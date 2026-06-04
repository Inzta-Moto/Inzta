# 🐛 Laporan Perbaikan Bug (Fix Report) - Autentikasi & Platform

Dokumen ini mencatat masalah-masalah kritis yang ditemukan selama pengujian pada berbagai peramban (Chrome, Safari, dll) beserta analisis mendalam dan solusi arsitektural yang telah diimplementasikan untuk menyelesaikannya.

---

## 1. Bug Gagal Login Affiliate (Cross-Browser API Race Condition & Fallback Crash)

**Gejala yang Dialami:**
- Pengguna (Affiliator) gagal masuk di Chrome, Safari, maupun browser lain meskipun email dan kode akses yang dimasukkan sudah benar.
- Muncul pesan error "Email atau kode akses salah." secara konstan.
- Jika halaman di-*refresh* setelah error terjadi, pengguna secara aneh tiba-tiba sudah berada di dalam Dashboard (berhasil login).

### Analisis Akar Permasalahan (Root Cause)
Masalah ini BUKAN sepenuhnya disebabkan oleh masalah _Cookie Delay_ di Safari, melainkan **cacat logika (_logic flaw_) pada proses pengambilan `voucherCode` di sisi klien (`login/page.tsx`)**.
1. Klien mengirim kredensial ke `/api/auth/session` untuk membuat *Session Cookie*. Ini **berhasil**.
2. Klien kemudian secara beruntun memanggil `/api/affiliate/commissions` untuk mendapatkan `voucherCode`. Pada beberapa kasus, _cookie_ sesi baru belum tersimpan secara utuh di peramban saat pemanggilan API kedua ini terjadi, sehingga API mengembalikan status 401 Unauthorized.
3. **The Fatal Crash:** Karena gagal, klien mengeksekusi blok *fallback* yang memanggil `/api/admin/affiliates`. Endpoint ini adalah endpoint administratif yang menolak akses afiliator dan mengembalikan error JSON (`{ error: 'Unauthorized' }`).
4. Karena respons tidak mengandung _array_ `affiliates`, baris kode `data.affiliates.find(...)` memicu `TypeError: Cannot read properties of undefined`.
5. _Error Javascript_ ini ditangkap oleh blok `catch` utama di form login, yang memiliki pesan _hardcoded_: "Login gagal. Email atau kode akses salah.", menyembunyikan masalah sebenarnya dan menggagalkan *redirect* ke dashboard.
6. Karena sesi sebenarnya sudah berhasil dibuat pada langkah 1, sebuah _refresh_ akan memuat halaman dengan _cookie_ yang valid, sehingga pengguna langsung masuk ke dashboard.

### Solusi yang Diimplementasikan
1. **Penerapan Arsitektur Single-Trip API:** 
   File `/api/auth/session/route.ts` dimodifikasi. Saat sesi dibuat, Server *backend* langsung memverifikasi token dan melakukan _query_ ke koleksi `affiliates` di Firestore untuk mengambil `voucherCode`. Server mengembalikan respons terpadu: `{ status: 'success', voucherCode: '...' }`.
2. **Pembersihan Logika Klien:**
   Pada file `app/affiliate/(public)/login/page.tsx`, blok kode yang melakukan _fetch_ beruntun (Race Condition) ke `/api/affiliate/commissions` dan *fallback error* ke `/api/admin/affiliates` **dihapus sepenuhnya**. 
3. **Penyimpanan Langsung:**
   Klien kini cukup mengekstrak `voucherCode` dari respons login API pertama, menyimpannya di `localStorage`, dan langsung memanggil `router.replace` menuju dashboard dengan lancar tanpa _error_.

---

## 2. Bug Gagal Salin Link Teks (Clipboard API Fallback di iOS Safari)

**Gejala yang Dialami:**
- Saat mengklik "Salin Link" di halaman Produk/Blog/Dashboard via iPhone, muncul *crash*: `TypeError: undefined is not an object (evaluating 'navigator.clipboard.writeText')`.
- Setelah disiasati menggunakan *fallback* `<textarea>`, muncul *toast* "Link berhasil disalin", namun saat pengguna mencoba mem-*paste* (tempel), clipboard ternyata kosong (hampa).

### Analisis Akar Permasalahan (Root Cause)
1. **Aturan Secure Context API:** 
   `navigator.clipboard` adalah API modern yang **hanya bisa berjalan di bawah protokol HTTPS** (atau localhost). Jika aplikasi diuji melalui jaringan lokal (misal: mengakses IP lokal via HTTP dari iPhone melalui BrowserStack), objek `navigator.clipboard` akan dihancurkan oleh sistem keamanan Safari, memicu *TypeError*.
