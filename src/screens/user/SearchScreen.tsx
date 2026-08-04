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
import { theme } from '../../theme/tokens';
import { SearchIcon, ClockIcon } from '../../components/SvgIcons';

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  onClose: () => void;
  onSelectRestaurant: (restaurantId: string, itemId?: string) => void;
}

type FilterTab = 'All' | 'Restaurants' | 'Dishes' | 'Cuisines';

const TAB_META: { key: FilterTab; icon: string; color: string; bg: string; activeBg: string }[] = [
  { key: 'All', icon: '✨', color: '#7C3AED', bg: '#F5F3FF', activeBg: '#7C3AED' },
  { key: 'Restaurants', icon: '🏠', color: '#F5A623', bg: '#FFF5E5', activeBg: '#F5A623' },
  { key: 'Dishes', icon: '🍽️', color: '#D97706', bg: '#FEF3C7', activeBg: '#D97706' },
  { key: 'Cuisines', icon: '🌏', color: '#0891B2', bg: '#E0F7FA', activeBg: '#0891B2' },
];

// ── Tab Button ──────────────────────────────────────────────────────────────────
function TabButton({
  meta, active, onPress, count, scrollRef,
}: {
  meta: typeof TAB_META[0];
  active: boolean;
  onPress: () => void;
  count: number;
  scrollRef: React.RefObject<ScrollView | null>;
}) {
  const offsetX = useRef(0);

  const handlePress = () => {
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
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<FilterTab>('All');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [cacheReady, setCacheReady] = useState(false);

  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slideAnim = useRef(new Animated.Value(50)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 90, friction: 11 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    setTimeout(() => inputRef.current?.focus(), 160);
  }, []);

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

  const handleSelect = useCallback(async (q: string, restaurantId?: string, itemId?: string) => {
    await addRecentSearch(q);
    if (restaurantId) onSelectRestaurant(restaurantId, itemId);
  }, [onSelectRestaurant]);

  const filteredResults = results.filter(r => {
    if (tab === 'All') return true;
    if (tab === 'Restaurants') return r.kind === 'restaurant';
    if (tab === 'Dishes') return r.kind === 'dish';
    if (tab === 'Cuisines') return r.kind === 'cuisine';
    return true;
  });

  const counts = {
    All: results.length,
    Restaurants: results.filter(r => r.kind === 'restaurant').length,
    Dishes: results.filter(r => r.kind === 'dish').length,
    Cuisines: results.filter(r => r.kind === 'cuisine').length,
  };

  const renderResult = ({ item: res }: { item: SearchResult }) => {
    if (res.kind === 'restaurant') {
      const r = res.restaurant;
      return (
        <TouchableOpacity style={st.resultRow} onPress={() => handleSelect(r.name, r.restaurantId)} activeOpacity={0.7}>
          <View style={[st.resultIcon, { backgroundColor: '#FFF5E5' }]}>
            <Text style={st.resultIconText}>🏠</Text>
          </View>
          <View style={st.resultText}>
            <Text style={st.resultTitle} numberOfLines={1}>{r.name}</Text>
            <Text style={st.resultSub} numberOfLines={1}>
              {(r.cuisine ?? []).join(' • ') || 'Restaurant'}
              {'   '}{r.isOpen === false ? '🔴 Closed' : '🟢 Open'}
            </Text>
          </View>
          <View style={[st.kindPill, { backgroundColor: '#FFF5E5' }]}>
            <Text style={[st.kindPillText, { color: '#F5A623' }]}>Restaurant</Text>
          </View>
        </TouchableOpacity>
      );
    }
    if (res.kind === 'dish') {
      const d = res.item;
      return (
        <TouchableOpacity style={st.resultRow} onPress={() => handleSelect(d.name, d.restaurantId, d._id)} activeOpacity={0.7}>
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
          <View style={st.searchIcon}>
            <SearchIcon size={18} color={theme.colors.ink500} />
          </View>
          <TextInput
            ref={inputRef}
            style={st.input}
            placeholder="Search food, restaurant..."
            placeholderTextColor={theme.colors.ink500}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
            selectionColor={theme.colors.accentOrange}
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
          <View style={st.fadeRight} pointerEvents="none" />
        </View>
      )}

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {loading && (
        <View style={st.centered}>
          <ActivityIndicator color={theme.colors.accentOrange} size="large" />
          <Text style={st.loadingText}>Loading search index…</Text>
        </View>
      )}

      {/* ── No query → recent searches ──────────────────────────────────────── */}
      {!loading && !query && (
        <View style={st.recentSection}>
          {recent.length > 0 ? (
            <>
              <View style={st.recentHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ClockIcon size={18} color={theme.colors.ink900} />
                  <Text style={st.recentTitle}>Recent Searches</Text>
                </View>
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
    backgroundColor: theme.colors.brandCanvas, zIndex: 999,
  },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 50, paddingHorizontal: 16, paddingBottom: 16,
    backgroundColor: theme.colors.brandCanvas, gap: 10,
    borderBottomWidth: 1, borderBottomColor: theme.colors.line,
  },
  inputRow: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16, paddingHorizontal: 16, height: 48,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  searchIcon: { marginRight: 8, justifyContent: 'center' },
  input: { flex: 1, fontSize: 15, color: theme.colors.ink900, paddingVertical: 0, fontWeight: '500' },
  clearBtn: { padding: 4 },
  clearCircle: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: theme.colors.ink500,
    justifyContent: 'center', alignItems: 'center',
  },
  clearX: { fontSize: 10, color: theme.colors.white, fontWeight: '700' },
  cancelBtn: { paddingHorizontal: 4 },
  cancelText: { color: theme.colors.accentOrange, fontSize: 15, fontWeight: '600' },

  // Tabs
  tabsContainer: {
    backgroundColor: theme.colors.brandCanvas,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.line,
  },
  tabsRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, paddingRight: 36 },
  fadeRight: {
    position: 'absolute',
    right: 0, top: 0, bottom: 0,
    width: 32,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },

  // Results
  resultRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 16,
    backgroundColor: theme.colors.brandCanvas,
    borderBottomWidth: 1, borderBottomColor: theme.colors.line,
  },
  resultIcon: {
    width: 46, height: 46, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginRight: 16,
  },
  resultIconText: { fontSize: 22 },
  resultText: { flex: 1 },
  resultTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.ink900, marginBottom: 4 },
  resultSub: { fontSize: 13, color: theme.colors.ink500 },
  kindPill: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  kindPillText: { fontSize: 10, fontWeight: '700' },

  // Recent searches
  recentSection: { flex: 1, padding: 24 },
  recentHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  recentTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.ink900 },
  clearAllText: { fontSize: 13, color: theme.colors.accentOrange, fontWeight: '600' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    backgroundColor: '#F9FAFB', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  chipText: { fontSize: 14, color: theme.colors.ink700, fontWeight: '500' },

  // Empty / loading
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 80 },
  loadingText: { marginTop: 16, color: theme.colors.ink500, fontSize: 14, fontWeight: '500' },
  emptyList: { flex: 1 },
  emptyEmoji: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: theme.colors.ink900, marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 15, color: theme.colors.ink500, textAlign: 'center', paddingHorizontal: 32, lineHeight: 22 },
});
