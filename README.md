# MochiNote

A cozy, mobile-first personal notes app. Plain HTML, CSS and JavaScript: no build step, no dependencies, no backend.
Notes live **only in your browser** (IndexedDB). There is no cloud sync.

Current version: **38.4.3** · [Changelog](CHANGELOG.md) · [Project context](PROJECT_CONTEXT.md)

## Run it

Serve the folder over HTTP (IndexedDB behaves differently on `file://`):

```bash
python3 -m http.server 8080     # or: npx serve .
# open http://localhost:8080
```

It is a static site, so it also works on GitHub Pages, Netlify and similar hosts.

## Features

- **Notes**: create, edit, pin, archive, Trash (restore or delete forever), note colours. Notes open in a read-only
  viewing mode; tap the edit icon to type (switchable in Settings).
- **Rich editor**: headings, bold / italic / underline / strikethrough, highlight, font, size and line height (px),
  alignment, bullet / numbered / lettered lists, checklists (title, progress, drag to reorder), links, images,
  undo / redo, auto-capitalization.
- **Cards**: note, prompt, link and code cards with their own colours, optional stickers and a copy button.
- **Organisation**: folders, `#hashtags` with autocomplete, search across titles, text, tags and folders.
- **Views**: grid and list, several sort orders (pinned notes always first), six themes with light and dark mode.
- **Safety**: autosave (optional), confirmations before destructive actions, export / import / restore with validation.
- **Mobile and desktop**: designed for phones first; desktop adds right-click menus, a two-row toolbar and fixed-size cards.

## Project layout

```
index.html                    page structure
css/                          styles, linked in cascade order from index.html (desktop-home.css last)
js/core/notes-logic.js        pure helpers: tags, filtering, sorting, import validation (unit-tested)
js/core/notes-storage.js      IndexedDB wrapper with in-memory fallback
js/editor/html-sanitizer.js   whitelist HTML cleaner
js/editor/rich-text-editor.js contenteditable editor, toolbar, cards, checklists
js/app/icons.js               line-icon set
js/app/notes-app.js           UI controller: state, rendering, folders, settings, backup
assets/                       logo and icons
```

Scripts are plain globals loaded in order (no ES modules), so the app has no build tooling.

## Data and backup

- Notes and folders are stored in IndexedDB; small preferences in `localStorage`.
- Nothing is uploaded. **Clearing site data or using a private window deletes your notes**, so export regularly.
- **Export** downloads a JSON file. **Import** merges it; **Restore** replaces everything after confirmation.
  Files are validated and note HTML is re-sanitized on import.
- Images are stored inside notes as data URLs (downscaled to 1280px).

## Versioning

Semantic versioning, `MAJOR.MINOR.PATCH`:

| Commit type | Bump | Example | Meaning |
|---|---|---|---|
| `fix:` | patch | 1.0.0 → 1.0.1 | Bug fixes |
| `feat:` | minor | 1.0.0 → 1.1.0 | New features |
| `feat!:` | major | 1.0.0 → 2.0.0 | Breaking changes |

## Android app

The `android-apk` branch wraps the web app with Capacitor, and a GitHub Actions workflow builds `app-debug.apk` from the files on `master`. The hardware Back button goes back one screen and only leaves the app from the plain home screen.

## Limitations

- Rich text relies on `contenteditable` / `execCommand`, so behaviour varies slightly between browsers; tested in Chromium.
- No sync, accounts or sharing; move notes between devices with export / import.
