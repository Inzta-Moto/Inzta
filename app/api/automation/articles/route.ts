import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { parseArticleInput } from '@/lib/article-input';
import { isAlreadyExists } from '@/lib/firestore-errors';
import { ARTICLE_SERVER_FAIL, serverPublishFailures } from '@/lib/admin-articles';
import { allowAutomationRequest, requireAutomationToken } from '@/lib/automation-auth';
import { revalidateArticlePaths } from '@/lib/revalidate';

// F-010 (ADR-0020): `node scripts/terbit-artikel.mjs` in inzta-hq creates an article here, published by default or as
// a draft with `publish: false`. It can only create: an existing slug is 409, and nothing here updates, unpublishes,
// or deletes. Validation, publish checks, and revalidation are the same code the admin editor uses.
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 100 * 1024;

const tooLarge = () => NextResponse.json({ error: `Data artikel lebih dari ${MAX_BODY_BYTES / 1024} KB` }, { status: 413 });

export async function POST(request: Request) {
  // Content-Length is checked before anything is read; the real size is checked again below because the header
  // can be absent (chunked) or wrong.
  if (Number(request.headers.get('content-length') || 0) > MAX_BODY_BYTES) return tooLarge();

  const auth = requireAutomationToken(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!allowAutomationRequest(auth.actor)) {
    return NextResponse.json({ error: 'Terlalu banyak permintaan. Coba lagi dalam satu jam.' }, { status: 429 });
  }

  const raw = await request.text().catch(() => '');
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) return tooLarge();
  let body: Record<string, unknown>;
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('not an object');
    body = value;
  } catch {
    return NextResponse.json({ error: 'body: format data tidak valid' }, { status: 400 });
  }

  // Draft is the default when the field is missing, so an old or broken client can never publish by accident.
  if (body.publish != null && typeof body.publish !== 'boolean') {
    return NextResponse.json({ error: 'publish: harus true atau false' }, { status: 400 });
  }
  const publish = body.publish === true;

  const parsed = parseArticleInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const fields = parsed.value;

  try {
    if (publish) {
      // Same blocking checks as the "Terbitkan" button (C-1 to C-9, cards resolved on the server).
      const checks = await serverPublishFailures({
        title: fields.title,
        slug: fields.slug,
        excerpt: fields.excerpt,
        content: fields.content,
        contentFormat: 'markdown',
        coverImage: fields.coverImage,
        coverAlt: fields.coverAlt,
        metaTitle: fields.metaTitle,
        metaDescription: fields.metaDescription,
      });
      if (checks.length) return NextResponse.json({ error: 'Belum lolos cek sebelum terbit', checks }, { status: 400 });
    }

    const now = new Date().toISOString();
    const item = {
      ...fields,
      contentFormat: 'markdown' as const,
      images: [],
      status: publish ? ('published' as const) : ('draft' as const),
      source: 'automation' as const,
      createdBy: auth.actor,
      createdAt: now,
      updatedAt: now,
      ...(publish ? { publishedAt: now, publishedBy: auth.actor } : {}),
    };
    // create() fails atomically when the slug exists, so a published article can never be overwritten from here.
    await getAdminDb().collection('articles').doc(fields.slug).create(item);
    if (publish) revalidateArticlePaths(fields.slug);
    console.info('Automation article created', { actor: auth.actor, slug: fields.slug, status: item.status });

    return NextResponse.json(
      {
        status: 'success',
        slug: fields.slug,
        articleStatus: item.status,
        url: `/blog/${fields.slug}`,
        editUrl: `/admin/artikel/${fields.slug}`,
        previewUrl: `/admin/pratinjau/${fields.slug}`,
      },
      { status: 201 },
    );
  } catch (error: any) {
    if (isAlreadyExists(error)) {
      return NextResponse.json({ error: 'slug: sudah dipakai artikel lain' }, { status: 409 });
    }
    console.error('Automation article error:', { actor: auth.actor, slug: fields.slug, error });
    return NextResponse.json({ error: ARTICLE_SERVER_FAIL }, { status: 500 });
  }
}
