'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { HIRES } from '@/lib/v2/home-content';
import { PHOTO_QUALITY } from '@/lib/v2/image';

// F-016 S1.1.1, S1.1.4, S0.12.7: the LCP photo stays a next/image with priority (preloaded, eager, no shimmer). When it
// fails, the image is hidden so the browser's broken-image icon never shows; the hero's --c-aspal background is the
// dark fallback under the text. A failure before hydration fires no React event, so the mounted state is read once.
// Below 1024 px the 4:3 photo covers a tall box, so it renders much wider than the viewport (390 x 844: about 290vw;
// tablets about 200vw); with sizes="100vw" the browser fetched 828 px and enlarged it about 2.7 times (soft on phones).
const HERO_SIZES = '(max-width: 767px) 290vw, (max-width: 1023px) 200vw, 100vw';

export default function HeroImage() {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  return (
    <Image
      ref={ref}
      className="iz-hero__img iz-hero__img--home"
      src={HIRES.hero99}
      alt="Rider berjaket INZTAMOTO di atas Yamaha XSR dengan tas kuning INZTA di jalan tanah berdebu"
      fill
      priority
      sizes={HERO_SIZES}
      quality={PHOTO_QUALITY}
      data-parallax=""
      data-failed={failed ? 'true' : undefined}
      onError={() => setFailed(true)}
    />
  );
}
