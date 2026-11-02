import Link from 'next/link';
import LegalPage from '@/components/v2/legal/LegalPage';
import { BUSINESS_NAME } from '@/lib/constants';
import { sectionMetadata } from '@/lib/seo';

// Static text; the navbar prices and flash-sale state in V2Layout are read on the server, so the page is ISR like /tentang.
export const revalidate = 3600;

export const metadata = sectionMetadata('syarat-ketentuan');

// Order flow as the site runs it (Beranda "Cara pesan": admin confirms shipping cost and payment on WhatsApp). Decisions
// from Angkasa, 2026-11-02: no returns or exchanges; warranty terms are confirmed by the admin on WhatsApp (A-023 open).
export default function SyaratKetentuanPage() {
  return (
    <LegalPage
      title="Syarat dan Ketentuan"
      lead="Ketentuan memakai inzta.id dan memesan produk INZTA lewat website dan WhatsApp admin."
      updated="2 November 2026"
    >
      <h2>Tentang ketentuan ini</h2>
      <p>
        Website inzta.id dikelola oleh {BUSINESS_NAME} (&ldquo;INZTA&rdquo;). Dengan memakai website ini atau memesan lewat WhatsApp
        admin INZTA, Anda menyetujui ketentuan di halaman ini. Pembelian di Shopee, Tokopedia, atau TikTok Shop mengikuti ketentuan
        platform tersebut.
      </p>

      <h2>Produk dan informasi</h2>
      <ul>
        <li>Warna di foto bisa sedikit berbeda dengan aslinya karena pencahayaan dan layar.</li>
        <li>Ukuran dan kapasitas di halaman produk adalah ukuran produk; hasil di motor bisa berbeda menurut model dan aksesori motor.</li>
        <li>Sebelum membayar, tanyakan kecocokan tas dengan motor Anda ke admin dengan menyebut merek, tipe, dan tahun motor.</li>
      </ul>

      <h2>Harga dan stok</h2>
      <p>
        Harga ditulis dalam Rupiah dan dapat berubah sewaktu-waktu, termasuk saat flash sale berakhir. Harga akhir, stok, dan ongkir
        dikonfirmasi admin di WhatsApp sebelum Anda membayar.
      </p>

      <h2>Cara pesan dan pembayaran</h2>
      <ul>
        <li>Pilih produk dan varian, lalu klik tombol pesan. Anda diarahkan ke WhatsApp admin dengan ringkasan pesanan.</li>
        <li>Admin mengonfirmasi stok, ongkir, total, dan cara pembayaran.</li>
        <li>Pesanan diproses setelah pembayaran diterima dan dikonfirmasi admin.</li>
        <li>Pembayaran hanya ke rekening atau metode yang diberikan admin INZTA lewat nomor WhatsApp resmi di halaman ini.</li>
      </ul>

      <h2>Voucher</h2>
      <p>
        Satu pesanan memakai satu kode voucher. Setiap voucher punya syarat sendiri, misalnya masa berlaku dan minimal belanja, dan
        tidak dapat ditukar dengan uang.
      </p>

      <h2>Pengiriman</h2>
      <p>
        Pesanan dikemas dan dikirim dari gudang INZTA di Jakarta Barat lewat jasa ekspedisi. Lama pengiriman bergantung pada
        ekspedisi dan kota tujuan. Pastikan nama, alamat, dan nomor HP penerima yang Anda kirim ke admin sudah benar.
      </p>

      <h2>Retur dan tukar barang</h2>
      <p>
        INZTA tidak menerima retur atau tukar barang. Karena itu, pastikan produk, varian, warna, dan kecocokan dengan motor Anda
        sudah dikonfirmasi ke admin sebelum membayar.
      </p>

      <h2>Garansi</h2>
      <p>Ketentuan garansi dikonfirmasi admin lewat WhatsApp.</p>

      <h2>Konten website</h2>
      <p>
        Nama INZTA, logo, foto produk, dan tulisan di inzta.id milik INZTA, kecuali yang disebut berasal dari pihak lain. Konten tidak
        boleh dipakai untuk kepentingan komersial tanpa izin tertulis dari INZTA.
      </p>

      <h2>Data pribadi</h2>
      <p>
        Cara kami memakai data Anda dijelaskan di <Link href="/kebijakan-privasi">Kebijakan Privasi</Link>.
      </p>

      <h2>Hukum yang berlaku dan perubahan</h2>
      <p>
        Ketentuan ini tunduk pada hukum Republik Indonesia. Bila ketentuan berubah, halaman ini kami perbarui beserta tanggal
        berlakunya.
      </p>
    </LegalPage>
  );
}
