/**
 * Structural token-leak test — Phase 2.4 closure.
 *
 * This is the static-grep companion to the runtime token-redaction tests
 * in `dentally-client.test.ts` and `dentally-health.test.ts`. Where those
 * inject a fake token and assert it never appears in returned errors or
 * reports, this test goes one layer deeper: it asserts the file system
 * itself enforces the rule that ONLY `lib/dentally/env.ts` reads the
 * Dentally token from process.env.
 *
 * Why: the runtime tests can't catch a regression like:
 *
 *     // some-new-file.ts
 *     const t = process.env.DENTALLY_API_TOKEN
 *     console.log('using token', t)  // <-- leak
 *
 * If we don't structurally prevent this, a future change might add a
 * second token reader and silently bypass the server-only guarantees of
 * `lib/dentally/env.ts`. This test fails fast in CI if that ever happens.
 *
 * Also blocks any `NEXT_PUBLIC_DENTALLY_*` variable from ever being
 * introduced — that prefix would bundle the value into the browser code.
 */

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(__dirname, '..')

/** Files allowed to read the Dentally token directly.
 *
 *  - lib/dentally/env.ts is the single canonical reader that hands the
 *    token to the GET-only client; it uses `import 'server-only'`.
 *  - lib/env.ts is the boot-time validator that ONLY checks token presence
 *    (`process.env.DENTALLY_API_TOKEN && !process.env.DENTALLY_API_BASE_URL`)
 *    to fail fast on misconfiguration. It never assigns the value to a
 *    variable or returns it. Allowed by design.
 */
const TOKEN_READER_ALLOWLIST = [
  'lib/dentally/env.ts',
  'lib/env.ts',
  // Operational CLI scripts — never bundled into Next.js; emit safe evidence only.
  'scripts/dentally-live-probe.mjs',
  'scripts/dentally-rotation-evidence.mjs',
]

/** Directories to skip when walking the source tree. */
const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  '.git',
  'dist',
  'build',
  'coverage',
  // The test stubs directory is allowed to reference the env name in
  // documentation comments without triggering the structural rule.
  '__tests__/_stubs',
])

function listSourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.') && entry !== '.env.example') continue
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const rel = relative(ROOT, full)
    if (SKIP_DIRS.has(rel)) continue
    const s = statSync(full)
    if (s.isDirectory()) {
      out.push(...listSourceFiles(full))
    } else if (
      entry.endsWith('.ts') ||
      entry.endsWith('.tsx') ||
      entry.endsWith('.js') ||
      entry.endsWith('.mjs')
    ) {
      out.push(full)
    }
  }
  return out
}

describe('Structural token-leak guarantees', () => {
  const sourceFiles = listSourceFiles(ROOT)

  it('finds source files to scan (sanity)', () => {
    expect(sourceFiles.length).toBeGreaterThan(20)
  })

  it('only the allowlisted file references process.env.DENTALLY_API_TOKEN', () => {
    const offenders: string[] = []
    for (const file of sourceFiles) {
      const rel = relative(ROOT, file).replace(/\\/g, '/')
      // Tests themselves may reference the variable name in setup logic;
      // skip the test directory entirely for this check. They never reach
      // a browser bundle anyway.
      if (rel.startsWith('__tests__/')) continue
      const content = readFileSync(file, 'utf8')
      if (content.includes('process.env.DENTALLY_API_TOKEN')) {
        if (!TOKEN_READER_ALLOWLIST.includes(rel)) {
          offenders.push(rel)
        }
      }
    }
    if (offenders.length > 0) {
      throw new Error(
        `Found ${offenders.length} file(s) reading process.env.DENTALLY_API_TOKEN outside ` +
        `the allowlist (${TOKEN_READER_ALLOWLIST.join(', ')}):\n  - ${offenders.join('\n  - ')}\n\n` +
        'Read the token only through readDentallyEnv() in lib/dentally/env.ts so the ' +
        'server-only guarantee survives.',
      )
    }
    expect(offenders).toEqual([])
  })

  it('no NEXT_PUBLIC_DENTALLY_* variable exists anywhere in source or env examples', () => {
    const offenders: { file: string; match: string }[] = []
    const pattern = /NEXT_PUBLIC_DENTALLY_[A-Z_]+/g
    // Also scan .env.example specifically since it's the documentation
    // for env vars and could accidentally introduce a public variant.
    const envExample = join(ROOT, '.env.example')
    const scanList = [...sourceFiles, envExample]
    for (const file of scanList) {
      const rel = relative(ROOT, file).replace(/\\/g, '/')
      // Don't fail on this very test file mentioning the pattern.
      if (rel === '__tests__/dentally-token-leak.test.ts') continue
      let content: string
      try {
        content = readFileSync(file, 'utf8')
      } catch {
        continue
      }
      const matches = content.match(pattern)
      if (matches) {
        for (const m of matches) {
          offenders.push({ file: rel, match: m })
        }
      }
    }
    if (offenders.length > 0) {
      throw new Error(
        `Found ${offenders.length} NEXT_PUBLIC_DENTALLY_* reference(s). ` +
        'That prefix would bundle the value into the browser. Use a server-only ' +
        'env var (no NEXT_PUBLIC_ prefix) instead:\n  ' +
        offenders.map(o => `${o.file}: ${o.match}`).join('\n  '),
      )
    }
    expect(offenders).toEqual([])
  })

  it('lib/dentally/env.ts uses the server-only directive', () => {
    const envFile = readFileSync(join(ROOT, 'lib/dentally/env.ts'), 'utf8')
    expect(envFile).toMatch(/^import ['"]server-only['"]/m)
  })

  it('lib/dentally/client.ts uses the server-only directive', () => {
    const file = readFileSync(join(ROOT, 'lib/dentally/client.ts'), 'utf8')
    expect(file).toMatch(/^import ['"]server-only['"]/m)
  })

  it('lib/dentally/audit.ts uses the server-only directive', () => {
    const file = readFileSync(join(ROOT, 'lib/dentally/audit.ts'), 'utf8')
    expect(file).toMatch(/^import ['"]server-only['"]/m)
  })
})
