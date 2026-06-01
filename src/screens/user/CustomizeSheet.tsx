/**
 * CustomizeSheet.tsx
 * Bottom-sheet modal for selecting variant + addons before adding to cart.
 */

import React, { useRef, useState } from 'react';
import {
  Animated,
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
  const max = addon.maxQuantity ?? 1;
  return (
    <View style={st.addonRow}>
      <View style={st.addonLeft}>
        <Text style={st.addonName}>{addon.name}</Text>
        {addon.price > 0 && <Text style={st.addonPrice}>+ ₹{addon.price}</Text>}
      </View>
      {qty === 0 ? (
        <TouchableOpacity style={st.addSmall} onPress={onInc} activeOpacity={0.8}>
          <Text style={st.addSmallText}>ADD +</Text>
        </TouchableOpacity>
      ) : (
        <View style={st.qtyRow}>
          <TouchableOpacity style={st.qtyBtn} onPress={onDec}>
            <Text style={st.qtyIcon}>−</Text>
          </TouchableOpacity>
          <Text style={st.qtyNum}>{qty}</Text>
          <TouchableOpacity style={[st.qtyBtn, qty >= max && st.qtyBtnDisabled]} onPress={qty < max ? onInc : undefined}>
            <Text style={st.qtyIcon}>+</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
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
          <TouchableOpacity activeOpacity={1}>
            {/* Handle */}
            <View style={st.handle} />

            {/* Header */}
            <View style={st.header}>
              <View style={[st.vegDot, { borderColor: item.isVeg ? '#16A34A' : '#F5C116' }]}>
                <View style={[st.vegDotInner, { backgroundColor: item.isVeg ? '#16A34A' : '#F5C116' }]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.itemName}>{item.name}</Text>
                <Text style={st.basePrice}>Base ₹{variantPrice}{addonTotal > 0 ? ` + ₹${addonTotal} extras` : ''}</Text>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>

              {/* ── Variants ──────────────────────────────────────────────── */}
              {item.hasVariants && (item.variants?.length ?? 0) > 0 && (
                <View style={st.section}>
                  <Text style={st.sectionTitle}>Choose Size / Variant <Text style={st.required}>*</Text></Text>
                  {item.variants!.map((v, idx) => (
                    <TouchableOpacity
                      key={v.name}
                      style={[st.variantRow, selVariant === idx && st.variantRowActive]}
                      onPress={() => { setSelVariant(idx); setAddonQty({}); }}
                      activeOpacity={0.8}
                    >
                      <View style={[st.radio, selVariant === idx && st.radioActive]}>
                        {selVariant === idx && <View style={st.radioDot} />}
                      </View>
                      <Text style={[st.variantName, selVariant === idx && st.variantNameActive]}>{v.name}</Text>
                      <Text style={[st.variantPrice, selVariant === idx && { color: '#F5C116' }]}>₹{v.price}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* ── Add-ons ───────────────────────────────────────────────── */}
              {allAddons.length > 0 && (
                <View style={st.section}>
                  <Text style={st.sectionTitle}>Add-ons <Text style={st.optional}>(optional)</Text></Text>
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
            <TouchableOpacity style={st.confirmBtn} onPress={handleConfirm} activeOpacity={0.88}>
              <Text style={st.confirmText}>Add to Cart</Text>
              <Text style={st.confirmPrice}>₹{finalPrice}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FAE08B',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 18, paddingBottom: 30, paddingTop: 10,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 14,
  },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', marginBottom: 4,
  },
  vegDot: {
    width: 14, height: 14, borderRadius: 2, borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center', marginTop: 3, flexShrink: 0,
  },
  vegDotInner: { width: 7, height: 7, borderRadius: 3.5 },
  itemName: { fontSize: 16, fontWeight: '800', color: '#111', flexShrink: 1 },
  basePrice: { fontSize: 13, color: '#6B7280', marginTop: 3 },

  section: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#111', marginBottom: 10 },
  required: { color: '#F5C116' },
  optional: { color: '#9CA3AF', fontWeight: '400' },

  // Variant
  variantRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10,
    marginBottom: 6, backgroundColor: '#F9FAFB',
    borderWidth: 1.5, borderColor: '#F3F4F6',
  },
  variantRowActive: { borderColor: '#F5C116', backgroundColor: '#FFF5F5' },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: '#D1D5DB',
    justifyContent: 'center', alignItems: 'center',
  },
  radioActive: { borderColor: '#F5C116' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#F5C116' },
  variantName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#374151' },
  variantNameActive: { color: '#111', fontWeight: '700' },
  variantPrice: { fontSize: 14, fontWeight: '700', color: '#6B7280' },

  // Addon
  addonRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, gap: 10,
    borderBottomWidth: 1, borderBottomColor: '#F9FAFB',
  },
  addonLeft: { flex: 1 },
  addonName: { fontSize: 13, fontWeight: '600', color: '#374151' },
  addonPrice: { fontSize: 12, color: '#16A34A', marginTop: 2 },
  addSmall: {
    borderWidth: 1.5, borderColor: '#F5C116', borderRadius: 7,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  addSmallText: { color: '#F5C116', fontSize: 12, fontWeight: '800' },
  qtyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F5C116', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5,
  },
  qtyBtn: { paddingHorizontal: 2 },
  qtyBtnDisabled: { opacity: 0.4 },
  qtyIcon: { color: '#FFF', fontSize: 16, fontWeight: '700', lineHeight: 18 },
  qtyNum: { color: '#FFF', fontWeight: '800', fontSize: 14, minWidth: 16, textAlign: 'center' },

  noCustom: { padding: 24, alignItems: 'center' },
  noCustomText: { color: '#9CA3AF', fontSize: 13 },

  // Confirm
  confirmBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#F5C116', borderRadius: 14,
    paddingHorizontal: 20, paddingVertical: 15, marginTop: 16,
    shadowColor: '#F5C116', shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  confirmText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  confirmPrice: { color: '#FFF', fontWeight: '800', fontSize: 16 },
});


