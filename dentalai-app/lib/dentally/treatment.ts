import 'server-only'

import { dentallyGet } from './client'
import { DENTALLY_ENDPOINTS } from './endpoints'
import type { DentallyErrorCategory } from './errors'
import {
  appendQuery,
  asRecord,
  booleanField,
  numberField,
  textField,
  unwrapList,
  unwrapOne,
} from './parse'
import type {
  DentallyTreatmentAppointment,
  DentallyTreatmentPlan,
  DentallyTreatmentPlanItem,
} from './types'

export type TreatmentReadResult<T> =
  | { ok: true; data: T; durationMs: number }
  | { ok: false; category: DentallyErrorCategory; statusCode?: number; durationMs: number }

export type TreatmentAppointmentParams = {
  patientId?: string
  treatmentPlanId?: string
  createdAfter?: string
  createdBefore?: string
  updatedAfter?: string
  updatedBefore?: string
}

export type TreatmentPlanParams = {
  patientId?: string
  practitionerId?: string
  completed?: boolean
  startDate?: string
  updatedSince?: string
}

export type TreatmentPlanItemParams = {
  patientId?: string
  treatmentPlanId?: string
  treatmentAppointmentId?: string
  practitionerId?: string
  completed?: boolean
  updatedSince?: string
}

function parseTreatmentAppointment(raw: unknown): DentallyTreatmentAppointment | null {
  const record = asRecord(raw)
  if (!record) return null
  const id = textField(record, 'id', 'treatment_appointment_id')
  if (!id) return null

  return {
    id,
    patientId: textField(record, 'patient_id', 'patient_sid'),
    treatmentPlanId: textField(record, 'treatment_plan_id'),
    appointmentId: textField(record, 'appointment_id'),
    bookable: booleanField(record, 'bookable'),
    completed: booleanField(record, 'completed'),
    completedAt: textField(record, 'completed_at') ?? null,
    notes: textField(record, 'notes'),
    position: numberField(record, 'position'),
    createdAt: textField(record, 'created_at'),
    updatedAt: textField(record, 'updated_at'),
  }
}

function parseTreatmentPlan(raw: unknown): DentallyTreatmentPlan | null {
  const record = asRecord(raw)
  if (!record) return null
  const id = textField(record, 'id', 'treatment_plan_id')
  if (!id) return null

  return {
    id,
    patientId: textField(record, 'patient_id', 'patient_sid'),
    practitionerId: textField(record, 'practitioner_id', 'practitioner_sid'),
    nickname: textField(record, 'nickname'),
    completed: booleanField(record, 'completed'),
    completedAt: textField(record, 'completed_at') ?? null,
    startDate: textField(record, 'start_date'),
    endDate: textField(record, 'end_date') ?? null,
    privateTreatmentValue: textField(record, 'private_treatment_value'),
    nhsUdaValue: textField(record, 'nhs_uda_value'),
  }
}

export async function readDentallyTreatmentAppointments(
  params: TreatmentAppointmentParams = {},
): Promise<TreatmentReadResult<DentallyTreatmentAppointment[]>> {
  const result = await dentallyGet<unknown>(
    appendQuery(DENTALLY_ENDPOINTS.treatmentAppointments, {
      patient_id: params.patientId,
      treatment_plan_id: params.treatmentPlanId,
      created_after: params.createdAfter,
      created_before: params.createdBefore,
      updated_after: params.updatedAfter,
      updated_before: params.updatedBefore,
    }),
  )
  if (!result.ok) {
    return { ok: false, category: result.category, statusCode: result.statusCode, durationMs: result.durationMs }
  }

  const arr = unwrapList(result.data, 'treatment_appointments')
  if (!arr) return { ok: false, category: 'malformed', durationMs: result.durationMs }
  return {
    ok: true,
    data: arr.map(parseTreatmentAppointment).filter((item): item is DentallyTreatmentAppointment => item !== null),
    durationMs: result.durationMs,
  }
}

export async function readDentallyTreatmentAppointment(
  treatmentAppointmentId: string,
): Promise<TreatmentReadResult<DentallyTreatmentAppointment>> {
  if (!treatmentAppointmentId.trim()) return { ok: false, category: 'unknown', durationMs: 0 }

  const result = await dentallyGet<unknown>(DENTALLY_ENDPOINTS.treatmentAppointmentById(treatmentAppointmentId))
  if (!result.ok) {
    return { ok: false, category: result.category, statusCode: result.statusCode, durationMs: result.durationMs }
  }

  const parsed = parseTreatmentAppointment(unwrapOne(result.data, 'treatment_appointment'))
  if (!parsed) return { ok: false, category: 'malformed', durationMs: result.durationMs }
  return { ok: true, data: parsed, durationMs: result.durationMs }
}

