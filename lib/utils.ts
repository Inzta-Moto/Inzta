import { WA_NUMBER } from '@/lib/constants';

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
  // Fixed zone: server renders (UTC on Vercel) and browsers must print the same day.
  return date.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', ...options });
}

export function calcDiscount(original: number | undefined, current: number): number {
  if (!original || original <= current) return 0;
  return Math.round(((original - current) / original) * 100);
}

export function buildWaLink(
  orderId: string,
  items: Array<{
    productName: string;
    selectedVariantLabel: string | null;
    sku: string | null;
    quantity: number;
    price: number;
    subtotal: number;
  }>,
  totals: {
    totalPrice: number;
    discountAmount: number;
    voucherCode: string | null;
    finalPrice: number;
  },
  // F-016 S4.3.4: optional line right after the order ID (the Sepasang choice); existing callers pass nothing.
  extraLine?: string,
): string {
  let msg = `PESANAN PRODUK\nOrder ID: #${orderId}\n${extraLine ? `${extraLine}\n` : ''}\n`;

  for (const item of items) {
    msg += `${item.productName}`;
    if (item.selectedVariantLabel) msg += ` — ${item.selectedVariantLabel}`;
    if (item.sku) msg += ` (SKU: ${item.sku})`;
    msg += `\n`;
    msg += `Jumlah: ${item.quantity} × ${formatPrice(item.price)} = ${formatPrice(item.subtotal)}\n\n`;
  }

  if (totals.discountAmount > 0) {
    msg += `Subtotal: ${formatPrice(totals.totalPrice)}\n`;
    if (totals.voucherCode) msg += `Voucher: ${totals.voucherCode}\n`;
    msg += `Diskon: -${formatPrice(totals.discountAmount)}\n`;
  }
  msg += `Total Bayar: ${formatPrice(totals.finalPrice)}\n\n`;
  msg += `Data Pemesan:\nNama: \nNo. HP: \nAlamat: \n\nTerima kasih!`;

  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
}

export function clearAffiliateSession() {
  localStorage.removeItem('is_affiliate_logged_in');
  localStorage.removeItem('inzta_affiliate');
  // Optional: Add more cleanup if needed
}

export function copyToClipboard(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // 1. API Modern (Berjalan di HTTPS/Localhost)
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(resolve).catch(reject);
    } else {
      // 2. Fallback Khusus iOS / Safari / HTTP
      try {
        // Gunakan <span>, BUKAN <textarea>, untuk mengatasi bug seleksi iOS
        const span = document.createElement('span');
        span.textContent = text;
        
        // Sembunyikan elemen tanpa display:none
        span.style.position = 'fixed';
        span.style.left = '-9999px';
        span.style.top = '0';
        span.style.whiteSpace = 'pre'; // Jaga format teks
        
        document.body.appendChild(span);
        
        // Logika seleksi murni WebKit/Safari
        const selection = window.getSelection();
        const range = document.createRange();
        
        selection?.removeAllRanges();
        range.selectNodeContents(span); // Pada span, ini akan menyeleksi Teksnya!
        selection?.addRange(range);
        
        const successful = document.execCommand('copy');
        
        selection?.removeAllRanges();
        document.body.removeChild(span);
        
        if (successful) {
          resolve();
        } else {
          reject(new Error('Gagal menyalin teks.'));
        }
      } catch (err) {
        reject(err);
      }
    }
  });
}

export function optimizeCloudinaryUrl(url: string, width?: number, height?: number, crop: string = 'fill', quality: string = 'auto'): string {
  if (!url || !url.includes('res.cloudinary.com')) return url;
  
  const regex = /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/;
  const match = url.match(regex);
  if (!match) return url;
  
  const base = match[1];
  let rest = match[2];
  
  // Clean existing transforms
  const parts = rest.split('/');
  const newParts = parts.filter(part => !/^(q_|f_|w_|h_|c_)/.test(part));
  
  const transforms = [`f_auto`, `q_${quality}`];
  if (width) transforms.push(`w_${width}`);
  if (height) transforms.push(`h_${height}`);
  if (crop) transforms.push(`c_${crop}`);
  
  return `${base}${transforms.join(',')}/${newParts.join('/')}`;
}

export function generateCloudinarySrcSet(url: string, widths: number[] = [400, 800, 1200]): string {
  if (!url || !url.includes('res.cloudinary.com')) return '';
  return widths.map(w => `${optimizeCloudinaryUrl(url, w)} ${w}w`).join(', ');
}
