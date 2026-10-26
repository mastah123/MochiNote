# Building the MochiNote APK on GitHub (from a phone)

The APK is built by GitHub's servers. Nothing is installed on your phone.

## One-time setup
1. Open the repo on github.com. Tap the branch name (top left), type `android-apk`, choose **Create branch**.
2. With `android-apk` selected, add these files to the **top level** of the branch:
   - `package.json`
   - `capacitor.config.json`
   - `.gitignore`
   - `.github/workflows/build-apk.yml` (use **Add file → Create new file**, type the whole path including the slashes, and paste the contents)
   - `APK-BUILD.md` (optional)
3. Committing a file to `android-apk` starts a build automatically.

## Get the APK
1. Open the **Actions** tab, then the newest run called "Build Android APK".
2. Wait for the green check (about 5 to 10 minutes).
3. Scroll to **Artifacts** and download **MochiNote-apk** (a zip with `app-debug.apk` inside).
4. Unzip it, open the APK, and allow "install from unknown apps" when Android asks.

## Updating the app later
Copy the changed web files (`index.html`, `css/`, `js/`, `assets/`, `manifest.webmanifest`) from `master` into `android-apk`, then commit. A new build starts.

## Notes
- This is a debug-signed APK: fine for your own phone, not for the Play Store.
- The app id is `com.mochinote.app`. Installing a build over an older one keeps your notes only if both builds are signed the same way; debug builds from GitHub use a new key each time, so keep an Export backup before you install a new APK, or uninstall first.
- Export backup (download) may not save a file inside the APK yet; that needs a Capacitor file plugin.
