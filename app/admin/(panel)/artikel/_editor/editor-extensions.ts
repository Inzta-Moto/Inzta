// F-013 phase B: the visual editor's schema (requirements 9.1, 9.4, 9.8). No React here, so the round-trip test
// can build the same schema with getSchema(). Node and mark names match markdown-doc.ts.

import { Extension, Node, mergeAttributes } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { isAllowedImageUrl, layoutClasses, resolveLayout } from '@/lib/article-format';
import { optimizeCloudinaryUrl } from '@/lib/utils';

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
          return { src: img.getAttribute('src') || '', alt: img.getAttribute('alt') || '', caption: el.querySelector('figcaption')?.textContent?.trim() || '', ...fromClasses(el) };
        },
      },
      { tag: 'img[src]', getAttrs: el => ({ src: el.getAttribute('src') || '', alt: el.getAttribute('alt') || '' }) },
    ];
  },

  renderHTML({ HTMLAttributes: a }) {
    const classes = layoutClasses(layoutOf(a));
    const img = ['img', { src: a.src, alt: a.alt }];
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

export function articleExtensions(options: ArticleImageOptions = {}) {
  return [
    StarterKit.configure({
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
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader.extend(cellContent),
    TableCell.extend(cellContent),
    ArticleImage.configure(options),
    RawMarkdown,
    ListTightness,
  ];
}
