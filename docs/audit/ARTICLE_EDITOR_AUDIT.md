# Audit: Penulisan & Tampilan Artikel

Tanggal: 2026-10-26 · Cakupan: admin artikel, API artikel, halaman `/blog`, `/blog/[slug]`, `BlogSection` di beranda, sitemap.

Tujuan audit ini: memetakan kondisi saat ini sebagai dasar rencana implementasi **editor artikel** yang mendukung format teks, gambar di posisi mana pun, tautan antar-artikel (backlink), dan sisipan produk INZTA.

---

## 1. Ringkasan

| Area | Kondisi sekarang | Dampak |
|---|---|---|
| Editor | `<textarea>` polos 8 baris di dalam modal | Tidak ada heading, bold, list, link, kutipan. Hasil tampil "mentah". |
| Penyimpanan konten | `content: string` (teks polos, maks 50.000 karakter) | Tidak ada struktur; tidak bisa menyimpan posisi gambar, link, atau blok produk. |
| Gambar | `images: string[]` (maks 5) terpisah dari teks | Gambar selalu tampil sebagai galeri **di atas** konten. Tidak ada caption/alt. |
| Render | `{a.content}` + CSS `white-space: pre-wrap` | Hanya baris baru yang dipertahankan; URL tidak bisa diklik. |
| Backlink / produk | Tidak ada | Tidak ada internal linking, tidak ada konversi dari artikel ke produk. |
| SEO | Halaman detail di-render di klien | Isi artikel tidak ada di HTML awal; beberapa bug metadata & sitemap (lihat §3). |
| Alur publikasi | Simpan = langsung tayang | Tidak ada draft, preview, atau autosave. |

Kesimpulan: masalahnya bukan hanya "belum ada editor". **Model datanya** (`content` string + `images` array terpisah) yang membuat gambar tidak bisa diletakkan di tengah paragraf dan produk/backlink tidak bisa disisipkan. Editor baru harus datang bersama model konten terstruktur dan renderer baru.

---

## 2. Kondisi saat ini (per file)

### 2.1 Admin — `app/admin/(panel)/artikel/page.tsx`
- Form di dalam modal (`maxWidth: 720px`), input tidak terkontrol (`defaultValue` + `FormData`).
- Konten: `<textarea rows={8}>` dengan petunjuk "Pindah baris = paragraf baru" (`:205`).
- Gambar: komponen `ImageUpload` dengan `max={5}` (`:210`), urutan tidak bisa diubah, tanpa alt/caption.
- Klik di luar modal langsung menutup form (`:176`) — **semua tulisan hilang tanpa konfirmasi**.
- Tidak ada preview, draft, autosave, atau penghitung kata.
- Daftar artikel memuat seluruh koleksi lalu dipaginasi di klien.

### 2.2 Validasi — `lib/article-input.ts`
- Field yang diterima: `title`, `slug`, `excerpt`, `content`, `images`. Field lain dibuang (bagus — pola whitelist ini perlu dipertahankan).
- `images` wajib URL `https://res.cloudinary.com/` (bagus — pertahankan untuk gambar di dalam konten).

### 2.3 API — `app/api/articles/route.ts`, `app/api/articles/[slug]/route.ts`
- Doc ID = slug. Edit di tempat via `PUT`; ganti slug = `POST` slug baru + `DELETE` slug lama.
- `createdAt`/`updatedAt` disimpan sebagai **string ISO**.
- `GET /api/articles` mengembalikan seluruh dokumen termasuk `content` penuh.

### 2.4 Halaman detail — `app/blog/[slug]/page.tsx` + `BlogDetailClient.tsx`
- `page.tsx` hanya membuat metadata (via Firestore REST); isi artikel diambil **di browser** lewat Firebase client SDK.
- Gambar: `images[0]` besar + sisanya grid kecil, semuanya **sebelum** konten (`BlogDetailClient.tsx:92-122`).
- Konten: `<div className="blog-detail-content">{a.content}</div>` (`:125-127`), CSS `white-space: pre-wrap` (`globals.css:2658`).
- Artikel tidak ditemukan tetap merespons HTTP 200 (tidak memakai `notFound()`).

