// F-013 phase B: the visual editor's schema (requirements 9.1, 9.4, 9.8). No React here, so the round-trip test
// can build the same schema with getSchema(). Node and mark names match markdown-doc.ts.

import { Extension, Node, mergeAttributes } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { isAllowedImageUrl, layoutClasses, resolveLayout } from '@/lib/article-format';
import { optimizeCloudinaryUrl } from '@/lib/utils';
import { SLUG_PATTERN } from '@/lib/slug';

export interface ArticleImageOptions {
  // Opens the image dialog for the image node at `pos` (B-8).
  onEdit?: (pos: number) => void;
}

const layoutOf = (attrs: Record<string, any>) => resolveLayout({ posisi: attrs.posisi, ukuran: attrs.ukuran });

/** An article image: <figure> with the phase A layout classes, an <img>, and an optional caption. */
export const ArticleImage = Node.create<ArticleImageOptions>({
  name: 'articleImage',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return { onEdit: undefined };
  },

  addAttributes() {
    return { src: { default: '' }, alt: { default: '' }, caption: { default: '' }, posisi: { default: 'tengah' }, ukuran: { default: 'penuh' } };
  },

  parseHTML() {
    const fromClasses = (el: HTMLElement) => {
      const has = (c: string) => el.classList.contains(`article-figure--${c}`);
      return resolveLayout({
        posisi: has('kiri') ? 'kiri' : has('kanan') ? 'kanan' : 'tengah',
        ukuran: has('kecil') ? 'kecil' : has('sedang') ? 'sedang' : has('besar') ? 'besar' : 'penuh',
      });
    };
    return [
      {
        tag: 'figure',
        getAttrs: el => {
          const img = el.querySelector('img');
          if (!img) return false;
          return { src: img.getAttribute('src') || img.getAttribute('data-src') || '', alt: img.getAttribute('alt') || '', caption: el.querySelector('figcaption')?.textContent?.trim() || '', ...fromClasses(el) };
        },
      },
      { tag: 'img[src]', getAttrs: el => ({ src: el.getAttribute('src') || '', alt: el.getAttribute('alt') || '' }) },
      { tag: 'img[data-src]', getAttrs: el => ({ src: el.getAttribute('data-src') || '', alt: el.getAttribute('alt') || '' }) },
    ];
  },

  renderHTML({ HTMLAttributes: a }) {
    const classes = layoutClasses(layoutOf(a));
    // Serialized HTML (copy, drag) is parsed into detached elements, which still load their src; placeholders and other
    // hosts would request a missing or foreign file, so they keep the path in data-src.
    const img = ['img', isAllowedImageUrl(a.src) ? { src: a.src, alt: a.alt } : { 'data-src': a.src, alt: a.alt }];
    return ['figure', classes.length ? { class: classes.join(' ') } : {}, img, ...(a.caption ? [['figcaption', {}, a.caption]] : [])] as any;
  },

  addKeyboardShortcuts() {
    return {
      // Enter on a selected image opens its dialog (B-8).
      Enter: ({ editor }) => {
        const sel = editor.state.selection;
        if (!(sel instanceof NodeSelection) || sel.node.type.name !== this.name || !this.options.onEdit) return false;
        this.options.onEdit(sel.from);
        return true;
      },
    };
  },

  addNodeView() {
    return ({ node: initial, getPos }) => {
      let node = initial;
      const dom = document.createElement('figure');
      dom.className = 'article-editor-figure';
      const render = () => {
        const a = node.attrs;
        dom.className = ['article-editor-figure', ...layoutClasses(layoutOf(a))].join(' ');
        const parts: HTMLElement[] = [];
        if (isAllowedImageUrl(a.src)) {
          const img = document.createElement('img');
          img.src = optimizeCloudinaryUrl(a.src, 800);
          img.alt = a.alt;
          img.draggable = false;
          parts.push(img);
        } else {
          // Placeholders (ADR-0013) and other hosts cannot load; say so instead of a broken image (9.4).
          const box = document.createElement('div');
          box.className = 'article-editor-figure-missing';
          const file = String(a.src).split(/[/\\]/).pop() || a.src;
          box.textContent = /^GAMBAR-\d+$/i.test(a.src) || /^(?:\.{1,2}\/)*images\//i.test(a.src) ? `Belum diunggah: ${file}` : `Bukan dari panel INZTA, unggah ulang: ${file}`;
          if (a.alt) box.title = a.alt;
          parts.push(box);
        }
        if (a.caption) {
          const cap = document.createElement('figcaption');
          cap.textContent = a.caption;
          parts.push(cap);
        }
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'btn btn-ghost article-editor-figure-edit';
        edit.textContent = 'Edit gambar';
        edit.contentEditable = 'false';
        edit.addEventListener('mousedown', e => e.preventDefault());
        edit.addEventListener('click', () => {
          const pos = typeof getPos === 'function' ? getPos() : undefined;
          if (typeof pos === 'number') this.options.onEdit?.(pos);
        });
        parts.push(edit);
        dom.replaceChildren(...parts);
      };
      render();
      return {
        dom,
        update: updated => {
          if (updated.type !== node.type) return false;
          node = updated;
          render();
          return true;
        },
        selectNode: () => dom.classList.add('is-selected'),
        deselectNode: () => dom.classList.remove('is-selected'),
        stopEvent: e => e.target instanceof HTMLElement && e.target.closest('button') !== null,
        ignoreMutation: () => true,
      };
    };
  },
});

