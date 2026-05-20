import { useState, useEffect, useCallback } from 'react'
import type { WorkflowNode, NodeType } from '@/types'
import { nodesApi } from '@/lib/api'
import styles from './NodeConfigPanel.module.css'

/* ─── Props ──────────────────────────────────────────────────── */
interface Props {
  node: WorkflowNode
  workflowId: string
  onClose: () => void
  onSaved: () => void
}

/* ─── Type metadata ──────────────────────────────────────────── */
const NODE_TYPE_META: Record<NodeType, { label: string; color: string; icon: React.ReactNode }> = {
  trigger: {
    label: 'Trigger',
    color: 'var(--node-trigger)',
    icon: (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.5 1.5L1 7h3.5v4.5L12 6H8L9.5 1.5z" />
      </svg>
    ),
  },
  action: {
    label: 'Action',
    color: 'var(--node-http)',
    icon: (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1.5 6.5h10M7.5 2.5l4 4-4 4" />
      </svg>
    ),
  },
  condition: {
    label: 'Condition',
    color: 'var(--node-condition)',
    icon: (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.5 1.5L11.5 6.5 6.5 11.5 1.5 6.5z" />
      </svg>
    ),
  },
  ai: {
    label: 'AI',
    color: 'var(--node-ai)',
    icon: (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="6.5" cy="6.5" r="5" />
        <path d="M6.5 4v3l2 1" />
      </svg>
    ),
  },
  transformer: {
    label: 'Transformer',
    color: 'var(--node-transform)',
    icon: (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M2 4.5h6M6 2.5l2 2-2 2M11 8.5H5M7 6.5l2 2-2 2" />
      </svg>
    ),
  },
  loop: {
    label: 'Loop',
    color: 'var(--node-loop)',
    icon: (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 4.5H5a2.5 2.5 0 000 5h5M8 2.5l2 2-2 2" />
      </svg>
    ),
  },
}

/* ─── Action sub-types (stored in config.integration) ─────────── */
const ACTION_INTEGRATIONS = [
  { value: 'http',    label: 'HTTP Request' },
  { value: 'email',   label: 'Send Email' },
  { value: 'slack',   label: 'Slack Message' },
  { value: 'discord', label: 'Discord Message' },
  { value: 'generic', label: 'Generic / Custom' },
] as const

/* ─── Root component ─────────────────────────────────────────── */
export function NodeConfigPanel({ node, workflowId, onClose, onSaved }: Props) {
  const meta = NODE_TYPE_META[node.type]
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  // Local copies of editable fields
  const [name,       setName]       = useState(node.name)
  const [config,     setConfig]     = useState<Record<string, unknown>>(node.config ?? {})
  const [maxRetries, setMaxRetries] = useState(node.retryPolicy.maxRetries)
  const [backoffMs,  setBackoffMs]  = useState(node.retryPolicy.backoffMs)
  const [timeoutMs,  setTimeoutMs]  = useState(node.timeoutMs)

  // Reset when node changes
  useEffect(() => {
    setName(node.name)
    setConfig(node.config ?? {})
    setMaxRetries(node.retryPolicy.maxRetries)
    setBackoffMs(node.retryPolicy.backoffMs)
    setTimeoutMs(node.timeoutMs)
    setSaved(false)
    setError(null)
  }, [node.id])

  const setConfigKey = useCallback((key: string, value: unknown) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }, [])

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await nodesApi.update(workflowId, node.id, {
        name: name.trim() || node.name,
        config,
        retryPolicy: { maxRetries, backoffMs, backoffMultiplier: node.retryPolicy.backoffMultiplier },
        timeoutMs,
      })
      if (res.success) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
        onSaved()
      } else {
        setError(res.error ?? 'Failed to save')
      }
    } catch {
      setError('Failed to save node config')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header} style={{ '--type-color': meta.color } as React.CSSProperties}>
        <div className={styles.headerLeft}>
          <span className={styles.typeBadge} style={{ color: meta.color, borderColor: meta.color + '55', background: meta.color + '18' }}>
            <span className={styles.typeIcon}>{meta.icon}</span>
            {meta.label}
          </span>
          <span className={styles.nodeId}>{node.id.slice(0, 8)}</span>
        </div>
        <button className={styles.closeBtn} onClick={onClose} title="Close panel">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M2 2l10 10M12 2L2 12" />
          </svg>
        </button>
      </div>

      <div className={styles.body}>
        {/* General section */}
        <Section title="General">
          <Field label="Node name">
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Send Slack message"
            />
          </Field>
        </Section>

        {/* Type-specific config */}
        <Section title="Configuration">
          {node.type === 'trigger' && <TriggerConfig config={config} set={setConfigKey} />}
          {node.type === 'action'  && <ActionConfig  config={config} set={setConfigKey} />}
          {node.type === 'condition' && <ConditionConfig config={config} set={setConfigKey} />}
          {node.type === 'ai'      && <AiConfig      config={config} set={setConfigKey} />}
          {node.type === 'transformer' && <TransformerConfig config={config} set={setConfigKey} />}
          {node.type === 'loop'    && <LoopConfig    config={config} set={setConfigKey} />}
        </Section>

        {/* Retry + timeout */}
        <Section title="Retry Policy">
          <div className={styles.row2}>
            <Field label="Max retries">
              <input
                className={styles.input}
                type="number"
                min={0}
                max={10}
                value={maxRetries}
                onChange={(e) => setMaxRetries(Number(e.target.value))}
              />
            </Field>
            <Field label="Backoff (ms)">
              <input
                className={styles.input}
                type="number"
                min={100}
                step={100}
                value={backoffMs}
                onChange={(e) => setBackoffMs(Number(e.target.value))}
              />
            </Field>
          </div>
          <Field label="Timeout (ms)">
            <input
              className={styles.input}
              type="number"
              min={1000}
              step={1000}
              value={timeoutMs}
              onChange={(e) => setTimeoutMs(Number(e.target.value))}
            />
          </Field>
        </Section>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        {error && <div className={styles.errorMsg}>{error}</div>}
        <button
          className={styles.saveBtn}
          onClick={handleSave}
          disabled={saving}
          data-saved={saved}
        >
          {saving ? (
            <><Spinner /> Saving…</>
          ) : saved ? (
            <><CheckIcon /> Saved</>
          ) : (
            'Save changes'
          )}
        </button>
      </div>
    </div>
  )
}

