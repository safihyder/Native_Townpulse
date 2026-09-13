# Missing Backend APIs Documentation

> **Generated:** 2026-09-13
> **Context:** The frontend (`app/tpapp`) was built against a local backend with additional endpoints that are **not present** in the pushed backend (`_townpulse_push`).
> This document lists every missing API endpoint, what it does, which frontend screens depend on it, and the current fallback behavior.

---

## Summary

| # | Endpoint | Method | Used By | Frontend Fallback |
|---|---|---|---|---|
| 1 | `/api/orders/restaurant/history` | `GET` | RestaurantAnalyticsTab, RestaurantHistoryReviewsModal | Alert dialogue + early return |
| 2 | `/api/payments/verify-payment/:orderId` | `POST` | CartScreen (Razorpay) | Alert dialogue warning |
| 3 | `/api/orders/:id/cancel-payment` | `POST` | CartScreen | Console warning |
| 4 | `/api/auth/addresses` | `GET` | LocationSelectorModal | Alert dialogue + empty array |
| 5 | `/api/auth/addresses` | `POST` | LocationSelectorModal | Alert dialogue + empty array |
| 6 | `/api/auth/addresses/:id` | `DELETE` | LocationSelectorModal | Alert dialogue + empty array |
| 7 | `/api/items/all-public` | `GET` | searchCache, SearchScreen | Graceful catch + empty items |
| 8 | `/api/restaurants/:id/banner/remove` | `PATCH` | RestaurantSettingsTab | Alert dialogue + early return |
| 9 | `/api/delivery-partner/analytics` | `GET` | DeliveryAnalyticsTab | Wallet endpoint fallback |
| 10 | `/api/coupons` (public listing) | `GET` | UserHomeTab, CartScreen | Returns empty array |

---

## Detailed Endpoint Documentation

### 1. `GET /api/orders/restaurant/history`

**Purpose:** Returns paginated order history for a restaurant owner. Used to power the analytics dashboard with revenue charts, order breakdowns, and historical order browsing.

**Query Parameters:**
- `page` (integer, default: 1)
- `limit` (integer, default: 50, max: 500)

**Expected Response:**
```json
{
  "orders": [
    {
      "createdAt": "2026-09-13T10:00:00.000Z",
      "status": "DELIVERED",
      "fulfillment": { "type": "DELIVERY" },
      "payment": { "mode": "ONLINE", "status": "PAID" },
      "pricing": { "grandTotal": 450 },
      "items": [{ "name": "Paneer Butter Masala", "quantity": 2, "itemTotal": 360 }]
    }
  ],
  "totalPages": 5
}
```

**Auth:** `Authorization: Bearer <token>` — Role: `restaurant_owner`

**Frontend Usage:**
- `RestaurantAnalyticsTab.tsx` — Fetches all pages sequentially (500/page) to build revenue charts, order type breakdowns, and date-filtered analytics.
- `RestaurantHistoryReviewsModal.tsx` — Fetches paginated past orders (50/page) for the history tab with "Show More" infinite scroll.

**Current Fallback:** Alert dialogue is shown warning the user. Analytics tab returns immediately without data.

**Implementation Notes:** Needs to query `Order` collection where `restaurantId` matches the authenticated user's managed restaurant, with `status` in terminal states (`DELIVERED`, `CANCELLED`), sorted by `createdAt` descending.

---

### 2. `POST /api/payments/verify-payment/:orderId`

**Purpose:** Verifies the Razorpay payment signature after the customer completes online payment checkout. This is the critical handshake that confirms payment was not tampered with.

**URL Parameters:**
- `orderId` (string) — The order's orderId (e.g., `ORD-172500001`)

**Request Body:**
```json
{
  "razorpay_payment_id": "pay_29QQoUBi66xm2f",
  "razorpay_order_id": "order_EKfwwad3Hw2jK",
  "razorpay_signature": "9ef4dffbfd84f1318f6739a3ce010d3b18b75e02320d25c5c0defb7faa67bb2e"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Payment verified successfully",
  "order": { "orderId": "ORD-172500001", "payment": { "status": "PAID" } }
}
```

**Auth:** `Authorization: Bearer <token>` — Role: any authenticated user (order owner)

