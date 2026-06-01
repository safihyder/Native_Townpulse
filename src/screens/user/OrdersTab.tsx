/**
 * OrdersTab.tsx — Order history list for user dashboard
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import Share from 'react-native-share';
import { appConfig } from '../../config/appConfig';
import { generateInvoicePdf, InvoiceOrderData } from '../../utils/InvoiceGenerator';

// ── Types ──────────────────────────────────────────────────────────────────────
interface OrderItem {
  name: string;
  quantity: number;
}
interface OrderDoc {
  _id: string;
  orderId: string;
  status: string;
  items: OrderItem[];
  pricing: {
    itemsTotal?: number;
    grandTotal?: number;
  };
  payment: {
    mode: string;
    status: string;
  };
  delivery?: {
    otpCode?: string;
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
  hasRated?: boolean;
  createdAt: string;
}

type Props = {
  idToken: string;
  onOpenTracking: (order: OrderDoc) => void;
  onOpenReview: (order: OrderDoc) => void;
};

const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  PLACED:             { bg: '#FEF3C7', fg: '#92400E' },
  CONFIRMED:          { bg: '#DBEAFE', fg: '#1E40AF' },
  PREPARING:          { bg: '#FDE68A', fg: '#78350F' },
  READY_FOR_PICKUP:   { bg: '#D1FAE5', fg: '#065F46' },
  OUT_FOR_DELIVERY:   { bg: '#E0E7FF', fg: '#3730A3' },
  DELIVERED:          { bg: '#DCFCE7', fg: '#166534' },
  CANCELLED:          { bg: '#FEE2E2', fg: '#D4A510' },
};

const STATUS_ICON: Record<string, string> = {
  PLACED: '📝',
  CONFIRMED: '✅',
  PREPARING: '🍳',
  READY_FOR_PICKUP: '📦',
  OUT_FOR_DELIVERY: '🛵',
  DELIVERED: '🎉',
  CANCELLED: '❌',
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const day = d.getDate();
  const mon = d.toLocaleString('en', { month: 'short' });
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${day} ${mon}, ${h12}:${m} ${ampm}`;
}

function OrderCard({ order, onPress, onRate, onDownloadInvoice }: { order: OrderDoc; onPress: () => void; onRate: () => void; onDownloadInvoice: () => void }) {
  const sc = STATUS_COLOR[order.status] ?? { bg: '#F3F4F6', fg: '#374151' };
  const icon = STATUS_ICON[order.status] ?? '📋';
  const itemsSummary = order.items
    .slice(0, 3)
    .map(i => `${i.name} ×${i.quantity}`)
    .join(', ');
  const more = order.items.length > 3 ? ` +${order.items.length - 3} more` : '';
  const isActive = !['DELIVERED', 'CANCELLED'].includes(order.status);

  return (
    <TouchableOpacity style={[st.card, isActive && st.cardActive]} onPress={onPress} activeOpacity={0.8}>
      {/* Header row */}
      <View style={st.cardHeader}>
        <View style={st.orderIdRow}>
          <Text style={st.orderId}>#{order.orderId.slice(-8)}</Text>
          <View style={[st.statusBadge, { backgroundColor: sc.bg }]}>
            <Text style={[st.statusText, { color: sc.fg }]}>{icon} {order.status.replace(/_/g, ' ')}</Text>
          </View>
        </View>
        <Text style={st.dateText}>{formatDate(order.createdAt)}</Text>
      </View>

      {/* Items */}
      <Text style={st.itemsList} numberOfLines={2}>{itemsSummary}{more}</Text>

      {/* Footer */}
      <View style={st.cardFooter}>
        <Text style={st.totalText}>₹{order.pricing?.grandTotal ?? order.pricing?.itemsTotal ?? 0}</Text>
        <View style={st.payChip}>
          <Text style={st.payText}>
            {order.payment.mode === 'CASH' ? '💵 COD' : '💳 Online'}
          </Text>
        </View>
        {isActive && (
          <View style={st.trackBtn}>
            <Text style={st.trackBtnText}>Track →</Text>
          </View>
        )}
        {order.status === 'DELIVERED' && (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {order.hasRated ? (
              <View style={[st.trackBtn, { backgroundColor: '#D1D5DB' }]}>
                <Text style={st.trackBtnText}>⭐ Rated</Text>
              </View>
            ) : (
              <TouchableOpacity style={[st.trackBtn, { backgroundColor: '#F59E0B' }]} onPress={onRate} activeOpacity={0.8}>
                <Text style={st.trackBtnText}>⭐ Rate</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[st.trackBtn, { backgroundColor: '#4F46E5' }]} onPress={onDownloadInvoice} activeOpacity={0.8}>
              <Text style={st.trackBtnText}>📄 Invoice</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function OrdersTab({ idToken, onOpenTracking, onOpenReview }: Props) {
  const [orders, setOrders] = useState<OrderDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);

  const handleDownloadInvoice = async (order: OrderDoc) => {
    try {
      if (Platform.OS === 'android') {
        const currentApiLevel = Platform.Version as number;
        if (currentApiLevel < 33) {
          await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
            PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          ]);
        } else {
          // Android 13+ (API 33+): WRITE_EXTERNAL_STORAGE is deprecated and auto-denied.
          // The app can write to its own directories without permissions, and react-native-share
          // uses a FileProvider to share the file, so no explicit storage permissions are needed for PDFs.
        }
      }

      setGeneratingInvoice(true);
      const invoiceData: InvoiceOrderData = {
        orderId: order.orderId,
        createdAt: order.createdAt,
        paymentMode: order.payment.mode,
        items: order.items,
        pricing: order.pricing
      };
      
      const filePath = await generateInvoicePdf(invoiceData);
      
      await Share.open({
        title: `Invoice_${order.orderId}`,
        url: `file://${filePath}`,
        type: 'application/pdf',
      });
    } catch (err: any) {
      console.warn('PDF/Share Error:', err);
      if (err.message !== 'User did not share') {
        Alert.alert('Error', err.message || 'Failed to generate or share invoice');
      }
    } finally {
      setGeneratingInvoice(false);
    }
  };

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`${appConfig.apiBaseUrl}/api/orders/my-orders?t=${Date.now()}`, {
        headers: { 
          Authorization: `Bearer ${idToken}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
      });
      const json = await res.json();
      if (json.success) {
        setOrders(json.data ?? []);
      }
    } catch (e: any) {
      console.error('[OrdersTab]', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [idToken]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Auto-refresh every 30s if there are active orders
  useEffect(() => {
    const hasActiveOrders = orders.some(o => !['DELIVERED', 'CANCELLED'].includes(o.status));
    if (!hasActiveOrders) return;
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [orders, fetchOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  if (loading) {
    return (
      <View style={st.center}>
        <ActivityIndicator color="#F5C116" size="large" />
        <Text style={st.loadingText}>Loading orders…</Text>
      </View>
    );
  }

  return (
    <View style={st.root}>
      <View style={st.header}>
        <Text style={st.headerTitle}>Your Orders</Text>
        <Text style={st.headerCount}>{orders.length} orders</Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={o => o._id}
        contentContainerStyle={st.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F5C116" />}
        renderItem={({ item }) => (
          <OrderCard 
            order={item} 
            onPress={() => onOpenTracking(item)} 
            onRate={() => onOpenReview(item)} 
            onDownloadInvoice={() => handleDownloadInvoice(item)}
          />
        )}
        ListEmptyComponent={
          <View style={st.empty}>
            <Text style={{ fontSize: 56 }}>📦</Text>
            <Text style={st.emptyTitle}>No orders yet</Text>
            <Text style={st.emptySub}>Your order history will appear here</Text>
          </View>
        }
      />
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFBF0' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#6B7280', fontSize: 13 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingTop: 56, paddingBottom: 14,
    backgroundColor: '#FAE08B', borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#111' },
  headerCount: { fontSize: 13, color: '#9CA3AF', fontWeight: '600' },

  list: { padding: 14, gap: 12, paddingBottom: 80 },

  card: {
    backgroundColor: '#FAE08B', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#F3F4F6',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
    shadowOffset: { width: 0, height: 2 },
  },
  cardActive: {
    borderColor: '#E0E7FF',
    shadowColor: '#F5C116', shadowOpacity: 0.08,
  },

  cardHeader: { marginBottom: 10 },
  orderIdRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderId: { fontSize: 14, fontWeight: '800', color: '#111', letterSpacing: 0.3 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  dateText: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },

  itemsList: { fontSize: 13, color: '#374151', lineHeight: 19, marginBottom: 12 },

  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  totalText: { fontSize: 16, fontWeight: '800', color: '#111', flex: 1 },
  payChip: {
    backgroundColor: '#F3F4F6', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  payText: { fontSize: 11, fontWeight: '600', color: '#374151' },
  trackBtn: {
    backgroundColor: '#F5C116', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  trackBtnText: { color: '#FFF', fontSize: 12, fontWeight: '800' },

  empty: { flex: 1, paddingTop: 80, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#111' },
  emptySub: { fontSize: 13, color: '#9CA3AF' },
});


