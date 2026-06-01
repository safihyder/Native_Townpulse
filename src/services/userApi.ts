import { appConfig } from '../config/appConfig';

const BASE = appConfig.apiBaseUrl;

async function get(path: string, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { headers });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || json.error || 'Request failed');
  return json;
}

async function post(path: string, body: object, token: string) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || json.error || 'Request failed');
  return json;
}

/** GET /api/settings/banners — Admin-controlled home banners */
export const getHomeBanners = () => get('/api/settings/banners');

/** GET /api/restaurants — All active restaurants (with optional cuisine filter) */
export const getRestaurants = (params?: { search?: string; cuisine?: string; page?: number; limit?: number }) => {
  const q = new URLSearchParams();
  if (params?.search) q.set('search', params.search);
  if (params?.cuisine) q.set('cuisine', params.cuisine);
  if (params?.page) q.set('page', String(params.page));
  q.set('limit', String(params?.limit ?? 20));
  return get(`/api/restaurants?${q.toString()}`);
};

/** GET /api/restaurants/:id — Single restaurant detail */
export const getRestaurantById = (id: string) => get(`/api/restaurants/${id}`);

/** GET /api/items/restaurant/:restaurantId — Menu items for a restaurant */
export const getMenuItems = (restaurantId: string) =>
  get(`/api/items/restaurant/${restaurantId}`);

/** GET /api/orders/my-orders — Logged-in user's order history */
export const getMyOrders = (token: string) => get('/api/orders/my-orders', token);

/** GET /api/orders/:id — Single order detail */
export const getOrderById = (id: string, token: string) => get(`/api/orders/${id}`, token);

/** GET /api/orders/:id/tracking — Delivery tracking snapshot */
export const getOrderTracking = (id: string, token: string) =>
  get(`/api/orders/${id}/tracking`, token);

/** POST /api/orders — Place a new order */
export const placeOrder = (token: string, body: object) => post('/api/orders', body, token);
