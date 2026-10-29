'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { PHOTOS } from '@/lib/v2/home-content';
import { PHOTO_QUALITY } from '@/lib/v2/image';

// F-016 S1.1.1, S1.1.4, S0.12.7: the LCP photo stays a next/image with priority (preloaded, eager, no shimmer). When it
// fails, the image is hidden so the browser's broken-image icon never shows; the hero's --c-aspal background is the
// dark fallback under the text. A failure before hydration fires no React event, so the mounted state is read once.
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
      className="iz-hero__img"
      src={PHOTOS.hero}
      alt="Rider petualang Indonesia di jalur gunung"
      fill
      priority
      sizes="100vw"
      quality={PHOTO_QUALITY}
      data-parallax=""
      data-failed={failed ? 'true' : undefined}
      onError={() => setFailed(true)}
    />
  );
}
