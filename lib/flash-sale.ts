export interface FlashSaleTimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * Remaining flash sale time, or null when the banner must stay hidden.
 * Null covers a missing or unparseable `endsAt` and an end time that is not in the future,
 * so the caller can decide visibility and the first countdown value in one step (F-003, req 2.5).
 */
export function getFlashSaleTimeLeft(endsAt: unknown, now: number = Date.now()): FlashSaleTimeLeft | null {
  if (typeof endsAt !== 'string' && typeof endsAt !== 'number') return null;
  if (endsAt === '') return null;
  const endTime = new Date(endsAt).getTime();
  if (!Number.isFinite(endTime)) return null;
  const distance = endTime - now;
  if (distance <= 0) return null;
  return {
    days: Math.floor(distance / (1000 * 60 * 60 * 24)),
    hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((distance % (1000 * 60)) / 1000),
  };
}
