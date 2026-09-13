import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { appConfig } from '../../config/appConfig';
import type { SyncedTownPulseSession } from '../../services/backendAuth';
import { LocationSelectorModal } from './LocationSelectorModal';
import { ReceiptIcon, LocationPinIcon, BriefcaseIcon } from '../../components/SvgIcons';
import { useToast } from '../../context/ToastContext';
import { PressableScale } from '../../components/PressableScale';

type Props = {
  session: SyncedTownPulseSession;
  onSignOut: () => void;
  onSessionUpdate: (newSession: SyncedTownPulseSession) => void;
  onApplyPress: () => void;
  onOpenOrders: () => void;
  onBackToHome: () => void;
};

export default function ProfileTab({ session, onSignOut, onSessionUpdate, onApplyPress, onOpenOrders, onBackToHome }: Props) {
  const { showToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locModalVisible, setLocModalVisible] = useState(false);

  // Form State
  const [name, setName] = useState(session.user.name || '');
  const [email, setEmail] = useState(session.user.email || '');

  // Address state (hidden in new UI, but kept for save functionality)
  const street = session.user.address?.street || '';
  const city = session.user.address?.city || '';
  const stateStr = session.user.address?.state || '';
  const zipCode = session.user.address?.zipCode || '';

  const getInitials = (n: string) => {
    return n.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || '👤';
  };

  const joinDate = new Date((session.user as any).createdAt || Date.now()).toLocaleDateString('en-GB');

  const handleSave = async () => {
    if (!name.trim()) {
      showToast({ type: 'error', title: 'Error', body: 'Name is required' });
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
          address: { street, city, state: stateStr, zipCode },
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to update profile');

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
    } catch (err: any) {
      showToast({ type: 'error', title: 'Error', body: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={st.root}>
      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <View style={st.headerContainer}>
        <View style={st.headerTopRow}>
          {isEditing ? (
            <TouchableOpacity hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }} onPress={() => setIsEditing(false)} style={st.headerActionLeft}>
              <Text style={[st.actionIcon, { fontSize: 28, fontWeight: '900', marginTop: -4 }]}>‹</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }} onPress={onBackToHome} style={st.headerActionLeft}>
              <Text style={[st.actionIcon, { fontSize: 28, fontWeight: '900', marginTop: -4 }]}>‹</Text>
            </TouchableOpacity>
          )}

          <Text style={st.headerTitle}>{isEditing ? 'Profile' : 'Menu'}</Text>

          {isEditing ? (
            <TouchableOpacity hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }} onPress={() => { }} style={st.headerActionBtn}>
              <Text style={[st.actionIcon, { fontSize: 22, fontWeight: '800' }]}>✎</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }} onPress={() => setIsEditing(true)} style={st.headerActionBtn}>
              <Text style={[st.actionIcon, { fontSize: 26, fontWeight: '900', marginTop: -6, letterSpacing: 2 }]}>⋯</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={st.profileInfoRow}>
          <View style={st.avatar}>
            <Image
              source={{ uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(session.user.name)}&background=F3E8FF&color=9333EA` }}
              style={st.avatarImg}
            />
          </View>

          <View style={st.profileTextCol}>
            <View style={st.nameRow}>
              <Text style={st.userName}>{session.user.name}</Text>
              <Text style={st.verifiedBadge}>✔</Text>
            </View>
            <Text style={st.joinDate}>{joinDate}</Text>
          </View>

          {/* Pedestal & Crown Group */}
          <View style={st.crownGroup}>
            <View style={st.lightBeam} />

            {/* The 3D CSS Pedestal */}
            <View style={st.pedestalContainer}>
              <View style={st.pedestalBody} />
              <View style={st.pedestalTop} />
            </View>

            {/* The Crown Image */}
            <Image
              source={require('../../assets/images/09f9a17303b4f9923d064b5e070a937cd0bec10d.png')}
              style={st.crownImg}
              resizeMode="contain"
            />
          </View>

        </View>
        <View style={st.headerCurve} />
      </View>

      {/* ── CONTENT ──────────────────────────────────────────────────────── */}
      <ScrollView style={st.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {isEditing ? (
          <View style={st.formContainer}>
            <View style={st.inputGroup}>
              <Text style={st.label}>Name</Text>
              <TextInput style={st.input} value={name} onChangeText={setName} />
            </View>

            <View style={st.inputGroup}>
              <Text style={st.label}>Phone</Text>
              <TextInput style={[st.input, { color: '#111' }]} value={session.user.phone} editable={false} />
            </View>

            <View style={st.inputGroup}>
              <Text style={st.label}>Email</Text>
              <TextInput style={st.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            </View>

          </View>
        ) : (
          <View style={st.menuContainer}>

            <TouchableOpacity style={st.menuRow} onPress={onOpenOrders} activeOpacity={0.7}>
              <View style={st.menuIconWrap}><ReceiptIcon size={24} color="#D97706" /></View>
              <Text style={st.menuText}>Your order</Text>
              <Text style={st.chevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={st.menuRow} onPress={() => setLocModalVisible(true)} activeOpacity={0.7}>
              <View style={st.menuIconWrap}><LocationPinIcon size={26} color="#EF4444" /></View>
              <Text style={st.menuText}>Saved Address</Text>
              <Text style={st.chevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={st.menuRow} onPress={onApplyPress} activeOpacity={0.7}>
              <View style={st.menuIconWrap}><BriefcaseIcon size={24} color="#8B5CF6" /></View>
              <Text style={st.menuText}>Partner with TownPulse</Text>
              <Text style={st.chevron}>›</Text>
            </TouchableOpacity>

          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <View style={st.footer}>
        {isEditing ? (
          <PressableScale onPress={handleSave} disabled={saving} style={st.editBtn}>
            {saving ? <ActivityIndicator color="#111" /> : <Text style={st.editBtnText}>✎ Edit</Text>}
          </PressableScale>
        ) : (
          <TouchableOpacity style={st.logOutBtn} onPress={onSignOut}>
            <Text style={st.logOutText}>Log Out</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── MODALS ───────────────────────────────────────────────────────── */}
      <LocationSelectorModal
        visible={locModalVisible}
        idToken={session.idToken}
        onClose={() => setLocModalVisible(false)}
        onSelect={() => {
          // Address saves in backend automatically. Close modal and sync session.
          setLocModalVisible(false);
          // Optional: Re-fetch session to reflect new default address if needed.
        }}
      />
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB' },

  // Header
  headerContainer: {
    backgroundColor: '#374151', // Darker slate grey background
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 40,
    position: 'relative',
    zIndex: 1,
  },
  headerCurve: {
    position: 'absolute',
    bottom: -30,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: '#374151',
    borderBottomLeftRadius: 120,
    borderBottomRightRadius: 120,
    transform: [{ scaleX: 1.5 }],
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    position: 'relative',
    height: 40,
  },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  headerActionLeft: { position: 'absolute', left: 0, top: -30, padding: 10, zIndex: 10 },
  headerActionBtn: { position: 'absolute', right: 0, top: -30, padding: 10, zIndex: 10 },
  actionIcon: { color: '#FFF', fontSize: 20 },

  profileInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    zIndex: 2,
  },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#F3F4F6',
    borderWidth: 2, borderColor: '#FFF',
    overflow: 'hidden',
    marginRight: 16,
  },
  avatarImg: { width: '100%', height: '100%' },

  profileTextCol: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  userName: { color: '#FFF', fontSize: 18, fontWeight: '800', marginRight: 6 },
  verifiedBadge: { color: '#3B82F6', fontSize: 14 },
  joinDate: { color: '#9CA3AF', fontSize: 12 },

  // Crown & Pedestal
  crownGroup: {
    position: 'absolute',
    right: -10,
    top: -15,
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pedestalContainer: {
    position: 'absolute',
    bottom: 5, // Push pedestal down
    width: 100,
    height: 40,
    zIndex: 2,
  },
  lightBeam: {
    position: 'absolute',
    bottom: 25,
    width: 0,
    height: 0,
    borderTopWidth: 80,
    borderLeftWidth: 45,
    borderRightWidth: 45,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    zIndex: 1,
  },
  pedestalTop: {
    position: 'absolute',
    top: 0,
    width: 100,
    height: 20,
    backgroundColor: '#D1D5DB', // Light grey oval top
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#9CA3AF',
    zIndex: 2,
  },
  pedestalBody: {
    position: 'absolute',
    top: 10, // Starts halfway down the top oval
    width: 100,
    height: 40, // Extends downwards
    backgroundColor: '#6B7280', // Darker body
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 50,
    zIndex: 1,
  },
  crownImg: {
    position: 'absolute',
    top: -10, // Crown hovers slightly above pedestal
    width: 120,
    height: 120,
    zIndex: 3,
  },

  // Content
  content: {
    flex: 1,
    paddingTop: 40,
    paddingHorizontal: 24,
    zIndex: 0,
  },

  // Menu List
  menuContainer: { gap: 8 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuIconWrap: { width: 32, alignItems: 'center', marginRight: 16 },
  menuText: { flex: 1, fontSize: 15, color: '#111827', fontWeight: '600' },
  chevron: { fontSize: 20, color: '#9CA3AF' },

  // Edit Form
  formContainer: { gap: 20 },
  inputGroup: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 8 },
  label: { fontSize: 12, color: '#9CA3AF', fontWeight: '600', marginBottom: 4 },
  input: { fontSize: 16, color: '#111827', fontWeight: '700', paddingVertical: 4, paddingHorizontal: 0, minHeight: 40 },

  // Footer
  footer: {
    padding: 24,
    paddingBottom: 40,
    backgroundColor: '#F9FAFB',
  },
  logOutBtn: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  logOutText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '700',
  },
  editBtn: {
    backgroundColor: '#FBC02D',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  editBtnText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
  },
});
