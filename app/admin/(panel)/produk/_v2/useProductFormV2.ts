'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MotorCategory, ProductVariant, Side } from '@/types';
import {
  CONFIRM_MODE_CHANGE,
  applyToPayload,
  initialState,
  prefillFromSimple,
  rowsFromVariants,
  validateSideRows,
  type AdminProduct,
  type FormV2State,
  type SaleMode,
  type SideRow,
} from './form-v2';

/**
 * State of the F-016 S4.6 additions to the admin product form ("Cara produk dijual", side table, "Bisa dibeli
 * sepasang", "Kategori motor"). It loads itself from the product being edited when the form opens, so the page only
 * passes its own fields in and merges `apply()` into the save body. Nothing changes data before "Simpan" (S4.6.4).
 */
export function useProductFormV2({
  formView,
  editSlug,
  products,
  setProductType,
  simplePrice,
  simpleCompareAt,
  formVariants,
}: {
  formView: 'list' | 'add' | 'edit';
  editSlug: string;
  products: Array<AdminProduct & { slug?: string }>;
  setProductType: (t: 'simple' | 'variable') => void;
  simplePrice: string;
  simpleCompareAt: string;
  formVariants: ProductVariant[];
}) {
  const [state, setState] = useState<FormV2State>(() => initialState(null));

  useEffect(() => {
    if (formView === 'list') return;
    const p = formView === 'edit' ? products.find(x => x.slug === editSlug) ?? null : null;
    setState(initialState(p));
    // Only when the form opens or another product is edited; later list reloads must not reset the admin's input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formView, editSlug]);

  // S4.6.4: leaving "Dijual per sisi" or "Varian lain" asks first (existing window.confirm pattern).
  const setMode = useCallback(
    (next: SaleMode) => {
      if (next === state.mode) return;
      if (state.mode !== 'none' && !window.confirm(CONFIRM_MODE_CHANGE)) return;
      let rows = state.rows;
      if (next === 'side') {
        if (state.mode === 'none') rows = prefillFromSimple(rows, simplePrice, simpleCompareAt);
        else if (!rows.kiri.variationId && !rows.kanan.variationId) rows = rowsFromVariants(formVariants);
      }
      setState(s => ({ ...s, mode: next, rows }));
      setProductType(next === 'none' ? 'simple' : 'variable');
    },
    [state.mode, state.rows, simplePrice, simpleCompareAt, formVariants, setProductType],
  );

  const updateRow = useCallback((side: Side, patch: Partial<SideRow>) => {
    setState(s => ({ ...s, rows: { ...s.rows, [side]: { ...s.rows[side], ...patch } } }));
  }, []);

  const setBisaSepasang = useCallback((on: boolean) => setState(s => ({ ...s, bisaSepasang: on })), []);

  const toggleKategori = useCallback((c: MotorCategory, on: boolean) => {
    setState(s => ({ ...s, kategoriTouched: true, kategori: on ? Array.from(new Set([...s.kategori, c])) : s.kategori.filter(x => x !== c) }));
  }, []);

  return {
    state,
    mode: state.mode,
    setMode,
    updateRow,
    setBisaSepasang,
    toggleKategori,
    // S4.6.3: inline error for the existing form error region, or null.
    validate: () => (state.mode === 'side' ? validateSideRows(state.rows) : null),
    apply: (data: Record<string, any>) => applyToPayload(data, state, formVariants, () => crypto.randomUUID()),
  };
}

export type ProductFormV2Api = ReturnType<typeof useProductFormV2>;
