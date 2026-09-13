/**
 * CartScreen.tsx — Review cart, apply coupon, choose payment, place order
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { appConfig } from '../../config/appConfig';
import { useCart } from '../../context/CartContext';
import { LocationPinIcon } from '../../components/SvgIcons';
import { LocationSelectorModal } from './LocationSelectorModal';
import { useToast } from '../../context/ToastContext';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PressableScale } from '../../components/PressableScale';
import { showMissingApiWarning, MISSING_APIS } from '../../utils/missingApiWarning';

interface Props {
  idToken: string;
  user?: { email?: string; phone?: string; name?: string };
  onBack: () => void;
  onOrderPlaced: () => void;
  fulfillmentType?: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface ApiCoupon {
  _id: string;
  code: string;
  description: string;
  type: 'flat' | 'percent';
  discount: number;
  maxDiscount?: number | null;
  minOrderAmount: number;
  discountAmount?: number;
}

type PaymentMode = 'ONLINE' | 'CASH';

const DELIVERY_FEE = 30;

// ── API helpers ────────────────────────────────────────────────────────────────
async function fetchCoupons(idToken: string, restaurantId: string | null): Promise<ApiCoupon[]> {
  const qs = restaurantId ? `?restaurantId=${restaurantId}` : '';
  const res = await fetch(`${appConfig.apiBaseUrl}/api/promocodes${qs}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const json = await res.json();
  return res.ok ? (json.coupons ?? []) : [];
}

async function validateCoupon(
  idToken: string, code: string, subtotal: number, restaurantId: string | null,
): Promise<{ coupon: ApiCoupon; discountAmount: number }> {
  const res = await fetch(`${appConfig.apiBaseUrl}/api/promocodes/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ code, orderValue: subtotal, restaurantId }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Invalid coupon');
  return { coupon: json.coupon, discountAmount: json.discountAmount };
}

// ── Zigzag Border Component ──────────────────────────────────────────────────
function ZigzagBorder() {
  // A simple hack for a zig zag border using triangles
  return (
    <View style={cs.zigzagContainer}>
      {Array.from({ length: 30 }).map((_, i) => (
        <View key={i} style={cs.zigzagTriangle} />
      ))}
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function CartScreen({ idToken, user, onBack, onOrderPlaced, fulfillmentType = 'DELIVERY' }: Props) {
  const { cart, itemCount, subtotal, setQty, clearCart, setDeliveryAddress } = useCart();
  const { showToast } = useToast();
  const [payment, setPayment] = useState<PaymentMode>('CASH');
  const [appliedCoupon, setApplied] = useState<ApiCoupon | null>(null);
  const [coupons, setCoupons] = useState<ApiCoupon[]>([]);
  const [loading, setLoading] = useState(false);
  const [applyingCode, setApplyingCode]   = useState<string | null>(null);
  const [locModalVisible, setLocModalVisible] = useState(false);
  const [clearConfirmVisible, setClearConfirmVisible] = useState(false);

  const [taxRate, setTaxRate]             = useState(0); // Fetched from backend
  const [deliveryFee, setDeliveryFee]     = useState(0); // Fetched from backend

  // Load coupons & reset applied if restaurant changes
  useEffect(() => {
    setApplied(null);
    if (cart.restaurantId) {
      fetchCoupons(idToken, cart.restaurantId).then(setCoupons);
      
      // Fetch tax rate from checkout preview
      fetch(`${appConfig.apiBaseUrl}/api/orders/checkout-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          restaurantId: cart.restaurantId,
          items: cart.items.map(i => ({ itemId: i.itemId, name: i.name, quantity: i.quantity, addons: i.addons || [] })),
          fulfillment: { deliveryFee: deliveryFee, platformFee: 0 },
        }),
      })
      .then(res => res.json())
      .then(json => {
        if (json.success && json.data && json.data.pricing && json.data.pricing.taxTotal !== undefined) {
          const fetchedTaxTotal = json.data.pricing.taxTotal;
          const currentSubtotal = cart.items.reduce((acc, i) => acc + (i.price + (i.addonTotal || 0)) * i.quantity, 0);
          setTaxRate(currentSubtotal > 0 ? fetchedTaxTotal / currentSubtotal : 0);
        }
      })
      .catch(err => console.warn('Failed to fetch checkout preview', err));

      // Fetch restaurant delivery fee
      fetch(`${appConfig.apiBaseUrl}/api/restaurants/${cart.restaurantId}`, {
        headers: { Authorization: `Bearer ${idToken}` }
      })
      .then(res => res.json())
      .then(json => {
        if (json.success && json.data && json.data.deliveryFee !== undefined) {
          setDeliveryFee(json.data.deliveryFee);
        }
      })
      .catch(err => console.warn('Failed to fetch restaurant info', err));
    }
  }, [cart.restaurantId, idToken]);

  // Pricing
  const tax      = Math.round(subtotal * taxRate);
  const delivery = fulfillmentType === 'DELIVERY' ? deliveryFee : 0;
  const discount = appliedCoupon?.discountAmount ?? 0;
  const total = Math.max(0, subtotal + tax + delivery - discount);

  const handleApplyCoupon = async (c: ApiCoupon) => {
    if (appliedCoupon?.code === c.code) {
      setApplied(null);
      return;
    }
    setApplyingCode(c.code);
    try {
      const { coupon, discountAmount } = await validateCoupon(idToken, c.code, subtotal, cart.restaurantId);
      setApplied({ ...coupon, discountAmount });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Coupon Error', body: e.message });
    } finally {
      setApplyingCode(null);
    }
  };

  const handlePlaceOrder = async () => {
    if (!cart.restaurantId || cart.items.length === 0) return;

    if (fulfillmentType === 'DELIVERY' && (!cart.deliveryAddress || (!cart.deliveryAddress.coordinates && !cart.deliveryAddress.lat))) {
      showToast({ type: 'warning', title: 'Address Required', body: 'Please go back to the Home screen and select your delivery location at the very top before placing an order.' });
      return;
    }

    setLoading(true);
    try {
      const body = {
        restaurantId: cart.restaurantId,
        items: cart.items.map(i => {
          const unitPrice = i.price + (i.addonTotal || 0);
          return {
            itemId: i.itemId,
            name: i.name,
            quantity: i.quantity,
            variantName: i.variantName,
            addons: i.addons,
            pricing: {
              unitPrice: i.price,
              finalPrice: unitPrice,
              taxAmount: Math.round(unitPrice * taxRate),
              packagingFee: 0
            },
            itemTotal: unitPrice * i.quantity
          };
        }),
        fulfillment: {
          type: fulfillmentType,
          address: cart.deliveryAddress ? {
            street: cart.deliveryAddress.name || 'Other',
            city: cart.deliveryAddress.fullAddress || '',
            coordinates: {
              lat: cart.deliveryAddress.coordinates?.lat ?? cart.deliveryAddress.lat,
              lng: cart.deliveryAddress.coordinates?.lng ?? cart.deliveryAddress.lng
            }
          } : undefined
        },
        pricing: {
          itemsTotal: subtotal,
          taxTotal: tax,
          deliveryFee: delivery,
          platformFee: 0,
          discountTotal: discount,
          grandTotal: total,
        },
        payment: {
          mode: payment,
          status: payment === 'CASH' ? 'PENDING' : 'PENDING',
          paidAmount: payment === 'CASH' ? 0 : total,
        },
        ...(appliedCoupon?.code ? { coupon: appliedCoupon.code } : {}),
      };
      const res = await fetch(`${appConfig.apiBaseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Order failed');

      const newOrder = json.order;
      let orderConfirmedMessage = `Order #${newOrder?.orderId ?? 'confirmed'} placed.\nPayment: Cash on Delivery`;

      if (payment === 'ONLINE') {
        try {
          const rzRes = await fetch(`${appConfig.apiBaseUrl}/api/payments/create-order/${newOrder.orderId}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${idToken}` }
          });
          const rzJson = await rzRes.json();
          if (!rzRes.ok || !rzJson.success) throw new Error(rzJson.message || 'Failed to initialize payment');

          const RazorpayCheckout = require('react-native-razorpay').default;
          const options = {
            description: 'Food Order',
            image: 'https://i.imgur.com/3g7nmJC.png',
            currency: rzJson.currency,
            key: rzJson.razorpayKey,
            amount: rzJson.amount,
            name: 'TownPulse',
            order_id: rzJson.razorpayOrderId,
            prefill: { email: user?.email || 'user@example.com', contact: user?.phone || '9999999999', name: user?.name || 'User' },
            theme: { color: '#B71C1C' }
          };

          const data = await RazorpayCheckout.open(options);

          // ⚠️ POST /api/payments/verify-payment is NOT in the pushed backend
          await showMissingApiWarning(MISSING_APIS.VERIFY_PAYMENT).catch(() => {});

          orderConfirmedMessage = `Order #${newOrder?.orderId ?? 'confirmed'} placed.\nPayment: Online Successful`;
        } catch (err: any) {
          try {
            // ⚠️ POST /api/orders/:id/cancel-payment is NOT in the pushed backend
            console.warn('[CartScreen] cancel-payment endpoint not available in pushed backend');
          } catch (cancelErr) {
            console.warn('Failed to cancel unpaid order:', cancelErr);
          }
          throw new Error('Payment cancelled or failed. Please try again.');
        }
      }

      clearCart();
      showToast({ type: 'success', title: '🎉 Order Placed!', body: orderConfirmedMessage });
      onOrderPlaced();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Error', body: err.message });
    } finally {
      setLoading(false);
    }
  };

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (itemCount === 0) {
    return (
      <View style={cs.rootEmpty}>
        <StatusBar barStyle="dark-content" backgroundColor="#E5E7EB" />
        <View style={cs.empty}>
          <Text style={cs.emptyEmoji}>🛒</Text>
          <Text style={cs.emptyTitle}>Cart is empty</Text>
          <Text style={cs.emptySub}>Add items from a restaurant to get started</Text>
          <TouchableOpacity style={cs.emptyBtn} onPress={onBack}>
            <Text style={cs.emptyBtnText}>Browse Restaurants</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={cs.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#E5E7EB" />

      <View style={cs.sheet}>

        {/* Header */}
        <View style={cs.header}>
          <TouchableOpacity onPress={onBack} style={cs.backBtn} activeOpacity={0.7}>
            <Text style={cs.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={cs.headerTitle}>Order confirmation</Text>
          <TouchableOpacity onPress={() => setClearConfirmVisible(true)}>
            <Text style={cs.clearText}>Clear</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={cart.items}
          keyExtractor={item => item.itemId}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          ListHeaderComponent={
            <>
              {/* Delivery Address */}
              {fulfillmentType === 'DELIVERY' && (
                <TouchableOpacity style={cs.deliverySection} onPress={() => setLocModalVisible(true)} activeOpacity={0.8}>
                  <LocationPinIcon size={22} color="#FBC02D" />
                  <View style={cs.deliveryInfo}>
                    <Text style={cs.deliveryLabel}>Delivery to</Text>
                    <Text style={cs.deliveryAddressText} numberOfLines={1}>
                      {cart.deliveryAddress?.name || cart.deliveryAddress?.fullAddress || 'Please select an address on Home'}
                    </Text>
                  </View>
                  <Text style={cs.chevronRight}>›</Text>
                </TouchableOpacity>
              )}

              <Text style={cs.sectionTitle}>Your order</Text>
            </>
          }
          renderItem={({ item }) => {
            const finalItemPrice = item.price + (item.addonTotal || 0);
            return (
              <View style={cs.itemRow}>
                {/* Image or Placeholder */}
                {item.image ? (
                  <Image source={{ uri: item.image }} style={cs.itemImg} resizeMode="cover" />
                ) : (
                  <View style={cs.itemImgPlaceholder}>
                    <Text style={{ fontSize: 24 }}>🍲</Text>
                  </View>
                )}

                <Text style={cs.itemQty}>{item.quantity} x</Text>

                <View style={cs.itemInfo}>
                  <Text style={cs.itemName} numberOfLines={1}>{item.name}</Text>
                  <Text style={cs.itemSubtext} numberOfLines={1}>
                    {item.variantName ? item.variantName : ''}
                    {item.addons && item.addons.length > 0 ? ` - ${item.addons.map(a => a.name).join(', ')}` : ''}
                  </Text>
                </View>

                <View style={cs.priceAndQty}>
                  <Text style={cs.itemPrice}>₹{finalItemPrice * item.quantity}</Text>
                  {/* +/- buttons */}
                  <View style={cs.qtyControls}>
                    <TouchableOpacity style={cs.qtyBtnSmall} onPress={() => setQty(item.itemId, item.quantity - 1)}>
                      <Text style={cs.qtyBtnTextSmall}>-</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={cs.qtyBtnSmall} onPress={() => setQty(item.itemId, item.quantity + 1)}>
                      <Text style={cs.qtyBtnTextSmall}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
          ListFooterComponent={
            <View>
              {/* Bill Summary */}
              <View style={cs.billSection}>
                <View style={cs.billRow}>
                  <Text style={cs.billLabel}>Subtotal ({itemCount} item)</Text>
                  <Text style={cs.billValue}>₹{subtotal}</Text>
                </View>
                {delivery > 0 && (
                  <View style={cs.billRow}>
                    <Text style={cs.billLabel}>Delivery charges</Text>
                    <Text style={cs.billValue}>₹{delivery}</Text>
                  </View>
                )}
                {tax > 0 && (
                  <View style={cs.billRow}>
                    <Text style={cs.billLabel}>Taxes ({(taxRate * 100).toFixed(0)}%)</Text>
                    <Text style={cs.billValue}>₹{tax}</Text>
                  </View>
                )}
                {discount > 0 && (
                  <View style={cs.billRow}>
                    <Text style={[cs.billLabel, { color: '#16A34A' }]}>Coupon discount</Text>
                    <Text style={[cs.billValue, { color: '#16A34A' }]}>- ₹{discount}</Text>
                  </View>
                )}
                <View style={cs.totalRow}>
                  <Text style={cs.totalLabel}>Total</Text>
                  <Text style={cs.totalValue}>₹{total}</Text>
                </View>
                <ZigzagBorder />
              </View>

              {/* Coupons List */}
              {coupons.length > 0 && (
                <View style={cs.couponsWrap}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                    {coupons.map(c => {
                      const isActive = appliedCoupon?.code === c.code;
                      const isApplying = applyingCode === c.code;
                      const isEligible = subtotal >= c.minOrderAmount;

                      return (
                        <TouchableOpacity
                          key={c.code}
                          style={[cs.couponCard, isActive && cs.couponCardActive, !isEligible && { opacity: 0.6 }]}
                          onPress={() => isEligible && handleApplyCoupon(c)}
                          activeOpacity={0.8}
                          disabled={!isEligible || isApplying}
                        >
                          <View style={cs.couponContent}>
                            <Text style={cs.couponDiscount}>{c.type === 'percent' ? `${c.discount}%` : `₹${c.discount}`}</Text>
                            <Text style={cs.couponCode}>Enter {c.code}</Text>
                          </View>
                          <View style={cs.couponBadge}>
                            {isApplying ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={cs.couponBadgeText}>{isActive ? '✓' : 'x20'}</Text>}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                    <TouchableOpacity style={cs.moreCouponsBtn}>
                      <Text style={cs.moreCouponsArrow}>›</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              )}
            </View>
          }
        />

        {/* Footer */}
        <View style={cs.footer}>
          {/* Payment Pills */}
          <View style={cs.paymentPills}>
            <TouchableOpacity
              style={[cs.payPill, payment === 'CASH' && cs.payPillActive]}
              onPress={() => setPayment('CASH')}
            >
              <Text style={[cs.payPillText, payment === 'CASH' && cs.payPillTextActive]}>💵 Cash</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[cs.payPill, payment === 'ONLINE' && cs.payPillActive]}
              onPress={() => setPayment('ONLINE')}
            >
              <Text style={[cs.payPillText, payment === 'ONLINE' && cs.payPillTextActive]}>💳 UPI</Text>
            </TouchableOpacity>
          </View>

          <PressableScale
            style={[cs.orderBtn, loading && { backgroundColor: '#E8D88A' }]}
            onPress={handlePlaceOrder}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#111" /> : <Text style={cs.orderBtnText}>Order  •  ₹{total}</Text>}
          </PressableScale>
        </View>

        <LocationSelectorModal 
          visible={locModalVisible} 
          idToken={idToken} 
          onClose={() => setLocModalVisible(false)} 
          onSelect={(addr) => {
            setDeliveryAddress(addr);
            setLocModalVisible(false);
          }}
        />

      </View>

      <ConfirmDialog
        visible={clearConfirmVisible}
        title="Clear cart?"
        message="Remove all items?"
        confirmLabel="Clear"
        destructive
        onConfirm={() => { clearCart(); setClearConfirmVisible(false); }}
        onCancel={() => setClearConfirmVisible(false)}
      />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const cs = StyleSheet.create({
  rootEmpty: { flex: 1, backgroundColor: '#E5E7EB' },
  root: { flex: 1, backgroundColor: '#E5E7EB', paddingTop: 40 },

  sheet: {
    flex: 1, backgroundColor: '#FFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: 'hidden',
  },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 18,
  },
  backBtn: { paddingRight: 10 },
  backIcon: { fontSize: 32, color: '#111', fontWeight: '400', lineHeight: 34, marginTop: -4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  clearText: { color: '#EF4444', fontWeight: '600', fontSize: 14 },

  // Delivery Section
  deliverySection: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  deliveryInfo: { flex: 1, marginLeft: 12 },
  deliveryLabel: { fontSize: 12, color: '#6B7280', marginBottom: 2 },
  deliveryAddressText: { fontSize: 14, fontWeight: '600', color: '#111' },
  chevronRight: { fontSize: 24, color: '#111', paddingLeft: 10 },

  sectionTitle: { fontSize: 13, color: '#6B7280', fontWeight: '600', paddingHorizontal: 16, marginTop: 24, marginBottom: 12 },

  // Items
  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 12,
  },
  itemImgPlaceholder: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center',
  },
  itemImg: {
    width: 44, height: 44, borderRadius: 10,
  },
  itemQty: { fontSize: 14, fontWeight: '700', color: '#111', width: 24 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 4 },
  itemSubtext: { fontSize: 12, color: '#9CA3AF' },

  priceAndQty: { alignItems: 'flex-end', justifyContent: 'center' },
  itemPrice: { fontSize: 15, fontWeight: '800', color: '#111', marginBottom: 6 },
  qtyControls: { flexDirection: 'row', gap: 6 },
  qtyBtnSmall: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  qtyBtnTextSmall: { fontSize: 16, fontWeight: '600', color: '#111', marginTop: -2 },

  // Bill
  billSection: {
    marginTop: 20, paddingHorizontal: 16, paddingTop: 16, backgroundColor: '#FAFAFA',
  },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  billLabel: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
  billValue: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginBottom: 16 },
  totalLabel: { fontSize: 15, fontWeight: '800', color: '#111' },
  totalValue: { fontSize: 15, fontWeight: '800', color: '#111' },

  zigzagContainer: { flexDirection: 'row', width: '100%', overflow: 'hidden', height: 8, backgroundColor: '#FFF' },
  zigzagTriangle: {
    width: 16, height: 16, backgroundColor: '#FAFAFA',
    transform: [{ rotate: '45deg' }], marginTop: -8, marginLeft: -8,
  },

  // Coupons
  couponsWrap: { marginTop: 24, marginBottom: 10 },
  couponCard: {
    width: 140, height: 70, borderRadius: 8,
    backgroundColor: '#FFAD5C', overflow: 'hidden',
    flexDirection: 'row',
  },
  couponCardActive: { borderWidth: 2, borderColor: '#16A34A' },
  couponContent: { flex: 1, padding: 12, justifyContent: 'center' },
  couponDiscount: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  couponCode: { fontSize: 10, color: '#FFF', fontWeight: '600', marginTop: 2 },
  couponBadge: {
    width: 30, backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  couponBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800', transform: [{ rotate: '90deg' }] },

  moreCouponsBtn: {
    width: 40, height: 70, borderRadius: 8, backgroundColor: '#FFF3E0',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FFAD5C',
  },
  moreCouponsArrow: { fontSize: 24, color: '#FFAD5C', fontWeight: '600' },

  // Footer
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFF', paddingHorizontal: 16, paddingBottom: 24, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  paymentPills: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  payPill: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    backgroundColor: '#EBF5FF', alignItems: 'center',
  },
  payPillActive: { backgroundColor: '#DBEAFE', borderWidth: 1, borderColor: '#3B82F6' },
  payPillText: { fontSize: 14, fontWeight: '600', color: '#60A5FA' },
  payPillTextActive: { color: '#2563EB' },

  orderBtn: {
    backgroundColor: '#FBC02D', borderRadius: 12, paddingVertical: 16,
    alignItems: 'center',
  },
  orderBtnText: { color: '#111', fontSize: 16, fontWeight: '800' },

  // Empty
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyEmoji: { fontSize: 60 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#111' },
  emptySub: { fontSize: 14, color: '#6B7280', textAlign: 'center', paddingHorizontal: 40 },
  emptyBtn: { marginTop: 8, backgroundColor: '#FBC02D', borderRadius: 12, paddingHorizontal: 28, paddingVertical: 12 },
  emptyBtnText: { color: '#111', fontWeight: '700', fontSize: 15 },
});
