'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Cart, Trash, WhatsApp } from '@/components/v2/icons';
import { MinusIcon, PlusIcon } from '@/components/v2/product/product-icons';
import VoucherField from '@/components/v2/product/VoucherField';
import Toast, { type ToastMessage } from '@/components/v2/cart/Toast';
import { useCartVoucher } from '@/components/v2/cart/useCartVoucher';
import {
  applyReconcile,
  badgeCount,
  cartTotals,
  hasSharedConflict,
  checkoutLines,
  isOrderable,
  reconcileCart,
  removeLines,
  restoreLines,
  setLineQuantity,
  setSelected,
} from '@/lib/cart/cart-core';
import { checkoutCart } from '@/lib/cart/checkout';
import { readCart, updateCart, useCart, useHydrated } from '@/lib/cart/store';
import type { CartCatalogEntry, CartLineView } from '@/lib/cart/types';
import { CART_MAX_QTY } from '@/lib/cart/types';
import { cldWebp } from '@/lib/v2/image';
import { formatRupiah } from '@/lib/v2/home-data';
import { browserStorage, readFirstTouchUtm } from '@/lib/utm';
import { trackBeginCheckout, trackLead, trackRemoveFromCart, trackViewCart, type CartTrackItem } from '@/lib/tracking';

type Notes = Record<string, { priceWas: number | null; clamped: boolean }>;

const trackItem = (v: CartLineView): CartTrackItem => ({ slug: v.line.productSlug, name: v.name, variant: v.optionLabel, price: v.unitPrice, quantity: v.quantity });

/**
 * /keranjang (F-030 E9–E17). The stored cart is re-checked against the active products the server passed in (D-2);
 * `catalog` null means that read failed (E15). Checkout goes through checkoutCart(), the hand-off point of the spec.
 */
