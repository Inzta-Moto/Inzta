'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { MotorCategory } from '@/types';

// The visitor's motor category (F-016 5). The server cannot read it, so every render starts as "not chosen" and the
// stored value is applied after mount (5.2). Storage can throw in private mode; the page must keep working (5.1).
export const MOTOR_CATEGORY_KEY = 'inzta.motorCategory';
const VALUES: readonly MotorCategory[] = ['matic', 'adventure', 'retro', 'trail'];

function parse(v: string | null): MotorCategory | null {
  return v && (VALUES as readonly string[]).includes(v) ? (v as MotorCategory) : null;
}

interface Ctx {
  category: MotorCategory | null;
  setCategory: (c: MotorCategory) => void;
}

const MotorCategoryContext = createContext<Ctx>({ category: null, setCategory: () => {} });

export function MotorCategoryProvider({ children }: { children: ReactNode }) {
  const [category, setState] = useState<MotorCategory | null>(null);

  useEffect(() => {
    try {
      setState(parse(window.localStorage.getItem(MOTOR_CATEGORY_KEY)));
    } catch {
      // Storage blocked: stay "not chosen".
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === MOTOR_CATEGORY_KEY) setState(parse(e.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setCategory = useCallback((c: MotorCategory) => {
    setState(c);
    try {
      window.localStorage.setItem(MOTOR_CATEGORY_KEY, c);
    } catch {
      // Storage blocked: the choice lasts for this page view only.
    }
  }, []);

  const value = useMemo(() => ({ category, setCategory }), [category, setCategory]);
  return <MotorCategoryContext.Provider value={value}>{children}</MotorCategoryContext.Provider>;
}

export function useMotorCategory(): Ctx {
  return useContext(MotorCategoryContext);
}
