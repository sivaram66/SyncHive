import { useThemeStore, useAuthStore } from '@/lib/store'
import styles from './TopNav.module.css'

export function TopNav() {
  const { theme, toggleTheme } = useThemeStore()
  const { user, clearAuth } = useAuthStore()

  return (
    <nav className={styles.nav}>
      <div className={styles.logo}>
        <div className={styles.gem}>
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
            <path d="M13 2L22 7v12L13 24 4 19V7L13 2z"
              fill="rgba(37,99,235,0.15)" stroke="#2563EB" strokeWidth="1.2" strokeLinejoin="round"/>
            <path d="M13 7l5 3v6L13 19 8 16V10L13 7z" fill="#2563EB" opacity="0.5"/>
            <path d="M13 11v3M11.5 12.5h3" stroke="#60A5FA" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </div>
        <span className={styles.brand}>SyncHive</span>
        <span className={styles.tag}>Engine</span>
      </div>

      <div className={styles.divider} />

      <div className={styles.links}>
        <a className={styles.link} href="https://github.com" target="_blank" rel="noreferrer">Docs</a>
        <a className={styles.link} href="#">Pricing</a>
        <a className={styles.link} href="#">Changelog</a>
      </div>

      <div className={styles.right}>
        <button className={styles.themeBtn} onClick={toggleTheme} title="Toggle theme">
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
        {user && (
          <div className={styles.userChip}>
            <div className={styles.avatar}>{user.name[0].toUpperCase()}</div>
            <span className={styles.userName}>{user.name}</span>
          </div>
        )}
        <button className={styles.cta} onClick={clearAuth}>Sign out</button>
      </div>
    </nav>
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
