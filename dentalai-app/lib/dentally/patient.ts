import 'server-only'

import { dentallyGet } from './client'
import { DENTALLY_ENDPOINTS } from './endpoints'
import type { DentallyErrorCategory } from './errors'
import { appendQuery, asRecord, textField, unwrapList, unwrapOne } from './parse'
import type { DentallyPatient, PatientMatchState } from './types'

export type PatientReadResult<T> =
  | { ok: true; data: T; durationMs: number }
  | { ok: false; category: DentallyErrorCategory; statusCode?: number; durationMs: number }

function parsePatient(raw: unknown): DentallyPatient | null {
  const record = asRecord(raw)
  if (!record) return null

  const id = textField(record, 'id', 'uuid', 'patient_id', 'sid')
  if (!id) return null

  const firstName = textField(record, 'first_name', 'firstName', 'firstname')
  const lastName = textField(record, 'last_name', 'lastName', 'surname')
  const fullName =
    textField(record, 'name', 'full_name', 'patient_name') ??
    ([firstName, lastName].filter(Boolean).join(' ') || undefined)

  return {
    id,
    firstName,
    lastName,
    fullName,
    dateOfBirth: textField(record, 'date_of_birth', 'dob', 'birth_date'),
    email: textField(record, 'email'),
    phone: textField(record, 'phone', 'phone_number', 'home_phone', 'work_phone'),
    mobile: textField(record, 'mobile', 'mobile_phone', 'mobile_number'),
    postcode: textField(record, 'postcode', 'post_code', 'postal_code'),
    accountId: textField(record, 'account_id', 'accountId'),
    siteId: textField(record, 'site_id', 'siteId'),
    active: typeof record.active === 'boolean' ? record.active : undefined,
  }
}

function parsePatients(raw: unknown): DentallyPatient[] | null {
  const arr = unwrapList(raw, 'patients')
  if (!arr) return null
  return arr.map(parsePatient).filter((patient): patient is DentallyPatient => patient !== null)
}

export async function searchDentallyPatients(
  query: string,
): Promise<PatientReadResult<DentallyPatient[]>> {
  const trimmed = query.trim()
  if (!trimmed) return { ok: true, data: [], durationMs: 0 }

  const result = await dentallyGet<unknown>(appendQuery(DENTALLY_ENDPOINTS.patients, { query: trimmed }))
  if (!result.ok) {
    return { ok: false, category: result.category, statusCode: result.statusCode, durationMs: result.durationMs }
  }

  const patients = parsePatients(result.data)
  if (!patients) return { ok: false, category: 'malformed', durationMs: result.durationMs }
  return { ok: true, data: patients, durationMs: result.durationMs }
}

export async function readDentallyPatient(
  patientId: string,
): Promise<PatientReadResult<DentallyPatient>> {
  if (!patientId.trim()) return { ok: false, category: 'unknown', durationMs: 0 }

  const result = await dentallyGet<unknown>(DENTALLY_ENDPOINTS.patientById(patientId))
  if (!result.ok) {
    return { ok: false, category: result.category, statusCode: result.statusCode, durationMs: result.durationMs }
  }

  const patient = parsePatient(unwrapOne(result.data, 'patient'))
  if (!patient) return { ok: false, category: 'malformed', durationMs: result.durationMs }
  return { ok: true, data: patient, durationMs: result.durationMs }
}

export function resolvePatientMatch(candidates: DentallyPatient[]): PatientMatchState {
  if (candidates.length === 1) {
    return { state: 'confirmed', patient: candidates[0], candidates }
  }
  if (candidates.length > 1) {
    return {
      state: 'multiple',
      candidates,
      reason: 'Multiple Dentally patients match the supplied search details. Human identity verification required.',
    }
  }
  return {
    state: 'no_match',
    candidates,
    reason: 'No Dentally patient matched the supplied search details. Capture details and create a human review task.',
  }
}

export async function searchAndResolvePatientMatch(query: string): Promise<PatientReadResult<PatientMatchState>> {
  const search = await searchDentallyPatients(query)
  if (!search.ok) return search
  return { ok: true, data: resolvePatientMatch(search.data), durationMs: search.durationMs }
}
