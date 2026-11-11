// Timestamps in the warranty documents are Firestore Timestamps; the routes take a `stamp` factory so tests can use a
// fake with the same toMillis() shape.

export type Stamp = (ms: number) => unknown;

export function toMs(v: unknown): number | null {
  if (v && typeof (v as { toMillis?: unknown }).toMillis === 'function') return (v as { toMillis(): number }).toMillis();
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Date.parse(v);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

export function toIso(v: unknown): string | null {
  const ms = toMs(v);
  return ms === null ? null : new Date(ms).toISOString();
}
