import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { allowAutomationRequest, requireAutomationToken } from '@/lib/automation-auth';
import { revalidateProductPaths } from '@/lib/revalidate';
import {
  MAX_PRODUCT_BODY_BYTES,
  changedFields,
  currentTextValues,
  parseProductPatchBody,
  versionOf,
  type ProductTextField,
  type ProductTextPatch,
  type ProductTextValues,
} from '@/lib/product-automation';

// F-023 (ADR-0033): `node scripts/update-produk.mjs` in inzta-hq updates the name, description, and motor categories
// of existing products here. One request carries every product of a run and is written in one Firestore batch, so a
// run is applied completely or not at all. A dry run (the default) only reads and returns the stored values.
// Nothing here creates or deletes a product, or touches price, stock, variants, photos, or status.
export const dynamic = 'force-dynamic';

const tooLarge = () =>
  NextResponse.json({ error: `Data produk lebih dari ${MAX_PRODUCT_BODY_BYTES / 1024} KB` }, { status: 413 });

const FAILED_PRECONDITION = 9;
const isFailedPrecondition = (e: any) => e?.code === FAILED_PRECONDITION || /FAILED_PRECONDITION/.test(String(e?.message));

const SERVER_FAIL = 'Gagal memperbarui produk. Tidak ada yang tersimpan; coba lagi.';

export async function PATCH(request: Request) {
  if (Number(request.headers.get('content-length') || 0) > MAX_PRODUCT_BODY_BYTES) return tooLarge();

  const auth = requireAutomationToken(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!allowAutomationRequest(auth.actor)) {
    return NextResponse.json({ error: 'Terlalu banyak permintaan. Coba lagi dalam satu jam.' }, { status: 429 });
  }

  const raw = await request.text().catch(() => '');
  if (Buffer.byteLength(raw, 'utf8') > MAX_PRODUCT_BODY_BYTES) return tooLarge();
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'body: format data tidak valid' }, { status: 400 });
  }
  const parsed = parseProductPatchBody(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { dryRun, items } = parsed;

  try {
    const db = getAdminDb();
    const refs = items.map(i => db.collection('products').doc(i.slug));
    const snaps = await db.getAll(...refs);

    const missing = items.filter((_, i) => !snaps[i].exists).map(i => i.slug);
    if (missing.length) {
      return NextResponse.json({ error: 'Produk tidak ditemukan. Tidak ada yang tersimpan.', missing }, { status: 404 });
    }

    const rows: {
      patch: ProductTextPatch;
      ref: (typeof refs)[number];
      updateTime: unknown;
      version: string | null;
      isActive: boolean;
      current: ProductTextValues;
      changes: ProductTextField[];
    }[] = items.map((patch, i) => {
      const data = snaps[i].data() as Record<string, any> | undefined;
      const current = currentTextValues(data);
      return {
        patch,
        ref: refs[i],
        updateTime: snaps[i].updateTime,
        version: versionOf(snaps[i].updateTime),
        isActive: data?.isActive === true,
        current,
        changes: changedFields(patch, current),
      };
    });

    const conflicts = rows
      .filter(r => r.patch.expectedVersion !== undefined && r.patch.expectedVersion !== r.version)
      .map(r => ({ slug: r.patch.slug, version: r.version }));
    if (conflicts.length) {
      return NextResponse.json(
        { error: 'Produk berubah sejak pratinjau (mungkin disimpan admin). Jalankan pratinjau lagi. Tidak ada yang tersimpan.', conflicts },
        { status: 409 },
      );
    }

    const summary = rows.map(r => ({
      slug: r.patch.slug,
      version: r.version,
      isActive: r.isActive,
      changes: r.changes,
      current: r.current,
    }));
    if (dryRun) return NextResponse.json({ status: 'success', dryRun: true, items: summary });

    const toWrite = rows.filter(r => r.changes.length);
    if (toWrite.length) {
      const now = new Date().toISOString();
      const batch = db.batch();
      for (const r of toWrite) {
        const fields: Record<string, unknown> = { updatedAt: now };
        for (const f of r.changes) fields[f] = r.patch[f];
        // Same guard as the article editor (unchangedSince): the batch fails if any product was saved after the read.
        if (r.updateTime) batch.update(r.ref, fields, { lastUpdateTime: r.updateTime as any });
        else batch.update(r.ref, fields);
      }
      await batch.commit();
      revalidateProductPaths();
    }
    console.info('Automation products updated', {
      actor: auth.actor,
      updated: toWrite.map(r => ({ slug: r.patch.slug, fields: r.changes })),
    });

    return NextResponse.json({
      status: 'success',
      dryRun: false,
      updated: toWrite.map(r => r.patch.slug),
      unchanged: rows.filter(r => !r.changes.length).map(r => r.patch.slug),
      // `current` is the value before this write: the script keeps it as the rollback backup.
      items: summary,
    });
  } catch (error: any) {
    if (isFailedPrecondition(error)) {
      return NextResponse.json(
        { error: 'Produk disimpan orang lain saat dikirim. Jalankan pratinjau lagi. Tidak ada yang tersimpan.' },
        { status: 409 },
      );
    }
    console.error('Automation products error:', { actor: auth.actor, error });
    return NextResponse.json({ error: SERVER_FAIL }, { status: 500 });
  }
}
