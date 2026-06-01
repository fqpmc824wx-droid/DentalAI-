'use client'

import { useState } from 'react'
import { inviteStaffAction, deactivateStaffAction } from '@/lib/users/actions'
import { Banner } from '@/components/calm'
import { ROLE_LABELS } from '@/lib/constants'
import type { Role } from '@/types'
import type { StoredUser } from '@/lib/users/store'

const INVITE_ROLES: Role[] = ['receptionist', 'practice_manager']

export function StaffInviteForm({ clinicId, allowedRoles }: { clinicId: string; allowedRoles: Role[] }) {
  const [error, setError] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setInviteLink('')

    const formData = new FormData(e.currentTarget)
    formData.set('clinicId', clinicId)
    const result = await inviteStaffAction(formData)

    if (!result.ok) {
      setError(result.error)
    } else if (result.inviteToken) {
      setInviteLink(`/invite?token=${encodeURIComponent(result.inviteToken)}`)
    }
    setLoading(false)
  }

  return (
    <div className="cm-card" style={{ marginBottom: 24 }}>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
        Invite staff · valid 72 hours
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input name="name" required placeholder="Full name" className="cm-input" />
        <input name="email" type="email" required placeholder="Email" className="cm-input" />
        <select name="role" className="cm-input" defaultValue="receptionist">
          {INVITE_ROLES.filter(r => allowedRoles.includes(r)).map(role => (
            <option key={role} value={role}>{ROLE_LABELS[role]}</option>
          ))}
        </select>
        {error && <Banner tone="warn">{error}</Banner>}
        {inviteLink && (
          <Banner tone="info">
            Invitation link (share securely): <code style={{ wordBreak: 'break-all' }}>{inviteLink}</code>
          </Banner>
        )}
        <button type="submit" className="btn primary" disabled={loading}>
          {loading ? 'Creating…' : 'Send invitation'}
        </button>
      </form>
    </div>
  )
}

export function StaffList({ users, canDeactivate }: { users: StoredUser[]; canDeactivate: boolean }) {
  const [error, setError] = useState('')
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function deactivate(userId: string) {
    setLoadingId(userId)
    setError('')
    const result = await deactivateStaffAction(userId)
    if (!result.ok) setError(result.error)
    setLoadingId(null)
  }

  return (
    <div>
      {error && <Banner tone="warn">{error}</Banner>}
      {users.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No staff accounts in scope.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {users.map(user => (
            <div key={user.id} className="cm-card tint" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
              <div>
                <div style={{ fontWeight: 500 }}>{user.name}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>{user.email}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  {ROLE_LABELS[user.role]} · {user.status.replace('_', ' ')}
                </div>
              </div>
              {canDeactivate && user.status === 'active' && (
                <button
                  type="button"
                  className="btn"
                  disabled={loadingId === user.id}
                  onClick={() => deactivate(user.id)}
                >
                  {loadingId === user.id ? '…' : 'Deactivate'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
