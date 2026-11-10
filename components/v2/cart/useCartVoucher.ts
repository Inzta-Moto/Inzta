'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Voucher } from '@/types';
import { checkVoucher, landingAffiliateCode, recalcVoucher, resolveAffiliateVoucher, type FetchLike } from '@/components/v2/product/order-core';
import type { FormMessage } from '@/components/v2/product/useOrder';

const browserFetch: FetchLike = (input, init) => fetch(input, init);

/**
 * F-030 E11: voucher of the cart summary with the same rules as the buy box (F-016 S3.3.1): affiliate voucher applied
 * automatically while nothing is entered, recomputed on every subtotal change and released below its minimum purchase,
 * and the buyer uid of a logged-in affiliate. It reuses the pure functions of order-core; useOrder stays untouched
 * because it is tied to one product's quantity (spec D-12).
 */
export function useCartVoucher(subtotal: number, active: boolean) {
  const [voucherInput, setVoucherInput] = useState('');
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [discount, setDiscount] = useState(0);
  const [checking, setChecking] = useState(false);
  const [voucherMessage, setVoucherMessage] = useState<FormMessage>(null);
  const [buyerUID, setBuyerUID] = useState<string | null>(null);

  // Same as useOrder: the Auth SDK loads only for a logged-in affiliate.
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

  const removeVoucher = useCallback(() => {
    setVoucherInput('');
    setVoucher(null);
    setVoucherMessage(null);
    setDiscount(0);
  }, []);

  useEffect(() => {
    // Nothing selected: no voucher request (the subtotal 0 would fail every minimum purchase).
    if (!active || subtotal <= 0) return;
    if (!voucher && !voucherMessage && !voucherInput) {
      let storage: Storage | null = null;
      try {
        storage = window.localStorage;
      } catch {
        storage = null;
      }
      const affiliateId = landingAffiliateCode(window.location.search, storage);
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
    // Same triggers as the buy box (subtotal); voucher state changes must not re-run the auto-apply.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal, active]);

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

  const applied = voucher && subtotal > 0 ? discount : 0;
  return {
    voucher,
    voucherInput,
    changeVoucherInput,
    applyVoucher,
    removeVoucher,
    checking,
    voucherMessage,
    discount: applied,
    total: Math.max(0, subtotal - applied),
    buyerUID,
    personalVoucher: !!(buyerUID && voucher?.affiliateId && buyerUID === voucher.affiliateId),
  };
}
