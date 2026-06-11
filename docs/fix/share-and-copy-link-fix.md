# Perbaikan Fitur Bagikan Gambar & Salin Link (WhatsApp Preview)

## Konteks Masalah
Terdapat dua kendala utama pada halaman detail produk terkait fitur membagikan produk:
1. **Bagikan Gambar (Share Image):** Saat pengguna mengklik tombol "Bagikan Gambar", aplikasi hanya membagikan teks promosi tanpa menyertakan gambar produk ke WhatsApp atau aplikasi lain.
2. **Salin Link (Copy Link):** Saat pengguna menyalin link produk (Copy Link) lalu menempelkannya (paste) di kolom obrolan WhatsApp, WhatsApp tidak menampilkan *preview* / *thumbnail* gambar produk, dan seluruh metadata (Judul & Deskripsi) juga ikut hilang (khususnya setelah migrasi aset gambar ke Cloudinary dan domain `inzta.id`).

## Analisis & Akar Masalah
1. **Error Bagikan Gambar (Blokir CORS):**
   Fungsi `handleShare` di klien (`DetailClient.tsx`) menggunakan Javascript `fetch()` untuk mengunduh gambar produk langsung dari URL Storage. Namun, browser keamanan memblokir *request* ini karena kebijakan **CORS (Cross-Origin Resource Sharing)**. Solusinya adalah melewatkannya via *Proxy API* internal Next.js.
2. **Preview WhatsApp Gagal Total (Aturan Ketat Meta Image WhatsApp):**
   Awalnya tag HTML `og:image` di `page.tsx` menggunakan trik proxy yang sama (`/api/proxy-image/preview.jpg?url=...`). Trik ini sempat berhasil, namun gagal kembali setelah aset gambar dipindah ke Cloudinary karena:
   - **MIME Type Mismatch & Query Params:** WhatsApp sering mencurigai dan memblokir URL gambar Open Graph yang mengandung *query parameters* (`?url=`). Selain itu, meski URL proxy diakhiri pseudo extension `.jpg`, proxy tetap mengirimkan *response header* `Content-Type: image/png` (karena meneruskan format asli gambar Cloudinary), menyebabkan *crawler* WhatsApp menolak memproses gambar.
   - **Ukuran File Terlalu Besar:** Gambar PNG asli dari Cloudinary rata-rata berukuran sangat besar (misal: ~884 KB), jauh melebihi batas optimal spesifikasi WhatsApp (< 300 KB).
   - Akibatnya, jika URL `og:image` ditolak, WhatsApp akan **membuang seluruh blok metadata** (termasuk judul dan deskripsi).
3. **Absennya `og:image:type`:**
   Implementasi SSR Next.js sebelumnya tidak secara eksplisit mendefinisikan tipe gambar (misal `image/jpeg`), sehingga *crawler* sosial media kebingungan mengenali tipe aslinya saat berada di balik URL dinamis.

## Solusi & Implementasi (Revisi Final Terhadap Isu Cloudinary & Domain Baru)

1. **Pembuatan Endpoint Proxy Gambar Dinamis (Khusus untuk "Bagikan Gambar" Client-Side):**
   - File: `/api/proxy-image/[...path]/route.ts`
   - Endpoint proxy ini tetap dipertahankan dan **hanya digunakan oleh Client Component** (`DetailClient.tsx`).
   - Endpoint ini me-*return* (piping) stream `response.body` secara langsung untuk membypass larangan CORS di *browser* saat mengeksekusi `navigator.share()`.

2. **Perbaikan Fungsi "Bagikan Gambar" via Proxy (Client-Side):**
   Pada klien `DetailClient.tsx`, fungsi pembagian memanggil API Proxy:
   `/api/proxy-image/preview.jpg?url={ENCODED_ABSOLUTE_URL}`
   URL sumber dipastikan menjadi *absolute URL*. Larangan CORS di *browser* sukses dihindari, *Blob* gambar berhasil di-*fetch*, dan bisa dilampirkan ke dialog share native perangkat HP.

3. **Perombakan Meta Data untuk "Salin Link" via Cloudinary Transform (Server-Side):**
   Pada Server Component `page.tsx`, metode proxy untuk `og:image` **dihapus sepenuhnya**. Sebagai gantinya, fitur *On-The-Fly Transformation* dari Cloudinary dimanfaatkan secara langsung di fungsi `generateMetadata`:
   - URL Cloudinary asli (`/image/upload/...`) diganti (replace) menggunakan manipulasi string menjadi: `/image/upload/c_fill,w_800,h_800,f_jpg,q_auto/...`.
   - **Keuntungan:** Gambar PNG ~884KB otomatis dikonversi oleh Cloudinary menjadi JPEG berukuran kecil (~83KB). 
   - Metadata kini menjadi sangat "bersih" tanpa URL query params (`?url=`), dan field `og:image:type` (seperti `image/jpeg`) ditambahkan secara eksplisit. Hal ini menjamin *crawler* WhatsApp merender *thumbnail*, judul, dan deskripsi produk dengan sempurna saat link di-paste.

## File yang Terdampak
- `app/api/proxy-image/[...path]/route.ts` - API Endpoint Proxy (Dipertahankan khusus untuk Client CORS bypass).
- `app/produk/[slug]/page.tsx` *(Modifikasi SSR Meta)* - Proxy dihapus, diganti dengan manipulasi string parameter URL Cloudinary (`c_fill,w_800,h_800,f_jpg,q_auto`) untuk Open Graph & injeksi `og:image:type`.
- `app/produk/[slug]/DetailClient.tsx` - Fungsi `handleShare()` tetap menggunakan Proxy URL untuk bypass CORS.