import { ChevronRight } from 'lucide-react';
import { commissionTitle, formatRupiah, type AffCommission, type MonthGroup } from '@/lib/affiliate/dashboard';
import StatusTile from './StatusTile';
import { rowMeta, rowStatusText } from './model';

/**
 * Transactions below 1024 px (E11): month groups with their subtotal, then one row per commission. The whole row is a
 * button that opens the detail (E12); the arrow is hidden under 360 px, where the row stays tappable.
 */
export default function CommissionList({
  groups,
  onOpen,
}: {
  groups: MonthGroup[];
  onOpen: (commission: AffCommission, trigger: HTMLElement) => void;
}) {
  return (
    <div className="iz-aff-txlist">
      {groups.map((g) => (
        <div key={g.key} className="iz-aff-txlist__group">
          <div className="iz-aff-txlist__month">
            <h3 className="iz-aff-txlist__month-name">{g.label}</h3>
            <p className="iz-aff-txlist__subtotal iz-aff-num">
              <span className="iz-aff-sr-only">Subtotal </span>
              {formatRupiah(g.subtotal)}
            </p>
          </div>
          <ul className="iz-aff-txlist__rows" role="list">
            {g.items.map((c) => {
              const meta = rowMeta(c);
              return (
                <li key={c.id}>
                  <button type="button" className="iz-aff-row" aria-haspopup="dialog" onClick={(e) => onOpen(c, e.currentTarget)}>
                    <StatusTile paid={!!c.isPaid} />
                    <span className="iz-aff-row__main">
                      <span className="iz-aff-row__title">{commissionTitle(c)}</span>
                      {meta && <span className="iz-aff-row__meta">{meta}</span>}
                    </span>
                    <span className="iz-aff-row__side">
                      <span className="iz-aff-row__amount iz-aff-num">{formatRupiah(c.commissionAmount ?? 0)}</span>
                      <span className={`iz-aff-row__status iz-aff-row__status--${c.isPaid ? 'paid' : 'pending'}`}>{rowStatusText(c)}</span>
                    </span>
                    <ChevronRight className="iz-aff-row__arrow" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
