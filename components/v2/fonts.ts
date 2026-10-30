import { Bricolage_Grotesque, Figtree } from 'next/font/google';

// Self-hosted at build, no runtime request to Google (F-016 3.1). Bricolage is loaded as the variable font: Next 14.2
// rejects `axes` together with fixed weights, and the CSS only uses 700 and 800.
export const fontDisplay = Bricolage_Grotesque({
  subsets: ['latin'],
  display: 'swap',
  axes: ['opsz'],
  variable: '--font-display-v2',
});

export const fontSans = Figtree({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans-v2',
});
