# MochiNote — Project Context

Handoff notes for another AI or account. Keep this file short and current; update it with every release.

## Status
- Version **38.1.0** (semver from here on: `fix:` patch, `feat:` minor, `feat!:` major).
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

## Decisions
- No build step, no frameworks, no ES modules.
- Local-first: data stays in the browser; backup = JSON export/import.
- Every version is listed in the README changelog and in Settings → About (`APP_VERSION` in notes-app.js).

## Known issues / limits
- Real phone keyboards, touch dragging and the hardware Back button can't be tested headlessly (only simulated IME via CDP); report problems from a device.
- `execCommand` is deprecated but still the most reliable rich-text option across browsers.
- `rich-text-editor.js` and `notes-app.js` are still large (about 1000 and 900 lines) because they share closure state.

## Tests
- `tests/logic.test.js` (Node) and `tests/e2e*.js` (Playwright, Chromium); 40 suites, about 7 minutes in total. Run with `NODE_PATH` pointing at the global Playwright and `CHROME` set to the Chromium binary.

## Next steps
1. README clean-up for GitHub and a separate CHANGELOG.md with the full history (the changelog is currently inside the README).
2. Keep `commit.txt` updated at the top for every release.
3. Split the two big JS files further if it can be done without changing behaviour.
