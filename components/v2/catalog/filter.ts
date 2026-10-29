import type { HomeProductCard, MotorCategory, Product, ProductPosition } from '@/types';
import { effectivePrice, positionsOf, toCard } from '@/lib/v2/home-data';
import { CATEGORY_SLUGS, normalizeKategoriMotor } from '@/lib/v2/motor-category';

// Pure filter, sort, and query logic of the Katalog (F-016 S2.2–S2.5). No React or Firebase imports, so
// tests/f016-catalog.cjs can load it. Types stay here because only the catalog uses them.

export type HargaKey = 'bawah-200rb' | '200rb-500rb' | 'atas-500rb';
export type LabelKey = 'best-seller' | 'baru' | 'diskon';
export type UrutKey = 'sesuai' | 'harga-terendah' | 'harga-tertinggi' | 'terbaru';
export type FilterGroup = 'posisi' | 'motor' | 'harga' | 'label';

export interface FilterState {
  posisi: ProductPosition[];
  motor: MotorCategory | null;
  harga: HargaKey | null;
  label: LabelKey[];
  urut: UrutKey;
}

// What a card needs to be filtered and sorted, computed once on the server so the client gets plain data.
export interface CatalogItem {
  card: HomeProductCard;
  positions: ProductPosition[];
  kategori: MotorCategory[];
  price: number;
  discounted: boolean;
  best: boolean;
  baru: boolean;
  createdAt: number | null;
}

export interface Option<K extends string> {
  value: K;
  label: string;
}

// Labels from the canvas (posisi, urut) and CONTENT.md "produk" (harga, label); the order is the display order.
export const POSISI_OPTIONS: readonly Option<ProductPosition>[] = [
  { value: 'tank', label: 'Tank bag' },
  { value: 'side', label: 'Side bag' },
  { value: 'tail', label: 'Tail bag' },
  { value: 'extend', label: 'Extend bag' },
  { value: 'aksesori', label: 'Aksesori touring' },
  { value: 'harian', label: 'Tas harian' },
];
export const HARGA_OPTIONS: readonly Option<HargaKey>[] = [
  { value: 'bawah-200rb', label: 'Di bawah Rp200.000' },
  { value: '200rb-500rb', label: 'Rp200.000 sampai Rp500.000' },
  { value: 'atas-500rb', label: 'Di atas Rp500.000' },
];
export const LABEL_OPTIONS: readonly Option<LabelKey>[] = [
  { value: 'best-seller', label: 'Best seller' },
  { value: 'baru', label: 'Baru' },
  { value: 'diskon', label: 'Diskon' },
];
export const URUT_OPTIONS: readonly Option<UrutKey>[] = [
  { value: 'sesuai', label: 'Paling sesuai' },
  { value: 'harga-terendah', label: 'Harga terendah' },
  { value: 'harga-tertinggi', label: 'Harga tertinggi' },
  { value: 'terbaru', label: 'Terbaru' },
];

export const PAGE_SIZE = 12;
export const HELP_AFTER = 8;
export const QUERY_KEYS = ['posisi', 'motor', 'harga', 'label', 'urut'] as const;

export const DEFAULT_STATE: FilterState = { posisi: [], motor: null, harga: null, label: [], urut: 'sesuai' };

export function toCatalogItem(p: Product): CatalogItem {
  const { price, compareAt } = effectivePrice(p);
  const badge = (p.badge ?? '').toLowerCase();
  const createdAt = typeof p.createdAt === 'number' && Number.isFinite(p.createdAt) ? p.createdAt : null;
  return {
    card: toCard(p),
    positions: positionsOf(p),
    kategori: normalizeKategoriMotor(p.kategoriMotor),
    price,
    discounted: compareAt !== null && compareAt > price,
    best: badge.includes('best'),
    baru: /\b(new|baru)\b/.test(badge),
    createdAt,
  };
}

type Params = { get(key: string): string | null };

