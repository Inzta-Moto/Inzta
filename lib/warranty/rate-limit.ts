import type { Firestore } from 'firebase-admin/firestore';
import { toMs, type Stamp } from '@/lib/warranty/time';

// F-031 rate limits (requirements 3.3, 4.3, 10.3) as counters in the website Firestore `rateLimits/{key}`
// ({ count, expiresAt }), changed in one transaction so parallel requests cannot both pass the last slot.

export interface LimitRule {
  key: string;
  limit: number;
  windowMs: number;
}

export type LimitResult = { ok: true } | { ok: false; key: string };

/**
 * Passes when every counter is below its limit and then increments all of them; a refused request increments none,
 * so hammering a full bucket does not keep it full longer. Expired counters count as zero.
 */
export async function checkLimits(db: Firestore, rules: LimitRule[], now: number, stamp: Stamp): Promise<LimitResult> {
  const col = db.collection('rateLimits');
  return db.runTransaction(async tx => {
    const refs = rules.map(r => col.doc(r.key));
    const snaps = [];
    for (const ref of refs) snaps.push(await tx.get(ref));
    const current = snaps.map(s => {
      const d = s.exists ? (s.data() as { count?: number; expiresAt?: unknown }) : null;
      const exp = d ? toMs(d.expiresAt) : null;
      const active = d !== null && exp !== null && exp > now;
      return { count: active && typeof d?.count === 'number' ? d.count : 0, expiresAt: active ? d?.expiresAt : null };
    });
    for (let i = 0; i < rules.length; i++) {
      if (current[i].count >= rules[i].limit) return { ok: false as const, key: rules[i].key };
    }
    rules.forEach((r, i) => {
      tx.set(refs[i], { count: current[i].count + 1, expiresAt: current[i].expiresAt ?? stamp(now + r.windowMs) });
    });
    return { ok: true as const };
  });
}

/**
 * Deletes up to `max` expired counters. Called from the ERP list route instead of a Firestore TTL policy, which is
 * not relied on under Spark (design.md §3, decided in task W3); a single-field range query, no composite index.
 */
export async function cleanupExpiredLimits(db: Firestore, now: number, stamp: Stamp, max = 50): Promise<number> {
  const snap = await db.collection('rateLimits').where('expiresAt', '<', stamp(now)).limit(max).get();
  await Promise.all(snap.docs.map(d => d.ref.delete()));
  return snap.docs.length;
}

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;
