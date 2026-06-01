'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Banner } from '@/components/calm'

const SUPER_ADMIN_EMAIL = 'admin@dentalai.co.uk'

const DEMO_ACCOUNTS = [
  { email: 'reception@smile-dental.co.uk', role: 'Receptionist' },
  { email: 'manager@smile-dental.co.uk',   role: 'Practice Manager' },
  { email: 'owner@smile-dental.co.uk',     role: 'Group Owner' },
  { email: SUPER_ADMIN_EMAIL,              role: 'Super Admin' },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const needsMfa = email.toLowerCase().trim() === SUPER_ADMIN_EMAIL

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await signIn('credentials', {
      email,
      password,
      totpCode: needsMfa ? totpCode : undefined,
      redirect: false,
    })

    if (result?.error) {
      setError(
        needsMfa && totpCode.length < 6
          ? 'Super Admin sign-in requires your authenticator code.'
          : 'Email, password, or authenticator code not recognised.',
      )
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        {/* Brand */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 40,
        }}>
          <div style={{
            width: 28,
            height: 28,
            background: 'var(--primary)',
            borderRadius: 6,
            display: 'grid',
            placeItems: 'center',
          }}>
            <div style={{
              width: 11,
              height: 11,
              background: 'var(--bg)',
              borderRadius: 2,
              transform: 'rotate(45deg)',
            }} />
          </div>
          <span style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: '0',
            color: 'var(--ink)',
          }}>
            DentalAI
          </span>
        </div>

        {/* Greeting */}
        <div style={{ marginBottom: 32 }}>
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--muted)',
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
            marginBottom: 14,
          }}>
            Reception OS · sign in
          </p>
          <h1 style={{
            fontFamily: 'var(--font-serif)',
            fontWeight: 400,
            fontSize: 46,
            lineHeight: 1.1,
            letterSpacing: '0',
            color: 'var(--ink)',
            margin: '0 0 12px',
          }}>
            Welcome <em style={{ color: 'var(--primary)' }}>back</em>.
          </h1>
          <p style={{
            fontSize: 16,
            color: 'var(--ink-2)',
            maxWidth: 380,
            margin: 0,
          }}>
            I&rsquo;ve been holding the line. Sign in and I&rsquo;ll bring you up to speed.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <p className="field-label" style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              margin: '0 0 8px',
            }}>
              Email
            </p>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="you@smile-dental.co.uk"
              className="cm-input"
            />
          </div>

          <div>
            <p className="field-label" style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              margin: '0 0 8px',
            }}>
              Password
            </p>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="cm-input"
            />
          </div>

          {needsMfa && (
            <div>
              <p className="field-label" style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                margin: '0 0 8px',
              }}>
                Authenticator code
              </p>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={totpCode}
                onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                placeholder="6-digit code"
                className="cm-input"
              />
            </div>
          )}

          {error && (
            <Banner tone="warn">{error}</Banner>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn primary"
            style={{ justifyContent: 'center', padding: '12px 18px', marginTop: 4 }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
            {!loading && <span className="kbd">↵</span>}
          </button>
        </form>

        {/* Demo accounts panel */}
        <div className="cm-card tint" style={{ marginTop: 32 }}>
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontWeight: 600,
            marginBottom: 10,
          }}>
            Demo accounts · password <code style={{
              fontFamily: 'var(--font-mono)',
              background: 'var(--paper)',
              padding: '1px 6px',
              borderRadius: 4,
            }}>demo</code>
            {' '}· Super Admin also needs MFA (seed secret in dev docs)
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {DEMO_ACCOUNTS.map(a => (
              <div key={a.email} style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 13,
              }}>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--ink-2)',
                }}>{a.email}</span>
                <span style={{
                  color: 'var(--muted)',
                  fontSize: 12,
                }}>{a.role}</span>
              </div>
            ))}
          </div>
        </div>

        <p style={{
          fontSize: 11,
          color: 'var(--faint)',
          textAlign: 'center',
          marginTop: 32,
          fontStyle: 'italic',
        }}>
          Mock scaffold under re-audit · I never touch Dentally without your say-so.
        </p>
      </div>
    </div>
  )
}
