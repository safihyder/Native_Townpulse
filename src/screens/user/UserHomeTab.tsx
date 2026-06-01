import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getHomeBanners, getRestaurants } from '../../services/userApi';
import { appConfig } from '../../config/appConfig';
import { useRestaurantSocket } from '../../hooks/useRestaurantSocket';
import { warmCache } from '../../services/searchCache';
import SearchScreen from './SearchScreen';

const { width: SCREEN_W } = Dimensions.get('window');
const BANNER_W = SCREEN_W - 32;

type Props = { idToken: string; userName: string; onOpenRestaurant: (id: string) => void };

// ── Helpers ───────────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// Cuisine → accent colour for card placeholder
const CUISINE_COLORS: Record<string, [string, string]> = {
  Burgers:    ['#FF6B35', '#FF8C42'],
  Pizza:      ['#F5C116', '#E53935'],
  'Fast Food':['#F57C00', '#FB8C00'],
  Chinese:    ['#D32F2F', '#EF5350'],
  Indian:     ['#6A1B9A', '#8E24AA'],
  Healthy:    ['#2E7D32', '#43A047'],
  Noodles:    ['#1565C0', '#1976D2'],
  Desserts:   ['#AD1457', '#D81B60'],
  default:    ['#37474F', '#546E7A'],
};

function cuisineColor(cuisines: string[]): [string, string] {
  for (const c of cuisines) {
    if (CUISINE_COLORS[c]) return CUISINE_COLORS[c];
  }
  return CUISINE_COLORS.default;
}

// ── Banner Slide ──────────────────────────────────────────────────────────────
function BannerSlide({ item }: { item: any }) {
  const [g1, g2] = item.gradient ?? ['#E53935', '#B71C1C'];
  return (
    <View style={[bannerSt.slide, { backgroundColor: g1, width: BANNER_W }]}>
      <View style={[bannerSt.slideOverlay, { backgroundColor: g2 }]} />
      <View style={bannerSt.decor1} />
      <View style={bannerSt.decor2} />
      <View style={bannerSt.content}>
        <Text style={bannerSt.emoji}>{item.emoji ?? '🎉'}</Text>
        <Text style={bannerSt.title}>{item.title}</Text>
        <Text style={bannerSt.sub}>{item.subtitle}</Text>
      </View>
    </View>
  );
}

