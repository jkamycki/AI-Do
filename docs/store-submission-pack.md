# A.I. DO Store Submission Pack

Generated from `docs/release-manifest.json`.

## Final Checks

- Run `corepack pnpm run check:store` before uploading store assets.
- Run `corepack pnpm run check:launch:auth` after production auth is refreshed.
- Run `corepack pnpm run check:complete:strict` to confirm the release is ready to submit.

## Destinations

- Canonical website: https://aidowedding.net
- Production API: https://ai-do.onrender.com
- Google Play production build: `corepack pnpm --dir mobile/app run build:android:store`
- Local Android AAB preflight: `mobile/app/android/app/build/outputs/bundle/release/app-release.aab`
- iOS build command: `corepack pnpm --dir mobile/app run build:ios`

## Artifact Sources

- The GitHub `release-collateral` artifact contains docs, store copy, screenshots, and icons.
- Android APK/AAB files are local build outputs for install and packaging preflight.
- Use the EAS production Android build artifact for Google Play upload. Do not upload the local Gradle AAB unless it was signed with the production upload key.

## Post-Submission Signoff

- These signoffs are for handoff tracking after the ready-to-submit completion score reaches 100%.
- After the production auth GitHub secret is updated, run `corepack pnpm run release:signoff:mark -- github`.
- After Google Play accepts the Android upload, run `corepack pnpm run release:signoff:mark -- android`.
- After App Store Connect submission is complete, run `corepack pnpm run release:signoff:mark -- ios`.
- Add `--dry-run` to any signoff command to validate evidence without changing `docs/release-signoff.json`.

## Artifacts

### Android Uploads

| Label | Path | Size | SHA-256 |
| --- | --- | ---: | --- |
| Release APK | `mobile/app/android/app/build/outputs/apk/release/app-release.apk` | 33.7 MB | `8aec7ca9b90c3e04b6378914cb4a2eb2d6f8aaad43a3c8948f28f164cc4e2296` |
| Local Android AAB preflight | `mobile/app/android/app/build/outputs/bundle/release/app-release.aab` | 54.4 MB | `bb92a6cad1a158877ad3bd4c84d5bceb7ff0db7ed581d7da8bc2cb7a4795bae3` |

### iOS Screenshots

| Label | Path | Size | SHA-256 |
| --- | --- | ---: | --- |
| 01-dashboard.png | `mobile/app/store/screenshots/iphone/01-dashboard.png` | 522.3 KB | `8dcdcfeef0ac115531fbf277a27efd1e648a4677d6e5b6282ae50ecf841c8260` |
| 02-guests.png | `mobile/app/store/screenshots/iphone/02-guests.png` | 288.4 KB | `f7a101e87bbad90c550ca7f34d1565f7f53593235ee7926bf156ed7ab320c4ef` |
| 03-website-editor.png | `mobile/app/store/screenshots/iphone/03-website-editor.png` | 605.3 KB | `ffcc99976c5747666aff79127ba8de60925dd78748b61d07dc3d2b7323ae4bdc` |
| 04-budget.png | `mobile/app/store/screenshots/iphone/04-budget.png` | 276.4 KB | `93dde7f1e1cbb933de32ed2583914c4fe8b7fef793027905b98f6492043bbdf0` |
| 05-vendors.png | `mobile/app/store/screenshots/iphone/05-vendors.png` | 266.2 KB | `eb9d46f0d41ce61756285a08384ad613568f863f536827e2606484d3443c3bfa` |
| 06-aria.png | `mobile/app/store/screenshots/iphone/06-aria.png` | 41.3 KB | `ce807669c9d9ea01753d3d8c744fc1067c3f756a6686e4e2a680519dc3b51dcf` |

### Store Copy

| Label | Path | Size | SHA-256 |
| --- | --- | ---: | --- |
| Mobile store listing | `mobile/app/STORE_LISTING.md` | 2.0 KB | `ff4d0065130ad711323a02516ac29fa116600ce3bdb4f62c6369633fa6dd4496` |
| Release notes | `docs/release-notes.md` | 1.4 KB | `83ad3c251d5dea99636cdad8dfeb3ebc57a8cf5f64b74aaed6ae36e5c2d520e1` |

### App And Web Icons

| Label | Path | Size | SHA-256 |
| --- | --- | ---: | --- |
| Mobile app icon | `mobile/app/assets/icon.png` | 124.8 KB | `e94e9c12fe6479738cfc1c9b5d012ff9512d6c1981771ec3999d294718502410` |
| Android adaptive foreground | `mobile/app/assets/android-icon-foreground.png` | 226.9 KB | `f6d8ce6e7c2c672853ca6ceac4090170cd3413a40ecc78de59b805757b1e6508` |
| Android adaptive background | `mobile/app/assets/android-icon-background.png` | 111.1 KB | `95905ab402b3e14b3fbe285dcbc416b22b7e4ad31472fce46e3ac032e4f6745a` |
| Android adaptive monochrome | `mobile/app/assets/android-icon-monochrome.png` | 35.6 KB | `6e3af1cba00c54c8503e0a6698be57d05a9393bb4ded69ecb3a95a8afb52aa88` |
| Website PWA icon 192 | `artifacts/aido/public/web-app-icon-192.png` | 11.8 KB | `73f5fcb563f29c5dcf5881b159455a2bf1b14e56bd74c90aebd0e43a14eb08cb` |
| Website PWA icon 512 | `artifacts/aido/public/web-app-icon-512.png` | 41.7 KB | `42e42ce37ce5724141bc6236ae98fb81d6fa798241a875b770b97e85fbb97717` |
| Website manifest | `artifacts/aido/public/site.webmanifest` | 608 B | `40815259cbd259b56f37923bb0d2345cd9b81ef3f80a50cb3e8daea0a341c033` |

### Website Launch Screenshots

| Label | Path | Size | SHA-256 |
| --- | --- | ---: | --- |
| 01-home-desktop.png | `marketing/release-screenshots/web/01-home-desktop.png` | 955.6 KB | `38de4252b34787101b3dd08bef91a882140bc9e3dc5544271843bd977cedd9af` |
| 02-website-builder-desktop.png | `marketing/release-screenshots/web/02-website-builder-desktop.png` | 153.0 KB | `ccc7f6e2bdc0d67e1ba49e7dd4949a6e318d3a4902ab96cead61e94711b8ad6d` |
| 03-photo-qr-desktop.png | `marketing/release-screenshots/web/03-photo-qr-desktop.png` | 156.0 KB | `a86e4f1c309f29134080d83e6a39360788a7cc85f1688e009a83430efecc7783` |
| 04-vendors-desktop.png | `marketing/release-screenshots/web/04-vendors-desktop.png` | 675.2 KB | `f20471d900afed470c5807440078723aa347f56ae8e014ecceffa4ec25aab1ac` |
