import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { getDb, __closeForTests } from '@/lib/db/client'
import { logAuditEvent, __resetAuditForTests } from '@/lib/audit/store'
import { assertKnownAuditAction, UnknownAuditActionError } from '@/lib/audit/taxonomy'

let tmpDir: string

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dentalai-audit-immut-'))
  process.env.DENTALAI_DATA_DIR = tmpDir
  __resetAuditForTests()
  logAuditEvent({
    action: 'auth.login',
    status: 'success',
    actor: { userId: 'u1', name: 'Test', role: 'receptionist', email: 't@example.com' },
    clinicId: 'clinic-1',
    summary: 'Test login for immutability proof',
  })
})

afterAll(() => {
  __closeForTests()
  delete process.env.DENTALAI_DATA_DIR
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  } catch { /* ignore */ }
})

describe('audit taxonomy', () => {
  it('rejects unknown action strings at log time', () => {
    expect(() => assertKnownAuditAction('not.a.real.action')).toThrow(UnknownAuditActionError)
  })

  it('accepts canonical auth.mfa_verified action', () => {
    expect(() => assertKnownAuditAction('auth.mfa_verified')).not.toThrow()
  })
})

describe('append-only audit_events', () => {
  it('blocks UPDATE on audit_events via SQLite trigger', () => {
    const db = getDb()
    expect(() => {
      db.prepare("UPDATE audit_events SET summary = 'tampered' WHERE id != ''").run()
    }).toThrow(/append-only/)
  })

  it('blocks DELETE on audit_events via SQLite trigger', () => {
    const db = getDb()
    expect(() => {
      db.prepare('DELETE FROM audit_events').run()
    }).toThrow(/append-only/)
  })
})
