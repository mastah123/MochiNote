# Changelog

All notable changes to MochiNote, newest first. Versions up to 38.0.0 were numbered one major per release (v1 … v38);
from 38.1.0 on the project follows semantic versioning: `fix:` patch, `feat:` minor, `feat!:` major.
Commit messages are in [commit.txt](commit.txt).

| Commit type | Bump | Example | Meaning |
|---|---|---|---|
| `fix:` | patch | 1.0.0 → 1.0.1 | Bug fixes |
| `feat:` | minor | 1.0.0 → 1.1.0 | New features |
| `feat!:` | major | 1.0.0 → 2.0.0 | Breaking changes |

### v38.4.3 — Android Back button
- In the Android app, the hardware Back button closes the menu, a sheet, the editor or search, goes from editing to viewing, and leaves a folder or Settings. It only exits the app from the plain home screen.

### v38.4.2 — Plain "Saved"
- The note's info line says just "Saved" (no time) after saving.

### v38.4.1 — Desktop details like the phone
- The desktop "Show all" button is accent-coloured text without a border, like the phone.
- In the desktop list view the pin icon sits at the bottom right of the row instead of covering the date.

### v38.4.0 — Desktop home like the phone
- Desktop: the sort control and the grid/list toggle are on the right, in the same row as the "Recent notes" title.
- Desktop: folders are smaller, in one compact row (icon, name and count) with a "Folders" title; "Show all" appears only when some folders don't fit and expands the row ("Show less" collapses it).
- Desktop: the "Recent notes" row and the pin above a pinned note's title follow the phone home. Filtered views (folder, tag, Pinned…) keep the sort and toggle on the right without repeating the title.
- The phone home is unchanged.

### v38.3.1 — Caret after Backspace in a list
- After pressing Backspace in a list (for example on an empty last item), the next letters stay at the end of the list instead of jumping to a new line above it. The editor now puts the caret back inside the item when a phone keyboard leaves it on the list itself or at the start of the note.

### v38.3.0 — Menu folders and tags
- The menu shows 4 folder rows; the rest scrolls, with a fixed "Show all" under the list (phone: opens the folders page; desktop: expands the list, then "Show less").
- Tags are limited to 8, with a "Show all" on the right of the Tags header (expands in place, then "Show less").

### v38.2.2 — List caret fixes
- Editing a note from the end of a list puts the cursor inside the last list item, so Enter adds a new item instead of the cursor jumping.
- Enter, then Back, then Edit again, then typing continues in the list instead of jumping to the top.
- On desktop, the format toolbar appearing no longer pushes the end of the note out of view when you start editing.

### v38.2.1 — Docs fix
- README no longer mentions tests (they are not in the zip); version semantics table added.

### v38.2.0 — Docs
- README rewritten for GitHub (short, current feature list); the changelog now lives in this file.
- `commit.txt` and `PROJECT_CONTEXT.md` updated.

### v38.1.0 — Files reorganised, tab title
- Versioning now follows semver (`fix:` patch, `feat:` minor, `feat!:` major); the zip name carries the version.
- CSS moved into `css/` (8 files, same order, same look). JS moved into `js/core`, `js/editor`, `js/app`, with the sanitizer and the icon set in their own files. Behaviour is unchanged.
- The browser tab now shows just **MochiNote** (it used to show "All notes · MochiNote").
- Added `PROJECT_CONTEXT.md` (handoff notes) and `commit.txt`.

### v38.0.0 — Card content is normal text again
- In a card, only the **title** (first line) is bold. The lines you type under it are normal text again — the title's bold is no longer carried over to them (also with phone keyboards).
- Lines that already came out bold in notes made with v36/v37 are kept as they are; select them and press Bold to turn it off.

### v37.0.0 — Lettered lists and edit-where-you-read
- New **lettered list** (a, b, c…) in the list options, between bulleted and indent. It converts to and from numbered/bulleted lists, shows as "a. b." in the home previews and keeps its letters when copied.
- Tapping the **edit icon** keeps your reading position (no scrolling again) and puts the cursor on the line you were reading — or at the end of the note when the end is on screen.

### v36.0.0 — Size, highlight and card colours
- **Size** (and Font, Highlight) now work like Bold/Italic: pick one with the cursor in a line and it applies to what you type next. The buttons light up, and Size shows the number in use (e.g. "20 px").
- **Highlight → None** really removes the highlight, also from part of a highlighted run on the same line, and turning it off at the cursor stops it carrying over to new text.
- A card's **title is bold from the first letter** you type, not only after Enter.
- Each card type has its **own colour** (light and dark mode): note card amber, prompt lilac, link blue, code dark with a green tag.

