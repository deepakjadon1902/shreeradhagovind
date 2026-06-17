## Goal
Wire backend ↔ frontend tightly, add SEO basics, and ship a real order-tracking + payment-verification flow with email invoices.

## 1. Backend ↔ Frontend wiring audit
- Verify `src/lib/store.tsx` calls every API: auth, products, categories, orders, admin, payments, uploads, settings.
- Add missing client helpers in `src/lib/api.ts` for: `getOrderByTrackingId`, `adminUpdateOrder` (tracking id, courier, status), `adminVerifyPayment`, `adminCancelOrder`.
- Confirm `VITE_API_URL` fallback still works (demo localStorage mode), but real mode goes through backend.
- Fix any response-shape mismatches (`_id` vs `id`, `mrp` vs `price`) in mappers.

## 2. SEO
- `public/robots.txt` — allow all, point to sitemap.
- `src/routes/sitemap[.]xml.ts` server route listing: `/`, `/shop`, `/cart`, `/wishlist`, `/checkout`, `/orders`, `/track`, `/login`, `/signup`, `/profile`.
- `head()` per route: unique title + description + og:title/description/url + canonical for index, shop, product, cart, wishlist, checkout, orders, profile, track, login, signup, admin (noindex).
- Root `__root.tsx` keeps sitewide defaults + Organization JSON-LD.

## 3. Order tracking system

### Backend
- Extend `models/Order.ts`:
  - `trackingId: string` (unique, indexed, generated on order create — e.g. `SRG-XXXXXXXX`)
  - `courier: enum ['Ekart','DTDC','Shree Murti','India Post','Delhivery'] | null`
  - `courierTrackingUrl?: string`
  - keep existing `status` enum
- Auto-generate `trackingId` in `order.routes.ts` on POST.
- New `admin.routes.ts` endpoint: `PATCH /admin/orders/:id` → `{ status?, courier?, trackingId? (override), courierTrackingUrl? }`. Emits status-update email.
- New public endpoint: `GET /orders/track/:trackingId` → returns sanitized order (no PII beyond city/state, items, status, courier, timeline).

### Frontend
- New route `src/routes/track.tsx` — input box for tracking id → calls `/orders/track/:id` → renders timeline (Placed → Packed → Shipped → Out for delivery → Delivered) + courier name + courier tracking URL link.
- Header: add "Track Order" link.
- Admin Orders tab: edit modal with `Tracking ID` (auto-filled, editable), `Courier` (dropdown), `Courier tracking URL`, `Status` (dropdown). Save → PATCH.
- Existing `/orders/$id` page also shows tracking id + courier.

## 4. Payment verification + emails

### Backend
- On order POST when `method=razorpay`: require `razorpayOrderId/paymentId/signature`; verify signature server-side (already in `payment.routes.ts` — reuse helper). If verify fails → don't create order, return 400. If success → create order with `payment.status='paid'`, send `orderConfirmed` email with HTML invoice (items table, totals, tracking id, courier="To be assigned", address). Auto-cancel + email is for the failure path: if frontend reports `payment_failed`, call `POST /orders/payment-failed` with `{ razorpayOrderId, reason }` → log + email user.
- Admin manual verification endpoint: `PATCH /admin/orders/:id/payment` → `{ status: 'paid'|'failed'|'refunded' }`. If set to `failed` → auto-set order `status='Cancelled'` and email user. If set to `paid` → email confirmation + invoice.
- Templates added to `utils/email.ts`:
  - `orderConfirmed(name, order)` — full HTML invoice with line items, totals, tracking id, courier, shipping address.
  - `paymentFailed(name, orderRef, amount, reason)` — apology + retry CTA.
  - `orderCancelled(name, orderRef, reason)`
  - `statusUpdate(name, orderRef, status, trackingId, courier, url)`

### Frontend
- Checkout: when Razorpay selected, open Razorpay checkout → on success POST order with payment fields; on dismiss/failure call `payment-failed` endpoint + toast "Order cancelled, email sent".
- COD: order created with `payment.status='pending'`; admin verifies later manually.
- Admin Payments tab: each row gets "Mark Paid" / "Mark Failed" buttons.

## 5. Files

### New
- `src/routes/track.tsx`
- `src/routes/sitemap[.]xml.ts`
- `public/robots.txt`

### Edited (backend)
- `backend/src/models/Order.ts` — trackingId, courier, courierTrackingUrl
- `backend/src/routes/order.routes.ts` — trackingId gen, payment verify on create, public track endpoint, payment-failed endpoint
- `backend/src/routes/admin.routes.ts` — PATCH order (status/courier/tracking), PATCH payment
- `backend/src/utils/email.ts` — invoice + new templates
- `backend/src/utils/trackingId.ts` (new) — id generator

### Edited (frontend)
- `src/lib/api.ts` — new helpers
- `src/lib/store.tsx` — wire new admin updaters + Razorpay flow
- `src/routes/__root.tsx` — sitewide defaults, Organization JSON-LD
- `src/routes/index.tsx`, `shop.tsx`, `cart.tsx`, `wishlist.tsx`, `checkout.tsx`, `orders.index.tsx`, `orders.$id.tsx`, `profile.tsx`, `login.tsx`, `signup.tsx`, `product.$id.tsx`, `admin.tsx` — `head()` metadata
- `src/components/Header.tsx` — "Track Order" link
- `src/routes/admin.tsx` — Orders tab edit modal, Payments tab verify buttons
- `src/routes/checkout.tsx` — Razorpay integration with fail-handling

## Notes
- Real Razorpay sandbox needs `RAZORPAY_KEY_ID/SECRET` in `backend/.env` and the script `https://checkout.razorpay.com/v1/checkout.js` loaded on demand.
- Email invoices only send when `RESEND_API_KEY` is set; otherwise they log and skip silently (already handled).
- Admin-set tracking id overrides the auto-generated one if provided.

Shall I proceed?