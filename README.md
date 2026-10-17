# MochiNote

**Version 8.0.0**

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
tests/            logic.test.js (Node), e2e*.js (Playwright)
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

### v8.0.0 — One icon set, single grid/list icon, note colours, editable "Your space"
- **Icons:** the menu (All notes, Pinned, Archive, Trash, Settings), sidebar folders, back and more (⋮) buttons, the search icon, the ⋮ menu items and the long-press menus all use the same line icons as the home screen — phone and desktop. The pin mark on cards is the same icon everywhere.
- **Grid/list (phone):** one icon that shows the view you would switch to; tap it to switch. Folders and notes keep their own toggle.
- **Menu:** the Close button is removed (tap outside, or use the phone Back button).
- **Note colours on home cards:** cards show their note's colour in every theme. On phones the colour (Theme) is picked from the ⋮ menu inside a note (desktop keeps the swatch row).
- **"Your space" card:** has an edit (pencil) button, and long-pressing it opens a popup with Edit / Reset to default. The title and subtitle are saved in your preferences; leaving a field empty restores the default.
- Tests: new `tests/e2e-batch11.js`; older suites updated for the removed close button and the new icons.

### v7.0.0 — Long-press menus pop up from the pressed item (mobile only)
- Long-pressing a note, folder or sidebar folder now opens a small popup menu **next to the pressed item** instead of a bottom sheet. It opens below the item when there is room, otherwise above, and lines up with the item's left or right edge. It always stays on screen and pops out from the item.
- The pressed item is highlighted while the menu is open. Tapping outside, Esc or the phone Back button closes it. The menu choices are unchanged.
- Tests: new `tests/e2e-batch10.js`.

### v6.0.0 — Editor: no sideways scroll, checklist fix, fixed image size (phone and desktop)
- **No horizontal overflow in notes:** the header stays fixed on top and the note area only scrolls up and down. Long words, links and images are wrapped or clipped instead of pushing the page sideways.
- **Checklist fixed:** items no longer use a flex layout, which split bold/italic text into separate columns and made rows jump. Each item is now a normal text row with the circle placed beside it, so mixed formatting, wrapping and empty items stay stable. Tapping the circle still ticks it.
- **Images have a fixed display size:** 200px tall on phones, 300px tall (up to 460px wide) on desktop. The whole picture is shown (not cropped) and every image takes the same space.
- Tests: new `tests/e2e-batch9.js`.

### v5.0.0 — Simpler controls (phone and desktop)
- **Pinned notes are always first**, in every sort order. The "Pinned first" checkbox is removed.
- **"Last 7 days" filter removed.**
- **"No folder" removed from the menu.** It is still a choice when you move a note ("Move to…"), and deleting a folder still leaves its notes unfiled.
- Tests: new `tests/e2e-batch7.js`; older suites updated for the removed controls.

### v4.0.0 — New mobile home (mobile only; desktop unchanged)
- **Fixed top bar:** menu icon on the left, search icon on the right. "All notes" is gone from home. Tap the search icon to open the search field (✕ or Esc closes and restores the home).
- **"Your space" card** at the top of home.
- **Folders section:** shows 2 folders (grid) or 4 (list, 2 columns × 2 rows). **Show all** sits right of the "Folders" label and opens a separate Folders page listing every folder (Back arrow or phone Back returns home).
- **Independent views:** folders and notes each have their own grid/list toggle; the folder choice is remembered.
- **Recent notes row:** sort and grid/list are icon only and stay pinned under the fixed header, so only folders and notes scroll.
- **Fixed-size note cards:** 2 columns in grid view, fixed-height rows in list view; long words and tags are clipped so nothing overflows or scrolls sideways. Pinned cards show a pin icon.
- "Pinned first" and "Last 7 days" were hidden on phones (fully removed in v5.0.0).
- Tests: new `tests/e2e-batch6.js`.

### v3.0.0 — Bottom format bar, 💡 callout cards, copy keeps numbering (mobile only)

**Mobile (≤ 899px)**
- **Format bar moved to the bottom** (just above the footer) with a **✕ close button** and clean line icons
  (undo, redo, bullets, numbering, checklist, alignment, link, image). Every control is at least 44px and wraps instead of scrolling off screen.
- **Opening Format hides the on-screen keyboard** so the bar can take its place. Format buttons still act on the text you selected.
  Closing the bar (✕ or Aa), or tapping into the text or title, brings the keyboard back. This works by setting `inputmode="none"` on the
  note while the bar is open, so it needs no extra libraries.
- **💡 Callout card** as a Format option (the lightbulb button). Tap it to turn the current line(s) into an editable rounded card;
  tap it again to turn it back into normal text. Press Enter inside to add lines (the first line of a multi-line card is the bold title) and
  press Enter on an empty last line to leave the card. Cards show with 💡 in the note list previews and render the same on desktop.
- **Copy / cut keeps list numbering**: select-all (or any selection) and copy now produces plain text with `1. 2. 3.`, `•` bullets and
  `☐ / ☑` checkboxes (nested lists are indented, callouts start with 💡) plus the rich HTML version. Partial selections keep the real item numbers.

**Desktop (≥ 900px)** — unchanged: toolbar on top with text labels, no callout button, normal browser copy. Callouts made on mobile still display correctly.

**Under the hood**
- New `tests/e2e-batch4.js` (40 checks, mobile + desktop). The older browser tests reopen the format bar before using it,
  because on phones it now closes when you tap into the text.

### v2.0.0 — Long-press menus and richer cards (mobile only)

**Mobile (≤ 899px)**
- **Long-press a note card** to open a bottom action sheet: Pin / Unpin, Move to folder…, Archive / Unarchive, Move to Trash.
  In Trash the sheet offers Restore and Delete forever. A normal tap still opens the note.
- **Long-press a folder** (on the home folder cards or in the menu list) to Rename, Add subfolder or Delete it.
  The existing inline folder buttons in the menu are still there.
- The sheet closes with a tap outside it, Esc, or the phone's Back button (Back only closes the sheet, it never leaves the app).
  Dragging your finger before the press finishes cancels it, so scrolling never triggers a menu.
- **Note cards now show real structure**: bullets (•), numbering (1. 2. 3.) and checklists (○ / ● with struck-through done items)
  instead of flattening everything to one run of text. Cards show the first four lines plus "…".
- New note button stays fixed and floating (unchanged, covered by tests).

**Desktop (≥ 900px)** — unchanged: plain-text card previews, no long-press menus.

**Under the hood**
- New `tests/e2e-batch3.js` (44 checks, mobile + desktop). Version shown in Settings → About is now 2.0.0.

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
