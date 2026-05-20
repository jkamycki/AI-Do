# Render API Deploy

Use these settings for the `AI-Do` web service:

- Root Directory: leave blank
- Build Command: `npm run render:build`
- Start Command: `npm run render:start`
- Health Check Path: `/api/healthz`
- Node version: `20`

The root Render scripts build and start only the API service. They use npm
directly and install the API package from `artifacts/api-server`, so the deploy
does not depend on pnpm being preinstalled in Render's environment.
