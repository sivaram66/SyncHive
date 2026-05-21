import { useState, useEffect } from 'react'
import { subscribeToasts, toast as toastApi } from '@/lib/toast'
import styles from './ToastProvider.module.css'

interface ToastItem {
  id: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
  duration: number
}

const ICONS = {
  success: (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="7.5" r="6.5"/><path d="M4.5 7.5l2 2 4-4"/>
    </svg>
  ),
  error: (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="7.5" cy="7.5" r="6.5"/><path d="M5 5l5 5M10 5l-5 5"/>
    </svg>
  ),
  info: (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="7.5" cy="7.5" r="6.5"/><path d="M7.5 7v4M7.5 4.5v.5"/>
    </svg>
  ),
  warning: (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.5 2L1 13h13L7.5 2z"/><path d="M7.5 6v3M7.5 11v.5"/>
    </svg>
  ),
}

export function ToastProvider() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    const unsub = subscribeToasts(setToasts)
    return unsub
  }, [])

  return (
    <div className={styles.container} aria-live="polite" aria-atomic="false">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`${styles.toast} ${styles[t.type]}`}
          role="alert"
        >
          <span className={styles.icon}>{ICONS[t.type]}</span>
          <span className={styles.message}>{t.message}</span>
          <button
            className={styles.close}
            onClick={() => toastApi.dismiss(t.id)}
            aria-label="Dismiss"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M1 1l9 9M10 1L1 10"/>
            </svg>
          </button>
          {/* Progress bar */}
          <div
            className={styles.progress}
            style={{ animationDuration: `${t.duration}ms` }}
          />
        </div>
      ))}
    </div>
  )
}