// F-013 phase C3: a [[produk:slug]] / [[artikel:slug]] card (requirement 21). `kind` uses the Markdown keyword.
export type EmbedMdKind = 'produk' | 'artikel';

// What the editor knows about a card's target: undefined while the list is loading, null when the slug is not
// in it, `unavailable` when the public page will not show the card (inactive, draft, this article).
export interface EmbedInfo {
  title: string;
  image: string | null;
  unavailable?: string;
}

export interface EmbedCatalogSource {
  get: (kind: EmbedMdKind, slug: string) => EmbedInfo | null | undefined;
  // Node views re-render when the list arrives.
  subscribe: (fn: () => void) => () => void;
}

export interface ArticleEmbedOptions {
  // Opens the picker for the card at `pos` ("Ganti", or Enter on a selected card).
  onEdit?: (pos: number) => void;
  catalog?: EmbedCatalogSource;
}

export const isEmbedKind = (v: unknown): v is EmbedMdKind => v === 'produk' || v === 'artikel';
export const embedPath = (kind: EmbedMdKind, slug: string) => `/${kind === 'produk' ? 'produk' : 'blog'}/${slug}`;

/**
 * A product or "Baca juga" card. Group `embed` is allowed only directly in the document (ArticleDocument), so a
 * card can never end up inside a list or a table cell, where the renderer would show the marker as text (17.3).
 */
export const ArticleEmbed = Node.create<ArticleEmbedOptions>({
  name: 'articleEmbed',
  group: 'embed',
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return { onEdit: undefined, catalog: undefined };
  },

  addAttributes() {
    return { kind: { default: 'produk' }, slug: { default: '' } };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-embed]',
        getAttrs: el => {
          const kind = el.getAttribute('data-embed');
          const slug = el.getAttribute('data-slug') || '';
          return isEmbedKind(kind) && SLUG_PATTERN.test(slug) ? { kind, slug } : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes: a }) {
    return ['div', { 'data-embed': a.kind, 'data-slug': a.slug }, `[[${a.kind}:${a.slug}]]`];
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const sel = editor.state.selection;
        if (!(sel instanceof NodeSelection) || sel.node.type.name !== this.name || !this.options.onEdit) return false;
        this.options.onEdit(sel.from);
        return true;
      },
    };
  },

  addNodeView() {
    return ({ node: initial, getPos, editor }) => {
      let node = initial;
      const dom = document.createElement('div');
      dom.contentEditable = 'false';
      const pos = () => (typeof getPos === 'function' ? getPos() : undefined);
      const button = (label: string, onClick: () => void) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn btn-ghost article-editor-embed-btn';
        b.textContent = label;
        b.addEventListener('mousedown', e => e.preventDefault());
        b.addEventListener('click', onClick);
        return b;
      };
      const render = () => {
        const kind: EmbedMdKind = isEmbedKind(node.attrs.kind) ? node.attrs.kind : 'produk';
        const slug = String(node.attrs.slug);
        const info = this.options.catalog?.get(kind, slug);
        const hidden = info === null ? 'Tidak ditemukan' : info?.unavailable;
        dom.className = `article-editor-embed${hidden ? ' is-missing' : ''}`;
        const parts: HTMLElement[] = [];
        if (info?.image && /^https:\/\//.test(info.image)) {
          const img = document.createElement('img');
          img.src = optimizeCloudinaryUrl(info.image, 120, 120);
          img.alt = '';
          img.draggable = false;
          parts.push(img);
        }
        const text = document.createElement('span');
        text.className = 'article-editor-embed-text';
        const label = document.createElement('span');
        label.className = 'article-editor-embed-label';
        label.textContent = kind === 'produk' ? 'Kartu produk' : 'Kartu Baca juga';
        const title = document.createElement('strong');
        title.textContent = info ? info.title : slug;
        const meta = document.createElement('span');
        meta.className = 'article-editor-embed-meta';
        meta.textContent = hidden ? `${hidden}: ${embedPath(kind, slug)}. Kartu tidak tampil di halaman publik.` : embedPath(kind, slug);
        text.append(label, title, meta);
        parts.push(text);
        parts.push(button('Ganti', () => { const p = pos(); if (typeof p === 'number') this.options.onEdit?.(p); }));
        parts.push(button('Hapus', () => {
          const p = pos();
          if (typeof p === 'number') editor.chain().focus().deleteRange({ from: p, to: p + node.nodeSize }).run();
        }));
        dom.replaceChildren(...parts);
      };
      render();
      const unsubscribe = this.options.catalog?.subscribe(render);
      return {
        dom,
        update: updated => {
          if (updated.type !== node.type) return false;
          node = updated;
          render();
          return true;
        },
        selectNode: () => dom.classList.add('is-selected'),
        deselectNode: () => dom.classList.remove('is-selected'),
        stopEvent: e => e.target instanceof HTMLElement && e.target.closest('button') !== null,
        ignoreMutation: () => true,
        destroy: () => unsubscribe?.(),
      };
    };
  },
});

