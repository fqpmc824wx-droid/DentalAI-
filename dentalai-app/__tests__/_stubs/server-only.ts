/**
 * Vitest stub for `server-only`.
 *
 * Next.js 16 handles the `server-only` directive itself at build time —
 * it does NOT come from an npm package. Vitest (which runs through Vite)
 * can't resolve the bare specifier, so we alias it to this empty module
 * inside `vitest.config.ts`.
 *
 * In production Next.js still enforces the boundary; this stub only exists
 * so `import 'server-only'` does not crash the test runner.
 */
export {}
