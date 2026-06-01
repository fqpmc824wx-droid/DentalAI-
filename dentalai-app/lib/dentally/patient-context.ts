import 'server-only'

import { readDentallyPatient } from './patient'
import { readDentallyPatientAppointments } from './appointments'
import { readFinancialAccountFlagForPatient } from './financial'
import {
  getUnbookedTreatmentAppointments,
  readDentallyTreatmentAppointments,
  readDentallyTreatmentPlanItems,
  readDentallyTreatmentPlans,
} from './treatment'
import { auditDentallyRead } from './audit'
import type { DentallyErrorCategory } from './errors'
import type { SafePatientContext } from './types'
import type { SessionActor } from '@/lib/access-control'

export type PatientContextResult =
  | { ok: true; data: SafePatientContext; durationMs: number }
  | {
      ok: false
      category: DentallyErrorCategory
      statusCode?: number
      durationMs: number
      warnings: string[]
    }

function addWarning(warnings: string[], label: string, category?: DentallyErrorCategory) {
  warnings.push(category ? `${label}: ${category}` : label)
}

/**
 * Read a safe, minimal Dentally context bundle for human review.
 *
 * This deliberately returns "partial" context if non-critical reads fail.
 * Patient identity is critical; appointments/treatments/financials are helpful
 * and their failures become warnings so the receptionist can still see what
 * has been proven.
 *
 * Every sub-read is audited via `dentally.read.*` events so the trail records
 * who read what and when. Audit events never include patient names, DOBs,
 * phone numbers, balances, or the Dentally token.
 */
export async function readSafePatientContext(
  patientId: string,
  opts: { siteId?: string; actor?: SessionActor; clinicId?: string } = {},
): Promise<PatientContextResult> {
  const warnings: string[] = []
  const auditClinicId = opts.clinicId ?? opts.actor?.clinicId ?? 'system'

  const patient = await readDentallyPatient(patientId)
  auditDentallyRead({
    resource: 'patient',
    actor: opts.actor,
    clinicId: auditClinicId,
    ok: patient.ok,
    durationMs: patient.durationMs,
    category: patient.ok ? undefined : patient.category,
    resourceId: patientId,
  })
  if (!patient.ok) {
    return {
      ok: false,
      category: patient.category,
      statusCode: patient.statusCode,
      durationMs: patient.durationMs,
      warnings: ['Patient detail read failed. Do not prepare a booking request from this context.'],
    }
  }

  const [appointments, treatmentAppointments, treatmentPlans, treatmentPlanItems, financial] = await Promise.all([
    readDentallyPatientAppointments(patientId, opts.siteId),
    readDentallyTreatmentAppointments({ patientId }),
    readDentallyTreatmentPlans({ patientId }),
    readDentallyTreatmentPlanItems({ patientId }),
    readFinancialAccountFlagForPatient(patientId),
  ])

  // Audit each sub-read with the actor + clinic context. Counts (never PII)
  // are recorded so reviewers can see "appointments returned 3" without ever
  // seeing the appointment detail.
  auditDentallyRead({
    resource: 'appointments',
    actor: opts.actor,
    clinicId: auditClinicId,
    ok: appointments.ok,
    durationMs: appointments.durationMs,
    category: appointments.ok ? undefined : appointments.category,
    resourceId: patientId,
    counts: appointments.ok ? { appointments: appointments.data.length } : undefined,
  })
  auditDentallyRead({
    resource: 'treatment_appointments',
    actor: opts.actor,
    clinicId: auditClinicId,
    ok: treatmentAppointments.ok,
    durationMs: treatmentAppointments.durationMs,
    category: treatmentAppointments.ok ? undefined : treatmentAppointments.category,
    resourceId: patientId,
    counts: treatmentAppointments.ok ? { treatmentAppointments: treatmentAppointments.data.length } : undefined,
  })
  auditDentallyRead({
    resource: 'treatment_plans',
    actor: opts.actor,
    clinicId: auditClinicId,
    ok: treatmentPlans.ok,
    durationMs: treatmentPlans.durationMs,
    category: treatmentPlans.ok ? undefined : treatmentPlans.category,
    resourceId: patientId,
    counts: treatmentPlans.ok ? { treatmentPlans: treatmentPlans.data.length } : undefined,
  })
  auditDentallyRead({
    resource: 'treatment_plan_items',
    actor: opts.actor,
    clinicId: auditClinicId,
    ok: treatmentPlanItems.ok,
    durationMs: treatmentPlanItems.durationMs,
    category: treatmentPlanItems.ok ? undefined : treatmentPlanItems.category,
    resourceId: patientId,
    counts: treatmentPlanItems.ok ? { treatmentPlanItems: treatmentPlanItems.data.length } : undefined,
  })
  auditDentallyRead({
    resource: 'financial',
    actor: opts.actor,
    clinicId: auditClinicId,
    ok: financial.ok,
    durationMs: financial.durationMs,
    category: financial.ok ? undefined : financial.category,
    resourceId: patientId,
  })

  if (!appointments.ok) addWarning(warnings, 'Appointment list read failed', appointments.category)
  if (!treatmentAppointments.ok) addWarning(warnings, 'Treatment appointment read failed', treatmentAppointments.category)
  if (!treatmentPlans.ok) addWarning(warnings, 'Treatment plan read failed', treatmentPlans.category)
  if (!treatmentPlanItems.ok) addWarning(warnings, 'Treatment plan items read failed', treatmentPlanItems.category)
  if (!financial.ok) addWarning(warnings, 'Financial account flag read failed', financial.category)

  const appointmentData = appointments.ok ? appointments.data : []
  const treatmentAppointmentData = treatmentAppointments.ok ? treatmentAppointments.data : []
  const treatmentPlanData = treatmentPlans.ok ? treatmentPlans.data : []
  const treatmentPlanItemData = treatmentPlanItems.ok ? treatmentPlanItems.data : []
  const financialData = financial.ok
    ? financial.data
    : {
        accountIds: [],
        hasAccountData: false,
        hasOutstandingBalance: false,
        creditBalance: false,
        restricted: false,
        reviewReason: 'Financial context unavailable. Human review required before any approval.',
      }

  return {
    ok: true,
    data: {
      patient: patient.data,
      appointments: appointmentData,
      treatmentAppointments: treatmentAppointmentData,
      unbookedTreatmentAppointments: getUnbookedTreatmentAppointments(treatmentAppointmentData),
      treatmentPlans: treatmentPlanData,
      treatmentPlanItems: treatmentPlanItemData,
      financial: financialData,
      readiness: warnings.length === 0 ? 'complete' : 'partial',
      warnings,
    },
    durationMs: patient.durationMs +
      appointments.durationMs +
      treatmentAppointments.durationMs +
      treatmentPlans.durationMs +
      treatmentPlanItems.durationMs +
      financial.durationMs,
  }
}

