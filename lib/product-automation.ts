import type { MotorCategory } from '@/types';
import { CATEGORY_SLUGS, isMotorCategory, normalizeKategoriMotor } from '@/lib/v2/motor-category';
import { isValidSlug } from '@/lib/slug';

// F-023 (ADR-0032): pure rules of PATCH /api/automation/products. No Firebase or Next imports, so the tests load it
// directly. The route may change three text fields of existing products and nothing else: price, stock, variants,
// photos, status, and slug stay with the admin form.

export const PRODUCT_TEXT_FIELDS = ['name', 'description', 'kategoriMotor'] as const;
export type ProductTextField = (typeof PRODUCT_TEXT_FIELDS)[number];

const ITEM_KEYS = new Set<string>(['slug', 'expectedVersion', ...PRODUCT_TEXT_FIELDS]);

// 31 products today; the cap keeps one request well under the body limit and the Firestore batch limit (500).
export const MAX_PRODUCT_ITEMS = 50;
// The longest uniform description (2026-11-03 draft) is about 1,400 characters; this leaves room without letting a
// pasted document through.
export const MAX_DESCRIPTION_CHARS = 5000;
export const MAX_NAME_CHARS = 120;
export const MAX_PRODUCT_BODY_BYTES = 200 * 1024;

export interface ProductTextPatch {
  slug: string;
  name?: string;
  description?: string;
  kategoriMotor?: MotorCategory[];
  // The version returned by a dry run (Firestore update time). Required on a write (review REV-06): the write is
  // refused if the product changed since, so an admin edit made between the preview and the send is never overwritten.
  expectedVersion?: string | null;
}

export type ParsedProductPatch =
  | { ok: true; dryRun: boolean; items: ProductTextPatch[] }
  | { ok: false; error: string };

// Tab and newline are allowed in a description; every other control character is refused (they never come from the
// admin textarea and would show as boxes on the page).
const CONTROL_IN_TEXT = /[\u0000-\u0008\u000b-\u001f\u007f]/;
const CONTROL_IN_NAME = /[\u0000-\u001f\u007f]/;

const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Description as stored by the admin textarea: CRLF folded to LF, trailing whitespace of the whole text removed. */
export function normalizeDescription(value: string): string {
  return value.replace(/\r\n?/g, '\n').replace(/\s+$/, '');
}

function parseItem(raw: unknown, index: number): { ok: true; value: ProductTextPatch } | { ok: false; error: string } {
  const at = `items[${index}]`;
  if (!isPlainObject(raw)) return { ok: false, error: `${at}: harus objek` };
  for (const key of Object.keys(raw)) {
    if (!ITEM_KEYS.has(key)) return { ok: false, error: `${at}.${key}: field tidak boleh diubah lewat otomasi` };
  }
  if (!isValidSlug(raw.slug)) return { ok: false, error: `${at}.slug: tidak valid` };
  const value: ProductTextPatch = { slug: raw.slug };

  if (raw.name !== undefined) {
    if (typeof raw.name !== 'string') return { ok: false, error: `${at}.name: harus teks` };
    const name = raw.name.trim();
    if (!name) return { ok: false, error: `${at}.name: tidak boleh kosong` };
    if (name.length > MAX_NAME_CHARS) return { ok: false, error: `${at}.name: lebih dari ${MAX_NAME_CHARS} karakter` };
    if (CONTROL_IN_NAME.test(name)) return { ok: false, error: `${at}.name: berisi karakter kontrol atau baris baru` };
    value.name = name;
  }

  if (raw.description !== undefined) {
    if (typeof raw.description !== 'string') return { ok: false, error: `${at}.description: harus teks` };
    const description = normalizeDescription(raw.description);
    if (!description.trim()) return { ok: false, error: `${at}.description: tidak boleh kosong` };
    if (description.length > MAX_DESCRIPTION_CHARS) return { ok: false, error: `${at}.description: lebih dari ${MAX_DESCRIPTION_CHARS} karakter` };
    if (CONTROL_IN_TEXT.test(description)) return { ok: false, error: `${at}.description: berisi karakter kontrol` };
    value.description = description;
  }

  if (raw.kategoriMotor !== undefined) {
    const k = raw.kategoriMotor;
    if (!Array.isArray(k) || !k.every(isMotorCategory) || new Set(k).size !== k.length) {
      return { ok: false, error: `${at}.kategoriMotor: harus daftar unik dari ${CATEGORY_SLUGS.join(', ')}` };
    }
    // Stored in D1 order, like the admin form, so a no-op change is detected as unchanged.
    value.kategoriMotor = CATEGORY_SLUGS.filter(c => k.includes(c));
  }

  if (raw.expectedVersion !== undefined) {
    if (raw.expectedVersion !== null && typeof raw.expectedVersion !== 'string') {
      return { ok: false, error: `${at}.expectedVersion: harus teks atau null` };
    }
    value.expectedVersion = raw.expectedVersion;
  }

  if (value.name === undefined && value.description === undefined && value.kategoriMotor === undefined) {
    return { ok: false, error: `${at}: tidak ada field yang diubah (name, description, atau kategoriMotor)` };
  }
  return { ok: true, value };
}

