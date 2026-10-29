import type { BagPosition, CategoryItem, FilmPhoto, MotorCategory, PositionItem, ReviewItem } from '@/types';

export type { CategoryItem, FilmPhoto, PositionItem, ReviewItem };

// Static Beranda content that is not in Firestore (F-016). Copy is from inzta-web-design @ 3281681
// (claude-design/canvas/project/Main.dc.html); placeholders stay visible until INZTA sends the data
// (inventory in inzta-hq docs/specs/F-016-landing-page-v2/design.md section 10).

export const TOURMAX_SLUG = 'tail-bag-inzta-tourmax-30';
export const GASBER_SLUG = 'gasber-16-indonesia-ride-adventure';

const CLD = 'https://res.cloudinary.com/dukddlp0b/image/upload';

// Cloudinary photos already used by the current site (hero carousel, gallery) and by K-06.
export const PHOTOS = {
  hero: `${CLD}/v1780326022/99_u0fbp7.jpg`,
  road01: `${CLD}/v1780324954/01_rmqx6d.jpg`,
  road02: `${CLD}/v1780324953/02_dctvpe.jpg`,
  road03: `${CLD}/v1780333698/03_iwohfu.jpg`,
  road04: `${CLD}/v1780325195/04_avqwtg.jpg`,
  gasber1: `${CLD}/v1793176536/ysnx5dscgd87b46l9936.png`,
  gasber2: `${CLD}/v1792996227/gasber-16-foto-2_wfa6nv.png`,
  gasber4: `${CLD}/v1792996253/gasber-16-foto-4_ag7ggp.png`,
} as const;

export const GASBER_CREDIT = 'Dok. Gasber 16 / Indonesia Ride Adventure';

// Example photos (Stitch and Unsplash), always tagged "Foto contoh" where the design tags them (P-1).
export const MOTOR_CATEGORIES: readonly CategoryItem[] = [
  { value: 'matic', label: 'Matic', image: '/images/v2/contoh/contoh-motor-nmax.jpg', alt: 'Motor matic' },
  { value: 'adventure', label: 'Adventure', image: '/images/v2/contoh/contoh-rider-gunung.jpg', alt: 'Motor adventure di jalan pegunungan' },
  { value: 'retro', label: 'Retro', image: '/images/v2/contoh/contoh-motor-xsr-155.jpg', alt: 'Motor retro di jalan perkebunan teh' },
  { value: 'trail', label: 'Trail', image: '/images/v2/contoh/contoh-rider-hutan.jpg', alt: 'Motor trail di jalur hutan' },
];

export function categoryLabel(value: MotorCategory): string {
  return MOTOR_CATEGORIES.find(c => c.value === value)?.label ?? value;
}

export const POSITION_ITEMS: readonly PositionItem[] = [
  { value: 'tank', menuLabel: 'Tank bag', tileTitle: 'Tangki', tileText: 'Ponsel, dompet, dan air minum tetap terjangkau.', image: '/images/v2/tk-highway-3.jpg', alt: 'Tank bag di tangki motor' },
  { value: 'side', menuLabel: 'Side bag', tileTitle: 'Samping', tileText: 'Muatan besar dibagi dua sisi.', image: PHOTOS.road01, alt: 'Side bag di motor touring' },
  { value: 'tail', menuLabel: 'Tail bag', tileTitle: 'Belakang', tileText: 'Untuk bawaan perjalanan beberapa hari.', image: '/images/v2/tail-bag-inzta-tourmax-30-2.jpg', alt: 'Tail bag di jok belakang' },
  { value: 'aksesori', menuLabel: 'Aksesori touring', tileTitle: 'Aksesori', tileText: 'Perkakas, P3K, dan botol di perjalanan.', image: '/images/v2/acc-toolkit-rollkit.jpg', alt: 'Aksesori touring' },
];

export const POSITION_CHIP: Record<BagPosition, string> = {
  tank: 'Tank bag',
  side: 'Side bag',
  tail: 'Tail bag',
  aksesori: 'Aksesori',
};

export const TOURMAX_NOTES: readonly string[] = [
  'Cordura D600 di lapisan luar',
  'Kantong dalam dengan resleting',
  'Tiga kantong tambahan',
];
// Size note kept without a unit: cm is unconfirmed (P-11).
export const TOURMAX_SIZE = { from: '37 x 28 x 23', to: '37 x 28 x 28' };

