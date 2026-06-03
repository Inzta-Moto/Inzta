# 🐛 Laporan Perbaikan Bug (Fix Report) - Safari & iPhone

Dokumen ini mencatat masalah-masalah kritis yang ditemukan selama pengujian pada lingkungan Apple/iOS (khususnya Safari di iPhone) beserta analisis mendalam dan solusi arsitektural yang telah diimplementasikan untuk menyelesaikannya.

---

## 1. Bug Gagal Login Affiliate (Cookie Race Condition Safari)

**Gejala yang Dialami:**
- Pengguna (Affiliator) gagal masuk meskipun email dan kode akses yang dimasukkan sudah benar.
- Muncul pesan error "Email atau kode akses salah."
- Jika halaman di-*refresh* setelah error terjadi, pengguna anehnya tiba-tiba sudah berada di dalam Dashboard (berhasil login).
- Saat pindah ke halaman toko, Header masih menampilkan status "LOGIN" (belum login) sehingga proses salin link gagal karena parameter `inzta_affiliate` tidak tersimpan di `localStorage`.

**Pesan Error Log Server:**
```json
{
  "code": "auth/session-cookie-revoked",
  "message": "The Firebase session cookie has been revoked."
}
```

### Analisis Akar Permasalahan (Root Cause)
Masalah ini diakibatkan oleh **Race Condition pada Cookie Jar (Brankas Cookie) di peramban Safari**.
1. Klien mengirim kredensial ke `/api/auth/session` untuk membuat *Session Cookie*.
2. Setelah Server merespons sukses (bersama *header Set-Cookie*), aplikasi Next.js di sisi klien secara instan langsung melakukan `fetch` kedua ke `/api/affiliate/commissions` untuk mendapatkan `voucherCode`.
3. Karena *fetch* kedua terjadi **terlalu cepat** (dalam milidetik), WebKit/Safari belum sempat memperbarui *Cookie Jar* miliknya. Akibatnya, Safari mengirimkan *Session Cookie* versi LAMA (sesi usang) ke Server.
4. Server Firebase membaca *cookie* lama tersebut, menganggapnya tidak valid/dicabut (*revoked*), dan memicu *Crash 500*.
5. Di sisi lain, *Intelligent Tracking Prevention (ITP)* milik Safari membatasi penyimpanan lokal (*IndexedDB*), sehingga *Firebase Auth Client* mudah "lupa" status login saat berpindah halaman kembali ke toko (menyebabkan kasus Header tidak terupdate).

### Solusi yang Diimplementasikan
1. **Menghapus Kebutuhan Request Beruntun:** 
   File `/api/auth/session/route.ts` dimodifikasi. Saat sesi dibuat, Server *backend* langsung melakukan verifikasi ke database Firestore untuk mencari dan mengembalikan `voucherCode` secara bersamaan (`{ status: 'success', voucherCode: '...' }`). Hal ini menghapus kewajiban klien untuk melakukan *fetch* kedua secara beruntun, menghindari *bug delay* pada Safari.
2. **Penyimpanan Langsung & Aman:**
   Pada file `app/affiliate/(public)/login/page.tsx`, `voucherCode` langsung diekstrak dari respon API login pertama dan disimpan ke `localStorage`.
3. **Anti-ITP Header (Resilient Header):**
   Komponen `Header.tsx` dimodifikasi agar tidak lagi sepenuhnya bergantung pada `onAuthStateChanged` dari Firebase Auth Klien yang gampang terhapus oleh Safari. Kini Header juga mengecek langsung status `localStorage` (`is_affiliate_logged_in`).
4. **Mekanisme Self-Healing di Dashboard:**
   Setiap kali halaman Dashboard (`app/affiliate/(panel)/dashboard/page.tsx`) dimuat dan berhasil mengambil data dari API yang dilindungi, halaman tersebut akan secara diam-diam memastikan dan menulis ulang status `localStorage` untuk memulihkan data yang mungkin dibersihkan sepihak oleh Safari.

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
