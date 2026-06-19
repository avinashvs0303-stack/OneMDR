import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/set-password',
  '/auth/verify-email',
  '/auth/callback',
  '/request-access',
  '/submit-lead',
];

const ADMIN_PUBLIC_PATHS = ['/admin/login'];

const DEV_BYPASS_ENABLED =
  process.env['NEXT_PUBLIC_DEV_BYPASS_AUTH'] === 'true' && process.env['NODE_ENV'] !== 'production';

function makeSupabaseClient(request: NextRequest, supabaseResponse: { response: NextResponse }) {
  return createServerClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '',
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? '',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse.response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always pass through Next.js internals and static assets
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  const isAuthPath = AUTH_PATHS.some((p) => pathname.startsWith(p));
  const isAdminPath = pathname.startsWith('/admin');
  const isAdminPublic = ADMIN_PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // ── Dev bypass ───────────────────────────────────────────────────────────────
  if (DEV_BYPASS_ENABLED) {
    const devSession = request.cookies.get('dev_session');
    const isAuthenticated = devSession?.value === 'true';

    if (isAdminPath) return NextResponse.next();
    if (isAuthenticated && isAuthPath) {
      return NextResponse.redirect(new URL('/modules', request.url));
    }
    if (!isAuthenticated && !isAuthPath) {
      const loginUrl = new URL('/auth/login', request.url);
      if (pathname !== '/') loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // ── Production: Supabase session ─────────────────────────────────────────────
  const holder = { response: NextResponse.next({ request }) };
  const supabase = makeSupabaseClient(request, holder);

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isAuthenticated = Boolean(session);
  const appRole = (session?.user.app_metadata?.['app_role'] as string | undefined) ?? '';
  const email = session?.user.email ?? '';
  const isClarbitStaff = appRole === 'SUPER_ADMIN' && email.toLowerCase().endsWith('@clarbit.com');

  // ── Admin routing ─────────────────────────────────────────────────────────────

  if (isAdminPath) {
    // /admin/login is always public
    if (isAdminPublic) {
      // Already authenticated admin → skip login page
      if (isAuthenticated && isClarbitStaff) {
        return NextResponse.redirect(new URL('/admin/overview', request.url));
      }
      return holder.response;
    }

    // All other /admin/* require SUPER_ADMIN + @clarbit.com
    if (!isAuthenticated || !isClarbitStaff) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    return holder.response;
  }

  // ── Customer routing ──────────────────────────────────────────────────────────

  // Authenticated user hitting auth page → send to app
  if (isAuthenticated && isAuthPath) {
    return NextResponse.redirect(new URL('/modules', request.url));
  }

  // Unauthenticated user hitting protected page → login
  if (!isAuthenticated && !isAuthPath) {
    const loginUrl = new URL('/auth/login', request.url);
    if (pathname !== '/') loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return holder.response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)'],
};
