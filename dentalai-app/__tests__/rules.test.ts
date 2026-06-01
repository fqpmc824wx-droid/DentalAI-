import { describe, it, expect } from 'vitest'
import { evaluateBookingRequest } from '@/lib/rules/engine'
import type { MockPatient } from '@/lib/mock/patients'
import type { BookingRequestInput } from '@/lib/rules/types'

// ── Test fixtures ────────────────────────────────────────────────────────────

const cleanPatient: MockPatient = {
  id: 'test-001',
  firstName: 'Test',
  lastName: 'Patient',
  dob: '1985-01-01',
  phone: '07700900001',
  clinicId: 'clinic-1',
  isPrivate: false,
  outstandingBalance: 0,
  lastAppointment: '2025-01-01',
  nextAppointment: null,
  isFTA: false,
  isLapsed: false,
}

const privatePatient: MockPatient = {
  ...cleanPatient,
  id: 'test-002',
  isPrivate: true,
}

const debtPatient: MockPatient = {
  ...cleanPatient,
  id: 'test-003',
  outstandingBalance: 120,
}

const ftaPatient: MockPatient = {
  ...cleanPatient,
  id: 'test-004',
  isFTA: true,
}

const lapsedPatient: MockPatient = {
  ...cleanPatient,
  id: 'test-005',
  isLapsed: true,
  lastAppointment: '2023-01-01',
}

const newNHSPatient: MockPatient = {
  ...cleanPatient,
  id: 'test-006',
  lastAppointment: null,
  isPrivate: false,
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Rules engine — identity gates', () => {
  it('allows clean confirmed patient for routine checkup', () => {
    const input: BookingRequestInput = {
      callerState: 'confirmed',
      patient: cleanPatient,
      appointmentTypeId: 'routine_checkup',
    }
    const result = evaluateBookingRequest(input, 'clinic-1')
    expect(result.decision).toBe('allow')
    expect(result.triggered).not.toContain('IDENTITY_NO_MATCH')
  })

  it('reviews when caller is withheld', () => {
    const input: BookingRequestInput = {
      callerState: 'withheld',
      patient: null,
      appointmentTypeId: 'routine_checkup',
    }
    const result = evaluateBookingRequest(input, 'clinic-1')
    expect(result.decision).toBe('review')
    expect(result.triggered).toContain('IDENTITY_NO_MATCH')
  })

  it('reviews when caller has no match', () => {
    const input: BookingRequestInput = {
      callerState: 'no_match',
      patient: null,
      appointmentTypeId: 'routine_checkup',
    }
    const result = evaluateBookingRequest(input, 'clinic-1')
    expect(result.decision).toBe('review')
    expect(result.triggered).toContain('IDENTITY_NO_MATCH')
  })

  it('reviews on family number (clinic-1 has reviewOnUncertainIdentity=true)', () => {
    const input: BookingRequestInput = {
      callerState: 'family_number',
      patient: cleanPatient,
      appointmentTypeId: 'routine_checkup',
    }
    const result = evaluateBookingRequest(input, 'clinic-1')
    expect(result.decision).toBe('review')
    expect(result.triggered).toContain('IDENTITY_UNCERTAIN')
  })

  it('reviews on uncertain identity', () => {
    const input: BookingRequestInput = {
      callerState: 'uncertain',
      patient: null,
      appointmentTypeId: 'routine_checkup',
    }
    const result = evaluateBookingRequest(input, 'clinic-1')
    expect(result.decision).toBe('review')
  })
})