export default function CartPage({ catalog, waHref }: { catalog: CartCatalogEntry[] | null; waHref: string }) {
  const hydrated = useHydrated();
  const cart = useCart();
  const views = useMemo(() => reconcileCart(cart, catalog), [cart, catalog]);
  const orderable = views.filter(isOrderable);
  const blocked = views.filter(v => !isOrderable(v));
  const totals = cartTotals(views);
  const voucher = useCartVoucher(totals.subtotal, hydrated);
  const [notes, setNotes] = useState<Notes>({});
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const viewed = useRef(false);
  const reconciledFor = useRef<CartCatalogEntry[] | null | undefined>(undefined);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const conflict = hasSharedConflict(views);

  // E13/E14: notes are captured from the first comparison, then the new prices and quantities are saved, so the note
  // shows once for this visit and not on the next one. Once per catalog, not on every cart change: two tabs opened
  // before and after a price change would otherwise keep writing their own price over each other (review REV-01).
  useEffect(() => {
    if (!hydrated || reconciledFor.current === catalog) return;
    reconciledFor.current = catalog;
    const fresh: Notes = {};
    for (const v of reconcileCart(readCart(), catalog)) if (v.priceWas !== null || v.clamped) fresh[v.key] = { priceWas: v.priceWas, clamped: v.clamped };
    if (Object.keys(fresh).length) setNotes(n => ({ ...n, ...fresh }));
    updateCart(s => applyReconcile(s, reconcileCart(s, catalog)));
  }, [hydrated, catalog]);

  // REV-02: a page restored from the back-forward cache after WhatsApp opened must not keep the button in "Memproses...".
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      busy.current = false;
      setProcessing(false);
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  // REV-04: on phones the summary with the message is below the list; bring the message into view next to the action.
  useEffect(() => {
    if (!error || !window.matchMedia('(max-width: 767px)').matches) return;
    errorRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    errorRef.current?.focus({ preventScroll: true });
  }, [error]);

  // D-03 of the review: the fixed phone bar needs room under the footer's last line too, so the padding sits on the page.
  const hasBar = hydrated && views.length > 0;
  useEffect(() => {
    if (!hasBar) return;
    const page = document.querySelector<HTMLElement>('.iz-page');
    page?.classList.add('iz-page--cartbar');
    // The bar is one or two lines tall (a long total wraps the button); the page padding follows its real height.
    const bar = barRef.current;
    const ro = bar && page && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => page.style.setProperty('--iz-cartbar-h', `${bar.offsetHeight}px`)) : null;
    if (ro && bar) ro.observe(bar);
    return () => {
      ro?.disconnect();
      page?.classList.remove('iz-page--cartbar');
      page?.style.removeProperty('--iz-cartbar-h');
    };
  }, [hasBar]);

  useEffect(() => {
    if (!hydrated || viewed.current) return;
    viewed.current = true;
    trackViewCart(views.filter(isOrderable).map(trackItem));
  }, [hydrated, views]);

  const closeToast = useCallback(() => setToast(null), []);

  const remove = useCallback(
    (keys: string[], text: string) => {
      const gone = views.filter(v => keys.includes(v.key));
      let removed: ReturnType<typeof removeLines>['removed'] = [];
      updateCart(s => {
        const r = removeLines(s, keys);
        removed = r.removed;
        return r.state;
      });
      if (!removed.length) return;
      trackRemoveFromCart(gone.map(trackItem));
      const back = removed;
      setToast({ id: Date.now(), text, action: { label: 'Batalkan', onClick: () => updateCart(s => restoreLines(s, back)) } });
    },
    [views],
  );

  const allKeys = orderable.map(v => v.key);
  const allSelected = orderable.length > 0 && orderable.every(v => v.line.selected);
  const someSelected = orderable.some(v => v.line.selected);
  const toggleAll = () => updateCart(s => setSelected(s, allKeys, !allSelected));

  const submit = async () => {
    if (busy.current || conflict) return;
    const lines = checkoutLines(views);
    if (!lines.length) return;
    busy.current = true;
    setProcessing(true);
    setError(null);
    const chosen = views.filter(v => isOrderable(v) && v.line.selected);
    trackBeginCheckout(chosen.map(trackItem), voucher.voucher?.code ?? null);
    const r = await checkoutCart(
      { lines, voucher: voucher.voucher, buyerUID: voucher.buyerUID, utm: readFirstTouchUtm(browserStorage(), Date.now()) },
      (input, init) => fetch(input, init),
    );
    if (r.ok) {
      trackLead({ orderId: r.orderId, value: r.value, slugs: Array.from(new Set(lines.map(l => l.productSlug))) }, 'cart');
      // D-11: the ordered lines leave the cart before WhatsApp opens; unselected lines stay.
      updateCart(s => removeLines(s, chosen.map(v => v.key)).state);
      window.location.href = r.href;
      // Same as useOrder: released after the navigation starts, so a return to this tab (WhatsApp app took the link)
      // finds a usable button for the lines left in the cart.
      busy.current = false;
      setProcessing(false);
      return;
    }
    setError(r.message);
    busy.current = false;
    setProcessing(false);
  };

  // Every count on this page is products (lines), like the navbar badge (D-7, Sehan 2026-11-10).
  const count = totals.lines;
  const payLabel = processing ? 'Memproses...' : `Pesan via WhatsApp (${count})`;
  const canPay = count > 0 && !processing && !conflict;

  let body: React.ReactNode;
  if (!hydrated) {
    body = (
      <div className="iz-cart__loading" aria-busy="true">
        <span className="iz-sr">Memuat keranjang</span>
        <div className="iz-cart__skel" />
        <div className="iz-cart__skel" />
      </div>
    );
  } else if (views.length === 0) {
    body = (
      <div className="iz-cartempty">
        <span className="iz-cartempty__icon" aria-hidden="true">
          <Cart width={32} height={32} />
        </span>
        <h2 className="t-h2-shop">Keranjang masih kosong</h2>
        <p>Barang yang ditambahkan dari halaman produk akan muncul di sini.</p>
        <div className="iz-cartempty__actions">
          <Link className="iz-btn iz-btn--primary" href="/produk">
            Lihat produk <ArrowRight width={18} height={18} />
          </Link>
          <a className="iz-link" href={waHref} target="_blank" rel="noopener noreferrer">
            Tanya admin
          </a>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="iz-cart__grid">
        <div className="iz-cart__main">
          {catalog === null && (
            <p className="iz-cart__notice">Harga dan stok terbaru belum bisa dicek. Admin akan mengonfirmasi saat chat.</p>
          )}
          {orderable.length > 0 && (
            <section className="iz-cartlist" aria-label="Barang di keranjang">
              <div className="iz-cartlist__head">
                <label className="iz-cbox">
                  <input type="checkbox" checked={allSelected} ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }} onChange={toggleAll} />
                  <span>Pilih semua ({orderable.length})</span>
                </label>
              </div>
              <ul className="iz-cartlist__rows">
                {orderable.map(v => (
                  <CartRow key={v.key} view={v} note={notes[v.key]} onRemove={() => remove([v.key], 'Produk dihapus dari keranjang.')} />
                ))}
              </ul>
            </section>
          )}
          {blocked.length > 0 && (
            <section className="iz-cartlist iz-cartlist--off" aria-labelledby="iz-cart-off">
              <div className="iz-cartlist__head">
                <h2 id="iz-cart-off" className="iz-cartlist__title">Tidak bisa dipesan ({blocked.length})</h2>
                <button type="button" className="iz-cartlist__clear" aria-label="Hapus semua produk yang tidak bisa dipesan" onClick={() => remove(blocked.map(v => v.key), `${blocked.length} produk dihapus dari keranjang.`)}>
                  Hapus semua
                </button>
              </div>
              <ul className="iz-cartlist__rows">
                {blocked.map(v => (
                  <CartRow key={v.key} view={v} onRemove={() => remove([v.key], 'Produk dihapus dari keranjang.')} />
                ))}
              </ul>
            </section>
          )}
          <p className="iz-cart__device">Isi keranjang tersimpan di browser ini saja, tidak ikut ke HP atau laptop lain.</p>
        </div>

        <aside className="iz-cartsum" aria-label="Ringkasan pesanan">
          <h2 className="t-h3">Ringkasan</h2>
          <dl className="iz-cartsum__rows">
            <div>
              <dt>Subtotal ({totals.lines} produk)</dt>
              <dd>{formatRupiah(totals.subtotal)}</dd>
            </div>
            {voucher.voucher && voucher.discount > 0 && (
              <div>
                <dt>Diskon voucher</dt>
                <dd>-{formatRupiah(voucher.discount)}</dd>
              </div>
            )}
          </dl>
          <VoucherField order={voucher} id="voucher-keranjang" />
          <div className="iz-cartsum__live" aria-live="polite">
            {voucher.voucher && (
              <div className="iz-formmsg iz-formmsg--ok">
                <p>
                  <b>Voucher {voucher.voucher.code} aktif!</b>
                </p>
                {voucher.personalVoucher && <p>Voucher pribadi: Anda mendapatkan diskon, komisi tidak berlaku.</p>}
              </div>
            )}
            {voucher.voucherMessage && <p className={`iz-formmsg iz-formmsg--${voucher.voucherMessage.kind}`}>{voucher.voucherMessage.text}</p>}
            {conflict && <p className="iz-formmsg iz-formmsg--error">Jumlah beberapa pilihan melebihi stok. Kurangi jumlah yang ditandai dulu.</p>}
            {error && (
              <p ref={errorRef} tabIndex={-1} className="iz-formmsg iz-formmsg--error">
                {error}
              </p>
            )}
          </div>
          <div className="iz-cartsum__total">
            <span>Total</span>
            <b>{formatRupiah(voucher.total)}</b>
          </div>
          <p className="iz-cartsum__ship">Ongkir dikonfirmasi admin</p>
          <div className="iz-wa iz-cartsum__pay">
            <span className="iz-wa__note">Anda akan diarahkan ke WhatsApp</span>
            <button type="button" className="iz-btn iz-btn--primary iz-btn--wa" disabled={!canPay} onClick={submit}>
              <span className="iz-btn__icon">
                <WhatsApp />
              </span>
              <span>{count === 0 && !processing ? 'Pilih barang dulu' : payLabel}</span>
            </button>
          </div>
        </aside>

        {/* E11: phone bar with the same total and order button; the full summary stays above it. */}
        {/* E11: "Semua", total, and order button. The total keeps its full width; when it does not fit, the button moves
            to a second line (flex-wrap) instead of covering it. */}
        <div className="iz-cartbar iz-only-mob" ref={barRef}>
          {orderable.length > 0 && (
            <label className="iz-cbox">
              <input type="checkbox" aria-label="Pilih semua produk" checked={allSelected} ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }} onChange={toggleAll} />
              <span aria-hidden="true">Semua</span>
            </label>
          )}
          <div className="iz-cartbar__total">
            <span>Total</span>
            <b>{formatRupiah(voucher.total)}</b>
          </div>
          <button
            type="button"
            className="iz-btn iz-btn--primary iz-btn--wa"
            disabled={!canPay}
            onClick={submit}
            aria-label={processing ? 'Memproses pesanan' : count ? `Pesan ${count} produk via WhatsApp` : undefined}
          >
            <span className="iz-btn__icon">
              <WhatsApp />
            </span>
            <span>{processing ? 'Memproses...' : `Pesan (${count})`}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="iz-cart iz-wrap">
      <nav className="iz-crumb" aria-label="Breadcrumb">
        <Link href="/">Beranda</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Keranjang</span>
      </nav>
      <h1 className="t-h1-product iz-cart__title">
        Keranjang{hasBar && <span className="iz-cart__count"> ({badgeCount(cart)})</span>}
      </h1>
      {body}
      <Toast message={toast} onClose={closeToast} duration={8000} />
    </section>
  );
}

