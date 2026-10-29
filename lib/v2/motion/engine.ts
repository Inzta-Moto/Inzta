import type { SplitText as SplitTextType } from 'gsap/SplitText';
import type { MotionKit } from '@/lib/v2/motion/runtime';
import { DESKTOP, HOVER, MOBILE, whenRevealed } from '@/lib/v2/motion/runtime';

// "full" for the story pages (Beranda, Pilih motor, Artikel, Tentang); "light" for the shop routes under /produk,
// where only short fades run so nothing slows a buyer down (Sehan, 2026-10-29).
export type PageMode = 'full' | 'light';

type Split = InstanceType<typeof SplitTextType>;

const HEADINGS_FULL = 'h2.t-h2-landing, h1.t-h1-shop, h1.t-h1-article, h2.t-h2-shop';
const HEADINGS_LIGHT = 'h1.t-h1-shop, h1.t-h1-product, h2.t-h2-shop';
const GROUPS =
  '[data-reveal-stagger], .iz-garasi, .iz-row-cards, .iz-cats, .iz-guides, .iz-grid-4, .iz-grid-3, .iz-grid-2, .iz-ordersteps, .iz-steps, .iz-why__list, .iz-alist, .iz-notice__list';
const PHOTOS = '[data-reveal-clip], .iz-overlap__photo, .iz-gfeature';
const KREM = '#f3efe6';
const BATU_MUDA = '#7a7364';

const inHero = (el: Element) => !!el.closest('.iz-hero');
const inScene = (el: Element, name?: string) => !!el.closest(name ? `[data-scene="${name}"]` : '[data-scene]');
const textOnly = (el: Element) => el.children.length === 0 && !!el.textContent?.trim();

/**
 * Scroll and entrance motion for one v2 page (F-016 C5, design.md §8). It runs while the curtain still covers the
 * page: every from-state and every ScrollTrigger is created here, so the layout work happens out of sight, and the
 * entrances only play once the curtain lifts (whenRevealed). Creating dozens of triggers during the lift made the
 * curtain stutter. Hidden from-states use opacity, not visibility, so content waiting for its reveal stays in the
 * tab order (review REV-02). Only transform, opacity, clip-path, filter and colour on split text are animated. Everything
 * lives in one gsap.matchMedia, so the returned cleanup reverts every tween, trigger, pin and split before the next
 * route starts. Reduced motion matches neither query and leaves the page untouched.
 */
