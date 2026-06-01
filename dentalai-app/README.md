# DentalAI Reception OS

AI-powered reception operations for UK dental practices. AI prepares work. Humans approve diary-changing actions. Dentally confirms successful appointments.

> **Current status:** foundation scaffold with enterprise typed SQLite, staff lifecycle (S016), super-admin MFA, audit hardening (S017–S018), env separation/CSP/health (S019), backup evidence (S020), role navigation (S021), browser acceptance re-run (S022), schema foundation band (S023–S028), Dentally read-proof + data contracts (S029–S040), caller identity + authorisation band (S041–S057), queue taxonomy band (S087–S090), queue card fields (S091), human briefing (S092), Dentally link panel (S094), and working tools (S095). Active roadmap in `../dentalai-planning-redesign.html`. **65 / 269** slices signed off. Not pilot-ready yet — SMS visibility (S096+), telephony, slot holds, and Dentally writes remain ahead.

## Current Truth

The codebase contains useful evidence, not a finished operating system:

- A Next.js 16 app with Auth.js credentials login, **scrypt-hashed passwords**, staff invitations, password reset, deactivation, and session revocation.
- **Enterprise SQLite storage**: typed tables (`queue_items`, `audit_events`, `users`, …), versioned migrations, append-only audit (no 500 cap), row-level login rate limits.
- **Environment hardening (S019)**: `DENTALAI_APP_ENV` separation, boot-time secret hygiene, CSP + security headers, `/api/health` monitoring probe (no secrets exposed).
- **Backup evidence (S020)**: SQLite backup/restore scripts with manifest JSON and incident-response evidence pack.
- **Role navigation (S021)**: Primary + More menus per four-role matrix; route guards on manager-only surfaces.
- **Browser acceptance (S022)**: Real-browser auth, clinic access, role nav, CSP re-run; automated matrix in `browser-acceptance.test.ts`.
- **Schema band (S023–S028)**: `app_settings` migration v6; consolidated schema-foundation verification tests.
- Protected routes, clinic scoping, queue actions, audit events, caller-identity scenarios, and a deterministic rules prototype.
- A server-only GET-only Dentally client with safe-path validation, typed parsers, readiness reporting, clinic-to-site mapping, audited reads, and structural token-leak tests.

The expanded Sessions 1-5 operating system is not implemented yet: full queue taxonomy, callbacks, duplicate logic, holding SMS, slot holds, Dentally writes, CallSwitch, live voice, panic override, shadow mode, waiting lists, recall campaigns, reporting, compliance workflows, onboarding walkthrough, and pilot controls remain ahead.

## Known Re-Audit Findings

- `npm run verify` passes: typecheck, lint, **411** Vitest tests across **36** files, and production build.
- Demo seed accounts still use password **`demo`** (now stored as scrypt hashes in SQLite when persistence is on).
- First-claim queue locking and critical manager notifications remain future queue OS work.
- Multi-instance HA, Postgres, and formal compliance retention hooks are not yet implemented.

## Locked Product Rule

> **AI prepares. Humans approve diary-changing actions. Dentally confirms successful appointments.**

## Quick Start

```bash
cp .env.example .env.local
# Fill in AUTH_SECRET. Generate one with: openssl rand -base64 32
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Mock Accounts

All seed accounts use password **`demo`** (hashed at rest when persistence is enabled).

| Email | Role | Clinic(s) |
|---|---|---|
| `reception@smile-dental.co.uk` | Receptionist | Clinic 1 |
| `manager@smile-dental.co.uk` | Practice Manager | Clinic 1 |
| `owner@smile-dental.co.uk` | Group Owner | Clinics 1, 2, 3 |
| `admin@dentalai.co.uk` | Super Admin | All clinics (requires MFA) |

Managers can invite staff at `/staff`. Password reset at `/reset`.

**Super Admin MFA (dev):** seed secret `JBSWY3DPEHPK3PXP` (or override with `DENTALAI_SUPERADMIN_MFA_SECRET`). Use any authenticator app; the current 6-digit TOTP code is required at login alongside password `demo`.

## Commands

```bash
npm run dev
npm run typecheck
npm run lint
npm run test
npm run build
npm run verify
npm run db:backup          # backup .data/dentalai.db → .data/backups/
npm run db:restore -- --from .data/backups/dentalai-<timestamp>.db
npm run incident:evidence  # emit incident-response JSON (no secrets)
```

Health probe (when running): [http://localhost:3000/api/health](http://localhost:3000/api/health)

## Architecture Snapshot

| Layer | Current implementation |
|---|---|
| Framework | Next.js 16 App Router |
| Language | TypeScript strict mode |
| Styling | Tailwind CSS 4 plus Calm components |
| Auth | Auth.js + scrypt passwords + session revocation |
| Validation | Zod |
| Tests | Vitest |
| Persistence | Typed SQLite (WAL, migrations, repositories) |
| Dentally | Server-only GET-only read proof |
| Ops | Env separation, CSP, health probe, backup scripts |

## Security Boundary

- Protected actions use authenticated session actors and clinic checks.
- Queue mutations pass through server-side permission checks.
- Staff lifecycle: invitations (72h), reset links (30m), deactivation revokes sessions and releases locks.
- Dentally client exports GET-only reads and rejects unsafe paths.
- Audit log is append-only in typed storage.
- CSP and companion headers on all routes; secrets never use `NEXT_PUBLIC_` prefix.

## Planning Source of Truth

Use `../dentalai-planning-redesign.html`:

1. **Build Breakdown** for current app truth and exact active slice.
2. **Locked Product Book** for Sessions 1-5 implementation rules.
3. **Slice Ledger** for the 36-phase, 269-slice delivery path.
4. **Decision Register** for locked and still-open validation decisions.
5. **Technical Log** as archived journey history only.
