import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  Vibration,
  View,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pick } from '@react-native-documents/picker';
import { launchImageLibrary } from 'react-native-image-picker';
import ReactNativeBlobUtil from 'react-native-blob-util';
import * as xlsx from 'xlsx';

import { ActionButton } from '../components/ActionButton';
import { BrandBackdrop } from '../components/BrandBackdrop';
import { NativeBarChart } from '../components/NativeBarChart';
import type { SyncedTownPulseSession } from '../services/backendAuth';
import { theme } from '../theme/tokens';
import { appConfig } from '../config/appConfig';
import { getFreshFirebaseIdToken } from '../services/firebaseAuth';
import { useRestaurantSocket } from '../hooks/useRestaurantSocket';

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = 'analytics' | 'menu' | 'orders' | 'settings';
type ChartMode = 'bar' | 'pie' | 'both';
type Variant = { name: string; price: string; isDefault: boolean };
type Addon = { name: string; price: string };
type DayKey = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
type BusinessHourEntry = { day: DayKey; isOpen: boolean; openTime: string; closeTime: string };

const DAYS: DayKey[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const DAY_LABELS: Record<DayKey, string> = { MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday', SUN: 'Sunday' };

const DEFAULT_HOURS: BusinessHourEntry[] = DAYS.map(d => ({ day: d, isOpen: true, openTime: '09:00', closeTime: '22:00' }));

type Props = {
  currentStepLabel: string;
  onSignOut: () => void;
  session: SyncedTownPulseSession;
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export function RestaurantDashboardScreen({ currentStepLabel, onSignOut, session }: Props): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<Tab>('analytics');
  const [dashboard, setDashboard] = useState<any>(null);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [myItems, setMyItems] = useState<any[]>([]);
  const [isBusy, setIsBusy] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ active: false, pct: 0 });

  // Analytics
  const [chartMode, setChartMode] = useState<ChartMode>('bar');
  const [chartDropdownOpen, setChartDropdownOpen] = useState(false);

  // Edit restaurant profile
  const [isEditing, setIsEditing] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [editName, setEditName] = useState('');

  // Staged photos (local URIs, uploaded on Save)
  type StagedAsset = { uri: string; fileName: string; type: string };
  const [stagedBanners, setStagedBanners] = useState<StagedAsset[]>([]);
  const [stagedLogo, setStagedLogo] = useState<StagedAsset | null>(null);

  // Manual open/close
  const [manualClosed, setManualClosed] = useState(false);
  const [manualReason, setManualReason] = useState('');

  // Scheduled closure
  const [schedFrom, setSchedFrom] = useState('');
  const [schedUntil, setSchedUntil] = useState('');
  const [schedReason, setSchedReason] = useState('');
  const [showCalendar, setShowCalendar] = useState<'from' | 'until' | null>(null);

  // Timetable
  const [businessHours, setBusinessHours] = useState<BusinessHourEntry[]>(DEFAULT_HOURS);
  const [clockPickerVisible, setClockPickerVisible] = useState(false);
  const [clockTarget, setClockTarget] = useState<{ dayIdx: number; field: 'openTime' | 'closeTime' } | null>(null);
  const [clockHour, setClockHour] = useState(9);
  const [clockMinute, setClockMinute] = useState(0);
  const [clockPeriod, setClockPeriod] = useState<'AM'|'PM'>('AM');

  // Items expand
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemPrice, setEditItemPrice] = useState('');
  const [editItemDesc, setEditItemDesc] = useState('');
  const [editItemCategory, setEditItemCategory] = useState('');
  const [editItemAvailable, setEditItemAvailable] = useState(true);
  const [editItemHasVariants, setEditItemHasVariants] = useState(false);
  const [editItemVariants, setEditItemVariants] = useState<Variant[]>([]);
  const [editItemAddons, setEditItemAddons] = useState<Addon[]>([]);

  // New Item Form
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemCategory, setItemCategory] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemIsVeg, setItemIsVeg] = useState(true);
  const [itemHasVariants, setItemHasVariants] = useState(false);
  const [itemVariants, setItemVariants] = useState<Variant[]>([{ name: '', price: '', isDefault: true }]);
  const [itemAddons, setItemAddons] = useState<Addon[]>([]);
  const [isCreatingItem, setIsCreatingItem] = useState(false);

  const getToken = useCallback(() => getFreshFirebaseIdToken(), []);
  const apiFetch = useCallback(async (path: string, opts?: any) => {
    const token = await getToken();
    const res = await fetch(`${appConfig.apiBaseUrl}${path}`, {
      ...opts,
      headers: { Authorization: `Bearer ${token}`, ...(opts?.headers || {}) },
    });
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      if (!res.ok) throw new Error(json.message || 'Request failed');
      return json;
    } catch {
      throw new Error(`Server error (${res.status})`);
    }
  }, [getToken]);

  // ─── Fetch All ──────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      setIsBusy(true);
      const restJson = await apiFetch('/api/restaurants/my/managed');
      const r = restJson.restaurant;
      const isManualClosedValid = (status: any) => {
        if (!status?.isClosed) return false;
        if (!status.closedSince) return false;
        const hours = (new Date().getTime() - new Date(status.closedSince).getTime()) / (1000 * 60 * 60);
        return hours <= 24;
      };

      setRestaurant(r);
      setEditDesc(r.description || '');
      setEditName(r.name || '');
      setManualClosed(isManualClosedValid(r.manualStatus));
      setManualReason(r.manualStatus?.reason || '');
      if (r.scheduledClosure?.from) setSchedFrom(r.scheduledClosure.from.split('T')[0]);
      if (r.scheduledClosure?.until) setSchedUntil(r.scheduledClosure.until.split('T')[0]);
      setSchedReason(r.scheduledClosure?.reason || '');
      if (r.businessHours?.length > 0) setBusinessHours(r.businessHours);
      try {
        const dashJson = await apiFetch(`/api/restaurants/${r.restaurantId}/dashboard`);
        setDashboard(dashJson.analytics);
      } catch {}
      try {
        const ordersJson = await apiFetch('/api/orders/restaurant/active');
        setActiveOrders(ordersJson.orders || []);
      } catch {}
      try {
        const itemsJson = await apiFetch('/api/items/my-items');
        setMyItems(itemsJson.items || []);
      } catch {}
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setIsBusy(false);
    }
  }, [apiFetch]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── Real-time WebSocket events ─────────────────────────────────────────────
  const { statusMap, onNewOrder, onRestaurantUpdate } = useRestaurantSocket();

  // New order arrived → immediately refresh active orders
  useEffect(() => {
    onNewOrder.current = async (data) => {
      if (data.restaurantId !== restaurant?.restaurantId) return;
      try {
        const json = await apiFetch('/api/orders/restaurant/active');
        setActiveOrders(json.orders || []);
      } catch {}
    };
  }, [apiFetch, restaurant?.restaurantId, onNewOrder]);

  // Restaurant data updated (from another device / admin) → full refresh
  useEffect(() => {
    onRestaurantUpdate.current = async (data) => {
      if (data.restaurantId !== restaurant?.restaurantId) return;
      await fetchAll();
    };
  }, [fetchAll, restaurant?.restaurantId, onRestaurantUpdate]);

  // Fallback: poll active orders every 30 s (handles missed WS events)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const json = await apiFetch('/api/orders/restaurant/active');
        setActiveOrders(json.orders || []);
      } catch {}
    }, 30_000);
    return () => clearInterval(interval);
  }, [apiFetch]);

  // ─── Grouped Items ──────────────────────────────────────────────────────────
  const groupedItems = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const item of myItems) {
      const cat = item.category || 'Uncategorised';
      if (!map[cat]) map[cat] = [];
      map[cat].push(item);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [myItems]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // ─── Patch Restaurant ────────────────────────────────────────────────────────
  const patchRestaurant = async (payload: any) => {
    const json = await apiFetch(`/api/restaurants/${restaurant.restaurantId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    const isManualClosedValid = (status: any) => {
        if (!status?.isClosed) return false;
        if (!status.closedSince) return false;
        const hours = (new Date().getTime() - new Date(status.closedSince).getTime()) / (1000 * 60 * 60);
        return hours <= 24;
    };

    setRestaurant(json.restaurant);
    setManualClosed(isManualClosedValid(json.restaurant.manualStatus));
    return json;
  };



  const handleToggleManualClose = async (val: boolean) => {
    setManualClosed(val);
    try {
      await patchRestaurant({ manualStatus: { isClosed: val, reason: manualReason } });
    } catch (err: any) { Alert.alert('Error', err.message); }
  };

  const handleSaveManualStatus = async () => {
    try {
      setIsSaving(true);
      await patchRestaurant({ manualStatus: { isClosed: manualClosed, reason: manualReason } });
      Alert.alert('✅ Saved', 'Status updated!');
    } catch (err: any) { Alert.alert('Error', err.message); }
    finally { setIsSaving(false); }
  };

  const handleSaveScheduledClosure = async () => {
    try {
      setIsSaving(true);
      await patchRestaurant({ scheduledClosure: { from: schedFrom, until: schedUntil, reason: schedReason } });
      Alert.alert('✅ Saved', 'Scheduled closure saved!');
    } catch (err: any) { Alert.alert('Error', err.message); }
    finally { setIsSaving(false); }
  };

  const handleClearScheduledClosure = async () => {
    setSchedFrom(''); setSchedUntil(''); setSchedReason('');
    try {
      setIsSaving(true);
      await patchRestaurant({ scheduledClosure: { from: '', until: '', reason: '' } });
      Alert.alert('✅ Cleared', 'Scheduled closure cleared!');
    } catch (err: any) { Alert.alert('Error', err.message); }
    finally { setIsSaving(false); }
  };

  const handleSaveTimetable = async () => {
    try {
      setIsSaving(true);
      await patchRestaurant({ businessHours });
      Alert.alert('✅ Saved', 'Business hours updated!');
    } catch (err: any) { Alert.alert('Error', err.message); }
    finally { setIsSaving(false); }
  };

  // ─── Clock Picker Helpers ────────────────────────────────────────────────────
  const openClockPicker = (dayIdx: number, field: 'openTime' | 'closeTime') => {
    const currentTime = businessHours[dayIdx][field] || '09:00 AM';
    let hStr, mStr, isPm = false;
    if (currentTime.includes(' ')) {
       const [time, period] = currentTime.split(' ');
       [hStr, mStr] = time.split(':');
       isPm = period.toUpperCase() === 'PM';
    } else {
       [hStr, mStr] = currentTime.split(':');
       const hInt = parseInt(hStr, 10);
       isPm = hInt >= 12;
    }
    
    let hl = parseInt(hStr, 10);
    if (!currentTime.includes(' ')) {
      hl = hl % 12 || 12;
    }
    const ml = parseInt(mStr, 10) || 0;
    
    setClockHour(hl);
    setClockMinute(ml);
    setClockPeriod(isPm ? 'PM' : 'AM');
    setClockTarget({ dayIdx, field });
    setClockPickerVisible(true);
  };

  const applyClockTime = () => {
    if (!clockTarget) return;
    const formatted = `${String(clockHour).padStart(2, '0')}:${String(clockMinute).padStart(2, '0')} ${clockPeriod}`;
    setBusinessHours(prev => prev.map((h, idx) =>
      idx === clockTarget.dayIdx ? { ...h, [clockTarget.field]: formatted } : h
    ));
    setClockPickerVisible(false);
  };

  // ─── Calendar Mini-picker ────────────────────────────────────────────────────
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth()); // 0-indexed

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfWeek = (y: number, m: number) => new Date(y, m, 1).getDay();

  const selectCalendarDate = (day: number) => {
    const ds = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (showCalendar === 'from') setSchedFrom(ds);
    else setSchedUntil(ds);
    setShowCalendar(null);
  };

  // ─── Order Actions ────────────────────────────────────────────────────────────
  const handleOrderAction = async (orderId: string, action: string) => {
    try {
      await apiFetch(`/api/orders/${orderId}/restaurant-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await apiFetch('/api/orders/restaurant/active');
      setActiveOrders(json.orders || []);
    } catch (err: any) { Alert.alert('Error', err.message); }
  };

  const refreshItems = async () => {
    try {
      const json = await apiFetch('/api/items/my-items');
      setMyItems(json.items || []);
    } catch {}
  };

  const handleCreateItem = async () => {
    if (!itemName.trim() || !itemCategory.trim()) { Alert.alert('Missing Fields', 'Please fill Name and Category.'); return; }
    if (!itemHasVariants && !itemPrice.trim()) { Alert.alert('Missing Fields', 'Please fill Price or add variants.'); return; }
    try {
      setIsCreatingItem(true);
      const body: any = {
        restaurantId: restaurant._id, name: itemName.trim(), price: itemHasVariants ? 0 : parseInt(itemPrice, 10),
        category: itemCategory.trim(), description: itemDesc.trim(), isVeg: itemIsVeg, prepTimeMinutes: 15, hasVariants: itemHasVariants,
      };
      if (itemHasVariants) body.variants = itemVariants.filter(v => v.name && v.price).map(v => ({ name: v.name.trim(), price: parseInt(v.price, 10), isDefault: v.isDefault }));
      if (itemAddons.length > 0) body.globalAddOns = itemAddons.filter(a => a.name && a.price).map(a => ({ name: a.name.trim(), price: parseInt(a.price, 10) }));
      await apiFetch('/api/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      Alert.alert('✅ Added', `"${itemName}" is now on your menu!`);
      setItemName(''); setItemPrice(''); setItemCategory(''); setItemDesc('');
      setItemHasVariants(false); setItemVariants([{ name: '', price: '', isDefault: true }]); setItemAddons([]);
      await refreshItems();
    } catch (err: any) { Alert.alert('Error', err.message); }
    finally { setIsCreatingItem(false); }
  };

  const handleUpdateItem = async (itemId: string) => {
    try {
      const body: any = { name: editItemName.trim(), price: editItemHasVariants ? 0 : parseInt(editItemPrice || '0', 10), description: editItemDesc.trim(), category: editItemCategory.trim(), isAvailable: editItemAvailable, hasVariants: editItemHasVariants };
      if (editItemHasVariants) body.variants = editItemVariants.filter(v => v.name && v.price).map(v => ({ name: v.name.trim(), price: parseInt(v.price, 10), isDefault: v.isDefault }));
      body.globalAddOns = editItemAddons.filter(a => a.name && a.price).map(a => ({ name: a.name.trim(), price: parseInt(a.price, 10) }));
      await apiFetch(`/api/items/${itemId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      Alert.alert('✅ Updated', 'Item updated!');
      setEditingItemId(null);
      await refreshItems();
    } catch (err: any) { Alert.alert('Error', err.message); }
  };

  const handleUploadItemPhoto = async (itemId: string) => {
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.7, maxWidth: 800, maxHeight: 800 });
      if (!result.assets || result.didCancel) return;
      const asset = result.assets[0];
      if (!asset.uri) return;

      const token = await getToken();

      // ReactNativeBlobUtil properly resolves Android content:// URIs.
      // Both fetch() and XMLHttpRequest silently fail with content:// in FormData.
      setUploadProgress({ active: true, pct: 0 });
      const response = await ReactNativeBlobUtil.fetch(
        'PATCH',
        `${appConfig.apiBaseUrl}/api/items/${itemId}/image`,
        {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        [
          {
            name: 'image',
            filename: asset.fileName || `item_${Date.now()}.jpg`,
            type: asset.type || 'image/jpeg',
            data: ReactNativeBlobUtil.wrap(asset.uri.replace('file://', '')),
          },
        ]
      ).uploadProgress((written, total) => {
        setUploadProgress({ active: true, pct: written / total });
      });

      setUploadProgress({ active: false, pct: 0 });

      const status = response.respInfo.status;
      const json = JSON.parse(response.data);
      if (status < 200 || status >= 300) {
        throw new Error(json.message || `Upload failed (${status})`);
      }

      Alert.alert('✅ Photo Uploaded', 'Image added to item successfully!');
      await refreshItems();
    } catch (err: any) {
      setUploadProgress({ active: false, pct: 0 });
      Alert.alert('Upload Error', err.message);
    }
  };

  const handleRemoveBannerImage = async (imageUrl: string) => {
    try {
      const token = await getToken();
      const res = await fetch(`${appConfig.apiBaseUrl}/api/restaurants/${restaurant.restaurantId}/banner/remove`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setRestaurant((prev: any) => prev ? { ...prev, banner: json.restaurant.banner } : prev);
      Alert.alert('Removed', 'Banner image removed');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  // ── Pick images locally (no upload yet) ────────────────────────────────────
  const pickBannersLocally = async () => {
    const uploadedCount = Array.isArray(restaurant?.banner) ? restaurant.banner.length : (restaurant?.banner ? 1 : 0);
    const slotsLeft = Math.max(0, 8 - uploadedCount - stagedBanners.length);
    if (slotsLeft === 0) {
      Alert.alert('Limit Reached', 'You have 8 banners already. Delete some to add more.');
      return;
    }
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.85, maxWidth: 1280, maxHeight: 720, selectionLimit: slotsLeft });
    if (!result.assets || result.didCancel) return;
    const newAssets: StagedAsset[] = result.assets.map(a => ({
      uri: a.uri!,
      fileName: a.fileName || `banner_${Date.now()}.jpg`,
      type: a.type || 'image/jpeg',
    }));
    setStagedBanners(prev => [...prev, ...newAssets].slice(0, 8));
  };

  const pickLogoLocally = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.85, maxWidth: 512, maxHeight: 512, selectionLimit: 1 });
    if (!result.assets || result.didCancel) return;
    const a = result.assets[0];
    setStagedLogo({ uri: a.uri!, fileName: a.fileName || `logo_${Date.now()}.jpg`, type: a.type || 'image/jpeg' });
  };

  // ── Upload staged photos + save text details ─────────────────────────────
  const handleSaveRestaurant = async () => {
    try {
      setIsSaving(true);
      const token = await getToken();

      // 1. Upload staged logo (if any)
      if (stagedLogo) {
        setUploadProgress({ active: true, pct: 0 });
        const logoResponse = await ReactNativeBlobUtil.fetch(
          'PATCH',
          `${appConfig.apiBaseUrl}/api/restaurants/${restaurant.restaurantId}/image/logo`,
          { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
          [{ name: 'image', filename: stagedLogo.fileName, type: stagedLogo.type, data: ReactNativeBlobUtil.wrap(stagedLogo.uri.replace('file://', '')) }]
        ).uploadProgress((w, t) => setUploadProgress({ active: true, pct: w / t }));
        const logoJson = JSON.parse(logoResponse.data);
        if (logoResponse.respInfo.status >= 300) throw new Error(logoJson.message || 'Logo upload failed');
        setRestaurant((prev: any) => prev ? { ...prev, logo: logoJson.restaurant.logo } : prev);
        setStagedLogo(null);
      }

      // 2. Upload staged banners (all at once in one request)
      if (stagedBanners.length > 0) {
        setUploadProgress({ active: true, pct: 0 });
        const formData = stagedBanners.map(a => ({
          name: 'image',
          filename: a.fileName,
          type: a.type,
          data: ReactNativeBlobUtil.wrap(a.uri.replace('file://', '')),
        }));
        const bannerResponse = await ReactNativeBlobUtil.fetch(
          'PATCH',
          `${appConfig.apiBaseUrl}/api/restaurants/${restaurant.restaurantId}/image/banner`,
          { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
          formData
        ).uploadProgress((w, t) => setUploadProgress({ active: true, pct: w / t }));
        const bannerJson = JSON.parse(bannerResponse.data);
        if (bannerResponse.respInfo.status >= 300) throw new Error(bannerJson.message || 'Banner upload failed');
        setRestaurant((prev: any) => prev ? { ...prev, banner: bannerJson.restaurant.banner } : prev);
        setStagedBanners([]);
      }

      setUploadProgress({ active: false, pct: 0 });

      // 3. Save text fields (name, description)
      const res = await fetch(`${appConfig.apiBaseUrl}/api/restaurants/${restaurant.restaurantId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, description: editDesc }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setRestaurant((prev: any) => prev ? { ...prev, name: json.restaurant.name, description: json.restaurant.description } : prev);
      setIsEditing(false);
      Alert.alert('✅ Saved', 'Restaurant profile updated successfully!');
    } catch (err: any) {
      setUploadProgress({ active: false, pct: 0 });
      Alert.alert('Save Error', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkUpload = async () => {
    try {
      const [result] = await pick({ type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'] });
      if (!result?.uri) return;
      setIsBusy(true);
      let realPath = result.uri;
      if (realPath.startsWith('content://')) realPath = await ReactNativeBlobUtil.fs.stat(realPath).then(s => s.path).catch(() => realPath);
      const fileData = await ReactNativeBlobUtil.fs.readFile(realPath, 'base64');
      const workbook = xlsx.read(fileData, { type: 'base64' });
      const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      if (!rawData || rawData.length === 0) throw new Error('The uploaded file contains no data.');
      const token = await getToken();
      const res = await fetch(`${appConfig.apiBaseUrl}/api/items/bulk/upload-json`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ restaurantId: restaurant.restaurantId, items: rawData }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Upload failed');
      Alert.alert('✅ Bulk Upload', `Imported: ${json.importedCount}, Skipped: ${json.skippedCount}`);
      await refreshItems();
    } catch (err: any) {
      if (!err?.message?.includes('cancel')) Alert.alert('Error', err.message);
    } finally { setIsBusy(false); }
  };

  // Variant helpers
  const addVariant = () => setItemVariants(v => [...v, { name: '', price: '', isDefault: false }]);
  const removeVariant = (i: number) => setItemVariants(v => v.filter((_, idx) => idx !== i));
  const updateVariant = (i: number, field: keyof Variant, val: any) => setItemVariants(v => v.map((item, idx) => { if (idx !== i) return field === 'isDefault' && val ? { ...item, isDefault: false } : item; return { ...item, [field]: val }; }));
  const addAddon = () => setItemAddons(a => [...a, { name: '', price: '' }]);
  const removeAddon = (i: number) => setItemAddons(a => a.filter((_, idx) => idx !== i));
  const updateAddon = (i: number, field: keyof Addon, val: string) => setItemAddons(a => a.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  const editAddVariant = () => setEditItemVariants(v => [...v, { name: '', price: '', isDefault: false }]);
  const editRemoveVariant = (i: number) => setEditItemVariants(v => v.filter((_, idx) => idx !== i));
  const editUpdateVariant = (i: number, field: keyof Variant, val: any) => setEditItemVariants(v => v.map((item, idx) => { if (idx !== i) return field === 'isDefault' && val ? { ...item, isDefault: false } : item; return { ...item, [field]: val }; }));
  const editAddAddon = () => setEditItemAddons(a => [...a, { name: '', price: '' }]);
  const editRemoveAddon = (i: number) => setEditItemAddons(a => a.filter((_, idx) => idx !== i));
  const editUpdateAddon = (i: number, field: keyof Addon, val: string) => setEditItemAddons(a => a.map((item, idx) => idx === i ? { ...item, [field]: val } : item));

  // ────────────────────────────────────────────────────────────────────────────
  if (isBusy) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={s.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#FFFBF0" />
        <View style={s.loadWrap}>
          <ActivityIndicator size="large" color={theme.colors.brandPrimary} />
          <Text style={s.loadText}>Loading Dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const commRate = dashboard?.commissionRate ?? 20;
  const gross = dashboard?.totalSales ?? 0;
  const net = dashboard?.netEarnings ?? Math.round(gross * (1 - commRate / 100));

  // ── Status: live from WebSocket; falls back to API-fetched isOpen ─────────────
  const liveIsOpen = restaurant?.restaurantId !== undefined
    ? statusMap[restaurant.restaurantId]
    : undefined;
  const isRestaurantClosed = liveIsOpen !== undefined
    ? !liveIsOpen
    : restaurant?.isOpen === false;


  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView edges={['top', 'bottom']} style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#FFFBF0" />
      {uploadProgress.active && (
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 9999, elevation: 10 }}>
           <View style={{ backgroundColor: '#FAE08B', padding: 24, borderRadius: 16, width: '75%', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10 }}>
              <Text style={{ fontWeight: '900', marginBottom: 12, color: '#111827', fontSize: 16 }}>Uploading Media...</Text>
              <View style={{ height: 8, width: '100%', backgroundColor: '#2A2A2A', borderRadius: 4, overflow: 'hidden' }}>
                 <View style={{ height: '100%', width: `${Math.round(uploadProgress.pct * 100)}%`, backgroundColor: '#F5C116', borderRadius: 4 }} />
              </View>
              <Text style={{ marginTop: 12, fontSize: 13, color: '#B0B0B0', fontWeight: '800' }}>{Math.round(uploadProgress.pct * 100)}% Complete</Text>
           </View>
        </View>
      )}
      <View style={s.root}>
        <BrandBackdrop />
        <ScrollView bounces={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={s.header}>
            <View style={s.brandRow}>
              <View style={s.brandDot}><Text style={s.brandDotText}>TP</Text></View>
              <View>
                <Text style={s.eyebrow}>{currentStepLabel}</Text>
                <Text style={s.brandName}>townpulse</Text>
              </View>
            </View>
            <Text style={s.heroTitle}>{restaurant?.name || 'Dashboard'}</Text>
            <View style={s.statusPill}>
              <View style={[s.statusDot, { backgroundColor: isRestaurantClosed ? '#ef4444' : '#22c55e' }]} />
              <Text style={s.statusText}>{isRestaurantClosed ? 'CLOSED' : 'OPEN'}</Text>
            </View>
          </View>

          {/* Tab Bar */}
          <View style={s.tabBar}>
            {(['analytics', 'menu', 'orders', 'settings'] as Tab[]).map(t => {
              const labels: Record<Tab, string> = {
                analytics: '📈',
                menu: '🍔',
                orders: `🔔${activeOrders.length ? ` ${activeOrders.length}` : ''}`,
                settings: '⚙️',
              };
              return (
                <Pressable key={t} onPress={() => setActiveTab(t)} style={[s.tab, activeTab === t && s.tabActive]}>
                  <Text style={[s.tabLabel, activeTab === t && s.tabLabelActive]}>{labels[t]}</Text>
                  <Text style={[s.tabSublabel, activeTab === t && s.tabLabelActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Card body */}
          <View style={s.card}>

            {/* ══════════ ANALYTICS ══════════ */}
            {activeTab === 'analytics' && (
              <>
                {/* Summary % pills */}
                <View style={s.section}>
                  <View style={s.sectionHeaderRow}>
                    <Text style={s.secTitle}>Order Analytics</Text>
                    {/* Chart mode dropdown */}
                    <View>
                      <Pressable style={s.dropdownBtn} onPress={() => setChartDropdownOpen(o => !o)}>
                        <Text style={s.dropdownBtnText}>{chartMode === 'bar' ? '📊 Bar' : chartMode === 'pie' ? '🥧 Pie' : '📊+🥧 Both'} ▾</Text>
                      </Pressable>
                      {chartDropdownOpen && (
                        <View style={s.dropdown}>
                          {(['bar', 'pie', 'both'] as ChartMode[]).map(m => (
                            <Pressable key={m} style={s.dropdownItem} onPress={() => { setChartMode(m); setChartDropdownOpen(false); }}>
                              <Text style={[s.dropdownItemText, chartMode === m && { color: '#F5C116', fontWeight: '900' }]}>
                                {m === 'bar' ? '📊 Bar Chart' : m === 'pie' ? '🥧 Pie Chart' : '📊+🥧 Both'}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>

                  {/* % summary row */}
                  <View style={s.pctRow}>
                    <View style={[s.pctPill, { backgroundColor: 'rgba(34,197,94,0.15)' }]}>
                      <Text style={[s.pctNum, { color: '#15803d' }]}>{dashboard?.acceptedPct ?? 0}%</Text>
                      <Text style={s.pctLabel}>Accepted</Text>
                    </View>
                    <View style={[s.pctPill, { backgroundColor: 'rgba(229,57,53,0.15)' }]}>
                      <Text style={[s.pctNum, { color: '#E53935' }]}>{dashboard?.rejectedPct ?? 0}%</Text>
                      <Text style={s.pctLabel}>Rejected</Text>
                    </View>
                    <View style={[s.pctPill, { backgroundColor: 'rgba(245,193,22,0.15)' }]}>
                      <Text style={[s.pctNum, { color: '#F5C116' }]}>{(dashboard?.totalAccepted ?? 0) + (dashboard?.totalRejected ?? 0)}</Text>
                      <Text style={s.pctLabel}>Total (7d)</Text>
                    </View>
                  </View>
                </View>

                {/* Charts */}
                {dashboard?.ordersBreakdown && dashboard.ordersBreakdown.length > 0 && (chartMode === 'bar' || chartMode === 'both') && (
                  <View style={s.section}>
                    <Text style={s.secTitle}>Orders (last 7 days)</Text>
                    <View style={s.chartBox}>
                      <OrdersBarChart data={dashboard.ordersBreakdown} />
                    </View>
                  </View>
                )}

                {(chartMode === 'pie' || chartMode === 'both') && (
                  <View style={s.section}>
                    <Text style={s.secTitle}>Acceptance Rate</Text>
                    <View style={s.chartBox}>
                      <PieChart accepted={dashboard?.acceptedPct ?? 0} rejected={dashboard?.rejectedPct ?? 0} />
                    </View>
                  </View>
                )}

                {/* Revenue bar */}
                {dashboard?.dailyRevenue?.length > 0 && (
                  <View style={s.section}>
                    <Text style={s.secTitle}>7-Day Revenue</Text>
                    <View style={s.chartBox}>
                      <NativeBarChart data={dashboard.dailyRevenue.map((d: any) => ({ label: d.date.slice(5), value: d.revenue }))} height={150} />
                    </View>
                  </View>
                )}

                <View style={s.section}>
                  <Text style={s.secTitle}>Financial Overview</Text>
                  <View style={s.statGrid}>
                    <StatCard icon="💰" label="Gross" value={`₹${gross}`} bg="rgba(5,150,105,0.15)" accent="#059669" />
                    <StatCard icon="📊" label="Net" value={`₹${net}`} bg="rgba(245,193,22,0.15)" accent="#F5C116" />
                    <StatCard icon="📦" label="Total Orders" value={`${dashboard?.totalOrders ?? 0}`} bg="rgba(234,88,12,0.15)" accent="#ea580c" />
                    <StatCard icon="🏷️" label="Commission" value={`${commRate}%`} bg="rgba(229,57,53,0.15)" accent="#E53935" />
                    <StatCard icon="⭐" label="Rating" value={`${dashboard?.rating ?? 0}`} bg="rgba(202,138,4,0.15)" accent="#ca8a04" />
                    <StatCard icon="💬" label="Reviews" value={`${dashboard?.numReviews ?? 0}`} bg="rgba(124,58,237,0.15)" accent="#7c3aed" />
                    <StatCard icon="⏱️" label="Avg Prep Time" value={dashboard?.averagePrepMinutes != null ? `${dashboard.averagePrepMinutes} min` : 'No data'} bg="rgba(22,163,106,0.15)" accent="#16a34a" />
                  </View>
                </View>

                <View style={s.section}>
                  <Text style={s.secTitle}>Top Selling Items</Text>
                  {dashboard?.mostSellingItems?.length > 0 ? dashboard.mostSellingItems.map((item: any) => (
                    <View key={item._id} style={s.listRow}>
                      <View style={s.listDot} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.listMain}>{item.name}</Text>
                        <Text style={s.listSub}>Sold: {item.totalSold} · ₹{item.revenue}</Text>
                      </View>
                    </View>
                  )) : <Text style={s.muted}>No sales data yet.</Text>}
                </View>
              </>
            )}

            {/* ══════════ MENU ══════════ */}
            {activeTab === 'menu' && (
              <>
                <View style={s.section}>
                  <Text style={s.secTitle}>Your Menu ({myItems.length} items)</Text>
                  {groupedItems.length === 0
                    ? <Text style={s.muted}>No items yet. Add one below!</Text>
                    : groupedItems.map(([cat, items]) => (
                        <View key={cat} style={s.categoryBlock}>
                          {/* Category header */}
                          <Pressable style={s.categoryHeader} onPress={() => toggleCategory(cat)}>
                            <Text style={s.categoryTitle}>{cat} ({items.length})</Text>
                            <Text style={s.categoryChevron}>{expandedCategories.has(cat) ? '▲' : '▼'}</Text>
                          </Pressable>

                          {/* Items inside */}
                          {expandedCategories.has(cat) && items.map((item: any) => (
                            <View key={item._id} style={s.itemCard}>
                              {editingItemId === item._id ? (
                                <>
                                  {item.images && item.images.length > 0 && (
                                    <View style={{ alignSelf: 'flex-start', marginBottom: 10, marginTop: 4 }}>
                                      <Image source={{ uri: item.images[0] }} style={{ height: 60, width: 60, borderRadius: 8, backgroundColor: '#2A2A2A', resizeMode: 'cover' }} />
                                    </View>
                                  )}
                                  <Text style={s.label}>Name</Text>
                                  <TextInput style={s.input} value={editItemName} onChangeText={setEditItemName} />
                                  <Text style={s.label}>Description</Text>
                                  <TextInput style={[s.input, { minHeight: 60, textAlignVertical: 'top' }]} value={editItemDesc} onChangeText={setEditItemDesc} multiline />
                                  <Text style={s.label}>Category</Text>
                                  <TextInput style={s.input} value={editItemCategory} onChangeText={setEditItemCategory} />
                                  <View style={s.switchRow}>
                                    <Text style={s.switchLabel}>Available</Text>
                                    <Switch value={editItemAvailable} onValueChange={setEditItemAvailable} trackColor={{ false: '#fecaca', true: '#bbf7d0' }} thumbColor={editItemAvailable ? '#15803d' : '#F5C116'} />
                                  </View>
                                  <View style={s.switchRow}>
                                    <Text style={s.switchLabel}>Has Variants?</Text>
                                    <Switch value={editItemHasVariants} onValueChange={setEditItemHasVariants} trackColor={{ false: '#e5e5e5', true: '#bfdbfe' }} thumbColor={editItemHasVariants ? '#2563eb' : '#999'} />
                                  </View>
                                  {!editItemHasVariants ? (
                                    <><Text style={s.label}>Price (₹)</Text><TextInput style={s.input} value={editItemPrice} onChangeText={setEditItemPrice} keyboardType="numeric" /></>
                                  ) : (
                                    <View style={s.variantSection}>
                                      <Text style={s.subTitle}>Variants</Text>
                                      {editItemVariants.map((v, vi) => (
                                        <View key={vi} style={s.variantRow}>
                                          <TextInput style={[s.input, { flex: 2 }]} value={v.name} onChangeText={val => editUpdateVariant(vi, 'name', val)} placeholder="Size" placeholderTextColor="#aaa" />
                                          <TextInput style={[s.input, { flex: 1 }]} value={v.price} onChangeText={val => editUpdateVariant(vi, 'price', val)} placeholder="₹" placeholderTextColor="#aaa" keyboardType="numeric" />
                                          <Pressable onPress={() => editUpdateVariant(vi, 'isDefault', true)} style={[s.defaultBtn, v.isDefault && s.defaultBtnActive]}><Text style={s.defaultBtnText}>{v.isDefault ? '★' : '☆'}</Text></Pressable>
                                          {editItemVariants.length > 1 && <Pressable onPress={() => editRemoveVariant(vi)} style={s.removeBtn}><Text style={s.removeBtnText}>✕</Text></Pressable>}
                                        </View>
                                      ))}
                                      <Pressable onPress={editAddVariant} style={s.addRowBtn}><Text style={s.addRowBtnText}>+ Add Variant</Text></Pressable>
                                    </View>
                                  )}
                                  <View style={s.variantSection}>
                                    <Text style={s.subTitle}>Add-ons</Text>
                                    {editItemAddons.map((a, ai) => (
                                      <View key={ai} style={s.variantRow}>
                                        <TextInput style={[s.input, { flex: 2 }]} value={a.name} onChangeText={val => editUpdateAddon(ai, 'name', val)} placeholder="Add-on" placeholderTextColor="#aaa" />
                                        <TextInput style={[s.input, { flex: 1 }]} value={a.price} onChangeText={val => editUpdateAddon(ai, 'price', val)} placeholder="₹" placeholderTextColor="#aaa" keyboardType="numeric" />
                                        <Pressable onPress={() => editRemoveAddon(ai)} style={s.removeBtn}><Text style={s.removeBtnText}>✕</Text></Pressable>
                                      </View>
                                    ))}
                                    <Pressable onPress={editAddAddon} style={s.addRowBtn}><Text style={s.addRowBtnText}>+ Add Add-on</Text></Pressable>
                                  </View>
                                  <View style={s.editActions}>
                                    <Pressable style={[s.actionBtn, { backgroundColor: '#d1fae5' }]} onPress={() => handleUpdateItem(item._id)}><Text style={s.actionBtnText}>💾 Save</Text></Pressable>
                                    <Pressable style={[s.actionBtn, { backgroundColor: '#fef3c7' }]} onPress={() => handleUploadItemPhoto(item._id)}><Text style={s.actionBtnText}>📷 Photo</Text></Pressable>
                                    <Pressable style={[s.actionBtn, { backgroundColor: '#fee2e2' }]} onPress={() => setEditingItemId(null)}><Text style={s.actionBtnText}>✖ Cancel</Text></Pressable>
                                  </View>
                                </>
                              ) : (
                                <Pressable onPress={() => {
                                  setEditingItemId(item._id); setEditItemName(item.name); setEditItemPrice(String(item.price));
                                  setEditItemDesc(item.description || ''); setEditItemCategory(item.category || '');
                                  setEditItemAvailable(item.isAvailable !== false); setEditItemHasVariants(item.hasVariants || false);
                                  setEditItemVariants((item.variants || []).map((v: any) => ({ name: v.name, price: String(v.price), isDefault: v.isDefault || false })));
                                  setEditItemAddons((item.globalAddOns || []).map((a: any) => ({ name: a.name, price: String(a.price) })));
                                }}>
                                  <View style={s.itemRow}>
                                    {item.images && item.images.length > 0 && <Image source={{ uri: item.images[0] }} style={s.itemThumb} />}
                                    <View style={{ flex: 1 }}>
                                      <Text style={s.itemName}>{item.isVeg ? '🟢' : '🔴'} {item.name}{item.isAvailable === false ? '  ⛔' : ''}</Text>
                                      <Text style={s.itemSub}>₹{item.price}{item.hasVariants ? ' (variants)' : ''}{item.isAvailable === false ? ' · HIDDEN' : ''}</Text>
                                    </View>
                                    <View style={s.editBadge}><Text style={s.editBadgeText}>✏️</Text></View>
                                  </View>
                                </Pressable>
                              )}
                            </View>
                          ))}
                        </View>
                      ))
                  }
                </View>

                {/* Add New Item */}
                <View style={s.section}>
                  <Text style={s.secTitle}>➕ Add New Item</Text>
                  <View style={s.formBox}>
                    <Text style={s.label}>Name *</Text>
                    <TextInput style={s.input} value={itemName} onChangeText={setItemName} placeholder="e.g. Butter Chicken" placeholderTextColor="#aaa" />
                    <Text style={s.label}>Description</Text>
                    <TextInput style={[s.input, { minHeight: 60, textAlignVertical: 'top' }]} value={itemDesc} onChangeText={setItemDesc} placeholder="Describe this dish..." placeholderTextColor="#aaa" multiline />
                    <Text style={s.label}>Category *</Text>
                    <TextInput style={s.input} value={itemCategory} onChangeText={setItemCategory} placeholder="Main Course" placeholderTextColor="#aaa" />
                    <View style={s.switchRow}>
                      <Text style={s.switchLabel}>🟢 Vegetarian</Text>
                      <Switch value={itemIsVeg} onValueChange={setItemIsVeg} trackColor={{ false: '#fecaca', true: '#bbf7d0' }} thumbColor={itemIsVeg ? '#15803d' : '#F5C116'} />
                    </View>
                    <View style={s.switchRow}>
                      <Text style={s.switchLabel}>📐 Has Size/Variants?</Text>
                      <Switch value={itemHasVariants} onValueChange={setItemHasVariants} trackColor={{ false: '#e5e5e5', true: '#bfdbfe' }} thumbColor={itemHasVariants ? '#2563eb' : '#999'} />
                    </View>
                    {!itemHasVariants ? (
                      <><Text style={s.label}>Base Price (₹) *</Text><TextInput style={s.input} value={itemPrice} onChangeText={setItemPrice} placeholder="250" placeholderTextColor="#aaa" keyboardType="numeric" /></>
                    ) : (
                      <View style={s.variantSection}>
                        <Text style={s.subTitle}>Variants / Sizes</Text>
                        {itemVariants.map((v, i) => (
                          <View key={i} style={s.variantRow}>
                            <TextInput style={[s.input, { flex: 2 }]} value={v.name} onChangeText={val => updateVariant(i, 'name', val)} placeholder="e.g. Small" placeholderTextColor="#aaa" />
                            <TextInput style={[s.input, { flex: 1 }]} value={v.price} onChangeText={val => updateVariant(i, 'price', val)} placeholder="₹" placeholderTextColor="#aaa" keyboardType="numeric" />
                            <Pressable onPress={() => updateVariant(i, 'isDefault', true)} style={[s.defaultBtn, v.isDefault && s.defaultBtnActive]}><Text style={s.defaultBtnText}>{v.isDefault ? '★' : '☆'}</Text></Pressable>
                            {itemVariants.length > 1 && <Pressable onPress={() => removeVariant(i)} style={s.removeBtn}><Text style={s.removeBtnText}>✕</Text></Pressable>}
                          </View>
                        ))}
                        <Pressable onPress={addVariant} style={s.addRowBtn}><Text style={s.addRowBtnText}>+ Add Variant</Text></Pressable>
                      </View>
                    )}
                    <View style={s.variantSection}>
                      <Text style={s.subTitle}>Add-ons (optional)</Text>
                      {itemAddons.map((a, i) => (
                        <View key={i} style={s.variantRow}>
                          <TextInput style={[s.input, { flex: 2 }]} value={a.name} onChangeText={val => updateAddon(i, 'name', val)} placeholder="e.g. Extra Cheese" placeholderTextColor="#aaa" />
                          <TextInput style={[s.input, { flex: 1 }]} value={a.price} onChangeText={val => updateAddon(i, 'price', val)} placeholder="₹" placeholderTextColor="#aaa" keyboardType="numeric" />
                          <Pressable onPress={() => removeAddon(i)} style={s.removeBtn}><Text style={s.removeBtnText}>✕</Text></Pressable>
                        </View>
                      ))}
                      <Pressable onPress={addAddon} style={s.addRowBtn}><Text style={s.addRowBtnText}>+ Add Add-on</Text></Pressable>
                    </View>
                    <ActionButton label="Add to Menu" onPress={handleCreateItem} isLoading={isCreatingItem} />
                  </View>
                </View>

                <View style={s.section}>
                  <Text style={s.secTitle}>📂 Bulk Import (.xlsx)</Text>
                  <View style={s.formBox}>
                    <Text style={s.muted}>Upload an Excel file to mass-import items.</Text>
                    <ActionButton label="Select Excel File" onPress={handleBulkUpload} variant="primary" />
                  </View>
                </View>
              </>
            )}

            {/* ══════════ ORDERS ══════════ */}
            {activeTab === 'orders' && (
              <>
                {activeOrders.length === 0 ? (
                  <View style={s.emptyOrders}>
                    <Text style={{ fontSize: 56 }}>🍽️</Text>
                    <Text style={s.emptyTitle}>No Active Orders</Text>
                    <Text style={s.muted}>New orders will appear here automatically.</Text>
                  </View>
                ) : (
                  <>
                    <Text style={s.secTitle}>Active Orders ({activeOrders.length})</Text>
                    {activeOrders.map((order: any) => (
                      <View key={order.orderId} style={s.orderCard}>
                        <View style={s.orderHead}>
                          <Text style={s.orderId}>{order.orderId}</Text>
                          <View style={[s.badge, statusColor(order.status)]}><Text style={s.badgeText}>{order.status.replace(/_/g, ' ')}</Text></View>
                        </View>
                        {order.items?.map((it: any, i: number) => (<Text key={i} style={s.orderItem}>{it.quantity}× {it.name} — ₹{it.itemTotal}</Text>))}
                        <Text style={s.orderTotal}>Total: ₹{order.pricing?.grandTotal}</Text>
                        {order.customer?.userId && (<Text style={s.customerInfo}>👤 {order.customer.userId.name || 'Customer'} · {order.customer.userId.phone || ''}</Text>)}
                        {order.status === 'PREPARING' && order.preparation?.startedAt && (
                          <PreparationTimer startedAt={order.preparation.startedAt} />
                        )}
                        <View style={s.orderBtns}>
                          {order.status === 'PLACED' && (<><Pressable style={[s.actionBtn, { backgroundColor: '#d1fae5' }]} onPress={() => handleOrderAction(order.orderId, 'accept')}><Text style={s.actionBtnText}>✅ Accept</Text></Pressable><Pressable style={[s.actionBtn, { backgroundColor: '#fee2e2' }]} onPress={() => handleOrderAction(order.orderId, 'reject')}><Text style={s.actionBtnText}>❌ Reject</Text></Pressable></>)}
                          {order.status === 'CONFIRMED' && (<Pressable style={[s.actionBtn, { backgroundColor: '#dbeafe' }]} onPress={() => handleOrderAction(order.orderId, 'preparing')}><Text style={s.actionBtnText}>🍳 Start Preparing</Text></Pressable>)}
                          {order.status === 'PREPARING' && (<Pressable style={[s.actionBtn, { backgroundColor: '#fef3c7' }]} onPress={() => handleOrderAction(order.orderId, 'ready')}><Text style={s.actionBtnText}>📦 Mark Ready for Pickup</Text></Pressable>)}
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </>
            )}

            {/* ══════════ SETTINGS ══════════ */}
            {activeTab === 'settings' && (
              <>
                {/* Restaurant Profile */}
                <View style={s.section}>
                  <Text style={s.secTitle}>Restaurant Profile</Text>
                  <View style={[s.profileBox, { marginBottom: 15 }]}>
                    {(Array.isArray(restaurant?.banner) ? restaurant.banner : (restaurant?.banner ? [restaurant.banner] : [])).length > 0 && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ width: '100%' }}>
                        {(Array.isArray(restaurant?.banner) ? restaurant.banner : [restaurant?.banner]).filter(Boolean).map((url: string, index: number) => (
                          <View key={index} style={{ marginRight: 10, position: 'relative' }}>
                             <Image source={{ uri: url }} style={{ height: 100, width: 220, borderRadius: 8, resizeMode: 'cover' }} />
                             {isEditing && (
                                <Pressable onPress={() => handleRemoveBannerImage(url)} style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                                   <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>✕ Delete</Text>
                                </Pressable>
                             )}
                          </View>
                        ))}
                      </ScrollView>
                    )}
                  </View>

                  {!isEditing ? (
                    <View style={s.profileBox}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                        {restaurant?.logo && <Image source={{ uri: restaurant.logo }} style={{ height: 60, width: 60, borderRadius: 30, backgroundColor: '#eee' }} />}
                        <View style={{ flex: 1 }}>
                          <Text style={s.profileDesc}>{restaurant?.description || 'No description set.'}</Text>
                        </View>
                      </View>
                      <Pressable onPress={() => setIsEditing(true)} style={s.editPill}><Text style={s.editPillText}>✏️ Edit Details & Photos</Text></Pressable>
                    </View>
                  ) : (
                    <View style={s.profileBox}>
                      {/* ── Name & Description ── */}
                      <Text style={s.label}>Restaurant Name</Text>
                      <TextInput style={s.input} value={editName} onChangeText={setEditName} />
                      <Text style={s.label}>Description</Text>
                      <TextInput style={[s.input, { minHeight: 70, textAlignVertical: 'top' }]} value={editDesc} onChangeText={setEditDesc} multiline />

                      {/* ── Logo ── */}
                      <Text style={[s.label, { marginTop: 16 }]}>Logo</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        {/* Current or staged logo preview */}
                        {(stagedLogo?.uri || restaurant?.logo) && (
                          <Image
                            source={{ uri: stagedLogo?.uri || restaurant.logo }}
                            style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#eee' }}
                          />
                        )}
                        <Pressable style={[s.actionBtn, { backgroundColor: '#eff6ff' }]} onPress={pickLogoLocally}>
                          <Text style={[s.actionBtnText, { color: '#2563eb' }]}>
                            {stagedLogo ? '🔄 Change Logo' : '📷 Pick Logo'}
                          </Text>
                        </Pressable>
                        {stagedLogo && (
                          <Text style={{ color: '#f59e0b', fontSize: 11, fontWeight: '700' }}>Pending upload</Text>
                        )}
                      </View>

                      {/* ── Banners ── */}
                      <Text style={[s.label, { marginTop: 8 }]}>
                        Banners ({(Array.isArray(restaurant?.banner) ? restaurant.banner.length : 0) + stagedBanners.length}/8)
                      </Text>

                      {/* Uploaded banners */}
                      {(Array.isArray(restaurant?.banner) ? restaurant.banner : (restaurant?.banner ? [restaurant.banner] : [])).filter(Boolean).map((url: string, i: number) => (
                        <View key={`up-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                          <Image source={{ uri: url }} style={{ width: 110, height: 65, borderRadius: 8, backgroundColor: '#eee' }} resizeMode="cover" />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 11, color: '#22c55e', fontWeight: '700' }}>✅ Uploaded</Text>
                          </View>
                          <Pressable onPress={() => handleRemoveBannerImage(url)} style={{ backgroundColor: '#fee2e2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
                            <Text style={{ color: '#F5C116', fontSize: 12, fontWeight: '800' }}>✕</Text>
                          </Pressable>
                        </View>
                      ))}

                      {/* Staged (local, not yet uploaded) banners */}
                      {stagedBanners.map((asset, i) => (
                        <View key={`st-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                          <Image source={{ uri: asset.uri }} style={{ width: 110, height: 65, borderRadius: 8, backgroundColor: '#eee' }} resizeMode="cover" />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 11, color: '#f59e0b', fontWeight: '700' }}>⏳ Pending upload</Text>
                          </View>
                          <Pressable onPress={() => setStagedBanners(prev => prev.filter((_, idx) => idx !== i))} style={{ backgroundColor: '#fef3c7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
                            <Text style={{ color: '#92400e', fontSize: 12, fontWeight: '800' }}>✕</Text>
                          </Pressable>
                        </View>
                      ))}

                      {/* Add more banners button */}
                      {(Array.isArray(restaurant?.banner) ? restaurant.banner.length : 0) + stagedBanners.length < 8 && (
                        <Pressable style={[s.actionBtn, { backgroundColor: '#f0fdf4', marginTop: 6 }]} onPress={pickBannersLocally}>
                          <Text style={[s.actionBtnText, { color: '#166534' }]}>
                            ➕ Add Banners (up to {8 - (Array.isArray(restaurant?.banner) ? restaurant.banner.length : 0) - stagedBanners.length} more)
                          </Text>
                        </Pressable>
                      )}

                      {/* Save / Cancel */}
                      <View style={{ marginTop: 16, gap: 8 }}>
                        <ActionButton
                          label={`Save${stagedBanners.length + (stagedLogo ? 1 : 0) > 0 ? ` & Upload ${stagedBanners.length + (stagedLogo ? 1 : 0)} Photo${stagedBanners.length + (stagedLogo ? 1 : 0) > 1 ? 's' : ''}` : ' Details'}`}
                          onPress={handleSaveRestaurant}
                          isLoading={isSaving}
                        />
                        <ActionButton label="Cancel" onPress={() => { setIsEditing(false); setStagedBanners([]); setStagedLogo(null); }} variant="secondary" />
                      </View>
                    </View>
                  )}
                </View>

                {/* ── Scheduled Closure ── */}
                <View style={s.section}>
                  <Text style={s.secTitle}>📅 Schedule Closure</Text>
                  <View style={s.formBox}>
                    <Text style={s.muted}>Set a date range when your restaurant will be automatically closed (e.g. holidays).</Text>
                    <Text style={s.label}>From</Text>
                    <Pressable style={[s.input, s.datePickerBtn]} onPress={() => { setCalYear(new Date().getFullYear()); setCalMonth(new Date().getMonth()); setShowCalendar('from'); }}>
                      <Text style={{ color: schedFrom ? theme.colors.ink900 : '#aaa', fontSize: 15 }}>{schedFrom || 'Select start date'}</Text>
                    </Pressable>
                    <Text style={s.label}>Until</Text>
                    <Pressable style={[s.input, s.datePickerBtn]} onPress={() => { setCalYear(new Date().getFullYear()); setCalMonth(new Date().getMonth()); setShowCalendar('until'); }}>
                      <Text style={{ color: schedUntil ? theme.colors.ink900 : '#aaa', fontSize: 15 }}>{schedUntil || 'Select end date'}</Text>
                    </Pressable>
                    <Text style={s.label}>Reason</Text>
                    <TextInput style={s.input} value={schedReason} onChangeText={setSchedReason} placeholder="Diwali holidays, renovation..." placeholderTextColor="#aaa" />
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <ActionButton label="Save Schedule" onPress={handleSaveScheduledClosure} isLoading={isSaving} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ActionButton label="Reset" onPress={handleClearScheduledClosure} variant="secondary" />
                      </View>
                    </View>
                    {restaurant?.scheduledClosure?.isScheduled && (
                      <View style={s.schedBadge}>
                        <Text style={s.schedBadgeText}>⚠️ Scheduled: {restaurant.scheduledClosure.from?.split('T')[0]} → {restaurant.scheduledClosure.until?.split('T')[0]}</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* ── Timetable ── */}
                <View style={s.section}>
                  <Text style={s.secTitle}>🕐 Business Hours</Text>
                  <View style={s.formBox}>
                    {businessHours.map((h, idx) => (
                      <View key={h.day} style={s.timetableRow}>
                        <View style={{ width: 38 }}>
                          <Text style={s.dayLabel}>{h.day}</Text>
                        </View>
                        <Switch value={h.isOpen} onValueChange={val => setBusinessHours(prev => prev.map((r, i) => i === idx ? { ...r, isOpen: val } : r))} trackColor={{ false: '#fecaca', true: '#bbf7d0' }} thumbColor={h.isOpen ? '#15803d' : '#F5C116'} style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }} />
                        {h.isOpen ? (
                          <View style={s.timeRow}>
                            <Pressable style={s.timeBtn} onPress={() => openClockPicker(idx, 'openTime')}>
                              <Text style={s.timeBtnText}>{h.openTime}</Text>
                            </Pressable>
                            <Text style={s.timeSep}>→</Text>
                            <Pressable style={s.timeBtn} onPress={() => openClockPicker(idx, 'closeTime')}>
                              <Text style={s.timeBtnText}>{h.closeTime}</Text>
                            </Pressable>
                          </View>
                        ) : (
                          <Text style={[s.muted, { flex: 1 }]}>Closed</Text>
                        )}
                      </View>
                    ))}
                    <ActionButton label="Save Business Hours" onPress={handleSaveTimetable} isLoading={isSaving} />
                  </View>
                </View>
              </>
            )}

            <View style={{ marginTop: 24 }}>
              <ActionButton label="Sign Out" onPress={onSignOut} variant="secondary" />
            </View>
          </View>
        </ScrollView>
      </View>

      {/* ── Clock Picker Modal ── */}
      <Modal visible={clockPickerVisible} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setClockPickerVisible(false)} />
          <View style={s.clockModal}>
            <Text style={s.clockTitle}>Set Time</Text>
            <View style={s.clockFace}>
              {/* Hour Drum */}
              <ScrollPicker 
                data={Array.from({length: 12}, (_, i) => i + 1)} 
                value={clockHour} 
                onChange={setClockHour} 
              />
              
              <Text style={s.clockColon}>:</Text>
              
              {/* Minute Drum */}
              <ScrollPicker 
                data={Array.from({length: 60}, (_, i) => i)} 
                value={clockMinute} 
                onChange={setClockMinute} 
              />

              <View style={{ width: 10 }} />

              {/* AM/PM Drum */}
              <ScrollPicker 
                data={['AM', 'PM']} 
                value={clockPeriod} 
                onChange={setClockPeriod} 
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <Pressable style={[s.clockBtn, { backgroundColor: '#D4A510' }]} onPress={applyClockTime}><Text style={[s.clockBtnText, { color: '#fff' }]}>Set Time</Text></Pressable>
              <Pressable style={[s.clockBtn, { backgroundColor: '#111827' }]} onPress={() => setClockPickerVisible(false)}><Text style={s.clockBtnText}>Cancel</Text></Pressable>
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
              <Pressable onPress={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }}><Text style={s.calNavBtn}>‹</Text></Pressable>
              <Text style={s.calMonthLabel}>{new Date(calYear, calMonth).toLocaleString('default', { month: 'long' })} {calYear}</Text>
              <Pressable onPress={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }}><Text style={s.calNavBtn}>›</Text></Pressable>
            </View>
            <View style={s.calGrid}>
              {['S','M','T','W','T','F','S'].map((d, i) => <Text key={i} style={s.calDayHeader}>{d}</Text>)}
              {Array(getFirstDayOfWeek(calYear, calMonth)).fill(null).map((_, i) => <View key={`e${i}`} style={s.calCell} />)}
              {Array(getDaysInMonth(calYear, calMonth)).fill(null).map((_, i) => {
                const day = i + 1;
                const ds = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isSelected = ds === (showCalendar === 'from' ? schedFrom : schedUntil);
                return (
                  <Pressable key={day} style={[s.calCell, isSelected && s.calCellSelected]} onPress={() => selectCalendarDate(day)}>
                    <Text style={[s.calCellText, isSelected && { color: '#fff' }]}>{day}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatCard({ icon, label, value, bg, accent }: { icon: string; label: string; value: string; bg: string; accent: string }) {
  return (
    <View style={[s.statCard, { backgroundColor: bg }]}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <Text style={[s.statValue, { color: accent }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function OrdersBarChart({ data }: { data: { date: string; accepted: number; rejected: number }[] }) {
  const maxVal = Math.max(1, ...data.flatMap(d => [d.accepted, d.rejected]));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: 6 }}>
      {data.map((d, i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
            <View style={{ width: 10, height: Math.max(4, (d.accepted / maxVal) * 100), backgroundColor: '#22c55e', borderRadius: 4 }} />
            <View style={{ width: 10, height: Math.max(4, (d.rejected / maxVal) * 100), backgroundColor: '#ef4444', borderRadius: 4 }} />
          </View>
          <Text style={{ fontSize: 8, color: '#6b7280' }}>{d.date.slice(5)}</Text>
        </View>
      ))}
      <View style={{ position: 'absolute', right: 0, bottom: 20, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><View style={{ width: 8, height: 8, backgroundColor: '#22c55e', borderRadius: 2 }} /><Text style={{ fontSize: 9, color: '#374151' }}>Accepted</Text></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><View style={{ width: 8, height: 8, backgroundColor: '#ef4444', borderRadius: 2 }} /><Text style={{ fontSize: 9, color: '#374151' }}>Rejected</Text></View>
      </View>
    </View>
  );
}

function PieChart({ accepted, rejected }: { accepted: number; rejected: number }) {
  const total = accepted + rejected;
  if (total === 0) return <Text style={{ color: '#6b7280', textAlign: 'center', paddingVertical: 20 }}>No data yet</Text>;
  return (
    <View style={{ alignItems: 'center', paddingVertical: 12 }}>
      {/* Simple ring approximation using two arcs with rounded ends */}
      <View style={{ position: 'relative', width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 120, height: 120, borderRadius: 60, borderWidth: 18, borderColor: '#ef4444' }} />
        <View style={{ position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 18, borderColor: '#22c55e', borderRightColor: 'transparent', borderBottomColor: accepted >= 50 ? '#22c55e' : 'transparent', transform: [{ rotate: `-90deg` }], opacity: accepted / 100 + 0.2 }} />
        <View style={{ position: 'absolute', alignItems: 'center' }}>
          <Text style={{ fontSize: 24, fontWeight: '900', color: '#D4A510' }}>{accepted}%</Text>
          <Text style={{ fontSize: 10, color: '#6b7280' }}>Accepted</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 20, marginTop: 14 }}>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <View style={{ width: 16, height: 16, backgroundColor: '#22c55e', borderRadius: 8 }} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#15803d' }}>{accepted}%</Text>
          <Text style={{ fontSize: 10, color: '#6b7280' }}>Accepted</Text>
        </View>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <View style={{ width: 16, height: 16, backgroundColor: '#ef4444', borderRadius: 8 }} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#F5C116' }}>{rejected}%</Text>
          <Text style={{ fontSize: 10, color: '#6b7280' }}>Rejected</Text>
        </View>
      </View>
    </View>
  );
}

// ─── PreparationTimer Component ──────────────────────────────────────────────
function PreparationTimer({ startedAt }: { startedAt: string }) {
  const calc = () => {
    const diff = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    return { h: Math.floor(diff / 3600), m: Math.floor((diff % 3600) / 60), s: diff % 60 };
  };
  const [elapsed, setElapsed] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setElapsed(calc()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  const pad = (n: number) => String(n).padStart(2, '0');
  const isHot = elapsed.m >= 20;
  const isMed = elapsed.m >= 10 && !isHot;
  const accent = isHot ? '#F5C116' : isMed ? '#f59e0b' : '#2563eb';
  const bgColor = isHot ? '#fef2f2' : isMed ? '#fffbeb' : '#eff6ff';
  return (
    <View style={{ backgroundColor: bgColor, borderRadius: 16, padding: 14, marginVertical: 10, alignItems: 'center', borderWidth: 1.5, borderColor: accent }}>
      <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: accent, textTransform: 'uppercase', marginBottom: 6 }}>⏱  Preparing For</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {elapsed.h > 0 && (
          <>
            <View style={{ backgroundColor: accent, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: 1 }}>{pad(elapsed.h)}</Text>
            </View>
            <Text style={{ color: accent, fontSize: 22, fontWeight: '900' }}>:</Text>
          </>
        )}
        <View style={{ backgroundColor: accent, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: 1 }}>{pad(elapsed.m)}</Text>
        </View>
        <Text style={{ color: accent, fontSize: 22, fontWeight: '900' }}>:</Text>
        <View style={{ backgroundColor: accent, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: 1 }}>{pad(elapsed.s)}</Text>
        </View>
      </View>
      <Text style={{ fontSize: 10, color: accent, marginTop: 6, fontWeight: '700' }}>{isHot ? '🔥 Running Long!' : isMed ? '⚠️ Taking a while...' : '✅ On Track'}</Text>
    </View>
  );
}

function statusColor(status: string) {
  const m: Record<string, any> = { PLACED: { backgroundColor: '#fef3c7' }, CONFIRMED: { backgroundColor: '#dbeafe' }, PREPARING: { backgroundColor: '#fce7f3' }, READY_FOR_PICKUP: { backgroundColor: '#d1fae5' } };
  return m[status] || { backgroundColor: '#f3f4f6' };
}

function ScrollPicker<T extends number | string>({ data, value, onChange }: { data: T[]; value: T; onChange: (v: T) => void }) {
  const ITEM_HEIGHT = 48;
  const isInfinite = data.length > 2; // only Hour and Minute are infinite
  const MULTIPLIER = 100;
  
  // Create infinite wrapping data using useMemo to avoid re-creation
  const listData = useMemo(() => {
    return isInfinite ? Array(MULTIPLIER).fill(data).flat() : data;
  }, [data, isInfinite, MULTIPLIER]);
    
  // Start position for infinite
  const centerIndex = isInfinite ? Math.floor(MULTIPLIER / 2) * data.length : 0;
  const valIndex = data.indexOf(value);
  const initialScrollIndex = Math.max(0, centerIndex + valIndex);

  const handleScroll = (e: any) => {
    const y = e.nativeEvent.contentOffset.y;
    let index = Math.round(y / ITEM_HEIGHT);
    if (index >= 0 && index < listData.length) {
      if (listData[index] !== value) {
        onChange(listData[index]);
        try { Vibration.vibrate(10); } catch {}
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
            <Text style={{ fontSize: item === value ? 26 : 20, fontWeight: item === value ? '900' : '500', color: item === value ? '#D4A510' : '#9ca3af' }}>
              {typeof item === 'number' ? String(item).padStart(2, '0') : item}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.brandCanvas },
  root: { flex: 1, backgroundColor: theme.colors.brandCanvas },
  loadWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadText: { color: theme.colors.ink500, fontSize: 15 },
  scroll: { flexGrow: 1, paddingBottom: 32 },

  header: { paddingHorizontal: 20, paddingTop: 48, paddingBottom: 16 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  brandDot: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FAE08B', justifyContent: 'center', alignItems: 'center' },
  brandDotText: { color: theme.colors.brandPrimary, fontSize: 11, fontWeight: '900' },
  eyebrow: { color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  brandName: { color: '#fff', fontSize: 15, fontWeight: '800' },
  heroTitle: { color: '#fff', fontSize: 30, fontWeight: '900', lineHeight: 36, letterSpacing: -0.6 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  tabBar: { flexDirection: 'row', marginHorizontal: 16, gap: 6, marginBottom: 8 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center' },
  tabActive: { backgroundColor: '#FAE08B' },
  tabLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 16 },
  tabSublabel: { color: 'rgba(255,255,255,0.7)', fontSize: 8, fontWeight: '700', marginTop: 2 },
  tabLabelActive: { color: theme.colors.brandPrimary },

  card: { marginHorizontal: 16, backgroundColor: '#FAE08B', borderRadius: 28, padding: 20, borderWidth: 1, borderColor: '#fee2e2', shadowColor: '#D4A510', shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 },
  section: { marginBottom: 20 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  secTitle: { color: theme.colors.ink900, fontSize: 18, fontWeight: '900' },
  subTitle: { color: theme.colors.ink900, fontSize: 14, fontWeight: '800', marginBottom: 8, marginTop: 12 },
  muted: { color: theme.colors.ink500, fontStyle: 'italic', fontSize: 13, lineHeight: 20 },

  // Dropdown
  dropdownBtn: { backgroundColor: '#fef2f2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  dropdownBtnText: { color: '#D4A510', fontSize: 12, fontWeight: '800' },
  dropdown: { position: 'absolute', top: 36, right: 0, backgroundColor: '#FAE08B', borderRadius: 12, borderWidth: 1, borderColor: '#fee2e2', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 8, zIndex: 99, minWidth: 140 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 14 },
  dropdownItemText: { color: theme.colors.ink700, fontSize: 13, fontWeight: '700' },

  // % pills
  pctRow: { flexDirection: 'row', gap: 8 },
  pctPill: { flex: 1, borderRadius: 14, padding: 12, alignItems: 'center', gap: 2 },
  pctNum: { fontSize: 22, fontWeight: '900' },
  pctLabel: { color: theme.colors.ink500, fontSize: 10, fontWeight: '700' },

  chartBox: { backgroundColor: '#fafaf9', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#f5f5f4' },
  profileBox: { backgroundColor: '#fafaf9', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#f5f5f4', gap: 8 },
  profileDesc: { color: theme.colors.ink700, fontSize: 14, lineHeight: 21 },
  editPill: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#fef2f2' },
  editPillText: { color: theme.colors.brandPrimary, fontSize: 12, fontWeight: '800' },
  formBox: { backgroundColor: '#fafaf9', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#f5f5f4' },
  label: { color: theme.colors.ink900, fontSize: 12, fontWeight: '700', marginBottom: 4, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 12, padding: 12, backgroundColor: '#fafafa', color: theme.colors.ink900, fontSize: 15 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 6, paddingVertical: 4 },
  switchLabel: { color: theme.colors.ink900, fontSize: 14, fontWeight: '700', flex: 1 },
  datePickerBtn: { justifyContent: 'center' },
  schedBadge: { backgroundColor: '#fef3c7', borderRadius: 10, padding: 10, marginTop: 10 },
  schedBadgeText: { color: '#92400e', fontSize: 13, fontWeight: '700' },

  // Timetable
  timetableRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f5f5f4' },
  dayLabel: { color: theme.colors.ink900, fontSize: 12, fontWeight: '900' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  timeBtn: { backgroundColor: '#eff6ff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  timeBtnText: { color: '#2563eb', fontSize: 14, fontWeight: '800' },
  timeSep: { color: theme.colors.ink500, fontSize: 13 },

  // Categories
  categoryBlock: { marginBottom: 8 },
  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fef2f2', borderRadius: 12, padding: 12, marginBottom: 4 },
  categoryTitle: { color: theme.colors.brandPrimary, fontSize: 14, fontWeight: '900' },
  categoryChevron: { color: theme.colors.brandPrimary, fontSize: 12 },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: { width: '48%', flexGrow: 1, padding: 14, borderRadius: 16, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 20, fontWeight: '900' },
  statLabel: { color: theme.colors.ink500, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginTop: 2 },

  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f4' },
  listDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.brandPrimary || '#D4A510' },
  listMain: { color: theme.colors.ink900, fontSize: 15, fontWeight: '700' },
  listSub: { color: theme.colors.ink500, fontSize: 12, marginTop: 2 },

  itemCard: { backgroundColor: '#fafaf9', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#f5f5f4', marginBottom: 8 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemName: { color: theme.colors.ink900, fontSize: 15, fontWeight: '800' },
  itemSub: { color: theme.colors.ink500, fontSize: 12, marginTop: 2 },
  editBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center' },
  editBadgeText: { fontSize: 14 },
  editActions: { flexDirection: 'row', gap: 6, marginTop: 10 },
  variantSection: { marginTop: 4 },
  variantRow: { flexDirection: 'row', gap: 6, marginBottom: 6, alignItems: 'center' },
  defaultBtn: { width: 36, height: 44, borderRadius: 10, borderWidth: 1, borderColor: '#e5e5e5', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fafafa' },
  defaultBtnActive: { backgroundColor: '#fef3c7', borderColor: '#fbbf24' },
  defaultBtnText: { fontSize: 16 },
  removeBtn: { width: 36, height: 44, borderRadius: 10, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' },
  removeBtnText: { fontSize: 14, color: '#F5C116', fontWeight: '800' },
  addRowBtn: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#eff6ff', marginTop: 4 },
  addRowBtnText: { color: '#2563eb', fontSize: 12, fontWeight: '800' },

  emptyOrders: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { color: theme.colors.ink900, fontSize: 20, fontWeight: '900' },
  orderCard: { backgroundColor: '#fafaf9', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#f5f5f4', marginBottom: 10 },
  orderHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderId: { color: theme.colors.ink900, fontSize: 14, fontWeight: '900' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 9, fontWeight: '800', color: theme.colors.ink900, textTransform: 'uppercase', letterSpacing: 0.5 },
  orderItem: { color: theme.colors.ink700, fontSize: 13, lineHeight: 20 },
  orderTotal: { color: theme.colors.ink900, fontSize: 15, fontWeight: '800', marginTop: 6 },
  customerInfo: { color: theme.colors.ink500, fontSize: 12, marginTop: 4 },
  orderBtns: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  actionBtnText: { fontSize: 13, fontWeight: '800', color: theme.colors.ink900 },

  // Clock Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  clockModal: { backgroundColor: '#FAE08B', borderRadius: 24, padding: 28, alignItems: 'center', minWidth: 240, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  clockTitle: { fontSize: 18, fontWeight: '900', color: theme.colors.ink900, marginBottom: 20 },
  clockFace: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clockCol: { alignItems: 'center', gap: 8 },
  clockArrow: { backgroundColor: '#fef2f2', borderRadius: 10, width: 44, height: 36, alignItems: 'center', justifyContent: 'center' },
  clockArrowText: { fontSize: 16, color: '#D4A510', fontWeight: '900' },
  clockNum: { fontSize: 42, fontWeight: '900', color: theme.colors.ink900, width: 64, textAlign: 'center' },
  clockColon: { fontSize: 42, fontWeight: '900', color: theme.colors.ink500 || '#9ca3af', marginBottom: 8 },
  clockBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, flex: 1, alignItems: 'center' },
  clockBtnText: { fontSize: 14, fontWeight: '800', color: theme.colors.ink900 },

  // Calendar Modal
  calModal: { backgroundColor: '#FAE08B', borderRadius: 24, padding: 20, width: 320, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  calNavRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  calNavBtn: { fontSize: 24, color: '#D4A510', fontWeight: '900', paddingHorizontal: 8 },
  calMonthLabel: { fontSize: 16, fontWeight: '900', color: theme.colors.ink900 },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calDayHeader: { width: `${100 / 7}%` as any, textAlign: 'center', fontSize: 11, fontWeight: '800', color: theme.colors.ink500, paddingBottom: 8 },
  calCell: { width: `${100 / 7}%` as any, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  calCellSelected: { backgroundColor: '#D4A510', borderRadius: 999 },
  calCellText: { fontSize: 14, color: theme.colors.ink900, fontWeight: '600' },
  itemThumb: { width: 50, height: 50, borderRadius: 8, marginRight: 12, backgroundColor: '#eee' },
});