// Keeps known values only, once each, in display order (S2.2.2: unknown values are ignored).
function pickList<K extends string>(raw: string | null, options: readonly Option<K>[]): K[] {
  if (!raw) return [];
  const asked = raw.split(',').map(s => s.trim().toLowerCase());
  return options.map(o => o.value).filter(v => asked.includes(v));
}

function pickOne<K extends string>(raw: string | null, allowed: readonly K[]): K | null {
  const v = (raw ?? '').trim().toLowerCase();
  return (allowed as readonly string[]).includes(v) ? (v as K) : null;
}

export function parseQuery(params: Params): FilterState {
  return {
    posisi: pickList(params.get('posisi'), POSISI_OPTIONS),
    motor: pickOne(params.get('motor'), CATEGORY_SLUGS),
    harga: pickOne(params.get('harga'), HARGA_OPTIONS.map(o => o.value)),
    label: pickList(params.get('label'), LABEL_OPTIONS),
    // "Paling sesuai" is the default and never written (S2.2.2), so `urut=sesuai` is ignored too.
    urut: pickOne(params.get('urut'), ['harga-terendah', 'harga-tertinggi', 'terbaru'] as const) ?? 'sesuai',
  };
}

// Writes the catalog keys and keeps every other parameter (for example ?aff= of the affiliate tracker).
export function writeQuery(current: string, state: FilterState): string {
  const out = new URLSearchParams(current);
  for (const k of QUERY_KEYS) out.delete(k);
  if (state.posisi.length) out.set('posisi', state.posisi.join(','));
  if (state.motor) out.set('motor', state.motor);
  if (state.harga) out.set('harga', state.harga);
  if (state.label.length) out.set('label', state.label.join(','));
  if (state.urut !== 'sesuai') out.set('urut', state.urut);
  // Commas stay readable (posisi=tank,side), as written in S2.2.2.
  return out.toString().replace(/%2C/gi, ',');
}

// Stable identity of the applied state, used to reset "Muat lagi" and to restart the result fade.
export function stateKey(state: FilterState): string {
  return writeQuery('', state);
}

export function sameState(a: FilterState, b: FilterState): boolean {
  return stateKey(a) === stateKey(b);
}

// Products with no price (price row hidden, S0.9.4) never match a price band.
function inHarga(price: number, h: HargaKey): boolean {
  if (price <= 0) return false;
  if (h === 'bawah-200rb') return price < 200000;
  if (h === '200rb-500rb') return price >= 200000 && price <= 500000;
  return price > 500000;
}

function hasLabel(item: CatalogItem, l: LabelKey): boolean {
  if (l === 'best-seller') return item.best;
  if (l === 'baru') return item.baru;
  return item.discounted;
}

// S2.2.3: OR within a group, AND across groups. `skip` leaves one group out, for the option counts of S2.2.5.
export function matches(item: CatalogItem, state: FilterState, skip?: FilterGroup): boolean {
  if (skip !== 'posisi' && state.posisi.length && !state.posisi.some(p => item.positions.includes(p))) return false;
  if (skip !== 'motor' && state.motor && !item.kategori.includes(state.motor)) return false;
  if (skip !== 'harga' && state.harga && !inHarga(item.price, state.harga)) return false;
  if (skip !== 'label' && state.label.length && !state.label.some(l => hasLabel(item, l))) return false;
  return true;
}

// Newest first, products without a date last (S2.4.1, S2.4.2).
function byNewest(a: CatalogItem, b: CatalogItem): number {
  if (a.createdAt === b.createdAt) return 0;
  if (a.createdAt === null) return 1;
  if (b.createdAt === null) return -1;
  return b.createdAt - a.createdAt;
}

// Products without a price sort after every priced product in both price orders.
function byPrice(dir: 1 | -1) {
  return (a: CatalogItem, b: CatalogItem): number => {
    const ap = a.price > 0 ? a.price : null;
    const bp = b.price > 0 ? b.price : null;
    if (ap !== bp) {
      if (ap === null) return 1;
      if (bp === null) return -1;
      return (ap - bp) * dir;
    }
    return byNewest(a, b);
  };
}

