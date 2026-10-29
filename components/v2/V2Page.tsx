import type { ReactNode } from 'react';
import '@/app/(v2)/v2-tokens.css';
import '@/app/(v2)/v2-components.css';
import '@/app/(v2)/v2-overrides.css';
import '@/app/(v2)/v2-ui.css';
import { fontDisplay, fontSans } from '@/components/v2/fonts';
import { MotorCategoryProvider } from '@/components/v2/MotorCategory';

// Without JavaScript the image load event never reaches React, so the shimmer layer would cover the photo (S0.12).
const NOSCRIPT_STYLE = '<style>.iz-smartimg > .iz-skel { display: none; }</style>';

// Wrapper for every v2 page (F-016 2.1, 3.2): the v2 CSS and fonts load only through this component, so pages that
// do not render it (blog, article, product, admin) keep their current styles.
export default function V2Page({ children }: { children: ReactNode }) {
  return (
    <div className={`iz-page ${fontDisplay.variable} ${fontSans.variable}`} data-theme="light">
      <noscript dangerouslySetInnerHTML={{ __html: NOSCRIPT_STYLE }} />
      <a className="iz-skip" href="#isi">Langsung ke isi</a>
      <MotorCategoryProvider>{children}</MotorCategoryProvider>
    </div>
  );
}
