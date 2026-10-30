'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from '@/components/v2/icons';

// Collapsed height of a long description, and how far past it the text must run before it is folded: a description
// only a few lines longer than the fold shows in full instead of hiding two lines behind a button.
const FOLD_PX = 264;
const SLACK_PX = 96;

/**
 * "Lihat selengkapnya" for a long product description, like the marketplaces. The full text stays in the server HTML
 * (SEO, screen readers); only its height is clipped. The server folds by a length guess (`folded`) so the page does
 * not jump on load, and after mount the real height decides, again on resize while the visitor has not opened it.
 * Without JavaScript the noscript style shows the whole text and hides the button.
 */
export default function DescriptionMore({ id, folded, children }: { id: string; folded: boolean; children: ReactNode }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [foldable, setFoldable] = useState(folded);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) return;
    const measure = () => {
      const el = bodyRef.current;
      if (el) setFoldable(el.scrollHeight > FOLD_PX + SLACK_PX);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open]);

  const toggle = useCallback(() => {
    // Folding back from deep in the text would leave the visitor far below the description; bring its start back.
    const section = rootRef.current?.closest<HTMLElement>('.iz-pdp-desc');
    if (open && section && section.getBoundingClientRect().top < 0) section.scrollIntoView({ block: 'start' });
    setOpen(!open);
  }, [open]);

  const clipped = foldable && !open;
  return (
    <div className="iz-more" ref={rootRef}>
      <noscript dangerouslySetInnerHTML={{ __html: '<style>.iz-more__body { max-height: none !important; mask-image: none !important; -webkit-mask-image: none !important; } .iz-more__btn { display: none !important; }</style>' }} />
      <div
        id={id}
        ref={bodyRef}
        className={`iz-more__body${clipped ? ' iz-more__body--folded' : ''}`}
        style={{ ['--iz-more-fold' as string]: `${FOLD_PX}px` }}
      >
        {children}
      </div>
      {foldable && (
        <button type="button" className="iz-more__btn" aria-expanded={open} aria-controls={id} onClick={toggle}>
          {open ? 'Lihat lebih sedikit' : 'Lihat selengkapnya'}
          <ChevronDown />
        </button>
      )}
    </div>
  );
}
