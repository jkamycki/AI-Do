@echo off
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "ANDROID_HOME=C:\Users\Kamyc\AppData\Local\Android\Sdk"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"
set "NODE_ENV=production"
android\gradlew.bat -p android app:assembleRelease -x lint -x test -PreactNativeArchitectures=x86_64
