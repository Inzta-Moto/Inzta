import type { Token, Tokens } from 'marked';
import type { ImageLayout } from '@/types';
import { ATTR_BLOCK_RE, parseImageAttrs, resolveLayout } from '@/lib/article-format';

// Shared by the server renderer (lib/markdown.ts) and the visual editor's Markdown parser (F-013 phase B), so
// both read an image's attribute block the same way. Type-only import of marked: no runtime dependency here.

// F-013: an image token carrying the layout of the attribute block that followed it.
export type LayoutImage = Tokens.Image & { layout?: ImageLayout };

/**
 * marked splits `![alt](url){posisi=kanan}` into an image token and a text token starting with the block.
 * For every image directly followed by such a text token, store the resolved layout on the image and remove
 * the block text, so a recognised block never reaches the output (requirements 2.8, 3.1). The stripped prefix
 * is "{...}" without braces or line breaks inside one text token, so it holds no Markdown escapes.
 */
export function attachImageLayouts(children: Token[] | undefined) {
  if (!children) return;
  for (let i = 0; i < children.length - 1; i++) {
    const img = children[i];
    const next = children[i + 1];
    if (img.type !== 'image' || next.type !== 'text') continue;
    const m = ATTR_BLOCK_RE.exec(next.raw);
    if (!m) continue;
    (img as LayoutImage).layout = resolveLayout(parseImageAttrs(m[1]));
    const rest = next.raw.slice(m[0].length);
    if (rest) {
      next.raw = rest;
      (next as Tokens.Text).text = rest;
    } else {
      children.splice(i + 1, 1);
    }
  }
}
