import type { Voucher } from '@/types';

// F-030 (Angkasa, 11 Nov): a voucher worth 0 is valid and still carries its affiliate, but gives no price cut. The
// affiliate panel creates every affiliate's voucher at 0% until the admin sets a value in the Voucher menu, so the
// buyer was shown "Voucher X aktif!" with the same total and read it as broken. Shared by the buy box and the cart.
export function isZeroVoucher(v: Pick<Voucher, 'value'> | null | undefined): boolean {
  return !!v && !(Number(v.value) > 0);
}

export function voucherNoticeLines(v: Pick<Voucher, 'code' | 'value'>, personal: boolean): { title: string; notes: string[] } {
  if (isZeroVoucher(v)) {
    return {
      title: `Kode ${v.code} terpasang.`,
      notes: ['Kode ini tidak memberi potongan harga.', ...(personal ? ['Kode pribadi: komisi tidak berlaku.'] : [])],
    };
  }
  return {
    title: `Voucher ${v.code} aktif!`,
    notes: personal ? ['Voucher pribadi: Anda mendapatkan diskon, komisi tidak berlaku.'] : [],
  };
}
