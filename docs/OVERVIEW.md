# 🤖 Inzta Project Overview & AI Agent Context

> **AI SYSTEM PROMPT:** File ini adalah sumber kebenaran utama (*Single Source of Truth*) untuk proyek Inzta. Agen AI diwajibkan membaca file ini untuk memahami konteks bisnis, arsitektur teknis, model data, dan aturan *styling* sebelum mengeksekusi tugas apa pun.

## 1. Project Context & Vision
**Inzta (Inzta Moto)** adalah platform e-commerce premium untuk aksesori dan tas motor anti-air (*waterproof*). Fokus utama proyek ini adalah menyajikan pengalaman belanja *luxury minimalist* yang berfokus pada kecepatan, tampilan visual yang kuat, dan konversi ke WhatsApp (Checkout to WhatsApp). Platform ini juga memfasilitasi sistem afiliasi yang memberikan *reward* otomatis pada perujuk (*referrer*).

## 2. Technical Stack & Architecture
- **Framework:** Next.js 14 (App Router).
- **Language:** TypeScript (Strict mode).
- **Styling:** Vanilla CSS murni (menggunakan global variables di `globals.css` dan naming convention BEM-like). **JANGAN** gunakan Tailwind CSS, Styled Components, atau framework CSS lainnya kecuali diinstruksikan.
- **Database & Auth:** Firebase (Firestore & Firebase Authentication).
- **Arsitektur Utama:** Menggunakan **Server-Side Architecture** dengan Firebase Admin SDK melalui `Next.js API Routes` (`/api/*`) dan diamankan menggunakan `Middleware` untuk halaman admin. Operasi *database* kritis (seperti pengurangan stok produk) diproses via *Firestore Transaction* di backend, bukan client.

## 3. Directory Structure
- `/app`: Pages dan Layouts Next.js (termasuk public, admin, affiliate, blog, produk, api).
- `/components`: Komponen UI yang dapat digunakan kembali (*reusable*), seperti `ProductCard`, `AffiliateTracker`.
- `/lib`: Konfigurasi *third-party* (Firebase client, Admin SDK, utility helpers).
- `/public`: Aset statis (Logo Inzta, MTG, manifest, gambar *placeholder*).
- `/types`: Definisi antarmuka (Interfaces) TypeScript. **Wajib** meletakkan semua tipe data di sini (seperti Order, Product, Affiliate).
- `/docs`: Dokumentasi detail spesifik per fitur, sistem desain, roadmap, dan catatan perbaikan (*fixes*).

## 4. Core Data Models (Firestore)
Struktur data kunci berdasarkan `types/index.ts`:

*   **Product:** `{ name, slug, description, category, stock, price, originalPrice, isActive, features[], images[], createdAt }`
*   **Order (Tracking):** `{ orderId, customerName, address, items: [{id, name, price, quantity}], totalPrice, discountAmount, voucherCode, affiliateId, finalPrice, status: 'pending' | 'completed' | 'cancelled', createdAt }`
*   **Affiliate:** `{ id, name, phone, email, voucherCode, uid, createdAt }`
*   **Voucher:** `{ code, type, value, minPurchase, maxDiscount, affiliateId, affiliateName, isActive, usageCount, expiresAt }`
*   **Commission:** `{ id, affiliateId, voucherCode, productName, productSlug, productPrice, discountAmount, commissionAmount, isPaid, orderId, paidAt }`

## 5. Key System Flows (Alur Sistem Kritis)
1.  **Checkout & WhatsApp Flow (Server-Side):**
    - User menambahkan barang ke keranjang/klik beli.
    - `POST /api/orders` dipanggil. Sistem menghasilkan `Order ID` unik (misal: #ORD-XXXXX).
    - Pesanan di-*draft* dengan `status: 'pending'` ke Firestore.
    - Klien di-*redirect* ke URL WhatsApp memuat *Order ID* dan *finalPrice*.
2.  **Affiliate Auto-Voucher Flow:**
    - Sistem memonitor parameter URL `?aff=ID` via `AffiliateTracker.tsx`.
    - ID disimpan di `localStorage`. Saat checkout, voucher afiliasi teraplikasi otomatis memotong harga.
3.  **Admin Verification & Stock Flow:**
    - Admin mencari `Order ID` di Dashboard Admin Inzta.
    - Admin memverifikasi transaksi WhatsApp lalu menekan "Selesaikan Pesanan".
    - `PATCH /api/admin/orders/[id]` mengubah status menjadi `completed`.
    - **PENTING:** Terjadi *Transaction* di server untuk mengurangi `stock` berdasarkan jumlah yang dibeli, mencegah *race condition*.

## 6. Design System & Styling Rules
- **Color Palette:** 
  - *Accent:* `#F59E0B` (Amber/Gold) untuk CTA dan *highlight*.
  - *Background:* `#F9FAFB` (Subtle Grey) untuk public, tone khusus untuk admin panel.
  - *Surface/Card:* `#FFFFFF`.
- **UI Elements:** Gunakan *border-radius* 8px untuk kartu/input. Gunakan efek *hover* yang halus (misal: `translateY(-4px)` dengan *shadow*).
- **Typography:** *Inter* (Sans-serif). Gunakan format *Uppercase* dengan *letter-spacing* lebar untuk judul Hero dan Eyebrows.

## 7. Current Progress & Focus
Proyek telah bertransisi dari fase purwarupa (*frontend client-side*) menjadi aplikasi *full-stack* yang kuat dengan proteksi Middleware dan API Server-side.
- **Selesai:** UI Frontend (Katalog, Blog, Afiliasi), API Routes (Orders, Admin, Products, Vouchers, dsb), Order & Stock System, Affiliate Engine.
- **Fokus Selanjutnya:** Optimasi performa, keamanan Firestore Rules lanjutan, dan penyempurnaan fitur spesifik (selalu periksa `docs/PROGRESS.md` untuk tugas terbaru).
