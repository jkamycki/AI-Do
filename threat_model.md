# Threat Model

## Project Overview

A.IDO is a production web application for wedding planning. It uses a React + Vite frontend in `artifacts/aido`, an Express API server in `artifacts/api-server`, PostgreSQL via Drizzle in `lib/db`, Clerk for authentication, Replit object storage for user-uploaded files, OpenAI-backed features for planning and messaging assistance, and inbound/outbound email integrations through Resend and a Cloudflare email worker.

The production scope for this scan is the API server, the frontend routes that exercise production APIs, shared libraries consumed by those services, and the Cloudflare inbound email worker. `artifacts/mockup-sandbox` is treated as dev-only and out of scope unless production reachability is demonstrated. Per deployment assumptions, production traffic is TLS-terminated by the platform and `NODE_ENV` is `production`.

## Assets

- **User accounts and Clerk sessions** — compromise allows impersonation of couples, collaborators, and admins.
- **Wedding workspace data** — profiles, budgets, checklists, guests, contracts, vendor conversations, seating charts, and hotel blocks contain sensitive personal and event data.
- **Collaboration invitations and guest-collection links** — bearer-style tokens grant access to shared workspaces or public guest-submission flows.
- **Uploaded files and attachments** — receipts, contracts, and vendor-message attachments may contain PII, financial details, and contract terms.
- **Admin analytics and support data** — admin views expose broad cross-user information, contact submissions, and operational events.
- **Application secrets and service credentials** — Clerk secret key, webhook secrets, database credentials, OpenAI access, and Resend credentials enable privileged backend actions.

## Trust Boundaries

- **Browser to API** — all frontend requests cross from an untrusted client into the Express server; every protected route must authenticate and authorize server-side.
- **Public token holder to API** — invite links, guest-collection links, and any object URLs behave like bearer tokens and must be treated as sensitive secrets.
- **API to PostgreSQL** — the API has broad database access; broken authorization or injection at the API layer can expose or modify all tenant data.
- **API to Clerk** — production auth proxy code can mint or complete sessions using privileged Clerk backend credentials.
- **API to object storage** — the backend can issue presigned upload URLs and serve private files; access control must be enforced before file exposure.
- **API to external services** — Resend, Cloudflare inbound email, and OpenAI calls cross service boundaries and require origin verification, minimal data disclosure, and bounded failure behavior.
- **Authenticated user to admin surface** — `/api/admin/*` and support-message views must remain inaccessible to normal users.
- **Owner/collaborator/workspace boundary** — workspace sharing intentionally permits some cross-user access, but only according to collaborator role and workspace membership.

## Scan Anchors

- **Production entry points:** `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/routes/**`, `artifacts/aido/src/App.tsx`, `cloudflare/email-worker.js`
- **Highest-risk areas:** Clerk production proxy in `artifacts/api-server/src/app.ts`, workspace/invite logic in `artifacts/api-server/src/routes/collaborators.ts` and `src/lib/workspaceAccess.ts`, object storage in `artifacts/api-server/src/routes/storage.ts` and `src/lib/objectStorage.ts`, ID-based CRUD routes under `artifacts/api-server/src/routes/**`
- **Public/token-based surfaces:** `/api/invite/:token`, `/api/guest-collect/:token*`, `/api/storage/public-objects/*`, `/api/storage/objects/*`, `/api/tts/narration/:scene`, inbound webhook endpoints under `/api/webhooks/*`
- **Authenticated/admin surfaces:** most `/api/*` routes require `requireAuth`; `/api/admin/*` and admin help-message actions require additional admin checks
- **Usually dev-only:** `artifacts/mockup-sandbox`, `scripts`, attached assets used for design/reference

## Threat Categories

### Spoofing

The application depends on Clerk sessions to identify users, collaborators, and admins. The API must only establish or accept sessions through legitimate Clerk flows, must never let backend-only credentials bypass second-factor or equivalent identity verification, and must verify webhook callers using the configured shared secret or signature mechanism.

Invite and guest-collection tokens also act as identities. Possession of one of these links must only grant the exact access intended by the owner, and invite acceptance must be bound to the intended recipient rather than any authenticated account that obtains the link.

### Tampering

The client is untrusted for all workspace mutations. Budget items, checklist items, contracts, collaborators, seating charts, vendor messages, and similar records must be updated or deleted only when the server verifies both the target record and the caller’s ownership or authorized workspace role. Client-selected workspace headers and route identifiers must never be sufficient on their own.

### Information Disclosure

Wedding planning data includes guest addresses, budgets, uploaded receipts, contracts, vendor emails, and support messages. API responses, object-download routes, and token-based flows must limit disclosure to the owning workspace or explicitly public content. Private object storage paths must not become effectively public through guessable or reusable URLs, and invite/token lookups must not reveal more metadata than necessary to unauthenticated callers.

### Denial of Service

Public or semi-public endpoints such as upload-URL issuance, contract upload, guest-collection submission, AI-backed generation routes, and TTS generation can consume storage, CPU, and third-party quotas. These routes need authentication where appropriate, bounded body/file sizes, and controls that prevent unauthenticated abuse from exhausting storage or paid API usage.

### Elevation of Privilege

The major privilege boundaries are normal user vs admin, owner vs collaborator, collaborator role tiers, and unauthenticated token holder vs authenticated workspace member. The system must enforce role checks server-side on every sensitive route, ensure record-level mutations remain scoped to the proper user or workspace, and prevent backend integration code from turning privileged service credentials into a universal login or data-access primitive.