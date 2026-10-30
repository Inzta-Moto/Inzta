'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { loadMotion, motionOn } from '@/lib/v2/motion/runtime';

/**
 * Frame of "Pesan dalam tiga langkah" (F-016 S1.10). The steps and their scenes are complete in the server HTML; this
 * component only drives them, so without JavaScript, when the motion runtime fails, or with reduced motion nothing is
 * hidden or moving; the minimal motion tier (reduced motion or Save-Data) counts as reduced. data-scene="howto" tells the page engine to leave the steps to this component (the engine still
 * reveals the heading and the eyebrow). The journey itself (desktop pin, phone reveals, scene timelines) lives in
 * howto-motion.ts, loaded next to the shared GSAP chunk so neither is in the route's first-load JS.
 */
export default function HowToStage({ className, children }: { className: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || !motionOn()) return;
    // React Strict Mode mounts, cleans up and mounts again in development: the first mount's promise resolves after
    // its cleanup and must not attach, or the section would get two pins.
    let disposed = false;
    let detach: (() => void) | null = null;
    Promise.all([loadMotion(), import('@/components/v2/home/howto-motion')])
      .then(([kit, motion]) => {
        if (!disposed) detach = motion.attachHowTo(root, kit);
      })
      .catch(() => {
        // The static section stays; the shared runtime already handles a failed chunk on the next navigation.
      });
    return () => {
      disposed = true;
      detach?.();
      detach = null;
    };
  }, []);

  return (
    <div ref={ref} className={className} data-scene="howto">
      {children}
    </div>
  );
}
