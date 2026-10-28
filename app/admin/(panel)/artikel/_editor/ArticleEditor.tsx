'use client';

import { KeyboardEvent, RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import ImageUpload from '@/components/ImageUpload';
import { toSlug } from '@/lib/slug';
import { formatDate } from '@/lib/utils';
import { adminErrorMessage } from '@/lib/admin-messages';
import { canPublish, runChecklist } from '@/lib/article-checklist';
import { DEFAULT_AUTHOR } from '@/lib/constants';
import ArticleHead from '@/app/blog/[slug]/ArticleHead';
import {
  countWords,
  extractBodyImages,
  formatOf,
  imageMarkdown,
  isAllowedImageUrl,
  isEverPublished,
  MAX_EMBEDS,
  readingMinutes,
  statusOf,
  type BodyImage,
} from '@/lib/article-format';
import type { ArticleEmbeds, ArticleStatus, ChecklistItem, ContentFormat, RenderBlock, RenderWarning } from '@/types';
import ArticleBody from '@/components/ArticleBody';
import type { Editor } from '@tiptap/react';
import MarkdownToolbar from './MarkdownToolbar';
import VisualEditor, { splittableDepth } from './VisualEditor';
import { NodeSelection } from '@tiptap/pm/state';
import { imageOccurrence } from './markdown-doc';
import LinkDialog from './LinkDialog';
import EmbedDialog, { loadCatalog, pickable, type Catalog } from './EmbedDialog';
import type { EmbedCatalogSource, EmbedMdKind } from './editor-extensions';
import ImageDialog, { type ImageDialogValue } from './ImageDialog';
import BodyImagesPanel from './BodyImagesPanel';
import SeoPanel from './SeoPanel';
import ChecklistPanel from './ChecklistPanel';
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
  coverCaption: string;
  showCover: boolean;
  author: string;
  metaTitle: string;
  metaDescription: string;
  images: string[];
}

// GET/PUT/publish responses: stored fields with dates as epoch milliseconds (lib/admin-articles.ts).
interface ServerArticle extends Partial<Draft> {
  slug: string;
  status?: ArticleStatus;
  imageUrl?: string;
  createdAt: number | null;
  updatedAt: number | null;
  publishedAt: number | null;
}

// F-013 phase B: link and new-image dialogs remember the editor range they act on; `pos` is an image node
// opened from the editor, `image` one opened from the side panel.
type Dialog =
  | { type: 'link'; text: string; url?: string; from: number; to: number }
  | { type: 'image'; image?: BodyImage; pos?: number; at?: number }
  // F-013 phase C3: a card picked from the product or article list; `pos` is an existing card node.
  | { type: 'embed'; kind: EmbedMdKind; pos?: number; at?: number }
  | { type: 'cover' };

type Message = { kind: 'error' | 'ok'; text: string; checks?: ChecklistItem[] };

