'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Local safety copy of the editor (requirement 9). It never writes to Firestore: only the save, publish,
// and unpublish buttons do. Every access is wrapped because localStorage throws in some private modes.

export interface LocalCopy<T> {
  v: 1;
  savedAt: number;
  // The server updatedAt the copy started from, to warn when the server version is newer.
  baseUpdatedAt: number | null;
  draft: T;
}

export const localKey = (slug?: string) => `inzta-artikel:${slug || 'baru'}`;
const INTERVAL_MS = 5000;

function storageWorks(): boolean {
  try {
    const probe = '__inzta_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export function readLocalCopy<T>(key: string): LocalCopy<T> | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.v !== 1 || typeof parsed.savedAt !== 'number' || !parsed.draft || typeof parsed.draft !== 'object') return null;
    return parsed as LocalCopy<T>;
  } catch {
    return null;
  }
}

export function clearLocalCopy(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}

export type AutosaveStatus = { state: 'off' } | { state: 'idle' } | { state: 'saved'; at: number };

export function useAutosave<T>(key: string, draft: T, dirty: boolean, baseUpdatedAt: number | null, enabled: boolean) {
  // Unknown until mounted: the page is also rendered on the server, where window does not exist.
  const [available, setAvailable] = useState<boolean | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const latest = useRef({ key, draft, baseUpdatedAt });
  latest.current = { key, draft, baseUpdatedAt };
  const lastWritten = useRef('');

  useEffect(() => setAvailable(storageWorks()), []);

  const write = useCallback(() => {
    const { key: k, draft: d, baseUpdatedAt: base } = latest.current;
    const json = JSON.stringify(d);
    if (json === lastWritten.current) return;
    const at = Date.now();
    try {
      const copy: LocalCopy<T> = { v: 1, savedAt: at, baseUpdatedAt: base, draft: d };
      window.localStorage.setItem(k, JSON.stringify(copy));
      lastWritten.current = json;
      setSavedAt(at);
    } catch {
      setAvailable(false);
    }
  }, []);

  // Throttled, not debounced: continuous typing still produces a copy every 5 seconds.
  useEffect(() => {
    if (!enabled || !dirty || !available) return;
    const id = window.setInterval(write, INTERVAL_MS);
    // Closing the tab between two ticks would otherwise lose up to 5 seconds of typing.
    window.addEventListener('pagehide', write);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('pagehide', write);
    };
  }, [enabled, dirty, available, write]);

  const clear = useCallback((k?: string) => {
    clearLocalCopy(k || latest.current.key);
    lastWritten.current = '';
    setSavedAt(null);
  }, []);

  const status: AutosaveStatus = available === false ? { state: 'off' } : savedAt ? { state: 'saved', at: savedAt } : { state: 'idle' };
  return { status, clear, available };
}
