/**
 * Clinic mapping — DentalAI clinic ID ↔ Dentally site ID.
 *
 * Phase 2.4: explicit, code-defined mapping. No auto-trust. If a clinic
 * has no entry here, the integration page shows it as `setup_required`.
 * If Dentally returns a site not in this table, it also surfaces as
 * `unmapped`. Both are deliberate human-decision moments.
 *
 * Phase 5+ will move this to a database-backed admin form. Until then the
 * source of truth is this file — a code review of any change here is the
 * gate for granting a site access to DentalAI.
 *
 * Pure module. No Next.js, no `import 'server-only'` — safe for tests and
 * server components alike.
 */

import { canAccessClinic, type SessionActor } from '@/lib/access-control'

/** A single explicit DentalAI ↔ Dentally binding. */
export type ClinicSiteBinding = {
  /** Internal DentalAI clinic ID. Matches lib/mock/clinics.ts. */
  clinicId: string
  /** Dentally site ID this clinic represents in Dentally. */
  dentallySiteId: string
  /** Optional human note for reviewers (e.g. "Smile Whitechapel — UAT"). */
  note?: string
}

export const GK_HAWICK_DENTALLY_SITE_ID = '8e0f35a8-a7b1-4fe7-8c85-780505eeb2ce'

/**
 * THE MAPPING TABLE.
 *
 * Phase 2 pilot mapping:
 *   - clinic-1 is GK Hawick, the first Dentally read-only proof site.
 *   - Other visible Dentally sites remain unmapped rollout candidates until
 *     explicitly approved.
 */
export const CLINIC_SITE_BINDINGS: ClinicSiteBinding[] = [
  {
    clinicId: 'clinic-1',
    dentallySiteId: GK_HAWICK_DENTALLY_SITE_ID,
    note: 'GK Hawick — TD9 9EE · first pilot site',
  },
]

/** Status of a single DentalAI clinic's Dentally binding. */
export type ClinicMappingStatus =
  | { status: 'mapped'; clinicId: string; dentallySiteId: string; note?: string }
  | { status: 'setup_required'; clinicId: string }

/** Status of a Dentally site seen via the token. */
export type SiteMappingStatus =
  | { status: 'mapped'; dentallySiteId: string; clinicId: string; note?: string }
  | { status: 'unmapped'; dentallySiteId: string }

/** Look up the binding for an internal clinic. */
export function getBindingByClinicId(clinicId: string): ClinicSiteBinding | undefined {
  return CLINIC_SITE_BINDINGS.find(b => b.clinicId === clinicId)
}

/** Look up the binding for a Dentally site. */
export function getBindingByDentallySiteId(dentallySiteId: string): ClinicSiteBinding | undefined {
  return CLINIC_SITE_BINDINGS.find(b => b.dentallySiteId === dentallySiteId)
}

/** Status report for a single clinic. */
export function clinicSiteMappingStatus(clinicId: string): ClinicMappingStatus {
  const binding = getBindingByClinicId(clinicId)
  if (binding) {
    return {
      status: 'mapped',
      clinicId,
      dentallySiteId: binding.dentallySiteId,
      note: binding.note,
    }
  }
  return { status: 'setup_required', clinicId }
}

/** Status report for every clinic the actor can see. */
export function clinicSiteMappingStatusesForActor(actor: SessionActor): ClinicMappingStatus[] {
  // super_admin sees all clinics in the mapping table + the actor's clinics
  if (actor.role === 'super_admin') {
    const all = new Set<string>([...actor.clinicIds, ...CLINIC_SITE_BINDINGS.map(b => b.clinicId)])
    return Array.from(all).map(clinicSiteMappingStatus)
  }
  return actor.clinicIds.map(clinicSiteMappingStatus)
}

/**
 * Status report for a list of Dentally sites the token returned —
 * filtered to only those the actor is allowed to see.
 *
 * - mapped + actor-accessible → returned
 * - mapped but other clinic → hidden from this actor (cross-clinic isolation)
 * - unmapped → surfaced to super_admin only (it's a setup-time decision)
 */
export function siteMappingStatusesForActor(
  sites: Array<{ id: string }>,
  actor: SessionActor,
): SiteMappingStatus[] {
  const out: SiteMappingStatus[] = []
  for (const p of sites) {
    const binding = getBindingByDentallySiteId(p.id)
    if (binding) {
      if (canAccessClinic(actor, binding.clinicId)) {
        out.push({
          status: 'mapped',
          dentallySiteId: p.id,
          clinicId: binding.clinicId,
          note: binding.note,
        })
      }
      // else: mapped to a clinic this actor cannot see — hide entirely.
    } else if (actor.role === 'super_admin') {
      // Unmapped sites are surfaced ONLY to super_admin for setup.
      out.push({ status: 'unmapped', dentallySiteId: p.id })
    }
  }
  return out
}
