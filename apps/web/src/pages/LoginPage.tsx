import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '@/lib/api'
import { useAuthStore, useThemeStore } from '@/lib/store'
import styles from './AuthPage.module.css'

export function LoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await authApi.login({ email, password })
      if (res.success && res.data) {
        setAuth(res.data.token, res.data.user)
        navigate('/workflows')
      } else {
        setError(res.error ?? 'Invalid credentials')
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error
      setError(msg ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      {/* Ambient glow orbs */}
      <div className={styles.orb1} />
      <div className={styles.orb2} />

      {/* Theme toggle */}
      <button className={styles.themeBtn} onClick={toggleTheme} title="Toggle theme">
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>

      <div className={styles.card}>
        {/* Logo */}
        <div className={styles.logo}>
          <div className={styles.gem}><div className={styles.gemInner} /></div>
          <span className={styles.brand}>SyncHive</span>
        </div>

        <h1 className={styles.heading}>Welcome back</h1>
        <p className={styles.sub}>Sign in to your workspace</p>

        {error && <div className={styles.errorBanner}>{error}</div>}

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input
              className={styles.input}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Password</label>
            <input
              className={styles.input}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button className={styles.submitBtn} type="submit" disabled={loading}>
            {loading ? <span className={styles.spinner} /> : 'Sign in'}
          </button>
        </form>

        <p className={styles.footer}>
          No account?{' '}
          <Link to="/signup" className={styles.footerLink}>Create one</Link>
        </p>
      </div>
    </div>
  )
}

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor"
      strokeWidth="1.3" strokeLinecap="round">
      <circle cx="7" cy="7" r="2.8" />
      <path d="M7 1v1.2M7 11.8V13M1 7h1.2M11.8 7H13M2.76 2.76l.85.85M10.39 10.39l.85.85M2.76 11.24l.85-.85M10.39 3.61l.85-.85" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor"
      strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.5 5.5A5 5 0 114 11a3.8 3.8 0 006.5-5.5z" />
    </svg>
  )
}
