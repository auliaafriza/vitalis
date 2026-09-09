import { nextRoute } from '@calorya/core';
import { redirect } from 'next/navigation';
import { BottomNav } from '@/components/nav';
import { getServerClient } from '@/lib/supabase/server';

/**
 * Shell for every signed-in screen.
 *
 * The onboarding check happens on the server so a half-configured account
 * never renders a dashboard full of zeros — it goes straight to the form that
 * fixes it.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase
        .from('profiles')
        .select('onboarded_at, tutorial_seen_at')
        .eq('id', user.id)
        .maybeSingle()
    : { data: null };

  /*
   * One shared rule, not a local `if` ladder.
   *
   * `nextRoute` lives in @calorya/core and is exercised by its own tests, so
   * "a returning user never sees setup again" is a fact the suite defends
   * rather than a line of code someone could reorder by accident. The phone's
   * root layout asks the same function the same question.
   *
   * Running on the server means the answer is known before anything renders:
   * a half-configured account never flashes a dashboard full of zeros.
   */
  const route = nextRoute({
    signedIn: Boolean(user),
    onboarded: Boolean(profile?.onboarded_at),
    tutorialSeen: Boolean(profile?.tutorial_seen_at),
    at: 'app',
  });
  if (route && route !== '/app') redirect(route);

  return (
    <div className="md:pl-56">
      <div className="mx-auto max-w-lg px-4 pt-6 pb-28 md:max-w-2xl md:pb-10">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
