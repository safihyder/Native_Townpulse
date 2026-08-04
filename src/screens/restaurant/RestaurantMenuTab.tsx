import React, { useMemo, useState } from 'react';
import {
  Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { useToast } from '../../context/ToastContext';
import { launchImageLibrary } from 'react-native-image-picker';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { pick } from '@react-native-documents/picker';
import * as xlsx from 'xlsx';

import { ActionButton } from '../../components/ActionButton';
import { appConfig } from '../../config/appConfig';
import { getFreshFirebaseIdToken } from '../../services/firebaseAuth';

type Variant = { name: string; price: string; isDefault: boolean };
type Addon = { name: string; price: string };

type Props = {
  restaurant: any;
  myItems: any[];
  setMyItems: (items: any[]) => void;
  apiFetch: (path: string, opts?: any) => Promise<any>;
};

export function RestaurantMenuTab({ restaurant, myItems, setMyItems, apiFetch }: Props) {
  const { showToast } = useToast();
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

  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemCategory, setItemCategory] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemIsVeg, setItemIsVeg] = useState(true);
  const [itemHasVariants, setItemHasVariants] = useState(false);
  const [itemVariants, setItemVariants] = useState<Variant[]>([{ name: '', price: '', isDefault: true }]);
  const [itemAddons, setItemAddons] = useState<Addon[]>([]);
  const [isCreatingItem, setIsCreatingItem] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ active: false, pct: 0 });

  const getToken = async () => getFreshFirebaseIdToken();

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

  const refreshItems = async () => {
    try {
      const json = await apiFetch('/api/items/my-items');
      setMyItems(json.items || []);
    } catch { }
  };

  const handleCreateItem = async () => {
    if (!itemName.trim() || !itemCategory.trim()) { showToast({ type: 'error', title: 'Missing Fields', body: 'Please fill Name and Category.' }); return; }
    if (!itemHasVariants && !itemPrice.trim()) { showToast({ type: 'error', title: 'Missing Fields', body: 'Please fill Price or add variants.' }); return; }
    try {
      setIsCreatingItem(true);
      const body: any = {
        restaurantId: restaurant._id, name: itemName.trim(), price: itemHasVariants ? 0 : parseInt(itemPrice, 10),
        category: itemCategory.trim(), description: itemDesc.trim(), isVeg: itemIsVeg, prepTimeMinutes: 15, hasVariants: itemHasVariants,
      };
      if (itemHasVariants) body.variants = itemVariants.filter(v => v.name && v.price).map(v => ({ name: v.name.trim(), price: parseInt(v.price, 10), isDefault: v.isDefault }));
      if (itemAddons.length > 0) body.globalAddOns = itemAddons.filter(a => a.name && a.price).map(a => ({ name: a.name.trim(), price: parseInt(a.price, 10) }));
      await apiFetch('/api/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      showToast({ type: 'success', title: 'Added', body: `"${itemName}" is now on your menu!` });
      setItemName(''); setItemPrice(''); setItemCategory(''); setItemDesc('');
      setItemHasVariants(false); setItemVariants([{ name: '', price: '', isDefault: true }]); setItemAddons([]);
      await refreshItems();
    } catch (err: any) { showToast({ type: 'error', title: 'Error', body: err.message }); }
    finally { setIsCreatingItem(false); }
  };

  const handleUpdateItem = async (itemId: string) => {
    try {
      const body: any = { name: editItemName.trim(), price: editItemHasVariants ? 0 : parseInt(editItemPrice || '0', 10), description: editItemDesc.trim(), category: editItemCategory.trim(), isAvailable: editItemAvailable, hasVariants: editItemHasVariants };
      if (editItemHasVariants) body.variants = editItemVariants.filter(v => v.name && v.price).map(v => ({ name: v.name.trim(), price: parseInt(v.price, 10), isDefault: v.isDefault }));
      body.globalAddOns = editItemAddons.filter(a => a.name && a.price).map(a => ({ name: a.name.trim(), price: parseInt(a.price, 10) }));
      await apiFetch(`/api/items/${itemId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      showToast({ type: 'success', title: 'Updated', body: 'Item updated!' });
      setEditingItemId(null);
      await refreshItems();
    } catch (err: any) { showToast({ type: 'error', title: 'Error', body: err.message }); }
  };

  const handleUploadItemPhoto = async (itemId: string) => {
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.7, maxWidth: 800, maxHeight: 800 });
      if (!result.assets || result.didCancel) return;
      const asset = result.assets[0];
      if (!asset.uri) return;
      const token = await getToken();
      setUploadProgress({ active: true, pct: 0 });
      const response = await ReactNativeBlobUtil.fetch(
        'PATCH',
        `${appConfig.apiBaseUrl}/api/items/${itemId}/image`,
        { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
        [{ name: 'image', filename: asset.fileName || `item_${Date.now()}.jpg`, type: asset.type || 'image/jpeg', data: ReactNativeBlobUtil.wrap(asset.uri.replace('file://', '')) }]
      ).uploadProgress((written, total) => setUploadProgress({ active: true, pct: written / total }));
      setUploadProgress({ active: false, pct: 0 });
      const status = response.respInfo.status;
      const json = JSON.parse(response.data);
      if (status < 200 || status >= 300) throw new Error(json.message || `Upload failed (${status})`);
      showToast({ type: 'success', title: 'Photo Uploaded', body: 'Image added to item successfully!' });
      await refreshItems();
    } catch (err: any) {
      setUploadProgress({ active: false, pct: 0 });
      showToast({ type: 'error', title: 'Upload Error', body: err.message });
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
      showToast({ type: 'success', title: 'Bulk Upload', body: `Imported: ${json.importedCount}, Skipped: ${json.skippedCount}` });
      await refreshItems();
    } catch (err: any) {
      if (!err?.message?.includes('cancel')) showToast({ type: 'error', title: 'Error', body: err.message });
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

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {/* Upload overlay */}
      {uploadProgress.active && (
        <View style={styles.uploadOverlay}>
          <View style={styles.uploadBox}>
            <Text style={styles.uploadTitle}>Uploading...</Text>
            <View style={styles.uploadBar}>
              <View style={[styles.uploadBarFill, { width: `${Math.round(uploadProgress.pct * 100)}%` }]} />
            </View>
            <Text style={styles.uploadPct}>{Math.round(uploadProgress.pct * 100)}%</Text>
          </View>
        </View>
      )}

      {/* Menu Items */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your Menu ({myItems.length} items)</Text>
        {groupedItems.length === 0
          ? <Text style={styles.muted}>No items yet. Add one below!</Text>
          : groupedItems.map(([cat, items]) => (
            <View key={cat} style={styles.categoryBlock}>
              <Pressable style={styles.categoryHeader} onPress={() => toggleCategory(cat)}>
                <Text style={styles.categoryTitle}>{cat} ({items.length})</Text>
                <Text style={styles.categoryChevron}>{expandedCategories.has(cat) ? '\u25B2' : '\u25BC'}</Text>
              </Pressable>

              {expandedCategories.has(cat) && items.map((item: any) => (
                <View key={item._id} style={styles.itemCard}>
                  {editingItemId === item._id ? (
                    <>
                      {item.images?.length > 0 && (
                        <Image source={{ uri: item.images[0] }} style={{ height: 60, width: 60, borderRadius: 8, backgroundColor: '#F3F4F6', marginBottom: 10 }} />
                      )}
                      <Text style={styles.label}>Name</Text>
                      <TextInput style={styles.input} value={editItemName} onChangeText={setEditItemName} />
                      <Text style={styles.label}>Description</Text>
                      <TextInput style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]} value={editItemDesc} onChangeText={setEditItemDesc} multiline />
                      <Text style={styles.label}>Category</Text>
                      <TextInput style={styles.input} value={editItemCategory} onChangeText={setEditItemCategory} />
                      <View style={styles.switchRow}>
                        <Text style={styles.switchLabel}>Available</Text>
                        <Switch value={editItemAvailable} onValueChange={setEditItemAvailable} trackColor={{ false: '#FEE2E2', true: '#BBF7D0' }} thumbColor={editItemAvailable ? '#15803D' : '#EF4444'} />
                      </View>
                      <View style={styles.switchRow}>
                        <Text style={styles.switchLabel}>Has Variants?</Text>
                        <Switch value={editItemHasVariants} onValueChange={setEditItemHasVariants} trackColor={{ false: '#E5E7EB', true: '#BFDBFE' }} thumbColor={editItemHasVariants ? '#2563EB' : '#9CA3AF'} />
                      </View>
                      {!editItemHasVariants ? (
                        <><Text style={styles.label}>Price ({'\u20B9'})</Text><TextInput style={styles.input} value={editItemPrice} onChangeText={setEditItemPrice} keyboardType="numeric" /></>
                      ) : (
                        <View style={{ marginTop: 4 }}>
                          <Text style={styles.subTitle}>Variants</Text>
                          {editItemVariants.map((v, vi) => (
                            <View key={vi} style={styles.variantRow}>
                              <TextInput style={[styles.input, { flex: 2 }]} value={v.name} onChangeText={val => editUpdateVariant(vi, 'name', val)} placeholder="Size" placeholderTextColor="#CCC" />
                              <TextInput style={[styles.input, { flex: 1 }]} value={v.price} onChangeText={val => editUpdateVariant(vi, 'price', val)} placeholder={'\u20B9'} placeholderTextColor="#CCC" keyboardType="numeric" />
                              <Pressable onPress={() => editUpdateVariant(vi, 'isDefault', true)} style={[styles.defaultBtn, v.isDefault && styles.defaultBtnActive]}><Text style={styles.defaultBtnText}>{v.isDefault ? '\u2605' : '\u2606'}</Text></Pressable>
                              {editItemVariants.length > 1 && <Pressable onPress={() => editRemoveVariant(vi)} style={styles.removeBtn}><Text style={styles.removeBtnText}>{'\u2715'}</Text></Pressable>}
                            </View>
                          ))}
                          <Pressable onPress={editAddVariant} style={styles.addRowBtn}><Text style={styles.addRowBtnText}>+ Add Variant</Text></Pressable>
                        </View>
                      )}
                      <View style={{ marginTop: 4 }}>
                        <Text style={styles.subTitle}>Add-ons</Text>
                        {editItemAddons.map((a, ai) => (
                          <View key={ai} style={styles.variantRow}>
                            <TextInput style={[styles.input, { flex: 2 }]} value={a.name} onChangeText={val => editUpdateAddon(ai, 'name', val)} placeholder="Add-on" placeholderTextColor="#CCC" />
                            <TextInput style={[styles.input, { flex: 1 }]} value={a.price} onChangeText={val => editUpdateAddon(ai, 'price', val)} placeholder={'\u20B9'} placeholderTextColor="#CCC" keyboardType="numeric" />
                            <Pressable onPress={() => editRemoveAddon(ai)} style={styles.removeBtn}><Text style={styles.removeBtnText}>{'\u2715'}</Text></Pressable>
                          </View>
                        ))}
                        <Pressable onPress={editAddAddon} style={styles.addRowBtn}><Text style={styles.addRowBtnText}>+ Add Add-on</Text></Pressable>
                      </View>
                      <View style={styles.editActions}>
                        <Pressable style={[styles.actionBtn, { backgroundColor: '#ECFDF5' }]} onPress={() => handleUpdateItem(item._id)}><Text style={[styles.actionBtnText, { color: '#15803D' }]}>Save</Text></Pressable>
                        <Pressable style={[styles.actionBtn, { backgroundColor: '#FFF7ED' }]} onPress={() => handleUploadItemPhoto(item._id)}><Text style={[styles.actionBtnText, { color: '#F5A623' }]}>Photo</Text></Pressable>
                        <Pressable style={[styles.actionBtn, { backgroundColor: '#FEF2F2' }]} onPress={() => setEditingItemId(null)}><Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Cancel</Text></Pressable>
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
                      <View style={styles.itemRow}>
                        {item.images?.length > 0 && <Image source={{ uri: item.images[0] }} style={styles.itemThumb} />}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemName}>
                            <View style={[styles.vegDot, { backgroundColor: item.isVeg ? '#22C55E' : '#EF4444' }]} />
                            {'  '}{item.name}{item.isAvailable === false ? '  (Hidden)' : ''}
                          </Text>
                          <Text style={styles.itemSub}>{'\u20B9'}{item.price}{item.hasVariants ? ' (variants)' : ''}{item.isAvailable === false ? ' · HIDDEN' : ''}</Text>
                        </View>
                        <View style={styles.editBadge}><Text style={styles.editBadgeText}>Edit</Text></View>
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
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Add New Item</Text>
        <Text style={styles.label}>Name *</Text>
        <TextInput style={styles.input} value={itemName} onChangeText={setItemName} placeholder="e.g. Butter Chicken" placeholderTextColor="#CCC" />
        <Text style={styles.label}>Description</Text>
        <TextInput style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]} value={itemDesc} onChangeText={setItemDesc} placeholder="Describe this dish..." placeholderTextColor="#CCC" multiline />
        <Text style={styles.label}>Category *</Text>
        <TextInput style={styles.input} value={itemCategory} onChangeText={setItemCategory} placeholder="Main Course" placeholderTextColor="#CCC" />
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Vegetarian</Text>
          <Switch value={itemIsVeg} onValueChange={setItemIsVeg} trackColor={{ false: '#FEE2E2', true: '#BBF7D0' }} thumbColor={itemIsVeg ? '#15803D' : '#EF4444'} />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Has Size/Variants?</Text>
          <Switch value={itemHasVariants} onValueChange={setItemHasVariants} trackColor={{ false: '#E5E7EB', true: '#BFDBFE' }} thumbColor={itemHasVariants ? '#2563EB' : '#9CA3AF'} />
        </View>
        {!itemHasVariants ? (
          <><Text style={styles.label}>Base Price ({'\u20B9'}) *</Text><TextInput style={styles.input} value={itemPrice} onChangeText={setItemPrice} placeholder="250" placeholderTextColor="#CCC" keyboardType="numeric" /></>
        ) : (
          <View style={{ marginTop: 4 }}>
            <Text style={styles.subTitle}>Variants / Sizes</Text>
            {itemVariants.map((v, i) => (
              <View key={i} style={styles.variantRow}>
                <TextInput style={[styles.input, { flex: 2 }]} value={v.name} onChangeText={val => updateVariant(i, 'name', val)} placeholder="e.g. Small" placeholderTextColor="#CCC" />
                <TextInput style={[styles.input, { flex: 1 }]} value={v.price} onChangeText={val => updateVariant(i, 'price', val)} placeholder={'\u20B9'} placeholderTextColor="#CCC" keyboardType="numeric" />
                <Pressable onPress={() => updateVariant(i, 'isDefault', true)} style={[styles.defaultBtn, v.isDefault && styles.defaultBtnActive]}><Text style={styles.defaultBtnText}>{v.isDefault ? '\u2605' : '\u2606'}</Text></Pressable>
                {itemVariants.length > 1 && <Pressable onPress={() => removeVariant(i)} style={styles.removeBtn}><Text style={styles.removeBtnText}>{'\u2715'}</Text></Pressable>}
              </View>
            ))}
            <Pressable onPress={addVariant} style={styles.addRowBtn}><Text style={styles.addRowBtnText}>+ Add Variant</Text></Pressable>
          </View>
        )}
        <View style={{ marginTop: 4 }}>
          <Text style={styles.subTitle}>Add-ons (optional)</Text>
          {itemAddons.map((a, i) => (
            <View key={i} style={styles.variantRow}>
              <TextInput style={[styles.input, { flex: 2 }]} value={a.name} onChangeText={val => updateAddon(i, 'name', val)} placeholder="e.g. Extra Cheese" placeholderTextColor="#CCC" />
              <TextInput style={[styles.input, { flex: 1 }]} value={a.price} onChangeText={val => updateAddon(i, 'price', val)} placeholder={'\u20B9'} placeholderTextColor="#CCC" keyboardType="numeric" />
              <Pressable onPress={() => removeAddon(i)} style={styles.removeBtn}><Text style={styles.removeBtnText}>{'\u2715'}</Text></Pressable>
            </View>
          ))}
          <Pressable onPress={addAddon} style={styles.addRowBtn}><Text style={styles.addRowBtnText}>+ Add Add-on</Text></Pressable>
        </View>
        <View style={{ marginTop: 12 }}>
          <ActionButton label="Add to Menu" onPress={handleCreateItem} isLoading={isCreatingItem} />
        </View>
      </View>

      {/* Bulk Import */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Bulk Import (.xlsx)</Text>
        <Text style={styles.muted}>Upload an Excel file to mass-import items.</Text>
        <View style={{ marginTop: 10 }}>
          <ActionButton label="Select Excel File" onPress={handleBulkUpload} variant="primary" />
        </View>
      </View>

      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, marginBottom: 12,
    borderWidth: 1, borderColor: '#F3F4F6', elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8,
  },
  cardTitle: { color: '#1C2434', fontSize: 17, fontWeight: '800', marginBottom: 12 },
  muted: { color: '#9CA3AF', fontStyle: 'italic', fontSize: 13 },
  label: { color: '#1C2434', fontSize: 12, fontWeight: '700', marginBottom: 4, marginTop: 10 },
  subTitle: { color: '#1C2434', fontSize: 14, fontWeight: '800', marginBottom: 8, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, backgroundColor: '#FAFAFA', color: '#1C2434', fontSize: 15 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 6, paddingVertical: 4 },
  switchLabel: { color: '#1C2434', fontSize: 14, fontWeight: '700', flex: 1 },
  categoryBlock: { marginBottom: 8 },
  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF7ED', borderRadius: 12, padding: 12, marginBottom: 4 },
  categoryTitle: { color: '#f8910af4', fontSize: 14, fontWeight: '900' },
  categoryChevron: { color: '#F5A623', fontSize: 12 },
  itemCard: { backgroundColor: '#FAFAFA', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#F3F4F6', marginBottom: 8 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemName: { color: '#1C2434', fontSize: 15, fontWeight: '800' },
  itemSub: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  itemThumb: { width: 50, height: 50, borderRadius: 8, marginRight: 12, backgroundColor: '#F3F4F6' },
  vegDot: { width: 8, height: 8, borderRadius: 4 },
  editBadge: { backgroundColor: '#FFF7ED', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  editBadgeText: { fontSize: 12, fontWeight: '700', color: '#F5A623' },
  editActions: { flexDirection: 'row', gap: 6, marginTop: 10 },
  variantRow: { flexDirection: 'row', gap: 6, marginBottom: 6, alignItems: 'center' },
  defaultBtn: { width: 36, height: 44, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFAFA' },
  defaultBtnActive: { backgroundColor: '#FFF7ED', borderColor: '#F5A623' },
  defaultBtnText: { fontSize: 16 },
  removeBtn: { width: 36, height: 44, borderRadius: 10, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  removeBtnText: { fontSize: 14, color: '#EF4444', fontWeight: '800' },
  addRowBtn: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#EFF6FF', marginTop: 4 },
  addRowBtnText: { color: '#2563EB', fontSize: 12, fontWeight: '800' },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  actionBtnText: { fontSize: 13, fontWeight: '800' },
  uploadOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
  uploadBox: { backgroundColor: '#FFF', padding: 24, borderRadius: 16, width: '75%', alignItems: 'center' },
  uploadTitle: { fontWeight: '900', marginBottom: 12, color: '#1C2434', fontSize: 16 },
  uploadBar: { height: 8, width: '100%', backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  uploadBarFill: { height: '100%', backgroundColor: '#F5A623', borderRadius: 4 },
  uploadPct: { marginTop: 12, fontSize: 13, color: '#9CA3AF', fontWeight: '800' },
});
