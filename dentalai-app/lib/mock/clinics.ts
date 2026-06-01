import type { Clinic } from '@/types'

export const MOCK_CLINICS: Clinic[] = [
  {
    id: 'clinic-1',
    name: 'GK Dental — Hawick',
    slug: 'gk-hawick',
    address: 'Hawick TD9 9EE',
    phone: '01450 372 476',
  },
  {
    id: 'clinic-2',
    name: 'Smile Dental — Stratford',
    slug: 'smile-stratford',
    address: '45 The Broadway, Stratford, London E15 1NG',
    phone: '020 7234 5678',
  },
  {
    id: 'clinic-3',
    name: 'Smile Dental — Ilford',
    slug: 'smile-ilford',
    address: '88 High Road, Ilford IG1 1DX',
    phone: '020 7345 6789',
  },
]

export function getClinic(id: string): Clinic | undefined {
  return MOCK_CLINICS.find(c => c.id === id)
}
