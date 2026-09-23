# Travels Pro — Production Deployment Guide (Vercel & Render)

**Document Version:** 1.0.0  
**Target Topology:**
* **Frontend:** Vercel (Next.js 16 App Router)
* **Backend API & WebSockets:** Render Web Service (Node.js / Next.js API Routes / Socket.io)
* **Database:** Managed PostgreSQL (Render PostgreSQL, Supabase, or Neon)
* **Cache / Invalidation:** Managed Redis (Render Redis or Upstash)

---

## 1. Overview of Architecture in Production

```
┌───────────────────────────────────────────────┐
│               TRAVELER / HOST BROWSER         │
└───────────────────────┬───────────────────────┘
                        │
                        ▼ HTTPS
┌───────────────────────────────────────────────┐
│           VERCEL (Travels_frontend)           │
│  - Serves static pages, React UI, & assets    │
│  - /api/:path* rewritten to Render backend    │
│  - Zero CORS & Zero cross-site cookie errors  │
└───────────────────────┬───────────────────────┘
                        │
                        ▼ Internal Server-to-Server Rewrite
┌───────────────────────────────────────────────┐
│           RENDER (Travels_backend)            │
│  - Next.js API Routes (119 Endpoints)         │
│  - Health Check: /api/health/ready            │
│  - Socket.io Trip Circles: npm run socket     │
└───────────────┬───────────────────────────────┘
                │
        ┌───────┴────────┐
        ▼                ▼
┌───────────────┐ ┌───────────────┐
│  PostgreSQL   │ │     Redis     │
│  Prisma 70+   │ │  Session FIFO │
│    Models     │ │  Device Limits│
└───────────────┘ └───────────────┘
```

---

## 2. Deploying Backend to Render

### Option A: Using Render Blueprint (`render.yaml`) — Recommended
1. Push `Travels_backend` to GitHub:
   ```bash
   git push origin main
   ```
