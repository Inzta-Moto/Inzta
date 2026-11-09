import type { ReactNode } from 'react';
import '@/app/(v2)/v2-tokens.css';
import '@/app/(v2)/v2-components.css';
import '@/app/(v2)/v2-overrides.css';
import '@/app/affiliate/affiliate.css';
import { fontDisplay, fontSans } from '@/components/v2/fonts';

/**
 * Frame of every affiliate page (F-023 D-4, D-9), login and dashboard alike. The v2 tokens, reset, and fonts are bound
 * to .iz-page, so the shell loads only the base v2 files (tokens, the ported reset and components, the black-tone and
 * font overrides) plus affiliate.css, not the shop's page CSS; same approach as the admin SidePreview. Light theme only.
 * No header here: on the dashboard the header sits inside the dark band (E7), on login inside the photo panel.
 */
export default function AffiliateShell({ children }: { children: ReactNode }) {
  return (
    <div className={`iz-page iz-aff ${fontDisplay.variable} ${fontSans.variable}`} data-theme="light">
      {children}
    </div>
  );
}
