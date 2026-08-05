import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
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

type Screen = 'home' | 'menu' | 'cart' | 'tracking' | 'review' | 'apply' | 'orders' | 'profile';

// ── Inner component (has access to CartContext) ────────────────────────────────
function DashboardInner({ session, onSignOut, onSessionUpdate }: Props) {
  const [screen, setScreen] = useState<Screen>('home');
  const [selectedRestaurantId, setSelected] = useState<string>('');
  const [highlightedItemId, setHighlightedItemId] = useState<string>('');
  const [trackingOrder, setTrackingOrder] = useState<any>(null);

  const { idToken, user } = session;
  const { itemCount } = useCart();

  const openRestaurant = (id: string, itemId?: string) => {
    setSelected(id);
    setHighlightedItemId(itemId || '');
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

  // Full-screen overlays
  if (screen === 'menu') {
    return (
      <RestaurantMenuScreen
        restaurantId={selectedRestaurantId}
        highlightItemId={highlightedItemId}
        onBack={() => { setScreen('home'); setHighlightedItemId(''); }}
        onOpenCart={() => setScreen('cart')}
      />
    );
  }
  if (screen === 'cart') {
    return (
      <CartScreen
        idToken={idToken}
        onBack={() => setScreen('home')}
        onOrderPlaced={() => { setScreen('orders'); }}
      />
    );
  }
  if (screen === 'tracking' && trackingOrder) {
    return (
      <OrderTrackingScreen
        order={trackingOrder}
        idToken={idToken}
        onBack={() => { setTrackingOrder(null); setScreen('orders'); }}
      />
    );
  }
  if (screen === 'review' && trackingOrder) {
    return (
      <OrderReviewScreen
        order={trackingOrder}
        idToken={idToken}
        onClose={() => { setTrackingOrder(null); setScreen('orders'); }}
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
      <View style={s.content}>
        {screen === 'home' && (
          <UserHomeTab
            idToken={idToken}
            userName={user.name ?? 'there'}
            cartItemCount={itemCount}
            onOpenRestaurant={openRestaurant}
            onOpenCart={() => setScreen('cart')}
            onOpenProfile={() => setScreen('profile')}
            onOpenOrders={() => setScreen('orders')}
            onOpenTracking={openTracking}
          />
        )}
        {screen === 'orders' && (
          <OrdersTab
            idToken={idToken}
            onOpenTracking={openTracking}
            onOpenReview={openReview}
            onBack={() => setScreen('profile')}
          />
        )}
        {screen === 'profile' && (
          <ProfileTab
            session={session}
            onSignOut={onSignOut}
            onSessionUpdate={onSessionUpdate || (() => {})}
            onApplyPress={() => setScreen('apply')}
            onOpenOrders={() => setScreen('orders')}
            onBackToHome={() => setScreen('home')}
          />
        )}
      </View>
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
  root: { flex: 1, backgroundColor: '#F7F8FA' },
  content: { flex: 1 },
});
