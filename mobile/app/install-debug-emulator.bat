@echo off
set "ANDROID_HOME=C:\Users\Kamyc\AppData\Local\Android\Sdk"
set "PATH=%ANDROID_HOME%\platform-tools;%PATH%"

echo This will replace the old A.I Do emulator app with the Expo app.
echo It only removes app data inside the Android emulator.
choice /C YN /M "Continue"
if errorlevel 2 exit /b 1

adb uninstall net.aidowedding.app
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
adb shell am force-stop net.aidowedding.app
adb shell monkey -p net.aidowedding.app -c android.intent.category.LAUNCHER 1
