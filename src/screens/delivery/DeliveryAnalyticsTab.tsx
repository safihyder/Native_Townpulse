import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getMyAnalytics } from '../../services/deliveryApi';
import { MoneyIcon, WalletIcon, BankIcon, ScooterIcon, ClockIcon, LocationPinIcon } from '../../components/SvgIcons';

type Props = { idToken: string };

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, color ? { color } : {}]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

function TripRow({ trip, index }: { trip: any; index: number }) {
  const mins = trip.durationSeconds ? Math.floor(trip.durationSeconds / 60) : null;
  const secs = trip.durationSeconds ? trip.durationSeconds % 60 : null;
  const km = trip.distanceMeters ? (trip.distanceMeters / 1000).toFixed(1) : null;
  return (
    <View style={styles.tripRow}>
      <View style={styles.tripIndex}>
        <Text style={styles.tripIndexText}>#{index + 1}</Text>
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.tripDate}>
          {trip.deliveredAt ? new Date(trip.deliveredAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '--'}
        </Text>
        {mins !== null && <View style={{flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2}}><ClockIcon size={12} color="#9CA3AF" /><Text style={styles.tripMeta}>{mins}m {secs}s</Text></View>}
        {km && <View style={{flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2}}><LocationPinIcon size={12} color="#9CA3AF" /><Text style={styles.tripMeta}>{km} km</Text></View>}
      </View>
    </View>
  );
}

export function DeliveryAnalyticsTab({ idToken }: Props) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await getMyAnalytics(idToken);
        setAnalytics(res.analytics || {});
        setTrips(res.recentTrips || []);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [idToken]);

  if (loading) return <View style={styles.center}><ActivityIndicator color="#F5A623" size="large" /></View>;

  const a = analytics || {};

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      <Text style={styles.pageTitle}>Analytics</Text>

      {/* Total Distance & Earnings — Hero Stat */}
      <View style={[styles.heroCard, { backgroundColor: '#10B981', marginBottom: 16 }]}>
        <Text style={styles.heroLabel}>Total Distance Travelled</Text>
        <Text style={styles.heroValue}>{a.totalDistanceKm ?? 0} km</Text>
        <Text style={styles.heroSub}>
          Total Earnings: ₹{a.totalEarnings ?? 0} ({a.totalDistanceKm ?? 0} km × ₹{a.perKmRate}/km)
        </Text>
      </View>

      {/* Avg Delivery Time — Hero Stat */}
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>Avg. Delivery Time</Text>
        <Text style={styles.heroValue}>{a.avgDeliveryFormatted ?? '--'}</Text>
        <Text style={styles.heroSub}>Calculated from {a.totalDeliveries ?? 0} deliveries</Text>
      </View>

      {/* Grid Stats */}
      <View style={styles.statsGrid}>
        <StatCard label="Total Deliveries" value={String(a.totalDeliveries ?? 0)} />
        <StatCard label="Online Orders" value={String(a.totalOnlineOrders ?? 0)} />
        <StatCard label="COD Orders" value={String(a.totalCODOrders ?? 0)} />
        <StatCard label="Total Earnings" value={`₹${Number(a.totalEarnings ?? 0).toFixed(0)}`} color="#22C55E" />
      </View>

      {/* Cash Tracking */}
      <View style={styles.cashTrackCard}>
        <View style={styles.cashTrackRow}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
            <MoneyIcon size={18} color="#6B7280" />
            <Text style={styles.cashTrackLabel}>Total Cash Collected</Text>
          </View>
          <Text style={styles.cashTrackValue}>{`₹${Number(a.totalCashCollected ?? 0).toFixed(2)}`}</Text>
        </View>
        <View style={styles.cashTrackRow}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
            <WalletIcon size={18} color="#6B7280" />
            <Text style={styles.cashTrackLabel}>Current Cash in Hand</Text>
          </View>
          <Text style={[styles.cashTrackValue, { color: '#2563EB' }]}>{`₹${Number(a.currentCashInHand ?? 0).toFixed(2)}`}</Text>
        </View>
        <View style={[styles.cashTrackRow, { borderBottomWidth: 0 }]}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
            <BankIcon size={18} color="#6B7280" />
            <Text style={styles.cashTrackLabel}>Earnings Balance</Text>
          </View>
          <Text style={[styles.cashTrackValue, { color: '#22C55E' }]}>{`₹${Number(a.currentEarningsBalance ?? 0).toFixed(2)}`}</Text>
        </View>
      </View>

      {/* Recent Trips */}
      <Text style={styles.sectionTitle}>Recent Trips</Text>
      {trips.length === 0 ? (
        <View style={styles.emptyBox}>
          <ScooterIcon size={40} color="#9CA3AF" />
          <Text style={styles.emptyText}>No completed trips yet</Text>
        </View>
      ) : (
        <View style={styles.tripList}>
          {trips.map((t: any, i: number) => <TripRow key={t.tripId || t.id || i} trip={t} index={i} />)}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pageTitle: { fontSize: 28, fontWeight: '900', color: '#1C2434', marginHorizontal: 20, marginTop: 20, marginBottom: 16 },

  heroCard: {
    marginHorizontal: 20, borderRadius: 16, backgroundColor: '#F5A623',
    padding: 28, marginBottom: 20, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
    shadowOffset: { width: 0, height: 4 },
  },
  heroLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  heroValue: { color: '#fff', fontSize: 42, fontWeight: '900', letterSpacing: 1 },
  heroSub: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 6 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, marginBottom: 16 },
  statCard: {
    width: '46%', margin: '2%', backgroundColor: '#FFFFFF', borderRadius: 12,
    padding: 14, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 2,
    shadowOffset: { width: 0, height: 2 },
  },
  statValue: { fontSize: 20, fontWeight: '900', color: '#1C2434' },
  statLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '600', textAlign: 'center', marginTop: 4 },
  statSub: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },

  cashTrackCard: {
    marginHorizontal: 20, backgroundColor: '#FFFFFF', borderRadius: 16,
    padding: 20, marginBottom: 24,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 2,
    shadowOffset: { width: 0, height: 2 },
  },
  cashTrackRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  cashTrackLabel: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  cashTrackValue: { fontSize: 16, fontWeight: '800', color: '#1C2434' },

  sectionTitle: { fontSize: 20, fontWeight: '900', color: '#1C2434', marginHorizontal: 20, marginBottom: 12 },

  tripList: {
    backgroundColor: '#FFFFFF', marginHorizontal: 20, borderRadius: 16,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 2,
    shadowOffset: { width: 0, height: 2 }, overflow: 'hidden',
  },
  tripRow: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  tripIndex: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: '#FEF3C7',
    justifyContent: 'center', alignItems: 'center',
  },
  tripIndexText: { fontSize: 11, fontWeight: '800', color: '#F5A623' },
  tripDate: { fontSize: 14, fontWeight: '700', color: '#1C2434' },
  tripMeta: { fontSize: 12, color: '#9CA3AF' },

  emptyBox: {
    alignItems: 'center', paddingVertical: 48, marginHorizontal: 20,
    backgroundColor: '#F9FAFB', borderRadius: 16,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  emptyIcon: { fontSize: 40 },
  emptyText: { color: '#9CA3AF', marginTop: 8, fontSize: 15, fontWeight: '500' },
});
