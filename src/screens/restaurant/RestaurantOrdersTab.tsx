import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useToast } from '../../context/ToastContext';

type Props = {
  activeOrders: any[];
  setActiveOrders: (orders: any[]) => void;
  apiFetch: (path: string, opts?: any) => Promise<any>;
};

export function RestaurantOrdersTab({ activeOrders, setActiveOrders, apiFetch }: Props) {
  const { showToast } = useToast();
  const handleOrderAction = async (orderId: string, action: string) => {
    try {
      await apiFetch(`/api/orders/${orderId}/restaurant-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await apiFetch('/api/orders/restaurant/active');
      setActiveOrders(json.orders || []);
    } catch (err: any) { showToast({ type: 'error', title: 'Error', body: err.message }); }
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      {activeOrders.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconBox}>
            <Text style={styles.emptyIcon}>No Orders</Text>
          </View>
          <Text style={styles.emptyTitle}>No Active Orders</Text>
          <Text style={styles.emptyDesc}>New orders will appear here automatically.</Text>
        </View>
      ) : (
        <>
          <View style={styles.headerCard}>
            <Text style={styles.headerTitle}>Active Orders</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{activeOrders.length}</Text>
            </View>
          </View>

          {activeOrders.map((order: any) => (
            <View key={order.orderId} style={styles.orderCard}>
              <View style={styles.orderHead}>
                <Text style={styles.orderId}>{order.orderId}</Text>
                <View style={[styles.statusBadge, statusColor(order.status)]}>
                  <Text style={styles.statusBadgeText}>{order.status.replace(/_/g, ' ')}</Text>
                </View>
              </View>

              {order.items?.map((it: any, i: number) => (
                <Text key={i} style={styles.orderItem}>{it.quantity}{'\u00D7'} {it.name} — {'\u20B9'}{it.itemTotal}</Text>
              ))}

              <Text style={styles.orderTotal}>Total: {'\u20B9'}{order.pricing?.grandTotal}</Text>

              {order.customer?.userId && (
                <Text style={styles.customerInfo}>
                  {order.customer.userId.name || 'Customer'} · {order.customer.userId.phone || ''}
                </Text>
              )}

              {order.status === 'PREPARING' && order.preparation?.startedAt && (
                <PreparationTimer startedAt={order.preparation.startedAt} />
              )}

              <View style={styles.orderBtns}>
                {order.status === 'PLACED' && (
                  <>
                    <Pressable style={[styles.actionBtn, { backgroundColor: '#ECFDF5' }]} onPress={() => handleOrderAction(order.orderId, 'accept')}>
                      <Text style={[styles.actionBtnText, { color: '#15803D' }]}>Accept</Text>
                    </Pressable>
                    <Pressable style={[styles.actionBtn, { backgroundColor: '#FEF2F2' }]} onPress={() => handleOrderAction(order.orderId, 'reject')}>
                      <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Reject</Text>
                    </Pressable>
                  </>
                )}
                {order.status === 'CONFIRMED' && (
                  <Pressable style={[styles.actionBtn, { backgroundColor: '#EFF6FF' }]} onPress={() => handleOrderAction(order.orderId, 'preparing')}>
                    <Text style={[styles.actionBtnText, { color: '#2563EB' }]}>Start Preparing</Text>
                  </Pressable>
                )}
                {order.status === 'PREPARING' && (
                  <Pressable style={[styles.actionBtn, { backgroundColor: '#FFF7ED' }]} onPress={() => handleOrderAction(order.orderId, 'ready')}>
                    <Text style={[styles.actionBtnText, { color: '#F5A623' }]}>Mark Ready for Pickup</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))}
        </>
      )}

      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

// ─── Preparation Timer ────────────────────────────────────────────────────────
function PreparationTimer({ startedAt }: { startedAt: string }) {
  const calc = () => {
    const diff = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    return { h: Math.floor(diff / 3600), m: Math.floor((diff % 3600) / 60), s: diff % 60 };
  };
  const [elapsed, setElapsed] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setElapsed(calc()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  const pad = (n: number) => String(n).padStart(2, '0');
  const isHot = elapsed.m >= 20;
  const isMed = elapsed.m >= 10 && !isHot;
  const accent = isHot ? '#EF4444' : isMed ? '#F59E0B' : '#2563EB';
  const bgColor = isHot ? '#FEF2F2' : isMed ? '#FFFBEB' : '#EFF6FF';
  return (
    <View style={{ backgroundColor: bgColor, borderRadius: 14, padding: 14, marginVertical: 10, alignItems: 'center', borderWidth: 1.5, borderColor: accent }}>
      <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: accent, textTransform: 'uppercase', marginBottom: 6 }}>Preparing For</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {elapsed.h > 0 && (
          <>
            <View style={{ backgroundColor: accent, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ color: '#FFF', fontSize: 28, fontWeight: '900', letterSpacing: 1 }}>{pad(elapsed.h)}</Text>
            </View>
            <Text style={{ color: accent, fontSize: 22, fontWeight: '900' }}>:</Text>
          </>
        )}
        <View style={{ backgroundColor: accent, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
          <Text style={{ color: '#FFF', fontSize: 28, fontWeight: '900', letterSpacing: 1 }}>{pad(elapsed.m)}</Text>
        </View>
        <Text style={{ color: accent, fontSize: 22, fontWeight: '900' }}>:</Text>
        <View style={{ backgroundColor: accent, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
          <Text style={{ color: '#FFF', fontSize: 28, fontWeight: '900', letterSpacing: 1 }}>{pad(elapsed.s)}</Text>
        </View>
      </View>
      <Text style={{ fontSize: 10, color: accent, marginTop: 6, fontWeight: '700' }}>
        {isHot ? 'Running Long!' : isMed ? 'Taking a while...' : 'On Track'}
      </Text>
    </View>
  );
}

function statusColor(status: string) {
  const m: Record<string, any> = {
    PLACED: { backgroundColor: '#FFF7ED' },
    CONFIRMED: { backgroundColor: '#EFF6FF' },
    PREPARING: { backgroundColor: '#F5F3FF' },
    READY_FOR_PICKUP: { backgroundColor: '#ECFDF5' },
  };
  return m[status] || { backgroundColor: '#F3F4F6' };
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 32 },
  emptyCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 40, alignItems: 'center',
    borderWidth: 1, borderColor: '#F3F4F6', elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8,
  },
  emptyIconBox: { marginBottom: 16 },
  emptyIcon: { fontSize: 18, fontWeight: '700', color: '#9CA3AF' },
  emptyTitle: { color: '#1C2434', fontSize: 20, fontWeight: '900', marginBottom: 6 },
  emptyDesc: { color: '#9CA3AF', fontSize: 13 },
  headerCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, marginBottom: 12,
    borderWidth: 1, borderColor: '#F3F4F6', elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8,
  },
  headerTitle: { color: '#1C2434', fontSize: 18, fontWeight: '900' },
  countBadge: { backgroundColor: '#F5A623', borderRadius: 10, minWidth: 28, height: 28, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  countText: { color: '#FFF', fontSize: 13, fontWeight: '900' },
  orderCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: '#F3F4F6', elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8,
  },
  orderHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderId: { color: '#1C2434', fontSize: 14, fontWeight: '900' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusBadgeText: { fontSize: 9, fontWeight: '800', color: '#1C2434', textTransform: 'uppercase', letterSpacing: 0.5 },
  orderItem: { color: '#374151', fontSize: 13, lineHeight: 20 },
  orderTotal: { color: '#1C2434', fontSize: 15, fontWeight: '800', marginTop: 6 },
  customerInfo: { color: '#9CA3AF', fontSize: 12, marginTop: 4 },
  orderBtns: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  actionBtnText: { fontSize: 13, fontWeight: '800' },
});
