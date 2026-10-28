'use client';

import { KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import ImageUpload from '@/components/ImageUpload';
import { toSlug } from '@/lib/slug';
import { formatDate } from '@/lib/utils';
import { adminErrorMessage } from '@/lib/admin-messages';
import { canPublish, runChecklist } from '@/lib/article-checklist';
import {
  countWords,
  extractBodyImages,
  formatOf,
  imageMarkdown,
  isAllowedImageUrl,
  isEverPublished,
  readingMinutes,
  statusOf,
  type BodyImage,
} from '@/lib/article-format';
import type { ArticleStatus, ChecklistItem, ContentFormat, RenderWarning } from '@/types';
import MarkdownToolbar, { type ToolbarAction } from './MarkdownToolbar';
import LinkDialog from './LinkDialog';
import ImageDialog, { type ImageDialogValue } from './ImageDialog';
import BodyImagesPanel from './BodyImagesPanel';
import SeoPanel from './SeoPanel';
import ChecklistPanel from './ChecklistPanel';
import { applyEdit, blockEdit, encodeLinkUrl, escapeLinkText, headingEdit, listEdit, wrapEdit } from './markdown-edit';
import { clearLocalCopy, localKey, readLocalCopy, useAutosave, type LocalCopy } from './useAutosave';
import { useUnsavedGuard } from './useUnsavedGuard';

// The editable fields, in a fixed key order so two drafts compare by their JSON.
interface Draft {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  contentFormat: ContentFormat;
  coverImage: string;
  coverAlt: string;
  metaTitle: string;
  metaDescription: string;
  images: string[];
}

// GET/PUT/publish responses: stored fields with dates as epoch milliseconds (lib/admin-articles.ts).
interface ServerArticle extends Partial<Draft> {
  slug: string;
  status?: ArticleStatus;
  imageUrl?: string;
  author?: string;
  createdAt: number | null;
  updatedAt: number | null;
  publishedAt: number | null;
}

type Dialog =
  | { type: 'link'; text: string }
  | { type: 'image'; image?: BodyImage }
  | { type: 'cover' };

type Message = { kind: 'error' | 'ok'; text: string; checks?: ChecklistItem[] };

const EMPTY: Draft = {
  title: '', slug: '', excerpt: '', content: '', contentFormat: 'markdown',
  coverImage: '', coverAlt: '', metaTitle: '', metaDescription: '', images: [],
};

function toDraft(a: Partial<ServerArticle>): Draft {
  const images = Array.isArray(a.images) ? a.images : a.imageUrl ? [a.imageUrl] : [];
  return {
    title: a.title || '',
    slug: a.slug || '',
    excerpt: a.excerpt || '',
    content: a.content || '',
    contentFormat: formatOf(a),
    coverImage: a.coverImage || '',
    coverAlt: a.coverAlt || '',
    metaTitle: a.metaTitle || '',
    metaDescription: a.metaDescription || '',
    images: images.filter((u): u is string => typeof u === 'string'),
  };
}

const sameDraft = (a: Draft, b: Draft) => JSON.stringify(toDraft(a)) === JSON.stringify(toDraft(b));
const timeOf = (ms: number) => new Date(ms).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });
const dateTimeOf = (ms: number | null | undefined) =>
  ms ? `${formatDate(ms, { day: 'numeric', month: 'short', year: 'numeric' })} ${timeOf(ms)}` : '-';

function warningText(w: RenderWarning): string {
  switch (w.kind) {
    case 'raw-html': return 'Kode HTML di isi dibuang';
    case 'render-error': return 'Isi tidak bisa diproses: daftar atau kutipan bersarang terlalu dalam';
    case 'placeholder': return `Gambar belum diunggah, tidak tampil: ${w.alt || w.src}`;
    case 'image-host': return `Gambar bukan dari panel INZTA, dibuang: ${w.alt || w.src}`;
    case 'inline-image': return `Gambar menempel di teks, dibuang. Beri baris kosong sebelum dan sesudahnya: ${w.alt || w.src}`;
  }
}

