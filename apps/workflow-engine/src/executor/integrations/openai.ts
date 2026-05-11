/**
 * Groq AI integration — OpenAI-compatible API.
 *
 * Groq provides free, ultra-fast inference for open-source models
 * (Llama 3, Gemma 2, Mixtral) via an OpenAI-compatible endpoint.
 * Get your free API key at: https://console.groq.com/keys
 *
 * Node config shape:
 * {
 *   "model":        "llama-3.3-70b-versatile",  // any Groq model
 *   "systemPrompt": "You are helpful.",          // optional
 *   "prompt":       "Summarize: {{input}}",      // required, supports templates
 *   "temperature":  0.7,                         // 0-2, default 0.7
 *   "maxTokens":    1000                         // default 1000
 * }
 *
 * Supported models (as of 2025):
 *   llama-3.3-70b-versatile  — best quality, 128k context
 *   llama-3.1-8b-instant     — fastest, great for simple tasks
 *   gemma2-9b-it             — Google Gemma 2
 *   mixtral-8x7b-32768       — Mixtral MoE
 *   llama-guard-3-8b         — content moderation
 */

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

export interface AIConfig {
  model: string;
  systemPrompt?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIResult {
  model: string;
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
  completedAt: string;
}

interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface GroqResponse {
  id: string;
  model: string;
  choices: {
    message: { role: string; content: string };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function callAI(config: AIConfig): Promise<AIResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY environment variable is not set. " +
        "Get your free API key at https://console.groq.com/keys and add it to .env"
    );
  }

  if (!config.prompt?.trim()) {
    throw new Error('AI node requires a non-empty "prompt" in config');
  }

  const model = config.model ?? "llama-3.3-70b-versatile";
  const temperature = Math.min(2, Math.max(0, config.temperature ?? 0.7));
  // Groq limits vary per model; cap at 32768 to be safe
  const maxTokens = Math.min(32768, Math.max(1, config.maxTokens ?? 1000));

  const messages: GroqMessage[] = [];
  if (config.systemPrompt?.trim()) {
    messages.push({ role: "system", content: config.systemPrompt.trim() });
  }
  messages.push({ role: "user", content: config.prompt.trim() });

  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errBody = await response
      .json()
      .catch(() => ({ error: { message: response.statusText } }));
    const errMsg =
      (errBody as { error?: { message?: string } })?.error?.message ??
      response.statusText;
    throw new Error(`Groq API error ${response.status}: ${errMsg}`);
  }

  const data = (await response.json()) as GroqResponse;
  const choice = data.choices[0];

  return {
    model: data.model,
    content: choice.message.content,
    usage: {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    },
    finishReason: choice.finish_reason,
    completedAt: new Date().toISOString(),
  };
}
