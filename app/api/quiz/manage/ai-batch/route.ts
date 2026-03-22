import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession } from '@/lib/auth'

const MINIMAX_API_URL = 'https://api.minimaxi.com/anthropic'
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || ''
const MINIMAX_MODEL = 'MiniMax-M2.7'

// POST /api/quiz/manage/ai-batch — AI-powered batch operations on quiz questions
// The AI interprets a natural language instruction and determines which operations to perform
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'parent') {
      return NextResponse.json({ error: '仅家长可管理题库' }, { status: 403 })
    }

    const { instruction } = await request.json()
    if (!instruction?.trim()) {
      return NextResponse.json({ error: '请输入操作指令' }, { status: 400 })
    }

    const sqlite = (db as any).session.client

    // Gather current quiz stats for context
    const stats = sqlite.prepare(`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT subject) as subjectCount,
        GROUP_CONCAT(DISTINCT subject) as subjects,
        COUNT(DISTINCT category) as categoryCount,
        GROUP_CONCAT(DISTINCT category) as categories,
        MIN(difficulty) as minDiff,
        MAX(difficulty) as maxDiff
      FROM quiz_questions
    `).get() as any

    // Get sample questions to help AI understand the data
    const sampleQuestions = sqlite.prepare(`
      SELECT id, subject, difficulty, question, category, grade_min, grade_max, time_limit
      FROM quiz_questions ORDER BY RANDOM() LIMIT 10
    `).all() as any[]

    const systemPrompt = `你是一个题库管理助手。用户会用自然语言描述他们想对题库执行的批量操作，你需要将其翻译为具体的操作指令。

## 当前题库状态
- 总题目数: ${stats.total}
- 学科: ${stats.subjects || '无'}
- 分类: ${stats.categories || '无'}
- 难度范围: ${stats.minDiff}-${stats.maxDiff}

## 部分题目示例
${sampleQuestions.map(q => `[ID:${q.id}] ${q.subject}(${q.category || '无分类'}) 难度${q.difficulty} 年级${q.grade_min}-${q.grade_max}: ${q.question.substring(0, 50)}...`).join('\n')}

## 支持的操作类型
你必须输出一个 JSON 对象，包含以下结构：

\`\`\`json
{
  "operations": [
    {
      "type": "delete",
      "description": "操作描述（给用户看的）",
      "filter": {
        "subject": "数学",
        "difficulty": 1,
        "category": "加减法",
        "gradeMin": 3,
        "gradeMax": 4,
        "searchText": "关键词",
        "ids": [1, 2, 3]
      }
    },
    {
      "type": "update",
      "description": "操作描述",
      "filter": { ... },
      "changes": {
        "difficulty": 2,
        "subject": "科学",
        "gradeMin": 3,
        "gradeMax": 6,
        "timeLimit": 15,
        "category": "新分类"
      }
    }
  ],
  "summary": "总体操作概要（给用户看的简洁中文描述）",
  "warning": "如果操作有风险（如大批量删除），在这里提醒用户"
}
\`\`\`

## filter 字段说明
所有 filter 字段都是可选的，未指定的字段不参与筛选：
- subject: 学科筛选
- difficulty: 难度筛选 (1/2/3)
- category: 分类筛选
- gradeMin / gradeMax: 年级范围筛选
- searchText: 题目内容关键词搜索
- ids: 指定 ID 列表（优先级最高，如果提供了则忽略其他 filter）

## 重要规则
1. 只输出 JSON，不要有其他文字
2. 不要用 markdown 代码块包裹
3. 操作要准确反映用户的意图
4. 如果用户的指令不明确，选择最保守的理解
5. 如果操作影响大量题目（>50题），务必在 warning 中提醒
6. 如果用户的指令无法翻译为支持的操作，返回空 operations 数组并在 summary 中说明原因`

    const userPrompt = `请解析以下操作指令并生成操作计划：

${instruction.trim()}

请直接输出 JSON，不要包含其他文字。`

    // Call AI with thinking mode for better instruction understanding
    const apiResponse = await fetch(`${MINIMAX_API_URL}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': MINIMAX_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MINIMAX_MODEL,
        max_tokens: 8192,
        stream: true,
        thinking: { type: 'enabled', budget_tokens: 2048 },
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt },
        ],
      }),
    })

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text()
      console.error('MiniMax API error:', apiResponse.status, errorText)
      return NextResponse.json({ error: 'AI 服务不可用，请稍后重试' }, { status: 502 })
    }

    // Stream response for progress, then parse and execute
    const encoder = new TextEncoder()
    const upstreamBody = apiResponse.body

    const stream = new ReadableStream({
      async start(controller) {
        if (!upstreamBody) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'No response body' })}\n\n`))
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
          controller.close()
          return
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'status', message: '🤔 AI 正在分析指令...' })}\n\n`))

        const reader = upstreamBody.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        let fullText = ''
        let thinkingDone = false

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buf += decoder.decode(value, { stream: true })
            const lines = buf.split('\n')
            buf = lines.pop() || ''

            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed.startsWith('data: ')) continue
              const data = trimmed.slice(6).trim()
              if (data === '[DONE]') continue

              try {
                const parsed = JSON.parse(data)
                if (parsed.type === 'content_block_start' && parsed.content_block?.type === 'text' && !thinkingDone) {
                  thinkingDone = true
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'status', message: '📋 生成操作计划...' })}\n\n`))
                }
                if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta' && parsed.delta?.text) {
                  fullText += parsed.delta.text
                }
              } catch {
                // skip
              }
            }
          }
        } catch (e) {
          console.error('Stream reading error:', e)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: '流读取错误' })}\n\n`))
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
          controller.close()
          return
        }

        // Parse AI response
        try {
          let jsonText = fullText.trim()
          if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
          }
          const objMatch = jsonText.match(/\{[\s\S]*\}/)
          if (objMatch) {
            jsonText = objMatch[0]
          }

          const plan = JSON.parse(jsonText)

          if (!plan.operations || !Array.isArray(plan.operations)) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'plan',
              operations: [],
              summary: plan.summary || 'AI 无法理解该指令',
              warning: plan.warning || '',
            })}\n\n`))
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
            controller.close()
            return
          }

          // Count affected rows for each operation (preview mode)
          for (const op of plan.operations) {
            const { conditions, params } = buildWhereClause(op.filter || {})
            const whereStr = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
            const countResult = sqlite.prepare(`SELECT COUNT(*) as cnt FROM quiz_questions ${whereStr}`).get(...params) as any
            op.affectedCount = countResult.cnt
          }

          // Send plan to client for confirmation
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'plan',
            operations: plan.operations,
            summary: plan.summary || '',
            warning: plan.warning || '',
          })}\n\n`))

        } catch (e) {
          console.error('Plan parse error:', e, 'Raw:', fullText.substring(0, 500))
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            message: 'AI 返回格式不正确，请重新描述操作',
          })}\n\n`))
        }

        controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('POST /api/quiz/manage/ai-batch error:', error)
    return NextResponse.json({ error: '操作失败，请重试' }, { status: 500 })
  }
}

