'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { MotorCategory } from '@/types';
import { useMotorCategory } from '@/components/v2/MotorCategory';
import { categoryHref } from '@/lib/v2/motor-category';

// A real <a href> to the category page in the server HTML (19.2, 21.5) that also stores the category (4.4, P2-4).
export default function CategoryLink({
  value,
  className,
  children,
  onChosen,
  current = false,
}: {
  value: MotorCategory;
  className?: string;
  children: ReactNode;
  onChosen?: () => void;
  current?: boolean;
}) {
  const { setCategory } = useMotorCategory();
  return (
    <Link
      href={categoryHref(value)}
      className={className}
      aria-current={current ? 'page' : undefined}
      onClick={() => {
        setCategory(value);
        onChosen?.();
      }}
    >
      {children}
    </Link>
  );
}
