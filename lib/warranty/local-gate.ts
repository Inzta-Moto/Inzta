// F-031 review SEC-01: a per-instance gate in front of the Firestore rate limits. A request refused here costs no
// Firestore read, so one source hammering a public route cannot drain the Spark read quota the checkout shares. It is
// per serverless instance (not global); the Firestore counters stay the real limit.

export interface LocalGate {
  /** True when the key is blocked or over its local budget; counts the request otherwise. */
  refuse(key: string, now: number): boolean;
  /** Remembers a Firestore refusal until `until`, so repeats are refused without reading Firestore. */
  block(key: string, until: number): void;
}

const MAX_KEYS = 5000;

export function createLocalGate(limit = 20, windowMs = 10 * 60 * 1000): LocalGate {
  const hits = new Map<string, { count: number; resetAt: number }>();
  const blocked = new Map<string, number>();
  const trim = (m: Map<string, unknown>) => {
    // Oldest entries go first (Map keeps insertion order), so memory stays bounded under a flood of new keys.
    while (m.size > MAX_KEYS) m.delete(m.keys().next().value as string);
  };
  return {
    refuse(key, now) {
      const until = blocked.get(key);
      if (until !== undefined) {
        if (until > now) return true;
        blocked.delete(key);
      }
      const h = hits.get(key);
      if (!h || h.resetAt <= now) {
        hits.delete(key);
        hits.set(key, { count: 1, resetAt: now + windowMs });
        trim(hits);
        return false;
      }
      h.count++;
      return h.count > limit;
    },
    block(key, until) {
      blocked.set(key, until);
      trim(blocked);
    },
  };
}