export function initPage(root: HTMLElement, kit: MotionKit, mode: PageMode): () => void {
  const { gsap, ScrollTrigger, SplitText } = kit;
  const mm = gsap.matchMedia();

  mm.add({ desktop: DESKTOP, mobile: MOBILE }, () => {
    const desktop = window.matchMedia(DESKTOP).matches;
    // On phones the next block is often only a few pixels into view; a later start left it blank under the fold.
    const START = desktop ? 'top 86%' : 'top 97%';
    const splits: Split[] = [];
    const undo: (() => void)[] = [];
    let shown = false;
    const queued: gsap.core.Animation[] = [];
    const play = (a: gsap.core.Animation) => (shown ? a.play() : queued.push(a));

    const onEnter = (trigger: Element, tween: gsap.core.Animation, start = START) => {
      ScrollTrigger.create({ trigger, start, once: true, onEnter: () => play(tween) });
    };
    // Split text is put back once its entrance has played, so later reflows and React updates see the original DOM.
    const split = (el: HTMLElement, type: string) => {
      const s = SplitText.create(el, { type, mask: 'lines', aria: 'auto' });
      splits.push(s);
      return s;
    };
    const unsplit = (s: Split) => () => s.revert();

    if (mode === 'full') {
      hero(root);
      headings(root, HEADINGS_FULL, true);
      eyebrows(root);
      leads(root);
      singles(root);
      groups(root, false);
      photos(root);
      tourmax(root);
      film(root);
      reviews(root);
      closing(root);
      footer(root);
      if (!desktop) swipe(root);
      if (window.matchMedia(HOVER).matches) tilt(root);
    } else {
      headings(root, HEADINGS_LIGHT, false);
      groups(root, true);
      pdp(root);
      footer(root);
    }

    function hero(scope: HTMLElement) {
      const section = scope.querySelector<HTMLElement>('main .iz-hero');
      if (!section) return;
      const img = section.querySelector<HTMLElement>('img');
      const body = section.querySelector<HTMLElement>('.iz-hero__body');
      const title = section.querySelector<HTMLElement>('h1');
      // A reload half-way down the page keeps the hero as it is; its entrance would play off screen.
      const visible = section.getBoundingClientRect().bottom > window.innerHeight * 0.35;
      if (visible) {
        const tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });
        if (img) tl.fromTo(img, { scale: 1.22 }, { scale: 1.08, duration: 2.2 }, 0);
        if (title) {
          const s = split(title, 'lines,words,chars');
          tl.fromTo(
            s.chars,
            { yPercent: 118, rotate: 7, color: BATU_MUDA },
            { yPercent: 0, rotate: 0, color: KREM, duration: 1.15, stagger: 0.018, onComplete: () => retype(section, title, s) },
            0.15,
          );
        }
        const lead = section.querySelector<HTMLElement>('.t-lead');
        if (lead) {
          const s = split(lead, 'lines');
          tl.fromTo(s.lines, { yPercent: 105 }, { yPercent: 0, duration: 1, stagger: 0.08, onComplete: unsplit(s) }, 0.55);
        }
        const extras = section.querySelectorAll('.iz-eyebrow, .iz-crumb, .iz-hero__body > .iz-row, .iz-hero__meta, .iz-hero__cue');
        tl.fromTo(extras, { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, stagger: 0.08 }, 0.7);
        play(tl);
        // A tab that paints no frames would leave the H1 hidden; finish the entrance instead.
        const safety = window.setTimeout(() => tl.progress(1), 6000);
        undo.push(() => window.clearTimeout(safety));
      } else {
        if (img) gsap.set(img, { scale: 1.08 });
        if (title) retype(section, title, split(title, 'lines,words,chars'));
      }
      // Leaving: the photo sinks slower than the page and the copy lifts and fades (scrubbed, no pin). Desktop only:
      // scrubbed parallax on phones fights the collapsing address bar.
      if (img && desktop) {
        gsap.to(img, { yPercent: 9, ease: 'none', scrollTrigger: { trigger: section, start: 'top top', end: 'bottom top', scrub: true } });
      }
      if (body && desktop) {
        gsap.to(body, { y: -70, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: section, start: 'top top', end: 'bottom 25%', scrub: true } });
      }
    }

    // The production hero types its title; this retypes the last line of the hero title in a loop after the
    // entrance: letters drop out from the end behind a yellow caret, the caret blinks, then they rise back sharp
    // (Sehan, 2026-10-29). The H1 keeps its full text for screen readers and search (SplitText aria). The loop
    // pauses while the hero is off screen, and a width change re-splits the lines and starts again.
    function retype(section: HTMLElement, title: HTMLElement, first: Split) {
      let s = first;
      let loop: gsap.core.Timeline | null = null;
      let caret: HTMLElement | null = null;
      let width = title.offsetWidth;
      const build = () => {
        const line = s.lines[s.lines.length - 1] as HTMLElement | undefined;
        if (!line) return;
        const chars = (s.chars as HTMLElement[]).filter(c => line.contains(c));
        if (chars.length < 2) return;
        line.style.position = 'relative';
        caret = document.createElement('span');
        caret.className = 'iz-caret';
        caret.setAttribute('aria-hidden', 'true');
        line.appendChild(caret);
        const at = (i: number) => {
          const base = line.getBoundingClientRect();
          const x = i < 0 ? chars[0].getBoundingClientRect().left - base.left : chars[i].getBoundingClientRect().right - base.left;
          gsap.set(caret, { x });
        };
        const index = (t: gsap.core.Tween) => chars.indexOf(t.targets()[0] as HTMLElement);
        loop = gsap.timeline({ repeat: -1, repeatDelay: 3.4, delay: 1.4 });
        loop
          .call(() => at(chars.length - 1))
          .to(caret, { autoAlpha: 1, duration: 0.15 })
          .to(chars.slice().reverse(), {
            yPercent: 70,
            opacity: 0,
            filter: 'blur(6px)',
            duration: 0.24,
            ease: 'power2.in',
            stagger: {
              each: 0.042,
              onStart() {
                at(index(this as unknown as gsap.core.Tween) - 1);
              },
            },
          })
          .to(caret, { autoAlpha: 0.15, duration: 0.14, repeat: 3, yoyo: true, ease: 'steps(1)' })
          .fromTo(
            chars,
            { yPercent: -70, opacity: 0, filter: 'blur(6px)' },
            {
              yPercent: 0,
              opacity: 1,
              filter: 'blur(0px)',
              duration: 0.42,
              ease: 'power3.out',
              stagger: {
                each: 0.058,
                onStart() {
                  at(index(this as unknown as gsap.core.Tween));
                },
              },
            },
          )
          .to(caret, { autoAlpha: 0, duration: 0.3 }, '+=0.7');
      };
      build();
      const watch = ScrollTrigger.create({
        trigger: section,
        start: 'top bottom',
        end: 'bottom top',
        onToggle: self => (self.isActive ? loop?.resume() : loop?.pause()),
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
          s = split(title, 'lines,words,chars');
          gsap.set(s.chars, { color: KREM });
          build();
        }, 250);
      };
      window.addEventListener('resize', onResize);
      undo.push(() => {
        window.removeEventListener('resize', onResize);
        window.clearTimeout(timer);
        watch.kill();
        loop?.kill();
        caret?.remove();
      });
    }

    function headings(scope: HTMLElement, selector: string, splitWords: boolean) {
      scope.querySelectorAll<HTMLElement>(selector).forEach(el => {
        if (inHero(el) || !el.textContent?.trim()) return;
        if (!splitWords) {
          onEnter(el, gsap.fromTo(el, { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, paused: true }));
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
        if (inHero(el) || !textOnly(el)) return;
        const text = el.textContent!.trim();
        const sr = document.createElement('span');
        sr.className = 'iz-sr';
        sr.textContent = text;
        const vis = document.createElement('span');
        vis.setAttribute('aria-hidden', 'true');
        vis.textContent = text;
        el.replaceChildren(sr, vis);
        undo.push(() => el.replaceChildren(document.createTextNode(text)));
        const tween = gsap.fromTo(
          vis,
          { opacity: 0 },
          { opacity: 1, duration: 1.1, ease: 'none', paused: true, scrambleText: { text, chars: 'ABCDEFGHIJKLMNOPRSTUVWXYZ', speed: 0.6, revealDelay: 0.25 } },
        );
        onEnter(el, tween);
      });
    }

    function leads(scope: HTMLElement) {
      scope.querySelectorAll<HTMLElement>('main .iz-head > p, main .iz-head > div > p, main .iz-head .t-lead').forEach(el => {
        if (inHero(el)) return;
        onEnter(el, gsap.fromTo(el, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 1, delay: 0.15, paused: true }));
      });
    }

    function singles(scope: HTMLElement) {
      scope.querySelectorAll<HTMLElement>('main [data-reveal]').forEach(el => {
        if (inHero(el)) return;
        onEnter(el, gsap.fromTo(el, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 1, paused: true }));
      });
    }

    function groups(scope: HTMLElement, light: boolean) {
      scope.querySelectorAll<HTMLElement>(`main :is(${GROUPS})`).forEach(group => {
        // Only leaf groups animate, so a grid inside a grid is not moved twice; scenes run their own motion.
        if (inHero(group) || inScene(group, 'film') || inScene(group, 'reviews') || inScene(group, 'tourmax') || group.querySelector(GROUPS)) return;
        const items = Array.from(group.children) as HTMLElement[];
        if (!items.length) return;
        if (light) {
          // Long catalogue grids reveal row by row as they come into view.
          gsap.set(items, { y: 28, opacity: 0 });
          ScrollTrigger.batch(items, {
            start: 'top 94%',
            once: true,
            onEnter: batch => play(gsap.to(batch, { y: 0, opacity: 1, duration: 0.6, stagger: 0.05, overwrite: true, paused: true, clearProps: 'transform,opacity,visibility' })),
          });
          return;
        }
        const tl = gsap.timeline({ paused: true });
        // clearProps hands the cards back to CSS afterwards; a leftover inline transform blocked their hover lift.
        tl.fromTo(items, { y: desktop ? 80 : 36, opacity: 0 }, { y: 0, opacity: 1, duration: 1.15, ease: 'expo.out', stagger: 0.085, clearProps: 'transform,opacity,visibility' }, 0);
        const imgs = items.map(item => item.querySelector('img')).filter((img): img is HTMLImageElement => !!img);
        if (imgs.length) tl.fromTo(imgs, { scale: 1.28 }, { scale: 1, duration: 1.7, ease: 'expo.out', stagger: 0.085, clearProps: 'scale' }, 0);
        onEnter(group, tl);
      });
    }

    // Large photos open from the bottom while the image settles, then drift slower than the page.
    function photos(scope: HTMLElement) {
      scope.querySelectorAll<HTMLElement>(`main :is(${PHOTOS})`).forEach(box => {
        if (inHero(box) || inScene(box)) return;
        const img = box.querySelector<HTMLElement>('img');
        const tl = gsap.timeline({ paused: true });
        tl.fromTo(box, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.35, ease: 'expo.inOut' }, 0);
        if (img) tl.fromTo(img, { scale: 1.4 }, { scale: 1.16, duration: 1.8, ease: 'expo.out' }, 0.1);
        onEnter(box, tl, desktop ? 'top 82%' : START);
        if (img && desktop) {
          gsap.fromTo(img, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: box, start: 'top bottom', end: 'bottom top', scrub: true } });
        }
      });
    }

    // Tourmax band: the dark sheet opens from an inset card to full width as it scrolls in, the photo panel wipes in
    // from the right and drifts, the spec rows draw their hairlines one by one and the size callout pops in. No pin,
    // so the page never holds on an empty gap.
    function tourmax(scope: HTMLElement) {
      const band = scope.querySelector<HTMLElement>('[data-scene="tourmax"]');
      if (!band) return;
      gsap.fromTo(
        band,
        { clipPath: desktop ? 'inset(6% 4% 6% 4% round 56px)' : 'inset(2% 3% 2% 3% round 40px)' },
        { clipPath: 'inset(0% 0% 0% 0% round 32px)', ease: 'none', scrollTrigger: { trigger: band, start: 'top bottom', end: 'top 35%', scrub: 1 } },
      );
      const num = band.querySelector<HTMLElement>('.iz-band__num');
      if (num) {
        gsap.fromTo(num, { yPercent: 18 }, { yPercent: -18, ease: 'none', scrollTrigger: { trigger: band, start: 'top bottom', end: 'bottom top', scrub: 1.2 } });
      }
      const tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });
      const photo = band.querySelector<HTMLElement>('.iz-band__photo');
      const img = photo?.querySelector<HTMLElement>('img');
      if (photo) tl.fromTo(photo, { clipPath: desktop ? 'inset(0% 0% 0% 100%)' : 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'expo.inOut' }, 0);
      if (img) tl.fromTo(img, { scale: 1.35 }, { scale: 1.1, duration: 2 }, 0.1);
      const rows = band.querySelectorAll<HTMLElement>('.iz-spec');
      if (rows.length) {
        tl.fromTo(rows, { '--line': 0 }, { '--line': 1, duration: 1.2, ease: 'expo.inOut', stagger: 0.1 }, 0.2);
        tl.fromTo(Array.from(rows).map(r => r.children), { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.9, stagger: 0.05 }, 0.35);
      }
      const callout = band.querySelector<HTMLElement>('.iz-band__callout');
      if (callout) tl.fromTo(callout, { y: 30, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 1 }, 0.9);
      onEnter(band, tl, desktop ? 'top 70%' : 'top 85%');
      if (img && desktop) {
        gsap.fromTo(img, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: band, start: 'top bottom', end: 'bottom top', scrub: true } });
      }
    }

    // Community filmstrip: on desktop the section pins and vertical scroll moves the strip sideways, each photo
    // drifting inside its frame. The pinned section fills the viewport, so there is no blank band under it. Phones
    // keep the native swipe row.
    function film(scope: HTMLElement) {
      const section = scope.querySelector<HTMLElement>('[data-scene="film"]');
      const track = section?.querySelector<HTMLElement>('.iz-film');
      if (!section || !track) return;
      const photosIn = Array.from(track.children) as HTMLElement[];
      if (!desktop) {
        // Phones keep the native swipe (a vertical scroll that moves things sideways feels wrong on touch); a
        // progress line follows the swipe.
        const tl = gsap.timeline({ paused: true });
        tl.fromTo(photosIn, { x: 60, opacity: 0 }, { x: 0, opacity: 1, duration: 1, ease: 'expo.out', stagger: 0.08 });
        onEnter(track, tl);
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
      undo.push(() => section.classList.remove('is-pinned'));
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
      if (!section) return;
      const feature = section.querySelector<HTMLElement>('.iz-rfeature');
      const cols = section.querySelectorAll<HTMLElement>('.iz-rcol');
      const tl = gsap.timeline({ paused: true });
      if (feature) tl.fromTo(feature, { x: desktop ? -60 : 0, y: desktop ? 0 : 40, opacity: 0 }, { x: 0, y: 0, opacity: 1, duration: 1.2, ease: 'expo.out' }, 0);
      if (cols.length) tl.fromTo(cols, { y: 70, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, ease: 'expo.out', stagger: 0.12 }, 0.1);
      onEnter(section.querySelector('.iz-reviews') ?? section, tl, desktop ? 'top 80%' : START);
    }

    function closing(scope: HTMLElement) {
      scope.querySelectorAll<HTMLElement>('main .iz-closing').forEach(el => {
        gsap.fromTo(
          el,
          { clipPath: 'inset(0% 4% 0% 4% round 48px)' },
          { clipPath: 'inset(0% 0% 0% 0% round 32px)', ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'top 45%', scrub: 1 } },
        );
        const actions = el.querySelectorAll('.iz-btn, .iz-wa, .iz-link');
        if (actions.length) {
          onEnter(el, gsap.fromTo(actions, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 1, stagger: 0.08, delay: 0.25, paused: true }), desktop ? 'top 75%' : START);
        }
      });
    }

    // Footer columns and the shop pills rise in one after another as the footer arrives.
    function footer(scope: HTMLElement) {
      const foot = scope.querySelector<HTMLElement>('.iz-footer');
      const cols = foot?.querySelector('.iz-footer__in')?.children;
      if (!foot || !cols?.length) return;
      const tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });
      tl.fromTo(cols, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, stagger: 0.07 }, 0);
      const pills = foot.querySelectorAll('.iz-footer__shops > *');
      if (pills.length) tl.fromTo(pills, { x: -24, opacity: 0 }, { x: 0, opacity: 1, duration: 0.9, stagger: 0.08 }, 0.35);
      onEnter(foot, tl, 'top 92%');
    }

    // Phones: rows that scroll sideways nudge left and back once when they arrive, so the swipe is discoverable.
    function swipe(scope: HTMLElement) {
      scope.querySelectorAll<HTMLElement>('main :is(.iz-film, .iz-scroller, .iz-reviews__wall)').forEach(row => {
        if (row.scrollWidth <= row.clientWidth + 8) return;
        const items = Array.from(row.children).filter(el => (el as HTMLElement).offsetParent !== null);
        if (!items.length) return;
        const hint = gsap.timeline({ paused: true, delay: 0.9 });
        hint.to(items, { x: -36, duration: 0.5, ease: 'power2.inOut', stagger: 0.03 }).to(items, { x: 0, duration: 0.7, ease: 'expo.out', stagger: 0.03 });
        onEnter(row, hint, 'top 75%');
      });
    }

    // Product page: gallery and buy box arrive once, quickly; nothing scrubs.
    function pdp(scope: HTMLElement) {
      const block = scope.querySelector<HTMLElement>('.iz-pdp');
      if (!block) return;
      const parts = Array.from(block.children) as HTMLElement[];
      const tl = gsap.timeline({ paused: true });
      tl.fromTo(parts, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.1 });
      play(tl);
    }

    // Garasi and position tiles lean a few degrees toward the pointer (fine pointers only).
    function tilt(scope: HTMLElement) {
      scope.querySelectorAll<HTMLElement>('.iz-gtile, .iz-cat, .iz-mtile, .iz-step, .iz-gfeature').forEach(card => {
        gsap.set(card, { transformPerspective: 900 });
        const rx = gsap.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power3.out' });
        const ry = gsap.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power3.out' });
        const move = (e: PointerEvent) => {
          const r = card.getBoundingClientRect();
          ry(((e.clientX - r.left) / r.width - 0.5) * 7);
          rx(-((e.clientY - r.top) / r.height - 0.5) * 7);
        };
        const leave = () => {
          rx(0);
          ry(0);
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
    const stop = whenRevealed(() => {
      shown = true;
      queued.splice(0).forEach(a => a.play());
    });

    return () => {
      stop();
      undo.forEach(fn => fn());
      splits.forEach(s => s.revert());
    };
  });

  return () => mm.revert();
}
