import { afterEach, describe, expect, it } from 'vitest'
import { readAppEnv, readRuntimeConfig } from '@/lib/env/runtime'
import { findPublicSecretLeaks, validateAuthSecretStrength } from '@/lib/env/secrets'

const OLD_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...OLD_ENV }
})

describe('readAppEnv', () => {
  it('honours DENTALAI_APP_ENV when set', () => {
    process.env.DENTALAI_APP_ENV = 'staging'
    expect(readAppEnv()).toBe('staging')
  })

  it('derives test from Vitest', () => {
    delete process.env.DENTALAI_APP_ENV
    process.env.VITEST = 'true'
    expect(readAppEnv()).toBe('test')
  })

  it('accepts explicit production label', () => {
    process.env.DENTALAI_APP_ENV = 'production'
    expect(readAppEnv()).toBe('production')
  })

  it('accepts explicit development label', () => {
    process.env.DENTALAI_APP_ENV = 'development'
    expect(readAppEnv()).toBe('development')
  })
})

describe('readRuntimeConfig', () => {
  it('requires strong secrets in production', () => {
    process.env.DENTALAI_APP_ENV = 'production'
    const cfg = readRuntimeConfig()
    expect(cfg.requireStrongAuthSecret).toBe(true)
    expect(cfg.allowDemoSeedPassword).toBe(false)
  })

  it('allows demo seed password in development', () => {
    process.env.DENTALAI_APP_ENV = 'development'
    const cfg = readRuntimeConfig()
    expect(cfg.allowDemoSeedPassword).toBe(true)
    expect(cfg.requireStrongAuthSecret).toBe(false)
  })
})

describe('validateAuthSecretStrength', () => {
  it('flags weak secrets in production', () => {
    process.env.AUTH_SECRET = 'demo'
    expect(validateAuthSecretStrength(true)).toContain(
      'AUTH_SECRET must not use a known weak placeholder in staging/production',
    )
  })

  it('passes a long random secret in production', () => {
    process.env.AUTH_SECRET = 'x'.repeat(40)
    expect(validateAuthSecretStrength(true)).toEqual([])
  })

  it('skips checks outside staging/production', () => {
    delete process.env.AUTH_SECRET
    expect(validateAuthSecretStrength(false)).toEqual([])
  })
})

describe('findPublicSecretLeaks', () => {
  it('detects NEXT_PUBLIC_AUTH_ variables', () => {
    process.env.NEXT_PUBLIC_AUTH_SECRET = 'leak'
    expect(findPublicSecretLeaks()).toContain('NEXT_PUBLIC_AUTH_SECRET')
  })
})
