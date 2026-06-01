'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/access'
import {
  acceptInvitation,
  completePasswordReset,
  createStaffInvitation,
  deactivateStaffAccount,
  requestPasswordReset,
} from '@/lib/users/lifecycle'
import { canManageRole, canManageStaff, canManageUser } from '@/lib/users/permissions'
import { getUserById, listUsers } from '@/lib/users/store'
import type { Role } from '@/types'

export type StaffActionResult =
  | { ok: true; inviteToken?: string; resetToken?: string }
  | { ok: false; error: string }

const InviteSchema = z.object({
  email: z.string().email().max(200),
  name: z.string().min(2).max(120),
  role: z.enum(['receptionist', 'practice_manager', 'group_owner', 'super_admin']),
  clinicId: z.string().min(1).max(64),
})

const PasswordSchema = z.string().min(8).max(128)

export async function inviteStaffAction(formData: FormData): Promise<StaffActionResult> {
  const actor = await requireSession()
  if (!canManageStaff(actor)) {
    return { ok: false, error: 'You do not have permission to invite staff' }
  }

  const parsed = InviteSchema.safeParse({
    email: formData.get('email'),
    name: formData.get('name'),
    role: formData.get('role'),
    clinicId: formData.get('clinicId') ?? actor.clinicId,
  })

  if (!parsed.success) return { ok: false, error: 'Invalid invitation details' }

  const { email, name, role, clinicId } = parsed.data
  if (!canManageRole(actor, role as Role)) {
    return { ok: false, error: 'You cannot invite users with that role' }
  }
  if (!actor.clinicIds.includes(clinicId) && actor.role !== 'super_admin') {
    return { ok: false, error: 'You cannot invite users to that clinic' }
  }

  const result = createStaffInvitation({
    email,
    name,
    role: role as Role,
    clinicId,
    clinicIds: [clinicId],
    createdBy: {
      userId: actor.userId,
      name: actor.name,
      role: actor.role,
      email: actor.email,
    },
  })

  if (!result.ok) return result

  revalidatePath('/staff')
  return { ok: true, inviteToken: result.inviteToken }
}

export async function deactivateStaffAction(userId: string): Promise<StaffActionResult> {
  const actor = await requireSession()
  if (!canManageStaff(actor)) {
    return { ok: false, error: 'You do not have permission to deactivate staff' }
  }

  const target = getUserById(userId)
  if (!target) return { ok: false, error: 'User not found' }
  if (target.id === actor.userId) {
    return { ok: false, error: 'You cannot deactivate your own account' }
  }
  if (!canManageUser(actor, target.clinicIds)) {
    return { ok: false, error: 'You cannot deactivate this user' }
  }
  if (!canManageRole(actor, target.role)) {
    return { ok: false, error: 'You cannot deactivate a user with that role' }
  }

  const result = deactivateStaffAccount(userId, {
    userId: actor.userId,
    name: actor.name,
    role: actor.role,
    email: actor.email,
  })

  if (!result.ok) return result

  revalidatePath('/staff')
  return { ok: true }
}

export async function requestPasswordResetAction(email: string): Promise<StaffActionResult> {
  const normalized = email.toLowerCase().trim()
  if (!normalized) return { ok: false, error: 'Email is required' }

  const result = requestPasswordReset(normalized)
  if (!result.ok) return result

  // Never expose whether the email exists in the response body for public use
  return { ok: true, resetToken: result.resetToken || undefined }
}

export async function completePasswordResetAction(token: string, password: string): Promise<StaffActionResult> {
  const parsed = PasswordSchema.safeParse(password)
  if (!parsed.success) return { ok: false, error: 'Password must be at least 8 characters' }

  const result = completePasswordReset(token, parsed.data)
  return result.ok ? { ok: true } : result
}

export async function acceptInvitationAction(token: string, password: string): Promise<StaffActionResult> {
  const parsed = PasswordSchema.safeParse(password)
  if (!parsed.success) return { ok: false, error: 'Password must be at least 8 characters' }

  const result = acceptInvitation(token, parsed.data)
  return result.ok ? { ok: true } : result
}

export async function listStaffForActor() {
  const actor = await requireSession()
  if (!canManageStaff(actor)) return []
  return listUsers(actor.role === 'super_admin' ? undefined : actor.clinicIds)
}
