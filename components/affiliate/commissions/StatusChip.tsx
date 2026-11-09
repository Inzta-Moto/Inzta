import { Check, Clock } from 'lucide-react';
import type { AffCommission } from '@/lib/affiliate/dashboard';
import { chipStatusText } from './model';

/** Table status chip (E11, >= 1024 px): "Pending" or "Cair · 2 Nov". */
export default function StatusChip({ commission }: { commission: AffCommission }) {
  const paid = !!commission.isPaid;
  return (
    <span className={`iz-aff-chip iz-aff-chip--${paid ? 'paid' : 'pending'}`}>
      {paid ? <Check aria-hidden="true" strokeWidth={2.5} /> : <Clock aria-hidden="true" strokeWidth={2.5} />}
      {chipStatusText(commission)}
    </span>
  );
}
