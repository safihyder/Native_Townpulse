/**
 * CartScreen.tsx — Review cart, apply coupon, choose payment, place order
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { appConfig } from '../../config/appConfig';
import { useCart } from '../../context/CartContext';

interface Props {
  idToken: string;
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
  discountAmount?: number;  // filled after validate call
}

type PaymentMode = 'ONLINE' | 'CASH';

const DELIVERY_FEE = 30;
const TAX_RATE     = 0.05;

// ── API helpers ────────────────────────────────────────────────────────────────
async function fetchCoupons(idToken: string, restaurantId: string | null): Promise<ApiCoupon[]> {
  const qs  = restaurantId ? `?restaurantId=${restaurantId}` : '';
  const res = await fetch(`${appConfig.apiBaseUrl}/api/coupons${qs}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const json = await res.json();
  return res.ok ? (json.coupons ?? []) : [];
}

async function validateCoupon(
  idToken: string, code: string, subtotal: number, restaurantId: string | null,
): Promise<{ coupon: ApiCoupon; discountAmount: number }> {
  const res  = await fetch(`${appConfig.apiBaseUrl}/api/coupons/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ code, subtotal, restaurantId }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Invalid coupon');
  return { coupon: json.coupon, discountAmount: json.discountAmount };
}

// ── Payment option row ─────────────────────────────────────────────────────────
function PaymentOption({ mode, selected, onSelect }: {
  mode: PaymentMode; selected: boolean; onSelect: () => void;
}) {
  const icon  = mode === 'ONLINE' ? '💳' : '💵';
  const label = mode === 'ONLINE' ? 'Pay Online'       : 'Cash on Delivery';
  const sub   = mode === 'ONLINE' ? 'UPI / Card / Net Banking' : 'Pay when your order arrives';

  return (
    <TouchableOpacity
      style={[cs.payOption, selected && cs.payOptionActive]}
      onPress={onSelect}
      activeOpacity={0.8}
    >
      <Text style={cs.payIcon}>{icon}</Text>
      <View style={cs.payText}>
        <Text style={[cs.payLabel, selected && cs.payLabelActive]}>{label}</Text>
        <Text style={cs.paySub}>{sub}</Text>
      </View>
      <View style={[cs.payRadio, selected && cs.payRadioActive]}>
        {selected && <View style={cs.payRadioDot} />}
      </View>
    </TouchableOpacity>
  );
}

// ── Coupon sheet ───────────────────────────────────────────────────────────────
function CouponSheet({ visible, idToken, subtotal, restaurantId, applied, onApply, onClose }: {
  visible: boolean;
  idToken: string;
  subtotal: number;
  restaurantId: string | null;
  applied: ApiCoupon | null;
  onApply: (c: ApiCoupon | null) => void;
  onClose: () => void;
}) {
  const [typed, setTyped]       = useState('');
  const [coupons, setCoupons]   = useState<ApiCoupon[]>([]);
  const [listLoading, setLL]    = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const slideAnim = useRef(new Animated.Value(400)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
      // Load coupons from API
      setLL(true);
      fetchCoupons(idToken, restaurantId)
        .then(setCoupons)
        .finally(() => setLL(false));
    } else {
      Animated.timing(slideAnim, { toValue: 400, duration: 200, useNativeDriver: true }).start();
    }
  }, [visible, idToken, restaurantId, slideAnim]);

  const tryApply = async (code: string) => {
    setApplying(code);
    try {
      const { coupon, discountAmount } = await validateCoupon(idToken, code, subtotal, restaurantId);
      onApply({ ...coupon, discountAmount });
      onClose();
    } catch (e: any) {
      Alert.alert('Coupon Error', e.message);
    } finally {
      setApplying(null);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={cs.overlay} activeOpacity={1} onPress={onClose}>
        <Animated.View style={[cs.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <TouchableOpacity activeOpacity={1}>
            <View style={cs.sheetHandle} />
            <Text style={cs.sheetTitle}>Apply Coupon</Text>

            {/* Type coupon */}
            <View style={cs.couponInputRow}>
              <TextInput
                style={cs.couponInput}
                placeholder="Type coupon code"
                placeholderTextColor="#9CA3AF"
                value={typed}
                onChangeText={t => setTyped(t.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[cs.couponApplyBtn, applying === typed && { opacity: 0.6 }]}
                onPress={() => typed.trim() && tryApply(typed.trim())}
                disabled={!!applying}
                activeOpacity={0.8}
              >
                {applying === typed
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <Text style={cs.couponApplyText}>APPLY</Text>
                }
              </TouchableOpacity>
            </View>

            <Text style={cs.sheetSub}>Available Coupons</Text>

            {listLoading ? (
              <ActivityIndicator color="#F5C116" style={{ marginTop: 16 }} />
            ) : coupons.length === 0 ? (
              <Text style={cs.noCoupons}>No coupons available right now</Text>
            ) : (
              coupons.map(c => {
                const eligible = subtotal >= c.minOrderAmount;
                const isActive = applied?.code === c.code;
                return (
                  <View key={c.code} style={[cs.couponCard, isActive && cs.couponCardActive, !eligible && { opacity: 0.5 }]}>
                    <View style={cs.couponLeft}>
                      <Text style={cs.couponCode}>{c.code}</Text>
                      <Text style={cs.couponLabel}>{c.description}</Text>
                      {!eligible && (
                        <Text style={cs.couponMin}>Add ₹{c.minOrderAmount - subtotal} more to unlock</Text>
                      )}
                    </View>
                    {isActive ? (
                      <TouchableOpacity style={cs.couponRemoveBtn} onPress={() => onApply(null)}>
                        <Text style={cs.couponRemoveText}>REMOVE</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[cs.couponSelectBtn, (!eligible || !!applying) && { opacity: 0.4 }]}
                        disabled={!eligible || !!applying}
                        onPress={() => tryApply(c.code)}
                      >
                        {applying === c.code
                          ? <ActivityIndicator color="#F5C116" size="small" />
                          : <Text style={cs.couponSelectText}>APPLY</Text>
                        }
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            )}
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function CartScreen({ idToken, onBack, onOrderPlaced, fulfillmentType = 'DELIVERY' }: Props) {
  const { cart, itemCount, subtotal, setQty, clearCart } = useCart();
  const [payment, setPayment]             = useState<PaymentMode>('ONLINE');
  const [appliedCoupon, setApplied]       = useState<ApiCoupon | null>(null);
  const [couponVisible, setCouponVisible] = useState(false);
  const [loading, setLoading]             = useState(false);

  // Reset coupon if cart changes significantly
  useEffect(() => { setApplied(null); }, [cart.restaurantId]);

  // Pricing — use server-computed discountAmount when available
  const tax      = Math.round(subtotal * TAX_RATE);
  const delivery = fulfillmentType === 'DELIVERY' ? DELIVERY_FEE : 0;
  const discount = appliedCoupon?.discountAmount ?? 0;
  const total    = Math.max(0, subtotal + tax + delivery - discount);

  const handlePlaceOrder = async () => {
    if (!cart.restaurantId || cart.items.length === 0) return;
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
              taxAmount: Math.round(unitPrice * TAX_RATE),
              packagingFee: 0
            },
            itemTotal: unitPrice * i.quantity
          };
        }),
        fulfillment: { type: fulfillmentType },
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
      const res  = await fetch(`${appConfig.apiBaseUrl}/api/orders`, {
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
            prefill: { email: 'user@example.com', contact: '9999999999', name: 'User' },
            theme: { color: '#B71C1C' }
          };

          const data = await RazorpayCheckout.open(options);

          // Verify Payment
          const vRes = await fetch(`${appConfig.apiBaseUrl}/api/payments/verify-payment/${newOrder.orderId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify(data)
          });
          const vJson = await vRes.json();
          if (!vRes.ok || !vJson.success) throw new Error(vJson.message || 'Payment verification failed');
          
          orderConfirmedMessage = `Order #${newOrder?.orderId ?? 'confirmed'} placed.\nPayment: Online Successful`;
        } catch (err: any) {
          // Cancel the unverified order so the cart isn't stuck and restaurants don't see it
          try {
            await fetch(`${appConfig.apiBaseUrl}/api/orders/${newOrder.orderId}/cancel-payment`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${idToken}` }
            });
          } catch (cancelErr) {
            console.warn('Failed to cancel unpaid order:', cancelErr);
          }
          throw new Error('Payment cancelled or failed. Please try again.');
        }
      }

      clearCart();
      Alert.alert(
        '🎉 Order Placed!',
        orderConfirmedMessage,
        [{ text: 'OK', onPress: onOrderPlaced }],
      );
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (itemCount === 0) {
    return (
      <View style={cs.root}>
        <StatusBar barStyle="light-content" backgroundColor="#B71C1C" />
        <View style={cs.header}>
          <TouchableOpacity onPress={onBack} style={cs.backBtn}>
            <Text style={cs.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={cs.headerTitle}>Your Cart</Text>
        </View>
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
      <StatusBar barStyle="light-content" backgroundColor="#B71C1C" />
      <CouponSheet
        visible={couponVisible}
        idToken={idToken}
        subtotal={subtotal}
        restaurantId={cart.restaurantId}
        applied={appliedCoupon}
        onApply={setApplied}
        onClose={() => setCouponVisible(false)}
      />

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <View style={cs.header}>
        <TouchableOpacity onPress={onBack} style={cs.backBtn}>
          <Text style={cs.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={cs.headerInfo}>
          <Text style={cs.headerTitle}>Your Cart</Text>
          <Text style={cs.headerSub} numberOfLines={1}>{cart.restaurantName}</Text>
        </View>
        <TouchableOpacity onPress={() => Alert.alert('Clear cart?', 'Remove all items?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Clear', style: 'destructive', onPress: clearCart },
        ])}>
          <Text style={cs.clearText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={cart.items}
        keyExtractor={item => item.itemId}
        contentContainerStyle={{ paddingBottom: 110 }}
        renderItem={({ item }) => (
          <View style={cs.itemRow}>
            <View style={[cs.vegDot, { borderColor: item.isVeg ? '#16A34A' : '#F5C116' }]}>
              <View style={[cs.vegDotInner, { backgroundColor: item.isVeg ? '#16A34A' : '#F5C116' }]} />
            </View>
            <View style={cs.itemInfo}>
              <Text style={cs.itemName} numberOfLines={1}>{item.name}</Text>
              {item.variantName && <Text style={cs.itemVariant}>{item.variantName}</Text>}
              {item.addons && item.addons.length > 0 && (
                <View style={cs.addonsWrap}>
                  {item.addons.map(a => (
                    <Text key={a.name} style={cs.addonText}>+ {a.name} (x{a.quantity})</Text>
                  ))}
                </View>
              )}
              <Text style={cs.itemPrice}>
                {item.addonTotal ? `₹${item.price} + ₹${item.addonTotal}` : `₹${item.price}`} × {item.quantity} = <Text style={{ fontWeight: '700', color: '#111' }}>₹{(item.price + (item.addonTotal || 0)) * item.quantity}</Text>
              </Text>
            </View>
            <View style={cs.qtyRow}>
              <TouchableOpacity style={cs.qtyBtn} onPress={() => setQty(item.itemId, item.quantity - 1)}>
                <Text style={cs.qtyBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={cs.qtyNum}>{item.quantity}</Text>
              <TouchableOpacity style={cs.qtyBtn} onPress={() => setQty(item.itemId, item.quantity + 1)}>
                <Text style={cs.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListFooterComponent={
          <View>
            {/* ── Coupon ────────────────────────────────────────────────────── */}
            <TouchableOpacity style={cs.couponRow} onPress={() => setCouponVisible(true)} activeOpacity={0.8}>
              <Text style={cs.couponRowIcon}>🏷️</Text>
              {appliedCoupon ? (
                <View style={cs.couponRowCenter}>
                  <Text style={cs.couponRowApplied}>{appliedCoupon.code} applied</Text>
                  <Text style={cs.couponRowSaving}>You save ₹{discount}!</Text>
                </View>
              ) : (
                <Text style={cs.couponRowText}>Apply Coupon Code</Text>
              )}
              <Text style={cs.couponRowChevron}>{appliedCoupon ? '✕' : '›'}</Text>
            </TouchableOpacity>

            {/* ── Bill ──────────────────────────────────────────────────────── */}
            <View style={cs.bill}>
              <Text style={cs.billTitle}>Bill Details</Text>
              <View style={cs.billRow}>
                <Text style={cs.billLabel}>Item Total</Text>
                <Text style={cs.billValue}>₹{subtotal}</Text>
              </View>
              {delivery > 0 && (
                <View style={cs.billRow}>
                  <Text style={cs.billLabel}>Delivery Fee</Text>
                  <Text style={cs.billValue}>₹{delivery}</Text>
                </View>
              )}
              <View style={cs.billRow}>
                <Text style={cs.billLabel}>Taxes & Charges (5%)</Text>
                <Text style={cs.billValue}>₹{tax}</Text>
              </View>
              {discount > 0 && (
                <View style={cs.billRow}>
                  <Text style={[cs.billLabel, { color: '#16A34A' }]}>Coupon Discount</Text>
                  <Text style={[cs.billValue, { color: '#16A34A' }]}>− ₹{discount}</Text>
                </View>
              )}
              <View style={[cs.billRow, cs.billRowTotal]}>
                <Text style={cs.billTotalLabel}>To Pay</Text>
                <Text style={cs.billTotalValue}>₹{total.toLocaleString('en-IN')}</Text>
              </View>
            </View>

            {/* ── Payment method ────────────────────────────────────────────── */}
            <View style={cs.paySection}>
              <Text style={cs.paySectionTitle}>Payment Method</Text>
              <PaymentOption mode="ONLINE" selected={payment === 'ONLINE'} onSelect={() => setPayment('ONLINE')} />
              <PaymentOption mode="CASH"    selected={payment === 'CASH'}    onSelect={() => setPayment('CASH')} />
            </View>
          </View>
        }
      />

      {/* ── Footer — Place Order ─────────────────────────────────────────────── */}
      <View style={cs.footer}>
        <View style={cs.footerMeta}>
          <Text style={cs.footerPayMode}>
            {payment === 'ONLINE' ? '💳 Pay Online' : '💵 Cash on Delivery'}
          </Text>
          <Text style={cs.footerTotal}>₹{total.toLocaleString('en-IN')}</Text>
        </View>
        <TouchableOpacity
          style={[cs.orderBtn, loading && cs.orderBtnDisabled]}
          onPress={handlePlaceOrder}
          activeOpacity={0.85}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#FFF" />
            : <Text style={cs.orderBtnText}>Place Order</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const cs = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111827' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#B71C1C', paddingTop: 48, paddingBottom: 12, paddingHorizontal: 14, gap: 10,
  },
  backBtn: { padding: 4 },
  backIcon: { color: '#FFF', fontSize: 22, fontWeight: '700' },
  headerInfo: { flex: 1 },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 1 },
  clearText: { color: '#FFD5D5', fontWeight: '600', fontSize: 13 },

  // Item row
  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FAE08B', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 12,
  },
  vegDot: { width: 14, height: 14, borderRadius: 2, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  vegDotInner: { width: 7, height: 7, borderRadius: 3.5 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 2 },
  itemVariant: { fontSize: 12, color: '#6B7280', marginBottom: 2 },
  addonsWrap: { marginBottom: 4 },
  addonText: { fontSize: 11, color: '#16A34A' },
  itemPrice: { fontSize: 12, color: '#6B7280' },
  qtyRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5C116', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, gap: 8,
  },
  qtyBtn: { paddingHorizontal: 2 },
  qtyBtnText: { color: '#FFF', fontSize: 18, fontWeight: '700', lineHeight: 20 },
  qtyNum: { color: '#FFF', fontWeight: '800', fontSize: 15, minWidth: 18, textAlign: 'center' },

  // Coupon row
  couponRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FAE08B', marginTop: 10, marginHorizontal: 0,
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F3F4F6',
  },
  couponRowIcon: { fontSize: 20 },
  couponRowCenter: { flex: 1 },
  couponRowText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#F5C116' },
  couponRowApplied: { fontSize: 14, fontWeight: '700', color: '#16A34A' },
  couponRowSaving: { fontSize: 12, color: '#16A34A', marginTop: 1 },
  couponRowChevron: { fontSize: 18, color: '#9CA3AF', fontWeight: '600' },

  // Bill
  bill: { backgroundColor: '#FAE08B', margin: 10, borderRadius: 14, padding: 16, gap: 10 },
  billTitle: { fontSize: 15, fontWeight: '800', color: '#111', marginBottom: 4 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between' },
  billLabel: { fontSize: 13, color: '#6B7280' },
  billValue: { fontSize: 13, color: '#111', fontWeight: '600' },
  billRowTotal: { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 10, marginTop: 4 },
  billTotalLabel: { fontSize: 15, fontWeight: '800', color: '#111' },
  billTotalValue: { fontSize: 16, fontWeight: '800', color: '#F5C116' },

  // Payment
  paySection: { backgroundColor: '#FAE08B', margin: 10, borderRadius: 14, padding: 16, gap: 10 },
  paySectionTitle: { fontSize: 15, fontWeight: '800', color: '#111', marginBottom: 4 },
  payOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#FAFAFA',
  },
  payOptionActive: { borderColor: '#F5C116', backgroundColor: '#FFF5F5' },
  payIcon: { fontSize: 22 },
  payText: { flex: 1 },
  payLabel: { fontSize: 14, fontWeight: '700', color: '#374151' },
  payLabelActive: { color: '#F5C116' },
  paySub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  payRadio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: '#D1D5DB',
    justifyContent: 'center', alignItems: 'center',
  },
  payRadioActive: { borderColor: '#F5C116' },
  payRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#F5C116' },

  // Footer
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#FAE08B', borderTopWidth: 1, borderTopColor: '#F3F4F6',
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20,
    gap: 10,
  },
  footerMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerPayMode: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  footerTotal: { fontSize: 18, fontWeight: '800', color: '#111' },
  orderBtn: {
    backgroundColor: '#F5C116', borderRadius: 14, paddingVertical: 15, alignItems: 'center',
    shadowColor: '#F5C116', shadowOpacity: 0.3, shadowRadius: 10, elevation: 6, shadowOffset: { width: 0, height: 3 },
  },
  orderBtnDisabled: { opacity: 0.6 },
  orderBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },

  // Coupon sheet / modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FAE08B', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 36,
    maxHeight: '85%',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB',
    alignSelf: 'center', marginBottom: 16,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 16 },
  sheetSub: { fontSize: 13, fontWeight: '700', color: '#6B7280', marginBottom: 10, marginTop: 6 },

  // Coupon input
  couponInputRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  couponInput: {
    flex: 1, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111',
    fontWeight: '700', letterSpacing: 1,
  },
  couponApplyBtn: {
    backgroundColor: '#F5C116', borderRadius: 10,
    paddingHorizontal: 16, justifyContent: 'center',
  },
  couponApplyText: { color: '#FFF', fontWeight: '800', fontSize: 13 },

  // Coupon cards
  couponCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    padding: 12, marginBottom: 10, borderStyle: 'dashed',
  },
  couponCardActive: { borderColor: '#16A34A', backgroundColor: '#F0FDF4' },
  couponLeft: { flex: 1, paddingRight: 10 },
  couponCode: { fontSize: 15, fontWeight: '800', color: '#111', letterSpacing: 0.5 },
  couponLabel: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  couponMin: { fontSize: 11, color: '#F5C116', marginTop: 4 },
  couponSelectBtn: {
    backgroundColor: '#FEE2E2', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7,
  },
  couponSelectText: { color: '#F5C116', fontWeight: '800', fontSize: 12 },
  couponRemoveBtn: {
    backgroundColor: '#DCFCE7', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7,
  },
  couponRemoveText: { color: '#15803D', fontWeight: '800', fontSize: 12 },

  noCoupons: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginTop: 16 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyEmoji: { fontSize: 60 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#111' },
  emptySub: { fontSize: 14, color: '#6B7280', textAlign: 'center', paddingHorizontal: 40 },
  emptyBtn: { marginTop: 8, backgroundColor: '#F5C116', borderRadius: 12, paddingHorizontal: 28, paddingVertical: 12 },
  emptyBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});


