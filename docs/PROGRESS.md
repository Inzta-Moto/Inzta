# Project Progress & Task Tracker

Dokumen ini melacak status implementasi fitur Inzta dari fase purwarupa (prototype) hingga menjadi aplikasi full-stack yang aman.

## Phase 1: Frontend & Initial Prototype (Status: 🟢 Sebagian Besar Selesai)
- [x] Setup proyek dengan Next.js 14 (App Router) & TypeScript.
- [x] Implementasi Design System (UI/UX, warna Amber/Gold, Tipografi).
- [x] Halaman Katalog Produk (List & Filter).
- [x] Halaman Detail Produk & Galeri Gambar.
- [x] Integrasi Firebase Firestore & Auth (Client-side / Sementara).
- [x] Alur Checkout ke WhatsApp (Basic redirect).

## Phase 2: Backend & Security Migration (Status: 🔴 Belum Dimulai)
- [ ] Setup Firebase Admin SDK untuk Server-Side.
- [ ] Buat Next.js API Routes (`/api/products`, `/api/orders`, dll) untuk memindahkan logika dari client.
- [ ] Implementasi Next.js Middleware untuk melindungi route `/admin` dan `/api/admin`.
- [ ] Amankan Firestore Rules (Hanya Admin yang bisa *write* langsung, sisanya lewat API).

## Phase 3: Order & Checkout Flow (Status: 🟡 Direncanakan)
- [ ] Generate `Order ID` unik sebelum checkout.
- [ ] Simpan draft pesanan (`Status: Pending`) ke Firestore melalui API sebelum redirect ke WhatsApp.
- [ ] Otomatisasi penyesuaian teks WhatsApp agar memuat `Order ID` dan total harga.

## Phase 4: Admin Command Center (Status: 🔴 Belum Dimulai)
- [ ] **Auth:** Halaman Login khusus Admin.
- [ ] **Dashboard:** UI metrik utama (Total produk, Alert stok menipis).
- [ ] **Order Manager:** Fitur cari `Order ID`, ubah status (`pending` -> `completed`), dan logika otomatis potong stok saat `completed`.
- [ ] **Product Manager:** Fitur CRUD produk & upload gambar.
- [ ] **Blog/Content Manager:** CRUD untuk artikel dan FAQ.

## Phase 5: Affiliate & Reward System (Status: 🔴 Belum Dimulai)
- [ ] Deteksi parameter URL `?aff=` dan simpan ke `localStorage`/Cookies.
- [ ] Logika auto-apply voucher saat checkout berdasarkan afiliasi.
- [ ] Tambahkan Affiliate ID dan rincian voucher ke dalam data pesanan (`Order`).
- [ ] **Admin - Affiliate Manager:** Fitur pendaftaran afiliasi, pembuatan kode voucher, dan tracking komisi.