// PUT /api/quiz/manage/ai-batch — Execute a confirmed batch operation plan
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'parent') {
      return NextResponse.json({ error: '仅家长可管理题库' }, { status: 403 })
    }

    const { operations } = await request.json()
    if (!Array.isArray(operations) || operations.length === 0) {
      return NextResponse.json({ error: '无操作可执行' }, { status: 400 })
    }

    const sqlite = (db as any).session.client
    const results: { description: string; affected: number; success: boolean; error?: string }[] = []

    for (const op of operations) {
      try {
        const { conditions, params } = buildWhereClause(op.filter || {})
        const whereStr = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

        if (op.type === 'delete') {
          const result = sqlite.prepare(`DELETE FROM quiz_questions ${whereStr}`).run(...params)
          results.push({ description: op.description, affected: result.changes, success: true })
        } else if (op.type === 'update' && op.changes) {
          const setClauses: string[] = []
          const setParams: any[] = []

          if (op.changes.difficulty !== undefined) {
            setClauses.push('difficulty = ?')
            setParams.push(Math.max(1, Math.min(3, op.changes.difficulty)))
          }
          if (op.changes.subject) {
            setClauses.push('subject = ?')
            setParams.push(op.changes.subject)
          }
          if (op.changes.gradeMin !== undefined) {
            setClauses.push('grade_min = ?')
            setParams.push(Math.max(1, Math.min(6, op.changes.gradeMin)))
          }
          if (op.changes.gradeMax !== undefined) {
            setClauses.push('grade_max = ?')
            setParams.push(Math.max(1, Math.min(6, op.changes.gradeMax)))
          }
          if (op.changes.timeLimit !== undefined) {
            setClauses.push('time_limit = ?')
            setParams.push(Math.max(5, Math.min(60, op.changes.timeLimit)))
          }
          if (op.changes.category !== undefined) {
            setClauses.push('category = ?')
            setParams.push(op.changes.category || null)
          }

          if (setClauses.length > 0) {
            const result = sqlite.prepare(
              `UPDATE quiz_questions SET ${setClauses.join(', ')} ${whereStr}`
            ).run(...setParams, ...params)
            results.push({ description: op.description, affected: result.changes, success: true })
          } else {
            results.push({ description: op.description, affected: 0, success: false, error: '无有效更新字段' })
          }
        } else {
          results.push({ description: op.description, affected: 0, success: false, error: '不支持的操作类型' })
        }
      } catch (e) {
        results.push({
          description: op.description,
          affected: 0,
          success: false,
          error: e instanceof Error ? e.message : '未知错误',
        })
      }
    }

    return NextResponse.json({
      success: true,
      results,
      totalAffected: results.reduce((sum, r) => sum + r.affected, 0),
    })
  } catch (error) {
    console.error('PUT /api/quiz/manage/ai-batch error:', error)
    return NextResponse.json({ error: '执行失败，请重试' }, { status: 500 })
  }
}

// Helper: build WHERE clause from filter object
function buildWhereClause(filter: any): { conditions: string[]; params: any[] } {
  const conditions: string[] = []
  const params: any[] = []

  // IDs take priority
  if (filter.ids && Array.isArray(filter.ids) && filter.ids.length > 0) {
    const placeholders = filter.ids.map(() => '?').join(',')
    conditions.push(`id IN (${placeholders})`)
    params.push(...filter.ids)
    return { conditions, params }
  }

  if (filter.subject) {
    conditions.push('subject = ?')
    params.push(filter.subject)
  }
  if (filter.difficulty !== undefined) {
    conditions.push('difficulty = ?')
    params.push(filter.difficulty)
  }
  if (filter.category) {
    conditions.push('category = ?')
    params.push(filter.category)
  }
  if (filter.gradeMin !== undefined) {
    conditions.push('grade_min >= ?')
    params.push(filter.gradeMin)
  }
  if (filter.gradeMax !== undefined) {
    conditions.push('grade_max <= ?')
    params.push(filter.gradeMax)
  }
  if (filter.searchText) {
    conditions.push('question LIKE ?')
    params.push(`%${filter.searchText}%`)
  }

  return { conditions, params }
}
