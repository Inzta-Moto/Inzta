'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import 'lenis/dist/lenis.css';
import '@/app/(v2)/v2-motion.css';
import { fontDisplay } from '@/components/v2/fonts';
import { CURTAIN_ATTR, isMotionRoute } from '@/lib/v2/motion/boot';
import { FULL, cover, framesSettled, lift, pageReady, pageSettled } from '@/lib/v2/motion/curtain';
import { initCursor } from '@/lib/v2/motion/cursor';
import { initPage, type PageMode, type PageMotion } from '@/lib/v2/motion/engine';
import { routeLabel, samePage, transitionTarget } from '@/lib/v2/motion/links';
import { HOVER, MOTION_OK, jumpTo, loadMotion, markCovered, markRevealed, setLenis, type MotionKit } from '@/lib/v2/motion/runtime';

const WORD = 'INZTA';
// A route that never arrives (network error, redirect elsewhere) still lifts the curtain after this long.
const ROUTE_SAFETY_MS = 8000;

const modeFor = (pathname: string): PageMode => (pathname === '/produk' || pathname.startsWith('/produk/') ? 'light' : 'full');

// The GSAP chunks start downloading as soon as this module runs, while React is still hydrating, instead of after
// the first effect; the load curtain lifts sooner. Admin routes and reduced-motion visitors download nothing.
if (typeof window !== 'undefined' && isMotionRoute(window.location.pathname) && window.matchMedia(MOTION_OK).matches) {
  void loadMotion().catch(() => undefined);
  void import('lenis').catch(() => undefined);
}

// The page to animate: a hydrated v2 page (PageReady), not the loading skeleton (LoadingV2 renders .iz-loading).
function readyRoot(): HTMLElement | null {
  const root = document.querySelector<HTMLElement>('.iz-page[data-iz-ready]');
  return root && !root.querySelector('.iz-loading') ? root : null;
}

type Controller = { routeChanged: (pathname: string) => void; dispose: () => void };

