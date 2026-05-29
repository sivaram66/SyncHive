/**
 * Resend email integration.
 *
 * Resend is a developer-first email API. We use their REST API directly
 * with fetch() instead of their SDK to keep dependencies minimal.
 *
 * Node config shape:
 * {
 *   "integration": "resend",
 *   "from": "SyncHive <onboarding@resend.dev>",   // must be verified domain or resend.dev for testing
 *   "to": "{{trigger.email}}",                     // supports template resolution
 *   "subject": "Welcome to {{trigger.name}}",
 *   "html": "<h1>Hello {{trigger.name}}</h1>",     // html OR text, not both required
 *   "text": "Hello {{trigger.name}}"               // plain text fallback
 * }
 *
 * Returns the Resend email ID on success, throws on failure.
 */

export interface ResendConfig {
  from?: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}

export interface ResendResult {
  emailId: string;
  to: string | string[];
  subject: string;
  sentAt: string;
}

export async function sendEmail(config: ResendConfig): Promise<ResendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY environment variable is not set');

  const from = config.from ?? 'SyncHive <onboarding@resend.dev>';

  if (!config.to) throw new Error('Resend: "to" is required');
  if (!config.subject) throw new Error('Resend: "subject" is required');
  if (!config.html && !config.text) throw new Error('Resend: either "html" or "text" is required');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(config.to) ? config.to : [config.to],
      subject: config.subject,
      ...(config.html ? { html: config.html } : {}),
      ...(config.text ? { text: config.text } : {}),
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(`Resend API error ${response.status}: ${JSON.stringify(error)}`);
  }

  const data = await response.json() as { id: string };

  return {
    emailId: data.id,
    to: config.to,
    subject: config.subject,
    sentAt: new Date().toISOString(),
  };
}