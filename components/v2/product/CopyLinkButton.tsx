'use client';

import { useEffect, useRef, useState } from 'react';
import { copyToClipboard } from '@/lib/utils';
import { affiliateNeedsRefresh, affiliateShareCode, copyMessage, productShareUrl } from '@/components/v2/product/share';

const LinkIcon = () => (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
    <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
  </svg>
);

const DoneIcon = () => (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

/** How long the button reads "Link disalin" after a successful copy (E5). */
const DONE_MS = 2500;

/**
 * F-021: one "Salin link" button on the product page. Copies only the product link, plus ?aff=<code> for a logged-in
 * affiliate; no text, no image, no share sheet. The code is read on click, so a login or logout in another tab counts.
 */
export default function CopyLinkButton() {
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copy() {
    let storage: Storage | null = null;
    try {
      storage = window.localStorage;
    } catch {
      storage = null;
    }
    const code = affiliateShareCode(storage);
    const refresh = !code && affiliateNeedsRefresh(storage);
    const url = productShareUrl(window.location.origin, window.location.pathname, code);
    if (timer.current) clearTimeout(timer.current);
    // Empty first, so a repeated copy changes the live region and is announced again (REV-03).
    setMessage(null);
    try {
      await copyToClipboard(url);
      setDone(true);
      setMessage({ kind: 'ok', text: copyMessage('ok', url, code, refresh) });
      // The plain confirmation clears with the label; the hint and the code line stay a little longer to be read.
      timer.current = setTimeout(() => {
        setDone(false);
        setMessage(null);
      }, code || refresh ? DONE_MS * 3 : DONE_MS);
    } catch {
      setDone(false);
      setMessage({ kind: 'error', text: copyMessage('error', url, code) });
    }
  }

  return (
    <div className="iz-copylink iz-js-only">
      <button className="iz-link" type="button" style={{ color: 'var(--c-tinta)' }} onClick={() => void copy()}>
        {done ? <DoneIcon /> : <LinkIcon />}
        {done ? 'Link disalin' : 'Salin link'}
      </button>
      <p className={`iz-copylink__msg${message?.kind === 'error' ? ' iz-copylink__msg--error' : ''}`} aria-live="polite">
        {message?.text ?? ''}
      </p>
    </div>
  );
}
