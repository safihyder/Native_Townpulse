import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
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
import LinearGradient from 'react-native-linear-gradient';
import { getHomeBanners, getRestaurants, getCoupons } from '../../services/userApi';
import { appConfig } from '../../config/appConfig';
import { useRestaurantSocket } from '../../hooks/useRestaurantSocket';
import { warmCache } from '../../services/searchCache';
import SearchScreen from './SearchScreen';
import { fetchLiveLocation, type LocationResult } from '../../services/locationService';
import {
  SearchIcon,
  LocationPinIcon,
  CartIcon,
  ProfileIcon,
  ChevronDownIcon,
  StarIcon,
  FilterIcon,
  ArrowRightIcon,
  ClockIcon,
  DistanceIcon,
  VoucherCategoryIcon,
  RiceCategoryIcon,
  DrinkCategoryIcon,
  FastFoodCategoryIcon,
  BreadCategoryIcon,
} from '../../components/SvgIcons';


const { width: SCREEN_W } = Dimensions.get('window');
const BANNER_W = SCREEN_W - 48;

type Props = {
  idToken: string;
  userName: string;
  cartItemCount?: number;
  onOpenRestaurant: (id: string, itemId?: string) => void;
  onOpenCart?: () => void;
  onOpenProfile?: () => void;
  onOpenOrders?: () => void;
  onOpenTracking?: (order: any) => void;
};

// ── Category data ────────────────────────────────────────────────────────────
const CATEGORIES = [
  { label: 'Voucher', icon: VoucherCategoryIcon, color: '#FFF3E0' },
  { label: 'Rice', icon: RiceCategoryIcon, color: '#FFF3E0' },
  { label: 'Drink', icon: DrinkCategoryIcon, color: '#E3F2FD' },
  { label: 'Fast food', icon: FastFoodCategoryIcon, color: '#FFF3E0' },
  { label: 'Bread', icon: BreadCategoryIcon, color: '#FBE9E7' },
];

// ── Voucher card colors ──────────────────────────────────────────────────────
const VOUCHER_COLORS = [
  { bg: '#E8F5E9', accent: '#4CAF50' },
  { bg: '#FFF3E0', accent: '#F5A623' },
  { bg: '#E3F2FD', accent: '#2196F3' },
  { bg: '#FCE4EC', accent: '#E91E63' },
];

import { useCart } from '../../context/CartContext';
import { LocationSelectorModal } from './LocationSelectorModal';

