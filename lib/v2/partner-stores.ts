// F-027: shops run by others where INZTA bags can be seen offline (/toko, the Beranda teaser, the /tentang channel
// row, and the footer). Pure data, no React, so lib/seo.ts and tests can import it. A second shop is one more entry.

export interface PartnerStore {
  slug: string;
  name: string;
  /** Shop category as on its Google listing, written in the site's sentence case. */
  kind: string;
  addressLines: string[];
  /** Short location for the Beranda teaser. */
  area: string;
  /** Link to the shop's Google Maps listing; opened in a new tab, never embedded. */
  mapsUrl: string;
  hours?: { days: string; time: string }[];
  /** Product slugs on display at the shop; unknown or inactive slugs are skipped. */
  products?: string[];
  photos?: { src: string; alt: string; credit?: string }[];
  /** Prefilled WhatsApp text to the INZTA admin; it names the shop so the admin knows where the visitor came from. */
  waText: string;
}

export const PARTNER_STORES: PartnerStore[] = [
  {
    slug: 'bikerjowo-depok',
    name: 'Bikerjowo Depok',
    kind: 'Toko motorsport',
    addressLines: ['Grand Depok City, Cluster Azalea No.38-40 Blok W1', 'Jatimulya, Kec. Cilodong', 'Kota Depok, Jawa Barat 16413'],
    area: 'Grand Depok City, Cilodong',
    mapsUrl: 'https://maps.google.com/?cid=12517936582616688079',
    // Hours and photos confirmed by INZTA on 2026-11-09 (inzta-hq A-097, A-101); the photos are the shop's own, sent with
    // its permission. Products on display stay empty until confirmed (A-098); empty fields render nothing.
    hours: [
      { days: 'Senin–Sabtu', time: '10.00–19.00' },
      { days: 'Minggu', time: '08.00–16.00' },
    ],
    photos: [
      { src: '/images/v2/toko/bikerjowo-depok/tampak-depan.webp', alt: 'Tampak depan toko Bikerjowo Depok pada siang hari, motor terparkir dekat etalase', credit: 'Foto: Bikerjowo' },
      { src: '/images/v2/toko/bikerjowo-depok/pintu-masuk-malam.webp', alt: 'Pintu masuk toko pada malam hari dengan deretan motor di depannya', credit: 'Foto: Bikerjowo' },
      { src: '/images/v2/toko/bikerjowo-depok/kaca-etalase.webp', alt: 'Kaca etalase toko bertuliskan "Work is just something we do between rides"', credit: 'Foto: Bikerjowo' },
      { src: '/images/v2/toko/bikerjowo-depok/etalase-dalam.webp', alt: 'Etalase di dalam toko berisi helm dan jaket', credit: 'Foto: Bikerjowo' },
    ],
    waText: 'Halo admin INZTA, saya ingin tahu tas apa saja yang bisa dilihat di Bikerjowo Depok.',
  },
];

// Every new F-027 string in one place (inzta-hq docs/specs/F-027-toko-partner/copy.md, final editor text), so edited
// copy is swapped here without touching the components. The page head and the channel labels name the one shop
// listed today and need rewording when a second shop is added. "Official partner" is the term INZTA allowed on
// 2026-11-09 (inzta-hq ADR-0038, A-096); the shop logo is not confirmed yet. hoursLabel, productsLabel, and gallery.regionLabel are not in copy.md yet; they render only once
// hours, products, or photos are filled in, so they need editor text before that data lands.
export const STORE_COPY = {
  meta: {
    title: 'Lihat Tas INZTA di Bikerjowo Depok',
    description:
      'Tas INZTA bisa dilihat langsung di Bikerjowo Depok, toko motorsport di Grand Depok City, Cilodong. Buka lokasinya di Google Maps atau tanya admin INZTA.',
  },
  page: {
    eyebrow: 'Offline',
    title: 'Official partner INZTA di Depok.',
    lead: 'Tas INZTA bisa dilihat langsung di Bikerjowo Depok, Cilodong. Sebelum datang, tanyakan tas yang Anda cari ke admin INZTA.',
  },
  card: {
    addressLabel: 'Alamat',
    mapsButton: 'Buka di Google Maps',
    hoursNote: 'Cek jam buka di Google Maps sebelum berangkat.',
    hoursLabel: 'Jam buka',
    displayNote: 'Tas yang dipajang di toko bisa berbeda dengan katalog.',
    productsLabel: 'Tas yang dipajang',
    waButton: 'Tanya admin via WhatsApp',
    // Same note as the WhatsApp card on /tentang (ContactCard), so it adds no new copy.
    waNote: 'Anda akan diarahkan ke WhatsApp',
  },
  gallery: {
    title: (name: string) => `Dari ${name}.`,
    regionLabel: (name: string) => `Foto ${name}`,
  },
  closing: {
    text: 'Kalau tidak bisa ke Depok, pesan lewat WhatsApp dan tas dikirim.',
    link: 'Lihat semua tas',
  },
  teaser: {
    eyebrow: 'Official partner',
    title: 'Tas INZTA bisa dilihat langsung di Bikerjowo Depok.',
    link: 'Cek lokasi toko',
  },
  contactRow: 'Lihat langsung di Bikerjowo Depok',
  footerLink: 'Lihat langsung: Bikerjowo Depok',
} as const;