/**
 * Validates the whole request before anything is read. `dryRun` defaults to true, so a missing or broken flag
 * never writes; a write needs an explicit `dryRun: false`.
 */
export function parseProductPatchBody(body: unknown): ParsedProductPatch {
  if (!isPlainObject(body)) return { ok: false, error: 'body: format data tidak valid' };
  for (const key of Object.keys(body)) {
    if (key !== 'dryRun' && key !== 'items') return { ok: false, error: `${key}: field tidak dikenal` };
  }
  if (body.dryRun !== undefined && typeof body.dryRun !== 'boolean') return { ok: false, error: 'dryRun: harus true atau false' };
  const dryRun = body.dryRun !== false;
  if (!Array.isArray(body.items) || body.items.length === 0) return { ok: false, error: 'items: minimal satu produk' };
  if (body.items.length > MAX_PRODUCT_ITEMS) return { ok: false, error: `items: maksimal ${MAX_PRODUCT_ITEMS} produk per permintaan` };

  const items: ProductTextPatch[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < body.items.length; i++) {
    const parsed = parseItem(body.items[i], i);
    if (!parsed.ok) return parsed;
    // Review REV-06: a write must name the version it was previewed against, so no client can write blind.
    if (!dryRun && parsed.value.expectedVersion === undefined) {
      return { ok: false, error: `items[${i}].expectedVersion: wajib saat menulis (ambil dari pratinjau)` };
    }
    if (seen.has(parsed.value.slug)) return { ok: false, error: `items[${i}].slug: "${parsed.value.slug}" muncul dua kali` };
    seen.add(parsed.value.slug);
    items.push(parsed.value);
  }
  return { ok: true, dryRun, items };
}

export interface ProductTextValues {
  name: string;
  description: string;
  // null = the stored product has no kategoriMotor field (legacy, read as [] by the site).
  kategoriMotor: MotorCategory[] | null;
}

/** The three fields as stored, for the dry-run preview and the backup the script keeps before a write. */
export function currentTextValues(stored: Record<string, any> | undefined): ProductTextValues {
  return {
    name: typeof stored?.name === 'string' ? stored.name : '',
    description: typeof stored?.description === 'string' ? stored.description : '',
    kategoriMotor: Array.isArray(stored?.kategoriMotor) ? normalizeKategoriMotor(stored!.kategoriMotor) : null,
  };
}

/** Fields of the patch that differ from the stored values. A missing kategoriMotor differs from any sent list. */
export function changedFields(patch: ProductTextPatch, current: ProductTextValues): ProductTextField[] {
  const out: ProductTextField[] = [];
  if (patch.name !== undefined && patch.name !== current.name) out.push('name');
  if (patch.description !== undefined && patch.description !== current.description) out.push('description');
  if (
    patch.kategoriMotor !== undefined &&
    (current.kategoriMotor === null || patch.kategoriMotor.join(',') !== current.kategoriMotor.join(','))
  ) out.push('kategoriMotor');
  return out;
}

/** Firestore update time as a comparable string; null when the snapshot has none (only in tests). */
export function versionOf(updateTime: unknown): string | null {
  if (!updateTime || typeof updateTime !== 'object') return null;
  const t = updateTime as { seconds?: unknown; nanoseconds?: unknown };
  if (typeof t.seconds !== 'number' || typeof t.nanoseconds !== 'number') return null;
  return `${t.seconds}.${String(t.nanoseconds).padStart(9, '0')}`;
}
