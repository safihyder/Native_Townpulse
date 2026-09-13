import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Tab = 'history' | 'reviews';

type Props = {
  visible: boolean;
  onClose: () => void;
  apiFetch: (path: string, opts?: any) => Promise<any>;
  restaurantId: string | null;
  initialTab?: Tab;
};

export function RestaurantHistoryReviewsModal({ visible, onClose, apiFetch, restaurantId, initialTab = 'history' }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [orders, setOrders] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  
  const [ordersPage, setOrdersPage] = useState(1);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [ordersHasMore, setOrdersHasMore] = useState(true);
  const [reviewsHasMore, setReviewsHasMore] = useState(true);

  // Sync initial tab when opened
  useEffect(() => {
    if (visible) {
      setActiveTab(initialTab);
    }
  }, [visible, initialTab]);

  useEffect(() => {
    if (visible && restaurantId) {
      if (activeTab === 'history' && orders.length === 0) {
        fetchOrders(1);
      } else if (activeTab === 'reviews' && reviews.length === 0) {
        fetchReviews(1);
      }
    }
  }, [visible, activeTab, restaurantId]);

  const fetchOrders = async (page: number) => {
    // ⚠️ GET /api/orders/restaurant/history is NOT in the pushed backend
    Alert.alert(
      '⚠️ API Not Available',
      'GET /api/orders/restaurant/history is not available in the pushed backend.\n\nPurpose: Fetches paginated restaurant order history for analytics and revenue charts.\n\nUsed by: RestaurantHistoryReviewsModal',
      [{ text: 'OK' }]
    );
    return;
    if (loading) return;
    setLoading(true);
    try {
      const json = await apiFetch(`/api/orders/restaurant/history?page=${page}&limit=50`);
      if (page === 1) {
        setOrders(json.orders || []);
      } else {
        setOrders(prev => [...prev, ...(json.orders || [])]);
      }
      setOrdersPage(page);
      setOrdersHasMore(page < (json.totalPages || 1));
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async (page: number) => {
    if (loading) return;
    setLoading(true);
    try {
      const json = await apiFetch(`/api/reviews/${restaurantId}?page=${page}&limit=50`);
      if (page === 1) {
        setReviews(json.reviews || []);
      } else {
        setReviews(prev => [...prev, ...(json.reviews || [])]);
      }
      setReviewsPage(page);
      setReviewsHasMore(page < (json.totalPages || 1));
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleShowMore = () => {
    if (activeTab === 'history' && ordersHasMore) {
      fetchOrders(ordersPage + 1);
    } else if (activeTab === 'reviews' && reviewsHasMore) {
      fetchReviews(reviewsPage + 1);
    }
  };

  const formatDate = (ds: string) => {
    if (!ds) return '';
    const d = new Date(ds);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderOrder = ({ item }: { item: any }) => {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.orderId}>#{item.orderId?.slice(-6).toUpperCase()}</Text>
          <View style={[styles.statusBadge, { backgroundColor: item.status === 'DELIVERED' ? '#ECFDF5' : '#FEF2F2' }]}>
            <Text style={[styles.statusText, { color: item.status === 'DELIVERED' ? '#15803D' : '#EF4444' }]}>
              {item.status.replace(/_/g, ' ')}
            </Text>
          </View>
        </View>
        <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
        <Text style={styles.customerName}>
          Customer: {item.customer?.userId?.name || 'Guest'}
        </Text>
        <Text style={styles.amount}>Total: {item.pricing?.currency} {item.pricing?.grandTotal?.toFixed(2)}</Text>
      </View>
    );
  };

  const renderReview = ({ item }: { item: any }) => {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.ratingText}>⭐ {item.rating} / 5</Text>
          <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
        </View>
        {!!item.comment && <Text style={styles.reviewComment}>"{item.comment}"</Text>}
      </View>
    );
  };

  const renderFooter = () => {
    if (loading) {
      return <ActivityIndicator size="small" color="#F5A623" style={{ margin: 20 }} />;
    }
    const hasMore = activeTab === 'history' ? ordersHasMore : reviewsHasMore;
    const itemsLen = activeTab === 'history' ? orders.length : reviews.length;
    
    if (hasMore) {
      return (
        <TouchableOpacity style={styles.showMoreButton} onPress={handleShowMore}>
          <Text style={styles.showMoreText}>Show More</Text>
        </TouchableOpacity>
      );
    } else if (itemsLen > 0) {
      return <Text style={styles.endText}>No more items.</Text>;
    }
    return null;
  };

  const data = activeTab === 'history' ? orders : reviews;
  const renderItem = activeTab === 'history' ? renderOrder : renderReview;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>History & Reviews</Text>
          <View style={styles.closeBtn} />
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'history' && styles.tabBtnActive]}
            onPress={() => setActiveTab('history')}
          >
            <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>Order History</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'reviews' && styles.tabBtnActive]}
            onPress={() => setActiveTab('reviews')}
          >
            <Text style={[styles.tabText, activeTab === 'reviews' && styles.tabTextActive]}>Reviews</Text>
          </TouchableOpacity>
        </View>

        {/* List Content */}
        <FlatList
          data={data}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            !loading ? <Text style={styles.emptyText}>No {activeTab} found.</Text> : null
          }
          ListFooterComponent={renderFooter}
        />

      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F8FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1C2434' },
  closeBtn: { width: 50 },
  closeText: { color: '#6B7280', fontSize: 15, fontWeight: '600' },
  tabContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#F3F4F6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#1C2434',
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderId: { fontSize: 15, fontWeight: '800', color: '#1C2434' },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: { fontSize: 11, fontWeight: '800' },
  date: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  customerName: { fontSize: 14, color: '#4B5563', marginTop: 4, fontWeight: '500' },
  amount: { fontSize: 14, color: '#1C2434', fontWeight: '700', marginTop: 8 },
  ratingText: { fontSize: 15, fontWeight: '700', color: '#1C2434' },
  reviewComment: { fontSize: 14, color: '#4B5563', marginTop: 8, fontStyle: 'italic', lineHeight: 20 },
  showMoreButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginVertical: 10,
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  endText: {
    textAlign: 'center',
    color: '#9CA3AF',
    marginTop: 20,
    fontSize: 13,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6B7280',
    marginTop: 40,
    fontSize: 15,
  }
});
