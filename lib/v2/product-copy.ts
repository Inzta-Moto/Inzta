import type { BagPosition } from '@/types';

// Static product copy for v2 cards (F-016 17). Data in Firestore has no position or fitment fields.

// Names the keyword rule in positionOf() gets wrong. null = no position tile (e.g. "Bagasi").
export const POSITION_BY_SLUG: Record<string, BagPosition | null> = {
  'tankbag-and-tailbag-wanderpack-10l': 'tank',
  'xbags-tas-bagasi-xmax': null,
};

// Gate 0 (C-7, 17.1a): fitment stays at the most careful level until A-012 is validated, so these ship empty.
// Candidates with their sources are listed in inzta-hq docs/specs/F-016-landing-page-v2/design.md section 4.
export const UNIVERSAL_SLUGS: readonly string[] = [];
export const FOR_LINE_BY_SLUG: Record<string, string> = {};

// Main photos that print "FULL WATERPROOF", a claim without a source (design D5): cropped so the text never shows.
export const CROP_TOP_SLUGS: readonly string[] = [
  'side-bage-motor-inzta-oke',
  'side-bag-inzta-foldbag-7l',
  'tankbag-and-tailbag-wanderpack-10l',
];
// Package photos that print "free raincover" (design D6). None is a main photo today.
export const CROP_HALF_SLUGS: readonly string[] = [];

// Words that must never appear in a generated label (17.3).
export const BANNED_LABEL_WORDS: readonly string[] = [
  'cocok', 'pas', 'teruji', 'verified', 'waterproof', 'tahan air', '100%', 'terbaik', 'dijamin', 'original', 'gratis',
];
