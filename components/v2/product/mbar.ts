// Height of the phone zone the fixed order bar covers: 12 px gap + about 120 px two-row bar (F-030: product row, then the
// cart and order buttons) + room to breathe. The same 140 px is the page's bottom padding and scroll-padding while the
// bar is active (v2-product.css), plus the iOS safe area where the browser reports one.
export const MBAR_ZONE_PX = 140;

type Box = Pick<DOMRect, 'top' | 'bottom'>;

// True when any control that must stay tappable (data-mbar-avoid, e.g. "Lihat selengkapnya") sits in the bar's zone,
// so the bar steps aside instead of covering it (bug report Angkasa, 2026-11-04). Pure, so the test can run it.
export function barWouldCover(boxes: readonly Box[], viewportHeight: number, zone = MBAR_ZONE_PX): boolean {
  const top = viewportHeight - zone;
  return boxes.some(b => b.bottom > top && b.top < viewportHeight);
}
