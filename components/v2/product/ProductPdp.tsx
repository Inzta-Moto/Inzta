'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { FitLabel, Product, SideChoice, VariableProduct } from '@/types';
import { formatRupiah } from '@/lib/v2/home-data';
import Gallery, { type GalleryTile } from '@/components/v2/product/Gallery';
import BuyBox, { type BuyBoxView } from '@/components/v2/product/BuyBox';
import MobileOrderBar from '@/components/v2/product/MobileOrderBar';
import { useOrder } from '@/components/v2/product/useOrder';
import { BUTTON_TEXT, INCOMPLETE_TEXT, genericButton, genericState, type ButtonState } from '@/components/v2/product/order-core';
import {
  buildSideItems,
  maxQuantity as sideMax,
  optionFor,
  quantityLabel,
  sepasangWaLine,
  sidePicker,
  sidePriceRow,
  sideSummary,
} from '@/components/v2/product/side';
import type { SummaryRow } from '@/components/v2/product/OrderSummary';

export interface PdpProps {
  product: Product;
  images: string[];
  positionLabel: string | null;
  badge: 'best' | 'baru' | null;
  fit: FitLabel;
  cropClass: string | null;
  waHref: string;
  plainHref: string;
  soldOut: boolean;
}

const firstPhotoOf = (v: { images?: string[] } | undefined) => v?.images?.find(Boolean) ?? null;

/**
 * Client island of the product page (F-016 S3.2, S3.3, S3.9, S4.2–S4.4): gallery, buy box, and mobile bar share the
 * selection, so a chosen variant or side can switch the main photo. Everything renders on the server too; only the
 * order control changes after hydration (S3.3.8).
 */
