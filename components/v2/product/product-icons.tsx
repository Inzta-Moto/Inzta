import type { ReactNode } from 'react';

// Inline icons of produk-detail.dc.html, produk-sisi.dc.html, and admin-sisi.dc.html (paths copied from the canvas).
function Svg({ children, strokeWidth = 2, size }: { children: ReactNode; strokeWidth?: number; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const MinusIcon = () => <Svg strokeWidth={2.5}><path d="M5 12h14" /></Svg>;
export const PlusIcon = () => <Svg strokeWidth={2.5}><path d="M5 12h14M12 5v14" /></Svg>;
export const AccPlusIcon = () => <Svg size={18}><path d="M12 5v14M5 12h14" /></Svg>;
export const ShareIcon = () => (
  <Svg size={18}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
  </Svg>
);
export const InfoIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </Svg>
);
export const ArrowLeftIcon = () => <Svg><path d="M19 12H5M12 19l-7-7 7-7" /></Svg>;
export const ArrowRightIcon = () => <Svg><path d="M5 12h14M12 5l7 7-7 7" /></Svg>;
export const PairIcon = () => <Svg><path d="M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4" /></Svg>;
export const CheckIcon = () => <Svg><path d="M20 6 9 17l-5-5" /></Svg>;
export const CameraIcon = () => (
  <Svg>
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
    <circle cx="12" cy="13" r="3" />
  </Svg>
);
