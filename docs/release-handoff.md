# A.I. DO Release Handoff

Use this when the repo is ready and the remaining work is account access, deployment, and store submission.

## 1. Local Launch Gate

Run the combined release doctor:

```powershell
corepack pnpm run doctor:release
```

This includes launch status, the completion dashboard, mobile preview status, and production auth status.

Check the short launch status:

```powershell
corepack pnpm run check:launch:status
```

Check the full completion dashboard:

```powershell
corepack pnpm run check:complete
```

Check the exact account logins needed for final account-gated commands:

```powershell
corepack pnpm run check:accounts
```

The same dashboard is printed by the GitHub Actions Readiness workflow so PRs show the current completion percentage.
That workflow also uploads a `release-collateral` artifact with `docs/release-completion-report.json`, `docs/release-completion-summary.md`, `docs/store-submission-pack.md`, `docs/release-manifest.json`, store copy, release notes, and screenshots.

Write the completion dashboard to JSON when sharing handoff status:

```powershell
corepack pnpm run release:completion-report
```

Write JSON plus a Markdown summary for GitHub Actions or release handoff:

```powershell
corepack pnpm run release:completion-summary
```

Check that both generated completion artifacts still match the current release state:

```powershell
corepack pnpm run check:completion-artifacts
```

Run the full non-account launch gate:

```powershell
corepack pnpm run check:launch
```

This verifies the website build, API build, deploy configuration, mobile readiness, website/app parity, Android package outputs, iOS store readiness, release assets, and public production smoke.

Generate the release artifact manifest after refreshing builds or screenshots:

```powershell
corepack pnpm run release:manifest
```

Generate the store submission pack from the manifest:

```powershell
corepack pnpm run release:store-pack
```

Use the generated checksums in:

```text
docs/release-manifest.json
docs/release-completion-report.json
docs/release-completion-summary.md
docs/store-submission-pack.md
```

Initialize the manual signoff file:

```powershell
corepack pnpm run release:signoff:init
```

This uses `docs/release-signoff.example.json` to create `docs/release-signoff.json`.

The completion dashboard counts readiness to submit, not app-store acceptance. After the account and store-portal steps are done, mark the matching post-submission signoff through the guarded command:

```powershell
corepack pnpm run release:signoff:mark -- github
corepack pnpm run release:signoff:mark -- android
corepack pnpm run release:signoff:mark -- ios
```

Each command validates matching local evidence before writing `docs/release-signoff.json`. You can test evidence without changing the file:

```powershell
corepack pnpm run release:signoff:mark -- android --dry-run
```

Then run:

```powershell
corepack pnpm run check:complete:strict
```

The strict completion gate checks that the website and mobile app are ready to submit. The guarded signoff commands separately update `githubAuthSecretUpdated`, `androidStoreSubmitted`, and `iosStoreSubmitted` after those portal actions are complete.

## 2. Production Signed-In Gate

Check whether production auth is already ready:

```powershell
corepack pnpm run doctor:production:auth
```

Refresh production auth:

```powershell
corepack pnpm run auth:production:refresh
```

Log in at `https://aidowedding.net` in the Playwright browser, then close the browser window. After that, run:

```powershell
corepack pnpm run check:launch:auth
```

Update the GitHub Actions auth secret after refreshing production auth:

```powershell
corepack pnpm run auth:production:print-secret
```

Copy the printed value into the GitHub secret named `AIDO_AUTH_STATE_BASE64`. Keep the value private.
If GitHub CLI is logged in for this repo, you can set the secret without printing it:

```powershell
corepack pnpm run auth:production:set-github-secret
```

Run `corepack pnpm run release:signoff:mark -- github` after the secret is updated.
The E2E workflow runs `doctor:production:auth` against the decoded secret before signed-in tests, so stale or wrong-domain auth state fails early.

## 3. Website And API Deployment

- Audit production environment values with `docs/production-env.md`.
- Deploy the frontend to Vercel using the root build command: `pnpm run build`.
- Deploy the API service to Render using `render.yaml`.
- Confirm the canonical website is `https://aidowedding.net`.
- Confirm the API origin is `https://ai-do.onrender.com`.
- Re-run `corepack pnpm run check:production`.
- Re-run `corepack pnpm run check:production:auth`.

## 4. Android Submission

Build or verify the local Android package preflight:

```powershell
corepack pnpm run build:android:store-aab
corepack pnpm run check:android:store
```

This confirms the Android bundle can be produced and that listing assets are ready. The current local Gradle release config signs this AAB with the Android debug keystore, so do not upload the local Gradle AAB to Google Play unless a production upload keystore has been configured locally.

Use the EAS production Android build artifact for Google Play upload:

```powershell
corepack pnpm --dir mobile/app exec eas login
corepack pnpm --dir mobile/app run build:android:store
```

Local preflight artifact:

```text
mobile/app/android/app/build/outputs/bundle/release/app-release.aab
```

Run `corepack pnpm run release:signoff:mark -- android` after Google Play accepts the upload.

Use the listing copy in:

```text
mobile/app/STORE_LISTING.md
```

Use release notes from:

```text
docs/release-notes.md
```

Use artifact checksums from:

```text
docs/release-manifest.json
docs/store-submission-pack.md
```

Use iPhone screenshots in:

```text
mobile/app/store/screenshots/iphone/
```

## 5. iOS Submission

Before starting the iOS build:

```powershell
corepack pnpm run check:ios:store
```

Then run the EAS iOS production build from this repo:

```powershell
corepack pnpm --dir mobile/app exec eas login
corepack pnpm --dir mobile/app run build:ios
```

Submit through EAS/App Store Connect after the Apple developer account is connected.
Run `corepack pnpm run release:signoff:mark -- ios` after the App Store Connect submission is complete.

## 6. Final Smoke

After deployment and before store submission, run:

```powershell
corepack pnpm run check:launch:auth
```

The release is ready to submit when `corepack pnpm run check:complete:strict` passes.
After the store portals accept the Android/iOS builds, use the post-submission signoff commands to record that handoff state.
