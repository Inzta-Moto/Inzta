import type { Product, TokopediaReview } from '@/types';
import { CROP_TOP_SLUGS } from '@/lib/v2/product-copy';

// F-016 D4, S1.9: eight Tokopedia reviews of INZTA bags, copied from the snapshot
// inzta-hq research/2026-10-29-ulasan-tokopedia-inzta.md (source https://www.tokopedia.com/lentoratoko/review,
// accessed 2026-10-29). Quotes are verbatim; names are the masked Tokopedia form; months are approximate because
// Tokopedia shows relative dates. No rating, count, or aggregate is kept here or shown (S1.9.2, G-C5).

export const TOKOPEDIA_REVIEWS_URL = 'https://www.tokopedia.com/lentoratoko/review';
export const REVIEWS_ACCESSED = '2026-10-29';

// Snapshot order; review 1 is featured. productSlug follows the snapshot mapping; review 6 has no website product.
const SNAPSHOT: readonly TokopediaReview[] = [
  {
    quote: 'Sedang dipakai dari Malang ke Banyuwangi. Mantap, tali-talian kokoh. Angin kencang pantura Jatim sanggup ditahan tali di sekeliling tas.',
    productSlug: 'side-bage-motor-inzta-oke',
    productName: 'Sidebag Foldpack Z10',
    variant: 'sepasang',
    name: 'S***o',
    month: '2026-08',
  },
  {
    quote: 'barang sangat bagus dan berkualitas. sudah sekitar 1 minggu pemakaian. minusnya dia di posisi yg [tertutup] dekat dengan mesin dan mudah untuk terpapar panas. tapi sejauh ini tidak ada masalah atau kerusakan apapun akibat hal tsb.',
    productSlug: 'side-bag-inzta-xsr-155',
    productName: 'Tas samping Yamaha XSR',
    variant: 'kiri',
    name: 'H***f',
    month: '2026-08',
  },
  {
    quote: 'bahan bagus, kapasitas lumayan, pengiriman juga cepat. oke banget.',
    productSlug: 'side-bage-motor-inzta-oke',
    productName: 'Sidebag Foldpack Z10',
    variant: 'sepasang',
    name: 'B***f',
    month: '2026-09',
  },
  {
    quote: 'pnp di motor xsr 155 sesuai pesanan',
    productSlug: 'side-bag-inzta-xsr-155',
    productName: 'Tas samping Yamaha XSR',
    variant: 'kiri',
    name: 'A***n',
    month: '2026-09',
  },
  {
    quote: 'Bagus, tebal, lengkap dengan baut',
    productSlug: 'botol-bag-inzta-nmax',
    productName: 'Tas botol NMAX',
    variant: null,
    name: 'V***b',
    month: '2026-09',
  },
  {
    quote: 'Barang sudah diterima. Yang sebelah kiri sampai lebih dulu, yang sebelah kanan menyusul karena sempat terlambat. ... Tokonya amanah dan bertanggung jawab',
    productSlug: null,
    productName: 'Sidebag XSR Daily Ride',
    variant: 'sepasang',
    name: 'D***n',
    month: '2026-09',
  },
  {
    quote: 'cakep, bahannya sepertinya kuat',
    productSlug: 'acc-toolkit-rollkit',
    productName: 'Rollkit toolkit',
    variant: null,
    name: 'T***o',
    month: '2026-07',
  },
  {
    quote: 'Sesuai n bagus saya lgsg beli 1 lagi',
    productSlug: 'botol-bag-inzta-xmax',
    productName: 'Bottlebag XMAX',
    variant: null,
    name: 'B***g',
    month: '2026-07',
  },
];

// F-016 S1.9.3: "[tertutup]" marks text hidden at the source; it renders as a cut marker.
export function displayQuote(quote: string): string {
  return quote.replace(/\s*\[tertutup\]\s*/g, ' ... ');
}

export const TOKOPEDIA_REVIEWS: readonly TokopediaReview[] = SNAPSHOT.map(r => ({ ...r, quote: displayQuote(r.quote) }));

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

// F-016 S1.9.1: "sekitar Agustus 2026"; the snapshot months are estimates (review VER-16).
export function reviewMonthLabel(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  const i = m ? Number(m[2]) - 1 : -1;
  return m && i >= 0 && i < 12 ? `sekitar ${MONTHS[i]} ${m[1]}` : '';
}

// F-016 S1.9 (E4, design.md §11): "Ulasan di Tokopedia, sekitar <Bulan YYYY>".
export function reviewMetaLine(r: Pick<TokopediaReview, 'month'>): string {
  const when = reviewMonthLabel(r.month);
  return when ? `Ulasan di Tokopedia, ${when}` : 'Ulasan di Tokopedia';
}

// F-016 S1.9.4: featured = first; the wall takes the largest even count of the rest, in snapshot order.
export function splitReviews<T>(list: readonly T[]): { featured: T | null; wall: T[] } {
  if (list.length === 0) return { featured: null, wall: [] };
  const rest = list.slice(1);
  return { featured: list[0], wall: rest.slice(0, rest.length - (rest.length % 2)) };
}

/**
 * F-016 S1.9: chip text and photo at render. Name = the active website product's name, else the snapshot name
 * (unmapped or inactive, e.g. review 6); " · <Varian>" appended when the snapshot gives one (S1.9.6). Photo =
 * images[0] ?? imageUrl of that active product; crop-top for the "FULL WATERPROOF" slugs (S1.9.5).
 */
export function reviewChip(
  r: TokopediaReview,
  products: readonly Pick<Product, 'slug' | 'name' | 'images' | 'imageUrl' | 'isActive'>[],
): { label: string; image: string | null; cropTop: boolean } {
  const p = r.productSlug ? products.find(x => x.slug === r.productSlug && x.isActive !== false) : undefined;
  const name = p?.name ?? r.productName;
  const variant = r.variant ? ` · ${r.variant.charAt(0).toUpperCase()}${r.variant.slice(1)}` : '';
  return {
    label: name + variant,
    image: p ? p.images?.[0] || p.imageUrl || null : null,
    cropTop: Boolean(p && CROP_TOP_SLUGS.includes(p.slug)),
  };
}
