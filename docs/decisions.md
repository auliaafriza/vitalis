# Catatan keputusan arsitektur

Format ringkas: konteks, keputusan, konsekuensi. Ditulis saat keputusannya diambil,
bukan sesudahnya.

---

## ADR-001 — Snapshot gizi pada entri makanan

**Konteks.** Sebuah entri makanan merujuk ke baris di tabel `foods`. Kalau nilai gizi
hanya dihitung lewat join saat dibaca, mengoreksi satu angka pada makanan akan
mengubah seluruh riwayat pengguna yang pernah mencatat makanan itu.

**Keputusan.** `food_entries` menyimpan salinan nilai gizi (kalori, makro, natrium)
yang diisi oleh trigger `snapshot_food_entry()` saat insert atau saat `quantity_g`
berubah. Klien tidak pernah menulis kolom-kolom ini.

**Konsekuensi.**
- Riwayat tidak bisa berubah retroaktif. Ini yang diinginkan.
- Data sedikit redundan — sekitar 7 kolom numerik per entri. Murah.
- Trigger, bukan kode aplikasi, yang menjamin konsistensi. Aplikasi web dan mobile
  tidak bisa saling berbeda karena keduanya tidak menghitung apa pun di sini.
- Menyalin makanan ke hari lain (`copyMeal`) sengaja memakai `food_id`, bukan
  snapshot, karena salinan baru memang harus mencerminkan definisi terkini.

---

## ADR-002 — Hari sebagai `date` di zona waktu pengguna

**Konteks.** "Apa yang saya makan hari ini" adalah pertanyaan tentang hari kalender
lokal, bukan tentang rentang UTC. Menyimpan `timestamptz` lalu mengelompokkan dengan
`date_trunc` di UTC akan menempatkan makan malam jam 20:00 WIB (13:00 UTC) di hari
yang benar, tetapi makan malam jam 21:00 WIB (14:00 UTC) juga — sampai penggunanya
bepergian, dan semuanya bergeser.

**Keputusan.** Setiap entri punya kolom `logged_on date`. Nilainya dihitung di klien
memakai `Intl.DateTimeFormat` dengan zona waktu dari profil, bukan `toISOString()`.

**Konsekuensi.**
- Query harian menjadi kesetaraan sederhana pada kolom terindeks, bukan konversi
  zona waktu di dalam `WHERE`.
- Pergeseran hari saat aplikasi dibiarkan terbuka semalaman ditangani eksplisit di
  hook `useDay`, yang menghitung ulang "hari ini" saat window mendapat fokus.
- Ada satu unit test khusus untuk kasus 21:00 UTC = hari berikutnya di Jakarta.

---

## ADR-003 — Logika domain di paket sinkron tanpa dependensi

**Konteks.** Perhitungan kalori bisa diletakkan di server (RPC Postgres, atau route
handler). Itu menempatkan satu sumber kebenaran di satu tempat.

**Keputusan.** Semua kalkulasi ada di `packages/core`: fungsi murni, sinkron, tanpa
React dan tanpa I/O.

**Konsekuensi.**
- Form onboarding bisa menampilkan target yang dihitung **sambil** pengguna memilih —
  tanpa round-trip. Ini bukan detail kecil; itu perbedaan antara form yang terasa
  hidup dan form yang terasa seperti survei.
- 66 unit test berjalan dalam ~1 detik tanpa database.
- Aplikasi web dan mobile secara struktural tidak bisa menghitung berbeda.
- Harganya: kalau nanti ada klien pihak ketiga (mis. integrasi), logika ini perlu
  diekspos lewat API, bukan diduplikasi.

---

## ADR-004 — Target diberi versi

**Konteks.** Pengguna mengubah tujuan dari "pertahankan" ke "turunkan". Grafik bulan
lalu sekarang dinilai terhadap target yang belum ada saat itu, dan hari-hari yang
dulu "tepat sasaran" mendadak terlihat gagal.

**Keputusan.** Tabel `targets` punya `effective_from date` dan unique key
`(user_id, effective_from)`. `getTargetsFor(day)` mengambil versi terbaru yang berlaku
pada atau sebelum hari itu.

**Konsekuensi.**
- Riwayat jujur.
- Menyimpan target baru adalah upsert pada hari ini, bukan update baris tunggal.
- Setiap query harian butuh satu lookup target; diindeks
  (`user_id, effective_from desc`) sehingga murah.

---

## ADR-005 — Auth berbasis cookie di web, AsyncStorage di mobile

