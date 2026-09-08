import type { Metadata } from 'next';
import Link from 'next/link';

/**
 * The privacy policy.
 *
 * Public by design — Google Play requires a policy URL reachable without
 * signing in, so `/privasi` is listed in PUBLIC_PATHS in proxy.ts. It also
 * sits outside the (app) route group so none of the signed-in chrome renders
 * around it.
 *
 * Everything below describes what the code actually does. When the app starts
 * collecting something new, this page and the Play Data safety form both have
 * to change with it — a policy that drifts from the code is worse than none,
 * because it is a promise you are no longer keeping.
 */

const UPDATED = '8 September 2026';
const CONTACT = 'auliaafriza@gmail.com';

export const metadata: Metadata = {
  title: 'Kebijakan Privasi — Calorya',
  description:
    'Data apa yang dikumpulkan Calorya, untuk apa dipakai, siapa yang bisa melihatnya, dan bagaimana cara menghapusnya.',
};

export default function PrivasiPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12 sm:px-8">
      <header className="border-b border-ink-800 pb-6">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-brand-400 uppercase">
          Calorya
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Kebijakan Privasi</h1>
        <p className="mt-2 text-sm text-ink-500">
          Berlaku sejak {UPDATED}. Dokumen ini menjelaskan data apa yang Calorya
          simpan, kenapa, dan bagaimana kamu bisa mengambil atau menghapusnya.
        </p>
      </header>

      <Section title="Ringkasnya">
        <ul className="space-y-2">
          <Bullet>
            Calorya menyimpan apa yang kamu catat sendiri — makanan, air, tidur,
            langkah, berat badan, suasana hati — beserta profil dasar untuk
            menghitung targetmu.
          </Bullet>
          <Bullet>
            Catatanmu hanya bisa dibaca oleh akunmu. Pembatasan itu ditegakkan di
            database, bukan cuma di tampilan aplikasi.
          </Bullet>
          <Bullet>
            Tidak ada iklan, tidak ada pelacak pihak ketiga, tidak ada analitik,
            dan datamu tidak dijual atau dibagikan untuk pemasaran.
          </Bullet>
          <Bullet>
            Kamera dipakai <em>hanya</em> untuk membaca barcode. Tidak ada foto
            yang disimpan atau dikirim ke mana pun.
          </Bullet>
        </ul>
      </Section>

      <Section title="Siapa yang bertanggung jawab">
        <p>
          Calorya dikembangkan dan dioperasikan oleh <strong>Aulia Afriza</strong>{' '}
          sebagai pengembang perorangan. Untuk pertanyaan, permintaan salinan
          data, atau penghapusan akun, hubungi{' '}
          <a
            href={`mailto:${CONTACT}`}
            className="font-medium text-brand-400 underline underline-offset-4"
          >
            {CONTACT}
          </a>
          .
        </p>
      </Section>

      <Section title="Data yang dikumpulkan">
        <p className="mb-4">
          Semua data di bawah ini kamu masukkan sendiri, kecuali yang ditandai
          sebagai berasal dari sensor perangkat.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink-700 text-left">
                <Th>Data</Th>
                <Th>Contoh</Th>
                <Th>Kenapa dibutuhkan</Th>
              </tr>
            </thead>
            <tbody>
              <Row
                what="Identitas akun"
                example="Alamat email, kata sandi"
                why="Untuk masuk ke akunmu dan memastikan hanya kamu yang bisa membacanya. Kata sandi disimpan dalam bentuk hash oleh penyedia autentikasi, bukan sebagai teks biasa."
              />
              <Row
                what="Profil"
                example="Nama, tanggal lahir, jenis kelamin, tinggi badan, tingkat aktivitas, tujuan, zona waktu"
                why="Dipakai menghitung kebutuhan kalori dan makronutrienmu. Tanggal lahir dan jenis kelamin adalah variabel dalam rumus Mifflin-St Jeor; tanpa keduanya targetnya cuma tebakan."
              />
              <Row
                what="Catatan kesehatan"
                example="Makanan dan porsinya, air minum, durasi tidur, langkah, berat badan, persen lemak tubuh, suasana hati, catatan bebas"
                why="Inilah isi aplikasinya. Data ini yang membentuk ringkasan harian dan grafik trenmu."
              />
              <Row
                what="Langkah dari sensor"
                example="Jumlah langkah hari ini"
                why="Dibaca dari penghitung langkah perangkat (Android: izin Pengenalan Aktivitas) supaya kamu tidak perlu mengetiknya. Hanya angka langkahnya yang dibaca — bukan lokasi, bukan rute."
              />
              <Row
                what="Barcode"
                example="Angka barcode kemasan makanan"
                why="Angkanya dicari di katalog Calorya, lalu ke Open Food Facts kalau tidak ketemu. Gambar dari kamera diproses di perangkat dan tidak pernah dikirim atau disimpan."
              />
              <Row
                what="Status langganan"
                example="Paket free atau premium, masa aktif"
                why="Menentukan fitur yang terbuka. Saat ini seluruh fitur dibuka gratis dan belum ada pembayaran apa pun yang diproses."
              />
            </tbody>
          </table>
        </div>

        <p className="mt-4">
          Calorya <strong>tidak</strong> mengumpulkan lokasi, daftar kontak, foto,
          rekaman suara, riwayat penjelajahan, atau pengenal iklan.
        </p>
      </Section>

      <Section title="Yang disimpan di perangkatmu">
        <p>
          Dua hal saja: token sesi supaya kamu tidak perlu masuk ulang setiap kali
          membuka aplikasi, dan pilihan temamu (terang, gelap, atau ikut
          perangkat). Keduanya tersimpan lokal di perangkat, tidak dikirim ke
          server, dan hilang saat kamu keluar dari akun atau mencopot aplikasi.
        </p>
      </Section>

      <Section title="Siapa yang bisa melihat datamu">
        <p className="mb-4">
          Kamu. Setiap tabel yang memuat catatanmu dilindungi Row-Level Security di
          database: kueri hanya mengembalikan baris milik akun yang sedang masuk.
          Pembatasan ini berlaku di lapisan database, jadi tetap berlaku meski
          seseorang memanggil API-nya langsung tanpa lewat aplikasi.
        </p>
        <p className="mb-4">
          Sebagai pengembang, saya tidak membaca catatan kesehatan penggunanya, dan
          tidak akan melakukannya kecuali kamu sendiri yang meminta bantuan atas
          suatu masalah dan menyetujuinya lebih dulu.
        </p>
        <p>Pihak ketiga yang terlibat hanya dua, keduanya seperlunya:</p>
        <ul className="mt-3 space-y-3">
          <Bullet>
            <strong>Supabase</strong> — menyediakan basis data, autentikasi, dan
            servernya. Datamu tersimpan di sana sebagai pemroses data atas nama
            Calorya. Kebijakan privasi mereka:{' '}
            <ExternalLink href="https://supabase.com/privacy">
              supabase.com/privacy
            </ExternalLink>
            .
          </Bullet>
          <Bullet>
            <strong>Open Food Facts</strong> — basis data produk terbuka, dihubungi{' '}
            <em>hanya</em> saat kamu memindai barcode yang belum ada di katalog
            Calorya. Yang dikirim cuma angka barcode-nya. Seperti pada setiap
            permintaan internet, alamat IP perangkatmu terlihat oleh layanan
            tersebut. Kebijakan mereka:{' '}
            <ExternalLink href="https://world.openfoodfacts.org/privacy">
              openfoodfacts.org/privacy
            </ExternalLink>
            .
          </Bullet>
        </ul>
        <p className="mt-4">
          Tidak ada SDK iklan, tidak ada analitik, dan tidak ada pelaporan crash
          pihak ketiga di dalam aplikasi ini.
        </p>
      </Section>

      <Section title="Berapa lama disimpan">
        <p>
          Selama akunmu masih ada. Catatan harian sengaja disimpan tanpa batas
          waktu karena gunanya justru untuk dilihat lagi bertahun-tahun kemudian —
          bukan karena ada nilainya bagi kami. Setiap entri bisa kamu hapus satu
          per satu kapan saja, dan menghapus akun akan menghapus seluruhnya.
        </p>
      </Section>

      <Section title="Hakmu atas datamu">
        <ul className="space-y-2">
          <Bullet>
            <strong>Melihat dan mengubah</strong> — semua catatanmu bisa dibuka dan
            disunting langsung di aplikasi.
          </Bullet>
          <Bullet>
            <strong>Mengambil salinan</strong> — ekspor CSV dan laporan cetak
            tersedia di halaman Progress, dalam format yang bisa dibuka Excel atau
            dibawa ke dokter dan ahli gizi.
          </Bullet>
          <Bullet>
            <strong>Menghapus</strong> — entri dihapus sendiri lewat aplikasi.
            Untuk menghapus seluruh akun beserta isinya, kirim permintaan dari
            alamat email akunmu ke{' '}
            <a
              href={`mailto:${CONTACT}?subject=Permintaan%20hapus%20akun%20Calorya`}
              className="font-medium text-brand-400 underline underline-offset-4"
            >
              {CONTACT}
            </a>
            . Penghapusan diproses paling lambat 30 hari dan bersifat permanen —
            tidak ada salinan cadangan yang bisa dikembalikan setelahnya.
          </Bullet>
        </ul>
      </Section>

      <Section title="Keamanan">
        <p>
          Seluruh lalu lintas antara aplikasi dan server berjalan lewat HTTPS. Kata
          sandi disimpan sebagai hash. Akses antar-pengguna dibatasi di lapisan
          database seperti dijelaskan di atas. Meski begitu, tidak ada sistem yang
          sepenuhnya kebal — kalau terjadi kebocoran data yang berdampak pada
          penggunanya, kamu akan diberi tahu lewat email akunmu.
        </p>
      </Section>

      <Section title="Anak-anak">
        <p>
          Calorya tidak ditujukan untuk anak di bawah 13 tahun dan tidak
          mengumpulkan data mereka dengan sengaja. Aplikasi pencatat kalori juga
          bukan alat yang tepat untuk anak-anak tanpa pendampingan tenaga
          kesehatan. Kalau kamu orang tua dan menemukan anakmu membuat akun,
          hubungi saya dan akunnya akan dihapus.
        </p>
      </Section>

      <Section title="Bukan nasihat medis">
        <p>
          Angka-angka di Calorya berasal dari catatan mandirimu dan rumus gizi
          umum. Aplikasi ini bukan alat kesehatan dan tidak menggantikan nasihat
          dokter atau ahli gizi. Kalau kamu punya kondisi kesehatan tertentu,
          sedang hamil, atau punya riwayat gangguan makan, bicarakan dulu dengan
          tenaga kesehatan sebelum mengikuti target apa pun dari aplikasi ini.
        </p>
      </Section>

      <Section title="Perubahan kebijakan">
        <p>
          Kalau ada perubahan yang berarti — data baru yang dikumpulkan, atau pihak
          ketiga baru yang terlibat — tanggal di atas akan diperbarui dan
          pemberitahuan ditampilkan di dalam aplikasi sebelum perubahannya berlaku.
        </p>
      </Section>

      <footer className="mt-10 border-t border-ink-800 pt-6 text-sm text-ink-500">
        <p>
          Pertanyaan tentang dokumen ini bisa dikirim ke{' '}
          <a
            href={`mailto:${CONTACT}`}
            className="font-medium text-brand-400 underline underline-offset-4"
          >
            {CONTACT}
          </a>
          .
        </p>
        <p className="mt-4">
          <Link href="/login" className="text-brand-400 underline underline-offset-4">
            Kembali ke Calorya
          </Link>
        </p>
      </footer>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      <div className="space-y-1 text-sm leading-relaxed text-ink-300">{children}</div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span aria-hidden="true" className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-brand-400" />
      <span>{children}</span>
    </li>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="py-2 pr-4 align-bottom text-xs font-semibold tracking-wide text-ink-500 uppercase">
      {children}
    </th>
  );
}

function Row({ what, example, why }: { what: string; example: string; why: string }) {
  return (
    <tr className="border-b border-ink-800 align-top">
      <td className="py-3 pr-4 font-medium text-ink-100">{what}</td>
      <td className="py-3 pr-4 text-ink-500">{example}</td>
      <td className="py-3 text-ink-300">{why}</td>
    </tr>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-brand-400 underline underline-offset-4"
    >
      {children}
    </a>
  );
}
