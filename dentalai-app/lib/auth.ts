import '@/lib/env'
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { logAuditEvent } from '@/lib/audit/store'
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from '@/lib/auth/rate-limit'
import {
  mustVerifyMfa,
  verifyUserMfaCode,
  ensureSuperAdminMfaSeeded,
} from '@/lib/auth/mfa/policy'
import {
  getUserByEmail,
  isUserLoginAllowed,
  toAuthUser,
  verifyUserPassword,
} from '@/lib/users/store'
import { isSessionRevoked } from '@/lib/users/lifecycle'
import type { Role } from '@/types'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        totpCode: { label: 'Authenticator code', type: 'text' },
      },
      async authorize(credentials) {
        const email = (credentials?.email as string | undefined)?.toLowerCase().trim()
        const password = credentials?.password as string | undefined
        const totpCode = (credentials?.totpCode as string | undefined)?.trim()

        if (!email || !password) return null

        const { allowed } = checkRateLimit(email)
        if (!allowed) {
          logAuditEvent({
            action: 'auth.login_failed',
            status: 'failure',
            actor: { userId: 'unknown', name: 'unknown', role: 'unknown', email },
            clinicId: 'unknown',
            metadata: { reason: 'rate_limited' },
            summary: 'Login blocked — too many failed attempts',
          })
          return null
        }

        const user = getUserByEmail(email)

        if (!user || !verifyUserPassword(user, password) || !isUserLoginAllowed(user)) {
          recordFailedAttempt(email)
          logAuditEvent({
            action: 'auth.login_failed',
            status: 'failure',
            actor: { userId: 'unknown', name: 'unknown', role: 'unknown', email },
            clinicId: 'unknown',
            metadata: { attemptedEmail: email },
            summary: 'Failed login attempt',
          })
          return null
        }

        resetRateLimit(email)
        ensureSuperAdminMfaSeeded(user.id, user.role)

        let mfaVerified = true
        if (mustVerifyMfa(user.id, user.role)) {
          if (!totpCode) {
            logAuditEvent({
              action: 'auth.mfa_required',
              status: 'pending',
              actor: { userId: user.id, name: user.name, role: user.role, email: user.email },
              clinicId: user.clinicId,
              summary: 'Super-admin sign-in requires MFA code',
              metadata: { role: user.role },
            })
            return null
          }
          if (!verifyUserMfaCode(user.id, totpCode)) {
            recordFailedAttempt(email)
            logAuditEvent({
              action: 'auth.mfa_failed',
              status: 'failure',
              actor: { userId: user.id, name: user.name, role: user.role, email: user.email },
              clinicId: user.clinicId,
              summary: 'Super-admin MFA verification failed',
              metadata: { role: user.role },
            })
            return null
          }
          mfaVerified = true
          logAuditEvent({
            action: 'auth.mfa_verified',
            status: 'success',
            actor: { userId: user.id, name: user.name, role: user.role, email: user.email },
            clinicId: user.clinicId,
            summary: `${user.name} passed MFA verification`,
            metadata: { role: user.role },
          })
        }

        logAuditEvent({
          action: 'auth.login',
          status: 'success',
          actor: { userId: user.id, name: user.name, role: user.role, email: user.email },
          clinicId: user.clinicId,
          summary: `${user.name} signed in`,
          metadata: { role: user.role, mfaVerified },
        })

        return { ...toAuthUser(user), mfaVerified }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.clinicId = user.clinicId
        token.clinicIds = user.clinicIds
        token.mfaVerified = user.mfaVerified ?? true
      }

      const userId = token.id as string | undefined
      const role = token.role as Role | undefined
      const issuedAtMs = (token.iat ?? 0) * 1000
      if (userId) {
        if (isSessionRevoked(userId, issuedAtMs)) {
          return { ...token, revoked: true }
        }
        const stored = getUserByEmail(token.email as string)
        if (!stored || !isUserLoginAllowed(stored)) {
          return { ...token, revoked: true }
        }
        if (role && mustVerifyMfa(userId, role) && !token.mfaVerified) {
          return { ...token, revoked: true }
        }
      }

      return token
    },
    async session({ session, token }) {
      if (token.revoked || !token.id) {
        return { expires: new Date(0).toISOString(), user: session.user }
      }

      session.user.id = token.id as string
      session.user.role = token.role as Role
      session.user.clinicId = token.clinicId as string
      session.user.clinicIds = (token.clinicIds as string[]) ?? [token.clinicId as string]
      session.user.mfaVerified = token.mfaVerified as boolean | undefined
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
})
