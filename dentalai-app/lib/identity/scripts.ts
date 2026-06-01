import type { IdentityScenarioState } from './types'

/** Locked Session 2 scripts (S2-ScA–S2-ScG) — verbatim from product book. */
export const IDENTITY_SCRIPTS = {
  failed_verification: {
    handoff:
      "I'm having trouble verifying the details, so I'll pass you to the team who can help further.",
    callback:
      "I'm sorry — I'll make sure the team knows and they'll call you back.",
  },
  sensitive_before_verify:
    "I'm not able to give that information until I've confirmed who I'm speaking to.",
  low_confidence_repeat_back: (detail: string) =>
    `Just to confirm, I heard ${detail}. Is that right?`,
  multiple_match:
    "I can see more than one person linked to this number. Could I take the patient's full name and date of birth?",
  borrowed_or_work_phone:
    "No problem — I'll just verify the patient's details first.",
  parent_guardian_child:
    "Of course — could I take your child's full name and date of birth?",
  child_calling_alone:
    'Is there a grown-up nearby who can help with the call?',
} as const

export type IdentityScriptKey = keyof typeof IDENTITY_SCRIPTS

/**
 * S049 / S043 / S048 — pick the script bundle for the active scenario.
 */
export function scriptForScenario(
  scenario: IdentityScenarioState,
  options?: { lowConfidenceDetail?: string },
): string | { handoff: string; callback: string } {
  if (scenario === 'failed_verification') {
    return IDENTITY_SCRIPTS.failed_verification
  }
  if (scenario === 'multiple_match' || scenario === 'shared_household') {
    return IDENTITY_SCRIPTS.multiple_match
  }
  if (scenario === 'borrowed_phone') {
    return IDENTITY_SCRIPTS.borrowed_or_work_phone
  }
  if (scenario === 'child_guardian') {
    return IDENTITY_SCRIPTS.parent_guardian_child
  }
  if (options?.lowConfidenceDetail) {
    return IDENTITY_SCRIPTS.low_confidence_repeat_back(options.lowConfidenceDetail)
  }
  return IDENTITY_SCRIPTS.sensitive_before_verify
}
