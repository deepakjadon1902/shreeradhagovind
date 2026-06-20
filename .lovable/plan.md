## Goals

1. **Auto courier event syncing** in admin OrderManager (polling-based; no real courier API integration since carrier API keys not provided — simulate event derivation + auto-refresh).
2. **Admin Users page** — list registered users, view full details, activate/block.
3. **Store address & contact update** site-wide to:
   - Shri Radha Govind Store, 155, 2nd Floor, Madan Mohan Ghera, Vrindavan, Mathura, UP – 281121
   - Phone +91 7500533505, support@shriradhagovindstore.com, shriradhagovindstore@gmail.com
4. **Content pages** — create About Us, Contact Us, Privacy Policy, Terms & Conditions, Shipping Policy, Refund & Returns routes using uploaded text content (cleaned & restyled with project tokens, not raw HTML strings).

## Implementation

### Backend
- `User` model: add `isBlocked: boolean`, `phone`, `address` (already may have). Verify and extend.
- `admin.routes.ts`:
  - `GET /admin/users` → list with full registration data
  - `PATCH /admin/users/:id/status` → block/unblock (sets `isBlocked`)
- `auth.routes.ts` login: reject if `isBlocked`.
- `order.routes.ts`: add `GET /orders/:id/events` returning derived courier events array based on current status + timestamps (lightweight derivation since no real courier API).
- Update site address constants in `email.ts` and `invoice.ts` footers/headers.

### Frontend
- `src/lib/store.tsx`: add `users` state, `fetchUsers`, `toggleUserBlock`. Already-known `settings` defaults updated to new address/phone/email.
- `src/routes/admin.tsx`:
  - New **Users** tab — table with name, email, phone, address, joined date, status, block/unblock action, details modal.
  - OrderManager: `useEffect` polling every 15s via `setInterval` to refetch the open order's events; show "Live" indicator + last synced time.
- New routes:
  - `src/routes/about.tsx`
  - `src/routes/contact.tsx`
  - `src/routes/privacy.tsx`
  - `src/routes/terms.tsx`
  - `src/routes/shipping.tsx`
  - `src/routes/returns.tsx`
  Each with proper SEO `head()`, semantic HTML using design tokens (NOT raw uploaded inline styles).
- `Footer.tsx`: update address/phone/email + link to new policy pages.
- `Header.tsx`: keep existing nav; policy links live in footer.

### Notes / Limitations
- True real-time courier sync requires per-courier API credentials (Ekart/DTDC/etc.) which aren't available. Implementation uses **derived events from status + timestamps** with auto-polling so the modal updates without manual refresh. When real courier API keys are provided later, only `/orders/:id/events` backend handler needs swapping.

## Files

**Created:** 6 route files (about/contact/privacy/terms/shipping/returns).
**Edited:** `backend/src/models/User.ts`, `backend/src/routes/admin.routes.ts`, `backend/src/routes/auth.routes.ts`, `backend/src/routes/order.routes.ts`, `backend/src/utils/email.ts`, `backend/src/utils/invoice.ts`, `src/lib/store.tsx`, `src/lib/api.ts`, `src/routes/admin.tsx`, `src/components/Footer.tsx`.
