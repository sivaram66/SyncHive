import { useState, useEffect, type FormEvent } from 'react'
import { useAuthStore } from '@/lib/store'
import { authApi } from '@/lib/api'
import styles from './SettingsPage.module.css'

export function SettingsPage() {
  const { user, setUser } = useAuthStore()

  // Profile form
  const [name,        setName]        = useState(user?.name ?? '')
  const [nameLoading, setNameLoading] = useState(false)
  const [nameMsg,     setNameMsg]     = useState<{ text: string; ok: boolean } | null>(null)

  // Password form
  const [currPw,   setCurrPw]   = useState('')
  const [newPw,    setNewPw]    = useState('')
  const [confPw,   setConfPw]   = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwMsg,    setPwMsg]    = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => { setName(user?.name ?? '') }, [user?.name])

  async function handleNameSave(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setNameLoading(true); setNameMsg(null)
    try {
      const res = await authApi.updateProfile(name.trim())
      if (res.success && res.data) {
        setUser({ ...user!, name: res.data.name })
        setNameMsg({ text: 'Name updated successfully ✓', ok: true })
      } else {
        setNameMsg({ text: res.error ?? 'Failed to update', ok: false })
      }
    } catch (err: any) {
      setNameMsg({ text: err?.response?.data?.message ?? 'Failed to update name', ok: false })
    } finally { setNameLoading(false) }
  }

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault()
    if (newPw !== confPw) { setPwMsg({ text: 'New passwords do not match', ok: false }); return }
    if (newPw.length < 8) { setPwMsg({ text: 'Password must be at least 8 characters', ok: false }); return }
    setPwLoading(true); setPwMsg(null)
    try {
      const res = await authApi.changePassword(currPw, newPw)
      if (res.success) {
        setCurrPw(''); setNewPw(''); setConfPw('')
        setPwMsg({ text: 'Password changed successfully ✓', ok: true })
      } else {
        setPwMsg({ text: res.error ?? 'Failed to change password', ok: false })
      }
    } catch (err: any) {
      setPwMsg({ text: err?.response?.data?.message ?? 'Incorrect current password or server error', ok: false })
    } finally { setPwLoading(false) }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.sub}>Manage your account preferences</p>
      </div>

      <div className={styles.grid}>

        {/* ── Profile card ── */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIconWrap}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="5" r="3"/><path d="M2 14c0-3 2.7-5 6-5s6 2 6 5"/>
              </svg>
            </div>
            <div>
              <div className={styles.cardTitle}>Profile</div>
              <div className={styles.cardSub}>Update your display name</div>
            </div>
          </div>

          {/* Avatar */}
          <div className={styles.avatarRow}>
            <div className={styles.avatar}>
              {(user?.name ?? user?.email ?? 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className={styles.avatarName}>{user?.name ?? 'User'}</div>
              <div className={styles.avatarEmail}>{user?.email}</div>
            </div>
          </div>

          <form className={styles.form} onSubmit={handleNameSave}>
            <div className={styles.field}>
              <label className={styles.label}>Display name</label>
              <input
                className={styles.input}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Email address</label>
              <input className={styles.input} value={user?.email ?? ''} disabled />
              <span className={styles.hint}>Email cannot be changed</span>
            </div>
            {nameMsg && (
              <div className={nameMsg.ok ? styles.msgSuccess : styles.msgError}>{nameMsg.text}</div>
            )}
            <button className={styles.saveBtn} type="submit" disabled={nameLoading || !name.trim()}>
              {nameLoading ? <Spinner /> : 'Save changes'}
            </button>
          </form>
        </section>

        {/* ── Password card ── */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIconWrap}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5a3 3 0 016 0v2"/>
                <circle cx="8" cy="10.5" r="1" fill="currentColor" stroke="none"/>
              </svg>
            </div>
            <div>
              <div className={styles.cardTitle}>Password</div>
              <div className={styles.cardSub}>Change your account password</div>
            </div>
          </div>

          <form className={styles.form} onSubmit={handlePasswordChange}>
            <div className={styles.field}>
              <label className={styles.label}>Current password</label>
              <input className={styles.input} type="password" value={currPw}
                onChange={e => setCurrPw(e.target.value)} placeholder="Enter current password" required />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>New password</label>
              <input className={styles.input} type="password" value={newPw}
                onChange={e => setNewPw(e.target.value)} placeholder="At least 8 characters" required minLength={8} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Confirm new password</label>
              <input className={styles.input} type="password" value={confPw}
                onChange={e => setConfPw(e.target.value)} placeholder="Repeat new password" required />
              {confPw && newPw !== confPw && (
                <span className={styles.hintError}>Passwords do not match</span>
              )}
            </div>
            {pwMsg && (
              <div className={pwMsg.ok ? styles.msgSuccess : styles.msgError}>{pwMsg.text}</div>
            )}
            <button className={styles.saveBtn} type="submit"
              disabled={pwLoading || !currPw || !newPw || !confPw || newPw !== confPw}>
              {pwLoading ? <Spinner /> : 'Change password'}
            </button>
          </form>
        </section>

        {/* ── Account info card ── */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIconWrap}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="8" r="6"/><path d="M8 5v4M8 11v.5"/>
              </svg>
            </div>
            <div>
              <div className={styles.cardTitle}>Account info</div>
              <div className={styles.cardSub}>Read-only account details</div>
            </div>
          </div>

          <div className={styles.infoGrid}>
            <InfoRow label="User ID"    value={user?.id ?? '—'} mono />
            <InfoRow label="Email"      value={user?.email ?? '—'} />
            <InfoRow label="Member since" value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'} />
            <InfoRow label="Plan"       value="Free" />
          </div>
        </section>

        {/* ── Danger zone card ── */}
        <section className={`${styles.card} ${styles.dangerCard}`}>
          <div className={styles.cardHeader}>
            <div className={`${styles.cardIconWrap} ${styles.dangerIcon}`}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2L1 13h14L8 2z"/><path d="M8 7v3M8 11.5v.5"/>
              </svg>
            </div>
            <div>
              <div className={styles.cardTitle}>Danger zone</div>
              <div className={styles.cardSub}>Irreversible account actions</div>
            </div>
          </div>
          <p className={styles.dangerText}>
            Account deletion will permanently remove all your workflows, executions, and data.
            This action cannot be undone.
          </p>
          <button className={styles.dangerBtn} onClick={() => alert('Contact support to delete your account.')}>
            Delete account
          </button>
        </section>

      </div>
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className={styles.infoRow}>
      <span className={styles.infoLabel}>{label}</span>
      <span className={`${styles.infoValue} ${mono ? styles.mono : ''}`}>{value}</span>
    </div>
  )
}

function Spinner() {
  return <span style={{ width: 14, height: 14, borderRadius: '50%', display: 'inline-block', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />
}
