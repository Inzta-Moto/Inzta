import type { BagPosition, HomeGuideCard } from '@/types';

// F-016 section, implemented by a section agent.
export default function Positions({ minPrices }: { minPrices: Record<BagPosition, number | null> }) {
  void minPrices;
  return null;
}
