import { afterEach, describe, expect, it } from 'vitest'
import { getHealthReport } from '@/lib/monitoring/health'

const OLD_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...OLD_ENV }
})

describe('getHealthReport', () => {
  it('returns ok in test mode without persistence', () => {
    process.env.DENTALAI_APP_ENV = 'test'
    process.env.AUTH_SECRET = 'x'.repeat(40)
    delete process.env.NEXT_PUBLIC_AUTH_SECRET
    const report = getHealthReport()
    expect(report.status).toBe('ok')
    expect(report.runtime.appEnv).toBe('test')
    expect(report.persistence.enabled).toBe(false)
    expect(JSON.stringify(report)).not.toContain('DENTALLY_API_TOKEN')
    expect(JSON.stringify(report)).not.toContain('AUTH_SECRET')
  })

  it('never exposes secret env values', () => {
    process.env.DENTALLY_API_TOKEN = 'super-secret-health-token'
    process.env.AUTH_SECRET = 'super-secret-auth'
    const report = getHealthReport()
    const json = JSON.stringify(report)
    expect(json).not.toContain('super-secret-health-token')
    expect(json).not.toContain('super-secret-auth')
  })

  it('reports secret hygiene check status', () => {
    const report = getHealthReport()
    expect(typeof report.checks.secretHygiene).toBe('boolean')
    expect(typeof report.checks.authSecretConfigured).toBe('boolean')
  })
})
