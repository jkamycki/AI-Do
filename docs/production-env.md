# A.I. DO Production Environment

Use this to audit deployment settings before the final signed-in launch check.

## Vercel Frontend

Set these in the Vercel project environment variables:

```text
VITE_API_URL=https://ai-do.onrender.com
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
VITE_CLERK_PROXY_URL=
```

The frontend build command should be:

```text
pnpm run build
```

The output directory should be:

```text
dist
```

## Render API

Set these in the Render API service environment:

```text
PORT=10000
NODE_ENV=production
FRONTEND_URL=https://aidowedding.net
PUBLIC_APP_URL=https://aidowedding.net
CLERK_SECRET_KEY=sk_live_...
CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_WEBHOOK_SECRET=whsec_...
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@aidowedding.net
RESEND_FROM_NAME=A.IDO
INBOUND_EMAIL_DOMAIN=mail.aidowedding.net
RESEND_WEBHOOK_SECRET=whsec_...
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=aido-uploads
R2_PUBLIC_PREFIX=public
R2_PRIVATE_PREFIX=private
CLOUDFLARE_INBOUND_SECRET=...
```

The Render service should use:

```text
healthCheckPath: /api/healthz
```

## Mobile App

Set these in `mobile/app/.env` for production builds:

```text
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
EXPO_PUBLIC_AIDO_WEB_URL=https://aidowedding.net
EXPO_PUBLIC_AIDO_API_URL=https://ai-do.onrender.com
EXPO_PUBLIC_AIDO_AUTH_TOKEN=
```

Do not set `EXPO_PUBLIC_AIDO_AUTH_TOKEN` for production store builds.

## Verification

Run:

```powershell
corepack pnpm run check:deploy
corepack pnpm run check:production
```

After refreshing signed-in production auth, run:

```powershell
corepack pnpm run check:production:auth
```
