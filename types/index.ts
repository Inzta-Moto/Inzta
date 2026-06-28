// ── Product Variation Types ────────────────────────────────────────────────────

export type ProductType = 'simple' | 'variable';

export interface ProductAttribute {
  id: string;       // crypto.randomUUID(), stabil untuk React key
  name: string;
  values: string[];
}

export interface ProductVariant {
  variationId: string;
  sku: string;
  attributes: Record<string, string>;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  images: string[];
  isActive: boolean;
  isDefault: boolean;
}

export interface VariantSnapshot {
  variationId: string;
  sku: string;
  attributes: Record<string, string>;
  price: number;
  compareAtPrice: number | null;
  imageUrl: string | null;
}

// ── Product — Discriminated Union ──────────────────────────────────────────────

export interface BaseProduct {
  name: string;
  slug: string;
  description: string;
  category: string;
  images: string[];
  imageUrl?: string;   // ponytail: deprecated — derived dari images[0], dipertahankan untuk compat existing Firestore docs
  features: string[];
  badge?: string | null;
  badgeType?: string;
  isActive: boolean;
  createdAt?: any;
}

export interface SimpleProduct extends BaseProduct {
  productType: 'simple';
  price: number;
  compareAtPrice: number | null;
  stock: number;
  sku?: string | null;
}

export interface VariableProduct extends BaseProduct {
  productType: 'variable';
  attributes: ProductAttribute[];
  variants: ProductVariant[];
  priceFrom: number | null;
  priceTo: number | null;
  totalStock: number;
}

export type Product = SimpleProduct | VariableProduct;

// ── Order ──────────────────────────────────────────────────────────────────────

export interface OrderItem {
  id?: string;                        // legacy — hanya ada di order lama
  productId: string;
  productSlug: string;
  productName: string;
  productType: ProductType;
  variationId: string | null;
  quantity: number;
  price: number;
  subtotal: number;
  imageUrl: string | null;
  selectedVariantLabel: string | null;
  variantSnapshot: VariantSnapshot | null;
}

export interface InventorySnapshotItem {
  productSlug: string;
  variationId: string | null;
  stockBefore: number;
  quantity: number;
  stockAfter: number;
}

export interface Order {
  orderId: string;
  customerName: string;
  address: string;
  items: OrderItem[];
  totalPrice: number;
  discountAmount: number;
  voucherCode: string | null;
  affiliateId: string | null;
  finalPrice: number;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: any;
  completedAt?: any;
  commissionId?: string;
  inventorySnapshot?: { items: InventorySnapshotItem[] };
  inventoryRecoveryFailed?: boolean;
  inventoryRecoveryDetails?: {
    variationId: string;
    productSlug: string;
    reason: string;
  };
}

// ── Unchanged Types ────────────────────────────────────────────────────────────

export interface Feature {
  id?: string;
  icon: string;
  title: string;
  description: string;
  order?: number;
  isActive: boolean;
}

export interface Article {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  imageUrl?: string;
  author?: string;
  createdAt?: { seconds: number; nanoseconds: number };
}

export interface Voucher {
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minPurchase: number;
  maxDiscount: number;
  affiliateId: string | null;
  affiliateName: string | null;
  isActive: boolean;
  usageCount: number;
  maxUsage: number | null;
  expiresAt: any;
  createdAt: any;
}

export interface Affiliate {
  id: string;
  name: string;
  phone: string;
  voucherCode: string;
  email: string;
  uid: string;
  createdAt: any;
}

export interface Commission {
  id: string;
  affiliateId: string;
  affiliateName: string;
  voucherCode: string;
  productName: string;
  productSlug: string;
  productPrice: number;
  discountAmount: number;
  finalPrice: number;
  commissionAmount: number;
  isPaid: boolean;
  orderId?: string;
  items?: OrderItem[];
  paidAt: any;
  createdAt: any;
}
