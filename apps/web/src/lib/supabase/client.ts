'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database, VitalisClient } from '@vitalis/api';

let cached: VitalisClient | null = null;

/**
 * Browser-side Supabase client, created once per tab.
 *
 * @supabase/ssr keeps the session in cookies rather than localStorage, which
 * is what lets the Next.js server read it too — the same session works in
 * server components, middleware, and here.
 */
export function getBrowserClient(): VitalisClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'Supabase belum dikonfigurasi. Salin .env.example ke apps/web/.env.local lalu isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }

  cached = createBrowserClient<Database>(url, key);
  return cached;
}
