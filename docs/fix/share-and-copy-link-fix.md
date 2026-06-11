# Perbaikan Fitur Bagikan Gambar & Salin Link (WhatsApp Preview)

## Konteks Masalah
Terdapat dua kendala utama pada halaman detail produk terkait fitur membagikan produk:
1. **Bagikan Gambar (Share Image):** Saat pengguna mengklik tombol "Bagikan Gambar", aplikasi hanya membagikan teks promosi tanpa menyertakan gambar produk ke WhatsApp atau aplikasi lain.
2. **Salin Link (Copy Link):** Saat pengguna menyalin link produk (Copy Link) lalu menempelkannya (paste) di kolom obrolan WhatsApp, WhatsApp tidak menampilkan *preview* / *thumbnail* gambar produk, dan seluruh metadata (Judul & Deskripsi) juga ikut hilang.

## Analisis & Akar Masalah
1. **Error Bagikan Gambar (Blokir CORS):**
   Fungsi `handleShare` di klien (`DetailClient.tsx`) menggunakan Javascript `fetch()` untuk mengunduh gambar produk langsung dari URL Firebase Storage. Namun, browser keamanan memblokir *request* ini karena kebijakan **CORS (Cross-Origin Resource Sharing)**.
2. **Preview WhatsApp Gagal Total (Aturan Ketat Meta Image WhatsApp):**
   Awalnya tag HTML `og:image` menggunakan endpoint proxy sederhana (`/api/proxy-image?url=...`). Namun WhatsApp Bot sangat ketat:
   - **Ketiadaan Ekstensi Gambar:** Bot WhatsApp seringkali menolak URL gambar yang tidak diakhiri dengan ekstensi gambar valid (seperti `.jpg` atau `.png`).
   - **Ketiadaan Content-Length:** Jika server tidak memberikan header `Content-Length`, WhatsApp dapat membatalkan proses render karena tidak tahu ukuran file.
   - Jika satu syarat gagal pada URL `og:image`, WhatsApp akan **mengabaikan seluruh blok metadata** (termasuk judul dan deskripsi).
3. **Error URL Relatif di Backend:**
   Jika produk belum memiliki gambar kustom, sistem menggunakan *fallback* berupa URL relatif (`/logo.png`). Saat diteruskan ke proses *fetch* di server proxy, hal ini memicu error karena *fetch* di Node.js mewajibkan *absolute URL* (diawali `http(s)://`).

## Solusi & Implementasi (Revisi Akhir)

1. **Pembuatan Endpoint Proxy Gambar Dinamis (`/api/proxy-image/[...path]/route.ts`):**
   - Struktur folder diubah menjadi *dynamic route* agar dapat menyematkan nama file virtual di akhir URL (contoh: `.../api/proxy-image/preview.jpg?url=...`). Ekstensi semu `.jpg` ini berhasil meyakinkan *crawler* WhatsApp untuk membaca metadata dengan benar.
   - Endpoint proxy dioptimasi untuk me-*return* (piping) `response.body` (Stream) secara langsung, bukan mengubahnya menjadi `Buffer`. Ini jauh lebih cepat dan meminimalisir error memori.
   - Header `Content-Length` dan `Content-Type` dari sumber (Firebase) diteruskan langsung ke klien untuk membantu Crawler mengetahui ukuran gambar.

2. **Perbaikan Fungsi "Bagikan Gambar" via Proxy:**
   Pada klien `DetailClient.tsx`, fungsi pembagian diubah. Alih-alih *fetch* ke URL Firebase, ia memanggil API Proxy:
   `/api/proxy-image/preview.jpg?url={ENCODED_ABSOLUTE_URL}`
   URL sumber dipastikan selalu dikonversi menjadi *absolute URL* agar aman di-fetch oleh backend. Larangan CORS di *browser* pun berhasil dihindari. *Blob* gambar sukses dibuat, dan fungsi `navigator.share()` bisa melampirkan *file image* ke dialog share native di perangkat HP.

3. **Perbaikan Meta Data untuk "Salin Link" via Proxy:**
   Pada Server Component `page.tsx`, proses injeksi URL `og:image` di `generateMetadata` disesuaikan. Daripada menyisipkan URL raw Firebase, URL tersebut dibungkus melalui API proxy dengan ekstensi *dummy*:
   `https://{DOMAIN_SITUS}/api/proxy-image/preview.jpg?url={ENCODED_ABSOLUTE_URL}`
   Penyesuaian ini menjamin URL meta image mutlak "bersih" dan tervalidasi sebagai "gambar" di mata WhatsApp bot. Metadata judul, deskripsi, dan thumbnail produk kini otomatis muncul saat link di-*paste*.

## File yang Terdampak
- `app/api/proxy-image/[...path]/route.ts` *(Folder Baru)* - API Endpoint untuk proxy stream dengan dynamic path.
- `app/api/proxy-image/route.ts` *(Dihapus/Dipindahkan)*
- `app/produk/[slug]/page.tsx` *(Modifikasi)* - Injeksi proxy dynamic path & validasi *absolute URL* untuk `og:image`.
- `app/produk/[slug]/DetailClient.tsx` *(Modifikasi)* - Injeksi proxy dynamic path & validasi *absolute URL* pada fungsi `handleShare()`.
