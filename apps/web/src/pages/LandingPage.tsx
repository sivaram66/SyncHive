import { useNavigate } from 'react-router-dom'
import { useAuthStore, useThemeStore } from '@/lib/store'
import s from './LandingPage.module.css'

export function LandingPage() {
  const navigate = useNavigate()
  const { token } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const ctaLabel = token ? 'Open Dashboard' : 'Get started free'
  const ctaRoute = token ? '/workflows' : '/signup'

  return (
    <div className={s.page}>
      <div className={s.orb1} />
      <div className={s.orb2} />
      <div className={s.orb3} />

      {/* ── NAV ── */}
      <nav className={s.nav}>
        <div className={s.navLogo}>
          <div className={s.gem}><div className={s.gemInner} /></div>
          <span className={s.brand}>SyncHive</span>
          <span className={s.tag}>Engine</span>
        </div>
        <div className={s.navLinks}>
          <a className={s.navLink} href="#features">Features</a>
          <a className={s.navLink} href="#how">How it works</a>
          <a className={s.navLink} href="#execution">Execution</a>
          <a className={s.navLink} href="https://github.com" target="_blank" rel="noreferrer">GitHub</a>
        </div>
        <div className={s.navRight}>
          <button className={s.themeBtn} onClick={toggleTheme}>
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <button className={s.signIn} onClick={() => navigate('/login')}>Sign in</button>
          <button className={s.cta} onClick={() => navigate(ctaRoute)}>{ctaLabel}</button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className={s.hero}>
        <div className={s.heroBadge}>
          <span className={s.badgeDot} />
          Workflow automation for engineers
        </div>
        <h1 className={s.heroTitle}>
          Automate workflows<br />
          <span className={s.heroRed}>without limits</span>
        </h1>
        <p className={s.heroSub}>
          SyncHive is a powerful workflow automation engine.<br />
          Build, deploy, and monitor complex automations with a visual DAG editor.
        </p>
        <div className={s.heroBtns}>
          <button className={s.heroPrimary} onClick={() => navigate(ctaRoute)}>
            {ctaLabel} <ArrowIcon />
          </button>
          <a className={s.heroSecondary} href="https://github.com" target="_blank" rel="noreferrer">
            <GithubIcon /> View on GitHub
          </a>
        </div>
        <div className={s.heroStats}>
          {[
            { num: '∞',    label: 'Workflows' },
            { num: '6',    label: 'Node types' },
            { num: '<200ms', label: 'Queue latency' },
            { num: '99.9%', label: 'Reliability' },
          ].map((item, i) => (
            <div key={i} className={s.heroStatGroup}>
              {i > 0 && <div className={s.heroStatDiv} />}
              <div className={s.heroStat}>
                <span className={s.heroStatNum}>{item.num}</span>
                <span className={s.heroStatLabel}>{item.label}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      

      {/* ── FEATURES ── */}
      <section className={s.section} id="features">
        <div className={s.sectionBadge}>Features</div>
        <h2 className={s.sectionTitle}>Everything you need to automate</h2>
        <p className={s.sectionSub}>Built for engineers who want control — not drag-and-drop limitations with hidden costs.</p>
        <div className={s.featGrid}>
          {FEATURES.map((f, i) => (
            <div key={i} className={s.featCard} style={{ animationDelay: `${i * 70}ms` }}>
              <div className={s.featIconWrap}>{f.icon}</div>
              <h3 className={s.featTitle}>{f.title}</h3>
              <p className={s.featDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className={s.section} id="how">
        <div className={s.sectionBadge}>How it works</div>
        <h2 className={s.sectionTitle}>From idea to automation in minutes</h2>
        <p className={s.sectionSub}>No infrastructure setup. No complex configs. Just build and deploy.</p>
        <div className={s.stepsGrid}>
          {STEPS.map((step, i) => (
            <div key={i} className={s.stepCard}>
              <div className={s.stepNum}>{String(i + 1).padStart(2, '0')}</div>
              <h3 className={s.stepTitle}>{step.title}</h3>
              <p className={s.stepDesc}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── EXECUTION FLOW ── */}
      <section className={s.section} id="execution">
        <div className={s.sectionBadge}>Execution Model</div>
        <h2 className={s.sectionTitle}>How a webhook becomes a workflow</h2>
        <div className={s.flowRow}>
          {FLOW.map((step, i) => (
            <div key={i} className={s.flowItem}>
              <div className={s.flowCard}>
                <div className={s.flowIcon}>{step.icon}</div>
                <div className={s.flowTitle}>{step.title}</div>
                <div className={s.flowDesc}>{step.desc}</div>
              </div>
              {i < FLOW.length - 1 && (
                <div className={s.flowConnector}>
                  <div className={s.flowLine} />
                  <div className={s.flowArrowHead} />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section className={s.ctaSection}>
        <div className={s.ctaCard}>
          <div className={s.ctaGlow} />
          <div className={s.ctaContent}>
            <h2 className={s.ctaTitle}>Ready to automate everything?</h2>
            <p className={s.ctaSub}>Deploy in minutes. Scale without limits. No vendor lock-in.</p>
            <div className={s.ctaBtns}>
              <button className={s.heroPrimary} onClick={() => navigate(ctaRoute)}>
                {ctaLabel} <ArrowIcon />
              </button>
              <a className={s.heroSecondary} href="https://github.com" target="_blank" rel="noreferrer">
                <GithubIcon /> Star on GitHub
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className={s.footer}>
        <div className={s.footerTop}>
          <div className={s.footerBrand}>
            <div className={s.footerGem}><div className={s.footerGemInner} /></div>
            <span className={s.footerName}>SyncHive</span>
          </div>
          <div className={s.footerLinks}>
            <a className={s.footerLink} href="#features">Features</a>
            <a className={s.footerLink} href="#how">How it works</a>
            <a className={s.footerLink} href="#execution">Execution</a>
            <a className={s.footerLink} href="https://github.com" target="_blank" rel="noreferrer">GitHub</a>
            <span className={s.footerLink} style={{ cursor: 'pointer' }} onClick={() => navigate('/login')}>Sign in</span>
          </div>
        </div>
        <div className={s.footerBottom}>
          <span className={s.footerCopy}>© 2025 SyncHive. All rights reserved.</span>
          <span className={s.footerBuilt}>Built with TypeScript · Node.js · PostgreSQL · BullMQ</span>
        </div>
      </footer>
    </div>
  )
}

function cx(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

const FEATURES = [
  {
    title: 'Visual DAG Editor',
    desc: 'Drag, drop, and connect nodes on a canvas powered by React Flow. Your workflow topology is always visible.',
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="1" width="6" height="6" rx="1.5"/><rect x="13" y="1" width="6" height="6" rx="1.5"/><rect x="7" y="13" width="6" height="6" rx="1.5"/><path d="M4 7v2.5a2.5 2.5 0 002.5 2.5H8.5M16 7v2.5a2.5 2.5 0 01-2.5 2.5H11.5"/></svg>,
  },
  {
    title: 'BullMQ Powered Queue',
    desc: 'Every execution is a reliable BullMQ job — dead-letter queues, deterministic job IDs, and automatic deduplication.',
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2L3 6v8l7 4 7-4V6L10 2z"/><path d="M10 2v14M3 6l7 4 7-4"/></svg>,
  },
  {
    title: 'Per-node Retry Policies',
    desc: 'Each node has its own maxRetries, backoffMs, and multiplier. AI calls retry 3x. Webhooks never retry.',
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5A7 7 0 104 16M15 5v4h-4"/></svg>,
  },
  {
    title: 'Parallel Execution',
    desc: 'DAG levels run in parallel using Promise.allSettled. Independent branches never block each other.',
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3v14M4 8l6-5 6 5M4 12l6 5 6-5"/></svg>,
  },
  {
    title: 'Version Snapshots',
    desc: 'Activating freezes the graph. Edit a live workflow without breaking running executions — ever.',
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="10" r="7"/><path d="M10 6v4l3 3"/></svg>,
  },
  {
    title: 'Webhook Triggers',
    desc: 'Expose endpoints instantly. API returns 202 immediately, executes async. GitHub, Stripe, Slack — anything.',
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2C6 2 3 5 3 9s3 7 7 7 7-3 7-7M14 2l3 2-2 3"/></svg>,
  },
  {
    title: 'Mustache Templates',
    desc: 'Reference upstream node outputs with {{sender.login}} syntax — dot notation, recursive config resolution.',
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7l-2 3 2 3M16 7l2 3-2 3M8 4l-2 12M14 4l-2 12"/></svg>,
  },
  {
    title: 'Condition Evaluator',
    desc: 'Branch your DAG based on runtime expressions. Evaluate node output, skip paths, handle errors gracefully.',
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10h12M10 4l4 6-4 6M6 4L2 10l4 6"/></svg>,
  },
  {
    title: 'Audit Trail',
    desc: 'Every retry is a new row. Failed rows are never mutated. Full execution history always preserved.',
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h14M3 9h10M3 13h7M3 17h5"/></svg>,
  },
]

const STEPS = [
  { title: 'Create a workflow', desc: 'Name it, pick a trigger — webhook, schedule, manual, or event. Done in under 10 seconds.' },
  { title: 'Build the DAG', desc: 'Add nodes, connect them visually. Trigger → Action → AI → Condition → Transformer.' },
  { title: 'Activate', desc: 'Validates the DAG and creates a frozen version snapshot. Your workflow goes live instantly.' },
  { title: 'Monitor live', desc: 'Every execution logged in real time — status, duration, retries, errors, step outputs.' },
]

const FLOW = [
  {
    title: 'Webhook fires',
    desc: 'External service hits /hooks/:path',
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2C5.7 2 3 4.7 3 8s2.7 6 6 6 6-2.7 6-6M12 2l3 1.5-1.5 2.5"/></svg>,
  },
  {
    title: 'API returns 202',
    desc: 'Immediate response, async execution',
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l4 4 8-8"/></svg>,
  },
  {
    title: 'BullMQ job queued',
    desc: 'Deterministic ID prevents duplicates',
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2L2 6v6l7 4 7-4V6L9 2z"/></svg>,
  },
  {
    title: 'Engine picks up',
    desc: 'Loads snapshot, builds DAG',
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="9" r="3"/><path d="M9 2v2M9 14v2M2 9h2M14 9h2"/></svg>,
  },
  {
    title: 'Nodes execute',
    desc: 'Parallel branches, retries, timeouts',
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 9l3 3 5-5"/><circle cx="9" cy="9" r="7"/></svg>,
  },
  {
    title: 'Logged & done',
    desc: 'Every step recorded, audit trail kept',
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h12M3 9h8M3 13h5"/></svg>,
  },
]

function ArrowIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 7h10M8 3l4 4-4 4"/></svg>
}
function GithubIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
}
function SunIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><circle cx="7" cy="7" r="2.8"/><path d="M7 1v1.2M7 11.8V13M1 7h1.2M11.8 7H13M2.76 2.76l.85.85M10.39 10.39l.85.85M2.76 11.24l.85-.85M10.39 3.61l.85-.85"/></svg>
}
function MoonIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 5.5A5 5 0 114 11a3.8 3.8 0 006.5-5.5z"/></svg>
}