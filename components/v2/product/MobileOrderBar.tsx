'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { WhatsApp } from '@/components/v2/icons';
import { cldWebp } from '@/lib/v2/image';
import { barWouldCover } from '@/components/v2/product/mbar';

/**
 * Mobile order bar `.iz-mbar` (F-016 S3.9). Rendered only after hydration (without JavaScript the main link remains),
 * shown at 767 px and narrower while the main order control is out of the viewport. It slides with translateY
 * (CSS, none under reduced motion) and is hidden from focus and assistive technology while off screen. It also steps
 * aside while a control marked data-mbar-avoid is in its zone, so it never covers "Lihat selengkapnya".
 */
export default function MobileOrderBar({
  target,
  image,
  name,
  price,
  label,
  disabled,
  ariaDisabled,
  onActivate,
}: {
  target: RefObject<HTMLElement>;
  image: string | null;
  name: string;
  price: string;
  label: string;
  disabled: boolean;
  ariaDisabled: boolean;
  onActivate: () => void;
}) {
  const [mainOut, setMainOut] = useState(false);
  const [avoid, setAvoid] = useState(false);
  const shown = mainOut && !avoid;
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = target.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setMainOut(!entry.isIntersecting), { threshold: 0 });
    io.observe(el);
    // Bottom padding on the page so the bar never covers the footer's last line (S3.9.1); the html class adds the
    // matching scroll-padding so focused or scrolled-to elements stop above the bar (WCAG 2.4.11).
    const page = el.closest('.iz-page');
    page?.classList.add('iz-page--mbar');
    document.documentElement.classList.add('iz-mbar-on');

    // One rect read per frame while scrolling; the ResizeObserver catches the description opening or closing,
    // which moves its button without a scroll event.
    let frame = 0;
    const check = () => {
      frame = 0;
      const boxes = Array.from(document.querySelectorAll<HTMLElement>('[data-mbar-avoid]'), n => n.getBoundingClientRect());
      setAvoid(barWouldCover(boxes, window.innerHeight));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    check();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const ro = typeof ResizeObserver === 'undefined' || !page ? null : new ResizeObserver(schedule);
    if (ro && page) ro.observe(page);
    return () => {
      io.disconnect();
      ro?.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
      page?.classList.remove('iz-page--mbar');
      document.documentElement.classList.remove('iz-mbar-on');
    };
  }, [target]);

  useEffect(() => {
    // `inert` keeps the off-screen bar out of the tab order; React 18 has no typed prop for it.
    if (bar.current) (bar.current as HTMLElement & { inert: boolean }).inert = !shown;
  }, [shown]);

  return (
    <div ref={bar} className="iz-mbar iz-mbar--fixed iz-only-mob" data-shown={shown ? 'true' : 'false'} aria-hidden={shown ? undefined : true}>
      <div className="iz-mbar__item">
        {image ? <img src={cldWebp(image, 144)} alt="" width={48} height={48} loading="lazy" decoding="async" /> : null}
        <div>
          <b>{name}</b>
          <span>{price}</span>
        </div>
      </div>
      <button
        type="button"
        className="iz-btn iz-btn--primary iz-btn--wa"
        disabled={disabled}
        aria-disabled={ariaDisabled ? true : undefined}
        onClick={onActivate}
      >
        <span className="iz-btn__icon">
          <WhatsApp />
        </span>
        <span>{label}</span>
      </button>
    </div>
  );
}
