import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { SyncedTownPulseSession } from '../../services/backendAuth';
import { getFreshFirebaseIdToken } from '../../services/firebaseAuth';
import { appConfig } from '../../config/appConfig';
import { useRestaurantSocket } from '../../hooks/useRestaurantSocket';
import { useToast } from '../../context/ToastContext';

import { RestaurantAnalyticsTab } from './RestaurantAnalyticsTab';
import { RestaurantMenuTab } from './RestaurantMenuTab';
import { RestaurantOrdersTab } from './RestaurantOrdersTab';
import { RestaurantSettingsTab } from './RestaurantSettingsTab';
import { RestaurantHistoryReviewsModal } from './RestaurantHistoryReviewsModal';

import { ChartIcon, MenuBookIcon, BellIcon, SettingsIcon, InfoIcon } from '../../components/SvgIcons';

type Tab = 'analytics' | 'menu' | 'orders' | 'settings';

type Props = {
  currentStepLabel: string;
  onSignOut: () => void;
  session: SyncedTownPulseSession;
};

const TABS: { key: Tab; label: string; icon: (color: string) => React.ReactNode }[] = [
  { key: 'analytics', label: 'Analytics', icon: (c) => <ChartIcon size={26} color={c} strokeWidth={2.5} /> },
  { key: 'menu', label: 'Menu', icon: (c) => <MenuBookIcon size={26} color={c} strokeWidth={2.5} /> },
  { key: 'orders', label: 'Orders', icon: (c) => <BellIcon size={26} color={c} strokeWidth={2.5} /> },
  { key: 'settings', label: 'Settings', icon: (c) => <SettingsIcon size={26} color={c} strokeWidth={2.5} /> },
];

