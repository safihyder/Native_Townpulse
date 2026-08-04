/**
 * RestaurantMenuScreen.tsx — Premium restaurant menu with hero banner,
 * horizontal bestseller cards, and clean categorised list.
 *
 * Design reference: orange gradient hero, food image, meta chips,
 * horizontal "Super hot" cards, vertical category sections.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  ScrollView,
  SectionList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { appConfig } from '../../config/appConfig';
import { useCart } from '../../context/CartContext';
import CustomizeSheet, { CustomizableItem } from './CustomizeSheet';
import {
  StarIcon,
  ClockIcon,
  LocationPinIcon,
  ArrowRightIcon,
  InfoIcon,
} from '../../components/SvgIcons';
import RestaurantInfoModal from './RestaurantInfoModal';

const { width: W } = Dimensions.get('window');

// ── Types ──────────────────────────────────────────────────────────────────────
interface MenuItem {
  _id: string;
  name: string;
  description?: string;
  category: string;
  price: number;
  isVeg: boolean;
  isAvailable: boolean;
  isBestSeller?: boolean;
  images?: string[];
  hasVariants?: boolean;
  variants?: { name: string; price: number; isDefault?: boolean; addOns?: any[] }[];
  globalAddOns?: any[];
  prepTimeMinutes?: number;
}
interface Restaurant {
  _id: string;
  restaurantId: string;
  name: string;
  cuisine: string[];
  description?: string;
  banner?: string[];
  logo?: string;
  isOpen?: boolean;
  avgDeliveryTime?: string;
  deliveryFee?: number;
  rating?: number;
  numReviews?: number;
  type?: string;
}

interface Props {
  restaurantId: string;
  highlightItemId?: string;
  onBack: () => void;
  onOpenCart: () => void;
}

// ── API helper ─────────────────────────────────────────────────────────────────
async function apiFetch(path: string) {
  const res = await fetch(`${appConfig.apiBaseUrl}${path}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Request failed');
  return json;
}

function effectivePrice(item: MenuItem): number {
  if (item.hasVariants && item.variants?.length) {
    const def = item.variants.find(v => v.isDefault) ?? item.variants[0];
    return def.price;
  }
  return item.price;
}

// ── Plus button SVG ────────────────────────────────────────────────────────────
function PlusCircle({ size = 28 }: { size?: number }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: '#1C2434', justifyContent: 'center', alignItems: 'center',
    }}>
      <Text style={{ color: '#FFF', fontSize: size * 0.6, fontWeight: '700', lineHeight: size * 0.7 }}>+</Text>
    </View>
  );
}

// ── Qty stepper ────────────────────────────────────────────────────────────────
function QtyControl({ item, restaurant, onCustomize, variant = 'default' }: {
  item: MenuItem; restaurant: Restaurant;
  onCustomize: () => void;
  variant?: 'default' | 'card';
}) {
  const { addItem, removeItem, getQty } = useCart();
  const qty = getQty(item._id);
  const price = effectivePrice(item);
  const isCustomizable = (item.hasVariants && (item.variants?.length ?? 0) > 0) || (item.globalAddOns?.length ?? 0) > 0;

  const doAdd = () => {
    if (isCustomizable) {
      onCustomize();
    } else {
      addItem(restaurant._id, restaurant.name, {
        itemId: item._id, name: item.name, price, isVeg: item.isVeg, category: item.category,
        image: item.images?.[0],
      });
    }
  };

  if (variant === 'card') {
    if (qty === 0) {
      return (
        <TouchableOpacity onPress={doAdd} activeOpacity={0.8}>
          <PlusCircle size={30} />
        </TouchableOpacity>
      );
    }
    return (
      <View style={ms.stepperSmall}>
        <TouchableOpacity onPress={() => removeItem(item._id)} style={ms.stepBtnSmall}>
          <Text style={ms.stepIconSmall}>−</Text>
        </TouchableOpacity>
        <Text style={ms.stepCountSmall}>{qty}</Text>
        <TouchableOpacity onPress={doAdd} style={ms.stepBtnSmall}>
          <Text style={ms.stepIconSmall}>+</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // default variant
  if (qty === 0) {
    return (
      <TouchableOpacity style={ms.addBtn} onPress={doAdd} activeOpacity={0.8}>
        <Text style={ms.addBtnText}>ADD</Text>
        <Text style={ms.addBtnPlus}>+</Text>
      </TouchableOpacity>
    );
  }
  return (
    <View style={ms.stepper}>
      <TouchableOpacity style={ms.stepBtn} onPress={() => removeItem(item._id)}>
        <Text style={ms.stepIcon}>−</Text>
      </TouchableOpacity>
      <Text style={ms.stepCount}>{qty}</Text>
      <TouchableOpacity style={ms.stepBtn} onPress={doAdd}>
        <Text style={ms.stepIcon}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Horizontal Bestseller Card ─────────────────────────────────────────────────
function BestsellerCard({ item, restaurant, onCustomize }: {
  item: MenuItem; restaurant: Restaurant; onCustomize: () => void;
}) {
  const price = effectivePrice(item);
  const img = item.images?.[0];

  return (
    <View style={ms.bsCard}>
      {/* Food image */}
      <View style={ms.bsImageWrap}>
        {img ? (
          <Image source={{ uri: img }} style={ms.bsImage} resizeMode="cover" />
        ) : (
          <View style={[ms.bsImage, ms.bsImagePlaceholder]}>
            <Text style={{ fontSize: 42 }}>{item.isVeg ? '🥗' : '🍗'}</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <Text style={ms.bsName} numberOfLines={2}>{item.name}</Text>
      <Text style={ms.bsDesc} numberOfLines={1}>
        {item.description || (item.category || '')}
      </Text>

      {/* Price row */}
      <View style={ms.bsPriceRow}>
        <View style={{ flex: 1 }}>
          <Text style={ms.bsPrice}>₹{price}</Text>
        </View>
        <QtyControl item={item} restaurant={restaurant} onCustomize={onCustomize} variant="card" />
      </View>
    </View>
  );
}

