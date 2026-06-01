import React, { useState } from 'react';
import {
  SafeAreaView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import type { SyncedTownPulseSession } from '../../services/backendAuth';
import { UserHomeTab } from './UserHomeTab';
import RestaurantMenuScreen from './RestaurantMenuScreen';
import CartScreen from './CartScreen';
import OrdersTab from './OrdersTab';
import OrderTrackingScreen from './OrderTrackingScreen';
import OrderReviewScreen from './OrderReviewScreen';
import ProfileTab from './ProfileTab';
import ApplicationFormScreen from './ApplicationFormScreen';
import { CartProvider, useCart } from '../../context/CartContext';

type Props = {
  session: SyncedTownPulseSession;
  onSignOut: () => void;
  onSessionUpdate?: (session: SyncedTownPulseSession) => void;
};

type HomeTab = 'home' | 'orders' | 'profile';
type Screen  = 'home' | 'menu' | 'cart' | 'tracking' | 'review' | 'apply';

const TABS: { key: HomeTab; label: string; icon: string }[] = [
  { key: 'home',    label: 'Home',    icon: '🏠' },
  { key: 'orders',  label: 'Orders',  icon: '📦' },
  { key: 'profile', label: 'Profile', icon: '👤' },
];

// ── Inner component (has access to CartContext) ────────────────────────────────
function DashboardInner({ session, onSignOut, onSessionUpdate }: Props) {
  const [activeTab, setActiveTab]           = useState<HomeTab>('home');
  const [screen, setScreen]                 = useState<Screen>('home');
  const [selectedRestaurantId, setSelected] = useState<string>('');
  const [trackingOrder, setTrackingOrder]   = useState<any>(null);
  const { idToken, user }                   = session;
  const { itemCount }                       = useCart();

  const openRestaurant = (id: string) => {
    setSelected(id);
    setScreen('menu');
  };

  const openTracking = (order: any) => {
    setTrackingOrder(order);
    setScreen('tracking');
  };

  const openReview = (order: any) => {
    setTrackingOrder(order);
    setScreen('review');
  };

  // Full-screen overlays (no tab bar)
  if (screen === 'menu') {
    return (
      <RestaurantMenuScreen
        restaurantId={selectedRestaurantId}
        onBack={() => setScreen('home')}
        onOpenCart={() => setScreen('cart')}
      />
    );
  }
  if (screen === 'cart') {
    return (
      <CartScreen
        idToken={idToken}
        onBack={() => setScreen('menu')}
        onOrderPlaced={() => { setScreen('home'); setActiveTab('orders'); }}
      />
    );
  }
  if (screen === 'tracking' && trackingOrder) {
    return (
      <OrderTrackingScreen
        order={trackingOrder}
        idToken={idToken}
        onBack={() => { setTrackingOrder(null); setScreen('home'); setActiveTab('orders'); }}
      />
    );
  }
  if (screen === 'review' && trackingOrder) {
    return (
      <OrderReviewScreen
        order={trackingOrder}
        idToken={idToken}
        onClose={() => { setTrackingOrder(null); setScreen('home'); setActiveTab('orders'); }}
      />
    );
  }
  if (screen === 'apply') {
    return (
      <ApplicationFormScreen
        idToken={idToken}
        onBack={() => setScreen('home')}
      />
    );
  }

  return (
    <View style={s.root}>
      {/* Screen content */}
      <View style={s.content}>
        {activeTab === 'home' && (
          <UserHomeTab
            idToken={idToken}
            userName={user.name ?? 'there'}
            onOpenRestaurant={openRestaurant}
          />
        )}
        {activeTab === 'orders' && (
          <OrdersTab
            idToken={idToken}
            onOpenTracking={openTracking}
            onOpenReview={openReview}
          />
        )}
        {activeTab === 'profile' && (
          <ProfileTab
            session={session}
            onSignOut={onSignOut}
            onSessionUpdate={onSessionUpdate || (() => {})}
            onApplyPress={() => setScreen('apply')}
          />
        )}
      </View>

      {/* Bottom Tab Bar */}
      <SafeAreaView style={s.tabBar}>
        {TABS.map(tab => {
          const isActive = tab.key === activeTab;
          return (
            <TouchableOpacity
              key={tab.key}
              style={s.tabItem}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={[s.tabIcon, isActive && s.tabIconActive]}>{tab.icon}</Text>
              <Text style={[s.tabLabel, isActive && s.tabLabelActive]}>{tab.label}</Text>
              {isActive && <View style={s.tabIndicator} />}
            </TouchableOpacity>
          );
        })}

        {/* Cart shortcut tab */}
        {itemCount > 0 && (
          <TouchableOpacity style={s.tabItem} onPress={() => setScreen('cart')} activeOpacity={0.7}>
            <View style={s.cartTabIcon}>
              <Text style={{ fontSize: 20 }}>🛒</Text>
              <View style={s.cartTabBadge}>
                <Text style={s.cartTabBadgeText}>{itemCount}</Text>
              </View>
            </View>
            <Text style={[s.tabLabel, s.tabLabelCart]}>Cart</Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    </View>
  );
}

// ── Exported wrapper (provides CartContext) ────────────────────────────────────
export function UserDashboardScreen({ session, onSignOut, onSessionUpdate }: Props) {
  return (
    <CartProvider>
      <DashboardInner session={session} onSignOut={onSignOut} onSessionUpdate={onSessionUpdate} />
    </CartProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFBF0' },
  content: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FAE08B',
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
    shadowColor: '#F5C116', shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1, shadowRadius: 10, elevation: 12,
  },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 10, position: 'relative' },
  tabIcon: { fontSize: 22, marginBottom: 2 },
  tabIconActive: {},
  tabLabel: { fontSize: 11, fontWeight: '600', color: '#B0B0B0' },
  tabLabelActive: { color: '#F5C116', fontWeight: '800' },
  tabLabelCart: { color: '#F5C116', fontWeight: '800' },
  tabIndicator: {
    position: 'absolute', top: 0, left: '30%', right: '30%',
    height: 3, backgroundColor: '#F5C116', borderRadius: 2,
  },
  // Cart tab icon with badge
  cartTabIcon: { position: 'relative', marginBottom: 2 },
  cartTabBadge: {
    position: 'absolute', top: -4, right: -8,
    backgroundColor: '#E53935', borderRadius: 9, minWidth: 18, height: 18,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3,
  },
  cartTabBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  // Placeholder tabs
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  placeholderEmoji: { fontSize: 56 },
  placeholderTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  placeholderSub: { fontSize: 14, color: '#6B7280', textAlign: 'center', paddingHorizontal: 40 },
  signOutBtn: {
    marginTop: 16, backgroundColor: 'rgba(245,193,22,0.15)',
    paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12,
  },
  signOutText: { color: '#D4A510', fontWeight: '800', fontSize: 15 },
});

