# Catalog & Product Module

## Data Model (TypeScript)
```typescript
interface Product {
  name: string;
  slug: string;
  description: string;
  category: string;
  stock: number;
  price: number;
  originalPrice?: number;
  isActive: boolean;
  badge?: string; // e.g., "New", "Best Seller"
  features: string[];
  imageUrl?: string;
  images?: string[]; // Array for gallery
  createdAt: Timestamp;
}
```

## Functional Requirements
1.  **Product List (`/produk`):**
    - **Real-time Search:** Filter by name, description, or features as the user types.
    - **Category Filtering:** Sidebar/Mobile-dropdown selection.
    - **Badge Filtering:** Quick tabs for "Best Seller", "New", and "Diskon".
2.  **Product Detail (`/produk/[slug]`):**
    - **Gallery:** Main image + Thumbnails. Zoom capabilities in Lightbox.
    - **Price Display:** Shows discount percentage if `originalPrice` exists.
    - **Inventory:** Displays "In Stock", "Low Stock" (<= 10), or "Out of Stock".
3.  **WhatsApp Integration:**
    - Generates a link: `https://wa.me/[number]?text=Halo Inzta, saya ingin bertanya tentang produk [Product Name]...`

## Admin Requirements
- **CRUD Operations:** Full control over product data.
- **Image Upload:** Needs integration with a storage provider (Firebase Storage).
- **Slug Generation:** Automatic generation from the name if possible.