function CartRow({ view: v, note, onRemove }: { view: CartLineView; note?: { priceWas: number | null; clamped: boolean }; onRemove: () => void }) {
  const ok = isOrderable(v);
  const max = Math.min(v.stock ?? CART_MAX_QTY, CART_MAX_QTY);
  const qtyId = `iz-qty-${v.key.replace(/[^a-z0-9]/gi, '-')}`;
  const setQty = (q: number) => updateCart(s => setLineQuantity(s, v.key, q, max));
  const reason = v.status === 'soldout' ? 'Stok habis' : v.status === 'unavailable' ? 'Sedang tidak tersedia' : null;
  return (
    <li className={`iz-cline${ok ? '' : ' iz-cline--off'}`}>
      {ok ? (
        <label className="iz-cline__check">
          <input type="checkbox" checked={v.line.selected} onChange={e => updateCart(s => setSelected(s, [v.key], e.target.checked))} aria-label={`Pilih ${v.name}`} />
        </label>
      ) : (
        <span className="iz-cline__check" aria-hidden="true" />
      )}
      <Link className="iz-cline__img" href={`/produk/${v.line.productSlug}`} tabIndex={-1} aria-hidden="true">
        {v.image ? <img src={cldWebp(v.image, 192)} alt="" width={96} height={96} loading="lazy" decoding="async" /> : <span />}
      </Link>
      <div className="iz-cline__info">
        <Link className="iz-cline__name" href={`/produk/${v.line.productSlug}`}>
          {v.name}
        </Link>
        {v.optionLabel && <span className="iz-cline__opt">{v.optionLabel}</span>}
        <span className="iz-cline__price">
          {formatRupiah(v.unitPrice)}
          {note?.priceWas != null && <small> Harga berubah dari {formatRupiah(note.priceWas)}</small>}
        </span>
        {reason && <span className="iz-cline__reason">{reason}</span>}
        {ok && note?.clamped && <span className="iz-cline__hint">Jumlah disesuaikan dengan stok</span>}
        {v.sharedOver !== null && <span className="iz-cline__hint">Jumlah dengan pilihan lain melebihi stok ({v.sharedOver})</span>}
      </div>
      <div className="iz-cline__side">
        {ok && (
          <div className="iz-stepper" role="group" aria-labelledby={qtyId}>
            <span id={qtyId} className="iz-sr">
              Jumlah {v.name}
            </span>
            <button type="button" aria-label="Kurangi" disabled={v.quantity <= 1} onClick={() => setQty(v.quantity - 1)}>
              <MinusIcon />
            </button>
            <output aria-live="polite">{v.quantity}</output>
            <button type="button" aria-label="Tambah" disabled={v.quantity >= max} onClick={() => setQty(v.quantity + 1)}>
              <PlusIcon />
            </button>
          </div>
        )}
        {ok && <b className="iz-cline__sub">{formatRupiah(v.unitPrice * v.quantity)}</b>}
        <button type="button" className="iz-cline__del" aria-label={`Hapus ${v.name}`} onClick={onRemove}>
          <Trash width={18} height={18} />
        </button>
      </div>
    </li>
  );
}
