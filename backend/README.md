# Shri Radha Govind Store — Backend

Express + TypeScript + MongoDB API powering the storefront and admin panel.

## Stack
- Express 4 + TypeScript
- MongoDB via Mongoose
- JWT auth (email/password) + Google OAuth (ID token verification)
- Cloudinary for image storage (multer memory uploads)
- Resend for transactional email (order confirmations etc.)
- Razorpay for payments (create order + verify signature)

## Setup
```bash
cd backend
cp .env.example .env       # then fill in the values
npm install                # or: bun install / pnpm install
npm run dev                # http://localhost:5000
```

A bootstrap admin (`ADMIN_EMAIL` / `ADMIN_PASSWORD`) is created on first boot if it does not exist.

## Frontend wiring
Add to the frontend `.env`:
```
VITE_API_URL=http://localhost:5000/api
```
On production deploy of the backend (Render/Railway/VPS), point `VITE_API_URL` at the deployed URL and add the frontend origin to `CORS_ORIGIN`.

## API surface
- `POST   /api/auth/signup` — { name, email, password }
- `POST   /api/auth/login` — { email, password }
- `POST   /api/auth/google` — { credential } (Google ID token)
- `GET    /api/auth/me`
- `GET    /api/products` · `GET /api/products/:id`
- `POST   /api/products` · `PATCH /api/products/:id` · `DELETE /api/products/:id` (admin)
- `GET    /api/categories` · `POST/PATCH/DELETE` (admin)
- `GET    /api/settings` · `PATCH /api/settings` (admin)
- `POST   /api/uploads/image` — multipart `file` → Cloudinary URL (admin)
- `GET    /api/orders` (mine) · `POST /api/orders` · `GET /api/orders/:id`
- `GET    /api/admin/orders` · `PATCH /api/admin/orders/:id/status` (admin)
- `GET    /api/admin/users` · `GET /api/admin/payments` (admin)
- `POST   /api/payments/razorpay/order` — { amount }
- `POST   /api/payments/razorpay/verify` — { order_id, payment_id, signature }
