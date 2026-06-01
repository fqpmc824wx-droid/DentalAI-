/**
 * Dentally env safety tests.
 *
 * These tests prove the server-only env reader does not expose the raw token
 * as an enumerable property. The client can still build an Authorization
 * header, but accidental logging/serialisation of the env object will not
 * print the token.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { readDentallyEnv } from '@/lib/dentally/env'

const OLD_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...OLD_ENV }
})

describe('readDentallyEnv secret handling', () => {
  it('keeps the raw token out of enumerable env fields', () => {
    process.env.DENTALLY_API_BASE_URL = 'https://api.dentally.test/'
    process.env.DENTALLY_API_TOKEN = 'super-secret-token-for-test'
    process.env.DENTALLY_TIMEOUT_MS = '1234'

    const env = readDentallyEnv()

    expect(env.configured).toBe(true)
    if (!env.configured) throw new Error('expected configured env')

    expect(env.baseUrl).toBe('https://api.dentally.test')
    expect(env.timeoutMs).toBe(1234)
    expect(Object.keys(env)).not.toContain('token')
    expect(JSON.stringify(env)).not.toContain('super-secret-token-for-test')
    expect(String(env)).not.toContain('super-secret-token-for-test')
  })

  it('only materialises the token at the transport boundary', () => {
    process.env.DENTALLY_API_BASE_URL = 'https://api.dentally.test'
    process.env.DENTALLY_API_TOKEN = 'transport-only-token'

    const env = readDentallyEnv()

    expect(env.configured).toBe(true)
    if (!env.configured) throw new Error('expected configured env')

    expect(env.getAuthorizationHeader()).toBe('Bearer transport-only-token')
  })

  it('fails closed for invalid base URLs', () => {
    process.env.DENTALLY_API_BASE_URL = 'file:///etc/passwd'
    process.env.DENTALLY_API_TOKEN = 'token'

    expect(readDentallyEnv()).toEqual({ configured: false })
  })
})
