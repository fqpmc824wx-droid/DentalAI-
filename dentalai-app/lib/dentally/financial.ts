import 'server-only'

import { dentallyGet } from './client'
import { DENTALLY_ENDPOINTS } from './endpoints'
import type { DentallyErrorCategory } from './errors'
import { appendQuery, asRecord, numberField, textField, unwrapList } from './parse'
import type { DentallyAccount, FinancialAccountFlag } from './types'

export type FinancialReadResult<T> =
  | { ok: true; data: T; durationMs: number }
  | { ok: false; category: DentallyErrorCategory; statusCode?: number; durationMs: number }

function parseAccount(raw: unknown): DentallyAccount | null {
  const record = asRecord(raw)
  if (!record) return null
  const id = textField(record, 'id', 'account_id')
  if (!id) return null

  return {
    id,
    patientId: textField(record, 'patient_id', 'patientId'),
    state: textField(record, 'state'),
    balance: numberField(record, 'current_balance', 'balance', 'amount', 'total_balance'),
    accountBalance: numberField(record, 'current_balance', 'account_balance', 'accountBalance', 'balance'),
  }
}

export function summariseFinancialFlags(accounts: DentallyAccount[]): FinancialAccountFlag {
  const accountIds = accounts.map(account => account.id)
  const balances = accounts
    .map(account => account.accountBalance ?? account.balance)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const outstandingBalance = balances.length > 0
    ? balances.reduce((sum, value) => sum + value, 0)
    : undefined
  const hasOutstandingBalance = typeof outstandingBalance === 'number' && outstandingBalance > 0
  const creditBalance = typeof outstandingBalance === 'number' && outstandingBalance < 0
  const restricted = accounts.some(account => {
    const state = account.state?.toLowerCase()
    return state === 'debt' || state === 'overdue' || state === 'suspended' || state === 'restricted'
  })

  return {
    accountIds,
    hasAccountData: accounts.length > 0,
    outstandingBalance,
    hasOutstandingBalance,
    creditBalance,
    restricted,
    reviewReason: restricted
      ? 'Dentally account state suggests a restriction. Human review required.'
      : hasOutstandingBalance
        ? 'Dentally account balance suggests money may be outstanding. Human review required.'
        : undefined,
  }
}

export async function readDentallyAccountsForPatient(
  patientId: string,
): Promise<FinancialReadResult<DentallyAccount[]>> {
  if (!patientId.trim()) return { ok: false, category: 'unknown', durationMs: 0 }

  const result = await dentallyGet<unknown>(appendQuery(DENTALLY_ENDPOINTS.accounts, { patient_id: patientId }))
  if (!result.ok) {
    return { ok: false, category: result.category, statusCode: result.statusCode, durationMs: result.durationMs }
  }

  const arr = unwrapList(result.data, 'accounts')
  if (!arr) return { ok: false, category: 'malformed', durationMs: result.durationMs }
  return {
    ok: true,
    data: arr.map(parseAccount).filter((account): account is DentallyAccount => account !== null),
    durationMs: result.durationMs,
  }
}

export async function readFinancialAccountFlagForPatient(
  patientId: string,
): Promise<FinancialReadResult<FinancialAccountFlag>> {
  const result = await readDentallyAccountsForPatient(patientId)
  if (!result.ok) return result
  return {
    ok: true,
    data: summariseFinancialFlags(result.data),
    durationMs: result.durationMs,
  }
}
