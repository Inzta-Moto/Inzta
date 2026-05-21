# 🤖 Inzta Project Overview & AI Agent Context

> **AI SYSTEM PROMPT:** File ini adalah sumber kebenaran utama (*Single Source of Truth*) untuk proyek Inzta. Agen AI diwajibkan membaca file ini untuk memahami konteks bisnis, arsitektur teknis, model data, dan aturan *styling* sebelum mengeksekusi tugas apa pun.

## 1. Project Context & Vision
**Inzta (Inzta Moto)** adalah platform e-commerce premium untuk aksesori dan tas motor anti-air (*waterproof*). Fokus utama proyek ini adalah menyajikan pengalaman belanja *luxury minimalist* yang berfokus pada kecepatan, tampilan visual yang kuat, dan konversi ke WhatsApp (untuk saat ini).

## 2. Technical Stack & Architecture
- **Framework:** Next.js 14 (App Router).
- **Language:** TypeScript (Strict mode).
- **Styling:** Vanilla CSS murni (menggunakan global variables di `globals.css` dan naming convention BEM-like). **JANGAN** gunakan Tailwind CSS, Styled Components, atau framework CSS lainnya kecuali diinstruksikan.
- **Database & Auth:** Firebase (Firestore & Firebase Authentication).
- **Icons:** Lucide React.
- **Arsitektur (Transisi Fase):** Saat ini (Fase 1) menggunakan operasi Firestore langsung dari *Client-side*. Tugas agen AI ke depan adalah melakukan migrasi ke **Server-Side Architecture** menggunakan Firebase Admin SDK melalui `Next.js API Routes` dan `Middleware` demi keamanan.

## 3. Directory Structure
- `/app`: Pages dan Layouts (mengikuti Next.js App Router convention).
- `/components`: Komponen UI yang dapat digunakan kembali (*reusable*).
- `/lib`: Konfigurasi *third-party* (Firebase client, utilities).
- `/public`: Aset statis (Logo, Favicon, gambar *placeholder*).
- `/types`: Definisi antarmuka (Interfaces) TypeScript. **Wajib** meletakkan semua tipe data di sini.
- `/docs`: Dokumentasi detail spesifik per fitur (Baca file di `/docs/features/` atau `/docs/flows/` jika membutuhkan instruksi sangat mendalam tentang satu fitur).

## 4. Core Data Models (Firestore)
Agen AI harus mematuhi struktur data berikut saat membuat API atau komponen antarmuka:

*   **Product:** `{ name, slug, description, category, stock, price, originalPrice, isActive, badge, features[], images[] }`
*   **Order (Tracking):** `{ orderId, customerName, address, items: [{id, name, price, quantity}], totalPrice, discountAmount, voucherCode, affiliateId, finalPrice, status: 'pending' | 'completed' | 'cancelled' }`
*   **Affiliate:** `{ id, name, phone, email, voucherCode, uid, totalCommission }`

## 5. Key System Flows (Alur Sistem Kritis)
1.  **Checkout & WhatsApp Flow:**
    - User menambahkan barang ke keranjang/klik beli.
    - Sistem menghasilkan `Order ID` unik (misal: #ORD-12345).
    - Sistem menyimpan draft pesanan dengan `status: 'pending'` ke Firestore melalui API.
    - User di-*redirect* ke URL WhatsApp dengan pesan teks bawaan yang memuat `Order ID`, daftar barang, dan total harga (`finalPrice`).
2.  **Affiliate Auto-Voucher Flow:**
    - URL dengan parameter `?aff=ID` terdeteksi oleh sistem.
    - Sistem menyimpan Affiliate ID di `localStorage`/Cookies.
    - Voucher diskon diaplikasikan secara otomatis ke keranjang dan dicatat dalam dokumen `Order` saat checkout.
3.  **Admin Verification & Stock Flow:**
    - Admin mencari `Order ID` (dari pesan WhatsApp) di Dashboard Inzta.
    - Admin memverifikasi harga dan mengubah status menjadi `completed`.
    - **PENTING:** Stok produk (`stock`) baru dikurangi secara otomatis pada database KETIKA status berubah menjadi `completed`.

## 6. Design System & Styling Rules
- **Color Palette:** 
  - *Accent:* `#F59E0B` (Amber/Gold) untuk CTA dan *highlight*.
  - *Background:* `#F9FAFB` (Subtle Grey).
  - *Surface/Card:* `#FFFFFF`.
- **UI Elements:** Gunakan *border-radius* 8px untuk kartu/input. Gunakan efek *hover* yang halus (misal: `translateY(-4px)` dengan *shadow*).
- **Typography:** *Inter* (Sans-serif). Gunakan format *Uppercase* dengan *letter-spacing* lebar untuk judul Hero dan Eyebrows.

## 7. Current Progress
Untuk mengetahui fitur apa yang sudah selesai dan apa yang harus dikerjakan, **selalu periksa file `docs/PROGRESS.md`**.
- **Selesai:** UI Frontend Prototype (Katalog Produk, Detail Produk).
- **Fokus Selanjutnya:** Backend/API Routes, Security Middleware, Order Generation System, dan Admin Dashboard Command Center.