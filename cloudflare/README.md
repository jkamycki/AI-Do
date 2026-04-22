# Cloudflare Email Routing Setup

Inbound vendor replies → A.IDO chat threads.

## One-time setup in Cloudflare

### 1. Enable Email Routing
- Cloudflare dashboard → `aidowedding.net` → **Email** → **Email Routing**
- Click **Enable Email Routing** if it isn't on yet
- Add the MX + TXT records when prompted (Cloudflare adds them automatically)

### 2. Create the Email Worker
- Email → Email Routing → **Email Workers** → **Create**
- Name it `aido-inbound`
- Paste the contents of `email-worker.js` from this folder
- The dashboard editor doesn't support `import` from npm, so use **Wrangler** to deploy:

```bash
npm create cloudflare@latest aido-inbound-worker -- --type=hello-world --ts=false
cd aido-inbound-worker
npm install postal-mime
# replace src/index.js with the contents of email-worker.js
npx wrangler deploy
```

### 3. Add secrets to the Worker
```bash
npx wrangler secret put API_URL          # → https://aidowedding.net
npx wrangler secret put INBOUND_SECRET   # → same value as CLOUDFLARE_INBOUND_SECRET in Replit
```

### 4. Route inbound mail to the Worker
- Email Routing → **Routes** → **Catch-all address**
- Action: **Send to a Worker** → pick `aido-inbound`
- Save & enable

### 5. Add the matching secret on Replit
- App secrets → add `CLOUDFLARE_INBOUND_SECRET` with the **exact same value** you set in step 3
- Republish the app so the API picks it up

## Test
1. Open any vendor chat in the app, send a message — note the reply-to address shown is `messages+<id>.<token>@aidowedding.net`
2. From your personal email, reply to that thread
3. Within ~5 seconds the reply should appear in the chat with the toast notification

## Troubleshooting
- Worker logs: `npx wrangler tail aido-inbound`
- API logs: Replit deployment logs, search for `cloudflare inbound`
- 401 Invalid auth → secrets don't match between Worker and Replit
- "no routing match" → recipient isn't `messages+<id>.<token>@aidowedding.net` (Cloudflare catch-all might be matching the wrong domain — verify Email Routing is enabled on `aidowedding.net` not a subdomain)