// Cards sit only between top-level blocks (see ArticleEmbed).
const ArticleDocument = Node.create({ name: 'doc', topNode: true, content: '(block | embed)+' });

/** Markdown the editor cannot represent, kept verbatim and editable as text (B-4, requirement 9.8). */
export const RawMarkdown = Node.create({
  name: 'rawMarkdown',
  group: 'block',
  content: 'text*',
  marks: '',
  code: true,
  defining: true,

  parseHTML() {
    return [{ tag: 'pre[data-raw-markdown]', preserveWhitespace: 'full' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['pre', mergeAttributes(HTMLAttributes, { 'data-raw-markdown': '', class: 'article-editor-raw', 'aria-label': 'Markdown mentah' }), 0];
  },
});

/** Tight lists (no blank line between items) render differently from loose ones, so the editor keeps the choice. */
const ListTightness = Extension.create({
  name: 'listTightness',
  addGlobalAttributes() {
    return [
      {
        types: ['bulletList', 'orderedList'],
        attributes: {
          tight: {
            default: true,
            parseHTML: el => !el.hasAttribute('data-loose'),
            renderHTML: attrs => (attrs.tight === false ? { 'data-loose': '' } : {}),
          },
        },
      },
    ];
  },
});

// Cells hold text only, as a GFM pipe table can (no lists or images in a cell).
const cellContent = { content: 'paragraph+' };

export function articleExtensions(options: ArticleImageOptions & { onEditEmbed?: (pos: number) => void; catalog?: EmbedCatalogSource } = {}) {
  return [
    ArticleDocument,
    StarterKit.configure({
      document: false,
      // Outside the F-012 subset: the sanitizer drops these tags, so the editor must not create them.
      blockquote: false,
      code: false,
      codeBlock: false,
      horizontalRule: false,
      strike: false,
      underline: false,
      heading: { levels: [2, 3] },
      link: { openOnClick: false, autolink: false, linkOnPaste: true, HTMLAttributes: { rel: null, target: null } },
    }),
    // Tab in the last cell leaves the table instead of adding a row, so keyboard users are never trapped.
    Table.extend({
      addKeyboardShortcuts() {
        return { ...this.parent?.(), Tab: () => this.editor.commands.goToNextCell(), 'Shift-Tab': () => this.editor.commands.goToPreviousCell() };
      },
    }).configure({ resizable: false }),
    TableRow,
    TableHeader.extend(cellContent),
    TableCell.extend(cellContent),
    ArticleImage.configure({ onEdit: options.onEdit }),
    ArticleEmbed.configure({ onEdit: options.onEditEmbed, catalog: options.catalog }),
    RawMarkdown,
    ListTightness,
  ];
}
