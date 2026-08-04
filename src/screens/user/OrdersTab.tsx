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
  PermissionsAndroid,
  Platform,
  Image,
  TextInput,
} from 'react-native';
import Share from 'react-native-share';
import { appConfig } from '../../config/appConfig';
import { generateInvoicePdf, InvoiceOrderData } from '../../utils/InvoiceGenerator';
import { SearchIcon } from '../../components/SvgIcons';
import { useToast } from '../../context/ToastContext';

// ── Types ──────────────────────────────────────────────────────────────────────
interface OrderItem {
  name: string;
  quantity: number;
  image?: string;
  variantName?: string;
  price?: number;
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
  onBack?: () => void;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const mon = String(d.getMonth() + 1).padStart(2, '0');
  const yr = d.getFullYear();
  return `${day}/${mon}/${yr}`;
}

export default function OrdersTab({ idToken, onOpenTracking, onOpenReview, onBack }: Props) {
  const { showToast } = useToast();
  const [orders, setOrders] = useState<OrderDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);

  // Tabs state
  type TabType = 'Delivery' | 'History' | 'Rating';
  const [activeTab, setActiveTab] = useState<TabType>('History');

  // Search state
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
        setOrders(json.orders ?? []);
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
  const hasActiveOrders = orders.some(o => !['DELIVERED', 'CANCELLED'].includes(o.status));
  useEffect(() => {
    if (!hasActiveOrders) return;
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [orders, fetchOrders]);

  // Default to Delivery tab if there are active orders and we haven't manually switched
  useEffect(() => {
    if (hasActiveOrders && activeTab === 'History') {
      setActiveTab('Delivery');
    }
  }, [hasActiveOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  // Filter orders based on active tab and search query
  const filteredOrders = orders.filter(o => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchOrderId = o.orderId?.toLowerCase().includes(query);
      const matchItemName = o.items.some(item => item.name?.toLowerCase().includes(query));
      if (!matchOrderId && !matchItemName) return false;
    }

    const isActive = !['DELIVERED', 'CANCELLED'].includes(o.status);
    if (activeTab === 'Delivery') return isActive;
    if (activeTab === 'History') return !isActive;
    if (activeTab === 'Rating') return o.status === 'DELIVERED' && !o.hasRated;
    return true;
  });

  const handleOrderPress = async (order: OrderDoc) => {
    if (!['DELIVERED', 'CANCELLED'].includes(order.status)) {
      onOpenTracking(order);
      return;
    }

    const downloadInvoice = async () => {
      try {
        setGeneratingInvoice(true);
        const pdfPath = await generateInvoicePdf({
          orderId: order.orderId,
          createdAt: order.createdAt,
          paymentMode: order.payment?.mode || 'Unknown',
          items: order.items.map(i => ({
            name: i.name,
            quantity: i.quantity,
            pricing: { finalPrice: (i as any).finalPrice ?? (i as any).unitPrice ?? i.price ?? 0 }
          })),
          pricing: order.pricing
        });
        if (pdfPath) {
          await Share.open({
            url: `file://${pdfPath}`,
            type: 'application/pdf',
            title: `Invoice_${order.orderId}`,
          });
        }
      } catch (e) {
        showToast({ type: 'error', title: 'Error', body: 'Failed to generate invoice.' });
      } finally {
        setGeneratingInvoice(false);
      }
    };

    if (order.status === 'DELIVERED' && !order.hasRated) {
      // If unrated, open review directly; user can download invoice from history tab
      onOpenReview(order);
    } else {
      downloadInvoice();
    }
  };

  if (loading) {
    return (
      <View style={st.center}>
        <ActivityIndicator color="#FBC02D" size="large" />
      </View>
    );
  }

  return (
    <View style={st.root}>
      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <View style={st.header}>
        {isSearching ? (
          <>
            <TouchableOpacity style={st.iconBtn} onPress={() => { setIsSearching(false); setSearchQuery(''); }} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
              <Text style={[st.headerIcon, { fontSize: 24, fontWeight: '800' }]}>‹</Text>
            </TouchableOpacity>
            <TextInput 
              style={st.searchInput}
              placeholder="Search items or order ID..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              placeholderTextColor="#9CA3AF"
            />
          </>
        ) : (
          <>
            <TouchableOpacity style={st.iconBtn} onPress={onBack} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
              <Text style={[st.headerIcon, { fontSize: 24, fontWeight: '800' }]}>‹</Text>
            </TouchableOpacity>
            <Text style={st.headerTitle}>Your order</Text>
            <TouchableOpacity style={st.iconBtn} onPress={() => setIsSearching(true)} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
              <SearchIcon size={22} color="#4B5563" />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* ── TABS ─────────────────────────────────────────────────────────── */}
      <View style={st.tabsContainer}>
        {hasActiveOrders && (
          <TouchableOpacity 
            style={[st.tabBtn, activeTab === 'Delivery' && st.tabBtnActive]} 
            onPress={() => setActiveTab('Delivery')}
            activeOpacity={0.8}
          >
            <Text style={[st.tabText, activeTab === 'Delivery' && st.tabTextActive]}>Delivery</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={[st.tabBtn, activeTab === 'History' && st.tabBtnActive]} 
          onPress={() => setActiveTab('History')}
          activeOpacity={0.8}
        >
          <Text style={[st.tabText, activeTab === 'History' && st.tabTextActive]}>History</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[st.tabBtn, activeTab === 'Rating' && st.tabBtnActive]} 
          onPress={() => setActiveTab('Rating')}
          activeOpacity={0.8}
        >
          <Text style={[st.tabText, activeTab === 'Rating' && st.tabTextActive]}>Rating</Text>
        </TouchableOpacity>
      </View>

      {/* ── LIST ─────────────────────────────────────────────────────────── */}
      <FlatList
        data={filteredOrders}
        keyExtractor={o => o._id}
        contentContainerStyle={st.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#111" />}
        renderItem={({ item }) => {
          const firstItem = item.items[0]; // Assuming we only show the first item like the mockup
          const isActive = !['DELIVERED', 'CANCELLED'].includes(item.status);
          
          let etaStr = "Delivered";
          if (isActive) {
            const etaMinutes = item.delivery?.tracking?.etaMinutes;
            if (etaMinutes) {
              const d = new Date();
              d.setMinutes(d.getMinutes() + etaMinutes);
              etaStr = `Est. Time ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
            } else {
              etaStr = "Preparing...";
            }
          }

          return (
            <TouchableOpacity style={st.card} onPress={() => handleOrderPress(item)} activeOpacity={0.9}>
              
              {/* Order ID & Date Row */}
              <View style={st.cardHeaderRow}>
                <View style={st.orderIdCol}>
                  <Text style={st.receiptIcon}>🧾</Text>
                  <Text style={st.orderId}># {item.orderId.slice(-8)}</Text>
                </View>
                <Text style={st.dateText}>{formatDate(item.createdAt)}</Text>
              </View>

              {/* Item Details Row */}
              {firstItem && (
                <View style={st.itemContentRow}>
                  
                  <View style={st.itemImageWrap}>
                    {firstItem.image ? (
                      <Image source={{ uri: firstItem.image }} style={st.itemImage} />
                    ) : (
                      <Text style={{fontSize: 24}}>🍲</Text>
                    )}
                  </View>

                  <Text style={st.itemQty}>{firstItem.quantity} x</Text>
                  
                  <View style={st.itemInfo}>
                    <Text style={st.itemName}>{firstItem.name}</Text>
                    {firstItem.variantName ? (
                      <Text style={st.itemVariant}>{firstItem.variantName}</Text>
                    ) : (
                      <Text style={st.itemVariant}>Standard</Text>
                    )}
                  </View>

                  <View style={st.priceCol}>
                    <Text style={st.itemPrice}>₹{item.pricing?.grandTotal ?? item.pricing?.itemsTotal ?? 0}</Text>
                  </View>

                </View>
              )}

              {/* ETA Pill Row */}
              <View style={st.etaPillContainer}>
                <View style={st.etaPill}>
                   <Text style={st.etaPillText}>{etaStr}</Text>
                </View>
                {item.items.length > 1 && (
                  <Text style={st.moreItemsText}>+ {item.items.length - 1} more items</Text>
                )}
              </View>

            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={st.empty}>
            <Text style={{ fontSize: 56 }}>📦</Text>
            <Text style={st.emptyTitle}>No orders found</Text>
          </View>
        }
      />
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#F9FAFB',
  },
  iconBtn: { padding: 4 },
  headerIcon: { fontSize: 24, color: '#111827', fontWeight: '500' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#111827',
    marginRight: 16,
  },

  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  tabBtnActive: {
    backgroundColor: '#E0E7FF',
  },
  tabText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#4F46E5',
  },

  // List
  list: { padding: 20, paddingTop: 0, paddingBottom: 80, gap: 16 },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 2,
    shadowOffset: { width: 0, height: 2 },
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  orderIdCol: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  receiptIcon: { fontSize: 18, color: '#F5A623' },
  orderId: { fontSize: 15, fontWeight: '800', color: '#111827' },
  dateText: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },

  itemContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  itemImageWrap: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 16, overflow: 'hidden'
  },
  itemImage: { width: '100%', height: '100%' },
  itemQty: { fontSize: 14, fontWeight: '800', color: '#111827', width: 28 },
  
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 2 },
  itemVariant: { fontSize: 12, color: '#9CA3AF' },
  
  priceCol: { alignItems: 'flex-end', justifyContent: 'center' },
  itemPrice: { fontSize: 16, fontWeight: '800', color: '#111827' },

  etaPillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  etaPill: {
    backgroundColor: '#1F2937',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, alignSelf: 'flex-start'
  },
  etaPillText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  moreItemsText: { color: '#9CA3AF', fontSize: 12, fontWeight: '500' },

  // Empty
  empty: { paddingVertical: 60, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111', marginTop: 12 },
});
