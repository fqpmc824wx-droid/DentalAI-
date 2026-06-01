// Phase 1 roles. `dentist` is intentionally excluded until the dentist workflow
// (clinical view, treatment notes, schedule visibility) is fully specified.
// There is no "senior receptionist" role — that is a job title only; permissions use receptionist.
// Roles are security boundaries — never add a half-wired role.
export type Role = 'receptionist' | 'practice_manager' | 'group_owner' | 'super_admin'

export type Clinic = {
  id: string
  name: string
  slug: string
  address: string
  phone: string
}

export type MockUser = {
  id: string
  email: string
  password: string
  name: string
  role: Role
  clinicId: string        // primary clinic (always set)
  clinicIds?: string[]    // group_owner: all accessible clinics
}

// Extends NextAuth session user
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: Role
      clinicId: string
      clinicIds: string[]
      mfaVerified?: boolean
    }
  }

  interface User {
    id: string
    email: string
    name: string
    role: Role
    clinicId: string
    clinicIds: string[]
    mfaVerified?: boolean
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    mfaVerified?: boolean
    revoked?: boolean
  }
}
