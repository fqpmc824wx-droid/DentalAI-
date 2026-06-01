import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { nextUrl, auth: session } = req
  const isLoggedIn = !!session?.user

  const isAuthRoute = nextUrl.pathname.startsWith('/login')
  const isApiRoute = nextUrl.pathname.startsWith('/api/auth')

  if (isApiRoute) return NextResponse.next()
  if (isAuthRoute) {
    if (isLoggedIn) return NextResponse.redirect(new URL('/dashboard', nextUrl))
    return NextResponse.next()
  }
  if (!isLoggedIn) return NextResponse.redirect(new URL('/login', nextUrl))

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
