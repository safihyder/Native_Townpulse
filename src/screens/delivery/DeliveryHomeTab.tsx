import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Linking, Modal, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { theme } from '../../theme/tokens';
import {
  acceptDispatch, completeDelivery, getDispatchFeed, updateLiveLocation,
  markArrivedAtCustomer, markArrivedAtPickup, markPickedUp, rejectDispatch,
  setDeliveryMode,
} from '../../services/deliveryApi';
import LeafletMap from '../../components/LeafletMap';

import messaging from '@react-native-firebase/messaging';
import { appConfig } from '../../config/appConfig';

type Props = { idToken: string; partnerName: string; mode: Mode; setMode: (m: Mode) => void; activeOrder: any; setActiveOrder: (order: any) => void; };
type Mode = 'OFFLINE' | 'ONLINE_AVAILABLE' | 'ONLINE_BUSY' | 'PAUSED';

const STAGE_LABELS: Record<string, string> = {
  ASSIGNED: 'Head to Restaurant',
  TO_PICKUP: 'On the way to pickup',
  AT_PICKUP: 'Arrived at restaurant',
  TO_CUSTOMER: 'On the way to customer',
  AT_CUSTOMER: 'Arrived at customer',
  DELIVERED: 'Delivered ✓',
};

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

export function DeliveryHomeTab({ idToken, partnerName, mode, setMode, activeOrder, setActiveOrder }: Props) {
  const [loading, setLoading] = useState(false);
  const [feed, setFeed] = useState<any[]>([]);
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const locationWatchId = useRef<number | null>(null);
  const [partnerCoords, setPartnerCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // Pulse animation for online indicator
  useEffect(() => {
    if (mode !== 'OFFLINE') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [mode, pulseAnim]);

  // Start GPS watch when partner is online (required for backend dispatch eligibility)
  useEffect(() => {
    if (mode !== 'OFFLINE') {
      // Simulate partner being near the pickup location in Mumbai instead of using real Bihar GPS
      const simulatedPos = { latitude: 19.0540, longitude: 72.8400 };
      setPartnerCoords(simulatedPos);
      // LeafletMap fits itself automatically via fitBounds
      
      // Update backend with simulated location so ETAs work
      updateLiveLocation(idToken, simulatedPos.latitude, simulatedPos.longitude, 0).catch(() => {});

      locationWatchId.current = setInterval(() => {
         updateLiveLocation(idToken, simulatedPos.latitude, simulatedPos.longitude, 0).catch(() => {});
      }, 5000) as any;
    } else {
      if (locationWatchId.current !== null) {
        clearInterval(locationWatchId.current as any);
        locationWatchId.current = null;
      }
    }
    return () => {
      if (locationWatchId.current !== null) {
        clearInterval(locationWatchId.current as any);
        locationWatchId.current = null;
      }
    };
  }, [mode, activeOrder?.orderId, idToken]);




  const fetchFeed = useCallback(async () => {
    if (mode === 'OFFLINE') return;
    try {
      const data = await getDispatchFeed(idToken);
      if (data?.activeOrder && !activeOrder) {
        setActiveOrder(data.activeOrder);
      }
      setFeed(Array.isArray(data?.notifications) ? data.notifications : Array.isArray(data?.orders) ? data.orders : Array.isArray(data) ? data : []);
    } catch { /* silent */ }
  }, [idToken, mode]);

  useEffect(() => {
    fetchFeed();
    const interval = setInterval(fetchFeed, 15000);
    
    // Listen for incoming FCM notifications and instantly refresh feed
    const unsubscribe = messaging().onMessage(async (remoteMessage) => {
       console.log('FCM Received in Foreground (Delivery):', remoteMessage);
       fetchFeed();
    });

    // ── Internal React Native WebSocket Listener ───────────────────────────
    const wsUrl = appConfig.apiBaseUrl.replace(/^http/, 'ws') + '/ws';
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connectWs = () => {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'incoming_dispatch') {
            console.log('WS: Received incoming dispatch! Refreshing feed...');
            fetchFeed();
          }
        } catch {}
      };
      ws.onclose = () => { reconnectTimer = setTimeout(connectWs, 3000); };
      ws.onerror = () => { ws?.close(); };
    };

    if (mode !== 'OFFLINE') connectWs();
    
    return () => {
       clearInterval(interval);
       unsubscribe();
       clearTimeout(reconnectTimer);
       ws?.close();
    };
  }, [fetchFeed, mode]);

  const toggleOnline = async () => {
    const nextMode: Mode = mode === 'OFFLINE' ? 'ONLINE_AVAILABLE' : 'OFFLINE';
    setLoading(true);
    try {
      await setDeliveryMode(idToken, nextMode);
      setMode(nextMode);
      if (nextMode === 'OFFLINE') { setFeed([]); setActiveOrder(null); }
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  };

  const handleAccept = async (orderId: string) => {
    setLoading(true);
    try {
      const res = await acceptDispatch(idToken, orderId);
      const order = { orderId, stage: 'TO_PICKUP', ...res };
      setActiveOrder(order);
      setFeed([]);
      // LeafletMap auto-fits to pickup/dropoff via fitBounds
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  };

  const handleReject = async (orderId: string) => {
    try { await rejectDispatch(idToken, orderId); fetchFeed(); }
    catch (e: any) { Alert.alert('Error', e.message); }
  };

  const handleStageAction = async () => {
    if (!activeOrder) return;
    setLoading(true);
    try {
      const id = activeOrder.orderId;
      const stage = activeOrder.stage || 'ASSIGNED';
      if (stage === 'ASSIGNED' || stage === 'TO_PICKUP') {
        await markArrivedAtPickup(idToken, id);
        setActiveOrder((o: any) => ({ ...o, stage: 'AT_PICKUP' }));
      } else if (stage === 'AT_PICKUP') {
        await markPickedUp(idToken, id);
        setActiveOrder((o: any) => ({ ...o, stage: 'TO_CUSTOMER' }));
      } else if (stage === 'TO_CUSTOMER') {
        await markArrivedAtCustomer(idToken, id);
        setActiveOrder((o: any) => ({ ...o, stage: 'AT_CUSTOMER' }));
      } else if (stage === 'AT_CUSTOMER') {
        setOtpValue('');
        setOtpModalVisible(true);
        setLoading(false);
        return;
      }
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  };

  const isOnline = mode !== 'OFFLINE';

  // ─── ACTIVE ORDER: Full-screen Map Dashboard ─────────────────────────────────
  if (activeOrder) {
    const stage = activeOrder.stage || 'ASSIGNED';
    const isHeadingToCustomer = stage === 'TO_CUSTOMER' || stage === 'AT_CUSTOMER';

    // Before pickup: show restaurant as destination
    // After pickup: show customer address as destination
    const destination = isHeadingToCustomer
      ? activeOrder?.fulfillment?.address?.coordinates              // customer address
      : activeOrder?.fulfillment?.pickup?.coordinates;              // restaurant

    const stages = ['ASSIGNED', 'TO_PICKUP', 'AT_PICKUP', 'TO_CUSTOMER', 'AT_CUSTOMER'];
    const currentStageIdx = stages.indexOf(activeOrder.stage);

    return (
      <View style={{ flex: 1 }}>
        {/* Full-screen Leaflet Map */}
        <LeafletMap
          tileUrl={`https://api.olamaps.io/tiles/v1/styles/default-light-standard/{z}/{x}/{y}.png?api_key=W7wiwv4l2zbS091tTWFMriVUlkx4VE8A6izkx25d`}
          partnerCoords={partnerCoords}
          pickupCoords={activeOrder?.fulfillment?.pickup?.coordinates} // Restaurant pin
          dropoffCoords={isHeadingToCustomer ? activeOrder?.fulfillment?.address?.coordinates : undefined} // Customer pin
          routeOrigin={partnerCoords ? { lat: partnerCoords.latitude, lng: partnerCoords.longitude } : activeOrder?.fulfillment?.pickup?.coordinates} // Route origin: Delivery boy
          routeDestination={destination} // Route destination: Restaurant OR Customer
          polylinePoints={[]} // Force live fetch for exact road path
        />

        {/* LIVE badge top-left */}
        <View style={mapStyles.liveBadge}>
          <View style={mapStyles.liveDot} />
          <Text style={mapStyles.liveBadgeText}>LIVE</Text>
        </View>

        {/* Bottom Sheet */}
        <View style={mapStyles.bottomSheet}>
          <View style={mapStyles.sheetHandle} />

          <View style={mapStyles.orderHeader}>
            <Text style={mapStyles.orderTag}>ACTIVE ORDER</Text>
            <Text style={mapStyles.orderId}>{activeOrder.orderId}</Text>
          </View>

          {/* Stage progress dots */}
          <View style={mapStyles.stageRow}>
            {['TO_PICKUP', 'AT_PICKUP', 'TO_CUSTOMER', 'AT_CUSTOMER'].map((s, i) => {
              const stepIdx = i + 1;
              const isDone = currentStageIdx > stepIdx;
              const isActive = currentStageIdx === stepIdx || (i === 0 && currentStageIdx <= 1);
              return (
                <View key={s} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={[mapStyles.stageDot, isActive && mapStyles.stageDotActive, isDone && mapStyles.stageDotDone]} />
                  {i < 3 && <View style={[mapStyles.stageLine, isDone && mapStyles.stageLineDone]} />}
                </View>
              );
            })}
          </View>

          <Text style={mapStyles.stageLabel}>{STAGE_LABELS[activeOrder.stage] ?? activeOrder.stage}</Text>

          {/* ETA chips */}
          {(activeOrder.delivery?.routePreview?.etaMinutes || activeOrder.delivery?.routePreview?.roadDistanceKm) ? (
            <View style={mapStyles.etaRow}>
              {activeOrder.delivery?.routePreview?.etaMinutes ? (
                <View style={mapStyles.etaChip}>
                  <Text style={mapStyles.etaText}>⏱ {activeOrder.delivery.routePreview.etaMinutes} min</Text>
                </View>
              ) : null}

              {activeOrder.delivery?.routePreview?.roadDistanceKm ? (
                <View style={mapStyles.etaChip}>
                  <Text style={mapStyles.etaText}>📍 {Number(activeOrder.delivery.routePreview.roadDistanceKm).toFixed(1)} km</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Customer Info */}
          {activeOrder.customer && (
            <View style={mapStyles.customerCard}>
              <View style={mapStyles.customerInfo}>
                <Text style={mapStyles.customerName}>{activeOrder.customer?.name || 'Customer'}</Text>
                <Text style={mapStyles.customerAddress}>{activeOrder.fulfillment?.address?.street || activeOrder.fulfillment?.address?.city || 'No address provided'}</Text>
              </View>
              {activeOrder.customer?.phone ? (
                <TouchableOpacity 
                  style={mapStyles.callBtn}
                  onPress={() => Linking.openURL(`tel:${activeOrder.customer.phone}`)}
                >
                  <Text style={mapStyles.callBtnText}>📞 Call</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          <TouchableOpacity style={mapStyles.actionBtn} onPress={handleStageAction} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : (
              <Text style={mapStyles.actionBtnText}>
                {activeOrder.stage === 'AT_CUSTOMER' ? '✅ Complete Delivery (OTP)' : '➡️ Next Step'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* OTP Modal */}
        <Modal visible={otpModalVisible} transparent animationType="slide">
          <View style={mapStyles.otpOverlay}>
            <View style={mapStyles.otpCard}>
              <Text style={mapStyles.otpTitle}>Enter Delivery OTP</Text>
              <Text style={mapStyles.otpSubtitle}>Ask the customer for the 6-digit OTP</Text>
              <TextInput
                style={mapStyles.otpInput}
                placeholder="Enter OTP"
                placeholderTextColor="#999"
                keyboardType="number-pad"
                maxLength={6}
                value={otpValue}
                onChangeText={setOtpValue}
                autoFocus
              />
              <View style={mapStyles.otpBtnRow}>
                <TouchableOpacity
                  style={[mapStyles.otpBtn, mapStyles.otpBtnCancel]}
                  onPress={() => setOtpModalVisible(false)}
                >
                  <Text style={mapStyles.otpBtnCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[mapStyles.otpBtn, mapStyles.otpBtnSubmit]}
                  disabled={loading || otpValue.length < 4}
                  onPress={async () => {
                    setLoading(true);
                    try {
                      const res = await completeDelivery(idToken, activeOrder.orderId, otpValue);
                      setOtpModalVisible(false);
                      Alert.alert('🎉 Delivered!', `Commission ₹${res.walletCredit?.amount ?? 0} credited.`);
                      setActiveOrder(null);
                      setMode('ONLINE_AVAILABLE');
                    } catch (err: any) {
                      Alert.alert('Invalid OTP', err.message);
                    } finally { setLoading(false); }
                  }}
                >
                  {loading ? <ActivityIndicator color="#fff" size="small" /> : (
                    <Text style={mapStyles.otpBtnSubmitText}>Verify & Complete</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ─── DEFAULT HOME TAB ────────────────────────────────────────────────────────
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {partnerName.split(' ')[0]} 👋</Text>
          <Text style={styles.subGreeting}>{isOnline ? 'You are online & earning' : 'Go online to start earning'}</Text>
        </View>
        <TouchableOpacity style={[styles.toggleBtn, isOnline && styles.toggleBtnOn]} onPress={toggleOnline} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" size="small" /> : (
            <View style={styles.toggleInner}>
              <Animated.View style={[styles.toggleDot, { transform: [{ scale: pulseAnim }] }]} />
              <Text style={styles.toggleLabel}>{isOnline ? 'ONLINE' : 'OFFLINE'}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Status Banner */}
      <View style={[styles.statusBanner, isOnline ? styles.statusBannerOn : styles.statusBannerOff]}>
        <Text style={styles.statusBannerText}>
          {isOnline ? '🟢 Looking for orders near you...' : '🔴 You are offline. Toggle to go online.'}
        </Text>
      </View>

      {/* Dispatch Feed */}
      {!activeOrder && isOnline && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nearby Orders</Text>
          {feed.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyText}>Waiting for orders...</Text>
            </View>
          ) : (
            feed.map((item: any, idx: number) => (
              <View key={idx} style={styles.feedCard}>
                <View style={styles.feedCardLeft}>
                  <Text style={styles.feedOrderId}>{item.orderId}</Text>
                  <Text style={styles.feedMeta}>📍 {item.roadDistanceKm ?? item.distanceKm ?? '--'} km away</Text>
                  <Text style={styles.feedMeta}>⏱ ETA {item.etaMinutes ?? '--'} min</Text>
                  <Text style={styles.feedAmount}>₹{item.grandTotal ?? '--'}</Text>
                </View>
                <View style={styles.feedCardActions}>
                  <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(item.orderId)}>
                    <Text style={styles.acceptBtnText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(item.orderId)}>
                    <Text style={styles.rejectBtnText}>Skip</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.brandCanvas },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: theme.spacing.lg, paddingTop: theme.spacing.xl },
  greeting: { fontSize: theme.typography.h2, fontWeight: '700', color: theme.colors.ink900 },
  subGreeting: { fontSize: theme.typography.small, color: theme.colors.ink500, marginTop: 2 },
  toggleBtn: { backgroundColor: theme.colors.ink500, borderRadius: theme.radius.pill, paddingVertical: 10, paddingHorizontal: 18 },
  toggleBtnOn: { backgroundColor: theme.colors.success },
  toggleInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FAE08B' },
  toggleLabel: { color: '#fff', fontWeight: '700', fontSize: 13 },
  statusBanner: { marginHorizontal: theme.spacing.lg, borderRadius: theme.radius.sm, padding: 12, marginBottom: theme.spacing.sm },
  statusBannerOn: { backgroundColor: '#dcfce7' },
  statusBannerOff: { backgroundColor: '#fee2e2' },
  statusBannerText: { fontSize: theme.typography.small, fontWeight: '600', color: theme.colors.ink700 },
  section: { paddingHorizontal: theme.spacing.lg },
  sectionTitle: { fontSize: theme.typography.h2, fontWeight: '700', color: theme.colors.ink900, marginBottom: 12 },
  emptyCard: { alignItems: 'center', paddingVertical: 40, backgroundColor: '#FAE08B', borderRadius: theme.radius.md },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: theme.colors.ink500, marginTop: 8, fontSize: theme.typography.body },
  feedCard: { backgroundColor: '#FAE08B', borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', ...theme.shadow.card },
  feedCardLeft: { flex: 1 },
  feedOrderId: { fontSize: theme.typography.body, fontWeight: '700', color: theme.colors.ink900 },
  feedMeta: { fontSize: theme.typography.small, color: theme.colors.ink500, marginTop: 2 },
  feedAmount: { fontSize: 18, fontWeight: '800', color: theme.colors.brandPrimary, marginTop: 6 },
  feedCardActions: { justifyContent: 'center', gap: 8 },
  acceptBtn: { backgroundColor: theme.colors.brandPrimary, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  acceptBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  rejectBtn: { borderWidth: 1, borderColor: theme.colors.ink500, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  rejectBtnText: { color: theme.colors.ink500, fontWeight: '600', fontSize: 13 },
});

const mapStyles = StyleSheet.create({
  liveBadge: {
    position: 'absolute',
    top: 54,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  liveBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FAE08B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    elevation: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    alignSelf: 'center',
    marginBottom: 16,
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  orderTag: {
    backgroundColor: theme.colors.brandPrimary,
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  orderId: { fontSize: 13, color: theme.colors.ink500, fontWeight: '600' },
  stageRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  stageDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#e5e7eb',
    borderWidth: 2,
    borderColor: '#d1d5db',
  },
  stageDotActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  stageDotDone: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
  stageLine: { flex: 1, height: 3, backgroundColor: '#e5e7eb' },
  stageLineDone: { backgroundColor: '#22c55e' },
  stageLabel: {
    fontSize: theme.typography.body,
    fontWeight: '700',
    color: theme.colors.ink700,
    textAlign: 'center',
    marginBottom: 10,
  },
  etaRow: { flexDirection: 'row', gap: 10, justifyContent: 'center', marginBottom: 14 },
  etaChip: {
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  etaText: { fontSize: 13, fontWeight: '600', color: theme.colors.ink700 },
  actionBtn: {
    backgroundColor: theme.colors.brandPrimary,
    borderRadius: theme.radius.sm,
    padding: 16,
    alignItems: 'center',
  },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: theme.typography.body },
  otpOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  otpCard: { backgroundColor: '#FAE08B', borderRadius: 16, padding: 24, width: '85%', elevation: 10 },
  otpTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.ink900, textAlign: 'center', marginBottom: 4 },
  otpSubtitle: { fontSize: 13, color: theme.colors.ink500, textAlign: 'center', marginBottom: 16 },
  otpInput: { borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, fontSize: 22, textAlign: 'center', letterSpacing: 8, fontWeight: '700', color: theme.colors.ink900, marginBottom: 20 },
  otpBtnRow: { flexDirection: 'row', gap: 12 },
  otpBtn: { flex: 1, borderRadius: 10, padding: 14, alignItems: 'center' },
  otpBtnCancel: { backgroundColor: '#f3f4f6' },
  otpBtnCancelText: { color: theme.colors.ink700, fontWeight: '600', fontSize: 15 },
  otpBtnSubmit: { backgroundColor: theme.colors.brandPrimary },
  otpBtnSubmitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  customerCard: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center' },
  customerInfo: { flex: 1 },
  customerName: { fontSize: 15, fontWeight: '700', color: theme.colors.ink900, marginBottom: 4 },
  customerAddress: { fontSize: 13, color: theme.colors.ink700 },
  callBtn: { backgroundColor: '#e0f2fe', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, marginLeft: 10 },
  callBtnText: { color: '#0284c7', fontWeight: '700', fontSize: 13 },
});

