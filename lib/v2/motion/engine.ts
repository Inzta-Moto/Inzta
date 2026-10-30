import type { SplitText as SplitTextType } from 'gsap/SplitText';
import type { MotionKit } from '@/lib/v2/motion/runtime';
import { DESKTOP, HOVER, MOBILE, handBack, isRevealed, motionTier, noteSetup, onTierChange, scrollIdle, whenRevealed } from '@/lib/v2/motion/runtime';

// "full" for the story pages (Beranda, Pilih motor, Artikel, Tentang); "light" for the shop routes under /produk,
// where only short fades run so nothing slows a buyer down (Sehan, 2026-10-29).
export type PageMode = 'full' | 'light';

/** Cleanup for one page's motion; intro() plays the hero entrance again behind the curtain (logo click). */
export type PageMotion = (() => void) & { intro: () => void };

/**
 * settled: the page is already on screen and has played its entrance (SiteMotion re-attaching in the lite tier after
 * the frame probe), so nothing that is visible is hidden again; only what is still below the screen gets set up.
 */
export type PageOptions = { settled?: boolean };

type Split = InstanceType<typeof SplitTextType>;

const HEADINGS_FULL = 'h2.t-h2-landing, h1.t-h1-shop, h1.t-h1-article, h2.t-h2-shop';
const HEADINGS_LIGHT = 'h1.t-h1-shop, h1.t-h1-product, h2.t-h2-shop';
const GROUPS =
  '[data-reveal-stagger], .iz-garasi, .iz-row-cards, .iz-cats, .iz-guides, .iz-grid-4, .iz-grid-3, .iz-grid-2, .iz-ordersteps, .iz-steps, .iz-why__list, .iz-alist, .iz-notice__list';
const PHOTOS = '[data-reveal-clip], .iz-overlap__photo, .iz-gfeature';
const KREM = '#f3efe6';
const BATU_MUDA = '#7a7364';
// Page colour, the wipe cover's fallback when no ancestor paints a background.
const KERTAS = '#f6f4ef';

const inHero = (el: Element) => !!el.closest('.iz-hero');
const inScene = (el: Element, name?: string) => !!el.closest(name ? `[data-scene="${name}"]` : '[data-scene]');
const textOnly = (el: Element) => el.children.length === 0 && !!el.textContent?.trim();

// First painted background behind el: the colour of the lite wipe cover, so the covered box reads as empty page.
function backdrop(el: Element): string {
  for (let n = el.parentElement; n; n = n.parentElement) {
    const c = getComputedStyle(n).backgroundColor;
    if (c && c !== 'transparent' && !/^rgba\(.*,\s*0\)$/.test(c)) return c;
  }
  return KERTAS;
}

/**
 * Scroll and entrance motion for one v2 page (F-016 C5, design.md §8). It runs while the curtain still covers the
 * page: every from-state and every ScrollTrigger is created here, so the layout work happens out of sight, and the
 * entrances only play once the curtain lifts (whenRevealed). Creating dozens of triggers during the lift made the
 * curtain stutter. Hidden from-states use opacity, not visibility, so content waiting for its reveal stays in the
 * tab order (review REV-02). Only transform, opacity, clip-path, filter and colour on split text are animated. Everything
 * lives in one gsap.matchMedia, so the returned cleanup reverts every tween, trigger, pin and split before the next
 * route starts. Reduced motion matches neither query and leaves the page untouched.
 *
 * In the lite tier (lib/v2/motion/tier.ts) every effect keeps its intent with a cheaper technique: text splits into
 * words or lines instead of letters, single elements and photos use CSS transitions on transform and opacity (.iz-rise,
 * .iz-zoom, .iz-wipe in v2-motion.css) instead of per-frame tweens, scrubbed insets play once on enter, loops end, and
 * the filmstrip stays a native swipe row. The tier is read again at each setup step, so a downgrade from the frame probe
 * reaches the blocks that are set up later.
 */
