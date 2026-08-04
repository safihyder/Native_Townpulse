import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Linking, Modal, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View, Image, Vibration, Platform
} from 'react-native';
import { useToast } from '../../context/ToastContext';
import {
  acceptDispatch, completeDelivery, getDispatchFeed, updateLiveLocation,
  markArrivedAtCustomer, markArrivedAtPickup, markPickedUp, rejectDispatch,
  setDeliveryMode,
} from '../../services/deliveryApi';
import {
  requestLocationPermission, checkLocationServicesEnabled, watchCurrentPosition,
} from '../../services/locationService';
import { getFcmToken } from '../../services/notificationService';
import Geolocation from '@react-native-community/geolocation';
import LeafletMap from '../../components/LeafletMap';

import messaging from '@react-native-firebase/messaging';
import { appConfig } from '../../config/appConfig';
import { WarningIcon, PackageIcon, ClockIcon, LocationPinIcon, PhoneIcon, CheckCircleIcon, ArrowRightCircleIcon } from '../../components/SvgIcons';

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
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const openGpsSettings = () => {
    if (Platform.OS === 'android') {
      Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(() => Linking.openSettings());
    } else {
      Linking.openSettings();
    }
  };
  const [feed, setFeed] = useState<any[]>([]);
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationRetry, setLocationRetry] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const [partnerCoords, setPartnerCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [partnerHeading, setPartnerHeading] = useState<number>(0);
  const gpsErrorCountRef = useRef(0);

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

  // ─── Real GPS Watch — starts when partner is online ──────────────────────────
  useEffect(() => {
    if (mode === 'OFFLINE') {
      setPartnerCoords(null);
      setLocationError(null);
      return;
    }

    // Start watching real GPS
    const watchId = watchCurrentPosition(
      (coords) => {
        setPartnerCoords({ latitude: coords.latitude, longitude: coords.longitude });
        setPartnerHeading(coords.heading ?? 0);
        setLocationError(null);
        gpsErrorCountRef.current = 0; // Reset on success
        // Send real location to backend
        updateLiveLocation(idToken, coords.latitude, coords.longitude, coords.heading ?? 0).catch(() => { });
      },
      (error) => {
        if (error.code === 2) {
          gpsErrorCountRef.current += 1;
          // Only show GPS error after 3 consecutive failures (debounce transient errors)
          if (gpsErrorCountRef.current >= 3) {
            checkLocationServicesEnabled().then(enabled => {
              if (!enabled) {
                setLocationError('GPS is turned off. Please enable it.');
                // Auto-Offline
                setMode('OFFLINE');
                setDeliveryMode(idToken, 'OFFLINE').catch(()=>{});
                showToast({ type: 'warning', title: 'Offline', body: 'GPS was turned off. You are now offline.' });
                openGpsSettings();
              }
            });
          }
        } else if (error.code === 1) {
          setLocationError('Location permission denied. Please allow precise location.');
          setMode('OFFLINE');
          setDeliveryMode(idToken, 'OFFLINE').catch(()=>{});
          showToast({ type: 'warning', title: 'Offline', body: 'Location permission denied. You are now offline.' });
          Linking.openSettings(); // As requested by user
        } else {
          // ignore transient errors
        }
      },
    );

    return () => {
      Geolocation.clearWatch(watchId);
    };
  }, [mode, idToken, locationRetry]);

  // NOTE: Removed auto Linking.openSettings() — was causing the GPS redirect loop.
  // The GPS Warning Modal already handles prompting the user to fix settings.

  const fetchFeed = useCallback(async () => {
    if (mode === 'OFFLINE') return;
    try {
      const data = await getDispatchFeed(idToken);
      if (data?.activeOrder && !activeOrder) {
        setActiveOrder(data.activeOrder);
      }
      
      const newFeedArray = Array.isArray(data?.notifications) ? data.notifications : Array.isArray(data?.orders) ? data.orders : Array.isArray(data) ? data : [];
      
      // If the feed has more items than before, a new order just came in!
      setFeed(prevFeed => {
        if (newFeedArray.length > prevFeed.length && prevFeed.length > 0) {
          Vibration.vibrate([0, 500, 200, 500]);
          showToast({ type: 'info', title: 'New Order', body: 'A new delivery request just arrived!' });
        } else if (newFeedArray.length === 1 && prevFeed.length === 0 && !activeOrder && mode === 'ONLINE_AVAILABLE') {
          // Edge case: if they just went online and get an order immediately
          Vibration.vibrate([0, 500, 200, 500]);
          showToast({ type: 'info', title: 'New Order', body: 'A new delivery request is waiting!' });
        }
        return newFeedArray;
      });
    } catch { /* silent */ }
  }, [idToken, mode, activeOrder, showToast]);

  useEffect(() => {
    // ── Register FCM Token on Mount ──────────────────────────────
    getFcmToken().then(token => {
      if (token) {
        fetch(`${appConfig.apiBaseUrl}/api/auth/fcm-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ token })
        }).catch(() => {});
      }
    });

    fetchFeed();
    const interval = setInterval(fetchFeed, 15000);

    // Listen for incoming FCM notifications and instantly refresh feed
    const unsubscribe = messaging().onMessage(async (remoteMessage) => {
      console.log('FCM Received in Foreground (Delivery):', remoteMessage);
      Vibration.vibrate([0, 500, 200, 500]);
      showToast({ type: 'info', title: 'New Order', body: 'A new delivery request just arrived!' });
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
            Vibration.vibrate([0, 500, 200, 500]);
            showToast({ type: 'info', title: 'New Order', body: 'A new delivery request just arrived!' });
            fetchFeed();
          }
        } catch { }
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

  // ─── Aggressive GPS Monitor ────────────────────────────────────────────────
  useEffect(() => {
    if (mode === 'OFFLINE') return;

    const gpsCheckInterval = setInterval(async () => {
      const isEnabled = await checkLocationServicesEnabled();
      if (!isEnabled) {
        setLocationError('GPS is turned off. Please enable it.');
        setMode('OFFLINE');
        setDeliveryMode(idToken, 'OFFLINE').catch(() => {});
        showToast({ type: 'warning', title: 'Offline', body: 'GPS was turned off. You are now offline.' });
        openGpsSettings();
      }
    }, 5000);

    return () => clearInterval(gpsCheckInterval);
  }, [mode, idToken, showToast]);

  // ─── Go Online with Permission Gate ──────────────────────────────────────────
  const toggleOnline = async () => {
    if (mode === 'OFFLINE') {
      // STEP 1: Check/request location permission
      const permGranted = await requestLocationPermission();
      if (!permGranted) {
        showToast({ type: 'warning', title: 'Location Permission Required', body: 'TownPulse needs your location to assign you nearby orders.' });
        Linking.openSettings();
        return;
      }

      // STEP 2: Check if device GPS is actually turned ON
      const gpsEnabled = await checkLocationServicesEnabled();
      if (!gpsEnabled) {
        showToast({ type: 'warning', title: 'GPS is Off', body: 'Please turn on your device GPS to go online.' });
        openGpsSettings();
        return;
      }

      // STEP 3: Go online
      setLoading(true);
      try {
        await setDeliveryMode(idToken, 'ONLINE_AVAILABLE');
        setMode('ONLINE_AVAILABLE');
        setLocationError(null);
        gpsErrorCountRef.current = 0;
      } catch (e: any) { showToast({ type: 'error', title: 'Error', body: e.message }); }
      finally { setLoading(false); }
    } else {
      // Going offline
      setLoading(true);
      try {
        await setDeliveryMode(idToken, 'OFFLINE');
        setMode('OFFLINE');
        setFeed([]);
        setActiveOrder(null);
        setLocationError(null);
      } catch (e: any) { showToast({ type: 'error', title: 'Error', body: e.message }); }
      finally { setLoading(false); }
    }
  };

  const handleAccept = async (orderId: string) => {
    setLoading(true);
    try {
      await acceptDispatch(idToken, orderId);
      // Immediately fetch feed to get the activeOrder with populated customer info
      await fetchFeed();
      setFeed([]);
    } catch (e: any) { showToast({ type: 'error', title: 'Error', body: e.message }); }
    finally { setLoading(false); }
  };

  const handleReject = async (orderId: string) => {
    try { await rejectDispatch(idToken, orderId); fetchFeed(); }
    catch (e: any) { showToast({ type: 'error', title: 'Error', body: e.message }); }
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
    } catch (e: any) { showToast({ type: 'error', title: 'Error', body: e.message }); }
    finally { setLoading(false); }
  };

  const isOnline = mode !== 'OFFLINE';

  // ─── ACTIVE ORDER: Full-screen Map Dashboard ─────────────────────────────────
  if (activeOrder) {
    const stage = activeOrder.stage || 'ASSIGNED';
    const isHeadingToCustomer = stage === 'TO_CUSTOMER' || stage === 'AT_CUSTOMER';

    const destination = isHeadingToCustomer
      ? activeOrder?.fulfillment?.address?.coordinates
      : activeOrder?.fulfillment?.pickup?.coordinates;

    const stages = ['ASSIGNED', 'TO_PICKUP', 'AT_PICKUP', 'TO_CUSTOMER', 'AT_CUSTOMER'];
    const currentStageIdx = stages.indexOf(activeOrder.stage);

    return (
      <View style={{ flex: 1 }}>
        {/* Full-screen Leaflet Map */}
        <LeafletMap
          partnerCoords={partnerCoords}
          partnerHeading={partnerHeading}
          pickupCoords={activeOrder?.fulfillment?.pickup?.coordinates}
          dropoffCoords={isHeadingToCustomer ? activeOrder?.fulfillment?.address?.coordinates : undefined}
          routeOrigin={partnerCoords ? { lat: partnerCoords.latitude, lng: partnerCoords.longitude } : activeOrder?.fulfillment?.pickup?.coordinates}
          routeDestination={destination}
          polylinePoints={[]}
        />

        {/* LIVE badge top-left */}
        <View style={mapStyles.liveBadge}>
          <View style={mapStyles.liveDot} />
          <Text style={mapStyles.liveBadgeText}>LIVE</Text>
        </View>

        {/* GPS Warning on map */}
        {locationError && (
          <View style={mapStyles.gpsMapWarning}>
            <WarningIcon size={14} color="#92400E" />
            <Text style={mapStyles.gpsMapWarningText}>{locationError}</Text>
            <TouchableOpacity onPress={() => locationError.includes('turned off') ? openGpsSettings() : Linking.openSettings()}>
              <Text style={mapStyles.gpsMapWarningAction}>Fix →</Text>
            </TouchableOpacity>
          </View>
        )}

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
                  <ClockIcon size={14} color="#374151" />
                  <Text style={mapStyles.etaText}>{activeOrder.delivery.routePreview.etaMinutes} min</Text>
                </View>
              ) : null}

              {activeOrder.delivery?.routePreview?.roadDistanceKm ? (
                <View style={mapStyles.etaChip}>
                  <LocationPinIcon size={14} color="#374151" />
                  <Text style={mapStyles.etaText}>{Number(activeOrder.delivery.routePreview.roadDistanceKm).toFixed(1)} km</Text>
                </View>
              ) : null}

              {activeOrder.estimatedEarnings !== undefined ? (
                <View style={[mapStyles.etaChip, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={[mapStyles.etaText, { color: '#D97706', fontWeight: '800' }]}>₹{activeOrder.estimatedEarnings}</Text>
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
              <View style={{ flexDirection: 'row', gap: 6, marginLeft: 10 }}>
                {/* Google Maps Redirect */}
                <TouchableOpacity
                  style={mapStyles.mapBtn}
                  onPress={() => {
                    if (destination && partnerCoords) {
                      const url = `https://www.google.com/maps/dir/?api=1&origin=${partnerCoords.latitude},${partnerCoords.longitude}&destination=${destination.lat},${destination.lng}&travelmode=driving`;
                      Linking.openURL(url);
                    } else if (destination) {
                      const url = `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&travelmode=driving`;
                      Linking.openURL(url);
                    } else {
                      showToast({ type: 'error', title: 'No Destination', body: 'Coordinates not available for this location.' });
                    }
                  }}
                >
                  <LocationPinIcon size={16} color="#16A34A" />
                </TouchableOpacity>

                {/* Call Customer */}
                <TouchableOpacity
                  style={mapStyles.callBtn}
                  onPress={() => {
                    if (activeOrder.customer?.phone) {
                      Linking.openURL(`tel:${activeOrder.customer.phone}`);
                    } else {
                      showToast({ type: 'error', title: 'No Phone Number', body: 'This customer has not provided a phone number.' });
                    }
                  }}
                >
                  <PhoneIcon size={14} color="#2563EB" />
                  <Text style={mapStyles.callBtnText}>Call</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity style={mapStyles.actionBtn} onPress={handleStageAction} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {activeOrder.stage === 'AT_CUSTOMER' ? <CheckCircleIcon size={20} color="#FFF" /> : <ArrowRightCircleIcon size={20} color="#FFF" />}
                <Text style={mapStyles.actionBtnText}>
                  {activeOrder.stage === 'AT_CUSTOMER' ? 'Complete Delivery (OTP)' : 'Next Step'}
                </Text>
              </View>
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
                placeholderTextColor="#9CA3AF"
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
                      showToast({ type: 'success', title: '🎉 Delivered!', body: `Commission ₹${res.walletCredit?.amount ?? 0} credited.` });
                      setActiveOrder(null);
                      setMode('ONLINE_AVAILABLE');
                    } catch (err: any) {
                      showToast({ type: 'error', title: 'Invalid OTP', body: err.message });
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
          <Text style={styles.greeting}>Hello, {partnerName.split(' ')[0]}</Text>
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

      {/* Forceful GPS Modal */}
      <Modal visible={!!locationError && mode !== 'OFFLINE'} transparent animationType="fade">
        <View style={styles.forceOverlay}>
          <View style={styles.forceContent}>
            <WarningIcon size={48} color="#EF4444" />
            <Text style={styles.forceTitle}>Action Required</Text>
            <Text style={styles.forceText}>{locationError}</Text>
            <Text style={styles.forceSub}>TownPulse requires location access to assign and track orders. Please enable it to continue working.</Text>
            <TouchableOpacity style={styles.forceBtn} onPress={() => {
              Linking.openSettings();
            }} activeOpacity={0.8}>
              <Text style={styles.forceBtnText}>Open Permissions / Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.forceBtn, { backgroundColor: '#DBEAFE', marginBottom: 12 }]} onPress={() => {
              setLocationRetry(r => r + 1);
              setLocationError(null);
            }} activeOpacity={0.8}>
              <Text style={[styles.forceBtnText, { color: '#2563EB' }]}>I've Enabled It (Retry)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.forceBtnSec} onPress={() => {
              setMode('OFFLINE');
              setDeliveryMode(idToken, 'OFFLINE');
              setLocationError(null);
            }}>
              <Text style={styles.forceBtnSecText}>Go Offline</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
              <Image source={require('../../assets/images/waiting_orders.png')} style={styles.emptyImg} resizeMode="contain" />
              <Text style={styles.emptyText}>Waiting for orders...</Text>
            </View>
          ) : (
            feed.map((item: any, idx: number) => (
              <View key={idx} style={styles.feedCard}>
                <View style={styles.feedCardLeft}>
                  <Text style={styles.feedOrderId}>{item.orderId}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <LocationPinIcon size={14} color="#6B7280" />
                    <Text style={styles.feedMeta}>{item.roadDistanceKm ?? item.distanceKm ?? '--'} km away</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <ClockIcon size={14} color="#6B7280" />
                    <Text style={styles.feedMeta}>ETA {item.etaMinutes ?? '--'} min</Text>
                  </View>
                  <Text style={styles.feedAmount}>Earn ₹{item.estimatedEarnings ?? '--'}</Text>
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

// ── Styles — Matching User-Side Clean White/Grey Design ──────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  greeting: { fontSize: 22, fontWeight: '800', color: '#1C2434' },
  subGreeting: { fontSize: 13, color: '#9CA3AF', marginTop: 2, fontWeight: '500' },
  toggleBtn: {
    backgroundColor: '#6B7280', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 18,
  },
  toggleBtnOn: { backgroundColor: '#22C55E' },
  toggleInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF' },
  toggleLabel: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // GPS Warning Banner
  gpsWarningBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 20, marginTop: 12, backgroundColor: '#FEF3C7',
    borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#FDE68A',
  },
  gpsWarningText: { color: '#92400E', fontSize: 13, fontWeight: '600', flex: 1 },
  gpsWarningAction: { color: '#D97706', fontSize: 14, fontWeight: '800', marginLeft: 12 },

  // Status Banner
  statusBanner: { marginHorizontal: 20, borderRadius: 12, padding: 14, marginTop: 12, marginBottom: 12 },
  statusBannerOn: { backgroundColor: '#DCFCE7' },
  statusBannerOff: { backgroundColor: '#FEE2E2' },
  statusBannerText: { fontSize: 13, fontWeight: '600', color: '#374151' },

  section: { paddingHorizontal: 20, marginTop: 8 },
  sectionTitle: { fontSize: 20, fontWeight: '900', color: '#1C2434', marginBottom: 16 },

  emptyCard: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF', borderRadius: 16, padding: 40, borderWidth: 1, borderColor: '#F3F4F6' },
  emptyImg: { width: 160, height: 160, opacity: 0.95, marginBottom: 16 },
  emptyText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },

  feedCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, marginBottom: 12,
    flexDirection: 'row', justifyContent: 'space-between',
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 2,
    shadowOffset: { width: 0, height: 2 },
  },
  feedCardLeft: { flex: 1 },
  feedOrderId: { fontSize: 15, fontWeight: '800', color: '#1C2434' },
  feedMeta: { fontSize: 13, color: '#6B7280', marginTop: 3, fontWeight: '500' },
  feedAmount: { fontSize: 20, fontWeight: '900', color: '#F5A623', marginTop: 8 },
  feedCardActions: { justifyContent: 'center', gap: 8, marginLeft: 16 },
  acceptBtn: { backgroundColor: '#F5A623', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20 },
  acceptBtnText: { color: '#fff', fontWeight: '800', fontSize: 14, textAlign: 'center' },
  rejectBtn: { borderWidth: 1.5, borderColor: '#D1D5DB', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20 },
  rejectBtnText: { color: '#6B7280', fontWeight: '700', fontSize: 14, textAlign: 'center' },

  forceOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  forceContent: { backgroundColor: '#FFF', borderRadius: 24, padding: 28, alignItems: 'center', width: '100%', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  forceTitle: { fontSize: 20, fontWeight: '900', color: '#1C2434', marginTop: 16, marginBottom: 8 },
  forceText: { fontSize: 15, fontWeight: '700', color: '#374151', textAlign: 'center', marginBottom: 6 },
  forceSub: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 24, lineHeight: 18 },
  forceBtn: { backgroundColor: '#F5A623', width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  forceBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  forceBtnSec: { paddingVertical: 10 },
  forceBtnSecText: { color: '#6B7280', fontWeight: '700', fontSize: 14 },
});

