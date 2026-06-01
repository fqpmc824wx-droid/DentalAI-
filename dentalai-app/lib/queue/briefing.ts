/**
 * S092 — Human briefing panel (S3-B · B-4).
 *
 * Tone warning, clinic opening script, collapsed contact history,
 * transcript, and AI call timeline for queue detail cards.
 */

import type { QueueItem } from './types'
import type { MockPatient } from '@/lib/mock/patients'

export type PatientToneWarning =
  | 'none'
  | 'anxious'
  | 'frustrated'
  | 'confused'
  | 'distressed'
  | 'repeat_question'

export type ContactHistoryEntry = {
  at: string
  channel: 'call' | 'sms' | 'holding_sms'
  summary: string
}

export type AiTimelineEntry = {
  at: string
  label: string
}

export type TranscriptLine = {
  at: string
  speaker: 'caller' | 'ai' | 'system'
  text: string
}

export type HumanBriefingPanel = {
  toneWarning: PatientToneWarning
  toneMessage?: string
  suggestedOpeningScript: string
  scriptEditableByClinic: true
  contactHistory: ContactHistoryEntry[]
  transcript: TranscriptLine[]
  aiTimeline: AiTimelineEntry[]
  defaultCollapsed: true
}

const TONE_MESSAGES: Record<Exclude<PatientToneWarning, 'none'>, string> = {
  anxious: 'Patient sounded anxious on the call — use a calm, unhurried tone.',
  frustrated: 'Patient sounded frustrated — acknowledge before proceeding.',
  confused: 'Patient seemed confused — check understanding before confirming details.',
  distressed: 'Patient was distressed — consider human handoff if unsure.',
  repeat_question: 'Patient repeated the same question — slow down and confirm one detail at a time.',
}

const DEFAULT_OPENING_SCRIPT =
  'Good morning, you are through to {clinicName}. My name is {staffName}. How can I help you today?'

/** Derive tone warning from queue context (mock heuristics until voice sentiment exists). */
export function derivePatientToneWarning(item: QueueItem): PatientToneWarning {
  if (item.type === 'emergency') return 'distressed'
  if (item.type === 'complaint') return 'frustrated'
  if (item.confidence < 50) return 'confused'
  if (item.callerState === 'uncertain' || item.callerState === 'family_number') return 'repeat_question'
  if (item.callerState === 'withheld') return 'anxious'
  return 'none'
}

function mockContactHistory(item: QueueItem, patient: MockPatient | null): ContactHistoryEntry[] {
  const entries: ContactHistoryEntry[] = [
    {
      at: item.createdAt,
      channel: item.source === 'ai_call' ? 'call' : 'call',
      summary: item.summary.slice(0, 120),
    },
  ]
  if (patient?.isFTA) {
    entries.push({
      at: patient.lastAppointment ?? item.createdAt,
      channel: 'sms',
      summary: 'FTA reminder sent — no confirmation received.',
    })
  }
  return entries
}

function mockTranscript(item: QueueItem): TranscriptLine[] {
  if (item.source !== 'ai_call') {
    return [
      {
        at: item.createdAt,
        speaker: 'system',
        text: 'Manual queue item — no live transcript attached.',
      },
    ]
  }
  return [
    { at: item.createdAt, speaker: 'ai', text: 'Thank you for calling. How can I help you today?' },
    { at: item.createdAt, speaker: 'caller', text: '[Caller intent captured — see prepared summary.]' },
    { at: item.createdAt, speaker: 'system', text: `Prepared work item: ${item.title}` },
  ]
}

function mockAiTimeline(item: QueueItem): AiTimelineEntry[] {
  return [
    { at: item.createdAt, label: 'Call received' },
    { at: item.createdAt, label: `Identity state: ${item.callerState.replace(/_/g, ' ')}` },
    { at: item.createdAt, label: `Rules engine: ${item.ruleDecision ?? 'pending'}` },
    { at: item.createdAt, label: 'Queue item created for staff review' },
  ]
}

export function buildHumanBriefingPanel(input: {
  item: QueueItem
  patient: MockPatient | null
  clinicName?: string
  staffName?: string
  clinicOpeningScript?: string
}): HumanBriefingPanel {
  const toneWarning = derivePatientToneWarning(input.item)
  const template = input.clinicOpeningScript?.trim() || DEFAULT_OPENING_SCRIPT
  const suggestedOpeningScript = template
    .replace(/\{clinicName\}/g, input.clinicName ?? 'the practice')
    .replace(/\{staffName\}/g, input.staffName ?? 'the team')

  return {
    toneWarning,
    toneMessage: toneWarning === 'none' ? undefined : TONE_MESSAGES[toneWarning],
    suggestedOpeningScript,
    scriptEditableByClinic: true,
    contactHistory: mockContactHistory(input.item, input.patient),
    transcript: mockTranscript(input.item),
    aiTimeline: mockAiTimeline(input.item),
    defaultCollapsed: true,
  }
}
