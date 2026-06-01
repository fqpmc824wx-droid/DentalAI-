'use client'

import { useEffect, type ReactNode } from 'react'

/**
 * Modal — controlled dialog with a backdrop.
 *
 * Closes on Escape. Click backdrop to dismiss (configurable).
 * Locks body scroll while open.
 *
 * <Modal open={showModal} onClose={() => setShowModal(false)} title="Record outcome">
 *   {form fields}
 *   <div className="actions">
 *     <button className="btn danger">Submit</button>
 *     <button className="btn">Cancel</button>
 *   </div>
 * </Modal>
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  dismissOnBackdrop = true,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  dismissOnBackdrop?: boolean
}) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="cm-modal-backdrop"
      onClick={dismissOnBackdrop ? onClose : undefined}
      role="presentation"
    >
      <div
        className="cm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'cm-modal-title' : undefined}
        onClick={e => e.stopPropagation()}
      >
        {(title || subtitle) && (
          <div>
            {title && <h2 id="cm-modal-title">{title}</h2>}
            {subtitle && <p className="sub">{subtitle}</p>}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
