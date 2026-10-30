import type { MotionKit } from '@/lib/v2/motion/runtime';
import { DESKTOP, MOBILE, handBack, motionTier, noteSetup, onTierChange, scrollIdle, whenRevealed } from '@/lib/v2/motion/runtime';

type Gsap = MotionKit['gsap'];
type Timeline = gsap.core.Timeline;
type SceneControl = { duration: number; play: () => void; finish: () => void; rewind: () => void };

// Pin length in viewport heights: room for three stops without dragging (the asked range was 1.5 to 2.2).
const TRAVEL = 1.6;
// Room the pinned block needs above and below it inside the viewport; the navbar slides back in on scroll up.
const ROOM = 72;
// The pinned timeline: hold on step 1, fill road 1, hold on step 2, fill road 2, hold on step 3. Sums to 1, so the
// numbers are fractions of the pin.
const PLAN = { hold1: 0.2, fill: 0.16, hold2: 0.24, hold3: 0.24 };
const AT_2 = PLAN.hold1 + PLAN.fill;
const AT_3 = AT_2 + PLAN.hold2 + PLAN.fill;
// Any refreshPriority turns on ScrollTrigger's page-order sort for every global refresh. 0 keeps this pin in page
// order: measured after the film pin above it, and before the closing panel and footer triggers below it. A negative
// value would refresh it after those, measuring them without its spacing (QA: they then fired a pin length early).
const PRIORITY = 0;
// Longest wait for the page engine to set up the film pin above before the journey is measured anyway.
const ENGINE_WAIT_MS = 3000;
// Lite tier (lib/v2/motion/tier.ts): stagger between the three steps of the CSS entrance, the pause between a scene
// ending and the road to the next step filling, and the road fill itself (v2-howto.css .iz-howto--ease).
const LITE_STAGGER_MS = 100;
const LITE_PAUSE_MS = 350;
const LITE_FILL_MS = 600;

const q = (el: ParentNode, sel: string) => el.querySelector<HTMLElement>(sel);
const qa = (el: ParentNode, sel: string) => Array.from(el.querySelectorAll<HTMLElement>(sel));

