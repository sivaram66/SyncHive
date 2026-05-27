import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore, useThemeStore } from '@/lib/store'
import { TopNav } from '@/components/layout/TopNav'
import { Sidebar } from '@/components/layout/Sidebar'
import { ToastProvider } from '@/components/layout/ToastProvider'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'
import { WorkflowsPage } from '@/pages/WorkflowsPage'
import { EditorPage } from '@/pages/EditorPage'
import { ExecutionsPage } from '@/pages/ExecutionsPage'
import { IntegrationsPage } from '@/pages/IntegrationsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { SchedulerPage } from '@/pages/SchedulerPage'
import { LogsPage } from '@/pages/LogsPage'
import { PlaceholderPage } from '@/pages/PlaceholderPage'
import styles from './App.module.css'

function ThemeSync() {
  const { theme } = useThemeStore()
  // Apply on every render — covers hydration from persisted store
  document.documentElement.setAttribute('data-theme', theme)
  document.documentElement.style.colorScheme = theme
  return null
}

type BackendWakeStatus = 'checking' | 'waking' | 'ready' | 'error' | 'hidden'

function BackendWakeNotice() {
  const [status, setStatus] = useState<BackendWakeStatus>('checking')

  useEffect(() => {
    let cancelled = false
    let readyTimer: number | undefined

    const slowTimer = window.setTimeout(() => {
      if (!cancelled) setStatus('waking')
    }, 1500)

    async function wakeBackend() {
      const apiOrigin = (import.meta.env.VITE_API_ORIGIN as string | undefined)?.replace(/\/$/, '') ?? ''

      try {
        const response = await fetch(`${apiOrigin}/health/ping`, {
          method: 'GET',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        })

        if (!response.ok) throw new Error(`Health check failed: ${response.status}`)
        if (cancelled) return

        window.clearTimeout(slowTimer)
        setStatus('ready')
        readyTimer = window.setTimeout(() => {
          if (!cancelled) setStatus('hidden')
        }, 1800)
      } catch {
        if (cancelled) return
        window.clearTimeout(slowTimer)
        setStatus('error')
      }
    }

    wakeBackend()

    return () => {
      cancelled = true
      window.clearTimeout(slowTimer)
      if (readyTimer) window.clearTimeout(readyTimer)
    }
  }, [])

  if (status === 'hidden') return null

  const message =
    status === 'ready'
      ? 'Backend is ready.'
      : status === 'error'
        ? 'Backend is taking longer than expected. Please refresh in a moment.'
        : status === 'waking'
          ? 'Waking the SyncHive backend on Render free tier. This can take 30-60 seconds.'
          : 'Connecting to SyncHive backend...'

  return (
    <div className={styles.wakeNotice} data-status={status} role="status" aria-live="polite">
      <span className={styles.wakePulse} />
      <span>{message}</span>
    </div>
  )
}

function RequireAuth() {
  const { token } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  return <Outlet />
}

function AppShell() {
  return (
    <div className={styles.shell}>
      <TopNav />
      <div className={styles.body}>
        <Sidebar />
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeSync />
      <BackendWakeNotice />
      <ToastProvider />
      <Routes>
        {/* Public — no auth required */}
        <Route path="/"       element={<LandingPage />} />
        <Route path="/login"  element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* Protected — requires auth */}
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="/workflows"     element={<WorkflowsPage />} />
            <Route path="/workflows/:id" element={<EditorPage />} />
            <Route path="/executions"    element={<ExecutionsPage />} />
            <Route path="/integrations"  element={<IntegrationsPage />} />
            <Route path="/scheduler"     element={<SchedulerPage />} />
            <Route path="/logs"          element={<LogsPage />} />
            <Route path="/settings"      element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