export function RestaurantDashboardScreen({ currentStepLabel, onSignOut, session }: Props) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('analytics');
  const [token, setToken] = useState('');
  const [tokenLoading, setTokenLoading] = useState(true);

  // Shared data
  const [restaurant, setRestaurant] = useState<any>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [myItems, setMyItems] = useState<any[]>([]);
  const [isBusy, setIsBusy] = useState(true);

  // Info Modal state
  const [infoMenuOpen, setInfoMenuOpen] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalInitialTab, setModalInitialTab] = useState<'history' | 'reviews'>('history');

  // WebSocket
  const { statusMap, onNewOrder, onRestaurantUpdate } = useRestaurantSocket();

  // Token management
  useEffect(() => {
    (async () => {
      try {
        const t = await getFreshFirebaseIdToken();
        setToken(t);
      } catch { /* handled by child */ }
      finally { setTokenLoading(false); }
    })();
    const interval = setInterval(async () => {
      try { setToken(await getFreshFirebaseIdToken()); } catch { /* silent */ }
    }, 50 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // API helper
  const apiFetch = useCallback(async (path: string, opts?: any) => {
    const t = token || await getFreshFirebaseIdToken();
    const res = await fetch(`${appConfig.apiBaseUrl}${path}`, {
      ...opts,
      headers: { Authorization: `Bearer ${t}`, ...(opts?.headers || {}) },
    });
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      if (!res.ok) throw new Error(json.message || 'Request failed');
      return json;
    } catch {
      throw new Error(`Server error (${res.status})`);
    }
  }, [token]);

  // Fetch all data
  const fetchAll = useCallback(async () => {
    try {
      setIsBusy(true);
      const restJson = await apiFetch('/api/restaurants/my/managed');
      const r = restJson.restaurant;
      setRestaurant(r);
      try {
        const dashJson = await apiFetch(`/api/restaurants/${r.restaurantId}/dashboard`);
        setDashboard(dashJson.analytics);
      } catch { }
      try {
        const ordersJson = await apiFetch('/api/orders/restaurant/active');
        setActiveOrders(ordersJson.orders || []);
      } catch { }
      try {
        const itemsJson = await apiFetch('/api/items/my-items');
        setMyItems(itemsJson.items || []);
      } catch { }
    } catch (err: any) {
      showToast({ type: 'error', title: 'Error', body: err.message });
    } finally {
      setIsBusy(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (token) fetchAll();
  }, [token, fetchAll]);

  // WebSocket: new order → refresh orders
  useEffect(() => {
    onNewOrder.current = async (data) => {
      if (data.restaurantId !== restaurant?.restaurantId) return;
      try {
        const json = await apiFetch('/api/orders/restaurant/active');
        setActiveOrders(json.orders || []);
      } catch { }
    };
  }, [apiFetch, restaurant?.restaurantId, onNewOrder]);

  // WebSocket: restaurant updated → full refresh
  useEffect(() => {
    onRestaurantUpdate.current = async (data) => {
      if (data.restaurantId !== restaurant?.restaurantId) return;
      await fetchAll();
    };
  }, [fetchAll, restaurant?.restaurantId, onRestaurantUpdate]);

  // Poll active orders every 30s
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(async () => {
      try {
        const json = await apiFetch('/api/orders/restaurant/active');
        setActiveOrders(json.orders || []);
      } catch { }
    }, 30_000);
    return () => clearInterval(interval);
  }, [apiFetch, token]);

  // Live open/close status
  const liveIsOpen = restaurant?.restaurantId !== undefined
    ? statusMap[restaurant.restaurantId]
    : undefined;
  const isRestaurantOpen = liveIsOpen !== undefined
    ? liveIsOpen
    : restaurant?.isOpen !== false;

  const renderTab = () => {
    if (tokenLoading || !token || isBusy) {
      return (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#F5A623" />
          <Text style={styles.loadingText}>Loading Dashboard...</Text>
        </View>
      );
    }

    switch (activeTab) {
      case 'analytics':
        return <RestaurantAnalyticsTab dashboard={dashboard} apiFetch={apiFetch} />;
      case 'menu':
        return (
          <RestaurantMenuTab
            restaurant={restaurant}
            myItems={myItems}
            setMyItems={setMyItems}
            apiFetch={apiFetch}
          />
        );
      case 'orders':
        return (
          <RestaurantOrdersTab
            activeOrders={activeOrders}
            setActiveOrders={setActiveOrders}
            apiFetch={apiFetch}
          />
        );
      case 'settings':
        return (
          <RestaurantSettingsTab
            restaurant={restaurant}
            setRestaurant={setRestaurant}
            isRestaurantOpen={isRestaurantOpen}
            apiFetch={apiFetch}
            onSignOut={onSignOut}
          />
        );
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Text style={styles.brandName}>TownPulse</Text>
        <View style={styles.brandBadge}>
          <Text style={styles.brandSub}>Restaurant</Text>
        </View>
        <View style={{ flex: 1 }} />

        {/* Info Menu Toggle */}
        <View style={{ position: 'relative', zIndex: 50, marginRight: 8 }}>
          <TouchableOpacity 
            style={styles.infoBtn}
            onPress={() => setInfoMenuOpen(!infoMenuOpen)}
          >
            <InfoIcon size={24} color="#1C2434" />
          </TouchableOpacity>

          {infoMenuOpen && (
            <View style={styles.infoDropdown}>
              <TouchableOpacity 
                style={styles.dropdownItem}
                onPress={() => {
                  setInfoMenuOpen(false);
                  setModalInitialTab('reviews');
                  setModalVisible(true);
                }}
              >
                <Text style={styles.dropdownText}>Reviews</Text>
              </TouchableOpacity>
              <View style={styles.dropdownDivider} />
              <TouchableOpacity 
                style={styles.dropdownItem}
                onPress={() => {
                  setInfoMenuOpen(false);
                  setModalInitialTab('history');
                  setModalVisible(true);
                }}
              >
                <Text style={styles.dropdownText}>Order History</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={[styles.statusPill, { backgroundColor: isRestaurantOpen ? '#ECFDF5' : '#FEF2F2' }]}>
          <View style={[styles.statusDot, { backgroundColor: isRestaurantOpen ? '#22C55E' : '#EF4444' }]} />
          <Text style={[styles.statusText, { color: isRestaurantOpen ? '#15803D' : '#EF4444' }]}>
            {isRestaurantOpen ? 'OPEN' : 'CLOSED'}
          </Text>
        </View>
      </View>

      {/* History / Reviews Modal */}
      <RestaurantHistoryReviewsModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        apiFetch={apiFetch}
        restaurantId={restaurant?.restaurantId || null}
        initialTab={modalInitialTab}
      />

      {/* Tab Content */}
      <View style={styles.content}>{renderTab()}</View>

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          const badgeCount = tab.key === 'orders' ? activeOrders.length : 0;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.navItem}
              onPress={() => setActiveTab(tab.key)}>
              <View style={[styles.navIcon, active && styles.navIconActive]}>
                {tab.icon(active ? '#F5A623' : '#6B7280')}
                {badgeCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badgeCount}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>{tab.label}</Text>
              {active && <View style={styles.navDot} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F8FA' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 10,
  },
  brandName: { color: '#1C2434', fontSize: 20, fontWeight: '900', letterSpacing: 0.5 },
  brandBadge: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  brandSub: { color: '#F5A623', fontSize: 11, fontWeight: '700' },
  infoBtn: {
    padding: 4,
    borderRadius: 20,
  },
  infoDropdown: {
    position: 'absolute',
    top: 36,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    width: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  dropdownText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  content: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#9CA3AF', fontSize: 15 },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingBottom: 8,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  navItem: { flex: 1, alignItems: 'center', paddingTop: 10, position: 'relative' },
  navIcon: { alignItems: 'center', justifyContent: 'center', height: 24, position: 'relative' },
  navIconActive: {},
  navLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '600', marginTop: 2 },
  navLabelActive: { color: '#F5A623', fontWeight: '700' },
  navDot: {
    position: 'absolute',
    bottom: 0,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#F5A623',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: '800' },
});
