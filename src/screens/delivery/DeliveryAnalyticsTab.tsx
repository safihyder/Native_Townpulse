import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme/tokens';
import { getMyAnalytics } from '../../services/deliveryApi';

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
        {mins !== null && <Text style={styles.tripMeta}>⏱ {mins}m {secs}s</Text>}
        {km && <Text style={styles.tripMeta}>📍 {km} km</Text>}
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

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.brandPrimary} size="large" /></View>;

  const a = analytics || {};

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      <Text style={styles.pageTitle}>Analytics</Text>

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
        <StatCard label="Total Earnings" value={`₹${Number(a.totalEarnings ?? 0).toFixed(0)}`} color={theme.colors.success} />
        <StatCard label="Online Commission" value={`₹${Number(a.totalOnlineCommission ?? 0).toFixed(0)}`} />
        <StatCard label="COD Commission" value={`₹${Number(a.totalCODCommission ?? 0).toFixed(0)}`} />
      </View>

      {/* Cash Tracking */}
      <View style={styles.cashTrackCard}>
        <View style={styles.cashTrackRow}>
          <Text style={styles.cashTrackLabel}>💵 Total Cash Collected</Text>
          <Text style={styles.cashTrackValue}>{`₹${Number(a.totalCashCollected ?? 0).toFixed(2)}`}</Text>
        </View>
        <View style={styles.cashTrackRow}>
          <Text style={styles.cashTrackLabel}>💰 Current Cash in Hand</Text>
          <Text style={[styles.cashTrackValue, { color: '#1e40af' }]}>{`₹${Number(a.currentCashInHand ?? 0).toFixed(2)}`}</Text>
        </View>
        <View style={styles.cashTrackRow}>
          <Text style={styles.cashTrackLabel}>🏦 Earnings Balance</Text>
          <Text style={[styles.cashTrackValue, { color: theme.colors.success }]}>{`₹${Number(a.currentEarningsBalance ?? 0).toFixed(2)}`}</Text>
        </View>
      </View>

      {/* Recent Trips */}
      <Text style={styles.sectionTitle}>Recent Trips</Text>
      {trips.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>🛵</Text>
          <Text style={styles.emptyText}>No completed trips yet</Text>
        </View>
      ) : (
        <View style={styles.tripList}>
          {trips.map((t: any, i: number) => <TripRow key={t.tripId} trip={t} index={i} />)}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.brandCanvas },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pageTitle: { fontSize: theme.typography.h1, fontWeight: '800', color: theme.colors.ink900, margin: theme.spacing.lg, marginBottom: theme.spacing.sm },
  heroCard: { marginHorizontal: theme.spacing.lg, borderRadius: theme.radius.md, backgroundColor: theme.colors.brandPrimary, padding: theme.spacing.xl, marginBottom: theme.spacing.md, alignItems: 'center', ...theme.shadow.card },
  heroLabel: { color: 'rgba(255,255,255,0.8)', fontSize: theme.typography.small, fontWeight: '600', marginBottom: 6 },
  heroValue: { color: '#fff', fontSize: 40, fontWeight: '900', letterSpacing: 1 },
  heroSub: { color: 'rgba(255,255,255,0.65)', fontSize: theme.typography.micro, marginTop: 6 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: theme.spacing.md, marginBottom: theme.spacing.md },
  statCard: { width: '30%', margin: '1.5%', backgroundColor: '#FAE08B', borderRadius: theme.radius.sm, padding: theme.spacing.sm, alignItems: 'center', ...theme.shadow.card },
  statValue: { fontSize: 20, fontWeight: '800', color: theme.colors.ink900 },
  statLabel: { fontSize: 10, color: theme.colors.ink500, fontWeight: '600', textAlign: 'center', marginTop: 4 },
  statSub: { fontSize: theme.typography.micro, color: theme.colors.ink500, marginTop: 2 },
  cashTrackCard: { marginHorizontal: theme.spacing.lg, backgroundColor: '#FAE08B', borderRadius: theme.radius.md, padding: theme.spacing.lg, ...theme.shadow.card, marginBottom: theme.spacing.lg },
  cashTrackRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  cashTrackLabel: { fontSize: theme.typography.small, color: theme.colors.ink700, fontWeight: '500' },
  cashTrackValue: { fontSize: theme.typography.body, fontWeight: '800', color: theme.colors.ink900 },
  sectionTitle: { fontSize: theme.typography.h2, fontWeight: '700', color: theme.colors.ink900, marginHorizontal: theme.spacing.lg, marginBottom: 10 },
  tripList: { backgroundColor: '#FAE08B', marginHorizontal: theme.spacing.lg, borderRadius: theme.radius.md, ...theme.shadow.card, overflow: 'hidden' },
  tripRow: { flexDirection: 'row', alignItems: 'center', padding: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  tripIndex: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.brandPrimarySoft, justifyContent: 'center', alignItems: 'center' },
  tripIndexText: { fontSize: 11, fontWeight: '700', color: theme.colors.brandPrimary },
  tripDate: { fontSize: theme.typography.small, fontWeight: '600', color: theme.colors.ink900 },
  tripMeta: { fontSize: theme.typography.micro, color: theme.colors.ink500, marginTop: 2 },
  emptyBox: { alignItems: 'center', padding: 40, marginHorizontal: theme.spacing.lg, backgroundColor: '#FAE08B', borderRadius: theme.radius.md },
  emptyIcon: { fontSize: 40 },
  emptyText: { color: theme.colors.ink500, marginTop: 8 },
});

