import React, { useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { BadgeCheckIcon, ScooterIcon } from '../../components/SvgIcons';
import { setDeliveryMode } from '../../services/deliveryApi';
import { useToast } from '../../context/ToastContext';

type Mode = 'OFFLINE' | 'ONLINE_AVAILABLE' | 'PAUSED';
type Props = { idToken: string; partnerName: string; partnerRole: string; onSignOut: () => void; mode: Mode | 'ONLINE_BUSY'; setMode: (m: 'OFFLINE' | 'ONLINE_AVAILABLE' | 'ONLINE_BUSY' | 'PAUSED') => void; };

const MODE_OPTIONS: { label: string; value: Mode; desc: string; color: string }[] = [
  { label: 'Online & Available', value: 'ONLINE_AVAILABLE', desc: 'Receive new order requests', color: '#22C55E' },
  { label: 'Paused', value: 'PAUSED', desc: 'Stay online but skip new orders', color: '#D97706' },
  { label: 'Offline', value: 'OFFLINE', desc: 'Not receiving any orders', color: '#9CA3AF' },
];

export function DeliverySettingsTab({ idToken, partnerName, partnerRole, onSignOut, mode, setMode }: Props) {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [nearbyAlerts, setNearbyAlerts] = useState(true);

  const handleModeChange = async (newMode: Mode) => {
    setSaving(true);
    try {
      await setDeliveryMode(idToken, newMode);
      setMode(newMode);
      showToast({ type: 'success', title: 'Status Updated', body: `You are now set to ${newMode.replace(/_/g, ' ').toLowerCase()}.` });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Error', body: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      <Text style={styles.pageTitle}>Settings</Text>

      {/* Profile Card — Dark header matching user ProfileTab */}
      <View style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          <Image
            source={{ uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(partnerName)}&background=F3E8FF&color=9333EA` }}
            style={styles.avatarImg}
          />
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <View style={styles.nameRow}>
            <Text style={styles.profileName}>{partnerName}</Text>
            <BadgeCheckIcon size={18} color="#3B82F6" />
          </View>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>DELIVERY PARTNER</Text>
          </View>
        </View>
      </View>

      {/* Delivery Mode */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Delivery Mode</Text>
        <Text style={styles.sectionSub}>Change your availability status. This affects which orders you receive.</Text>
        {MODE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.modeRow, mode === opt.value && styles.modeRowSelected]}
            onPress={() => handleModeChange(opt.value)}
            disabled={saving}>
            <View style={[styles.modeIndicator, { backgroundColor: opt.color }]} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.modeLabel, mode === opt.value && { color: opt.color }]}>{opt.label}</Text>
              <Text style={styles.modeDesc}>{opt.desc}</Text>
            </View>
            {saving && mode === opt.value
              ? <ActivityIndicator size="small" color={opt.color} />
              : mode === opt.value && <Text style={{ color: opt.color, fontSize: 18, fontWeight: '800' }}>✓</Text>}
          </TouchableOpacity>
        ))}
      </View>

      {/* Notification Preferences */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.prefRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.prefLabel}>Nearby Order Alerts</Text>
            <Text style={styles.prefSub}>Get notified when orders appear near you</Text>
          </View>
          <Switch
            value={nearbyAlerts}
            onValueChange={setNearbyAlerts}
            trackColor={{ true: '#F5A623', false: '#D1D5DB' }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>App Version</Text>
          <Text style={styles.aboutValue}>1.0.0</Text>
        </View>
        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>Role</Text>
          <Text style={styles.aboutValue}>{partnerRole}</Text>
        </View>
        <View style={[styles.aboutRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.aboutLabel}>Platform</Text>
          <Text style={styles.aboutValue}>TownPulse Delivery</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <ScooterIcon size={24} color="#D1D5DB" />
        <Text style={styles.footerText}>TownPulse Delivery Partner</Text>
      </View>

      {/* Sign Out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={onSignOut}>
        <Text style={styles.signOutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  pageTitle: { fontSize: 28, fontWeight: '900', color: '#1C2434', marginHorizontal: 20, marginTop: 20, marginBottom: 16 },

  // Profile Card — Dark (matching user's ProfileTab header)
  profileCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#374151',
    marginHorizontal: 20, borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
    shadowOffset: { width: 0, height: 4 },
    marginBottom: 20,
  },
  avatarCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#F3F4F6', borderWidth: 2, borderColor: '#FFF',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  profileName: { fontSize: 17, fontWeight: '800', color: '#FFFFFF', marginRight: 6 },
  verifiedBadge: { color: '#3B82F6', fontSize: 14 },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    alignSelf: 'flex-start',
  },
  roleBadgeText: { color: '#F5A623', fontSize: 10, fontWeight: '700' },

  // Sections
  section: {
    backgroundColor: '#FFFFFF', marginHorizontal: 20, borderRadius: 16,
    padding: 20, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 2,
    shadowOffset: { width: 0, height: 2 },
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1C2434', marginBottom: 4 },
  sectionSub: { fontSize: 12, color: '#9CA3AF', marginBottom: 16 },

  modeRow: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderRadius: 12, borderWidth: 1.5, borderColor: '#F3F4F6', marginBottom: 8,
  },
  modeRowSelected: { borderColor: '#F5A623', backgroundColor: '#FEF3C7' },
  modeIndicator: { width: 10, height: 10, borderRadius: 5 },
  modeLabel: { fontSize: 14, fontWeight: '700', color: '#1C2434' },
  modeDesc: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  prefRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  prefLabel: { fontSize: 14, fontWeight: '700', color: '#1C2434' },
  prefSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  aboutRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  aboutLabel: { fontSize: 14, color: '#9CA3AF', fontWeight: '500' },
  aboutValue: { fontSize: 14, fontWeight: '700', color: '#1C2434' },

  signOutBtn: {
    marginHorizontal: 20, marginTop: 10, padding: 16,
    borderRadius: 12, alignItems: 'center',
  },
  signOutText: { color: '#EF4444', fontWeight: '700', fontSize: 16 },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 32, gap: 8 },
  footerText: { color: '#D1D5DB', fontSize: 13, fontWeight: '600' },
});
