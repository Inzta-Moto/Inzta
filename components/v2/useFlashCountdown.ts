'use client';

import { useEffect, useState } from 'react';
import { countdown, type Countdown } from '@/lib/v2/flash-time';

export interface FlashCountdown {
  value: Countdown | null;
  ended: boolean;
}

// F-016 24.5 and 24.6: shared by the promo bar and the countdown panel.
// The state starts null on the server and on the first client render, so both print the same neutral markup;
// the real time left only appears after mount.
export function useFlashCountdown(endsAt: string | null): FlashCountdown {
  const [value, setValue] = useState<Countdown | null>(null);

  useEffect(() => {
    const end = endsAt ? Date.parse(endsAt) : NaN;
    if (Number.isNaN(end)) {
      setValue(null);
      return;
    }
    let id: ReturnType<typeof setInterval> | undefined;
    const tick = () => {
      // Recomputed from the clock each time, so a throttled background tab still shows the right time when it returns.
      const next = countdown(end, Date.now());
      setValue(next);
      if (next.ended && id !== undefined) {
        clearInterval(id);
        id = undefined;
      }
    };
    // Checked right away: a stale ISR copy opened after endsAt must hide the sale on mount, not one second later.
    tick();
    if (end > Date.now()) id = setInterval(tick, 1000);
    return () => {
      if (id !== undefined) clearInterval(id);
    };
  }, [endsAt]);

  return { value, ended: value?.ended ?? false };
}