/* ─── Type-specific config forms ─────────────────────────────── */

function TriggerConfig({ config, set }: ConfigProps) {
  const trigType = String(config.triggerType ?? 'webhook')
  return (
    <>
      <Field label="Trigger type">
        <Select
          value={trigType}
          onChange={(v) => set('triggerType', v)}
          options={[
            { value: 'webhook',  label: 'Webhook' },
            { value: 'schedule', label: 'Schedule (cron)' },
            { value: 'manual',   label: 'Manual' },
            { value: 'event',    label: 'Event' },
          ]}
        />
      </Field>

      {trigType === 'webhook' && (
        <Field label="Webhook path" hint="e.g. /hooks/my-path">
          <input
            className={styles.input}
            value={String(config.path ?? '')}
            onChange={(e) => set('path', e.target.value)}
            placeholder="/hooks/my-event"
          />
        </Field>
      )}

      {trigType === 'webhook' && (
        <Field label="Action filter" hint="Optional. Only trigger when body.action matches (e.g. 'created'). Leave empty to trigger on all actions.">
          <input
            className={styles.input}
            value={String(config.action ?? '')}
            onChange={(e) => set('action', e.target.value)}
            placeholder="created"
          />
        </Field>
      )}

      {trigType === 'schedule' && (
        <Field label="Cron expression" hint="e.g. 0 9 * * 1-5 (weekdays at 9am)">
          <input
            className={styles.input}
            value={String(config.cron ?? '')}
            onChange={(e) => set('cron', e.target.value)}
            placeholder="0 * * * *"
          />
        </Field>
      )}
    </>
  )
}

function ActionConfig({ config, set }: ConfigProps) {
  const integration = String(config.integration ?? 'http')
  return (
    <>
      <Field label="Integration">
        <Select
          value={integration}
          onChange={(v) => set('integration', v)}
          options={ACTION_INTEGRATIONS as unknown as { value: string; label: string }[]}
        />
      </Field>

      {integration === 'http' && <HttpFields config={config} set={set} />}
      {integration === 'email' && <EmailFields config={config} set={set} />}
      {integration === 'slack' && <SlackFields config={config} set={set} />}
      {integration === 'discord' && <DiscordFields config={config} set={set} />}
      {integration === 'generic' && <GenericFields config={config} set={set} />}
    </>
  )
}