Bandingkan dengan `app/produk/[slug]/page.tsx` yang sudah membaca data di server (`getAdminDb`) + JSON-LD — pola itu sebaiknya diikuti blog.

### 2.5 Daftar & beranda — `app/blog/page.tsx`, `components/BlogSection.tsx`
- Keduanya mengambil **seluruh** koleksi `articles` (termasuk `content` penuh) di klien, lalu sort & slice.
- Fallback gambar dan header memakai hotlink Unsplash/YouTube.

### 2.6 Tipe — `types/index.ts:125`
- `Article` tidak punya `images`, `updatedAt`; `createdAt` bertipe `{seconds, nanoseconds}` padahal API menyimpan string. Akibatnya banyak `(a as any)`.

---

## 3. Bug yang ditemukan (bisa diperbaiki sebelum editor)

| # | Lokasi | Masalah | Akibat |
|---|---|---|---|
| B1 | `app/blog/page.tsx:21`, `components/BlogSection.tsx:19` | Sort memakai `createdAt?.seconds`, padahal API menyimpan `createdAt` sebagai string ISO → nilainya selalu `0`. | Urutan artikel di `/blog` dan beranda **tidak berdasarkan tanggal** (mengikuti urutan ID/slug alfabetis). "3 artikel terbaru" di beranda bisa bukan yang terbaru. Admin tidak kena karena punya `getTimestamp` sendiri. |
| B2 | `app/sitemap.ts:52` | Filter `where('isPublished', '==', true)`, field ini tidak pernah ditulis di mana pun. | **Tidak ada satu pun artikel di sitemap.** |
| B3 | `app/blog/[slug]/page.tsx:53` | `content.split('\\n')` memecah pada teks literal `\n`, bukan baris baru; `excerpt` tidak dipakai. | `meta description` & OG berisi **seluruh isi artikel** (bisa puluhan ribu karakter). |
| B4 | `app/blog/[slug]/page.tsx:63` | OG image dikirim tanpa transformasi Cloudinary, tapi dideklarasikan 800×800. | Preview WhatsApp/sosmed bisa gagal/terpotong (produk sudah memakai `c_fill,w_800,h_800,f_jpg`). |
| B5 | `app/admin/(panel)/artikel/page.tsx:86-109` + `app/api/articles/route.ts:29` | Ganti slug = POST baru → `createdAt` di-reset ke sekarang. | Tanggal terbit artikel berubah saat slug diganti. |
| B6 | Alur ganti slug | Slug lama dihapus tanpa redirect. | **Semua backlink (internal & eksternal) ke URL lama menjadi 404.** Ini krusial bila backlink akan diandalkan. |
| B7 | `app/admin/(panel)/artikel/page.tsx:176` | Klik overlay menutup modal tanpa konfirmasi. | Tulisan panjang bisa hilang. |
| B8 | `app/blog/[slug]/BlogDetailClient.tsx` | Isi di-render di klien. | Mesin pencari/crawler sosmed tidak melihat isi artikel di HTML awal; 404 palsu (HTTP 200). |

---

## 4. Kebutuhan editor (dari permintaan)

1. Format teks layaknya situs artikel: heading (H2/H3), bold/italic, list bernomor/berbutir, kutipan, link, garis pemisah.
2. Gambar **di posisi mana pun** di antara paragraf, dengan caption & alt text.
3. **Backlink ke post lain**: link teks biasa ke artikel lain + blok "Baca juga" berbentuk kartu.
4. **Sisipan produk INZTA**: kartu produk (gambar, nama, harga, tombol) yang datanya selalu terbaru (harga/stok/aktif tidak basi).
5. Tambahan yang wajar: embed YouTube, tombol CTA (mis. WhatsApp), callout/tips.

---

## 5. Rekomendasi arsitektur

