# Building the MochiNote APK on GitHub (from a phone)

The APK is built by GitHub's servers. Nothing is installed on your phone.

## Files on the `android-apk` branch
- `package.json`
- `capacitor.config.json`
- `.gitignore`
- `.github/workflows/build-apk.yml`

The web app itself is taken from the **master** branch every time the workflow runs, so the copies of `index.html`, `css/`, `js/`, `assets/` and `manifest.webmanifest` on `android-apk` are not used. You can delete them.

## Get the APK
1. Open the **Actions** tab, then the newest run called "Build Android APK".
2. Wait for the green check (about 5 to 10 minutes).
3. Scroll to **Artifacts** and download **MochiNote-apk** (a zip with `app-debug.apk` inside).
4. Unzip it, open the APK, and allow "install from unknown apps" when Android asks.

## After you update the app on master
Open the latest run on the Actions tab and press **Re-run all jobs**. It builds again with the newest files from master. (Or commit any small change to `android-apk`.)

## Notes
- Debug-signed APK: fine for your own phone, not for the Play Store.
- Each build gets a new debug signing key, so Android will not install it over the previous one. Use Export backup if you can, uninstall the old app, then install the new one.
- Export backup (a download) may not save a file inside the APK yet; that needs a Capacitor file plugin.
