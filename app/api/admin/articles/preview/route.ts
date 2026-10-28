import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { renderArticle } from '@/lib/markdown';
import { resolveEmbeds } from '@/lib/article-embeds';
import { isValidSlug } from '@/lib/slug';
import type { ArticleEmbeds } from '@/types';

// Renders the editor's current body with the same renderer as the public page. No Firestore write
// (F-012 requirement 12.4); F-013 phase C reads only the products and articles its markers name, in one
// getAll. The body limit keeps one request from tying up the function.
const MAX_BODY_BYTES = 100 * 1024;

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tooLarge = () => NextResponse.json({ error: 'Isi terlalu besar untuk pratinjau (maksimal 100 KB)' }, { status: 413 });
  // The header check rejects large bodies before reading them; the byte count covers a missing header.
  if (Number(request.headers.get('content-length') || 0) > MAX_BODY_BYTES) return tooLarge();
  const raw = await request.text().catch(() => '');
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return tooLarge();
  let body: { content?: unknown; contentFormat?: unknown; slug?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'body: format data tidak valid' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'body: format data tidak valid' }, { status: 400 });

  const content = typeof body.content === 'string' ? body.content : '';
  const contentFormat = body.contentFormat === 'markdown' ? 'markdown' : 'plain';
  const result = renderArticle({ content, contentFormat });
  // The article being edited never shows itself as "Baca juga". A failed read only drops the cards (19.4).
  let embeds: ArticleEmbeds = { products: {}, articles: {} };
  // Tells the preview that missing cards are a read failure, not missing products (review REV-03).
  let embedsError = false;
  try {
    embeds = await resolveEmbeds(result.blocks, { exclude: isValidSlug(body.slug) ? body.slug : undefined });
  } catch (error) {
    console.error('preview: embeds could not be read', { error: (error as Error)?.message });
    embedsError = true;
  }
  return NextResponse.json({ ...result, embeds, embedsError }, { status: 200 });
}