### v35.0.0 — Typed text always matches the toolbar
- Whatever the Bold / Italic / Underline / Strike buttons show at the cursor is now exactly how the next typed text looks. Before, a style could sneak in from the line above (e.g. Italic coming on after leaving a strikethrough line and choosing Bold).
- Fixed a saving problem where some struck-through text could come back underlined after reopening a note.

### v34.0.0 — Auto-capital no longer breaks formats
- The auto-capitalized first letter of a line or sentence used to lose (or wrongly keep) the format you had just chosen — e.g. after turning strikethrough off and bold on, the first letter stayed struck through. The capital now keeps exactly the format of the word you are typing.

### v33.0.0 — The last format choice wins (phone keyboards)
- Phone keyboards type words in "composing" mode, which made a format you had just turned off (bold, italic, underline, strikethrough) come back as you typed or deleted. Your last choice now wins while you type words, delete letters, press Space or press Enter, until you move the cursor somewhere else.

### v32.0.0 — Formats stay off after deleting
- If you turn a format off (e.g. underline) at the cursor and then delete a letter, the format now stays off — before, deleting brought the underline back for the next letters and the button lit up again. Deleting while a format is on keeps it on. Moving the cursor still clears the choice.

### v31.0.0 — Text formats no longer stick
- Bold / Italic / Underline / Strikethrough pressed at a plain cursor now decide exactly how the next typed letters look, and the button always shows the truth. Before, a new line after italic or underlined text kept the style while the button looked off, so pressing it did the wrong thing.
- Moving the cursor forgets the pending choice. Selected text still toggles on and off as before.

### v30.0.0 — Viewing mode
- Opening an existing note now shows it in **viewing mode**: read-only, no keyboard, and the format buttons and undo/redo are hidden. Code/prompt cards can still be copied and link cards opened.
- A new **edit icon** beside the ⋮ menu switches to editing and brings back the format buttons and undo/redo.
- **Back** while editing returns to viewing mode (your changes are saved); Back again closes the note. The browser/phone back button does the same.
- New notes still open ready to type. Notes in Trash stay view-only.
- Settings → Behavior → "Open notes to read" turns viewing mode off if you prefer to open notes ready to edit.

### v29.0.0 — Line height and auto-capitalization
- New **Line height** drop-down next to Font, Size and Highlight (in px, or Default). It applies to the selected lines (or the line the cursor is in) and is saved with the note.
- **Auto-capitalize**: the first letter of a line or sentence and a lone "i" are capitalized as you type. Code, prompt and link cards, links and #tags are left alone. On by default; switch it off in Settings → Behavior.

### v28.0.0 — Fixes and ordering
- Pressing Enter inside a link card no longer duplicates it; it starts a new line under the card (also works with phone keyboards).
- “+” options are now Image, Link, Card, Prompt, Code.
- List options are now Numbered, Bulleted, Outdent/Indent (nested), Checklist.
- Checklist: rounded square checkbox with a check mark; the drag handle sits inside the row next to the box so it is easy to grab; a bullet or numbered list inside a checklist item no longer picks up checkbox styling; nested checklists get handles and × too.

### v27.0.0 — Code, prompt and link cards
- New **Code** and **Prompt** cards under “+”: a card you type or paste into, with a copy icon in its top-right corner (Enter adds a line inside the card, Enter on an empty last line leaves it, Tab indents).
- A link added from “+ → Link” or a URL pasted on an empty line becomes a **link card** (site name and address; tap the card to open it). A link added over selected text stays an inline link. The app is local-only, so cards don't fetch the page itself.
- Note previews on the home screen show these cards too.
- The zips no longer include the tests folder.

### v26.0.0 — Checklist
- Smaller checkbox, a drag handle on the left to reorder items and an × on the right to remove one.
- Each checklist has a title, a sort button (completed last / first), a done count like 3/6 and a faint progress bar behind that header.
- Works the same on phone and desktop.

### v25.0.0 — Editor basics
- Images fit the note area: they use the available width and a taller height limit, never cropped or stretched (phone and desktop).
- Adding a link inserts it where you were typing (it used to jump back to the first line after the dialog).
- Text sizes are in px (12–40 px).
- A faint line under the title shows word count, when the note was created and its save state.
- The save icon at the top right is hidden while Autosave is on; with Autosave off it appears (dot when there are unsaved changes) and pressing it saves.

