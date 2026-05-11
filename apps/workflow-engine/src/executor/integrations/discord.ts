/**
 * Discord webhook integration.
 *
 * Node config shape:
 * {
 *   "integration":  "discord",
 *   "webhookUrl":   "https://discord.com/api/webhooks/...",
 *   "message":      "Deploy succeeded: {{repo}}",   // supports templates
 *   "username":     "SyncHive",                     // optional bot name override
 *   "avatarUrl":    "https://..."                   // optional avatar override
 * }
 */

export interface DiscordConfig {
  webhookUrl: string
  message: string
  username?: string
  avatarUrl?: string
  embeds?: DiscordEmbed[]
}

export interface DiscordEmbed {
  title?: string
  description?: string
  color?: number
  fields?: { name: string; value: string; inline?: boolean }[]
}

export interface DiscordResult {
  messageId: string | null
  channelId: string | null
  sentAt: string
}

export async function postDiscordMessage(config: DiscordConfig): Promise<DiscordResult> {
  const webhookUrl = config.webhookUrl ?? process.env.DISCORD_WEBHOOK_URL
  if (!webhookUrl) {
    throw new Error('Discord: "webhookUrl" is required in node config (or set DISCORD_WEBHOOK_URL env var)')
  }
  if (!config.message?.trim() && !config.embeds?.length) {
    throw new Error('Discord: either "message" or "embeds" is required')
  }

  // Add ?wait=true to get the message object back (for the ID)
  const url = webhookUrl.includes('?') ? `${webhookUrl}&wait=true` : `${webhookUrl}?wait=true`

  const payload: Record<string, unknown> = {
    content:    config.message?.trim() || undefined,
    username:   config.username ?? 'SyncHive',
    avatar_url: config.avatarUrl,
    embeds:     config.embeds?.length ? config.embeds : undefined,
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({})) as Record<string, unknown>
    throw new Error(`Discord webhook error ${response.status}: ${JSON.stringify(errBody)}`)
  }

  // Discord returns the message object when ?wait=true
  const data = await response.json().catch(() => ({})) as Record<string, unknown>

  return {
    messageId:  (data.id as string) ?? null,
    channelId:  (data.channel_id as string) ?? null,
    sentAt:     new Date().toISOString(),
  }
}
