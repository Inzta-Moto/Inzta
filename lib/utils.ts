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
  let msg = '';
  if (orderId) {
    msg = `🛒 *PESANAN PRODUK*\n📋 Order ID: #${orderId}\n━━━━━━━━━━━━━━━\n\n📦 *${product.name}*\n💰 ${formatPrice(product.price)}\n\n━━━━━━━━━━━━━━━\n💵 *Total Bayar: ${formatPrice(product.price)}*\n━━━━━━━━━━━━━━━\n\nData Pemesan:\n• Nama: \n• No. HP: \n• Alamat: \n\nTerima kasih! 🙏`;
  } else {
    msg = `Halo INZTA, saya ingin memesan:\n\n📦 ${product.name}\n💰 ${formatPrice(product.price)}\n\nMohon info ketersediaan stok dan ongkir. Terima kasih!`;
  }
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
}

export function buildDetailWaLink(product: Product, orderId?: string): string {
  let msg = '';
  if (orderId) {
    msg = `🛒 *PESANAN PRODUK*\n📋 Order ID: #${orderId}\n━━━━━━━━━━━━━━━\n\n📦 *${product.name}*\n${product.features ? '🔧 ' + product.features.join(', ') + '\n' : ''}\n💰 ${formatPrice(product.price)}\n\n━━━━━━━━━━━━━━━\n💵 *Total Bayar: ${formatPrice(product.price)}*\n━━━━━━━━━━━━━━━\n\nData Pemesan:\n• Nama: \n• No. HP: \n• Alamat: \n\nTerima kasih! 🙏`;
  } else {
    msg = `Halo INZTA, saya ingin memesan:\n\n📦 ${product.name}\n💰 ${formatPrice(product.price)}\n${product.features ? '🔧 ' + product.features.join(', ') + '\n' : ''}\n\nMohon info ketersediaan stok dan ongkir. Terima kasih!`;
  }
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
}