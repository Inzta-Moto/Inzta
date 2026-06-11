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