**Konteks.** Supabase mendukung keduanya. Memilih satu untuk kedua platform akan
menyederhanakan `packages/api`.

**Keputusan.** `packages/api` tidak membuat client sama sekali; semua fungsinya
menerima `SupabaseClient` sebagai argumen pertama. Web membangunnya lewat
`@supabase/ssr` (cookie, agar server component dan proxy bisa membacanya), mobile
lewat `createClient` dengan storage AsyncStorage.

**Konsekuensi.**
- Guard auth di web berjalan di `proxy.ts` (dulu `middleware.ts`), sebelum rendering.
  Permintaan tanpa sesi tidak pernah menyentuh query data.
- `packages/api` tetap agnostik platform dan mudah diuji.
- Ada dua tempat konfigurasi client, bukan satu. Trade-off yang disengaja.

---

## ADR-006 — Service worker ditulis tangan

**Konteks.** `next-pwa` dan sejenisnya menghasilkan service worker otomatis.

**Keputusan.** `public/sw.js` ditulis manual dengan tiga aturan eksplisit: navigasi
network-first dengan fallback ke shell lalu `/offline`; aset `_next/static`
cache-first (URL-nya sudah content-hashed sehingga tidak mungkin basi); dan trafik
Supabase **tidak pernah** di-cache.

**Konsekuensi.**
- Aturan cache-nya bisa dibaca dan dipertanggungjawabkan — penting karena men-cache
  respons auth atau data kesehatan yang basi adalah masalah nyata, bukan sekadar
  ketidaknyamanan.
- Tidak ada precache manifest otomatis; aset yang ingin tersedia offline harus
  didaftarkan sendiri.

---

## ADR-007 — Ambang BMI WHO Asia-Pasifik

**Konteks.** Ambang BMI global (normal < 25) diketahui meremehkan risiko kardiometabolik
pada populasi Asia. WHO/IASO/IOTF (2000) mengusulkan ambang yang lebih rendah untuk
kawasan Asia-Pasifik: normal < 23, berat berlebih < 25.

**Keputusan.** `bmiCategory()` memakai ambang Asia-Pasifik.

**Konsekuensi.**
- Pengguna dengan BMI 24 dikategorikan "berat berlebih", bukan "normal".
- Ada unit test yang mengunci perilaku ini agar tidak tergeser kembali ke ambang
  global oleh refactor.
- Kalau aplikasi diperluas ke luar kawasan ini, ambangnya perlu mengikuti profil,
  bukan hard-coded.

---

## ADR-008 — Tipe React Native legacy, bukan `types_generated`

**Konteks.** React Native 0.86/0.87 mengapalkan dua set definisi tipe. Kondisi
resolusi `types` default mengarah ke `types_generated/`, di mana alias `ViewStyle`
dan `TextStyle` yang diekspor tidak cocok dengan tipe prop komponen yang seharusnya
mereka gambarkan — `position: "fixed"` ada di satu sisi dan tidak di sisi lain,
sehingga **setiap** hasil `StyleSheet.create()` gagal typecheck.

**Keputusan.** `apps/mobile/tsconfig.json` menyetel
`customConditions: ["react-native-legacy-deep-imports", "react-native"]`, yang
mengarahkan resolusi ke `types/index.d.ts` yang konsisten.

**Konsekuensi.**
- `tsc --noEmit` bersih di aplikasi mobile.
- Perlu ditinjau ulang ketika RN menstabilkan tipe generated-nya.

---

## ADR-009 — Paywall dimatikan lewat satu saklar di database, bukan dihapus

**Konteks.** Fitur premium (tren 30/90/365/semua, ekspor CSV & PDF) sudah dibangun
lengkap dengan penegakan di RLS. Untuk sementara semuanya ingin dibuka gratis —
demo portofolio tanpa gembok lebih enak dilihat, dan belum ada penagihan yang
berjalan. Pilihannya: hapus kodenya, atau matikan penegakannya.

**Keputusan.** Tabel satu baris `app_settings.paywall_enabled` (default `false`)
dibaca oleh `paywall_enabled()`, dan `current_tier()` mengembalikan `'premium'`
selama saklar itu mati.

**Konsekuensi.**
- Menyalakan kembali cukup satu perintah, tanpa deploy dan tanpa ubah kode:
  `update public.app_settings set paywall_enabled = true;`
- Tidak ada sumber kebenaran kedua. Semua konsumen — `history_floor()`, setiap
  policy RLS, dan `LIMITS` di sisi klien — sudah membaca `current_tier()`, jadi
  saklar ini satu-satunya tempat keputusannya dibuat.
