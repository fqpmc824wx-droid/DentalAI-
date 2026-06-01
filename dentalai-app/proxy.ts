import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import type { Role } from '@/types'
import { canAccessRoute, deniedRouteRedirect } from '@/lib/navigation/access'

export default auth((req) => {
  const { nextUrl, auth: session } = req
  const isLoggedIn = !!session?.user

  const isAuthRoute = nextUrl.pathname.startsWith('/login')
  const isPublicApi =
    nextUrl.pathname.startsWith('/api/auth') ||
    nextUrl.pathname === '/api/health'

  if (isPublicApi) return NextResponse.next()
  if (isAuthRoute) {
    if (isLoggedIn) return NextResponse.redirect(new URL('/dashboard', nextUrl))
    return NextResponse.next()
  }
  if (!isLoggedIn) return NextResponse.redirect(new URL('/login', nextUrl))

  const role = session?.user?.role as Role | undefined
  if (role && !canAccessRoute(role, nextUrl.pathname)) {
    return NextResponse.redirect(new URL(deniedRouteRedirect(), nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
