export const metadata = { title: 'Offline — Calorya' };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-6 text-center">
      <p className="text-4xl" aria-hidden="true">
        📡
      </p>
      <h1 className="mt-4 text-xl font-semibold">Kamu sedang offline</h1>
      <p className="mt-2 text-sm text-ink-500">
        Halaman ini belum tersimpan di perangkatmu. Data yang sudah pernah dibuka tetap
        bisa dilihat — coba kembali ke beranda.
      </p>
      <a
        href="/dashboard"
        className="mt-6 rounded-xl bg-brand-500 px-5 py-2.5 font-medium text-ink-950"
      >
        Ke beranda
      </a>
    </main>
  );
}
