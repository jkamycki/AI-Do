@echo off
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "ANDROID_HOME=C:\Users\Kamyc\AppData\Local\Android\Sdk"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"
android\gradlew.bat -p android app:assembleDebug -x lint -x test -PreactNativeDevServerPort=8081 -PreactNativeArchitectures=x86_64
