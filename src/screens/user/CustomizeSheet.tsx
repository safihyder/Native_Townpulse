/**
 * CustomizeSheet.tsx
 * Bottom-sheet modal for selecting variant + addons before adding to cart.
 */

import React, { useRef, useState } from 'react';
import {
  Animated,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { SelectedAddon } from '../../context/CartContext';

// ── Types (mirrors Item model) ─────────────────────────────────────────────────
export interface AddonDef  { name: string; price: number; maxQuantity?: number; }
export interface VariantDef { name: string; price: number; isDefault?: boolean; addOns?: AddonDef[]; }

export interface CustomizableItem {
  _id: string;
  name: string;
  price: number;
  isVeg: boolean;
  category?: string;
  hasVariants?: boolean;
  variants?: VariantDef[];
  globalAddOns?: AddonDef[];
  images?: string[];
}

interface Props {
  item: CustomizableItem | null;
  restaurantId: string;
  restaurantName: string;
  onConfirm: (opts: {
    variantName?: string;
    finalPrice: number;
    addons: SelectedAddon[];
    addonTotal: number;
  }) => void;
  onClose: () => void;
}

// ── Addon row ──────────────────────────────────────────────────────────────────
function AddonRow({ addon, qty, onInc, onDec }: {
  addon: AddonDef; qty: number;
  onInc: () => void; onDec: () => void;
}) {
  const isSelected = qty > 0;
  return (
    <TouchableOpacity
      style={st.variantRow}
      onPress={isSelected ? onDec : onInc}
      activeOpacity={0.8}
    >
      <View style={st.addonLeft}>
        <Text style={st.variantNameActive}>{addon.name}</Text>
        {addon.price > 0 && <Text style={st.variantPrice}>${addon.price}</Text>}
      </View>
      <View style={[st.checkbox, isSelected && st.checkboxActive]}>
        {isSelected && <Text style={st.checkMark}>✓</Text>}
      </View>
    </TouchableOpacity>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function CustomizeSheet({ item, restaurantId, restaurantName, onConfirm, onClose }: Props) {
  const slideAnim = useRef(new Animated.Value(600)).current;

  // Selected variant index
  const defaultVariantIdx = item?.variants?.findIndex(v => v.isDefault) ?? 0;
  const [selVariant, setSelVariant] = useState(Math.max(0, defaultVariantIdx));

  // Addon quantities: key = addon name, value = qty
  const [addonQty, setAddonQty] = useState<Record<string, number>>({});

  React.useEffect(() => {
    if (item) {
      setSelVariant(Math.max(0, item.variants?.findIndex(v => v.isDefault) ?? 0));
      setAddonQty({});
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 70, friction: 12 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 600, duration: 220, useNativeDriver: true }).start();
    }
  }, [item, slideAnim]);

  if (!item) return null;

  const variant      = item.variants?.[selVariant];
  const variantPrice = variant?.price ?? item.price;
  // Merge global addons + variant-specific addons (deduplicate by name)
  const allAddons: AddonDef[] = [
    ...(item.globalAddOns ?? []),
    ...(variant?.addOns ?? []),
  ].filter((a, idx, arr) => arr.findIndex(x => x.name === a.name) === idx);

  // Build selected addons list & total
  const selectedAddons: SelectedAddon[] = allAddons
    .filter(a => (addonQty[a.name] ?? 0) > 0)
    .map(a => ({ name: a.name, price: a.price, quantity: addonQty[a.name] }));
  const addonTotal = selectedAddons.reduce((s, a) => s + a.price * a.quantity, 0);
  const finalPrice = variantPrice + addonTotal;

  const setAddon = (name: string, qty: number) =>
    setAddonQty(prev => ({ ...prev, [name]: Math.max(0, qty) }));

  const handleConfirm = () => {
    onConfirm({
      variantName: variant?.name,
      finalPrice: variantPrice,
      addons: selectedAddons,
      addonTotal,
    });
    onClose();
  };

  const hasCustomization = (item.hasVariants && (item.variants?.length ?? 0) > 0) || allAddons.length > 0;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={st.overlay} activeOpacity={1} onPress={onClose}>
        <Animated.View style={[st.sheet, { transform: [{ translateY: slideAnim }] }]}>
              {/* Hero Image Section */}
              <View style={st.heroBg}>
                <TouchableOpacity style={st.backBtnHero} onPress={onClose} activeOpacity={0.8}>
                  <Text style={st.backBtnText}>‹</Text>
                </TouchableOpacity>
                {item.images && item.images.length > 0 ? (
                  <Image source={{ uri: item.images[0] }} style={st.heroImg} resizeMode="cover" />
                ) : (
                  <View style={st.heroImgPlaceholder}>
                    <Text style={{ fontSize: 60 }}>🍽️</Text>
                  </View>
                )}
              </View>

              {/* White Sheet Content */}
              <View style={st.sheetContent}>
                {/* Header */}
                <View style={st.header}>
                  <Text style={st.headerTitle}>Add new</Text>
                  <TouchableOpacity onPress={onClose} style={st.closeBtn}>
                    <Text style={st.closeBtnText}>×</Text>
                  </TouchableOpacity>
                </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>

              {/* ── Variants ──────────────────────────────────────────────── */}
              {item.hasVariants && (item.variants?.length ?? 0) > 0 && (
                <View style={st.section}>
                  <Text style={st.sectionTitle}>Choice of size</Text>
                  {item.variants!.map((v, idx) => (
                    <TouchableOpacity
                      key={v.name}
                      style={st.variantRow}
                      onPress={() => { setSelVariant(idx); setAddonQty({}); }}
                      activeOpacity={0.8}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={st.variantNameActive}>{v.name}</Text>
                        <Text style={st.variantPrice}>${v.price}</Text>
                      </View>
                      <View style={[st.checkbox, selVariant === idx && st.checkboxActive]}>
                        {selVariant === idx && <Text style={st.checkMark}>✓</Text>}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* ── Add-ons ───────────────────────────────────────────────── */}
              {allAddons.length > 0 && (
                <View style={st.section}>
                  <Text style={st.sectionTitle}>Choice of topping</Text>
                  {allAddons.map(a => (
                    <AddonRow
                      key={a.name}
                      addon={a}
                      qty={addonQty[a.name] ?? 0}
                      onInc={() => setAddon(a.name, (addonQty[a.name] ?? 0) + 1)}
                      onDec={() => setAddon(a.name, (addonQty[a.name] ?? 0) - 1)}
                    />
                  ))}
                </View>
              )}

              {!hasCustomization && (
                <View style={st.noCustom}>
                  <Text style={st.noCustomText}>No customizations for this item.</Text>
                </View>
              )}
            </ScrollView>

            {/* ── Confirm ──────────────────────────────────────────────────── */}
            <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
              <TouchableOpacity style={st.confirmBtn} onPress={handleConfirm} activeOpacity={0.88}>
                <Text style={st.confirmText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: 'transparent',
    paddingTop: 40,
  },
  heroBg: {
    backgroundColor: '#D6A6A6',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    height: 220, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  heroImg: { width: '100%', height: '100%', position: 'absolute' },
  heroImgPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  backBtnHero: { 
    position: 'absolute', top: 20, left: 16, 
    width: 36, height: 36, borderRadius: 18, 
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center', alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
  },
  backBtnText: { fontSize: 26, color: '#111', fontWeight: '600', lineHeight: 28, marginLeft: -2, marginTop: -2 },
  
  sheetContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    marginTop: -24, // overlap hero
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111' },
  closeBtn: { position: 'absolute', right: 16, padding: 4 },
  closeBtnText: { fontSize: 24, color: '#111', fontWeight: '500' },

  section: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#9CA3AF', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },

  // Variant
  variantRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#F9FAFB',
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: '#D1D5DB',
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxActive: { borderColor: '#F5C116', backgroundColor: '#F5C116' },
  checkMark: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  variantNameActive: { color: '#111', fontWeight: '700', fontSize: 14, marginBottom: 2 },
  variantPrice: { fontSize: 13, fontWeight: '500', color: '#6B7280' },

  addonLeft: { flex: 1 },

  noCustom: { padding: 24, alignItems: 'center' },
  noCustomText: { color: '#9CA3AF', fontSize: 13 },

  // Confirm
  confirmBtn: {
    backgroundColor: '#FBC02D', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginTop: 16,
  },
  confirmText: { color: '#111', fontWeight: '700', fontSize: 16 },
});