### 5.1 Format konten: JSON terstruktur (bukan HTML, bukan Markdown)

| Opsi | Kelebihan | Kekurangan | Putusan |
|---|---|---|---|
| Markdown + shortcode | Ringan, mudah di-diff | Admin harus belajar sintaks; embed produk via shortcode rawan salah ketik | ✗ |
| HTML dari WYSIWYG | Mudah ditampilkan | Wajib sanitasi (XSS); data produk tertanam jadi basi; sulit divalidasi | ✗ |
| **JSON dokumen (ProseMirror/Tiptap)** | Tiap blok bertipe & bisa divalidasi; produk disimpan sebagai **referensi slug** lalu di-render dengan data live; render tanpa `dangerouslySetInnerHTML` | Perlu renderer sendiri (±1 file) | ✓ |

### 5.2 Library editor

**Rekomendasi: Tiptap** (headless, berbasis ProseMirror, React, inti MIT).
- Headless → tampilannya bisa mengikuti `DESIGN_SYSTEM.md` yang sudah ada (tidak membawa UI kit lain).
- Custom node mudah: `image` (Cloudinary), `productEmbed`, `articleCard`, `youtube`, `callout`.
- Catatan Next.js: komponen editor harus `'use client'` dan memakai `immediatelyRender: false` agar tidak terjadi hydration mismatch.

Alternatif: **BlockNote** (UI ala Notion di atas Tiptap; paling cepat jadi, tapi tampilannya lebih sulit diselaraskan) atau **Editor.js** (blok JSON sederhana, tapi inline formatting & ekosistemnya lebih terbatas).

> Proyek saat ini memakai Next `^14.2` dan React 18 (lihat `package.json`). Pastikan versi Tiptap yang dipilih kompatibel saat instalasi, dan baca panduan di `node_modules/next/dist/docs/` sesuai `AGENTS.md`.

### 5.3 Model data baru `articles/{slug}`

```ts
interface Article {
  title: string;
  slug: string;
  excerpt: string;

  contentFormat: 'doc-v1' | 'plain';   // 'plain' = artikel lama
  contentDoc?: JSONContent;             // dokumen Tiptap/ProseMirror
  content: string;                      // teks polos turunan: share WA, pencarian, fallback artikel lama

  coverImage: { url: string; alt: string } | null;   // pengganti images[0]
  images?: string[];                    // legacy, hanya dibaca

  status: 'draft' | 'published';
  publishedAt: string | null;           // ISO; dipakai untuk urutan & sitemap
  createdAt: string;                    // ISO
  updatedAt: string;                    // ISO

  author?: string;
  category?: string;
  tags?: string[];
  seo?: { metaTitle?: string; metaDescription?: string; ogImage?: string };

  // Diturunkan server dari contentDoc saat simpan (untuk query & "artikel terkait")
  productSlugs: string[];
  linkedArticleSlugs: string[];
  readingMinutes: number;
}
```

Ukuran: batas dokumen Firestore 1 MiB, cukup untuk artikel panjang karena gambar tetap disimpan sebagai URL Cloudinary.

Koleksi tambahan **`articleRedirects/{oldSlug}` → `{ to: newSlug }`** — ditulis otomatis saat slug diganti; halaman detail melakukan `permanentRedirect()` bila slug lama diakses. Ini menjaga backlink (B6).

### 5.4 Node yang diizinkan (whitelist)

| Node | Atribut tersimpan | Validasi server |
|---|---|---|
| `paragraph`, `heading` (level 2–3), `bulletList`, `orderedList`, `listItem`, `blockquote`, `horizontalRule`, `hardBreak` | — | level hanya 2/3 (H1 = judul) |
| mark `bold`, `italic`, `link` | `href` | `href` hanya `https:`, `http:`, `mailto:`, `wa.me`, atau path relatif `/…`; tolak `javascript:` |
| `image` | `src`, `alt`, `caption` | `src` wajib prefiks `https://res.cloudinary.com/` (aturan yang sudah ada) |
| `productEmbed` | `slug`, `variant?: 'card' \| 'inline'` | `SLUG_PATTERN`; opsional cek produk ada |
| `articleCard` | `slug` | `SLUG_PATTERN`; tidak boleh menunjuk dirinya sendiri |
| `youtube` | `videoId` | regex ID YouTube, bukan URL bebas |
| `callout` | `tone: 'info' \| 'tip' \| 'warning'` | enum |

