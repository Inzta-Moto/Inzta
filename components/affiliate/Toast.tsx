'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';

const TOAST_MS = 2500;
// Matches the fade in affiliate.css; the text is cleared only after the pill has faded out.
const FADE_MS = 200;

/**
 * State for one Toast: `show(msg)` displays the message for 2.5 s (F-025 E8). Calling it again restarts the timer.
 */
export function useToast(duration: number = TOAST_MS) {
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);
  const hideTimer = useRef<number | undefined>(undefined);
  const clearTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(hideTimer.current);
      window.clearTimeout(clearTimer.current);
    },
    [],
  );

  const show = useCallback(
    (msg: string) => {
      window.clearTimeout(hideTimer.current);
      window.clearTimeout(clearTimer.current);
      // A live region whose text does not change is not announced again, so a repeat of the same message toggles a
      // trailing no-break space: invisible, but a new text for screen readers.
      setMessage((current) => (current === msg ? `${msg} ` : msg));
      setOpen(true);
      hideTimer.current = window.setTimeout(() => {
        setOpen(false);
        // Clear the text only after the pill has faded out, so it does not empty while still visible.
        clearTimer.current = window.setTimeout(() => setMessage(''), FADE_MS);
      }, duration);
    },
    [duration],
  );

  return { message, open, show };
}

/**
 * Krem pill with a check, centred at the bottom of the screen. The wrapper is a polite live region that is always
 * rendered; only its text changes, which is what screen readers need to announce it. Render it once per page.
 */
export default function Toast({ message, open = message !== '' }: { message: string; open?: boolean }) {
  return (
    <div className="iz-aff-toast" role="status" aria-live="polite" aria-atomic="true">
      <div className="iz-aff-toast__pill" data-open={open && message !== '' ? 'true' : 'false'}>
        <span className="iz-aff-toast__icon" aria-hidden="true">
          <Check strokeWidth={2.5} />
        </span>
        <span>{message}</span>
      </div>
    </div>
  );
}