function createController(curtain: HTMLDivElement, push: (href: string) => void, prefetch: (href: string) => void): Controller {
  let kit: MotionKit | null = null;
  let revert: PageMotion | null = null;
  let committed = window.location.pathname;
  let stale = true;
  let busy = false;
  let waiter: ((root: HTMLElement | null) => void) | null = null;
  // Pathname at the moment a covered navigation pushed; the waiter only accepts a page once the route has moved on.
  let leaving: string | null = null;
  let disposeLenis: (() => void) | null = null;
  let disposeCursor: (() => void) | null = null;
  let frame = 0;
  // React Strict Mode mounts, disposes and mounts again in development; async steps of a disposed controller must
  // stop, or its engine and Lenis outlive it and the page gets two pins on one section.
  let disposed = false;
  const bouncing = new WeakSet<Element>();
  const motionOk = () => window.matchMedia(MOTION_OK).matches;
  const html = document.documentElement;
  const word = curtain.querySelector<HTMLElement>('[data-curtain-word]');
  const label = curtain.querySelector<HTMLElement>('[data-curtain-label]');

  function attach(root: HTMLElement) {
    if (disposed) return;
    revert?.();
    revert = null;
    stale = false;
    if (!kit || !motionOk()) return;
    html.classList.add('iz-motion');
    revert = initPage(root, kit, modeFor(committed));
  }

  function detach() {
    revert?.();
    revert = null;
    html.classList.remove('iz-motion');
  }

  // Runs after every DOM change (debounced by a timer, which also fires in a hidden tab): hands a fresh page to a waiting transition, or attaches the
  // engine to a page that arrived without one (back/forward, a skeleton replaced by the real page).
  function check() {
    frame = 0;
    const root = readyRoot();
    if (!root || !stale) return;
    if (waiter) {
      if (committed === leaving) return;
      const resolve = waiter;
      waiter = null;
      resolve(root);
    } else if (!busy) {
      attach(root);
      kit?.ScrollTrigger.refresh();
    }
  }
  const schedule = () => {
    if (stale && !frame) frame = window.setTimeout(check, 16);
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('iz:page-ready', schedule);

  async function startLenis() {
    if (disposeLenis || !kit || !motionOk()) return;
    const { default: Lenis } = await import('lenis');
    if (disposeLenis || !kit || disposed) return;
    const { gsap, ScrollTrigger } = kit;
    // Weighted scroll, the same both ways (Sehan, 2026-10-29). Duration mode restarted its 1.35 s ease on every wheel
    // notch, so a run of notches downward piled up and felt fast; a low lerp is plain inertia toward the target, which
    // feels equally heavy up and down, and each notch travels a little less.
    // allowNestedScroll stays off: it handed every downward wheel to <body>, which globals.css turns into an overflow
    // box (overflow-x: hidden makes overflow-y auto) 4 px taller than its content, so scrolling down was native and
    // only scrolling up was smoothed (Sehan: heavy only upward, stutter, smooth only after waiting; probe in QA).
    // Panels that scroll on their own carry data-lenis-prevent instead (phone menu, catalogue filter sheet, TOC).
    const lenis = new Lenis({ lerp: 0.065, wheelMultiplier: 0.8, touchMultiplier: 1, smoothWheel: true, anchors: true, stopInertiaOnNavigate: true });
    lenis.on('scroll', ScrollTrigger.update);
    // Page progress along the top edge (v2-motion.css .iz-readline). Its own class: .iz-progress is the article's
    // reading bar (S7.7), which the shared name hid by scaling its container to zero.
    const bar = document.createElement('div');
    bar.className = 'iz-readline';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    const onProgress = (l: { progress: number }) => {
      bar.style.transform = `scaleX(${Math.min(1, Math.max(0, l.progress || 0)).toFixed(4)})`;
    };
    lenis.on('scroll', onProgress);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    // Pins add spacers on refresh; Lenis caches the scroll limit, so it measures again with them.
    const resize = () => lenis.resize();
    ScrollTrigger.addEventListener('refresh', resize);
    setLenis(lenis);
    // Dev-only handle for the Browser pane QA (drive scroll and the ticker when the pane is hidden); the NODE_ENV
    // check is replaced at build time, so production bundles drop it.
    if (process.env.NODE_ENV === 'development') Object.assign(window, { __izMotion: { gsap, ScrollTrigger, lenis } });
    disposeLenis = () => {
      ScrollTrigger.removeEventListener('refresh', resize);
      gsap.ticker.remove(tick);
      lenis.destroy();
      bar.remove();
      setLenis(null);
      disposeLenis = null;
    };
  }

  function endCurtain() {
    html.removeAttribute(CURTAIN_ATTR);
    curtain.removeAttribute('data-active');
  }

  async function boot() {
    // Lenis downloads alongside GSAP instead of after it, so the load curtain is not held by two chunk round trips.
    void import('lenis');
    try {
      kit = await loadMotion();
    } catch {
      endCurtain();
      markRevealed();
      return;
    }
    if (disposed) return;
    await startLenis();
    if (disposed) return;
    disposeCursor = initCursor(kit);
    const root = readyRoot();
    if (root) attach(root);
    if (html.getAttribute(CURTAIN_ATTR) === 'load') {
      // Only the hold on the logo is short (Sehan, 2026-10-29); the sheets keep their original pace.
      await pageSettled(250, 1100);
      if (disposed) return;
      await lift(kit, curtain, markRevealed);
      endCurtain();
    }
    markRevealed();
    kit.ScrollTrigger.refresh();
  }

  function waitForPage(): Promise<HTMLElement | null> {
    return new Promise(resolve => {
      const timer = window.setTimeout(() => {
        waiter = null;
        resolve(readyRoot());
      }, ROUTE_SAFETY_MS);
      waiter = root => {
        window.clearTimeout(timer);
        resolve(root);
      };
      if (!frame) frame = window.setTimeout(check, 16);
    });
  }

  async function navigate(url: URL, text: string | undefined) {
    if (!kit) return;
    busy = true;
    // Whatever happens below (a malformed hash, a failed route), the curtain comes down and the page stays usable
    // (review REV-05).
    try {
      await travel(url, text, kit);
    } catch (error) {
      console.warn('[motion] route transition failed', error);
      markRevealed();
    } finally {
      leaving = null;
      html.removeAttribute('data-iz-covered');
      curtain.removeAttribute('data-active');
      if (word) word.hidden = false;
      if (label) label.hidden = true;
      busy = false;
    }
  }

  async function travel(url: URL, text: string | undefined, kit: MotionKit) {
    const href = url.pathname + url.search + url.hash;
    prefetch(href);
    markCovered();
    if (word) word.hidden = true;
    if (label) {
      label.hidden = false;
      label.textContent = text?.trim() || routeLabel(url.pathname, url.search);
    }
    curtain.setAttribute('data-active', '');
    // The scrollbar is hidden while covered; its lane stays reserved (scrollbar-gutter in v2-motion.css), so the page
    // width never changes. Lenis is not stopped: its stop() clips overflow, which removed the scrollbar and reflowed
    // the page right as the curtain lifted (the stutter Sehan saw on every route change).
    html.setAttribute('data-iz-covered', '');
    await cover(kit, curtain);
    // The old page leaves while covered, so none of its pins or splits outlive it.
    detach();
    stale = true;
    leaving = committed;
    push(href);
    const root = await waitForPage();
    leaving = null;
    let target: HTMLElement | null = null;
    try {
      target = url.hash ? document.getElementById(decodeURIComponent(url.hash.slice(1))) : null;
    } catch {
      target = null;
    }
    jumpTo(target ?? 0);
    // Shorter waits than before: the label is not meant to be read twice (Sehan, 2026-10-29: the hold on the curtain
    // text felt long). The engine only sets up the first screen now, so the page is ready sooner anyway.
    await pageReady(root, 500);
    if (root) attach(root);
    kit.ScrollTrigger.refresh();
    await framesSettled(60, 360);
    await lift(kit, curtain, markRevealed);
  }

  // Covers the page with the load curtain (logo and INZTA), goes back to the top, rebuilds the hero entrance so it
  // plays again, and lifts. The rest of the page keeps its motion; rebuilding all of it held the logo for seconds.
  async function replay() {
    if (!kit) return;
    busy = true;
    markCovered();
    if (word) word.hidden = false;
    if (label) label.hidden = true;
    curtain.setAttribute('data-active', '');
    html.setAttribute('data-iz-covered', '');
    try {
      await cover(kit, curtain);
      jumpTo(0);
      const root = readyRoot();
      if (revert) revert.intro();
      else if (root) attach(root);
      await framesSettled(60, 300);
      await lift(kit, curtain, markRevealed);
    } catch (error) {
      console.warn('[motion] intro replay failed', error);
      markRevealed();
    } finally {
      html.removeAttribute('data-iz-covered');
      curtain.removeAttribute('data-active');
      busy = false;
    }
  }

  function onClick(e: MouseEvent) {
    if (!kit || !motionOk() || !document.querySelector('.iz-page')) return;
    const a = (e.target as Element | null)?.closest?.('a');
    if (!a) return;
    const click = {
      target: a.getAttribute('target'),
      download: a.hasAttribute('download'),
      button: e.button,
      modified: e.metaKey || e.ctrlKey || e.shiftKey || e.altKey,
      optOut: a.dataset.transition === 'off',
      defaultPrevented: e.defaultPrevented,
    };
    const url = transitionTarget(
      {
        href: a.getAttribute('href'),
        target: a.getAttribute('target'),
        download: a.hasAttribute('download'),
        button: e.button,
        modified: e.metaKey || e.ctrlKey || e.shiftKey || e.altKey,
        optOut: a.dataset.transition === 'off',
        defaultPrevented: e.defaultPrevented,
      },
      new URL(window.location.href),
    );
    if (!url) {
      // The link points at this very page (the logo on the Beranda): replay the intro like a refresh (Sehan).
      if (!busy && samePage({ ...click, href: a.getAttribute('href') }, new URL(window.location.href))) {
        e.preventDefault();
        void replay();
      }
      return;
    }
    // A second click while the curtain runs is swallowed; reaching next/link it started a parallel navigation that
    // held the curtain for seconds (review REV-03).
    if (busy) {
      e.preventDefault();
      return;
    }
    // Captured before React sees the click: next/link skips its own navigation once the default is prevented, and
    // the link's own onClick (closing a menu, saving the motor category) still runs.
    e.preventDefault();
    void navigate(url, a.dataset.transitionLabel);
  }

  // Hovering or touching an internal link prefetches its route, so it is usually ready when the curtain has covered
  // the page and the transition is shorter.
  const warmed = new Set<string>();
  function warm(target: EventTarget | null) {
    const a = (target as Element | null)?.closest?.('a');
    const href = a?.getAttribute('href');
    if (!a || !href || warmed.has(href) || a.target === '_blank') return;
    const url = transitionTarget({ href, target: null, download: false, button: 0, modified: false, optOut: false, defaultPrevented: false }, new URL(window.location.href));
    if (!url) return;
    warmed.add(href);
    prefetch(url.pathname + url.search);
  }

  // Button hover (after BookMate): letters of a <Bounce> label drop, squash and spring back; outline buttons flood
  // from the point the pointer came in (CSS reads --fx/--fy).
  function onPointer(e: PointerEvent) {
    if (e.type === 'pointerover') warm(e.target);
    if (e.pointerType !== 'mouse' || !window.matchMedia(HOVER).matches) return;
    const btn = (e.target as Element | null)?.closest?.('.iz-page .iz-btn, .iz-page .iz-nav__cta, .iz-page .iz-footer__shops a');
    if (!btn || (e.relatedTarget instanceof Node && btn.contains(e.relatedTarget))) return;
    const box = btn.getBoundingClientRect();
    (btn as HTMLElement).style.setProperty('--fx', `${((e.clientX - box.left) / box.width) * 100}%`);
    (btn as HTMLElement).style.setProperty('--fy', `${((e.clientY - box.top) / box.height) * 100}%`);
    if (e.type !== 'pointerover' || !kit || bouncing.has(btn)) return;
    const chars = btn.querySelectorAll('.iz-bounce__c');
    if (!chars.length) return;
    bouncing.add(btn);
    kit.gsap.to(chars, {
      keyframes: {
        '0%': { yPercent: 0, scaleY: 1, rotate: 0 },
        '22%': { yPercent: 40, scaleY: 0.5, rotate: 10, ease: 'power2.in' },
        '100%': { yPercent: 0, scaleY: 1, rotate: 0, ease: 'elastic.out(1, 0.5)' },
      },
      duration: 0.75,
      stagger: { amount: 0.22 },
      onComplete: () => {
        bouncing.delete(btn);
      },
    });
  }

  // Phone menu and navbar buttons answer a tap (Sehan, 2026-10-29: the sheet looked flat): the press point becomes
  // --fx/--fy and data-press runs a short CSS flood that finishes even when the finger lifts at once (:active alone
  // lasts one frame on a quick tap). The attribute clears itself for the next tap.
  const pressed = new WeakMap<Element, number>();
  function onPress(e: PointerEvent) {
    if (!motionOk()) return;
    const btn = (e.target as Element | null)?.closest?.('.iz-msheet a, .iz-msheet button, .iz-nav__menu, .iz-motorchip');
    if (!(btn instanceof HTMLElement)) return;
    const box = btn.getBoundingClientRect();
    btn.style.setProperty('--fx', `${((e.clientX - box.left) / box.width) * 100}%`);
    btn.style.setProperty('--fy', `${((e.clientY - box.top) / box.height) * 100}%`);
    window.clearTimeout(pressed.get(btn));
    btn.removeAttribute('data-press');
    // A forced reflow restarts the CSS animation on a second tap in a row.
    void btn.offsetWidth;
    btn.setAttribute('data-press', '');
    pressed.set(btn, window.setTimeout(() => btn.removeAttribute('data-press'), 700));
  }

  document.addEventListener('click', onClick, true);
  document.addEventListener('pointerover', onPointer);
  document.addEventListener('pointerdown', onPress, { passive: true });
  const onTouch = (e: TouchEvent) => warm(e.target);
  document.addEventListener('touchstart', onTouch, { passive: true });
  document.addEventListener('pointerout', onPointer);
  void boot();

  return {
    routeChanged(pathname) {
      if (pathname === committed) return;
      committed = pathname;
      stale = true;
      if (!isMotionRoute(pathname)) {
        detach();
        disposeLenis?.();
        return;
      }
      if (!busy) {
        // Back/forward and links outside the curtain: the old page is already gone.
        detach();
        markRevealed();
        void startLenis();
      }
      if (!frame) frame = window.setTimeout(check, 16);
    },
    dispose() {
      disposed = true;
      observer.disconnect();
      window.removeEventListener('iz:page-ready', schedule);
      if (frame) window.clearTimeout(frame);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('pointerover', onPointer);
      document.removeEventListener('pointerdown', onPress);
      document.removeEventListener('touchstart', onTouch);
      document.removeEventListener('pointerout', onPointer);
      detach();
      disposeLenis?.();
      disposeCursor?.();
      // Only the route curtain is dropped: in development Strict Mode disposes the first controller while the load
      // curtain is still up, and the second one must still lift it (the boot fallback covers a real unmount).
      curtain.removeAttribute('data-active');
      html.removeAttribute('data-iz-covered');
    },
  };
}

/**
 * Site-wide motion for the public v2 pages (F-016 C5): smooth scroll (Lenis on the GSAP ticker), the load and route
 * curtain, button hover, and the per-page scroll motion (lib/v2/motion/engine.ts). Mounted once in the root layout so
 * it survives route changes; on admin and affiliate routes, and under reduced motion, it only renders the hidden
 * curtain markup.
 */
export default function SiteMotion() {
  const pathname = usePathname();
  const router = useRouter();
  const curtainRef = useRef<HTMLDivElement>(null);
  const controller = useRef<Controller | null>(null);
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    const curtain = curtainRef.current;
    if (!curtain || !isMotionRoute(window.location.pathname) || !window.matchMedia(MOTION_OK).matches) return;
    const c = createController(
      curtain,
      href => routerRef.current.push(href),
      href => routerRef.current.prefetch(href),
    );
    controller.current = c;
    return () => {
      c.dispose();
      controller.current = null;
    };
  }, []);

  useEffect(() => {
    controller.current?.routeChanged(pathname);
  }, [pathname]);

  return (
    <div ref={curtainRef} className={`iz-curtain ${fontDisplay.variable}`} aria-hidden="true">
      <svg className="iz-curtain__sheets" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
        <path data-curtain-sheet className="iz-curtain__sheet iz-curtain__sheet--kuning" d={FULL} />
        <path data-curtain-sheet className="iz-curtain__sheet iz-curtain__sheet--aspal" d={FULL} />
      </svg>
      <div className="iz-curtain__mark">
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny static logo, must paint before hydration */}
        <img data-curtain-part className="iz-curtain__logo" src="/logo-inzta.png" alt="" width={46} height={54} />
        <span data-curtain-part data-curtain-word className="iz-curtain__word">
          {WORD.split('').map((letter, i) => (
            <span key={i} style={{ animationDelay: `${0.1 + i * 0.05}s` }}>
              {letter}
            </span>
          ))}
        </span>
        <span data-curtain-part data-curtain-label className="iz-curtain__label" hidden />
      </div>
    </div>
  );
}
