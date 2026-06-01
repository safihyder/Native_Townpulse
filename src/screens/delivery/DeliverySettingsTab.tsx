import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../../theme/tokens';
import { setDeliveryMode } from '../../services/deliveryApi';

type Mode = 'OFFLINE' | 'ONLINE_AVAILABLE' | 'PAUSED';
type Props = { idToken: string; partnerName: string; partnerRole: string; onSignOut: () => void; mode: Mode | 'ONLINE_BUSY'; setMode: (m: 'OFFLINE' | 'ONLINE_AVAILABLE' | 'ONLINE_BUSY' | 'PAUSED') => void; };

const MODE_OPTIONS: { label: string; value: Mode; desc: string; color: string }[] = [
  { label: 'Online & Available', value: 'ONLINE_AVAILABLE', desc: 'Receive new order requests', color: theme.colors.success },
  { label: 'Paused', value: 'PAUSED', desc: 'Stay online but skip new orders', color: '#d97706' },
  { label: 'Offline', value: 'OFFLINE', desc: 'Not receiving any orders', color: theme.colors.ink500 },
];

export function DeliverySettingsTab({ idToken, partnerName, partnerRole, onSignOut, mode, setMode }: Props) {
  const [saving, setSaving] = useState(false);
  const [nearbyAlerts, setNearbyAlerts] = useState(true);

  const handleModeChange = async (newMode: Mode) => {
    setSaving(true);
    try {
      await setDeliveryMode(idToken, newMode);
      setMode(newMode);
      Alert.alert('Status Updated', `You are now set to ${newMode.replace(/_/g, ' ').toLowerCase()}.`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      <Text style={styles.pageTitle}>Settings</Text>

      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{partnerName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.profileName}>{partnerName}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>🛵 DELIVERY PARTNER</Text>
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
              : mode === opt.value && <Text style={{ color: opt.color, fontSize: 18 }}>✓</Text>}
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
            trackColor={{ true: theme.colors.brandPrimary, false: '#d1d5db' }}
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
        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>Platform</Text>
          <Text style={styles.aboutValue}>TownPulse Delivery</Text>
        </View>
      </View>

      {/* Sign Out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={onSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.brandCanvas },
  pageTitle: { fontSize: theme.typography.h1, fontWeight: '800', color: theme.colors.ink900, margin: theme.spacing.lg, marginBottom: theme.spacing.sm },
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FAE08B', marginHorizontal: theme.spacing.lg, borderRadius: theme.radius.md, padding: theme.spacing.lg, ...theme.shadow.card, marginBottom: theme.spacing.lg },
  avatarCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.brandPrimary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '900' },
  profileName: { fontSize: theme.typography.body, fontWeight: '700', color: theme.colors.ink900 },
  roleBadge: { backgroundColor: theme.colors.brandPrimarySoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, alignSelf: 'flex-start', marginTop: 4 },
  roleBadgeText: { color: theme.colors.brandPrimary, fontSize: 10, fontWeight: '700' },
  section: { backgroundColor: '#FAE08B', marginHorizontal: theme.spacing.lg, borderRadius: theme.radius.md, padding: theme.spacing.lg, ...theme.shadow.card, marginBottom: theme.spacing.md },
  sectionTitle: { fontSize: theme.typography.body, fontWeight: '700', color: theme.colors.ink900, marginBottom: 4 },
  sectionSub: { fontSize: theme.typography.micro, color: theme.colors.ink500, marginBottom: 14 },
  modeRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#f3f4f6', marginBottom: 8 },
  modeRowSelected: { borderColor: theme.colors.brandPrimary, backgroundColor: theme.colors.brandPrimarySoft },
  modeIndicator: { width: 10, height: 10, borderRadius: 5 },
  modeLabel: { fontSize: theme.typography.small, fontWeight: '700', color: theme.colors.ink900 },
  modeDesc: { fontSize: theme.typography.micro, color: theme.colors.ink500, marginTop: 2 },
  prefRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  prefLabel: { fontSize: theme.typography.small, fontWeight: '600', color: theme.colors.ink900 },
  prefSub: { fontSize: theme.typography.micro, color: theme.colors.ink500, marginTop: 2 },
  aboutRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f9fafb' },
  aboutLabel: { fontSize: theme.typography.small, color: theme.colors.ink500 },
  aboutValue: { fontSize: theme.typography.small, fontWeight: '600', color: theme.colors.ink900 },
  signOutBtn: { margin: theme.spacing.lg, padding: theme.spacing.md, borderRadius: theme.radius.sm, borderWidth: 2, borderColor: theme.colors.danger, alignItems: 'center' },
  signOutText: { color: theme.colors.danger, fontWeight: '700', fontSize: theme.typography.body },
});

