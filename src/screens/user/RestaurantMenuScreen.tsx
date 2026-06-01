/**
 * RestaurantMenuScreen.tsx — Rich restaurant menu with banner, logo, cart bar
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
import { appConfig } from '../../config/appConfig';
import { useCart } from '../../context/CartContext';
import CustomizeSheet, { CustomizableItem } from './CustomizeSheet';

const { width: W } = Dimensions.get('window');

// ── Types ──────────────────────────────────────────────────────────────────────
interface Variant { name: string; price: number; isDefault?: boolean; }
interface MenuItem {
  _id: string;
  name: string;
  description?: string;
  category: string;
  price: number;
  isVeg: boolean;
  isAvailable: boolean;
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
  type?: string;
}

interface Props {
  restaurantId: string;
  onBack: () => void;
  onOpenCart: () => void;
}

// ── API helper ─────────────────────────────────────────────────────────────────
async function apiFetch(path: string) {
  const res  = await fetch(`${appConfig.apiBaseUrl}${path}`);
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

// ── Qty stepper ────────────────────────────────────────────────────────────────
function QtyControl({ item, restaurant, onCustomize }: { item: MenuItem; restaurant: Restaurant; onCustomize: () => void }) {
  const { addItem, removeItem, getQty } = useCart();
  const qty   = getQty(item._id);
  const price = effectivePrice(item);
  const isCustomizable = (item.hasVariants && (item.variants?.length ?? 0) > 0) || (item.globalAddOns?.length ?? 0) > 0;

  const doAdd = () => {
    if (isCustomizable) {
      onCustomize();
    } else {
      addItem(restaurant._id, restaurant.name, {
        itemId: item._id, name: item.name, price, isVeg: item.isVeg, category: item.category,
      });
    }
  };

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

// ── Menu Item Card ─────────────────────────────────────────────────────────────
function MenuItemCard({ item, restaurant, onCustomize }: { item: MenuItem; restaurant: Restaurant; onCustomize: () => void }) {
  const price = effectivePrice(item);
  const img   = item.images?.[0];

  return (
    <View style={[ms.card, !item.isAvailable && { opacity: 0.45 }]}>
      {/* Veg / Non-veg indicator */}
      <View style={[ms.vegIndicator, { borderColor: item.isVeg ? '#16A34A' : '#F5C116' }]}>
        <View style={[ms.vegDot, { backgroundColor: item.isVeg ? '#16A34A' : '#F5C116' }]} />
      </View>

      <View style={ms.cardBody}>
        <Text style={ms.itemName} numberOfLines={2}>{item.name}</Text>
        {item.description ? (
          <Text style={ms.itemDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}
        <View style={ms.priceRow}>
          <Text style={ms.itemPrice}>₹{price}</Text>
          {item.hasVariants && <Text style={ms.customTag}>Customisable ▾</Text>}
          {item.prepTimeMinutes ? (
            <Text style={ms.prepTag}>⏱ {item.prepTimeMinutes}m</Text>
          ) : null}
        </View>
      </View>

      <View style={ms.cardRight}>
        {img ? (
          <Image source={{ uri: img }} style={ms.itemImg} resizeMode="cover" />
        ) : (
          <View style={[ms.itemImg, ms.itemImgPlaceholder]}>
            <Text style={{ fontSize: 30 }}>{item.isVeg ? '🥗' : '🍗'}</Text>
          </View>
        )}
        {item.isAvailable
          ? <QtyControl item={item} restaurant={restaurant} onCustomize={onCustomize} />
          : <Text style={ms.unavailText}>Unavailable</Text>
        }
      </View>
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function RestaurantMenuScreen({ restaurantId, onBack, onOpenCart }: Props) {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [sections, setSections]     = useState<{ title: string; data: MenuItem[] }[]>([]);
  const [loading, setLoading]       = useState(true);
  const [activeCategory, setActive] = useState('');
  const { itemCount, subtotal, addItem } = useCart();
  
  const [customizeItem, setCustomizeItem] = useState<CustomizableItem | null>(null);

  const sectionRef   = useRef<SectionList<MenuItem>>(null);
  const cartBarSlide = useRef(new Animated.Value(100)).current;

  // ── Load data ────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [restDoc, itemsJson] = await Promise.all([
          apiFetch(`/api/restaurants/${restaurantId}`),   // returns doc directly
          apiFetch(`/api/items/restaurant/${restaurantId}`),
        ]);

        // getRestaurantById returns the doc directly (not { restaurant: doc })
        const r: Restaurant = restDoc;
        setRestaurant(r);

        const items: MenuItem[] = (itemsJson.items ?? []);
        // Group by category preserving insertion order
        const map = new Map<string, MenuItem[]>();
        for (const item of items) {
          const cat = item.category || 'Other';
          if (!map.has(cat)) map.set(cat, []);
          map.get(cat)!.push(item);
        }
        const secs = Array.from(map.entries()).map(([title, data]) => ({ title, data }));
        setSections(secs);
        if (secs.length) setActive(secs[0].title);
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

  const scrollToSection = useCallback((idx: number, title: string) => {
    setActive(title);
    try {
      sectionRef.current?.scrollToLocation({
        sectionIndex: idx, itemIndex: 0, animated: true, viewOffset: 52,
      });
    } catch {}
  }, []);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={ms.loaderWrap}>
        <StatusBar barStyle="light-content" backgroundColor="#B71C1C" />
        <ActivityIndicator color="#F5C116" size="large" />
        <Text style={ms.loaderText}>Loading menu…</Text>
      </View>
    );
  }

  const banners: string[] = Array.isArray(restaurant?.banner)
    ? (restaurant!.banner as string[]).filter(Boolean)
    : [];
  const categories = sections.map(s => s.title);

  return (
    <View style={ms.root}>
      <StatusBar barStyle="light-content" backgroundColor="#B71C1C" translucent />

      {/* ── Back button (absolute, over banner) ─────────────────────────────── */}
      <TouchableOpacity style={ms.backBtn} onPress={onBack} activeOpacity={0.85}>
        <Text style={ms.backIcon}>←</Text>
      </TouchableOpacity>

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
          restaurant ? <MenuItemCard item={item} restaurant={restaurant} onCustomize={() => setCustomizeItem(item as any)} /> : null
        }
        renderSectionHeader={({ section }) => (
          <View style={ms.sectionHeader}>
            <Text style={ms.sectionTitle}>{section.title}</Text>
            <Text style={ms.sectionCount}>{section.data.length} items</Text>
          </View>
        )}
        ListHeaderComponent={
          <View>
            {/* ── Banner ──────────────────────────────────────────────────── */}
            <View style={ms.bannerWrap}>
              {banners.length > 0 ? (
                <Image source={{ uri: banners[0] }} style={ms.bannerImg} resizeMode="cover" />
              ) : (
                <View style={ms.bannerPlaceholder}>
                  <Text style={ms.bannerEmoji}>
                    {restaurant?.cuisine?.[0] === 'Chinese' ? '🥡'
                      : restaurant?.cuisine?.[0] === 'Pizza' ? '🍕'
                      : restaurant?.cuisine?.[0] === 'Burgers' ? '🍔'
                      : restaurant?.cuisine?.[0] === 'Indian' ? '🍛'
                      : '🍽️'}
                  </Text>
                </View>
              )}
              {/* Dark gradient overlay at bottom */}
              <View style={ms.bannerGradient} />

              {/* Restaurant info over banner */}
              <View style={ms.bannerInfo}>
                {restaurant?.logo ? (
                  <Image source={{ uri: restaurant.logo }} style={ms.logo} />
                ) : null}
                <View style={ms.bannerTextBlock}>
                  <Text style={ms.restName} numberOfLines={2}>{restaurant?.name}</Text>
                  <Text style={ms.restCuisine} numberOfLines={1}>
                    {(restaurant?.cuisine ?? []).join(' • ')}
                  </Text>
                </View>
              </View>
            </View>

            {/* ── Status + meta chips ──────────────────────────────────────── */}
            <View style={ms.metaBar}>
              <View style={[ms.statusChip, {
                backgroundColor: restaurant?.isOpen === false ? '#FEE2E2' : '#DCFCE7',
              }]}>
                <View style={[ms.statusDot, {
                  backgroundColor: restaurant?.isOpen === false ? '#F5C116' : '#16A34A',
                }]} />
                <Text style={[ms.statusText, {
                  color: restaurant?.isOpen === false ? '#B91C1C' : '#15803D',
                }]}>
                  {restaurant?.isOpen === false ? 'Closed now' : 'Open now'}
                </Text>
              </View>
              {restaurant?.rating ? (
                <View style={ms.metaChip}>
                  <Text style={ms.metaChipText}>★ {Number(restaurant.rating).toFixed(1)}</Text>
                </View>
              ) : null}
              <View style={ms.metaChip}>
                <Text style={ms.metaChipText}>🛵 ₹{restaurant?.deliveryFee ?? 30}</Text>
              </View>
              <View style={ms.metaChip}>
                <Text style={ms.metaChipText}>⏱ {restaurant?.avgDeliveryTime ?? '25–35 min'}</Text>
              </View>
            </View>

            {/* ── Description ─────────────────────────────────────────────── */}
            {restaurant?.description ? (
              <View style={ms.descBox}>
                <Text style={ms.descText}>{restaurant.description}</Text>
              </View>
            ) : null}

            {/* ── Category tabs ────────────────────────────────────────────── */}
            {categories.length > 1 && (
              <View style={ms.catWrap}>
                <ScrollView
                  horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={ms.catScroll}
                  bounces={false}
                  decelerationRate={0.985}
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
            price: finalPrice - addonTotal, // base price is the variant price
            quantity: 1,
            isVeg: customizeItem.isVeg,
            category: customizeItem.category,
            variantName,
            addons,
            addonTotal,
          });
        }}
        onClose={() => setCustomizeItem(null)}
      />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const BANNER_H = 220;

