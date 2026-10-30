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
import { startProbe, type Probe } from '@/lib/v2/motion/probe';
import {
  HOVER,
  getLenis,
  jumpTo,
  loadMotion,
  markCovered,
  markRevealed,
  motionOn,
  motionTier,
  onTierChange,
  scrollIdle,
  setLenis,
  syncTierAttr,
  type MotionKit,
} from '@/lib/v2/motion/runtime';

const WORD = 'INZTA';
// A route that never arrives (network error, redirect elsewhere) still lifts the curtain after this long.
const ROUTE_SAFETY_MS = 8000;
// Lenis inertia per tier: lite eases to the target faster, so fewer smoothed frames follow each wheel notch.
const lerpFor = () => (motionTier() === 'lite' ? 0.1 : 0.065);
// A probe downgrade near the top re-attaches the page in lite once the hero entrance has landed (about 2 s after the
// curtain lifts), so no letter is caught mid-flight.
const REATTACH_AFTER_MS = 2200;

const modeFor = (pathname: string): PageMode => (pathname === '/produk' || pathname.startsWith('/produk/') ? 'light' : 'full');

// The GSAP chunks start downloading as soon as this module runs, while React is still hydrating, instead of after
// the first effect; the load curtain lifts sooner. Admin routes and the minimal tier (reduced motion, Save-Data)
// download nothing.
if (typeof window !== 'undefined' && isMotionRoute(window.location.pathname) && motionOn()) {
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
  const motionOk = motionOn;
  let probe: Probe | null = null;
  let revealedAt = 0;
  let reattachTimer = 0;
  // Tier the current engine was attached in; a logo replay after a probe downgrade re-attaches instead of replaying.
  let attachedTier = motionTier();
  const html = document.documentElement;
  const word = curtain.querySelector<HTMLElement>('[data-curtain-word]');
  const label = curtain.querySelector<HTMLElement>('[data-curtain-label]');

  function attach(root: HTMLElement, settled = false) {
    if (disposed) return;
    revert?.();
    revert = null;
    stale = false;
    if (!kit || !motionOk()) return;
    html.classList.add('iz-motion');
    attachedTier = motionTier();
    // Article pages have their own reading bar over the body (S7.7, .iz-progress); one line at the top is enough.
    document.querySelector<HTMLElement>('.iz-readline')?.toggleAttribute('hidden', !!root.querySelector('.iz-progress'));
    revert = initPage(root, kit, modeFor(committed), { settled });
  }

  // The frame probe lowered the tier. Lenis lightens at once. Near the top of the page (a cheap moment, like the logo
  // replay but without a curtain) the page re-attaches in lite, leaving what is on screen as it is; further down, the
  // blocks set up later and the next route use lite.
  function tierLowered() {
    const lenis = getLenis();
    if (lenis) lenis.options.lerp = lerpFor();
    // Touch-only devices drop Lenis in lite (startLenis); swapping it out mid-page costs nothing visible there.
    if (lenis && motionTier() === 'lite' && window.matchMedia('(hover: none) and (pointer: coarse)').matches) {
      disposeLenis?.();
      void startLenis();
    }
    if (motionTier() !== 'lite' || !revert) return;
    window.clearTimeout(reattachTimer);
    const tryReattach = () => {
      reattachTimer = 0;
      // attachedTier already matches when a logo replay re-attached the page in the meantime.
      if (disposed || busy || stale || !revert || attachedTier === motionTier() || window.scrollY >= window.innerHeight) return;
      if (!scrollIdle()) {
        reattachTimer = window.setTimeout(tryReattach, 250);
        return;
      }
      const root = readyRoot();
      if (!root) return;
      // initPage ends with its own ScrollTrigger.refresh(), which measures the re-attached page.
      attach(root, true);
    };
    reattachTimer = window.setTimeout(tryReattach, Math.max(0, revealedAt + REATTACH_AFTER_MS - performance.now()));
  }
  const offTier = onTierChange(tierLowered);

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
    const { gsap, ScrollTrigger } = kit;
    // Page progress along the top edge (v2-motion.css .iz-readline). Its own class: .iz-progress is the article's
    // reading bar (S7.7), which the shared name hid by scaling its container to zero.
    const bar = document.createElement('div');
    bar.className = 'iz-readline';
    bar.setAttribute('aria-hidden', 'true');
    const progress = (p: number) => {
      bar.style.transform = `scaleX(${Math.min(1, Math.max(0, p || 0)).toFixed(4)})`;
    };
    // Lite on a touch-only device: no Lenis at all. Touch scrolling was native anyway, but Lenis still listened to
    // every touchmove without passive (so the compositor waited on the main thread mid-swipe), rewrote the <html>
    // class on each scroll start and stop, and ran its raf on the ticker (6x phone trace, 2026-10-30). ScrollTrigger
    // reads native scroll on its own; the bar follows a passive listener with the limit measured once per refresh.
    if (motionTier() === 'lite' && window.matchMedia('(hover: none) and (pointer: coarse)').matches) {
      document.body.appendChild(bar);
      let max = 1;
      let raf = 0;
      const measure = () => {
        max = Math.max(1, ScrollTrigger.maxScroll(window));
        progress(window.scrollY / max);
      };
      const onScroll = () => {
        if (!raf) raf = requestAnimationFrame(() => {
          raf = 0;
          progress(window.scrollY / max);
        });
      };
      measure();
      ScrollTrigger.addEventListener('refresh', measure);
      window.addEventListener('scroll', onScroll, { passive: true });
      disposeLenis = () => {
        ScrollTrigger.removeEventListener('refresh', measure);
        window.removeEventListener('scroll', onScroll);
        cancelAnimationFrame(raf);
        bar.remove();
        disposeLenis = null;
      };
      return;
    }
    const { default: Lenis } = await import('lenis');
    if (disposeLenis || !kit || disposed) return;
    // Weighted scroll, the same both ways (Sehan, 2026-10-29). Duration mode restarted its 1.35 s ease on every wheel
    // notch, so a run of notches downward piled up and felt fast; a low lerp is plain inertia toward the target, which
    // feels equally heavy up and down, and each notch travels a little less.
    // allowNestedScroll stays off: it handed every downward wheel to <body>, which globals.css turns into an overflow
    // box (overflow-x: hidden makes overflow-y auto) 4 px taller than its content, so scrolling down was native and
    // only scrolling up was smoothed (Sehan: heavy only upward, stutter, smooth only after waiting; probe in QA).
    // Panels that scroll on their own carry data-lenis-prevent instead (phone menu, catalogue filter sheet, TOC).
    // The lite tier uses a lighter inertia (lerpFor); touch stays native in both.
    const lenis = new Lenis({ lerp: lerpFor(), wheelMultiplier: 0.8, touchMultiplier: 1, smoothWheel: true, anchors: true, stopInertiaOnNavigate: true });
    lenis.on('scroll', ScrollTrigger.update);
    document.body.appendChild(bar);
    lenis.on('scroll', (l: { progress: number }) => progress(l.progress));
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
    revealedAt = performance.now();
    kit.ScrollTrigger.refresh();
    if (!disposed) probe = startProbe();
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
    // Route changes are not representative frames for the probe.
    probe?.pause();
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
      revealedAt = performance.now();
      probe?.resume();
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
  // After a probe downgrade the engine still holds full-tier techniques (the hero entrance captured its tier), so the
  // page is attached again under the curtain instead: at the top only the first screen is set up before the lift (the
  // rest follows in the deferred queue), and the hero entrance plays in lite.
  async function replay() {
    if (!kit) return;
    busy = true;
    probe?.pause();
    markCovered();
    if (word) word.hidden = false;
    if (label) label.hidden = true;
    curtain.setAttribute('data-active', '');
    html.setAttribute('data-iz-covered', '');
    try {
      await cover(kit, curtain);
      jumpTo(0);
      const root = readyRoot();
      if (revert && attachedTier === motionTier()) revert.intro();
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
      revealedAt = performance.now();
      probe?.resume();
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
    // Lite labels are split into words only (Bounce.tsx) and bounce per word. A whole word takes a shallower dip: the
    // letter values squashed and tilted it like a rendering glitch (motion audit, 2026-10-30).
    let chars: NodeListOf<Element> = btn.querySelectorAll('.iz-bounce__c');
    const words = !chars.length;
    if (words) chars = btn.querySelectorAll('.iz-bounce__w');
    if (!chars.length) return;
    bouncing.add(btn);
    kit.gsap.to(chars, {
      keyframes: {
        '0%': { yPercent: 0, scaleY: 1, rotate: 0 },
        '22%': words ? { yPercent: 18, scaleY: 0.85, rotate: 3, ease: 'power2.in' } : { yPercent: 40, scaleY: 0.5, rotate: 10, ease: 'power2.in' },
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
      // The boot script set them for the first page; client navigation to or from admin keeps them in step.
      html.classList.toggle('iz-v2', isMotionRoute(pathname));
      syncTierAttr(isMotionRoute(pathname));
      if (!isMotionRoute(pathname)) {
        detach();
        disposeLenis?.();
        // Frames of a non-v2 page must not judge the tier (and store lite for two weeks).
        probe?.stop();
        probe = null;
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
      probe?.stop();
      offTier();
      window.clearTimeout(reattachTimer);
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
    if (!curtain || !isMotionRoute(window.location.pathname) || !motionOn()) return;
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
    if (controller.current) controller.current.routeChanged(pathname);
    // No controller (minimal tier, or a visit that opened on an admin route): the tier attribute still follows the
    // route, so the lite and minimal CSS match what HowToStage and ClosingStage decide in JS.
    else syncTierAttr(isMotionRoute(pathname));
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
