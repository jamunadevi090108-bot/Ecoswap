# EcoSwap Full Stack

EcoSwap uses a React + TypeScript + Vite frontend and a Node.js + Express backend. The backend is prepared to persist application data in Supabase PostgreSQL, handle JWT authentication with bcryptjs password hashing, upload images to Supabase Storage, and provide a demo clothing analyzer and shopping assistant.

## Supabase readiness

The backend starts without Supabase credentials so the project can be prepared before a Supabase project exists. Database-backed routes return HTTP 503 with setup instructions until both required server-side values are configured. This project is **ready for Supabase, not connected to Supabase** until real credentials are added and database requests have been verified.

The service-role key is used only by the backend. Never add it to frontend files or frontend environment variables.

1. Copy `backend/.env.example` to `backend/.env`.
2. Fill in `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FRONTEND_URL`, and a private `JWT_SECRET`.
3. In the Supabase SQL Editor, run `backend/supabase/schema.sql`. This creates the `product-images` public-read bucket; uploads require a signed-in user.
4. Optionally run `backend/supabase/seed.sql` to add fictional demo marketplace data. Seeding is never automatic.

The schema contains the tables required by the current backend: `users`, `products`, `orders`, and `requests`. Donations, recycling, and exchanges use the existing `requests` table distinguished by its `type`; no separate tables are needed by the current API. Run `backend/supabase/payment-schema.sql` after the base schema to add the secure Razorpay payment flow.

## Backend

From `EcoSwapFullStack/backend`:

```powershell
npm.cmd install
npm.cmd run dev
```

The API listens at `http://localhost:5000`. `GET /api/health` reports whether Supabase credentials are configured; it does not claim that a database connection has been tested.

To create an admin after configuring Supabase and running the schema:

```powershell
node createAdmin.js <email> <password>
```

The password must be at least eight characters. Admin routes remain protected by the existing JWT and role checks.

## Frontend

From `EcoSwapFullStack/frontend`:

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:5173`. The frontend continues to use its centralized REST API service and calls the Express backend at `http://localhost:5000`.

When running commands from the downloaded project’s outer folder, use `npm.cmd run dev` to start the frontend or `npm.cmd run dev:backend` to start the backend. `npm.cmd run build` builds the frontend from that folder.

## Current backend routes

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/users/profile`, `PUT /api/users/profile`
- `GET /api/products`, `GET /api/products/:id`, `GET /api/products/mine`, `POST /api/products`, `PUT /api/products/:id`, `DELETE /api/products/:id`
- `GET /api/orders`, `POST /api/orders/checkout`, `POST /api/orders/verify-payment`, `POST /api/orders/cancel-payment`
- `POST /api/requests`, `GET /api/requests`
- `POST /api/upload`
- `POST /api/ai/analyze`, `POST /api/ai/chat`
- Protected `/api/admin` statistics, user, listing, request, and order operations

The clothing analyzer remains a clearly labeled demo. Open-ended assistant replies use Google Gemini through the backend; create an API key in Google AI Studio, set it as `AI_API_KEY` in `backend/.env`, and optionally set `AI_MODEL` (defaults to `gemini-3.8-flash`). Never expose the key in frontend configuration. The assistant has several fast built-in EcoSwap navigation and marketplace lookup replies; its listing responses query real marketplace records when Supabase is configured. Uploaded listing/donation/recycling images use the `product-images` Supabase Storage bucket.

The marketplace includes only real database records. Optional rows from `seed.sql` carry an `is_demo` marker and are labeled as seeded demo listings. Product checkout uses Razorpay Standard Checkout; Google Pay appears as a UPI method when supported and enabled for the merchant account. The backend creates Razorpay orders, verifies payment signatures and captured amounts, and only then marks the listing sold. Get test keys from Razorpay Dashboard → Account & Settings → API Keys, then set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `backend/.env`; keep the key secret on the backend only. Live payments require an activated Razorpay account and payment methods enabled in its dashboard. The legacy unpaid `POST /api/orders` route is disabled.

For local frontend configuration, copy `frontend/.env.example` to `frontend/.env.local` and set `VITE_API_URL` if your backend is not at `http://localhost:5000/api`.

## Setup checklist after creating a Supabase project

1. Create the Supabase project.
2. Copy the Project URL.
3. Copy the service-role key from Supabase project API settings.
4. Put both values into `backend/.env`; keep the service-role key private and backend-only.
5. Open the Supabase SQL Editor.
6. Run `backend/supabase/schema.sql`.
7. Run `backend/supabase/payment-schema.sql`.
8. Optionally run `backend/supabase/seed.sql`.
9. Set Razorpay test keys in `backend/.env` and restart the backend.
10. Start the backend with `npm.cmd run dev` from `backend`.
11. Start the frontend with `npm.cmd run dev` from `frontend`.
12. Test the app and `GET /api/health`. Only after database-backed API operations succeed is the project connected.
