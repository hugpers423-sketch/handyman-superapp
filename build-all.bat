@echo off
echo ============================================
echo  HANDYMAN SUPER APP - Build Script
echo  3 APKs + Web Admin
echo ============================================
echo.

REM === 1. Build all web assets ===
echo [1/5] Building all web assets...
cd "C:\Users\ING.VICTOR REYES\Documents\Default Project\handyman-superapp"
call npm run build:all
echo DONE: All web assets built.
echo.

REM === 2. Build Cliente APK ===
echo [2/5] Building CLIENTE APK...
call npx cap sync android --config capacitor.config.client.ts
cd android && call gradlew.bat bundleRelease assembleRelease
echo DONE: Cliente AAB generated at android/app/build/outputs/bundle/release/
echo.
cd ..

REM === 3. Build Operario/Pro APK ===
echo [3/5] Building OPERARIO APK...
call npx cap sync android --config capacitor.config.pro.ts
cd android && call gradlew.bat bundleRelease assembleRelease
echo DONE: Pro AAB generated at android/app/build/outputs/bundle/release/
echo.
cd ..

REM === 4. Build Staff APK ===
echo [4/5] Building STAFF APK...
call npx cap sync android --config capacitor.config.staff.ts
cd android && call gradlew.bat bundleRelease assembleRelease
echo DONE: Staff AAB generated at android/app/build/outputs/bundle/release/
echo.
cd ..

REM === 5. Web Admin ===
echo [5/5] Web Admin ready at dist/admin/
echo ============================================
echo ALL DONE! Find APKs at:
echo   android/app/build/outputs/bundle/release/
echo ============================================
pause