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

export type ArticleStatus = 'draft' | 'published';
export type ContentFormat = 'plain' | 'markdown';

export interface Article {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  // Missing on documents written before F-012: no contentFormat means 'plain', no status means 'published'.
  contentFormat?: ContentFormat;
  status?: ArticleStatus;
  coverImage?: string;
  coverAlt?: string;
  // F-013 phase A2: credit under the cover, and whether the cover shows on the article page (missing = true).
  // The cover still feeds blog cards, the home page, and og:image when showCover is false.
  coverCaption?: string;
  showCover?: boolean;
  metaTitle?: string;
  metaDescription?: string;
  // Legacy gallery, used only by 'plain' articles.
  images?: string[];
  imageUrl?: string;
  author?: string;
  source?: 'admin' | 'automation';
  // Legacy documents hold a Firestore Timestamp; writes since F-000 store an ISO string.
  createdAt?: StoredDate;
  updatedAt?: StoredDate;
  // First publish; kept on unpublish so the slug stays locked.
  publishedAt?: StoredDate;
}

export type StoredDate = { seconds: number; nanoseconds: number } | string | number;

// Article as passed from server pages to client components: dates as epoch milliseconds.
export interface PublicArticle extends Omit<Article, 'createdAt' | 'updatedAt' | 'publishedAt'> {
  createdAt: number | null;
  updatedAt: number | null;
  publishedAt: number | null;
}

// Only what a blog card renders, so list sections do not ship full article content to the browser.
export type ArticleCard = Pick<
  PublicArticle,
  'slug' | 'title' | 'excerpt' | 'images' | 'imageUrl' | 'coverImage' | 'coverAlt' | 'createdAt' | 'publishedAt'
>;

// F-013: layout of one body image, written as an attribute block after the Markdown image
// (`![alt](url "caption"){posisi=kanan ukuran=sedang}`). Parsed and resolved in lib/article-format.ts.
export type ImagePosition = 'kiri' | 'tengah' | 'kanan';
export type ImageSize = 'kecil' | 'sedang' | 'besar' | 'penuh';
export interface ImageLayout {
  posisi: ImagePosition;
  ukuran: ImageSize;
}

// Warnings from renderArticle() (lib/markdown.ts). Shared with the checklist and the editor, so a new kind
// has to be handled everywhere the compiler sees it.
export type RenderWarning =
  | { kind: 'image-host' | 'placeholder' | 'inline-image'; src: string; alt: string }
  | { kind: 'raw-html' }
  // marked could not parse the body (e.g. nesting deep enough to overflow the stack).
  | { kind: 'render-error' };

export interface ChecklistItem {
  id: string;
  label: string;
  ok: boolean;
  detail?: string;
}

export interface ChecklistResult {
  blocking: ChecklistItem[];
  warnings: ChecklistItem[];
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
