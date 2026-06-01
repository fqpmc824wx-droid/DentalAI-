#!/usr/bin/env node
/**
 * Safe Dentally live-read probe — no token or PII in output.
 *
 * Usage: node scripts/dentally-live-probe.mjs [--out FILE]
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadLocalEnv } from './load-local-env.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(__dirname, '..')

loadLocalEnv(appRoot)

function getDataDir() {
  const fromEnv = process.env.DENTALAI_DATA_DIR?.trim()
  if (fromEnv) return path.resolve(fromEnv)
  return path.join(appRoot, '.data')
}

function readAppEnv() {
  const explicit = process.env.DENTALAI_APP_ENV?.trim().toLowerCase()
  if (['development', 'staging', 'production', 'test'].includes(explicit ?? '')) {
    return explicit
  }
  if (process.env.NODE_ENV === 'production') return 'production'
  return 'development'
}

function parseArgs(argv) {
  const outIdx = argv.indexOf('--out')
  return { outFile: outIdx >= 0 ? argv[outIdx + 1] : null }
}

function safeHost(baseUrl) {
  try {
    return new URL(baseUrl).host
  } catch {
    return null
  }
}

async function probeUserEndpoint(baseUrl, token, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const started = Date.now()
  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/v1/user`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    })
    const durationMs = Date.now() - started
    let userIdPresent = false
    if (response.ok) {
      try {
        const body = await response.json()
        const record = body?.user ?? body
        userIdPresent = Boolean(record?.id || record?.uuid)
      } catch {
        userIdPresent = false
      }
    }
    return {
      ok: response.ok,
      statusCode: response.status,
      durationMs,
      userIdPresent,
      category:
        response.status === 401
          ? 'auth'
          : response.status === 403
            ? 'forbidden'
            : response.status === 429
              ? 'rate_limited'
              : response.ok
                ? undefined
                : response.status >= 500
                  ? 'server'
                  : 'unknown',
    }
  } catch (error) {
    return {
      ok: false,
      statusCode: undefined,
      durationMs: Date.now() - started,
      userIdPresent: false,
      category: error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'network',
    }
  } finally {
    clearTimeout(timer)
  }
}

const baseUrl = process.env.DENTALLY_API_BASE_URL?.trim() ?? ''
const token = process.env.DENTALLY_API_TOKEN?.trim() ?? ''
const timeoutMs = Number.parseInt(process.env.DENTALLY_TIMEOUT_MS ?? '8000', 10) || 8000
const configured = Boolean(baseUrl && token)

let probe = null
if (configured) {
  probe = await probeUserEndpoint(baseUrl, token, timeoutMs)
}

const healthStatus = !configured
  ? 'not_configured'
  : probe.ok
    ? probe.durationMs > timeoutMs * 0.75
      ? 'degraded'
      : 'connected'
    : probe.category === 'rate_limited'
      ? 'degraded'
      : 'unavailable'

const artifact = {
  kind: 'dentally_live_read_probe',
  generatedAt: new Date().toISOString(),
  appEnv: readAppEnv(),
  configured,
  apiHost: configured ? safeHost(baseUrl) : null,
  probePath: '/v1/user',
  healthStatus,
  durationMs: probe?.durationMs ?? null,
  httpStatus: probe?.statusCode ?? null,
  userEndpointReachable: probe?.ok ?? false,
  userIdPresent: probe?.userIdPresent ?? false,
  errorCategory: probe?.category ?? (configured ? undefined : 'not_configured'),
  exclusions: [
    'Never paste or print DENTALLY_API_TOKEN',
    'Never include patient-identifiable payloads',
    'Never log raw Dentally response bodies',
  ],
}

const { outFile } = parseArgs(process.argv.slice(2))
const defaultOut = path.join(getDataDir(), 'evidence', 'dentally-live-read-probe.json')
const target = path.resolve(outFile ?? defaultOut)
fs.mkdirSync(path.dirname(target), { recursive: true })
fs.writeFileSync(target, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')

console.log(
  JSON.stringify(
    {
      ok: configured && probe?.ok,
      written: target,
      healthStatus,
      durationMs: probe?.durationMs ?? null,
    },
    null,
    2,
  ),
)

process.exit(configured && probe?.ok ? 0 : 1)
