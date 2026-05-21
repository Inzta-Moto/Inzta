# Admin Panel & Management

## Security & Authentication
- **Access:** Restricted to authenticated users via Firebase Auth.
- **Role:** Currently single-admin (Superuser).
- **Paths:** `/admin`, `/admin/produk`, `/admin/blog`, `/admin/affiliate`.

## Dashboard Features
- **Key Metrics:**
    - Total Active Products.
    - Low Stock Items (Threshold: 10).
- **Quick Actions:** Shortcuts to add new products or view the live shop.

## Management Modules
1.  **Product Manager:**
    - Table view with status indicators (`Active`/`Inactive`).
    - Form with validation for prices and inventory.
    - Multi-feature input (comma-separated or dynamic tags).
2.  **Blog Manager:**
    - Simple text editor for content.
    - Slug management for SEO-friendly URLs.
3.  **Affiliate Manager:**
    - List of partners and their unique voucher codes.
    - Commission tracking per sale.

## UI/UX
- **Sidebar Navigation:** Collapsible on mobile.
- **Toasts:** Feedback on success/error for CRUD actions.
- **Empty States:** Clear messaging when no data is available.
