'use client';

import { useEffect, useRef, useState } from 'react';
import { Close } from '@/components/v2/icons';

export interface ToastMessage {
  id: number;
  text: string;
  action?: { label: string; onClick: () => void };
}

/**
 * F-030 short message at the bottom of the screen (E3, E5, D-9 "Batalkan"). The live region stays mounted so screen
 * readers announce each new message; the timer pauses while the toast is hovered or holds focus, so an "Undo" is never
 * pulled away from someone reaching for it.
 */
export default function Toast({ message, onClose, duration = 6000 }: { message: ToastMessage | null; onClose: () => void; duration?: number }) {
  const [paused, setPaused] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => setPaused(false), [message?.id]);

  useEffect(() => {
    if (!message || paused) return;
    const t = window.setTimeout(() => closeRef.current(), duration);
    return () => window.clearTimeout(t);
  }, [message, paused, duration]);

  return (
    <div className="iz-toastzone" role="status" aria-live="polite">
      {message && (
        <div
          key={message.id}
          className="iz-toast"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <p>{message.text}</p>
          {message.action && (
            <button
              type="button"
              className="iz-toast__action"
              onClick={() => {
                message.action!.onClick();
                onClose();
              }}
            >
              {message.action.label}
            </button>
          )}
          <button type="button" className="iz-toast__close" aria-label="Tutup pesan" onClick={onClose}>
            <Close width={16} height={16} />
          </button>
        </div>
      )}
    </div>
  );
}
