import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, TextInput, Modal, Dimensions, ActivityIndicator, TouchableOpacity } from 'react-native';
import { NativeBarChart } from '../../components/NativeBarChart';
import { NativeLineChart } from '../../components/NativeLineChart';

type Props = {
  dashboard: any;
  apiFetch: (path: string, opts?: any) => Promise<any>;
};

type ChartMode = 'bar' | 'pie' | 'both';
type DateRangeType = 'Today' | 'This Week' | 'This Month' | 'Last Month' | 'Last 3 Months' | 'Last 6 Months' | 'Custom' | 'All';

// Slim order type — only the fields we need for client-side filtering
type SlimOrder = {
  createdAt: string;
  status: string;
  fulfillmentType: string;
  payMode: string;
  payStatus: string;
  grandTotal: number;
  items: { name: string; quantity: number; itemTotal: number }[];
};

// ─── Helper: format date as "12 Jul 2026" ───────────────────────────────────────
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_HEADER = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const fmtDate = (d: Date) => `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const isBetween = (d: Date, from: Date, to: Date) => d >= from && d <= to;

// Strip a raw order to only the ~6 fields needed for analytics (saves ~90% memory)
const toSlim = (o: any): SlimOrder => ({
  createdAt: o.createdAt,
  status: o.status,
  fulfillmentType: o.fulfillment?.type || '',
  payMode: o.payment?.mode || '',
  payStatus: o.payment?.status || '',
  grandTotal: o.pricing?.grandTotal || 0,
  items: (o.items || []).map((i: any) => ({
    name: i.name || 'Item',
    quantity: i.quantity || 1,
    itemTotal: i.itemTotal || 0,
  })),
});

export function RestaurantAnalyticsTab({ dashboard, apiFetch }: Props) {
  const [chartMode, setChartMode] = useState<ChartMode>('bar');
  const [chartDropdownOpen, setChartDropdownOpen] = useState(false);

  // ─── Lazy paginated order history loading ──────────────────────────────────────
  const [orderHistory, setOrderHistory] = useState<SlimOrder[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const fetchingRef = useRef(false);

  useEffect(() => {
    if (historyLoaded || fetchingRef.current) return;
    fetchingRef.current = true;
    setHistoryLoading(true);

    let cancelled = false;
    const loadAllPages = async () => {
      let accumulated: SlimOrder[] = [];
      const limit = 500; // Larger limit for fewer network roundtrips

      try {
        // 1. Fetch initial chunk to get totalPages
        const json1 = await apiFetch(`/api/orders/restaurant/history?page=1&limit=${limit}`);
        if (cancelled) return;

        accumulated = (json1.orders || []).map(toSlim);
        setOrderHistory([...accumulated]); // Instantly show first 500 orders

        const totalPages = json1.totalPages || 1;
        if (totalPages > 1) {
          // 2. Fetch remaining requests sequentially to prevent server overload
          for (let p = 2; p <= totalPages; p++) {
            if (cancelled) break;
            try {
              const res = await apiFetch(`/api/orders/restaurant/history?page=${p}&limit=${limit}`);
              const batch = (res.orders || []).map(toSlim);
              accumulated = [...accumulated, ...batch];
              
              // Optional: Update state progressively so the user sees data filling in
              setOrderHistory([...accumulated]);
            } catch (err) {
              console.log(`Error fetching page ${p}`, err);
              break; // Stop fetching if an error occurs to prevent endless failing requests
            }
          }
        }
      } catch (err) {
        console.log('Error loading history', err);
      }

      if (!cancelled) {
        setHistoryLoaded(true);
        setHistoryLoading(false);
        fetchingRef.current = false;
      }
    };

    loadAllPages();
    return () => { cancelled = true; };
  }, [apiFetch, historyLoaded]);

  // Filters State
  const [showFilters, setShowFilters] = useState(false);
  const [fDateRange, setFDateRange] = useState<DateRangeType>('All');
  const [fOrderType, setFOrderType] = useState<'All' | 'delivery' | 'pickup' | 'dine_in'>('All');
  const [fPayment, setFPayment] = useState<'All' | 'UPI' | 'Card' | 'Cash' | 'Wallet'>('All');
  const [fPaymentStatus, setFPaymentStatus] = useState<'All' | 'paid' | 'pending' | 'failed'>('All');
  const [fSettlement, setFSettlement] = useState<'All' | 'Settled' | 'Pending'>('All');
  const [fTimeSlot, setFTimeSlot] = useState<'All' | 'Breakfast' | 'Lunch' | 'Dinner' | 'Late Night'>('All');

  // Filter application loader
  const [isApplyingFilter, setIsApplyingFilter] = useState(false);
  const applyFilter = useCallback((setter: any, val: any) => {
    setIsApplyingFilter(true);
    // Yield to the UI thread so the loader renders, then do heavy work
    setTimeout(() => {
      setter(val);
      setTimeout(() => setIsApplyingFilter(false), 10);
    }, 50);
  }, []);

  // Custom date picker state
  const [customFrom, setCustomFrom] = useState<Date | null>(null);
  const [customTo, setCustomTo] = useState<Date | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calPickingField, setCalPickingField] = useState<'from' | 'to'>('from');
  const [calViewMonth, setCalViewMonth] = useState(new Date().getMonth());
  const [calViewYear, setCalViewYear] = useState(new Date().getFullYear());

  // Derive oldest order date (earliest date the user can pick)
  const oldestOrderDate = useMemo(() => {
    if (orderHistory.length === 0) return new Date();
    return orderHistory.reduce((min, o) => {
      const d = new Date(o.createdAt);
      return d < min ? d : min;
    }, new Date());
  }, [orderHistory]);

  const openCalendar = (field: 'from' | 'to') => {
    setCalPickingField(field);
    const ref = field === 'from' ? (customFrom || new Date()) : (customTo || new Date());
    setCalViewMonth(ref.getMonth());
    setCalViewYear(ref.getFullYear());
    setShowCalendar(true);
  };

  const onSelectCalDate = (day: number) => {
    const picked = new Date(calViewYear, calViewMonth, day);
    if (calPickingField === 'from') {
      setCustomFrom(picked);
      if (customTo && picked > customTo) setCustomTo(null);
    } else {
      setCustomTo(picked);
    }
    setShowCalendar(false);
    setFDateRange('Custom');
  };

  const calPrevMonth = () => {
    if (calViewMonth === 0) { setCalViewMonth(11); setCalViewYear(y => y - 1); }
    else setCalViewMonth(m => m - 1);
  };
  const calNextMonth = () => {
    if (calViewMonth === 11) { setCalViewMonth(0); setCalViewYear(y => y + 1); }
    else setCalViewMonth(m => m + 1);
  };

  const { commRate, gross, net, acceptedPct, rejectedPct, totalAccepted, totalRejected, totalOrders, dailyRev, ordersBrk, topItems } = useMemo(() => {
    let filtered = orderHistory;

    const now = new Date();
    if (fDateRange === 'Today') {
      filtered = filtered.filter(o => new Date(o.createdAt).toDateString() === now.toDateString());
    } else if (fDateRange === 'This Week') {
      const w = new Date(); w.setDate(now.getDate() - 7);
      filtered = filtered.filter(o => new Date(o.createdAt) >= w);
    } else if (fDateRange === 'This Month') {
      filtered = filtered.filter(o => {
        const d = new Date(o.createdAt);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
    } else if (fDateRange === 'Last Month') {
      filtered = filtered.filter(o => {
        const d = new Date(o.createdAt);
        const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        return d.getMonth() === lastMonth && d.getFullYear() === year;
      });
    } else if (fDateRange === 'Last 3 Months') {
      const m3 = new Date(); m3.setMonth(now.getMonth() - 3);
      filtered = filtered.filter(o => new Date(o.createdAt) >= m3);
    } else if (fDateRange === 'Last 6 Months') {
      const m6 = new Date(); m6.setMonth(now.getMonth() - 6);
      filtered = filtered.filter(o => new Date(o.createdAt) >= m6);
    } else if (fDateRange === 'Custom' && customFrom) {
      const fromStart = new Date(customFrom); fromStart.setHours(0, 0, 0, 0);
      const toEnd = customTo ? new Date(customTo) : new Date(); toEnd.setHours(23, 59, 59, 999);
      filtered = filtered.filter(o => {
        const d = new Date(o.createdAt);
        return d >= fromStart && d <= toEnd;
      });
    }

    if (fOrderType !== 'All') {
      filtered = filtered.filter(o => o.fulfillmentType?.toUpperCase() === fOrderType.toUpperCase());
    }

    if (fPayment !== 'All') {
      const backendMode = fPayment === 'Cash' ? 'CASH' : fPayment === 'Wallet' ? 'WALLET' : 'ONLINE';
      filtered = filtered.filter(o => o.payMode === backendMode);
    }

    if (fPaymentStatus !== 'All') {
      filtered = filtered.filter(o => o.payStatus?.toUpperCase() === fPaymentStatus.toUpperCase());
    }

    if (fSettlement !== 'All') {
      filtered = filtered.filter(o => {
        const isPaid = o.payStatus === 'PAID';
        const isOld = (Date.now() - new Date(o.createdAt).getTime()) > 2 * 24 * 60 * 60 * 1000; // 2 days old
        const st = (isPaid && isOld) ? 'Settled' : 'Pending';
        return st === fSettlement;
      });
    }

    if (fTimeSlot !== 'All') {
      filtered = filtered.filter(o => {
        const h = new Date(o.createdAt).getHours();
        if (fTimeSlot === 'Breakfast') return h >= 6 && h < 12;
        if (fTimeSlot === 'Lunch') return h >= 12 && h < 17;
        if (fTimeSlot === 'Dinner') return h >= 17 && h < 23;
        if (fTimeSlot === 'Late Night') return h >= 23 || h < 6;
        return true;
      });
    }

    let g = 0, acc = 0, rej = 0;
    const itemsMap: any = {};
    const dRev: any = {};
    const dBrk: any = {};

    filtered.forEach(o => {
      g += o.grandTotal;
      
      const isAcc = ['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'].includes(o.status);
      const isRej = ['CANCELLED', 'REJECTED'].includes(o.status);
      
      if (isAcc) acc++; else if (isRej) rej++;

      o.items?.forEach((i: any) => {
        const itemId = i.name;
        if (!itemsMap[itemId]) itemsMap[itemId] = { _id: itemId, name: i.name, totalSold: 0, revenue: 0 };
        itemsMap[itemId].totalSold += i.quantity;
        itemsMap[itemId].revenue += i.itemTotal;
      });

      const dateStr = new Date(o.createdAt).toISOString().split('T')[0];
      if (!dRev[dateStr]) dRev[dateStr] = 0;
      dRev[dateStr] += o.grandTotal;

      if (!dBrk[dateStr]) dBrk[dateStr] = { date: dateStr, accepted: 0, rejected: 0 };
      if (isAcc) dBrk[dateStr].accepted++;
      else if (isRej) dBrk[dateStr].rejected++;
    });

    const cRate = dashboard?.commissionRate ?? 20;
    const n = Math.round(g * (1 - cRate / 100));

    const total = acc + rej;
    const aPct = total > 0 ? Math.round((acc / total) * 100) : 0;
    const rPct = total > 0 ? Math.round((rej / total) * 100) : 0;

    const tItems = Object.values(itemsMap).sort((a: any, b: any) => b.totalSold - a.totalSold).slice(0, 5);
    const revArr = Object.keys(dRev).sort().map(d => ({ date: d, revenue: dRev[d] }));
    const brkArr = Object.values(dBrk).sort((a: any, b: any) => a.date.localeCompare(b.date));

    // Fallback to initial dashboard if no local data
    const finalG = (fDateRange === 'All' && filtered.length === 0) ? (dashboard?.totalSales || 0) : g;
    const finalN = (fDateRange === 'All' && filtered.length === 0) ? (dashboard?.netEarnings || Math.round(finalG * (1 - cRate / 100))) : n;
    
    return {
      commRate: cRate,
      gross: finalG,
      net: finalN,
      acceptedPct: (fDateRange === 'All' && filtered.length === 0) ? (dashboard?.acceptedPct || 0) : aPct,
      rejectedPct: (fDateRange === 'All' && filtered.length === 0) ? (dashboard?.rejectedPct || 0) : rPct,
      totalAccepted: (fDateRange === 'All' && filtered.length === 0) ? (dashboard?.totalAccepted || 0) : acc,
      totalRejected: (fDateRange === 'All' && filtered.length === 0) ? (dashboard?.totalRejected || 0) : rej,
      totalOrders: (fDateRange === 'All' && filtered.length === 0) ? (dashboard?.totalOrders || 0) : filtered.length,
      dailyRev: (fDateRange === 'All' && filtered.length === 0) ? (dashboard?.dailyRevenue || []) : revArr,
      ordersBrk: (fDateRange === 'All' && filtered.length === 0) ? (dashboard?.ordersBreakdown || []) : brkArr,
      topItems: (fDateRange === 'All' && filtered.length === 0) ? (dashboard?.mostSellingItems || []) : tItems,
    };
  }, [orderHistory, dashboard, fDateRange, fOrderType, fPayment, fPaymentStatus, fSettlement, fTimeSlot, customFrom, customTo]);

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled">

      {/* Greeting Card */}
      <View style={styles.greetingCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={styles.greetingTitle}>Restaurant Overview</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.greetingSub}>Your business at a glance</Text>
              {historyLoading && <ActivityIndicator size="small" color="#F5A623" />}
            </View>
          </View>
          <TouchableOpacity activeOpacity={0.6} style={styles.dropdownBtn} onPress={() => setShowFilters(!showFilters)}>
            <Text style={styles.dropdownBtnText}>{showFilters ? 'Hide Filters' : 'Show Filters'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filters Drawer */}
      {showFilters && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Filters</Text>
          
          <Text style={styles.filterLabel}>Date Range</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {['All', 'Today', 'This Week', 'This Month', 'Last Month', 'Last 3 Months', 'Last 6 Months', 'Custom'].map(f => (
              <TouchableOpacity key={f} activeOpacity={0.6} onPress={() => {
                if (f === 'Custom') { 
                  applyFilter(setFDateRange, 'Custom');
                  if (!customFrom) openCalendar('from');
                } else {
                  setIsApplyingFilter(true);
                  setTimeout(() => {
                    setFDateRange(f as any);
                    setCustomFrom(null); 
                    setCustomTo(null);
                    setTimeout(() => setIsApplyingFilter(false), 10);
                  }, 50);
                }
              }} style={[styles.filterChip, fDateRange === f && styles.filterChipActive]}>
                <Text style={[styles.filterChipText, fDateRange === f && styles.filterChipTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Custom Date Picker Row */}
          {fDateRange === 'Custom' && (
            <View style={styles.customDateRow}>
              <Pressable style={styles.datePickerBtn} onPress={() => openCalendar('from')}>
                <Text style={styles.datePickerIcon}>📅</Text>
                <View>
                  <Text style={styles.datePickerHint}>From</Text>
                  <Text style={styles.datePickerValue}>{customFrom ? fmtDate(customFrom) : 'Select'}</Text>
                </View>
              </Pressable>
              <Text style={styles.datePickerDash}>→</Text>
              <Pressable style={styles.datePickerBtn} onPress={() => openCalendar('to')}>
                <Text style={styles.datePickerIcon}>📅</Text>
                <View>
                  <Text style={styles.datePickerHint}>To</Text>
                  <Text style={styles.datePickerValue}>{customTo ? fmtDate(customTo) : 'Today'}</Text>
                </View>
              </Pressable>
            </View>
          )}

          <Text style={styles.filterLabel}>Order Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {['All', 'delivery', 'pickup', 'dine_in'].map(f => (
              <TouchableOpacity key={f} activeOpacity={0.6} onPress={() => applyFilter(setFOrderType, f)} style={[styles.filterChip, fOrderType === f && styles.filterChipActive]}>
                <Text style={[styles.filterChipText, fOrderType === f && styles.filterChipTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.filterLabel}>Payment Method</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {['All', 'UPI', 'Card', 'Cash', 'Wallet'].map(f => (
              <TouchableOpacity key={f} activeOpacity={0.6} onPress={() => applyFilter(setFPayment, f)} style={[styles.filterChip, fPayment === f && styles.filterChipActive]}>
                <Text style={[styles.filterChipText, fPayment === f && styles.filterChipTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.filterLabel}>Payment Status</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {['All', 'paid', 'pending', 'failed'].map(f => (
              <TouchableOpacity key={f} activeOpacity={0.6} onPress={() => applyFilter(setFPaymentStatus, f)} style={[styles.filterChip, fPaymentStatus === f && styles.filterChipActive]}>
                <Text style={[styles.filterChipText, fPaymentStatus === f && styles.filterChipTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.filterLabel}>Settlement Status</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {['All', 'Settled', 'Pending'].map(f => (
              <TouchableOpacity key={f} activeOpacity={0.6} onPress={() => applyFilter(setFSettlement, f)} style={[styles.filterChip, fSettlement === f && styles.filterChipActive]}>
                <Text style={[styles.filterChipText, fSettlement === f && styles.filterChipTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.filterLabel}>Time Slot</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {['All', 'Breakfast', 'Lunch', 'Dinner', 'Late Night'].map(f => (
              <TouchableOpacity key={f} activeOpacity={0.6} onPress={() => applyFilter(setFTimeSlot, f)} style={[styles.filterChip, fTimeSlot === f && styles.filterChipActive]}>
                <Text style={[styles.filterChipText, fTimeSlot === f && styles.filterChipTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

        </View>
      )}

      {/* Calendar Modal */}
      <Modal visible={showCalendar} transparent animationType="fade" onRequestClose={() => setShowCalendar(false)}>
        <Pressable style={styles.calOverlay} onPress={() => setShowCalendar(false)}>
          <Pressable style={styles.calContainer} onPress={() => {}}>
            {/* Header */}
            <View style={styles.calHeader}>
              <Text style={styles.calTitle}>
                {calPickingField === 'from' ? 'Select Start Date' : 'Select End Date'}
              </Text>
              <Pressable onPress={() => setShowCalendar(false)}>
                <Text style={styles.calClose}>✕</Text>
              </Pressable>
            </View>

            {/* Month Navigator */}
            <View style={styles.calMonthNav}>
              <Pressable onPress={calPrevMonth} style={styles.calNavBtn}>
                <Text style={styles.calNavText}>◀</Text>
              </Pressable>
              <Text style={styles.calMonthLabel}>
                {MONTHS_FULL[calViewMonth]} {calViewYear}
              </Text>
              <Pressable onPress={calNextMonth} style={styles.calNavBtn}>
                <Text style={styles.calNavText}>▶</Text>
              </Pressable>
            </View>

            {/* Day-of-week headers */}
            <View style={styles.calDaysHeader}>
              {DAYS_HEADER.map(d => (
                <Text key={d} style={styles.calDayHeaderText}>{d}</Text>
              ))}
            </View>

            {/* Day grid */}
            <View style={styles.calGrid}>
              {(() => {
                const firstDay = new Date(calViewYear, calViewMonth, 1).getDay();
                const daysInMonth = new Date(calViewYear, calViewMonth + 1, 0).getDate();
                const today = new Date(); today.setHours(0,0,0,0);
                const earliest = new Date(oldestOrderDate); earliest.setHours(0,0,0,0);
                const cells = [];

                // Blank cells for days before the 1st
                for (let b = 0; b < firstDay; b++) {
                  cells.push(<View key={`blank-${b}`} style={styles.calCell} />);
                }

                for (let day = 1; day <= daysInMonth; day++) {
                  const thisDate = new Date(calViewYear, calViewMonth, day);
                  const isBeforeEarliest = thisDate < earliest;
                  const isAfterToday = thisDate > today;
                  // For 'to' field, cannot be before 'from'
                  const isBeforeFrom = calPickingField === 'to' && customFrom && thisDate < customFrom;
                  const disabled = isBeforeEarliest || isAfterToday || !!isBeforeFrom;

                  const isSelected = (calPickingField === 'from' && customFrom && isSameDay(thisDate, customFrom))
                    || (calPickingField === 'to' && customTo && isSameDay(thisDate, customTo));
                  const isInRange = customFrom && customTo && isBetween(thisDate, customFrom, customTo);
                  const isToday = isSameDay(thisDate, today);

                  cells.push(
                    <Pressable
                      key={day}
                      disabled={disabled}
                      onPress={() => onSelectCalDate(day)}
                      style={[
                        styles.calCell,
                        isInRange && !isSelected && styles.calCellInRange,
                        isSelected && styles.calCellSelected,
                      ]}>
                      <Text style={[
                        styles.calCellText,
                        disabled && styles.calCellTextDisabled,
                        isSelected && styles.calCellTextSelected,
                        isToday && !isSelected && styles.calCellTextToday,
                      ]}>
                        {day}
                      </Text>
                    </Pressable>
                  );
                }
                return cells;
              })()}
            </View>

            {/* Selected range summary */}
            {(customFrom || customTo) && (
              <View style={styles.calSummary}>
                <Text style={styles.calSummaryText}>
                  {customFrom ? fmtDate(customFrom) : '...'} → {customTo ? fmtDate(customTo) : 'Today'}
                </Text>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Order Analytics */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Order Analytics</Text>
          <View>
            <TouchableOpacity activeOpacity={0.6} style={styles.dropdownBtn} onPress={() => setChartDropdownOpen(o => !o)}>
              <Text style={styles.dropdownBtnText}>
                {chartMode === 'bar' ? 'Bar Chart' : chartMode === 'pie' ? 'Pie Chart' : 'Both'}
              </Text>
            </TouchableOpacity>
            {chartDropdownOpen && (
              <View style={styles.dropdown}>
                {(['bar', 'pie', 'both'] as ChartMode[]).map(m => (
                  <TouchableOpacity key={m} activeOpacity={0.7} style={styles.dropdownItem} onPress={() => { setChartMode(m); setChartDropdownOpen(false); }}>
                    <Text style={[styles.dropdownItemText, chartMode === m && { color: '#F5A623', fontWeight: '900' }]}>
                      {m === 'bar' ? 'Bar Chart' : m === 'pie' ? 'Pie Chart' : 'Both'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* % summary row */}
        <View style={styles.pctRow}>
          <View style={[styles.pctPill, { backgroundColor: '#ECFDF5' }]}>
            <Text style={[styles.pctNum, { color: '#15803D' }]}>{acceptedPct}%</Text>
            <Text style={styles.pctLabel}>Accepted</Text>
          </View>
          <View style={[styles.pctPill, { backgroundColor: '#FEF2F2' }]}>
            <Text style={[styles.pctNum, { color: '#EF4444' }]}>{rejectedPct}%</Text>
            <Text style={styles.pctLabel}>Rejected</Text>
          </View>
          <View style={[styles.pctPill, { backgroundColor: '#FFF7ED' }]}>
            <Text style={[styles.pctNum, { color: '#F5A623' }]}>{totalAccepted + totalRejected}</Text>
            <Text style={styles.pctLabel}>Total</Text>
          </View>
        </View>
      </View>

      {/* Charts */}
      {ordersBrk?.length > 0 && (chartMode === 'bar' || chartMode === 'both') && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Orders Trend</Text>
          <View style={styles.chartBox}>
            <OrdersBarChart data={ordersBrk} />
          </View>
        </View>
      )}

      {(chartMode === 'pie' || chartMode === 'both') && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Acceptance Rate</Text>
          <View style={styles.chartBox}>
            <PieChart accepted={acceptedPct} rejected={rejectedPct} />
          </View>
        </View>
      )}

      {/* Revenue bar */}
      {dailyRev?.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Revenue Trend</Text>
          <View style={styles.chartBox}>
            <NativeBarChart data={dailyRev.map((d: any) => ({ label: d.date.slice(5), value: d.revenue }))} height={150} />
          </View>
        </View>
      )}

      {/* Revenue Line Chart */}
      {dailyRev?.length > 1 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Revenue Growth</Text>
          <View style={styles.chartBox}>
            <NativeLineChart data={dailyRev.map((d: any) => ({ label: d.date.slice(5), value: d.revenue }))} height={180} />
          </View>
        </View>
      )}

      {/* Financial Overview */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Financial Overview</Text>
        <View style={styles.statGrid}>
          <StatCard label="Gross" value={`\u20B9${gross}`} bg="#ECFDF5" accent="#059669" />
          <StatCard label="Net" value={`\u20B9${net}`} bg="#FFF7ED" accent="#F5A623" />
          <StatCard label="Total Orders" value={`${totalOrders}`} bg="#FEF2F2" accent="#EA580C" />
          <StatCard label="Commission" value={`${commRate}%`} bg="#FEF2F2" accent="#EF4444" />
          <StatCard label="Rating" value={`${dashboard?.rating ?? 0}`} bg="#FFFBEB" accent="#CA8A04" />
          <StatCard label="Reviews" value={`${dashboard?.numReviews ?? 0}`} bg="#F5F3FF" accent="#7C3AED" />
          <StatCard label="Avg Prep" value={dashboard?.averagePrepMinutes != null ? `${dashboard.averagePrepMinutes}m` : '--'} bg="#ECFDF5" accent="#16A34A" />
        </View>
      </View>

      {/* Top Selling Items */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Top Selling Items</Text>
        {topItems?.length > 0 ? topItems.map((item: any) => (
          <View key={item._id} style={styles.listRow}>
            <View style={styles.listDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.listMain}>{item.name}</Text>
              <Text style={styles.listSub}>Sold: {item.totalSold} · {'\u20B9'}{item.revenue}</Text>
            </View>
          </View>
        )) : <Text style={styles.muted}>No sales data matching filters.</Text>}
      </View>

      <View style={{ height: 20 }} />

      {/* Loading Overlay Modal */}
      <Modal visible={isApplyingFilter} transparent animationType="fade">
        <View style={styles.applyingOverlay}>
          <View style={styles.applyingCard}>
            <ActivityIndicator size="large" color="#F5A623" />
            <Text style={styles.applyingTitle}>Applying Filter</Text>
            <Text style={styles.applyingSub}>Generating charts for {orderHistory.length} orders...</Text>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function StatCard({ label, value, bg, accent }: { label: string; value: string; bg: string; accent: string }) {
  return (
    <View style={[styles.statCard, { backgroundColor: bg }]}>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function OrdersBarChart({ data }: { data: { date: string; accepted: number; rejected: number }[] }) {
  const maxVal = Math.max(1, ...data.flatMap(d => [d.accepted, d.rejected]));
  return (
    <View style={{ height: 160 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: 14, paddingHorizontal: 8, minWidth: '100%' }}>
          {data.map((d, i) => (
            <View key={i} style={{ width: 28, alignItems: 'center', gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
                <View style={{ width: 12, height: Math.max(4, (d.accepted / maxVal) * 100), backgroundColor: '#22C55E', borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />
                <View style={{ width: 12, height: Math.max(4, (d.rejected / maxVal) * 100), backgroundColor: '#EF4444', borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />
              </View>
              <Text style={{ fontSize: 9, color: '#6B7280' }}>{d.date.slice(5)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={{ position: 'absolute', right: 0, top: -20, gap: 4, flexDirection: 'row' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><View style={{ width: 8, height: 8, backgroundColor: '#22C55E', borderRadius: 2 }} /><Text style={{ fontSize: 9, color: '#374151' }}>Accepted</Text></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 8 }}><View style={{ width: 8, height: 8, backgroundColor: '#EF4444', borderRadius: 2 }} /><Text style={{ fontSize: 9, color: '#374151' }}>Rejected</Text></View>
      </View>
    </View>
  );
}

function PieChart({ accepted, rejected }: { accepted: number; rejected: number }) {
  const total = accepted + rejected;
  if (total === 0) return <Text style={{ color: '#6B7280', textAlign: 'center', paddingVertical: 20 }}>No data yet</Text>;
  return (
    <View style={{ alignItems: 'center', paddingVertical: 12 }}>
      <View style={{ position: 'relative', width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 120, height: 120, borderRadius: 60, borderWidth: 18, borderColor: '#EF4444' }} />
        <View style={{ position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 18, borderColor: '#22C55E', borderRightColor: 'transparent', borderBottomColor: accepted >= 50 ? '#22C55E' : 'transparent', transform: [{ rotate: `-90deg` }], opacity: accepted / 100 + 0.2 }} />
        <View style={{ position: 'absolute', alignItems: 'center' }}>
          <Text style={{ fontSize: 24, fontWeight: '900', color: '#F5A623' }}>{accepted}%</Text>
          <Text style={{ fontSize: 10, color: '#6B7280' }}>Accepted</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 20, marginTop: 14 }}>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <View style={{ width: 16, height: 16, backgroundColor: '#22C55E', borderRadius: 8 }} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#15803D' }}>{accepted}%</Text>
          <Text style={{ fontSize: 10, color: '#6B7280' }}>Accepted</Text>
        </View>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <View style={{ width: 16, height: 16, backgroundColor: '#EF4444', borderRadius: 8 }} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#EF4444' }}>{rejected}%</Text>
          <Text style={{ fontSize: 10, color: '#6B7280' }}>Rejected</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 32 },
  greetingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  greetingTitle: { color: '#1C2434', fontSize: 22, fontWeight: '900' },
  greetingSub: { color: '#9CA3AF', fontSize: 13, marginTop: 4 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTitle: { color: '#1C2434', fontSize: 17, fontWeight: '800', marginBottom: 12 },
  dropdownBtn: { backgroundColor: '#F7F8FA', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#F3F4F6' },
  dropdownBtnText: { color: '#6B7280', fontSize: 12, fontWeight: '700' },
  dropdown: { position: 'absolute', top: 36, right: 0, backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 8, zIndex: 99, minWidth: 140 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 14 },
  dropdownItemText: { color: '#374151', fontSize: 13, fontWeight: '600' },
  pctRow: { flexDirection: 'row', gap: 8 },
  pctPill: { flex: 1, borderRadius: 14, padding: 12, alignItems: 'center', gap: 2 },
  pctNum: { fontSize: 22, fontWeight: '900' },
  pctLabel: { color: '#9CA3AF', fontSize: 10, fontWeight: '700' },
  chartBox: { backgroundColor: '#FAFAFA', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#F3F4F6' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: { width: '48%', flexGrow: 1, padding: 14, borderRadius: 14, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 20, fontWeight: '900' },
  statLabel: { color: '#9CA3AF', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginTop: 2 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  listDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F5A623' },
  listMain: { color: '#1C2434', fontSize: 15, fontWeight: '700' },
  listSub: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  muted: { color: '#9CA3AF', fontStyle: 'italic', fontSize: 13 },
  filterLabel: { color: '#1C2434', fontSize: 13, fontWeight: '800', marginTop: 12, marginBottom: 8 },
  filterRow: { flexDirection: 'row' },
  filterChip: { backgroundColor: '#F3F4F6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8 },
  filterChipActive: { backgroundColor: '#EA580C' },
  filterChipText: { color: '#4B5563', fontSize: 12, fontWeight: '700' },
  filterChipTextActive: { color: '#FFF' },

  // Custom Date Picker
  customDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  datePickerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderColor: '#F5A623',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  datePickerIcon: { fontSize: 18 },
  datePickerHint: { color: '#9CA3AF', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  datePickerValue: { color: '#1C2434', fontSize: 13, fontWeight: '800', marginTop: 1 },
  datePickerDash: { color: '#D97706', fontSize: 16, fontWeight: '800' },

  // Calendar Modal
  calOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  calContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
  },
  calHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calTitle: { color: '#1C2434', fontSize: 17, fontWeight: '900' },
  calClose: { color: '#9CA3AF', fontSize: 20, fontWeight: '700', padding: 4 },
  calMonthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  calNavBtn: { padding: 8, borderRadius: 10 },
  calNavText: { color: '#D97706', fontSize: 14, fontWeight: '800' },
  calMonthLabel: { color: '#1C2434', fontSize: 15, fontWeight: '800' },
  calDaysHeader: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  calDayHeaderText: {
    flex: 1,
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  calCellInRange: {
    backgroundColor: 'rgba(245,166,35,0.10)',
  },
  calCellSelected: {
    backgroundColor: '#F5A623',
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#F5A623',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  calCellText: {
    color: '#1C2434',
    fontSize: 14,
    fontWeight: '600',
  },
  calCellTextDisabled: {
    color: '#D1D5DB',
  },
  calCellTextSelected: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  calCellTextToday: {
    color: '#F5A623',
    fontWeight: '900',
  },
  calSummary: {
    marginTop: 14,
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  calSummaryText: {
    color: '#D97706',
    fontSize: 13,
    fontWeight: '800',
  },

  // Loader Overlay
  applyingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyingCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  applyingTitle: {
    marginTop: 16,
    color: '#1C2434',
    fontSize: 16,
    fontWeight: '800',
  },
  applyingSub: {
    marginTop: 4,
    color: '#6B7280',
    fontSize: 13,
  },
});
