# MochiNote — Project Context

Handoff notes for another AI or account. Keep this file short and current; update it with every release.

## Status
- Version **39.7.0** (semver from here on: `fix:` patch, `feat:` minor, `feat!:` major).
- Personal notes web app: vanilla HTML/CSS/JS, no build tools, no backend, local-first (IndexedDB, in-memory fallback). Mobile-first; desktop (≥900px) adapts.
- Work arrives as lists of changes; the owner says "Next" to build a batch. One zip per version, named `mochinote-vX.Y.Z.zip`, tests excluded.

## Architecture
- Scripts are plain globals loaded in this order (no ES modules, so it works from file://):
  `js/core/notes-logic.js` (NotesLogic, pure, unit-tested) → `js/core/notes-storage.js` (NotesDB) → `js/editor/html-sanitizer.js` (NotesSanitizer) → `js/editor/rich-text-editor.js` (NotesEditor) → `js/app/icons.js` (NotesIcons) → `js/app/notes-app.js` (IIFE, exposes `window.__mochiNote` with `state` and `render`).
- CSS in `css/`, linked in cascade order from `index.html`; mobile is `max-width: 899px`, desktop `min-width: 900px`. Themes are CSS variables (`data-theme`, `data-mode` on `<html>`).
- Editor: contenteditable + `execCommand`. Typing-style override `ov` (rich-text-editor.js) keeps Bold/Italic/Underline/Strike, size, font and highlight choices at a plain caret, re-applied on input and IME `compositionend`. Auto-capitalize uses `pendingCap`/`capNow`.
- Cards (note/prompt/link/code) are `div.callout`; only the first line (title) is bold, via CSS. `calloutTitle` stops bold carrying into content lines.
- Viewing mode (`state.viewing`) opens notes read-only with an edit icon; pref `openView`.
- Sanitizer whitelists tags, classes, `data-*` and a fixed set of style rules (e.g. `text-decoration-line`, px `line-height`); lettered lists are `ol type="a"`.

## Android app
- Branch `android-apk` (repo mastah123/MochiNote, default branch `master`) holds package.json, capacitor.config.json and `.github/workflows/build-apk.yml`; the workflow checks out `master` for the web files, builds with Capacitor 6 + Gradle and uploads `MochiNote-apk`. Rebuild with "Re-run all jobs" on the latest run.
- Hardware Back: notes-app.js listens for Capacitor's `backButton` (@capacitor/app), uses history.back() and falls back to applying the step directly.
- Known: Export backup (blob download) may not save a file in the WebView; debug builds get a new signing key each run.

## Decisions
- No build step, no frameworks, no ES modules.
- Local-first: data stays in the browser; backup = JSON export/import.
- Every version is listed in the README changelog and in Settings → About (`APP_VERSION` in notes-app.js).

## Known issues / limits
- Real phone keyboards, touch dragging and the hardware Back button can't be tested headlessly (only simulated IME via CDP); report problems from a device.
- List caret: on a real phone, after Backspace in a list the next letter once landed on a line above the list (video, 2026-10-20). Not reproducible headlessly; `stray()` in rich-text-editor.js puts the caret back into the item it was in. If it still happens, ask for a new video and the exact keyboard.
- `execCommand` is deprecated but still the most reliable rich-text option across browsers.
- `rich-text-editor.js` and `notes-app.js` are still large (about 1000 and 900 lines) because they share closure state.

## Tests
- `tests/logic.test.js` (Node) and `tests/e2e*.js` (Playwright, Chromium); 44 suites, about 7 minutes in total. Run with `NODE_PATH` pointing at the global Playwright and `CHROME` set to the Chromium binary.

## Redesign (branch for the new design)
- v39.0.0 = batch 1: phone Home (header, search, greeting + New Note, 4 tiles, Recent Notes card, banner) and the bottom bar (Home/Notes/Categories/Settings). New view `notes` = the Notes tab; Categories = the folders page.
- Fonts: Poppins in `assets/fonts` (the mockup font is not available offline). Styles: `css/mochi-design.css` (linked last), theme `mochi`.
- v39.1.0 = batch 2: desktop Home (dashboard + right column widgets, new sidebar). `#notesView` has `.nv-main` + `#homeAside`; `data-home=1` on `.main` on both widths; Add Tag stands in for the mockup's "Add Category" (categories are folders).
- v39.2.0 = batch 3: Notes/Categories/Settings/editor restyle (no mockup; derived from Home). Categories page uses `folderTile(..., big)`.
- Next batch: 4 dark mode polish + new logo (logo still the old placeholder).

## Next steps
1. Keep `commit.txt` updated at the top for every release.
2. Split the two big JS files further if it can be done without changing behaviour.
