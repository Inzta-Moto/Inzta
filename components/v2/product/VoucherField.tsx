import type { OrderApi } from '@/components/v2/product/useOrder';

// Voucher field `.iz-voucher` (F-016 S3.3.1): uppercases, applies on "Pakai" or Enter, "Hapus" once applied. Its
// messages are rendered by the buy box live region. Hidden without JavaScript (S3.3.8).
export default function VoucherField({ order, id }: { order: OrderApi; id: string }) {
  const applied = !!order.voucher;
  return (
    <label className="iz-voucher iz-js-only" htmlFor={id}>
      <input
        id={id}
        type="text"
        placeholder="Kode voucher"
        aria-label="Kode voucher"
        autoComplete="off"
        value={order.voucherInput}
        disabled={applied}
        onChange={e => order.changeVoucherInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void order.applyVoucher();
          }
        }}
      />
      {applied ? (
        <button type="button" onClick={order.removeVoucher}>Hapus</button>
      ) : (
        <button type="button" onClick={() => void order.applyVoucher()} disabled={order.checking || !order.voucherInput.trim()}>
          {order.checking ? 'Memeriksa...' : 'Pakai'}
        </button>
      )}
    </label>
  );
}
