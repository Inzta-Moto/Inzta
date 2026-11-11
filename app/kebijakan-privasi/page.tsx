import Link from 'next/link';
import LegalPage from '@/components/v2/legal/LegalPage';
import { BUSINESS_EMAIL, BUSINESS_NAME } from '@/lib/constants';
import { sectionMetadata } from '@/lib/seo';

// Static text; the navbar prices and flash-sale state in V2Layout are read on the server, so the page is ISR like /tentang.
export const revalidate = 3600;

export const metadata = sectionMetadata('kebijakan-privasi');

// The text describes what the code does today (2026-11-02): orders store items, voucher, affiliate code, and UTM but no
// name, phone, or address (app/api/orders/route.ts); GA4 runs on every public page (components/TrackingScripts.tsx);
// Meta Pixel only loads when NEXT_PUBLIC_META_PIXEL_ID is set; the affiliate code and first UTM stay in localStorage
// (components/AffiliateTracker.tsx, lib/utm.ts, 30 days). F-031 (8.1): warranty claims and feedback from /garansi are
// stored in the website Firestore with a hashed IP, claim photos in a separate Cloudinary account (authenticated, staff
// only), no automatic deletion until A-148. Update this page whenever one of those changes.
export default function KebijakanPrivasiPage() {
  return (
    <LegalPage
      title="Kebijakan Privasi"
      lead={`Bagaimana ${BUSINESS_NAME} (INZTA) mengumpulkan, memakai, dan menjaga data Anda saat Anda membuka inzta.id dan memesan lewat WhatsApp.`}
      updated="11 November 2026"
    >
      <h2>Siapa kami</h2>
      <p>
        Website inzta.id dikelola oleh {BUSINESS_NAME} (&ldquo;INZTA&rdquo;, &ldquo;kami&rdquo;), brand lokal tas dan perlengkapan
        motor. Alamat dan kontak kami ada di bagian <a href="#kontak">Kontak</a> di bawah. Kebijakan ini disusun dengan mengacu pada
        Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi.
      </p>

      <h2>Data yang kami kumpulkan</h2>
      <h3>Saat Anda memesan lewat website</h3>
      <p>
        Tombol pesan membuat catatan pesanan berisi produk, varian, jumlah, harga, kode voucher (bila dipakai), kode afiliasi (bila
        Anda datang dari tautan mitra), dan sumber kunjungan (parameter UTM dari tautan iklan atau kampanye). Website tidak meminta
        nama, nomor HP, atau alamat Anda.
      </p>
      <h3>Saat Anda chat dengan admin di WhatsApp</h3>
      <p>
        Nama, nomor WhatsApp, alamat pengiriman, dan isi chat yang Anda kirim ke admin INZTA. Data ini kami pakai untuk memproses dan
        mengirim pesanan Anda.
      </p>
      <h3>Data penggunaan website</h3>
      <ul>
        <li>
          <strong>Google Analytics 4.</strong> Halaman yang dibuka, tombol yang diklik (misalnya klik pesan via WhatsApp), sumber
          kunjungan, jenis perangkat dan browser, serta perkiraan lokasi tingkat kota. Google Analytics memakai cookie.
        </li>
        <li>
          <strong>Meta Pixel.</strong> Bila kami aktifkan untuk mengukur iklan di Facebook dan Instagram, data kunjungan sejenis
          dikirim ke Meta.
        </li>
        <li>
          <strong>Penyimpanan di browser Anda.</strong> Kode afiliasi dan sumber kunjungan pertama disimpan di penyimpanan lokal
          browser (localStorage) supaya voucher mitra dan sumber pesanan tercatat. Sumber kunjungan dihapus otomatis setelah 30 hari.
        </li>
        <li>
          <strong>Log server.</strong> Penyedia hosting mencatat alamat IP, waktu akses, dan halaman yang diminta untuk keamanan dan
          perbaikan gangguan.
        </li>
      </ul>
      <h3>Mitra afiliasi</h3>
      <p>
        Untuk mitra afiliasi yang didaftarkan admin, kami menyimpan nama, nomor HP, dan email untuk login dan perhitungan komisi.
      </p>

      <h2 id="garansi">Klaim garansi</h2>
      <p>
        Saat Anda mengisi formulir klaim di halaman <Link href="/garansi">Garansi</Link>, kami menyimpan nama, nomor WhatsApp, kota
        atau kabupaten tempat produk dipakai, produk, tempat pembelian, tanggal pembelian dan nomor pesanan (bila diisi), lama
        pemakaian, jenis kerusakan, cerita kerusakan, foto bukti, tanda bila Anda punya video, dan waktu Anda memberi persetujuan.
        Alamat IP tidak disimpan apa adanya, hanya sebagai
        kode tersandi (hash) yang tidak menampilkan alamat aslinya. Kode ini dipakai untuk membatasi pengiriman berulang.
      </p>
      <p>
        Data ini kami pakai untuk memeriksa klaim dan menghubungi Anda lewat WhatsApp. Data ini dibuka tim INZTA lewat dashboard
        internal. Foto disimpan di Cloudinary tanpa alamat publik dan tidak ditampilkan di website. Video tidak diunggah di
        website; bila Anda mengirimnya lewat WhatsApp, video itu tersimpan di chat WhatsApp.
      </p>
      <p>
        Foto yang sudah terunggah tetapi formulirnya tidak jadi dikirim dapat tetap tersimpan sampai kami menghapusnya secara manual. Saat ini
        data klaim belum dihapus otomatis. Anda dapat meminta penghapusan kapan saja dengan menyebut nomor tiket klaim (lihat{' '}
        <a href="#hak-anda">Hak Anda</a>).
      </p>

      <h2 id="masukan">Masukan</h2>
      <p>
        Formulir masukan menyimpan jenis masukan, isi masukan, produk bila dipilih, nama dan nomor WhatsApp bila Anda mengisinya, serta
        waktu Anda memberi persetujuan. Nama dan nomor boleh dikosongkan. Alamat IP juga hanya disimpan sebagai kode tersandi (hash), sama seperti pada klaim.
      </p>
      <p>
        Kami memakai data ini untuk membaca dan menindaklanjuti masukan Anda, dan untuk menghubungi Anda bila Anda mencantumkan
        nomor. Masukan dibaca tim INZTA lewat dashboard internal, tidak ditampilkan di website, dan tidak dipakai sebagai testimoni. Saat ini masukan belum dihapus
        otomatis; Anda dapat meminta penghapusan dengan menyebut nomor referensi masukan.
      </p>

      <h2>Untuk apa data dipakai</h2>
      <ul>
        <li>Memproses pesanan, menghitung ongkir, dan mengirim barang.</li>
        <li>Menjawab pertanyaan dan menangani keluhan.</li>
        <li>Memeriksa klaim garansi serta membaca dan menindaklanjuti masukan.</li>
        <li>Menerapkan voucher dan menghitung komisi mitra afiliasi.</li>
        <li>Memahami halaman mana yang membantu pembeli dan mengukur hasil iklan.</li>
        <li>Menjaga keamanan website.</li>
      </ul>
      <p>Kami tidak menjual data pribadi Anda.</p>

      <h2>Pihak lain yang ikut memproses data</h2>
      <ul>
        <li>Google (Firebase untuk database dan login, Google Analytics untuk statistik kunjungan).</li>
        <li>Vercel, penyedia hosting website.</li>
        <li>Cloudinary, penyimpanan gambar produk, gambar artikel, dan foto klaim garansi.</li>
        <li>WhatsApp dan Meta, untuk chat dan, bila aktif, pengukuran iklan.</li>
        <li>Jasa ekspedisi, yang menerima nama, alamat, dan nomor HP penerima untuk pengiriman.</li>
      </ul>
      <p>
        Bila Anda membeli lewat Shopee, Tokopedia, atau TikTok Shop, data Anda diproses sesuai kebijakan privasi platform tersebut.
      </p>

      <h2>Cookie dan cara menolaknya</h2>
      <p>
        Anda dapat menghapus atau memblokir cookie dan penyimpanan lokal lewat pengaturan browser, atau memasang{' '}
        <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">
          add-on penolakan Google Analytics
        </a>
        . Website tetap bisa dipakai dan pesanan tetap bisa dikirim lewat WhatsApp, tetapi voucher mitra mungkin tidak terpasang
        otomatis.
      </p>

      <h2>Penyimpanan dan keamanan</h2>
      <p>
        Data disimpan selama dibutuhkan untuk tujuan di atas, termasuk pencatatan pesanan dan kewajiban hukum. Akses ke panel admin
        dibatasi untuk tim INZTA dengan akun terverifikasi, dan koneksi ke website memakai HTTPS.
      </p>

      <h2 id="hak-anda">Hak Anda</h2>
      <p>
        Anda berhak meminta salinan data pribadi Anda, memperbaikinya, menghapusnya, atau menarik persetujuan pemakaiannya. Kirim
        permintaan ke <a href={`mailto:${BUSINESS_EMAIL}`}>{BUSINESS_EMAIL}</a> atau WhatsApp admin dengan menyebut nomor pesanan, nomor
        tiket klaim, atau nomor referensi masukan bila ada. Kami dapat meminta informasi tambahan untuk memastikan permintaan datang dari Anda.
      </p>

      <h2>Perubahan kebijakan</h2>
      <p>
        Bila cara kami memakai data berubah, halaman ini kami perbarui beserta tanggal berlakunya. Ketentuan pemesanan ada di{' '}
        <Link href="/syarat-ketentuan">Syarat dan Ketentuan</Link>.
      </p>
    </LegalPage>
  );
}