2. Log in to [Render Dashboard](https://dashboard.render.com).
3. Click **New +** &rarr; **Blueprint**.
4. Connect the `Satyamdubey19/Travel_backend` repository.
5. Render will automatically detect [`render.yaml`](file:///d:/GetHotelsNextjs/Travels_Pro/Travels_backend/render.yaml) and pre-configure the service:
   * **Service Name:** `travels-pro-backend`
   * **Runtime:** Node
   * **Build Command:** `npm install --include=dev && npx prisma generate && npm run build`
   * **Start Command:** `npx next start -p $PORT`
   * **Health Check Path:** `/api/health/ready`
6. Fill in the required secret values (e.g. `DATABASE_URL`, `REDIS_URL`, `CLOUDINARY_*`, `RAZORPAY_*`).
7. Click **Apply**.

---

### Option B: Manual Web Service Setup on Render
1. In Render Dashboard, click **New +** &rarr; **Web Service**.
2. Select your repository: `Satyamdubey19/Travel_backend`.
3. Configure settings:
   * **Name:** `travels-pro-backend`
   * **Region:** Oregon (US West) or Singapore / Frankfurt (choose closest to users)
   * **Branch:** `main`
   * **Root Directory:** leave blank (or `.` if repo root)
   * **Runtime:** `Node`
   * **Build Command:**
     ```bash
     npm install --include=dev && npx prisma generate && npm run build
     ```
   * **Start Command:**
     ```bash
     npx next start -p $PORT
     ```
   * **Plan:** Starter ($7/mo recommended for production; Free tier sleeps after inactivity).
4. Expand **Advanced**:
   * **Health Check Path:** `/api/health/ready`
   * **Auto-Deploy:** Yes

---

### Backend Environment Variables on Render

Configure these under the **Environment** tab:

| Variable Name | Required | Sample / Guidance |
| :--- | :--- | :--- |
| `NODE_ENV` | Yes | `production` |
| `DATABASE_URL` | Yes | `postgresql://user:pass@host:5432/travelspro?sslmode=require` |
| `REDIS_URL` | Yes | `redis://default:pass@host:6379` |
| `PORT` | Auto | Injected automatically by Render (default 10000) |
| `NEXTAUTH_URL` | Yes | `https://travels-pro.vercel.app` (your frontend domain) |
| `CORS_ORIGIN` | Yes | `https://travels-pro.vercel.app` |
| `NEXTAUTH_SECRET` | Yes | 32+ char random string (e.g. `openssl rand -base64 32`) |
| `JWT_SECRET` | Yes | 32+ char random string |
| `JWT_ACCESS_SECRET`| Yes | 32+ char random string |
| `KYC_ENCRYPTION_KEY`| Yes | 32-byte hex/random key for Aadhaar & Bank encryption |
| `AADHAAR_HASH_SECRET`| Yes | Random salt string for irreversible Aadhaar blinding |
| `CRON_SECRET` | Yes | Secret token for scheduled job webhooks |
| `LOCATION_API_KEY` | Optional | OpenCage or Google Maps key |
| `OPENCAGE_API_KEY` | Optional | OpenCage API key for geocoding |
| `CLOUDINARY_CLOUD_NAME` | Yes | Your Cloudinary Cloud Name |
| `CLOUDINARY_API_KEY` | Yes | Your Cloudinary API Key |
| `CLOUDINARY_API_SECRET` | Yes | Your Cloudinary API Secret |
| `RAZORPAY_KEY_ID` | Yes | `rzp_live_...` or `rzp_test_...` |
| `RAZORPAY_KEY_SECRET` | Yes | Razorpay key secret |
| `RAZORPAY_WEBHOOK_SECRET` | Yes | Secret configured in Razorpay Webhooks dashboard |
| `BREVO_API_KEY` | Yes | Brevo / Sendinblue API Key |
| `BREVO_FROM_EMAIL` | Yes | `Travels Pro <notifications@yourdomain.com>` (verified sender) |

---

### Running Database Migrations on Render
Once the PostgreSQL database is connected, run migrations either via a Render Deploy Hook or the Render Shell:
```bash
npx prisma migrate deploy
```
To seed initial tours, activities, and policies:
```bash
npx prisma db seed
```

---

## 3. Deploying Frontend to Vercel

1. Push `Travels_frontend` to GitHub:
   ```bash
   git push origin main
   ```
2. Log in to [Vercel Dashboard](https://vercel.com).
3. Click **Add New...** &rarr; **Project**.
4. Import `Satyamdubey19/Travel_frontend`.
5. Configure Project Settings:
   * **Framework Preset:** `Next.js` (auto-detected)
   * **Root Directory:** `./`
   * **Build Command:** `npm run build` (auto-detected)
   * **Output Directory:** `.next` (auto-detected)
   * **Install Command:** `npm install` (auto-detected)

---

### Frontend Environment Variables on Vercel

Configure these in the Vercel **Environment Variables** section:

| Variable Name | Environment | Value | Description |
| :--- | :--- | :--- | :--- |
| `BACKEND_API_URL` | Production, Preview, Dev | `https://your-backend-app.onrender.com` | **Crucial:** The public URL of your Render backend. Used by Next.js rewrites to proxy `/api/*` requests. |
| `NEXT_PUBLIC_API_URL` | Production, Preview, Dev | `/api` | Kept as `/api` so browser makes same-origin requests through the proxy. |
| `NEXT_PUBLIC_SOCKET_URL` | Production, Preview, Dev | `https://your-backend-app.onrender.com` | URL for WebSocket Trip Circles connection. |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Production, Preview, Dev | `rzp_live_...` (or test key) | Client-side Razorpay checkout modal key. |

---

## 4. Post-Deployment Cross-Wiring Verification

### Step 1: Verify Backend Health
Test that your Render backend is running and connected to PostgreSQL and Redis:
```bash
curl -I https://your-backend-app.onrender.com/api/health/ready
```
*Expected response:* `HTTP/2 200` with JSON `{"status":"ok","database":true,"redis":true}`.

### Step 2: Verify Frontend Reverse Proxy
Open the Vercel deployment URL (e.g. `https://travels-pro.vercel.app`):
1. Test `/api/health/ready` through Vercel:
   ```bash
   curl -I https://your-frontend-app.vercel.app/api/health/ready
   ```
   *Expected response:* `HTTP/2 200` proxied directly from Render.
2. Open browser DevTools Network tab on `https://your-frontend-app.vercel.app/`.
3. Verify that `/api/tour`, `/api/activity`, and `/api/rental` return 200 without any CORS warnings.
4. Verify the interactive Calendar, Search Bar, and Responsive Horizontal Rail render smoothly.

### Step 3: Configure Razorpay Webhooks
In your Razorpay Dashboard:
* **Webhook URL:** `https://your-backend-app.onrender.com/api/webhooks/razorpay`
* **Secret:** Matches `RAZORPAY_WEBHOOK_SECRET` on Render.
* **Events:**
  * `payment.captured`
  * `payment.failed`
  * `refund.processed`
  * `order.paid`

---

## 5. Maintenance & Troubleshooting

* **Render Free Tier Spin-Down**:
  On Render Free tier, web services sleep after 15 minutes of inactivity. Set up an uptime monitor (like UptimeRobot or BetterUptime) hitting `https://your-backend-app.onrender.com/api/health/live` every 5 minutes to prevent sleep.
* **Cookie / Session issues**:
  Because Next.js `proxy.ts` and `next.config.ts` rewrite `/api/*` from the frontend origin, cookies (`refreshToken`, `deviceId`) are stored as **first-party cookies** on your Vercel domain, preventing Safari ITP and third-party cookie blocks.
