'use client';

import { useEffect, useRef } from 'react';

// Marks the v2 page as hydrated. The page sits inside a Suspense boundary (loading.tsx) and hydrates after the root
// layout where SiteMotion lives; SiteMotion waits for this mark, because splitting text or setting transforms on
// server HTML that React has not hydrated yet makes React discard that HTML and render the page again.
export default function PageReady() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const page = ref.current?.closest('.iz-page');
    if (!page) return;
    page.setAttribute('data-iz-ready', '');
    window.dispatchEvent(new Event('iz:page-ready'));
  }, []);

  return <span ref={ref} hidden />;
}