// Array.prototype.sort is stable, so equal items keep the server order (newest first from getActiveProducts).
export function sortItems(items: readonly CatalogItem[], state: FilterState): CatalogItem[] {
  const list = [...items];
  if (state.urut === 'harga-terendah') return list.sort(byPrice(1));
  if (state.urut === 'harga-tertinggi') return list.sort(byPrice(-1));
  if (state.urut === 'terbaru') return list.sort(byNewest);
  const motor = state.motor;
  return list.sort((a, b) => {
    if (motor) {
      const d = Number(b.kategori.includes(motor)) - Number(a.kategori.includes(motor));
      if (d) return d;
    }
    const d = Number(b.best) - Number(a.best);
    return d || byNewest(a, b);
  });
}

export function applyCatalog(items: readonly CatalogItem[], state: FilterState): CatalogItem[] {
  return sortItems(items.filter(i => matches(i, state)), state);
}

// S2.2.5: how many products an option would give together with the other active groups.
export function optionCount(items: readonly CatalogItem[], state: FilterState, group: FilterGroup, value: string): number {
  const probe: FilterState = { ...state };
  if (group === 'posisi') probe.posisi = [value as ProductPosition];
  else if (group === 'motor') probe.motor = value as MotorCategory;
  else if (group === 'harga') probe.harga = value as HargaKey;
  else probe.label = [value as LabelKey];
  return items.filter(i => matches(i, probe)).length;
}

export function activeCount(state: FilterState, group: FilterGroup): number {
  if (group === 'posisi') return state.posisi.length;
  if (group === 'label') return state.label.length;
  if (group === 'motor') return state.motor ? 1 : 0;
  return state.harga ? 1 : 0;
}

export function totalActive(state: FilterState): number {
  return state.posisi.length + state.label.length + (state.motor ? 1 : 0) + (state.harga ? 1 : 0);
}

export interface ActiveChip {
  group: FilterGroup;
  value: string;
  label: string;
}

// S2.3: one chip per applied value, in the order of the filter bar.
export function activeChips(state: FilterState, categoryLabel: (c: MotorCategory) => string): ActiveChip[] {
  const out: ActiveChip[] = [];
  if (state.motor) out.push({ group: 'motor', value: state.motor, label: categoryLabel(state.motor) });
  for (const o of POSISI_OPTIONS) if (state.posisi.includes(o.value)) out.push({ group: 'posisi', value: o.value, label: o.label });
  const h = HARGA_OPTIONS.find(o => o.value === state.harga);
  if (h) out.push({ group: 'harga', value: h.value, label: h.label });
  for (const o of LABEL_OPTIONS) if (state.label.includes(o.value)) out.push({ group: 'label', value: o.value, label: o.label });
  return out;
}

export function removeValue(state: FilterState, group: FilterGroup, value: string): FilterState {
  if (group === 'posisi') return { ...state, posisi: state.posisi.filter(v => v !== value) };
  if (group === 'label') return { ...state, label: state.label.filter(v => v !== value) };
  if (group === 'motor') return { ...state, motor: null };
  return { ...state, harga: null };
}

// S2.3.1: "Hapus semua" clears every filter, including motor, and keeps the sort.
export function clearFilters(state: FilterState): FilterState {
  return { ...DEFAULT_STATE, urut: state.urut };
}

export function toggleList<K extends string>(list: readonly K[], value: K, options: readonly Option<K>[]): K[] {
  const next = list.includes(value) ? list.filter(v => v !== value) : [...list, value];
  return options.map(o => o.value).filter(v => next.includes(v));
}

export function urutLabel(u: UrutKey): string {
  return URUT_OPTIONS.find(o => o.value === u)?.label ?? 'Paling sesuai';
}

// S2.4.3: the help card follows the 8th card, or the last one when there are fewer; none for an empty result.
export function helpCardIndex(shown: number): number {
  if (shown <= 0) return -1;
  return Math.min(HELP_AFTER, shown) - 1;
}