export function initPage(root: HTMLElement, kit: MotionKit, mode: PageMode, options: PageOptions = {}): PageMotion {
  const settled = !!options.settled;
  const { gsap, ScrollTrigger, SplitText } = kit;
  const mm = gsap.matchMedia();
  let intro = () => {};

  mm.add({ desktop: DESKTOP, mobile: MOBILE }, context => {
    const desktop = window.matchMedia(DESKTOP).matches;
    const hover = window.matchMedia(HOVER).matches;
    // On phones the next block is often only a few pixels into view; a later start left it blank under the fold.
    const START = desktop ? 'top 86%' : 'top 97%';
    const splits: Split[] = [];
    const undo: (() => void)[] = [];
    let lite = motionTier() === 'lite';
    undo.push(onTierChange(t => (lite = t === 'lite')));
    let shown = false;
    const queued: gsap.core.Animation[] = [];
    const play = (a: gsap.core.Animation) => (shown ? a.play() : queued.push(a));

    const onEnter = (trigger: Element, tween: gsap.core.Animation, start = START) => {
      // Initialise the tween now (setup runs under the curtain or in a still moment) instead of on first play: a tween
      // reads the start values it was not given from computed style when it first renders, and on its first play that
      // read forced a style recalc mid-scroll. Rendering to the end and back, events suppressed, leaves the from-state.
      tween.progress(1, true).progress(0, true);
      ScrollTrigger.create({ trigger, start, once: true, onEnter: () => play(tween) });
    };
    // Split text is put back once its entrance has played, so later reflows and React updates see the original DOM.
    const split = (el: HTMLElement, type: string) => {
      const s = SplitText.create(el, { type, mask: 'lines', aria: 'auto' });
      splits.push(s);
      return s;
    };
    const unsplit = (s: Split) => () => s.revert();

    // Only the blocks in or above the first screen are set up while the curtain covers the page; the blocks further
    // down follow once it has lifted, one per frame. Setting up every block (splitting every heading, creating every
    // trigger) was most of the time the logo sat on the curtain (QA profile; Sehan, 2026-10-29: the hold felt long).
    // Blocks are measured once, before anything is written, and stay in page order, so triggers are still created
    // top to bottom and a pin only ever pushes triggers created after it.
    const main = root.querySelector<HTMLElement>('main');
    const blocks = (main ? Array.from(main.children) : []) as HTMLElement[];
    const foot = root.querySelector<HTMLElement>('.iz-footer');
    if (foot && !blocks.some(b => b.contains(foot))) blocks.push(foot);
    const fold = window.innerHeight * 1.15;
    // Settled: every block goes through the deferred queue, which leaves alone any block already on screen.
    const later = settled ? blocks.slice() : blocks.filter(b => b.getBoundingClientRect().top > fold);
    let active: HTMLElement | null = null;
    const mine = (el: Element) => {
      const block = blocks.find(b => b.contains(el));
      return active ? block === active : !block || !later.includes(block);
    };
    // Cara pesan runs its own scroll journey (HowToStage), so the generic reveals and tilt leave it alone.
    const owned = (el: Element) => inScene(el, 'howto');
    // A page that arrives without the curtain (product detail, back/forward) is painted before this runs; hiding
    // what is already on screen to fade it in would make it blink, so the shop routes skip that first screen.
    const bare = isRevealed();

    // The tilt hides nothing, so a settled attach still gives it to the blocks that are already on screen.
    const tiltStep = () => tilt(root);
    const steps: (() => void)[] =
      mode === 'full'
        ? [
            () => headings(root, HEADINGS_FULL, true),
            () => eyebrows(root),
            () => leads(root),
            () => singles(root),
            () => groups(root, false),
            () => photos(root),
            () => tourmax(root),
            () => film(root),
            () => reviews(root),
            () => closing(root),
            () => footer(root),
            () => swipe(root),
            ...(hover ? [tiltStep] : []),
          ]
        : [() => headings(root, HEADINGS_LIGHT, false), () => groups(root, true), () => pdp(root), () => footer(root)];
    let replayHero: (() => void) | null = null;
    if (mode === 'full') hero(root);
    steps.forEach(step => step());

    function hero(scope: HTMLElement) {
      const section = scope.querySelector<HTMLElement>('main .iz-hero');
      if (!section) return;
      const img = section.querySelector<HTMLElement>('img');
      const body = section.querySelector<HTMLElement>('.iz-hero__body');
      const title = section.querySelector<HTMLElement>('h1');
      // The tier when the hero was set up. A logo replay keeps it, so the zoom and the parallax always use the same
      // technique (GSAP folds a CSS scale into its own transform once it touches the image).
      const lit = lite;
      let stop = () => {};
      const entrance = () => {
        stop();
        const tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });
        const parts: Split[] = [];
        let stopRetype = () => {};
        let rising: HTMLElement[] = [];
        if (img) {
          if (lit) {
            // Lite: the zoom is a CSS transition on the scale property, which composes with the desktop parallax.
            zoomPrep(img, 1.22, 1.08, 2.2);
            tl.call(() => zoomGo(img), [], 0.001);
          } else tl.fromTo(img, { scale: 1.22 }, { scale: 1.08, duration: 2.2 }, 0);
        }
        if (title) {
          if (lit) {
            // Lite: words instead of letters, with the same tilt; opacity from 0.45 (about the stone colour on asphalt)
            // instead of the colour tween, which repainted every letter.
            const s = split(title, 'lines,words');
            parts.push(s);
            tl.fromTo(
              s.words,
              { yPercent: 118, rotate: 4, opacity: 0.45 },
              { yPercent: 0, rotate: 0, opacity: 1, duration: 1, stagger: 0.06, onComplete: () => (stopRetype = retype(section, title, s, true)) },
              0.15,
            );
          } else {
            const s = split(title, 'lines,words,chars');
            parts.push(s);
            tl.fromTo(
              s.chars,
              { yPercent: 118, rotate: 7, color: BATU_MUDA },
              {
                yPercent: 0,
                rotate: 0,
                color: KREM,
                duration: 1.15,
                stagger: 0.018,
                onComplete: () => {
                  stopRetype = retype(section, title, s, false);
                },
              },
              0.15,
            );
          }
        }
        const lead = section.querySelector<HTMLElement>('.t-lead');
        const extras = Array.from(
          section.querySelectorAll<HTMLElement>('.iz-eyebrow, .iz-crumb, .iz-hero__body > .iz-row, .iz-hero__meta, .iz-hero__cue'),
        );
        if (lit) {
          // Lite: lead and extras rise through the compositor transitions, in the same order and rhythm.
          rising = lead ? [lead, ...extras] : extras;
          prepareRise(rising, [], 26, false);
          tl.call(riseStart(rising, [], 80), [], 0.55);
        } else {
          if (lead) {
            const s = split(lead, 'lines');
            parts.push(s);
            tl.fromTo(s.lines, { yPercent: 105 }, { yPercent: 0, duration: 1, stagger: 0.08, onComplete: unsplit(s) }, 0.55);
          }
          tl.fromTo(extras, { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, stagger: 0.08 }, 0.7);
        }
        play(tl);
        // A tab that paints no frames would leave the H1 hidden; finish the entrance instead.
        const safety = window.setTimeout(() => tl.progress(1), 6000);
        stop = () => {
          window.clearTimeout(safety);
          stopRetype();
          tl.kill();
          parts.forEach(s => s.revert());
          settleRise(rising);
          if (img) unzoom(img);
        };
      };
      // A reload half-way down the page keeps the hero as it is; its entrance would play off screen. A settled attach
      // (lite re-attach after the probe) keeps it as well, since the visitor has just watched it.
      if (!settled && section.getBoundingClientRect().bottom > window.innerHeight * 0.35) entrance();
      else {
        if (img) {
          if (lit) {
            zoomPrep(img, 1.08, 1.08, 0);
            zoomGo(img);
          } else gsap.set(img, { scale: 1.08 });
        }
        if (title) {
          const s = split(title, lit ? 'lines,words' : 'lines,words,chars');
          const stopRetype = retype(section, title, s, lit);
          stop = () => {
            stopRetype();
            s.revert();
            if (img) unzoom(img);
          };
        } else if (img) stop = () => unzoom(img);
      }
      replayHero = entrance;
      undo.push(() => stop());
      // Leaving: the photo sinks slower than the page and the copy lifts and fades (scrubbed, no pin). Desktop only:
      // scrubbed parallax on phones fights the collapsing address bar.
      if (img && desktop) drift(img, lit, 0, 9, { trigger: section, start: 'top top', end: 'bottom top', scrub: true });
      if (body && desktop) {
        gsap.to(body, { y: -70, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: section, start: 'top top', end: 'bottom 25%', scrub: true } });
      }
    }

    // The production hero types its title; this re-types the last line of the title in a loop after the entrance. The
    // caret appears at the left edge and runs right while each letter flips out upward and lands again from below
    // just behind it, so the line is never left empty (Sehan, 2026-10-29: the old right-to-left erase stood blank too
    // long; run it more often at the same letter speed). The H1 keeps its full text for screen readers and search
    // (SplitText aria). The loop pauses while the hero is off screen, and a width change re-splits the lines and
    // starts again. Returns a stop function.
    // Lite: the title is split into words, so the wave runs word by word without blur, two cycles, then rests with the
    // whole line shown. A downgrade while the full loop runs lets it finish its current cycle and rest the same way.
    function retype(section: HTMLElement, title: HTMLElement, first: Split, lit: boolean): () => void {
      let s = first;
      let loop: gsap.core.Timeline | null = null;
      let caret: HTMLElement | null = null;
      let width = title.offsetWidth;
      let rest = false;
      const build = () => {
        const line = s.lines[s.lines.length - 1] as HTMLElement | undefined;
        if (!line) return;
        const chars = ((lit ? s.words : s.chars) as HTMLElement[]).filter(c => line.contains(c));
        if (chars.length < (lit ? 1 : 2)) return;
        line.style.position = 'relative';
        caret = document.createElement('span');
        caret.className = 'iz-caret';
        caret.setAttribute('aria-hidden', 'true');
        line.appendChild(caret);
        // Letter edges are measured once per build (a width change rebuilds): the letters only move vertically, and
        // reading rects at every step forced a layout in the middle of the loop. The caret moves by its own style, not
        // gsap.set, which created a tween (and a computed-style read) at every step.
        const base = line.getBoundingClientRect().left;
        const left = chars[0].getBoundingClientRect().left - base;
        const rights = chars.map(c => c.getBoundingClientRect().right - base);
        const at = (i: number) => {
          if (caret) caret.style.transform = `translateX(${i < 0 ? left : rights[i]}px)`;
        };
        // Blur repaints every letter on each frame; phones and the lite tier keep the flip without it.
        const blur = !lit && window.matchMedia(HOVER).matches;
        const out = blur ? { filter: 'blur(6px)' } : {};
        const sharp = blur ? { filter: 'blur(0px)' } : {};
        // One sub-timeline per letter, 0.05 s apart: out for 0.24 s, back in for 0.42 s, the caret stepping behind
        // each letter as it lands. About five letters are in flight at once, so the gap travels like a wave.
        const wave = gsap.timeline();
        chars.forEach((c, i) => {
          wave.add(
            gsap
              .timeline()
              .to(c, { yPercent: -70, opacity: 0, ...out, duration: 0.24, ease: 'power2.in' })
              .call(() => at(i))
              .set(c, { yPercent: 70 })
              .to(c, { yPercent: 0, opacity: 1, ...sharp, duration: 0.42, ease: 'power3.out' }),
            i * (lit ? 0.09 : 0.05),
          );
        });
        loop = gsap.timeline({
          repeat: lit ? 1 : -1,
          repeatDelay: 2.2,
          delay: 0.8,
          // Lite: after its two cycles the loop rests for good, so a later width change re-splits without starting over.
          onComplete: () => {
            rest = true;
          },
          // Each cycle starts with every letter at rest, so this is where a downgraded loop stops.
          onRepeat: () => {
            if (lit || !lite) return;
            rest = true;
            loop?.pause();
          },
        });
        loop
          .call(() => at(-1))
          .to(caret, { autoAlpha: 1, duration: 0.18 })
          .add(wave, '-=0.06')
          .to(caret, { autoAlpha: 0.15, duration: 0.14, repeat: 3, yoyo: true, ease: 'steps(1)' })
          .to(caret, { autoAlpha: 0, duration: 0.3 });
      };
      build();
      const watch = ScrollTrigger.create({
        trigger: section,
        start: 'top bottom',
        end: 'bottom top',
        onToggle: self => (self.isActive && !rest ? loop?.resume() : loop?.pause()),
      });
      let timer = 0;
      const onResize = () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          if (Math.abs(title.offsetWidth - width) < 2) return;
          width = title.offsetWidth;
          loop?.kill();
          caret?.remove();
          s.revert();
          s = split(title, lit ? 'lines,words' : 'lines,words,chars');
          if (!lit) gsap.set(s.chars, { color: KREM });
          if (!rest) build();
        }, 250);
      };
      window.addEventListener('resize', onResize);
      return () => {
        window.removeEventListener('resize', onResize);
        window.clearTimeout(timer);
        watch.kill();
        loop?.kill();
        caret?.remove();
        // A width change re-split the title; the caller only knows the first split.
        if (s !== first) s.revert();
      };
    }

    function headings(scope: HTMLElement, selector: string, splitWords: boolean) {
      scope.querySelectorAll<HTMLElement>(selector).forEach(el => {
        if (inHero(el) || !mine(el) || !el.textContent?.trim()) return;
        if (!splitWords) {
          if (bare && !active) return;
          if (lite) riseOne(el, 22, 0, true);
          else onEnter(el, gsap.fromTo(el, { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, paused: true }));
          return;
        }
        if (lite) {
          // Lite: masked lines rise, without the per-word rotation.
          const s = split(el, 'lines');
          onEnter(el, gsap.fromTo(s.lines, { yPercent: 105 }, { yPercent: 0, duration: 0.9, ease: 'expo.out', stagger: 0.08, paused: true, onComplete: unsplit(s) }));
          return;
        }
        const s = split(el, 'lines,words');
        const tween = gsap.fromTo(
          s.words,
          { yPercent: 112, rotate: 4 },
          { yPercent: 0, rotate: 0, duration: 1.05, ease: 'expo.out', stagger: 0.045, paused: true, onComplete: unsplit(s) },
        );
        onEnter(el, tween);
      });
    }

    // Eyebrow labels decode letter by letter as they arrive. Screen readers get the stable copy; the decoding span is
    // decorative, and the label is restored when the page leaves.
    function eyebrows(scope: HTMLElement) {
      scope.querySelectorAll<HTMLElement>('main .iz-eyebrow').forEach(el => {
        if (inHero(el) || !mine(el) || !textOnly(el)) return;
        const text = el.textContent!.trim();
        const sr = document.createElement('span');
        sr.className = 'iz-sr';
        sr.textContent = text;
        const vis = document.createElement('span');
        vis.setAttribute('aria-hidden', 'true');
        vis.textContent = text;
        el.replaceChildren(sr, vis);
        undo.push(() => el.replaceChildren(document.createTextNode(text)));
        // Lite: under half the time and a short alphabet, so the label re-lays out on fewer frames.
        const scramble = lite
          ? { text, chars: 'INZTA', speed: 1, revealDelay: 0.1 }
          : { text, chars: 'ABCDEFGHIJKLMNOPRSTUVWXYZ', speed: 0.6, revealDelay: 0.25 };
        const tween = gsap.fromTo(vis, { opacity: 0 }, { opacity: 1, duration: lite ? 0.5 : 1.1, ease: 'none', paused: true, scrambleText: scramble });
        onEnter(el, tween);
      });
    }

    function leads(scope: HTMLElement) {
      scope.querySelectorAll<HTMLElement>('main .iz-head > p, main .iz-head > div > p, main .iz-head .t-lead').forEach(el => {
        if (inHero(el) || !mine(el)) return;
        if (lite) riseOne(el, 24, 150, false, true);
        else onEnter(el, gsap.fromTo(el, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 1, delay: 0.15, paused: true }));
      });
    }

    function singles(scope: HTMLElement) {
      scope.querySelectorAll<HTMLElement>('main [data-reveal]').forEach(el => {
        if (inHero(el) || !mine(el) || owned(el)) return;
        if (lite) riseOne(el, 24, 0, false, true);
        else onEnter(el, gsap.fromTo(el, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 1, paused: true }));
      });
    }

    function groups(scope: HTMLElement, light: boolean) {
      scope.querySelectorAll<HTMLElement>(`main :is(${GROUPS})`).forEach(group => {
        // Only leaf groups animate, so a grid inside a grid is not moved twice; scenes run their own motion.
        if (inHero(group) || !mine(group) || owned(group) || inScene(group, 'film') || inScene(group, 'reviews') || inScene(group, 'tourmax') || group.querySelector(GROUPS)) return;
        const items = Array.from(group.children) as HTMLElement[];
        if (!items.length) return;
        if (light) {
          if (bare && !active) return;
          // Long catalogue grids reveal row by row as they come into view.
          prepareRise(items, [], 28, true);
          ScrollTrigger.batch(items, {
            start: 'top 94%',
            once: true,
            onEnter: batch => play(riseTimeline(batch as HTMLElement[], [], 50)),
          });
          return;
        }
        const imgs = items.map(item => item.querySelector('img')).filter((img): img is HTMLImageElement => !!img);
        // Lite: at most three 50 ms steps spread over the whole row, so a long row lands as quickly as a short one; the
        // image settles from closer (v2-motion.css .iz-rise--lite).
        prepareRise(items, imgs, desktop ? 44 : 28, false, lite);
        onEnter(group, lite ? riseTimeline(items, imgs, 50, 0, 3) : riseTimeline(items, imgs, 85));
      });
    }

    // Card groups rise through CSS transitions on transform and opacity (v2-motion.css .iz-rise), which the
    // compositor runs off the main thread. GSAP tweens wrote inline styles on every card and image each frame, and
    // with a section arriving mid-scroll those writes cost style recalcs inside the scroll frames on phones (trace,
    // 2026-10-29). Only classes and two custom properties are used and all are removed afterwards, so hover lifts
    // and the tilt find the cards as their CSS describes them.
    // y is a pixel number or any CSS length (the Tourmax number moves by a percentage).
    function prepareRise(items: HTMLElement[], imgs: HTMLElement[], y: number | string, quick: boolean, liteImgs = false) {
      for (const el of items) {
        el.style.setProperty('--iz-rise-y', typeof y === 'number' ? `${y}px` : y);
        el.classList.add('iz-rise', 'iz-rise--wait');
        if (quick) el.classList.add('iz-rise--quick');
      }
      for (const el of imgs) {
        el.classList.add('iz-rise-img', 'iz-rise--wait');
        if (liteImgs) el.classList.add('iz-rise--lite');
      }
      undo.push(() => settleRise([...items, ...imgs]));
    }
    function settleRise(els: HTMLElement[]) {
      for (const el of els) {
        el.classList.remove('iz-rise', 'iz-rise-img', 'iz-rise--wait', 'iz-rise--quick', 'iz-rise--lite', 'iz-rise--house');
        el.style.removeProperty('--iz-rise-y');
        el.style.removeProperty('--iz-rise-d');
        el.style.removeProperty('--iz-rise-o');
      }
    }
    // Starts the transitions of prepared elements, stepMs apart after baseMs, and cleans up once they have run. A cap
    // keeps the total span at cap steps but spreads it over every item, so a long row still arrives in order instead
    // of its tail landing at once.
    function riseStart(items: HTMLElement[], imgs: HTMLElement[], stepMs: number, baseMs = 0, cap = Infinity) {
      let timer = 0;
      undo.push(() => window.clearTimeout(timer));
      return () => {
        const step = items.length - 1 > cap ? (stepMs * cap) / (items.length - 1) : stepMs;
        const delay = (i: number) => `${Math.round(baseMs + i * step)}ms`;
        items.forEach((el, i) => el.style.setProperty('--iz-rise-d', delay(i)));
        imgs.forEach((el, i) => el.style.setProperty('--iz-rise-d', delay(i)));
        for (const el of [...items, ...imgs]) el.classList.remove('iz-rise--wait');
        window.clearTimeout(timer);
        timer = window.setTimeout(() => settleRise([...items, ...imgs]), 1800 + baseMs + Math.min(items.length, cap) * stepMs);
      };
    }
    // A paused timeline whose only job is to run fn when played (so CSS-driven entrances queue behind the curtain and
    // the once-triggers like every other entrance).
    function callTimeline(fn: () => void) {
      return gsap.timeline({ paused: true }).call(fn, [], 0.001).to({}, { duration: 0.02 });
    }
    function riseTimeline(items: HTMLElement[], imgs: HTMLElement[], stepMs: number, baseMs = 0, cap = Infinity) {
      return callTimeline(riseStart(items, imgs, stepMs, baseMs, cap));
    }
    // One element rising on enter (lite tier).
    // house: the house ease of the full-tier tween it replaces (v2-motion.css .iz-rise--house).
    function riseOne(el: HTMLElement, y: number, delayMs: number, quick: boolean, house = false) {
      prepareRise([el], [], y, quick);
      if (house) el.classList.add('iz-rise--house');
      onEnter(el, riseTimeline([el], [], 0, delayMs));
    }

    // Lite photo zoom: a CSS transition on the scale property (v2-motion.css .iz-zoom), which composes with the
    // parallax transform GSAP writes on desktop. The end scale stays until the page leaves, like the tween's did.
    function zoomPrep(img: HTMLElement, from: number, to: number, seconds: number, delayMs = 0) {
      img.style.setProperty('--iz-zoom-from', String(from));
      img.style.setProperty('--iz-zoom-to', String(to));
      img.style.setProperty('--iz-zoom-t', `${seconds}s`);
      img.style.setProperty('--iz-zoom-d', `${delayMs}ms`);
      img.classList.add('iz-zoom', 'iz-zoom--wait');
    }
    function zoomGo(img: HTMLElement) {
      img.classList.remove('iz-zoom--wait');
    }
    function unzoom(img: HTMLElement) {
      img.classList.remove('iz-zoom', 'iz-zoom--wait');
      for (const p of ['--iz-zoom-from', '--iz-zoom-to', '--iz-zoom-t', '--iz-zoom-d']) img.style.removeProperty(p);
    }
    // Scrubbed vertical drift of a photo in its frame, in percent of its height. In lite it drives the CSS translate
    // property through --iz-py (v2-motion.css .iz-zoom): once GSAP writes an element's transform it folds the CSS scale
    // into it and sets scale to none, which would freeze the lite zoom.
    function drift(img: HTMLElement, lit: boolean, from: number, to: number, scrollTrigger: ScrollTrigger.Vars) {
      if (lit) {
        gsap.fromTo(img, { '--iz-py': `${from}%` }, { '--iz-py': `${to}%`, ease: 'none', scrollTrigger });
        undo.push(() => img.style.removeProperty('--iz-py'));
      } else if (from === 0) gsap.to(img, { yPercent: to, ease: 'none', scrollTrigger });
      else gsap.fromTo(img, { yPercent: from }, { yPercent: to, ease: 'none', scrollTrigger });
    }

    // Lite photo wipe: a cover in the colour behind the box shrinks away with a transform (compositor) instead of a
    // clip-path tween repainting the photo every frame; "up" opens from the bottom, "left" from the right edge. The
    // cover is removed once it has run. Returns the function that starts it.
    function wipePrep(box: HTMLElement, dir: 'up' | 'left'): () => void {
      const cover = document.createElement('span');
      cover.className = `iz-wipe iz-wipe--${dir}`;
      cover.setAttribute('aria-hidden', 'true');
      cover.style.background = backdrop(box);
      const host = getComputedStyle(box).position === 'static';
      if (host) box.classList.add('iz-wipe-host');
      box.appendChild(cover);
      let timer = 0;
      const done = () => {
        window.clearTimeout(timer);
        cover.remove();
        if (host) box.classList.remove('iz-wipe-host');
      };
      undo.push(done);
      return () => {
        cover.classList.add('iz-wipe--open');
        timer = window.setTimeout(done, 1600);
      };
    }

    // Lite inset: a scrubbed clip-path inset becomes one transition on enter (v2-motion.css .iz-inset). The end inset
    // stays until the page leaves, like the end state of the scrubbed tween did.
    function insetPrep(el: HTMLElement, from: string, to: string): () => void {
      el.style.setProperty('--iz-inset-from', from);
      el.style.setProperty('--iz-inset-to', to);
      el.classList.add('iz-inset', 'iz-inset--wait');
      undo.push(() => {
        el.classList.remove('iz-inset', 'iz-inset--wait');
        el.style.removeProperty('--iz-inset-from');
        el.style.removeProperty('--iz-inset-to');
      });
      return () => el.classList.remove('iz-inset--wait');
    }

    // Large photos open from the bottom while the image settles, then drift slower than the page.
    function photos(scope: HTMLElement) {
      scope.querySelectorAll<HTMLElement>(`main :is(${PHOTOS})`).forEach(box => {
        if (inHero(box) || inScene(box) || !mine(box)) return;
        const img = box.querySelector<HTMLElement>('img');
        if (lite) {
          const wipe = wipePrep(box, 'up');
          if (img) zoomPrep(img, 1.4, 1.16, 1.8, 100);
          onEnter(
            box,
            callTimeline(() => {
              wipe();
              if (img) zoomGo(img);
            }),
            desktop ? 'top 82%' : START,
          );
        } else {
          const tl = gsap.timeline({ paused: true });
          // clearProps hands the corners back to CSS: a square inset left behind cut the rounded corners while the
          // photo inside kept moving (Sehan: corners sometimes straight, sometimes round).
          tl.fromTo(box, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.35, ease: 'expo.inOut', clearProps: 'clipPath' }, 0);
          if (img) tl.fromTo(img, { scale: 1.4 }, { scale: 1.16, duration: 1.8, ease: 'expo.out' }, 0.1);
          onEnter(box, tl, desktop ? 'top 82%' : START);
        }
        if (img && lite) undo.push(() => unzoom(img));
        if (img && desktop) {
          drift(img, lite, -6, 6, { trigger: box, start: 'top bottom', end: 'bottom top', scrub: true });
        }
      });
    }

    // Tourmax band: the dark sheet opens from an inset card to full width as it scrolls in, the photo panel wipes in
    // from the right and drifts, the spec rows draw their hairlines one by one and the size callout pops in. No pin,
    // so the page never holds on an empty gap.
    function tourmax(scope: HTMLElement) {
      const band = scope.querySelector<HTMLElement>('[data-scene="tourmax"]');
      if (!band || !mine(band)) return;
      const inset = desktop ? 'inset(6% 4% 6% 4% round 56px)' : 'inset(2% 3% 2% 3% round 40px)';
      const num = band.querySelector<HTMLElement>('.iz-band__num');
      const photo = band.querySelector<HTMLElement>('.iz-band__photo');
      const img = photo?.querySelector<HTMLElement>('img');
      const tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });
      if (lite) {
        // Lite: the inset opens and the big number moves once as the band arrives, instead of following the scroll;
        // the photo panel wipes in with a cover and zooms by transition.
        const open = insetPrep(band, inset, 'inset(0% 0% 0% 0% round 32px)');
        if (num) {
          prepareRise([num], [], '18%', false);
          num.style.setProperty('--iz-rise-o', '1');
        }
        onEnter(
          band,
          callTimeline(() => {
            open();
            if (num) riseStart([num], [], 0)();
          }),
        );
        if (photo) tl.call(wipePrep(photo, desktop ? 'left' : 'up'), [], 0.001);
        if (img) {
          zoomPrep(img, 1.35, 1.1, 2, 100);
          tl.call(() => zoomGo(img), [], 0.001);
          undo.push(() => unzoom(img));
        }
      } else {
        gsap.fromTo(
          band,
          { clipPath: inset },
          { clipPath: 'inset(0% 0% 0% 0% round 32px)', ease: 'none', scrollTrigger: { trigger: band, start: 'top bottom', end: 'top 35%', scrub: 1 } },
        );
        if (num) {
          gsap.fromTo(num, { yPercent: 18 }, { yPercent: -18, ease: 'none', scrollTrigger: { trigger: band, start: 'top bottom', end: 'bottom top', scrub: 1.2 } });
        }
        if (photo) tl.fromTo(photo, { clipPath: desktop ? 'inset(0% 0% 0% 100%)' : 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'expo.inOut', clearProps: 'clipPath' }, 0);
        if (img) tl.fromTo(img, { scale: 1.35 }, { scale: 1.1, duration: 2 }, 0.1);
      }
      const rows = band.querySelectorAll<HTMLElement>('.iz-spec');
      if (rows.length) {
        tl.fromTo(rows, { '--line': 0 }, { '--line': 1, duration: 1.2, ease: 'expo.inOut', stagger: 0.1 }, 0.2);
        tl.fromTo(Array.from(rows).map(r => r.children), { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.9, stagger: 0.05 }, 0.35);
      }
      const callout = band.querySelector<HTMLElement>('.iz-band__callout');
      if (callout) tl.fromTo(callout, { y: 30, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 1 }, 0.9);
      onEnter(band, tl, desktop ? 'top 70%' : 'top 85%');
      if (img && desktop) {
        drift(img, lite, -6, 6, { trigger: band, start: 'top bottom', end: 'bottom top', scrub: true });
      }
    }

    // Community filmstrip: on desktop the section pins and vertical scroll moves the strip sideways, each photo
    // drifting inside its frame. The pinned section fills the viewport, so there is no blank band under it. Phones
    // keep the native swipe row.
    function film(scope: HTMLElement) {
      const section = scope.querySelector<HTMLElement>('[data-scene="film"]');
      const track = section?.querySelector<HTMLElement>('.iz-film');
      if (!section || !track || !mine(section)) return;
      const photosIn = Array.from(track.children) as HTMLElement[];
      // Lite keeps the native swipe row on desktop too: no pin, no scrubbed strip.
      if (!desktop || lite) {
        // Phones keep the native swipe (a vertical scroll that moves things sideways feels wrong on touch); a
        // progress line follows the swipe.
        if (lite) {
          prepareRise(photosIn, [], desktop ? 60 : 40, false);
          onEnter(track, riseTimeline(photosIn, [], 80, 0, 3));
        } else {
          const tl = gsap.timeline({ paused: true });
          tl.fromTo(photosIn, { x: 60, opacity: 0 }, { x: 0, opacity: 1, duration: 1, ease: 'expo.out', stagger: 0.08 });
          onEnter(track, tl);
        }
        const bar = section.querySelector<HTMLElement>('.iz-film__progress > span');
        if (bar && track.scrollWidth > track.clientWidth + 8) {
          section.classList.add('is-swipe');
          const onScroll = () => {
            bar.style.transform = `scaleX(${(track.scrollLeft / Math.max(1, track.scrollWidth - track.clientWidth)).toFixed(4)})`;
          };
          onScroll();
          track.addEventListener('scroll', onScroll, { passive: true });
          undo.push(() => {
            track.removeEventListener('scroll', onScroll);
            section.classList.remove('is-swipe');
          });
        }
        return;
      }
      section.classList.add('is-pinned');
      // The block after the pinned stage sits a fixed 64 px below it (v2-overrides.css .iz-after-pin).
      const after = blocks.find(b => b.contains(section))?.nextElementSibling;
      after?.classList.add('iz-after-pin');
      undo.push(() => {
        section.classList.remove('is-pinned');
        after?.classList.remove('iz-after-pin');
      });
      const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
      if (distance() <= 0) return;
      const bar = section.querySelector<HTMLElement>('.iz-film__progress > span');
      const imgs = photosIn.map(ph => ph.querySelector('img')).filter((img): img is HTMLImageElement => !!img);
      // One scrubbed timeline drives the strip and the photo drift together. Per-photo containerAnimation triggers
      // left the pinned section offset by the full scroll distance in a fresh load (headless QA), so they are avoided.
      const move = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 0.9,
          invalidateOnRefresh: true,
          onUpdate: self => {
            if (bar) bar.style.transform = `scaleX(${self.progress.toFixed(4)})`;
          },
        },
      });
      move.to(track, { x: () => -distance(), ease: 'none' }, 0);
      if (imgs.length) move.fromTo(imgs, { xPercent: -8, scale: 1.2 }, { xPercent: 8, ease: 'none' }, 0);
      const tl = gsap.timeline({ paused: true });
      tl.fromTo(photosIn, { y: 90, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, ease: 'expo.out', stagger: 0.07 });
      onEnter(section, tl, 'top 70%');
    }

    // Reviews: the featured card slides in; the two wall columns run as a slow CSS marquee (v2-home.css).
    function reviews(scope: HTMLElement) {
      const section = scope.querySelector<HTMLElement>('[data-scene="reviews"]');
      if (!section || !mine(section)) return;
      const feature = section.querySelector<HTMLElement>('.iz-rfeature');
      const cols = section.querySelectorAll<HTMLElement>('.iz-rcol');
      const trigger = section.querySelector('.iz-reviews') ?? section;
      if (lite) {
        // Lite: the card and the columns rise through the compositor transitions, and the marquee (desktop, v2-home.css)
        // runs twice, then holds. The two runs are counted while the wall is on screen, not from page load: the
        // columns wait paused (.iz-rcol--wait) until the wall scrolls in and pause again whenever it leaves. Once a
        // column has run twice it holds (.iz-rcol--held) as a plain column with a thin scrollbar, so every card stays
        // reachable. The classes belong to this lite build only, so a wall set up in full keeps its endless loop after
        // a downgrade instead of jumping to the end.
        const items = [...(feature ? [feature] : []), ...Array.from(cols)];
        if (!items.length) return;
        prepareRise(items, [], desktop ? 50 : 40, false);
        onEnter(trigger, riseTimeline(items, [], 120), desktop ? 'top 80%' : START);
        const colList = Array.from(cols);
        if (!colList.length) return;
        const held = (e: AnimationEvent) => {
          const col = colList.find(c => c === (e.target as Element).parentElement);
          if (!col) return;
          col.classList.add('iz-rcol--held');
          // A held column is its own scroll box; Lenis (allowNestedScroll off) would turn the wheel into page scroll.
          col.setAttribute('data-lenis-prevent-wheel', '');
        };
        colList.forEach(col => {
          col.classList.add('iz-rcol--lite', 'iz-rcol--wait');
          col.addEventListener('animationend', held);
        });
        undo.push(() =>
          colList.forEach(col => {
            col.removeEventListener('animationend', held);
            col.classList.remove('iz-rcol--lite', 'iz-rcol--wait', 'iz-rcol--held');
            col.removeAttribute('data-lenis-prevent-wheel');
          }),
        );
        const wall = section.querySelector('.iz-reviews__wall') ?? trigger;
        ScrollTrigger.create({
          trigger: wall,
          start: 'top bottom',
          end: 'bottom top',
          onToggle: self => colList.forEach(col => col.classList.toggle('iz-rcol--wait', !self.isActive)),
        });
        return;
      }
      const tl = gsap.timeline({ paused: true });
      if (feature) tl.fromTo(feature, { x: desktop ? -60 : 0, y: desktop ? 0 : 40, opacity: 0 }, { x: 0, y: 0, opacity: 1, duration: 1.2, ease: 'expo.out' }, 0);
      if (cols.length) tl.fromTo(cols, { y: 70, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, ease: 'expo.out', stagger: 0.12 }, 0.1);
      onEnter(trigger, tl, desktop ? 'top 80%' : START);
    }

    function closing(scope: HTMLElement) {
      scope.querySelectorAll<HTMLElement>('main .iz-closing').forEach(el => {
        if (!mine(el)) return;
        const actions = el.querySelectorAll<HTMLElement>('.iz-btn, .iz-wa, .iz-link');
        if (lite) {
          // Lite: the inset opens once on enter instead of following the scroll; the actions rise by transition.
          onEnter(el, callTimeline(insetPrep(el, 'inset(0% 4% 0% 4% round 48px)', 'inset(0% 0% 0% 0% round 32px)')));
          if (actions.length) {
            const list = Array.from(actions);
            prepareRise(list, [], 30, false);
            for (const a of list) a.classList.add('iz-rise--house');
            onEnter(el, riseTimeline(list, [], 80, 250), desktop ? 'top 75%' : START);
          }
          return;
        }
        gsap.fromTo(
          el,
          { clipPath: 'inset(0% 4% 0% 4% round 48px)' },
          { clipPath: 'inset(0% 0% 0% 0% round 32px)', ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'top 45%', scrub: 1 } },
        );
        if (actions.length) {
          onEnter(el, gsap.fromTo(actions, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 1, stagger: 0.08, delay: 0.25, paused: true }), desktop ? 'top 75%' : START);
        }
      });
    }

    // Footer columns and the shop pills rise in one after another as the footer arrives.
    function footer(scope: HTMLElement) {
      const foot = scope.querySelector<HTMLElement>('.iz-footer');
      const cols = foot?.querySelector('.iz-footer__in')?.children;
      if (!foot || !cols?.length || !mine(foot)) return;
      if (lite) {
        // Lite: the same sequence through CSS: columns and pills rise, the divider draws by a transition on its
        // pseudo-element (v2-motion.css .iz-drawline).
        const colList = Array.from(cols) as HTMLElement[];
        const pillList = Array.from(foot.querySelectorAll<HTMLElement>('.iz-footer__shops > *'));
        const line = foot.querySelector<HTMLElement>('.iz-footer__bottom');
        prepareRise(colList, [], 40, false);
        if (pillList.length) prepareRise(pillList, [], 24, false);
        if (line) {
          line.classList.add('iz-drawline', 'iz-drawline--wait');
          undo.push(() => line.classList.remove('iz-drawline', 'iz-drawline--wait'));
        }
        const startCols = riseStart(colList, [], 70);
        const startPills = riseStart(pillList, [], 80, 350, 3);
        onEnter(
          foot,
          callTimeline(() => {
            startCols();
            if (pillList.length) startPills();
            line?.classList.remove('iz-drawline--wait');
          }),
          'top 92%',
        );
        return;
      }
      const tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });
      tl.fromTo(cols, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, stagger: 0.07 }, 0);
      const pills = foot.querySelectorAll('.iz-footer__shops > *');
      if (pills.length) tl.fromTo(pills, { x: -24, opacity: 0 }, { x: 0, opacity: 1, duration: 0.9, stagger: 0.08 }, 0.35);
      const bottom = foot.querySelector<HTMLElement>('.iz-footer__bottom');
      if (bottom) tl.fromTo(bottom, { '--line': 0 }, { '--line': 1, duration: 1.3, ease: 'expo.inOut' }, 0.3);
      onEnter(foot, tl, 'top 92%');

    }

    // Phones: rows that scroll sideways nudge left and back once when they arrive, so the swipe is discoverable. Desktop
    // lite gets it for the filmstrip, which stays a swipe row there.
    function swipe(scope: HTMLElement) {
      if (desktop && !lite) return;
      const rows = desktop ? 'main .iz-film' : 'main :is(.iz-film, .iz-scroller, .iz-reviews__wall)';
      scope.querySelectorAll<HTMLElement>(rows).forEach(row => {
        if (!mine(row) || owned(row) || row.scrollWidth <= row.clientWidth + 8) return;
        // A strip film() pinned in full before a probe downgrade is driven by the scrub; a nudge would freeze it.
        if (desktop && row.closest('.pin-spacer')) return;
        if (lite) {
          // Lite: one CSS keyframe on the row's cards instead of a GSAP tween per card (v2-motion.css .iz-nudge > *).
          let timer = 0;
          const done = () => {
            window.clearTimeout(timer);
            row.classList.remove('iz-nudge');
          };
          undo.push(done);
          onEnter(
            row,
            callTimeline(() => {
              row.classList.add('iz-nudge');
              timer = window.setTimeout(done, 2400);
            }),
            'top 75%',
          );
          return;
        }
        const items = Array.from(row.children).filter(el => (el as HTMLElement).offsetParent !== null);
        if (!items.length) return;
        const hint = gsap.timeline({ paused: true, delay: 0.9 });
        // fromTo initialises at setup (an idle moment); a to() first read the cards' transforms as the row arrived.
        hint
          .fromTo(items, { x: 0 }, { x: -36, duration: 0.5, ease: 'power2.inOut', stagger: 0.03 })
          .to(items, { x: 0, duration: 0.7, ease: 'expo.out', stagger: 0.03, onComplete: () => handBack(items) });
        onEnter(row, hint, 'top 75%');
      });
    }

    // Product page: gallery and buy box arrive once, quickly; nothing scrubs.
    function pdp(scope: HTMLElement) {
      const block = scope.querySelector<HTMLElement>('.iz-pdp');
      if (!block || bare || !mine(block)) return;
      const parts = Array.from(block.children) as HTMLElement[];
      if (lite) {
        prepareRise(parts, [], 24, true);
        play(riseTimeline(parts, [], 100));
        return;
      }
      const tl = gsap.timeline({ paused: true });
      tl.fromTo(parts, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.1 });
      play(tl);
    }

    // Garasi and position tiles lean a few degrees toward the pointer (fine pointers only).
    function tilt(scope: HTMLElement) {
      scope.querySelectorAll<HTMLElement>('.iz-gtile, .iz-cat, .iz-mtile, .iz-step, .iz-gfeature').forEach(card => {
        if (!mine(card) || owned(card)) return;
        // Set up on the first move over a card that has finished its entrance: GSAP reads the transform it finds when
        // it first touches an element, and a card still holding its .iz-rise from-state (translateY) would keep that
        // offset inline after the CSS transition ended.
        let rx: ((value: number) => void) | null = null;
        let ry: ((value: number) => void) | null = null;
        const move = (e: PointerEvent) => {
          if (!rx || !ry) {
            if (card.classList.contains('iz-rise')) return;
            // Inside the matchMedia context, so leaving the page reverts these like every setup-time tween.
            context.add(() => {
              gsap.set(card, { transformPerspective: 900 });
              rx = gsap.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power3.out' });
              ry = gsap.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power3.out' });
            });
            if (!rx || !ry) return;
          }
          const r = card.getBoundingClientRect();
          // Lite leans less: the same cue, quieter.
          const deg = lite ? 4 : 7;
          ry(((e.clientX - r.left) / r.width - 0.5) * deg);
          rx(-((e.clientY - r.top) / r.height - 0.5) * deg);
        };
        const leave = () => {
          rx?.(0);
          ry?.(0);
        };
        card.addEventListener('pointermove', move);
        card.addEventListener('pointerleave', leave);
        undo.push(() => {
          card.removeEventListener('pointermove', move);
          card.removeEventListener('pointerleave', leave);
        });
      });
    }

    // Catalogue filters, article topics and position tabs add, move or hide cards after load. Their triggers are
    // measured again, so a card moved into view reveals instead of staying invisible (review REV-01). Only these
    // containers are watched: split text also mutates the DOM, and refreshing on every split would stutter.
    let refreshTimer = 0;
    const relayout = new MutationObserver(() => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => ScrollTrigger.refresh(), 120);
    });
    root.querySelectorAll('main :is(.iz-catalog__grid, .iz-alist, .iz-motor-produk .iz-grid-4, .iz-guides)').forEach(list =>
      relayout.observe(list, { childList: true, attributes: true, attributeFilter: ['hidden', 'class'], subtree: true }),
    );
    undo.push(() => {
      relayout.disconnect();
      window.clearTimeout(refreshTimer);
    });

    ScrollTrigger.refresh();
    noteSetup();

    // The blocks below the first screen, in page order, once the curtain is up: one setup step of one block at a time,
    // about 8 ms of work per frame, and never while the page is moving. Setting a block up (splitting headings, from-
    // states, triggers) makes GSAP read computed styles, which forced a style recalc in the middle of scroll frames:
    // 36% of the main thread during a phone fling in the production profile (Sehan, 2026-10-29: scrolling stuttered,
    // worst on phones). The work waits for a pause instead. A block that reaches the screen before its turn is left as
    // it is (hiding it to play an entrance would blink), so a fast scroller simply sees it without one.
    const queue: (() => void)[] = [];
    const seen = new Set<HTMLElement>();
    later.forEach(block => {
      queue.push(() => {
        if (block.getBoundingClientRect().top < window.innerHeight * 1.05) seen.add(block);
      });
      steps.forEach(step =>
        queue.push(() => {
          if (seen.has(block) && !(settled && step === tiltStep)) return;
          active = block;
          try {
            step();
          } finally {
            active = null;
          }
        }),
      );
    });
    let lateTimer = 0;
    let lateFrame = 0;
    const next = () => {
      lateFrame = 0;
      if (!queue.length) return;
      if (scrollIdle()) {
        const start = performance.now();
        context.add(() => {
          do queue.shift()?.();
          while (queue.length && performance.now() - start < 8 && scrollIdle());
        });
        noteSetup();
      }
      if (queue.length) lateFrame = requestAnimationFrame(next);
    };
    const startLate = () => {
      window.clearTimeout(lateTimer);
      if (!lateFrame && queue.length) lateFrame = requestAnimationFrame(next);
    };
    const release = () => {
      shown = true;
      queued.splice(0).forEach(a => a.play());
    };
    let stop = whenRevealed(() => {
      release();
      // The hero letters are still landing until about 1.8 s after the reveal; the shop routes have no entrance.
      lateTimer = window.setTimeout(startLate, settled ? 100 : mode === 'full' ? 1500 : 300);
    });

    // Logo click on the page you are on (SiteMotion replay): only the hero entrance is rebuilt behind the curtain and
    // plays when it lifts; the rest of the page keeps its motion, so the logo hold stays short.
    intro = () =>
      context.add(() => {
        stop();
        shown = false;
        replayHero?.();
        stop = whenRevealed(release);
      });

    return () => {
      intro = () => {};
      stop();
      window.clearTimeout(lateTimer);
      if (lateFrame) cancelAnimationFrame(lateFrame);
      queue.length = 0;
      undo.forEach(fn => fn());
      splits.forEach(s => s.revert());
    };
  });

  return Object.assign(() => mm.revert(), { intro: () => intro() });
}
