import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import clsx from 'clsx'
import styles from './Sidebar.module.css'

const NAV_ITEMS = [
  {
    label: 'Workflows', href: '/workflows',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="1" width="5" height="5" rx="1.5"/>
        <rect x="10" y="1" width="5" height="5" rx="1.5"/>
        <rect x="5.5" y="10" width="5" height="5" rx="1.5"/>
        <path d="M3.5 6v2a2 2 0 002 2H7M12.5 6v2a2 2 0 01-2 2H9"/>
      </svg>
    ),
  },
  {
    label: 'Executions', href: '/executions',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="6.5"/>
        <path d="M8 4.5v4l2.5 2.5"/>
      </svg>
    ),
  },
  {
    label: 'Integrations', href: '/integrations', badge: 'Soon',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1.5 8h3M11.5 8h3M4.5 8a3.5 3.5 0 007 0 3.5 3.5 0 00-7 0z"/>
        <path d="M8 1.5v2M8 12.5v2"/>
      </svg>
    ),
  },
]

const SYSTEM_ITEMS = [
  {
    label: 'Scheduler', href: '/scheduler', badge: 'Soon',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1.5" y="2.5" width="13" height="12" rx="2"/>
        <path d="M1.5 7h13M5.5 1.5v2M10.5 1.5v2"/>
      </svg>
    ),
  },
  {
    label: 'Logs', href: '/logs',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M2.5 4.5h11M2.5 8h8M2.5 11.5h5"/>
      </svg>
    ),
  },
  {
    label: 'Settings', href: '/settings',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="2.2"/>
        <path d="M8 1.5v1.2M8 13.3v1.2M1.5 8h1.2M13.3 8h1.2M3.4 3.4l.85.85M11.75 11.75l.85.85M3.4 12.6l.85-.85M11.75 4.25l.85-.85"/>
      </svg>
    ),
  },
]

export function Sidebar() {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 1L16 5v8L9 17 2 13V5L9 1z" fill="rgba(124,58,237,0.2)" stroke="#7C3AED" strokeWidth="1.2" strokeLinejoin="round"/>
            <path d="M9 5l3 2v4L9 13 6 11V7L9 5z" fill="#7C3AED" opacity="0.7"/>
            <path d="M9 8v2M8 9h2" stroke="#fff" strokeWidth="1" strokeLinecap="round"/>
          </svg>
        </div>
        <span className={styles.logoText}>SyncHive</span>
      </div>

      {/* Navigation */}
      <nav className={styles.nav}>
        <span className={styles.sectionLabel}>Workspace</span>
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} to={item.href}
            className={({ isActive }) => clsx(styles.navItem, isActive && styles.active)}>
            <span className={styles.navIcon}>{item.icon}</span>
            <span className={styles.navLabel}>{item.label}</span>
            {item.badge && <span className={styles.navBadge}>{item.badge}</span>}
          </NavLink>
        ))}

        <span className={clsx(styles.sectionLabel, styles.sectionGap)}>System</span>
        {SYSTEM_ITEMS.map((item) => (
          <NavLink key={item.href} to={item.href}
            className={({ isActive }) => clsx(styles.navItem, isActive && styles.active)}>
            <span className={styles.navIcon}>{item.icon}</span>
            <span className={styles.navLabel}>{item.label}</span>
            {item.badge && <span className={styles.navBadge}>{item.badge}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User Footer */}
      <div className={styles.footer}>
        <div className={styles.avatar}>{user?.name?.[0]?.toUpperCase() ?? 'U'}</div>
        <div className={styles.userInfo}>
          <div className={styles.userName}>{user?.name ?? 'User'}</div>
          <div className={styles.userEmail}>{user?.email ?? ''}</div>
        </div>
        <button className={styles.signOutBtn}
          onClick={() => { clearAuth(); navigate('/login') }} title="Sign out">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 2H3a1.5 1.5 0 00-1.5 1.5v7A1.5 1.5 0 003 12h2M9.5 9.5L12 7l-2.5-2.5M12 7H5"/>
          </svg>
        </button>
      </div>
    </aside>
  )
}