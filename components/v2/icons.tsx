import type { ReactNode, SVGProps } from 'react';

// Inline line icons from the design (Lucide-style paths copied from Main.dc.html); no icon package (DS README "Foto dan ikon").
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Line({ size, children, strokeWidth = 2, ...rest }: IconProps & { children: ReactNode }) {
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
      {...rest}
    >
      {children}
    </svg>
  );
}

export const ArrowRight = (p: IconProps) => <Line {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Line>;
export const ArrowUpRight = (p: IconProps) => <Line {...p}><path d="M7 17 17 7M8 7h9v9" /></Line>;
export const ChevronDown = (p: IconProps) => <Line {...p}><path d="m6 9 6 6 6-6" /></Line>;
export const ChevronLeft = (p: IconProps) => <Line {...p}><path d="m15 18-6-6 6-6" /></Line>;
export const ChevronRight = (p: IconProps) => <Line {...p}><path d="m9 18 6-6-6-6" /></Line>;
export const Menu = (p: IconProps) => <Line {...p}><path d="M4 6h16M4 12h16M4 18h16" /></Line>;
export const Close = (p: IconProps) => <Line {...p}><path d="M18 6 6 18M6 6l12 12" /></Line>;
export const Check = (p: IconProps) => <Line strokeWidth={3} {...p}><path d="M20 6 9 17l-5-5" /></Line>;
export const Motorcycle = (p: IconProps) => (
  <Line {...p}><circle cx="5.5" cy="17" r="3.5" /><circle cx="18.5" cy="17" r="3.5" /><path d="M15 6h2l3 11M5.5 17l4-7h6l-3 7M9.5 10 8 7H5" /></Line>
);
export const CircleCheck = (p: IconProps) => <Line {...p}><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></Line>;
export const Scissors = (p: IconProps) => (
  <Line {...p}><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12" /></Line>
);
export const Chat = (p: IconProps) => <Line {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></Line>;
export const Road = (p: IconProps) => <Line {...p}><path d="M3 20 9 4M21 20 15 4M12 6v2M12 11v2M12 16v2" /></Line>;
export const Shield = (p: IconProps) => <Line {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /></Line>;
export const Truck = (p: IconProps) => (
  <Line {...p}>
    <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
    <circle cx="17" cy="18" r="2" />
    <circle cx="7" cy="18" r="2" />
  </Line>
);
export const Bag = (p: IconProps) => <Line {...p}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18M16 10a4 4 0 0 1-8 0" /></Line>;
export const BadgeCheck = (p: IconProps) => <Line {...p}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></Line>;
export const Bolt = (p: IconProps) => <Line {...p}><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /></Line>;

export function WhatsApp({ size, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" focusable="false" {...rest}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}