export default function ProductPdp({ product, images, positionLabel, badge, fit, cropClass, waHref, plainHref, soldOut }: PdpProps) {
  const side = useMemo(() => sidePicker(product), [product]);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [choice, setChoice] = useState<SideChoice | null>(null);
  const [active, setActive] = useState(0);
  const [switched, setSwitched] = useState(false);
  const waRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLElement | null>(null);

  // S3.2 / S4.4.1: product photos, then (side products) Foto kiri, Foto kanan, Foto sepasang.
  const tiles = useMemo<GalleryTile[]>(() => {
    const total = images.length;
    const list: GalleryTile[] = images.map((src, i) => ({
      kind: 'photo',
      src,
      label: `Foto ${i + 1} dari ${total}`,
      // G-C4: the crop rule belongs to the main photo of the slug.
      crop: i === 0 ? cropClass : null,
    }));
    if (side) {
      for (const s of ['kiri', 'kanan'] as const) {
        const photo = firstPhotoOf(side.variants[s]);
        const text = s === 'kiri' ? 'Foto kiri' : 'Foto kanan';
        list.push(photo ? { kind: 'photo', src: photo, label: text } : { kind: 'placeholder', text, label: `${text} belum tersedia` });
      }
      // S4.4.2: no data field for a pair photo yet (P-16).
      list.push({ kind: 'placeholder', text: 'Foto sepasang', label: 'Foto sepasang belum tersedia' });
    }
    return list;
  }, [images, cropClass, side]);

  const selectTile = useCallback((i: number) => {
    setActive(i);
    setSwitched(true);
  }, []);

  const generic = useMemo(() => (side ? null : genericState(product, selection)), [side, product, selection]);

  // Side derived state (S4.2–S4.3).
  const sideOption = side && choice ? optionFor(side, choice) : null;
  const sideRow = side ? sidePriceRow(side, choice) : null;
  const sideMaxQty = side && choice ? sideMax(side, choice) : 0;
  const sideCanOrder = !!sideOption && !sideOption.disabled && sideMaxQty > 0;
  // Without a choice the voucher subtotal uses the price row, as the generic page uses priceFrom.
  const sideUnit = sideOption ? sideOption.price : sideRow ? (sideRow.kind === 'single' ? sideRow.price : sideRow.low) : 0;

  const unitTotal = side ? sideUnit : generic!.unitPrice;
  const canOrder = side ? sideCanOrder : generic!.canOrder;
  const maxQty = side ? sideMaxQty : generic!.maxQuantity;
  const selectionKey = side ? choice ?? '' : JSON.stringify(selection);

  const buildItems = useCallback(
    (q: number) =>
      side && choice
        ? buildSideItems(product.slug, side, choice, q)
        : [{ productSlug: product.slug, variationId: generic?.selected?.variationId ?? null, quantity: q }],
    [side, choice, product.slug, generic],
  );
  const extraLine = useCallback((q: number) => (choice === 'sepasang' ? sepasangWaLine(q) : undefined), [choice]);

  const order = useOrder({ slug: product.slug, unitTotal, maxQuantity: maxQty, canOrder, selectionKey, buildItems, extraLine });

  // S3.3.2 / S4.2.1–S4.2.3 button state.
  let button: ButtonState;
  if (order.processing) button = 'processing';
  else if (side) button = side.allSoldOut ? 'soldout' : !choice ? 'incomplete' : sideCanOrder ? 'ready' : 'soldout';
  else button = genericButton(generic!, false);
  const buttonText = button === 'incomplete' ? (side ? INCOMPLETE_TEXT.side : INCOMPLETE_TEXT.generic) : BUTTON_TEXT[button];

  // S4.2.1 / S3.9.2: while incomplete the button stays focusable and moves focus to the first enabled option.
  const focusFirstOption = useCallback(() => {
    const input = optionsRef.current?.querySelector<HTMLInputElement>('input[type="radio"]:not(:disabled)');
    if (!input) return;
    input.scrollIntoView({ block: 'center', behavior: 'smooth' });
    input.focus({ preventScroll: true });
  }, []);
  const activate = useCallback(() => {
    if (button === 'incomplete') focusFirstOption();
    else if (button === 'ready') void order.submit();
  }, [button, focusFirstOption, order]);

  const onSelectAttr = (attribute: string, value: string) => {
    const next = { ...selection, [attribute]: value };
    setSelection(next);
    // S3.2.2: a matched variant with photos switches the main image; otherwise back to the first photo.
    const matched = genericState(product, next).selected;
    const photo = firstPhotoOf(matched ?? undefined);
    const idx = photo ? tiles.findIndex(t => t.kind === 'photo' && t.src === photo) : -1;
    setActive(idx >= 0 ? idx : 0);
    setSwitched(true);
  };

  const onChoice = (c: SideChoice) => {
    setChoice(c);
    // S4.4.3: Kiri or Kanan with a photo switch the main image; Sepasang or a side without a photo keep it.
    if (side && c !== 'sepasang' && firstPhotoOf(side.variants[c])) {
      const idx = images.length + (c === 'kiri' ? 0 : 1);
      if (tiles[idx]?.kind === 'photo') {
        setActive(idx);
        setSwitched(true);
      }
    }
  };

  // Summary rows (S3.3.3 generic, S4.3 side).
  let summary: { rows: SummaryRow[]; total: string } | null = null;
  const voucherRows: SummaryRow[] = order.voucher ? [{ label: 'Diskon Voucher', value: `-${formatRupiah(order.discount)}` }] : [];
  if (side) {
    if (choice) {
      const s = sideSummary(choice, order.quantity);
      summary = { rows: [{ label: 'Pilihan', value: s.pilihan }, { label: 'Isi pesanan', value: s.isi }, ...voucherRows], total: formatRupiah(order.total) };
    }
  } else if (generic!.complete && (order.quantity > 1 || order.voucher)) {
    const subtotalRow: SummaryRow[] = order.voucher ? [{ label: `Subtotal (${order.quantity} item)`, value: formatRupiah(order.subtotal) }] : [];
    summary = { rows: [...subtotalRow, ...voucherRows], total: formatRupiah(order.total) };
  }

  const view: BuyBoxView = {
    name: product.name,
    positionLabel,
    badge,
    fit,
    priceRow: side
      ? sideRow!.kind === 'range'
        ? { kind: 'range', low: sideRow!.low, high: sideRow!.high, perSide: true }
        : { kind: 'single', price: sideRow!.price, compareAt: sideRow!.compareAt, showSaving: sideRow!.compareAt !== null, perSide: true }
      : { kind: 'single', price: generic!.unitPrice, compareAt: generic!.compareAt, showSaving: generic!.showSaving, perSide: false },
    quantityLabel: side ? quantityLabel(choice) : 'Jumlah',
    summary,
    button,
    buttonText,
    soldOutAtRender: soldOut,
    plainHref,
    waHref,
  };

  const mainImage = images[0] ?? null;
  const shareImage = tiles[active]?.kind === 'photo' ? (tiles[active] as Extract<GalleryTile, { kind: 'photo' }>).src : product.imageUrl ?? null;

  return (
    <section className="iz-pdp iz-wrap">
      <Gallery tiles={tiles} active={active} onSelect={selectTile} name={product.name} positionLabel={positionLabel} switched={switched} />
      <BuyBox
        view={view}
        order={order}
        side={side}
        choice={choice}
        onChoice={onChoice}
        product={product.productType === 'variable' ? (product as VariableProduct) : null}
        selection={selection}
        onSelectAttr={onSelectAttr}
        optionsRef={optionsRef}
        waRef={waRef}
        onActivate={activate}
        shareImage={shareImage}
      />
      {order.mounted && (
        <MobileOrderBar
          target={waRef}
          image={mainImage}
          name={product.name}
          price={view.priceRow.kind === 'single' ? formatRupiah(view.priceRow.price) : `${formatRupiah(view.priceRow.low)} – ${formatRupiah(view.priceRow.high)}`}
          label={button === 'ready' ? `Pesan · ${formatRupiah(order.total)}` : buttonText}
          disabled={button === 'processing' || button === 'soldout' || button === 'missing'}
          ariaDisabled={button === 'incomplete'}
          onActivate={activate}
        />
      )}
    </section>
  );
}
