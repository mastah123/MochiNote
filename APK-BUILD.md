# Building the MochiNote APK on GitHub (from a phone)

The APK is built by GitHub's servers. Nothing is installed on your phone.

## What is on the `android-apk` branch
- `app/` — the web app (version 39.8.0: `index.html`, `css/`, `js/`, `assets/`, `manifest.webmanifest`)
- `icon/foreground.png` — the cat used for the launcher icon
- `package.json`, `capacitor.config.json`, `.gitignore`
- `.github/workflows/build-apk.yml` — the build

The branch is self-contained: it no longer reads anything from `master`.

## Get the APK
1. Open the **Actions** tab, then the newest run called "Build Android APK".
2. Wait for the green check (about 5 to 10 minutes).
3. Scroll to **Artifacts** and download **MochiNote-apk** (a zip with `app-debug.apk` inside).
4. Unzip it, open the APK, and allow "install from unknown apps" when Android asks.

## Update the app later
Replace the files inside `app/` with the new version's files (`index.html`, `css/`, `js/`, `assets/`, `manifest.webmanifest`) and commit. The push starts a new build.

## Notes
- Debug-signed APK: fine for your own phone, not for the Play Store.
- Each build gets a new debug signing key, so Android will not install it over the previous one. Export a backup first, uninstall the old app, then install the new one.
- Export backup (a download) may not save a file inside the APK yet; that needs a Capacitor file plugin.
