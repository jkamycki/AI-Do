# A.I. DO Mobile App Browser Preview

Use this to preview the actual Expo mobile app package in a browser.

## Start Preview

```powershell
corepack pnpm run preview:mobile:web
```

Open:

```text
http://localhost:19006
```

This previews `mobile/app`, not the Vite website at `http://localhost:5173`.

Do not use `http://localhost:5174/sign-in` for the mobile app preview. That is not the Expo mobile app server.

## Smoke Check

Run:

```powershell
corepack pnpm run check:mobile:preview
```

This starts or reuses the Expo web preview, verifies the mobile app sign-in screen, signs in with the local preview email, and verifies the home screen renders in a browser.

## Preview Doctor

Run this if the browser appears stuck on the wrong URL:

```powershell
corepack pnpm run doctor:mobile:preview
```

It reports whether the website dev server, stale `localhost:5174/sign-in` URL, and real Expo mobile preview are reachable.

## What To Expect

- The preview starts on the mobile app sign-in screen.
- The smoke check signs in with `preview@aidowedding.test` for the browser-only local preview.
- The `Use preview account` button is the fastest browser-preview sign-in path.
- The page title should be `A.I DO`.
- The sign-in screen should show the A.I. DO logo, sign-in/sign-up controls, email input, and a browser-preview account button.
- After sign-in, the app should show the mobile home screen with wedding progress and main planning tiles.

## Notes

- This is an Expo web preview of the mobile app source.
- On `localhost`, the browser-preview account button signs into local preview data instead of opening the website auth page.
- Native Android behavior still needs an emulator/device or the release APK.
- Native iOS behavior still needs EAS or Xcode/macOS.
