# A.IDO

A modern React-based project built with TypeScript, Vite, and Tailwind CSS.

## Prerequisites

- Node.js >= 20
- pnpm (preferred package manager)

## Installation

```bash
pnpm install
```

## Development

```bash
pnpm run dev
```

The development server will start at `http://localhost:5173`

## Building

```bash
pnpm run build
```

The production build will be output to `artifacts/aido/dist/public`

## Type Checking

```bash
pnpm run typecheck
```

## Deployment

This project is configured for deployment on Vercel.

### Vercel Configuration

- **Install Command**: `pnpm install --frozen-lockfile`
- **Build Command**: `pnpm --filter @workspace/aido... run build`
- **Output Directory**: `artifacts/aido/dist/public`
- **Framework**: None (Static SPA with client-side routing)

### Environment Variables

Set the following environment variables in your Vercel project settings:

- `VITE_API_URL` (if needed)
- Other app-specific variables

## Project Structure

```
.
├── artifacts/          # Build artifacts and packages
│   └── aido/          # Main web app
├── lib/               # Shared libraries
├── scripts/           # Build and utility scripts
├── vercel.json        # Vercel configuration
├── pnpm-workspace.yaml # pnpm workspace configuration
└── package.json       # Root workspace package
```

## License

MIT
