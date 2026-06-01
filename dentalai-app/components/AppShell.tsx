'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { logoutAction } from '@/lib/auth-actions'
import { navigationForRole } from '@/lib/navigation/menus'
import type { Clinic, Role } from '@/types'
import { ROLE_LABELS } from '@/lib/constants'

type User = {
  id: string
  name: string
  email: string
  role: Role
  clinicId: string
  clinicIds: string[]
}

function initials(name: string) {
  return name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

/** Hamburger icon — three slim lines. */
function IconMenu() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <path d="M3 6h14M3 10h14M3 14h14" />
    </svg>
  )
}
function IconClose() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  )
}

export default function AppShell({
  user,
  clinic,
  children,
  queuePending = 0,
  queueUrgent = 0,
}: {
  user: User
  clinic: Clinic | undefined
  children: React.ReactNode
  queuePending?: number
  queueUrgent?: number
}) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const isMulti = user.clinicIds.length > 1
  const clinicLabel = isMulti ? `${user.clinicIds.length} clinics` : (clinic?.name ?? '—')
  const { primary, more } = navigationForRole(user.role)

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [drawerOpen])

  const closeDrawer = () => setDrawerOpen(false)

  function renderNavGroup(
    label: string,
    items: { href: string; label: string; showCount?: boolean }[],
  ) {
    if (items.length === 0) return null
    return (
      <div className="side-section">
        <div className="head">{label}</div>
        {items.map(item => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`side-item ${active ? 'on' : ''}`}
              onClick={closeDrawer}
            >
              <span>{item.label}</span>
              {item.showCount && queuePending > 0 && (
                <span className={`badge ${queueUrgent > 0 ? 'urgent' : ''}`}>{queuePending}</span>
              )}
            </Link>
          )
        })}
      </div>
    )
  }

  function renderIdentityFoot() {
    return (
      <div className="foot">
        <div className="av" aria-hidden>{initials(user.name)}</div>
        <div className="me">
          <div className="n">{user.name}</div>
          <div className="r">{ROLE_LABELS[user.role]} · {clinicLabel}</div>
        </div>
      </div>
    )
  }

  function renderSidebar(className: string, options?: { hidden?: boolean }) {
    return (
      <aside
        className={className}
        aria-label="Navigation"
        aria-hidden={options?.hidden}
      >
        {options?.hidden === false && (
          <button
            className="close"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close navigation"
          >
            <IconClose />
          </button>
        )}
        <div className="brand-row">
          <div className="logo" aria-hidden />
          <div className="name">DentalAI</div>
        </div>
        {renderNavGroup('Primary', primary)}
        {renderNavGroup('More', more)}
        {renderIdentityFoot()}
        <form action={logoutAction}>
          <button type="submit" className="signout">Sign out →</button>
        </form>
      </aside>
    )
  }

  return (
    <div className="app">
      {/* Mobile top bar — only visible <860px */}
      <div className="cm-topbar">
        <div className="brand">
          <span className="logo" aria-hidden />
          <span>DentalAI</span>
        </div>
        <button
          className="hamburger"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
          aria-expanded={drawerOpen}
        >
          <IconMenu />
        </button>
      </div>

      {/* Mobile drawer */}
      <div
        className={`cm-drawer-backdrop${drawerOpen ? ' open' : ''}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden
      />
      {renderSidebar(`cm-drawer${drawerOpen ? ' open' : ''}`, { hidden: !drawerOpen })}

      {/* Desktop sidebar — only visible ≥860px */}
      {renderSidebar('side desktop-only')}

      <nav className="cm-mobile-nav" aria-label="Primary navigation">
        {primary.map(item => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`cm-mobile-nav-item${active ? ' on' : ''}`}
            >
              <span className="icon" aria-hidden>•</span>
              <span>{item.label}</span>
              {item.showCount && queuePending > 0 && (
                <span className={`badge ${queueUrgent > 0 ? 'urgent' : ''}`}>{queuePending}</span>
              )}
            </Link>
          )
        })}
        {more.length > 0 && (
          <button
            type="button"
            className={`cm-mobile-nav-item more${drawerOpen ? ' on' : ''}`}
            onClick={() => setDrawerOpen(true)}
            aria-label="More navigation"
          >
            <span className="icon" aria-hidden>⋯</span>
            <span>More</span>
          </button>
        )}
      </nav>

      <main>
        {children}
      </main>
    </div>
  )
}