**Frontend Usage:**
- `CartScreen.tsx` — Called immediately after Razorpay SDK's `onSuccess` callback. Without this, online payments are accepted by Razorpay but the backend never confirms them, leaving orders stuck in `AWAITING_PAYMENT`.

**Current Fallback:** Alert dialogue warns the user that payment verification is unavailable.

**Implementation Notes:**
1. Accepts `{ razorpay_payment_id, razorpay_order_id, razorpay_signature }`
2. Computes `HMAC SHA256(razorpay_order_id + "|" + razorpay_payment_id, RAZORPAY_KEY_SECRET)`
3. Compares computed hash with `razorpay_signature`
4. If valid: updates `order.payment.status = 'PAID'`, `order.status = 'PLACED'`, `order.razorpay.paymentId`, `order.razorpay.signature`
5. Triggers customer + restaurant notifications

---

### 3. `POST /api/orders/:id/cancel-payment`

**Purpose:** Cancels/voids an unpaid order when the customer dismisses Razorpay checkout or payment fails.

**URL Parameters:**
- `id` (string) — orderId or MongoDB ObjectId

**Request Body:** None

**Expected Response:**
```json
{
  "success": true,
  "message": "Unpaid order cancelled"
}
```

**Auth:** `Authorization: Bearer <token>` — Role: order owner

**Frontend Usage:**
- `CartScreen.tsx` — Called in the Razorpay `onError`/`onDismiss` handler. Without it, failed/cancelled payment orders remain in `AWAITING_PAYMENT` indefinitely.

**Current Fallback:** Console warning logged. Order remains in AWAITING_PAYMENT status.

**Implementation Notes:** Should only cancel orders where `payment.status === 'PENDING'` and `status === 'AWAITING_PAYMENT'`.

---

### 4-6. Address Management (`/api/auth/addresses`)

**Purpose:** CRUD operations for the user's saved delivery addresses.

#### `GET /api/auth/addresses`
Returns the user's `addresses` array from the User document.

**Expected Response:**
```json
{
  "addresses": [
    {
      "_id": "64abc123...",
      "name": "Home",
      "fullAddress": "123 Main St, Bangalore",
      "coordinates": { "lat": 12.9716, "lng": 77.5946 },
      "isDefault": true
    }
  ]
}
```

#### `POST /api/auth/addresses`
Pushes a new address subdocument into the user's `addresses` array.

**Request Body:**
```json
{
  "name": "Office",
  "fullAddress": "456 Tech Park, HSR Layout",
  "coordinates": { "lat": 12.9141, "lng": 77.6368 }
}
```

#### `DELETE /api/auth/addresses/:id`
Removes the address subdocument with matching `_id` from the user's `addresses` array.

**Auth:** `Authorization: Bearer <token>` — Role: any authenticated user

**Frontend Usage:**
- `LocationSelectorModal.tsx` — Manages the saved addresses list (load, add, delete) used during order placement to select delivery location.

**Current Fallback:** Alert dialogue shown. Returns empty `{ addresses: [] }`. Users can still use live GPS location or map picker.

**Implementation Notes:** These operate on the `addresses` subdocument array in the `User` model. The User schema already has the `addresses` field defined.

---

### 7. `GET /api/items/all-public`

**Purpose:** Returns a slim/projected list of all available menu items across all restaurants for client-side search indexing.

**Expected Response:**
```json
{
  "items": [
    {
      "_id": "64item...",
      "name": "Paneer Butter Masala",
      "restaurantId": "64rest...",
      "category": "Main Course",
      "price": 250,
      "isVeg": true,
      "images": ["https://..."]
    }
  ]
}
```

**Auth:** None (Public)

**Frontend Usage:**
- `searchCache.ts` — Called during `warmCache()` on app launch and after WebSocket `restaurant_updated` events. The items are used for the trigram fuzzy search in `SearchScreen.tsx`, enabling customers to search by dish name across all restaurants.

**Current Fallback:** Graceful catch with console warning. Dish-level search is disabled; only restaurant-level search works.

**Implementation Notes:** Should project only essential fields (`_id`, `name`, `restaurantId`, `category`, `price`, `isVeg`, `images`) and filter by `isAvailable: true`. Consider `select()` projection for minimal payload.

