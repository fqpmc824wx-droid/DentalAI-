import { Suspense } from 'react'
import InviteAcceptClient from './InviteAcceptClient'

export default function InvitePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>Loading…</div>}>
      <InviteAcceptClient />
    </Suspense>
  )
}
