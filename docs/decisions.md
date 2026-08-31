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
