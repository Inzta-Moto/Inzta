import { Product } from '@/types';
import { WA_NUMBER } from '@/lib/firebase'; // Import dari firebase

export function formatPrice(num: number): string {
  return 'Rp ' + num.toLocaleString('id-ID');
}

export function calcDiscount(original: number | undefined, current: number): number {
  if (!original || original <= current) return 0;
  return Math.round(((original - current) / original) * 100);
}

export function buildWaLink(product: Product): string {
  const text = encodeURIComponent(
    `Halo INZTA, saya ingin memesan:\n\n📦 ${product.name}\n💰 ${formatPrice(product.price)}\n\nMohon info ketersediaan stok dan ongkir. Terima kasih!`
  );
  return `https://wa.me/${WA_NUMBER}?text=${text}`;
}

export function buildDetailWaLink(product: Product): string {
  const text = encodeURIComponent(
    `Halo INZTA, saya ingin memesan:\n\n📦 ${product.name}\n💰 ${formatPrice(product.price)}\n${product.features ? '🔧 ' + product.features.join(', ') + '\n' : ''}\n\nMohon info ketersediaan stok dan ongkir. Terima kasih!`
  );
  return `https://wa.me/${WA_NUMBER}?text=${text}`;
}