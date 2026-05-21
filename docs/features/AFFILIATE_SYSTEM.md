# Affiliate & Rewards System

## Logic & Attribution
1.  **URL Tracking:** Affiliates share links with a `?aff=ID` parameter.
2.  **Auto-Voucher:** When the parameter is detected, a hidden or visible voucher is applied to the session.
3.  **Order ID Linking:** When an order is created (before WhatsApp redirect), the `affiliateId` is locked into the Order record in Firestore.
4.  **Verification:** Admin uses the Order ID from the WhatsApp message to confirm which affiliate gets the commission.

## Data Models
### Affiliate
```typescript
interface Affiliate {
  id: string; // unique code like 'rider123'
  name: string;
  phone: string;
  email: string;
  voucherCode: string;
  uid: string; // Firebase Auth UID
  totalCommission: number;
}
```

### Order (Tracking)
```typescript
interface Order {
  orderId: string;
  customerName: string;
  address: string;
  items: Array<{id: string, name: string, price: number, quantity: number}>;
  totalPrice: number; // Harga sebelum diskon
  discountAmount: number; // Jumlah potongan harga (baru)
  voucherCode: string | null; // Voucher yang digunakan (baru)
  affiliateId: string | null; // For commission tracking
  finalPrice: number; // Harga akhir setelah diskon (baru)
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: Timestamp;
}
```

### Voucher
```typescript
interface Voucher {
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  affiliateId: string | null;
  isActive: boolean;
  usageCount: number;
  maxUsage: number | null;
  expiresAt: Date;
}
```

### Commission
```typescript
interface Commission {
  affiliateId: string;
  productName: string;
  finalPrice: number;
  commissionAmount: number;
  isPaid: boolean;
  paidAt?: Date;
}
```

## Backend Road Map
1.  **Automated Tracking:** Track link clicks using cookies or local storage to attribute sales even without a voucher.
2.  **Affiliate Dashboard:** A dedicated portal for affiliates to see their clicks, conversions, and unpaid commissions.
3.  **Automatic Commission Calculation:** Logic to calculate % of `finalPrice` based on affiliate tier.