// ── Main Component ────────────────────────────────────────────────────────────
export function UserHomeTab({ idToken, userName, cartItemCount = 0, onOpenRestaurant, onOpenCart, onOpenProfile, onOpenOrders, onOpenTracking }: Props) {
  const { setDeliveryAddress, cart, isHydrated } = useCart();
  const [banners, setBanners] = useState<any[]>([]);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchVisible, setSearchVisible] = useState(false);
  const [locationSelectorVisible, setLocationSelectorVisible] = useState(false);
  const [locationAddress, setLocationAddress] = useState('Loading...');
  const [activeBannerIdx, setActiveBannerIdx] = useState(0);
  const [activeOrder, setActiveOrder] = useState<any>(null);

  const fetchActiveOrder = useCallback(async () => {
    try {
      const res = await fetch(`${appConfig.apiBaseUrl}/api/orders/my-orders?t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
      });
      const json = await res.json();
      if (json.success && json.orders) {
        const active = json.orders.find((o: any) => !['DELIVERED', 'CANCELLED', 'REJECTED'].includes(o.status));
        setActiveOrder(active || null);
      }
    } catch (e) {
      // Ignore
    }
  }, [idToken]);

  useEffect(() => {
    fetchActiveOrder();
    const interval = setInterval(fetchActiveOrder, 30000); // Polling every 30s
    return () => clearInterval(interval);
  }, [fetchActiveOrder]);

  const { statusMap, onRestaurantUpdate } = useRestaurantSocket();
  const bannerRef = useRef<FlatList>(null);
  const [activeFilter, setActiveFilter] = useState('Near you');

  // Initialize location from cache or fetch live
  useEffect(() => {
    if (!isHydrated) return;

    if (cart.deliveryAddress) {
      setLocationAddress(cart.deliveryAddress.name === 'Current Location' ? cart.deliveryAddress.fullAddress : `${cart.deliveryAddress.name} - ${cart.deliveryAddress.fullAddress}`);
    } else {
      fetchLiveLocation()
        .then((loc: LocationResult) => {
          setLocationAddress(loc.address);
          setDeliveryAddress({ name: 'Current Location', fullAddress: loc.address, lat: loc.coords.latitude, lng: loc.coords.longitude });
        })
        .catch(() => setLocationAddress('Enable location'));
    }
  }, [isHydrated, cart.deliveryAddress, setDeliveryAddress]);

  useEffect(() => { warmCache(); }, []);

  const loadData = useCallback(async () => {
    try {
      const [bannerRes, restRes, couponRes] = await Promise.all([
        getHomeBanners().catch(() => ({ banners: null })),
        getRestaurants({ limit: 50 }).catch(() => ({ restaurants: [] })),
        getCoupons(idToken).catch(() => ({ coupons: [] })),
      ]);
      if (bannerRes.banners) setBanners(bannerRes.banners);
      setRestaurants(restRes.restaurants ?? []);
      setCoupons(couponRes.coupons ?? (couponRes as any).data ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [idToken]);

  useEffect(() => {
    onRestaurantUpdate.current = () => { warmCache(true); loadData(); };
  }, [loadData, onRestaurantUpdate]);

  useEffect(() => { loadData(); }, [loadData]);

  // Banner auto-scroll
  useEffect(() => {
    if (banners.length < 2) return;
    const timer = setInterval(() => {
      const next = (activeBannerIdx + 1) % banners.length;
      bannerRef.current?.scrollToIndex({ index: next, animated: true });
      setActiveBannerIdx(next);
    }, 4000);
    return () => clearInterval(timer);
  }, [banners.length, activeBannerIdx]);

  const filteredRestaurants = useMemo(() => {
    switch (activeFilter) {
      case 'Near you':
        return restaurants;
      case 'Hot Food':
        return restaurants.filter(r => {
          if (!r.cuisine) return true;
          const lowerCuisines = r.cuisine.map((c: string) => c.toLowerCase());
          return lowerCuisines.some((c: string) =>
            c.includes('fast food') || c.includes('burger') || c.includes('pizza') ||
            c.includes('indian') || c.includes('chinese') || c.includes('spicy') ||
            c.includes('chicken')
          );
        });
      case 'Promotion':
        return restaurants.filter(r => (r.rating || 0) >= 4.3);
      case 'Top rated':
        return [...restaurants].sort((a, b) => (b.rating || 0) - (a.rating || 0)).filter(r => (r.rating || 0) >= 4.5);
      default:
        return restaurants;
    }
  }, [restaurants, activeFilter]);

  return (
    <View style={s.root}>
      {searchVisible && (
        <SearchScreen
          onClose={() => setSearchVisible(false)}
          onSelectRestaurant={(id, itemId) => {
            setSearchVisible(false);
            onOpenRestaurant(id, itemId);
          }}
        />
      )}

      {/* ── Header ─────────────────────────────────────────── */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <LocationPinIcon size={28} color="#F5A623" />
          <View style={s.headerLocationCol}>
            <Text style={s.deliveryLabel}>Delivery to</Text>
            <TouchableOpacity
              style={s.locationRow}
              activeOpacity={0.7}
              onPress={() => setLocationSelectorVisible(true)}
            >
              <Text style={s.locationText} numberOfLines={1}>{locationAddress}</Text>
              <ChevronDownIcon size={16} color="#F5A623" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.headerRight}>
          <TouchableOpacity style={s.iconBtn} onPress={onOpenCart} activeOpacity={0.7}>
            <CartIcon size={22} color="#1C2434" />
            {cartItemCount ? (cartItemCount > 0 ? (
              <View style={s.cartBadge}>
                <Text style={s.cartBadgeText}>{cartItemCount}</Text>
              </View>
            ) : null) : null}
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn} onPress={onOpenProfile} activeOpacity={0.7}>
            <ProfileIcon size={22} color="#1C2434" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* ── Search Bar ────────────────────────────────────────────── */}
        <View style={s.searchContainer}>
          <TouchableOpacity style={s.searchBox} onPress={() => setSearchVisible(true)}>
            <SearchIcon size={18} color="#1C2434" />
            <Text style={s.searchPlaceholder}>Search drink, food...</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={s.loadingBox}><ActivityIndicator color="#F5A623" size="large" /></View>
        ) : (
          <>
            {/* ── Banner Carousel ──────────────────────────── */}
            {banners.length > 0 && (
              <View style={s.bannerSection}>
                <FlatList
                  ref={bannerRef}
                  data={banners}
                  keyExtractor={item => item.id || item._id}
                  renderItem={({ item }) => (
                    <LinearGradient
                      colors={item.gradient ?? ['#F5A623', '#F7C948']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[s.bannerSlide, { width: BANNER_W }]}
                    >
                      <View style={s.bannerTextCol}>
                        <Text style={s.bannerTitle}>{item.title}</Text>
                        {item.subtitle ? <Text style={s.bannerSub}>{item.subtitle}</Text> : null}
                      </View>
                      {item.imageUrl ? (
                        <Image source={{ uri: item.imageUrl }} style={s.bannerImage} resizeMode="contain" />
                      ) : null}
                    </LinearGradient>
                  )}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={BANNER_W + 16}
                  decelerationRate="fast"
                  ItemSeparatorComponent={() => <View style={{ width: 16 }} />}
                  onMomentumScrollEnd={e => {
                    const idx = Math.round(e.nativeEvent.contentOffset.x / (BANNER_W + 16));
                    setActiveBannerIdx(idx);
                  }}
                />
                <View style={s.dotsRow}>
                  {banners.map((_, i) => (
                    <View key={i} style={[s.dot, i === activeBannerIdx && s.dotActive]} />
                  ))}
                </View>
              </View>
            )}

            {/* ── Filter Pills ───────────────────────────── */}
            <View style={s.filterPillSection}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterPillRow}>
                {['Near you', 'Hot Food', 'Promotion', 'Top rated'].map((filter) => {
                  const isActive = activeFilter === filter;
                  return (
                    <TouchableOpacity
                      key={filter}
                      style={[s.filterPill, isActive && s.filterPillActive]}
                      onPress={() => setActiveFilter(filter)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.filterPillTxt, isActive && s.filterPillTxtActive]}>{filter}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* ── Top Discounts ─────────────────────────────── */}
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Top discounts</Text>
                <TouchableOpacity>
                  <ArrowRightIcon size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <Text style={s.sectionSubtitle}>Best deals near you</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingRight: 24 }}>
                {restaurants.slice(0, 6).map(r => {
                  const bannerImg = Array.isArray(r.banner) ? r.banner[0] : r.banner;
                  return (
                    <TouchableOpacity key={`disc-${r._id}`} style={s.discountCard} onPress={() => onOpenRestaurant(r.restaurantId)} activeOpacity={0.88}>
                      <View style={s.discountImageBox}>
                        {bannerImg ? (
                          <Image source={{ uri: bannerImg }} style={s.discountImage} resizeMode="cover" />
                        ) : (
                          <View style={[s.discountImagePlaceholder]}>
                            <Text style={s.discountImageLetter}>{(r.name ?? 'R')[0]}</Text>
                          </View>
                        )}
                        <View style={s.promoBadge}>
                          <Text style={s.promoBadgeText}>PROMO</Text>
                        </View>
                      </View>
                      <Text style={s.discountName} numberOfLines={1}>{r.name}</Text>
                      <Text style={s.discountCuisine} numberOfLines={1}>{(r.cuisine ?? []).slice(0, 2).join(' · ') || 'Restaurant'}</Text>
                      <View style={s.discountMeta}>
                        <StarIcon size={14} color="#F5A623" />
                        <Text style={s.discountRating}>{Number(r.rating || 4.5).toFixed(1)}</Text>
                        <Text style={s.discountReviews}>(100+)</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* ── Top Voucher ──────────────────────────────── */}
            {coupons.length > 0 ? (
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <View>
                    <Text style={s.sectionTitle}>Top voucher</Text>
                    <Text style={s.sectionSubtitle}>We have {coupons.length} discount codes</Text>
                  </View>
                  <ArrowRightIcon size={20} color="#9CA3AF" />
                </View>
                <View style={s.voucherGrid}>
                  {coupons.slice(0, 4).map((coupon, idx) => {
                    const remaining = coupon.usageLimit ? Math.max(0, coupon.usageLimit - (coupon.usageCount || 0)) : 40;
                    const isExhausted = remaining === 0;

                    return (
                      <View key={coupon._id || idx} style={[s.voucherCard, isExhausted && s.voucherCardExhausted]}>
                        <View style={s.voucherCardLeft}>
                          <Text style={[s.voucherDiscount, isExhausted && s.voucherDiscountExhausted]}>
                            {coupon.type === 'percent' ? `${coupon.discount}%` : `$${coupon.discount}`}
                          </Text>
                          <Text style={s.voucherCode} numberOfLines={1}>
                            Enter {coupon.code || 'PROMO'}
                          </Text>
                        </View>
                        <View style={[s.voucherBadge, isExhausted && s.voucherBadgeExhausted]}>
                          <Text style={s.voucherBadgeTxt}>X{remaining}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {/* ── Near You / Filtered Items ─────────────────────────────────── */}
            <View style={s.section}>
              {restaurants.length === 0 ? (
                <View style={s.empty}>
                  <Text style={s.emptyText}>No restaurants here yet</Text>
                </View>
              ) : (
                restaurants.map((r, idx) => {
                  const bannerImg = Array.isArray(r.banner) ? r.banner[0] : r.banner;
                  const isOpen = statusMap[r.restaurantId] !== undefined ? statusMap[r.restaurantId] : r.isOpen !== false;
                  const pastelBgs = ['#A7F3D0', '#FDE68A', '#DDD6FE', '#FBCFE8', '#BAE6FD'];
                  const bg = pastelBgs[idx % pastelBgs.length];

                  return (
                    <TouchableOpacity
                      key={`near-${r._id}`}
                      style={s.nearCard}
                      onPress={() => onOpenRestaurant(r.restaurantId)}
                      activeOpacity={0.88}
                    >
                      <View style={[s.nearImageBox, { backgroundColor: bannerImg ? '#F3F4F6' : bg }]}>
                        {bannerImg ? (
                          <Image source={{ uri: bannerImg }} style={s.nearImage} resizeMode="cover" />
                        ) : (
                          <View style={s.nearImagePlaceholder}>
                            <Text style={s.nearImageLetter}>{(r.name ?? 'R')[0]}</Text>
                          </View>
                        )}
                        {!isOpen && (
                          <View style={s.closedTag}>
                            <Text style={s.closedTagText}>CLOSED</Text>
                          </View>
                        )}
                      </View>
                      <View style={s.nearInfo}>
                        <Text style={s.nearName} numberOfLines={1}>{r.name}</Text>
                        <Text style={s.nearCuisine} numberOfLines={1}>{(r.cuisine ?? []).join(', ') || 'Restaurant'}</Text>
                        <View style={s.nearMeta}>
                          <StarIcon size={14} color="#F5A623" />
                          <Text style={s.nearRating}>{Number(r.rating || 4.5).toFixed(1)}</Text>
                          <Text style={s.nearReviews}>(100+)</Text>
                          <Text style={{ color: '#D1D5DB', fontSize: 12 }}>|</Text>
                          <LocationPinIcon size={14} color="#1C2434" />
                          <Text style={s.nearDistance}>1.2km</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* ── Active Order Banner ────────────────────────────────── */}
      {activeOrder && (
        <TouchableOpacity
          style={s.activeOrderBanner}
          onPress={() => onOpenTracking && onOpenTracking(activeOrder)}
          activeOpacity={0.9}
        >
          <View style={s.activeOrderContent}>
            <View style={s.activeOrderIconWrap}>
              <Text style={s.activeOrderIcon}>🛵</Text>
            </View>
            <View style={s.activeOrderTextWrap}>
              <Text style={s.activeOrderTitle}>
                {(() => {
                   const rId = activeOrder.restaurantId?._id || activeOrder.restaurantId;
                   const r = restaurants.find(x => x.restaurantId === rId || x._id === rId);
                   return r?.name ? `${r.name} Order` : 'Order in Progress';
                })()}
              </Text>
              <Text style={s.activeOrderDesc}>
                {activeOrder.status === 'PREPARING' ? 'Kitchen is preparing your food' :
                  activeOrder.status === 'OUT_FOR_DELIVERY' ? 'Partner is on the way!' : 'Waiting for confirmation'}
              </Text>
              {activeOrder.pricing?.total && (
                <Text style={{ color: '#F5A623', fontSize: 12, fontWeight: '700', marginTop: 4 }}>
                  Total: ₹{activeOrder.pricing.total} • {activeOrder.items?.length || 1} items
                </Text>
              )}
            </View>
            <ArrowRightIcon size={20} color="#FFF" />
          </View>
        </TouchableOpacity>
      )}

      <LocationSelectorModal
        visible={locationSelectorVisible}
        idToken={idToken}
        onClose={() => setLocationSelectorVisible(false)}
        onSelect={(addr) => {
          setLocationAddress(addr.name === 'Current Location' ? addr.fullAddress : `${addr.name} - ${addr.fullAddress}`);
          setDeliveryAddress(addr);
          setLocationSelectorVisible(false);
        }}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F8FA' },

  // Header
  header: {
    backgroundColor: '#ffbb00ea',
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  headerLocationCol: { flex: 1 },
  deliveryLabel: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  locationText: {
    color: '#1C2434',
    fontSize: 15,
    fontWeight: '700',
    maxWidth: SCREEN_W * 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBtn: {
    width: 42,
    height: 42,
    backgroundColor: '#F9FAFB',
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },

  filterPillSection: { marginBottom: 24, paddingLeft: 20 },
  filterPillRow: { gap: 12, paddingRight: 20 },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  filterPillActive: {
    backgroundColor: '#DBEAFE',
  },
  filterPillTxt: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '600',
  },
  filterPillTxtActive: {
    color: '#2563EB',
  },

  searchContainer: { paddingHorizontal: 20, marginBottom: 24 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 16,
    height: 48,
    gap: 12,
  },
  searchPlaceholder: { color: '#6B7280', fontSize: 14, fontWeight: '500' },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 100 },

  bannerSection: { marginBottom: 28 },
  bannerSlide: {
    height: 140,
    borderRadius: 16,
    flexDirection: 'row',
    padding: 20,
    overflow: 'hidden',
    marginLeft: 20,
  },
  bannerTextCol: { flex: 1, justifyContent: 'center' },
  bannerTitle: { fontSize: 24, fontWeight: '900', color: '#FFF', marginBottom: 4 },
  bannerSub: { fontSize: 14, color: '#FFF', opacity: 0.9, fontWeight: '500' },
  bannerImage: { width: 100, height: 100, alignSelf: 'flex-end' },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 12, gap: 6, paddingRight: 20 },
  dot: { height: 6, width: 6, borderRadius: 3, backgroundColor: '#E5E7EB' },
  dotActive: { backgroundColor: '#F5A623', width: 20, borderRadius: 3 },

  categorySection: { marginBottom: 24, paddingLeft: 20 },
  categoryRow: { gap: 20, paddingRight: 20 },
  categoryItem: { alignItems: 'center', width: 60 },
  categoryCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryLabel: { fontSize: 12, color: '#374151', fontWeight: '600', textAlign: 'center' },

  section: { marginBottom: 28, paddingHorizontal: 20 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 20, fontWeight: '900', color: '#1C2434' },
  sectionSubtitle: { fontSize: 13, color: '#9CA3AF', fontWeight: '500', marginBottom: 16 },

  loadingBox: { paddingTop: 80, alignItems: 'center' },

  discountCard: {
    width: 160,
    backgroundColor: '#FFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  discountImageBox: {
    height: 110,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  discountImage: { width: '100%', height: '100%' },
  discountImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  discountImageLetter: { fontSize: 32, fontWeight: '900', color: '#D1D5DB' },
  promoBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  promoBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  discountName: { fontSize: 14, fontWeight: '800', color: '#1C2434', marginTop: 8 },
  discountCuisine: { fontSize: 12, color: '#9CA3AF', marginTop: 2, marginBottom: 6 },
  discountMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  discountRating: { fontSize: 13, fontWeight: '800', color: '#1C2434' },
  discountReviews: { fontSize: 12, color: '#9CA3AF' },

  voucherGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  voucherCard: {
    width: (SCREEN_W - 52) / 2,
    height: 74,
    backgroundColor: '#FDBA74',
    borderRadius: 8,
    flexDirection: 'row',
    position: 'relative',
  },
  voucherCardExhausted: {
    backgroundColor: '#D1D5DB',
  },
  voucherCardLeft: {
    flex: 1,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 4,
    marginTop: 2,
    marginBottom: 2,
    marginLeft: 2,
    marginRight: 28,
    paddingLeft: 12,
    justifyContent: 'center',
  },
  voucherDiscount: {
    fontSize: 22,
    fontWeight: '900',
    color: '#F97316',
  },
  voucherDiscountExhausted: {
    color: '#6B7280',
  },
  voucherCode: {
    fontSize: 9,
    color: '#111',
    fontWeight: '600',
    marginTop: 2,
  },
  voucherBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#EA580C',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  voucherBadgeExhausted: {
    backgroundColor: '#9CA3AF',
  },
  voucherBadgeTxt: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '800',
  },

  nearCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    marginBottom: 16,
    alignItems: 'center',
    gap: 16,
  },
  nearImageBox: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  nearImage: { width: '100%', height: '100%' },
  nearImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  nearImageLetter: { fontSize: 32, fontWeight: '900', color: '#4B5563' },
  closedTag: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closedTagText: { color: '#EF4444', fontSize: 10, fontWeight: '900' },
  nearInfo: { flex: 1 },
  nearName: { fontSize: 15, fontWeight: '800', color: '#1C2434', marginBottom: 2 },
  nearCuisine: { fontSize: 12, color: '#9CA3AF', marginBottom: 6 },
  nearMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  nearRating: { fontSize: 13, fontWeight: '800', color: '#1C2434' },
  nearReviews: { fontSize: 12, color: '#9CA3AF' },
  nearDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#D1D5DB', marginHorizontal: 4 },
  nearDistance: { fontSize: 12, color: '#6B7280', fontWeight: '500' },

  empty: { alignItems: 'center', paddingVertical: 40, backgroundColor: '#F9FAFB', borderRadius: 16 },
  emptyText: { color: '#9CA3AF', fontSize: 14 },

  activeOrderBanner: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#1C2434',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    shadowOffset: { width: 0, height: 4 },
  },
  activeOrderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeOrderIconWrap: {
    width: 40, height: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  activeOrderIcon: { fontSize: 20 },
  activeOrderTextWrap: { flex: 1 },
  activeOrderTitle: { color: '#FFF', fontSize: 16, fontWeight: '800', marginBottom: 2 },
  activeOrderDesc: { color: '#9CA3AF', fontSize: 13, fontWeight: '500' },
});
