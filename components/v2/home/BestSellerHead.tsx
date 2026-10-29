'use client';

import type { FlashSaleState } from '@/types';

// F-016 7.1 and 24.4: normal "Pilihan best seller INZTA." heading with ScrollerArrows, or the flash-sale countdown panel.
export default function BestSellerHead({ flash, scrollerId }: { flash: FlashSaleState; scrollerId: string }) {
  void flash;
  void scrollerId;
  return null;
}
