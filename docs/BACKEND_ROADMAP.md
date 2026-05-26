# Backend Roadmap & Architecture Proposals

## Current Architecture
- **Client-Side Heavy:** React components talk directly to Firestore.
- **Vulnerabilities:** Firestore rules are the only line of defense; business logic is exposed in the frontend.

## Proposed Architecture (Next.js API Routes)
### 1. API Layer
- **Endpoint:** `/api/products`, `/api/blog`, `/api/affiliates`.
- **Logic:** Move filtering, sorting, and validation to the server.
- **Benefits:** SEO improvement (Metadata generation via Server Components), Security (Secret keys for storage/payouts), and Consistency.

### 2. Security Implementations
- **Middleware:** Validate Firebase Session Cookies for all `/admin` and `/api/admin` routes.
- **Firestore Rules:** Tighten rules to prevent unauthorized writes, ensuring only the Admin UID can modify collections.

### 3. Image & Media Strategy
- **Provider:** Use **Firebase Storage** or **Cloudinary**.
- **Transformation:** Implement automatic resizing for thumbnails and optimized webp formats for performance.

### 4. Expansion: WhatsApp Checkout System (Manual Payment)
- **Order Pre-Registration:** Before redirecting to WhatsApp, the system creates a "Pending" order record in Firestore.
- **Dynamic Link Generation:** Generates a WhatsApp URL containing a structured message: Order ID, Customer Data, and Final Price.
- **Order ID Verification:** The Order ID serves as the primary reference. Admin verifies the price and affiliate attribution in the dashboard using this ID to prevent manual price manipulation by the user in the chat box.
- **Affiliate Commission Trigger:** Admin manually marks an order as "Completed" in the dashboard, which then triggers the commission calculation for the associated affiliate.

## Database Schema Enhancements
- Add `Orders` collection to track transactions.
- Add `Sessions` or `Analytics` to track affiliate link performance.
- Implement soft-deletes (`deletedAt`) for products and articles.
