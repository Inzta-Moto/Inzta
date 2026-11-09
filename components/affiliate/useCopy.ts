'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const COPIED_MS = 2500;

/**
 * Old-browser fallback: a hidden, read-only textarea selected and copied with execCommand. Some in-app browsers
 * (Instagram, Facebook) and http previews have no navigator.clipboard, but still honour execCommand inside a click.
 * The previous focus is restored so keyboard users stay on the button they pressed.
 */
function legacyCopy(text: string): boolean {
  if (typeof document === 'undefined') return false;
  const previous = document.activeElement as HTMLElement | null;
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.setAttribute('aria-hidden', 'true');
  area.tabIndex = -1;
  // Off screen but still selectable; 16 px keeps iOS from zooming on the brief focus.
  area.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0;font-size:16px;';
  document.body.appendChild(area);
  let ok = false;
  try {
    area.select();
    area.setSelectionRange(0, text.length);
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  previous?.focus?.({ preventScroll: true });
  return ok;
}

/** Copies text with the async Clipboard API, then the execCommand fallback. Resolves false when both fail. */
export async function copyText(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Denied or blocked (permissions policy, insecure context): try the fallback below.
  }
  return legacyCopy(text);
}

/**
 * Copy state shared by the ticket buttons and the copy callbacks handed to CommissionsSection (F-025 E8). `key`
 * names the control ('link', 'code', ...): a success marks it as copied for 2.5 s and reports the message (the toast);
 * a failure marks it as failed until the next attempt, so the ticket can show the manual-copy hint.
 */
export function useCopy(onSuccess?: (message: string) => void) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const success = useRef(onSuccess);
  success.current = onSuccess;

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = useCallback(async (key: string, text: string, okMessage: string): Promise<boolean> => {
    const ok = await copyText(text);
    window.clearTimeout(timer.current);
    if (ok) {
      setFailedKey(null);
      setCopiedKey(key);
      timer.current = window.setTimeout(() => setCopiedKey(null), COPIED_MS);
      success.current?.(okMessage);
    } else {
      setCopiedKey(null);
      setFailedKey(key);
    }
    return ok;
  }, []);

  return { copiedKey, failedKey, copy };
}
