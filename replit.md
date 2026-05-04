# A.IDO — AI Wedding Planning OS

## Overview

Full-stack AI-powered wedding planning application. pnpm workspace monorepo using TypeScript.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Authentication**: Clerk (email + password + Google OAuth)
- **AI**: OpenAI via Replit integration (model: gpt-5.2, no user API key needed)
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui

## SMS / Text Messaging
- SMS RSVP was considered but deferred — user decided to stick with email-only RSVPs for now.
- Twilio integration exists in Replit (`connector:ccfg_twilio_01K69QJTED9YTJFE2SJ7E4SY08`) but was not authorized. If SMS is revisited, propose that integration or ask the user for their Twilio Account SID, Auth Token, and sender phone number to store as secrets.
- The `guests` table already has a `phone` column ready to use for SMS when needed.

## Operations Center (Admin Dashboard)

- Tabs: **Overview** | **Users** | **Engagement** | **Event Log** | **Messages**
- **Overview**: Sticky KPI strip (visits today, signups today, total, onboarded, conversion rate, DAU), conversion funnel (Visits → Signups → Onboarded), area chart (growth last 30 days), feature usage bar chart, system summary
- **Users**: Filter pills (All / Onboarded / Not Onboarded / New Today) with live counts, searchable user directory, per-user event count, Excel export, click-to-inspect detail modal
- **Website visit tracking**: `POST /api/analytics/pageview` (public, no auth) stores visitor ID (localStorage UUID) + path + device in analytics_events; fires on every Landing page mount
- **Engagement**: Feature usage charts, most/least used features
- Page views tracked in `analytics_events` table with `eventType = 'page_view'` and `userId = visitor_{uuid}`

## Application Features

1. **Wedding Profile** — Store couple names, date, venue, guest count, budget, vibe
2. **AI Timeline Builder** — Drag-and-drop block-based timeline with 9 color-coded categories (preparation/amber, ceremony/gold, cocktail/orange, reception/pink, photos/purple, vendors/blue, travel/gray, dancing/fuchsia, other), start+end times, location per block, smart conflict detection (overlaps + tight travel gaps), three view modes (Master/Guest/Vendor), and PDF export. Event schema: `{ id, startTime, endTime, title, description, category, location, notes }` stored in `timelines.events` JSONB.
3. **AI Vendor Email Assistant** — Draft professional vendor emails with AI + PDF export
4. **AI Budget Manager** — Track expenses + AI cost predictions by location
5. **AI Checklist System** — Month-by-month planning tasks personalized by AI
6. **Day-Of Coordinator Mode** — Emergency AI helper for the wedding day
7. **Smart Vendor Sync** — Full CRUD vendor management (scoped by profileId)
8. **Guest List Manager** — Full CRUD guest list with RSVP tracking, meal choices, plus-ones, table assignments, CSV export (`/guests` route, `guests` DB table)
9. **Onboarding Wizard** — Multi-step profile setup modal for new users (`OnboardingWizard.tsx`)
10. **Dashboard: Upcoming Tasks** — Shows checklist items due within 45 days on the dashboard
11. **Dashboard: Guest Count Chip** — Guest stat chip on dashboard linking to guest list
8. **PDF Export** — Server-side pdfkit generation with branded A.IDO layout for timeline + vendor emails
9. **Operations Center** — Admin analytics dashboard with User Metrics, Product Usage, Money Metrics, System Health, and Event Log
10. **Collaboration System** — Invite-by-link system with Partner/Planner/Vendor roles, accept/decline flow, workspace switching, shared workspace view, and activity log
11. **Virtual Support Assistant (Aria)** — Floating AI chat widget on all authenticated pages; GPT-powered, knows all A.IDO features and general wedding planning; streams responses in real time
12. **Internationalization (i18n)** — 14 languages supported (en, es, fr, de, it, pt, zh, ja, ko, ar, hi, ru, nl, pl). Locales in `artifacts/aido/src/locales/<lang>.json`. RTL support in `i18n.ts` auto-applies `dir="rtl"` for ar/he/fa/ur on language change. Persists per-user via `useSaveProfile` + `localStorage["aido_language"]`. Use the chunked translator script at `/tmp/translate_chunked.mjs` (env: NS_FILTER) to regenerate locales when adding/changing keys in `en.json`.

## Authentication Architecture

- **Clerk** handles user identity (email/password + Google OAuth)
- `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` auto-provisioned
- API server uses `@clerk/express` + `clerkMiddleware()` + `requireAuth` middleware
- All API routes require authentication via `requireAuth` middleware
- Frontend wraps app with `<ClerkProvider>` and uses `setAuthTokenGetter` to pass Bearer tokens
- Each user's data is scoped via `userId` column on `wedding_profiles` table
- Other tables (`timelines`, `budgets`, `budget_items`, `checklist_items`) scope via `profile_id` FK

## Analytics & Admin Architecture

