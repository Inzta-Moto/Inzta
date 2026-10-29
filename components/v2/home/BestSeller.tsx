import type { FlashSaleState, HomeProductCard } from '@/types';

// F-016 7 and 24.4. Implemented by the section agent; the heading area comes from BestSellerHead (flash-sale agent).
export default function BestSeller({ cards, flash }: { cards: HomeProductCard[]; flash: FlashSaleState }) {
  void cards;
  void flash;
  return null;
}
