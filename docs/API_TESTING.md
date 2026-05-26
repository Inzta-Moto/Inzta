# Skenario Pengujian Keseluruhan API (End-to-End API Testing)

File ini memuat daftar *endpoint* API yang ada di Inzta beserta *payload* (data request) yang diuji. Pengujian ini bertujuan memastikan sistem *Backend* baru berjalan dengan baik tanpa ada *crash* (Error 500).

## 1. Auth & Sesi (Gembok Keamanan)
**Tujuan:** Memastikan sistem login dapat membuat sesi *cookie* dengan token Firebase yang valid.
*   **Endpoint:** `POST /api/auth/session`
*   **Payload:** `{ "idToken": "eyJhbGci...", "role": "admin" }` // Atau "affiliate"
*   **Ekspektasi:** `200 OK` (Set-Cookie `admin_session` / `affiliate_session`)

## 2. API Publik & Checkout
**Tujuan:** Memastikan fungsi yang dipakai pelanggan berfungsi dengan aman.

### A. Cek Detail Produk
*   **Endpoint:** `GET /api/products/[slug]` (Jika ada API khusus, atau via Firestore langsung)
*   **Ekspektasi:** Data produk tampil.

### B. Validasi Voucher (Sebelum Checkout)
*   **Endpoint:** `GET /api/vouchers/validate?code=INZ-50`
*   **Ekspektasi:** `200 OK` (Jika valid), `400/404` (Jika kadaluarsa/tidak ada).

### C. Membuat Pesanan (Checkout via WA)
*   **Endpoint:** `POST /api/orders`
*   **Payload:**
    ```json
    {
      "items": [
        { "id": "sidebag-inzta-adventure", "name": "Sidebag Inzta", "price": 300000, "quantity": 1 }
      ],
      "voucherCode": "INZ-50",
      "affiliateId": "AFF-123",
      "buyerUID": null
    }
    ```
*   **Catatan Keamanan:** Total harga, diskon, dan harga akhir sengaja dihilangkan dari payload karena kini dihitung paksa di server.
*   **Ekspektasi:** `201 Created` (Mengembalikan `orderId` dan `calculatedTotals`).

## 3. Panel Admin (Memerlukan Cookie `admin_session`)
**Tujuan:** Memastikan Admin bisa mengatur toko dan otorisasi berjalan. *Jika diuji tanpa login, semua harus me-return 401 Unauthorized.*

### A. Melihat Statistik Dasbor
*   **Endpoint:** `GET /api/admin/dashboard-stats`
*   **Ekspektasi:** `200 OK` (Mengembalikan total pesanan, pendapatan, dll).

### B. Membuat Voucher Baru
*   **Endpoint:** `POST /api/admin/vouchers`
*   **Payload:**
    ```json
    {
      "code": "INZ-50",
      "type": "fixed",
      "value": 50000,
      "minPurchase": 100000,
      "isActive": true
    }
    ```
*   **Ekspektasi:** `201 Created`.

### C. Memproses Pesanan (Stok Berkurang & Komisi Dibuat)
*   **Endpoint:** `PATCH /api/admin/orders/ORD-ABCDEF`
*   **Payload:** `{ "status": "completed" }`
*   **Ekspektasi:** `200 OK`. Stok produk di database otomatis berkurang.

### D. Mendaftarkan Afiliator Baru
*   **Endpoint:** `POST /api/admin/affiliates`
*   **Payload:**
    ```json
    {
      "id": "AFF-123",
      "email": "affiliate@test.com",
      "password": "password123",
      "name": "Budi Afiliasi",
      "voucherCode": "INZ-BUDI"
    }
    ```
*   **Ekspektasi:** `201 Created` (Sistem juga otomatis membuat akun di Firebase Auth).

## 4. Panel Afiliasi (Memerlukan Cookie `affiliate_session`)
**Tujuan:** Memastikan Afiliator bisa melihat komisi mereka.

### A. Melihat Data Komisi
*   **Endpoint:** `GET /api/affiliate/commissions`
*   **Ekspektasi:** `200 OK` (Daftar komisi dari orang yang memakai vouchernya).