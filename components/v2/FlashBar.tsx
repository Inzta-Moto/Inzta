'use client';

import type { FlashSaleState } from '@/types';

// F-016 24.3, 24.6, 24.7. Implemented by the flash-sale agent.
export default function FlashBar({ flash }: { flash: FlashSaleState }) {
  void flash;
  return null;
}
