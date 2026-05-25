# A.I Do Mobile App

This is the shared Android and iPhone React Native + Expo app for A.I Do.

The app now uses native screens for Home, Vendors, Budget, Checklist, Guests, More, guided setup, Settings, Profile, Mood Board, Timeline, Day Of, Aria, Contracts, Documents, Wedding Party, Seating Chart, Hotels, Invitations, Website Editor, Workspace, Help, and Updates. It uses local sample planning data immediately, then tries the website API paths under `https://aidowedding.net/api/mobile/*` when those endpoints are ready.

Recent app parity work includes:

- Guided setup for new couples with skip options on every step.
- Settings for email reminders, RSVP response email forwarding, Aria memory, theme, data export, and activity log.
- Profile priority chips for Must Have, Nice to Have, and Must Avoid.
- Vendor status switching directly in vendor cards.
- Budget payment date validation before saving payments.
- Day-of coordinator tabs for timeline, ceremony, music, speeches, setup, attire, vendors, and packing.
- Seating chart visual preview with round table layouts and seat lists.
- Device persistence with AsyncStorage so mobile edits survive reloads while the website API sync is being connected.
- Website Portal fallback for advanced website-only workflows while the native app continues to mature.

## See It on the Android Emulator

1. Open Android Studio.
2. Start your Pixel emulator.
3. Open PowerShell or the VS Code terminal.
4. Run the release build once:

```powershell
cd C:\Users\Kamyc\Documents\AI-Do\mobile\app
.\build-release-apk.bat
```

5. Install and open it on the emulator:

```powershell
.\install-release-emulator.bat
```

This is the easiest way to preview the app because it bundles the JavaScript inside the APK and does not need the Metro/Expo dev server.

The release APK is created at:

```text
C:\Users\Kamyc\Documents\AI-Do\mobile\app\android\app\build\outputs\apk\release\app-release.apk
```

## Development Mode

```powershell
cd C:\Users\Kamyc\Documents\AI-Do\mobile\app
npm.cmd start -- --clear
```

Then press `a` in the terminal to open Android.

If the emulator shows a red development-server screen, close the app, stop the terminal with `Ctrl+C`, run the command above again, and press `a`.

To build only the debug APK:

```powershell
.\build-debug-apk.bat
```

## Preview on iPhone

The easiest preview path is Expo Go:

1. Install **Expo Go** from the iPhone App Store.
2. Make sure the iPhone and computer are on the same Wi-Fi.
3. Run:

```powershell
cd C:\Users\Kamyc\Documents\AI-Do\mobile\app
npm.cmd start
```

4. Scan the QR code with the iPhone camera.

## Build for App Stores

For final app-store builds, use EAS Build. First log in:

```powershell
cd C:\Users\Kamyc\Documents\AI-Do\mobile\app
npx.cmd eas login
```

Build an Android APK you can install and test:

```powershell
npm.cmd run build:android:apk
```

Build the Android App Bundle for Google Play:

```powershell
npm.cmd run build:android:store
```

Build the iPhone app:

```powershell
npm.cmd run build:ios
```

Build both store versions:

```powershell
npm.cmd run build:all
```

iOS App Store publishing requires an Apple Developer account. Google Play publishing requires a Google Play Console developer account.

## Project Structure

```text
App.tsx
src/api/client.ts
src/components/
src/data/sampleData.ts
src/navigation/RootNavigator.tsx
src/screens/
src/state/PlanningDataContext.tsx
src/theme.tsx
assets/fonts/
assets/icon.png
```