Validator (`lib/article-input.ts`) menelusuri pohon JSON, menolak node/atribut di luar whitelist, lalu menurunkan `content` (teks polos), `productSlugs`, `linkedArticleSlugs`, dan `readingMinutes`.

### 5.5 Rendering publik

- Ubah `app/blog/[slug]/page.tsx` menjadi **Server Component** yang membaca via `getAdminDb()` (pola sama dengan `app/produk/[slug]/page.tsx`), pakai `cache()` agar metadata & halaman berbagi satu query. Panggil `notFound()` bila tidak ada / masih draft.
- `ArticleRenderer` (server) memetakan tiap node → elemen React. Tanpa `dangerouslySetInnerHTML`.
- `productEmbed`: kumpulkan semua `productSlugs`, ambil sekaligus dengan `getAll()`, render kartu dengan harga/stok **terkini**; produk nonaktif/terhapus disembunyikan (atau tampil "Stok habis"). Reuse gaya `ProductCard`.
- `articleCard` & link internal `/blog/...`: pakai `next/link`; data judul/cover diambil batch.
- `image`: `<figure>` + `<figcaption>`, `optimizeCloudinaryUrl` + `srcSet` yang sudah ada, `loading="lazy"` kecuali gambar pertama.
- Artikel lama (`contentFormat: 'plain'`): pecah per baris kosong → `<p>`, lalu galeri lama tetap di atas. Tidak perlu migrasi massal di hari pertama.
- Tambah gaya tipografi `.article-body` (h2, h3, ul, ol, blockquote, figure, a, hr) di `globals.css`, hapus `white-space: pre-wrap`.
- Bagian bawah artikel: "Produk di artikel ini" (dari `productSlugs`) dan "Artikel terkait" (dari kategori/tag/`linkedArticleSlugs`).
- Tombol share & WA hanya bagian kecil yang tetap client component.

---

## 6. UX admin yang disarankan

- Pindah dari modal ke halaman penuh: `/admin/artikel/baru` dan `/admin/artikel/[slug]/edit`. Panel kanan: slug, excerpt, cover, kategori/tag, SEO, status.
- Toolbar + slash menu (`/`) untuk menyisipkan: Gambar, Produk, Artikel, YouTube, Callout.
- **Gambar**: upload / drag-drop / paste langsung ke posisi kursor. Ekstrak logika upload di `components/ImageUpload.tsx` menjadi fungsi `uploadToCloudinary(file)` agar dipakai editor & form produk. Minta alt text saat upload.
- **Picker produk**: modal pencarian dari `/api/products`, menampilkan gambar + harga; hasil disisipkan sebagai node `productEmbed` (bukan salinan data).
- **Picker artikel**: pencarian judul; bisa jadi link teks atau kartu "Baca juga".
- Status **Draft / Terbit**, tombol **Preview** (render dengan `ArticleRenderer` yang sama), autosave draft ke `localStorage` + peringatan `beforeunload` (menutup B7).
- Ganti slug pada artikel yang sudah terbit → peringatan + redirect otomatis.

---

## 7. Catatan keamanan & performa