const ms = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFAFA' },

  loaderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  loaderText: { color: '#6B7280', fontSize: 14 },

  // Back button (floats over banner)
  backBtn: {
    position: 'absolute', top: 46, left: 14, zIndex: 20,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
  },
  backIcon: { color: '#FFF', fontSize: 20, lineHeight: 22 },

  // Banner
  bannerWrap: { width: W, height: BANNER_H, backgroundColor: '#1C1C1E' },
  bannerImg: { width: W, height: BANNER_H },
  bannerPlaceholder: {
    width: W, height: BANNER_H,
    backgroundColor: '#1C1C1E',
    justifyContent: 'center', alignItems: 'center',
  },
  bannerEmoji: { fontSize: 72 },
  bannerGradient: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 100,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  bannerInfo: {
    position: 'absolute', left: 14, right: 14, bottom: 14,
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
  },
  logo: {
    width: 52, height: 52, borderRadius: 10,
    borderWidth: 2, borderColor: '#FFF',
    backgroundColor: '#FAE08B',
  },
  bannerTextBlock: { flex: 1 },
  restName: { color: '#FFF', fontSize: 22, fontWeight: '800', lineHeight: 26 },
  restCuisine: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },

  // Meta bar
  metaBar: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#FAE08B',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  metaChip: {
    backgroundColor: '#F3F4F6', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  metaChipText: { fontSize: 12, color: '#374151', fontWeight: '600' },

  // Description
  descBox: { backgroundColor: '#FAE08B', paddingHorizontal: 14, paddingBottom: 12 },
  descText: { fontSize: 13, color: '#6B7280', lineHeight: 19 },

  // Category tabs
  catWrap: {
    backgroundColor: '#FAE08B',
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  catScroll: { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  catPill: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 22,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
  },
  catPillActive: { backgroundColor: '#F5C116', borderColor: '#F5C116' },
  catPillText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  catPillTextActive: { color: '#FFF' },

  // Section header
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F9FAFB', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#111827' },
  sectionCount: { fontSize: 12, color: '#9CA3AF' },

  // Item card
  card: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#FAE08B', paddingHorizontal: 14, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F9FAFB',
  },
  vegIndicator: {
    width: 14, height: 14, borderWidth: 1.5, borderRadius: 2,
    justifyContent: 'center', alignItems: 'center',
    marginTop: 3, marginRight: 10, flexShrink: 0,
  },
  vegDot: { width: 7, height: 7, borderRadius: 3.5 },
  cardBody: { flex: 1, paddingRight: 10 },
  itemName: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 4, lineHeight: 20 },
  itemDesc: { fontSize: 12, color: '#6B7280', lineHeight: 17, marginBottom: 6 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  itemPrice: { fontSize: 15, fontWeight: '800', color: '#111827' },
  customTag: { fontSize: 10, color: '#F5C116', fontWeight: '700', backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  prepTag: { fontSize: 10, color: '#92400E', backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  cardRight: { alignItems: 'center', gap: 8, flexShrink: 0 },
  itemImg: { width: 96, height: 80, borderRadius: 10, overflow: 'hidden' },
  itemImgPlaceholder: { backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  unavailText: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },

  // ADD button / stepper
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: '#F5C116', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#FAE08B',
  },
  addBtnText: { color: '#F5C116', fontSize: 13, fontWeight: '800' },
  addBtnPlus: { color: '#F5C116', fontSize: 17, fontWeight: '800', lineHeight: 18 },
  stepper: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F5C116', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  stepBtn: { padding: 2 },
  stepIcon: { color: '#FFF', fontSize: 18, fontWeight: '700', lineHeight: 20 },
  stepCount: { color: '#FFF', fontWeight: '800', fontSize: 15, minWidth: 18, textAlign: 'center' },

  // Cart bar
  cartBar: {
    position: 'absolute', left: 16, right: 16, bottom: 20,
    borderRadius: 16,
    shadowColor: '#F5C116', shadowOpacity: 0.4, shadowRadius: 16, elevation: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  cartBarInner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5C116', borderRadius: 16,
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


