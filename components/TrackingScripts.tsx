'use client';

import { useEffect } from 'react';
import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { GA_ID, META_PIXEL_ID, IS_PRODUCTION, isTrackingAllowed } from '@/lib/tracking';
import { browserStorage, captureFirstTouchUtm } from '@/lib/utm';

// F-002: GA4 + Meta Pixel, plus capture UTM pertama. Tidak merender apa pun
// di /admin dan /affiliate. Page view saat navigasi client dikirim oleh
// history tracking bawaan vendor (D-6), bukan oleh kode ini.
export default function TrackingScripts() {
  const pathname = usePathname() || '/';
  const searchParams = useSearchParams();
  const allowed = isTrackingAllowed(pathname);

  useEffect(() => {
    if (!allowed) return;
    captureFirstTouchUtm(new URLSearchParams(searchParams?.toString()), pathname, browserStorage(), Date.now());
  }, [allowed, pathname, searchParams]);

  if (!allowed) return null;

  return (
    <>
      {GA_ID && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">{`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}'${IS_PRODUCTION ? '' : ', { debug_mode: true }'});
`}</Script>
        </>
      )}
      {META_PIXEL_ID && (
        <Script id="meta-pixel-init" strategy="afterInteractive">{`
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('set', 'autoConfig', false, '${META_PIXEL_ID}');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');
`}</Script>
      )}
    </>
  );
}
