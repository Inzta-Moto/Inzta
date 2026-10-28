// Kept apart from lib/firebase so server components can use lib/utils without bundling the Firebase client SDK.
export const WA_NUMBER: string = process.env.NEXT_PUBLIC_WA_NUMBER || "6283804058329";

// The website's own Cloudinary cloud (components/ImageUpload.tsx). Article images must come from it, so
// content can never hotlink or track through another host.
export const CLOUDINARY_CLOUD = 'dukddlp0b';
export const ALLOWED_IMAGE_PREFIX = `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/`;

// '/admin/artikel/baru' is the new-article page, so an article cannot own that slug.
export const RESERVED_ARTICLE_SLUGS: readonly string[] = ['baru'];
