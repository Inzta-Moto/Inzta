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
export const SHOWN_KEY = 'tampil';

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

// Writes the catalog keys and keeps every other parameter (for example ?aff= of the affiliate tracker). `tampil`
// ("Muat lagi") is always dropped and written back only when given, so any filter or sort change resets it (S2.5.2).
export function writeQuery(current: string, state: FilterState, shown?: number): string {
  const out = new URLSearchParams(current);
  for (const k of QUERY_KEYS) out.delete(k);
  out.delete(SHOWN_KEY);
  if (state.posisi.length) out.set('posisi', state.posisi.join(','));
  if (state.motor) out.set('motor', state.motor);
  if (state.harga) out.set('harga', state.harga);
  if (state.label.length) out.set('label', state.label.join(','));
  if (state.urut !== 'sesuai') out.set('urut', state.urut);
  if (shown !== undefined && shown > PAGE_SIZE) out.set(SHOWN_KEY, String(shown));
  // Commas stay readable (posisi=tank,side), as written in S2.2.2.
  return out.toString().replace(/%2C/gi, ',');
}

// `tampil` keeps the "Muat lagi" progress in the URL, so coming back from a product page restores it. Only whole
// pages count: a multiple of 12, at least 12, at most the pages the result has; anything else reads as 12.
export function parseShown(raw: string | null, total = Infinity): number {
  const v = (raw ?? '').trim();
  if (!/^\d{1,6}$/.test(v)) return PAGE_SIZE;
  const n = Number(v);
  if (n < PAGE_SIZE || n % PAGE_SIZE !== 0) return PAGE_SIZE;
  const max = Number.isFinite(total) ? Math.max(PAGE_SIZE, Math.ceil(total / PAGE_SIZE) * PAGE_SIZE) : n;
  return Math.min(n, max);
}

// What the URL holds for the Katalog: the applied filters and the "Muat lagi" progress.
export interface CatalogView {
  state: FilterState;
  shown: number;
}

export function readView(params: Params): CatalogView {
  return { state: parseQuery(params), shown: parseShown(params.get(SHOWN_KEY)) };
}

// The view after a control's change, applied to the latest view (never to a rendered prop); null when nothing changed.
// Any filter or sort change starts again at the first 12 (S2.5.2).
export function changeView(cur: CatalogView, change: FilterChange): CatalogView | null {
  const state = reduceFilter(cur.state, change);
  return state === cur.state ? null : { state, shown: PAGE_SIZE };
}

