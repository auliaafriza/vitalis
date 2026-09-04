import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { Database, CaloryaClient } from '@calorya/api';
import 'react-native-url-polyfill/auto';

/**
 * Supabase client for React Native.
 *
 * Two things differ from the web build:
 *   - the session lives in AsyncStorage, since there are no cookies;
 *   - detectSessionInUrl is off, because there is no URL to parse and leaving
 *     it on makes the client try to touch `window`.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Supabase belum dikonfigurasi. Salin .env.example ke apps/mobile/.env lalu isi EXPO_PUBLIC_SUPABASE_URL dan EXPO_PUBLIC_SUPABASE_ANON_KEY.',
  );
}

export const supabase: CaloryaClient = createClient<Database>(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export function getClient(): CaloryaClient {
  return supabase;
}