- **`analytics_events` table** — tracks all user actions with `user_id`, `event_type`, `timestamp`, `metadata`
- **`admin_users` table** — stores promoted admin user IDs
- **`trackEvent(userId, eventType, metadata?)` helper** — fire-and-forget event tracking in all route handlers
- **Tracked events**: `user_signup`, `onboarding_completed`, `user_login`, `timeline_generated`, `vendor_email_generated`, `checklist_item_completed`, `budget_updated`, `day_of_mode_activated`, `pdf_exported`
- **Admin API routes** at `/api/admin/*`: `check`, `metrics`, `events`, `promote/:userId`, `demote/:userId`
- **Admin bootstrap**: insert user_id into `admin_users` table via SQL to grant initial access
- **Frontend**: `Admin.tsx` at `/admin` route — tabs: User Metrics, Product Usage, Money Metrics, System Health, Event Log
- **Sidebar** shows "Operations Center" link only to users whose `/api/admin/check` returns `isAdmin: true`

## Routing Structure (Frontend)

- `/` — Public landing page (or redirect to /dashboard if signed in)
- `/sign-in` — Clerk-branded sign-in page
- `/sign-up` — Clerk-branded sign-up page
- `/dashboard` — Main app (protected)
- `/profile`, `/timeline`, `/budget`, `/checklist`, `/vendor-email`, `/day-of` — All protected
- `/admin` — Operations Center (protected; also requires admin role via `/api/admin/check`)
- `/settings` — Settings & Collaborators page (protected)
- `/invite/:token` — Invite acceptance page (public, handles own auth state)
- `/workspace/:profileId` — Shared workspace view (protected; requires collaborator access)

## Collaboration Architecture

- **`workspace_collaborators` table** — `profileId`, `inviterUserId`, `inviteeEmail`, `inviteeUserId` (filled on accept), `role` (partner/planner/vendor), `status` (pending/active/declined), `inviteToken` (UUID), `invitedAt`, `acceptedAt`
- **`workspace_activity` table** — `profileId`, `userId`, `userName`, `action`, `resourceType`, `details` (jsonb), `createdAt`
- **`logActivity(profileId, userId, action, resourceType?, details?, userName?)` helper** — fire-and-forget activity tracking; called from timeline, checklist, budget, and collaborator management routes
- **Invite flow**: Owner creates invite (email + role) → UUID token generated → share link `/invite/:token` → invitee signs in → POST `/api/invite/:token/accept` claims the invite
- **No email service**: Invite link must be copied and shared manually by the owner
- **Workspace switching**: `WorkspaceContext` stores active workspace info in localStorage; `WorkspaceSwitcher` in sidebar fetches `/api/collaborators/my-workspaces` and lets user jump to any shared workspace
- **Shared workspace view**: `/workspace/:profileId` page fetches timeline, budget, checklist, and activity from `/api/workspace/:profileId/*` endpoints with role-based access control (Vendors see timeline only; Planners/Partners see budget + checklist too)
- **Real-time**: React Query `refetchInterval: 5000` on shared workspace queries for live updates
- **Roles**: `owner` (full), `partner` (full edit), `planner` (edit timeline/checklist/budget/emails), `vendor` (view timeline + PDFs only)
- **API endpoints** at `/api/collaborators/*` and `/api/workspace/:profileId/*`
- **`workspaceAccess.ts` helper** — `resolveWorkspaceRole(userId, profileId)`, `hasMinRole(role, required)`, `logActivity(...)`

## AI Contract Reader

- **Page**: `/contract-reader` — drag-and-drop upload (PDF, DOCX, TXT, max 10 MB)
- **API**: `POST /api/contracts/upload` — multer memory storage → pdf-parse text extraction → GPT-4.1-mini analysis
- **Analysis output**: overall risk level (low/medium/high), vendor type, summary, red flags with severity, key terms, cancellation policy, payment terms, liability, positives, missing clauses, negotiation tips
- **History**: `GET /api/contracts`, `DELETE /api/contracts/:id`; stored in `vendor_contracts` DB table
- **Frontend**: split-panel layout — past contracts sidebar + analysis view with expandable risk flags

## AI Seating Chart Generator

- **Page**: `/seating-chart` — guest list manager with relationship mapping
- **Guest features**: name, group (6 options), +1 toggle, notes, per-guest relationship picker (♥ prefer near / ⚡ avoid)
- **API**: `POST /api/seating/generate` — GPT-4.1-mini assigns guests to named tables, avoids conflicts
- **Chart output**: named tables with color-coded cards, AI insights, conflict warnings, regenerate button
- **Persistence**: `POST/GET/PUT/DELETE /api/seating/charts` stored in `seating_charts` DB table

## Help & Support System

- **Help page** at `/help` — three tabs: Contact Us, Feedback, FAQ
- **Contact form** — name, email, subject, message; displayed from address is "A.IDO@support.com"; stored in `contact_messages` DB table
- **Feedback form** — star rating (1-5), category picker (Bug/Feature/General/Praise), message; stored in `feedback_submissions` DB table
- **API endpoints**: `POST /api/help/contact`, `POST /api/help/feedback`, `GET /api/help/messages` (admin), `PATCH /api/help/messages/{type}/{id}/read` (admin)
- **Admin Messages tab** in Operations Center — shows all contact messages and feedback with unread indicators and click-to-expand; auto-marks read on expand

## PDF Export Architecture

- **Server-side**: `pdfkit` generates A4 PDFs with A.IDO branding (plum header, color-coded categories)
- **Endpoints**: `POST /api/pdf/timeline` and `POST /api/pdf/vendor-email`
- **Frontend**: download buttons trigger `fetch()` with `credentials: "include"` and save the blob

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
