import type { CaloryaClient } from '../client';

/**
 * Sign out, and mean it.
 *
 * `auth.signOut()` defaults to `scope: 'global'`, which asks the server to
 * revoke the refresh token — the part that actually matters, because a
 * refresh token left alive can mint new access tokens for days. But that is a
 * network call, and the naive version of this function is the bug it was
 * written to fix:
 *
 *     await client.auth.signOut();   // throws offline, or 403 on a token
 *     router.replace('/login');      // the server already rejected
 *
 * When the call throws, nothing after it runs. The user taps "Keluar", the
 * app does nothing at all, and they are left signed in with no explanation.
 *
 * So the two halves are separated. Revoking is best-effort; forgetting the
 * session on THIS device is not optional and happens either way. A user who
 * asked to leave must end up signed out locally even when the network is
 * gone — the worst case is then a refresh token that stays valid until it
 * expires on its own, which is a far smaller problem than a sign-out button
 * that does not sign out.
 *
 * Returns whether the server-side revoke actually succeeded, so a caller can
 * say "kamu sudah keluar, tapi sesi di perangkat lain belum dicabut" instead
 * of claiming more than happened.
 */
export async function signOutEverywhere(
  client: CaloryaClient,
): Promise<{ revokedOnServer: boolean }> {
  let revokedOnServer = false;

  try {
    const { error } = await client.auth.signOut();
    revokedOnServer = !error;
  } catch {
    revokedOnServer = false;
  }

  // Belt and braces. `scope: 'local'` touches no network — it only drops the
  // stored session — so this cannot fail for the reasons the call above can.
  // It is a no-op when the first call already succeeded.
  try {
    await client.auth.signOut({ scope: 'local' });
  } catch {
    // Ignored: the verification below is what decides whether we succeeded.
  }

  // Don't take it on trust. Different gotrue versions clear local state at
  // different points in their error paths, and "signed out" is exactly the
  // claim that must not be wrong.
  const { data } = await client.auth.getSession();
  if (data.session) {
    throw new Error(
      'Gagal keluar: sesi masih tersimpan di perangkat ini. Coba lagi.',
    );
  }

  return { revokedOnServer };
}
