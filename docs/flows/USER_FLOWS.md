# User Flows

## 1. Customer Flow (Discovery & WhatsApp Checkout)
1.  **Landing & Referral:** 
    - User arrives via Affiliate Link (e.g., `inzta.id/produk/tas-moto?aff=AFF-JANUARI`).
    - System detects `aff` parameter and validates the voucher code securely via Server API (`/api/vouchers/validate`).
    - The discount is auto-applied and the voucher code is stored in `localStorage` (`inzta_affiliate`).
2.  **Product Discovery:**
    - User sees discounted prices automatically on the product detail page.
3.  **Checkout & Order Generation:**
    - User clicks "Pesan via WhatsApp".
    - System calls `POST /api/orders` to generate a unique **Order ID** (e.g., `#ORD-123456789`).
    - System securely saves an Order record in Firestore: `{ orderId, items, totalPrice, discountAmount, voucherCode, affiliateId, finalPrice, status: 'pending' }`.
    - System automatically calls `POST /api/admin/commissions/track` (Server-Side) to log a `pending` commission for the affiliate and increment the voucher usage count.
4.  **WhatsApp Redirect:**
    - User is redirected to WhatsApp with a pre-filled message containing the `Order ID`, product details, discount info, and Final Price.
5.  **Admin Verification:**
    - Admin receives the WhatsApp message.
    - Admin logs into the Admin Panel, searches for the Order ID in the **Order Manager**.
    - Admin verifies payment and changes the order status from `pending` to `completed`.
    - **Crucial Step:** The system executes a secure Firestore Transaction to automatically deduct product stock based on the order.

## 2. Affiliate Flow (End-to-End)
1.  **Registration:** Admin creates an Affiliate account via `/admin/affiliate`. The system securely creates an authentication account (via Firebase Admin SDK) and auto-generates a unique **Voucher Code** (e.g., `AFF-XYZ`).
2.  **Configuration:** Admin configures the discount rules for that voucher (percentage/fixed, max discount, min purchase) in the **Voucher Manager** (`/admin/voucher`).
3.  **Promotion:** Affiliate retrieves their code (either provided by Admin or by logging into the `/affiliate` portal) and shares links like: `inzta.id?aff=AFF-XYZ`.
4.  **Conversion & Tracking:** A customer uses the link, makes a purchase, and the system automatically calculates and records a 5% commission as `pending`.
5.  **Payout:** After the transaction is successfully completed, the Admin visits the **Commission Manager** (`/admin/commission`) to execute payout to the affiliate's bank/e-wallet, then marks the commission as `Paid` in the system.

## 3. Admin Flow (Management)
1.  **Auth:** Admin logs in via `/admin/login`. (The login page is structurally isolated via Route Groups so the sidebar is hidden).
2.  **Dashboard:** Admin views stock alerts and high-level stats powered by fast Server API aggregations (`/api/admin/dashboard-stats`).
3.  **Command Center Actions:**
    - **Orders:** Manage and verify customer orders. Auto-deduct stock upon completion.
    - **Products:** CRUD operations for the product catalog.
    - **Blog:** Manage SEO articles and content.
    - **Affiliates:** Add/Manage partners and their access.
    - **Vouchers:** Manage discount campaigns and limits.
    - **Commissions:** Manage affiliate payouts.
    - *Note: All admin actions communicate securely with `/api/admin/*` endpoints using the Firebase Admin SDK, adhering to strict Firestore Security Rules that block direct client access.*