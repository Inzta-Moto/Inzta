import { Check, Clock } from 'lucide-react';

/**
 * Status tile of a commission (E11, E12): kuning clock for pending, green check for paid. Decorative; the row or the
 * detail always says the status in text next to it.
 */
export default function StatusTile({ paid, size = 'md' }: { paid: boolean; size?: 'md' | 'lg' }) {
  return (
    <span className={`iz-aff-tile iz-aff-tile--${paid ? 'paid' : 'pending'}${size === 'lg' ? ' iz-aff-tile--lg' : ''}`} aria-hidden="true">
      {paid ? <Check strokeWidth={2.25} /> : <Clock strokeWidth={2.25} />}
    </span>
  );
}
