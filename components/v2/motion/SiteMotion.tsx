'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import 'lenis/dist/lenis.css';
import '@/app/(v2)/v2-motion.css';
import { fontDisplay } from '@/components/v2/fonts';
import { CURTAIN_ATTR, isMotionRoute } from '@/lib/v2/motion/boot';
import { FULL, cover, framesSettled, lift, pageReady, pageSettled } from '@/lib/v2/motion/curtain';
import { initPage, type PageMode } from '@/lib/v2/motion/engine';
import { routeLabel, transitionTarget } from '@/lib/v2/motion/links';
import { HOVER, MOTION_OK, jumpTo, loadMotion, markCovered, markRevealed, setLenis, type MotionKit } from '@/lib/v2/motion/runtime';

const WORD = 'INZTA';
// A route that never arrives (network error, redirect elsewhere) still lifts the curtain after this long.
const ROUTE_SAFETY_MS = 8000;

const modeFor = (pathname: string): PageMode => (pathname === '/produk' || pathname.startsWith('/produk/') ? 'light' : 'full');

// The page to animate: a hydrated v2 page (PageReady), not the loading skeleton (LoadingV2 renders .iz-loading).
function readyRoot(): HTMLElement | null {
  const root = document.querySelector<HTMLElement>('.iz-page[data-iz-ready]');
  return root && !root.querySelector('.iz-loading') ? root : null;
}

type Controller = { routeChanged: (pathname: string) => void; dispose: () => void };

function createController(curtain: HTMLDivElement, push: (href: string) => void, prefetch: (href: string) => void): Controller {
  let kit: MotionKit | null = null;
  let revert: (() => void) | null = null;
  let committed = window.location.pathname;
  let stale = true;
  let busy = false;
  let waiter: ((root: HTMLElement | null) => void) | null = null;
  // Pathname at the moment a covered navigation pushed; the waiter only accepts a page once the route has moved on.
  let leaving: string | null = null;
  let disposeLenis: (() => void) | null = null;
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
    // A low lerp gives the long, soft glide Sehan asked for (2026-10-29); the wheel is slightly damped so one notch
    // does not travel too far at that softness.
    const lenis = new Lenis({ lerp: 0.075, wheelMultiplier: 0.9, touchMultiplier: 1, smoothWheel: true, anchors: true, allowNestedScroll: true, stopInertiaOnNavigate: true });
    lenis.on('scroll', ScrollTrigger.update);
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
      setLenis(null);
      disposeLenis = null;
    };
  }

  function endCurtain() {
    html.removeAttribute(CURTAIN_ATTR);
    curtain.removeAttribute('data-active');
  }

  async function boot() {
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
    const href = url.pathname + url.search + url.hash;
    prefetch(href);
    markCovered();
    if (word) word.hidden = true;
    if (label) {
      label.hidden = false;
      label.textContent = text?.trim() || routeLabel(url.pathname);
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
    const target = url.hash ? document.getElementById(decodeURIComponent(url.hash.slice(1))) : null;
    jumpTo(target ?? 0);
    await pageReady(root);
    if (root) attach(root);
    kit.ScrollTrigger.refresh();
    await framesSettled();
    await lift(kit, curtain, markRevealed);
    html.removeAttribute('data-iz-covered');
    curtain.removeAttribute('data-active');
    if (word) word.hidden = false;
    if (label) label.hidden = true;
    busy = false;
  }

  function onClick(e: MouseEvent) {
    if (!kit || busy || !motionOk() || !document.querySelector('.iz-page')) return;
    const a = (e.target as Element | null)?.closest?.('a');
    if (!a) return;
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
    if (!url) return;
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

  document.addEventListener('click', onClick, true);
  document.addEventListener('pointerover', onPointer);
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
      document.removeEventListener('touchstart', onTouch);
      document.removeEventListener('pointerout', onPointer);
      detach();
      disposeLenis?.();
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
