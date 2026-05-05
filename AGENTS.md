# AGENTS.md

## Cursor Cloud specific instructions

This is a **pnpm monorepo** (pnpm@10.26.1, Node.js >=20) for the A.IDO AI wedding planning platform.

### Workspace structure

| Package | Path | Role |
|---------|------|------|
| `@workspace/aido` | `artifacts/aido` | React SPA frontend (Vite, port 5173) |
| `@workspace/api-server` | `artifacts/api-server` | Express 5 API backend (port 10000) |
| `@workspace/db` | `lib/db` | Drizzle ORM schema + DB client |
| `@workspace/api-client-react` | `lib/api-client-react` | Generated React Query hooks |
| `@workspace/api-zod` | `lib/api-zod` | Generated Zod schemas |
| `@workspace/api-spec` | `lib/api-spec` | OpenAPI spec + Orval codegen |
| `@workspace/object-storage-web` | `lib/object-storage-web` | S3 upload component (Uppy) |

### Running services

- **Frontend**: `pnpm run dev` (runs Vite on port 5173, proxies nothing—talks to backend directly via `VITE_API_URL`)
- **Backend**: `pnpm --filter @workspace/api-server run dev` (builds with esbuild then starts on PORT env)

### Backend startup requirements (all crash at module load if missing)

1. `DATABASE_URL` — PostgreSQL connection string (Neon)
2. `PORT` — server port (use `10000` for dev)
3. `OPENAI_API_KEY` — can be a placeholder like `sk-placeholder` if AI features aren't needed
4. `AI_INTEGRATIONS_OPENAI_BASE_URL` — must be set (use `https://api.openai.com/v1` for placeholder)
5. `AI_INTEGRATIONS_OPENAI_API_KEY` — must be set (use same placeholder as OPENAI_API_KEY)
6. `CLERK_SECRET_KEY` — required for auth
7. `CLERK_PUBLISHABLE_KEY` — required for auth

The OpenAI/AI integration env vars throw at module load time (not at first use), so they must be set even for non-AI features.

### Key environment variables

Backend (`artifacts/api-server/.env`): `PORT`, `NODE_ENV`, `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`, `FRONTEND_URL`

Frontend (`artifacts/aido/.env`): `VITE_API_URL` (backend URL, e.g. `http://localhost:10000`), `VITE_CLERK_PUBLISHABLE_KEY`

### Commands

- `pnpm install` — install all workspace dependencies
- `pnpm run dev` — start frontend dev server
- `pnpm --filter @workspace/api-server run dev` — build + start API server
- `pnpm run build` — production build (frontend)
- `pnpm run typecheck` — TypeScript check (has pre-existing errors from unbuilt project references and implicit `any` types)
- `npx prettier --check .` — check formatting (pre-existing warnings in 128+ files)

### Testing API calls without browser auth

The app uses Clerk production keys which have domain restrictions that prevent localhost sign-in via browser. To test API endpoints:

1. Enable test account: set `ENABLE_TEST_ACCOUNT=true` in backend env
2. Get a sign-in token: `curl -X POST http://localhost:10000/api/auth/test-signin` (returns `{token: "..."}`)
3. For actual Bearer JWT, get a session token from an existing Clerk session via Backend API:
   ```
   curl -X POST "https://api.clerk.com/v1/sessions/<SESSION_ID>/tokens" -H "Authorization: Bearer $CLERK_SECRET_KEY"
   ```
4. Use the JWT: `curl -H "Authorization: Bearer <jwt>" http://localhost:10000/api/vendors`

Note: Clerk session JWTs expire quickly (60s). Always get a fresh one before each request.

### DB schema management

- `pnpm --filter @workspace/db run push` — push schema changes (interactive prompts)
- `pnpm --filter @workspace/db run push-force` — push with `--force` (still may prompt for destructive changes)
- The database is a shared Neon PostgreSQL instance. Schema may already exist; `drizzle push` will only apply diffs.
- If you add columns to the schema and get 500 errors from the API, the DB is likely out of sync. Run `push` or manually `ALTER TABLE`.

### Gotchas

- TypeScript `typecheck` currently has pre-existing TS6305 errors (library dist outputs not built from source). These are harmless for development—Vite handles TS resolution at dev time.
- The `.eslintrc.json` uses legacy ESLint format (plugins: security, no-unsanitized). ESLint v9+ won't work; use v8 if needed, but the config may have compatibility issues. Prettier is the reliable lint tool.
- `pnpm-workspace.yaml` enforces `minimumReleaseAge: 1440` (1 day) for supply-chain safety. Don't disable this.
- `onlyBuiltDependencies` in `pnpm-workspace.yaml` allowlists `@swc/core`, `esbuild`, `msw`, `unrs-resolver` for native builds.
- The Vite config conditionally loads Replit plugins only when `REPL_ID` env var is set—safe to ignore in cloud agents.
- API server esbuild bundles everything into a single ESM file with many externals (native modules, AWS SDK, etc.). The build is fast (~400ms).
- **No Vite proxy**: The frontend does NOT proxy `/api/*` to the backend. The `VITE_API_URL` env var is mandatory for API calls to reach the backend. Without it, requests go to port 5173 and 404.
- **Clerk production keys on localhost**: The Clerk frontend SDK may fail to initialize on localhost with production (`pk_live_`) keys. API testing must use the Backend API token approach (see above).
- **Vendor categories mismatch**: The Aria AI chat uses different category strings than the frontend UI's `VENDOR_CATEGORIES`. Keep these in sync (see `VENDOR_CATEGORIES` in `Vendors.tsx` and `ALLOWED_VENDOR_CATEGORIES` in `aria.ts`).
