'use client';

import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

// useLayoutEffect warns during server rendering; the dialog only opens on the client anyway.
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Actions pinned under the content (D-7: actions at the bottom). */
  footer?: ReactNode;
  /** Element that gets focus back after closing; defaults to whatever was focused when the modal opened. */
  returnFocusTo?: HTMLElement | null;
};

/**
 * Modal recipe D-7 for every sheet and dialog (E12, E13): radius 20, padding 24, title plus a 44 px close button,
 * actions at the bottom, the dashboard dimmed behind --aff-scrim. A bottom sheet below 768 px, a 520 px dialog above.
 *
 * Built on <dialog>.showModal(): the browser makes the rest of the page inert, traps focus, and turns Escape into a
 * cancel event. The dialog covers the viewport and draws its own scrim, so a tap on the scrim closes it. Mounted only
 * while open; unmounting closes the dialog and returns focus to the trigger (E12: "fokus dikembalikan ke baris").
 */
export default function Modal(props: ModalProps) {
  if (!props.open) return null;
  return <ModalDialog {...props} />;
}

function ModalDialog({ onClose, title, children, footer, returnFocusTo }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useIsoLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const opener = returnFocusTo ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    if (!dialog.open) {
      try {
        dialog.showModal();
      } catch {
        dialog.setAttribute('open', '');
      }
    }

    // Lock page scroll behind the modal; pad for the scrollbar that disappears so the dashboard does not jump.
    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;

    // Escape: keep React in charge of closing, so the open state and the DOM never disagree.
    const onCancel = (e: Event) => {
      e.preventDefault();
      onCloseRef.current();
    };
    // Some browsers still close the dialog on a repeated Escape despite preventDefault; follow along.
    const onNativeClose = () => onCloseRef.current();
    dialog.addEventListener('cancel', onCancel);
    dialog.addEventListener('close', onNativeClose);

    return () => {
      dialog.removeEventListener('cancel', onCancel);
      dialog.removeEventListener('close', onNativeClose);
      if (dialog.open) dialog.close();
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadding;
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    };
    // Runs once per opening: the modal is mounted only while open, and returnFocusTo is read at that moment.
  }, []);

  return (
    <dialog ref={ref} className="iz-aff-modal" aria-labelledby={titleId}>
      <div className="iz-aff-modal__scrim" aria-hidden="true" onClick={() => onCloseRef.current()} />
      <div className="iz-aff-modal__panel">
        <span className="iz-aff-modal__grabber" aria-hidden="true" />
        <div className="iz-aff-modal__head">
          <h2 id={titleId} className="iz-aff-modal__title">
            {title}
          </h2>
          <button type="button" className="iz-aff-iconbtn" aria-label="Tutup" onClick={() => onCloseRef.current()}>
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="iz-aff-modal__body">{children}</div>
        {footer && <div className="iz-aff-modal__foot">{footer}</div>}
      </div>
    </dialog>
  );
}
