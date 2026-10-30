'use client';

import { useEffect, useState } from 'react';
import { motionTier } from '@/lib/v2/motion/runtime';

// Button label split into letters for the hover bounce (SiteMotion onPointer, after Sehan's BookMate buttons). The
// server HTML carries the plain label, so crawlers and the link text read it once (review REV-06); after mount
// React renders the letters itself, so a label that changes (the Garasi button follows the chosen motor) re-renders
// cleanly and GSAP only ever touches their transforms. Word gaps come from CSS margins because whitespace between
// inline-blocks of a flex label would collapse. In the lite motion tier the label splits into words only and the
// bounce runs per word: fewer elements to tween on every hover. The split is picked once, at mount: re-rendering a
// label already on screen when the frame probe lowers the tier would change its width mid-session; the next route
// mounts its labels again and picks up lite then (SiteMotion onPointer handles both kinds).
export default function Bounce({ text }: { text: string }) {
  const [split, setSplit] = useState<'none' | 'chars' | 'words'>('none');
  useEffect(() => {
    setSplit(motionTier() === 'lite' ? 'words' : 'chars');
  }, []);
  if (split === 'none') return <>{text}</>;
  const words = text.split(' ');
  return (
    <>
      <span className="iz-sr">{text}</span>
      <span className="iz-bounce" aria-hidden="true">
        {words.map((word, w) => (
          <span className="iz-bounce__w" key={`${word}-${w}`}>
            {split === 'words'
              ? word
              : Array.from(word).map((char, c) => (
                  <span className="iz-bounce__c" key={c}>
                    {char}
                  </span>
                ))}
          </span>
        ))}
      </span>
    </>
  );
}
