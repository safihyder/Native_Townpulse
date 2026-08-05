/**
 * RestaurantInfoModal.tsx — Full-screen modal with two tabs:
 *   • Information — restaurant details, timing, cuisine
 *   • Comment     — star-rating breakdown, user reviews with photos
 *
 * All data is fetched live from the backend.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { appConfig } from '../../config/appConfig';
import { StarIcon, ClockIcon, LocationPinIcon } from '../../components/SvgIcons';

const { width: W } = Dimensions.get('window');

// ── Types ──────────────────────────────────────────────────────────────────────
interface Restaurant {
  _id: string;
  restaurantId: string;
  name: string;
  cuisine: string[];
  description?: string;
  phone?: string;
  email?: string;
  type?: string;
  rating?: number;
  numReviews?: number;
  isOpen?: boolean;
  avgDeliveryTime?: string;
  deliveryFee?: number;
  businessHours?: {
    day: string;
    isOpen: boolean;
    openTime: string;
    closeTime: string;
  }[];
}

interface ReviewData {
  _id: string;
  userId: { _id: string; name?: string; profilePic?: string } | string;
  rating: number;
  comment?: string;
  photos?: string[];
  createdAt: string;
  isVerifiedPurchase?: boolean;
}

interface Props {
  visible: boolean;
  restaurant: Restaurant;
  onClose: () => void;
}

type Tab = 'info' | 'comment';

// ── Star row component ─────────────────────────────────────────────────────────
function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <StarIcon key={i} size={size} color={i <= Math.round(rating) ? '#F5A623' : '#E5E7EB'} />
      ))}
    </View>
  );
}

// ── Rating bar ─────────────────────────────────────────────────────────────────
function RatingBar({ stars, count, total }: { stars: number; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <View style={s.ratingBarRow}>
      <StarRow rating={stars} size={10} />
      <View style={s.ratingBarTrack}>
        <View style={[s.ratingBarFill, { width: `${pct}%` }]} />
      </View>
      <Text style={s.ratingBarCount}>({count})</Text>
    </View>
  );
}

// ── Review card ────────────────────────────────────────────────────────────────
function ReviewCard({ review }: { review: ReviewData }) {
  const user = typeof review.userId === 'object' ? review.userId : null;
  const name = user?.name || 'Anonymous';
  const initials = name.charAt(0).toUpperCase();
  const date = new Date(review.createdAt);
  const dateStr = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;

  return (
    <View style={s.reviewCard}>
      {/* User row */}
      <View style={s.reviewHeader}>
        <View style={s.reviewAvatar}>
          {user?.profilePic ? (
            <Image source={{ uri: user.profilePic }} style={s.reviewAvatarImg} />
          ) : (
            <Text style={s.reviewAvatarText}>{initials}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.reviewName}>{name}</Text>
          <Text style={s.reviewDate}>{dateStr}</Text>
        </View>
        <StarRow rating={review.rating} size={12} />
      </View>

      {/* Comment */}
      {review.comment ? (
        <Text style={s.reviewComment}>{review.comment}</Text>
      ) : null}

      {/* Photos */}
      {review.photos && review.photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.reviewPhotosRow}>
          {review.photos.map((uri, i) => (
            <Image key={i} source={{ uri }} style={s.reviewPhoto} resizeMode="cover" />
          ))}
        </ScrollView>
      )}

      {/* Tags */}
      {review.isVerifiedPurchase && (
        <View style={s.reviewTagsRow}>
          <View style={s.reviewTag}><Text style={s.reviewTagText}>Verified Purchase</Text></View>
        </View>
      )}
    </View>
  );
}

// ── Day label helper ───────────────────────────────────────────────────────────
const DAY_LABELS: Record<string, string> = {
  MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday',
  THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday', SUN: 'Sunday',
};

