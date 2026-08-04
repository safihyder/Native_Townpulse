import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { appConfig } from '../../config/appConfig';
import { useToast } from '../../context/ToastContext';
import { PressableScale } from '../../components/PressableScale';

type Props = {
  idToken: string;
  order: any;
  onClose: () => void;
};

export default function OrderReviewScreen({ idToken, order, onClose }: Props) {
  const { showToast } = useToast();
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const hasDelivery = order.fulfillment?.type === 'DELIVERY' && order.delivery?.partnerId;

  const handleSubmit = async () => {
    if (rating === 0) {
      showToast({ type: 'warning', title: 'Rating Required', body: 'Please select a rating before submitting.' });
      return;
    }

    setSubmitting(true);
    try {
      const promises = [];

      // Restaurant Review
      promises.push(
        fetch(`${appConfig.apiBaseUrl}/api/reviews`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({
            reviewType: 'RESTAURANT',
            restaurantId: order.restaurantId,
            orderId: order.orderId,
            rating: rating,
            comment: '',
            isVerifiedPurchase: true,
          })
        })
      );

      // Delivery Review
      if (hasDelivery) {
        promises.push(
          fetch(`${appConfig.apiBaseUrl}/api/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({
              reviewType: 'DELIVERY',
              deliveryPartnerId: order.delivery.partnerId,
              orderId: order.orderId,
              rating: rating,
              comment: '',
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

      showToast({ type: 'success', title: 'Thank You!', body: 'Your feedback helps us improve.' });
      onClose();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Error', body: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const StarRating = ({ value, onChange }: { value: number, onChange: (r: number) => void }) => {
    return (
      <View style={st.starRow}>
        {[1, 2, 3, 4, 5].map(star => (
          <TouchableOpacity key={star} onPress={() => onChange(star)} activeOpacity={0.8}>
            <Text style={[st.star, star <= value && st.starActive]}>
              ★
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <View style={st.root}>
      <ScrollView contentContainerStyle={st.content} showsVerticalScrollIndicator={false}>
        
        <Text style={st.successTitle}>Success</Text>

        <Image 
          source={require('../../../assets/images/delivery_scooter.png')} 
          style={st.illustration}
          resizeMode="contain"
        />

        <Text style={st.feedbackTitle}>Feedback</Text>
        <Text style={st.feedbackSub}>
          Thank you for using our service. You can take a few seconds to rate the service quality.
        </Text>

        <StarRating value={rating} onChange={setRating} />

      </ScrollView>

      <View style={st.footer}>
        <PressableScale onPress={handleSubmit} disabled={submitting} style={st.submitBtn}>
          {submitting ? <ActivityIndicator color="#111" /> : <Text style={st.submitBtnText}>Submit</Text>}
        </PressableScale>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { 
    padding: 32, 
    alignItems: 'center',
    paddingTop: 80,
  },
  successTitle: { 
    fontSize: 22, 
    fontWeight: '800', 
    color: '#111827', 
    marginBottom: 40 
  },
  illustration: {
    width: 300,
    height: 300,
    marginBottom: 40,
  },
  feedbackTitle: { 
    fontSize: 20, 
    fontWeight: '800', 
    color: '#111827', 
    marginBottom: 12 
  },
  feedbackSub: { 
    fontSize: 14, 
    color: '#6B7280', 
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  starRow: { 
    flexDirection: 'row', 
    gap: 16, 
    marginBottom: 20 
  },
  star: { 
    fontSize: 48, 
    color: '#E5E7EB' 
  },
  starActive: { 
    color: '#FBC02D' 
  },
  footer: { 
    padding: 24, 
    backgroundColor: '#FFFFFF',
    paddingBottom: 40,
  },
  submitBtn: {
    backgroundColor: '#FBC02D', 
    paddingVertical: 18, 
    borderRadius: 16, 
    alignItems: 'center',
    shadowColor: '#FBC02D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  submitBtnText: { 
    color: '#111', 
    fontSize: 16, 
    fontWeight: '800' 
  },
});
