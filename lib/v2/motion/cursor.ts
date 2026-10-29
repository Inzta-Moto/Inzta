import type { MotionKit } from '@/lib/v2/motion/runtime';
import { HOVER } from '@/lib/v2/motion/runtime';

// Labels the ring turns into over these targets; the first match wins. Built from the classes the pages already use,
// so no markup needs a data attribute (an explicit data-cursor-label still wins).
const LABELS: [string, string][] = [
  ['.iz-pcard', 'Lihat'],
  ['.iz-gtile, .iz-mtile, .iz-cat', 'Pilih'],
  ['.iz-gfeature, .iz-grow, .iz-acard, .iz-featured', 'Baca'],
];
// Light cards get a soft light that follows the pointer (CSS reads --mx/--my).
const GLOW = '.iz-pcard, .iz-rcard, .iz-mfill, .iz-msheet__row';

/**
 * Pointer follower for fine pointers (Sehan, 2026-10-29, after the BookMate cursor): a dot that tracks the pointer,
 * a ring that trails it and grows over links and buttons, and a yellow pill with a short label over cards. The
 * native cursor stays visible, so a slow script never leaves the visitor without a pointer. Returns a cleanup.
 */
export function initCursor(kit: MotionKit): () => void {
  if (!window.matchMedia(HOVER).matches) return () => {};
  const { gsap } = kit;
  const make = (cls: string) => {
    const el = document.createElement('div');
    el.className = cls;
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
    return el;
  };
  const ring = make('iz-cursor iz-cursor--ring');
  const pill = make('iz-cursor iz-cursor--pill');
  const dot = make('iz-cursor iz-cursor--dot');
  const all = [ring, pill, dot];
  gsap.set(all, { xPercent: -50, yPercent: -50, autoAlpha: 0 });
  const dotX = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3' });
  const dotY = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3' });
  const ringX = gsap.quickTo([ring, pill], 'x', { duration: 0.5, ease: 'power3' });
  const ringY = gsap.quickTo([ring, pill], 'y', { duration: 0.5, ease: 'power3' });

  let visible = false;
  let label = '';
  let last: { x: number; y: number } | null = null;
  let glow: HTMLElement | null = null;

  const show = (on: boolean) => {
    if (on === visible) return;
    visible = on;
    gsap.to([dot, ring], { autoAlpha: on ? 1 : 0, duration: 0.25, overwrite: 'auto' });
    if (!on) gsap.to(pill, { autoAlpha: 0, duration: 0.2, overwrite: 'auto' });
  };
  const read = (target: Element | null) => {
    if (!target || !target.closest('.iz-page') || target.closest('[data-cursor="hide"], input, textarea, select')) {
      show(false);
      return;
    }
    show(true);
    const own = target.closest<HTMLElement>('[data-cursor-label]')?.dataset.cursorLabel;
    const next = own ?? LABELS.find(([sel]) => target.closest(sel))?.[1] ?? '';
    if (next !== label) {
      label = next;
      if (next) pill.textContent = next;
      gsap.to(pill, { autoAlpha: next ? 1 : 0, scale: next ? 1 : 0.6, duration: 0.3, overwrite: 'auto' });
      gsap.to(ring, { autoAlpha: next ? 0 : 1, duration: 0.2, overwrite: 'auto' });
    }
    ring.dataset.state = target.closest('a, button, [role="button"], label') ? 'link' : 'idle';
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    last = { x: e.clientX, y: e.clientY };
    dotX(e.clientX);
    dotY(e.clientY);
    ringX(e.clientX);
    ringY(e.clientY);
    const target = e.target instanceof Element ? e.target : null;
    read(target);
    const card = target?.closest<HTMLElement>(GLOW) ?? null;
    if (glow && glow !== card) glow.removeAttribute('data-glow');
    glow = card;
    if (card) {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
      card.setAttribute('data-glow', '');
    }
  };
  // Scrolling moves the page under a still pointer; read what is under it again.
  const onScroll = () => {
    if (last && visible) read(document.elementFromPoint(last.x, last.y));
  };
  const onLeave = () => show(false);
  document.addEventListener('pointermove', onMove);
  window.addEventListener('scroll', onScroll, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);
  window.addEventListener('blur', onLeave);
  return () => {
    document.removeEventListener('pointermove', onMove);
    window.removeEventListener('scroll', onScroll);
    document.documentElement.removeEventListener('pointerleave', onLeave);
    window.removeEventListener('blur', onLeave);
    glow?.removeAttribute('data-glow');
    all.forEach(el => el.remove());
  };
}
