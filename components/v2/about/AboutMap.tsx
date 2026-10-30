'use client';

import { useEffect, useRef } from 'react';
import { motionOn, whenRevealed } from '@/lib/v2/motion/runtime';

// The draw-in starts once the card top passes 75% of the viewport, the same point as the closing band.
const IN_VIEW = '0px 0px -25% 0px';
// If the curtain never reports itself lifted (runtime error), the route is still drawn this long after it is in view.
const SAFETY_MS = 4000;

type Leg = { key: string; view: string; d: string; box: [number, number, number, number]; fit?: string };

// Each card shows its own stretch of the touring map: a different tile offset and glow (v2-about.css) and its own
// route. Community: the road drops in from the top edge, passes under the large photo and runs out through the gap
// between the photos to the right edge, in the 516 x 499 box of the photo grid at 1440 px; when the photos stack
// below the text, only the stretch through that gap is left, drawn 1:1 and cut at the card width. Contact: the road
// climbs the empty right side of the card from the bottom edge to the top right corner (160 x 337 box at the right
// edge); below 1024 px only a short corner leg is left, above the number. Paths may leave their box; the card clips
// them.
const LEGS: Record<'community' | 'contact', Leg[]> = {
  community: [
    {
      key: 'wide',
      view: '0 0 516 499',
      d: 'M128-230C146-150 200-118 214-56S240 60 270 132S318 262 352 292S420 303 466 302S540 300 570 296S640 280 700 262',
      box: [80, -260, 660, 600],
    },
    {
      key: 'stack',
      view: '0 0 1100 48',
      d: 'M-10 27C60 19 130 17 200 22S330 33 410 28S560 15 640 20S790 32 870 27S1010 17 1110 22',
      box: [-40, -20, 1180, 88],
      fit: 'xMinYMid slice',
    },
  ],
  contact: [
    {
      key: 'wide',
      view: '0 0 160 337',
      d: 'M24 372C22 330 30 300 56 276S110 236 116 196S86 150 92 118S128 70 150 44S176 0 186-30',
      box: [-20, -60, 230, 460],
    },
    {
      key: 'corner',
      view: '0 0 140 140',
      d: 'M40-20C50 16 84 30 104 48S132 78 160 84',
      box: [0, -40, 180, 160],
    },
  ],
};

/**
 * Decorative route map behind a dark card of /tentang (Sehan, 2026-10-29: the closing band background on the Tentang
 * cards, each at a different spot). Contour lines from the shared tile, a warm glow, a dashed kuning route, and on
 * fine pointers a headlight that follows the cursor (lib/v2/motion/cursor.ts sets --mx/--my on the card). The map is
 * complete in the server HTML and aria-hidden; with motion allowed the route is drawn in once when the card scrolls
 * into view and the curtain is up (.iz-amap--armed, then .iz-amap--play). A card already on screen at mount keeps its
 * drawn route, so nothing blinks out in front of the visitor. No loops. The lite motion tier shortens the draw-in to
 * 1 s (v2-about.css, html[data-iz-tier]); the minimal tier counts as reduced motion.
 */
export default function AboutMap({ variant }: { variant: 'community' | 'contact' }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const map = ref.current;
    if (!map || !motionOn() || typeof IntersectionObserver !== 'function') return;
    let revealed = false;
    let inView = false;
    let played = false;
    let safety = 0;
    let io: IntersectionObserver | null = null;
    const play = () => {
      if (played) return;
      played = true;
      window.clearTimeout(safety);
      io?.disconnect();
      map.classList.add('iz-amap--play');
    };
    const stopReveal = whenRevealed(() => {
      revealed = true;
      if (inView) play();
    });
    const box = map.getBoundingClientRect();
    if (revealed && box.top < window.innerHeight && box.bottom > 0) return stopReveal;
    map.classList.add('iz-amap--armed');
    io = new IntersectionObserver(
      entries => {
        inView = entries.some(e => e.isIntersecting);
        if (!inView) return;
        if (revealed) play();
        else if (!safety) safety = window.setTimeout(play, SAFETY_MS);
      },
      { rootMargin: IN_VIEW },
    );
    io.observe(map);
    return () => {
      stopReveal();
      io?.disconnect();
      window.clearTimeout(safety);
      map.classList.remove('iz-amap--armed', 'iz-amap--play');
    };
  }, []);

  return (
    <div ref={ref} className={`iz-amap iz-amap--${variant}`} aria-hidden="true">
      <div className="iz-amap__topo">
        <span className="iz-amap__glow" />
        <span className="iz-amap__lamp" />
      </div>
      {LEGS[variant].map(leg => {
        // One map per card and one card per variant on the page, so the mask ids can be fixed.
        const mask = `iz-amap-${variant}-${leg.key}`;
        const [x, y, width, height] = leg.box;
        return (
          <svg
            key={leg.key}
            className={`iz-amap__trail iz-amap__trail--${leg.key}`}
            viewBox={leg.view}
            preserveAspectRatio={leg.fit}
            focusable="false"
          >
            <mask id={mask} maskUnits="userSpaceOnUse" x={x} y={y} width={width} height={height}>
              <path className="iz-amap__reveal" d={leg.d} pathLength={1} />
            </mask>
            <path className="iz-amap__road" d={leg.d} mask={`url(#${mask})`} />
          </svg>
        );
      })}
    </div>
  );
}
