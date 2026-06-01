import React, { useEffect, useState } from 'react';
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

type Props = {
  idToken: string;
  onBack: () => void;
};

type AppType = 'restaurant' | 'delivery' | null;

export default function ApplicationFormScreen({ idToken, onBack }: Props) {
  const [appType, setAppType] = useState<AppType>(null);
  const [submitting, setSubmitting] = useState(false);
  const [existingApps, setExistingApps] = useState<any[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);

  // Restaurant Form State
  const [rName, setRName] = useState('');
  const [rEmail, setREmail] = useState('');
  const [rPhone, setRPhone] = useState('');
  const [rType, setRType] = useState<'RESTAURANT' | 'CLOUD_KITCHEN'>('RESTAURANT');
  const [rCuisine, setRCuisine] = useState('');
  const [rStreet, setRStreet] = useState('');
  const [rCity, setRCity] = useState('');
  const [rState, setRState] = useState('');
  const [rZip, setRZip] = useState('');
  const [rDesc, setRDesc] = useState('');

  // Delivery Form State
  const [dVehicle, setDVehicle] = useState<'BIKE' | 'BICYCLE' | 'CAR' | 'SCOOTER'>('BIKE');
  const [dVehicleNum, setDVehicleNum] = useState('');
  const [dLicense, setDLicense] = useState('');
  const [dCnic, setDCnic] = useState('');

  useEffect(() => {
    fetchExistingApps();
  }, []);

  const fetchExistingApps = async () => {
    try {
      const res = await fetch(`${appConfig.apiBaseUrl}/api/applications/mine`, {
        headers: { Authorization: `Bearer ${idToken}` }
      });
      const json = await res.json();
      if (json.success) setExistingApps(json.applications);
    } catch (err) {
      console.warn('Failed to fetch applications', err);
    } finally {
      setLoadingApps(false);
    }
  };

  const handleSubmit = async () => {
    if (appType === 'restaurant') {
      if (!rName || !rEmail || !rPhone || !rCuisine || !rStreet || !rCity) {
        return Alert.alert('Error', 'Please fill all required fields');
      }
    } else if (appType === 'delivery') {
      if (!dVehicleNum || !dLicense || !dCnic) {
        return Alert.alert('Error', 'Please fill all required fields');
      }
      if (dCnic.length !== 13) {
        return Alert.alert('Error', 'Aadhar must be exactly 12 digits');
      }
    }

    try {
      setSubmitting(true);
      const endpoint = appType === 'restaurant' ? '/api/applications/restaurant' : '/api/applications/delivery';
      
      const payload = appType === 'restaurant' 
        ? {
            name: rName, email: rEmail, phone: rPhone, restaurantType: rType,
            cuisine: rCuisine.split(',').map(s => s.trim()).filter(Boolean),
            address: { street: rStreet, city: rCity, state: rState, zipCode: rZip },
            description: rDesc
          }
        : {
            vehicleType: dVehicle, vehicleNumber: dVehicleNum,
            licenseNumber: dLicense, cnicNumber: dCnic
          };

      const res = await fetch(`${appConfig.apiBaseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      
      if (!res.ok || !json.success) throw new Error(json.message);

      Alert.alert('Success', json.message, [{ text: 'OK', onPress: () => {
        setAppType(null);
        fetchExistingApps();
      }}]);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    let color = '#F59E0B'; // Pending
    if (status === 'approved') color = '#10B981';
    if (status === 'rejected') color = '#EF4444';
    
    return (
      <View style={[st.badge, { backgroundColor: color }]}>
        <Text style={st.badgeText}>{status.toUpperCase()}</Text>
      </View>
    );
  };

  if (appType === null) {
    return (
      <ScrollView style={st.root} contentContainerStyle={st.content}>
        <View style={st.header}>
          <TouchableOpacity onPress={onBack} style={st.backBtn}>
            <Text style={st.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={st.headerTitle}>Partner with Us</Text>
          <View style={{ width: 40 }} />
        </View>

        <TouchableOpacity style={st.optionCard} onPress={() => setAppType('restaurant')} activeOpacity={0.8}>
          <Text style={st.optionEmoji}>🍽️</Text>
          <Text style={st.optionTitle}>Open a Restaurant</Text>
          <Text style={st.optionDesc}>Sell your food to thousands of customers in your city.</Text>
        </TouchableOpacity>

        <TouchableOpacity style={st.optionCard} onPress={() => setAppType('delivery')} activeOpacity={0.8}>
          <Text style={st.optionEmoji}>🛵</Text>
          <Text style={st.optionTitle}>Become a Delivery Partner</Text>
          <Text style={st.optionDesc}>Earn money by delivering food on your own schedule.</Text>
        </TouchableOpacity>

        {loadingApps ? (
          <ActivityIndicator color="#F5C116" style={{ marginTop: 40 }} />
        ) : existingApps.length > 0 ? (
          <View style={st.existingSection}>
            <Text style={st.sectionTitle}>Your Applications</Text>
            {existingApps.map((app) => (
              <View key={app._id} style={st.appCard}>
                <View style={st.appHeader}>
                  <Text style={st.appType}>{app.type === 'restaurant' ? '🍽️ Restaurant' : '🛵 Delivery Partner'}</Text>
                  {renderStatusBadge(app.status)}
                </View>
                <Text style={st.appDate}>Applied on {new Date(app.createdAt).toLocaleDateString()}</Text>
                {app.adminNote ? (
                  <View style={st.noteBox}>
                    <Text style={st.noteText}><Text style={{ fontWeight: 'bold' }}>Note:</Text> {app.adminNote}</Text>
                  </View>
                ) : null}
                {app.status === 'approved' && (
                  <Text style={st.successMsg}>✓ Approved. Your role will update on next sign-in.</Text>
                )}
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    );
  }

  return (
    <ScrollView style={st.root} contentContainerStyle={st.content}>
      <View style={st.header}>
        <TouchableOpacity onPress={() => setAppType(null)} style={st.backBtn}>
          <Text style={st.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={st.headerTitle}>{appType === 'restaurant' ? 'Restaurant Application' : 'Delivery Application'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={st.formCard}>
        {appType === 'restaurant' && (
          <View style={st.formGroup}>
            <Text style={st.label}>Restaurant Name *</Text>
            <TextInput style={st.input} value={rName} onChangeText={setRName} placeholder="TownPulse Cafe" />

            <Text style={st.label}>Business Email *</Text>
            <TextInput style={st.input} value={rEmail} onChangeText={setREmail} keyboardType="email-address" autoCapitalize="none" />

            <Text style={st.label}>Business Phone *</Text>
            <TextInput style={st.input} value={rPhone} onChangeText={setRPhone} keyboardType="phone-pad" />

            <Text style={st.label}>Restaurant Type *</Text>
            <View style={st.row}>
              <TouchableOpacity style={[st.radio, rType === 'RESTAURANT' && st.radioActive]} onPress={() => setRType('RESTAURANT')}>
                <Text style={[st.radioText, rType === 'RESTAURANT' && st.radioTextActive]}>Restaurant</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.radio, rType === 'CLOUD_KITCHEN' && st.radioActive]} onPress={() => setRType('CLOUD_KITCHEN')}>
                <Text style={[st.radioText, rType === 'CLOUD_KITCHEN' && st.radioTextActive]}>Cloud Kitchen</Text>
              </TouchableOpacity>
            </View>

            <Text style={st.label}>Cuisines (comma separated) *</Text>
            <TextInput style={st.input} value={rCuisine} onChangeText={setRCuisine} placeholder="Indian, Chinese, Fast Food" />

            <Text style={st.sectionSub}>Location Details</Text>
            <Text style={st.label}>Street *</Text>
            <TextInput style={st.input} value={rStreet} onChangeText={setRStreet} />
            <Text style={st.label}>City *</Text>
            <TextInput style={st.input} value={rCity} onChangeText={setRCity} />
            <View style={st.row}>
              <View style={{ flex: 1 }}>
                <Text style={st.label}>State</Text>
                <TextInput style={st.input} value={rState} onChangeText={setRState} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.label}>Zip</Text>
                <TextInput style={st.input} value={rZip} onChangeText={setRZip} />
              </View>
            </View>

            <Text style={st.label}>Description</Text>
            <TextInput style={[st.input, { height: 80 }]} value={rDesc} onChangeText={setRDesc} multiline textAlignVertical="top" />
          </View>
        )}

        {appType === 'delivery' && (
          <View style={st.formGroup}>
            <Text style={st.label}>Vehicle Type *</Text>
            <View style={st.rowWrap}>
              {['BIKE', 'BICYCLE', 'CAR', 'SCOOTER'].map((vt) => (
                <TouchableOpacity key={vt} style={[st.radio, dVehicle === vt && st.radioActive]} onPress={() => setDVehicle(vt as any)}>
                  <Text style={[st.radioText, dVehicle === vt && st.radioTextActive]}>{vt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={st.label}>Vehicle Registration Number *</Text>
            <TextInput style={st.input} value={dVehicleNum} onChangeText={setDVehicleNum} placeholder="MH 01 AB 1234" autoCapitalize="characters" />

            <Text style={st.label}>Driving License Number *</Text>
            <TextInput style={st.input} value={dLicense} onChangeText={setDLicense} autoCapitalize="characters" />

            <Text style={st.label}>aadhar/ National ID Number (12 Digits) *</Text>
            <TextInput style={st.input} value={dCnic} onChangeText={setDCnic} keyboardType="number-pad" maxLength={13} placeholder="1234567890123" />
          </View>
        )}

        <TouchableOpacity style={st.submitBtn} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={st.submitBtnText}>Submit Application</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F4F6' },
  content: { padding: 20, paddingTop: 50, paddingBottom: 40 },
  
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FAE08B', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  backIcon: { fontSize: 20, color: '#111827', fontWeight: 'bold' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },

  optionCard: { backgroundColor: '#FAE08B', borderRadius: 16, padding: 24, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 3, alignItems: 'center' },
  optionEmoji: { fontSize: 48, marginBottom: 12 },
  optionTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6 },
  optionDesc: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },

  existingSection: { marginTop: 32 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 16 },
  appCard: { backgroundColor: '#FAE08B', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  appHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  appType: { fontSize: 16, fontWeight: '700', color: '#111827' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  appDate: { fontSize: 13, color: '#6B7280', marginBottom: 8 },
  noteBox: { backgroundColor: '#FEF2F2', padding: 12, borderRadius: 8, marginTop: 8 },
  noteText: { fontSize: 13, color: '#D4A510' },
  successMsg: { color: '#10B981', fontSize: 13, fontWeight: '600', marginTop: 8 },

  formCard: { backgroundColor: '#FAE08B', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 3 },
  formGroup: { gap: 12, marginBottom: 24 },
  sectionSub: { fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 12, marginBottom: 4 },
  label: { fontSize: 13, color: '#4B5563', fontWeight: '600' },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#111827' },
  
  row: { flexDirection: 'row', gap: 12 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  radio: { flex: 1, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, backgroundColor: '#F9FAFB' },
  radioActive: { borderColor: '#F5C116', backgroundColor: '#FEF2F2' },
  radioText: { color: '#4B5563', fontWeight: '600', fontSize: 13 },
  radioTextActive: { color: '#F5C116' },

  submitBtn: { backgroundColor: '#F5C116', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});


