import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore, useThemeStore } from '@/lib/store'
import { TopNav } from '@/components/layout/TopNav'
import { Sidebar } from '@/components/layout/Sidebar'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'
import { WorkflowsPage } from '@/pages/WorkflowsPage'
import { EditorPage } from '@/pages/EditorPage'
import { ExecutionsPage } from '@/pages/ExecutionsPage'
import { PlaceholderPage } from '@/pages/PlaceholderPage'
import styles from './App.module.css'

function ThemeSync() {
  const { theme } = useThemeStore()
  document.documentElement.setAttribute('data-theme', theme)
  return null
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
            <Route path="/integrations"  element={<PlaceholderPage title="Integrations" subtitle="Real connectors coming soon." />} />
            <Route path="/scheduler"     element={<PlaceholderPage title="Scheduler" subtitle="Cron-based triggers coming soon." />} />
            <Route path="/logs"          element={<PlaceholderPage title="Logs" subtitle="Structured execution logs coming soon." />} />
            <Route path="/settings"      element={<PlaceholderPage title="Settings" subtitle="Account settings coming soon." />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}