// ── Main component ─────────────────────────────────────────────────────────────
export default function RestaurantInfoModal({ visible, restaurant, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('info');
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [ratingBreakdown, setRatingBreakdown] = useState<number[]>([0, 0, 0, 0, 0]);
  const [filterType, setFilterType] = useState<string>('all');

  // Fetch reviews when Comment tab is opened
  useEffect(() => {
    if (!visible || tab !== 'comment') return;
    (async () => {
      setLoadingReviews(true);
      try {
        const res = await fetch(`${appConfig.apiBaseUrl}/api/reviews/${restaurant.restaurantId}`);
        const json = await res.json();
        const revs: ReviewData[] = json.reviews ?? json ?? [];
        setReviews(revs);

        // Build breakdown
        const bd = [0, 0, 0, 0, 0];
        for (const r of revs) {
          if (r.rating >= 1 && r.rating <= 5) bd[r.rating - 1]++;
        }
        setRatingBreakdown(bd);
      } catch (e) {
        console.error('[Reviews]', e);
      } finally {
        setLoadingReviews(false);
      }
    })();
  }, [visible, tab, restaurant.restaurantId]);

  const totalReviews = ratingBreakdown.reduce((a, b) => a + b, 0);
  const withPhotos = reviews.filter(r => r.photos && r.photos.length > 0).length;

  const filteredReviews = reviews.filter(r => {
    if (filterType === 'all') return true;
    if (filterType === 'photo') return r.photos && r.photos.length > 0;
    return r.rating === Number(filterType);
  });

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={s.root}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.headerBack} activeOpacity={0.7}>
            <Text style={s.headerBackText}>‹</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Information</Text>
          <View style={{ width: 38 }} />
        </View>

        {/* Tabs */}
        <View style={s.tabRow}>
          <TouchableOpacity
            style={[s.tabBtn, tab === 'info' && s.tabBtnActive]}
            onPress={() => setTab('info')}
            activeOpacity={0.8}
          >
            <Text style={[s.tabText, tab === 'info' && s.tabTextActive]}>Information</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tabBtn, tab === 'comment' && s.tabBtnActive]}
            onPress={() => setTab('comment')}
            activeOpacity={0.8}
          >
            <Text style={[s.tabText, tab === 'comment' && s.tabTextActive]}>Comment</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {tab === 'info' ? (
          <ScrollView style={s.content} showsVerticalScrollIndicator={false}>
            {/* Restaurant Name & Type */}
            <View style={s.infoSection}>
              <Text style={s.infoLabel}>Restaurant Name</Text>
              <Text style={s.infoValue}>{restaurant.name}</Text>
            </View>

            {restaurant.description ? (
              <View style={s.infoSection}>
                <Text style={s.infoLabel}>Description</Text>
                <Text style={s.infoDesc}>{restaurant.description}</Text>
              </View>
            ) : null}

            <View style={s.infoSection}>
              <Text style={s.infoLabel}>Cuisine</Text>
              <View style={s.cuisineRow}>
                {(restaurant.cuisine ?? []).map(c => (
                  <View key={c} style={s.cuisineChip}>
                    <Text style={s.cuisineChipText}>{c}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={s.infoSection}>
              <Text style={s.infoLabel}>Type</Text>
              <Text style={s.infoValue}>{restaurant.type === 'CLOUD_KITCHEN' ? 'Cloud Kitchen' : 'Restaurant'}</Text>
            </View>

            {/* Status */}
            <View style={s.infoSection}>
              <Text style={s.infoLabel}>Status</Text>
              <View style={[s.statusBadge, { backgroundColor: restaurant.isOpen !== false ? '#E8F5E9' : '#FFEBEE' }]}>
                <View style={[s.statusDot, { backgroundColor: restaurant.isOpen !== false ? '#4CAF50' : '#F44336' }]} />
                <Text style={[s.statusText, { color: restaurant.isOpen !== false ? '#2E7D32' : '#C62828' }]}>
                  {restaurant.isOpen !== false ? 'Open now' : 'Closed'}
                </Text>
              </View>
            </View>

            {/* Delivery info */}
            <View style={s.deliveryRow}>
              <View style={s.deliveryChip}>
                <Text style={s.deliveryEmoji}>🛵</Text>
                <View>
                  <Text style={s.deliveryChipLabel}>Delivery Fee</Text>
                  <Text style={s.deliveryChipValue}>₹{restaurant.deliveryFee ?? 30}</Text>
                </View>
              </View>
              <View style={s.deliveryChip}>
                <ClockIcon size={20} color="#F5A623" />
                <View>
                  <Text style={s.deliveryChipLabel}>Delivery Time</Text>
                  <Text style={s.deliveryChipValue}>{restaurant.avgDeliveryTime ?? '25-35 min'}</Text>
                </View>
              </View>
            </View>

            {/* Business Hours */}
            {restaurant.businessHours && restaurant.businessHours.length > 0 && (
              <View style={s.infoSection}>
                <Text style={s.infoLabel}>Business Hours</Text>
                <View style={s.hoursTable}>
                  {restaurant.businessHours.map((bh, i) => (
                    <View key={i} style={s.hoursRow}>
                      <Text style={[s.hoursDay, !bh.isOpen && s.hoursClosed]}>
                        {DAY_LABELS[bh.day] || bh.day}
                      </Text>
                      <Text style={[s.hoursTime, !bh.isOpen && s.hoursClosed]}>
                        {bh.isOpen ? `${bh.openTime} — ${bh.closeTime}` : 'Closed'}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Contact */}
            {(restaurant.phone || restaurant.email) && (
              <View style={s.infoSection}>
                <Text style={s.infoLabel}>Contact</Text>
                {restaurant.phone && <Text style={s.infoValue}>📞 {restaurant.phone}</Text>}
                {restaurant.email && <Text style={s.infoValue}>✉️ {restaurant.email}</Text>}
              </View>
            )}

            <View style={{ height: 30 }} />
          </ScrollView>
        ) : (
          /* ── Comment Tab ──────────────────────────────────────────────────── */
          <ScrollView style={s.content} showsVerticalScrollIndicator={false}>
            {/* Rating summary */}
            <View style={s.ratingSummary}>
              <View style={s.ratingSummaryLeft}>
                <Text style={s.ratingBig}>{Number(restaurant.rating || 0).toFixed(1)}</Text>
                <StarRow rating={restaurant.rating || 0} size={16} />
              </View>

              {/* Filter buttons */}
              <View style={s.ratingFilters}>
                <TouchableOpacity
                  style={[s.ratingFilterBtn, filterType === 'all' && s.ratingFilterActive]}
                  onPress={() => setFilterType('all')}
                  activeOpacity={0.7}
                >
                  <Text style={[s.ratingFilterText, filterType === 'all' && s.ratingFilterTextActive]}>
                    All{'\n'}({totalReviews})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.ratingFilterBtn, filterType === 'photo' && s.ratingFilterActive]}
                  onPress={() => setFilterType('photo')}
                  activeOpacity={0.7}
                >
                  <Text style={[s.ratingFilterText, filterType === 'photo' && s.ratingFilterTextActive]}>
                    With photo{'\n'}({withPhotos})
                  </Text>
                </TouchableOpacity>
                {[5, 4, 3, 2, 1].map(star => (
                  <TouchableOpacity
                    key={star}
                    style={[s.ratingFilterBtn, filterType === String(star) && s.ratingFilterActive]}
                    onPress={() => setFilterType(String(star))}
                    activeOpacity={0.7}
                  >
                    <StarRow rating={star} size={10} />
                    <Text style={[s.ratingFilterText, filterType === String(star) && s.ratingFilterTextActive]}>
                      ({ratingBreakdown[star - 1]})
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Rating breakdown bars */}
            <View style={s.breakdownSection}>
              {[5, 4, 3, 2, 1].map(star => (
                <RatingBar key={star} stars={star} count={ratingBreakdown[star - 1]} total={totalReviews} />
              ))}
            </View>

            {/* Reviews list */}
            {loadingReviews ? (
              <View style={s.loadingWrap}>
                <ActivityIndicator color="#F5A623" size="large" />
              </View>
            ) : filteredReviews.length === 0 ? (
              <View style={s.emptyReviews}>
                <Text style={{ fontSize: 48 }}>📝</Text>
                <Text style={s.emptyTitle}>No reviews found</Text>
                <Text style={s.emptySubtitle}>
                  {reviews.length === 0 ? 'Be the first to review this restaurant!' : 'Try changing your filter.'}
                </Text>
              </View>
            ) : (
              filteredReviews.map(review => (
                <ReviewCard key={review._id} review={review} />
              ))
            )}

            <View style={{ height: 30 }} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F8FA' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 50, paddingBottom: 14, paddingHorizontal: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  headerBack: {
    width: 38, height: 38, borderRadius: 19,
    justifyContent: 'center', alignItems: 'center',
  },
  headerBackText: { fontSize: 28, color: '#1C2434', fontWeight: '500', lineHeight: 30, marginTop: -2 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1C2434' },

  // Tabs
  tabRow: {
    flexDirection: 'row', backgroundColor: '#FFF',
    paddingHorizontal: 16, paddingBottom: 2, gap: 8,
  },
  tabBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 24, alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  tabBtnActive: { backgroundColor: '#1C2434' },
  tabText: { fontSize: 14, fontWeight: '700', color: '#6B7280' },
  tabTextActive: { color: '#FFF' },

  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },

  // ── Info Tab ─────────────────────────────────────────────────────────────────
  infoSection: {
    marginBottom: 20,
  },
  infoLabel: {
    fontSize: 12, fontWeight: '700', color: '#9CA3AF',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
  },
  infoValue: { fontSize: 15, fontWeight: '600', color: '#1C2434', lineHeight: 22 },
  infoDesc: { fontSize: 14, color: '#6B7280', lineHeight: 21 },

  cuisineRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cuisineChip: {
    backgroundColor: '#FFF3E0', borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  cuisineChipText: { fontSize: 13, fontWeight: '600', color: '#F5A623' },

  statusBadge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '700' },

  deliveryRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  deliveryChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFF', borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
    shadowOffset: { width: 0, height: 2 },
  },
  deliveryEmoji: { fontSize: 20 },
  deliveryChipLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  deliveryChipValue: { fontSize: 15, fontWeight: '800', color: '#1C2434' },

  hoursTable: {
    backgroundColor: '#FFF', borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
    shadowOffset: { width: 0, height: 2 },
  },
  hoursRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  hoursDay: { fontSize: 14, fontWeight: '600', color: '#1C2434' },
  hoursTime: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  hoursClosed: { color: '#E53935' },

  // ── Comment Tab ──────────────────────────────────────────────────────────────
  ratingSummary: {
    backgroundColor: '#FFF', borderRadius: 18, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    marginBottom: 16,
  },
  ratingSummaryLeft: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14,
  },
  ratingBig: { fontSize: 38, fontWeight: '900', color: '#1C2434' },

  ratingFilters: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  ratingFilterBtn: {
    backgroundColor: '#F3F4F6', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 6,
    alignItems: 'center', minWidth: 50,
  },
  ratingFilterActive: { backgroundColor: '#E3F2FD', borderWidth: 1, borderColor: '#2196F3' },
  ratingFilterText: { fontSize: 11, color: '#6B7280', fontWeight: '600', textAlign: 'center' },
  ratingFilterTextActive: { color: '#2196F3' },

  breakdownSection: {
    backgroundColor: '#FFF', borderRadius: 18, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    marginBottom: 16,
  },
  ratingBarRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6,
  },
  ratingBarTrack: {
    flex: 1, height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden',
  },
  ratingBarFill: {
    height: 6, backgroundColor: '#F5A623', borderRadius: 3,
  },
  ratingBarCount: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', minWidth: 30 },

  // Review card
  reviewCard: {
    backgroundColor: '#FFF', borderRadius: 18, padding: 16,
    marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
    shadowOffset: { width: 0, height: 2 },
  },
  reviewHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10,
  },
  reviewAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F5A623', justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  reviewAvatarImg: { width: 40, height: 40, borderRadius: 20 },
  reviewAvatarText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  reviewName: { fontSize: 14, fontWeight: '700', color: '#1C2434' },
  reviewDate: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  reviewComment: { fontSize: 13, color: '#4B5563', lineHeight: 20, marginBottom: 10 },

  reviewPhotosRow: { marginBottom: 10 },
  reviewPhoto: {
    width: 64, height: 64, borderRadius: 10, marginRight: 8,
    backgroundColor: '#FFF3E0',
  },

  reviewTagsRow: { flexDirection: 'row', gap: 8 },
  reviewTag: {
    backgroundColor: '#E8F5E9', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  reviewTagText: { fontSize: 11, fontWeight: '600', color: '#2E7D32' },

  loadingWrap: { paddingVertical: 60, alignItems: 'center' },
  emptyReviews: { paddingVertical: 60, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#1C2434' },
  emptySubtitle: { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },
});
