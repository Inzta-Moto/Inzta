'use client';

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Close, Search } from '@/components/v2/icons';
import { PHONE_QUERY } from '@/components/v2/catalog/FilterBar';
import { SEARCH_MAX, parseSearch } from '@/components/v2/catalog/filter';

export const SEARCH_DEBOUNCE_MS = 200;
export const SEARCH_PLACEHOLDER = 'Cari tas, misalnya tank bag atau XSR';

// Search row of the Katalog (F-019). The input keeps its own text so typing never waits for the grid; the applied
// value (`value`, from ?q=) is sent 200 ms after the last keystroke, at once on Enter or clear. A change from outside
// (back/forward, "Hapus pencarian" in the empty state) replaces the text and drops a pending send. Without `onSearch`
// (the server-rendered Suspense fallback) the row still renders, so it takes its place before hydration (no shift).
export default function CatalogSearch({ value, onSearch }: { value: string; onSearch?: (q: string) => void }) {
  const uid = useId().replace(/:/g, '');
  const [text, setText] = useState(value);
  const sent = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => {
    if (value === sent.current) return;
    cancel();
    sent.current = value;
    setText(value);
  }, [value]);

  useEffect(() => cancel, []);

  const commit = (raw: string) => {
    cancel();
    const q = parseSearch(raw);
    if (q === sent.current) return;
    sent.current = q;
    onSearch?.(q);
  };

  const onChange = (next: string) => {
    setText(next);
    cancel();
    timer.current = setTimeout(() => commit(next), SEARCH_DEBOUNCE_MS);
  };

  // Enter applies without a reload; on phones the keyboard closes so the results are not hidden under it.
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    commit(text);
    if (window.matchMedia(PHONE_QUERY).matches) inputRef.current?.blur();
  };

  const clear = () => {
    setText('');
    commit('');
    inputRef.current?.focus();
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Escape' || !text) return;
    e.preventDefault();
    clear();
  };

  return (
    <form className="iz-search" role="search" action="/produk" method="get" onSubmit={onSubmit}>
      <label className="iz-sr" htmlFor={`${uid}-q`}>
        Cari produk
      </label>
      <Search className="iz-search__ico" />
      <input
        ref={inputRef}
        id={`${uid}-q`}
        className="iz-search__input"
        type="search"
        name="q"
        value={text}
        maxLength={SEARCH_MAX}
        placeholder={SEARCH_PLACEHOLDER}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        // Leaving the field (tapping "Buka filter" or a chip) applies the text at once, so no control acts on a
        // state that is still waiting for the debounce.
        onBlur={() => {
          if (timer.current) commit(text);
        }}
      />
      {/* Always in the markup and only hidden, so the field never changes width when the first letter is typed. */}
      <button className="iz-search__clear" type="button" aria-label="Hapus pencarian" hidden={!text} onClick={clear}>
        <Close size={16} />
      </button>
    </form>
  );
}
