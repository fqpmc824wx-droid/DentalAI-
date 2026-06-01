'use client'

import { useEffect } from 'react'
import { touchQueueLockActivity, markQueueSessionEnded } from '@/lib/queue/actions'

const HEARTBEAT_MS = 60_000

export default function QueueLockHeartbeat({
  itemId,
  enabled,
}: {
  itemId: string
  enabled: boolean
}) {
  useEffect(() => {
    if (!enabled) return

    void touchQueueLockActivity(itemId)

    const interval = setInterval(() => {
      void touchQueueLockActivity(itemId)
    }, HEARTBEAT_MS)

    const onHide = () => {
      void markQueueSessionEnded(itemId)
    }
    window.addEventListener('pagehide', onHide)

    return () => {
      clearInterval(interval)
      window.removeEventListener('pagehide', onHide)
      void markQueueSessionEnded(itemId)
    }
  }, [itemId, enabled])

  return null
}