- Baris `subscriptions` tetap jujur menulis `'free'`. Baris itu mencatat apa yang
  dibayar seseorang; `current_tier()` mencatat apa yang boleh dia lakukan. Sengaja
  bukan hal yang sama, supaya penagihan nanti tidak perlu membersihkan data palsu.
- `paywall_enabled()` sengaja *fail-open*: baris setelan yang hilang membuka produk,
  bukan mengunci semua orang dari riwayatnya sendiri. Ini satu-satunya tempat di
  kode entitlement yang arah amannya permisif, karena mode gagalnya adalah
  kehilangan akses ke data sendiri, bukan kehilangan pendapatan.
- Suite `supabase/tests/entitlements.sql` menyalakan saklar itu di dalam
  transaksinya sendiri, jadi gerbangnya tetap teruji meski produk dikirim terbuka.

---

## ADR-010 — Skala `ink` bermakna jarak dari permukaan baca, bukan terang-gelap

**Konteks.** Aplikasi perlu tema terang (sesuai desain baru) dan gelap sekaligus.
Cara biasa — awalan `dark:` di setiap kelas warna — berarti sekitar 170 suntingan
yang harus terus dijaga sinkron selamanya, dan satu kelas yang terlewat menghasilkan
teks tak terbaca di salah satu tema.

**Keputusan.** Angka pada skala `ink` diartikan ulang: **950 adalah halaman yang
dilihat sekilas, 100 adalah teks yang dibaca**, dan angka di antaranya adalah lapisan
di antara keduanya. Nilainya dibalik per tema lewat CSS custom property, dirakit
dengan `@theme inline` supaya utilitas Tailwind memancarkan `var(--ink-500)` bukan
nilai literal.

**Konsekuensi.**
- `text-ink-100` tetap berarti "teks utama" di kedua tema. Tidak ada satu pun
  varian `dark:` di markup.
- `text-ink-950` di atas `bg-brand-500` otomatis benar di keduanya: krem di atas
  hijau tua (terang), hampir hitam di atas mint (gelap).
- Yang harus diperhatikan: permukaan tembus pandang. `bg-ink-900/60` mengandaikan
  latar gelap di belakangnya; semuanya diganti jadi solid karena putih 60% di atas
  krem tidak lagi terlihat sebagai kartu.
- React Native tidak punya custom property, jadi `apps/mobile/src/lib/theme.tsx`
  menyimpan dua objek palet dan `useThemedStyles(makeStyles)` membangun ulang
  `StyleSheet` saat tema berganti. Cache-nya berkunci identitas objek tema, dan
  kedua palet adalah konstanta modul, jadi bolak-balik tema memakai ulang dua sheet
  yang sama.
- `userInterfaceStyle` di app.json jadi `automatic` — sebelumnya dipaksa `dark`.

---

## ADR-011 — Kategori makanan disimpan sebagai kolom, bukan ditebak dari nama

**Konteks.** Grid "Kategori Populer" butuh kategori. Menebaknya dari nama makanan
saat dibaca lebih murah dan tidak butuh migrasi.

**Keputusan.** Kolom `foods.category` bertipe enum, diisi eksplisit untuk katalog
bawaan lewat daftar nama, bukan pola LIKE.

**Konsekuensi.**
- Tebakan berbasis pola akan menjawab beda di tiap layar, dan sama sekali tidak bisa
  mengklasifikasikan produk yang diimpor lewat barcode — justru tempat tebakan paling
  tidak bisa dipercaya. Impor barcode sekarang default ke `packaged`.
- 'Susu kedelai' itu minuman dan 'Tahu putih' itu makanan utama; tidak ada satu pola
  yang benar untuk keduanya. Karena itu daftarnya ditulis eksplisit supaya bisa
  ditinjau.
- `search_foods()` mendapat parameter `in_category` — bukan `category`, karena nama
  parameter yang sama dengan nama kolom membuat `f.category = category` ambigu dan
  Postgres diam-diam memenangkan parameter, sehingga filternya cocok ke semua baris.
- Fungsi lama di-DROP, bukan di-REPLACE: menambah parameter berdefault menciptakan
  overload, dan PostgREST akan menolak memilih di antara dua kandidat.
- Default kolom `other`, bukan `main`: makanan tak terklasifikasi harus terlihat tak
  terklasifikasi, bukan diam-diam menggelembungkan kategori yang paling sering dibuka.
