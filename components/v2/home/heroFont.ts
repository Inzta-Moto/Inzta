import { Inter } from 'next/font/google';

// The Beranda hero headline goes back to the first site's type (Inter 800, uppercase; owner via Bang Raja,
// 2026-11-11). Kept in its own module, imported only by the hero, so the font is preloaded on Beranda alone.
export const fontHero = Inter({
  subsets: ['latin'],
  display: 'swap',
  weight: '800',
  variable: '--font-hero-v2',
});
