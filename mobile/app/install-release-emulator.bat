@echo off
set "ANDROID_HOME=C:\Users\Kamyc\AppData\Local\Android\Sdk"
set "PATH=%ANDROID_HOME%\platform-tools;%PATH%"
adb install -r android\app\build\outputs\apk\release\app-release.apk
adb shell am force-stop net.aidowedding.app
adb shell monkey -p net.aidowedding.app -c android.intent.category.LAUNCHER 1
