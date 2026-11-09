'use client';

import type { MouseEvent } from 'react';
import { commissionMeta, commissionTitle, formatDateTime, formatRupiah, type AffCommission, type MonthGroup } from '@/lib/affiliate/dashboard';
import StatusChip from './StatusChip';
import StatusTile from './StatusTile';
import { priceText } from './model';

/**
 * Transactions from 1024 px (E11): Produk, Harga, Komisi, Status, Tanggal, a krem header, month groups with a
 * subtotal. The product cell holds a real button (keyboard and screen readers); a click anywhere else on the row opens
 * the same detail, with focus moved to that button first so it comes back there when the detail closes.
 */
export default function CommissionTable({
  groups,
  onOpen,
}: {
  groups: MonthGroup[];
  onOpen: (commission: AffCommission, trigger: HTMLElement) => void;
}) {
  const onRowClick = (e: MouseEvent<HTMLTableRowElement>, c: AffCommission) => {
    const button = e.currentTarget.querySelector<HTMLButtonElement>('.iz-aff-table__open');
    if (!button) return;
    // The button's own click lands here too; one handler covers both.
    button.focus({ preventScroll: true });
    onOpen(c, button);
  };

  return (
    <div className="iz-aff-txtable">
      <table className="iz-aff-table">
        <colgroup>
          <col />
          <col className="iz-aff-table__col-price" />
          <col className="iz-aff-table__col-amount" />
          <col className="iz-aff-table__col-status" />
          <col className="iz-aff-table__col-date" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Produk</th>
            <th scope="col" className="iz-aff-table__num">
              Harga
            </th>
            <th scope="col" className="iz-aff-table__num">
              Komisi
            </th>
            <th scope="col">Status</th>
            <th scope="col">Tanggal</th>
          </tr>
        </thead>
        {groups.map((g) => (
          <tbody key={g.key}>
            <tr className="iz-aff-table__group">
              <th scope="rowgroup" colSpan={5}>
                <span className="iz-aff-table__group-row">
                  <span>{g.label}</span>
                  <span className="iz-aff-num">Subtotal {formatRupiah(g.subtotal)}</span>
                </span>
              </th>
            </tr>
            {g.items.map((c) => {
              const meta = commissionMeta(c);
              return (
                <tr key={c.id} className="iz-aff-table__row" onClick={(e) => onRowClick(e, c)}>
                  <td>
                    <button type="button" className="iz-aff-table__open" aria-haspopup="dialog">
                      <StatusTile paid={!!c.isPaid} />
                      <span className="iz-aff-row__main">
                        <span className="iz-aff-row__title">{commissionTitle(c)}</span>
                        {meta && <span className="iz-aff-row__meta">{meta}</span>}
                      </span>
                    </button>
                  </td>
                  <td className="iz-aff-table__num iz-aff-table__price iz-aff-num">{priceText(c)}</td>
                  <td className="iz-aff-table__num iz-aff-table__amount iz-aff-num">{formatRupiah(c.commissionAmount ?? 0)}</td>
                  <td>
                    <StatusChip commission={c} />
                  </td>
                  <td className="iz-aff-table__date iz-aff-num">{formatDateTime(c.createdAt) || '–'}</td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}
