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

- **Frontend**: `pnpm run dev` (runs Vite on port 5173, proxies nothing—talks to backend directly)
- **Backend**: `pnpm --filter @workspace/api-server run dev` (builds with esbuild then starts on PORT env)
- The backend **requires** `DATABASE_URL` (PostgreSQL) to start. Without it, it crashes at module load.
- The backend also requires `PORT` env var (default 10000 for dev).

### Key environment variables

Backend (`artifacts/api-server/.env`): `PORT`, `NODE_ENV`, `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `OPENAI_API_KEY`, `FRONTEND_URL`

Frontend (`artifacts/aido/.env`): `VITE_API_URL` (backend URL), `VITE_CLERK_PUBLISHABLE_KEY`

### Commands

- `pnpm install` — install all workspace dependencies
- `pnpm run dev` — start frontend dev server
- `pnpm --filter @workspace/api-server run dev` — build + start API server
- `pnpm run build` — production build (frontend)
- `pnpm run typecheck` — TypeScript check (has pre-existing errors from unbuilt project references and implicit `any` types)
- `npx prettier --check .` — check formatting (pre-existing warnings in 128+ files)

### Gotchas

- TypeScript `typecheck` currently has pre-existing TS6305 errors (library dist outputs not built from source). These are harmless for development—Vite handles TS resolution at dev time.
- The `.eslintrc.json` uses legacy ESLint format (plugins: security, no-unsanitized). ESLint v9+ won't work; use v8 if needed, but the config may have compatibility issues. Prettier is the reliable lint tool.
- `pnpm-workspace.yaml` enforces `minimumReleaseAge: 1440` (1 day) for supply-chain safety. Don't disable this.
- `onlyBuiltDependencies` in `pnpm-workspace.yaml` allowlists `@swc/core`, `esbuild`, `msw`, `unrs-resolver` for native builds.
- The Vite config conditionally loads Replit plugins only when `REPL_ID` env var is set—safe to ignore in cloud agents.
- API server esbuild bundles everything into a single ESM file with many externals (native modules, AWS SDK, etc.). The build is fast (~400ms).