---

### 8. `PATCH /api/restaurants/:id/banner/remove`

**Purpose:** Removes a specific banner image URL from a restaurant's `banner` array.

**URL Parameters:**
- `id` (string) — restaurantId

**Request Body:**
```json
{
  "imageUrl": "https://res.cloudinary.com/.../banner_2.jpg"
}
```

**Expected Response:**
```json
{
  "restaurant": { "banner": ["remaining_url_1.jpg"] }
}
```

**Auth:** `Authorization: Bearer <token>` — Role: `restaurant_owner`, `admin`

**Frontend Usage:**
- `RestaurantSettingsTab.tsx` — Restaurant owners can remove individual banner images from their gallery.

**Current Fallback:** Alert dialogue shown. Image removal blocked.

**Implementation Notes:** Uses `$pull` on the `banner` array. Optionally deletes the image from Cloudinary using the public ID extracted from the URL.

---

### 9. `GET /api/delivery-partner/analytics`

**Purpose:** Returns comprehensive delivery partner performance analytics including trip history.

**Expected Response:**
```json
{
  "analytics": {
    "totalDeliveries": 84,
    "totalDistanceKm": 392.4,
    "perKmRate": 10,
    "totalEarnings": 3924,
    "totalOnlineOrders": 52,
    "totalCODOrders": 32,
    "totalCashCollected": 15600,
    "currentCashInHand": 1200,
    "currentEarningsBalance": 1840.50,
    "avgDeliveryFormatted": "28 min"
  },
  "recentTrips": [
    {
      "orderId": "ORD-172500001",
      "orderCode": "TP-001",
      "pickup": { "label": "Pizza Roma" },
      "status": "DELIVERED",
      "metrics": { "distanceMeters": 5200, "durationSeconds": 1680 },
      "timeline": { "assignedAt": "...", "deliveredAt": "..." }
    }
  ]
}
```

**Auth:** `Authorization: Bearer <token>` — Role: `delivery`

**Frontend Usage:**
- `DeliveryAnalyticsTab.tsx` — Powers the delivery partner stats dashboard showing total earnings, distance, delivery counts, and trip history.

**Current Fallback:** Automatic fallback to `GET /api/delivery-partner/wallet` endpoint. Analytics are derived from wallet balance, running stats, and transaction summary. Trip history is unavailable.

**Implementation Notes:** Aggregates data from `DeliveryTrip` collection (trip metrics, timelines) and `User.deliveryProfile.runningStats` (cumulative stats). The wallet fallback already provides reasonable approximations.

---

### 10. `GET /api/coupons` (Public Customer Listing)

**Purpose:** Lists active, valid coupons/vouchers available to customers. The pushed backend replaced this with the admin-only `GET /api/promocodes`.

**Frontend Usage:**
- `UserHomeTab.tsx` — Shows promotional voucher cards on the home screen.
- `CartScreen.tsx` — Lists available coupons at checkout for the customer to apply.

**Current Fallback:** Returns empty arrays. Coupon cards section shows nothing. Customers can still manually enter promo codes via `POST /api/promocodes/validate`.

**Notes:** The pushed backend's promo system (`/api/promocodes`) has `GET` listing as admin-only. To restore customer-facing coupon visibility, a public endpoint like `GET /api/promocodes/available` would need to be added, filtered by `isActive: true` and within `validFrom`/`validUntil` date range.

---

## API Changes Made (Switched to Pushed Backend)

These aren't missing — they were **changed** to use the pushed backend's new endpoints:

| Old Frontend Endpoint | New Pushed Backend Endpoint | Change Reason |
|---|---|---|
| `GET /api/settings/banners` | `GET /api/banners?activeOnly=true` | Pushed backend has dedicated Banner system |
| `GET /api/coupons` | Returns `[]` (no public listing) | Admin-only in pushed backend |
| `POST /api/coupons/validate` | `POST /api/promocodes/validate` | Switched to PromoCode system |
| `GET /api/settings/FINANCE` | `POST /api/orders/checkout-preview` | Dynamic tax engine replaces static settings |
| Role: `manager` | Role: `restaurant_owner` | Pushed backend standardized role name |
