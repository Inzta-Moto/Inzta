'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { WARRANTY_COPY } from '@/lib/warranty/copy';

// Shared pieces of the two /garansi forms: labelled fields with hint and error wiring (2.4, 2.7), chip groups on native
// radios and checkboxes, the timer token (3.3), and focus on the first error.

const C = WARRANTY_COPY;

export function describedBy(id: string, hint: boolean, error: string | undefined): string | undefined {
  const ids = [hint ? `${id}-hint` : '', error ? `${id}-err` : ''].filter(Boolean);
  return ids.length ? ids.join(' ') : undefined;
}

export function Field({ id, label, hint, error, optional, counter, children }: { id: string; label: string; hint?: string; error?: string; optional?: boolean; counter?: string; children: ReactNode }) {
  return (
    <div className="iz-gr-field" data-invalid={error ? '' : undefined}>
      <label className="iz-gr-label" htmlFor={id}>
        {label}
        {optional && <span className="iz-gr-opt"> ({C.claim.optional})</span>}
      </label>
      {hint && (
        <p className="iz-gr-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {children}
      <div className="iz-gr-below">
        {error ? (
          <p className="iz-gr-err" id={`${id}-err`}>
            {error}
          </p>
        ) : (
          <span />
        )}
        {counter && (
          <span className="iz-gr-count" aria-hidden="true">
            {counter}
          </span>
        )}
      </div>
    </div>
  );
}

export function ChipGroup<T extends string>({
  id,
  legend,
  hint,
  error,
  options,
  value,
  multiple,
  onChange,
  optional,
}: {
  id: string;
  legend: string;
  hint?: string;
  error?: string;
  options: readonly { value: T; label: string }[];
  value: T | T[] | '';
  multiple?: boolean;
  onChange: (v: T) => void;
  optional?: boolean;
}) {
  const checked = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v);
  return (
    <fieldset className="iz-gr-field iz-gr-chips" id={id} tabIndex={-1} aria-describedby={describedBy(id, Boolean(hint), error)} data-invalid={error ? '' : undefined}>
      <legend className="iz-gr-label">
        {legend}
        {optional && <span className="iz-gr-opt"> ({C.claim.optional})</span>}
      </legend>
      {hint && (
        <p className="iz-gr-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      <div className="iz-gr-chiprow">
        {options.map(o => (
          <label key={o.value} className="iz-gr-chip">
            <input type={multiple ? 'checkbox' : 'radio'} name={id} value={o.value} checked={checked(o.value)} onChange={() => onChange(o.value)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
      {error && (
        <p className="iz-gr-err" id={`${id}-err`}>
          {error}
        </p>
      )}
    </fieldset>
  );
}

/** Timer token from GET /api/garansi/form-token, fetched when the form mounts; `renew` after an expired answer. */
export function useFormToken() {
  const [token, setToken] = useState<string>('');
  const renew = useCallback(async () => {
    try {
      const res = await fetch('/api/garansi/form-token', { cache: 'no-store' });
      if (res.ok) setToken((await res.json()).token || '');
    } catch {
      // The submit answers FORM_EXPIRED and renews again; nothing to show here.
    }
  }, []);
  useEffect(() => {
    renew();
  }, [renew]);
  return { token, renew };
}

/** Moves focus to the first field with an error, in page order (2.4). */
export function focusFirstError(form: HTMLFormElement | null, fields: Record<string, string>, idPrefix: string) {
  if (!form) return;
  const targets = Object.keys(fields)
    .map(f => document.getElementById(`${idPrefix}-${f}`))
    .filter((el): el is HTMLElement => Boolean(el));
  targets.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  const first = targets[0];
  if (first) {
    first.focus();
    first.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

/** sessionStorage draft of text fields (2.4); every access guarded, a blocked storage simply keeps no draft. */
export function useDraft<T extends object>(key: string, value: T, restore: (v: Partial<T>) => void, enabled: boolean) {
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) restore(JSON.parse(raw));
    } catch {
      // no draft
    }
    // restore runs once on mount
  }, [key]);
  useEffect(() => {
    if (!enabled || !restored.current) return;
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage full or blocked
    }
  }, [key, value, enabled]);
  return () => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
  };
}

export type SubmitOutcome = { kind: 'ok'; id: string } | { kind: 'fields'; fields: Record<string, string> } | { kind: 'error'; message: string; renew?: boolean };

/** POSTs a form body and maps every answer to something the form can show (3.3, 3.5, 10.3). */
export async function submitJson(url: string, body: Record<string, unknown>, idKey: 'ticket' | 'ref'): Promise<SubmitOutcome> {
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    return { kind: 'error', message: C.errors.network };
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, any>;
  if ((res.status === 201 || res.status === 200) && typeof data[idKey] === 'string') return { kind: 'ok', id: data[idKey] };
  if (res.status === 400 && data.fields) return { kind: 'fields', fields: data.fields };
  if (res.status === 400 && (data.code === 'FORM_EXPIRED' || data.code === 'TOO_FAST')) return { kind: 'error', message: C.errors.tooFast, renew: data.code === 'FORM_EXPIRED' };
  if (res.status === 429) return { kind: 'error', message: C.errors.rateLimited };
  if (res.status === 413) return { kind: 'error', message: C.errors.tooLarge };
  if (res.status === 503 && data.code === 'UPLOAD_UNAVAILABLE') return { kind: 'error', message: C.errors.photoUnavailable };
  return { kind: 'error', message: C.errors.server };
}

export function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };
  return { copied, copy };
}
