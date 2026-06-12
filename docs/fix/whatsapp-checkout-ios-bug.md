# Fix: WhatsApp Checkout iOS Safari Bug

## Deskripsi Bug
Pada saat melakukan checkout dari halaman detail produk maupun kartu produk di katalog, pengguna di perangkat iOS (terutama menggunakan browser Safari) mengalami kendala di mana sistem gagal membuka aplikasi WhatsApp yang sudah terinstal. Sebaliknya, pengguna justru diarahkan ke halaman *web* WhatsApp yang meminta mereka untuk mengunduh aplikasi WhatsApp. Di perangkat Android, fitur ini berjalan dengan normal.

## Akar Masalah
Penyebab utama dari masalah ini adalah kebijakan keamanan *pop-up* dan *Deep Linking* di browser Safari iOS.
- Pada kode sebelumnya, pembukaan URL WhatsApp dilakukan secara *asynchronous* (menggunakan `await fetch` untuk membuat order terlebih dahulu).
- Setelah order berhasil dibuat, URL dibuka dengan perintah `window.open(waUrl, '_blank')`.
- Safari iOS mendeteksi tindakan *window.open* ini bukan sebagai interaksi langsung dari pengguna (karena tertunda oleh proses *fetch* API), sehingga ia memblokir *deep link native* (`whatsapp://`) dan hanya membuka URL fallback di tab baru yang meminta pengguna untuk *install* ulang.

## Solusi yang Diimplementasikan
Untuk mengatasi masalah ini tanpa mengorbankan alur pembuatan order (Order ID tetap harus dibuat via API), perbaikan berikut telah diimplementasikan:
1. **Mengganti metode navigasi:** Perintah `window.open(..., '_blank')` diubah menjadi `window.location.href = waUrl`. Dengan menggunakan tab yang sama, iOS Safari secara optimal mengenali dan mengeksekusi *deep link* ke aplikasi WhatsApp native.
2. **Mengupdate URL WhatsApp:** Tautan `https://api.whatsapp.com/send` diubah menjadi tautan `https://wa.me/` (atau `wa.me/nomor`) karena URL format *wa.me* direkomendasikan langsung oleh WhatsApp untuk *routing* yang lebih andal di perangkat seluler.

File yang diperbarui:
- `app/produk/[slug]/DetailClient.tsx`
- `components/ProductCard.tsx`
- `lib/utils.ts`
- `app/blog/[slug]/BlogDetailClient.tsx` (untuk konsistensi link *share* blog)

## Panduan Testing (Tanpa Perangkat iPhone Real)
Berdasarkan opsi yang telah dipilih, proses *testing* dapat dilakukan menggunakan BrowserStack. Harap diperhatikan bahwa perangkat simulator di BrowserStack **tidak memiliki aplikasi WhatsApp terinstal**, sehingga peringatan untuk *install* aplikasi adalah hal yang wajar. Pengujian bertujuan untuk memastikan *protokol deep link* telah dijalankan dengan benar oleh Safari.

### Opsi 1: Testing Membuktikan Alur URL Terbuka (Via BrowserStack)
1. Jalankan aplikasi di BrowserStack menggunakan perangkat iOS (iPhone) dan browser Safari.
2. Navigasi ke halaman produk atau katalog.
3. Klik tombol **Pesan via WhatsApp**.
4. **Indikator Sukses:** Anda akan melihat layar pada tab yang sama langsung berpindah ke domain `wa.me`, atau Safari akan memunculkan sebuah **Pop-Up Alert Native iOS** dengan pesan seperti *"Open this page in WhatsApp?"*.
5. Meskipun jika Anda klik "Open" akan *error* di BrowserStack (karena tidak ada aplikasinya), munculnya peringatan *native* tersebut membuktikan bahwa Safari telah berhasil mencoba membuka *deep link* aplikasi pihak ketiga, yang berarti kode perbaikan ini telah berhasil untuk perangkat iPhone fisik.