// Each scene builder returns a paused timeline whose first frame is the scene before the step and whose last frame is
// the server markup (v2-howto.css), so reverting it leaves the finished scene. Offsets are percentages of the moving
// element, which keeps them right at every scene scale.
// lite (motion tier): the same beats, presses and pulse rings included (small transform and opacity tweens, already
// compositor work); only the steps that repaint change technique (the pre-filled lines, the typing dots).
function pickScene(gsap: Gsap, el: HTMLElement): Timeline {
  const tl = gsap.timeline({ paused: true });
  const cursor = q(el, '.iz-vig-cursor');
  const ring = q(el, '.iz-vig-cursor__ring');
  const plus = q(el, '.iz-vig-pick__btn--plus');
  const [one, two] = qa(el, '.iz-vig-pick__num > span');
  const back = q(el, '.iz-vig-pick__photo--back');
  const pair = q(el, '.iz-vig-pick__pair');
  if (!cursor || !ring || !plus || !one || !two || !back || !pair) return tl;
  tl.fromTo(cursor, { xPercent: 260, yPercent: 150, opacity: 0 }, { xPercent: 0, yPercent: 0, opacity: 1, duration: 0.75, ease: 'power3.out' }, 0.2)
    .fromTo(cursor, { scale: 1 }, { scale: 0.82, duration: 0.09, ease: 'power2.in', yoyo: true, repeat: 1 }, 0.98)
    .fromTo(plus, { scale: 1 }, { scale: 0.8, duration: 0.09, ease: 'power2.in', yoyo: true, repeat: 1 }, 0.98)
    .fromTo(ring, { scale: 0.3, opacity: 0.8 }, { scale: 1.9, opacity: 0, duration: 0.55, ease: 'power2.out' }, 1.02)
    // y: 0 as well: GSAP reads the resting translateY(-110%) of the "1" from CSS as a pixel y and would keep it.
    .fromTo(one, { y: 0, yPercent: 0 }, { y: 0, yPercent: -110, duration: 0.45, ease: 'power3.inOut' }, 1.05)
    .fromTo(two, { y: 0, yPercent: 110 }, { y: 0, yPercent: 0, duration: 0.45, ease: 'power3.inOut' }, 1.05)
    .fromTo(back, { rotate: 0, opacity: 0 }, { rotate: -10, opacity: 1, duration: 0.65, ease: 'back.out(1.8)' }, 1.15)
    .fromTo(pair, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(2.2)' }, 1.35)
    .to(cursor, { xPercent: 120, yPercent: 80, opacity: 0, duration: 0.5, ease: 'power2.in' }, 1.95);
  return tl;
}

function sendScene(gsap: Gsap, el: HTMLElement, lite: boolean): Timeline {
  const tl = gsap.timeline({ paused: true });
  const cta = q(el, '.iz-vig-send__cta');
  const note = q(el, '.iz-vig-send__note');
  const btn = q(el, '.iz-vig-send__btn');
  const cursor = q(el, '.iz-vig-cursor');
  const ring = q(el, '.iz-vig-cursor__ring');
  const wa = q(el, '.iz-vig-send__wa');
  const go = q(el, '.iz-vig-send__go');
  const lines = qa(el, '.iz-vig-send__line:not(.iz-vig-send__line--gap)');
  if (!cta || !note || !btn || !cursor || !ring || !wa || !go || !lines.length) return tl;
  // Before the step the order button waits in the middle of the scene under the product page's note, as in the buy
  // box; once pressed it moves to its corner while WhatsApp opens and the pre-filled text appears line by line.
  tl.fromTo(cta, { xPercent: 44, yPercent: -205, rotate: 0, scale: 1.12 }, { xPercent: 0, yPercent: 0, rotate: -3, scale: 1, duration: 0.65, ease: 'power3.inOut' }, 1.05)
    .fromTo(note, { opacity: 1 }, { opacity: 0, duration: 0.25, ease: 'none' }, 0.98)
    .fromTo(cursor, { xPercent: 200, yPercent: 140, opacity: 0 }, { xPercent: 0, yPercent: 0, opacity: 1, duration: 0.7, ease: 'power3.out' }, 0.15)
    .fromTo(cursor, { scale: 1 }, { scale: 0.82, duration: 0.09, ease: 'power2.in', yoyo: true, repeat: 1 }, 0.88)
    .fromTo(btn, { scale: 1 }, { scale: 0.93, duration: 0.1, ease: 'power2.inOut', yoyo: true, repeat: 1 }, 0.88)
    .fromTo(ring, { scale: 0.3, opacity: 0.8 }, { scale: 1.9, opacity: 0, duration: 0.55, ease: 'power2.out' }, 0.92)
    .to(cursor, { opacity: 0, duration: 0.25, ease: 'none' }, 1.05)
    .fromTo(wa, { opacity: 0, scale: 0.8, yPercent: 8 }, { opacity: 1, scale: 1, yPercent: 0, duration: 0.6, ease: 'back.out(1.4)' }, 1.2);
  // Lite: the pre-filled lines fade and slide in (compositor) instead of a clip-path wipe that repaints each frame.
  if (lite) tl.fromTo(lines, { opacity: 0, xPercent: -4 }, { opacity: 1, xPercent: 0, duration: 0.3, ease: 'power2.out', stagger: 0.16 }, 1.5);
  else tl.fromTo(lines, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.3, ease: 'none', stagger: 0.16 }, 1.5);
  tl.fromTo(go, { scale: 0.5, opacity: 0.35 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(2.4)' }, 2.3)
    .to(go, { scale: 1.14, duration: 0.18, ease: 'power1.inOut', yoyo: true, repeat: 1 }, 2.75);
  return tl;
}

function replyScene(gsap: Gsap, el: HTMLElement, lite: boolean): Timeline {
  const tl = gsap.timeline({ paused: true });
  const out = q(el, '.iz-vig-reply__out');
  const read = q(el, '.iz-vig-ticks__read');
  const typing = q(el, '.iz-vig-reply__typing');
  const dots = qa(el, '.iz-vig-reply__typing > i');
  const reply = q(el, '.iz-vig-reply__in');
  const chips = qa(el, '.iz-vig-reply__chip');
  const checks = qa(el, '.iz-vig-reply__chip > svg');
  if (!out || !read || !typing || !dots.length || !reply || !chips.length) return tl;
  // Before the step the order sits in the chat as sent (grey ticks). Then it is read (blue ticks), the admin types for
  // a moment, and the reply arrives with its two confirmations. The dots bounce a few times only, so nothing loops
  // while the scene sits finished.
  // Lite: the dots bounce once instead of twice.
  tl.fromTo(out, { scale: 1 }, { scale: 1.04, duration: 0.18, ease: 'power1.out', yoyo: true, repeat: 1, transformOrigin: '100% 100%' }, 0.2)
    .fromTo(read, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'none' }, 0.35)
    .fromTo(typing, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2)' }, 0.55)
    .fromTo(dots, { yPercent: 0 }, { yPercent: -80, duration: 0.22, ease: 'sine.inOut', yoyo: true, repeat: lite ? 1 : 3, stagger: 0.1 }, 0.65)
    .to(typing, { opacity: 0, scale: 0.8, duration: 0.2, ease: 'power2.in' }, 1.65)
    .fromTo(reply, { opacity: 0, scale: 0.86, yPercent: 8 }, { opacity: 1, scale: 1, yPercent: 0, duration: 0.5, ease: 'back.out(1.5)' }, 1.7)
    .fromTo(chips, { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.42, ease: 'back.out(2.2)', stagger: 0.16 }, 2.05);
  if (checks.length) tl.fromTo(checks, { scale: 0, rotate: -40 }, { scale: 1, rotate: 0, duration: 0.35, ease: 'back.out(3)', stagger: 0.16 }, 2.2);
  return tl;
}

// Plays a scene when its step lights up, hurries it to its end once the step is passed, and winds it back quickly when
// the visitor scrolls back above it, so it plays again next time.
function control(gsap: Gsap, step: HTMLElement, lite: boolean): SceneControl {
  const el = q(step, '.iz-vig');
  let tl: Timeline;
  if (!el) tl = gsap.timeline({ paused: true });
  else if (el.classList.contains('iz-vig-pick')) tl = pickScene(gsap, el);
  else if (el.classList.contains('iz-vig-send')) tl = sendScene(gsap, el, lite);
  else tl = replyScene(gsap, el, lite);
  // Initialise every tween now, while the page is still (the build waits for that), instead of on first play, when a
  // to() reads its start values from computed style in the middle of a scroll. Events are suppressed both ways.
  tl.progress(1, true).progress(0, true);
  return {
    duration: tl.duration(),
    play: () => {
      tl.timeScale(1).play();
    },
    finish: () => {
      if (tl.progress() < 1) tl.timeScale(2.5).play();
    },
    rewind: () => {
      if (tl.progress() > 0) tl.timeScale(2.5).reverse();
    },
  };
}

// Cards rise, numerals come up, nodes pop and the roads draw in, step by step.
function entrance(gsap: Gsap, steps: HTMLElement[]): Timeline {
  const pick = (sel: string) => steps.map(s => q(s, sel)).filter((el): el is HTMLElement => !!el);
  const cards = pick('.iz-journey__card');
  const numerals = pick('.iz-journey__n');
  const nodes = pick('.iz-journey__node');
  // handBack instead of clearProps: clearing transforms made GSAP re-read them from computed style mid-scroll.
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' }, onComplete: () => handBack([...cards, ...numerals, ...nodes]) });
  tl.fromTo(cards, { y: 56, opacity: 0, rotate: 1.2 }, { y: 0, opacity: 1, rotate: 0, duration: 1.15, stagger: 0.14 }, 0)
    .fromTo(numerals, { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.9, stagger: 0.14 }, 0.05)
    .fromTo(nodes, { scale: 0 }, { scale: 1, duration: 0.6, ease: 'back.out(2)', stagger: 0.14 }, 0.3);
  const roads = pick('.iz-journey__road');
  if (roads.length) tl.fromTo(roads, { '--hw-draw': 0 }, { '--hw-draw': 1, duration: 0.9, ease: 'expo.inOut', stagger: 0.14 }, 0.45);
  return tl;
}

/**
 * Motion of "Pesan dalam tiga langkah" (F-016 S1.10, Sehan 2026-10-29). Desktop: the section pins in the middle of the
 * viewport and scrolling walks it 1 -> 2 -> 3; the road between the numerals fills with the scroll (scrubbed) and each
 * step's scene plays as the step lights up. A desktop window too short for the pinned block gets the same walk once,
 * on a timer. Phones and tablets: no pin, each card lights up and plays as it scrolls in. Reduced motion never gets
 * here (HowToStage), and matches neither query.
 *
 * Everything is created after the curtain lifts, once the section is within 1.5 viewports, and after the page engine
 * has set up the film pin above (it does the blocks below the first screen after the curtain), so the pin is measured
 * in page order; a refresh then measures the closing panel and footer below it again. Cards are only hidden for their
 * entrance when the section is still below the viewport, so nothing on screen blinks out. Returns the cleanup.
 *
 * Lite tier (lib/v2/motion/tier.ts): no pin on any width. The same 1 -> 2 -> 3 walk is driven by the steps reaching the
 * viewport (desktop: the row arrives and the walk plays on a timer; phones: each card lights as it scrolls in), the
 * entrance and the road fills are CSS transitions on transform and opacity (v2-howto.css .iz-howto--lite), and the
 * scenes keep every beat (only the pre-filled lines and the typing dots change technique). A downgrade from the frame probe before the visitor has
 * reached the section rebuilds it in lite; once the walk has started it is left as it is.
 */
export function attachHowTo(root: HTMLElement, kit: MotionKit): () => void {
  const { gsap, ScrollTrigger } = kit;
  const steps = qa(root, '.iz-journey__step');
  const list = q(root, '.iz-journey');
  if (steps.length !== 3 || !list) return () => {};

  let disposed = false;
  let mm: gsap.MatchMedia | null = null;
  let io: IntersectionObserver | null = null;
  let frame = 0;
  let resizeTimer = 0;
  let pinFits: boolean | null = null;
  // Which tier the current build used, and whether its walk has lit a step yet (a downgrade only rebuilds before that).
  let builtLite = false;
  let touched = false;

  const fits = () => root.offsetHeight + ROOM * 2 <= window.innerHeight;
  const stepAt = (p: number) => (p >= AT_3 - 1e-3 ? 2 : p >= AT_2 - 1e-3 ? 1 : 0);

  function build(desktop: boolean): () => void {
    const below = root.getBoundingClientRect().top >= window.innerHeight;
    const lite = motionTier() === 'lite';
    builtLite = lite;
    const scenes = steps.map(step => control(gsap, step, lite));
    const roads = steps.map(s => q(s, '.iz-journey__road')).filter((el): el is HTMLElement => !!el);
    root.classList.add('iz-howto--live');

    let active = -1;
    const setActive = (n: number) => {
      if (n === active) return;
      active = n;
      touched = true;
      // The last stop marks every step reached (v2-howto.css .iz-howto--complete).
      root.classList.toggle('iz-howto--complete', n === steps.length - 1);
      steps.forEach((step, i) => {
        step.classList.toggle('iz-journey__step--on', i === n);
        step.classList.toggle('iz-journey__step--done', i < n);
        if (i === n) scenes[i].play();
        else if (i < n) scenes[i].finish();
        else scenes[i].rewind();
      });
    };
    const cleanup = () => {
      root.classList.remove('iz-howto--live', 'iz-howto--complete');
      steps.forEach(s => s.classList.remove('iz-journey__step--on', 'iz-journey__step--done'));
    };

    if (lite) return buildLite(desktop, below, setActive, () => active, scenes, cleanup);

    if (!desktop) {
      pinFits = null;
      gsap.set(roads, { '--hw-fill': 0 });
      const reach = (i: number) => {
        if (i <= active) return;
        // fromTo: a to() read the custom property's start from computed style while the visitor scrolled.
        for (let j = Math.max(0, active); j < i; j++) gsap.fromTo(roads[j], { '--hw-fill': 0 }, { '--hw-fill': 1, duration: 0.7, ease: 'power2.inOut' });
        setActive(i);
      };
      steps.forEach((step, i) => {
        const card = q(step, '.iz-journey__card');
        if (!card) return;
        if (card.getBoundingClientRect().top >= window.innerHeight) {
          const rise = gsap.fromTo(card, { y: 36, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: 'expo.out', paused: true, onComplete: () => handBack([card]) });
          ScrollTrigger.create({ trigger: card, start: 'top 96%', once: true, onEnter: () => rise.play() });
        }
        // Lights up once the card is well in view; at 72% the next card lit while the first was still mid-screen.
        ScrollTrigger.create({ trigger: card, start: 'top 62%', once: true, onEnter: () => reach(i) });
      });
      return cleanup;
    }

    const enter = below ? entrance(gsap, steps) : null;
    pinFits = fits();
    if (pinFits) {
      const journey: Timeline = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: root,
          pin: true,
          start: 'center center',
          end: () => `+=${Math.round(window.innerHeight * TRAVEL)}`,
          scrub: 0.9,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          refreshPriority: PRIORITY,
        },
        onUpdate: () => {
          if (active >= 0) setActive(stepAt(journey.progress()));
        },
      });
      journey
        .to({}, { duration: PLAN.hold1 })
        .fromTo(roads[0], { '--hw-fill': 0 }, { '--hw-fill': 1, duration: PLAN.fill })
        .to({}, { duration: PLAN.hold2 })
        .fromTo(roads[1], { '--hw-fill': 0 }, { '--hw-fill': 1, duration: PLAN.fill })
        .to({}, { duration: PLAN.hold3 });
      // Step 1 lights up as the cards land (or at once when the section was already on screen), then the scroll leads.
      const arrive = () => setActive(stepAt(journey.progress()));
      if (enter) {
        enter.call(arrive, [], 0.55);
        ScrollTrigger.create({ trigger: list, start: 'top 82%', once: true, onEnter: () => enter.play() });
      } else arrive();
      return cleanup;
    }

    // Desktop window too short to pin the whole block: the same walk plays once on a timer when the steps arrive.
    const tour = gsap.timeline({ paused: true });
    let at = enter ? 0.55 : 0.1;
    tour.call(() => setActive(0), [], at);
    roads.forEach((road, i) => {
      at += scenes[i].duration + 0.35;
      tour.fromTo(road, { '--hw-fill': 0 }, { '--hw-fill': 1, duration: 0.5, ease: 'power2.inOut' }, at);
      tour.call(() => setActive(i + 1), [], at + 0.5);
      at += 0.5;
    });
    ScrollTrigger.create({
      trigger: list,
      start: 'top 75%',
      once: true,
      onEnter: () => {
        enter?.play();
        tour.play();
      },
    });
    return cleanup;
  }

  /**
   * Lite build: the walk without a pin. Step classes drive everything visible (v2-howto.css): --wait holds a step at its
   * entrance start state, --road fills the road to the next step; .iz-howto--ease turns the transitions on two frames
   * after the start states are in, so nothing on screen animates into its hidden state. ScrollTrigger once-triggers
   * (no scrub, no pin) fire even when a jump skips past them; they and the scene timelines belong to the matchMedia
   * context, the timers are cleared here.
   */
  function buildLite(
    desktop: boolean,
    below: boolean,
    setActive: (n: number) => void,
    activeNow: () => number,
    scenes: SceneControl[],
    cleanup: () => void,
  ): () => void {
    pinFits = null;
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));
    root.classList.add('iz-howto--lite');
    const waiting = desktop
      ? below
        ? steps.slice()
        : []
      : steps.filter(step => {
          const card = q(step, '.iz-journey__card');
          return !!card && card.getBoundingClientRect().top >= window.innerHeight;
        });
    waiting.forEach(step => step.classList.add('iz-journey__step--wait'));
    let ease = requestAnimationFrame(() => {
      ease = requestAnimationFrame(() => {
        ease = 0;
        root.classList.add('iz-howto--ease');
      });
    });
    const rise = (list: HTMLElement[]) =>
      list.forEach((step, i) => {
        step.style.setProperty('--hw-d', `${i * LITE_STAGGER_MS}ms`);
        step.classList.remove('iz-journey__step--wait');
      });
    const road = (i: number) => steps[i]?.classList.add('iz-journey__step--road');

    if (desktop) {
      // The row arrives as one, so the walk plays on a timer like the short-window tour of the full tier.
      ScrollTrigger.create({
        trigger: list,
        start: 'top 75%',
        once: true,
        onEnter: () => {
          const held = steps.filter(step => step.classList.contains('iz-journey__step--wait'));
          rise(held);
          // Step 1 lights as the cards land, or at once when they were already on screen.
          let at = held.length ? 550 : 100;
          later(() => setActive(0), at);
          for (let i = 1; i < steps.length; i++) {
            at += scenes[i - 1].duration * 1000 + LITE_PAUSE_MS;
            later(() => road(i - 1), at);
            at += LITE_FILL_MS;
            later(() => setActive(i), at);
          }
        },
      });
    } else {
      steps.forEach((step, i) => {
        const card = q(step, '.iz-journey__card');
        if (!card) return;
        if (step.classList.contains('iz-journey__step--wait')) ScrollTrigger.create({ trigger: card, start: 'top 96%', once: true, onEnter: () => rise([step]) });
        ScrollTrigger.create({
          trigger: card,
          start: 'top 62%',
          once: true,
          onEnter: () => {
            if (i <= activeNow()) return;
            for (let j = Math.max(0, activeNow()); j < i; j++) road(j);
            setActive(i);
          },
        });
      });
    }

    return () => {
      timers.forEach(t => window.clearTimeout(t));
      if (ease) cancelAnimationFrame(ease);
      cleanup();
      root.classList.remove('iz-howto--lite', 'iz-howto--ease');
      steps.forEach(step => {
        step.classList.remove('iz-journey__step--wait', 'iz-journey__step--road');
        step.style.removeProperty('--hw-d');
      });
    };
  }

  const start = () => {
    if (disposed || mm) return;
    mm = gsap.matchMedia();
    mm.add({ desktop: DESKTOP, mobile: MOBILE }, context => build(Boolean(context.conditions?.desktop)));
    // The new pin pushes everything below it down; a global refresh (page order, see PRIORITY) measures it again.
    ScrollTrigger.refresh();
    noteSetup();
  };

  // On desktop the film strip above pins, and the page engine sets that block up only after the curtain lifts. The
  // engine marks the strip with is-pinned when it does; without that mark the journey waits a moment, then goes ahead.
  // The lite tier never pins the strip (it stays a swipe row) and builds no pin here either, so there is nothing to
  // measure in order and the build goes ahead at once.
  const engineReady = () => {
    if (!window.matchMedia(DESKTOP).matches || motionTier() === 'lite') return true;
    const film = document.querySelector<HTMLElement>('[data-scene="film"]');
    if (!film || film.compareDocumentPosition(root) & Node.DOCUMENT_POSITION_PRECEDING) return true;
    return film.classList.contains('is-pinned');
  };
  const begin = () => {
    const since = performance.now();
    const tick = () => {
      frame = 0;
      if (disposed) return;
      // Building the scenes and the pin makes GSAP read computed styles; done mid-scroll it dropped frames on phones,
      // so it waits for a still moment (runtime scrollIdle).
      if ((engineReady() || performance.now() - since > ENGINE_WAIT_MS) && scrollIdle()) start();
      else frame = requestAnimationFrame(tick);
    };
    tick();
  };

  const stopReveal = whenRevealed(() => {
    if (disposed) return;
    if (typeof IntersectionObserver !== 'function') {
      begin();
      return;
    }
    io = new IntersectionObserver(
      entries => {
        if (!entries.some(e => e.isIntersecting)) return;
        io?.disconnect();
        io = null;
        begin();
      },
      // Far ahead (four screens), so the build usually happens while the visitor is still reading above, not when the
      // section is about to arrive.
      { rootMargin: '0px 0px 400% 0px' },
    );
    io.observe(root);
  });

  // A desktop window resized past the point where the block fits (or no longer fits) switches between pin and walk.
  const onResize = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (!mm || pinFits === null || !window.matchMedia(DESKTOP).matches || fits() === pinFits) return;
      mm.revert();
      mm = null;
      start();
    }, 250);
  };
  window.addEventListener('resize', onResize);

  // The frame probe lowered the tier to lite. A full build the visitor has not reached yet (the section builds four
  // screens ahead) is swapped for the lite one; one already walking, or on screen, keeps going as it is. The verdict
  // lands inside the probe's frame, usually mid-scroll, so the swap (a layout read, the pin revert that changes the
  // page height, the refresh in start()) waits for a still moment, like the build itself.
  let tierFrame = 0;
  const swapToLite = () => {
    tierFrame = 0;
    if (!mm || builtLite || touched || disposed) return;
    if (!scrollIdle()) {
      tierFrame = requestAnimationFrame(swapToLite);
      return;
    }
    if (root.getBoundingClientRect().top < window.innerHeight) return;
    mm.revert();
    mm = null;
    begin();
  };
  const stopTier = onTierChange(next => {
    if (next === 'lite' && !tierFrame) tierFrame = requestAnimationFrame(swapToLite);
  });

  return () => {
    disposed = true;
    stopTier();
    if (tierFrame) cancelAnimationFrame(tierFrame);
    stopReveal();
    io?.disconnect();
    io = null;
    if (frame) cancelAnimationFrame(frame);
    window.clearTimeout(resizeTimer);
    window.removeEventListener('resize', onResize);
    mm?.revert();
    mm = null;
  };
}
