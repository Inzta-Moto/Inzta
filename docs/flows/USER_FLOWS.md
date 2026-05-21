# User Flows

## 1. Customer Flow (Discovery & WhatsApp Checkout)
1.  **Landing & Referral:** 
    - User arrives via Affiliate Link (e.g., `inzta.id/produk/tas-moto?aff=rider123`).
    - System detects `aff` parameter and auto-applies a voucher, storing the Affiliate ID in `localStorage`.
2.  **Product Discovery:**
    - User sees discounted prices automatically.
3.  **Checkout Form:**
    - User clicks "Beli Sekarang".
    - A simple modal/form appears to collect: **Name, Phone, and Full Address**.
4.  **Order Generation:**
    - System generates a unique **Order ID**.
    - System saves an Order record in Firestore: `{ orderId, items, totalPrice, affiliateId, status: 'pending' }`.
5.  **WhatsApp Redirect:**
    - User is redirected to WhatsApp with a pre-filled message:
      *"Halo Inzta, saya mau order [Product Name]. \n\nID Pesanan: #ORD-12345 \nNama: [Nama] \nAlamat: [Alamat] \nTotal: [Harga Akhir]"*
6.  **Admin Verification:**
    - Admin receives the message, logs into the dashboard, searches for `#ORD-12345`, and verifies the price is correct before providing payment instructions (Bank Transfer).

## 2. Affiliate Flow
1.  **Referral:** User clicks an affiliate link (e.g., `?aff=rider123`).
2.  **Shopping:** User browses and finds a product.
3.  **Voucher Usage:** User applies a voucher code provided by the affiliate.
4.  **Conversion:** Purchase happens on WhatsApp.
5.  **Tracking (Manual/Semi-Auto):** Currently, tracking is based on the voucher code used in the transaction.

## 3. Admin Flow (Management)
1.  **Auth:** Admin logs in via `/admin/login`.
2.  **Dashboard:** Views stock alerts, recent pending orders, and high-level stats.
3.  **Content & Order Management:**
    - **Orders:** Verifikasi `Order ID` dari pesan WhatsApp. Ubah status pesanan dari `pending` menjadi `completed`. **Catatan:** Sistem baru akan mengurangi jumlah stok (`stock`) produk ketika pesanan di-mark sebagai `completed`.
    - **Products:** Create, Edit, Toggle `isActive`, Manage inventory.
    - **Blog:** Write articles, manage images.
    - **Affiliates:** Add new partners, generate voucher codes.
    - **Commissions:** Record sales attributed to affiliates and mark as paid.
