import { HIRES, PHOTOS, GASBER_CREDIT, GASBER_SLUG, INSTAGRAM } from '@/lib/v2/home-content';

// Static content of /tentang (F-016 S8). Copy is verbatim from tentang.dc.html (inzta-web-design @ 3281681); the
// corrected alts are new strings of design.md §11, because the canvas alts do not describe the photos.

export { GASBER_SLUG, INSTAGRAM };

// S8.3.4: the values (S8.3) and the community lead line (S8.4) wait for Bang Raja's G2 approval (P-8). Set to false
// only if a Production deploy is needed before G2; the rest of the page stays unchanged.
export const SHOW_VALUES_COPY = true;

// S8.1.3: set to false if INZTA does not confirm 2023 (P-10); the eyebrow then reads "Tentang INZTA".
export const SHOW_SINCE_2023 = true;

// road-01 has only about 600 px of real detail and looked soft at 1920 px (Sehan, 2026-10-30); hero-99 is 3200 px.
// Its framing is set by .iz-hero__img--about (v2-about.css).
export const HERO_PHOTO = {
  src: HIRES.hero99,
  alt: 'Rider berjaket INZTAMOTO duduk di atas Yamaha XSR dengan tas kuning INZTA di jalan tanah berdebu berlatar bukit hijau',
};

export interface ProcessStep {
  title: string;
  text: string;
  image: string;
  crop: 'iz-crop-half' | null;
  // A landscape file covers the 4:5 box about 1.9 times its width, so ProcessSteps asks for a wider variant.
  landscape: boolean;
  // S8.2.5: source and license of each photo.
  source: string;
}

// S8.2: alts are empty because the h3 and the sentence carry the information (S8.2.4). The Cek photo is a stand-in
// until INZTA sends a real quality-check photo (P-3): two hands pulling the rain cover over an INZTA side bag on a
// bike, so the step shows hands-on checking rather than a product close-up. It is cropped above the third-party
// exhaust text, so it needs no crop class (S8.2.3, G-C4).
export const PROCESS_STEPS: readonly ProcessStep[] = [
  { title: 'Desain', text: 'Pola tas dirancang tim INZTA.', image: '/images/v2/contoh/desain-pola-unsplash-oTvBFTB0wow.webp', crop: null, landscape: false, source: 'Erwin Bosman, https://unsplash.com/photos/oTvBFTB0wow, Unsplash License (CONTENT.md)' },
  { title: 'Potong', text: 'Bahan dipotong sesuai pola.', image: '/images/v2/contoh/potong-kain-unsplash-SgLpZDf4P_c.webp', crop: null, landscape: true, source: 'atelierbyvineeth, https://unsplash.com/photos/SgLpZDf4P_c, Unsplash License (CONTENT.md)' },
  { title: 'Jahit', text: 'Dijahit oleh tim produksi INZTA.', image: '/images/v2/contoh/workshop-unsplash-5zg-ZDesJAk.webp', crop: null, landscape: false, source: 'alex jhonson, https://unsplash.com/photos/5zg-ZDesJAk, Unsplash License, checked 2026-10-27 (CONTENT.md)' },
  { title: 'Cek', text: 'Pesanan dikonfirmasi admin INZTA di WhatsApp.', image: '/images/v2/foto/proses-cek.webp', crop: null, landscape: false, source: 'INZTA product photo (photo catalog row 105, Sidebag Florez 15 lifestyle, rain cover being fitted)' },
  { title: 'Kirim', text: 'Dikemas dan dikirim dari gudang INZTA.', image: '/images/v2/contoh/kirim-paket-unsplash-MGaFENpDCsw.webp', crop: null, landscape: true, source: 'Bench Accounting, https://unsplash.com/photos/MGaFENpDCsw, Unsplash License (CONTENT.md)' },
];

// Tourmax (sharp, shown below its size) instead of Cangar (1280 px, enlarged about 1.5 times in this box); the empty
// asphalt at the bottom leaves room for the H2. Framing: .iz-why__img--values (v2-about.css).
export const VALUES_PHOTO = {
  src: HIRES.tourmax,
  alt: 'Dua skuter Yamaha XMAX dengan tail bag INZTA Tourmax 30 di jok belakang, terparkir di tepi jalan saat sore',
};

// S8.4.1: every fact from K-06 (content/articles/K-06-gasber-16-indonesia-ride-adventure.md).
export const EVENT_FACTS: readonly [string, string][] = [
  ['Acara', 'Gasber 16 Indonesia Ride Adventure'],
  ['Tanggal', '24 Oktober 2026'],
  ['Jalur', 'Jalur tanah Banten dan Bogor'],
  ['Peserta', 'Matic, trail, dan bigbike'],
  ['Peran INZTA', 'Sponsor lewat produk dan doorprize'],
];

export const COMMUNITY_PHOTOS = {
  // S8.4.2: the plate-blurred K-06 image, with the organiser credit.
  gasber: {
    src: HIRES.gasber4,
    alt: 'Skuter matic besar kuning-hitam melintas jalan setapak tanah merah di antara semak, diikuti motor adventure merah, pada Gasber 16 Indonesia Ride Adventure',
    credit: GASBER_CREDIT,
  },
  // S8.4.3: INZTA's own road photos, without credit or "Foto contoh". The second one is the K-02 XSR 155 because
  // hero-99 is now the hero of this page (one photo per page).
  road02: { src: PHOTOS.road02, alt: 'Dua rider berboncengan di motor retro dengan side bag dan tas belakang di hamparan pasir' },
  xsr155: {
    src: '/images/v2/foto/xsr155-sawah.webp',
    alt: 'Yamaha XSR 155 hitam dengan Scrambag INZTA di bawah tangki dan tas di jok, berlatar sawah dan bukit kapur',
  },
};

// S8.6: shops without a known URL stay text (P-7).
export const TOKOPEDIA_URL = 'https://www.tokopedia.com/lentoratoko';
