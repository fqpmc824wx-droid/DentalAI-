/**
 * Booking Rules Configuration — per-clinic
 * In Phase 5+ these would live in a clinics table column or rules table.
 * For now hard-coded per clinic_id.
 */

import type { AppointmentType, ClinicBookingRules } from './types'

export const APPOINTMENT_TYPES: AppointmentType[] = [
  {
    id: 'new_patient_consult',
    name: 'New Patient Consultation',
    durationMins: 30,
    isNHSCompatible: true,
    isPrivateOnly: false,
    requiresProvider: 'dentist',
    emergencySafe: false,
    notes: 'Includes initial exam, X-rays if needed, treatment plan discussion.',
  },
  {
    id: 'routine_checkup',
    name: 'Routine Checkup',
    durationMins: 20,
    isNHSCompatible: true,
    isPrivateOnly: false,
    requiresProvider: 'dentist',
    emergencySafe: false,
  },
  {
    id: 'hygiene',
    name: 'Hygiene Appointment',
    durationMins: 30,
    isNHSCompatible: false,
    isPrivateOnly: true,
    requiresProvider: 'hygienist',
    emergencySafe: false,
  },
  {
    id: 'emergency',
    name: 'Emergency Slot',
    durationMins: 20,
    isNHSCompatible: true,
    isPrivateOnly: false,
    requiresProvider: 'dentist',
    emergencySafe: true,
    notes: 'Same-day capacity, pain assessment focus.',
  },
  {
    id: 'implant_consult',
    name: 'Implant Consultation',
    durationMins: 45,
    isNHSCompatible: false,
    isPrivateOnly: true,
    requiresProvider: 'tco',
    emergencySafe: false,
    notes: 'Treatment Coordinator first, then dentist if patient proceeds.',
  },
  {
    id: 'invisalign_consult',
    name: 'Invisalign Consultation',
    durationMins: 30,
    isNHSCompatible: false,
    isPrivateOnly: true,
    requiresProvider: 'tco',
    emergencySafe: false,
  },
  {
    id: 'whitening_consult',
    name: 'Whitening Consultation',
    durationMins: 20,
    isNHSCompatible: false,
    isPrivateOnly: true,
    requiresProvider: 'tco',
    emergencySafe: false,
  },
]

export const CLINIC_RULES: Record<string, ClinicBookingRules> = {
  'clinic-1': {
    clinicId: 'clinic-1',
    blockOnUnpaidBalance: true,
    blockOnRepeatedFTA: true,
    blockOnLapsedNeedsFullAssessment: true,
    reviewOnFirstNHSBooking: false,
    reviewOnComplexTreatment: true,
    reviewOnUncertainIdentity: true,
    emergencyDailyCapPerProvider: 3,
    outOfHoursAcceptsEmergency: true,
  },
  'clinic-2': {
    clinicId: 'clinic-2',
    blockOnUnpaidBalance: true,
    blockOnRepeatedFTA: true,
    blockOnLapsedNeedsFullAssessment: false,
    reviewOnFirstNHSBooking: true,
    reviewOnComplexTreatment: true,
    reviewOnUncertainIdentity: true,
    emergencyDailyCapPerProvider: 2,
    outOfHoursAcceptsEmergency: false,
  },
  'clinic-3': {
    clinicId: 'clinic-3',
    blockOnUnpaidBalance: false,
    blockOnRepeatedFTA: false,
    blockOnLapsedNeedsFullAssessment: false,
    reviewOnFirstNHSBooking: false,
    reviewOnComplexTreatment: true,
    reviewOnUncertainIdentity: true,
    emergencyDailyCapPerProvider: 5,
    outOfHoursAcceptsEmergency: true,
  },
}

export function getAppointmentType(id: string): AppointmentType | undefined {
  return APPOINTMENT_TYPES.find(t => t.id === id)
}

export function getClinicRules(clinicId: string): ClinicBookingRules | undefined {
  return CLINIC_RULES[clinicId]
}
