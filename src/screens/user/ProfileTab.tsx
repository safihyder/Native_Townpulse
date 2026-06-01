import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { appConfig } from '../../config/appConfig';
import type { SyncedTownPulseSession } from '../../services/backendAuth';

type Props = {
  session: SyncedTownPulseSession;
  onSignOut: () => void;
  onSessionUpdate: (newSession: SyncedTownPulseSession) => void;
  onApplyPress: () => void;
};

export default function ProfileTab({ session, onSignOut, onSessionUpdate, onApplyPress }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [name, setName] = useState(session.user.name || '');
  const [email, setEmail] = useState(session.user.email || '');
  const [street, setStreet] = useState(session.user.address?.street || '');
  const [city, setCity] = useState(session.user.address?.city || '');
  const [state, setStateStr] = useState(session.user.address?.state || '');
  const [zipCode, setZipCode] = useState(session.user.address?.zipCode || '');

  const getInitials = (n: string) => {
    return n.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || '👤';
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(`${appConfig.apiBaseUrl}/api/auth/update-user`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.idToken}`,
        },
        body: JSON.stringify({
          name,
          email,
          address: { street, city, state, zipCode },
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to update profile');

      // Update local session
      onSessionUpdate({
        ...session,
        user: {
          ...session.user,
          name: json.user.name,
          email: json.user.email,
          address: json.user.address,
        },
      });

      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    Alert.alert(
      'Deactivate Account',
      'Are you sure you want to deactivate your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${appConfig.apiBaseUrl}/api/auth/deactivate-account`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${session.idToken}` },
              });
              const json = await res.json();
              if (!res.ok || !json.success) throw new Error(json.message);
              Alert.alert('Account Deactivated', json.message, [{ text: 'OK', onPress: onSignOut }]);
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={st.root} contentContainerStyle={st.content}>
      {/* Header Avatar */}
      <View style={st.header}>
        <View style={st.avatar}>
          <Text style={st.avatarText}>{getInitials(session.user.name)}</Text>
        </View>
        {!isEditing && <Text style={st.titleName}>{session.user.name}</Text>}
        {!isEditing && <Text style={st.roleBadge}>{session.user.role.toUpperCase()}</Text>}
      </View>

      {/* Details / Edit Form */}
      <View style={st.card}>
        <View style={st.cardHeader}>
          <Text style={st.cardTitle}>Personal Information</Text>
          {!isEditing ? (
            <TouchableOpacity onPress={() => setIsEditing(true)}>
              <Text style={st.editBtnText}>Edit</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setIsEditing(false)}>
              <Text style={st.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>

        {isEditing ? (
          <View style={st.form}>
            <Text style={st.label}>Full Name</Text>
            <TextInput style={st.input} value={name} onChangeText={setName} placeholder="John Doe" />
            
            <Text style={st.label}>Email Address</Text>
            <TextInput style={st.input} value={email} onChangeText={setEmail} placeholder="john@example.com" keyboardType="email-address" autoCapitalize="none" />
            
            <Text style={st.label}>Phone Number (Uneditable)</Text>
            <TextInput style={[st.input, st.inputDisabled]} value={session.user.phone} editable={false} />

            <Text style={st.sectionTitle}>Delivery Address</Text>
            
            <Text style={st.label}>Street</Text>
            <TextInput style={st.input} value={street} onChangeText={setStreet} placeholder="123 Main St" />
            
            <View style={st.row}>
              <View style={st.col}>
                <Text style={st.label}>City</Text>
                <TextInput style={st.input} value={city} onChangeText={setCity} placeholder="City" />
              </View>
              <View style={st.col}>
                <Text style={st.label}>State</Text>
                <TextInput style={st.input} value={state} onChangeText={setStateStr} placeholder="State" />
              </View>
            </View>
            
            <Text style={st.label}>Zip Code</Text>
            <TextInput style={st.input} value={zipCode} onChangeText={setZipCode} placeholder="12345" keyboardType="number-pad" />

            <TouchableOpacity style={st.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={st.saveBtnText}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={st.infoList}>
            <View style={st.infoRow}>
              <Text style={st.infoLabel}>Email</Text>
              <Text style={st.infoValue}>{session.user.email || 'Not provided'}</Text>
            </View>
            <View style={st.infoRow}>
              <Text style={st.infoLabel}>Phone</Text>
              <Text style={st.infoValue}>{session.user.phone}</Text>
            </View>
            <View style={st.infoRow}>
              <Text style={st.infoLabel}>Address</Text>
              <Text style={st.infoValue}>
                {[session.user.address?.street, session.user.address?.city, session.user.address?.state, session.user.address?.zipCode]
                  .filter(Boolean).join(', ') || 'Not provided'}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Application System Banner */}
      {session.user.role === 'user' && !isEditing && (
        <View style={st.applyCard}>
          <Text style={st.applyTitle}>Partner with TownPulse</Text>
          <Text style={st.applyDesc}>Grow your business by opening a restaurant, or earn money by becoming a delivery partner.</Text>
          <TouchableOpacity style={st.applyBtn} onPress={onApplyPress} activeOpacity={0.8}>
            <Text style={st.applyBtnText}>Apply Now →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Danger Zone */}
      {!isEditing && (
        <View style={st.dangerZone}>
          <TouchableOpacity style={st.signOutBtn} onPress={onSignOut}>
            <Text style={st.signOutBtnText}>Sign Out</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.deactivateBtn} onPress={handleDeactivate}>
            <Text style={st.deactivateBtnText}>Deactivate Account</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F4F6' },
  content: { padding: 20, paddingTop: 40, paddingBottom: 40 },
  
  header: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F5C116', justifyContent: 'center', alignItems: 'center', marginBottom: 12, shadowColor: '#F5C116', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  avatarText: { fontSize: 32, color: '#FFF', fontWeight: 'bold' },
  titleName: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 4 },
  roleBadge: { backgroundColor: '#E0E7FF', color: '#4F46E5', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, fontSize: 12, fontWeight: 'bold', overflow: 'hidden' },

  card: { backgroundColor: '#FAE08B', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 3, marginBottom: 20 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  editBtnText: { color: '#F5C116', fontWeight: '600', fontSize: 14 },
  cancelBtnText: { color: '#6B7280', fontWeight: '600', fontSize: 14 },

  infoList: { gap: 16 },
  infoRow: {},
  infoLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 15, color: '#111827', fontWeight: '500' },

  form: { gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 8, marginBottom: 4 },
  label: { fontSize: 13, color: '#4B5563', fontWeight: '600' },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#111827' },
  inputDisabled: { backgroundColor: '#E5E7EB', color: '#6B7280' },
  row: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },

  saveBtn: { backgroundColor: '#F5C116', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  applyCard: { backgroundColor: '#111827', borderRadius: 16, padding: 20, marginBottom: 20 },
  applyTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  applyDesc: { color: '#9CA3AF', fontSize: 14, lineHeight: 20, marginBottom: 16 },
  applyBtn: { backgroundColor: '#F5C116', alignSelf: 'flex-start', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  applyBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },

  dangerZone: { gap: 12, marginTop: 10 },
  signOutBtn: { backgroundColor: '#FAE08B', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  signOutBtnText: { color: '#374151', fontSize: 16, fontWeight: '600' },
  deactivateBtn: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  deactivateBtnText: { color: '#F5C116', fontSize: 16, fontWeight: '600' },
});


