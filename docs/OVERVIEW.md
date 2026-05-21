# Inzta Project Overview

## Project Context
**Inzta** (Inzta Moto) is a premium digital platform for a motorcycle accessory brand specializing in high-quality, waterproof, and stylish motorcycle bags. The project aims to provide a luxury shopping experience, moving beyond a simple catalog to a high-end branding tool.

Currently, the project is in a **high-fidelity frontend prototype stage**. It uses Next.js 14 and integrates directly with Firebase Firestore from the client side.

## Core Objectives for Next Phase
1.  **Backend Implementation:** Transition from direct client-side Firebase calls to a secure Server-Side / API-driven architecture.
2.  **Affiliate & Loyalty:** Expand the voucher and commission system to support a growing network of brand ambassadors.
3.  **Enhanced Admin Control:** Provide a complete "Command Center" for the business owner to manage inventory, content, and affiliate payouts.
4.  **Checkout Integration:** Currently, the "Buy" action leads to WhatsApp. Future plans may include an integrated payment gateway.

## Technical Stack
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Database/Auth:** Firebase (Firestore & Authentication)
- **Styling:** Vanilla CSS (Global variables & BEM-like naming)
- **Icons:** Lucide React
- **Hosting:** Vercel (Recommended)

## Project Structure
- `/app`: Pages and Layouts (Next.js App Router).
- `/components`: Reusable UI components.
- `/lib`: Library configurations (Firebase, Utilities).
- `/public`: Static assets (Logo, Favicon).
- `/types`: TypeScript interfaces for data consistency.
- `/docs`: Project documentation.