function HttpFields({ config, set }: ConfigProps) {
  return (
    <>
      <div className={styles.row2}>
        <Field label="Method">
          <Select
            value={String(config.method ?? 'POST')}
            onChange={(v) => set('method', v)}
            options={[
              { value: 'GET',    label: 'GET' },
              { value: 'POST',   label: 'POST' },
              { value: 'PUT',    label: 'PUT' },
              { value: 'PATCH',  label: 'PATCH' },
              { value: 'DELETE', label: 'DELETE' },
            ]}
          />
        </Field>
        <Field label="Timeout (ms)">
          <input
            className={styles.input}
            type="number"
            value={Number(config.timeoutMs ?? 30000)}
            onChange={(e) => set('timeoutMs', Number(e.target.value))}
          />
        </Field>
      </div>
      <Field label="URL" hint="Supports {{variable}} templates">
        <input
          className={styles.input}
          value={String(config.url ?? '')}
          onChange={(e) => set('url', e.target.value)}
          placeholder="https://api.example.com/endpoint"
        />
      </Field>
      <Field label="Headers (JSON)">
        <JsonTextarea
          value={config.headers as Record<string, string> | undefined}
          onChange={(v) => set('headers', v)}
          placeholder='{ "Authorization": "Bearer {{token}}" }'
        />
      </Field>
      <Field label="Body (JSON)" hint="Supports {{variable}} templates">
        <JsonTextarea
          value={config.body as Record<string, unknown> | undefined}
          onChange={(v) => set('body', v)}
          placeholder='{ "event": "{{triggerData.type}}" }'
          rows={5}
        />
      </Field>
    </>
  )
}

function EmailFields({ config, set }: ConfigProps) {
  return (
    <>
      <Field label="To" hint="Supports {{variable}} templates">
        <input className={styles.input} value={String(config.to ?? '')} onChange={(e) => set('to', e.target.value)} placeholder="user@example.com" />
      </Field>
      <Field label="Subject">
        <input className={styles.input} value={String(config.subject ?? '')} onChange={(e) => set('subject', e.target.value)} placeholder="Hello {{name}}" />
      </Field>
      <Field label="Body">
        <textarea className={styles.textarea} rows={5} value={String(config.body ?? '')} onChange={(e) => set('body', e.target.value)} placeholder="Hi {{name}}, your request has been processed." />
      </Field>
    </>
  )
}

function SlackFields({ config, set }: ConfigProps) {
  return (
    <>
      <Field label="Webhook URL">
        <input className={styles.input} value={String(config.webhookUrl ?? '')} onChange={(e) => set('webhookUrl', e.target.value)} placeholder="https://hooks.slack.com/services/..." />
      </Field>
      <Field label="Channel" hint="Optional. Overrides webhook default.">
        <input className={styles.input} value={String(config.channel ?? '')} onChange={(e) => set('channel', e.target.value)} placeholder="#deployments" />
      </Field>
      <Field label="Message" hint="Supports {{variable}} templates">
        <textarea className={styles.textarea} rows={4} value={String(config.message ?? '')} onChange={(e) => set('message', e.target.value)} placeholder="🚀 Deploy succeeded for {{repo}}" />
      </Field>
    </>
  )
}

function DiscordFields({ config, set }: ConfigProps) {
  return (
    <>
      <Field label="Webhook URL">
        <input className={styles.input} value={String(config.webhookUrl ?? '')} onChange={(e) => set('webhookUrl', e.target.value)} placeholder="https://discord.com/api/webhooks/..." />
      </Field>
      <Field label="Message" hint="Supports {{variable}} templates">
        <textarea className={styles.textarea} rows={4} value={String(config.message ?? '')} onChange={(e) => set('message', e.target.value)} placeholder="New event: {{type}}" />
      </Field>
    </>
  )
}

function GenericFields({ config, set }: ConfigProps) {
  return (
    <Field label="Config (JSON)" hint="Full configuration object">
      <JsonTextarea value={config as Record<string, unknown>} onChange={(v) => { if (v) Object.entries(v).forEach(([k, val]) => set(k, val)) }} placeholder='{ "key": "value" }' rows={8} />
    </Field>
  )
}

function ConditionConfig({ config, set }: ConfigProps) {
  return (
    <>
      <Field label="Condition expression" hint="Returns true/false. Supports {{variable}} and JS operators.">
        <textarea
          className={styles.textarea}
          rows={3}
          value={String(config.expression ?? '')}
          onChange={(e) => set('expression', e.target.value)}
          placeholder="{{status}} === 'success' && {{count}} > 0"
        />
      </Field>
      <Field label="True branch label">
        <input className={styles.input} value={String(config.trueLabel ?? 'true')} onChange={(e) => set('trueLabel', e.target.value)} placeholder="true" />
      </Field>
      <Field label="False branch label">
        <input className={styles.input} value={String(config.falseLabel ?? 'false')} onChange={(e) => set('falseLabel', e.target.value)} placeholder="false" />
      </Field>
    </>
  )
}

