import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { theme } from '../src/lib/theme';
import { supabase } from '../src/lib/supabase';

const SessionContext = createContext<{ session: Session | null; loading: boolean }>({
  session: null,
  loading: true,
});

export function useSession() {
  return useContext(SessionContext);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, gcTime: 24 * 60 * 60 * 1000, retry: 1 },
  },
});

/**
 * Root layout: session state plus the redirect rules.
 *
 * The redirect runs in an effect keyed on the route segments rather than
 * during render, because expo-router cannot navigate while it is still
 * mounting the first screen.
 */
export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      // Cached data belongs to the previous user; drop it on sign-out.
      if (!next) queryClient.clear();
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === 'login';

    if (!session && !inAuthGroup) router.replace('/login');
    else if (session && inAuthGroup) router.replace('/');
  }, [session, loading, segments, router]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionContext.Provider value={{ session, loading }}>
          <StatusBar style="light" />
          {loading ? (
            <View
              style={{
                flex: 1,
                backgroundColor: theme.bg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ActivityIndicator color={theme.brand} />
            </View>
          ) : (
            <Slot />
          )}
        </SessionContext.Provider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
