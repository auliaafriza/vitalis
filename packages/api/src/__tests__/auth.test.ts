import { describe, expect, it, vi } from 'vitest';
import { signOutEverywhere } from '../queries/auth';
import type { CaloryaClient } from '../client';

/**
 * The bug this function exists to prevent: a sign-out button that does
 * nothing.
 *
 * `auth.signOut()` is a network call — it asks the server to revoke the
 * refresh token — so it fails offline and returns 403 when the token has
 * already expired. The naive version awaited it with no catch, so on failure
 * every line after it (clear the cache, go to /login) never ran and the user
 * stayed signed in with no explanation.
 *
 * These cases are therefore all about failure. The happy path is the least
 * interesting one.
 */

/** A fake auth surface: enough of gotrue to drive every branch. */
function fakeClient({
  globalResult,
  localResult = { error: null },
  sessionAfter = null,
}: {
  globalResult: { error: unknown } | (() => never);
  localResult?: { error: unknown };
  sessionAfter?: unknown;
}) {
  const calls: string[] = [];
  const client = {
    auth: {
      signOut: vi.fn(async (options?: { scope?: string }) => {
        if (options?.scope === 'local') {
          calls.push('local');
          return localResult;
        }
        calls.push('global');
        if (typeof globalResult === 'function') globalResult();
        return globalResult;
      }),
      getSession: vi.fn(async () => ({ data: { session: sessionAfter } })),
    },
  } as unknown as CaloryaClient;
  return { client, calls };
}

describe('signOutEverywhere', () => {
  it('revokes on the server when the network is there', async () => {
    const { client, calls } = fakeClient({ globalResult: { error: null } });

    await expect(signOutEverywhere(client)).resolves.toEqual({
      revokedOnServer: true,
    });
    expect(calls[0]).toBe('global');
  });

  it('still signs out locally when the revoke request throws', async () => {
    const { client, calls } = fakeClient({
      globalResult: () => {
        throw new TypeError('Network request failed');
      },
    });

    // The whole point: offline must not mean "stuck signed in".
    await expect(signOutEverywhere(client)).resolves.toEqual({
      revokedOnServer: false,
    });
    expect(calls).toEqual(['global', 'local']);
  });

  it('still signs out locally when the server answers with an error', async () => {
    const { client, calls } = fakeClient({
      globalResult: { error: { status: 403, message: 'invalid token' } },
    });

    await expect(signOutEverywhere(client)).resolves.toEqual({
      revokedOnServer: false,
    });
    expect(calls).toEqual(['global', 'local']);
  });

  it('reports honestly when the local session survives both attempts', async () => {
    const { client } = fakeClient({
      globalResult: { error: { message: 'boom' } },
      localResult: { error: { message: 'storage unavailable' } },
      sessionAfter: { access_token: 'masih-ada' },
    });

    // Claiming success here would be the worse failure: the user believes
    // they have left, and the next person to open the app is still them.
    await expect(signOutEverywhere(client)).rejects.toThrow(/masih tersimpan/);
  });

  it('does not claim a server revoke it did not get', async () => {
    const { client } = fakeClient({
      globalResult: () => {
        throw new Error('offline');
      },
    });

    const { revokedOnServer } = await signOutEverywhere(client);
    expect(revokedOnServer).toBe(false);
  });
});
