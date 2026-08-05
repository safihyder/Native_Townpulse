import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Text, FlatList, TextInput, ActivityIndicator, Linking, Platform } from 'react-native';
import { getAddresses, addAddress, deleteAddress } from '../../services/userApi';
import { fetchLiveLocation, reverseGeocode } from '../../services/locationService';
import { MapAddressPickerModal } from './MapAddressPickerModal';
import { LocationPinIcon, ClockIcon, SearchIcon } from '../../components/SvgIcons'; // Re-use some icons or add generic ones
import { useToast } from '../../context/ToastContext';

type Props = {
  visible: boolean;
  idToken: string;
  onClose: () => void;
  onSelect: (addressInfo: { name: string, fullAddress: string, lat?: number, lng?: number }) => void;
};

export function LocationSelectorModal({ visible, idToken, onClose, onSelect }: Props) {
  const { showToast } = useToast();
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Add form state
  const [newName, setNewName] = useState('Home');
  const [newFullAddress, setNewFullAddress] = useState('');
  const [newCoords, setNewCoords] = useState<{lat: number, lng: number} | null>(null);
  const [coordsSource, setCoordsSource] = useState<'map' | 'live' | null>(null);

  useEffect(() => {
    if (visible) loadAddresses();
  }, [visible]);

  const loadAddresses = async () => {
    setLoading(true);
    try {
      const res = await getAddresses(idToken);
      setAddresses(res.addresses || []);
    } catch (e) {
      console.log('Failed to load addresses', e);
    } finally {
      setLoading(false);
    }
  };

  const showLocationError = async (err: any) => {
    // Only redirect to GPS settings if GPS is TRULY off (not just a timeout/network issue)
    if (Platform.OS === 'android') {
      const { checkLocationServicesEnabled } = require('../../services/locationService');
      const gpsOn = await checkLocationServicesEnabled();
      if (!gpsOn) {
        showToast({ type: 'warning', title: 'Location Disabled', body: 'Please turn on your device GPS (Location) to fetch your live location.' });
        Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(() => {});
      } else {
        // GPS is on but location fetch failed (timeout, weak signal, etc.)
        showToast({ type: 'error', title: 'Location Failed', body: 'Could not get your location. Please try again — make sure you are in an open area.' });
      }
    } else {
      showToast({ type: 'error', title: 'Location Error', body: err.message || 'Failed to get live location. Please enable location services.' });
    }
  };

  const [fetchingLive, setFetchingLive] = useState(false);

  const handleLiveLocation = async () => {
    setFetchingLive(true);
    try {
      const loc = await fetchLiveLocation();
      onSelect({ name: 'Current Location', fullAddress: loc.address, lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch (err: any) {
      showLocationError(err);
    } finally {
      setFetchingLive(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await deleteAddress(idToken, id);
      setAddresses(res.addresses || []);
    } catch (e) {
      showToast({ type: 'error', title: 'Error', body: 'Failed to delete address' });
    }
  };

  const handleSaveNewAddress = async () => {
    if (!newFullAddress || !newCoords) {
      showToast({ type: 'error', title: 'Error', body: 'Please provide an address and pick a location on the map' });
      return;
    }
    try {
      setLoading(true);
      const res = await addAddress(idToken, {
        name: newName,
        fullAddress: newFullAddress,
        coordinates: newCoords
      });
      setAddresses(res.addresses || []);
      setShowAddForm(false);
      setNewFullAddress('');
      setNewCoords(null);
    } catch (e) {
      showToast({ type: 'error', title: 'Error', body: 'Failed to save address' });
    } finally {
      setLoading(false);
    }
  };

  const [fetchingLiveLoc, setFetchingLiveLoc] = useState(false);

  const handleFillLiveLocation = async () => {
    setFetchingLiveLoc(true);
    try {
      const loc = await fetchLiveLocation();
      setNewFullAddress(loc.address);
      setNewCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      setCoordsSource('live');
    } catch (err: any) {
      showLocationError(err);
    } finally {
      setFetchingLiveLoc(false);
    }
  };

  const renderAddForm = () => (
    <View style={s.addForm}>
      <Text style={s.sectionTitle}>Add New Location</Text>
      
      <Text style={s.label}>Label (e.g. Home, Work)</Text>
      <TextInput style={s.input} value={newName} onChangeText={setNewName} placeholder="Home" />

      <View style={s.labelRow}>
        <Text style={s.label}>Address Details</Text>
        <TouchableOpacity onPress={handleFillLiveLocation} disabled={fetchingLiveLoc} style={s.liveFillBtn}>
          <Text style={s.liveFillTxt}>{fetchingLiveLoc ? 'Fetching...' : '📍 Auto-fill live location'}</Text>
        </TouchableOpacity>
      </View>

      <TextInput 
        style={[s.input, { height: 60 }]} 
        value={newFullAddress} 
        onChangeText={setNewFullAddress} 
        placeholder="Flat No, Street Name, Area..." 
        multiline
      />

      <TouchableOpacity style={s.mapBtn} onPress={() => setShowMapPicker(true)}>
        <LocationPinIcon size={18} color="#F5A623" />
        <Text style={s.mapBtnTxt}>
          {!newCoords 
            ? 'Tap to mark on map' 
            : coordsSource === 'live' 
              ? 'Exact Live Location Saved ✓' 
              : 'Location Marked on Map ✓'}
        </Text>
      </TouchableOpacity>

      <View style={s.row}>
        <TouchableOpacity style={[s.btn, s.btnCancel]} onPress={() => setShowAddForm(false)}>
          <Text style={s.btnCancelTxt}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, s.btnSave]} onPress={handleSaveNewAddress}>
          <Text style={s.btnSaveTxt}>Save Address</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.container}>
          <View style={s.header}>
            <Text style={s.title}>Select a location</Text>
            <TouchableOpacity onPress={onClose}><Text style={s.closeTxt}>Close</Text></TouchableOpacity>
          </View>

          {showAddForm ? (
            renderAddForm()
          ) : (
            <View style={s.listContainer}>
              <TouchableOpacity style={s.liveLocBtn} onPress={handleLiveLocation} disabled={fetchingLive}>
                {fetchingLive ? <ActivityIndicator size="small" color="#EF4444" /> : <LocationPinIcon size={22} color="#EF4444" />}
                <Text style={s.liveLocTxt}>{fetchingLive ? 'Fetching location...' : 'Use current live location'}</Text>
              </TouchableOpacity>

              <Text style={s.sectionTitle}>Saved Addresses</Text>
              {loading ? (
                <ActivityIndicator size="small" color="#F5A623" style={{ marginVertical: 20 }} />
              ) : addresses.length === 0 ? (
                <Text style={s.emptyTxt}>No saved addresses found.</Text>
              ) : (
                <FlatList
                  data={addresses}
                  keyExtractor={item => item._id}
                  renderItem={({ item }) => (
                    <View style={s.addressRow}>
                      <TouchableOpacity 
                        style={s.addressContent} 
                        onPress={() => onSelect({ name: item.name, fullAddress: item.fullAddress, lat: item.coordinates?.lat, lng: item.coordinates?.lng })}
                      >
                        <View style={s.iconCircle}><LocationPinIcon size={16} color="#6B7280" /></View>
                        <View style={s.addressTextCol}>
                          <Text style={s.addressName}>{item.name}</Text>
                          <Text style={s.addressDetail} numberOfLines={2}>{item.fullAddress}</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDelete(item._id)} style={s.deleteBtn}>
                        <Text style={s.deleteTxt}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                />
              )}

              <TouchableOpacity style={s.addNewBtn} onPress={() => setShowAddForm(true)}>
                <Text style={s.addNewTxt}>+ Add new address</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <MapAddressPickerModal
        visible={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        initialLat={28.6139} // fallback
        initialLng={77.2090} // fallback
        onSelectLocation={async (lat, lng) => {
          setNewCoords({ lat, lng });
          setCoordsSource('map');
          setShowMapPicker(false);
          if (!newFullAddress) {
            const addr = await reverseGeocode({ latitude: lat, longitude: lng });
            setNewFullAddress(addr);
          }
        }}
      />
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  container: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', minHeight: '50%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderColor: '#F3F4F6' },
  title: { fontSize: 18, fontWeight: '800', color: '#1C2434' },
  closeTxt: { color: '#6B7280', fontWeight: '600', fontSize: 15 },
  listContainer: { padding: 20 },
  liveLocBtn: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#FEF2F2', borderRadius: 12, marginBottom: 24 },
  liveLocTxt: { color: '#EF4444', fontWeight: '700', fontSize: 16, marginLeft: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1C2434', marginBottom: 16 },
  emptyTxt: { color: '#9CA3AF', marginBottom: 16 },
  addressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderColor: '#F3F4F6' },
  addressContent: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  iconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  addressTextCol: { flex: 1 },
  addressName: { fontSize: 15, fontWeight: '700', color: '#1C2434' },
  addressDetail: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  deleteBtn: { padding: 8 },
  deleteTxt: { color: '#EF4444', fontSize: 13, fontWeight: '600' },
  addNewBtn: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center', borderStyle: 'dashed', marginTop: 8 },
  addNewTxt: { color: '#1C2434', fontWeight: '700' },
  
  // Add form
  addForm: { padding: 20 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 6 },
  liveFillBtn: { backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  liveFillTxt: { color: '#4F46E5', fontSize: 12, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', color: '#4B5563' },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1C2434' },
  mapBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFBEB', padding: 14, borderRadius: 12, marginTop: 16, borderWidth: 1, borderColor: '#FDE68A' },
  mapBtnTxt: { color: '#D97706', fontWeight: '600', marginLeft: 8 },
  row: { flexDirection: 'row', gap: 12, marginTop: 24 },
  btn: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  btnCancel: { backgroundColor: '#F3F4F6' },
  btnCancelTxt: { color: '#4B5563', fontWeight: '700' },
  btnSave: { backgroundColor: '#F5A623' },
  btnSaveTxt: { color: '#FFF', fontWeight: '800' },
});
