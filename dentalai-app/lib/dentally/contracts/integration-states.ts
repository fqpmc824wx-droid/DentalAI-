/**
 * S037 — Degraded and unavailable Dentally integration states.
 *
 * Maps health and readiness reports into staff-visible operational banners.
 * Pure module — safe for tests and UI mappers alike.
 */

import type { DentallyHealthStatus } from '@/lib/dentally/health'
import type { DentallyReadinessStatus } from '@/lib/dentally/readiness'

export type DentallyIntegrationBannerState =
  | 'connected'
  | 'degraded'
  | 'unavailable'
  | 'setup_required'
  | 'human_only'

export type DentallyIntegrationBanner = {
  state: DentallyIntegrationBannerState
  headline: string
  nextAction: string
  showDentallyLinkPanel: boolean
  allowBookingPreparation: boolean
}

const BANNERS: Record<DentallyIntegrationBannerState, Omit<DentallyIntegrationBanner, 'state'>> = {
  connected: {
    headline: 'Dentally connected',
    nextAction: 'Routine reads available. Diary writes still require human approval.',
    showDentallyLinkPanel: true,
    allowBookingPreparation: true,
  },
  degraded: {
    headline: 'Dentally degraded',
    nextAction: 'Use human verification and avoid autonomous booking preparation until reads stabilise.',
    showDentallyLinkPanel: true,
    allowBookingPreparation: false,
  },
  unavailable: {
    headline: 'Dentally unavailable',
    nextAction: 'Switch to human-only mode. Capture details manually and retry later.',
    showDentallyLinkPanel: false,
    allowBookingPreparation: false,
  },
  setup_required: {
    headline: 'Dentally not configured',
    nextAction: 'Complete integration setup before using Dentally-linked queue features.',
    showDentallyLinkPanel: false,
    allowBookingPreparation: false,
  },
  human_only: {
    headline: 'Human-only mode',
    nextAction: 'Do not rely on Dentally reads. Staff must verify and act manually.',
    showDentallyLinkPanel: false,
    allowBookingPreparation: false,
  },
}

export function mapHealthStatusToBannerState(status: DentallyHealthStatus): DentallyIntegrationBannerState {
  if (status === 'not_configured') return 'setup_required'
  return status
}

export function mapReadinessStatusToBannerState(status: DentallyReadinessStatus): DentallyIntegrationBannerState {
  if (status === 'setup_required') return 'setup_required'
  if (status === 'unavailable') return 'unavailable'
  if (status === 'degraded') return 'degraded'
  return 'connected'
}

export function resolveIntegrationBanner(input: {
  healthStatus: DentallyHealthStatus
  readinessStatus?: DentallyReadinessStatus
  forceHumanOnly?: boolean
}): DentallyIntegrationBanner {
  if (input.forceHumanOnly) {
    return { state: 'human_only', ...BANNERS.human_only }
  }

  const fromReadiness = input.readinessStatus
    ? mapReadinessStatusToBannerState(input.readinessStatus)
    : mapHealthStatusToBannerState(input.healthStatus)

  const rank: Record<DentallyIntegrationBannerState, number> = {
    connected: 0,
    degraded: 1,
    setup_required: 2,
    unavailable: 3,
    human_only: 4,
  }

  const fromHealth = mapHealthStatusToBannerState(input.healthStatus)
  const state = rank[fromHealth] > rank[fromReadiness] ? fromHealth : fromReadiness

  return { state, ...BANNERS[state] }
}

export const DEGRADED_STATE_COVERAGE = [
  'connected',
  'degraded',
  'unavailable',
  'setup_required',
  'human_only',
] as const
