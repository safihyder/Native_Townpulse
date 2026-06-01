import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../../theme/tokens';
import type { SyncedTownPulseSession } from '../../services/backendAuth';
import { getFreshFirebaseIdToken } from '../../services/firebaseAuth';
import { DeliveryHomeTab } from './DeliveryHomeTab';
import { DeliveryWalletTab } from './DeliveryWalletTab';
import { DeliveryAnalyticsTab } from './DeliveryAnalyticsTab';
import { DeliverySettingsTab } from './DeliverySettingsTab';


type Tab = 'home' | 'wallet' | 'analytics' | 'settings';

type Props = {
  session: SyncedTownPulseSession;
  onSignOut: () => void;
};

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'home', label: 'Home', icon: '🏠' },
  { key: 'wallet', label: 'Wallet', icon: '💰' },
  { key: 'analytics', label: 'Stats', icon: '📊' },
  { key: 'settings', label: 'Settings', icon: '⚙️' },
];

export function DeliveryDashboardScreen({ session, onSignOut }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [activeOrder, setActiveOrder] = useState<any>(null);
  // Lift mode state up to Dashboard so it persists across tab switches
  const [mode, setMode] = useState<'OFFLINE' | 'ONLINE_AVAILABLE' | 'ONLINE_BUSY' | 'PAUSED'>('OFFLINE');
  const [idToken] = useState<string>(() => {
    // Token is fetched fresh each time to avoid expiry issues
    // We'll store it in state and refresh lazily
    return '';
  });

  // Use a ref-style approach: get a fresh token before each API call
  // The child tabs call the service which calls getFreshFirebaseIdToken internally.
  // For simplicity, we pass a token-getter pattern by using a hook here.
  const [token, setToken] = React.useState('');
  const [tokenLoading, setTokenLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        const t = await getFreshFirebaseIdToken();
        setToken(t);
      } catch { /* handled by child */ }
      finally { setTokenLoading(false); }
    })();

    // Refresh token every 50 minutes (Firebase tokens expire in 60 min)
    const interval = setInterval(async () => {
      try { setToken(await getFreshFirebaseIdToken()); } catch { /* silent */ }
    }, 50 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const renderTab = () => {
    if (tokenLoading || !token) {
      return (
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      );
    }

    switch (activeTab) {
      case 'home':
        return <DeliveryHomeTab idToken={token} partnerName={session.user.name} mode={mode} setMode={setMode} activeOrder={activeOrder} setActiveOrder={setActiveOrder} />;
      case 'wallet':
        return <DeliveryWalletTab idToken={token} />;
      case 'analytics':
        return <DeliveryAnalyticsTab idToken={token} />;
      case 'settings':
        return (
          <DeliverySettingsTab
            idToken={token}
            partnerName={session.user.name}
            partnerRole={session.user.role}
            onSignOut={onSignOut}
            mode={mode}
            setMode={setMode}
          />
        );
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Text style={styles.brandName}>TownPulse</Text>
        <Text style={styles.brandSub}>Delivery</Text>
      </View>

      {/* Tab Content */}
      <View style={styles.content}>{renderTab()}</View>

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.navItem}
              onPress={() => setActiveTab(tab.key)}>
              <Text style={[styles.navIcon, active && styles.navIconActive]}>{tab.icon}</Text>
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
  root: { flex: 1, backgroundColor: theme.colors.brandCanvas },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 10,
    backgroundColor: theme.colors.brandPrimary,
    gap: 8,
  },
  brandName: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 0.5 },
  brandSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  content: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: theme.colors.ink500, fontSize: theme.typography.body },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FAE08B',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingBottom: 8,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  navItem: { flex: 1, alignItems: 'center', paddingTop: 10, position: 'relative' },
  navIcon: { fontSize: 22, opacity: 0.5 },
  navIconActive: { opacity: 1 },
  navLabel: { fontSize: 10, color: theme.colors.ink500, fontWeight: '600', marginTop: 2 },
  navLabelActive: { color: theme.colors.brandPrimary },
  navDot: {
    position: 'absolute',
    bottom: 0,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.brandPrimary,
  },
});

