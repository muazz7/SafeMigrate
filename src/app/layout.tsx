import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { AppShell } from '@/components/AppShell';
import './globals.css';

/**
 * Fonts are self-hosted, never fetched from Google's CDN (BUILD-SPEC §3):
 * the APK must render Bangla with no network at all.
 */
const notoBengali = localFont({
  src: '../../public/fonts/NotoSansBengali-Variable.woff2',
  variable: '--font-noto-bengali',
  weight: '400 600',
  display: 'swap',
  preload: true,
});

const inter = localFont({
  src: '../../public/fonts/Inter-Variable.woff2',
  variable: '--font-inter',
  weight: '400 600',
  display: 'swap',
  preload: true,
});

export const metadata: Metadata = {
  title: 'নিরাপদ প্রবাস — SafeMigrate',
  description:
    'Check a foreign employment contract, verify a recruiting agency licence, and compare migration costs before you sign or pay.',
  manifest: '/manifest.json',
  applicationName: 'SafeMigrate',
  appleWebApp: { capable: true, title: 'নিরাপদ প্রবাস' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#0F6B4F',
  width: 'device-width',
  initialScale: 1,
  // The app is designed for 360px. Pinch-zoom stays enabled: disabling it would
  // fail accessibility for users who need to magnify Bangla text.
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn" className={`${notoBengali.variable} ${inter.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
