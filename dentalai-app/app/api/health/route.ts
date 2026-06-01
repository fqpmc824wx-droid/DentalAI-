import { NextResponse } from 'next/server'
import { getHealthReport } from '@/lib/monitoring/health'
import { readRuntimeConfig } from '@/lib/env/runtime'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cfg = readRuntimeConfig()
  if (!cfg.monitoringEnabled) {
    return NextResponse.json({ status: 'disabled' }, { status: 404 })
  }

  const report = getHealthReport()
  const httpStatus = report.status === 'unavailable' ? 503 : 200

  return NextResponse.json(report, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
