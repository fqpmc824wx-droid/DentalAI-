/**
 * S038–S040 — Formal Dentally read-proof sign-off artifact (code-side builder).
 *
 * Combines rotation evidence, live probe metadata, and structural checks into
 * one safe JSON artifact. Never embeds tokens, raw Dentally bodies, or PII.
 */

import { assertReadOnlyEndpointRegistry } from '@/lib/dentally/endpoints'
import * as dentallyClient from '@/lib/dentally/client'

export type DentallyReadProofSignoffArtifact = {
  kind: 'dentally_read_proof_signoff'
  signedOffAt: string
  slices: ['S029', 'S030', 'S031', 'S032', 'S033', 'S034', 'S035', 'S036', 'S037', 'S038', 'S039', 'S040']
  rotationEvidence: {
    rotationRecorded: boolean
    rotationAt?: string | null
    rotationBy?: string | null
  }
  liveProbe: {
    configured: boolean
    healthStatus?: string
    userEndpointReachable?: boolean
    durationMs?: number | null
    apiHost?: string | null
  }
  structuralProof: {
    getOnlyClient: boolean
    endpointRegistryCount: number
    writeHelpersExported: boolean
  }
  roleGatedIntegrationsPage: {
    route: '/integrations'
    requiresAuth: true
    rendersReadinessReport: true
  }
  exclusions: string[]
}

export type BuildReadProofSignoffInput = {
  rotationEvidence?: {
    rotationRecorded?: boolean
    rotationAt?: string | null
    rotationBy?: string | null
  }
  liveProbe?: {
    configured?: boolean
    healthStatus?: string
    userEndpointReachable?: boolean
    durationMs?: number | null
    apiHost?: string | null
  }
}

export function proveGetOnlyClientExports(): { getOnlyClient: boolean; writeHelpersExported: boolean } {
  const exports = Object.keys(dentallyClient)
  const writeHelpersExported = exports.some(name => /post|put|patch|delete|write/i.test(name))
  return {
    getOnlyClient: exports.includes('dentallyGet') && !writeHelpersExported,
    writeHelpersExported,
  }
}

export function buildReadProofSignoffArtifact(
  input: BuildReadProofSignoffInput = {},
): DentallyReadProofSignoffArtifact {
  const structural = proveGetOnlyClientExports()
  const registry = assertReadOnlyEndpointRegistry()

  return {
    kind: 'dentally_read_proof_signoff',
    signedOffAt: new Date().toISOString(),
    slices: ['S029', 'S030', 'S031', 'S032', 'S033', 'S034', 'S035', 'S036', 'S037', 'S038', 'S039', 'S040'],
    rotationEvidence: {
      rotationRecorded: input.rotationEvidence?.rotationRecorded ?? false,
      rotationAt: input.rotationEvidence?.rotationAt ?? null,
      rotationBy: input.rotationEvidence?.rotationBy ?? null,
    },
    liveProbe: {
      configured: input.liveProbe?.configured ?? false,
      healthStatus: input.liveProbe?.healthStatus,
      userEndpointReachable: input.liveProbe?.userEndpointReachable,
      durationMs: input.liveProbe?.durationMs ?? null,
      apiHost: input.liveProbe?.apiHost ?? null,
    },
    structuralProof: {
      getOnlyClient: structural.getOnlyClient,
      endpointRegistryCount: registry.count,
      writeHelpersExported: structural.writeHelpersExported,
    },
    roleGatedIntegrationsPage: {
      route: '/integrations',
      requiresAuth: true,
      rendersReadinessReport: true,
    },
    exclusions: [
      'Never paste or print DENTALLY_API_TOKEN',
      'Never include patient-identifiable payloads',
      'No Dentally write helpers until P21 allowlist work',
    ],
  }
}

export function isReadProofSignoffComplete(artifact: DentallyReadProofSignoffArtifact): boolean {
  return (
    artifact.rotationEvidence.rotationRecorded &&
    artifact.liveProbe.configured === true &&
    artifact.liveProbe.userEndpointReachable === true &&
    artifact.structuralProof.getOnlyClient &&
    !artifact.structuralProof.writeHelpersExported
  )
}
