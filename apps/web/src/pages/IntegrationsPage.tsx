import { useState } from 'react'
import styles from './IntegrationsPage.module.css'

const INTEGRATIONS = [
  {
    id: 'http',
    name: 'HTTP / REST',
    description: 'Make HTTP requests to any API endpoint. Supports GET, POST, PUT, PATCH, DELETE with custom headers and body.',
    category: 'Core',
    status: 'built-in',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="9"/>
        <path d="M2 11h18M11 2c-2.5 3-4 5.5-4 9s1.5 6 4 9M11 2c2.5 3 4 5.5 4 9s-1.5 6-4 9"/>
      </svg>
    ),
    color: '#3B82F6',
    nodeType: 'action',
    docs: 'https://developer.mozilla.org/en-US/docs/Web/HTTP',
    fields: ['Method', 'URL', 'Headers', 'Body'],
  },
  {
    id: 'email',
    name: 'Email via Resend',
    description: 'Send transactional and marketing emails using the Resend API. Supports HTML templates and {{variable}} substitution.',
    category: 'Communication',
    status: 'env-key',
    envKey: 'RESEND_API_KEY',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="18" height="13" rx="2"/>
        <path d="M2 8l9 6 9-6"/>
      </svg>
    ),
    color: '#10B981',
    nodeType: 'action',
    docs: 'https://resend.com/docs',
    fields: ['To', 'Subject', 'Body (HTML)'],
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Post messages to Slack channels via Incoming Webhooks. Rich text and {{variable}} interpolation supported.',
    category: 'Communication',
    status: 'per-node',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.5 13.5a2 2 0 100-4 2 2 0 000 4z"/><path d="M13.5 8.5a2 2 0 100-4 2 2 0 000 4z"/>
        <path d="M13.5 8.5H17M5 13.5H8.5M13.5 13.5a2 2 0 100 4 2 2 0 000-4zM8.5 8.5a2 2 0 100-4 2 2 0 000 4z"/>
        <path d="M8.5 8.5V5M13.5 13.5v3"/>
      </svg>
    ),
    color: '#7C3AED',
    nodeType: 'action',
    docs: 'https://api.slack.com/messaging/webhooks',
    fields: ['Webhook URL', 'Channel', 'Message'],
  },
  {
    id: 'discord',
    name: 'Discord',
    description: 'Send messages to Discord channels using webhook URLs. Supports embeds and {{variable}} interpolation.',
    category: 'Communication',
    status: 'per-node',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.5 5A15 15 0 0011 4a15 15 0 00-6.5 1S3 9.5 3 13s1.5 4 1.5 4a13 13 0 005 1.5l1-2a9 9 0 01-2.5-1.5"/>
        <path d="M4.5 17A13 13 0 0011 18a13 13 0 006.5-1S19 14.5 19 11s-1.5-6-1.5-6a13 13 0 00-5-1.5"/>
        <circle cx="8.5" cy="12" r="1.5" fill="currentColor" stroke="none"/>
        <circle cx="13.5" cy="12" r="1.5" fill="currentColor" stroke="none"/>
      </svg>
    ),
    color: '#5865F2',
    nodeType: 'action',
    docs: 'https://discord.com/developers/docs/resources/webhook',
    fields: ['Webhook URL', 'Message', 'Username'],
  },
  {
    id: 'ai',
    name: 'AI (Groq)',
    description: 'Fast LLM inference via Groq. Supports Llama 3.3 70B, Gemma 2 9B, and Mixtral 8x7B with full prompt templating.',
    category: 'AI / ML',
    status: 'env-key',
    envKey: 'GROQ_API_KEY',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 3l2 5h5l-4 3 1.5 5L11 13l-4.5 3L8 11 4 8h5z"/>
      </svg>
    ),
    color: '#F59E0B',
    nodeType: 'ai',
    docs: 'https://console.groq.com/docs',
    fields: ['Model', 'System Prompt', 'User Prompt', 'Temperature', 'Max Tokens'],
    models: ['llama-3.3-70b-versatile', 'gemma2-9b-it', 'mixtral-8x7b-32768'],
  },
  {
    id: 'webhook',
    name: 'Webhook Receiver',
    description: 'Receive HTTP webhooks from GitHub, Stripe, or any service. Optional HMAC-SHA256 signature verification.',
    category: 'Triggers',
    status: 'built-in',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 3a8 8 0 100 16A8 8 0 0011 3z"/><path d="M3.5 11H11M11 3v8l4-4"/>
      </svg>
    ),
    color: '#EC4899',
    nodeType: 'trigger',
    docs: null,
    fields: ['Path', 'Action filter', 'Webhook Secret (HMAC)'],
  },
  {
    id: 'cron',
    name: 'Cron Scheduler',
    description: 'Schedule workflows to run automatically using cron expressions (e.g. 0 9 * * 1-5 for weekdays at 9am).',
    category: 'Triggers',
    status: 'built-in',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="9"/><path d="M11 6v5l3 3"/>
      </svg>
    ),
    color: '#14B8A6',
    nodeType: 'trigger',
    docs: 'https://crontab.guru',
    fields: ['Cron Expression', 'Timezone'],
  },
  {
    id: 'condition',
    name: 'Condition Branch',
    description: 'Evaluate a JavaScript expression and route execution down the true or false branch. Full condition branching support.',
    category: 'Logic',
    status: 'built-in',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 5v5M8 13l-3 4M14 13l3 4M5 11h12"/>
      </svg>
    ),
    color: '#8B5CF6',
    nodeType: 'condition',
    docs: null,
    fields: ['Expression (JS)', 'True label', 'False label'],
  },
  {
    id: 'transformer',
    name: 'Data Transformer',
    description: 'Transform data between nodes: pick fields, rename keys, merge objects, filter arrays, map values, or run custom JS.',
    category: 'Logic',
    status: 'built-in',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6h14M4 11h10M4 16h6"/><path d="M16 13l3 3-3 3"/>
      </svg>
    ),
    color: '#06B6D4',
    nodeType: 'transformer',
    docs: null,
    fields: ['Operation', 'Mapping config'],
  },
  {
    id: 'loop',
    name: 'Loop / Iterator',
    description: 'Iterate over an array from upstream node output. Each item\'s context is available to downstream nodes via {{variable}}.',
    category: 'Logic',
    status: 'built-in',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 11a7 7 0 0112.95-3.5M18 11a7 7 0 01-12.95 3.5"/>
        <path d="M17 4l3 3.5-3 3.5M5 11l-3 3.5 3 3.5"/>
      </svg>
    ),
    color: '#F97316',
    nodeType: 'loop',
    docs: null,
    fields: ['Array path', 'Item variable', 'Max iterations'],
  },
]

