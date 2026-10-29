'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { OrderItemInput, Voucher } from '@/types';
import {
  buildOrderBody,
  checkVoucher,
  recalcVoucher,
  resolveAffiliateVoucher,
  submitOrder,
  type FetchLike,
} from '@/components/v2/product/order-core';

export type FormMessage = { kind: 'error' | 'info'; text: string } | null;

export interface UseOrderOptions {
  slug: string;
  // Price of one quantity step: the variant price, or Kiri + Kanan for Sepasang (S4.3.3).
  unitTotal: number;
  maxQuantity: number;
  canOrder: boolean;
  // The quantity goes back to 1 when this changes (variant or side choice, S3.3.4, S4.3.1).
  selectionKey: string;
  buildItems: (quantity: number) => OrderItemInput[];
  extraLine?: (quantity: number) => string | undefined;
}

const browserFetch: FetchLike = (input, init) => fetch(input, init);

/**
 * Order flow of the v2 buy box (F-016 S3.3, E2), moved from DetailClient.tsx: quantity, voucher (manual and affiliate
 * auto-apply), buyer uid for affiliates, and POST /api/orders followed by the WhatsApp redirect in the same tab
 * (S3.3.6). Messages go to one live region instead of toasts and alert (S3.3.1, S3.3.5).
 */
export function useOrder({ slug, unitTotal, maxQuantity, canOrder, selectionKey, buildItems, extraLine }: UseOrderOptions) {
  const [mounted, setMounted] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [voucherInput, setVoucherInput] = useState('');
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [discount, setDiscount] = useState(0);
  const [checking, setChecking] = useState(false);
  const [voucherMessage, setVoucherMessage] = useState<FormMessage>(null);
  const [processing, setProcessing] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [buyerUID, setBuyerUID] = useState<string | null>(null);
  // A ref, not only state: two quick activations happen before React re-renders (S3.3.2).
  const busy = useRef(false);

  const subtotal = unitTotal * quantity;

  useEffect(() => setMounted(true), []);

  // DetailClient subscribed to Firebase Auth on every visit; the uid was used only for logged-in affiliates, so the
  // Auth SDK now loads only for them (same buyerUID, less JavaScript for everyone else).
  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    let flag = false;
    try {
      flag = localStorage.getItem('is_affiliate_logged_in') === 'true';
    } catch {
      flag = false;
    }
    if (!flag) return;
    Promise.all([import('@/lib/firebase'), import('firebase/auth')])
      .then(([{ auth }, { onAuthStateChanged }]) => {
        if (cancelled) return;
        unsub = onAuthStateChanged(auth, user => {
          const isAffiliate = localStorage.getItem('is_affiliate_logged_in') === 'true';
          setBuyerUID(user && isAffiliate ? user.uid : null);
        });
      })
      .catch(() => setBuyerUID(null));
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  useEffect(() => {
    setQuantity(1);
  }, [selectionKey]);

  // Stock can drop below the chosen quantity when the choice changes; keep 1..max.
  useEffect(() => {
    setQuantity(q => Math.max(1, Math.min(q, Math.max(1, maxQuantity))));
  }, [maxQuantity]);

  const removeVoucher = useCallback(() => {
    setVoucherInput('');
    setVoucher(null);
    setVoucherMessage(null);
    setDiscount(0);
  }, []);

  // DetailClient effect: auto-apply the affiliate voucher while nothing is entered, else recompute the discount on
  // every subtotal change and release the voucher below its minimum purchase (S3.3.1).
  useEffect(() => {
    if (!voucher && !voucherMessage && !voucherInput) {
      let affiliateId: string | null = null;
      try {
        affiliateId = localStorage.getItem('inzta_affiliate');
      } catch {
        affiliateId = null;
      }
      if (!affiliateId) return;
      let cancelled = false;
      setChecking(true);
      resolveAffiliateVoucher(affiliateId, subtotal, browserFetch).then(r => {
        if (cancelled) return;
        setChecking(false);
        if (!r) return;
        setVoucherInput(r.voucher.code);
        setVoucher(r.voucher);
        setDiscount(r.discount);
      });
      return () => {
        cancelled = true;
        setChecking(false);
      };
    }
    if (voucher) {
      const r = recalcVoucher(voucher, subtotal);
      if (r.released) {
        removeVoucher();
        setVoucherMessage({ kind: 'error', text: r.message });
      } else {
        setDiscount(r.discount);
      }
    }
    // Same triggers as DetailClient (product and subtotal); voucher state changes must not re-run the auto-apply.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, subtotal]);

  const applyVoucher = useCallback(async () => {
    if (!voucherInput.trim() || checking) return;
    setChecking(true);
    setVoucherMessage(null);
    setVoucher(null);
    setDiscount(0);
    const r = await checkVoucher(voucherInput, subtotal, browserFetch);
    setChecking(false);
    if (r.ok) {
      setVoucher(r.voucher);
      setDiscount(r.discount);
    } else {
      setVoucherMessage({ kind: 'error', text: r.message });
    }
  }, [voucherInput, checking, subtotal]);

  const changeVoucherInput = useCallback((value: string) => {
    setVoucherInput(value.toUpperCase());
    setVoucherMessage(null);
  }, []);

  const submit = useCallback(async () => {
    if (busy.current || !canOrder) return;
    busy.current = true;
    setProcessing(true);
    setOrderError(null);
    const body = buildOrderBody(buildItems(quantity), voucher, buyerUID);
    const r = await submitOrder(body, browserFetch, extraLine?.(quantity));
    if (r.ok) {
      // S3.3.6: same tab; a new tab opened after an await is blocked by popup blockers.
      window.location.href = r.href;
    } else {
      setOrderError(r.message);
    }
    busy.current = false;
    setProcessing(false);
  }, [canOrder, buildItems, quantity, voucher, buyerUID, extraLine]);

  const max = Math.max(1, maxQuantity);
  return {
    mounted,
    quantity,
    decrement: () => setQuantity(q => Math.max(1, q - 1)),
    increment: () => setQuantity(q => Math.min(max, q + 1)),
    canDecrement: canOrder && quantity > 1,
    canIncrement: canOrder && quantity < maxQuantity,
    subtotal,
    discount: voucher ? discount : 0,
    total: subtotal - (voucher ? discount : 0),
    voucher,
    voucherInput,
    changeVoucherInput,
    applyVoucher,
    removeVoucher,
    checking,
    voucherMessage,
    // "Voucher pribadi" note: the buyer is the voucher's own affiliate (S3.3.1).
    personalVoucher: !!(buyerUID && voucher?.affiliateId && buyerUID === voucher.affiliateId),
    processing,
    orderError,
    submit,
  };
}

export type OrderApi = ReturnType<typeof useOrder>;
