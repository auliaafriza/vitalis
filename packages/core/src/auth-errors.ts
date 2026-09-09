/**
 * Supabase auth errors, said in Indonesian and in the second person.
 *
 * Everything the auth server returns is an English sentence written for a
 * developer: "Invalid login credentials", "User already registered". Showing
 * those to someone trying to sign in is two failures at once — they cannot
 * read it, and even translated it does not say what to do next.
 *
 * A lookup rather than a rewrite of the client: the same six messages surface
 * on the web and on the phone, and translating them twice is how the two apps
 * end up explaining the same failure differently.
 *
 * Matching is on a lowercased substring, deliberately loose. The exact
 * wording changes between GoTrue releases, and a message that stops matching
 * falls through to the original English — visibly imperfect, but never wrong,
 * and never an empty alert.
 */

interface Rule {
  match: string;
  message: string;
}

const RULES: readonly Rule[] = [
  {
    match: 'invalid login credentials',
    message: 'Email atau kata sandi salah. Coba periksa lagi.',
  },
  {
    match: 'email not confirmed',
    message:
      'Email ini belum dikonfirmasi. Buka tautan konfirmasi di inbox-mu dulu, lalu masuk lagi.',
  },
  {
    match: 'user already registered',
    message:
      'Email ini sudah punya akun. Masuk saja — atau pakai "Lupa kata sandi?" kalau sandinya lupa.',
  },
  {
    match: 'password should be at least',
    message: 'Kata sandi minimal 8 karakter.',
  },
  {
    match: 'unable to validate email address',
    message: 'Alamat email tidak valid.',
  },
  {
    match: 'email rate limit exceeded',
    message:
      'Terlalu banyak email dikirim dari proyek ini dalam satu jam. Tunggu sebentar lalu coba lagi.',
  },
  {
    match: 'for security purposes',
    message: 'Terlalu cepat. Tunggu sekitar satu menit sebelum mencoba lagi.',
  },
  {
    match: 'signups not allowed',
    message: 'Pendaftaran sedang ditutup untuk aplikasi ini.',
  },
  {
    // Thrown by fetch itself, not by the server, so it has no Supabase wording.
    match: 'network request failed',
    message: 'Tidak ada koneksi. Periksa jaringanmu lalu coba lagi.',
  },
];

/** A message worth showing a person, from whatever the auth call threw. */
export function authErrorMessage(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';

  const found = RULES.find((rule) => raw.toLowerCase().includes(rule.match));
  if (found) return found.message;

  // Unknown: keep the original rather than inventing a vague apology. A
  // developer-shaped sentence is still more actionable than "terjadi
  // kesalahan", and it is what someone would paste into a bug report.
  return raw.length > 0 ? raw : 'Gagal memproses permintaan. Coba lagi.';
}
