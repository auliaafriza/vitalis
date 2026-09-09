import { describe, expect, it } from 'vitest';
import { authErrorMessage } from '../auth-errors';

describe('authErrorMessage', () => {
  it('menerjemahkan email yang sudah terdaftar', () => {
    // The case that appears the moment email confirmation is switched off.
    expect(authErrorMessage(new Error('User already registered'))).toMatch(
      /sudah punya akun/,
    );
  });

  it('menerjemahkan sandi atau email yang salah', () => {
    expect(authErrorMessage(new Error('Invalid login credentials'))).toMatch(
      /Email atau kata sandi salah/,
    );
  });

  it('menerjemahkan email yang belum dikonfirmasi', () => {
    expect(authErrorMessage(new Error('Email not confirmed'))).toMatch(
      /belum dikonfirmasi/,
    );
  });

  it('cocok tanpa peduli huruf besar-kecil dan teks di sekitarnya', () => {
    // GoTrue reworded this between releases; loose matching survives that.
    expect(
      authErrorMessage(new Error('AuthApiError: USER ALREADY REGISTERED (422)')),
    ).toMatch(/sudah punya akun/);
  });

  it('menerjemahkan batas email per jam', () => {
    expect(authErrorMessage(new Error('Email rate limit exceeded'))).toMatch(
      /satu jam/,
    );
  });

  it('mengembalikan pesan asli kalau tidak dikenali', () => {
    // Never swallow an unknown failure into a vague apology: the English
    // sentence is still what someone would paste into a bug report.
    expect(authErrorMessage(new Error('Database error saving new user'))).toBe(
      'Database error saving new user',
    );
  });

  it('tetap memberi kalimat untuk lemparan yang bukan Error', () => {
    expect(authErrorMessage(null)).toMatch(/Coba lagi/);
    expect(authErrorMessage({})).toMatch(/Coba lagi/);
    expect(authErrorMessage('Invalid login credentials')).toMatch(/salah/);
  });
});
