import { NextRequest } from 'next/server'

const MINIMAX_API_URL = 'https://api.minimaxi.com/anthropic'
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || ''
const MINIMAX_MODEL = 'MiniMax-M2.7'

// POST /api/quiz/explain — Stream AI explanation for a quiz question
export async function POST(request: NextRequest) {
  try {
    const { question, options, correctIndex, userAnswerIndex, subject, category } = await request.json()

    if (!question || options === undefined || correctIndex === undefined) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const labels = ['A', 'B', 'C', 'D']
    const optionsText = options.map((opt: string, i: number) => `${labels[i]}. ${opt}`).join('\n')

    // Support two modes:
    // 1. Preload mode (userAnswerIndex is undefined/null): Generate knowledge-focused explanation
    //    while the child is still answering. Does NOT reference what the child picked.
    // 2. Full mode (userAnswerIndex provided): Original personalized explanation.
    const isPreload = userAnswerIndex === undefined || userAnswerIndex === null
    const isCorrect = !isPreload && userAnswerIndex === correctIndex

    let prompt: string
    if (isPreload) {
      // Preload mode — pure knowledge explanation, called when question loads
      prompt = `你是一个温柔有耐心的老师，正在给一个小学生讲解一道${subject || ''}${category ? `（${category}）` : ''}题目。

题目：${question}
选项：
${optionsText}

正确答案：${labels[correctIndex]}（${options[correctIndex]}）

请用简单易懂的语言讲解这道题的知识点：
1. 解释为什么正确答案是 ${labels[correctIndex]}
2. 简单说明其他选项为什么不对（一两句话即可）
3. 讲解要简短（3-5句话），用孩子能理解的语言
4. 如果合适的话，可以用一个小例子或比喻帮助理解

注意：回答不要使用 markdown 格式，直接用纯文本。不要提及"你选了什么"，因为孩子还没有作答。要像跟孩子面对面说话一样自然。`
    } else {
      // Full mode — personalized explanation after answering
      prompt = `你是一个温柔有耐心的老师，正在给一个小学生讲解一道${subject || ''}${category ? `（${category}）` : ''}题目。

题目：${question}
选项：
${optionsText}

正确答案：${labels[correctIndex]}（${options[correctIndex]}）
孩子选了：${labels[userAnswerIndex]}（${options[userAnswerIndex]}）${isCorrect ? '（答对了！）' : '（答错了）'}

请用简单易懂、充满鼓励的语言给孩子讲解这道题：
1. ${isCorrect ? '先表扬孩子答对了，然后简单解释为什么这个答案是对的' : '先安慰孩子别灰心，然后解释为什么正确答案是对的，以及孩子选的答案为什么不对'}
2. 讲解要简短（3-5句话），用孩子能理解的语言
3. 如果合适的话，可以用一个小例子或比喻帮助理解
4. 结尾可以用一句鼓励的话

注意：回答不要使用 markdown 格式，直接用纯文本。要像跟孩子面对面说话一样自然。`
    }

    // Call MiniMax API (Anthropic-compatible format) with streaming
    // NOTE: MiniMax-M2.7 is a thinking model. max_tokens includes both thinking + text tokens.
    // We need a generous max_tokens so thinking doesn't consume the entire budget.
    const apiResponse = await fetch(`${MINIMAX_API_URL}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': MINIMAX_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MINIMAX_MODEL,
        max_tokens: 4096,
        stream: true,
        thinking: { type: 'enabled', budget_tokens: 1024 },
        messages: [
          { role: 'user', content: prompt },
        ],
      }),
    })

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text()
      console.error('MiniMax API error:', apiResponse.status, errorText)
      return new Response(JSON.stringify({ error: 'AI service unavailable' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // True streaming: pipe upstream SSE to client in real-time (no buffering).
    // This greatly reduces time-to-first-token for the user.
    const encoder = new TextEncoder()
    const upstreamBody = apiResponse.body
    const stream = new ReadableStream({
      async start(controller) {
        if (!upstreamBody) {
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
          controller.close()
          return
        }
        const reader = upstreamBody.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        try {
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
                if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta' && parsed.delta?.text) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`))
                }
              } catch {
                // Skip unparseable lines
              }
            }
          }
        } catch (e) {
          console.error('Stream reading error:', e)
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
    console.error('POST /api/quiz/explain error:', error)
    return new Response(JSON.stringify({ error: 'Failed to get explanation' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