// Whether a `search` from useSearchParams should replace the current view. Only a URL changed from outside counts (a
// navbar or footer link to /produk?posisi=…, back/forward). A `search` that no longer equals the address bar (`live`)
// is an earlier replaceState of our own that Next delivers late; applying it would undo the newer tick. Null keeps
// the current view.
export function syncView(cur: CatalogView, search: string, live: string): CatalogView | null {
  if (new URLSearchParams(live).toString() !== new URLSearchParams(search).toString()) return null;
  const next = readView(new URLSearchParams(live));
  return sameState(cur.state, next.state) && cur.shown === next.shown ? null : next;
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

// How many products an option would give together with the other active groups, by brute force. The UI reads
// facetCounts(); this stays as the reference the tests compare it with.
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

// Text of the polite live region after a filter or sort change. The sort is named when it is not the default, so a
// sort change that keeps the heading and the count still changes the text and gets announced.
export function resultStatus(heading: string, count: number, urut: UrutKey): string {
  const base = `${heading}: ${count} produk`;
  return urut === 'sesuai' ? base : `${base}, ${urutLabel(urut).toLowerCase()}`;
}

// S2.4.3: the help card follows the 8th card, or the last one when there are fewer; none for an empty result.
export function helpCardIndex(shown: number): number {
  if (shown <= 0) return -1;
  return Math.min(HELP_AFTER, shown) - 1;
}

export const GROUP_TITLES: Record<FilterGroup, string> = {
  posisi: 'Posisi tas',
  motor: 'Motor saya',
  harga: 'Harga',
  label: 'Label',
};

// Every change a control can ask for. Controls never build the next state themselves: the owner of the state applies
// the change to its latest value, so two quick ticks can never both start from the same stale state.
export type FilterChange =
  | { type: 'toggle'; group: 'posisi' | 'label' | 'motor'; value: string }
  | { type: 'set'; group: 'harga' | 'motor'; value: string | null }
  | { type: 'remove'; group: FilterGroup; value: string }
  | { type: 'clearGroup'; group: FilterGroup }
  | { type: 'clearAll' }
  | { type: 'urut'; value: UrutKey }
  | { type: 'replace'; state: FilterState };

const URUT_KEYS: readonly UrutKey[] = URUT_OPTIONS.map(o => o.value);

// Pure reducer of FilterChange; unknown values leave the state as it is. Returns `prev` itself when nothing changes.
export function reduceFilter(prev: FilterState, change: FilterChange): FilterState {
  const next = nextState(prev, change);
  return sameState(prev, next) ? prev : next;
}

function nextState(prev: FilterState, change: FilterChange): FilterState {
  switch (change.type) {
    case 'toggle':
      if (change.group === 'posisi') {
        if (!POSISI_OPTIONS.some(o => o.value === change.value)) return prev;
        return { ...prev, posisi: toggleList(prev.posisi, change.value as ProductPosition, POSISI_OPTIONS) };
      }
      if (change.group === 'label') {
        if (!LABEL_OPTIONS.some(o => o.value === change.value)) return prev;
        return { ...prev, label: toggleList(prev.label, change.value as LabelKey, LABEL_OPTIONS) };
      }
      if (!(CATEGORY_SLUGS as readonly string[]).includes(change.value)) return prev;
      return { ...prev, motor: prev.motor === change.value ? null : (change.value as MotorCategory) };
    case 'set':
      if (change.group === 'harga') {
        if (change.value !== null && !HARGA_OPTIONS.some(o => o.value === change.value)) return prev;
        return { ...prev, harga: change.value as HargaKey | null };
      }
      if (change.value !== null && !(CATEGORY_SLUGS as readonly string[]).includes(change.value)) return prev;
      return { ...prev, motor: change.value as MotorCategory | null };
    case 'remove':
      return removeValue(prev, change.group, change.value);
    case 'clearGroup':
      return clearGroup(prev, change.group);
    case 'clearAll':
      return clearFilters(prev);
    case 'urut':
      return URUT_KEYS.includes(change.value) ? { ...prev, urut: change.value } : prev;
    case 'replace':
      return change.state;
  }
}

export function clearGroup(state: FilterState, group: FilterGroup): FilterState {
  if (group === 'posisi') return { ...state, posisi: [] };
  if (group === 'label') return { ...state, label: [] };
  if (group === 'motor') return { ...state, motor: null };
  return { ...state, harga: null };
}

export interface FacetCounts {
  // Products that match the whole state.
  total: number;
  // Products that match every group but harga: the count of "Semua harga" (includes products without a price).
  hargaAll: number;
  posisi: Record<ProductPosition, number>;
  motor: Record<MotorCategory, number>;
  harga: Record<HargaKey, number>;
  label: Record<LabelKey, number>;
}

function zeroes<K extends string>(keys: readonly K[]): Record<K, number> {
  const out = {} as Record<K, number>;
  for (const k of keys) out[k] = 0;
  return out;
}

const POSISI_KEYS = POSISI_OPTIONS.map(o => o.value);
const HARGA_KEYS = HARGA_OPTIONS.map(o => o.value);
const LABEL_KEYS = LABEL_OPTIONS.map(o => o.value);

// Option counts of every group in one pass over the items (the same numbers as optionCount for each option): an
// item adds to option o of group g when it passes every other active group and has o. OR within a group, AND across.
export function facetCounts(items: readonly CatalogItem[], state: FilterState): FacetCounts {
  const out: FacetCounts = {
    total: 0,
    hargaAll: 0,
    posisi: zeroes(POSISI_KEYS),
    motor: zeroes(CATEGORY_SLUGS),
    harga: zeroes(HARGA_KEYS),
    label: zeroes(LABEL_KEYS),
  };
  const { posisi, motor, harga, label } = state;
  for (const item of items) {
    const pP = !posisi.length || posisi.some(p => item.positions.includes(p));
    const pM = !motor || item.kategori.includes(motor);
    const pH = !harga || inHarga(item.price, harga);
    const pL = !label.length || label.some(l => hasLabel(item, l));
    if (pP && pM && pH && pL) out.total++;
    if (pM && pH && pL) item.positions.forEach((p, i, all) => all.indexOf(p) === i && out.posisi[p]++);
    if (pP && pH && pL) item.kategori.forEach((k, i, all) => all.indexOf(k) === i && out.motor[k]++);
    if (pP && pM && pL) {
      out.hargaAll++;
      for (const h of HARGA_KEYS) if (inHarga(item.price, h)) out.harga[h]++;
    }
    if (pP && pM && pH) for (const l of LABEL_KEYS) if (hasLabel(item, l)) out.label[l]++;
  }
  return out;
}

// Counts in the whole catalogue, independent of the state: decides which options exist at all.
export function availability(items: readonly CatalogItem[]): FacetCounts {
  return facetCounts(items, DEFAULT_STATE);
}

export function isSelected(state: FilterState, group: FilterGroup, value: string): boolean {
  if (group === 'posisi') return (state.posisi as string[]).includes(value);
  if (group === 'label') return (state.label as string[]).includes(value);
  if (group === 'motor') return state.motor === value;
  return state.harga === value;
}

export function countOf(counts: FacetCounts, group: FilterGroup, value: string): number {
  return (counts[group] as Record<string, number>)[value] ?? 0;
}

// `group:value` of every applied value, the unit of KeptSelection.
export function selectionKeys(state: FilterState): string[] {
  const out: string[] = [];
  for (const v of state.posisi) out.push(`posisi:${v}`);
  for (const v of state.label) out.push(`label:${v}`);
  if (state.motor) out.push(`motor:${state.motor}`);
  if (state.harga) out.push(`harga:${state.harga}`);
  return out;
}

// Every value that has been selected since the catalogue mounted. Visibility reads this instead of the current
// selection, so an option kept only because it was selected does not unmount under the pointer when it is unticked.
export type KeptSelection = ReadonlySet<string>;

function wasSelected(basis: FilterState | KeptSelection, group: FilterGroup, value: string): boolean {
  return basis instanceof Set ? basis.has(`${group}:${value}`) : isSelected(basis as FilterState, group, value);
}

// An option no product in the catalogue has is hidden, unless it is or was selected (an old ad link), so it can
// still be turned off and stays where it was once it is. Options that are 0 only because of the other groups stay
// visible: hiding depends on the catalogue only, so the list never reflows under the pointer while the visitor ticks.
export function isOptionVisible(group: FilterGroup, value: string, avail: FacetCounts, basis: FilterState | KeptSelection): boolean {
  return countOf(avail, group, value) > 0 || wasSelected(basis, group, value);
}

export type ListGroup = Exclude<FilterGroup, 'motor'>;

export function optionsOf(group: ListGroup): readonly Option<string>[] {
  if (group === 'posisi') return POSISI_OPTIONS;
  if (group === 'harga') return HARGA_OPTIONS;
  return LABEL_OPTIONS;
}

export function isGroupVisible(group: ListGroup, avail: FacetCounts, basis: FilterState | KeptSelection): boolean {
  return optionsOf(group).some(o => isOptionVisible(group, o.value, avail, basis));
}

function joinDan(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} dan ${parts[parts.length - 1]}`;
}

function posisiLabels(state: FilterState): string[] {
  return POSISI_OPTIONS.filter(o => state.posisi.includes(o.value)).map(o => o.label);
}

// H1 of the Katalog. "Semua" only when nothing filters (sort does not count); one or two positions name them; the
// motor adds "untuk motor X"; anything else reads as the neutral "Tas motor INZTA".
export function catalogHeading(state: FilterState, categoryLabel: (c: MotorCategory) => string): string {
  const pos = posisiLabels(state);
  const other = state.harga !== null || state.label.length > 0;
  if (!pos.length && !state.motor && !other) return 'Semua tas motor INZTA';
  if (other || pos.length > 2) return 'Tas motor INZTA';
  const head = pos.length ? joinDan(pos) : 'Tas';
  return state.motor ? `${head} untuk motor ${categoryLabel(state.motor)}` : head;
}

export const LEAD_MOTOR_NOTE = 'Tas yang dibuat untuk motor Anda ditandai hijau.';

// The one visible count, the same number as the grid. The green-mark sentence only makes sense once a motor
// category is chosen. CatalogBody renders the two parts separately (the sentence is always in the markup and shown
// by CSS) so a stored category does not push the page down after mount; this is the text a reader gets.
export function catalogLead(count: number, hasCategory: boolean): string {
  return hasCategory ? `${count} produk. ${LEAD_MOTOR_NOTE}` : `${count} produk.`;
}

// Lower-case name of exactly one chosen position ("tank bag"), else "tas"; used inside sentences.
export function positionPhrase(state: FilterState): string {
  const pos = posisiLabels(state);
  return pos.length === 1 ? pos[0].toLowerCase() : 'tas';
}

const RELAX_ORDER: readonly FilterGroup[] = ['label', 'harga', 'motor', 'posisi'];

// The group whose removal brings back the most products. Ties drop label, then harga, then motor, then posisi, so
// the visitor's main intent (the tile or menu position) is kept longest. Null when nothing is active, and also when
// removing any single group still gives 0: offering that removal would only lead to a second empty state, so the
// empty state offers "Hapus semua filter" instead. Stateless, so a shared link behaves the same.
export function relaxGroup(items: readonly CatalogItem[], state: FilterState): FilterGroup | null {
  const active = RELAX_ORDER.filter(g => activeCount(state, g) > 0);
  if (!active.length) return null;
  const restored = active.map(g => items.reduce((n, i) => n + (matches(i, state, g) ? 1 : 0), 0));
  let best = 0;
  for (let i = 1; i < active.length; i++) if (restored[i] > restored[best]) best = i;
  return restored[best] > 0 ? active[best] : null;
}

export interface Nearest {
  kind: 'relax' | 'posisi' | 'all';
  // What the "Lihat n produk" link applies.
  state: FilterState;
  items: CatalogItem[];
  total: number;
  heading: string;
}

// Products shown under an empty result, so the visitor is never stuck: first the result without the most
// restrictive group, then the same positions only, then the whole catalogue. Each in the current sort.
export function nearestItems(items: readonly CatalogItem[], state: FilterState, max = 4): Nearest | null {
  const relax = relaxGroup(items, state);
  const tries: { kind: Nearest['kind']; state: FilterState; heading: (n: number) => string }[] = [];
  if (relax) tries.push({ kind: 'relax', state: clearGroup(state, relax), heading: n => `Tanpa filter ${GROUP_TITLES[relax]}: ${n} produk` });
  if (state.posisi.length) {
    const pos = posisiLabels(state);
    tries.push({ kind: 'posisi', state: { ...DEFAULT_STATE, posisi: state.posisi, urut: state.urut }, heading: () => `${joinDan(pos)} lainnya` });
  }
  tries.push({ kind: 'all', state: clearFilters(state), heading: () => 'Produk lain' });
  for (const t of tries) {
    const list = applyCatalog(items, t.state);
    if (list.length) return { kind: t.kind, state: t.state, items: list.slice(0, max), total: list.length, heading: t.heading(list.length) };
  }
  return null;
}

export interface EmptyCopy {
  title: string;
  text: string;
  // Label of the primary action, which removes the relax group; null when no single removal brings products back.
  relaxLabel: string | null;
  // "Hapus semua filter" only adds something when more than one group is active. It is the primary action when
  // relaxLabel is null.
  showClearAll: boolean;
}

// Empty-state copy. The motor variant applies when the chosen motor is what empties the result: the motor tags are
// still being filled in (A-049), so the copy says so and points to the admin instead of blaming the filters.
export function emptyCopy(state: FilterState, relax: FilterGroup | null, categoryLabel: (c: MotorCategory) => string): EmptyCopy {
  const groups = RELAX_ORDER.filter(g => activeCount(state, g) > 0).length;
  const showClearAll = groups > 1 || (relax === null && groups > 0);
  if (relax === 'motor' && state.motor) {
    const phrase = positionPhrase(state);
    const onlyPosition = state.harga === null && state.label.length === 0 && state.posisi.length <= 1;
    return {
      title: `Belum ada ${phrase} yang ditandai untuk motor ${categoryLabel(state.motor)}.`,
      text: 'Penandaan motor masih kami lengkapi. Admin bisa bantu cek tas yang cocok.',
      relaxLabel: onlyPosition ? `Lihat semua ${phrase}` : 'Hapus filter Motor saya',
      showClearAll,
    };
  }
  const chips = activeChips(state, categoryLabel);
  let relaxLabel: string | null = null;
  if (relax) {
    const own = chips.filter(c => c.group === relax);
    relaxLabel = `Hapus filter ${own.length === 1 ? own[0].label : GROUP_TITLES[relax]}`;
  }
  return {
    title: 'Tidak ada tas yang sesuai filter.',
    text: chips.length ? `Filter aktif: ${chips.map(c => c.label).join(', ')}.` : '',
    relaxLabel,
    showClearAll,
  };
}
