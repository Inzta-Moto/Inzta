'use client';

import { useEffect, useState } from 'react';
import { READING_EVENT } from './ReadingProgress';

// F-017: "Waktu baca" in the left rail, turned into the time left once ReadingProgress reports a position. Without
// JavaScript or under reduced motion (no progress events) the server text stays.
export default function ReadingLeft({ minutes }: { minutes: number }) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const on = (e: Event) => {
      const p = (e as CustomEvent<number>).detail;
      setLeft(p >= 0.99 ? 0 : Math.max(1, Math.ceil(minutes * (1 - p))));
    };
    window.addEventListener(READING_EVENT, on);
    return () => window.removeEventListener(READING_EVENT, on);
  }, [minutes]);

  const text = left === null || left >= minutes ? `Waktu baca: ${minutes} menit` : left === 0 ? 'Selesai dibaca' : `Sisa sekitar ${left} menit`;
  return (
    <p className="iz-readleft">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
      {text}
    </p>
  );
}
