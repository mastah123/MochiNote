# MochiNote

**Version 1.0.0**

A cute, cozy, mobile-first personal notes app. Plain HTML, CSS and JavaScript — no build step, no
dependencies, no backend. Your notes live **only in your browser** (local-first). There is no cloud sync.

## Run it

IndexedDB and `file://` behave differently between browsers, so serve the folder over HTTP:

```bash
cd mochinote
python3 -m http.server 8080      # or: npx serve .
# open http://localhost:8080
```

It is a static site, so it can also be dropped onto any static host (GitHub Pages, Netlify, etc.).

## Features

- **Notes**: create, edit, pin, archive, restore, move to Trash, restore from Trash, delete forever.
- **One flexible editor**: paragraphs, headings, bullets, numbered lists and interactive checklists in the
  same note; bold / italic / underline / strikethrough; highlight; alignment; font family; font size;
  links; image attachments (resized and stored inside the note); undo / redo; note colours.
- **Organisation**: folders and subfolders (up to 3 levels), notes with no folder, `#hashtags` typed inside
  notes (case-insensitive, with autocomplete), and combined folder + tag filters.
- **Search**: titles, body text, hashtags and folder names, updating as you type. Extra filters for pinned,
  folder, tag and "last 7 days".
- **Views and sorting**: Grid and List views; sort by recently edited, created (newest/oldest), title A–Z / Z–A,
  with an optional "pinned first". View and sort are remembered.
- **Themes**: six pastel / neutral themes, each with light and dark mode; default font and size.
- **Safety**: debounced autosave with a Saving… / Saved indicator, flush on tab hide / close, confirmation before
  destructive actions, Trash, export / import / restore with validation.

### Keyboard shortcuts

`Ctrl/⌘+B / I / U` format · `Ctrl/⌘+Z / Y` undo / redo · `Ctrl/⌘+K` link (in a note) or focus search (in the list) ·
`Ctrl/⌘+Shift+8 / 7 / 9` bullets / numbers / checklist · `Ctrl/⌘+S` save now · `Esc` close editor / menu · `/` focus search.

## File structure

```
index.html        page structure (list, sidebar, editor sheet, dialog)
style.css         theme variables, layout, animations
js/logic.js       pure helpers: tags, search/filter, sorting, import validation (no DOM; unit-tested)
js/db.js          IndexedDB wrapper (notes + folders), with an in-memory fallback
js/editor.js      contenteditable editor, toolbar, checklists, sanitizer, tag suggestions
js/app.js         UI controller: state, rendering, folders, settings, backup
tests/            logic.test.js (Node), e2e.js and e2e-extra.js (Playwright)
```

`logic.js` and `db.js` have no UI dependencies, which keeps the app easy to wrap later as a browser extension
popup or an Android WebView.

## Storage and backup

- Notes and folders are stored in **IndexedDB** (database `little-notes`). Small preferences (theme, mode, view,
  sort, font, autosave, animations) are stored in `localStorage` under `little-notes:prefs`.
- Nothing is uploaded anywhere. **Clearing site data, uninstalling the browser or using a private window will
  delete your notes.** The app asks the browser for persistent storage, but browsers may refuse.
- If IndexedDB is unavailable, the app tells you and falls back to memory (notes last only until the tab closes).
- **Export backup** downloads a JSON file (`app`, `version`, `notes`, `folders`, `settings`). Export regularly.
- **Import (merge)** adds the file's notes alongside yours (IDs are remapped if they clash).
  **Restore (replace all)** replaces everything after a confirmation. Files are validated first: wrong format,
  newer version, damaged notes/folders (skipped and counted), dangling folder references and folder cycles are
  handled; note HTML is re-sanitized on import.
- Images are stored inside the note as data URLs (downscaled to 1280px), so many large images use quota quickly.

## Tests

```bash
node tests/logic.test.js                                   # unit tests, no dependencies
NODE_PATH=<path to playwright> CHROME=<chromium> node tests/e2e.js [screenshot-dir]
NODE_PATH=<path to playwright> CHROME=<chromium> node tests/e2e-extra.js [screenshot-dir]
```

## Known limitations

- Rich text uses the browser's `contenteditable` / `execCommand`, so exact behaviour differs slightly between
  browsers. Tested in Chromium only.
- Hashtags inside links or URLs fragments (`page.com/#top`) are intentionally not tags.
- Folders cannot be dragged; move notes with **More → Move to folder**.
- No cloud sync, accounts or sharing. Move notes between devices with export / import.

## Credits

Built with plain HTML, CSS and JavaScript. No third-party libraries, fonts or image assets are used.

---

## Changelog

### v1.0.0 — Initial release (MochiNote)

**Mobile improvements (≤ 899px)**
- Redesigned editor header: thin 44px fixed row with `←` Back icon, `Aa` format toggle, and `⋮` More menu
- Moved Pin action into the More (`⋮`) menu — cleaner top bar
- Format toolbar hidden by default; tap `Aa` to toggle
- Save status displayed as a small icon (✓ / ⟳ / ●) in the editor footer bottom-left
- Removed folder selector and color swatches from inside the note editor on mobile
- FAB (`+ New note`) sits lower and clear of system navigation bars
- Back button navigates to the previous view (Android/PWA back-gesture compatible)

**Desktop (≥ 900px) — unchanged from original**
- Editor opens as a centred modal card
- Folder selector and color swatches remain in the editor meta row
- Format toolbar visible by default
- Pin button in the editor header

**Renamed: little notes → MochiNote**
- App title, brand name, About section, backup filenames all updated
- Preferences key updated to `mochinote:prefs`

**Bug fixes**
- Rich-text formatting (bold, highlight, font size) now applies reliably — fixed stale selection restore after `execCommand`
- Hashtags on the second line of a note now detected correctly
- Mobile toolbar wraps to multiple rows instead of scrolling off-screen
