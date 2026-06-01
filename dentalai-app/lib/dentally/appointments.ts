import 'server-only'

import { dentallyGet } from './client'
import { DENTALLY_ENDPOINTS } from './endpoints'
import type { DentallyErrorCategory } from './errors'
import { appendQuery, asRecord, numberField, textField, unwrapList } from './parse'
import type { DentallyAppointment } from './types'

export type AppointmentReadResult<T> =
  | { ok: true; data: T; durationMs: number }
  | { ok: false; category: DentallyErrorCategory; statusCode?: number; durationMs: number }

export type AppointmentListParams = {
  patientId?: string
  siteId?: string
  practitionerId?: string
  state?: string
  on?: string
  before?: string
  after?: string
  updatedAfter?: string
}

function parseAppointment(raw: unknown): DentallyAppointment | null {
  const record = asRecord(raw)
  if (!record) return null
  const id = textField(record, 'id', 'appointment_id')
  if (!id) return null

  return {
    id,
    uuid: textField(record, 'uuid'),
    patientId: textField(record, 'patient_id', 'patient_sid'),
    practitionerId: textField(record, 'practitioner_id', 'practitioner_sid'),
    siteId: textField(record, 'site_id'),
    startTime: textField(record, 'start_time'),
    finishTime: textField(record, 'finish_time'),
    durationMinutes: numberField(record, 'duration', 'duration_minutes'),
    reason: textField(record, 'reason'),
    state: textField(record, 'state'),
    notes: textField(record, 'notes'),
    treatmentDescription: textField(record, 'treatment_description'),
  }
}

export async function readDentallyAppointments(
  params: AppointmentListParams = {},
): Promise<AppointmentReadResult<DentallyAppointment[]>> {
  const result = await dentallyGet<unknown>(
    appendQuery(DENTALLY_ENDPOINTS.appointments, {
      patient_id: params.patientId,
      site_id: params.siteId,
      practitioner_id: params.practitionerId,
      state: params.state,
      on: params.on,
      before: params.before,
      after: params.after,
      updated_after: params.updatedAfter,
    }),
  )

  if (!result.ok) {
    return { ok: false, category: result.category, statusCode: result.statusCode, durationMs: result.durationMs }
  }

  const arr = unwrapList(result.data, 'appointments')
  if (!arr) return { ok: false, category: 'malformed', durationMs: result.durationMs }
  return {
    ok: true,
    data: arr.map(parseAppointment).filter((appointment): appointment is DentallyAppointment => appointment !== null),
    durationMs: result.durationMs,
  }
}

export async function readDentallyPatientAppointments(
  patientId: string,
  siteId?: string,
): Promise<AppointmentReadResult<DentallyAppointment[]>> {
  return readDentallyAppointments({ patientId, siteId })
}