### v24.0.0 — Desktop right-click menus, style drop-downs, fixed grid, cleaner About
- Right-clicking a note card or folder on desktop opens the same options as the phone long-press, at the cursor.
- Font, Size and Highlight are drop-down menus: below the button on desktop, popping up above it on phones.
- Desktop grid view uses fixed-size note cards.
- Choosing a size no longer drops a font you already picked.
- The About card is tidier: logo, name and version, tagline, and a short Storage / Built with list.

### v23.0.0 — Alignment is always saved; card previews reverted
- Left / centre / right is written as a style and an `align` attribute from any browser is converted, so alignment is kept when the note is saved and reopened.
- Reverted the v22 card-preview changes (desktop cards keep the plain-text preview again, phone previews do not follow alignment).
- Kept from v22: clear active highlight on format buttons, folder icon on phone grid cards.

### v22.0.0 — Format highlight, card folder icon, same saved formats everywhere
- Format buttons light up clearly while active (bold, italic, align, lists…) and tapping again turns them off; they mix freely.
- Phone grid cards show the folder icon and name.
- Note cards on desktop now show the same rich preview as the phone (bullets, numbers, checklists, headings, left/centre/right alignment), and the phone preview now respects alignment and headings too.

### v21.0.0 — Desktop home polish
- Desktop home now follows the phone: icon-only Sort, a single view-toggle icon, folder icons on folder cards, and an icon instead of the 📁 emoji on note cards.

### v20.0.0 — Desktop format toolbar follows the phone
- The format toolbar (same place under the header) now uses the phone's icon buttons and functions, in two tidy rows: bold / italic / underline / strikethrough, H1-H3, align left / centre / right, font / size / highlight; then bullets, numbers, checklist, outdent / indent, and card / link / image.
- Removed on desktop, like on the phone: the Paragraph dropdown (H1-H3 replace it), the Sticker button, the toolbar's own Undo / Redo (they are in the header), and the note footer.
- Tapping a heading button again goes back to normal text; aligned list lines keep their bullet with the text.

### v19.0.0 — Desktop note top bar follows the phone
- Note header (desktop): Back, then small Undo / Redo icons; the save status is now a small icon beside the 3 dots (the centred text "Saved" is gone).
- The "Format" and "Pin" text buttons and the folder / colour row under the title are removed. Pin, Move to folder and the theme colours live in the ⋮ menu, which also shows "Edited …".
- The footer no longer shows "Edited …" (it only appears when a note has tags). The format toolbar keeps its original place and text labels; its Undo / Redo moved up to the header. Layout is otherwise unchanged.

### v18.0.0 — Align and Font/Size/Highlight buttons, aligned-list fix (phone)
- Footer icon row is now **+ / Aa / align / font-size-highlight / list**. **Aa** keeps H1-H3, bold, italic, underline and strikethrough; the new **align** button holds left / centre / right; one **style** button holds font, size and highlight.
- Fix: right-aligning (or centring) a line inside a bullet, numbered or checklist item no longer stretches the row; the bullet, number or checkbox now stays beside its text.

### v17.0.0 — MochiNote logo
- Your logo (sage notebook with the mochi face) is now the app logo: browser-tab icon (`assets/logo.svg` plus a 32px PNG fallback), home-screen icon (`assets/icon-180.png`), and an installable-app manifest (`manifest.webmanifest`, 192 and 512px icons).
- It replaces the placeholder mark in the sidebar header and appears at the top of Settings → About.
- Source artwork: `assets/logo.svg`.

### v16.0.0 — Thinner format row, smaller undo/redo, no Paragraph option (phone)
- The format options row is now a single thin row (about 44px, was up to 140px); extra options scroll sideways instead of stacking.
- The Paragraph dropdown is removed on phones: H1, H2 and H3 buttons cover it (tap the active one again for normal text).
- Undo and Redo are smaller, sit a little further from Back and closer to each other.

