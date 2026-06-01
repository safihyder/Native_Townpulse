/**
 * searchCache.ts — Warm and persist the local search index
 *
 * On app launch (or after restaurant_updated WS event) call warmCache().
 * getCachedData() returns the latest data synchronously from memory,
 * falling back to AsyncStorage, then network.
 *
 * Cache key: tp_search_cache_v1
 * TTL: 30 minutes
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { appConfig } from '../config/appConfig';
import type { SearchCache } from '../utils/fuzzy';

const CACHE_KEY = 'tp_search_cache_v1';
const TTL_MS = 30 * 60 * 1000; // 30 minutes

let _memCache: SearchCache | null = null;
let _warming = false;

interface StoredCache {
  ts: number;
  data: SearchCache;
}

async function fetchFromNetwork(): Promise<SearchCache> {
  const BASE = appConfig.apiBaseUrl;
  const [restRes, itemsRes] = await Promise.all([
    fetch(`${BASE}/api/restaurants?limit=100`).then(r => r.json()),
    fetch(`${BASE}/api/items/all-public`).then(r => r.json()),
  ]);
  return {
    restaurants: restRes.restaurants ?? [],
    items: itemsRes.items ?? [],
  };
}

/** Call on app mount and after restaurant_updated WebSocket events */
export async function warmCache(force = false): Promise<SearchCache> {
  if (_warming) return _memCache ?? { restaurants: [], items: [] };
  _warming = true;
  try {
    // Try AsyncStorage first
    if (!force) {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (raw) {
        const stored: StoredCache = JSON.parse(raw);
        if (Date.now() - stored.ts < TTL_MS) {
          _memCache = stored.data;
          return _memCache;
        }
      }
    }
    // Fetch from network
    const fresh = await fetchFromNetwork();
    _memCache = fresh;
    const stored: StoredCache = { ts: Date.now(), data: fresh };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(stored));
    return fresh;
  } catch (err) {
    // Network failure — use stale cache or empty
    if (_memCache) return _memCache;
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (raw) {
        _memCache = (JSON.parse(raw) as StoredCache).data;
        return _memCache;
      }
    } catch {}
    return { restaurants: [], items: [] };
  } finally {
    _warming = false;
  }
}

/** Returns cached data synchronously (may be null before first warm) */
export function getCachedData(): SearchCache {
  return _memCache ?? { restaurants: [], items: [] };
}

// ── Recent Searches ────────────────────────────────────────────────────────────
const RECENT_KEY = 'tp_recent_searches_v1';
const MAX_RECENT = 10;

export async function getRecentSearches(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function addRecentSearch(query: string): Promise<void> {
  if (!query.trim()) return;
  try {
    const q = query.trim();
    const prev = await getRecentSearches();
    const next = [q, ...prev.filter(p => p.toLowerCase() !== q.toLowerCase())].slice(0, MAX_RECENT);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}

export async function clearRecentSearches(): Promise<void> {
  try { await AsyncStorage.removeItem(RECENT_KEY); } catch {}
}
