import { NextResponse } from 'next/server'
import { auth } from './lib/auth'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const { pathname } = req.nextUrl
  const isPublicPath = pathname === '/login' || pathname.startsWith('/api/auth')

  if (!isLoggedIn && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', req.nextUrl.origin))
  }
  if (isLoggedIn && pathname === '/login') {
    return NextResponse.redirect(new URL('/', req.nextUrl.origin))
  }
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|uploads/|brasao-rs.jpg).*)'],
}
