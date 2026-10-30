import type { CSSProperties } from 'react';

// Shimmer block (F-016 S0.12.1). Decorative: loading containers carry aria-busy, the blocks are hidden from AT.
export function Skeleton({ w, h, r, dark = false, className }: { w?: string; h?: string; r?: string; dark?: boolean; className?: string }) {
  const style = { '--w': w, '--h': h, '--r': r } as CSSProperties;
  return <span className={`iz-skel${dark ? ' iz-skel--dark' : ''}${className ? ` ${className}` : ''}`} style={style} aria-hidden="true" />;
}

// Product card placeholder: 1:1 tile, two name lines, price (S0.9 ST-LOAD).
export function SkeletonCard() {
  return (
    <div className="iz-skelcard" aria-hidden="true">
      <Skeleton />
      <Skeleton h="20px" w="90%" />
      <Skeleton h="20px" w="60%" />
      <Skeleton h="22px" w="40%" />
    </div>
  );
}

export function SkeletonLines({ count, last = '70%' }: { count: number; last?: string }) {
  return (
    <div className="iz-skelstack" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} h="18px" w={i === count - 1 ? last : '100%'} />
      ))}
    </div>
  );
}
