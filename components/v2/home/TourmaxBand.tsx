import type { BagPosition, HomeGuideCard } from '@/types';

// F-016 section, implemented by a section agent.
export default function TourmaxBand({ tourmax }: { tourmax: { price: number; compareAt: number | null } | null }) {
  void tourmax;
  return null;
}
