import type { ReactNode } from 'react';
import type { Voucher } from '@/types';
import { voucherNoticeLines } from '@/components/v2/product/voucher-notice';

// Applied-voucher box of the buy box and the cart summary; a 0-value voucher says it gives no price cut.
export default function VoucherNotice({ voucher, personal, children }: { voucher: Voucher; personal: boolean; children?: ReactNode }) {
  const notice = voucherNoticeLines(voucher, personal);
  return (
    <div className="iz-formmsg iz-formmsg--ok">
      <p>
        <b>{notice.title}</b>
      </p>
      {notice.notes.map(n => (
        <p key={n}>{n}</p>
      ))}
      {children}
    </div>
  );
}
