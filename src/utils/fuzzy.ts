/**
 * fuzzy.ts — Lightweight fuzzy search scorer (zero dependencies)
 *
 * Uses trigram similarity for typo-tolerance ("restruant" → "restaurant")
 * combined with prefix / substring bonuses for speed.
 */

/** Build a set of overlapping 3-character trigrams from a string */
function trigrams(s: string): Set<string> {
  const t = new Set<string>();
  const p = ' ' + s.toLowerCase() + ' ';
  for (let i = 0; i < p.length - 2; i++) t.add(p.slice(i, i + 3));
  return t;
}

/** Jaccard similarity between two trigram sets → 0..1 */
function trigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const ta = trigrams(a);
  const tb = trigrams(b);
  let inter = 0;
  ta.forEach(t => { if (tb.has(t)) inter++; });
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Score how well `query` matches `target` → 0..1 */
export function fuzzyScore(query: string, target: string): number {
  if (!query || !target) return 0;
  const q = query.trim().toLowerCase();
  const t = target.toLowerCase();

  // Exact match
  if (t === q) return 1.0;
  // Substring match at start of word (e.g. "bur" → "Burger")
  if (t.startsWith(q)) return 0.95;
  // Substring anywhere
  if (t.includes(q)) return 0.85;
  // Any word in target starts with query
  if (t.split(/\s+/).some(w => w.startsWith(q))) return 0.8;
  // Trigram similarity (handles typos)
  const sim = trigramSimilarity(q, t);
  if (sim >= 0.4) return sim * 0.75;
  return 0;
}

/** Score a query against multiple fields; return the best score */
export function scoreFields(query: string, fields: (string | undefined)[]): number {
  return Math.max(0, ...fields.map(f => f ? fuzzyScore(query, f) : 0));
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CachedRestaurant {
  _id: string;
  restaurantId: string;
  name: string;
  cuisine: string[];
  description?: string;
  type?: string;
  isOpen?: boolean;
  banner?: string[];
  logo?: string;
  rating?: number;
  deliveryFee?: number;
  avgDeliveryTime?: string;
}

export interface CachedItem {
  _id: string;
  name: string;
  category: string;
  description?: string;
  isVeg?: boolean;
  price: number;
  restaurantId: string;
  restaurantName?: string;
}

export interface SearchCache {
  restaurants: CachedRestaurant[];
  items: CachedItem[];
}

export type SearchResultKind = 'restaurant' | 'dish' | 'cuisine';

export interface RestaurantResult {
  kind: 'restaurant';
  score: number;
  restaurant: CachedRestaurant;
}
export interface DishResult {
  kind: 'dish';
  score: number;
  item: CachedItem;
}
export interface CuisineResult {
  kind: 'cuisine';
  score: number;
  cuisine: string;
  count: number;
}

export type SearchResult = RestaurantResult | DishResult | CuisineResult;

const MIN_SCORE = 0.35;

/** Run a full search across the cache; returns results sorted by score desc */
export function searchAll(query: string, cache: SearchCache): SearchResult[] {
  const q = query.trim();
  if (!q) return [];

  const results: SearchResult[] = [];

  // ── Restaurants ────────────────────────────────────────────────────────────
  for (const r of cache.restaurants) {
    const score = scoreFields(q, [r.name, ...(r.cuisine ?? []), r.description, r.type]);
    if (score >= MIN_SCORE) {
      results.push({ kind: 'restaurant', score, restaurant: r });
    }
  }

  // ── Dishes ─────────────────────────────────────────────────────────────────
  for (const item of cache.items) {
    const score = scoreFields(q, [item.name, item.category, item.description]);
    if (score >= MIN_SCORE) {
      results.push({ kind: 'dish', score, item });
    }
  }

  // ── Cuisines ───────────────────────────────────────────────────────────────
  const cuisineMap = new Map<string, number>();
  for (const r of cache.restaurants) {
    for (const c of r.cuisine ?? []) {
      const s = fuzzyScore(q, c);
      if (s >= MIN_SCORE) cuisineMap.set(c, (cuisineMap.get(c) ?? 0) + 1);
    }
  }
  cuisineMap.forEach((count, cuisine) => {
    const score = fuzzyScore(q, cuisine);
    results.push({ kind: 'cuisine', score, cuisine, count });
  });

  // Sort by score desc, cap at 60 total
  return results.sort((a, b) => b.score - a.score).slice(0, 60);
}
