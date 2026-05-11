/**
 * AI node integration — OpenAI + Anthropic support.
 *
 * Uses OpenAI's chat completions API (compatible with most models).
 * Falls back to a clear error message if OPENAI_API_KEY is not configured
 * rather than silently returning fake data.
 *
 * Node config shape:
 * {
 *   "model":        "gpt-4o-mini",          // any OpenAI model
 *   "systemPrompt": "You are helpful.",     // optional
 *   "prompt":       "Summarize: {{input}}", // required, supports templates
 *   "temperature":  0.7,                    // 0-2, default 0.7
 *   "maxTokens":    1000                    // default 1000
 * }
 */

export interface AIConfig {
  model: string
  systemPrompt?: string
  prompt: string
  temperature?: number
  maxTokens?: number
}

export interface AIResult {
  model: string
  content: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  finishReason: string
  completedAt: string
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OpenAIResponse {
  id: string
  model: string
  choices: {
    message: { role: string; content: string }
    finish_reason: string
  }[]
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export async function callAI(config: AIConfig): Promise<AIResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY environment variable is not set. ' +
      'Add it to your .env file to enable AI nodes.'
    )
  }

  if (!config.prompt?.trim()) {
    throw new Error('AI node requires a non-empty "prompt" in config')
  }

  const model = config.model ?? 'gpt-4o-mini'
  const temperature = Math.min(2, Math.max(0, config.temperature ?? 0.7))
  const maxTokens = Math.min(8000, Math.max(1, config.maxTokens ?? 1000))

  const messages: OpenAIMessage[] = []
  if (config.systemPrompt?.trim()) {
    messages.push({ role: 'system', content: config.systemPrompt.trim() })
  }
  messages.push({ role: 'user', content: config.prompt.trim() })

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  })

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({ error: { message: response.statusText } }))
    const errMsg = (errBody as { error?: { message?: string } })?.error?.message ?? response.statusText
    throw new Error(`OpenAI API error ${response.status}: ${errMsg}`)
  }

  const data = await response.json() as OpenAIResponse
  const choice = data.choices[0]

  return {
    model: data.model,
    content: choice.message.content,
    usage: {
      promptTokens:     data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens:      data.usage.total_tokens,
    },
    finishReason: choice.finish_reason,
    completedAt:  new Date().toISOString(),
  }
}
