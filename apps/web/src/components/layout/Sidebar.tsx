import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import clsx from 'clsx'
import styles from './Sidebar.module.css'

const NAV_ITEMS = [
  {
    label: 'Workflows', href: '/workflows', badge: null,
    icon: <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="1" width="5" height="5" rx="1.5"/><rect x="9" y="1" width="5" height="5" rx="1.5"/><rect x="5" y="9" width="5" height="5" rx="1.5"/><path d="M3.5 6v1.5a2 2 0 002 2H7M11.5 6v1.5a2 2 0 01-2 2H8"/></svg>,
  },
  {
    label: 'Executions', href: '/executions', badge: null,
    icon: <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="7.5" r="6"/><path d="M7.5 4.5v3.5l2 2"/></svg>,
  },
  {
    label: 'Integrations', href: '/integrations', badge: 'Soon',
    icon: <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M1.5 7.5h3M10.5 7.5h3M4.5 7.5a3 3 0 006 0 3 3 0 00-6 0z"/><path d="M7.5 1.5v2M7.5 11.5v2"/></svg>,
  },
]

const SYSTEM_ITEMS = [
  {
    label: 'Scheduler', href: '/scheduler', badge: 'Soon',
    icon: <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="1.5" y="2.5" width="12" height="11" rx="2"/><path d="M1.5 6.5h12M5 1.5v2M10 1.5v2"/></svg>,
  },
  {
    label: 'Logs', href: '/logs', badge: null,
    icon: <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M2.5 4.5h10M2.5 7.5h7M2.5 10.5h5"/></svg>,
  },
  {
    label: 'Settings', href: '/settings', badge: null,
    icon: <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="7.5" r="2"/><path d="M7.5 1.5v1M7.5 12.5v1M1.5 7.5h1M12.5 7.5h1M3.4 3.4l.7.7M10.9 10.9l.7.7M3.4 11.6l.7-.7M10.9 4.1l.7-.7"/></svg>,
  },
]

export function Sidebar() {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <h1 className={styles.title}>Dashboard</h1>
        <p className={styles.sub}>Deploy and manage workflows</p>
      </div>

      <div className={styles.planCard}>
        <div className={styles.planIcon}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 1.5L1.5 5v4L7 12.5 12.5 9V5L7 1.5zM7 1.5v11M1.5 5l5.5 3.5L12.5 5"/>
          </svg>
        </div>
        <div>
          <div className={styles.planName}>Pro Plan</div>
          <div className={styles.planDetail}>Unlimited workflows</div>
        </div>
      </div>

      <nav className={styles.nav}>
        <div className={styles.sectionLabel}>Workspace</div>
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} to={item.href}
            className={({ isActive }) => clsx(styles.navItem, isActive && styles.active)}>
            <span className={styles.navIcon}>{item.icon}</span>
            <span className={styles.navLabel}>{item.label}</span>
            {item.badge && <span className={styles.navBadge}>{item.badge}</span>}
          </NavLink>
        ))}

        <div className={clsx(styles.sectionLabel, styles.sectionLabelSpaced)}>System</div>
        {SYSTEM_ITEMS.map((item) => (
          <NavLink key={item.href} to={item.href}
            className={({ isActive }) => clsx(styles.navItem, isActive && styles.active)}>
            <span className={styles.navIcon}>{item.icon}</span>
            <span className={styles.navLabel}>{item.label}</span>
            {item.badge && <span className={styles.navBadge}>{item.badge}</span>}
          </NavLink>
        ))}
      </nav>

      <div className={styles.footer}>
        <div className={styles.avatar}>{user?.name?.[0]?.toUpperCase() ?? 'U'}</div>
        <div className={styles.userInfo}>
          <div className={styles.userName}>{user?.name ?? 'User'}</div>
          <div className={styles.userEmail}>{user?.email ?? ''}</div>
        </div>
        <button className={styles.signOutBtn} onClick={() => { clearAuth(); navigate('/login') }} title="Sign out">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 2H3a1.5 1.5 0 00-1.5 1.5v7A1.5 1.5 0 003 12h2M9.5 9.5L12 7l-2.5-2.5M12 7H5"/>
          </svg>
        </button>
      </div>
    </aside>
  )
}