describe('Rules engine — patient flags', () => {
  it('reviews when patient has outstanding balance (clinic-1)', () => {
    const input: BookingRequestInput = {
      callerState: 'confirmed',
      patient: debtPatient,
      appointmentTypeId: 'routine_checkup',
    }
    const result = evaluateBookingRequest(input, 'clinic-1')
    expect(result.decision).toBe('review')
    expect(result.triggered).toContain('BALANCE_OUTSTANDING')
  })

  it('allows balance patient at clinic-3 (blockOnUnpaidBalance=false)', () => {
    const input: BookingRequestInput = {
      callerState: 'confirmed',
      patient: debtPatient,
      appointmentTypeId: 'routine_checkup',
    }
    const result = evaluateBookingRequest(input, 'clinic-3')
    expect(result.decision).toBe('allow')
    expect(result.triggered).not.toContain('BALANCE_OUTSTANDING')
  })

  it('reviews FTA patient at clinic-1', () => {
    const input: BookingRequestInput = {
      callerState: 'confirmed',
      patient: ftaPatient,
      appointmentTypeId: 'routine_checkup',
    }
    const result = evaluateBookingRequest(input, 'clinic-1')
    expect(result.decision).toBe('review')
    expect(result.triggered).toContain('FTA_FLAGGED')
  })

  it('allows FTA patient at clinic-3 (blockOnRepeatedFTA=false)', () => {
    const input: BookingRequestInput = {
      callerState: 'confirmed',
      patient: ftaPatient,
      appointmentTypeId: 'routine_checkup',
    }
    const result = evaluateBookingRequest(input, 'clinic-3')
    expect(result.decision).toBe('allow')
  })

  it('reviews lapsed patient requesting routine checkup', () => {
    const input: BookingRequestInput = {
      callerState: 'confirmed',
      patient: lapsedPatient,
      appointmentTypeId: 'routine_checkup',
    }
    const result = evaluateBookingRequest(input, 'clinic-1')
    expect(result.decision).toBe('review')
    expect(result.triggered).toContain('LAPSED_NEEDS_ASSESSMENT')
  })

  it('does NOT flag lapsed patient for non-routine appointment types', () => {
    const input: BookingRequestInput = {
      callerState: 'confirmed',
      patient: lapsedPatient,
      appointmentTypeId: 'hygiene',
    }
    const result = evaluateBookingRequest(input, 'clinic-1')
    expect(result.triggered).not.toContain('LAPSED_NEEDS_ASSESSMENT')
  })

  it('reviews NHS patient for private-only appointment', () => {
    const input: BookingRequestInput = {
      callerState: 'confirmed',
      patient: cleanPatient, // NHS patient
      appointmentTypeId: 'hygiene', // private-only
    }
    const result = evaluateBookingRequest(input, 'clinic-1')
    expect(result.decision).toBe('review')
    expect(result.triggered).toContain('NHS_PRIVATE_MISMATCH')
  })

  it('allows private patient for private-only appointment', () => {
    const input: BookingRequestInput = {
      callerState: 'confirmed',
      patient: privatePatient,
      appointmentTypeId: 'hygiene',
    }
    const result = evaluateBookingRequest(input, 'clinic-1')
    // hygiene is private-only — private patient passes this check
    expect(result.triggered).not.toContain('NHS_PRIVATE_MISMATCH')
  })
})

describe('Rules engine — complex treatment', () => {
  it('reviews implant consultation (clinic-1 reviewOnComplexTreatment=true)', () => {
    const input: BookingRequestInput = {
      callerState: 'confirmed',
      patient: privatePatient,
      appointmentTypeId: 'implant_consult',
    }
    const result = evaluateBookingRequest(input, 'clinic-1')
    expect(result.decision).toBe('review')
    expect(result.triggered).toContain('COMPLEX_TREATMENT_REVIEW')
  })

  it('reviews Invisalign consultation', () => {
    const input: BookingRequestInput = {
      callerState: 'confirmed',
      patient: privatePatient,
      appointmentTypeId: 'invisalign_consult',
    }
    const result = evaluateBookingRequest(input, 'clinic-1')
    expect(result.triggered).toContain('COMPLEX_TREATMENT_REVIEW')
  })
})

describe('Rules engine — first NHS booking', () => {
  it('reviews first NHS booking at clinic-2', () => {
    const input: BookingRequestInput = {
      callerState: 'confirmed',
      patient: newNHSPatient, // lastAppointment: null, isPrivate: false
      appointmentTypeId: 'routine_checkup',
    }
    const result = evaluateBookingRequest(input, 'clinic-2')
    expect(result.triggered).toContain('FIRST_NHS_BOOKING')
  })

  it('does NOT flag first NHS at clinic-1 (reviewOnFirstNHSBooking=false)', () => {
    const input: BookingRequestInput = {
      callerState: 'confirmed',
      patient: newNHSPatient,
      appointmentTypeId: 'routine_checkup',
    }
    const result = evaluateBookingRequest(input, 'clinic-1')
    expect(result.triggered).not.toContain('FIRST_NHS_BOOKING')
  })
})

describe('Rules engine — sanity gates', () => {
  it('blocks on unknown appointment type', () => {
    const input = {
      callerState: 'confirmed' as const,
      patient: cleanPatient,
      appointmentTypeId: 'this_does_not_exist' as never,
    }
    const result = evaluateBookingRequest(input, 'clinic-1')
    expect(result.decision).toBe('block')
    expect(result.triggered).toContain('SANITY_UNKNOWN_APPT_TYPE')
  })

  it('blocks on unconfigured clinic', () => {
    const input: BookingRequestInput = {
      callerState: 'confirmed',
      patient: cleanPatient,
      appointmentTypeId: 'routine_checkup',
    }
    const result = evaluateBookingRequest(input, 'clinic-9999')
    expect(result.decision).toBe('block')
    expect(result.triggered).toContain('SANITY_NO_CLINIC_RULES')
  })
})

describe('Rules engine — recommended actions', () => {
  it('always recommends human approval even on allow', () => {
    const input: BookingRequestInput = {
      callerState: 'confirmed',
      patient: cleanPatient,
      appointmentTypeId: 'routine_checkup',
    }
    const result = evaluateBookingRequest(input, 'clinic-1')
    expect(result.recommendedAction.toLowerCase()).toContain('staff')
  })

  it('review decision includes "prepare booking request"', () => {
    const input: BookingRequestInput = {
      callerState: 'withheld',
      patient: null,
      appointmentTypeId: 'routine_checkup',
    }
    const result = evaluateBookingRequest(input, 'clinic-1')
    expect(result.decision).toBe('review')
    expect(result.recommendedAction.toLowerCase()).toContain('approve')
  })
})