// Alt texts describe what each photo shows; the design's alts did not match the photos (D-11).
// Every Gasber photo carries the organiser's credit (D-3).
export const FILMSTRIP: readonly FilmPhoto[] = [
  { src: PHOTOS.gasber4, alt: 'Peserta Gasber 16 di jalur tanah', shape: 'wide', credit: GASBER_CREDIT },
  { src: PHOTOS.road02, alt: 'Dua rider touring berpose di samping motor di padang pasir', shape: 'tall', credit: null },
  { src: PHOTOS.road03, alt: 'Motor touring diparkir di depan tugu Cangar', shape: 'wide', credit: null },
  { src: PHOTOS.road04, alt: 'Motor di tepi pantai saat matahari terbenam', shape: 'tall', credit: null },
  { src: PHOTOS.gasber1, alt: 'Rider adventure memimpin rombongan di jalur tanah Gasber 16', shape: 'wide', credit: GASBER_CREDIT },
];

// Articles have no category field (12.3).
export const ARTICLE_CHIP_BY_SLUG: Record<string, string> = {
  [GASBER_SLUG]: 'Komunitas',
  'tas-samping-motor-xsr-155': 'Per motor',
  'panduan-memilih-tas-motor': 'Memilih tas',
};

// PLACEHOLDER until Sehan or Angkasa picks real Shopee reviews with the buyer's permission (13.2, C-8).
export const REVIEW_FEATURED: ReviewItem = {
  quote: 'PLACEHOLDER: satu ulasan terbaik, misalnya pembeli yang menyebut motornya dan cerita pemakaian saat touring atau hujan.',
  productSlug: TOURMAX_SLUG,
  productName: 'Tail bag Inzta Tourmax 30',
  name: 'Nama tersamar',
  month: 'Bulan: PLACEHOLDER',
};
export const REVIEW_FEATURED_PHOTO = { src: '/images/v2/tail-bag-inzta-tourmax-30-2.jpg', alt: 'Tail bag Inzta Tourmax 30 terpasang di motor' };

export const REVIEWS: readonly ReviewItem[] = [
  { quote: 'PLACEHOLDER: ulasan yang menyebut motor pembeli, misalnya pas atau tidaknya di jok belakang.', productSlug: 'side-bag-inzta-xsr-155', productName: 'Side bag Inzta XSR 155', name: 'Nama tersamar', month: 'Bulan: PLACEHOLDER' },
  { quote: 'PLACEHOLDER: ulasan pendek dari Shopee.', productSlug: 'tankbag-tk-5', productName: 'Tankbag TK 5', name: 'Nama tersamar', month: 'Bulan: PLACEHOLDER' },
  { quote: 'PLACEHOLDER: ulasan yang lebih panjang, misalnya pembeli yang memakai tas untuk harian dan perjalanan beberapa hari, ditulis persis seperti di Shopee.', productSlug: 'side-bage-motor-inzta-oke', productName: 'Side Bag Motor Inzta Foldpack Z10 Vol 10L', name: 'Nama tersamar', month: 'Bulan: PLACEHOLDER' },
  { quote: 'PLACEHOLDER: ulasan tentang pemasangan.', productSlug: 'botol-bag-inzta-xmax', productName: 'Botol bag Inzta Xmax', name: 'Nama tersamar', month: 'Bulan: PLACEHOLDER' },
  { quote: 'PLACEHOLDER: ulasan tentang balasan admin di WhatsApp atau chat Shopee.', productSlug: 'acc-medikit-ride', productName: 'Acc Medikit Ride', name: 'Nama tersamar', month: 'Bulan: PLACEHOLDER' },
  { quote: 'PLACEHOLDER: ulasan tentang bahan atau jahitan setelah dipakai beberapa kali perjalanan.', productSlug: 'sidebag-inzta-adventure-20l-tas-touring-motor', productName: 'Sidebag inzta Adventure 20L', name: 'Nama tersamar', month: 'Bulan: PLACEHOLDER' },
];

// True while REVIEWS are placeholders; outside the polish branch the section must not render (13.2).
export const REVIEWS_ARE_PLACEHOLDERS = true;

// Unknown until Sehan gives the URLs (Q-4): rendered as text, not as links (13.5, 16.4).
export const SHOPEE_REVIEWS_URL: string | null = null;
export const SHOP_LINKS: readonly { label: string; href: string | null }[] = [
  { label: 'Shopee: Inztamoto', href: null },
  { label: 'Tokopedia: Inzta moto Ride', href: 'https://www.tokopedia.com/lentoratoko' },
];

export const INSTAGRAM = { handle: '@inztamoto_bag', href: 'https://instagram.com/inztamoto_bag' };