// ── Map/Active Order Styles — Clean White Design ─────────────────────────────
const mapStyles = StyleSheet.create({
  liveBadge: {
    position: 'absolute', top: 54, left: 16,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, gap: 6,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  liveBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  // GPS Warning on map
  gpsMapWarning: {
    position: 'absolute', top: 54, right: 16,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FEF3C7', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, gap: 6, borderWidth: 1, borderColor: '#FDE68A',
  },
  gpsMapWarningText: { color: '#92400E', fontSize: 11, fontWeight: '700' },
  gpsMapWarningAction: { color: '#D97706', fontSize: 12, fontWeight: '800' },

  bottomSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 32,
    elevation: 30, shadowColor: '#000', shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12, shadowRadius: 16,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB',
    alignSelf: 'center', marginBottom: 16,
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  orderTag: {
    backgroundColor: '#F5A623', color: '#fff', fontSize: 10, fontWeight: '800',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  orderId: { fontSize: 13, color: '#9CA3AF', fontWeight: '600' },
  stageRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  stageDot: {
    width: 14, height: 14, borderRadius: 7, backgroundColor: '#E5E7EB',
    borderWidth: 2, borderColor: '#D1D5DB',
  },
  stageDotActive: { backgroundColor: '#F5A623', borderColor: '#F5A623' },
  stageDotDone: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
  stageLine: { flex: 1, height: 3, backgroundColor: '#E5E7EB' },
  stageLineDone: { backgroundColor: '#22c55e' },
  stageLabel: {
    fontSize: 16, fontWeight: '800', color: '#1C2434',
    textAlign: 'center', marginBottom: 10,
  },
  etaRow: { flexDirection: 'row', gap: 10, justifyContent: 'center', marginBottom: 14 },
  etaChip: {
    backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  etaText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  actionBtn: {
    backgroundColor: '#F5A623', borderRadius: 12, padding: 16, alignItems: 'center',
  },
  actionBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  otpOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  otpCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 28, width: '85%',
    elevation: 10, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  otpTitle: { fontSize: 20, fontWeight: '900', color: '#1C2434', textAlign: 'center', marginBottom: 4 },
  otpSubtitle: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginBottom: 20 },
  otpInput: {
    borderWidth: 2, borderColor: '#E5E7EB', borderRadius: 12, padding: 14,
    fontSize: 24, textAlign: 'center', letterSpacing: 8, fontWeight: '800',
    color: '#1C2434', marginBottom: 20, backgroundColor: '#F9FAFB',
  },
  otpBtnRow: { flexDirection: 'row', gap: 12 },
  otpBtn: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  otpBtnCancel: { backgroundColor: '#F3F4F6' },
  otpBtnCancelText: { color: '#374151', fontWeight: '700', fontSize: 15 },
  otpBtnSubmit: { backgroundColor: '#F5A623' },
  otpBtnSubmitText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  customerCard: {
    backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 16,
    flexDirection: 'row', alignItems: 'center',
  },
  customerInfo: { flex: 1 },
  customerName: { fontSize: 15, fontWeight: '800', color: '#1C2434', marginBottom: 4 },
  customerAddress: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  mapBtn: { backgroundColor: '#DCFCE7', width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  callBtn: { backgroundColor: '#DBEAFE', paddingHorizontal: 16, height: 36, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  callBtnText: { color: '#2563EB', fontWeight: '700', fontSize: 13 },
});
