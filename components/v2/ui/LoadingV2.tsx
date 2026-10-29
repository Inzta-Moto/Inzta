import V2StaticFrame from '@/components/v2/V2StaticFrame';
import type { NavTab } from '@/components/v2/SiteNav';
import { Skeleton, SkeletonCard, SkeletonLines } from '@/components/v2/ui/Skeleton';

type Variant = 'home' | 'catalog' | 'product' | 'motor' | 'blog' | 'article' | 'about';

const CURRENT: Partial<Record<Variant, NavTab>> = { catalog: 'produk', product: 'produk', motor: 'motor', blog: 'artikel', article: 'artikel', about: 'tentang' };

function Cards({ n }: { n: number }) {
  return (
    <div className="iz-grid-4">
      {Array.from({ length: n }, (_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}

// Skeleton of each v2 route's first screen (F-016 S0.12.3, design.md §6), inside the frame without data.
export default function LoadingV2({ variant }: { variant: Variant }) {
  return (
    <V2StaticFrame current={CURRENT[variant]} busy>
      <div className="iz-loading">
        <div className="iz-wrap iz-stack" style={{ gap: 32 }}>
          {variant === 'home' && (
            <>
              <Skeleton h="clamp(320px, 60vh, 560px)" r="var(--radius-band)" />
              <div className="iz-grid-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} h="160px" r="var(--radius-tile)" />)}</div>
              <Cards n={4} />
            </>
          )}
          {variant === 'catalog' && (
            <>
              <Skeleton h="48px" w="min(560px, 90%)" />
              <Skeleton h="56px" r="var(--radius-pill)" />
              <Cards n={8} />
            </>
          )}
          {variant === 'product' && (
            <div className="iz-grid-2">
              <Skeleton h="auto" r="var(--radius-tile)" className="iz-skel--square" />
              <div className="iz-stack">
                <Skeleton h="40px" w="80%" />
                <Skeleton h="28px" w="40%" />
                <SkeletonLines count={4} />
                <Skeleton h="56px" r="var(--radius-pill)" />
              </div>
            </div>
          )}
          {variant === 'motor' && (
            <>
              <Skeleton h="clamp(240px, 40vh, 380px)" r="var(--radius-band)" dark />
              <div className="iz-row">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} h="44px" w="120px" r="var(--radius-pill)" />)}</div>
              <Cards n={4} />
            </>
          )}
          {variant === 'blog' && (
            <>
              <Skeleton h="48px" w="min(420px, 80%)" />
              <Skeleton h="clamp(240px, 40vh, 420px)" r="var(--radius-tile)" />
              <div className="iz-grid-3">{Array.from({ length: 3 }, (_, i) => <SkeletonCard key={i} />)}</div>
            </>
          )}
          {variant === 'article' && (
            <div className="iz-stack" style={{ maxWidth: 760 }}>
              <Skeleton h="48px" w="90%" />
              <Skeleton h="20px" w="40%" />
              <Skeleton h="clamp(220px, 40vh, 420px)" r="var(--radius-tile)" />
              <SkeletonLines count={6} />
            </div>
          )}
          {variant === 'about' && (
            <>
              <Skeleton h="clamp(320px, 60vh, 560px)" r="var(--radius-band)" dark />
              <Skeleton h="40px" w="min(520px, 85%)" />
              <div className="iz-skelsteps">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} h="auto" r="var(--radius-tile)" className="iz-skel--portrait" />)}</div>
            </>
          )}
        </div>
      </div>
    </V2StaticFrame>
  );
}