// A message that has to survive router.replace, which remounts the editor for the new slug.
const FLASH_KEY = 'inzta-artikel-flash';
function setFlash(message: Message) {
  try { window.sessionStorage.setItem(FLASH_KEY, JSON.stringify(message)); } catch { /* storage off: message is lost */ }
}
function takeFlash(): Message | null {
  try {
    const raw = window.sessionStorage.getItem(FLASH_KEY);
    window.sessionStorage.removeItem(FLASH_KEY);
    return raw ? (JSON.parse(raw) as Message) : null;
  } catch {
    return null;
  }
}

async function readJson(res: Response): Promise<any> {
  return res.json().catch(() => ({}));
}

export default function ArticleEditor({ slug: routeSlug }: { slug?: string }) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const coverButtonRef = useRef<HTMLButtonElement>(null);
  const savedSelection = useRef({ start: 0, end: 0 });

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [server, setServer] = useState<ServerArticle | null>(null);
  const [loading, setLoading] = useState(Boolean(routeSlug));
  const [loadError, setLoadError] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [preview, setPreview] = useState<{ html: string; warnings: RenderWarning[] } | null>(null);
  const [previewState, setPreviewState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [previewError, setPreviewError] = useState('');
  const [busy, setBusy] = useState<null | 'save' | 'publish' | 'unpublish'>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [coverWidth, setCoverWidth] = useState<number | null>(null);
  const [restore, setRestore] = useState<LocalCopy<Draft> | null>(null);

  const key = localKey(routeSlug);
  const baseline = useMemo(() => (server ? toDraft(server) : EMPTY), [server]);
  const dirty = !sameDraft(draft, baseline);
  const isMarkdown = draft.contentFormat === 'markdown';
  const status: ArticleStatus = server ? statusOf(server) : 'draft';
  const slugLocked = server ? isEverPublished(server) : false;
  const images = useMemo(() => (isMarkdown ? extractBodyImages(draft.content) : []), [draft.content, isMarkdown]);
  const words = useMemo(() => countWords(draft.content), [draft.content]);
  const checklist = useMemo(
    () => runChecklist(draft, { coverWidth: isMarkdown ? coverWidth : null, legacySlugOk: Boolean(server && draft.slug === server.slug) }),
    [draft, coverWidth, isMarkdown, server],
  );
  const ready = canPublish(checklist);
  const failedCount = checklist.blocking.filter(c => !c.ok).length;

  const autosave = useAutosave(key, draft, dirty, server?.updatedAt ?? null, !loading && !restore && !loadError);
  useUnsavedGuard(dirty);

  useEffect(() => {
    const flash = takeFlash();
    if (flash) setMessage(flash);
  }, []);

  // Opening the editor costs one read (requirement 12.4); a newer local copy is offered, never applied silently.
  useEffect(() => {
    let cancelled = false;
    const offerLocalCopy = (against: Draft) => {
      const copy = readLocalCopy<Draft>(key);
      if (!copy) return;
      if (sameDraft(toDraft(copy.draft), against)) clearLocalCopy(key);
      else setRestore(copy);
    };
    if (!routeSlug) {
      offerLocalCopy(EMPTY);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/articles/${encodeURIComponent(routeSlug)}`, { cache: 'no-store' });
        const body = await readJson(res);
        if (cancelled) return;
        // Drafts are a 404 for non-admins (2.7), so a rejected session looks the same as a missing article.
        if (res.status === 404) setLoadError('Artikel tidak ditemukan, atau sesi admin sudah habis. Bila artikel ini memang ada, masuk lagi di /admin/login lalu buka ulang.');
        else if (!res.ok) setLoadError(adminErrorMessage(res.status, body.error));
        else {
          const item = body.item as ServerArticle;
          setServer(item);
          setDraft(toDraft(item));
          offerLocalCopy(toDraft(item));
        }
      } catch (e: any) {
        if (!cancelled) setLoadError('Gagal memuat artikel: ' + e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [routeSlug, key]);

  // The cover's real width, for the 1200 px link-preview warning (W-4).
  useEffect(() => {
    if (!isAllowedImageUrl(draft.coverImage)) { setCoverWidth(null); return; }
    let active = true;
    const img = new Image();
    img.onload = () => { if (active) setCoverWidth(img.naturalWidth); };
    img.src = draft.coverImage;
    return () => { active = false; };
  }, [draft.coverImage]);

  // The textarea grows with its content, so the page scrolls instead of a small inner box.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta || tab !== 'write') return;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight + 2}px`;
  }, [draft.content, tab]);

  const set = useCallback(<K extends keyof Draft>(field: K, value: Draft[K]) => {
    setDraft(d => ({ ...d, [field]: value }));
  }, []);

  const onTitle = (title: string) => {
    setDraft(d => ({ ...d, title, slug: !server && !slugTouched ? toSlug(title) : d.slug }));
  };

  // Saves the current draft and returns the stored article (plus a warning when a rename left the old
  // document behind), or null after showing why it failed.
  async function save(): Promise<{ item: ServerArticle; warning?: string } | null> {
    const snapshot = draftRef.current;
    const payload = { ...snapshot };
    try {
      let res: Response;
      const renaming = Boolean(server && snapshot.slug !== server.slug);
      if (!server || renaming) {
        // A new slug is a new document; POST refuses a taken slug, so nothing is overwritten (F-000).
        res = await fetch('/api/articles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      } else {
        res = await fetch(`/api/articles/${encodeURIComponent(server.slug)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, baseUpdatedAt: server.updatedAt }),
        });
      }
      const body = await readJson(res);
      if (!res.ok) {
        const local = autosave.status.state === 'saved' ? ' Salinan lokal di browser ini masih ada.' : '';
        const text = res.status === 409 && (!server || renaming) ? 'Slug ini sudah dipakai artikel lain. Ganti slug lalu simpan lagi.' : adminErrorMessage(res.status, body.error) + (res.status >= 500 ? local : '');
        setMessage({ kind: 'error', text, checks: body.checks });
        return null;
      }
      const item = body.item as ServerArticle;
      // From here the new document exists, so the editor follows it whatever happens to the old one.
      setServer(item);
      // Keep anything typed while the request was running; otherwise take the server's trimmed values.
      if (sameDraft(draftRef.current, snapshot)) setDraft(toDraft(item));
      autosave.clear(key);
      clearLocalCopy(localKey());
      let warning: string | undefined;
      if (renaming && server) {
        // The old document goes only after the new one is saved, so a failed save never loses the article.
        const leftover = `Tersimpan dengan slug baru, tetapi draf lama "${server.slug}" belum terhapus. Hapus draf lama itu dari daftar artikel.`;
        try {
          const del = await fetch(`/api/articles/${encodeURIComponent(server.slug)}`, { method: 'DELETE' });
          if (!del.ok) warning = leftover;
        } catch {
          warning = leftover;
        }
      }
      return { item, warning };
    } catch (e: any) {
      setMessage({ kind: 'error', text: 'Gagal terhubung ke server: ' + e.message });
      return null;
    }
  }

  // Shows the message here, or carries it over the remount when the route changes to the new slug.
  const finish = (slug: string, msg: Message) => {
    if (slug !== routeSlug) {
      setFlash(msg);
      router.replace(`/admin/artikel/${slug}`);
    } else {
      setMessage(msg);
    }
  };

  async function onSave() {
    setBusy('save'); setMessage(null);
    const saved = await save();
    setBusy(null);
    if (!saved) return;
    const { item, warning } = saved;
    finish(item.slug, warning
      ? { kind: 'error', text: warning }
      : { kind: 'ok', text: statusOf(item) === 'published' ? 'Perubahan tersimpan dan sudah tayang.' : 'Draf tersimpan.' });
  }

  async function onPublish() {
    if (!ready) return;
    setBusy('publish'); setMessage(null);
    let current = server;
    let warning: string | undefined;
    if (!current || dirty) {
      const saved = await save();
      current = saved?.item ?? null;
      warning = saved?.warning;
    }
    if (!current) { setBusy(null); return; }
    let msg: Message;
    try {
      const res = await fetch(`/api/articles/${encodeURIComponent(current.slug)}/publish`, { method: 'POST' });
      const body = await readJson(res);
      if (!res.ok) {
        msg = { kind: 'error', text: adminErrorMessage(res.status, body.error), checks: body.checks };
      } else {
        setServer(body.item);
        msg = { kind: 'ok', text: 'Artikel terbit. Halaman blog dan sitemap diperbarui.' };
      }
    } catch (e: any) {
      msg = { kind: 'error', text: 'Gagal terhubung ke server: ' + e.message };
    }
    setBusy(null);
    finish(current.slug, warning ? { kind: 'error', text: `${msg.text} ${warning}`, checks: msg.checks } : msg);
  }

  async function onUnpublish() {
    if (!server) return;
    if (!window.confirm('Tarik artikel ke draf? Halaman publiknya jadi 404 sampai diterbitkan lagi.')) return;
    setBusy('unpublish'); setMessage(null);
    try {
      const res = await fetch(`/api/articles/${encodeURIComponent(server.slug)}/publish`, { method: 'DELETE' });
      const body = await readJson(res);
      if (!res.ok) setMessage({ kind: 'error', text: adminErrorMessage(res.status, body.error) });
      else {
        setServer(body.item);
        setMessage({ kind: 'ok', text: 'Artikel ditarik ke draf.' });
      }
    } catch (e: any) {
      setMessage({ kind: 'error', text: 'Gagal terhubung ke server: ' + e.message });
    }
    setBusy(null);
  }

  // Live preview of the unsaved body; the server renders it with the public renderer and reads nothing.
  async function showPreview() {
    setTab('preview');
    setPreviewState('loading');
    try {
      const res = await fetch('/api/admin/articles/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draftRef.current.content, contentFormat: draftRef.current.contentFormat }),
      });
      const body = await readJson(res);
      if (!res.ok) {
        setPreviewState('error');
        setPreview(null);
        setPreviewError(body.error ? adminErrorMessage(res.status, body.error) : 'Pratinjau gagal dibuat. Coba lagi.');
        return;
      }
      setPreview(body);
      setPreviewState('idle');
    } catch (e: any) {
      setPreviewState('error');
      setPreview(null);
      setPreviewError('Pratinjau gagal dimuat. Cek koneksi, lalu klik Pratinjau lagi.');
    }
  }

  function onToolbar(action: ToolbarAction) {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    if (action === 'h2' || action === 'h3') applyEdit(ta, headingEdit(value, s, e, action === 'h2' ? 2 : 3));
    else if (action === 'bold') applyEdit(ta, wrapEdit(value, s, e, '**', 'teks tebal'));
    else if (action === 'italic') applyEdit(ta, wrapEdit(value, s, e, '*', 'teks miring'));
    else if (action === 'ul' || action === 'ol') applyEdit(ta, listEdit(value, s, e, action === 'ol'));
    else {
      savedSelection.current = { start: s, end: e };
      setDialog(action === 'link' ? { type: 'link', text: value.slice(s, e) } : { type: 'image' });
    }
  }

  // Tab pattern: arrow keys move between Tulis and Pratinjau; only the selected tab is in the Tab order.
  function onTabKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const next = e.key === 'Home' ? 'write' : e.key === 'End' ? 'preview' : tab === 'write' ? 'preview' : 'write';
    if (next === 'preview') showPreview();
    else setTab('write');
    document.getElementById(next === 'preview' ? 'tab-preview' : 'tab-write')?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'b' || k === 'i' || k === 'k') {
      e.preventDefault();
      onToolbar(k === 'b' ? 'bold' : k === 'i' ? 'italic' : 'link');
    }
  }

  function insertLink(text: string, url: string) {
    setDialog(null);
    const ta = textareaRef.current;
    if (!ta) return;
    const { start, end } = savedSelection.current;
    const md = `[${escapeLinkText(text)}](${encodeLinkUrl(url)})`;
    applyEdit(ta, { start, end, text: md, selectStart: start + md.length, selectEnd: start + md.length });
  }

  // Edits rewrite that exact match (by offsets and original text), so a duplicate image elsewhere stays.
  function replaceImage(image: BodyImage, markdown: string): boolean {
    const content = draftRef.current.content;
    if (content.slice(image.start, image.end) !== image.raw) {
      setMessage({ kind: 'error', text: 'Isi artikel berubah sejak gambar dibuka. Buka lagi dari daftar gambar.' });
      return false;
    }
    const ta = textareaRef.current;
    if (ta && tab === 'write') applyEdit(ta, { start: image.start, end: image.end, text: markdown, selectStart: image.start, selectEnd: image.start + markdown.length });
    else set('content', content.slice(0, image.start) + markdown + content.slice(image.end));
    return true;
  }

  function onImageConfirm(value: ImageDialogValue) {
    const current = dialog;
    setDialog(null);
    // F-013: the canonical attribute block for the chosen layout, none for the default (5.3, 5.4).
    const md = imageMarkdown(value.url, value.alt, value.caption, value.layout);
    if (current?.type === 'image' && current.image) {
      if (!replaceImage(current.image, md)) return;
    } else {
      const ta = textareaRef.current;
      if (!ta) return;
      const { start, end } = savedSelection.current;
      applyEdit(ta, blockEdit(ta.value, start, end, md));
    }
    if (value.asCover) {
      setDraft(d => ({ ...d, coverImage: value.url, coverAlt: d.coverAlt || value.alt }));
      if (value.width) setCoverWidth(value.width);
    }
  }

  function jumpTo(image: BodyImage) {
    setTab('write');
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(image.start, image.end);
      const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 24;
      window.scrollTo({ top: ta.getBoundingClientRect().top + window.scrollY + (image.line - 1) * lineHeight - 160, behavior: 'smooth' });
    });
  }

  // Local until saved (requirement 6.9): lines become paragraphs, the gallery becomes inline images.
  function convertToMarkdown() {
    setDraft(d => {
      const paragraphs = d.content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const gallery = d.images.map(url => imageMarkdown(url, ''));
      return {
        ...d,
        content: [...paragraphs, ...gallery].join('\n\n'),
        contentFormat: 'markdown',
        images: [],
        coverImage: d.coverImage || (isAllowedImageUrl(d.images[0]) ? d.images[0] : ''),
      };
    });
    setMessage({ kind: 'ok', text: 'Diubah ke Markdown (belum disimpan). Isi teks alt setiap gambar dan sampul, cek Pratinjau, lalu simpan.' });
  }

  function onRestore() {
    if (!restore) return;
    setDraft(toDraft(restore.draft));
    if (!server && restore.draft.slug) setSlugTouched(true);
    setRestore(null);
  }

  function onDiscard() {
    clearLocalCopy(key);
    setRestore(null);
  }

  if (loading) return <p className="article-editor-help">Memuat artikel...</p>;
  if (loadError) {
    return (
      <div className="article-editor-stack">
        <div className="form-error" role="alert">{loadError}</div>
        <Link href="/admin/artikel" className="btn btn-ghost" style={{ alignSelf: 'flex-start', fontSize: 11, padding: '8px 16px' }}>Kembali ke daftar artikel</Link>
      </div>
    );
  }

  const autosaveText =
    autosave.status.state === 'off' ? 'Simpan lokal mati'
      : dirty && autosave.status.state === 'saved' ? `Tersimpan lokal ${timeOf(autosave.status.at)}`
        : dirty ? 'Belum disimpan' : 'Semua tersimpan';
  const working = busy !== null;
  const serverNewer = Boolean(restore && server && (server.updatedAt ?? 0) > (restore.baseUpdatedAt ?? 0));

  return (
    <div className="article-editor">
      <div className="article-editor-topbar">
        <Link href="/admin/artikel" className="article-editor-back"><ArrowLeft size={16} /> Semua artikel</Link>
        <span className={`table-badge ${status === 'published' ? 'table-badge-active' : 'table-badge-inactive'}`}>{status === 'published' ? 'Terbit' : 'Draf'}</span>
        <span className={`article-editor-autosave${autosave.status.state === 'off' ? ' is-off' : ''}`} aria-live="polite">{autosaveText}</span>
        {/* A disabled button cannot be focused or show a tooltip on touch, so the reason is visible text. */}
        {server && !ready && (
          <a id="publish-blocked" className="article-editor-blocked" href="#panel-checklist">{failedCount} cek belum lolos, lihat checklist</a>
        )}
        <div className="article-editor-actions">
          {server && status === 'published' && (
            <a className="btn btn-ghost" href={`/blog/${server.slug}`} target="_blank" rel="noopener" style={{ fontSize: 11, padding: '8px 14px' }}>Lihat di situs</a>
          )}
          {server && status !== 'published' && (
            <a className="btn btn-ghost" href={`/admin/pratinjau/${server.slug}`} target="_blank" rel="noopener" title="Versi yang tersimpan" style={{ fontSize: 11, padding: '8px 14px' }}>Pratinjau halaman</a>
          )}
          {status === 'published' ? (
            <>
              <button type="button" className="btn btn-ghost" onClick={onUnpublish} disabled={working} style={{ fontSize: 11, padding: '8px 14px' }}>
                {busy === 'unpublish' ? 'Menarik...' : 'Tarik ke draf'}
              </button>
              <button type="button" className="btn btn-primary" onClick={onSave} disabled={working || !dirty || !ready} aria-describedby={ready ? undefined : 'publish-blocked'} style={{ fontSize: 11, padding: '8px 14px' }}>
                {busy === 'save' ? 'Menyimpan...' : 'Simpan perubahan'}
              </button>
            </>
          ) : (
            <>
              <button type="button" className={server ? 'btn btn-ghost' : 'btn btn-primary'} onClick={onSave} disabled={working || (!dirty && Boolean(server)) || !draft.title.trim() || !draft.slug.trim()} style={{ fontSize: 11, padding: '8px 14px' }}>
                {busy === 'save' ? 'Menyimpan...' : 'Simpan draf'}
              </button>
              {server && (
                <button type="button" className="btn btn-primary" onClick={onPublish} disabled={working || !ready} aria-describedby={ready ? undefined : 'publish-blocked'} style={{ fontSize: 11, padding: '8px 14px' }}>
                  {busy === 'publish' ? 'Menerbitkan...' : 'Terbitkan'}
                </button>
              )}
            </>
          )}
        </div>
        {/* Inside the sticky bar so a rejected save or publish is visible from anywhere on the page. */}
        {message && (
          <div className={`article-editor-message ${message.kind === 'error' ? 'form-error' : 'article-editor-ok'}`} role={message.kind === 'error' ? 'alert' : 'status'}>
            <button type="button" className="article-editor-message-close" onClick={() => setMessage(null)} aria-label="Tutup pesan">&times;</button>
            {message.text}
            {message.checks && message.checks.length > 0 && (
              <ul className="article-editor-errors">{message.checks.map(c => <li key={c.id}>{c.label}{c.detail ? `: ${c.detail}` : ''}</li>)}</ul>
            )}
          </div>
        )}
      </div>

      {restore && (
        <div className="article-editor-banner" role="alert">
          <p>
            Ada salinan lokal dari {dateTimeOf(restore.savedAt)} yang belum disimpan ke server.
            {serverNewer && ' Versi di server lebih baru daripada salinan ini; memulihkan akan menimpa perubahan itu saat Anda menyimpan.'}
          </p>
          <div className="article-editor-banner-actions">
            <button type="button" className="btn btn-primary" onClick={onRestore} style={{ fontSize: 11, padding: '6px 14px' }}>Pulihkan</button>
            <button type="button" className="btn btn-ghost" onClick={onDiscard} style={{ fontSize: 11, padding: '6px 14px' }}>Buang</button>
          </div>
        </div>
      )}

      <div className="article-editor-grid">
        <div className="article-editor-main">
          <div className="form-group">
            <div className="article-label-row">
              <label className="form-label" htmlFor="article-title">Judul artikel *</label>
              <span className="article-counter">{draft.title.length}/150</span>
            </div>
            <input id="article-title" className="form-input article-editor-title" value={draft.title} maxLength={150} onChange={e => onTitle(e.target.value)} />
            <p className="article-editor-help">Judul ini menjadi H1 halaman, jadi di isi artikel pakai subjudul H2 dan H3 saja.</p>
          </div>

          {!isMarkdown && (
            <div className="article-editor-banner">
              <p>Artikel lama (teks polos). Galeri lama tetap tampil di situs. Setiap baris menjadi satu paragraf.</p>
              <div className="form-group">
                <span className="form-label">Galeri lama (maksimal 5)</span>
                <ImageUpload value={draft.images} onChange={urls => set('images', urls)} max={5} />
              </div>
              <div className="article-editor-banner-actions">
                <button type="button" className="btn btn-primary" onClick={convertToMarkdown} style={{ fontSize: 11, padding: '6px 14px' }}>Ubah ke Markdown</button>
              </div>
            </div>
          )}

          <label className="form-label article-editor-body-label" htmlFor="article-content">Isi artikel *</label>
          <div className="article-editor-body">
            <div className="article-editor-tabs">
              <div role="tablist" aria-label="Mode isi" className="article-editor-tablist" onKeyDown={onTabKey}>
                <button type="button" role="tab" id="tab-write" aria-selected={tab === 'write'} aria-controls="panel-write" tabIndex={tab === 'write' ? 0 : -1} className={tab === 'write' ? 'is-active' : ''} onClick={() => setTab('write')}>Tulis</button>
                <button type="button" role="tab" id="tab-preview" aria-selected={tab === 'preview'} aria-controls="panel-preview" tabIndex={tab === 'preview' ? 0 : -1} className={tab === 'preview' ? 'is-active' : ''} onClick={showPreview}>Pratinjau</button>
              </div>
              {tab === 'write' && isMarkdown && <MarkdownToolbar onAction={onToolbar} />}
            </div>
            {/* Both panels stay in the DOM so aria-controls always points at an element. */}
            <div role="tabpanel" id="panel-write" aria-labelledby="tab-write" hidden={tab !== 'write'}>
                <textarea
                  id="article-content"
                  ref={textareaRef}
                  className="form-input article-editor-textarea"
                  value={draft.content}
                  onChange={e => set('content', e.target.value)}
                  onKeyDown={isMarkdown ? onKeyDown : undefined}
                  rows={16}
                  maxLength={50000}
                  spellCheck
                  placeholder={isMarkdown ? 'Tulis isi artikel. Baris kosong memisahkan paragraf. Pakai toolbar untuk subjudul, daftar, link, dan gambar.' : 'Setiap baris menjadi satu paragraf.'}
                />
            </div>
            <div role="tabpanel" id="panel-preview" aria-labelledby="tab-preview" className="article-editor-preview-wrap" hidden={tab !== 'preview'}>
                {previewState === 'loading' && <p className="article-editor-help">Menyiapkan pratinjau...</p>}
                {previewState === 'error' && <p className="form-error" role="alert">{previewError}</p>}
                {preview && preview.warnings.length > 0 && (
                  <ul className="article-editor-warnings">
                    {preview.warnings.map((w, i) => <li key={i}>{warningText(w)}</li>)}
                  </ul>
                )}
                {preview && previewState !== 'loading' && (
                  // Already sanitized by the server (lib/markdown.ts); the client does not transform it.
                  <div className={`article-body${isMarkdown ? '' : ' article-body-plain'}`} dangerouslySetInnerHTML={{ __html: preview.html }} />
                )}
            </div>
            <p className="article-editor-footer">
              {words.toLocaleString('id-ID')} kata · ±{readingMinutes(words)} menit baca · {images.length} gambar
            </p>
          </div>
        </div>

        <aside className="article-editor-side">
          <section className="article-panel" aria-labelledby="panel-publikasi">
            <h2 className="article-panel-title" id="panel-publikasi">Publikasi</h2>
            <dl className="article-meta">
              <dt>Status</dt><dd>{status === 'published' ? 'Terbit' : 'Draf'}</dd>
              <dt>Dibuat</dt><dd>{dateTimeOf(server?.createdAt)}</dd>
              <dt>Diperbarui</dt><dd>{dateTimeOf(server?.updatedAt)}</dd>
              <dt>Terbit</dt><dd>{dateTimeOf(server?.publishedAt)}</dd>
            </dl>
            <div className="form-group">
              <label className="form-label" htmlFor="article-author">Penulis</label>
              <input id="article-author" className="form-input" value="Tim INZTA" readOnly />
            </div>
          </section>

          <section className="article-panel" aria-labelledby="panel-url">
            <h2 className="article-panel-title" id="panel-url">URL</h2>
            <div className="form-group">
              <label className="form-label" htmlFor="article-slug">Slug</label>
              <input
                id="article-slug"
                className="form-input"
                value={draft.slug}
                readOnly={slugLocked}
                aria-describedby="article-slug-help"
                onChange={e => { setSlugTouched(true); set('slug', e.target.value.toLowerCase().replace(/\s+/g, '-')); }}
              />
              <p className="article-editor-help" id="article-slug-help">
                {slugLocked
                  ? 'Artikel ini pernah terbit, jadi URL-nya dikunci. Mengganti URL yang sudah tayang butuh redirect (fase 3).'
                  : `inzta.id/blog/${draft.slug || 'slug-artikel'}. Huruf kecil, angka, dan tanda hubung.`}
              </p>
            </div>
          </section>

          {isMarkdown && (
            <section className="article-panel" aria-labelledby="panel-cover">
              <h2 className="article-panel-title" id="panel-cover">Gambar sampul *</h2>
              <div className="article-image-preview is-small">
                {isAllowedImageUrl(draft.coverImage) ? <img src={draft.coverImage} alt="" /> : <span>Belum ada sampul</span>}
              </div>
              <div className="article-editor-banner-actions">
                <button type="button" ref={coverButtonRef} className="btn btn-ghost" onClick={() => setDialog({ type: 'cover' })} style={{ fontSize: 11, padding: '6px 14px' }}>
                  {draft.coverImage ? 'Ganti sampul' : 'Unggah sampul'}
                </button>
                {draft.coverImage && (
                  <button type="button" className="btn btn-ghost" onClick={() => setDraft(d => ({ ...d, coverImage: '', coverAlt: '' }))} style={{ fontSize: 11, padding: '6px 14px' }}>Hapus</button>
                )}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="article-cover-alt">Teks alt sampul *</label>
                <input id="article-cover-alt" className="form-input" value={draft.coverAlt} maxLength={200} onChange={e => set('coverAlt', e.target.value)} />
              </div>
              {coverWidth !== null && coverWidth < 1200 && (
                <p className="article-editor-help is-warn">Lebar sampul {coverWidth} px. Pratinjau link di WhatsApp dan Facebook butuh minimal 1200 px agar tidak buram.</p>
              )}
            </section>
          )}

          <section className="article-panel" aria-labelledby="panel-excerpt">
            <h2 className="article-panel-title" id="panel-excerpt">Ringkasan *</h2>
            <div className="form-group">
              <div className="article-label-row">
                <label className="form-label" htmlFor="article-excerpt">Excerpt</label>
                <span className="article-counter">{draft.excerpt.length}/300</span>
              </div>
              <textarea id="article-excerpt" className="form-input" rows={3} maxLength={300} value={draft.excerpt} onChange={e => set('excerpt', e.target.value)} />
              <p className="article-editor-help">Tampil di kartu blog, dan jadi deskripsi Google bila Deskripsi SEO kosong.</p>
            </div>
          </section>

          <section className="article-panel" aria-labelledby="panel-seo">
            <h2 className="article-panel-title" id="panel-seo">SEO</h2>
            <SeoPanel title={draft.title} slug={draft.slug} excerpt={draft.excerpt} metaTitle={draft.metaTitle} metaDescription={draft.metaDescription} onChange={set} />
          </section>

          {isMarkdown && (
            <section className="article-panel" aria-labelledby="panel-images">
              <h2 className="article-panel-title" id="panel-images">Gambar di artikel ({images.length})</h2>
              <BodyImagesPanel images={images} onEdit={image => setDialog({ type: 'image', image })} onJump={jumpTo} />
            </section>
          )}

          <section className="article-panel" aria-labelledby="panel-checklist">
            <h2 className="article-panel-title" id="panel-checklist">Checklist sebelum terbit</h2>
            <ChecklistPanel result={checklist} />
          </section>
        </aside>
      </div>

      {dialog?.type === 'link' && (
        <LinkDialog initialText={dialog.text} returnFocusRef={textareaRef} onClose={() => setDialog(null)} onInsert={insertLink} />
      )}
      {dialog?.type === 'image' && (
        <ImageDialog
          title={dialog.image ? (dialog.image.kind === 'allowed' ? 'Edit gambar' : 'Unggah gambar') : 'Sisipkan gambar'}
          kind="body"
          initial={dialog.image ? { url: dialog.image.url, alt: dialog.image.alt, caption: dialog.image.caption, fileName: dialog.image.fileName, layout: dialog.image.layout } : undefined}
          returnFocusRef={textareaRef}
          onClose={() => setDialog(null)}
          onConfirm={onImageConfirm}
        />
      )}
      {dialog?.type === 'cover' && (
        <ImageDialog
          title="Gambar sampul"
          kind="cover"
          initial={{ url: draft.coverImage, alt: draft.coverAlt }}
          returnFocusRef={coverButtonRef}
          onClose={() => setDialog(null)}
          onConfirm={v => {
            setDialog(null);
            setDraft(d => ({ ...d, coverImage: v.url, coverAlt: v.alt }));
            if (v.width) setCoverWidth(v.width);
          }}
        />
      )}
    </div>
  );
}
