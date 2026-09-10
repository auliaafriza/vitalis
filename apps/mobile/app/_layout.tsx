import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { isAccountGone, nextRoute } from '@calorya/core';
import { ThemeProvider, useTheme } from '../src/lib/theme';
import { supabase } from '../src/lib/supabase';

const SessionContext = createContext<{
  session: Session | null;
  loading: boolean;
  /**
   * Re-read the onboarding/tutorial columns.
   *
   * The tutorial screen calls this after stamping the column. Without it the
   * gate would still hold the stale answer and bounce the user back to the
   * slides they just finished — the classic way a "done" button appears to do
   * nothing.
   */
  refreshGate: () => void;
}>({
  session: null,
  loading: true,
  refreshGate: () => {},
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
  /**
   * What the account still owes before it can see the app: the onboarding
   * answers, then the intro slides. Kept as one object rather than two
   * booleans so there is a single "not asked yet" (null) — with two, the gate
   * below would have to guess what a half-answered pair means.
   */
  const [gate, setGate] = useState<{ onboarded: boolean; tutorialSeen: boolean } | null>(
    null,
  );

  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      // A different user has a different answer; re-ask rather than reuse.
      setGate(null);
      // Cached data belongs to the previous user; drop it on sign-out.
      if (!next) queryClient.clear();
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  /**
   * Has this account answered the onboarding questions, and seen the intro?
   *
   * Asked with a direct query rather than through react-query because this
   * runs outside QueryClientProvider — and because the answer decides which
   * screen mounts at all, so it cannot wait for a component to ask for it.
   *
   * `refreshGate` is exposed through the session context so the tutorial
   * screen can re-ask the moment it finishes, instead of the gate waiting for
   * the next sign-in to notice and bouncing the user straight back.
   */
  const [gateNonce, setGateNonce] = useState(0);

  useEffect(() => {
    if (!session) {
      setGate(null);
      return;
    }
    let alive = true;
    void (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('onboarded_at, tutorial_seen_at')
        .eq('id', session.user.id)
        .maybeSingle();
      if (!alive) return;

      if (error) {
        // A failed lookup is not evidence of anything. Assume both are done:
        // sending someone who already filled the form back through it is
        // worse than the alternative, and the screens below degrade
        // gracefully without a profile.
        setGate({ onboarded: true, tutorialSeen: true });
        return;
      }

      if (!data) {
        /*
         * Signed in, but the account has no profile row. Two causes, and they
         * need opposite treatment, so ask the server which it is.
         *
         * The session lives in AsyncStorage and its access token stays
         * syntactically valid for an hour after the account behind it is
         * deleted. The app therefore believes it is signed in, finds no
         * profile, concludes "not onboarded", and pins the person to the
         * setup form — where every attempt to finish fails against a user
         * that no longer exists. Deleting a test account in the dashboard is
         * exactly how someone ends up permanently stuck on onboarding.
         *
         * `getUser()` is a network call, so it asks the server rather than
         * the token. Gone means gone: drop the local session and let the gate
         * send them to /login, where they can sign in or register again.
         */
        const { data: live, error: liveError } = await supabase.auth.getUser();
        if (!alive) return;

        /*
         * Only an authoritative refusal signs anyone out. Treating any error
         * as "account deleted" would eject someone who merely reopened the
         * app on a bad connection — losing the very setup progress they were
         * halfway through. `isAccountGone` draws that line, and its tests
         * pin it down.
         */
        if (isAccountGone(liveError, live.user)) {
          await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
          queryClient.clear();
          if (alive) setSession(null);
          return;
        }

        // The account is real, the profile row simply never got created —
        // an account older than the trigger, or one it failed for. Setup can
        // fix that now that completeOnboarding upserts the row.
        setGate({ onboarded: false, tutorialSeen: false });
        return;
      }

      setGate({
        onboarded: Boolean(data.onboarded_at),
        tutorialSeen: Boolean(data.tutorial_seen_at),
      });
    })();
    return () => {
      alive = false;
    };
  }, [session, gateNonce]);

  useEffect(() => {
    if (loading) return;

    /*
     * The routing rule itself lives in @calorya/core, and the web app shell
     * asks the same function the same question. Two copies of this ladder is
     * how the phone ended up showing an intro the web had already marked as
     * seen; one tested function cannot disagree with itself.
     */
    const first = segments[0];
    const at =
      first === 'login'
        ? 'login'
        : first === 'onboarding'
          ? 'onboarding'
          : first === 'tutorial'
            ? 'tutorial'
            : 'app';

    const route = nextRoute({
      signedIn: Boolean(session),
      onboarded: gate?.onboarded ?? null,
      tutorialSeen: gate?.tutorialSeen ?? null,
      at,
    });

    if (route === null) return;
    // expo-router's app root is '/', not '/app'.
    router.replace(route === '/app' ? '/' : route);
  }, [session, loading, gate, segments, router]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <SessionContext.Provider
            value={{ session, loading, refreshGate: () => setGateNonce((n) => n + 1) }}
          >
            <Shell loading={loading} />
          </SessionContext.Provider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

/**
 * Split out so it sits *inside* ThemeProvider — the status bar and the
 * loading screen both need the active theme, and a component cannot read a
 * context it renders itself.
 */
function Shell({ loading }: { loading: boolean }) {
  const { theme, scheme } = useTheme();

  return (
    <>
      {/* Inverted: dark text on the light theme, light text on the dark one. */}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
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
    </>
  );
}
