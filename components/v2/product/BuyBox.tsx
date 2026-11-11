'use client';

import Link from 'next/link';
import type { MutableRefObject, RefObject } from 'react';
import type { FitLabel, SideChoice, SidePickerData, VariableProduct } from '@/types';
import { formatRupiah } from '@/lib/v2/home-data';
import { Cart, WhatsApp } from '@/components/v2/icons';
import { MinusIcon, PlusIcon } from '@/components/v2/product/product-icons';
import SidePicker from '@/components/v2/product/SidePicker';
import VariantPicker from '@/components/v2/product/VariantPicker';
import VoucherField from '@/components/v2/product/VoucherField';
import VoucherNotice from '@/components/v2/product/VoucherNotice';
import { isZeroVoucher } from '@/components/v2/product/voucher-notice';
import OrderSummary, { type SummaryRow } from '@/components/v2/product/OrderSummary';
import type { OrderApi } from '@/components/v2/product/useOrder';
import type { ButtonState } from '@/components/v2/product/order-core';
import CopyLinkButton from '@/components/v2/product/CopyLinkButton';

export interface BuyBoxView {
  name: string;
  positionLabel: string | null;
  badge: 'best' | 'baru' | null;
  fit: FitLabel;
  priceRow:
    | { kind: 'single'; price: number; compareAt: number | null; showSaving: boolean; perSide: boolean }
    | { kind: 'range'; low: number; high: number; perSide: true };
  quantityLabel: string;
  summary: { rows: SummaryRow[]; total: string } | null;
  button: ButtonState;
  buttonText: string;
  soldOutAtRender: boolean;
  plainHref: string;
  waHref: string;
}

// F-030 E1, E3: the secondary "Tambah ke keranjang" control under the WhatsApp button.
export interface BuyBoxCart {
  state: 'ready' | 'incomplete' | 'disabled';
  inCart: number;
  onAdd: () => void;
}

// Hides the controls that need JavaScript (S3.3.8). Same pattern as the noscript style of V2Page.
const NOSCRIPT_STYLE = '<style>.iz-js-only { display: none !important; }</style>';

/**
 * Buy box of produk-detail.dc.html / produk-sisi.dc.html (F-016 S3.3, S3.4, S4.2, S4.3). The order control is a plain
 * WhatsApp link in the server HTML (S3.3.8) and becomes the order button after hydration (S3.3.5).
 */
