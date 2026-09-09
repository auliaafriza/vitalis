# Tautan konfirmasi email menunjuk ke localhost

Bug yang paling sering kembali di proyek ini. Berikut penyebabnya, cara
memperbaikinya, dan cara memastikan perbaikannya benar-benar berlaku.

## Kenapa terjadi

Saat mendaftar, aplikasi mengirim `emailRedirectTo` ke Supabase:

| Aplikasi | Nilai yang dikirim | Asalnya |
| --- | --- | --- |
| Web | `${window.location.origin}/auth/callback` | host tempat halaman dibuka |
| Mobile | `${EXPO_PUBLIC_SITE_URL}/auth/callback` | `eas.json`, atau `.env` saat `expo start` |

**Supabase hanya menghormati nilai itu kalau URL-nya cocok dengan daftar
Redirect URLs di dashboard.** Kalau tidak cocok, Supabase diam-diam memakai
**Site URL** proyek sebagai gantinya — dan Site URL proyek baru adalah
`http://localhost:3000`.

Tidak ada error. Tidak ada peringatan. Pendaftaran tetap sukses. Satu-satunya
gejala adalah tautan mati di inbox orang, berjam-jam kemudian. Itulah yang
membuat bug ini sulit dilacak, dan kenapa memperbaikinya di kode tidak pernah
berhasil — kodenya memang sudah benar.

## Perbaikannya

Dashboard Supabase → **Authentication → URL Configuration**
(`https://supabase.com/dashboard/project/<ref>/auth/url-configuration`):

1. **Site URL** → `https://calorya-web.vercel.app`
   Ini yang dipakai kalau semua cara lain gagal, jadi harus URL produksi.
2. **Redirect URLs** → tambahkan ketiganya:
   - `https://calorya-web.vercel.app/**`
   - `http://localhost:3000/**`
   - `calorya://auth/callback`

   Tanda `**` penting: tanpa itu hanya URL yang sama persis yang cocok, dan
   `/auth/callback` tidak akan lolos.
3. **Save**.

Berlaku untuk email berikutnya. Email yang sudah terkirim tetap salah — tautan
di dalamnya sudah dicetak permanen.

## Cara memastikan

Jangan menebak. Buka email konfirmasi, klik kanan tautannya, salin alamatnya.
Bentuknya seperti ini:

```
https://<ref>.supabase.co/auth/v1/verify?token=...&type=signup&redirect_to=https://calorya-web.vercel.app/auth/callback
                                                                 ^^^^^^^^^^^ ini yang dibaca
```

Kalau `redirect_to` masih `http://localhost:3000`, setelannya belum benar.
Kalau sudah menunjuk ke domain Vercel, selesai.

Sejak versi ini, layar pendaftaran juga menyebutkan tujuan tautannya
("tautannya menuju calorya-web.vercel.app") sehingga masalahnya terlihat saat
mendaftar, bukan berjam-jam kemudian.

## Yang BUKAN bug

Mendaftar dari `localhost:3000` (server dev sendiri) **memang seharusnya**
menghasilkan tautan localhost — `window.location.origin` adalah localhost, dan
itu tujuan yang benar untuk sesi itu. Kalau ingin menguji tautan produksi,
daftar dari `https://calorya-web.vercel.app` atau dari APK.

## Perangkap terkait

- **`supabase/config.toml` bukan tempatnya.** Berkas itu mengatur stack lokal.
  Kalau isinya sampai ter-push ke proyek produksi (`supabase config push`),
  `site_url = "http://localhost:3000"` akan menimpa setelan dashboard dan
  membuat bug ini kembali untuk semua pengguna sekaligus.
- **`EXPO_PUBLIC_SITE_URL` kosong saat `expo start`.** Tanpa `.env`,
  aplikasi mobile tidak mengirim `emailRedirectTo` sama sekali, jadi Supabase
  langsung memakai Site URL. Salin `.env.example` ke `.env`.
- **Email bawaan Supabase dibatasi.** 2 email per jam, dan hanya ke alamat
  anggota tim proyek. Untuk pengguna sungguhan, pasang SMTP sendiri
  (Brevo, SendGrid, Resend) di Authentication → Emails → SMTP Settings.
  Ini masalah terpisah dari URL, tapi sering muncul bersamaan.
