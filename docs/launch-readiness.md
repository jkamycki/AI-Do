# A.I. DO Launch Readiness

See `docs/release-handoff.md` for the final deploy and store-submission order.
See `docs/mobile-preview.md` for previewing the actual mobile app package in a browser.
GitHub Actions also prints `check:launch:status` and `check:complete` in the Readiness workflow.
The Readiness workflow uploads a `release-collateral` artifact with the completion report, completion summary, manifest, store pack, store copy, release notes, and screenshots.

## Website

- Run `corepack pnpm run doctor:release` for combined launch, completion, mobile-preview, and production-auth status.
- Run `corepack pnpm run check:accounts` to see the GitHub and EAS logins needed for final account-gated commands.
- Run `corepack pnpm run check:launch:status` for a quick readout of ready assets and remaining manual account steps.
- Run `corepack pnpm run check:complete` for the full ready-to-submit completion dashboard.
- Run `corepack pnpm run release:completion-report` to write the same status to `docs/release-completion-report.json`.
- Run `corepack pnpm run release:completion-summary` to write JSON and Markdown completion status for release handoff.
- Run `corepack pnpm run check:completion-artifacts` to confirm the generated completion report and summary are current.
- Run `corepack pnpm run release:signoff:init` if you want a separate post-submission signoff tracker.
- Run `corepack pnpm run release:signoff:mark -- <github|android|ios>` after the matching account or store action is complete.
- Run `corepack pnpm run auth:production:set-github-secret` after `gh auth login` to update `AIDO_AUTH_STATE_BASE64` without printing the secret.
- Run `corepack pnpm --dir mobile/app exec eas login` before EAS Android/iOS production store builds.
- Run `corepack pnpm run check:launch` for the full local launch gate that does not require signed-in production auth.
- Run `corepack pnpm run check:launch:auth` after refreshing production auth to include signed-in production smoke.
- Run `corepack pnpm run check:parity` to compare website/app behavior locally on desktop and mobile.
- Run `corepack pnpm run check:all` before shipping website changes.
- Run `corepack pnpm run check:production` after deployment to confirm the public site is reachable.
- Run `corepack pnpm run check:production:auth` after refreshing `.auth/user.json` against `https://aidowedding.net`.

## Mobile App

- Run `corepack pnpm run build:android:release-apk` when you need a direct-install Android APK.
- Run `corepack pnpm run build:android:store-aab` when you need the local Android AAB preflight.
- Run `corepack pnpm run check:android:store` before starting the Google Play production build.
- Run `corepack pnpm --dir mobile/app run build:android:store` after `eas login` to create the EAS production Android artifact for Google Play.
- Run `corepack pnpm run check:ios:store` before starting an EAS iOS production build.
- Run `corepack pnpm run check:store` before submitting mobile store assets.
- Run `corepack pnpm run release:store-pack` after refreshing the release manifest.

## Current Release Outputs

- Android APK: `mobile/app/android/app/build/outputs/apk/release/app-release.apk`
- Local Android AAB preflight: `mobile/app/android/app/build/outputs/bundle/release/app-release.aab`
- iPhone screenshots: `mobile/app/store/screenshots/iphone/`
- Website screenshots: `marketing/release-screenshots/web/`
- Release manifest: `docs/release-manifest.json`
- Completion report: `docs/release-completion-report.json`
- Completion summary: `docs/release-completion-summary.md`
- Store submission pack: `docs/store-submission-pack.md`
- Post-submission signoff template: `docs/release-signoff.example.json`
- Post-submission signoff file: `docs/release-signoff.json`

## Android Build

Run the production Android build through EAS from `mobile/app` after signing into Expo. Use the EAS artifact for Google Play upload; the local Gradle AAB is only a packaging preflight unless a production upload keystore is configured locally.

```powershell
corepack pnpm --dir mobile/app run build:android:store
```

## iOS Build

Run the production iOS build through EAS from `mobile/app` after signing into Expo and connecting the Apple developer account:

```powershell
corepack pnpm --dir mobile/app run build:ios
```

## Remaining Manual Step

Refresh production auth state before running signed-in production smoke tests:

```powershell
corepack pnpm run auth:production:refresh
```
