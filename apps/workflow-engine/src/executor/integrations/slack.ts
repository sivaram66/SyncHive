/**
 * Slack incoming webhook integration.
 *
 * Slack incoming webhooks are the simplest way to post messages to a channel.
 * No OAuth, no bot tokens — just a URL you POST JSON to.
 *
 * Node config shape:
 * {
 *   "integration": "slack",
 *   "webhookUrl": "https://hooks.slack.com/services/...",  // or use env var
 *   "text": "New signup: {{trigger.email}}",               // simple text message
 *   "blocks": [...]                                         // optional: rich Block Kit layout
 * }
 *
 * If "webhookUrl" is not in config, falls back to SLACK_WEBHOOK_URL env var.
 * This lets you have a default channel while allowing per-node overrides.
 *
 * Slack Block Kit reference: https://api.slack.com/block-kit
 */

export interface SlackConfig {
  webhookUrl?: string;
  text: string;
  blocks?: unknown[];  // Slack Block Kit blocks for rich formatting
  username?: string;   // override the bot display name
  iconEmoji?: string;  // override the bot icon e.g. ":robot_face:"
}

export interface SlackResult {
  channel: string;
  text: string;
  sentAt: string;
}

export async function postSlackMessage(config: SlackConfig): Promise<SlackResult> {
  const webhookUrl = config.webhookUrl ?? process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) throw new Error('Slack: "webhookUrl" config or SLACK_WEBHOOK_URL env var is required');
  if (!config.text) throw new Error('Slack: "text" is required');

  const payload: Record<string, unknown> = {
    text: config.text,
  };

  if (config.blocks) payload.blocks = config.blocks;
  if (config.username) payload.username = config.username;
  if (config.iconEmoji) payload.icon_emoji = config.iconEmoji;

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    // Slack returns plain text errors like "invalid_payload" or "no_service"
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`Slack webhook error ${response.status}: ${errorText}`);
  }

  // Extract channel name from webhook URL for logging
  // URL format: https://hooks.slack.com/services/T.../B.../...
  const urlParts = webhookUrl.split('/');
  const channelHint = urlParts.length > 5 ? `...${urlParts[urlParts.length - 1].slice(-6)}` : 'unknown';

  return {
    channel: channelHint,
    text: config.text,
    sentAt: new Date().toISOString(),
  };
}