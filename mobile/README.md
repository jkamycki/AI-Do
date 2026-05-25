# A.I Do Native Mobile Shell

This folder contains native iOS and Android WebView wrappers for `https://aidowedding.net`.

## Structure

- `android/` - Android Studio project.
- `ios/` - Xcode project.
- `assets/` - Shared logo, splash, and app icon source assets.

## Design

- Primary blush: `#F7DDE2`
- Accent gold: `#D4A373`
- Native white top bar with blush bottom accent line.
- Native rounded bottom tab bar with soft shadow.
- Center floating gold/blush `+` action.
- White splash screen with centered A.I Do logo and fade transition.

## Navigation

Both apps keep one persistent WebView instance alive. Bottom tab taps navigate that WebView only when the selected destination is different from the current URL, so selecting the active tab does not reload the page.

Default destinations:

- Home: `https://aidowedding.net/`
- Vendors: `https://aidowedding.net/vendors`
- Add: `https://aidowedding.net/aria`
- Checklist: `https://aidowedding.net/checklist`
- More: `https://aidowedding.net/settings`

External links whose host is not `aidowedding.net` or a subdomain open in the device browser.

## Android Build

1. Open `mobile/android` in Android Studio.
2. Let Android Studio sync Gradle.
3. Choose a device or emulator.
4. Run the `app` configuration.

Command-line build, if Android SDK and Gradle are installed:

```powershell
cd C:\Users\Kamyc\Documents\AI-Do\mobile\android
gradle assembleDebug
```

## iOS Build

1. Open `mobile/ios/AIDoWedding.xcodeproj` in Xcode on macOS.
2. Select the `AIDoWedding` scheme.
3. Choose an iPhone simulator or signing team/device.
4. Build and run.

The iOS project is native Swift/UIKit and requires iOS 15 or newer.

## Store Polish Before Release

The included logo assets are wired into both projects. Before App Store or Play Store submission, export final app icon sizes from `assets/app-icon-source.png` using your preferred icon pipeline so every store-required size is pixel-perfect.
