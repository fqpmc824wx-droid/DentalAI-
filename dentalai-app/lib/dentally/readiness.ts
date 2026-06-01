import 'server-only'

import type { SessionActor } from '@/lib/access-control'
import { checkDentallyHealth, type DentallyHealthReport, type DentallyHealthStatus } from './health'
import { readDentallyPractice } from './practice'
import { readDentallySites } from './site'
import { readDentallyUser } from './user'
import { auditDentallyRead } from './audit'
import {
  clinicSiteMappingStatusesForActor,
  siteMappingStatusesForActor,
  type ClinicMappingStatus,
  type SiteMappingStatus,
} from './mapping'
import type { DentallyPractice, DentallySite, DentallyUser } from './types'

export type DentallyReadinessStatus =
  | 'connected'
  | 'degraded'
  | 'unavailable'
  | 'setup_required'

export type DentallyReadinessReport = {
  status: DentallyReadinessStatus
  checkedAt: string
  health: DentallyHealthReport
  user?: DentallyUser
  practice?: DentallyPractice
  sites: DentallySite[]
  clinicMappings: ClinicMappingStatus[]
  siteMappings: SiteMappingStatus[]
  visibleSiteCount: number
  mappedSiteCount: number
  rolloutCandidateCount: number
  warnings: string[]
}

function mapHealthStatus(status: DentallyHealthStatus): DentallyReadinessStatus {
  if (status === 'not_configured') return 'setup_required'
  if (status === 'connected') return 'connected'
  if (status === 'degraded') return 'degraded'
  return 'unavailable'
}

function degrade(
  current: DentallyReadinessStatus,
  next: DentallyReadinessStatus,
): DentallyReadinessStatus {
  const rank: Record<DentallyReadinessStatus, number> = {
    connected: 0,
    degraded: 1,
    setup_required: 2,
    unavailable: 3,
  }
  return rank[next] > rank[current] ? next : current
}

/**
 * Enterprise readiness service for Phase 2.
 *
 * It intentionally returns safe operational status only: no token, no raw
 * Dentally bodies, no patient data. The admin UI can render this directly.
 */
export async function getDentallyReadinessReport(
  actor: SessionActor,
): Promise<DentallyReadinessReport> {
  const health = await checkDentallyHealth()
  const checkedAt = new Date().toISOString()
  const warnings: string[] = []

  // Audit the health probe — every check is recorded against the actor
  // who triggered it (the integrations page loader).
  auditDentallyRead({
    resource: 'health',
    actor,
    clinicId: actor.clinicId,
    ok: health.status === 'connected' || health.status === 'degraded',
    durationMs: health.durationMs,
    category: health.errorCategory,
  })

  let status = mapHealthStatus(health.status)
  if (status === 'setup_required' || status === 'unavailable') {
    return {
      status,
      checkedAt,
      health,
      sites: [],
      clinicMappings: clinicSiteMappingStatusesForActor(actor),
      siteMappings: [],
      visibleSiteCount: 0,
      mappedSiteCount: 0,
      rolloutCandidateCount: 0,
      warnings: [health.message],
    }
  }

  const [user, practice, sites] = await Promise.all([
    readDentallyUser(),
    readDentallyPractice(),
    readDentallySites(),
  ])

  // Audit each foundation read — actor, duration, success/failure, no PII.
  auditDentallyRead({
    resource: 'user',
    actor,
    clinicId: actor.clinicId,
    ok: user.ok,
    durationMs: user.durationMs,
    category: user.ok ? undefined : user.category,
    resourceId: user.ok ? user.data.id : undefined,
  })
  auditDentallyRead({
    resource: 'practice',
    actor,
    clinicId: actor.clinicId,
    ok: practice.ok,
    durationMs: practice.durationMs,
    category: practice.ok ? undefined : practice.category,
    resourceId: practice.ok ? practice.data.id : undefined,
  })
  auditDentallyRead({
    resource: 'sites',
    actor,
    clinicId: actor.clinicId,
    ok: sites.ok,
    durationMs: sites.durationMs,
    category: sites.ok ? undefined : sites.category,
    counts: sites.ok ? { sites: sites.data.length } : undefined,
  })

  if (!user.ok) {
    status = degrade(status, 'degraded')
    warnings.push(`Current user read failed: ${user.category}`)
  }
  if (!practice.ok) {
    status = degrade(status, 'degraded')
    warnings.push(`Practice read failed: ${practice.category}`)
  }
  if (!sites.ok) {
    status = degrade(status, 'degraded')
    warnings.push(`Sites read failed: ${sites.category}`)
  }

  const siteData = sites.ok ? sites.data : []
  const clinicMappings = clinicSiteMappingStatusesForActor(actor)
  const siteMappings = siteMappingStatusesForActor(siteData, actor)
  const mappedSiteCount = siteMappings.filter(mapping => mapping.status === 'mapped').length
  const rolloutCandidateCount = siteMappings.filter(mapping => mapping.status === 'unmapped').length

  if (clinicMappings.some(mapping => mapping.status === 'setup_required')) {
    status = degrade(status, 'degraded')
    warnings.push('One or more accessible clinics is not mapped to a Dentally site.')
  }

  return {
    status,
    checkedAt,
    health,
    user: user.ok ? user.data : undefined,
    practice: practice.ok ? practice.data : undefined,
    sites: siteData,
    clinicMappings,
    siteMappings,
    visibleSiteCount: siteData.length,
    mappedSiteCount,
    rolloutCandidateCount,
    warnings,
  }
}
