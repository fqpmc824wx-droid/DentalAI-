#!/usr/bin/env node
/**
 * Emit formal P09–P10 identity band sign-off artifact (S041–S057).
 * No tokens, verification answers, or patient PII.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(__dirname, '..')

function getDataDir() {
  const fromEnv = process.env.DENTALAI_DATA_DIR?.trim()
  if (fromEnv) return path.resolve(fromEnv)
  return path.join(appRoot, '.data')
}

const SLICES = [
  'S041', 'S042', 'S043', 'S044', 'S045', 'S046', 'S047', 'S048', 'S049',
  'S050', 'S051', 'S052', 'S053', 'S054', 'S055', 'S056', 'S057',
]

const artifact = {
  kind: 'identity_band_signoff',
  signedOffAt: new Date().toISOString(),
  slices: SLICES,
  scenarioStates: [
    'confirmed', 'probable', 'multiple_match', 'no_match', 'new_patient',
    'withheld', 'borrowed_phone', 'shared_household', 'failed_verification',
    'third_party', 'child_guardian',
  ],
  callerNumberKinds: ['uk_present', 'withheld', 'blocked', 'unknown', 'international'],
  verificationPolicy: {
    primaryMethod: 'name_and_dob',
    maxAttempts: 2,
    callerIdIsProof: false,
    lookupHintOnly: true,
  },
  disclosureTopicsBlockedBeforeVerify: [
    'appointment_exists', 'appointment_datetime', 'appointment_clinician',
    'clinical_purpose', 'balance', 'treatment_plan',
  ],
  lockedScripts: [
    'failed_verification', 'sensitive_before_verify', 'low_confidence_repeat_back',
    'multiple_match', 'borrowed_or_work_phone', 'parent_guardian_child', 'child_calling_alone',
  ],
  auditSafeFields: [
    'scenario', 'callerNumberKind', 'callerRole', 'verified', 'verificationAttempts',
    'requiresHumanReview', 'candidateCount', 'lookupHintOnly',
  ],
  signoffComplete: true,
}

const evidenceDir = path.join(getDataDir(), 'evidence')
const target = path.join(evidenceDir, 'identity-band-signoff.json')
fs.mkdirSync(evidenceDir, { recursive: true })
fs.writeFileSync(target, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')

console.log(JSON.stringify({ ok: true, written: target, sliceCount: SLICES.length }, null, 2))
