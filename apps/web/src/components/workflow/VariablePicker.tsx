/**
 * VariablePicker — Zapier-style click-to-insert variable picker.
 *
 * Props:
 *  - upstreamNodes: list of nodes that come before this one in the workflow
 *  - onInsert(path): called with "nodeId.fieldName" to insert at cursor
 *  - anchorRef: the input element to insert into
 */
import { useState, useRef, useEffect } from 'react'
import type { WorkflowNode } from '@/types'
import styles from './VariablePicker.module.css'

// Known output schema per node type
const NODE_OUTPUT_SCHEMA: Record<string, { key: string; label: string; example?: string }[]> = {
  trigger: [
    { key: 'body',        label: 'Request body',      example: '{ ... }' },
    { key: 'headers',     label: 'Request headers',   example: '{ ... }' },
    { key: 'query',       label: 'Query params',      example: '{ ... }' },
    { key: 'method',      label: 'HTTP method',       example: 'POST' },
    { key: 'action',      label: 'Webhook action',    example: 'opened' },
  ],
  webhook: [
    { key: 'body',        label: 'Webhook body',      example: '{ ... }' },
    { key: 'headers',     label: 'Webhook headers',   example: '{ ... }' },
    { key: 'action',      label: 'Action field',      example: 'created' },
  ],
  action: [
    { key: 'status',      label: 'HTTP status',       example: '200' },
    { key: 'data',        label: 'Response body',     example: '{ ... }' },
    { key: 'ok',          label: 'Success boolean',   example: 'true' },
  ],
  ai: [
    { key: 'result',      label: 'AI response text',  example: 'Hello!' },
    { key: 'model',       label: 'Model used',        example: 'llama-3.3-70b' },
    { key: 'usage.tokens', label: 'Token usage',      example: '512' },
  ],
  transformer: [
    { key: 'result',      label: 'Transformed data',  example: '{ ... }' },
    { key: 'keys',        label: 'Output keys',       example: '[ ... ]' },
  ],
  loop: [
    { key: 'items',        label: 'Array items',      example: '[ ... ]' },
    { key: 'itemCount',    label: 'Item count',       example: '5' },
    { key: 'loopResults',  label: 'Iteration results',example: '[ ... ]' },
    { key: 'item',         label: 'Current item',     example: '{ ... }' },
    { key: 'loopIndex',    label: 'Current index',    example: '0' },
  ],
  condition: [
    { key: 'conditionResult', label: 'Result (bool)', example: 'true' },
  ],
  delay: [
    { key: 'delayedMs',  label: 'Delayed (ms)',       example: '5000' },
    { key: 'resumedAt',  label: 'Resumed at (ISO)',   example: '2026-...' },
  ],
}

interface Props {
  upstreamNodes: WorkflowNode[]
  targetRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>
  onInsert: (template: string) => void
}

export function VariablePicker({ upstreamNodes, targetRef, onInsert }: Props) {
  const [open,   setOpen]   = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  // Build flat list of variables from upstream nodes
  const variables = upstreamNodes.flatMap(node => {
    const schema = NODE_OUTPUT_SCHEMA[node.type] ?? [{ key: 'output', label: 'Output', example: '...' }]
    return schema.map(field => ({
      template: `{{${node.id}.${field.key}}}`,
      label:    field.label,
      example:  field.example,
      nodeName: node.name,
      nodeType: node.type,
      nodeId:   node.id,
      key:      field.key,
    }))
  })

  // Also add global aliases
  const globalVars = [
    { template: '{{triggerData.body}}',    label: 'Trigger body',    example: '{ ... }', nodeName: 'Global', nodeType: 'trigger', nodeId: 'global', key: 'triggerData.body' },
    { template: '{{triggerData.action}}',  label: 'Trigger action',  example: 'opened',  nodeName: 'Global', nodeType: 'trigger', nodeId: 'global', key: 'triggerData.action' },
    { template: '{{loopItem}}',            label: 'Loop item',       example: '{ ... }', nodeName: 'Loop',   nodeType: 'loop',    nodeId: 'global', key: 'loopItem' },
    { template: '{{loopIndex}}',           label: 'Loop index',      example: '0',       nodeName: 'Loop',   nodeType: 'loop',    nodeId: 'global', key: 'loopIndex' },
  ]

  const all = [...globalVars, ...variables]

  const filtered = search.trim()
    ? all.filter(v =>
        v.label.toLowerCase().includes(search.toLowerCase()) ||
        v.nodeName.toLowerCase().includes(search.toLowerCase()) ||
        v.key.toLowerCase().includes(search.toLowerCase())
      )
    : all

  function insertVariable(template: string) {
    const el = targetRef.current
    if (el) {
      const start = el.selectionStart ?? el.value.length
      const end   = el.selectionEnd   ?? el.value.length
      const before = el.value.slice(0, start)
      const after  = el.value.slice(end)
      const newVal = before + template + after
      // Trigger React synthetic event
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
        'value'
      )?.set
      nativeInputValueSetter?.call(el, newVal)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      // Restore cursor
      const newPos = start + template.length
      requestAnimationFrame(() => { el.focus(); el.setSelectionRange(newPos, newPos) })
    }
    onInsert(template)
    setOpen(false)
    setSearch('')
  }

  const nodeTypeColor: Record<string, string> = {
    trigger: '#10b981', webhook: '#ec4899', action: '#3b82f6',
    ai: '#f59e0b', transformer: '#06b6d4', loop: '#f97316',
    condition: '#8b5cf6', delay: '#6366f1',
  }

  return (
    <div ref={containerRef} className={styles.wrap}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen(o => !o)}
        title="Insert variable"
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4.5 2L2 6.5 4.5 11M8.5 2L11 6.5 8.5 11M6 4l-1 5"/>
        </svg>
        <span>Insert variable</span>
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M1.5 3L4.5 6 7.5 3"/>
        </svg>
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.dropHeader}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="5.5" cy="5.5" r="4"/><path d="M9 9l2 2"/>
            </svg>
            <input
              autoFocus
              className={styles.search}
              placeholder="Search variables…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className={styles.list}>
            {filtered.length === 0 ? (
              <div className={styles.empty}>No variables found</div>
            ) : (
              filtered.map((v, i) => (
                <button
                  key={i}
                  type="button"
                  className={styles.varRow}
                  onClick={() => insertVariable(v.template)}
                >
                  <span
                    className={styles.nodeTag}
                    style={{ color: nodeTypeColor[v.nodeType] ?? '#aaa', borderColor: (nodeTypeColor[v.nodeType] ?? '#aaa') + '40', background: (nodeTypeColor[v.nodeType] ?? '#aaa') + '15' }}
                  >
                    {v.nodeName}
                  </span>
                  <div className={styles.varInfo}>
                    <span className={styles.varLabel}>{v.label}</span>
                    <code className={styles.varCode}>{v.template}</code>
                  </div>
                  {v.example && <span className={styles.varExample}>{v.example}</span>}
                </button>
              ))
            )}
          </div>

          <div className={styles.dropFooter}>
            Type <code>{'{{'}nodeId.field{'}}'}</code> manually or click above to insert
          </div>
        </div>
      )}
    </div>
  )
}