// ── Category Chip ─────────────────────────────────────────────────────────────
function CategoryChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[chipSt.chip, active && chipSt.active]} onPress={onPress} activeOpacity={0.75}>
      <Text style={[chipSt.label, active && chipSt.labelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Restaurant Card ───────────────────────────────────────────────────────────
function RestaurantCard({ restaurant, onPress, liveIsOpen }: { restaurant: any; onPress: () => void; liveIsOpen?: boolean }) {
  // Use live socket status if available, fall back to API-computed isOpen
  const isOpen = liveIsOpen !== undefined ? liveIsOpen : restaurant.isOpen !== false;
  const cuisines: string[] = restaurant.cuisine ?? [];
  const cuisineLabel = cuisines.slice(0, 2).join(' • ') || 'Restaurant';
  const [c1, c2] = cuisineColor(cuisines);
  const initial = (restaurant.name ?? 'R')[0].toUpperCase();

  // Normalise banner to array
  const banners: string[] = Array.isArray(restaurant.banner)
    ? restaurant.banner.filter(Boolean)
    : typeof restaurant.banner === 'string' && restaurant.banner
      ? [restaurant.banner]
      : [];

  // Per-card carousel state
  const [activeSlide, setActiveSlide] = useState(0);
  const flatRef = useRef<FlatList>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idxRef = useRef(0);

  useEffect(() => {
    if (banners.length < 2) return;
    timerRef.current = setInterval(() => {
      const next = (idxRef.current + 1) % banners.length;
      idxRef.current = next;
      flatRef.current?.scrollToIndex({ index: next, animated: true });
      setActiveSlide(next);
    }, 2500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [banners.length]);

  const CARD_W = Dimensions.get('window').width - 32; // section has 16px padding each side

  return (
    <TouchableOpacity style={cardSt.card} onPress={onPress} activeOpacity={0.88}>
      {/* ── Banner Carousel ── */}
      <View style={cardSt.imageBox}>
        {banners.length > 0 ? (
          <>
            <FlatList
              ref={flatRef}
              data={banners}
              keyExtractor={(_, i) => String(i)}
              renderItem={({ item }) => (
                <Image
                  source={{ uri: item }}
                  style={{ width: CARD_W, height: 148 }}
                  resizeMode="cover"
                />
              )}
              horizontal
              pagingEnabled
              scrollEnabled={false}
              showsHorizontalScrollIndicator={false}
              style={{ width: CARD_W, height: 148 }}
              getItemLayout={(_, i) => ({ length: CARD_W, offset: CARD_W * i, index: i })}
            />
            {/* Slide dots */}
            {banners.length > 1 && (
              <View style={cardSt.dotsRow}>
                {banners.map((_, i) => (
                  <View key={i} style={[cardSt.dot, i === activeSlide && cardSt.dotActive]} />
                ))}
              </View>
            )}
          </>
        ) : (
          /* Gradient placeholder when no banners uploaded */
          <View style={[cardSt.imagePlaceholder, { backgroundColor: c2 }]}>
            <Text style={cardSt.imageLetter}>{initial}</Text>
            <Text style={cardSt.imageCuisine}>{cuisines[0] ?? ''}</Text>
          </View>
        )}

        {/* Closed overlay */}
        {!isOpen && (
          <View style={cardSt.closedOverlay}>
            <Text style={cardSt.closedText}>CLOSED</Text>
          </View>
        )}
        {/* Premium badge */}
        {restaurant.flags?.isPremium && (
          <View style={cardSt.premiumBadge}>
            <Text style={cardSt.premiumText}>⭐ PREMIUM</Text>
          </View>
        )}
      </View>

      {/* ── Info ── */}
      <View style={cardSt.info}>
        <View style={cardSt.nameRow}>
          <Text style={cardSt.name} numberOfLines={1}>{restaurant.name}</Text>
          <View style={cardSt.ratingBadge}>
            <Text style={cardSt.ratingStar}>★</Text>
            <Text style={cardSt.ratingVal}>{Number(restaurant.rating || 0).toFixed(1)}</Text>
          </View>
        </View>
        <Text style={cardSt.cuisine} numberOfLines={1}>{cuisineLabel}</Text>
        <View style={cardSt.metaRow}>
          <View style={[cardSt.metaChip, { backgroundColor: 'rgba(245,193,22,0.12)' }]}>
            <Text style={[cardSt.metaText, { color: '#F5C116' }]}>🛵 ₹40</Text>
          </View>
          <View style={[cardSt.metaChip, { backgroundColor: 'rgba(229,57,53,0.12)' }]}>
            <Text style={[cardSt.metaText, { color: '#E53935' }]}>⏱ 25–35 min</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function UserHomeTab({ idToken, userName, onOpenRestaurant }: Props) {
  const [banners, setBanners] = useState<any[]>([]);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>(['All']);
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeBannerIdx, setActiveBannerIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchVisible, setSearchVisible] = useState(false);

  // Live status + cache refresh from WebSocket
  const { statusMap, onRestaurantUpdate } = useRestaurantSocket();

  // Warm search cache on mount
  useEffect(() => {
    warmCache();
  }, []);

  const bannerRef = useRef<FlatList>(null);
  const autoScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentIdx = useRef(0);

  const [activeOrder, setActiveOrder] = useState<any>(null);

  const loadData = useCallback(async () => {
    try {
      // Fetch each independently so one failure doesn't block the others
      const [bannerRes, restRes, orderRes] = await Promise.all([
        getHomeBanners().catch(() => ({ banners: null })),
        getRestaurants({ limit: 50 }).catch(() => ({ restaurants: [] })),
        fetch(`${appConfig.apiBaseUrl}/api/orders/my-orders`, { headers: { Authorization: `Bearer ${idToken}` } }).then(r => r.json()).catch(() => ({})),
      ]);
      if (bannerRes.banners) setBanners(bannerRes.banners);
      const rests: any[] = restRes.restaurants ?? [];
      setRestaurants(rests);
      const allCuisines = new Set<string>();
      rests.forEach(r => (r.cuisine ?? []).forEach((c: string) => allCuisines.add(c)));
      setCategories(['All', ...Array.from(allCuisines)]);
      
      if (orderRes?.success && orderRes.data?.length > 0) {
        const active = orderRes.data.find((o: any) => !['DELIVERED', 'CANCELLED'].includes(o.status));
        setActiveOrder(active || null);
      } else {
        setActiveOrder(null);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [idToken]);

  // Wire up socket-triggered refresh (declared AFTER loadData)
  useEffect(() => {
    onRestaurantUpdate.current = () => { warmCache(true); loadData(); };
  }, [loadData, onRestaurantUpdate]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-scroll
  useEffect(() => {
    if (banners.length < 2) return;
    autoScrollTimer.current = setInterval(() => {
      const next = (currentIdx.current + 1) % banners.length;
      currentIdx.current = next;
      bannerRef.current?.scrollToIndex({ index: next, animated: true });
      setActiveBannerIdx(next); // ✅ update state so dots re-render
    }, 3500);
    return () => { if (autoScrollTimer.current) clearInterval(autoScrollTimer.current); };
  }, [banners.length]);

  const filtered = activeCategory === 'All'
    ? restaurants
    : restaurants.filter(r => (r.cuisine ?? []).includes(activeCategory));

  return (
    <View style={s.root}>
      {/* ── Search Overlay ───────────────────────────────────── */}
      {searchVisible && (
        <SearchScreen
          onClose={() => setSearchVisible(false)}
          onSelectRestaurant={(restaurantId) => {
            setSearchVisible(false);
            onOpenRestaurant(restaurantId);
          }}
        />
      )}

      {/* ── Header ─────────────────────────────────────────── */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <View style={s.headerLeft}>
            <Text style={s.greeting}>{getGreeting()}, {userName.split(' ')[0]} 👋</Text>
            <TouchableOpacity style={s.locationRow} activeOpacity={0.7}>
              <Text style={s.locationPin}>📍</Text>
              <Text style={s.locationText} numberOfLines={1}>Mumbai, Maharashtra</Text>
              <Text style={s.locationChevron}>▾</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar — tappable, opens SearchScreen */}
        <TouchableOpacity style={s.searchBar} activeOpacity={0.8} onPress={() => setSearchVisible(true)}>
          <Text style={s.searchIcon}>🔍</Text>
          <Text style={s.searchPlaceholder}>Search restaurants or dishes...</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Banner Carousel ─────────────────────────────── */}
        {banners.length > 0 && (
          <View style={s.bannerSection}>
            <FlatList
              ref={bannerRef}
              data={banners}
              keyExtractor={item => item.id}
              renderItem={({ item }) => <BannerSlide item={item} />}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              snapToInterval={BANNER_W + 12}
              decelerationRate="fast"
              ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
              onMomentumScrollEnd={e => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / (BANNER_W + 12));
                currentIdx.current = idx;
                setActiveBannerIdx(idx); // ✅ user-swipe also updates dots
              }}
              getItemLayout={(_, i) => ({ length: BANNER_W + 12, offset: (BANNER_W + 12) * i, index: i })}
            />
            {/* Dots */}
            <View style={s.dotsRow}>
              {banners.map((_, i) => (
                <View key={i} style={[s.dot, i === activeBannerIdx && s.dotActive]} />
              ))}
            </View>
          </View>
        )}

        {loading && <View style={s.loadingBox}><ActivityIndicator color="#F5C116" size="large" /></View>}

        {!loading && (
          <>
            {/* ── Categories ──────────────────────────────── */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Browse by Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow}>
                {categories.map(cat => (
                  <CategoryChip key={cat} label={cat} active={cat === activeCategory}
                    onPress={() => setActiveCategory(cat)} />
                ))}
              </ScrollView>
            </View>

            {/* ── Restaurants ─────────────────────────────── */}
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>{activeCategory === 'All' ? 'All Restaurants' : activeCategory}</Text>
                <Text style={s.sectionCount}>{filtered.length} places</Text>
              </View>
              {filtered.length === 0 ? (
                <View style={s.empty}>
                  <Text style={s.emptyEmoji}>🍽️</Text>
                  <Text style={s.emptyText}>No restaurants here yet</Text>
                </View>
              ) : (
                filtered.map(r => (
                  <RestaurantCard
                    key={r._id}
                    restaurant={r}
                    onPress={() => onOpenRestaurant(r.restaurantId)}
                    liveIsOpen={statusMap[r.restaurantId]}
                  />
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* ── Active Order Banner ─────────────────────────────── */}
      {activeOrder && (
        <View style={s.activeOrderBanner}>
          <View style={s.activeOrderBannerContent}>
            <View style={s.activeOrderIconBox}>
              <Text style={s.activeOrderIcon}>🛵</Text>
            </View>
            <View style={s.activeOrderTextCol}>
              <Text style={s.activeOrderTitle}>Track your order</Text>
              <Text style={s.activeOrderStatus}>{activeOrder.status.replace(/_/g, ' ')}</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFBF0' },

  activeOrderBanner: {
    position: 'absolute', bottom: 16, left: 16, right: 16,
    backgroundColor: '#FAE08B', borderRadius: 16,
    shadowColor: '#F5C116', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
    borderWidth: 2, borderColor: '#F5C116',
  },
  activeOrderBannerContent: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  activeOrderIconBox: { backgroundColor: 'rgba(245,193,22,0.15)', padding: 12, borderRadius: 12 },
  activeOrderIcon: { fontSize: 24 },
  activeOrderTextCol: { flex: 1 },
  activeOrderTitle: { fontSize: 13, color: '#6B7280', fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
  activeOrderStatus: { fontSize: 16, fontWeight: '800', color: '#111827' },

  // Header
  header: {
    backgroundColor: '#FAE08B',
    paddingTop: 48, paddingHorizontal: 16, paddingBottom: 14,
    gap: 10,
    borderBottomWidth: 1, borderBottomColor: '#F3EFE6',
  },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerLeft: { flex: 1 },
  greeting: { color: '#6B7280', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationPin: { fontSize: 14 },
  locationText: { color: '#111827', fontSize: 18, fontWeight: '800', flex: 1 },
  locationChevron: { color: '#111827', fontSize: 16 },

  // Clean search bar
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFFBF0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: '#F5C116',
  },
  searchIcon: { fontSize: 16 },
  searchPlaceholder: { fontSize: 14, color: '#9CA3AF', flex: 1 },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 100 },

  bannerSection: { paddingTop: 16, paddingLeft: 16 },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 10, gap: 5 },
  dot: { height: 6, width: 6, borderRadius: 3, backgroundColor: '#3A3A3A' },
  dotActive: { backgroundColor: '#F5C116', width: 20, borderRadius: 3 },

  loadingBox: { paddingTop: 80, alignItems: 'center' },

  section: { marginTop: 22, paddingHorizontal: 16 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 12 },
  sectionCount: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  chipsRow: { gap: 8, paddingBottom: 4 },
  empty: { alignItems: 'center', paddingVertical: 40, backgroundColor: '#FAE08B', borderRadius: 16 },
  emptyEmoji: { fontSize: 40, marginBottom: 8 },
  emptyText: { color: '#6B7280', fontSize: 14 },
});

const bannerSt = StyleSheet.create({
  slide: {
    height: 148, borderRadius: 18, overflow: 'hidden',
    justifyContent: 'flex-end', padding: 20, position: 'relative',
  },
  slideOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, top: '60%', opacity: 0.4, borderRadius: 18,
  },
  decor1: {
    position: 'absolute', width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(245,193,22,0.08)', top: -30, right: -20,
  },
  decor2: {
    position: 'absolute', width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(245,193,22,0.1)', top: 20, right: 70,
  },
  content: { zIndex: 2 },
  emoji: { fontSize: 30, marginBottom: 4 },
  title: { color: '#111827', fontSize: 21, fontWeight: '900', letterSpacing: 0.2 },
  sub: { color: '#374151', fontSize: 13, fontWeight: '500', marginTop: 2 },
});

const chipSt = StyleSheet.create({
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#FAE08B', borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  active: { backgroundColor: '#F5C116', borderColor: '#F5C116' },
  label: { fontSize: 13, fontWeight: '700', color: '#374151' },
  labelActive: { color: '#FFFBF0' },
});

const cardSt = StyleSheet.create({
  card: {
    backgroundColor: '#FAE08B', borderRadius: 16, marginBottom: 14, overflow: 'hidden',
    shadowColor: '#F5C116', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 3,
    borderWidth: 1, borderColor: '#F3EFE6',
  },
  imageBox: { height: 148, position: 'relative', justifyContent: 'center', alignItems: 'center' },
  image: { position: 'absolute', width: '100%', height: '100%' },
  imagePlaceholder: {
    width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 6,
  },
  imageLetter: { fontSize: 52, fontWeight: '900', color: 'rgba(255,255,255,0.9)' },
  imageCuisine: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.75)', letterSpacing: 1 },
  closedOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center',
  },
  closedText: { color: '#E53935', fontSize: 22, fontWeight: '900', letterSpacing: 3 },
  premiumBadge: {
    position: 'absolute', top: 10, left: 10,
    backgroundColor: '#F5C116', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6,
  },
  premiumText: { color: '#FFFBF0', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  // Carousel dots inside each card
  dotsRow: {
    position: 'absolute', bottom: 8, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 4,
  },
  dot: { height: 5, width: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { backgroundColor: '#F5C116', width: 14, borderRadius: 3 },
  info: { padding: 14 },
  nameRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4,
  },
  name: { fontSize: 16, fontWeight: '800', color: '#111827', flex: 1 },
  ratingBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5C116', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, gap: 3,
  },
  ratingStar: { color: '#FFFBF0', fontSize: 10 },
  ratingVal: { color: '#FFFBF0', fontSize: 12, fontWeight: '800' },
  cuisine: { fontSize: 13, color: '#6B7280', marginBottom: 10 },
  metaRow: { flexDirection: 'row', gap: 8 },
  metaChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  metaText: { fontSize: 12, fontWeight: '600' },
});


