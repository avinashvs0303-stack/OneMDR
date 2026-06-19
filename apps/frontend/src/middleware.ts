import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
];

const DEV_BYPASS_ENABLED =
  process.env['NEXT_PUBLIC_DEV_BYPASS_AUTH'] === 'true' && process.env['NODE_ENV'] !== 'production';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always pass through Next.js internals and static assets
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // ── Dev bypass ───────────────────────────────────────────────────────────
  if (DEV_BYPASS_ENABLED) {
    const devSession = request.cookies.get('dev_session');
    const isAuthenticated = devSession?.value === 'true';

    // Authenticated users visiting auth pages → send to dashboard
    if (isAuthenticated && isPublicPath) {
      return NextResponse.redirect(new URL('/modules', request.url));
    }
    // Unauthenticated users visiting protected pages → send to login
    if (!isAuthenticated && !isPublicPath) {
      const loginUrl = new URL('/auth/login', request.url);
      if (pathname !== '/') loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // ── Production: session cookie check ─────────────────────────────────────
  // Primary: onemdr_session — non-httpOnly, cleared by JS on logout immediately.
  // Fallback: refresh_token — httpOnly, for sessions created before the onemdr_session
  //   cookie was introduced (backward compat during Railway deployment transition).
  // Once all sessions are refreshed, refresh_token becomes the silent-refresh
  // mechanism only and onemdr_session is the sole routing signal.
  const sessionCookie = request.cookies.get('onemdr_session');
  const legacyCookie = request.cookies.get('refresh_token');
  const isAuthenticated = Boolean(sessionCookie) || Boolean(legacyCookie);

  if (isAuthenticated && isPublicPath) {
    return NextResponse.redirect(new URL('/modules', request.url));
  }
  if (!isAuthenticated && !isPublicPath) {
    const loginUrl = new URL('/auth/login', request.url);
    if (pathname !== '/') loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except Next.js internals and static files
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)'],
};
