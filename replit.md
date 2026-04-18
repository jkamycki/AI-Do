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
2. **AI Timeline Generator** — Minute-by-minute wedding day schedule
3. **AI Vendor Email Assistant** — Draft professional vendor emails with AI
4. **AI Budget Manager** — Track expenses + AI cost predictions by location
5. **AI Checklist System** — Month-by-month planning tasks personalized by AI
6. **Day-Of Coordinator Mode** — Emergency AI helper for the wedding day

## Authentication Architecture

- **Clerk** handles user identity (email/password + Google OAuth)
- `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` auto-provisioned
- API server uses `@clerk/express` + `clerkMiddleware()` + `requireAuth` middleware
- All API routes require authentication via `requireAuth` middleware
- Frontend wraps app with `<ClerkProvider>` and uses `setAuthTokenGetter` to pass Bearer tokens
- Each user's data is scoped via `userId` column on `wedding_profiles` table
- Other tables (`timelines`, `budgets`, `budget_items`, `checklist_items`) scope via `profile_id` FK

## Routing Structure (Frontend)

- `/` — Public landing page (or redirect to /dashboard if signed in)
- `/sign-in` — Clerk-branded sign-in page
- `/sign-up` — Clerk-branded sign-up page
- `/dashboard` — Main app (protected)
- `/profile`, `/timeline`, `/budget`, `/checklist`, `/vendor-email`, `/day-of` — All protected

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
