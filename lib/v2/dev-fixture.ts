import fs from 'node:fs';
import { normalizeProduct } from '@/lib/product-utils';
import { toMillis, toPublicArticle } from '@/lib/article-format';
import { draftKategoriMotor } from '@/lib/v2/motor-category';
import type { FlashSaleState, Product, PublicArticle } from '@/types';

// F-016 task A5: local-only data so every v2 state can be reviewed without Firebase credentials. Off unless
// NODE_ENV is not "production" AND F016_FIXTURE points to a JSON file of public data ({ products, articles }
// copied from https://inzta.id/api/products and published articles). Never active in a production build.
// Switches: F016_STATE=empty|error, F016_FLASH=off|active|soon|expired, F016_ARTICLES=<n>, F016_KATEGORI=draft
// (adds the P-22 draft category mapping to products without kategoriMotor; draft, needs Bang Raja validation, VF-03).

type Raw = { products?: Record<string, any>[]; articles?: Record<string, any>[] };

let memo: { path: string; mtime: number; data: Raw } | null = null;

export function devFixtureEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== 'production' && Boolean(env.F016_FIXTURE);
}

function load(env: NodeJS.ProcessEnv): Raw {
  const file = env.F016_FIXTURE as string;
  const mtime = fs.statSync(file).mtimeMs;
  if (!memo || memo.path !== file || memo.mtime !== mtime) {
    memo = { path: file, mtime, data: JSON.parse(fs.readFileSync(file, 'utf8')) };
  }
  return memo.data;
}

function guard(env: NodeJS.ProcessEnv, label: string): 'empty' | 'ok' {
  if (env.F016_STATE === 'error') throw new Error(`[dev-fixture] ${label}: forced error (F016_STATE=error)`);
  return env.F016_STATE === 'empty' ? 'empty' : 'ok';
}

// Returns undefined when the fixture is off, so callers fall through to Firestore.
export function fixtureProducts(env: NodeJS.ProcessEnv = process.env): Product[] | undefined {
  if (!devFixtureEnabled(env)) return undefined;
  if (guard(env, 'products') === 'empty') return [];
  return (load(env).products ?? [])
    .filter(p => p.isActive !== false)
    .map(p => ({
      ...normalizeProduct(p.slug ?? p.id, p),
      slug: p.slug ?? p.id,
      ...(env.F016_KATEGORI === 'draft' && !Array.isArray(p.kategoriMotor) ? { kategoriMotor: draftKategoriMotor(p as Product) } : {}),
      createdAt: toMillis(p.createdAt),
      updatedAt: toMillis(p.updatedAt),
    }) as unknown as Product);
}

export function fixtureArticles(env: NodeJS.ProcessEnv = process.env): PublicArticle[] | undefined {
  if (!devFixtureEnabled(env)) return undefined;
  if (guard(env, 'articles') === 'empty') return [];
  const all = (load(env).articles ?? []).map(a => toPublicArticle(a.slug, a)).filter(a => (a.status ?? 'published') === 'published');
  const n = env.F016_ARTICLES === undefined || env.F016_ARTICLES === 'all' ? all.length : Number(env.F016_ARTICLES);
  return all.slice(0, Number.isFinite(n) ? n : all.length);
}

export function fixtureArticle(slug: string, env: NodeJS.ProcessEnv = process.env): PublicArticle | null | undefined {
  const list = fixtureArticles(env);
  if (list === undefined) return undefined;
  return list.find(a => a.slug === slug) ?? null;
}

export function fixtureFlash(env: NodeJS.ProcessEnv = process.env, now = Date.now()): FlashSaleState | undefined {
  if (!devFixtureEnabled(env)) return undefined;
  guard(env, 'flashSale');
  switch (env.F016_FLASH) {
    case 'active': return { isActive: true, endsAt: new Date(now + (2 * 86400 + 4 * 3600 + 12 * 60) * 1000).toISOString() };
    case 'soon': return { isActive: true, endsAt: new Date(now + 70 * 1000).toISOString() };
    case 'expired': return { isActive: true, endsAt: new Date(now - 86400 * 1000).toISOString() };
    default: return { isActive: false, endsAt: null };
  }
}
