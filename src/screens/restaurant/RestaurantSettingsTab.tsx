import React, { useMemo, useState } from 'react';
import {
  FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Switch,
  Text, TextInput, Vibration, View,
} from 'react-native';
import { useToast } from '../../context/ToastContext';
import { launchImageLibrary } from 'react-native-image-picker';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { ActionButton } from '../../components/ActionButton';
import { appConfig } from '../../config/appConfig';
import { getFreshFirebaseIdToken } from '../../services/firebaseAuth';

type DayKey = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
type BusinessHourEntry = { day: DayKey; isOpen: boolean; openTime: string; closeTime: string };

const DAYS: DayKey[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const DEFAULT_HOURS: BusinessHourEntry[] = DAYS.map(d => ({ day: d, isOpen: true, openTime: '09:00', closeTime: '22:00' }));

type Props = {
  restaurant: any;
  setRestaurant: (r: any) => void;
  isRestaurantOpen: boolean;
  apiFetch: (path: string, opts?: any) => Promise<any>;
  onSignOut: () => void;
};

type StagedAsset = { uri: string; fileName: string; type: string };

export function RestaurantSettingsTab({ restaurant, setRestaurant, isRestaurantOpen, apiFetch, onSignOut }: Props) {
  const { showToast } = useToast();
  const getToken = async () => getFreshFirebaseIdToken();

  // Edit restaurant
  const [isEditing, setIsEditing] = useState(false);
  const [editDesc, setEditDesc] = useState(restaurant?.description || '');
  const [editName, setEditName] = useState(restaurant?.name || '');
  const [stagedBanners, setStagedBanners] = useState<StagedAsset[]>([]);
  const [stagedLogo, setStagedLogo] = useState<StagedAsset | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ active: false, pct: 0 });

  // Manual close
  const isManualClosedValid = (status: any) => {
    if (!status?.isClosed) return false;
    if (!status.closedSince) return false;
    const hours = (new Date().getTime() - new Date(status.closedSince).getTime()) / (1000 * 60 * 60);
    return hours <= 24;
  };
  const [manualClosed, setManualClosed] = useState(isManualClosedValid(restaurant?.manualStatus));
  const [manualReason, setManualReason] = useState(restaurant?.manualStatus?.reason || '');

  // Scheduled closure
  const [schedFrom, setSchedFrom] = useState(restaurant?.scheduledClosure?.from?.split('T')[0] || '');
  const [schedUntil, setSchedUntil] = useState(restaurant?.scheduledClosure?.until?.split('T')[0] || '');
  const [schedReason, setSchedReason] = useState(restaurant?.scheduledClosure?.reason || '');
  const [showCalendar, setShowCalendar] = useState<'from' | 'until' | null>(null);

  // Timetable
  const [businessHours, setBusinessHours] = useState<BusinessHourEntry[]>(restaurant?.businessHours?.length > 0 ? restaurant.businessHours : DEFAULT_HOURS);
  const [clockPickerVisible, setClockPickerVisible] = useState(false);
  const [clockTarget, setClockTarget] = useState<{ dayIdx: number; field: 'openTime' | 'closeTime' } | null>(null);
  const [clockHour, setClockHour] = useState(9);
  const [clockMinute, setClockMinute] = useState(0);
  const [clockPeriod, setClockPeriod] = useState<'AM' | 'PM'>('AM');

  // Calendar
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfWeek = (y: number, m: number) => new Date(y, m, 1).getDay();

  const patchRestaurant = async (payload: any) => {
    const json = await apiFetch(`/api/restaurants/${restaurant.restaurantId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setRestaurant(json.restaurant);
    setManualClosed(isManualClosedValid(json.restaurant.manualStatus));
    return json;
  };

  const handleToggleManualClose = async (val: boolean) => {
    setManualClosed(val);
    try { await patchRestaurant({ manualStatus: { isClosed: val, reason: manualReason } }); }
    catch (err: any) { showToast({ type: 'error', title: 'Error', body: err.message }); }
  };

  const handleSaveManualStatus = async () => {
    try {
      setIsSaving(true);
      await patchRestaurant({ manualStatus: { isClosed: manualClosed, reason: manualReason } });
      showToast({ type: 'success', title: 'Saved', body: 'Status updated!' });
    } catch (err: any) { showToast({ type: 'error', title: 'Error', body: err.message }); }
    finally { setIsSaving(false); }
  };

  const handleSaveScheduledClosure = async () => {
    try {
      setIsSaving(true);
      await patchRestaurant({ scheduledClosure: { from: schedFrom, until: schedUntil, reason: schedReason } });
      showToast({ type: 'success', title: 'Saved', body: 'Scheduled closure saved!' });
    } catch (err: any) { showToast({ type: 'error', title: 'Error', body: err.message }); }
    finally { setIsSaving(false); }
  };

  const handleClearScheduledClosure = async () => {
    setSchedFrom(''); setSchedUntil(''); setSchedReason('');
    try {
      setIsSaving(true);
      await patchRestaurant({ scheduledClosure: { from: '', until: '', reason: '' } });
      showToast({ type: 'success', title: 'Cleared', body: 'Scheduled closure cleared!' });
    } catch (err: any) { showToast({ type: 'error', title: 'Error', body: err.message }); }
    finally { setIsSaving(false); }
  };

  const handleSaveTimetable = async () => {
    try {
      setIsSaving(true);
      await patchRestaurant({ businessHours });
      showToast({ type: 'success', title: 'Saved', body: 'Business hours updated!' });
    } catch (err: any) { showToast({ type: 'error', title: 'Error', body: err.message }); }
    finally { setIsSaving(false); }
  };

  const openClockPicker = (dayIdx: number, field: 'openTime' | 'closeTime') => {
    const currentTime = businessHours[dayIdx][field] || '09:00 AM';
    let hStr: string, mStr: string, isPm = false;
    if (currentTime.includes(' ')) {
      const [time, period] = currentTime.split(' ');
      [hStr, mStr] = time.split(':');
      isPm = period.toUpperCase() === 'PM';
    } else {
      [hStr, mStr] = currentTime.split(':');
      const hInt = parseInt(hStr, 10);
      isPm = hInt >= 12;
    }
    let hl = parseInt(hStr!, 10);
    if (!currentTime.includes(' ')) hl = hl % 12 || 12;
    const ml = parseInt(mStr!, 10) || 0;
    setClockHour(hl); setClockMinute(ml); setClockPeriod(isPm ? 'PM' : 'AM');
    setClockTarget({ dayIdx, field }); setClockPickerVisible(true);
  };

  const applyClockTime = () => {
    if (!clockTarget) return;
    const formatted = `${String(clockHour).padStart(2, '0')}:${String(clockMinute).padStart(2, '0')} ${clockPeriod}`;
    setBusinessHours(prev => prev.map((h, idx) => idx === clockTarget.dayIdx ? { ...h, [clockTarget.field]: formatted } : h));
    setClockPickerVisible(false);
  };

  const selectCalendarDate = (day: number) => {
    const ds = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (showCalendar === 'from') setSchedFrom(ds);
    else setSchedUntil(ds);
    setShowCalendar(null);
  };

  const handleRemoveBannerImage = async (imageUrl: string) => {
    try {
      const token = await getToken();
      const res = await fetch(`${appConfig.apiBaseUrl}/api/restaurants/${restaurant.restaurantId}/banner/remove`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setRestaurant((prev: any) => prev ? { ...prev, banner: json.restaurant.banner } : prev);
      showToast({ type: 'success', title: 'Removed', body: 'Banner image removed' });
    } catch (err: any) { showToast({ type: 'error', title: 'Error', body: err.message }); }
  };

  const pickBannersLocally = async () => {
    const uploadedCount = Array.isArray(restaurant?.banner) ? restaurant.banner.length : (restaurant?.banner ? 1 : 0);
    const slotsLeft = Math.max(0, 8 - uploadedCount - stagedBanners.length);
    if (slotsLeft === 0) { showToast({ type: 'warning', title: 'Limit Reached', body: 'You have 8 banners already.' }); return; }
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, maxWidth: 1280, maxHeight: 720, selectionLimit: slotsLeft });
    if (!result.assets || result.didCancel) return;
    const newAssets: StagedAsset[] = result.assets.map(a => ({ uri: a.uri!, fileName: a.fileName || `banner_${Date.now()}.jpg`, type: a.type || 'image/jpeg' }));
    setStagedBanners(prev => [...prev, ...newAssets].slice(0, 8));
  };

  const pickLogoLocally = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, maxWidth: 512, maxHeight: 512, selectionLimit: 1 });
    if (!result.assets || result.didCancel) return;
    const a = result.assets[0];
    setStagedLogo({ uri: a.uri!, fileName: a.fileName || `logo_${Date.now()}.jpg`, type: a.type || 'image/jpeg' });
  };

  const handleSaveRestaurant = async () => {
    try {
      setIsSaving(true);
      const token = await getToken();
      if (stagedLogo) {
        setUploadProgress({ active: true, pct: 0 });
        const logoResponse = await ReactNativeBlobUtil.fetch('PATCH', `${appConfig.apiBaseUrl}/api/restaurants/${restaurant.restaurantId}/image/logo`,
          { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
          [{ name: 'image', filename: stagedLogo.fileName, type: stagedLogo.type, data: ReactNativeBlobUtil.wrap(stagedLogo.uri.replace('file://', '')) }]
        ).uploadProgress((w, t) => setUploadProgress({ active: true, pct: w / t }));
        const logoJson = JSON.parse(logoResponse.data);
        if (logoResponse.respInfo.status >= 300) throw new Error(logoJson.message || 'Logo upload failed');
        setRestaurant((prev: any) => prev ? { ...prev, logo: logoJson.restaurant.logo } : prev);
        setStagedLogo(null);
      }
      if (stagedBanners.length > 0) {
        setUploadProgress({ active: true, pct: 0 });
        const formData = stagedBanners.map(a => ({ name: 'image', filename: a.fileName, type: a.type, data: ReactNativeBlobUtil.wrap(a.uri.replace('file://', '')) }));
        const bannerResponse = await ReactNativeBlobUtil.fetch('PATCH', `${appConfig.apiBaseUrl}/api/restaurants/${restaurant.restaurantId}/image/banner`,
          { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }, formData
        ).uploadProgress((w, t) => setUploadProgress({ active: true, pct: w / t }));
        const bannerJson = JSON.parse(bannerResponse.data);
        if (bannerResponse.respInfo.status >= 300) throw new Error(bannerJson.message || 'Banner upload failed');
        setRestaurant((prev: any) => prev ? { ...prev, banner: bannerJson.restaurant.banner } : prev);
        setStagedBanners([]);
      }
      setUploadProgress({ active: false, pct: 0 });
      const res = await fetch(`${appConfig.apiBaseUrl}/api/restaurants/${restaurant.restaurantId}`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, description: editDesc }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setRestaurant((prev: any) => prev ? { ...prev, name: json.restaurant.name, description: json.restaurant.description } : prev);
      setIsEditing(false);
      showToast({ type: 'success', title: 'Saved', body: 'Restaurant profile updated!' });
    } catch (err: any) {
      setUploadProgress({ active: false, pct: 0 });
      showToast({ type: 'error', title: 'Save Error', body: err.message });
    } finally { setIsSaving(false); }
  };

  return (
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {/* Upload overlay */}
      {uploadProgress.active && (
        <View style={s.uploadOverlay}>
          <View style={s.uploadBox}>
            <Text style={s.uploadTitle}>Uploading...</Text>
            <View style={s.uploadBar}><View style={[s.uploadBarFill, { width: `${Math.round(uploadProgress.pct * 100)}%` }]} /></View>
            <Text style={s.uploadPct}>{Math.round(uploadProgress.pct * 100)}%</Text>
          </View>
        </View>
      )}

      {/* Restaurant Profile */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Restaurant Profile</Text>

        {/* Banners preview */}
        {(Array.isArray(restaurant?.banner) ? restaurant.banner : (restaurant?.banner ? [restaurant.banner] : [])).length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {(Array.isArray(restaurant?.banner) ? restaurant.banner : [restaurant?.banner]).filter(Boolean).map((url: string, index: number) => (
              <View key={index} style={{ marginRight: 10, position: 'relative' }}>
                <Image source={{ uri: url }} style={{ height: 100, width: 220, borderRadius: 12, backgroundColor: '#F3F4F6' }} resizeMode="cover" />
                {isEditing && (
                  <Pressable onPress={() => handleRemoveBannerImage(url)} style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                    <Text style={{ color: '#FFF', fontSize: 10, fontWeight: 'bold' }}>{'\u2715'} Delete</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </ScrollView>
        )}

        {!isEditing ? (
          <View style={s.profileBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
              {restaurant?.logo && <Image source={{ uri: restaurant.logo }} style={{ height: 60, width: 60, borderRadius: 30, backgroundColor: '#F3F4F6' }} />}
              <View style={{ flex: 1 }}>
                <Text style={s.profileName}>{restaurant?.name}</Text>
                <Text style={s.profileDesc}>{restaurant?.description || 'No description set.'}</Text>
              </View>
            </View>
            <Pressable onPress={() => { setIsEditing(true); setEditName(restaurant?.name || ''); setEditDesc(restaurant?.description || ''); }} style={s.editPill}>
              <Text style={s.editPillText}>Edit Details & Photos</Text>
            </Pressable>
          </View>
        ) : (
          <View style={s.profileBox}>
            <Text style={s.label}>Restaurant Name</Text>
            <TextInput style={s.input} value={editName} onChangeText={setEditName} />
            <Text style={s.label}>Description</Text>
            <TextInput style={[s.input, { minHeight: 70, textAlignVertical: 'top' }]} value={editDesc} onChangeText={setEditDesc} multiline />

            <Text style={[s.label, { marginTop: 16 }]}>Logo</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              {(stagedLogo?.uri || restaurant?.logo) && (
                <Image source={{ uri: stagedLogo?.uri || restaurant.logo }} style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#F3F4F6' }} />
              )}
              <Pressable style={[s.actionBtn, { backgroundColor: '#EFF6FF' }]} onPress={pickLogoLocally}>
                <Text style={[s.actionBtnText, { color: '#2563EB' }]}>{stagedLogo ? 'Change Logo' : 'Pick Logo'}</Text>
              </Pressable>
              {stagedLogo && <Text style={{ color: '#F59E0B', fontSize: 11, fontWeight: '700' }}>Pending</Text>}
            </View>

            <Text style={[s.label, { marginTop: 8 }]}>
              Banners ({(Array.isArray(restaurant?.banner) ? restaurant.banner.length : 0) + stagedBanners.length}/8)
            </Text>

            {(Array.isArray(restaurant?.banner) ? restaurant.banner : (restaurant?.banner ? [restaurant.banner] : [])).filter(Boolean).map((url: string, i: number) => (
              <View key={`up-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <Image source={{ uri: url }} style={{ width: 110, height: 65, borderRadius: 8, backgroundColor: '#F3F4F6' }} resizeMode="cover" />
                <View style={{ flex: 1 }}><Text style={{ fontSize: 11, color: '#22C55E', fontWeight: '700' }}>Uploaded</Text></View>
                <Pressable onPress={() => handleRemoveBannerImage(url)} style={{ backgroundColor: '#FEF2F2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
                  <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '800' }}>{'\u2715'}</Text>
                </Pressable>
              </View>
            ))}

            {stagedBanners.map((asset, i) => (
              <View key={`st-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <Image source={{ uri: asset.uri }} style={{ width: 110, height: 65, borderRadius: 8, backgroundColor: '#F3F4F6' }} resizeMode="cover" />
                <View style={{ flex: 1 }}><Text style={{ fontSize: 11, color: '#F59E0B', fontWeight: '700' }}>Pending upload</Text></View>
                <Pressable onPress={() => setStagedBanners(prev => prev.filter((_, idx) => idx !== i))} style={{ backgroundColor: '#FFFBEB', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
                  <Text style={{ color: '#92400E', fontSize: 12, fontWeight: '800' }}>{'\u2715'}</Text>
                </Pressable>
              </View>
            ))}

            {(Array.isArray(restaurant?.banner) ? restaurant.banner.length : 0) + stagedBanners.length < 8 && (
              <Pressable style={[s.actionBtn, { backgroundColor: '#ECFDF5', marginTop: 6 }]} onPress={pickBannersLocally}>
                <Text style={[s.actionBtnText, { color: '#166534' }]}>
                  + Add Banners (up to {8 - (Array.isArray(restaurant?.banner) ? restaurant.banner.length : 0) - stagedBanners.length} more)
                </Text>
              </Pressable>
            )}

            <View style={{ marginTop: 16, gap: 8 }}>
              <ActionButton
                label={`Save${stagedBanners.length + (stagedLogo ? 1 : 0) > 0 ? ` & Upload ${stagedBanners.length + (stagedLogo ? 1 : 0)} Photo${stagedBanners.length + (stagedLogo ? 1 : 0) > 1 ? 's' : ''}` : ' Details'}`}
                onPress={handleSaveRestaurant} isLoading={isSaving}
              />
              <ActionButton label="Cancel" onPress={() => { setIsEditing(false); setStagedBanners([]); setStagedLogo(null); }} variant="secondary" />
            </View>
          </View>
        )}
      </View>

      {/* Manual Close */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Quick Close/Open</Text>
        <View style={s.switchRow}>
          <Text style={s.switchLabel}>Manually Closed</Text>
          <Switch value={manualClosed} onValueChange={handleToggleManualClose} trackColor={{ false: '#BBF7D0', true: '#FEE2E2' }} thumbColor={manualClosed ? '#EF4444' : '#22C55E'} />
        </View>
        {manualClosed && (
          <>
            <Text style={s.label}>Reason (optional)</Text>
            <TextInput style={s.input} value={manualReason} onChangeText={setManualReason} placeholder="e.g. Maintenance" placeholderTextColor="#CCC" />
            <View style={{ marginTop: 10 }}>
              <ActionButton label="Save Status" onPress={handleSaveManualStatus} isLoading={isSaving} />
            </View>
          </>
        )}
      </View>

      {/* Scheduled Closure */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Schedule Closure</Text>
        <Text style={s.muted}>Set a date range when your restaurant will be automatically closed.</Text>
        <Text style={s.label}>From</Text>
        <Pressable style={[s.input, s.datePickerBtn]} onPress={() => { setCalYear(new Date().getFullYear()); setCalMonth(new Date().getMonth()); setShowCalendar('from'); }}>
          <Text style={{ color: schedFrom ? '#1C2434' : '#CCC', fontSize: 15 }}>{schedFrom || 'Select start date'}</Text>
        </Pressable>
        <Text style={s.label}>Until</Text>
        <Pressable style={[s.input, s.datePickerBtn]} onPress={() => { setCalYear(new Date().getFullYear()); setCalMonth(new Date().getMonth()); setShowCalendar('until'); }}>
          <Text style={{ color: schedUntil ? '#1C2434' : '#CCC', fontSize: 15 }}>{schedUntil || 'Select end date'}</Text>
        </Pressable>
        <Text style={s.label}>Reason</Text>
        <TextInput style={s.input} value={schedReason} onChangeText={setSchedReason} placeholder="Diwali holidays, renovation..." placeholderTextColor="#CCC" />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          <View style={{ flex: 1 }}><ActionButton label="Save Schedule" onPress={handleSaveScheduledClosure} isLoading={isSaving} /></View>
          <View style={{ flex: 1 }}><ActionButton label="Reset" onPress={handleClearScheduledClosure} variant="secondary" /></View>
        </View>
        {restaurant?.scheduledClosure?.isScheduled && (
          <View style={s.schedBadge}>
            <Text style={s.schedBadgeText}>Scheduled: {restaurant.scheduledClosure.from?.split('T')[0]} {'\u2192'} {restaurant.scheduledClosure.until?.split('T')[0]}</Text>
          </View>
        )}
      </View>

      {/* Business Hours */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Business Hours</Text>
        {businessHours.map((h, idx) => (
          <View key={h.day} style={s.timetableRow}>
            <View style={{ width: 38 }}>
              <Text style={s.dayLabel}>{h.day}</Text>
            </View>
            <Switch value={h.isOpen} onValueChange={val => setBusinessHours(prev => prev.map((r, i) => i === idx ? { ...r, isOpen: val } : r))} trackColor={{ false: '#FEE2E2', true: '#BBF7D0' }} thumbColor={h.isOpen ? '#15803D' : '#EF4444'} style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }} />
            {h.isOpen ? (
              <View style={s.timeRow}>
                <Pressable style={s.timeBtn} onPress={() => openClockPicker(idx, 'openTime')}>
                  <Text style={s.timeBtnText}>{h.openTime}</Text>
                </Pressable>
                <Text style={s.timeSep}>{'\u2192'}</Text>
                <Pressable style={s.timeBtn} onPress={() => openClockPicker(idx, 'closeTime')}>
                  <Text style={s.timeBtnText}>{h.closeTime}</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={[s.muted, { flex: 1 }]}>Closed</Text>
            )}
          </View>
        ))}
        <View style={{ marginTop: 10 }}>
          <ActionButton label="Save Business Hours" onPress={handleSaveTimetable} isLoading={isSaving} />
        </View>
      </View>

      {/* Sign Out */}
      <View style={{ marginTop: 8, marginBottom: 24 }}>
        <ActionButton label="Sign Out" onPress={onSignOut} variant="secondary" />
      </View>

      {/* ── Clock Picker Modal ── */}
      <Modal visible={clockPickerVisible} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setClockPickerVisible(false)} />
          <View style={s.clockModal}>
            <Text style={s.clockTitle}>Set Time</Text>
            <View style={s.clockFace}>
              <ScrollPicker data={Array.from({ length: 12 }, (_, i) => i + 1)} value={clockHour} onChange={setClockHour} />
              <Text style={s.clockColon}>:</Text>
              <ScrollPicker data={Array.from({ length: 60 }, (_, i) => i)} value={clockMinute} onChange={setClockMinute} />
              <View style={{ width: 10 }} />
              <ScrollPicker data={['AM', 'PM']} value={clockPeriod} onChange={setClockPeriod} />
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <Pressable style={[s.clockBtn, { backgroundColor: '#F5A623' }]} onPress={applyClockTime}><Text style={[s.clockBtnText, { color: '#FFF' }]}>Set Time</Text></Pressable>
              <Pressable style={[s.clockBtn, { backgroundColor: '#F3F4F6' }]} onPress={() => setClockPickerVisible(false)}><Text style={s.clockBtnText}>Cancel</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Calendar Modal ── */}
      <Modal visible={!!showCalendar} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowCalendar(null)} />
          <View style={s.calModal}>
            <Text style={s.clockTitle}>Select {showCalendar === 'from' ? 'Start' : 'End'} Date</Text>
            <View style={s.calNavRow}>
              <Pressable onPress={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }}><Text style={s.calNavBtn}>{'\u2039'}</Text></Pressable>
              <Text style={s.calMonthLabel}>{new Date(calYear, calMonth).toLocaleString('default', { month: 'long' })} {calYear}</Text>
              <Pressable onPress={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }}><Text style={s.calNavBtn}>{'\u203A'}</Text></Pressable>
            </View>
            <View style={s.calGrid}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <Text key={i} style={s.calDayHeader}>{d}</Text>)}
              {Array(getFirstDayOfWeek(calYear, calMonth)).fill(null).map((_, i) => <View key={`e${i}`} style={s.calCell} />)}
              {Array(getDaysInMonth(calYear, calMonth)).fill(null).map((_, i) => {
                const day = i + 1;
                const ds = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isSelected = ds === (showCalendar === 'from' ? schedFrom : schedUntil);
                return (
                  <Pressable key={day} style={[s.calCell, isSelected && s.calCellSelected]} onPress={() => selectCalendarDate(day)}>
                    <Text style={[s.calCellText, isSelected && { color: '#FFF' }]}>{day}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ─── ScrollPicker (reused from old screen) ───────────────────────────────────
function ScrollPicker<T extends number | string>({ data, value, onChange }: { data: T[]; value: T; onChange: (v: T) => void }) {
  const ITEM_HEIGHT = 48;
  const isInfinite = data.length > 2;
  const MULTIPLIER = 100;
  const listData = useMemo(() => isInfinite ? Array(MULTIPLIER).fill(data).flat() : data, [data, isInfinite]);
  const centerIndex = isInfinite ? Math.floor(MULTIPLIER / 2) * data.length : 0;
  const valIndex = data.indexOf(value);
  const initialScrollIndex = Math.max(0, centerIndex + valIndex);

  const handleScroll = (e: any) => {
    const y = e.nativeEvent.contentOffset.y;
    let index = Math.round(y / ITEM_HEIGHT);
    if (index >= 0 && index < listData.length) {
      if (listData[index] !== value) {
        onChange(listData[index]);
        try { Vibration.vibrate(10); } catch { }
      }
    }
  };

  return (
    <View style={{ height: ITEM_HEIGHT * 3, width: typeof value === 'string' ? 60 : 70, overflow: 'hidden' }}>
      <View pointerEvents="none" style={{ position: 'absolute', top: ITEM_HEIGHT, height: ITEM_HEIGHT, width: '100%', backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 10 }} />
      <FlatList
        data={listData}
        keyExtractor={(_, i) => String(i)}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        initialScrollIndex={initialScrollIndex}
        getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT }}
        renderItem={({ item }) => (
          <View style={{ height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: item === value ? 26 : 20, fontWeight: item === value ? '900' : '500', color: item === value ? '#F5A623' : '#9CA3AF' }}>
              {typeof item === 'number' ? String(item).padStart(2, '0') : item}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, marginBottom: 12,
    borderWidth: 1, borderColor: '#F3F4F6', elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8,
  },
  cardTitle: { color: '#1C2434', fontSize: 17, fontWeight: '800', marginBottom: 12 },
  muted: { color: '#9CA3AF', fontStyle: 'italic', fontSize: 13, lineHeight: 20 },
  label: { color: '#1C2434', fontSize: 12, fontWeight: '700', marginBottom: 4, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, backgroundColor: '#FAFAFA', color: '#1C2434', fontSize: 15 },
  datePickerBtn: { justifyContent: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 6, paddingVertical: 4 },
  switchLabel: { color: '#1C2434', fontSize: 14, fontWeight: '700', flex: 1 },
  profileBox: { backgroundColor: '#FAFAFA', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#F3F4F6', gap: 8 },
  profileName: { color: '#1C2434', fontSize: 16, fontWeight: '900' },
  profileDesc: { color: '#6B7280', fontSize: 14, lineHeight: 21 },
  editPill: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#FFF7ED' },
  editPillText: { color: '#F5A623', fontSize: 12, fontWeight: '800' },
  actionBtn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center' },
  actionBtnText: { fontSize: 13, fontWeight: '800' },
  schedBadge: { backgroundColor: '#FFFBEB', borderRadius: 10, padding: 10, marginTop: 10 },
  schedBadgeText: { color: '#92400E', fontSize: 13, fontWeight: '700' },
  timetableRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  dayLabel: { color: '#1C2434', fontSize: 12, fontWeight: '900' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  timeBtn: { backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  timeBtnText: { color: '#2563EB', fontSize: 14, fontWeight: '800' },
  timeSep: { color: '#9CA3AF', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  clockModal: { backgroundColor: '#FFF', borderRadius: 24, padding: 28, alignItems: 'center', minWidth: 240, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
  clockTitle: { fontSize: 18, fontWeight: '900', color: '#1C2434', marginBottom: 20 },
  clockFace: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clockColon: { fontSize: 42, fontWeight: '900', color: '#9CA3AF', marginBottom: 8 },
  clockBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, flex: 1, alignItems: 'center' },
  clockBtnText: { fontSize: 14, fontWeight: '800', color: '#1C2434' },
  calModal: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, width: 320, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
  calNavRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  calNavBtn: { fontSize: 24, color: '#F5A623', fontWeight: '900', paddingHorizontal: 8 },
  calMonthLabel: { fontSize: 16, fontWeight: '900', color: '#1C2434' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calDayHeader: { width: `${100 / 7}%` as any, textAlign: 'center', fontSize: 11, fontWeight: '800', color: '#9CA3AF', paddingBottom: 8 },
  calCell: { width: `${100 / 7}%` as any, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  calCellSelected: { backgroundColor: '#F5A623', borderRadius: 999 },
  calCellText: { fontSize: 14, color: '#1C2434', fontWeight: '600' },
  uploadOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
  uploadBox: { backgroundColor: '#FFF', padding: 24, borderRadius: 16, width: '75%', alignItems: 'center' },
  uploadTitle: { fontWeight: '900', marginBottom: 12, color: '#1C2434', fontSize: 16 },
  uploadBar: { height: 8, width: '100%', backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  uploadBarFill: { height: '100%', backgroundColor: '#F5A623', borderRadius: 4 },
  uploadPct: { marginTop: 12, fontSize: 13, color: '#9CA3AF', fontWeight: '800' },
});
