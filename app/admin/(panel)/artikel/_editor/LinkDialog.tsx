'use client';

import { FormEvent, RefObject, useEffect, useState } from 'react';
import Dialog from './Dialog';
import { isAllowedLinkUrl } from './markdown-edit';
import { CatalogPicker, pickable, type Catalog } from './EmbedDialog';
import { embedPath, type EmbedMdKind } from './editor-extensions';

interface LinkDialogProps {
  initialText: string;
  // F-013 phase B: the href when the selection is already a link, which also offers "Hapus link".
  initialUrl?: string;
  returnFocusRef: RefObject<HTMLElement>;
  onClose: () => void;
  onInsert: (text: string, url: string) => void;
  onRemove?: () => void;
  // F-013 phase C3 (21.4): pick an INZTA article or product instead of typing its URL.
  catalog: Catalog | null;
  catalogError?: string;
  currentSlug: string;
  onNeedCatalog: () => void;
}

type Target = 'url' | EmbedMdKind;
const SITE_LINK = /^\/(produk|blog)\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;

// Only http(s) and site paths, matching what the renderer keeps (requirement 4.6 and 7.3).
export default function LinkDialog({ initialText, initialUrl, returnFocusRef, onClose, onInsert, onRemove, catalog, catalogError, currentSlug, onNeedCatalog }: LinkDialogProps) {
  const site = SITE_LINK.exec(initialUrl || '');
  const [target, setTarget] = useState<Target>(site ? (site[1] === 'produk' ? 'produk' : 'artikel') : 'url');
  const [text, setText] = useState(initialText);
  const [url, setUrl] = useState(initialUrl || '');
  const [slug, setSlug] = useState(site ? site[2] : '');
  const [error, setError] = useState('');
  // The list is read only when an INZTA target is chosen; loading twice is a no-op in the editor.
  useEffect(() => { if (target !== 'url') onNeedCatalog(); }, [target, onNeedCatalog]);

  const choose = (t: Target) => {
    setTarget(t);
    setSlug('');
    setError('');
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!text.trim()) return setError('Teks link wajib diisi.');
    if (target !== 'url') {
      const item = catalog ? pickable(catalog[target], target, currentSlug).find(i => i.slug === slug) : undefined;
      if (!item || item.unavailable) return setError(`Pilih ${target} dari daftar.`);
      return onInsert(text.trim(), embedPath(target, slug));
    }
    if (!isAllowedLinkUrl(url)) return setError('URL harus diawali https:// (situs lain) atau / (halaman inzta.id, misalnya /produk).');
    onInsert(text.trim(), url.trim());
  };

  const choice = (t: Target, label: string) => (
    <label>
      <input type="radio" name="link-target" value={t} checked={target === t} onChange={() => choose(t)} />
      {label}
    </label>
  );

  return (
    <Dialog
      title={initialUrl ? 'Ubah link' : 'Sisipkan link'}
      onClose={onClose}
      returnFocusRef={returnFocusRef}
      footer={
        <>
          {initialUrl && onRemove && (
            <button type="button" className="btn btn-ghost" onClick={onRemove} style={{ fontSize: 11, padding: '8px 16px', marginRight: 'auto' }}>Hapus link</button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose} style={{ fontSize: 11, padding: '8px 16px' }}>Batal</button>
          <button type="submit" form="link-dialog-form" className="btn btn-primary" style={{ fontSize: 11, padding: '8px 16px' }}>{initialUrl ? 'Simpan' : 'Sisipkan'}</button>
        </>
      }
    >
      <form id="link-dialog-form" onSubmit={submit} className="article-editor-stack">
        <div className="form-group">
          <label className="form-label" htmlFor="link-text">Teks link</label>
          <input id="link-text" className="form-input" value={text} onChange={e => setText(e.target.value)} data-autofocus={initialText ? undefined : true} />
        </div>
        <fieldset className="article-editor-choice">
          <legend className="form-label">Tujuan link</legend>
          <div className="article-editor-choice-options">
            {choice('artikel', 'Artikel INZTA')}
            {choice('produk', 'Produk INZTA')}
            {choice('url', 'URL')}
          </div>
        </fieldset>
        {target === 'url' ? (
          <div className="form-group">
            <label className="form-label" htmlFor="link-url">URL</label>
            <input id="link-url" className="form-input" value={url} onChange={e => setUrl(e.target.value)} placeholder="/produk/nama-produk atau https://..." data-autofocus={initialText ? true : undefined} inputMode="url" />
            <p className="article-editor-help">Link ke situs lain otomatis dibuka di tab baru.</p>
          </div>
        ) : (
          <CatalogPicker
            kind={target}
            items={catalog ? pickable(catalog[target], target, currentSlug) : null}
            error={catalogError}
            value={slug}
            onChange={i => {
              setSlug(i.slug);
              setError('');
              if (!text.trim()) setText(i.title);
            }}
          />
        )}
        {error && <div className="form-error" role="alert">{error}</div>}
      </form>
    </Dialog>
  );
}
