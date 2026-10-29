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
  | { kind: 'render-error' }
  // F-013 phase C: a [[produk:…]] / [[artikel:…]] marker that is not alone in its paragraph, has an invalid
  // slug, or comes after the 10th marker. Each blocks publishing through C-9.
  | { kind: 'embed-inline' | 'embed-invalid' | 'embed-limit'; marker: string };

// F-013 phase C: renderArticle() output in Markdown order. HTML blocks are sanitized; cards are data only.
export type EmbedKind = 'product' | 'article';
export type RenderBlock = { type: 'html'; html: string } | { type: EmbedKind; slug: string };

// Card data from lib/article-embeds.ts (server). Only what the cards render, nothing internal.
export interface ProductEmbed {
  slug: string;
  name: string;
  image: string | null;
  price: number | null;
  priceTo: number | null;
  compareAtPrice: number | null;
  inStock: boolean;
}

export interface ArticleEmbed {
  slug: string;
  title: string;
  excerpt: string;
  image: string | null;
  date: number | null;
}

export interface ArticleEmbeds {
  products: Record<string, ProductEmbed>;
  articles: Record<string, ArticleEmbed>;
}

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

// F-016 landing page v2. Motor categories follow ADR-0019 (inzta-hq), positions are where a bag sits,
// not the Firestore `category` field (hardcase/softcase/tank).
export type MotorCategory = 'matic' | 'adventure' | 'retro' | 'trail';
export type BagPosition = 'tank' | 'side' | 'tail' | 'aksesori';

// Only one label shows per card (F-016 17.1); null means no label.
export type FitLabel = { kind: 'model' | 'universal' | 'for'; text: string } | null;

export interface HomeProductCard {
  slug: string;
  name: string;
  image: string | null;
  position: BagPosition | null;
  fit: FitLabel;
  price: number;
  compareAt: number | null;
  cropClass: 'iz-crop-top' | 'iz-crop-half' | null;
}

export interface HomeGuideCard {
  slug: string;
  title: string;
  image: string | null;
  imageAlt: string;
  author: string;
  date: number | null;
  chip: string | null;
  credit: string | null;
}

// settings/flashSale as stored by the admin settings route; endsAt is an ISO string.
export interface FlashSaleState {
  isActive: boolean;
  endsAt: string | null;
}

export interface HomeData {
  bestSellers: HomeProductCard[];
  minPrices: Record<BagPosition, number | null>;
  tourmax: { price: number; compareAt: number | null } | null;
  guides: HomeGuideCard[];
  gasberPublished: boolean;
  productImages: Record<string, string>;
  flash: FlashSaleState;
}

// F-016 static Beranda content and flash-sale countdown (all types live here, docs/steering/rules.md).
export interface CategoryItem {
  value: MotorCategory;
  label: string;
  image: string;
  alt: string;
}

export interface PositionItem {
  value: BagPosition;
  menuLabel: string;
  tileTitle: string;
  tileText: string;
  image: string;
  alt: string;
}

export interface FilmPhoto {
  src: string;
  alt: string;
  shape: 'wide' | 'tall';
  credit: string | null;
}

export interface ReviewItem {
  quote: string;
  productSlug: string;
  productName: string;
  name: string;
  month: string;
}

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  ended: boolean;
}

export interface FlashCountdown {
  value: Countdown | null;
  ended: boolean;
}