### v15.0.0 — Format bar rides above the keyboard, footer removed (phone)
- The + / Aa / list icons are now their own row at the very bottom of the editor, so they sit directly above the keyboard when it is open. The old footer is gone (tags still live in the text as #hashtags and show on cards).
- Choosing a format option no longer closes the keyboard: the note stays focused and you keep typing. The options row opens above the icon row; tap the same icon to close it. Tapping the text leaves it open.
- No extra safe-area space under the icon row.

### v14.0.0 — New note footer (phone)
- Footer now has three icons: **+** (image, link, card), **Aa** (H1, H2, H3, bold, italic, underline, strikethrough, alignment, font, size, highlight) and **list** (bullets, numbers, checklist, indent, outdent). Tapping one opens a short row of options just above the footer (it scrolls instead of growing, so the note keeps its space); tap the same icon again to close, or tap the text to go back to typing.
- "Edited just now" moved into the 3-dot menu; the saving icon now sits beside the 3 dots.
- Aa removed from the top bar; the Sticker option removed from the format options on phones (stickers on cards are still chosen from the card's "+" slot). Desktop toolbar is unchanged.

### v13.0.0 — Settings back icon, no auto keyboard, undo/redo in the note header (phone)
- Settings: the menu icon at the top-left is now a back arrow (returns to where you came from).
- Opening an existing note no longer pops up the keyboard; tap the text to start typing. A brand-new note still focuses the title.
- Note header: Undo and Redo icons sit right of Back. They are removed from the format bar on phones. Desktop is unchanged.

### v12.0.0 — Subfolders removed (phone and desktop)
- Folders are now a single flat level: no "+ Subfolder", no "Add subfolder", no indentation.
- Folders made in earlier versions that were nested are moved to the top level automatically; their notes stay in them, so nothing is lost.
- Importing a backup does the same for any nested folders it contains.

### v11.0.0 — Card icon with optional stickers, snug image frames (phone and desktop)
- **Card button:** the 💡 option is now a card icon (and a "Card" label on desktop); the lightbulb is gone. The Card button is available on desktop too.
- **Stickers are optional:** a new card starts with no sticker, only a faint dashed "+" slot. Tap the slot (or the sticker) to open the sticker picker: choose one of 28, type or paste your own, or pick "No sticker". The sticker shows on the card, in the home preview and when you copy the text. Existing cards simply lose the bulb.
- **Sticker button in the format bar:** inserts a sticker (or any emoji you type) at the caret, anywhere in a note.
- **Images:** the frame around a picture now hugs the picture (same shape as the image, no empty bars) and the picture is centred. Pictures are scaled down into a fixed box (200px tall on phones, 300px on desktop, narrower on desktop) and keep their shape.
- **Adding an image adds a new line under it,** with the caret there, so you can keep typing below the picture.
- Tests: new `tests/e2e-batch14.js`; older suites updated for the new card and image behaviour.

### v10.0.0 — Typing with the keyboard and format bar (mobile only)
- **Header stays put:** the note editor now always matches the visible screen area, so the top bar no longer scrolls out of view when the keyboard opens on a long note. (The page also asks the browser to resize for the keyboard.)
- **Format bar acts like a keyboard:** when it opens or closes, and as you type or press Enter, the line you are on scrolls up so it stays visible above the bar or keyboard.
- **About 5 lines of free space** under the last line of a note, so the end of a note is easy to reach, select and type at.
- The note text and title now scroll together in one area (the header, footer and format bar stay fixed).
- Desktop is unchanged.
- Tests: new `tests/e2e-batch13.js` (the keyboard is simulated with a fake visual viewport — please check on a real phone).

### v9.0.0 — Lists: caret in front of items, pasted lists (phone and desktop)
- **Caret before a list item:** press Enter with the caret in front of the first item's number, bullet or checkbox of a list at the top of a note and a normal line opens above it — the list stays exactly as it was (numbers keep 1-2-3). Arrow Up from the first item does the same, so there is always a way to type above a list. In front of any other item, Enter adds an empty item and keeps one list. Enter on an empty item still leaves the list.
- **Pasted lists become real lists:** pasted lines starting with `- `, `* `, `•`, `1.` / `1)`, `☐ ☑`, `[ ]`, `[x]` are turned into bulleted, numbered or checklist items (2+ lines in a row; a single line only on an empty line). Works for plain text and for HTML pasted from other apps whose lists arrive as plain paragraphs; real HTML lists are kept as they are. Lines that are not list items stay normal text. A numbered list pasted from "3." keeps its numbers. Undo takes a paste back out.
- Nested lists copied from MochiNote paste back flat (indentation is not rebuilt).
- Tests: new `tests/e2e-batch12.js`.

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
