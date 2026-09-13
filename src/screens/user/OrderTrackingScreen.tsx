/**
 * OrderTrackingScreen.tsx — OTP display + Live delivery map via WebSocket
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Linking,
  Image,
} from 'react-native';
import LeafletMap from '../../components/LeafletMap';
import { appConfig } from '../../config/appConfig';

// ── Types ──────────────────────────────────────────────────────────────────────
interface OrderDoc {
  _id: string;
  orderId: string;
  status: string;
  items: { name: string; quantity: number; image?: string; variantName?: string; price?: number; finalPrice?: number; unitPrice?: number; pricing?: { finalPrice?: number; unitPrice?: number } }[];
  pricing: { grandTotal?: number; itemsTotal?: number };
  payment: { mode: string; status: string };
  delivery?: {
    otpCode?: string;
    partner?: { name: string; phone: string; vehicleType?: string; photo?: string };
    routePreview?: {
      polyline?: string;
      origin?: { lat: number; lng: number };
      destination?: { lat: number; lng: number };
      etaMinutes?: number;
      roadDistanceKm?: number;
    };
    tracking?: {
      stage?: string;
      lastKnownLocation?: { lat: number; lng: number };
      etaMinutes?: number;
    };
  };
  fulfillment?: {
    type?: string;
    address?: { street?: string; city?: string; coordinates?: { lat: number; lng: number } };
    pickup?: { coordinates?: { lat: number; lng: number } };
  };
  createdAt: string;
}

type Props = {
  order: OrderDoc;
  idToken: string;
  onBack: () => void;
};

// Map backend statuses to our 3 horizontal steps
const getStepProgress = (status: string) => {
  if (['PLACED', 'CONFIRMED', 'ACCEPTED'].includes(status)) return 1;
  if (['PREPARING', 'READY_FOR_PICKUP'].includes(status)) return 2;
  if (['DISPATCHED', 'OUT_FOR_DELIVERY', 'ARRIVED'].includes(status)) return 3;
  if (['DELIVERED'].includes(status)) return 4;
  return 0; // Cancelled
};

import { decodePolyline } from '../../utils/polyline';

// ── Main Component ─────────────────────────────────────────────────────────────
export default function OrderTrackingScreen({ order: initialOrder, idToken, onBack }: Props) {
  const [order, setOrder] = useState(initialOrder);
  const [partnerLoc, setPartnerLoc] = useState<{ lat: number; lng: number } | null>(
    initialOrder.delivery?.tracking?.lastKnownLocation ?? null
  );
  const [eta, setEta] = useState<number | null>(
    initialOrder.delivery?.tracking?.etaMinutes ?? null
  );

  const isActive = !['DELIVERED', 'CANCELLED'].includes(order.status);
  const pickup = order.fulfillment?.pickup?.coordinates;
  const customer = order.fulfillment?.address?.coordinates;

  const currentStep = getStepProgress(order.status);

  // Formatting ETA time (e.g., "13:45")
  const getEtaTime = () => {
    if (!eta) return "Soon";
    const d = new Date();
    d.setMinutes(d.getMinutes() + eta);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  // ── Fetch fresh order data ─────────────────────────────────────────────────
  const refreshOrder = useCallback(async () => {
    try {
      const res = await fetch(`${appConfig.apiBaseUrl}/api/orders/${order.orderId}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const json = await res.json();
      if (json.success && json.order) {
        setOrder(json.order);
        if (json.order.delivery?.tracking?.lastKnownLocation) {
          setPartnerLoc(json.order.delivery.tracking.lastKnownLocation);
        }
        if (json.order.delivery?.tracking?.etaMinutes != null) {
          setEta(json.order.delivery.tracking.etaMinutes);
        }
      }
    } catch { }
  }, [order.orderId, idToken]);

  useEffect(() => { refreshOrder(); }, [refreshOrder]);

  // ── Socket.IO for live tracking ─────────────────────────────────────────────
  useEffect(() => {
    if (!isActive) return;
    let socketIo: any = null;

    const connectSocket = async () => {
      try {
        const { io } = require('socket.io-client');

        socketIo = io(appConfig.apiBaseUrl, {
          transports: ['websocket', 'polling'],
          auth: { token: idToken },
          reconnection: true,
          reconnectionDelay: 3000,
        });

        // Join the order-specific room for targeted updates
        socketIo.on('connect', () => {
          socketIo.emit('join_order', { orderId: order.orderId });
        });

        // Listen for live tracking snapshots from the server
        socketIo.on('tracking_snapshot', (data: any) => {
          if (data?.partnerLocation) {
            setPartnerLoc({
              lat: data.partnerLocation.lat,
              lng: data.partnerLocation.lng,
            });
          }
          if (data?.etaMinutes != null) setEta(data.etaMinutes);
        });

        // Listen for order status changes
        socketIo.on('order_updated', (data: any) => {
          if (data?.orderId === order.orderId) {
            refreshOrder();
          }
        });
      } catch (err) {
        console.log('[Socket.IO] Order tracking connection error:', err);
      }
    };

    connectSocket();
    return () => {
      socketIo?.disconnect();
    };
  }, [isActive, order.orderId, refreshOrder, idToken]);

  // ── Fallback polling for status updates ────────────────────────────────────
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(refreshOrder, 15000);
    return () => clearInterval(interval);
  }, [isActive, refreshOrder]);


  // Derived status text
  const getStatusText = (status: string) => {
    switch (status) {
      case 'PLACED': return 'Order placed';
      case 'CONFIRMED': return 'Restaurant Confirmed!';
      case 'ACCEPTED': return 'Restaurant accepted order';
      case 'PREPARING': return 'Preparing food...';
      case 'READY_FOR_PICKUP': return 'Order is ready for pickup';
      case 'DISPATCHED':
      case 'OUT_FOR_DELIVERY': return 'Delivery partner is on the way';
      case 'ARRIVED': return 'Partner arrived at your location';
      case 'DELIVERED': return 'Order Delivered successfully';
      case 'CANCELLED': return 'Order Cancelled';
      default: return 'Processing...';
    }
  };
  const statusText = getStatusText(order.status);

  return (
    <View style={st.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Floating Back Button */}
      <TouchableOpacity onPress={onBack} style={st.backBtn} activeOpacity={0.8} hitSlop={{ top: 30, bottom: 30, left: 30, right: 30 }}>
        <Text style={st.backIcon}>‹</Text>
      </TouchableOpacity>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} bounces={false}>

        {/* ── MAP ──────────────────────────────────────────────────────────── */}
        {order.fulfillment?.type === 'DELIVERY' ? (
          <View style={st.mapWrap}>
            <LeafletMap
              partnerCoords={partnerLoc ? { latitude: partnerLoc.lat, longitude: partnerLoc.lng } : null}
              pickupCoords={pickup}
              dropoffCoords={customer}
              routeOrigin={partnerLoc ?? pickup}
              routeDestination={customer}
              polylinePoints={order.delivery?.routePreview?.polyline ? decodePolyline(order.delivery.routePreview.polyline) : []}
              bottomPadding={50}
            />

            {!partnerLoc && isActive && !order.delivery?.routePreview?.polyline && (
              <View style={st.mapOverlay}>
                <Text style={st.mapOverlayText}>Waiting for delivery partner location…</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={st.mapWrapEmpty}>
            <Text style={{ color: '#9CA3AF' }}>Takeaway / No Map Available</Text>
          </View>
        )}

        {/* ── OVERLAPPING CARD ──────────────────────────────────────────────── */}
        <View style={st.floatingCard}>

          {/* Top ETA Pill */}
          {isActive && (
            <View style={st.etaPillContainer}>
              <View style={st.etaPill}>
                <Text style={st.etaPillText}>Est. Time {getEtaTime()}</Text>
              </View>
            </View>
          )}

          <Text style={st.statusTitle}>{statusText}</Text>

          {/* Horizontal Timeline */}
          {order.status !== 'CANCELLED' && (
            <View style={st.timelineRow}>
              {/* Step 1 */}
              <View style={st.stepNode}>
                <View style={[st.circle, currentStep >= 1 && st.circleActive]}>
                  {currentStep >= 1 ? <Text style={st.checkIcon}>✓</Text> : null}
                </View>
                <Text style={[st.stepText, currentStep >= 1 && st.stepTextActive]}>In process</Text>
                <Text style={st.stepTime}>{/* Can add actual timestamps if backend provides */}</Text>
              </View>

              <View style={[st.line, currentStep >= 2 && st.lineActive]} />

              {/* Step 2 */}
              <View style={st.stepNode}>
                <View style={[st.circle, currentStep >= 2 && st.circleActive]}>
                  {currentStep >= 2 ? <Text style={st.checkIcon}>✓</Text> : null}
                </View>
                <Text style={[st.stepText, currentStep >= 2 && st.stepTextActive]}>Prepare food</Text>
              </View>

              <View style={[st.line, currentStep >= 3 && st.lineActive]} />

              {/* Step 3 */}
              <View style={st.stepNode}>
                <View style={[st.circle, currentStep >= 3 && st.circleActive]}>
                  {currentStep >= 3 ? <Text style={st.checkIcon}>✓</Text> : null}
                </View>
                <Text style={[st.stepText, currentStep >= 3 && st.stepTextActive]}>On the way</Text>
              </View>

              <View style={[st.line, currentStep >= 4 && st.lineActive]} />

              {/* Step 4 */}
              <View style={st.stepNode}>
                <View style={[st.circle, currentStep >= 4 && st.circleActive]}>
                  {currentStep >= 4 ? <Text style={st.checkIcon}>✓</Text> : null}
                </View>
                <Text style={[st.stepText, currentStep >= 4 && st.stepTextActive]}>Success</Text>
              </View>
            </View>
          )}

          {/* Driver Information */}
          {order.delivery?.partner && (
            <>
              <Text style={st.sectionLabel}>Driver information</Text>
              <View style={st.driverRow}>
                <View style={st.driverAvatar}>
                  <Text style={{ fontSize: 24 }}>👨‍🚀</Text>
                </View>
                <View style={st.driverDetails}>
                  <Text style={st.driverName}>{order.delivery.partner.name}</Text>
                  <Text style={st.driverVehicle}>{order.delivery.partner.vehicleType || 'Delivery Partner'}</Text>
                </View>
                {order.delivery.partner.phone ? (
                  <View style={st.actionButtons}>
                    <TouchableOpacity style={st.actionIcon} onPress={() => Linking.openURL(`tel:${order.delivery!.partner!.phone}`)}>
                      <Text style={{ fontSize: 18 }}>📞</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={st.actionIcon} onPress={() => Linking.openURL(`sms:${order.delivery!.partner!.phone}`)}>
                      <Text style={{ fontSize: 18 }}>💬</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            </>
          )}

          {/* OTP Box (if active) */}
          {order.delivery?.otpCode && isActive && (
            <View style={st.otpCard}>
              <Text style={st.otpLabel}>Delivery OTP</Text>
              <Text style={st.otpDigit}>{order.delivery.otpCode}</Text>
            </View>
          )}

          {/* Order Details */}
          <View style={st.orderHeaderRow}>
            <View>
              <Text style={st.orderLabel}>Order ID</Text>
              <Text style={st.orderIdValue}># {order.orderId}</Text>
            </View>
            <TouchableOpacity style={st.copyBtn}>
              <Text style={{ fontSize: 20, color: '#9CA3AF' }}>⧉</Text>
            </TouchableOpacity>
          </View>

          <View style={st.itemsList}>
            {order.items.map((item, i) => (
              <View key={i} style={st.itemRow}>
                <View style={st.itemImgPlaceholder}>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={st.itemImg} />
                  ) : (
                    <Text style={{ fontSize: 20 }}>🍲</Text>
                  )}
                </View>
                <Text style={st.itemQty}>{item.quantity} x</Text>
                <View style={st.itemInfo}>
                  <Text style={st.itemName}>{item.name}</Text>
                  {item.variantName ? <Text style={st.itemVariant}>{item.variantName}</Text> : null}
                </View>
                <Text style={st.itemPrice}>₹{(item as any).itemTotal ?? ((item.pricing?.finalPrice ?? item.pricing?.unitPrice ?? item.finalPrice ?? item.unitPrice ?? item.price ?? 0) * item.quantity)}</Text>
              </View>
            ))}
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F4F6' },

  backBtn: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 4,
  },
  backIcon: { fontSize: 26, color: '#111', fontWeight: '500', marginTop: -2, marginLeft: -2 },

  mapWrap: {
    height: 480, // Takes up good portion of top screen
    width: '100%',
    position: 'relative',
  },
  mapWrapEmpty: {
    height: 480,
    width: '100%',
    backgroundColor: '#E5E7EB',
    justifyContent: 'center', alignItems: 'center',
  },
  mapOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center', alignItems: 'center',
  },
  mapOverlayText: { color: '#6B7280', fontSize: 13, fontWeight: '600' },

  // Floating Bottom Card
  floatingCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -80, // Overlap the map
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
    minHeight: 500,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 10,
  },

  etaPillContainer: {
    alignItems: 'center',
    marginTop: -60,
    marginBottom: 20,
    zIndex: 99,
    elevation: 11,
  },
  etaPill: {
    backgroundColor: '#1F2937',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 4,
  },
  etaPillText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  statusTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111',
    textAlign: 'center',
    marginBottom: 32,
  },

  // Horizontal Timeline
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 40,
    paddingHorizontal: 10,
  },
  stepNode: {
    alignItems: 'center',
    width: 70,
  },
  circle: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 8,
  },
  circleActive: {
    backgroundColor: '#10B981',
  },
  checkIcon: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  stepText: { fontSize: 12, color: '#9CA3AF', fontWeight: '600', textAlign: 'center' },
  stepTextActive: { color: '#111' },
  stepTime: { fontSize: 10, color: '#9CA3AF', marginTop: 4 },

  line: {
    flex: 1,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginTop: 11, // align with circle centers
    marginHorizontal: 4,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  lineActive: {
    borderColor: '#10B981',
  },

  // Driver Info
  sectionLabel: { fontSize: 14, fontWeight: '800', color: '#111', marginBottom: 16 },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  driverAvatar: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 16,
  },
  driverDetails: { flex: 1 },
  driverName: { fontSize: 16, fontWeight: '800', color: '#111', marginBottom: 2 },
  driverVehicle: { fontSize: 13, color: '#6B7280' },

  actionButtons: { flexDirection: 'row', gap: 12 },
  actionIcon: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1, borderColor: '#E5E7EB',
    justifyContent: 'center', alignItems: 'center',
  },

  // OTP
  otpCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#FEF3C7', padding: 16, borderRadius: 12, marginBottom: 32,
  },
  otpLabel: { fontSize: 14, fontWeight: '700', color: '#B45309' },
  otpDigit: { fontSize: 18, fontWeight: '900', color: '#B45309', letterSpacing: 4 },

  // Order Details
  orderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  orderLabel: { fontSize: 12, color: '#F5A623', fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  orderIdValue: { fontSize: 16, fontWeight: '800', color: '#111' },
  copyBtn: { padding: 4 },

  itemsList: { gap: 20 },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  itemImgPlaceholder: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center',
    marginRight: 12, overflow: 'hidden'
  },
  itemImg: { width: '100%', height: '100%' },
  itemQty: { fontSize: 14, fontWeight: '800', color: '#111', width: 28 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '800', color: '#111', marginBottom: 2 },
  itemVariant: { fontSize: 12, color: '#6B7280' },
  itemPrice: { fontSize: 15, fontWeight: '800', color: '#111' },

});
