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

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarded_at')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.onboarded_at) redirect('/onboarding');

  return (
    <div className="md:pl-56">
      <div className="mx-auto max-w-lg px-4 pt-6 pb-28 md:max-w-2xl md:pb-10">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
