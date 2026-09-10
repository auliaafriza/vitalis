import { describe, expect, it } from 'vitest';
import {
  parseOnboardingDraft,
  serialiseOnboardingDraft,
} from '../onboarding-draft';
import { isAccountGone } from '../auth-gate';

const base = {
  userId: 'u1',
  step: 1,
  fullName: 'Aulia',
  birthDate: '1996-04-12',
  sex: 'male',
  heightCm: '172',
  weightKg: '68',
  activityLevel: 'moderate',
  goal: 'lose',
};

describe('draft onboarding', () => {
  it('bolak-balik utuh', () => {
    const draft = parseOnboardingDraft(serialiseOnboardingDraft(base), 'u1');
    expect(draft).toMatchObject(base);
  });

  it('menolak draft milik akun lain', () => {
    // Satu ponsel, dua orang. Tinggi badan orang pertama tidak boleh muncul
    // di formulir orang kedua.
    expect(parseOnboardingDraft(serialiseOnboardingDraft(base), 'u2')).toBeNull();
  });

  it('mengabaikan draft yang sudah basi', () => {
    const raw = JSON.stringify({
      ...base,
      savedAt: new Date(Date.now() - 8 * 24 * 3600_000).toISOString(),
    });
    expect(parseOnboardingDraft(raw, 'u1')).toBeNull();
  });

  it('tidak meledak oleh isi penyimpanan yang rusak', () => {
    // Nilainya datang dari disk: bisa berisi apa pun yang ditulis versi lama.
    for (const raw of ['', 'bukan json', '[]', 'null', '{"userId":1}', undefined, null]) {
      expect(() => parseOnboardingDraft(raw as string, 'u1')).not.toThrow();
      expect(parseOnboardingDraft(raw as string, 'u1')).toBeNull();
    }
  });

  it('membersihkan langkah di luar jangkauan', () => {
    const raw = serialiseOnboardingDraft({ ...base, step: 99 });
    expect(parseOnboardingDraft(raw, 'u1')?.step).toBe(0);
  });

  it('tidak pernah menyimpan kata sandi', () => {
    const raw = serialiseOnboardingDraft({ ...base, password: 'rahasia123' } as never);
    // Kalaupun pemanggil keliru mengirimkannya, hasil bacanya tidak membawanya.
    expect(parseOnboardingDraft(raw, 'u1')).not.toHaveProperty('password');
  });
});

describe('isAccountGone', () => {
  it('akun benar-benar hilang kalau server menolak token-nya', () => {
    expect(isAccountGone({ status: 401, name: 'AuthApiError' }, null)).toBe(true);
    expect(isAccountGone({ status: 403, name: 'AuthApiError' }, null)).toBe(true);
  });

  it('tanpa error dan tanpa user berarti hilang', () => {
    expect(isAccountGone(null, null)).toBe(true);
    expect(isAccountGone(undefined, null)).toBe(true);
  });

  it('offline BUKAN berarti akunnya hilang', () => {
    // Regresi yang dicegah: mengeluarkan orang yang sedang di tengah setup
    // hanya karena sinyalnya putus.
    expect(isAccountGone({ name: 'AuthRetryableFetchError', status: 0 }, null)).toBe(false);
    expect(isAccountGone({ name: 'TypeError' }, null)).toBe(false);
    expect(isAccountGone({ status: 500, name: 'AuthApiError' }, null)).toBe(false);
    expect(isAccountGone({ status: 0 }, null)).toBe(false);
  });

  it('user yang masih ada tidak pernah dianggap hilang', () => {
    expect(isAccountGone(null, { id: 'u1' })).toBe(false);
  });
});
