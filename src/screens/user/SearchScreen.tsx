/**
 * SearchScreen.tsx — Full-screen search with fuzzy matching & recent searches
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { searchAll, SearchResult } from '../../utils/fuzzy';
import {
  addRecentSearch,
  clearRecentSearches,
  getCachedData,
  getRecentSearches,
  warmCache,
} from '../../services/searchCache';

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  onClose: () => void;
  onSelectRestaurant: (restaurantId: string) => void;
}

type FilterTab = 'All' | 'Restaurants' | 'Dishes' | 'Cuisines';

const TAB_META: { key: FilterTab; icon: string; color: string; bg: string; activeBg: string }[] = [
  { key: 'All',         icon: '✨', color: '#7C3AED', bg: '#F5F3FF', activeBg: '#7C3AED' },
  { key: 'Restaurants', icon: '🏠', color: '#F5C116', bg: '#FEE2E2', activeBg: '#F5C116' },
  { key: 'Dishes',      icon: '🍽️', color: '#D97706', bg: '#FEF3C7', activeBg: '#D97706' },
  { key: 'Cuisines',    icon: '🌏', color: '#0891B2', bg: '#E0F7FA', activeBg: '#0891B2' },
];

// ── Tab Button ──────────────────────────────────────────────────────────────────
function TabButton({
  meta, active, onPress, count, scrollRef,
}: {
  meta: typeof TAB_META[0];
  active: boolean;
  onPress: () => void;
  count: number;
  scrollRef: React.RefObject<ScrollView>;
}) {
  const offsetX = useRef(0);

  const handlePress = () => {
    // Scroll this tab fully into view
    scrollRef.current?.scrollTo({ x: Math.max(0, offsetX.current - 12), animated: true });
    onPress();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.75}
      onLayout={e => { offsetX.current = e.nativeEvent.layout.x; }}
      style={[
        tb.btn,
        { backgroundColor: active ? meta.activeBg : meta.bg },
        active && tb.btnActive,
      ]}
    >
      {active && <View style={[tb.glow, { backgroundColor: meta.activeBg }]} />}
      <Text style={tb.icon}>{meta.icon}</Text>
      <Text style={[tb.label, { color: active ? '#FFF' : meta.color }]}>
        {meta.key}
      </Text>
      {count > 0 && (
        <View style={[tb.badge, { backgroundColor: active ? 'rgba(255,255,255,0.25)' : meta.color }]}>
          <Text style={tb.badgeText}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function SearchScreen({ onClose, onSelectRestaurant }: Props) {
  const [query, setQuery]           = useState('');
  const [tab, setTab]               = useState<FilterTab>('All');
  const [results, setResults]       = useState<SearchResult[]>([]);
  const [recent, setRecent]         = useState<string[]>([]);
  const [loading, setLoading]       = useState(false);
  const [cacheReady, setCacheReady] = useState(false);

  const inputRef       = useRef<TextInput>(null);
  const scrollRef      = useRef<ScrollView>(null);
  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slideAnim      = useRef(new Animated.Value(50)).current;
  const opacityAnim    = useRef(new Animated.Value(0)).current;

  // Animate in
  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 90, friction: 11 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    setTimeout(() => inputRef.current?.focus(), 160);
  }, []);

  // Load recent searches & ensure cache is warm
  useEffect(() => {
    getRecentSearches().then(setRecent);
    const cache = getCachedData();
    if (cache.restaurants.length > 0) {
      setCacheReady(true);
    } else {
      setLoading(true);
      warmCache().then(() => { setCacheReady(true); setLoading(false); });
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(() => {
      const cache = getCachedData();
      const all = searchAll(query, cache);
      setResults(all);
    }, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, cacheReady]);

  const handleSelect = useCallback(async (q: string, restaurantId?: string) => {
    await addRecentSearch(q);
    if (restaurantId) onSelectRestaurant(restaurantId);
  }, [onSelectRestaurant]);

  const filteredResults = results.filter(r => {
    if (tab === 'All')         return true;
    if (tab === 'Restaurants') return r.kind === 'restaurant';
    if (tab === 'Dishes')      return r.kind === 'dish';
    if (tab === 'Cuisines')    return r.kind === 'cuisine';
    return true;
  });

  // Count per tab for badges
  const counts = {
    All: results.length,
    Restaurants: results.filter(r => r.kind === 'restaurant').length,
    Dishes:      results.filter(r => r.kind === 'dish').length,
    Cuisines:    results.filter(r => r.kind === 'cuisine').length,
  };

  // ── Result row ───────────────────────────────────────────────────────────────
  const renderResult = ({ item: res }: { item: SearchResult }) => {
    if (res.kind === 'restaurant') {
      const r = res.restaurant;
      return (
        <TouchableOpacity style={st.resultRow} onPress={() => handleSelect(r.name, r.restaurantId)} activeOpacity={0.7}>
          <View style={[st.resultIcon, { backgroundColor: '#FEE2E2' }]}>
            <Text style={st.resultIconText}>🏠</Text>
          </View>
          <View style={st.resultText}>
            <Text style={st.resultTitle} numberOfLines={1}>{r.name}</Text>
            <Text style={st.resultSub} numberOfLines={1}>
              {(r.cuisine ?? []).join(' • ') || 'Restaurant'}
              {'   '}{r.isOpen === false ? '🔴 Closed' : '🟢 Open'}
            </Text>
          </View>
          <View style={[st.kindPill, { backgroundColor: '#FEE2E2' }]}>
            <Text style={[st.kindPillText, { color: '#F5C116' }]}>Restaurant</Text>
          </View>
        </TouchableOpacity>
      );
    }
    if (res.kind === 'dish') {
      const d = res.item;
      return (
        <TouchableOpacity style={st.resultRow} onPress={() => handleSelect(d.name, d.restaurantId)} activeOpacity={0.7}>
          <View style={[st.resultIcon, { backgroundColor: '#FEF3C7' }]}>
            <Text style={st.resultIconText}>{d.isVeg ? '🥗' : '🍗'}</Text>
          </View>
          <View style={st.resultText}>
            <Text style={st.resultTitle} numberOfLines={1}>{d.name}</Text>
            <Text style={st.resultSub} numberOfLines={1}>
              {d.restaurantName || 'Restaurant'}{'   '}₹{d.price}
            </Text>
          </View>
          <View style={[st.kindPill, { backgroundColor: '#FEF3C7' }]}>
            <Text style={[st.kindPillText, { color: '#D97706' }]}>Dish</Text>
          </View>
        </TouchableOpacity>
      );
    }
    if (res.kind === 'cuisine') {
      return (
        <TouchableOpacity style={st.resultRow} onPress={() => handleSelect(res.cuisine)} activeOpacity={0.7}>
          <View style={[st.resultIcon, { backgroundColor: '#E0F7FA' }]}>
            <Text style={st.resultIconText}>🌏</Text>
          </View>
          <View style={st.resultText}>
            <Text style={st.resultTitle}>{res.cuisine}</Text>
            <Text style={st.resultSub}>{res.count} restaurant{res.count !== 1 ? 's' : ''}</Text>
          </View>
          <View style={[st.kindPill, { backgroundColor: '#E0F7FA' }]}>
            <Text style={[st.kindPillText, { color: '#0891B2' }]}>Cuisine</Text>
          </View>
        </TouchableOpacity>
      );
    }
    return null;
  };

  return (
    <Animated.View style={[st.container, { opacity: opacityAnim, transform: [{ translateY: slideAnim }] }]}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={st.header}>
        <View style={st.inputRow}>
          <Text style={st.searchIcon}>🔍</Text>
          <TextInput
            ref={inputRef}
            style={st.input}
            placeholder="Restaurants, dishes, cuisines…"
            placeholderTextColor="rgba(255,255,255,0.6)"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
            selectionColor="#FFF"
            onSubmitEditing={() => { if (query.trim()) addRecentSearch(query.trim()); }}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} style={st.clearBtn}>
              <View style={st.clearCircle}><Text style={st.clearX}>✕</Text></View>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={onClose} style={st.cancelBtn} activeOpacity={0.7}>
          <Text style={st.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* ── Filter Tabs ────────────────────────────────────────────────────── */}
      {query.length > 0 && (
        <View style={st.tabsContainer}>
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={st.tabsRow}
            decelerationRate={0.985}
            scrollEventThrottle={1}
            overScrollMode="never"
            bounces={false}
            directionalLockEnabled
          >
            {TAB_META.map(meta => (
              <TabButton
                key={meta.key}
                meta={meta}
                active={tab === meta.key}
                onPress={() => setTab(meta.key)}
                count={counts[meta.key]}
                scrollRef={scrollRef}
              />
            ))}
          </ScrollView>
          {/* Right-edge fade to hint scrollability */}
          <View style={st.fadeRight} pointerEvents="none" />
        </View>
      )}

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {loading && (
        <View style={st.centered}>
          <ActivityIndicator color="#F5C116" size="large" />
          <Text style={st.loadingText}>Loading search index…</Text>
        </View>
      )}

      {/* ── No query → recent searches ──────────────────────────────────────── */}
      {!loading && !query && (
        <View style={st.recentSection}>
          {recent.length > 0 ? (
            <>
              <View style={st.recentHeader}>
                <Text style={st.recentTitle}>🕐  Recent Searches</Text>
                <TouchableOpacity onPress={async () => { await clearRecentSearches(); setRecent([]); }}>
                  <Text style={st.clearAllText}>Clear all</Text>
                </TouchableOpacity>
              </View>
              <View style={st.chipsWrap}>
                {recent.map(r => (
                  <TouchableOpacity key={r} style={st.chip} onPress={() => setQuery(r)} activeOpacity={0.7}>
                    <Text style={st.chipText}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : (
            <View style={st.centered}>
              <Text style={st.emptyEmoji}>🔍</Text>
              <Text style={st.emptyTitle}>Search TownPulse</Text>
              <Text style={st.emptySubtitle}>Find restaurants, dishes, and cuisines near you</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Results ─────────────────────────────────────────────────────────── */}
      {!loading && query.length > 0 && (
        <FlatList
          data={filteredResults}
          keyExtractor={(item, i) => `${item.kind}-${i}`}
          renderItem={renderResult}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={filteredResults.length === 0 ? st.emptyList : undefined}
          ListEmptyComponent={
            <View style={st.centered}>
              <Text style={st.emptyEmoji}>😕</Text>
              <Text style={st.emptyTitle}>No results for "{query}"</Text>
              <Text style={st.emptySubtitle}>Try checking for typos or use a different word</Text>
            </View>
          }
        />
      )}
    </Animated.View>
  );
}

// ── Tab button styles ──────────────────────────────────────────────────────────
const tb = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 24,
    // subtle shadow
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    overflow: 'hidden',
  },
  btnActive: {
    shadowOpacity: 0.22, shadowRadius: 10, elevation: 6,
  },
  glow: {
    position: 'absolute', top: -20, left: -20, right: -20, bottom: -20, opacity: 0.15,
  },
  icon: { fontSize: 14 },
  label: { fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
  badge: {
    minWidth: 18, height: 18, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
  },
  badgeText: { fontSize: 10, fontWeight: '800' },
});

// ── Screen styles ──────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  container: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#FAFAFA', zIndex: 999,
  },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 50, paddingHorizontal: 12, paddingBottom: 12,
    backgroundColor: '#B71C1C', gap: 10,
  },
  inputRow: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 14, paddingHorizontal: 12, height: 44,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  searchIcon: { fontSize: 15, marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: '#FFF', paddingVertical: 0 },
  clearBtn: { padding: 4 },
  clearCircle: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center', alignItems: 'center',
  },
  clearX: { fontSize: 10, color: '#FFF', fontWeight: '700' },
  cancelBtn: { paddingHorizontal: 4 },
  cancelText: { color: '#FFF', fontSize: 15, fontWeight: '600' },

  // Tabs wrapper — no overflow clip so ScrollView can scroll freely
  tabsContainer: {
    backgroundColor: '#FAE08B',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tabsRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, paddingRight: 36 },
  // Right fade to hint there are more tabs
  fadeRight: {
    position: 'absolute',
    right: 0, top: 0, bottom: 0,
    width: 32,
    // Simulate a fade using a semi-transparent white gradient
    backgroundColor: 'rgba(255,255,255,0.85)',
  },

  // Results
  resultRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
    backgroundColor: '#FAE08B',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  resultIcon: {
    width: 46, height: 46, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  resultIconText: { fontSize: 22 },
  resultText: { flex: 1 },
  resultTitle: { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 3 },
  resultSub: { fontSize: 12, color: '#6B7280' },
  kindPill: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  kindPillText: { fontSize: 10, fontWeight: '700' },

  // Recent searches
  recentSection: { flex: 1, padding: 18 },
  recentHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14,
  },
  recentTitle: { fontSize: 15, fontWeight: '700', color: '#111' },
  clearAllText: { fontSize: 13, color: '#F5C116', fontWeight: '600' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#F3F4F6', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 9,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  chipText: { fontSize: 13, color: '#374151', fontWeight: '500' },

  // Empty / loading
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  loadingText: { marginTop: 12, color: '#6B7280', fontSize: 14 },
  emptyList: { flex: 1 },
  emptyEmoji: { fontSize: 52, marginBottom: 14 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', paddingHorizontal: 32, lineHeight: 20 },
});