function AiConfig({ config, set }: ConfigProps) {
  return (
    <>
      <Field label="Model">
        <Select
          value={String(config.model ?? 'llama-3.3-70b-versatile')}
          onChange={(v) => set('model', v)}
          options={[
            { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile (best)' },
            { value: 'llama-3.1-8b-instant',    label: 'Llama 3.1 8B Instant (fastest)' },
            { value: 'gemma2-9b-it',             label: 'Gemma 2 9B (Google)' },
            { value: 'mixtral-8x7b-32768',       label: 'Mixtral 8x7B (long context)' },
            { value: 'llama-guard-3-8b',         label: 'Llama Guard 3 8B (moderation)' },
          ]}
        />
      </Field>
      <Field label="System prompt">
        <textarea className={styles.textarea} rows={3} value={String(config.systemPrompt ?? '')} onChange={(e) => set('systemPrompt', e.target.value)} placeholder="You are a helpful assistant." />
      </Field>
      <Field label="User prompt" hint="Supports {{variable}} templates">
        <textarea className={styles.textarea} rows={5} value={String(config.prompt ?? '')} onChange={(e) => set('prompt', e.target.value)} placeholder="Summarize the following: {{input}}" />
      </Field>
      <div className={styles.row2}>
        <Field label="Temperature">
          <input className={styles.input} type="number" min={0} max={2} step={0.1} value={Number(config.temperature ?? 0.7)} onChange={(e) => set('temperature', Number(e.target.value))} />
        </Field>
        <Field label="Max tokens">
          <input className={styles.input} type="number" min={1} max={8000} value={Number(config.maxTokens ?? 1000)} onChange={(e) => set('maxTokens', Number(e.target.value))} />
        </Field>
      </div>
    </>
  )
}

function TransformerConfig({ config, set }: ConfigProps) {
  return (
    <>
      <Field label="Operation">
        <Select
          value={String(config.operation ?? 'pick')}
          onChange={(v) => set('operation', v)}
          options={[
            { value: 'pick',    label: 'Pick fields' },
            { value: 'rename',  label: 'Rename fields' },
            { value: 'merge',   label: 'Merge objects' },
            { value: 'filter',  label: 'Filter array' },
            { value: 'map',     label: 'Map array' },
            { value: 'custom',  label: 'Custom JS expression' },
          ]}
        />
      </Field>
      <Field label="Mapping (JSON)" hint="e.g. {&quot;newKey&quot;: &quot;{{oldKey}}&quot;}">
        <JsonTextarea value={config.mapping as Record<string, unknown>} onChange={(v) => set('mapping', v)} placeholder='{ "id": "{{userId}}", "name": "{{fullName}}" }' rows={6} />
      </Field>
    </>
  )
}

function LoopConfig({ config, set }: ConfigProps) {
  return (
    <>
      <Field label="Array input" hint="Path to the array to iterate. Supports {{variable}}.">
        <input className={styles.input} value={String(config.arrayPath ?? '')} onChange={(e) => set('arrayPath', e.target.value)} placeholder="{{items}}" />
      </Field>
      <Field label="Item variable name" hint="Name to access each item inside the loop.">
        <input className={styles.input} value={String(config.itemVar ?? 'item')} onChange={(e) => set('itemVar', e.target.value)} placeholder="item" />
      </Field>
      <Field label="Max iterations" hint="Safety limit to prevent infinite loops.">
        <input className={styles.input} type="number" min={1} max={1000} value={Number(config.maxIterations ?? 100)} onChange={(e) => set('maxIterations', Number(e.target.value))} />
      </Field>
    </>
  )
}

/* ─── Shared UI primitives ───────────────────────────────────── */
interface ConfigProps {
  config: Record<string, unknown>
  set: (key: string, value: unknown) => void
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{title}</div>
      <div className={styles.sectionBody}>{children}</div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      {children}
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  )
}

function Select({ value, onChange, options }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select className={styles.select} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

function JsonTextarea({
  value, onChange, placeholder, rows = 4,
}: {
  value: Record<string, unknown> | undefined
  onChange: (v: Record<string, unknown> | undefined) => void
  placeholder?: string
  rows?: number
}) {
  const [text, setText] = useState(() => value ? JSON.stringify(value, null, 2) : '')
  const [isInvalid, setIsInvalid] = useState(false)

  useEffect(() => {
    setText(value ? JSON.stringify(value, null, 2) : '')
  }, [JSON.stringify(value)])

  function handleChange(raw: string) {
    setText(raw)
    try {
      if (!raw.trim()) { onChange(undefined); setIsInvalid(false); return }
      onChange(JSON.parse(raw))
      setIsInvalid(false)
    } catch {
      setIsInvalid(true)
    }
  }

  return (
    <textarea
      className={`${styles.textarea} ${isInvalid ? styles.textareaError : ''}`}
      rows={rows}
      value={text}
      onChange={(e) => handleChange(e.target.value)}
      placeholder={placeholder}
      spellCheck={false}
    />
  )
}

function Spinner() {
  return <span className={styles.spinner} />
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 6.5L4.5 9.5l6-6" />
    </svg>
  )
}
