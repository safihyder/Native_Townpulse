import { appConfig } from '../config/appConfig';

const BASE = appConfig.apiBaseUrl;

async function authFetch(
  path: string,
  idToken: string,
  options: RequestInit = {},
): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(json?.error || `Request failed: ${res.status}`);
  return json;
}

// ─── Presence ────────────────────────────────────────────────────────────────

export async function setDeliveryMode(
  idToken: string,
  mode: 'OFFLINE' | 'ONLINE_AVAILABLE' | 'ONLINE_BUSY' | 'PAUSED',
) {
  return authFetch('/api/delivery-partner/mode', idToken, {
    method: 'PATCH',
    body: JSON.stringify({ mode }),
  });
}

export async function updateLiveLocation(
  idToken: string,
  lat: number,
  lng: number,
  heading?: number,
) {
  return authFetch('/api/delivery-partner/location', idToken, {
    method: 'PATCH',
    body: JSON.stringify({ lat, lng, heading, clientTimestamp: new Date().toISOString() }),
  });
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

export async function getDispatchFeed(idToken: string) {
  return authFetch('/api/delivery-partner/dispatch-feed', idToken);
}

export async function getNearbyOrders(idToken: string) {
  return authFetch('/api/delivery-partner/nearby-orders', idToken);
}

export async function acceptDispatch(idToken: string, orderId: string) {
  return authFetch(`/api/orders/${orderId}/accept-dispatch`, idToken, {
    method: 'POST',
  });
}

export async function rejectDispatch(idToken: string, orderId: string) {
  return authFetch(`/api/orders/${orderId}/reject-dispatch`, idToken, {
    method: 'POST',
  });
}

// ─── Order Flow ───────────────────────────────────────────────────────────────

export async function markArrivedAtPickup(idToken: string, orderId: string) {
  return authFetch(`/api/orders/${orderId}/arrived-pickup`, idToken, {
    method: 'POST',
  });
}

export async function markPickedUp(idToken: string, orderId: string) {
  return authFetch(`/api/orders/${orderId}/picked-up`, idToken, {
    method: 'POST',
  });
}

export async function markArrivedAtCustomer(idToken: string, orderId: string) {
  return authFetch(`/api/orders/${orderId}/arrived-customer`, idToken, {
    method: 'POST',
  });
}

export async function completeDelivery(idToken: string, orderId: string, otp: string) {
  return authFetch(`/api/orders/${orderId}/complete-delivery`, idToken, {
    method: 'PATCH',
    body: JSON.stringify({ otp }),
  });
}

export async function getOrderTracking(idToken: string, orderId: string) {
  return authFetch(`/api/orders/${orderId}/tracking`, idToken);
}

// ─── Wallet ───────────────────────────────────────────────────────────────────

export async function getMyWallet(idToken: string) {
  return authFetch('/api/delivery-partner/wallet', idToken);
}

export async function getWalletTransactions(idToken: string, page = 1) {
  return authFetch(`/api/delivery-partner/wallet/transactions?page=${page}`, idToken);
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function getMyAnalytics(idToken: string) {
  return authFetch('/api/delivery-partner/analytics', idToken);
}
