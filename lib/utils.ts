import { Product } from '@/types';
import { WA_NUMBER } from '@/lib/firebase'; // Import dari firebase

export function formatPrice(num: number): string {
  return 'Rp ' + num.toLocaleString('id-ID');
}

export function formatDate(val: any, options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }): string {
  if (!val) return '-';
  let date: Date;
  
  if (val instanceof Date) {
    date = val;
  } else if (typeof val === 'number') {
    date = new Date(val);
  } else if (typeof val === 'string') {
    date = new Date(val);
  } else if (typeof val === 'object') {
    if (typeof val.seconds === 'number') date = new Date(val.seconds * 1000);
    else if (typeof val._seconds === 'number') date = new Date(val._seconds * 1000);
    else return '-';
  } else {
    return '-';
  }
  
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('id-ID', options);
}

export function calcDiscount(original: number | undefined, current: number): number {
  if (!original || original <= current) return 0;
  return Math.round(((original - current) / original) * 100);
}

export function buildWaLink(product: Product, orderId?: string): string {
  let msg = `PESANAN PRODUK\n`;
  if (orderId) msg += `Order ID: #${orderId}\n`;
  msg += `\n`;
  msg += `${product.name}\n`;
  msg += `Harga: ${formatPrice(product.price)}\n\n`;
  msg += `Data Pemesan:\nNama: \nNo. HP: \nAlamat: \n\nTerima kasih!`;
  
  return `https://api.whatsapp.com/send?phone=${WA_NUMBER}&text=${encodeURIComponent(msg)}`;
}
