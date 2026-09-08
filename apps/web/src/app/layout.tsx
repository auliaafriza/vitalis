import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/providers';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import './globals.css';

export const metadata: Metadata = {
  title: 'Calorya — Pelacak Kesehatan & Nutrisi Harian',
  description:
    'Catat makanan, air, tidur, langkah, dan berat badan dalam satu tempat. Bisa dipasang di layar utama dan tetap bisa dibuka saat offline.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Calorya',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  // Two entries so the browser chrome matches the theme the user is actually
  // in — a cream address bar above a dark app looks broken.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f4ee' },
    { media: '(prefers-color-scheme: dark)', color: '#0d1117' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {/* Blocking on purpose: it must win the race with the first paint. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
