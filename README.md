# Calorya

Pelacak kesehatan harian dan nutrisi lintas platform. Satu monorepo, dua aplikasi
(Next.js PWA + Expo/React Native), satu domain core yang dipakai bersama, dan satu
database Supabase dengan Row-Level Security penuh.

```
                     ┌──────────────────┐   ┌──────────────────┐
                     │  apps/web        │   │  apps/mobile     │
                     │  Next.js 16 PWA  │   │  Expo SDK 57     │
                     │  · installable   │   │  · pedometer     │
                     │  · offline shell │   │  · native forms  │
                     └────────┬─────────┘   └────────┬─────────┘
                              │                      │
                              └──────────┬───────────┘
                                         │
                            ┌────────────▼────────────┐
                            │  packages/api           │
                            │  query & mutation murni │
                            │  di atas SupabaseClient │
                            └────────────┬────────────┘
                                         │
                            ┌────────────▼────────────┐
                            │  packages/core          │
                            │  BMR/TDEE · makro       │
                            │  streak · tren · zod    │
                            │  0 dependensi UI        │
                            └────────────┬────────────┘
                                         │
                            ┌────────────▼────────────┐
                            │  Supabase (Postgres)    │
                            │  RLS · trigger snapshot │
                            │  view ringkasan harian  │
                            └─────────────────────────┘
```

## Apa yang bisa dilakukan

- **Nutrisi** — cari makanan (katalog Indonesia bawaan, 50+ item), pilih porsi dengan
  pratinjau gizi langsung, kelompokkan per waktu makan, lihat komposisi makro.
- **Kesehatan harian** — air minum, tidur (durasi + kualitas), langkah, berat badan
  (dengan BMI ambang WHO Asia-Pasifik), suasana hati.
- **Target otomatis** — dihitung dari profil memakai Mifflin-St Jeor, dengan versioning
  sehingga grafik bulan lalu tetap dinilai dengan target bulan lalu.
- **Tren** — grafik 7/30/90 hari, rata-rata bergerak 7 hari untuk berat badan, dan
  regresi linier untuk laju perubahan per minggu.
- **PWA** — bisa dipasang ke layar utama, punya shell offline dan service worker sendiri.
- **Mobile** — pedometer perangkat mengisi langkah otomatis (satu-satunya hal yang
  tidak bisa dilakukan versi web).

## Menjalankan

Prasyarat: Node 20.19+, akun Supabase (tier gratis cukup).

```bash
npm install
```

### 1. Siapkan database

Buat project di [supabase.com](https://supabase.com), lalu jalankan kedua file di
`supabase/migrations/` secara berurutan melalui **SQL Editor** di dashboard.

Atau dengan Supabase CLI:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Untuk pengembangan lokal penuh:

```bash
supabase start     # Postgres + Auth lokal via Docker
supabase db reset  # jalankan migrasi + seed katalog makanan
npm run db:types   # regenerasi packages/api/src/database.types.ts
```

### 2. Isi environment

```bash
cp .env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env
```

Isi URL dan anon key dari **Project Settings → API**.

### 3. Jalankan

```bash
npm run dev:web      # http://localhost:3000
npm run dev:mobile   # buka di Expo Go, atau tekan i / a
```

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `npm test` | 66 unit test untuk logika gizi, tanggal, dan tren |
| `npm run typecheck` | typecheck seluruh workspace |
| `npm run build:web` | build produksi Next.js |
| `npm run db:types` | generate ulang tipe database dari Supabase lokal |
| `npm run db:test` | 9 uji perilaku skema: isolasi RLS, trigger snapshot, constraint |

### Uji keamanan database

`supabase/tests/rls_and_triggers.sql` berisi assertion yang tidak bisa dijamin
TypeScript: bahwa satu pengguna tidak bisa membaca, menulis, atau menghapus data
pengguna lain; bahwa mengedit definisi makanan tidak menulis ulang riwayat; dan
bahwa constraint menolak nilai yang mustahil. Jalankan terhadap database mana pun
yang sudah dimigrasi:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres npm run db:test
```

Seluruh 9 uji berjalan di dalam transaksi dan di-rollback, jadi aman dijalankan
kapan pun.

## Struktur

```
calorya/
├── packages/
│   ├── core/        # domain murni: kalkulasi, skema zod, format. Tanpa React, tanpa I/O.
│   └── api/         # data layer Supabase. Fungsi murni yang menerima client.
├── apps/
│   ├── web/         # Next.js 16 (App Router, Tailwind 4, service worker sendiri)
│   └── mobile/      # Expo SDK 57 (expo-router, pedometer)
└── supabase/
    └── migrations/  # skema, RLS, trigger, view, seed katalog makanan
```

## Keputusan teknis yang perlu diketahui

Penjelasan lengkap ada di [`docs/decisions.md`](docs/decisions.md). Ringkasnya:

1. **Kalori tercatat disimpan sebagai snapshot, bukan referensi.** Sebuah trigger
   database mengisi nilai gizi saat entri dibuat. Mengedit definisi makanan besok
   tidak boleh diam-diam mengubah kalori kemarin.
2. **Hari adalah `date` di zona waktu pengguna, bukan `timestamptz`.** Makan malam
   jam 20:00 di Jakarta harus masuk hari ini, bukan besok versi UTC.
3. **Semua kalkulasi hidup di `packages/core` dan sinkron.** Itulah sebabnya form
   onboarding bisa menampilkan target yang dihitung sambil pengguna masih mengetik,
   dan mengapa 66 unit test bisa berjalan tanpa database.
4. **Target diberi versi (`effective_from`).** Riwayat dinilai dengan target yang
   benar-benar berlaku saat itu.
5. **Ambang BMI memakai standar WHO Asia-Pasifik**, bukan ambang global — populasi
   sasarannya Indonesia.

## Batasan yang diketahui

- Angka gizi katalog adalah estimasi umum, bukan hasil uji laboratorium. Aplikasi ini
  bukan alat medis dan tidak menggantikan saran tenaga kesehatan.
- Mode offline saat ini sebatas app shell dan halaman yang pernah dibuka. Pencatatan
  saat offline (antrean tulis + sinkronisasi) belum diimplementasikan.
- Integrasi Apple Health / Google Fit belum ada; pedometer perangkat sudah jalan.
- Palet warna diduplikasi antara CSS (web) dan objek JS (mobile). Kalau desainnya
  bertambah, langkah berikutnya adalah satu paket token yang meng-emit keduanya.

## Lisensi

MIT
