# A.IDO Mobile WebView Apps

This folder contains native WebView wrappers for `https://aidowedding.net`.

- `ios/AIDOWedding.xcodeproj` opens in Xcode.
- `android` opens in Android Studio.

Both apps keep A.IDO navigation inside the WebView and open external links in the device browser. They support JavaScript, cookies, localStorage/session storage, login persistence, pull-to-refresh, a loading spinner, back navigation, offline retry UI, native splash screens, file upload, camera capture, and photo/file picking.

## iOS: Open in Xcode

1. Use a Mac with Xcode installed.
2. Copy or pull this repo onto the Mac.
3. Open `mobile/ios/AIDOWedding.xcodeproj`.
4. In Xcode, select the `AIDOWedding` project, then the `AIDOWedding` target.
5. Go to `Signing & Capabilities`.
6. Set `Team` to your Apple ID team.
7. If Xcode asks, change the Bundle Identifier to something unique, for example `net.aidowedding.app.kamyc`.

## iOS: Run on your iPhone with a free Apple ID

1. Connect your iPhone to the Mac with USB.
2. Unlock the iPhone and trust the Mac if prompted.
3. In Xcode, choose your iPhone as the run destination.
4. Click the Run button.
5. If the iPhone blocks the app the first time, open iPhone `Settings > General > VPN & Device Management`, trust your Apple ID developer profile, then run again.

Free Apple ID installs are private and usually expire after 7 days. You can reinstall from Xcode when needed.

## Android: Open in Android Studio

1. Open Android Studio.
2. Choose `Open`.
3. Select the `mobile/android` folder.
4. Let Gradle sync finish.
5. Connect your Android phone with USB debugging enabled, or start an emulator.
6. Press Run to install the debug app.

## Android: Build an APK

1. In Android Studio, open `Build > Build Bundle(s) / APK(s) > Build APK(s)`.
2. When it finishes, click `locate`.
3. The APK will be under `mobile/android/app/build/outputs/apk/debug/app-debug.apk`.
4. Transfer it to your Android phone or install it with:

```powershell
adb install -r mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

If Android blocks the APK, allow installs from the source you are using, then try again.

## Private testing without app stores

- iPhone: install directly from Xcode onto your device.
- Android: install from Android Studio, or sideload the debug APK.
- You do not need App Store Connect, Play Console, TestFlight, or Play Store internal testing for private device testing.

## Before publishing later

Replace the default icons, choose final bundle IDs/application IDs, add store screenshots, and review Apple/Google WebView policy requirements.
