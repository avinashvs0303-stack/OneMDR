import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/set-password',
  '/auth/verify-email',
  '/auth/callback',
];

const DEV_BYPASS_ENABLED =
  process.env['NEXT_PUBLIC_DEV_BYPASS_AUTH'] === 'true' && process.env['NODE_ENV'] !== 'production';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always pass through Next.js internals and static assets
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // ── Dev bypass ───────────────────────────────────────────────────────────────
  if (DEV_BYPASS_ENABLED) {
    const devSession = request.cookies.get('dev_session');
    const isAuthenticated = devSession?.value === 'true';
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

  // ── Production: Supabase session check ──────────────────────────────────────
  // createServerClient reads the Supabase auth cookies and automatically rotates
  // tokens before they expire, writing updated cookies back to the response.
  // getSession() reads from cookies without a network call — fast and suitable
  // for routing decisions. Actual security is enforced by Railway JWT verification.

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '',
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? '',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isAuthenticated = Boolean(session);

  if (isAuthenticated && isPublicPath) {
    return NextResponse.redirect(new URL('/modules', request.url));
  }

  if (!isAuthenticated && !isPublicPath) {
    const loginUrl = new URL('/auth/login', request.url);
    if (pathname !== '/') loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Return the supabaseResponse so any rotated cookies are set on the response
  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)'],
};
