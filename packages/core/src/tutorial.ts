/**
 * The introduction a new account sees once.
 *
 * It lives in the shared core, not in each app, because there is exactly one
 * thing to explain and two places to explain it. Kept apart, the two copies
 * drift within a month: someone fixes a typo on the web, the phone keeps it,
 * and the app starts describing itself two different ways.
 *
 * Rules the copy follows, so that later edits stay in the same voice:
 *
 *  - Five slides, and no more. A tutorial people skip teaches nothing, and the
 *    skip rate climbs with every extra tap.
 *  - Say what the person will DO, not what the app HAS. "Cari namanya atau
 *    pindai barcode", not "Fitur pencarian makanan dan pemindai barcode".
 *  - Never promise precision the data cannot deliver. The last slide says the
 *    numbers are estimates, on purpose and up front, because a user who
 *    discovers that on their own stops trusting everything else too.
 */

/** Where a feature lives — the one thing the two apps genuinely say differently. */
export interface TutorialLocation {
  web: string;
  mobile: string;
}

export interface TutorialStep {
  /** Stable key: used for React keys and for analytics later. */
  id: string;
  emoji: string;
  title: string;
  body: string;
  /** Short concrete actions. Two or three; never a wall of bullets. */
  points: readonly string[];
  /**
   * "Ada di ..." — omitted on the slides where naming a tab would be noise
   * (the welcome and the closing note).
   */
  where?: TutorialLocation;
  /** Background tint for the emoji medallion. Hex, because React Native. */
  tint: string;
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    id: 'welcome',
    emoji: '👋',
    title: 'Selamat datang di Calorya',
    body:
      'Target harianmu sudah dihitung dari tinggi, berat, usia dan tujuan yang ' +
      'baru kamu isi. Tinggal dipakai — tidak ada yang perlu diatur lagi.',
    points: [
      'Butuh sekitar satu menit untuk lihat semuanya',
      'Bisa dilewati, dan bisa dibuka lagi kapan saja',
    ],
    tint: '#FDEBD2',
  },
  {
    id: 'log-food',
    emoji: '🍽️',
    title: 'Catat makanan secukupnya',
    body:
      'Cari namanya, pilih dari kategori, atau pindai barcode untuk makanan ' +
      'kemasan. Isi porsinya dalam gram — angkanya langsung terlihat sebelum ' +
      'kamu simpan.',
    points: [
      'Salah porsi? Ketuk catatannya untuk memperbaiki',
      'Menu yang sama seperti kemarin: pakai "Salin dari kemarin"',
    ],
    where: { web: 'halaman Catat Makanan', mobile: 'tab Catat' },
    tint: '#FBDDD5',
  },
  {
    id: 'daily-health',
    emoji: '💧',
    title: 'Air, tidur, langkah, berat',
    body:
      'Satu ketukan untuk segelas air. Tidur dan berat badan cukup diisi ' +
      'sekali sehari, dan langkah terisi sendiri dari pedometer ponsel.',
    points: [
      'Kelebihan satu gelas bisa dihapus dari daftarnya',
      'Berat badan menentukan ulang targetmu seiring waktu',
    ],
    where: { web: 'halaman Kesehatan', mobile: 'tab Beranda' },
    tint: '#D6E9F8',
  },
  {
    id: 'progress',
    emoji: '📈',
    title: 'Lihat polanya, bukan satu hari',
    body:
      'Satu hari yang berantakan tidak berarti apa-apa. Grafik mingguan dan ' +
      'bulanan yang menunjukkan apakah kebiasaanmu bergerak ke arah yang benar.',
    points: [
      'Kalori, makronutrien, air, tidur dan berat dalam satu tempat',
      'Bisa diunduh sebagai CSV atau PDF kalau mau dibawa ke dokter',
    ],
    where: { web: 'halaman Tren', mobile: 'tab Progress' },
    tint: '#D9EFD6',
  },
  {
    id: 'honesty',
    emoji: '⚖️',
    title: 'Angkanya perkiraan, dan itu cukup',
    body:
      'Nilai gizi di katalog adalah angka umum untuk masakan rumahan, bukan ' +
      'hasil uji laboratorium. Cukup akurat untuk melihat kecenderungan, tidak ' +
      'untuk keperluan medis.',
    points: [
      'Target bisa kamu ubah sendiri kapan saja',
      'Tidak ada catatan yang dibagikan tanpa kamu minta',
    ],
    tint: '#E7E4DC',
  },
] as const;

export const TUTORIAL_SKIP_LABEL = 'Lewati';
export const TUTORIAL_LAST_LABEL = 'Mulai pakai Calorya';
export const TUTORIAL_NEXT_LABEL = 'Lanjut';
