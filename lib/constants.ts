// Kept apart from lib/firebase so server components can use lib/utils without bundling the Firebase client SDK.
export const WA_NUMBER: string = process.env.NEXT_PUBLIC_WA_NUMBER || "6283804058329";

// The website's own Cloudinary cloud (components/ImageUpload.tsx). Article images must come from it, so
// content can never hotlink or track through another host.
export const CLOUDINARY_CLOUD = 'dukddlp0b';
export const ALLOWED_IMAGE_PREFIX = `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/`;

// '/admin/artikel/baru' is the new-article page, so an article cannot own that slug.
export const RESERVED_ARTICLE_SLUGS: readonly string[] = ['baru'];

// F-013 phase A2 (H-3): an empty article author is stored and shown as this default.
export const DEFAULT_AUTHOR = 'Tim INZTA';

// F-005: the one public origin for canonical URLs and JSON-LD. Deliberately not NEXT_PUBLIC_SITE_URL or the
// request host, so Preview, staging, and www all point Google at inzta.id (requirement 1.3).
export const SITE_ORIGIN = 'https://inzta.id';

// Business identity shown in the footer, /tentang, and the legal pages (Google Ads destination requirements,
// Trello "[WEB] Perbaiki temuan inzta.id sebelum Google Ads"). Address and email confirmed by Angkasa on 2026-11-02;
// hello@inzta.id receives mail (A-035).
export const BUSINESS_NAME = 'PT Inzta Gear Indonesia';
export const BUSINESS_EMAIL = 'hello@inzta.id';
export const BUSINESS_ADDRESS: readonly string[] = [
  'Komp. Interkota Indah, Jl. Ring Road No. 2 Blok A4, RT 10/RW 7',
  'Duri Kosambi, Cengkareng',
  'Jakarta Barat, DKI Jakarta 11750',
];
