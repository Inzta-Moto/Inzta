import type { CategoryItem, FilmPhoto, MotorCategory, PositionItem, ReviewItem, ProductPosition } from '@/types';

export type { CategoryItem, FilmPhoto, PositionItem, ReviewItem };

// Static Beranda content that is not in Firestore (F-016). Copy is from inzta-web-design @ 3281681
// (claude-design/canvas/project/Main.dc.html); placeholders stay visible until INZTA sends the data
// (placeholder register P-* in inzta-hq docs/specs/F-016-website-v2/requirements.md §5).

export const TOURMAX_SLUG = 'tail-bag-inzta-tourmax-30';
export const GASBER_SLUG = 'gasber-16-indonesia-ride-adventure';

const CLD = 'https://res.cloudinary.com/dukddlp0b/image/upload';

// Cloudinary photos already used by the current site (hero carousel, gallery) and by K-06.
export const PHOTOS = {
  road02: `${CLD}/v1780324953/02_dctvpe.jpg`,
  road03: `${CLD}/v1780333698/03_iwohfu.jpg`,
  road04: `${CLD}/v1780325195/04_avqwtg.jpg`,
  gasber1: `${CLD}/v1793176536/ysnx5dscgd87b46l9936.png`,
  gasber2: `${CLD}/v1792996227/gasber-16-foto-2_wfa6nv.png`,
  gasber4: `${CLD}/v1792996253/gasber-16-foto-4_ag7ggp.png`,
  // Tourmax 30 on two big scooters, 1440 x 1920.
  tourmax: `${CLD}/v1780979155/enfur6qamy877ftcltaz.jpg`,
} as const;

// Large photos as local WebP made from the biggest originals (inzta-web-design/assets/photos, Cloudinary, K-06).
// Enlarged copies looked soft (Sehan, 2026-10-30: "buriq"), so files are kept at their source size or smaller and
// next/image picks the width; every visible plate is blurred in the file. Tiles from Cloudinary keep the URLs above.
export const HIRES = {
  // Cloudinary 99_u0fbp7 (3200 x 2400, the only large sharp source), plate blurred. One per page: Beranda hero,
  // Tentang hero and Retro hero.
  hero99: '/images/v2/foto/hero-99.webp',
  // road-09 from INZTA's current site: a dual-sport bike with INZTA bags on a sea cliff (Sehan, 2026-10-30: it is a
  // trail bike, so it moved from the Adventure tile to Trail).
  heroTrail: '/images/v2/foto/hero-trail.webp',
  // Its true detail is only about 600 px wide; kept for the Adventure hero because road-09 is the Adventure tile,
  // which MoreCard shows on the same page.
  road01: '/images/v2/foto/road-01.webp',
  // Design repo road-04 at its own 1200 x 1600, plate blurred (Matic hero and filmstrip).
  road04: '/images/v2/foto/road-04.webp',
  // K-06 photo (1618 px, plates already blurred) cropped 13:9 above the sponsor-logo strip.
  gasber1: '/images/v2/foto/gasber-1.webp',
  // Design repo gasber-4 (1200 x 802) cropped 16:9 above the sponsor-logo strip, not enlarged.
  gasber4: '/images/v2/foto/gasber-4.webp',
  // 1440 x 1920, plate blurred.
  tourmax: '/images/v2/foto/tourmax-30-motor.webp',
  // Photo catalog row 159 at its own 1200 px (not enlarged), plate blurred; the "Mengapa" panel. The
  // original high-resolution file is requested from INZTA's social media team through RND.
  foldpackZ10: '/images/v2/foto/touring-foldpack-z10.webp',
} as const;

export const GASBER_CREDIT = 'Dok. Gasber 16 / Indonesia Ride Adventure';

// INZTA photos, each a bike of that category with an INZTA bag fitted: photo catalog rows 136 and 206 cropped square,
// Adventure from road-01 (the tall-screen adventure bike with yellow side bags) and Trail from road-09 (a dual-sport
// bike on a sea cliff), both cropped 4:3 so the whole bike reads even as a 40 px menu thumb; their centred squares
// still hold the bike, so the square slots (Garasi, menus, MoreCard, OtherCategories, CategoryPanel) cover them
// without an object-position.
export const MOTOR_CATEGORIES: readonly CategoryItem[] = [
  { value: 'matic', label: 'Matic', image: '/images/v2/foto/kategori-matic.webp', alt: 'Rider berjaket INZTAMOTO berdiri di samping Yamaha XMAX dengan tail bag Tourmax 30 di jok belakang' },
  { value: 'adventure', label: 'Adventure', image: '/images/v2/foto/kategori-adventure.webp', alt: 'Rider di atas motor adventure berkaca depan tinggi dengan side bag kuning INZTA di jalan berkelok' },
  { value: 'retro', label: 'Retro', image: '/images/v2/foto/kategori-retro.webp', alt: 'Sidebag RD Depan Daily Ride terpasang di bawah tangki motor retro Yamaha hitam' },
  { value: 'trail', label: 'Trail', image: '/images/v2/foto/kategori-trail.webp', alt: 'Motor trail merah-hitam dengan side bag, tank bag, dan tas crashbar INZTA, terparkir di tebing di tepi laut' },
];