// ── Menu Item Row (vertical list) ──────────────────────────────────────────────
function MenuItemRow({ item, restaurant, onCustomize }: {
  item: MenuItem; restaurant: Restaurant; onCustomize: () => void;
}) {
  const price = effectivePrice(item);
  const img = item.images?.[0];

  return (
    <View style={[ms.listRow, !item.isAvailable && { opacity: 0.45 }]}>
      {/* Image */}
      <View style={ms.listImgWrap}>
        {img ? (
          <Image source={{ uri: img }} style={ms.listImg} resizeMode="cover" />
        ) : (
          <View style={[ms.listImg, ms.listImgPlaceholder]}>
            <Text style={{ fontSize: 28 }}>{item.isVeg ? '🥗' : '🍗'}</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={ms.listInfo}>
        {/* Veg indicator + name */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <View style={[ms.vegBadge, { borderColor: item.isVeg ? '#16A34A' : '#E53935' }]}>
            <View style={[ms.vegDot, { backgroundColor: item.isVeg ? '#16A34A' : '#E53935' }]} />
          </View>
          <Text style={ms.listName} numberOfLines={1}>{item.name}</Text>
        </View>
        {item.description ? (
          <Text style={ms.listDesc} numberOfLines={1}>{item.description}</Text>
        ) : null}

        {/* Price */}
        <View style={ms.listPriceRow}>
          <Text style={ms.listPrice}>₹{price}</Text>
          {item.hasVariants && <Text style={ms.customLabel}>Customisable ▾</Text>}
        </View>
      </View>

      {/* Add button */}
      <View style={ms.listAction}>
        {item.isAvailable ? (
          <QtyControl item={item} restaurant={restaurant} onCustomize={onCustomize} />
        ) : (
          <Text style={ms.unavailText}>Unavailable</Text>
        )}
      </View>
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function RestaurantMenuScreen({ restaurantId, highlightItemId, onBack, onOpenCart }: Props) {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [allItems, setAllItems] = useState<MenuItem[]>([]);
  const [sections, setSections] = useState<{ title: string; data: MenuItem[] }[]>([]);
  const [bestSellers, setBestSellers] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActive] = useState('');
  const [activeBannerIdx, setActiveBannerIdx] = useState(0);
  const [infoVisible, setInfoVisible] = useState(false);
  const { itemCount, subtotal, addItem } = useCart();

  const [customizeItem, setCustomizeItem] = useState<CustomizableItem | null>(null);

  const sectionRef = useRef<SectionList<MenuItem>>(null);
  const bannerRef = useRef<FlatList>(null);
  const cartBarSlide = useRef(new Animated.Value(100)).current;

  // ── Load data ────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [restDoc, itemsJson] = await Promise.all([
          apiFetch(`/api/restaurants/${restaurantId}`),
          apiFetch(`/api/items/restaurant/${restaurantId}`),
        ]);

        const r: Restaurant = restDoc;
        setRestaurant(r);

        const items: MenuItem[] = (itemsJson.items ?? []);
        setAllItems(items);

        // Extract bestsellers (isBestSeller flag, or first 4 items with images)
        const bs = items.filter(i => i.isBestSeller && i.isAvailable);
        const fallbackBs = bs.length > 0 ? bs : items.filter(i => i.images?.[0] && i.isAvailable).slice(0, 4);
        setBestSellers(fallbackBs.slice(0, 6));

        // Group by category
        const map = new Map<string, MenuItem[]>();
        for (const item of items) {
          const cat = item.category || 'Other';
          if (!map.has(cat)) map.set(cat, []);
          map.get(cat)!.push(item);
        }
        const secs = Array.from(map.entries()).map(([title, data]) => ({ title, data }));

        let finalSecs = secs;
        if (highlightItemId) {
          let searchedItem: MenuItem | null = null;
          for (const sec of secs) {
            const idx = sec.data.findIndex(i => i._id === highlightItemId);
            if (idx !== -1) {
              searchedItem = sec.data[idx];
              break;
            }
          }
          if (searchedItem) {
            finalSecs = [
              { title: 'Searched Item', data: [searchedItem] },
              ...secs,
            ];
          }
        }

        setSections(finalSecs);
        if (finalSecs.length) setActive(finalSecs[0].title);
      } catch (e: any) {
        console.error('[Menu]', e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [restaurantId]);

  // ── Animate cart bar ─────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.spring(cartBarSlide, {
      toValue: itemCount > 0 ? 0 : 100,
      useNativeDriver: true, tension: 80, friction: 10,
    }).start();
  }, [itemCount, cartBarSlide]);

  // ── Compute banners (must be before hooks that use it) ───────────────────────
  const banners: string[] = Array.isArray(restaurant?.banner)
    ? (restaurant!.banner as string[]).filter(Boolean)
    : [];

  // ── Auto-scroll banners ────────────────────────────────────────────────────
  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setActiveBannerIdx(prev => {
        const next = (prev + 1) % banners.length;
        bannerRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 3500);
    return () => clearInterval(timer);
  }, [banners.length]);

  const scrollToSection = useCallback((idx: number, title: string) => {
    setActive(title);
    try {
      sectionRef.current?.scrollToLocation({
        sectionIndex: idx, itemIndex: 0, animated: true, viewOffset: 52,
      });
    } catch { }
  }, []);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={ms.loaderWrap}>
        <StatusBar barStyle="dark-content" backgroundColor="#F5A623" />
        <ActivityIndicator color="#F5A623" size="large" />
        <Text style={ms.loaderText}>Loading menu…</Text>
      </View>
    );
  }

  const categories = sections.map(s => s.title);

  return (
    <View style={ms.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <SectionList
        ref={sectionRef}
        sections={sections}
        keyExtractor={item => item._id}
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingBottom: 120 }}
        onViewableItemsChanged={({ viewableItems }) => {
          const first = viewableItems.find(v => v.section);
          if (first?.section?.title) setActive(first.section.title as string);
        }}
        viewabilityConfig={{ itemVisiblePercentThreshold: 30 }}
        renderItem={({ item }) =>
          restaurant ? (
            <MenuItemRow
              item={item}
              restaurant={restaurant}
              onCustomize={() => setCustomizeItem(item as any)}
            />
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <View style={ms.sectionHeader}>
            <Text style={ms.sectionTitle}>{section.title}</Text>
            <Text style={ms.sectionCount}>{section.data.length} items</Text>
          </View>
        )}
        ListHeaderComponent={
          <View>
            {/* ── Hero Banner ─────────────────────────────────────────── */}
            <View style={ms.heroBanner}>
              {/* Floating back button */}
              <TouchableOpacity style={ms.backBtn} onPress={onBack} activeOpacity={0.85}>
                <Text style={ms.backIcon}>‹</Text>
              </TouchableOpacity>

              {/* Floating info button */}
              <TouchableOpacity style={ms.infoBtn} onPress={() => setInfoVisible(true)} activeOpacity={0.85}>
                <InfoIcon size={20} color="#1C2434" />
              </TouchableOpacity>

              {banners.length > 0 ? (
                <>
                  <FlatList
                    ref={bannerRef}
                    data={banners}
                    keyExtractor={(_, i) => `banner-${i}`}
                    renderItem={({ item: uri }) => (
                      <Image source={{ uri }} style={ms.bannerSlide} resizeMode="cover" />
                    )}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={e => {
                      const idx = Math.round(e.nativeEvent.contentOffset.x / W);
                      setActiveBannerIdx(idx);
                    }}
                  />
                  {/* Dots */}
                  {banners.length > 1 && (
                    <View style={ms.dotsRow}>
                      {banners.map((_, i) => (
                        <View key={i} style={[ms.dot, i === activeBannerIdx && ms.dotActive]} />
                      ))}
                    </View>
                  )}
                  {/* Gradient overlay at bottom */}
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.45)']}
                    style={ms.bannerGradient}
                    pointerEvents="none"
                  />
                </>
              ) : (
                <LinearGradient
                  colors={['#F5A623', '#FBC531', '#FFE082']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={ms.bannerFallback}
                >
                  <Text style={{ fontSize: 72 }}>
                    {restaurant?.cuisine?.[0] === 'Chinese' ? '🥡'
                      : restaurant?.cuisine?.[0] === 'Pizza' ? '🍕'
                        : restaurant?.cuisine?.[0] === 'Burgers' ? '🍔'
                          : restaurant?.cuisine?.[0] === 'Indian' ? '🍛'
                            : '🍽️'}
                  </Text>
                </LinearGradient>
              )}
            </View>

            {/* ── Restaurant Info Card ─────────────────────────────────── */}
            <View style={ms.infoCard}>
              {/* Promo badge */}
              {restaurant?.isOpen !== false && (
                <View style={ms.promoBadge}>
                  <Text style={ms.promoBadgeText}>
                    {restaurant?.isOpen === false ? 'CLOSED' : 'OPEN'}
                  </Text>
                </View>
              )}

              {/* Restaurant name */}
              <Text style={ms.restaurantName} numberOfLines={2}>
                {restaurant?.name}
              </Text>

              {/* Cuisine/description */}
              {restaurant?.description ? (
                <Text style={ms.restaurantDesc} numberOfLines={2}>
                  {restaurant.description}
                </Text>
              ) : (
                <Text style={ms.restaurantDesc} numberOfLines={1}>
                  {(restaurant?.cuisine ?? []).join(' • ')}
                </Text>
              )}

              {/* Meta chips row */}
              <View style={ms.metaRow}>
                {restaurant?.rating ? (
                  <View style={ms.metaChip}>
                    <StarIcon size={14} color="#F5A623" />
                    <Text style={ms.metaChipText}>
                      {Number(restaurant.rating).toFixed(1)}
                      {restaurant.numReviews ? ` (${restaurant.numReviews}+)` : ''}
                    </Text>
                  </View>
                ) : null}
                <View style={ms.metaChip}>
                  <Text style={ms.metaChipEmoji}>🛵</Text>
                  <Text style={ms.metaChipText}>₹{restaurant?.deliveryFee ?? 30}</Text>
                </View>
                <View style={ms.metaChip}>
                  <ClockIcon size={14} color="#6B7280" />
                  <Text style={ms.metaChipText}>{restaurant?.avgDeliveryTime ?? '25-35 min'}</Text>
                </View>
              </View>
            </View>

            {/* ── Super Hot / Bestsellers Horizontal ───────────────────── */}
            {bestSellers.length > 0 && (
              <View style={ms.bsSection}>
                <View style={ms.bsSectionHeader}>
                  <Text style={ms.bsSectionTitle}>Super hot</Text>
                  {bestSellers.length > 3 && (
                    <ArrowRightIcon size={18} color="#9CA3AF" />
                  )}
                </View>
                <FlatList
                  data={bestSellers}
                  keyExtractor={i => `bs-${i._id}`}
                  renderItem={({ item }) =>
                    restaurant ? (
                      <BestsellerCard
                        item={item}
                        restaurant={restaurant}
                        onCustomize={() => setCustomizeItem(item as any)}
                      />
                    ) : null
                  }
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}
                />
              </View>
            )}

            {/* ── Category tabs ────────────────────────────────────────── */}
            {categories.length > 1 && (
              <View style={ms.catWrap}>
                <ScrollView
                  horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={ms.catScroll}
                  bounces={false}
                >
                  {categories.map((cat, idx) => (
                    <TouchableOpacity
                      key={cat}
                      style={[ms.catPill, activeCategory === cat && ms.catPillActive]}
                      onPress={() => scrollToSection(idx, cat)}
                      activeOpacity={0.75}
                    >
                      <Text style={[ms.catPillText, activeCategory === cat && ms.catPillTextActive]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={ms.emptyWrap}>
            <Text style={{ fontSize: 48 }}>🍽️</Text>
            <Text style={ms.emptyTitle}>No items yet</Text>
            <Text style={ms.emptySubtitle}>This restaurant hasn't added menu items</Text>
          </View>
        }
      />

      {/* ── Floating cart bar ─────────────────────────────────────────────────── */}
      <Animated.View style={[ms.cartBar, { transform: [{ translateY: cartBarSlide }] }]}>
        <TouchableOpacity style={ms.cartBarInner} onPress={onOpenCart} activeOpacity={0.9}>
          <View style={ms.cartCountBadge}>
            <Text style={ms.cartCountText}>{itemCount}</Text>
          </View>
          <Text style={ms.cartBarLabel}>View Cart</Text>
          <Text style={ms.cartBarTotal}>₹{subtotal.toLocaleString('en-IN')}</Text>
          <Text style={ms.cartArrow}>→</Text>
        </TouchableOpacity>
      </Animated.View>

      <CustomizeSheet
        item={customizeItem}
        restaurantId={restaurant?._id || ''}
        restaurantName={restaurant?.name || ''}
        onConfirm={({ variantName, finalPrice, addons, addonTotal }) => {
          if (!customizeItem || !restaurant) return;
          addItem(restaurant._id, restaurant.name, {
            itemId: customizeItem._id,
            name: customizeItem.name,
            price: finalPrice - addonTotal,
            quantity: 1,
            isVeg: customizeItem.isVeg,
            category: customizeItem.category,
            variantName,
            addons,
            addonTotal,
            image: customizeItem.images?.[0],
          });
        }}
        onClose={() => setCustomizeItem(null)}
      />

      {restaurant && (
        <RestaurantInfoModal
          visible={infoVisible}
          restaurant={restaurant}
          onClose={() => setInfoVisible(false)}
        />
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const HERO_H = 280;
const CARD_W = (W - 16 * 2 - 14) / 2;

const ms = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F8FA' },

  loaderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, backgroundColor: '#F7F8FA' },
  loaderText: { color: '#6B7280', fontSize: 14, fontWeight: '500' },

  // ── Hero Banner ──────────────────────────────────────────────────────────────
  heroBanner: {
    width: W,
    height: HERO_H,
    backgroundColor: '#1C1C1E',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  bannerSlide: {
    width: W,
    height: HERO_H,
  },
  bannerGradient: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 80,
  },
  bannerFallback: {
    width: W,
    height: HERO_H,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotsRow: {
    position: 'absolute', bottom: 14,
    flexDirection: 'row', alignSelf: 'center', gap: 6,
  },
  dot: {
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  dotActive: {
    backgroundColor: '#FFF', width: 20, borderRadius: 4,
  },
  backBtn: {
    position: 'absolute', top: 48, left: 16, zIndex: 20,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, elevation: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  backIcon: { color: '#1C2434', fontSize: 24, fontWeight: '600', lineHeight: 26, marginTop: -2 },
  infoBtn: {
    position: 'absolute', top: 48, right: 16, zIndex: 20,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, elevation: 4,
    shadowOffset: { width: 0, height: 2 },
  },

  // ── Info Card ────────────────────────────────────────────────────────────────
  infoCard: {
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
    backgroundColor: '#FFF',
    borderRadius: 20,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 4,
    shadowOffset: { width: 0, height: 4 },
  },
  promoBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  promoBadgeText: { fontSize: 10, fontWeight: '800', color: '#2E7D32', letterSpacing: 0.5 },
  restaurantName: {
    fontSize: 22, fontWeight: '900', color: '#1C2434',
    lineHeight: 28, marginBottom: 4,
  },
  restaurantDesc: { fontSize: 13, color: '#6B7280', lineHeight: 19, marginBottom: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F3F4F6', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  metaChipEmoji: { fontSize: 14 },
  metaChipText: { fontSize: 12, color: '#374151', fontWeight: '600' },

  // ── Bestseller Section ───────────────────────────────────────────────────────
  bsSection: { marginTop: 20 },
  bsSectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 14,
  },
  bsSectionTitle: { fontSize: 20, fontWeight: '900', color: '#1C2434' },

  // Bestseller card
  bsCard: {
    width: CARD_W,
    backgroundColor: '#FFF',
    borderRadius: 18,
    paddingBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
    shadowOffset: { width: 0, height: 4 },
    overflow: 'hidden',
  },
  bsImageWrap: {
    width: CARD_W,
    height: CARD_W * 0.75,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bsImage: {
    width: '100%',
    height: '100%',
  },
  bsImagePlaceholder: {
    justifyContent: 'center', alignItems: 'center',
  },
  bsName: {
    fontSize: 14, fontWeight: '800', color: '#1C2434',
    paddingHorizontal: 12, marginTop: 10, lineHeight: 18,
  },
  bsDesc: {
    fontSize: 11, color: '#9CA3AF', fontWeight: '500',
    paddingHorizontal: 12, marginTop: 2,
  },
  bsPriceRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, marginTop: 8,
  },
  bsPrice: { fontSize: 16, fontWeight: '900', color: '#1C2434' },

  // ── Category tabs ────────────────────────────────────────────────────────────
  catWrap: {
    marginTop: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  catScroll: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  catPill: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 22,
    backgroundColor: '#F3F4F6',
  },
  catPillActive: { backgroundColor: '#F5A623' },
  catPillText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  catPillTextActive: { color: '#FFF', fontWeight: '700' },

  // ── Section header ───────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F7F8FA', paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#1C2434' },
  sectionCount: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },

  // ── List Item Row ────────────────────────────────────────────────────────────
  listRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
    gap: 12,
  },
  listImgWrap: {
    width: 72, height: 72,
    borderRadius: 14, overflow: 'hidden',
    backgroundColor: '#FFF3E0',
  },
  listImg: { width: 72, height: 72 },
  listImgPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  listInfo: { flex: 1 },
  vegBadge: {
    width: 14, height: 14, borderWidth: 1.5, borderRadius: 2,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  vegDot: { width: 7, height: 7, borderRadius: 3.5 },
  listName: {
    fontSize: 15, fontWeight: '700', color: '#1C2434', flex: 1,
  },
  listDesc: { fontSize: 12, color: '#9CA3AF', lineHeight: 17, marginBottom: 4, marginLeft: 20 },
  listPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 20 },
  listPrice: { fontSize: 16, fontWeight: '900', color: '#1C2434' },
  customLabel: {
    fontSize: 10, color: '#F5A623', fontWeight: '700',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  listAction: { flexShrink: 0 },
  unavailText: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },

  // ── ADD button / stepper ─────────────────────────────────────────────────────
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: '#F5A623', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#FFF',
  },
  addBtnText: { color: '#F5A623', fontSize: 13, fontWeight: '800' },
  addBtnPlus: { color: '#F5A623', fontSize: 17, fontWeight: '800', lineHeight: 18 },
  stepper: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F5A623', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  stepBtn: { padding: 2 },
  stepIcon: { color: '#FFF', fontSize: 18, fontWeight: '700', lineHeight: 20 },
  stepCount: { color: '#FFF', fontWeight: '800', fontSize: 15, minWidth: 18, textAlign: 'center' },

  // Small stepper for bestseller cards
  stepperSmall: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1C2434', borderRadius: 15,
    paddingHorizontal: 6, paddingVertical: 3,
  },
  stepBtnSmall: { padding: 2 },
  stepIconSmall: { color: '#FFF', fontSize: 14, fontWeight: '700', lineHeight: 16 },
  stepCountSmall: { color: '#FFF', fontWeight: '800', fontSize: 12, minWidth: 14, textAlign: 'center' },

  // ── Cart bar ─────────────────────────────────────────────────────────────────
  cartBar: {
    position: 'absolute', left: 16, right: 16, bottom: 20,
    borderRadius: 16,
    shadowColor: '#F5A623', shadowOpacity: 0.4, shadowRadius: 16, elevation: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  cartBarInner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5A623', borderRadius: 16,
    paddingHorizontal: 18, paddingVertical: 14, gap: 10,
  },
  cartCountBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center',
  },
  cartCountText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  cartBarLabel: { flex: 1, color: '#FFF', fontWeight: '700', fontSize: 15 },
  cartBarTotal: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  cartArrow: { color: 'rgba(255,255,255,0.8)', fontSize: 16, fontWeight: '700' },

  // Empty
  emptyWrap: { flex: 1, paddingVertical: 60, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#111', textAlign: 'center' },
  emptySubtitle: { fontSize: 13, color: '#6B7280', textAlign: 'center', paddingHorizontal: 32 },
});
