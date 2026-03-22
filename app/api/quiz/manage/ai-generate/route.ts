import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession } from '@/lib/auth'

const MINIMAX_API_URL = 'https://api.minimaxi.com/anthropic'
const MINIMAX_SEARCH_URL = 'https://api.minimaxi.com/v1/coding_plan/search'
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || ''
const MINIMAX_MODEL = 'MiniMax-M2.7'

// Maximum number of tool call rounds per generation request
const MAX_TOOL_ROUNDS = 5

// ── MiniMax Coding Plan Search API ──────────────────────────────────────────
async function minimaxWebSearch(query: string): Promise<{
  organic: { title: string; link: string; snippet: string; date?: string }[]
  related_searches: { query: string }[]
} | null> {
  try {
    const response = await fetch(MINIMAX_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MINIMAX_API_KEY}`,
      },
      body: JSON.stringify({ q: query }),
    })
    if (!response.ok) {
      console.error('MiniMax search error:', response.status, await response.text())
      return null
    }
    return await response.json()
  } catch (e) {
    console.error('MiniMax search exception:', e)
    return null
  }
}

// ── Fetch a web page and extract text content ──────────────────────────────
async function fetchWebPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000), // 15s timeout
    })
    if (!response.ok) {
      console.error(`Web fetch error: ${response.status} for ${url}`)
      return null
    }
    const html = await response.text()
    // Strip HTML to extract readable text
    return htmlToText(html)
  } catch (e) {
    console.error('Web fetch exception:', e)
    return null
  }
}

// ── Simple HTML to text converter ───────────────────────────────────────────
function htmlToText(html: string): string {
  let text = html
  // Remove script and style blocks
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '')
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '')
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, '')
  // Replace common block-level tags with newlines
  text = text.replace(/<\/(p|div|h[1-6]|li|tr|br|hr)[^>]*>/gi, '\n')
  text = text.replace(/<br[^>]*\/?>/gi, '\n')
  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '')
  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, ' ')
  text = text.replace(/&lt;/g, '<')
  text = text.replace(/&gt;/g, '>')
  text = text.replace(/&amp;/g, '&')
  text = text.replace(/&quot;/g, '"')
  text = text.replace(/&#39;/g, "'")
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
  // Clean up whitespace
  text = text.replace(/[ \t]+/g, ' ')
  text = text.replace(/\n\s*\n/g, '\n\n')
  text = text.trim()
  // Limit to ~8000 chars to avoid overloading AI context
  if (text.length > 8000) {
    text = text.substring(0, 8000) + '\n\n[...内容已截断，仅显示前8000字符]'
  }
  return text
}

// ── Anthropic tool definitions ──────────────────────────────────────────────
const WEB_SEARCH_TOOL = {
  name: 'web_search',
  description: `搜索互联网获取最新信息。当你需要查找特定知识点、验证事实、获取最新教学内容时，使用此工具。
返回结构化搜索结果，包含标题、链接和摘要。
使用建议：用3-5个关键词搜索效果最佳。`,
  input_schema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: '搜索查询词，建议3-5个关键词',
      },
    },
    required: ['query'],
  },
}

const WEB_FETCH_TOOL = {
  name: 'web_fetch',
  description: `读取指定网页的完整内容。当用户提供了具体的 URL 链接时，你必须使用此工具来获取网页内容。
使用场景：
- 用户粘贴了一个网页链接，要求从中提取题目
- 需要读取某个网页上的具体内容
- 需要获取链接中的文章、题目、教材等内容
注意：URL 必须是完整的 http/https 开头的链接。`,
  input_schema: {
    type: 'object' as const,
    properties: {
      url: {
        type: 'string',
        description: '要读取的网页完整 URL，必须以 http:// 或 https:// 开头',
      },
    },
    required: ['url'],
  },
}

// ── Call MiniMax Anthropic API (non-streaming, for tool_use loop) ────────────
async function callMiniMaxAPI(messages: any[], system: string, useTools: boolean = true): Promise<any> {
  const body: any = {
    model: MINIMAX_MODEL,
    max_tokens: 16384,
    thinking: { type: 'enabled', budget_tokens: 4096 },
    system,
    messages,
  }
  if (useTools) {
    body.tools = [WEB_SEARCH_TOOL, WEB_FETCH_TOOL]
  }

  const response = await fetch(`${MINIMAX_API_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': MINIMAX_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`MiniMax API error ${response.status}: ${errorText}`)
  }

  const result = await response.json()
  // Log content block types for debugging
  if (result.content) {
    const blockTypes = result.content.map((b: any) => b.type).join(', ')
    console.log(`[MiniMax API] stop_reason=${result.stop_reason}, blocks=[${blockTypes}]`)
  }
  return result
}

// ── Stream the final generation call (for progress updates) ─────────────────
async function callMiniMaxStreaming(messages: any[], system: string): Promise<Response> {
  const response = await fetch(`${MINIMAX_API_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': MINIMAX_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MINIMAX_MODEL,
      max_tokens: 16384,
      stream: true,
      thinking: { type: 'enabled', budget_tokens: 4096 },
      system,
      messages,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`MiniMax API error ${response.status}: ${errorText}`)
  }

  return response
}

// ── Extract text from Anthropic response content blocks ─────────────────────
function extractTextFromContent(content: any[]): string {
  const raw = content
    .filter((block: any) => block.type === 'text')
    .map((block: any) => block.text)
    .join('')
  // Clean up any MiniMax-specific XML tags that may leak into text output
  return cleanMiniMaxTags(raw)
}

// ── Strip MiniMax proprietary XML tags from AI output ───────────────────────
function cleanMiniMaxTags(text: string): string {
  // Remove <minimax:thinking>...</minimax:thinking> and similar tags
  return text
    .replace(/<minimax:[^>]*>[\s\S]*?<\/minimax:[^>]*>/g, '')
    .replace(/<minimax:[^>]*\/>/g, '')
    .replace(/<minimax:[^>]*>/g, '')
    .trim()
}

// ── Extract tool_use blocks from Anthropic response ─────────────────────────
function extractToolUseBlocks(content: any[]): any[] {
  return content.filter((block: any) => block.type === 'tool_use')
}

// POST /api/quiz/manage/ai-generate — Generate quiz questions via AI with web search
// Supports multi-round tool_use: AI can search the web for knowledge before generating
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'parent') {
      return NextResponse.json({ error: '仅家长可管理题库' }, { status: 403 })
    }

    const { prompt, count, enableSearch } = await request.json()
    if (!prompt?.trim()) {
      return NextResponse.json({ error: '请输入生成要求' }, { status: 400 })
    }

    const questionCount = Math.min(Math.max(1, count || 5), 20)
    const searchEnabled = enableSearch !== false // default true

    // Build the AI prompt for question generation
    const systemPrompt = `你是一个专业的小学教育题库编辑。用户会用自然语言描述他们想要什么样的题目，你需要根据要求生成高质量的选择题。

${searchEnabled ? `## 联网能力
你有两个联网工具可以使用：

### web_fetch — 读取指定网页
当用户的要求中包含 URL 链接（http:// 或 https:// 开头的地址）时，你**必须**首先使用 web_fetch 工具读取该网页的完整内容。这是最高优先级操作。
典型场景：
- 用户粘贴了一个题目网页链接，要求导入其中的题目
- 用户提供了教材或文章链接，要求基于内容出题
- 用户分享了任何网页链接，要求从中提取信息

### web_search — 搜索互联网
当遇到以下情况时，使用 web_search 搜索：
- 用户要求的知识点你不够确定（如具体的科学常识、历史事件、地理数据等）
- 用户要求的内容涉及最新信息（如时事、新课标等）
- 题目需要精确的数据或事实
- 用户明确要求搜索或使用最新内容

搜索建议：每次搜索用3-5个精准关键词，可以搜索多次以覆盖不同知识点。

### 重要规则
- 如果用户提供了 URL，你必须先用 web_fetch 读取内容，然后基于网页中的实际内容来生成题目
- 从网页提取的题目要尽量保持原题的知识点和难度，但必须转换为四选一的选择题格式
- 如果原题不是选择题（如填空题、应用题），需要基于同一知识点改编为选择题

` : ''}## 输出格式要求
你必须输出一个 JSON 数组，每个元素是一道题目对象。格式如下：
\`\`\`json
[
  {
    "subject": "数学",
    "gradeMin": 3,
    "gradeMax": 6,
    "difficulty": 1,
    "question": "题目内容",
    "optionA": "选项A",
    "optionB": "选项B",
    "optionC": "选项C",
    "optionD": "选项D",
    "correctIndex": 0,
    "timeLimit": 10,
    "category": "分类"
  }
]
\`\`\`

## 字段说明
- subject: 必须是 "数学"、"语文"、"英语"、"科学" 之一
- gradeMin / gradeMax: 适用年级范围，1-6
- difficulty: 1=简单, 2=中等, 3=困难
- question: 题目内容，简洁明了
- optionA ~ optionD: 四个选项
- correctIndex: 正确答案索引，0=A, 1=B, 2=C, 3=D
- timeLimit: 答题限时（秒），简单题10秒，中等15秒，困难20秒
- category: 细分类别，如"加减法"、"乘除法"、"古诗词"、"单词拼写"等

## 生成规则
1. 题目内容必须准确无误，正确答案必须确实是正确的
2. 干扰选项要有一定迷惑性，但不能有歧义
3. 适合小学生的认知水平
4. 如果用户没有指定学科，根据内容自动判断
5. 如果用户没有指定难度，生成混合难度的题目
6. 如果用户没有指定数量，生成 ${questionCount} 道题
7. 英语题目的选项可以是英文

## 重要
- 最终输出只有 JSON 数组，不要输出任何其他内容
- 不要使用 markdown 代码块包裹
- 确保 JSON 格式正确可解析`

    // Detect URLs in the prompt
    const urlPattern = /https?:\/\/[^\s]+/g
    const detectedUrls = prompt.trim().match(urlPattern)
    const hasUrl = detectedUrls && detectedUrls.length > 0

    let userPrompt: string
    if (hasUrl && searchEnabled) {
      // URL detected — instruct AI to fetch the page first
      userPrompt = `请根据以下要求生成选择题：

${prompt.trim()}

**重要：你的要求中包含了网页链接，请务必先使用 web_fetch 工具读取网页内容，然后基于网页中的实际题目/内容来生成 ${questionCount} 道选择题。**
如果网页中的题目不是选择题格式，请基于同一知识点改编为四选一的选择题。
请直接输出 JSON 数组，不要包含任何其他文字。`
    } else {
      userPrompt = `请根据以下要求生成 ${questionCount} 道选择题：

${prompt.trim()}

${searchEnabled ? '如果需要查找相关知识点来确保题目准确性，请先使用 web_search 工具搜索。' : ''}
请直接输出 JSON 数组，不要包含任何其他文字。`
    }

    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        }

        try {
          sendEvent({ type: 'status', message: '🤔 AI 正在分析要求...' })

          // Build message history for multi-turn tool use
          const messages: any[] = [
            { role: 'user', content: userPrompt },
          ]

          let fullText = ''
          let searchCount = 0
          let fetchCount = 0

          if (searchEnabled) {
            // ── Phase 1: Tool use loop (non-streaming) ──────────────────────
            // AI may call web_search 0-N times before generating the final answer
            for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
              const apiResult = await callMiniMaxAPI(messages, systemPrompt, true)

              // Check if AI wants to use tools
              const toolUseBlocks = extractToolUseBlocks(apiResult.content)

              if (toolUseBlocks.length === 0 || apiResult.stop_reason === 'end_turn') {
                // AI is done with tools, extract the text answer
                fullText = extractTextFromContent(apiResult.content)
                break
              }

              // AI wants to search — process each tool call
              // Add assistant message with all content blocks to history
              messages.push({ role: 'assistant', content: apiResult.content })

              // Process tool calls and build tool_result messages
              const toolResults: any[] = []
              for (const toolBlock of toolUseBlocks) {
                if (toolBlock.name === 'web_search' && toolBlock.input?.query) {
                  searchCount++
                  const query = toolBlock.input.query
                  sendEvent({
                    type: 'status',
                    message: `🔍 正在搜索: "${query}" (第${searchCount}次搜索)...`,
                  })

                  const searchResult = await minimaxWebSearch(query)

                  if (searchResult && searchResult.organic?.length > 0) {
                    // Format search results for AI
                    const formattedResults = searchResult.organic
                      .slice(0, 8) // limit to top 8 results
                      .map((r, i) => `${i + 1}. **${r.title}**\n   ${r.snippet}\n   来源: ${r.link}${r.date ? ` (${r.date})` : ''}`)
                      .join('\n\n')

                    const relatedStr = searchResult.related_searches?.length
                      ? `\n\n相关搜索建议: ${searchResult.related_searches.slice(0, 3).map(r => r.query).join('、')}`
                      : ''

                    toolResults.push({
                      type: 'tool_result',
                      tool_use_id: toolBlock.id,
                      content: `搜索"${query}"的结果：\n\n${formattedResults}${relatedStr}`,
                    })

                    sendEvent({
                      type: 'status',
                      message: `✅ 搜索完成，找到 ${searchResult.organic.length} 条结果`,
                    })
                  } else {
                    toolResults.push({
                      type: 'tool_result',
                      tool_use_id: toolBlock.id,
                      content: `搜索"${query}"未找到相关结果。请尝试换个关键词，或直接根据你的知识生成题目。`,
                    })

                    sendEvent({
                      type: 'status',
                      message: '⚠️ 搜索未找到结果，AI 将使用自身知识生成',
                    })
                  }
                } else if (toolBlock.name === 'web_fetch' && toolBlock.input?.url) {
                  fetchCount++
                  const url = toolBlock.input.url
                  sendEvent({
                    type: 'status',
                    message: `🌐 正在读取网页: ${url.length > 50 ? url.substring(0, 50) + '...' : url}`,
                  })

                  const pageContent = await fetchWebPage(url)

                  if (pageContent) {
                    toolResults.push({
                      type: 'tool_result',
                      tool_use_id: toolBlock.id,
                      content: `网页 ${url} 的内容：\n\n${pageContent}`,
                    })

                    sendEvent({
                      type: 'status',
                      message: `✅ 网页读取完成（${pageContent.length} 字符）`,
                    })
                  } else {
                    toolResults.push({
                      type: 'tool_result',
                      tool_use_id: toolBlock.id,
                      content: `无法读取网页 ${url}，可能是网页不存在或访问被拒绝。请尝试使用 web_search 搜索相关内容。`,
                    })

                    sendEvent({
                      type: 'status',
                      message: '⚠️ 网页读取失败，AI 将尝试其他方式',
                    })
                  }
                } else {
                  // Unknown tool, return error
                  toolResults.push({
                    type: 'tool_result',
                    tool_use_id: toolBlock.id,
                    content: '未知工具，请直接生成题目。',
                    is_error: true,
                  })
                }
              }

              // Add tool results to messages
              messages.push({ role: 'user', content: toolResults })
            }

            // If we exhausted tool rounds but still no text, do a final non-tool call
            if (!fullText) {
              sendEvent({ type: 'status', message: '✍️ 正在生成题目...' })
              const finalResult = await callMiniMaxAPI(messages, systemPrompt, false)
              fullText = extractTextFromContent(finalResult.content)
            }
          }

          if (!fullText) {
            // ── Phase 2: Streaming generation (no search or search done) ───
            sendEvent({ type: 'status', message: '✍️ 正在生成题目...' })

            // For non-search mode or when we need final streaming generation
            const streamResponse = await callMiniMaxStreaming(
              searchEnabled ? messages : [{ role: 'user', content: userPrompt }],
              systemPrompt
            )

            const upstreamBody = streamResponse.body
            if (!upstreamBody) {
              sendEvent({ type: 'error', message: 'No response body' })
              controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
              controller.close()
              return
            }

            const reader = upstreamBody.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            let thinkingDone = false

            while (true) {
              const { done, value } = await reader.read()
              if (done) break

              buffer += decoder.decode(value, { stream: true })
              const lines = buffer.split('\n')
              buffer = lines.pop() || ''

              for (const line of lines) {
                const trimmed = line.trim()
                if (!trimmed.startsWith('data: ')) continue
                const data = trimmed.slice(6).trim()
                if (data === '[DONE]') continue

                try {
                  const parsed = JSON.parse(data)

                  if (parsed.type === 'content_block_start') {
                    if (parsed.content_block?.type === 'text' && !thinkingDone) {
                      thinkingDone = true
                      sendEvent({ type: 'status', message: '✍️ 正在生成题目...' })
                    }
                  }

                  if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta' && parsed.delta?.text) {
                    fullText += parsed.delta.text
                    sendEvent({ type: 'progress', textLength: fullText.length })
                  }
                } catch {
                  // Skip unparseable lines
                }
              }
            }
          }

          // ── Phase 3: Parse and save questions ───────────────────────────
          sendEvent({ type: 'status', message: '📋 解析题目中...' })

          // Clean minimax tags from streaming output too
          fullText = cleanMiniMaxTags(fullText)

          let jsonText = fullText.trim()
          if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
          }
          const arrayMatch = jsonText.match(/\[[\s\S]*\]/)
          if (arrayMatch) {
            jsonText = arrayMatch[0]
          }

          let questions: any[]
          try {
            questions = JSON.parse(jsonText)
          } catch (parseErr) {
            // Send error with preview for debugging
            const preview = fullText.substring(0, 200).replace(/\n/g, '\\n')
            sendEvent({
              type: 'error',
              message: `AI 返回的内容格式不正确，请重试`,
              rawPreview: preview,
            })
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
            controller.close()
            return
          }

          if (!Array.isArray(questions) || questions.length === 0) {
            sendEvent({ type: 'error', message: 'AI 返回的内容无法解析为题目列表' })
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
            controller.close()
            return
          }

          // Validate and insert questions
          const sqlite = (db as any).session.client
          const insertStmt = sqlite.prepare(`
            INSERT INTO quiz_questions (subject, grade_min, grade_max, difficulty, question, option_a, option_b, option_c, option_d, correct_index, time_limit, category)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)

          const validSubjects = ['数学', '语文', '英语', '科学']
          const savedQuestions: any[] = []
          const errors: string[] = []

          for (let i = 0; i < questions.length; i++) {
            const q = questions[i]
            try {
              const subject = validSubjects.includes(q.subject) ? q.subject : '数学'
              const gradeMin = Math.max(1, Math.min(6, q.gradeMin || 3))
              const gradeMax = Math.max(gradeMin, Math.min(6, q.gradeMax || 6))
              const difficulty = Math.max(1, Math.min(3, q.difficulty || 1))
              const question = String(q.question || '').trim()
              const optionA = String(q.optionA || '').trim()
              const optionB = String(q.optionB || '').trim()
              const optionC = String(q.optionC || '').trim()
              const optionD = String(q.optionD || '').trim()
              const correctIndex = Math.max(0, Math.min(3, q.correctIndex ?? 0))
              const timeLimit = Math.max(5, Math.min(60, q.timeLimit || 10))
              const category = String(q.category || '').trim() || null

              if (!question || !optionA || !optionB || !optionC || !optionD) {
                errors.push(`第 ${i + 1} 题：缺少必要字段，已跳过`)
                continue
              }

              const result = insertStmt.run(
                subject, gradeMin, gradeMax, difficulty,
                question, optionA, optionB, optionC, optionD,
                correctIndex, timeLimit, category
              )

              savedQuestions.push({
                id: result.lastInsertRowid,
                subject, gradeMin, gradeMax, difficulty,
                question, optionA, optionB, optionC, optionD,
                correctIndex, timeLimit, category: category || '',
              })
            } catch (e) {
              errors.push(`第 ${i + 1} 题：保存失败 - ${e instanceof Error ? e.message : '未知错误'}`)
            }
          }

          sendEvent({
            type: 'result',
            questions: savedQuestions,
            totalGenerated: questions.length,
            totalSaved: savedQuestions.length,
            errors,
            searchUsed: searchCount > 0,
            searchCount,
            fetchUsed: fetchCount > 0,
            fetchCount,
          })

        } catch (e) {
          console.error('AI generate error:', e)
          const message = e instanceof Error ? e.message : '生成失败'
          // Check for rate limit
          if (message.includes('429') || message.includes('rate_limit')) {
            sendEvent({ type: 'error', message: 'AI 服务调用次数已达上限，请稍后再试' })
          } else {
            sendEvent({
              type: 'error',
              message: `AI 生成出错: ${message.substring(0, 100)}`,
            })
          }
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
    console.error('POST /api/quiz/manage/ai-generate error:', error)
    return NextResponse.json({ error: '生成失败，请重试' }, { status: 500 })
  }
}
