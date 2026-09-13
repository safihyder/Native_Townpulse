/**
 * Missing API Warning Utility
 *
 * Shows an Alert dialogue when a frontend feature tries to call an API
 * endpoint that does not exist in the pushed backend (_townpulse_push).
 * This ensures the user is aware of the limitation instead of silently failing.
 */
import { Alert } from 'react-native';

interface MissingApiInfo {
  /** HTTP method + path, e.g. "GET /api/orders/restaurant/history" */
  endpoint: string;
  /** Human-readable description of what this API does */
  description: string;
  /** Which screen/feature uses this API */
  usedBy: string;
}

/**
 * Displays an Alert dialogue warning that a particular API endpoint
 * is not available in the pushed backend.
 *
 * @returns A rejected promise so callers can catch and handle gracefully.
 */
export function showMissingApiWarning(info: MissingApiInfo): Promise<never> {
  return new Promise((_resolve, reject) => {
    Alert.alert(
      '⚠️ API Not Available',
      `This feature requires an API that is not present in the pushed backend.\n\n` +
        `Endpoint: ${info.endpoint}\n\n` +
        `Purpose: ${info.description}\n\n` +
        `Used by: ${info.usedBy}`,
      [{ text: 'OK', onPress: () => reject(new Error(`Missing API: ${info.endpoint}`)) }],
      { cancelable: true },
    );
  });
}

/**
 * Registry of all missing API endpoints.
 * Each entry documents the endpoint, its purpose, and which screen uses it.
 */
export const MISSING_APIS = {
  RESTAURANT_ORDER_HISTORY: {
    endpoint: 'GET /api/orders/restaurant/history',
    description:
      'Fetches paginated order history for a restaurant. Used for analytics charts and past order review.',
    usedBy: 'RestaurantAnalyticsTab, RestaurantHistoryReviewsModal',
  },
  CANCEL_PAYMENT: {
    endpoint: 'POST /api/orders/:id/cancel-payment',
    description:
      'Cancels/voids an unpaid order when the user dismisses or fails Razorpay checkout.',
    usedBy: 'CartScreen (Razorpay error/cancel handler)',
  },
  VERIFY_PAYMENT: {
    endpoint: 'POST /api/payments/verify-payment/:orderId',
    description:
      'Verifies the Razorpay payment signature after successful checkout. Without this, online payment confirmation will fail.',
    usedBy: 'CartScreen (Razorpay success handler)',
  },
  GET_ADDRESSES: {
    endpoint: 'GET /api/auth/addresses',
    description: 'Retrieves the user\'s saved delivery addresses list.',
    usedBy: 'LocationSelectorModal',
  },
  ADD_ADDRESS: {
    endpoint: 'POST /api/auth/addresses',
    description: 'Saves a new delivery address to the user\'s address book.',
    usedBy: 'LocationSelectorModal',
  },
  DELETE_ADDRESS: {
    endpoint: 'DELETE /api/auth/addresses/:id',
    description: 'Removes a saved delivery address from the user\'s address book.',
    usedBy: 'LocationSelectorModal',
  },
  ALL_PUBLIC_ITEMS: {
    endpoint: 'GET /api/items/all-public',
    description:
      'Returns a slim list of all public menu items for client-side search indexing. Without this, the fuzzy search cache cannot be populated.',
    usedBy: 'searchCache (warmCache), SearchScreen',
  },
  REMOVE_BANNER: {
    endpoint: 'PATCH /api/restaurants/:id/banner/remove',
    description: 'Removes a specific banner image from a restaurant\'s gallery.',
    usedBy: 'RestaurantSettingsTab',
  },
  DELIVERY_ANALYTICS: {
    endpoint: 'GET /api/delivery-partner/analytics',
    description:
      'Returns delivery partner performance analytics: total deliveries, distance, earnings, avg delivery time, and trip history.',
    usedBy: 'DeliveryAnalyticsTab',
  },
} as const;

