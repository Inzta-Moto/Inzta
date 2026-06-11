# Perbaikan Fitur Bagikan Gambar & Salin Link (WhatsApp Preview)

## Konteks Masalah
Terdapat dua kendala utama pada halaman detail produk terkait fitur membagikan produk:
1. **Bagikan Gambar (Share Image):** Saat pengguna mengklik tombol "Bagikan Gambar", aplikasi hanya membagikan teks promosi tanpa menyertakan gambar produk ke WhatsApp atau aplikasi lain.
2. **Salin Link (Copy Link):** Saat pengguna menyalin link produk (Copy Link) lalu menempelkannya (paste) di kolom obrolan WhatsApp, WhatsApp tidak menampilkan *preview* / *thumbnail* gambar produk.

## Analisis & Akar Masalah
1. **Error Bagikan Gambar (Blokir CORS):**
   Fungsi `handleShare` di klien (`DetailClient.tsx`) menggunakan Javascript `fetch()` untuk mengunduh gambar produk langsung dari URL Firebase Storage, lalu mengubahnya menjadi *blob* file. Namun, browser keamanan memblokir *request* ini karena kebijakan **CORS (Cross-Origin Resource Sharing)**. Akibatnya proses unduh gagal, masuk ke blok `catch`, dan aplikasi melakukan *fallback* dengan hanya melempar teks promosi ke WhatsApp URL scheme (`https://wa.me/`).
   
2. **Preview WhatsApp Gagal (Kompleksitas URL Meta Image):**
   Tag HTML `og:image` pada bagian metadata halaman (`page.tsx`) dipopulasi dengan URL langsung (raw) dari Firebase Storage. URL dari Firebase umumnya sangat panjang dan mengandung query string token keamanan yang kompleks (seperti `?alt=media&token=...`). Format URL yang rumit ini sering menyebabkan *crawler bot* milik WhatsApp (*WhatsApp Link Preview Bot*) gagal (error) dalam membaca, mengunduh, dan menampilkan gambar tersebut.

## Solusi & Implementasi
Solusi terpusat yang diterapkan adalah pembuatan **API Proxy** di dalam server Next.js:

1. **Pembuatan Endpoint Proxy Gambar (`/api/proxy-image`):**
   Dibuat API server-side Next.js yang menerima parameter `url` gambar Firebase. Endpoint ini mengunduh gambar di *backend* (komunikasi Server-to-Server tidak terkena batasan CORS browser), lalu mengembalikan (piping) *buffer* gambar tersebut kepada klien. Endpoint ini juga disematkan *header* `Access-Control-Allow-Origin: *`.

2. **Perbaikan Fungsi "Bagikan Gambar" via Proxy:**
   Pada komponen klien `DetailClient.tsx`, fungsi pembagian diubah. Alih-alih melakukan *fetch* langsung ke URL Firebase, fungsi tersebut kini menembak API Proxy internal:
   `/api/proxy-image?url={ENCODED_FIREBASE_URL}`
   Dengan ini, larangan CORS di *browser* berhasil dihindari. *Blob* gambar sukses dibuat, dan fungsi bawaan `navigator.share()` akhirnya bisa melampirkan *file image* ke dalam dialog share native di HP (yang kemudian diteruskan ke WhatsApp dengan gambar utuh).

3. **Perbaikan Meta Data untuk "Salin Link" via Proxy:**
   Pada Server Component `page.tsx`, proses injeksi URL `og:image` di `generateMetadata` disesuaikan. Daripada menyisipkan URL raw Firebase, URL tersebut dibungkus melalui API proxy:
   `https://{DOMAIN_SITUS}/api/proxy-image?url={ENCODED_FIREBASE_URL}`
   Penyesuaian ini menghasilkan URL meta image yang "bersih" (tanpa query string token panjang) dan berasal dari satu domain yang sama dengan website. WhatsApp bot kini bisa melacak URL ini tanpa masalah, sehingga *thumbnail* produk otomatis muncul saat link di-*paste*. (Catatan: Fungsi tombol salin link murni tetap hanya menyalin teks URL tanpa tambahan kata-kata).

## File yang Terdampak
- `app/api/proxy-image/route.ts` *(File Baru)* - API Endpoint untuk proxy/bypass.
- `app/produk/[slug]/page.tsx` *(Modifikasi)* - Injeksi proxy untuk metadata `og:image`.
- `app/produk/[slug]/DetailClient.tsx` *(Modifikasi)* - Injeksi proxy pada fungsi `handleShare()`.