// Photo in the "Kirim foto motor Anda" card of the category page (GridFill), styled like a buyer's phone photo. It is
// a different photo from the category tile because MoreCard shows the tiles on the same page. Trail has no second
// usable photo yet, so its frame stays a placeholder (rows 107, 169, 200).
export const CHAT_PHOTOS: Record<MotorCategory, string | null> = {
  matic: '/images/v2/foto/chat-matic.webp',
  adventure: '/images/v2/foto/chat-adventure.webp',
  retro: '/images/v2/foto/chat-retro.webp',
  trail: null,
};

// The visitor's photo in the Closing chat: a Yamaha XSR 155 with the Sidebag RD Depan Daily Ride (photo catalog row
// 129). Exported so the static photo test covers it.
export const CLOSING_CHAT_PHOTO = '/images/v2/foto/chat-xsr-155.webp';

export function categoryLabel(value: MotorCategory): string {
  return MOTOR_CATEGORIES.find(c => c.value === value)?.label ?? value;
}

// Local tiles are INZTA photos cropped 4:5 (576 x 720 or smaller, never enlarged): photo catalog rows 149 and 67, the
// K-01 Foldbag 7 photo for Samping, and the bottle bag on a scooter for Aksesori, chosen so each reads at the 40 px
// menu size.
export const POSITION_ITEMS: readonly PositionItem[] = [
  { value: 'tank', menuLabel: 'Tank bag', tileTitle: 'Tangki', tileText: 'Ponsel, dompet, dan air minum tetap terjangkau.', image: '/images/v2/foto/posisi-tangki.webp', alt: 'Tankbag TK5 terpasang di atas tangki motor' },
  { value: 'side', menuLabel: 'Side bag', tileTitle: 'Samping', tileText: 'Muatan besar dibagi dua sisi.', image: '/images/v2/foto/posisi-samping.webp', alt: 'Sidebag Foldbag 7 terpasang di sisi belakang motor TVS Ronin' },
  { value: 'tail', menuLabel: 'Tail bag', tileTitle: 'Belakang', tileText: 'Untuk bawaan perjalanan beberapa hari.', image: '/images/v2/foto/posisi-belakang.webp', alt: 'Tailbag Boba terpasang di jok belakang motor sport dengan tetesan air di permukaannya' },
  { value: 'aksesori', menuLabel: 'Aksesori touring', tileTitle: 'Aksesori', tileText: 'Perkakas, P3K, dan botol di perjalanan.', image: '/images/v2/foto/posisi-aksesori.webp', alt: 'Bottle bag INZTAWORKS berisi botol minum terpasang di panel kaki skuter matic' },
];

// F-016 S0.9 chip labels, keyed like the catalog filter (S2.2).
export const POSITION_CHIP: Record<ProductPosition, string> = {
  tank: 'Tank bag',
  side: 'Side bag',
  tail: 'Tail bag',
  extend: 'Extend bag',
  aksesori: 'Aksesori',
  harian: 'Tas harian',
};

export const TOURMAX_NOTES: readonly string[] = [
  'Cordura D600 di lapisan luar',
  'Kantong dalam dengan resleting',
  'Tiga kantong tambahan',
];
// Size note kept without a unit: cm is unconfirmed (P-11).
export const TOURMAX_SIZE = { from: '37 x 28 x 23', to: '37 x 28 x 28' };

// Alt texts describe what each photo shows (S0.12.6). Photos 2 and 3 use the corrected alts of S1.7.3 (design.md §11);
// photos 4 and 5 keep descriptive alts because the canvas alts ("Motor di kebun teh", "Debu jalur tanah") do not match
// road-04 (a scooter at a beach at sunset) or gasber-1 (riders on a dirt track). Every Gasber photo carries the
// organiser's credit and INZTA's own photos carry none (S1.7.2).
export const FILMSTRIP: readonly FilmPhoto[] = [
  { src: HIRES.gasber4, alt: 'Skuter matic besar kuning-hitam melintas jalan setapak tanah merah di antara semak, diikuti motor adventure merah, pada Gasber 16 Indonesia Ride Adventure', shape: 'wide', credit: GASBER_CREDIT },
  { src: PHOTOS.road02, alt: 'Dua rider di atas motor di jalur pasir', shape: 'tall', credit: null },
  { src: PHOTOS.road03, alt: 'Motor di depan tulisan Cangar', shape: 'wide', credit: null },
  { src: HIRES.road04, alt: 'Motor di tepi pantai saat matahari terbenam', shape: 'tall', credit: null },
  { src: HIRES.gasber1, alt: 'Rider adventure memimpin rombongan di jalur tanah Gasber 16', shape: 'wide', credit: GASBER_CREDIT },
];

// F-016 C-8: the Tokopedia reviews (lib/v2/reviews.ts, D4) render on the branch and on Preview, but not in Production
// until buyer permission or Bang Raja's written approval is recorded (design.md §15 condition 3). Set to true only
// with that record; check:f016-release lists the section while it is false.
export const REVIEWS_PERMISSION_RECORDED = false;

// Unknown until Sehan gives the URLs (Q-4): rendered as text, not as links (13.5, 16.4).
export const SHOPEE_REVIEWS_URL: string | null = null;
export const SHOP_LINKS: readonly { label: string; href: string | null }[] = [
  // Shop URL from docs/steering/business.md (inzta-hq): Shopee "Inztamoto", shopee.co.id/inztamoto.
  { label: 'Shopee: Inztamoto', href: 'https://shopee.co.id/inztamoto' },
  { label: 'Tokopedia: Inzta moto Ride', href: 'https://www.tokopedia.com/lentoratoko' },
];

export const INSTAGRAM = { handle: '@inztamoto_bag', href: 'https://instagram.com/inztamoto_bag' };
