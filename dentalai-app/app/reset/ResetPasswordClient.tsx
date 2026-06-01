'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { completePasswordResetAction, requestPasswordResetAction } from '@/lib/users/actions'
import { Banner } from '@/components/calm'
import Link from 'next/link'

export default function ResetPasswordClient() {
  const params = useSearchParams()
  const token = params.get('token')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [resetLink, setResetLink] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function requestReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    setResetLink('')
    const result = await requestPasswordResetAction(email)
    if (!result.ok) setError(result.error)
    else {
      setMessage('If that email exists, a reset link has been sent.')
      if (result.resetToken) {
        setResetLink(`/reset?token=${encodeURIComponent(result.resetToken)}`)
      }
    }
    setLoading(false)
  }

  async function completeReset(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    setError('')
    const result = await completePasswordResetAction(token, password)
    if (!result.ok) setError(result.error)
    else setDone(true)
    setLoading(false)
  }

  if (done) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400 }}>Password updated</h1>
          <p style={{ color: 'var(--ink-2)', marginBottom: 24 }}>All sessions were revoked. Sign in with your new password.</p>
          <Link href="/login" className="btn primary">Go to sign in</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {token ? (
          <>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, marginBottom: 8 }}>Choose a new password</h1>
            <p style={{ color: 'var(--muted)', marginBottom: 24 }}>Reset link · valid 30 minutes</p>
            <form onSubmit={completeReset} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} placeholder="New password" className="cm-input" />
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8} placeholder="Confirm password" className="cm-input" />
              {error && <Banner tone="warn">{error}</Banner>}
              <button type="submit" className="btn primary" disabled={loading}>{loading ? 'Saving…' : 'Update password'}</button>
            </form>
          </>
        ) : (
          <>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, marginBottom: 8 }}>Reset password</h1>
            <form onSubmit={requestReset} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@smile-dental.co.uk" className="cm-input" />
              {error && <Banner tone="warn">{error}</Banner>}
              {message && <Banner tone="info">{message}</Banner>}
              {resetLink && (
                <Banner tone="info">
                  Demo reset link: <code style={{ wordBreak: 'break-all' }}>{resetLink}</code>
                </Banner>
              )}
              <button type="submit" className="btn primary" disabled={loading}>{loading ? 'Sending…' : 'Send reset link'}</button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
