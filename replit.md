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

## Application Features

1. **Wedding Profile** — Store couple names, date, venue, guest count, budget, vibe
2. **AI Timeline Generator** — Minute-by-minute wedding day schedule + PDF export
3. **AI Vendor Email Assistant** — Draft professional vendor emails with AI + PDF export
4. **AI Budget Manager** — Track expenses + AI cost predictions by location
5. **AI Checklist System** — Month-by-month planning tasks personalized by AI
6. **Day-Of Coordinator Mode** — Emergency AI helper for the wedding day
7. **Smart Vendor Sync** — Full CRUD vendor management (scoped by userId, not profileId)
8. **PDF Export** — Server-side pdfkit generation with branded A.IDO layout for timeline + vendor emails
9. **Operations Center** — Admin analytics dashboard with User Metrics, Product Usage, Money Metrics, System Health, and Event Log

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
