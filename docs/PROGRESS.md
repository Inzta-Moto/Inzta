# Project Progress & Task Tracker

Dokumen ini melacak status implementasi fitur Inzta dari fase purwarupa (prototype) hingga menjadi aplikasi full-stack yang aman.

## Phase 1: Frontend & Initial Prototype (Status: 🟢 Selesai)
- [x] Setup proyek dengan Next.js 14 (App Router) & TypeScript.
- [x] Implementasi Design System (UI/UX, warna Amber/Gold, Tipografi).
- [x] Halaman Katalog Produk (List & Filter).
- [x] Halaman Detail Produk & Galeri Gambar.
- [x] Integrasi Firebase Firestore & Auth (Client-side / Sementara).
- [x] Alur Checkout ke WhatsApp (Basic redirect).

## Phase 2: Backend & Security Migration (Status: 🟢 Selesai)
- [x] Setup Firebase Admin SDK untuk Server-Side (Koneksi aman via `.env` dan fallback `serviceAccountKey.json`).
- [x] Implementasi Next.js Middleware untuk melindungi route `/admin` dan `/api/admin`.
- [x] Buat Next.js API Routes (`/api/products`, `/api/articles`) untuk memindahkan logika database dari client-side.
- [x] Buat API Routes admin (`/api/admin/orders`, `/api/admin/orders/[orderId]`, `/api/admin/dashboard-stats`, `/api/admin/sidebar-stats`, `/api/admin/affiliates`, `/api/admin/vouchers`, `/api/admin/commissions`).
- [x] Refactor folder `app/admin` — Produk dan Artikel sudah menggunakan API Route.
- [ ] Amankan Firestore Rules (Hanya Admin SDK yang bisa memodifikasi, klien dibatasi).

## Phase 3: Order & Checkout Flow (Status: 🟢 Selesai)
- [x] Definisi TypeScript interface `Order` dan `OrderItem` di `types/index.ts`.
- [x] Buat API publik `POST /api/orders` untuk generate Order ID unik (format `ORD-XXXXX`) dan simpan pesanan sebagai `pending`.
- [x] Integrasi checkout di halaman detail produk (`DetailClient.tsx`): Klik beli → buat order via API → buka WhatsApp dengan Order ID.
- [x] Integrasi checkout di kartu produk katalog (`ProductCard.tsx`): Klik beli → buat order via API → buka WhatsApp dengan Order ID.
- [x] Update `lib/utils.ts` — fungsi `buildWaLink` dan `buildDetailWaLink` mendukung parameter `orderId`.
- [x] Otomatisasi penyesuaian teks WhatsApp agar memuat Order ID, total harga yang benar (termasuk diskon/voucher dari detail produk).
- [x] Loading state pada tombol "Pesan via WhatsApp" saat proses pembuatan pesanan.

## Phase 4: Admin Command Center (Status: 🟢 95% Selesai)
- [x] **Auth:** Halaman Login khusus Admin (Sudah ada di `app/admin/login`).
- [x] **Dashboard:** UI metrik utama (Sudah ada di `app/admin/page.tsx`).
- [x] **Product Manager:** Fitur CRUD produk & upload gambar (Sudah menggunakan API).
- [x] **Blog/Content Manager:** CRUD untuk artikel (Sudah menggunakan API).
- [x] **Order Manager:** Halaman `app/admin/(panel)/orders/page.tsx` untuk daftar pesanan, cari Order ID, filter status, ubah status (`pending` → `completed`/`cancelled`), dan logika otomatis potong stok via Firestore transaction.
- [x] **Sidebar Navigation:** Link "Pesanan" dengan badge counter pending orders.
- [x] **Sidebar Stats API:** Endpoint `sidebar-stats` menghitung pending orders untuk badge.

## Phase 5: Affiliate & Reward System (Status: 🟢 Selesai)
- [x] **Admin - Affiliate Manager:** Fitur pendaftaran afiliasi, pembuatan voucher, dan tracking komisi (Sudah ada UI-nya).
- [x] Deteksi parameter URL `?aff=` secara global dan simpan ke `localStorage`/Cookies.
- [x] Logika auto-apply voucher saat checkout berdasarkan referal afiliasi.
- [x] Tambahkan logika perhitungan diskon (`discountAmount`) ke dalam tampilan detail produk saat menerapkan voucher.