const CATEGORIES = ['All', 'Core', 'Triggers', 'Communication', 'AI / ML', 'Logic']

export function IntegrationsPage() {
  const [cat, setCat] = useState('All')

  const filtered = cat === 'All' ? INTEGRATIONS : INTEGRATIONS.filter(i => i.category === cat)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Integrations</h1>
          <p className={styles.sub}>{INTEGRATIONS.length} integrations available · All built-in, no plugins needed</p>
        </div>
        <div className={styles.statsRow}>
          <span className={styles.stat}><span className={styles.statNum}>{INTEGRATIONS.filter(i => i.status === 'built-in').length}</span> Built-in</span>
          <span className={styles.stat}><span className={styles.statNum}>{INTEGRATIONS.filter(i => i.status === 'env-key').length}</span> Env key</span>
          <span className={styles.stat}><span className={styles.statNum}>{INTEGRATIONS.filter(i => i.status === 'per-node').length}</span> Per-node</span>
        </div>
      </div>

      {/* Category tabs */}
      <div className={styles.tabs}>
        {CATEGORIES.map(c => (
          <button
            key={c}
            className={`${styles.tab} ${cat === c ? styles.tabActive : ''}`}
            onClick={() => setCat(c)}
          >
            {c}
            {c !== 'All' && (
              <span className={styles.tabCount}>{INTEGRATIONS.filter(i => i.category === c).length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Cards grid */}
      <div className={styles.grid}>
        {filtered.map((intg, i) => (
          <div key={intg.id} className={styles.card} style={{ animationDelay: `${i * 40}ms` }}>
            <div className={styles.cardTop}>
              <div className={styles.iconWrap} style={{ color: intg.color, background: `${intg.color}18`, border: `1px solid ${intg.color}30` }}>
                {intg.icon}
              </div>
              <StatusBadge status={intg.status} envKey={(intg as any).envKey} />
            </div>

            <div className={styles.cardBody}>
              <div className={styles.cardName}>{intg.name}</div>
              <div className={styles.cardCategory}>{intg.category} · <span className={styles.nodeType}>{intg.nodeType}</span></div>
              <p className={styles.cardDesc}>{intg.description}</p>
            </div>

            <div className={styles.cardFields}>
              {intg.fields.map(f => (
                <span key={f} className={styles.fieldChip}>{f}</span>
              ))}
            </div>

            {(intg as any).models && (
              <div className={styles.modelsRow}>
                <span className={styles.modelsLabel}>Models</span>
                <div className={styles.modelsList}>
                  {(intg as any).models.map((m: string) => (
                    <span key={m} className={styles.modelChip}>{m}</span>
                  ))}
                </div>
              </div>
            )}

            {intg.docs && (
              <a href={intg.docs} target="_blank" rel="noopener noreferrer" className={styles.docsLink}>
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 1H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V6M6 1h4v4M4.5 6.5l5-5"/>
                </svg>
                View docs
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function StatusBadge({ status, envKey }: { status: string; envKey?: string }) {
  if (status === 'built-in') return <span className={`${styles.badge} ${styles.badgeBuiltin}`}>Built-in</span>
  if (status === 'env-key')  return <span className={`${styles.badge} ${styles.badgeEnv}`} title={`Set ${envKey} in .env`}>Env: {envKey}</span>
  return <span className={`${styles.badge} ${styles.badgeNode}`}>Per-node config</span>
}
