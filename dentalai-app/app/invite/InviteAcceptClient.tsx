'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { acceptInvitationAction } from '@/lib/users/actions'
import { Banner } from '@/components/calm'
import Link from 'next/link'

export default function InviteAcceptClient() {
  const params = useSearchParams()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    setError('')
    const result = await acceptInvitationAction(token, password)
    if (!result.ok) setError(result.error)
    else setDone(true)
    setLoading(false)
  }

  if (!token) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <Banner tone="warn">Invalid invitation link.</Banner>
      </div>
    )
  }

  if (done) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400 }}>You&rsquo;re set.</h1>
          <p style={{ color: 'var(--ink-2)', marginBottom: 24 }}>Password saved. Sign in to continue.</p>
          <Link href="/login" className="btn primary">Go to sign in</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, marginBottom: 8 }}>Set your password</h1>
        <p style={{ color: 'var(--muted)', marginBottom: 24 }}>Invitation link · valid 72 hours</p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} placeholder="New password" className="cm-input" />
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8} placeholder="Confirm password" className="cm-input" />
          {error && <Banner tone="warn">{error}</Banner>}
          <button type="submit" className="btn primary" disabled={loading}>{loading ? 'Saving…' : 'Activate account'}</button>
        </form>
      </div>
    </div>
  )
}
