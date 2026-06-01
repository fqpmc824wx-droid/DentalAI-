import { Suspense } from 'react'
import ResetPasswordClient from './ResetPasswordClient'

export default function ResetPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>Loading…</div>}>
      <ResetPasswordClient />
    </Suspense>
  )
}
