'use client';

import { useEffect, useRef } from 'react';

type Page = 'home' | 'about';

// If GSAP arrives later than this after mount, the hero has been on screen too long to replay its entrance.
const HERO_ENTRANCE_WINDOW_MS = 900;
const EASE = 'power3.out';

function idle(cb: () => void): () => void {
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(cb, { timeout: 1200 });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(cb, 200);
  return () => clearTimeout(id);
}

// Elements already in view when motion starts stay as they are: hiding them now would make them blink.
const belowFold = (el: Element) => el.getBoundingClientRect().top > window.innerHeight * 0.85;

// Scroll motion for the Beranda and /tentang (F-016 D7, design.md §8, S1.*, S8.8). GSAP and ScrollTrigger load as
// separate chunks after the page is idle, so they are never in the first-load JS. Every from-state is set by GSAP
// only after both modules resolve and html.js-motion is added at that moment; if the import fails nothing is ever
// hidden (S8.8.6, VF-06). Only transform, opacity, clip-path and scrollLeft are animated. The three matchMedia
// contexts revert on unmount, so client navigation leaves no ScrollTrigger behind (S8.8.7).
export default function PageMotion({ page }: { page: Page }) {
  const mountedAt = useRef(0);

  useEffect(() => {
    mountedAt.current = performance.now();
    let revert: (() => void) | null = null;
    let cancelled = false;

    const cancelIdle = idle(async () => {
      let gsap: typeof import('gsap').gsap;
      let ScrollTrigger: typeof import('gsap/ScrollTrigger').ScrollTrigger;
      try {
        const [g, st] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
        gsap = g.gsap;
        ScrollTrigger = st.ScrollTrigger;
      } catch (error) {
        console.warn('[motion] GSAP failed to load; the page stays static.', error);
        return;
      }
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      document.documentElement.classList.add('js-motion');
      const late = performance.now() - mountedAt.current > HERO_ENTRANCE_WINDOW_MS;

      const mm = gsap.matchMedia();
      mm.add(
        {
          desktop: '(min-width: 1024px) and (prefers-reduced-motion: no-preference)',
          mobile: '(max-width: 1023px) and (prefers-reduced-motion: no-preference)',
        },
        ctx => {
          const { desktop } = ctx.conditions as { desktop: boolean; mobile: boolean };
          const inPin = (el: Element) => desktop && !!el.closest('[data-motion="tourmax"]');
          const noMobileGsap = (el: Element) => !desktop && page === 'about' && !el.closest('.iz-why');
          const once = (trigger: Element) => ({ trigger, start: 'top 85%', once: true });
          const cleanups: (() => void)[] = [];

          // Hero: heading, lead and buttons rise on first load; the photo drifts while the hero leaves (S1.1).
          const hero = document.querySelector('[data-motion="hero"]');
          if (hero && !late && window.scrollY < 40) {
            const parts = hero.querySelectorAll('[data-reveal-lines], [data-reveal]');
            const entrance = gsap.from(parts, { y: desktop ? 24 : 16, opacity: 0, duration: 0.7, ease: EASE, stagger: 0.08 });
            // A tab that paints no frames (prerender, occluded window) would keep the H1 hidden; finish it instead.
            const safety = setTimeout(() => entrance.progress(1), 2500);
            cleanups.push(() => clearTimeout(safety));
          }
          if (hero && desktop) {
            const img = hero.querySelector('img');
            if (img) gsap.to(img, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
          }

          // Staggered groups: tiles and cards (S1.2, S1.3, S1.5, S1.8, S1.9, S8.2, S8.4).
          document.querySelectorAll('[data-reveal-stagger]').forEach(group => {
            if (group.closest('[data-motion="hero"]') || inPin(group) || noMobileGsap(group) || !belowFold(group)) return;
            const items = Array.from(group.children);
            if (!items.length) return;
            const isCards = !!group.querySelector('.iz-pcard') || group.classList.contains('iz-guides') || group.classList.contains('iz-reviews');
            gsap.from(items, {
              y: desktop ? (isCards ? 24 : 32) : 0,
              opacity: 0,
              duration: 0.6,
              ease: EASE,
              stagger: page === 'about' && group.classList.contains('iz-why__list') ? 0.08 : 0.06,
              scrollTrigger: once(group),
            });
          });

          // Photo panels open from the bottom on desktop and fade on phones (S1.4, S8.3).
          document.querySelectorAll('[data-reveal-clip]').forEach(el => {
            if (!belowFold(el)) return;
            gsap.from(el, desktop
              ? { clipPath: 'inset(100% 0 0 0)', duration: 0.8, ease: EASE, scrollTrigger: once(el) }
              : { opacity: 0, duration: 0.6, ease: EASE, scrollTrigger: once(el) });
          });

          // Section headings and single blocks outside the hero.
          document.querySelectorAll('[data-reveal-lines], [data-reveal]').forEach(el => {
            if (el.closest('[data-motion="hero"]') || inPin(el) || noMobileGsap(el) || !belowFold(el)) return;
            gsap.from(el, { y: desktop ? 16 : 0, opacity: 0, duration: 0.6, ease: EASE, scrollTrigger: once(el) });
          });

          // How to order: steps rise one after another (S1.10).
          document.querySelectorAll('[data-motion="howto"]').forEach(list => {
            if (!belowFold(list)) return;
            gsap.from(list.children, { y: desktop ? 24 : 0, opacity: 0, duration: 0.6, ease: EASE, stagger: 0.08, scrollTrigger: once(list) });
          });

          // Tourmax: pinned for 150% of the viewport, photo settles, notes one by one, price and button last (S1.6).
          // Nothing focusable is hidden for long: the scrub follows scroll, and Tab scrolls the page past the pin.
          const band = document.querySelector('[data-motion="tourmax"]');
          if (band && desktop) {
            const tl = gsap.timeline({ scrollTrigger: { trigger: band, start: 'top top', end: '+=150%', pin: true, scrub: 0.6 } });
            const img = band.querySelector('img');
            if (img) tl.fromTo(img, { scale: 1.06 }, { scale: 1, ease: 'none', duration: 1 }, 0);
            const notes = band.querySelectorAll('.iz-note');
            tl.from(notes, { y: 24, opacity: 0, stagger: 0.25, duration: 0.4, ease: EASE }, 0.1);
            const foot = band.querySelector('.iz-band__foot');
            if (foot) tl.from(foot, { y: 16, opacity: 0, duration: 0.3, ease: EASE }, '>');
          }
          // On phones the notes (data-reveal-stagger) and the price row (data-reveal) already fade through the generic
          // loops above; a second from() on the same elements would capture opacity 0 as its end state (QA, ≤1023 px).

          // Filmstrip: on desktop, scroll position follows the page while the strip passes, only when it overflows.
          // It stays a native, focusable scroll region, so keys and swipe still work (S1.7).
          if (desktop) {
            document.querySelectorAll<HTMLElement>('[data-motion="film"]').forEach(film => {
              const max = film.scrollWidth - film.clientWidth;
              if (max <= 0) return;
              gsap.fromTo(film, { scrollLeft: 0 }, { scrollLeft: max, ease: 'none', scrollTrigger: { trigger: film, start: 'top 85%', end: 'bottom 15%', scrub: true } });
            });
          }
          return () => cleanups.forEach(fn => fn());
        },
      );

      // Fonts and lazy images change heights after load; pinned and scrubbed ranges must be measured again.
      document.fonts?.ready.then(() => ScrollTrigger.refresh()).catch(() => {});
      const onLoad = () => ScrollTrigger.refresh();
      window.addEventListener('load', onLoad);

      revert = () => {
        window.removeEventListener('load', onLoad);
        mm.revert();
        document.documentElement.classList.remove('js-motion');
      };
    });

    return () => {
      cancelled = true;
      cancelIdle();
      revert?.();
    };
  }, [page]);

  return null;
}
