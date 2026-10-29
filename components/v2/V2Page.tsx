import type { ReactNode } from 'react';
import '@/app/(v2)/v2-tokens.css';
import '@/app/(v2)/v2-components.css';
import '@/app/(v2)/v2-overrides.css';
import { fontDisplay, fontSans } from '@/components/v2/fonts';
import { MotorCategoryProvider } from '@/components/v2/MotorCategory';

// Wrapper for every v2 page (F-016 2.1, 3.2): the v2 CSS and fonts load only through this component, so pages that
// do not render it (blog, article, product, admin) keep their current styles.
export default function V2Page({ children }: { children: ReactNode }) {
  return (
    <div className={`iz-page ${fontDisplay.variable} ${fontSans.variable}`} data-theme="light">
      <a className="iz-skip" href="#isi">Langsung ke isi</a>
      <MotorCategoryProvider>{children}</MotorCategoryProvider>
    </div>
  );
}
