import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['lib/**/*.ts'],
      exclude: ['lib/mock/**', '**/*.d.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // Next.js 16 ships its own implementation of `server-only`. Vitest
      // runs outside Next so it can't resolve the bare specifier. Stub it.
      'server-only': path.resolve(__dirname, '__tests__/_stubs/server-only.ts'),
    },
  },
  esbuild: {
    target: 'node18',
  },
})
