import { describe, it, expect } from 'vitest'
import { buildDentallyPatientRecordUrl } from '@/lib/dentally/record-url'
import {
  buildDentallyLinkPanel,
  detectRecordQualityIssues,
  mockDentallyContractFromPatient,
} from '@/lib/queue/dentally-link-panel'
import { MOCK_PATIENTS } from '@/lib/mock/patients'

describe('S094 Dentally record URL', () => {
  it('builds a patient deep link without embedding secrets', () => {
    const url = buildDentallyPatientRecordUrl('p-99', 'https://app.dentally.co')
    expect(url).toBe('https://app.dentally.co/patients/p-99')
    expect(url).not.toMatch(/token|bearer/i)
  })
})

describe('S094 Dentally link panel (B-5)', () => {
  const patient = MOCK_PATIENTS[0]

  it('offers create-record when there is no patient match', () => {
    const panel = buildDentallyLinkPanel({
      showPanel: true,
      identityBadge: 'no_match',
      callerState: 'no_match',
      patient: null,
    })
    expect(panel.linkState).toBe('create_required')
    expect(panel.primaryAction?.kind).toBe('create_record')
  })

  it('links to Dentally when a patient is matched', () => {
    const panel = buildDentallyLinkPanel({
      showPanel: true,
      identityBadge: 'confirmed',
      callerState: 'confirmed',
      patient,
      appBaseUrl: 'https://app.dentally.co',
    })
    expect(panel.primaryAction?.kind).toBe('open_record')
    if (panel.primaryAction?.kind === 'open_record') {
      expect(panel.primaryAction.href).toContain('dentally-')
    }
    expect(panel.contract?.hasOutstandingBalance).toBe(false)
  })

  it('surfaces record quality issues for shared numbers', () => {
    const issues = detectRecordQualityIssues({
      patient: MOCK_PATIENTS[2],
      callerState: 'family_number',
      identityBadge: 'multiple_match',
    })
    expect(issues.some(i => i.code === 'shared_number')).toBe(true)
  })

  it('hides panel when integration banner disables it', () => {
    const panel = buildDentallyLinkPanel({
      showPanel: false,
      identityBadge: 'confirmed',
      callerState: 'confirmed',
      patient,
    })
    expect(panel.visible).toBe(false)
  })

  it('mock contract maps patient flags without PII in contract JSON', () => {
    const contract = mockDentallyContractFromPatient(MOCK_PATIENTS[1])
    expect(contract.dentallyPatientId).toBe(`dentally-${MOCK_PATIENTS[1].id}`)
    expect(JSON.stringify(contract)).not.toContain('Sarah')
  })
})
