'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { WhatsApp } from '@/components/v2/icons';
import { optimizeCloudinaryUrl } from '@/lib/utils';

/**
 * Mobile order bar `.iz-mbar` (F-016 S3.9). Rendered only after hydration (without JavaScript the main link remains),
 * shown at 767 px and narrower while the main order control is out of the viewport. It slides with translateY
 * (CSS, none under reduced motion) and is hidden from focus and assistive technology while off screen.
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
  const [shown, setShown] = useState(false);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = target.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setShown(!entry.isIntersecting), { threshold: 0 });
    io.observe(el);
    // Bottom padding on the page so the bar never covers the footer's last line (S3.9.1).
    const page = el.closest('.iz-page');
    page?.classList.add('iz-page--mbar');
    return () => {
      io.disconnect();
      page?.classList.remove('iz-page--mbar');
    };
  }, [target]);

  useEffect(() => {
    // `inert` keeps the off-screen bar out of the tab order; React 18 has no typed prop for it.
    if (bar.current) (bar.current as HTMLElement & { inert: boolean }).inert = !shown;
  }, [shown]);

  return (
    <div ref={bar} className="iz-mbar iz-mbar--fixed iz-only-mob" data-shown={shown ? 'true' : 'false'} aria-hidden={shown ? undefined : true}>
      <div className="iz-mbar__item">
        {image ? <img src={optimizeCloudinaryUrl(image, 120)} alt="" width={48} height={48} loading="lazy" decoding="async" /> : null}
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
