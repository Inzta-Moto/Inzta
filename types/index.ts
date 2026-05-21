export interface Product {
  name: string;
  slug: string;
  description: string;
  category: string;
  stock: number;
  price: number;
  originalPrice?: number;
  priceFrom?: number;
  priceTo?: number;
  isActive: boolean;
  badge?: string | null;
  badgeType?: string;
  features: string[];
  imageUrl?: string;     
  images?: string[];      
  createdAt?: any;
}

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
  email: string;      // ← TAMBAH
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
  paidAt: any;
  createdAt: any;
}