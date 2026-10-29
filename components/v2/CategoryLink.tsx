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
}: {
  value: MotorCategory;
  className?: string;
  children: ReactNode;
  onChosen?: () => void;
}) {
  const { setCategory } = useMotorCategory();
  return (
    <Link
      href={categoryHref(value)}
      className={className}
      onClick={() => {
        setCategory(value);
        onChosen?.();
      }}
    >
      {children}
    </Link>
  );
}
