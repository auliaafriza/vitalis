import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@calorya/api';

// `/privasi` must stay reachable without signing in: Google Play requires a
// policy URL it can open anonymously, and a redirect to /login there reads as
// a broken link.
const PUBLIC_PATHS = [
  '/login',
  '/auth',
  '/offline',
  '/privasi',
  // The reset pages must be reachable while signed out — that is the whole
  // point of them. /sandi-baru additionally runs with a recovery session,
  // which the guard below would otherwise treat as a normal login and bounce
  // to the dashboard before the password is changed.
  '/lupa-sandi',
  '/sandi-baru',
  '/manifest.webmanifest',
  '/sw.js',
];

/**
 * Refreshes the Supabase session on every request and guards the app routes.
 * (Next.js 16 renamed the `middleware` convention to `proxy`.)
 *
 * Doing the auth check here rather than in each page means an unauthenticated
 * request never reaches a data query at all — the redirect happens at the
 * edge, before any rendering work.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() revalidates the token with Supabase; getSession() would trust
  // whatever is in the cookie, which is not safe for an authorisation check.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  if (!user && !isPublic) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/login';
    redirect.searchParams.set('next', path);
    return NextResponse.redirect(redirect);
  }

  if (user && path === '/login') {
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/dashboard';
    redirect.search = '';
    return NextResponse.redirect(redirect);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets.
    '/((?!_next/static|_next/image|favicon.ico|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest)$).*)',
  ],
};