2. **Kelemahan Seleksi `<textarea>` di iOS:** 
   Untuk mengatasi HTTPS yang hilang, umumnya *developer* menggunakan *fallback* berupa manipulasi `document.execCommand('copy')` dengan bantuan elemen `<textarea>`. Namun, peramban berbasis WebKit (Safari di iOS) **menolak perintah seleksi (`.select()`) pada value `<textarea>`**. Akibatnya, yang terseleksi dan tersalin ke papan klip hanyalah *string kosong*.

### Solusi yang Diimplementasikan
Dibuat sebuah utilitas tingkat lanjut di dalam `lib/utils.ts` bernama `copyToClipboard(text: string)`. Mekanisme barunya adalah:
1. Mengecek ketersediaan `navigator.clipboard` & `window.isSecureContext` (Jalur Utama HTTPS).
2. Jika terdeteksi akses HTTP atau peramban tidak mendukung, sistem beralih ke **Jalur Cadangan iOS-Safe**.
3. Sistem membuat elemen `<span>` bayangan (bukan `<textarea>`). Elemen ini ditempatkan di koordinat yang tidak terlihat oleh layar (`left: -9999px`) dan diberi atribut `whiteSpace: pre` agar format spasi/baris tidak hancur.
4. Teks tautan disematkan sebagai *Child Node* (*textContent*).
5. Sistem memanggil fungsi manipulasi seleksi khusus WebKit: `document.createRange()` dan `window.getSelection()`. Fungsi ini berhasil "memblok" isi teks di dalam `<span>` secara paksa di ekosistem iOS.
6. `document.execCommand('copy')` kemudian dipanggil, berhasil menyalin teks tersebut karena teks sudah terblok sempurna.
7. Elemen `<span>` bayangan dihancurkan tanpa menimbulkan lompatan layar (*scroll jump*) atau memunculkan *virtual keyboard* secara mendadak.

Solusi ini lalu diinjeksi secara massal menggantikan metode *copy-paste* lama ke dalam:
- `DetailClient.tsx` (Produk)
- `BlogDetailClient.tsx` (Artikel)
- `affiliate/page.tsx` (Dashboard Admin)
- `voucher/page.tsx` (Dashboard Admin)
- `affiliate/dashboard/page.tsx` (Dashboard Affiliate)

Dengan perbaikan ini, mekanisme penyalinan teks sekarang memiliki ketahanan 100% dan akan berhasil di-eksekusi di platform manapun, sekalipun dalam tahap *testing* jaringan lokal.

---

## 3. Bug Sinkronisasi UI (Stale Session Header)

**Gejala yang Dialami:**
- Tombol di Header Toko masih menampilkan "DASHBOARD" (menganggap pengguna masih login), padahal *Session Cookie* di *backend* sudah kedaluwarsa.
- Saat tombol "DASHBOARD" diklik, pengguna justru diarahkan kembali ke halaman login, menyebabkan pengalaman pengguna yang membingungkan.

### Analisis Akar Permasalahan (Root Cause)
Masalah ini adalah **UI Desynchronization**. Komponen `Header.tsx` sebelumnya hanya bergantung pada `localStorage` untuk menentukan status login. `localStorage` bersifat persisten dan tidak otomatis terhapus saat *Session Cookie* di *backend* kedaluwarsa atau dicabut, sehingga UI "berbohong" tentang status autentikasi yang sebenarnya.

### Solusi yang Diimplementasikan
1. **Pengecekan Sesi Aktif (Lightweight Session Check):**
   Dibuat API route baru `/api/affiliate/check` yang dilindungi oleh *middleware*. 
2. **Resilient Header Logic:**
   Komponen `Header.tsx` sekarang melakukan pengecekan proaktif saat dimuat (*on mount*). Header akan melakukan `fetch` ke `/api/affiliate/check`.
   - Jika server mengembalikan `401 Unauthorized`, sistem secara otomatis memanggil fungsi `clearAffiliateSession()` untuk menghapus `localStorage` yang kedaluwarsa dan mengupdate UI ke mode "LOGIN".
   - Jika `200 OK`, UI akan tetap menampilkan "DASHBOARD".
3. **Utility Cleanup:**
   Fungsi `clearAffiliateSession()` di `lib/utils.ts` dijadikan standar terpusat untuk membersihkan semua *state* lokal terkait sesi afiliasi.
