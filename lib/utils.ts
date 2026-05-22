import { Product } from '@/types';
import { WA_NUMBER } from '@/lib/firebase'; // Import dari firebase

export function formatPrice(num: number): string {
  return 'Rp ' + num.toLocaleString('id-ID');
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