export async function readDentallyTreatmentPlans(
  params: TreatmentPlanParams = {},
): Promise<TreatmentReadResult<DentallyTreatmentPlan[]>> {
  const result = await dentallyGet<unknown>(
    appendQuery(DENTALLY_ENDPOINTS.treatmentPlans, {
      patient_id: params.patientId,
      practitioner_id: params.practitionerId,
      completed: params.completed,
      start_date: params.startDate,
      updated_since: params.updatedSince,
    }),
  )
  if (!result.ok) {
    return { ok: false, category: result.category, statusCode: result.statusCode, durationMs: result.durationMs }
  }

  const arr = unwrapList(result.data, 'treatment_plans')
  if (!arr) return { ok: false, category: 'malformed', durationMs: result.durationMs }
  return {
    ok: true,
    data: arr.map(parseTreatmentPlan).filter((plan): plan is DentallyTreatmentPlan => plan !== null),
    durationMs: result.durationMs,
  }
}

export function getUnbookedTreatmentAppointments(
  items: DentallyTreatmentAppointment[],
): DentallyTreatmentAppointment[] {
  return items.filter(item =>
    item.bookable === true &&
    item.completed !== true &&
    !item.completedAt &&
    !item.appointmentId
  )
}

export async function readUnbookedTreatmentAppointmentsForPatient(
  patientId: string,
): Promise<TreatmentReadResult<DentallyTreatmentAppointment[]>> {
  const result = await readDentallyTreatmentAppointments({ patientId })
  if (!result.ok) return result
  return {
    ok: true,
    data: getUnbookedTreatmentAppointments(result.data),
    durationMs: result.durationMs,
  }
}

/**
 * Treatment plan items — the individual procedures inside a treatment plan.
 *
 * Each item describes one tooth/procedure (nomenclature), the duration, who
 * delivers it, whether it has been charged/completed, and which treatment
 * appointment it belongs to. This is what the receptionist needs to read to
 * understand "what is the patient actually being booked for, and is it ready?"
 *
 * The Dentally docs list `/v1/treatment_plan_items` as a separate resource
 * from treatment plans and treatment appointments. Reading them together
 * (plan + items + appointments) gives the full read-only picture.
 */
function parseTreatmentPlanItem(raw: unknown): DentallyTreatmentPlanItem | null {
  const record = asRecord(raw)
  if (!record) return null
  const id = textField(record, 'id', 'treatment_plan_item_id')
  if (!id) return null

  return {
    id,
    patientId: textField(record, 'patient_id', 'patient_sid'),
    practitionerId: textField(record, 'practitioner_id', 'practitioner_sid'),
    treatmentPlanId: textField(record, 'treatment_plan_id'),
    treatmentAppointmentId: textField(record, 'treatment_appointment_id'),
    treatmentId: textField(record, 'treatment_id'),
    nomenclature: textField(record, 'nomenclature'),
    patientNomenclature: textField(record, 'patient_nomenclature'),
    notes: textField(record, 'notes'),
    durationMinutes: numberField(record, 'duration', 'duration_minutes'),
    completed: booleanField(record, 'completed'),
    completedAt: textField(record, 'completed_at') ?? null,
    charged: booleanField(record, 'charged'),
    price: textField(record, 'price'),
    createdAt: textField(record, 'created_at'),
    updatedAt: textField(record, 'updated_at'),
  }
}

export async function readDentallyTreatmentPlanItems(
  params: TreatmentPlanItemParams = {},
): Promise<TreatmentReadResult<DentallyTreatmentPlanItem[]>> {
  const result = await dentallyGet<unknown>(
    appendQuery(DENTALLY_ENDPOINTS.treatmentPlanItems, {
      patient_id: params.patientId,
      treatment_plan_id: params.treatmentPlanId,
      treatment_appointment_id: params.treatmentAppointmentId,
      practitioner_id: params.practitionerId,
      completed: params.completed,
      updated_since: params.updatedSince,
    }),
  )
  if (!result.ok) {
    return { ok: false, category: result.category, statusCode: result.statusCode, durationMs: result.durationMs }
  }

  const arr = unwrapList(result.data, 'treatment_plan_items')
  if (!arr) return { ok: false, category: 'malformed', durationMs: result.durationMs }
  return {
    ok: true,
    data: arr.map(parseTreatmentPlanItem).filter((item): item is DentallyTreatmentPlanItem => item !== null),
    durationMs: result.durationMs,
  }
}

export async function readDentallyTreatmentPlanItem(
  treatmentPlanItemId: string,
): Promise<TreatmentReadResult<DentallyTreatmentPlanItem>> {
  if (!treatmentPlanItemId.trim()) return { ok: false, category: 'unknown', durationMs: 0 }

  const result = await dentallyGet<unknown>(DENTALLY_ENDPOINTS.treatmentPlanItemById(treatmentPlanItemId))
  if (!result.ok) {
    return { ok: false, category: result.category, statusCode: result.statusCode, durationMs: result.durationMs }
  }

  const parsed = parseTreatmentPlanItem(unwrapOne(result.data, 'treatment_plan_item'))
  if (!parsed) return { ok: false, category: 'malformed', durationMs: result.durationMs }
  return { ok: true, data: parsed, durationMs: result.durationMs }
}

