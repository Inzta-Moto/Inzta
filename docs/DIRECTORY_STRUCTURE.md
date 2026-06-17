# Inzta Directory Structure

Dokumen ini memetakan hierarki folder dan file (*folder tree*) dalam proyek Inzta beserta deskripsi fungsi masing-masing komponen.

```text
Inzta/
├── app/                       # Routing aplikasi menggunakan Next.js (App Router)
│   ├── admin/                 # Modul Admin Panel (Command Center)
│   │   ├── (panel)/           # Halaman internal admin (Products, Orders, Affiliates, dll)
│   │   ├── (public)/          # Halaman autentikasi/login Admin
│   │   ├── layout.tsx         # Layout khusus backend admin
│   │   └── page.tsx           # Dashboard utama admin
│   ├── affiliate/             # Modul Sistem Afiliasi untuk perujuk (publik & panel)
│   ├── api/                   # Server-Side API Routes (Backend Endpoints)
│   │   ├── admin/             # API yang dilindungi untuk manajerial data
│   │   ├── orders/            # API checkout pemesanan (menghasilkan Order ID)
│   │   ├── products/          # API publik pengambilan data katalog
│   │   └── ... 
│   ├── blog/                  # Modul artikel dan konten edukasi / SEO
│   ├── produk/                # Halaman Katalog (Koleksi lengkap & Slug Detail Produk)
│   ├── globals.css            # Styling Vanilla CSS Murni Utama & Variabel Warna
│   └── layout.tsx & page.tsx  # Root Layout Next.js & Halaman Beranda Publik (Hero, dll)
│
├── components/                # UI Components (Dapat Digunakan Kembali / Reusable)
│   ├── ProductCard.tsx        # Representasi visual produk tunggal (Harga, Gambar, Beli)
│   ├── Header.tsx & Footer.tsx# Navigasi utama situs
│   └── AffiliateTracker.tsx   # Komponen pasif pelacak rujukan `?aff=` di latar belakang
│
├── docs/                      # Dokumentasi Teknis Internal (Untuk AI dan Developer)
│   ├── features/              # Penjelasan arsitektur spesifik setiap fitur
│   ├── flows/                 # Pemetaan alur sistem dan pengguna
│   ├── fix/                   # Catatan perbaikan bug (*bug tracking & solutions*)
│   ├── DIRECTORY_STRUCTURE.md # File yang sedang Anda baca
│   ├── OVERVIEW.md            # Konteks proyek utama (Single Source of Truth)
│   └── PROGRESS.md            # Pelacakan status implementasi proyek (To-Do/Done)
│
├── lib/                       # Modul Utilitas Tambahan dan Konfigurasi Pihak Ketiga
│   ├── auth.ts                # Layanan pembantu autentikasi/sesi
│   ├── firebase.ts            # Inisialisasi Firebase Client-Side (Analytics, Auth)
│   ├── firebaseAdmin.ts       # Inisialisasi Firebase Server-Side (Admin SDK)
│   └── utils.ts               # Koleksi fungsi murni, misal: pembungkus *link WhatsApp*
│
├── public/                    # Aset Statis Publik (Disajikan oleh Next.js langsung)
│   └── logo*.png              # Berbagai varian logo situs
│
├── types/                     # Antarmuka (Interface) TypeScript
│   └── index.ts               # Tipe data utama seperti `Order`, `Product`, `Affiliate`
│
├── middleware.ts              # Lapisan proteksi rute halaman Admin menggunakan token
├── firestore.rules            # Lapisan kontrol keamanan akses database (Security Rules)
└── [Konfigurasi Root]         # package.json, next.config.js, tsconfig.json, dsb.
```

### Panduan Navigasi Tambahan
- **Untuk mengubah warna atau layout dasar:** Periksa `app/globals.css`.
- **Untuk memodifikasi rute API:** Lihat pada folder `app/api/`.
- **Untuk mengedit logika checkout:** Perhatikan file di `app/produk/[slug]/ProdukClient.tsx` atau `components/ProductCard.tsx` yang memanggil `/api/orders`.
- **Untuk tipe data/struktur database:** Lihat selalu di `types/index.ts`.
