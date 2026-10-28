'use client';

import { FormEvent, RefObject, useId, useMemo, useState } from 'react';
import Dialog from './Dialog';
import type { EmbedMdKind } from './editor-extensions';
import { statusOf } from '@/lib/article-format';
import { formatDate, formatPrice, optimizeCloudinaryUrl } from '@/lib/utils';

// F-013 phase C3 (requirement 21): the products and articles an admin can pick for a card or a link, read from
// the existing admin lists (GET /api/products, GET /api/articles). Inactive products and drafts are listed but
// cannot be picked; the article being edited is excluded by the picker.

export interface CatalogItem {
  slug: string;
  title: string;
  image: string | null;
  note: string;
  // Why the public page would not show it ("Nonaktif", "Draf"); not selectable.
  unavailable?: string;
}

export interface Catalog {
  produk: CatalogItem[];
  artikel: CatalogItem[];
}

const httpsOrNull = (url: unknown) => (typeof url === 'string' && url.startsWith('https://') ? url : null);
const byAvailableThenTitle = (a: CatalogItem, b: CatalogItem) =>
  Number(Boolean(a.unavailable)) - Number(Boolean(b.unavailable)) || a.title.localeCompare(b.title, 'id');

export async function loadCatalog(): Promise<Catalog> {
  const [p, a] = await Promise.all([fetch('/api/products', { cache: 'no-store' }), fetch('/api/articles', { cache: 'no-store' })]);
  if (!p.ok || !a.ok) throw new Error(`HTTP ${p.ok ? a.status : p.status}`);
  const products: any[] = (await p.json()).products ?? [];
  const articles: any[] = (await a.json()).items ?? [];
  return {
    produk: products
      .map(x => {
        const price = x.productType === 'variable' ? x.priceFrom : x.price;
        return {
          slug: String(x.id || x.slug),
          title: String(x.name || x.id),
          image: httpsOrNull(x.images?.[0]),
          note: typeof price === 'number' && price > 0 ? formatPrice(price) : '',
          unavailable: x.isActive === true ? undefined : 'Nonaktif',
        };
      })
      .sort(byAvailableThenTitle),
    artikel: articles
      .map(x => ({
        slug: String(x.slug),
        title: String(x.title || x.slug),
        image: httpsOrNull(x.coverImage) ?? httpsOrNull(x.images?.[0]) ?? httpsOrNull(x.imageUrl),
        note: formatDate(x.publishedAt ?? x.createdAt, { day: 'numeric', month: 'short', year: 'numeric' }),
        unavailable: statusOf(x) === 'published' ? undefined : 'Draf',
      }))
      .sort(byAvailableThenTitle),
  };
}

/** The article being edited is never a target: a card or link to itself makes no sense. */
export function pickable(items: CatalogItem[], kind: EmbedMdKind, currentSlug: string): CatalogItem[] {
  if (kind !== 'artikel' || !currentSlug) return items;
  return items.map(i => (i.slug === currentSlug ? { ...i, unavailable: 'Artikel ini' } : i));
}

interface PickerProps {
  kind: EmbedMdKind;
  items: CatalogItem[] | null;
  error?: string;
  value: string;
  onChange: (item: CatalogItem) => void;
}

/** Search box and a radio list (Tab into the list, arrow keys between items). */
export function CatalogPicker({ kind, items, error, value, onChange }: PickerProps) {
  const id = useId();
  const [query, setQuery] = useState('');
  const noun = kind === 'produk' ? 'produk' : 'artikel';
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? []).filter(i => !q || i.title.toLowerCase().includes(q) || i.slug.includes(q));
  }, [items, query]);

  if (error) return <p className="form-error" role="alert">{error}</p>;
  if (!items) return <p className="article-editor-help" role="status">Memuat daftar {noun}...</p>;
  return (
    <div className="article-editor-stack">
      <div className="form-group">
        <label className="form-label" htmlFor={`${id}-q`}>Cari {noun}</label>
        <input id={`${id}-q`} className="form-input" value={query} onChange={e => setQuery(e.target.value)} type="search" autoComplete="off" data-autofocus />
      </div>
      <fieldset className="article-editor-picker">
        <legend className="form-label">Pilih {noun}</legend>
        {shown.length === 0 && <p className="article-editor-help">Tidak ada {noun} yang cocok.</p>}
        {shown.map(i => (
          <label key={i.slug} className={`article-editor-picker-item${i.unavailable ? ' is-disabled' : ''}`}>
            <input type="radio" name={`${id}-pick`} value={i.slug} checked={value === i.slug} disabled={Boolean(i.unavailable)} onChange={() => onChange(i)} />
            {i.image ? <img src={optimizeCloudinaryUrl(i.image, 96, 96)} alt="" loading="lazy" /> : <span className="article-editor-picker-noimg" aria-hidden="true" />}
            <span className="article-editor-picker-text">
              <strong>{i.title}</strong>
              <span>{[i.note, i.unavailable ? `${i.unavailable}, tidak bisa dipilih` : ''].filter(Boolean).join(' · ')}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}

interface EmbedDialogProps {
  kind: EmbedMdKind;
  initialSlug?: string;
  currentSlug: string;
  catalog: Catalog | null;
  catalogError?: string;
  returnFocusRef: RefObject<HTMLElement>;
  onClose: () => void;
  onConfirm: (slug: string) => void;
}

export default function EmbedDialog({ kind, initialSlug, currentSlug, catalog, catalogError, returnFocusRef, onClose, onConfirm }: EmbedDialogProps) {
  const [slug, setSlug] = useState(initialSlug || '');
  const [error, setError] = useState('');
  const items = catalog ? pickable(catalog[kind], kind, currentSlug) : null;
  const noun = kind === 'produk' ? 'produk' : 'artikel';

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const item = items?.find(i => i.slug === slug);
    if (!item || item.unavailable) return setError(`Pilih ${noun} dari daftar.`);
    onConfirm(slug);
  };

  return (
    <Dialog
      title={`${initialSlug ? 'Ganti' : 'Sisipkan'} ${kind === 'produk' ? 'kartu produk' : 'kartu Baca juga'}`}
      onClose={onClose}
      returnFocusRef={returnFocusRef}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} style={{ fontSize: 11, padding: '8px 16px' }}>Batal</button>
          <button type="submit" form="embed-dialog-form" className="btn btn-primary" style={{ fontSize: 11, padding: '8px 16px' }}>{initialSlug ? 'Simpan' : 'Sisipkan'}</button>
        </>
      }
    >
      <form id="embed-dialog-form" onSubmit={submit} className="article-editor-stack">
        <p className="article-editor-help">
          {kind === 'produk'
            ? 'Kartu menampilkan foto, nama, harga, dan stok terbaru produk, dengan tombol ke halaman produk.'
            : 'Kartu "Baca juga" menampilkan judul, ringkasan, dan sampul artikel yang sudah terbit.'}
        </p>
        <CatalogPicker kind={kind} items={items} error={catalogError} value={slug} onChange={i => { setSlug(i.slug); setError(''); }} />
        {error && <div className="form-error" role="alert">{error}</div>}
      </form>
    </Dialog>
  );
}
