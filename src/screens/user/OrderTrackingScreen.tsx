/**
 * OrderTrackingScreen.tsx — OTP display + Live delivery map via WebSocket
 * Mirrors DeliveryMapTab.tsx pattern: react-native-maps with animated marker
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
} from 'react-native';
import LeafletMap from '../../components/LeafletMap';
import { appConfig } from '../../config/appConfig';

// ── Types ──────────────────────────────────────────────────────────────────────
interface OrderDoc {
  _id: string;
  orderId: string;
  status: string;
  items: { name: string; quantity: number }[];
  pricing: { grandTotal?: number; itemsTotal?: number };
  payment: { mode: string; status: string };
  delivery?: {
    otpCode?: string;
    partner?: { name: string; phone: string; vehicleType?: string };
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

const STATUS_STEPS = [
  { key: 'PLACED',           label: 'Placed',      icon: '📝' },
  { key: 'CONFIRMED',        label: 'Confirmed',   icon: '✅' },
  { key: 'PREPARING',        label: 'Preparing',   icon: '🍳' },
  { key: 'READY_FOR_PICKUP', label: 'Ready',       icon: '📦' },
  { key: 'OUT_FOR_DELIVERY', label: 'On the way',  icon: '🛵' },
  { key: 'DELIVERED',        label: 'Delivered',    icon: '🎉' },
];

function getStepIndex(status: string) {
  const idx = STATUS_STEPS.findIndex(s => s.key === status);
  return idx >= 0 ? idx : 0;
}

/** Decode a Google-style encoded polyline string to lat/lng pairs */
function decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
  if (!encoded) return [];
  const points: { latitude: number; longitude: number }[] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : result >> 1;
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

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
  const otp = order.delivery?.otpCode;
  const pickup = order.fulfillment?.pickup?.coordinates;
  const customer = order.fulfillment?.address?.coordinates;
  const stepIdx = getStepIndex(order.status);

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
    } catch {}
  }, [order.orderId, idToken]);

  // Initial fetch
  useEffect(() => { refreshOrder(); }, [refreshOrder]);

  // ── WebSocket for live tracking ────────────────────────────────────────────
  useEffect(() => {
    if (!isActive) return;

    const wsUrl = appConfig.apiBaseUrl.replace(/^http/, 'ws') + '/ws';
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'order_tracking_update' && msg.data?.orderId === order.orderId) {
            const t = msg.data.tracking;
            if (t?.location) {
              const newLoc = { lat: t.location.lat, lng: t.location.lng };
              setPartnerLoc(newLoc);
            }
            if (t?.etaMinutes != null) setEta(t.etaMinutes);
          }

          // Also handle status changes
          if (msg.type === 'order_updated' && msg.data?.orderId === order.orderId) {
            refreshOrder();
          }
        } catch {}
      };

      ws.onclose = () => {
        reconnectTimer = setTimeout(connect, 3000);
      };
      ws.onerror = () => { ws?.close(); };
    };

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [isActive, order.orderId, refreshOrder]);

  // ── Fallback polling for status updates ────────────────────────────────────
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(refreshOrder, 15000);
    return () => clearInterval(interval);
  }, [isActive, refreshOrder]);

  // ── Map region ─────────────────────────────────────────────────────────────
  const mapCenter = partnerLoc ?? customer ?? pickup ?? { lat: 19.076, lng: 72.8777 };

  const polylinePoints = decodePolyline(order.delivery?.routePreview?.polyline ?? '');

  return (
    <View style={st.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />

      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity onPress={onBack} style={st.backBtn} activeOpacity={0.8}>
          <Text style={st.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={st.headerTitle}>Order #{order.orderId.slice(-8)}</Text>
          <Text style={st.headerSub}>
            {order.payment.mode === 'CASH' ? '💵 Cash on Delivery' : '💳 Online Payment'}
          </Text>
        </View>
        {eta != null && isActive && (
          <View style={st.etaBadge}>
            <Text style={st.etaNum}>{eta}</Text>
            <Text style={st.etaLabel}>min</Text>
          </View>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* ── MAP ──────────────────────────────────────────────────────────── */}
        {isActive && order.fulfillment?.type === 'DELIVERY' && (
          <View style={st.mapWrap}>
            <LeafletMap
              tileUrl="https://api.olamaps.io/tiles/v1/styles/default-light-standard/{z}/{x}/{y}.png?api_key=W7wiwv4l2zbS091tTWFMriVUlkx4VE8A6izkx25d"
              partnerCoords={partnerLoc ? { latitude: partnerLoc.lat, longitude: partnerLoc.lng } : null}
              pickupCoords={pickup} // Restaurant pin
              dropoffCoords={customer} // Customer pin
              routeOrigin={partnerLoc ?? pickup} // Route origin: Delivery boy
              routeDestination={customer} // Route destination: Customer
              polylinePoints={[]}
              bottomPadding={50}
            />

            {!partnerLoc && (
              <View style={st.mapOverlay}>
                <Text style={st.mapOverlayText}>Waiting for delivery partner location…</Text>
              </View>
            )}
          </View>
        )}

        {/* ── OTP CARD ────────────────────────────────────────────────────── */}
        {otp && isActive && (
          <View style={st.otpCard}>
            <View style={st.otpHeader}>
              <Text style={st.otpLabel}>🔐 Delivery OTP</Text>
              <Text style={st.otpHint}>Share with delivery partner</Text>
            </View>
            <View style={st.otpDigits}>
              {otp.split('').map((digit, i) => (
                <View key={i} style={st.otpBox}>
                  <Text style={st.otpDigit}>{digit}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── PARTNER INFO ─────────────────────────────────────────────────── */}
        {order.delivery?.partner && isActive && (
          <View style={st.partnerCard}>
            <View style={st.partnerInfo}>
              <Text style={st.partnerLabel}>Delivery Partner</Text>
              <Text style={st.partnerName}>{order.delivery!.partner!.name}</Text>
              {order.delivery!.partner!.vehicleType && (
                <Text style={st.partnerVehicle}>{order.delivery!.partner!.vehicleType}</Text>
              )}
            </View>
            {order.delivery?.partner?.phone ? (
              <TouchableOpacity
                style={st.callBtn}
                onPress={() => Linking.openURL(`tel:${order.delivery!.partner!.phone}`)}
              >
                <Text style={st.callBtnText}>📞 Call</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {/* ── STATUS TIMELINE ─────────────────────────────────────────────── */}
        <View style={st.timelineCard}>
          <Text style={st.sectionLabel}>Order Status</Text>
          {STATUS_STEPS.map((step, i) => {
            const isDone = i <= stepIdx;
            const isCurrent = i === stepIdx;
            if (order.status === 'CANCELLED' && step.key !== 'PLACED') {
              if (step.key === 'CONFIRMED') {
                return (
                  <View key="cancelled" style={st.timelineRow}>
                    <View style={[st.dot, { backgroundColor: '#F5C116' }]} />
                    <View style={st.timelineText}>
                      <Text style={[st.timelineLabel, { color: '#F5C116', fontWeight: '800' }]}>❌ Cancelled</Text>
                    </View>
                  </View>
                );
              }
              return null;
            }
            return (
              <View key={step.key} style={st.timelineRow}>
                {i < STATUS_STEPS.length - 1 && (
                  <View style={[st.timelineLine, isDone && st.timelineLineDone]} />
                )}
                <View style={[st.dot, isDone && st.dotDone, (isCurrent && order.status !== 'DELIVERED') && st.dotCurrent]} />
                <View style={st.timelineText}>
                  <Text style={[st.timelineLabel, isDone && st.timelineLabelDone]}>
                    {step.icon} {step.label}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ── ORDER SUMMARY ───────────────────────────────────────────────── */}
        <View style={st.summaryCard}>
          <Text style={st.sectionLabel}>Order Summary</Text>
          {order.items.map((item, i) => (
            <View key={i} style={st.summaryRow}>
              <Text style={st.summaryItemName}>{item.name}</Text>
              <Text style={st.summaryItemQty}>×{item.quantity}</Text>
            </View>
          ))}
          <View style={st.totalRow}>
            <Text style={st.totalLabel}>Total</Text>
            <Text style={st.totalValue}>₹{order.pricing?.grandTotal ?? order.pricing?.itemsTotal ?? 0}</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFBF0' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14,
    backgroundColor: '#FAE08B', borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center',
  },
  backIcon: { fontSize: 18, color: '#111', fontWeight: '700' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#111' },
  headerSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  etaBadge: {
    backgroundColor: '#F5C116', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6,
    alignItems: 'center',
  },
  etaNum: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  etaLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '600' },

  // Map
  mapWrap: {
    height: 320,
    marginHorizontal: 10,
    marginVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
    position: 'relative',
  },
  map: { ...StyleSheet.absoluteFill },
  scooterMarker: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  pinMarker: {
    backgroundColor: '#FAE08B', borderRadius: 20, padding: 4,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  mapOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center', alignItems: 'center',
  },
  mapOverlayText: { color: '#6B7280', fontSize: 13, fontWeight: '600' },

  // OTP
  otpCard: {
    margin: 14, backgroundColor: '#FAE08B', borderRadius: 16, padding: 18,
    borderWidth: 1.5, borderColor: '#F5C116', borderStyle: 'dashed',
  },
  otpHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  otpLabel: { fontSize: 14, fontWeight: '800', color: '#111' },
  otpHint: { fontSize: 11, color: '#9CA3AF' },
  otpDigits: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  otpBox: {
    width: 44, height: 52, borderRadius: 10,
    backgroundColor: '#FEF2F2', borderWidth: 1.5, borderColor: '#FECACA',
    justifyContent: 'center', alignItems: 'center',
  },
  otpDigit: { fontSize: 22, fontWeight: '900', color: '#F5C116' },

  // Partner Info
  partnerCard: {
    margin: 14, backgroundColor: '#FAE08B', borderRadius: 16, padding: 18,
    flexDirection: 'row', alignItems: 'center'
  },
  partnerInfo: { flex: 1 },
  partnerLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  partnerName: { fontSize: 16, fontWeight: '800', color: '#111', marginBottom: 2 },
  partnerVehicle: { fontSize: 13, color: '#6B7280' },
  callBtn: { backgroundColor: '#e0f2fe', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, marginLeft: 10 },
  callBtnText: { color: '#0284c7', fontWeight: '700', fontSize: 13 },

  // Timeline
  timelineCard: {
    margin: 14, backgroundColor: '#FAE08B', borderRadius: 16, padding: 18,
  },
  sectionLabel: { fontSize: 14, fontWeight: '800', color: '#111', marginBottom: 16 },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, position: 'relative' },
  timelineLine: {
    position: 'absolute', left: 7, top: 18, width: 2, height: 24,
    backgroundColor: '#E5E7EB',
  },
  timelineLineDone: { backgroundColor: '#F5C116' },
  dot: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#E5E7EB', borderWidth: 2, borderColor: '#E5E7EB',
  },
  dotDone: { backgroundColor: '#F5C116', borderColor: '#F5C116' },
  dotCurrent: {
    borderColor: '#F5C116', backgroundColor: '#FAE08B',
    shadowColor: '#F5C116', shadowOpacity: 0.4, shadowRadius: 6, elevation: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  timelineText: { flex: 1 },
  timelineLabel: { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
  timelineLabelDone: { color: '#111', fontWeight: '700' },

  // Summary
  summaryCard: {
    marginHorizontal: 14, backgroundColor: '#FAE08B', borderRadius: 16, padding: 18,
  },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F9FAFB',
  },
  summaryItemName: { fontSize: 13, color: '#374151', flex: 1 },
  summaryItemQty: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 12, marginTop: 4,
  },
  totalLabel: { fontSize: 15, fontWeight: '800', color: '#111' },
  totalValue: { fontSize: 15, fontWeight: '800', color: '#F5C116' },
});


