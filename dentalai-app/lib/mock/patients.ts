/**
 * Mock patient data for Phases 1–4.
 * Phase 5+: replace with live Dentally API calls.
 *
 * PII note: this file is mock data only. In production, patient data lives in Dentally.
 * DentalAI stores only patientId references, never copies of patient records.
 */

import { normaliseUKPhone, isWithheld } from '@/lib/phone'

export type CallerMatchState =
  | 'confirmed'        // exactly one match, high confidence
  | 'multiple'         // 2+ patients share this number (different families)
  | 'no_match'         // number not in Dentally
  | 'family_number'    // known shared family landline/mobile
  | 'withheld'         // caller withheld their number
  | 'uncertain'        // partial/low-confidence match — needs verification

export type MockPatient = {
  id: string
  firstName: string
  lastName: string
  dob: string                  // YYYY-MM-DD
  phone: string                // normalised 11-digit UK format
  altPhone?: string            // second contact number
  clinicId: string
  nhsNumber?: string
  isPrivate: boolean
  outstandingBalance: number
  lastAppointment: string | null
  nextAppointment: string | null
  isFTA: boolean
  isLapsed: boolean
  notes?: string
}

export const MOCK_PATIENTS: MockPatient[] = [
  {
    id: 'pat-001',
    firstName: 'James',
    lastName: 'Patel',
    dob: '1985-03-12',
    phone: '07700900001',
    clinicId: 'clinic-1',
    nhsNumber: '485 777 3456',
    isPrivate: false,
    outstandingBalance: 0,
    lastAppointment: '2024-11-15',
    nextAppointment: null,
    isFTA: false,
    isLapsed: false,
  },
  {
    id: 'pat-002',
    firstName: 'Sarah',
    lastName: 'Hussain',
    dob: '1990-07-22',
    phone: '07700900002',
    clinicId: 'clinic-1',
    isPrivate: true,
    outstandingBalance: 85,
    lastAppointment: '2024-09-03',
    nextAppointment: null,
    isFTA: true,
    isLapsed: false,
    notes: 'FTA – missed hygiene appointment 03/09/24',
  },
  {
    id: 'pat-003',
    firstName: 'Mohammed',
    lastName: 'Rahman',
    dob: '1978-01-30',
    phone: '02071234567',   // family landline shared with pat-004
    clinicId: 'clinic-1',
    isPrivate: false,
    outstandingBalance: 0,
    lastAppointment: '2025-01-10',
    nextAppointment: '2025-07-10',
    isFTA: false,
    isLapsed: false,
  },
  {
    id: 'pat-004',
    firstName: 'Fatima',
    lastName: 'Rahman',
    dob: '1980-06-15',
    phone: '02071234567',   // same family landline as pat-003
    clinicId: 'clinic-1',
    isPrivate: false,
    outstandingBalance: 0,
    lastAppointment: '2024-12-20',
    nextAppointment: null,
    isFTA: false,
    isLapsed: false,
  },
  {
    id: 'pat-005',
    firstName: 'David',
    lastName: 'Chen',
    dob: '1965-11-05',
    phone: '07700900005',
    clinicId: 'clinic-1',
    isPrivate: true,
    outstandingBalance: 0,
    lastAppointment: '2023-04-01',   // 18+ months ago = lapsed
    nextAppointment: null,
    isFTA: false,
    isLapsed: true,
  },
  {
    id: 'pat-006',
    firstName: 'Amir',
    lastName: 'Hassan',
    dob: '1992-04-11',
    phone: '07700900006',
    clinicId: 'clinic-1',
    isPrivate: true,
    outstandingBalance: 0,
    lastAppointment: '2025-03-15',
    nextAppointment: '2025-09-15',
    isFTA: false,
    isLapsed: false,
  },
  {
    // Clinic-2 patient sharing phone with clinic-1 pat-001 — triggers cross-clinic uncertain state
    // IMPORTANT: must have a DIFFERENT surname to pat-001 (Patel) so family_number is not triggered
    id: 'pat-007',
    firstName: 'Jamil',
    lastName: 'Hussain',
    dob: '1983-07-22',
    phone: '07700900001',   // same as pat-001 but different clinic → uncertain
    clinicId: 'clinic-2',
    isPrivate: false,
    outstandingBalance: 0,
    lastAppointment: '2024-08-10',
    nextAppointment: null,
    isFTA: false,
    isLapsed: false,
    notes: 'Cross-clinic duplicate — triggers uncertain state',
  },
]

export type CallerLookupResult = {
  state: CallerMatchState
  matches: MockPatient[]
  confidence: number          // 0–100
  requiresHumanReview: boolean
  reason: string
}

export function lookupCallerByPhone(rawPhone: string): CallerLookupResult {
  // Withheld / no number
  if (isWithheld(rawPhone)) {
    return {
      state: 'withheld',
      matches: [],
      confidence: 0,
      requiresHumanReview: true,
      reason: 'Caller withheld their number. Manual identity verification required.',
    }
  }

  const normalised = normaliseUKPhone(rawPhone)

  if (!normalised) {
    return {
      state: 'uncertain',
      matches: [],
      confidence: 10,
      requiresHumanReview: true,
      reason: 'Phone number could not be normalised to a recognised UK format. Manual verification required.',
    }
  }

  // Match against all patients for this — clinic scoping happens at the queue/action level
  const exactMatches = MOCK_PATIENTS.filter(p => {
    const pNorm = normaliseUKPhone(p.phone)
    if (pNorm === normalised) return true
    if (p.altPhone) {
      const altNorm = normaliseUKPhone(p.altPhone)
      if (altNorm === normalised) return true
    }
    return false
  })

  if (exactMatches.length === 0) {
    return {
      state: 'no_match',
      matches: [],
      confidence: 0,
      requiresHumanReview: true,
      reason: 'Number not found in the system. This may be a new patient or an unregistered number.',
    }
  }

  if (exactMatches.length === 1) {
    return {
      state: 'confirmed',
      matches: exactMatches,
      confidence: 92,
      requiresHumanReview: false,
      reason: `Single match found — patient ID ${exactMatches[0].id}`,
    }
  }

  // Multiple exact matches
  const allSameLastName = exactMatches.every(p => p.lastName === exactMatches[0].lastName)

  if (allSameLastName) {
    // Known family — same surname, shared number
    return {
      state: 'family_number',
      matches: exactMatches,
      confidence: 40,
      requiresHumanReview: true,
      reason: `Shared family number — ${exactMatches.length} patients with the same surname share this number. Confirm which family member is calling.`,
    }
  }

  // Different surnames sharing the same number — genuinely ambiguous
  // Check if confidence is low enough to call it uncertain vs multiple
  const distinctClinics = new Set(exactMatches.map(p => p.clinicId)).size
  if (distinctClinics > 1) {
    return {
      state: 'uncertain',
      matches: exactMatches,
      confidence: 25,
      requiresHumanReview: true,
      reason: `Number matches patients across different clinics — identity cannot be confirmed automatically.`,
    }
  }

  return {
    state: 'multiple',
    matches: exactMatches,
    confidence: 30,
    requiresHumanReview: true,
    reason: `${exactMatches.length} different patients share this number. Human review required before any patient detail is revealed.`,
  }
}

export function getPatientById(id: string): MockPatient | undefined {
  return MOCK_PATIENTS.find(p => p.id === id)
}
