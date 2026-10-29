import { cache } from 'react';
import type { BagPosition, FlashSaleState, Product } from '@/types';
import { getActiveProducts } from '@/lib/public-content';
import { getFlashSale } from '@/lib/v2/flash-sale';
import { isFlashActive } from '@/lib/v2/flash-time';
import { minPriceByPosition } from '@/lib/v2/home-data';

export interface NavData {
  minPrices: Record<BagPosition, number | null>;
  flash: FlashSaleState;
}

const INACTIVE: FlashSaleState = { isActive: false, endsAt: null };

// Shared by every v2 frame so the navbar prices and the promo bar agree on every page (S0.3, S0.4). cache() makes
// the frame and the page share one read per render. An ended sale is normalised to inactive on the server.
export const getNavData = cache(async (products?: Product[]): Promise<NavData> => {
  const [list, flash] = await Promise.all([products ? Promise.resolve(products) : getActiveProducts(), getFlashSale()]);
  return { minPrices: minPriceByPosition(list), flash: isFlashActive(flash, Date.now()) ? flash : INACTIVE };
});