export default function BuyBox({
  view,
  order,
  side,
  choice,
  onChoice,
  product,
  selection,
  onSelectAttr,
  optionsRef,
  waRef,
  onActivate,
  cart,
}: {
  view: BuyBoxView;
  order: OrderApi;
  side: SidePickerData | null;
  choice: SideChoice | null;
  onChoice: (c: SideChoice) => void;
  product: VariableProduct | null;
  selection: Record<string, string>;
  onSelectAttr: (attribute: string, value: string) => void;
  optionsRef: MutableRefObject<HTMLElement | null>;
  waRef: RefObject<HTMLDivElement>;
  onActivate: () => void;
  cart: BuyBoxCart;
}) {
  const { priceRow, fit, badge } = view;
  const qtyId = 'iz-qty-label';
  const msg = order.voucherMessage;

  // A div, not the canvas aside: the buy box sits inside main, and a nested complementary landmark fails axe (S3.3, G-A1).
  return (
    <div className="iz-buybox">
      <noscript dangerouslySetInnerHTML={{ __html: NOSCRIPT_STYLE }} />
      {(view.positionLabel || badge || fit?.kind === 'model') && (
        <div className="iz-row" style={{ gap: 8 }}>
          {view.positionLabel && <span className="iz-cat-chip">{view.positionLabel}</span>}
          {badge && (
            <span className="iz-cat-chip" style={{ background: 'var(--c-aspal)', color: 'var(--c-krem)' }}>
              {badge === 'best' ? 'Best seller' : 'Baru'}
            </span>
          )}
          {fit?.kind === 'model' && <span className="iz-fit">{fit.text}</span>}
        </div>
      )}
      <h1 className="t-h1-product">{view.name}</h1>

      {priceRow.kind === 'range' ? (
        <div className="iz-buybox__price">
          <b>{`${formatRupiah(priceRow.low)} – ${formatRupiah(priceRow.high)}`}</b>
          <span className="iz-per">/ sisi</span>
        </div>
      ) : priceRow.price > 0 ? (
        <div className="iz-buybox__price">
          <b>{formatRupiah(priceRow.price)}</b>
          {priceRow.perSide && <span className="iz-per">/ sisi</span>}
          {priceRow.compareAt !== null && <s>{formatRupiah(priceRow.compareAt)}</s>}
          {priceRow.showSaving && priceRow.compareAt !== null && (
            <span className="iz-save">Hemat {formatRupiah(priceRow.compareAt - priceRow.price)}</span>
          )}
        </div>
      ) : null}

      {fit && fit.kind !== 'model' && (
        <p className="iz-for" style={{ fontSize: 17 }}>
          {fit.text}
        </p>
      )}

      {side ? (
        <SidePicker
          data={side}
          choice={choice}
          onChoice={onChoice}
          name="main"
          waHref={view.waHref}
          fieldsetRef={el => {
            optionsRef.current = el;
          }}
        />
      ) : product ? (
        <VariantPicker
          attributes={product.attributes ?? []}
          variants={product.variants ?? []}
          selection={selection}
          onSelect={onSelectAttr}
          name="varian"
          containerRef={el => {
            optionsRef.current = el;
          }}
        />
      ) : null}

      <div className="iz-qty iz-js-only">
        <span className="iz-field-label" id={qtyId}>
          {view.quantityLabel}
        </span>
        <div className="iz-stepper" role="group" aria-labelledby={qtyId}>
          <button type="button" aria-label="Kurangi" disabled={!order.canDecrement} onClick={order.decrement}>
            <MinusIcon />
          </button>
          <output aria-labelledby={qtyId}>{order.quantity}</output>
          <button type="button" aria-label="Tambah" disabled={!order.canIncrement} onClick={order.increment}>
            <PlusIcon />
          </button>
        </div>
      </div>

      <VoucherField order={order} id="voucher" />

      {/* One live region for voucher and order messages (S3.3.1, S3.3.5, design.md §6). */}
      <div className="iz-buybox__live" aria-live="polite">
        {order.voucher && (
          <VoucherNotice voucher={order.voucher} personal={order.personalVoucher}>
            {!isZeroVoucher(order.voucher) && (
              <p>
                Diskon: -{formatRupiah(order.discount)}
                {order.voucher.type === 'percentage' && order.voucher.maxDiscount ? ` (maks ${formatRupiah(order.voucher.maxDiscount)})` : ''}
              </p>
            )}
          </VoucherNotice>
        )}
        {msg && <p className={`iz-formmsg iz-formmsg--${msg.kind}`}>{msg.text}</p>}
        {order.orderError && <p className="iz-formmsg iz-formmsg--error">{order.orderError}</p>}
      </div>

      {view.summary && <OrderSummary rows={view.summary.rows} total={view.summary.total} />}

      <div className="iz-wa" ref={waRef}>
        <span className="iz-wa__note">Anda akan diarahkan ke WhatsApp</span>
        <OrderControl view={view} order={order} onActivate={onActivate} />
      </div>

      {/* F-030: secondary to the WhatsApp order (D-5); needs JavaScript like the other controls. */}
      <div className="iz-addcart iz-js-only">
        <button
          type="button"
          className="iz-btn iz-btn--secondary iz-addcart__btn"
          disabled={cart.state === 'disabled'}
          aria-disabled={cart.state === 'incomplete' ? true : undefined}
          onClick={cart.onAdd}
        >
          <Cart width={20} height={20} />
          <span>Tambah ke keranjang</span>
        </button>
        {cart.inCart > 0 && (
          <p className="iz-addcart__note">
            Sudah ada {cart.inCart} di <Link href="/keranjang">keranjang</Link>
          </p>
        )}
      </div>

      {/* F-021: copies the product link only (plus ?aff= for a logged-in affiliate); replaces "Bagikan produk". */}
      <CopyLinkButton />

      <div className="iz-buybox__info">
        <span className="iz-infopill">Dibalas admin INZTA</span>
        <span className="iz-infopill">Garansi: tanya admin</span>
        <span className="iz-infopill">Ongkir dikonfirmasi admin</span>
      </div>
    </div>
  );
}

function OrderControl({ view, order, onActivate }: { view: BuyBoxView; order: OrderApi; onActivate: () => void }) {
  const icon = (
    <span className="iz-btn__icon">
      <WhatsApp />
    </span>
  );
  // Server HTML and the first client render: the plain link of S3.3.8, or "Stok Habis" when sold out at render.
  if (!order.mounted) {
    return view.soldOutAtRender ? (
      <a className="iz-btn iz-btn--primary iz-btn--wa" role="link" aria-disabled="true">
        {icon}
        <span>Stok Habis</span>
      </a>
    ) : (
      <a className="iz-btn iz-btn--primary iz-btn--wa" href={view.plainHref} target="_blank" rel="noopener noreferrer">
        {icon}
        <span>Pesan via WhatsApp</span>
      </a>
    );
  }
  const incomplete = view.button === 'incomplete';
  return (
    <button
      type="button"
      className="iz-btn iz-btn--primary iz-btn--wa"
      disabled={view.button === 'processing' || view.button === 'soldout' || view.button === 'missing'}
      aria-disabled={incomplete ? true : undefined}
      onClick={onActivate}
    >
      {icon}
      <span>{view.buttonText}</span>
    </button>
  );
}
