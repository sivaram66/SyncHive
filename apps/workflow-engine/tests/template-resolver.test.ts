import { describe, it, expect } from 'vitest'
import { resolveTemplate, resolveConfig } from '../src/executor/template-resolver'

// ── resolveTemplate ───────────────────────────────────────────────────
describe('resolveTemplate', () => {
  it('replaces a simple {{key}} with its value', () => {
    expect(resolveTemplate('Hello {{name}}', { name: 'Siva' })).toBe('Hello Siva')
  })

  it('resolves nested dot-notation paths', () => {
    expect(
      resolveTemplate('Repo: {{body.repository.name}}', {
        body: { repository: { name: 'synchive' } },
      })
    ).toBe('Repo: synchive')
  })

  it('keeps the placeholder intact when value is undefined', () => {
    expect(resolveTemplate('Hi {{missing}}', {})).toBe('Hi {{missing}}')
  })

  it('keeps the placeholder intact when value is null', () => {
    expect(resolveTemplate('{{val}}', { val: null })).toBe('{{val}}')
  })

  it('converts numbers to strings', () => {
    expect(resolveTemplate('Score: {{score}}', { score: 42 })).toBe('Score: 42')
  })

  it('converts booleans to strings', () => {
    expect(resolveTemplate('Active: {{active}}', { active: true })).toBe('Active: true')
  })

  it('resolves multiple placeholders in one string', () => {
    expect(
      resolveTemplate('{{first}} {{last}}', { first: 'John', last: 'Doe' })
    ).toBe('John Doe')
  })

  it('handles a template with no placeholders', () => {
    expect(resolveTemplate('plain text', { foo: 'bar' })).toBe('plain text')
  })

  it('handles empty template string', () => {
    expect(resolveTemplate('', { foo: 'bar' })).toBe('')
  })

  it('resolves deeply nested paths (4 levels)', () => {
    const data = { a: { b: { c: { d: 'deep' } } } }
    expect(resolveTemplate('{{a.b.c.d}}', data)).toBe('deep')
  })

  it('handles spaces around path in template', () => {
    // {{ name }} (with spaces) should still resolve
    expect(resolveTemplate('Hello {{ name }}', { name: 'World' })).toBe('Hello World')
  })
})

// ── resolveConfig ─────────────────────────────────────────────────────
describe('resolveConfig', () => {
  it('resolves string values', () => {
    const result = resolveConfig({ url: 'https://api.example.com/{{id}}' }, { id: '123' })
    expect(result.url).toBe('https://api.example.com/123')
  })

  it('preserves non-string primitives', () => {
    const result = resolveConfig({ count: 5, flag: true }, {})
    expect(result.count).toBe(5)
    expect(result.flag).toBe(true)
  })

  it('recursively resolves nested objects', () => {
    const result = resolveConfig(
      { headers: { Authorization: 'Bearer {{token}}' } },
      { token: 'abc123' }
    )
    expect((result.headers as any).Authorization).toBe('Bearer abc123')
  })

  it('resolves string items in arrays', () => {
    const result = resolveConfig({ tags: ['{{tag1}}', '{{tag2}}'] }, { tag1: 'a', tag2: 'b' })
    expect(result.tags).toEqual(['a', 'b'])
  })

  it('resolves object items in arrays', () => {
    const result = resolveConfig(
      { recipients: [{ email: '{{email}}' }] },
      { email: 'test@example.com' }
    )
    expect((result.recipients as any[])[0].email).toBe('test@example.com')
  })

  it('leaves non-string array items unchanged', () => {
    const result = resolveConfig({ nums: [1, 2, 3] }, {})
    expect(result.nums).toEqual([1, 2, 3])
  })

  it('handles empty config object', () => {
    expect(resolveConfig({}, { foo: 'bar' })).toEqual({})
  })

  it('handles config with undefined value gracefully', () => {
    const result = resolveConfig({ x: '{{missing}}' }, {})
    // Unresolvable placeholder is left as-is
    expect(result.x).toBe('{{missing}}')
  })
})