const EMPTY: Draft = {
  title: '', slug: '', excerpt: '', content: '', contentFormat: 'markdown',
  coverImage: '', coverAlt: '', coverCaption: '', showCover: true, author: DEFAULT_AUTHOR,
  metaTitle: '', metaDescription: '', images: [],
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
    // F-013 phase A2: documents and local copies from before A2 get the defaults (15.3).
    coverCaption: a.coverCaption || '',
    showCover: a.showCover !== false,
    author: a.author || DEFAULT_AUTHOR,
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
    case 'embed-inline': return `Penanda harus di baris sendiri, diapit baris kosong; tampil sebagai teks: ${w.marker}`;
    case 'embed-invalid': return `Slug penanda hanya boleh huruf kecil, angka, dan tanda hubung; tampil sebagai teks: ${w.marker}`;
    case 'embed-limit': return `Lebih dari 10 kartu produk/artikel; penanda ini tidak ditampilkan: ${w.marker}`;
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
  const topbarRef = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  // Dialogs return focus to the editor; ProseMirror puts its own selection back when it regains focus.
  const editorFocusRef = useMemo(() => ({ get current() { try { return editor?.view.dom ?? null; } catch { return null; } } }) as RefObject<HTMLElement>, [editor]);

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [server, setServer] = useState<ServerArticle | null>(null);
  const [loading, setLoading] = useState(Boolean(routeSlug));
  const [loadError, setLoadError] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [preview, setPreview] = useState<{ blocks: RenderBlock[]; embeds: ArticleEmbeds; warnings: RenderWarning[] } | null>(null);
  const [previewState, setPreviewState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [previewError, setPreviewError] = useState('');
  const [busy, setBusy] = useState<null | 'save' | 'publish' | 'unpublish'>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [coverWidth, setCoverWidth] = useState<number | null>(null);
  const [restore, setRestore] = useState<LocalCopy<Draft> | null>(null);
  // F-013 phase C3: products and articles for cards and links, read once when first needed.
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState('');
  const catalogRef = useRef<{ data: Catalog | null; loading: boolean; listeners: Set<() => void> }>({ data: null, loading: false, listeners: new Set() });
  const ensureCatalog = useCallback(() => {
    const c = catalogRef.current;
    if (c.data || c.loading) return;
    c.loading = true;
    setCatalogError('');
    loadCatalog()
      .then(data => {
        c.data = data;
        setCatalog(data);
        c.listeners.forEach(fn => fn());
      })
      .catch(() => setCatalogError('Daftar produk dan artikel gagal dimuat. Tutup dialog, cek koneksi, lalu coba lagi.'))
      .finally(() => { c.loading = false; });
  }, []);
  // An article that already has cards needs the list for their names; others read it on the first dialog.
  const hasCards = /\[\[(?:produk|artikel):/i.test(draft.content);
  useEffect(() => { if (hasCards && draft.contentFormat === 'markdown') ensureCatalog(); }, [hasCards, draft.contentFormat, ensureCatalog]);
  // What the card nodes in the editor show; stable for the editor's life.
  const catalogSource = useMemo<EmbedCatalogSource>(() => ({
    get: (kind, slug) => {
      const data = catalogRef.current.data;
      if (!data) return undefined;
      return pickable(data[kind], kind, draftRef.current.slug).find(i => i.slug === slug) ?? null;
    },
    subscribe: fn => {
      catalogRef.current.listeners.add(fn);
      return () => { catalogRef.current.listeners.delete(fn); };
    },
  }), []);

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

  // The sticky toolbar sits under the sticky action bar on wider screens; the bar's height changes with messages
  // and wrapping, so it is measured (F-013 requirement 9.9, admin.css --editor-topbar-h).
  useEffect(() => {
    const bar = topbarRef.current;
    if (!bar || typeof ResizeObserver === 'undefined') return;
    const root = bar.parentElement;
    const observer = new ResizeObserver(() => root?.style.setProperty('--editor-topbar-h', `${bar.offsetHeight}px`));
    observer.observe(bar);
    return () => observer.disconnect();
  }, [loading, loadError]);

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
        body: JSON.stringify({ content: draftRef.current.content, contentFormat: draftRef.current.contentFormat, slug: draftRef.current.slug }),
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

  // Tab pattern: arrow keys move between Tulis and Pratinjau; only the selected tab is in the Tab order.
  function onTabKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const next = e.key === 'Home' ? 'write' : e.key === 'End' ? 'preview' : tab === 'write' ? 'preview' : 'write';
    if (next === 'preview') showPreview();
    else setTab('write');
    document.getElementById(next === 'preview' ? 'tab-preview' : 'tab-write')?.focus();
  }

  const onContent = useCallback((md: string) => set('content', md), [set]);
  const onEditorReady = useCallback((ed: Editor | null) => setEditor(ed), []);

  function openLink() {
    // A selected image is a node, not text; linking it would replace it with the link text (review REV-06).
    if (!editor || editor.state.selection instanceof NodeSelection) return;
    const href = editor.getAttributes('link').href as string | undefined;
    // A caret inside a link edits the whole link.
    if (href && editor.state.selection.empty) editor.chain().extendMarkRange('link').run();
    const { from, to } = editor.state.selection;
    setDialog({ type: 'link', text: editor.state.doc.textBetween(from, to, ' '), url: href, from, to });
  }

  function insertLink(text: string, url: string) {
    const current = dialog;
    setDialog(null);
    if (!editor || current?.type !== 'link') return;
    const { from, to } = current;
    const chain = editor.chain().focus();
    if (from !== to && editor.state.doc.textBetween(from, to, ' ').trim() === text) chain.setTextSelection({ from, to }).setLink({ href: url }).run();
    else chain.insertContentAt({ from, to }, { type: 'text', text, marks: [{ type: 'link', attrs: { href: url } }] }).run();
  }

  function removeLink() {
    const current = dialog;
    setDialog(null);
    if (!editor || current?.type !== 'link') return;
    editor.chain().focus().setTextSelection({ from: current.from, to: current.to }).unsetLink().run();
  }

  // A new image goes after the selection, never over it: a selected image stays (A7b, ERR-01; requirement 9.6).
  // Inside a raw block or a table it goes after that whole block, which it would otherwise split (review REV-02).
  function openImage() {
    if (!editor) return;
    const { selection } = editor.state;
    const depth = splittableDepth(selection);
    setDialog({ type: 'image', at: depth ? selection.$to.after(depth) : selection.to });
  }
  const onEditImage = (pos: number) => setDialog({ type: 'image', pos });

  // Cards go between top-level blocks, after the block holding the selection (requirement 21.2).
  function openEmbed(kind: EmbedMdKind) {
    if (!editor) return;
    let cards = 0;
    editor.state.doc.forEach(n => { if (n.type.name === 'articleEmbed') cards++; });
    if (cards >= MAX_EMBEDS) {
      setMessage({ kind: 'error', text: `Maksimal ${MAX_EMBEDS} kartu produk dan artikel per artikel.` });
      return;
    }
    const { selection } = editor.state;
    setDialog({ type: 'embed', kind, at: selection.$to.depth ? selection.$to.after(1) : selection.to });
    ensureCatalog();
  }
  const onEditEmbed = (pos: number) => {
    const node = editor?.state.doc.nodeAt(pos);
    if (!node) return;
    setDialog({ type: 'embed', kind: node.attrs.kind === 'artikel' ? 'artikel' : 'produk', pos });
    ensureCatalog();
  };

  function onEmbedConfirm(slug: string) {
    const current = dialog;
    setDialog(null);
    if (!editor || current?.type !== 'embed') return;
    const attrs = { kind: current.kind, slug };
    if (current.pos !== undefined) {
      const pos = current.pos;
      editor.chain().focus().command(({ tr }) => { tr.setNodeMarkup(pos, undefined, attrs); return true; }).setNodeSelection(pos).run();
    } else {
      editor.chain().focus().insertContentAt(current.at ?? editor.state.selection.to, { type: 'articleEmbed', attrs }).run();
    }
  }

  // Panel edits rewrite that exact match (by offsets and original text), so a duplicate image elsewhere stays;
  // the visual editor then reloads the changed Markdown as one undo step.
  function replaceImage(image: BodyImage, markdown: string): boolean {
    const content = draftRef.current.content;
    if (content.slice(image.start, image.end) !== image.raw) {
      setMessage({ kind: 'error', text: 'Isi artikel berubah sejak gambar dibuka. Buka lagi dari daftar gambar.' });
      return false;
    }
    set('content', content.slice(0, image.start) + markdown + content.slice(image.end));
    return true;
  }

  function onImageConfirm(value: ImageDialogValue) {
    const current = dialog;
    setDialog(null);
    if (current?.type !== 'image') return;
    const attrs = { src: value.url, alt: value.alt, caption: value.caption, posisi: value.layout.posisi, ukuran: value.layout.ukuran };
    if (current.image) {
      // F-013: the canonical attribute block for the chosen layout, none for the default (5.3, 5.4).
      if (!replaceImage(current.image, imageMarkdown(value.url, value.alt, value.caption, value.layout))) return;
    } else if (editor && current.pos !== undefined) {
      const pos = current.pos;
      editor.chain().focus().command(({ tr }) => { tr.setNodeMarkup(pos, undefined, attrs); return true; }).setNodeSelection(pos).run();
    } else if (editor) {
      editor.chain().focus().insertContentAt(current.at ?? editor.state.selection.to, { type: 'articleImage', attrs }).run();
    }
    if (value.asCover) {
      setDraft(d => ({ ...d, coverImage: value.url, coverAlt: d.coverAlt || value.alt }));
      if (value.width) setCoverWidth(value.width);
    }
  }

  // "Lihat" in the side panel: select that image in the editor (same src and alt, n-th occurrence).
  function jumpTo(image: BodyImage) {
    setTab('write');
    if (!editor) return;
    const nth = imageOccurrence(images, image);
    let found = -1;
    let seen = 0;
    editor.state.doc.descendants((node, pos) => {
      if (found >= 0) return false;
      if (node.type.name === 'articleImage' && node.attrs.src === image.url && node.attrs.alt === image.alt && seen++ === nth) found = pos;
      return true;
    });
    requestAnimationFrame(() => {
      if (found >= 0) editor.chain().focus().setNodeSelection(found).scrollIntoView().run();
      else setMessage({ kind: 'error', text: 'Gambar ini ada di dalam blok Markdown mentah, jadi tidak bisa dipilih. Cari teksnya di editor.' });
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
  // The image dialog for a node opened from the editor reads that node's attributes.
  const node = dialog?.type === 'image' && dialog.pos !== undefined ? editor?.state.doc.nodeAt(dialog.pos)?.attrs : undefined;
  const imageInitial = dialog?.type !== 'image' ? undefined
    : dialog.image ? { url: dialog.image.url, alt: dialog.image.alt, caption: dialog.image.caption, fileName: dialog.image.fileName, layout: dialog.image.layout }
      : node ? { url: node.src, alt: node.alt, caption: node.caption, fileName: String(node.src).split(/[/\\]/).pop(), layout: { posisi: node.posisi, ukuran: node.ukuran } }
        : undefined;
  const serverNewer = Boolean(restore && server && (server.updatedAt ?? 0) > (restore.baseUpdatedAt ?? 0));

  return (
    <div className="article-editor">
      <div className="article-editor-topbar" ref={topbarRef}>
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

          <label className="form-label article-editor-body-label" htmlFor={isMarkdown ? undefined : 'article-content'} id="article-content-label">Isi artikel *</label>
          <div className="article-editor-body">
            <div className="article-editor-tabs">
              <div role="tablist" aria-label="Mode isi" className="article-editor-tablist" onKeyDown={onTabKey}>
                <button type="button" role="tab" id="tab-write" aria-selected={tab === 'write'} aria-controls="panel-write" tabIndex={tab === 'write' ? 0 : -1} className={tab === 'write' ? 'is-active' : ''} onClick={() => setTab('write')}>Tulis</button>
                <button type="button" role="tab" id="tab-preview" aria-selected={tab === 'preview'} aria-controls="panel-preview" tabIndex={tab === 'preview' ? 0 : -1} className={tab === 'preview' ? 'is-active' : ''} onClick={showPreview}>Pratinjau</button>
              </div>
              {tab === 'write' && isMarkdown && <MarkdownToolbar editor={editor} onLink={openLink} onImage={openImage} onEmbed={openEmbed} />}
            </div>
            {/* Both panels stay in the DOM so aria-controls always points at an element. */}
            <div role="tabpanel" id="panel-write" aria-labelledby="tab-write" hidden={tab !== 'write'}>
              {isMarkdown ? (
                // F-013 phase B: the visual editor; content stays Markdown (requirements 9.1, 10.1).
                <VisualEditor value={draft.content} onChange={onContent} onReady={onEditorReady} onLink={openLink} onEditImage={onEditImage} onEditEmbed={onEditEmbed} catalog={catalogSource} />
              ) : (
                <textarea
                  id="article-content"
                  ref={textareaRef}
                  className="form-input article-editor-textarea"
                  value={draft.content}
                  onChange={e => set('content', e.target.value)}
                  rows={16}
                  maxLength={50000}
                  spellCheck
                  placeholder="Setiap baris menjadi satu paragraf."
                />
              )}
            </div>
            <div role="tabpanel" id="panel-preview" aria-labelledby="tab-preview" className="article-editor-preview-wrap" hidden={tab !== 'preview'}>
                {previewState === 'loading' && <p className="article-editor-help">Menyiapkan pratinjau...</p>}
                {previewState === 'error' && <p className="form-error" role="alert">{previewError}</p>}
                {preview && preview.warnings.length > 0 && (
                  <ul className="article-editor-warnings">
                    {preview.warnings.map((w, i) => <li key={i}>{warningText(w)}</li>)}
                  </ul>
                )}
                {preview && previewState !== 'loading' && (isMarkdown ? (
                  // F-013 phase A2 (16.1): same head component and classes as /blog/{slug}, from the unsaved draft.
                  <div className="blog-detail blog-detail--column">
                    <ArticleHead article={{ ...draft, publishedAt: server?.publishedAt ?? null, createdAt: server?.createdAt ?? null }} />
                    {/* Already sanitized by the server (lib/markdown.ts); the client does not transform it. */}
                    <ArticleBody blocks={preview.blocks} embeds={preview.embeds} className="blog-detail-content article-body" adminPreview />
                  </div>
                ) : (
                  <ArticleBody blocks={preview.blocks} embeds={preview.embeds} className="article-body article-body-plain" adminPreview />
                ))}
            </div>
            <p className="article-editor-footer">
              {words.toLocaleString('id-ID')} kata · ±{readingMinutes(words)} menit baca · {images.length} gambar
              {/* The textarea's maxLength is gone for the visual editor; the server still rejects more (review REV-10). */}
              {draft.content.length > 50000 && <span className="is-warn"> · Isi melebihi 50.000 karakter, tidak bisa disimpan. Pecah jadi dua artikel.</span>}
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
              <input id="article-author" className="form-input" value={draft.author} maxLength={80} placeholder={DEFAULT_AUTHOR} aria-describedby={isMarkdown ? 'article-author-help' : undefined} onChange={e => set('author', e.target.value)} />
              {/* Plain articles show no byline (12.5), so the hint is for Markdown articles only (review N-2). */}
              {isMarkdown && <p className="article-editor-help" id="article-author-help">Tampil di bawah judul: "Oleh {draft.author.trim() || DEFAULT_AUTHOR}". Kosong berarti {DEFAULT_AUTHOR}.</p>}
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
                  <button type="button" className="btn btn-ghost" onClick={() => setDraft(d => ({ ...d, coverImage: '', coverAlt: '', coverCaption: '' }))} style={{ fontSize: 11, padding: '6px 14px' }}>Hapus</button>
                )}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="article-cover-alt">Teks alt sampul *</label>
                <input id="article-cover-alt" className="form-input" value={draft.coverAlt} maxLength={200} onChange={e => set('coverAlt', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="article-cover-caption">Keterangan / kredit foto sampul</label>
                <input id="article-cover-caption" className="form-input" value={draft.coverCaption} maxLength={200} onChange={e => set('coverCaption', e.target.value)} />
              </div>
              <label className="article-editor-check">
                <input type="checkbox" checked={draft.showCover} onChange={e => set('showCover', e.target.checked)} aria-describedby="article-show-cover-help" /> Tampilkan sampul di halaman artikel
              </label>
              <p className="article-editor-help" id="article-show-cover-help">Sampul tetap dipakai di kartu blog, beranda, dan pratinjau link.</p>
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
        <LinkDialog
          initialText={dialog.text}
          initialUrl={dialog.url}
          returnFocusRef={editorFocusRef}
          onClose={() => setDialog(null)}
          onInsert={insertLink}
          onRemove={removeLink}
          catalog={catalog}
          catalogError={catalogError}
          currentSlug={draft.slug}
          onNeedCatalog={ensureCatalog}
        />
      )}
      {dialog?.type === 'embed' && (
        <EmbedDialog
          kind={dialog.kind}
          initialSlug={dialog.pos !== undefined ? editor?.state.doc.nodeAt(dialog.pos)?.attrs.slug : undefined}
          currentSlug={draft.slug}
          catalog={catalog}
          catalogError={catalogError}
          returnFocusRef={editorFocusRef}
          onClose={() => setDialog(null)}
          onConfirm={onEmbedConfirm}
        />
      )}
      {dialog?.type === 'image' && (
        <ImageDialog
          title={imageInitial ? (isAllowedImageUrl(imageInitial.url) ? 'Edit gambar' : 'Unggah gambar') : 'Sisipkan gambar'}
          kind="body"
          initial={imageInitial}
          returnFocusRef={editorFocusRef}
          onClose={() => setDialog(null)}
          onConfirm={onImageConfirm}
        />
      )}
      {dialog?.type === 'cover' && (
        <ImageDialog
          title="Gambar sampul"
          kind="cover"
          initial={{ url: draft.coverImage, alt: draft.coverAlt, caption: draft.coverCaption }}
          returnFocusRef={coverButtonRef}
          onClose={() => setDialog(null)}
          onConfirm={v => {
            setDialog(null);
            setDraft(d => ({ ...d, coverImage: v.url, coverAlt: v.alt, coverCaption: v.caption }));
            if (v.width) setCoverWidth(v.width);
          }}
        />
      )}
    </div>
  );
}
