import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
  order: any;
  onClose: () => void;
};

export default function OrderReviewScreen({ idToken, order, onClose }: Props) {
  const [restaurantRating, setRestaurantRating] = useState(0);
  const [restaurantComment, setRestaurantComment] = useState('');
  
  const [deliveryRating, setDeliveryRating] = useState(0);
  const [deliveryComment, setDeliveryComment] = useState('');
  
  const [submitting, setSubmitting] = useState(false);

  const hasDelivery = order.fulfillment?.type === 'DELIVERY' && order.delivery?.partnerId;

  const handleSubmit = async () => {
    if (restaurantRating === 0 && (!hasDelivery || deliveryRating === 0)) {
      Alert.alert('Please select a rating before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const promises = [];

      // Restaurant Review
      if (restaurantRating > 0) {
        promises.push(
          fetch(`${appConfig.apiBaseUrl}/api/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({
              reviewType: 'RESTAURANT',
              restaurantId: order.restaurantId,
              orderId: order.orderId,
              rating: restaurantRating,
              comment: restaurantComment,
              isVerifiedPurchase: true,
            })
          })
        );
      }

      // Delivery Review
      if (hasDelivery && deliveryRating > 0) {
        promises.push(
          fetch(`${appConfig.apiBaseUrl}/api/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({
              reviewType: 'DELIVERY',
              deliveryPartnerId: order.delivery.partnerId,
              orderId: order.orderId,
              rating: deliveryRating,
              comment: deliveryComment,
              isVerifiedPurchase: true,
            })
          })
        );
      }

      const results = await Promise.all(promises);
      const allOk = results.every(res => res.ok);

      if (!allOk) {
        throw new Error('Some reviews failed to submit.');
      }

      Alert.alert('Thank You!', 'Your feedback helps us improve.', [{ text: 'OK', onPress: onClose }]);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const StarRating = ({ rating, onChange }: { rating: number, onChange: (r: number) => void }) => {
    return (
      <View style={st.starRow}>
        {[1, 2, 3, 4, 5].map(star => (
          <TouchableOpacity key={star} onPress={() => onChange(star)}>
            <Text style={[st.star, star <= rating && st.starActive]}>
              {star <= rating ? '★' : '☆'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <View style={st.root}>
      <View style={st.header}>
        <TouchableOpacity onPress={onClose} style={st.closeBtn}>
          <Text style={st.closeIcon}>✕</Text>
        </TouchableOpacity>
        <Text style={st.headerTitle}>Rate Your Order</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={st.content}>
        
        {/* RESTAURANT REVIEW */}
        <View style={st.sectionCard}>
          <Text style={st.sectionTitle}>🍽️ How was the food?</Text>
          <Text style={st.sectionSub}>from {order.items?.[0]?.name && 'the restaurant'}</Text>
          <StarRating rating={restaurantRating} onChange={setRestaurantRating} />
          {restaurantRating > 0 && (
            <TextInput
              style={st.input}
              placeholder="What did you like or dislike? (Optional)"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              value={restaurantComment}
              onChangeText={setRestaurantComment}
            />
          )}
        </View>

        {/* DELIVERY REVIEW */}
        {hasDelivery && (
          <View style={st.sectionCard}>
            <Text style={st.sectionTitle}>🛵 How was the delivery?</Text>
            <Text style={st.sectionSub}>by your delivery partner</Text>
            <StarRating rating={deliveryRating} onChange={setDeliveryRating} />
            {deliveryRating > 0 && (
              <TextInput
                style={st.input}
                placeholder="Any feedback for the delivery partner? (Optional)"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                value={deliveryComment}
                onChangeText={setDeliveryComment}
              />
            )}
          </View>
        )}

      </ScrollView>

      <View style={st.footer}>
        <TouchableOpacity style={st.submitBtn} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={st.submitBtnText}>Submit Feedback</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FAE08B', paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  closeBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  closeIcon: { fontSize: 24, color: '#374151', fontWeight: 'bold' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  content: { padding: 20, gap: 20 },
  sectionCard: {
    backgroundColor: '#FAE08B', borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
    alignItems: 'center',
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 4 },
  sectionSub: { fontSize: 13, color: '#6B7280', marginBottom: 20 },
  starRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  star: { fontSize: 40, color: '#E5E7EB' },
  starActive: { color: '#F59E0B' },
  input: {
    width: '100%', backgroundColor: '#F3F4F6', borderRadius: 12, padding: 16,
    fontSize: 15, color: '#111827', textAlignVertical: 'top', minHeight: 100,
  },
  footer: { padding: 20, backgroundColor: '#FAE08B', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  submitBtn: {
    backgroundColor: '#F5C116', paddingVertical: 16, borderRadius: 12, alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});


