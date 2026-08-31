import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database, VitalisClient } from '@vitalis/api';

/**
 * Server-side client for server components and route handlers.
 *
 * Server components cannot write cookies, so the setAll handler swallows the
 * error there; the middleware is what actually refreshes the session cookie
 * on every request.
 */
export async function getServerClient(): Promise<VitalisClient> {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY belum di-set');
  }

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a server component — the middleware handles refresh.
        }
      },
    },
  });
}
