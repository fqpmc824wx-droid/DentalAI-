/**
 * Dentally typed models — only the fields DentalAI actually reads. Keep these
 * narrow so we never accidentally store more data than the workflow needs.
 *
 * Field names mirror the public Dentally REST API. If the live response shape
 * differs, the parsing layer (lib/dentally/parse.ts in a later slice) is the
 * single place to adjust — these types stay the contract DentalAI relies on.
 *
 * Phase 2 is read-only: identity, appointment context, unbooked treatment
 * appointment proof, and financial flags. These models intentionally include
 * only the fields DentalAI needs for safe work preparation.
 */

/** Internal: every Dentally read call returns this shape. */
export type DentallyReadResult<T> =
  | { ok: true; data: T; durationMs: number }
  | {
      ok: false
      category: import('./errors').DentallyErrorCategory
      statusCode?: number
      durationMs: number
      /**
       * Safe operational hint parsed from Retry-After when Dentally rate
       * limits us. Never includes response body or request details.
       */
      retryAfterMs?: number
    }

/**
 * Dentally Practice — what we read for Phase 2.4 clinic mapping.
 * Only the fields needed to verify token scope and identify the practice.
 */
export type DentallyPractice = {
  id: string
  name: string
  /** Trading/legal name if separate. Optional. */
  legalName?: string
  /** Optional timezone string e.g. "Europe/London". */
  timezone?: string
  /** Whether the practice is active in Dentally. */
  active?: boolean
}

/** Dentally User — safe token/user context proof. */
export type DentallyUser = {
  id: string
  name?: string
  email?: string
}

/** Dentally Site — the rollout unit DentalAI maps clinics to. */
export type DentallySite = {
  id: string
  name: string
  postcode?: string
  address?: string
  active?: boolean
}

export type DentallyPatient = {
  id: string
  firstName?: string
  lastName?: string
  fullName?: string
  dateOfBirth?: string
  email?: string
  phone?: string
  mobile?: string
  postcode?: string
  accountId?: string
  siteId?: string
  active?: boolean
}

export type PatientMatchState =
  | { state: 'confirmed'; patient: DentallyPatient; candidates: DentallyPatient[] }
  | { state: 'multiple'; candidates: DentallyPatient[]; reason: string }
  | { state: 'no_match'; candidates: DentallyPatient[]; reason: string }

export type DentallyAppointment = {
  id: string
  uuid?: string
  patientId?: string
  practitionerId?: string
  siteId?: string
  startTime?: string
  finishTime?: string
  durationMinutes?: number
  reason?: string
  state?: string
  notes?: string
  treatmentDescription?: string
}

export type DentallyTreatmentAppointment = {
  id: string
  patientId?: string
  treatmentPlanId?: string
  appointmentId?: string
  bookable?: boolean
  completed?: boolean
  completedAt?: string | null
  notes?: string
  position?: number
  createdAt?: string
  updatedAt?: string
}

export type DentallyTreatmentPlan = {
  id: string
  patientId?: string
  practitionerId?: string
  nickname?: string
  completed?: boolean
  completedAt?: string | null
  startDate?: string
  endDate?: string | null
  privateTreatmentValue?: string
  nhsUdaValue?: string
}

export type DentallyTreatmentPlanItem = {
  id: string
  patientId?: string
  practitionerId?: string
  treatmentPlanId?: string
  treatmentAppointmentId?: string
  treatmentId?: string
  nomenclature?: string
  patientNomenclature?: string
  notes?: string
  durationMinutes?: number
  completed?: boolean
  completedAt?: string | null
  charged?: boolean
  price?: string
  createdAt?: string
  updatedAt?: string
}

export type DentallyAccount = {
  id: string
  patientId?: string
  state?: string
  balance?: number
  accountBalance?: number
}

export type FinancialAccountFlag = {
  accountIds: string[]
  hasAccountData: boolean
  outstandingBalance?: number
  hasOutstandingBalance: boolean
  creditBalance: boolean
  restricted: boolean
  reviewReason?: string
}

export type SafePatientContext = {
  patient: DentallyPatient
  appointments: DentallyAppointment[]
  treatmentAppointments: DentallyTreatmentAppointment[]
  unbookedTreatmentAppointments: DentallyTreatmentAppointment[]
  treatmentPlans: DentallyTreatmentPlan[]
  treatmentPlanItems: DentallyTreatmentPlanItem[]
  financial: FinancialAccountFlag
  readiness: 'complete' | 'partial'
  warnings: string[]
}

/** Internal request options — caller never touches transport details. */
export type DentallyReadOptions = {
  /** Override the default timeout for this single call. */
  timeoutMs?: number
  /** Caller-provided AbortSignal (e.g. request cancellation). */
  signal?: AbortSignal
}
