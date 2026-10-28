'use client';

import { useEffect, useMemo, useRef } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import { Fragment, Slice } from '@tiptap/pm/model';
import type { Selection } from '@tiptap/pm/state';
import { articleExtensions } from './editor-extensions';
import { countRawBlocks, docToMarkdown, markdownToDoc } from './markdown-doc';

interface VisualEditorProps {
  // The Markdown in draft.content; the editor shows it and reports edits as Markdown (requirement 10.1).
  value: string;
  onChange: (markdown: string) => void;
  onReady: (editor: Editor | null) => void;
  // Ctrl+K and the image node's "Edit gambar" button / Enter (B-8, B-9).
  onLink: () => void;
  onEditImage: (pos: number) => void;
}

/** Depth of the raw block or table around the selection end, or 0: blocks must not be inserted inside those. */
export function splittableDepth(selection: Selection): number {
  const $to = selection.$to;
  for (let d = $to.depth; d > 0; d--) if (['rawMarkdown', 'table'].includes($to.node(d).type.name)) return d;
  return 0;
}
const insideSplittable = (selection: Selection) => splittableDepth(selection) > 0;

// A naskah pasted as text (B-6): headings, images, lists, or tables at a line start.
const MARKDOWN_SIGNS = /^(#{1,6} |!\[|[-*+] |\d+[.)] |\|)/m;

export default function VisualEditor({ value, onChange, onReady, onLink, onEditImage }: VisualEditorProps) {
  const callbacks = useRef({ onChange, onLink, onEditImage });
  callbacks.current = { onChange, onLink, onEditImage };
  // What the editor last reported (or was loaded with), the Markdown it was loaded from, and that Markdown's
  // canonical form. A document equal to the loaded one reports the loaded Markdown, so opening an article, or
  // undoing back to it, never changes content (B-5, requirement 10.5).
  const lastEmitted = useRef<string | null>(null);
  const loaded = useRef({ markdown: '', canonical: '' });

  const extensions = useMemo(() => articleExtensions({ onEdit: pos => callbacks.current.onEditImage(pos) }), []);
  const editor = useEditor({
    extensions,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        id: 'article-content',
        class: 'article-body article-editor-visual',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-labelledby': 'article-content-label',
        spellcheck: 'true',
      },
      // The caret scrolls clear of the sticky admin bar and toolbar (up to ~200 px on phones, requirement 9.9).
      scrollThreshold: { top: 200, right: 0, bottom: 40, left: 0 },
      scrollMargin: { top: 200, right: 0, bottom: 40, left: 0 },
      handleKeyDown: (_view, e) => {
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          callbacks.current.onLink();
          return true;
        }
        return false;
      },
      handlePaste: (view, e) => {
        const text = e.clipboardData?.getData('text/plain') ?? '';
        const html = e.clipboardData?.getData('text/html') ?? '';
        if (!text || (html && (html.includes('data-pm-slice') || !MARKDOWN_SIGNS.test(text)))) return false;
        // A URL over selected text becomes a link (Tiptap linkOnPaste, review REV-09). In a raw block or a table
        // cell, blocks would split it, so the default plain-text paste applies there (review REV-02).
        if (!view.state.selection.empty && /^https?:\/\/\S+$/.test(text.trim())) return false;
        if (insideSplittable(view.state.selection)) return false;
        const nodes = markdownToDoc(text).content ?? [];
        const fragment = Fragment.fromJSON(view.state.schema, nodes);
        // Open paragraph ends merge into the paragraph at the caret, so pasting one sentence stays inline.
        const open = (i: number) => (nodes[i]?.type === 'paragraph' ? 1 : 0);
        view.dispatch(view.state.tr.replaceSelection(new Slice(fragment, open(0), open(nodes.length - 1))).scrollIntoView());
        return true;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const md = docToMarkdown(ed.getJSON());
      const out = md === loaded.current.canonical ? loaded.current.markdown : md;
      if (out === lastEmitted.current) return;
      lastEmitted.current = out;
      callbacks.current.onChange(out);
    },
  });

  // Loads value into the editor on start and whenever it changes from outside (restore, save, the image panel).
  useEffect(() => {
    if (!editor || value === lastEmitted.current) return;
    const first = lastEmitted.current === null;
    lastEmitted.current = value;
    // The first load is not an undo step; later outside changes are, so Ctrl+Z can take them back.
    editor.chain().setMeta('addToHistory', !first).setContent(markdownToDoc(value), { emitUpdate: false }).run();
    loaded.current = { markdown: value, canonical: docToMarkdown(editor.getJSON()) };
  }, [editor, value]);

  useEffect(() => {
    onReady(editor);
    return () => onReady(null);
  }, [editor, onReady]);

  const rawBlocks = useEditorState({ editor, selector: ({ editor: ed }) => (ed ? countRawBlocks(ed.getJSON()) : 0) }) ?? 0;

  return (
    <>
      {rawBlocks > 0 && (
        <p className="article-editor-help is-warn article-editor-raw-notice" role="status">
          {rawBlocks} blok ditampilkan sebagai Markdown mentah karena di luar format editor (misalnya kode, kutipan, atau HTML). Isinya tetap tersimpan apa adanya; cek hasilnya di Pratinjau.
        </p>
      )}
      <EditorContent editor={editor} />
    </>
  );
}
