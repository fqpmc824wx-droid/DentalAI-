/**
 * Versioned schema migrations — applied once on database open.
 */

import type { DB } from './client'

type Migration = { version: number; name: string; sql: string }

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'schema_version',
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    INTEGER PRIMARY KEY,
        name       TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 2,
    name: 'typed_tables',
    sql: `
      CREATE TABLE IF NOT EXISTS queue_items (
        id                  TEXT PRIMARY KEY,
        type                TEXT NOT NULL,
        priority            TEXT NOT NULL,
        status              TEXT NOT NULL,
        clinic_id           TEXT NOT NULL,
        created_at          TEXT NOT NULL,
        resolved_at         TEXT,
        updated_at          TEXT,
        caller_phone        TEXT NOT NULL,
        caller_state        TEXT NOT NULL,
        patient_id          TEXT,
        title               TEXT NOT NULL,
        summary             TEXT NOT NULL,
        appointment_type_id TEXT,
        confidence          REAL NOT NULL,
        rule_decision       TEXT,
        rule_reasons        TEXT,
        assigned_to         TEXT,
        resolved_by         TEXT,
        notes               TEXT,
        source              TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_queue_clinic ON queue_items(clinic_id);
      CREATE INDEX IF NOT EXISTS idx_queue_status ON queue_items(status);
      CREATE INDEX IF NOT EXISTS idx_queue_assigned ON queue_items(assigned_to);

      CREATE TABLE IF NOT EXISTS audit_events (
        id              TEXT PRIMARY KEY,
        timestamp       TEXT NOT NULL,
        action          TEXT NOT NULL,
        status          TEXT NOT NULL,
        actor_user_id   TEXT NOT NULL,
        actor_name      TEXT NOT NULL,
        actor_role      TEXT NOT NULL,
        actor_email     TEXT NOT NULL,
        clinic_id       TEXT NOT NULL,
        patient_ref     TEXT,
        queue_item_ref  TEXT,
        metadata        TEXT,
        summary         TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_audit_clinic ON audit_events(clinic_id);
      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_events(timestamp DESC);

      CREATE TABLE IF NOT EXISTS login_attempts (
        email         TEXT PRIMARY KEY,
        count         INTEGER NOT NULL,
        window_start  INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id                   TEXT PRIMARY KEY,
        email                TEXT NOT NULL UNIQUE,
        password_hash        TEXT,
        name                 TEXT NOT NULL,
        role                 TEXT NOT NULL,
        clinic_id            TEXT NOT NULL,
        clinic_ids           TEXT NOT NULL,
        status               TEXT NOT NULL DEFAULT 'active',
        created_at           TEXT NOT NULL,
        updated_at           TEXT NOT NULL,
        deactivated_at       TEXT,
        password_changed_at  TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

      CREATE TABLE IF NOT EXISTS user_invitations (
        id           TEXT PRIMARY KEY,
        user_id      TEXT NOT NULL REFERENCES users(id),
        token_hash   TEXT NOT NULL UNIQUE,
        expires_at   TEXT NOT NULL,
        created_by   TEXT NOT NULL,
        created_at   TEXT NOT NULL,
        accepted_at  TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_invitations_user ON user_invitations(user_id);

      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id           TEXT PRIMARY KEY,
        user_id      TEXT NOT NULL REFERENCES users(id),
        token_hash   TEXT NOT NULL UNIQUE,
        expires_at   TEXT NOT NULL,
        created_at   TEXT NOT NULL,
        used_at      TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_reset_user ON password_reset_tokens(user_id);

      CREATE TABLE IF NOT EXISTS session_revocations (
        user_id        TEXT PRIMARY KEY REFERENCES users(id),
        revoked_after  INTEGER NOT NULL,
        revoked_at     TEXT NOT NULL
      );
    `,
  },
  {
    version: 3,
    name: 'migrate_json_collections',
    sql: `
      CREATE TABLE IF NOT EXISTS collections (
        name       TEXT PRIMARY KEY,
        data       TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 4,
    name: 'super_admin_mfa',
    sql: `
      CREATE TABLE IF NOT EXISTS user_mfa (
        user_id         TEXT PRIMARY KEY REFERENCES users(id),
        secret_base32   TEXT NOT NULL,
        enrolled_at     TEXT NOT NULL
      );
    `,
  },
  {
    version: 5,
    name: 'audit_immutability',
    sql: `
      CREATE TRIGGER IF NOT EXISTS audit_events_no_update
      BEFORE UPDATE ON audit_events
      BEGIN
        SELECT RAISE(ABORT, 'audit_events is append-only');
      END;
      CREATE TRIGGER IF NOT EXISTS audit_events_no_delete
      BEFORE DELETE ON audit_events
      BEGIN
        SELECT RAISE(ABORT, 'audit_events is append-only');
      END;
    `,
  },
  {
    version: 6,
    name: 'app_settings',
    sql: `
      CREATE TABLE IF NOT EXISTS app_settings (
        clinic_id    TEXT NOT NULL,
        key          TEXT NOT NULL,
        value        TEXT NOT NULL,
        updated_at   TEXT NOT NULL,
        updated_by   TEXT,
        PRIMARY KEY (clinic_id, key)
      );
      CREATE INDEX IF NOT EXISTS idx_settings_clinic ON app_settings(clinic_id);
    `,
  },
  {
    version: 7,
    name: 'queue_ownership_locks',
    sql: `
      ALTER TABLE queue_items ADD COLUMN lock_mode TEXT;
      ALTER TABLE queue_items ADD COLUMN lock_assigned_at TEXT;
      ALTER TABLE queue_items ADD COLUMN lock_last_activity_at TEXT;
      ALTER TABLE queue_items ADD COLUMN lock_session_ended_at TEXT;
      ALTER TABLE queue_items ADD COLUMN draft_notes TEXT;
    `,
  },
  {
    version: 8,
    name: 'queue_callback_attempts',
    sql: `
      ALTER TABLE queue_items ADD COLUMN callback_attempts TEXT;
    `,
  },
]

function appliedVersions(db: DB): Set<number> {
  const exists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'",
  ).get()
  if (!exists) return new Set()

  const rows = db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]
  return new Set(rows.map(r => r.version))
}

function migrateFromCollections(db: DB): void {
  const hasCollections = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='collections'",
  ).get()
  if (!hasCollections) return

  const migrateQueue = db.prepare('SELECT data FROM collections WHERE name = ?').get('queue') as { data: string } | undefined
  if (migrateQueue) {
    const count = (db.prepare('SELECT COUNT(*) AS c FROM queue_items').get() as { c: number }).c
    if (count === 0) {
      const items = JSON.parse(migrateQueue.data) as Record<string, unknown>[]
      if (Array.isArray(items)) {
        const insert = db.prepare(`
          INSERT INTO queue_items (
            id, type, priority, status, clinic_id, created_at, resolved_at, updated_at,
            caller_phone, caller_state, patient_id, title, summary, appointment_type_id,
            confidence, rule_decision, rule_reasons, assigned_to, resolved_by, notes, source
          ) VALUES (
            @id, @type, @priority, @status, @clinicId, @createdAt, @resolvedAt, @updatedAt,
            @callerPhone, @callerState, @patientId, @title, @summary, @appointmentTypeId,
            @confidence, @ruleDecision, @ruleReasons, @assignedTo, @resolvedBy, @notes, @source
          )
        `)
        const tx = db.transaction((rows: Record<string, unknown>[]) => {
          for (const row of rows) {
            insert.run({
              id: row.id,
              type: row.type,
              priority: row.priority,
              status: row.status,
              clinicId: row.clinicId,
              createdAt: row.createdAt,
              resolvedAt: row.resolvedAt ?? null,
              updatedAt: row.updatedAt ?? null,
              callerPhone: row.callerPhone,
              callerState: row.callerState,
              patientId: row.patientId ?? null,
              title: row.title,
              summary: row.summary,
              appointmentTypeId: row.appointmentTypeId ?? null,
              confidence: row.confidence,
              ruleDecision: row.ruleDecision ?? null,
              ruleReasons: row.ruleReasons ? JSON.stringify(row.ruleReasons) : null,
              assignedTo: row.assignedTo ?? null,
              resolvedBy: row.resolvedBy ?? null,
              notes: row.notes ?? null,
              source: row.source,
            })
          }
        })
        tx(items)
      }
    }
  }

  const migrateAudit = db.prepare('SELECT data FROM collections WHERE name = ?').get('audit') as { data: string } | undefined
  if (migrateAudit) {
    const count = (db.prepare('SELECT COUNT(*) AS c FROM audit_events').get() as { c: number }).c
    if (count === 0) {
      const events = JSON.parse(migrateAudit.data) as Record<string, unknown>[]
      if (Array.isArray(events)) {
        const insert = db.prepare(`
          INSERT INTO audit_events (
            id, timestamp, action, status,
            actor_user_id, actor_name, actor_role, actor_email,
            clinic_id, patient_ref, queue_item_ref, metadata, summary
          ) VALUES (
            @id, @timestamp, @action, @status,
            @actorUserId, @actorName, @actorRole, @actorEmail,
            @clinicId, @patientRef, @queueItemRef, @metadata, @summary
          )
        `)
        const tx = db.transaction((rows: Record<string, unknown>[]) => {
          for (const row of rows) {
            const actor = row.actor as Record<string, string>
            insert.run({
              id: row.id,
              timestamp: row.timestamp,
              action: row.action,
              status: row.status,
              actorUserId: actor.userId,
              actorName: actor.name,
              actorRole: actor.role,
              actorEmail: actor.email,
              clinicId: row.clinicId,
              patientRef: row.patientRef ?? null,
              queueItemRef: row.queueItemRef ?? null,
              metadata: row.metadata ? JSON.stringify(row.metadata) : null,
              summary: row.summary,
            })
          }
        })
        tx(events)
      }
    }
  }

  const migrateAttempts = db.prepare('SELECT data FROM collections WHERE name = ?').get('login_attempts') as { data: string } | undefined
  if (migrateAttempts) {
    const buckets = JSON.parse(migrateAttempts.data) as { email: string; count: number; windowStart: number }[]
    if (Array.isArray(buckets)) {
      const upsert = db.prepare(`
        INSERT INTO login_attempts (email, count, window_start) VALUES (?, ?, ?)
        ON CONFLICT(email) DO UPDATE SET count = excluded.count, window_start = excluded.window_start
      `)
      const tx = db.transaction((rows: typeof buckets) => {
        for (const row of rows) upsert.run(row.email, row.count, row.windowStart)
      })
      tx(buckets)
    }
  }
}

export function runMigrations(db: DB): void {
  const applied = appliedVersions(db)
  const now = new Date().toISOString()

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue
    db.exec(migration.sql)
    db.prepare(
      'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
    ).run(migration.version, migration.name, now)
  }

  migrateFromCollections(db)
}
