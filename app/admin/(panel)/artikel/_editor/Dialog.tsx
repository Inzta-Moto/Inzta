'use client';

import { ReactNode, RefObject, useEffect, useId, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DialogProps {
  title: string;
  onClose: () => void;
  // Where focus goes when the dialog closes (the textarea for toolbar dialogs, requirement 6.8).
  returnFocusRef?: RefObject<HTMLElement>;
  children: ReactNode;
  footer: ReactNode;
}

export default function Dialog({ title, onClose, returnFocusRef, children, footer }: DialogProps) {
  const titleId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const box = boxRef.current;
    const first = box?.querySelector<HTMLElement>('[data-autofocus]') || box?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !box) return;
      const items = Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.offsetParent !== null);
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      (returnFocusRef?.current || previous)?.focus();
    };
  }, [returnFocusRef]);

  return (
    <div className="modal-overlay" style={{ display: 'flex' }} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal article-editor-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={boxRef}>
        <div className="modal-header">
          <h2 className="modal-title" id={titleId}>{title}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Tutup">&times;</button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">{footer}</div>
      </div>
    </div>
  );
}
