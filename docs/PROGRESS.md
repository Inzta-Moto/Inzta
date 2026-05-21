# Project Progress & Task Tracker

Dokumen ini melacak status implementasi fitur Inzta dari fase purwarupa (prototype) hingga menjadi aplikasi full-stack yang aman.

## Phase 1: Frontend & Initial Prototype (Status: 🟢 Selesai)
- [x] Setup proyek dengan Next.js 14 (App Router) & TypeScript.
- [x] Implementasi Design System (UI/UX, warna Amber/Gold, Tipografi).
- [x] Halaman Katalog Produk (List & Filter).
- [x] Halaman Detail Produk & Galeri Gambar.
- [x] Integrasi Firebase Firestore & Auth (Client-side / Sementara).
- [x] Alur Checkout ke WhatsApp (Basic redirect).

## Phase 2: Backend & Security Migration (Status: 🔴 Belum Dimulai)
- [ ] Setup Firebase Admin SDK untuk Server-Side.
- [ ] Buat Next.js API Routes (`/api/products`, `/api/orders`, dll) untuk memindahkan logika database dari komponen *client-side*.
- [ ] Refactor folder `app/admin` yang ada saat ini agar menggunakan pemanggilan API alih-alih `getDocs/setDoc` Firebase Client secara langsung.
- [ ] Implementasi Next.js Middleware untuk melindungi route `/admin` dan `/api/admin`.
- [ ] Amankan Firestore Rules (Hanya Admin SDK yang bisa memodifikasi, klien dibatasi).

## Phase 3: Order & Checkout Flow (Status: 🟡 Direncanakan)
- [ ] Generate `Order ID` unik sebelum redirect checkout.
- [ ] Simpan draft pesanan (`Status: Pending`) ke Firestore melalui API sebelum redirect ke WhatsApp.
- [ ] Otomatisasi penyesuaian teks WhatsApp agar memuat `Order ID` dan total harga yang benar (termasuk diskon/voucher).

## Phase 4: Admin Command Center (Status: 🟡 70% Selesai secara UI/Client-side)
- [x] **Auth:** Halaman Login khusus Admin (Sudah ada di `app/admin/login`).
- [x] **Dashboard:** UI metrik utama (Sudah ada di `app/admin/page.tsx`).
- [x] **Product Manager:** Fitur CRUD produk & upload gambar (Sudah ada di `app/admin/produk`).
- [x] **Blog/Content Manager:** CRUD untuk artikel (Sudah ada di `app/admin/artikel`).
- [ ] **Order Manager:** Buat halaman baru `app/admin/order` untuk cari `Order ID`, ubah status (`pending` -> `completed`), dan logika otomatis potong stok.

## Phase 5: Affiliate & Reward System (Status: 🟡 60% Selesai secara UI/Client-side)
- [x] **Admin - Affiliate Manager:** Fitur pendaftaran afiliasi, pembuatan voucher, dan tracking komisi (Sudah ada UI-nya).
- [ ] Deteksi parameter URL `?aff=` secara global dan simpan ke `localStorage`/Cookies.
- [ ] Logika auto-apply voucher saat checkout berdasarkan referal afiliasi.
- [ ] Tambahkan logika perhitungan diskon (`discountAmount`) ke dalam model data pesanan saat klik "Beli".
