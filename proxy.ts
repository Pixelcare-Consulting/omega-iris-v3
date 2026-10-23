import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

import { auth } from './lib/auth'
import {
  AUTH_API_PREFIX,
  AUTH_ROUTES,
  CHOOSE_DATABASE_ROUTE,
  DEFAULT_SIGNIN_REDIRECT,
  PATHNAME_HEADER,
  PUBLIC_ROUTES
} from './constants/routes'

export async function proxy(req: NextRequest) {
  const { nextUrl } = req
  const { pathname } = nextUrl

  const session = await auth.api.getSession({ headers: await headers() })
  const isAuthenticated = !!session

  const isApiAuthRoute = nextUrl.pathname.startsWith(AUTH_API_PREFIX)
  //* prefix match so subpaths of a public route (e.g. /examples/stat-card) stay public
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
  const isRootPage = pathname === '/'
  const isAuthRoute = AUTH_ROUTES.includes(pathname)
  const isChangePasswordPage = nextUrl.pathname === '/change-password'
  const isChooseDatabasePage = pathname === CHOOSE_DATABASE_ROUTE
  const isApiRoute = pathname.startsWith('/api/')

  //* if its api auth routes or public route, proceed
  if (isPublicRoute || isApiAuthRoute) return NextResponse.next()

  //* api callers get a status code, a redirect to a page means nothing to them
  if (isApiRoute) {
    if (!isAuthenticated) return NextResponse.json({ message: 'Unauthorized!' }, { status: 401 })
    if (!session?.user?.isDefaultPasswordChanged)
      return NextResponse.json({ message: 'Change your default password first!' }, { status: 403 })
    if (!session.session.dbCode) return NextResponse.json({ message: 'No SAP database selected!' }, { status: 403 })

    return NextResponse.next()
  }

  //* if its isChangePasswordPage or isChooseDatabasePage and not isAuthenticated, redirect to signin page
  if ((isChangePasswordPage || isChooseDatabasePage) && !isAuthenticated) {
    return NextResponse.redirect(new URL('/signin', nextUrl))
  }

  //* if its isAuthenticated and isDefaultPasswordChanged and is not isChangePasswordPage, redirect to changed default password page
  if (isAuthenticated && !session?.user?.isDefaultPasswordChanged && !isChangePasswordPage) {
    return NextResponse.redirect(new URL(`/change-password`, nextUrl))
  }

  //* after the password gate, pick a sap database, a fresh signin always asks again
  if (isAuthenticated && session?.user?.isDefaultPasswordChanged && !session.session.dbCode && !isChooseDatabasePage) {
    const isPassThrough = isRootPage || isAuthRoute || isChangePasswordPage
    const callbackUrl = isPassThrough ? '' : `?callbackUrl=${encodeURIComponent(pathname + nextUrl.search)}`

    return NextResponse.redirect(new URL(`${CHOOSE_DATABASE_ROUTE}${callbackUrl}`, nextUrl))
  }

  if (isRootPage) {
    if (isAuthenticated) return NextResponse.redirect(new URL(DEFAULT_SIGNIN_REDIRECT, nextUrl))
    else return NextResponse.redirect(new URL('/signin', nextUrl))
  }

  //* if its auth route and user is already authenticated, redirect to default signin redirect otherwise proceed
  if (isAuthRoute) {
    if (isAuthenticated) return NextResponse.redirect(new URL(DEFAULT_SIGNIN_REDIRECT, nextUrl))
    return NextResponse.next()
  }

  //! fail closed, everything past the guards above requires a session
  if (!isAuthenticated) {
    let callbackUrl = pathname

    if (nextUrl.search) callbackUrl += nextUrl.search

    const encodedCallbackUrl = encodeURIComponent(callbackUrl)
    return NextResponse.redirect(new URL(`/signin?callbackUrl=${encodedCallbackUrl}`, nextUrl))
  }

  //* pass the path on, the protected layout needs it for its own redirect
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set(PATHNAME_HEADER, pathname + nextUrl.search)

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: [
    //* runs on app pages only, skipping next.js internals (`/_next`), auth API routes (`/api/auth`) and static files
    '/((?!_next|api/auth|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',

    //* always run middleware for TRPC routes
    '/trpc/(.*)'
  ]
}