- **Upload Cloudinary unsigned**: cloud name & preset `inztaa` tertulis di kode klien (`components/ImageUpload.tsx:43,59`). Siapa pun bisa mengunggah ke akun tersebut. Karena editor akan menambah volume upload, pertimbangkan signed upload lewat route admin (`/api/admin/upload-signature`) atau minimal batasi preset (folder, format, ukuran) di dashboard Cloudinary.
- **Payload daftar artikel**: `/blog` dan beranda mengunduh `content` semua artikel. Setelah pindah ke server component, query hanya field kartu (`select('title','slug','excerpt','coverImage','publishedAt')`), filter `status == 'published'`, `orderBy('publishedAt','desc')`, `limit()` (butuh composite index).
- Firestore rules `articles` `allow read: if true` membuat draft terbaca publik lewat client SDK. Setelah semua pembacaan publik pindah ke server, ubah rule menjadi `allow read: if resource.data.status == 'published'` (atau tutup baca klien sepenuhnya).

---

## 8. Rencana bertahap

| Fase | Isi | Hasil |
|---|---|---|
| **0 — Perbaikan cepat** | B1 (sort pakai `formatDate`-style parser / `publishedAt`), B2 (sitemap tanpa `isPublished` atau isi field-nya), B3–B4 (meta pakai `excerpt`, OG Cloudinary 1200×630), B5 (pertahankan `createdAt` saat rename), sinkronkan tipe `Article`. | Urutan, SEO, dan sitemap benar tanpa menunggu editor. |
| **1 — Fondasi konten** | Model data §5.3, validator JSON §5.4, `ArticleRenderer` server-side, halaman detail jadi Server Component + `notFound()` + JSON-LD `BlogPosting`, tipografi `.article-body`, dukungan legacy `plain`. | Halaman publik siap menampilkan konten terstruktur. |
| **2 — Editor inti** | Halaman editor penuh, Tiptap dengan format dasar, link, gambar inline + caption/alt, `uploadToCloudinary`, draft/terbit, preview, autosave. | Gambar bisa di paragraf mana pun. |
| **3 — Blok khusus** | `productEmbed` (data live), `articleCard` + picker, YouTube, callout, CTA WhatsApp. Turunan `productSlugs`/`linkedArticleSlugs`. | Backlink & produk INZTA di dalam artikel. |
| **4 — SEO & distribusi** | `articleRedirects` saat rename, sitemap dengan `lastModified = updatedAt`, artikel terkait, daftar isi dari H2, kategori/tag, query daftar yang ringan, rules Firestore untuk draft, signed upload. | Backlink aman, performa & SEO matang. |

### Pengujian
- Ikuti pola `tests/f000-auth.cjs` (route handler nyata + Firestore in-memory): uji validator menolak node/atribut liar, `javascript:` link, gambar non-Cloudinary, slug produk tidak valid; uji rename menulis redirect dan mempertahankan `createdAt`.
- Uji render: artikel `plain` lama tetap tampil sama; produk nonaktif tidak tampil di embed; slug lama mengarah 308 ke slug baru.

---

## 9. File yang akan tersentuh

| File | Perubahan |
|---|---|
| `types/index.ts` | Tipe `Article` baru |
| `lib/article-input.ts` | Validator dokumen JSON + turunan field |
| `app/api/articles/route.ts`, `app/api/articles/[slug]/route.ts` | Field baru, status, rename + redirect |
| `app/admin/(panel)/artikel/page.tsx` | Daftar saja; form pindah ke halaman editor |
| `app/admin/(panel)/artikel/baru/page.tsx`, `.../[slug]/edit/page.tsx` | **Baru** — halaman editor |
| `components/article/ArticleEditor.tsx` + node kustom | **Baru** — Tiptap |
| `components/article/ArticleRenderer.tsx` | **Baru** — render server |
| `components/ImageUpload.tsx` | Ekstrak `uploadToCloudinary` |
| `app/blog/[slug]/page.tsx`, `BlogDetailClient.tsx` | Server Component; client tinggal tombol share |
| `app/blog/page.tsx`, `components/BlogSection.tsx` | Query server, sort `publishedAt`, hanya `published` |
| `app/sitemap.ts` | Filter `status`, `lastModified` |
| `app/globals.css` | Tipografi `.article-body`, kartu embed |
| `firestore.rules` | Draft tidak terbaca publik |
