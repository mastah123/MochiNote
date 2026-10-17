/* app.js — UI controller: state, rendering, folders, tags, settings, backup. */
(function () {
  'use strict';
  const L = NotesLogic;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const APP_VERSION = '23.0.0';
  const PREFS_KEY = 'mochinote:prefs';
  const DEFAULT_PREFS = { theme: 'cream', mode: 'light', view: 'grid', sort: 'edited', heroTitle: 'A little bit of everything ☁️', heroSub: 'Ideas, reminders & random thoughts.', folderView: 'grid', fontFamily: '', fontSize: 16, autosave: true, motion: 'on', lastBackup: 0 };
  const THEMES = [['cream', '#f3dfb7', 'Cream'], ['blush', '#f6d9de', 'Blush'], ['sage', '#d3e4cf', 'Sage'], ['sky', '#d3e4f2', 'Sky'], ['lilac', '#e2d8f1', 'Lilac'], ['stone', '#dedbd5', 'Stone']];
  const FONTS = [['', 'Default (sans)'], ['Georgia, serif', 'Serif'], ["'Courier New', monospace", 'Mono'], ["'Comic Sans MS', 'Trebuchet MS', cursive", 'Playful']];
  const COLOR_VAR = { default: '--c-default', yellow: '--c-yellow', green: '--c-green', blue: '--c-blue', pink: '--c-pink', lilac: '--c-lilac' };

  const state = {
    notes: [], folders: [], prefs: Object.assign({}, DEFAULT_PREFS),
    view: 'all', folderId: null, tag: null, query: '',
    openId: null, dirty: false, saveTimer: null, saving: Promise.resolve()
  };

  /* ---------- preferences (localStorage, with fallback) ---------- */
  function loadPrefs() {
    try { const raw = localStorage.getItem(PREFS_KEY); if (raw) Object.assign(state.prefs, JSON.parse(raw)); } catch (_) {}
    const p = state.prefs;
    if (!L.SORTS.includes(p.sort)) p.sort = 'edited';
    if (p.view !== 'grid' && p.view !== 'list') p.view = 'grid';
    if (p.folderView !== 'grid' && p.folderView !== 'list') p.folderView = 'grid';
    p.fontSize = Math.min(28, Math.max(12, Number(p.fontSize) || 16));
  }
  function savePrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify(state.prefs)); } catch (_) {} }
  function applyPrefs() {
    const p = state.prefs, h = document.documentElement;
    h.dataset.theme = p.theme; h.dataset.mode = p.mode; h.dataset.motion = p.motion;
    h.style.setProperty('--editor-size', p.fontSize + 'px');
    h.style.setProperty('--editor-font', p.fontFamily || 'var(--font)');
    const meta = $('meta[name=theme-color]');
    if (meta) meta.content = getComputedStyle(h).getPropertyValue('--bg').trim() || '#f8f1e7';
  }
  function setPref(k, v) { state.prefs[k] = v; savePrefs(); applyPrefs(); }

  /* ---------- helpers ---------- */
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v === false || v == null) return;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    });
    kids.flat().forEach(k => { if (k != null) n.append(k.nodeType ? k : document.createTextNode(k)); });
    return n;
  }
  const ICONS = {
    pin: '<svg class="pm-ico" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>',
    folder: '<svg class="f-ico" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>'
  };
  // one line-icon set (24px grid, 1.9 stroke, round caps) used by the menu, settings, sheets, back and more buttons
  const IPATHS = {
    all: '<path d="M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M9 9h6M9 13h6M9 17h3"/>',
    pin: '<path d="M9 4h6l-1 5 3 3v2H7v-2l3-3-1-5z"/><path d="M12 14v6"/>',
    archive: '<rect x="3.5" y="4" width="17" height="4.5" rx="1.2"/><path d="M5 8.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5M10 12.5h4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
    settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    folder: '<path d="M3.5 7a2 2 0 0 1 2-2H10l2 2.5h6.5a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
    restore: '<path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v4.5h4.5"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    more: '<circle cx="12" cy="5" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="19" r="1.5" fill="currentColor"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>'
  };
  const svgIco = (name, size) => '<svg class="ico" viewBox="0 0 24 24" width="' + (size || 20) + '" height="' + (size || 20) + '" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IPATHS[name] + '</svg>';
  const icon = svg => { const t = document.createElement('template'); t.innerHTML = svg; return t.content.firstChild.cloneNode(true); };
  let toastTimer;
  function toast(msg, ms) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms || 3200);
  }
  const SAVE_ICONS = { '': '', 'Saving…': '⟳', 'Saved': '✓', 'Unsaved changes': '●', 'Not saved': '!' };
  function setStatus(msg) {
    // Mobile: show icon in footer
    const mobileEl = $('#edStatus');
    if (mobileEl) { mobileEl.textContent = SAVE_ICONS[msg] !== undefined ? SAVE_ICONS[msg] : msg; mobileEl.title = msg; mobileEl.setAttribute('aria-label', msg); }
    // Desktop: show text in header
    const desktopEl = $('#edStatusDesktop');
    if (desktopEl) desktopEl.textContent = msg;
  }

  // Promise-based dialog: kind 'confirm' | 'prompt' | 'select'
  function dialog(o) {
    return new Promise(resolve => {
      const d = $('#dlg'), inp = $('#dlgInput'), inp2 = $('#dlgInput2'), sel = $('#dlgSelect');
      $('#dlgTitle').textContent = o.title || ''; $('#dlgMsg').textContent = o.message || '';
      $('#dlgMsg').hidden = !o.message;
      inp.hidden = o.kind !== 'prompt' && o.kind !== 'form'; inp2.hidden = o.kind !== 'form'; sel.hidden = o.kind !== 'select';
      if (o.kind === 'form') { const [f1, f2] = o.fields; inp.value = f1.value || ''; inp.placeholder = f1.placeholder || ''; inp.setAttribute('aria-label', f1.label || ''); inp.maxLength = f1.max || 200; inp2.value = f2.value || ''; inp2.placeholder = f2.placeholder || ''; inp2.setAttribute('aria-label', f2.label || ''); inp2.maxLength = f2.max || 200; } else { inp.maxLength = 524288; }
      if (o.kind !== 'form') { inp.value = o.value || ''; inp.placeholder = o.placeholder || ''; inp.removeAttribute('aria-label'); }
      sel.textContent = '';
      (o.options || []).forEach(([v, label]) => sel.append(el('option', { value: v, text: label })));
      if (o.kind === 'select') sel.value = o.value == null ? '' : o.value;
      $('#dlgCancel').hidden = o.hideCancel === true;
      const ok = $('#dlgOk'); ok.textContent = o.ok || 'OK'; ok.className = o.danger ? 'btn-danger' : 'btn-primary';
      const done = () => {
        d.removeEventListener('close', done);
        if (d.returnValue !== 'ok') return resolve(null);
        resolve(o.kind === 'prompt' ? inp.value : o.kind === 'form' ? [inp.value, inp2.value] : o.kind === 'select' ? sel.value : true);
      };
      d.addEventListener('close', done);
      d.returnValue = '';
      if (d.showModal) d.showModal(); else d.setAttribute('open', '');
      if (o.kind === 'prompt' || o.kind === 'form') { inp.focus(); inp.select(); }
    });
  }

  /* ---------- data ---------- */
  const noteById = id => state.notes.find(n => n.id === id);
  const folderById = id => state.folders.find(f => f.id === id);
  async function persistNote(n) { await NotesDB.put('notes', n); }
  function allTags() {
    const m = new Map();
    state.notes.filter(n => !n.trashed).forEach(n => (n.tags || []).forEach(t => m.set(t, (m.get(t) || 0) + 1)));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }
  function newNote(extra) {
    const now = Date.now();
    return Object.assign({ id: L.uid(), title: '', html: '', text: '', tags: [], folderId: null, color: 'default', pinned: false, archived: false, trashed: false, trashedAt: null, created: now, updated: now }, extra);
  }

  /* ---------- navigation + rendering ---------- */
  const VIEW_TITLES = { all: 'All notes', pinned: 'Pinned', archive: 'Archive', trash: 'Trash', settings: 'Settings', folders: 'Folders' };

  function go(view, opts) {
    if (state.openId) closeEditor();
    state.view = view; opts = opts || {};
    state.folderId = opts.folderId !== undefined ? opts.folderId : (view === 'all' ? state.folderId : null);
    state.tag = opts.tag !== undefined ? opts.tag : (view === 'all' ? state.tag : null);
    if (view !== 'all' && opts.folderId === undefined) state.folderId = null;
    closeSidebar(); render(); pushView();
    window.scrollTo(0, 0);
  }

  function render() {
    const settings = state.view === 'settings', foldersPage = state.view === 'folders';
    $('#notesView').hidden = settings || foldersPage; $('#settingsView').hidden = !settings; $('#foldersView').hidden = !foldersPage;
    $('#homeHead').hidden = settings || foldersPage;
    $('#main').dataset.view = state.view;
    $('#newNote').hidden = settings || foldersPage || state.view === 'trash';
    let title = VIEW_TITLES[state.view];
    if (state.view === 'all' && state.folderId) title = state.folderId === L.NO_FOLDER ? 'No folder' : (folderById(state.folderId) || { name: 'All notes' }).name;
    $('#viewTitle').textContent = title;
    const mb = $('#openSidebar'); // phones: Settings shows a back arrow instead of the menu icon
    if (mb.dataset.menuSvg === undefined) mb.dataset.menuSvg = mb.innerHTML;
    mb.innerHTML = settings ? svgIco('back', 24) : mb.dataset.menuSvg;
    mb.setAttribute('aria-label', settings ? 'Back' : 'Open menu'); mb.title = settings ? 'Back' : 'Menu';
    document.title = title + ' · MochiNote';
    renderSidebar();
    if (settings) renderSettings(); else if (foldersPage) renderFoldersPage(); else renderNotes();
  }

  function renderSidebar() {
    $$('.nav-item').forEach(b => {
      const v = b.dataset.view;
      b.classList.toggle('active', v === state.view && !(v === 'all' && (state.folderId || state.tag)));
      if (v !== 'settings') {
        const c = L.filterNotes(state.notes, state.folders, { view: v }).length;
        $('[data-count]', b).textContent = c ? c : '';
      }
    });
    const sf = $('#sideFolders'); sf.textContent = '';
    const active = state.notes.filter(n => !n.trashed && !n.archived);
    const mk = (label, id, count, folder) => {
      const isActive = state.view === 'all' && state.folderId === id;
      const item = el('button', { class: 'side-item' + (isActive ? ' active' : ''), onclick: () => go('all', { folderId: id, tag: state.tag }) },
        el('span', { class: 'fl-name' }, icon(svgIco('folder', 18)), label), el('span', { class: 'count', text: count || '' }));
      if (folder) onLongPress(item, () => folderSheet(folder, item));
      sf.append(item);
      if (folder && isActive) {
        sf.append(el('div', { class: 'folder-tools' },
          el('button', { onclick: () => renameFolder(folder.id) }, 'Rename'),
          el('button', { class: 'danger', onclick: () => deleteFolder(folder.id) }, 'Delete')));
      }
    };
    L.folderTree(state.folders).forEach(({ folder }) => mk(folder.name, folder.id, active.filter(n => n.folderId === folder.id).length, folder));
    const st = $('#sideTags'); st.textContent = '';
    const tags = allTags();
    if (!tags.length) st.append(el('span', { class: 'info', style: 'color:var(--muted);font-size:.9rem', text: 'Type #tags in a note and they show up here.' }));
    tags.forEach(([t, c]) => st.append(el('button', { class: 'tag' + (state.tag === t ? ' active' : ''), onclick: () => go('all', { tag: state.tag === t ? null : t, folderId: state.folderId }) }, '#' + t + ' ' + c)));
  }

  function currentList() {
    const list = L.filterNotes(state.notes, state.folders, { view: state.view, folderId: state.folderId, tag: state.tag, query: state.query });
    return L.sortNotes(list, state.prefs.sort, state.view !== 'trash');
  }

  function renderNotes() {
    const p = state.prefs;
    $('#sortSelect').value = p.sort;
    $('#viewGrid').setAttribute('aria-pressed', p.view === 'grid'); $('#viewList').setAttribute('aria-pressed', p.view === 'list');
    // filter pills
    const f = $('#filters'); f.textContent = '';
    if (state.folderId) f.append(el('button', { class: 'pill', onclick: () => go('all', { folderId: null, tag: state.tag }) }, 'Folder: ', el('b', { text: state.folderId === L.NO_FOLDER ? 'No folder' : (folderById(state.folderId) || {}).name }), ' ✕'));
    if (state.tag) f.append(el('button', { class: 'pill', onclick: () => go('all', { tag: null, folderId: state.folderId }) }, 'Tag: ', el('b', { text: '#' + state.tag }), ' ✕'));
    // labels + "Your space" card (phones; desktop hides them in CSS)
    const plainHome = state.view === 'all' && !state.folderId && !state.tag && !state.query;
    $('#hero').hidden = !plainHome;
    $('#heroTitle').textContent = p.heroTitle || DEFAULT_PREFS.heroTitle; $('#heroSub').textContent = p.heroSub || DEFAULT_PREFS.heroSub;
    $('#notesLabel').textContent = state.view === 'all' && !state.folderId
      ? (state.tag ? '#' + state.tag : state.query ? 'Results' : p.sort === 'edited' ? 'Recent notes' : 'Notes')
      : $('#viewTitle').textContent;
    // folder cards on All notes: phones show 2 (grid) or 4 (list) with "Show all"; desktop shows them all as before
    const strip = $('#folderStrip'); strip.textContent = '';
    const top = state.folders.filter(x => !x.parentId).sort((a, b) => (a.created || 0) - (b.created || 0));
    const mobile = isMobile(), fview = mobile ? p.folderView : 'grid';
    const showFolders = plainHome && top.length > 0;
    strip.className = 'folder-strip ' + fview;
    if (showFolders) {
      if (!mobile) strip.append(el('div', { class: 'folder-strip-head' }, el('span', {}, icon(svgIco('folder', 18)), 'Folders')));
      top.slice(0, mobile ? (fview === 'list' ? 4 : 2) : top.length).forEach((fo, i) => strip.append(folderCard(fo, i)));
    }
    strip.hidden = !strip.childNodes.length;
    $('#folderSection').hidden = !showFolders;
    $('#fvGrid').setAttribute('aria-pressed', p.folderView === 'grid'); $('#fvList').setAttribute('aria-pressed', p.folderView === 'list');
    $('#trashBar').hidden = state.view !== 'trash' || !state.notes.some(n => n.trashed);

    const list = currentList(), box = $('#notes');
    box.className = 'notes ' + p.view; box.textContent = '';
    const frag = document.createDocumentFragment();
    list.forEach(n => frag.append(noteCard(n)));
    box.append(frag);
    const empty = $('#empty'); empty.hidden = list.length > 0;
    if (!list.length) {
      const msgs = {
        all: state.query || state.tag || state.folderId ? ['Nothing matches', 'Try a different search or clear a filter.'] : ['No notes yet', 'Tap “New note” to write your first one.'],
        pinned: ['No pinned notes', 'Pin a note to keep it handy.'], archive: ['Archive is empty', 'Archived notes live here.'], trash: ['Trash is empty', 'Deleted notes wait here until you remove them.']
      };
      const m = msgs[state.view]; empty.textContent = ''; empty.append(el('b', { text: m[0] }), m[1]);
    }
  }

  function folderCard(fo, i) {
    const c = state.notes.filter(n => !n.trashed && !n.archived && n.folderId === fo.id).length;
    const fc = el('button', { class: 'folder-card f' + (i % 4), title: fo.name, onclick: () => go('all', { folderId: fo.id }) },
      icon(ICONS.folder), el('span', { class: 'fname', text: fo.name }), el('span', { class: 'fcount', text: c + (c === 1 ? ' note' : ' notes') }));
    onLongPress(fc, () => folderSheet(fo, fc));
    return fc;
  }
  function renderFoldersPage() {
    const box = $('#allFolders'); box.textContent = ''; box.className = 'folder-strip grid';
    const tree = L.folderTree(state.folders);
    if (!tree.length) { box.append(el('div', { class: 'empty', style: 'grid-column:1/-1' }, el('b', { text: 'No folders yet' }), 'Tap “+ New folder” to make one.')); return; }
    tree.forEach(({ folder }, i) => box.append(folderCard(folder, i)));
  }

  /* Structured preview for cards: keeps bullets, numbering and checklists instead of flattening to text.
     Note HTML is already sanitized; DOMParser never runs scripts or loads images. */
  function previewLines(html, max) {
    const doc = new DOMParser().parseFromString('<body>' + String(html || '') + '</body>', 'text/html');
    const lines = []; let buf = '';
    const flush = () => { const t = buf.replace(/\s+/g, ' ').trim(); if (t) lines.push({ k: 'p', t }); buf = ''; };
    const BLOCK = /^(DIV|P|H[1-6]|BLOCKQUOTE)$/;
    (function walk(node) {
      Array.from(node.childNodes).forEach(ch => {
        if (ch.nodeType === 3) { buf += ch.textContent; return; }
        if (ch.nodeType !== 1) return;
        const tag = ch.tagName;
        if (tag === 'IMG') return;
        if (tag === 'BR') { flush(); return; }
        if (tag === 'UL' || tag === 'OL') {
          flush();
          const kind = tag === 'OL' ? 'ol' : ch.classList.contains('checklist') ? 'check' : 'ul';
          let i = tag === 'OL' ? (parseInt(ch.getAttribute('start'), 10) || 1) - 1 : 0;
          Array.from(ch.children).forEach(li => {
            if (li.tagName !== 'LI') return;
            i++;
            const c = li.cloneNode(true); c.querySelectorAll('ul,ol').forEach(x => x.remove());
            const t = c.textContent.replace(/\s+/g, ' ').trim();
            if (t) lines.push({ k: kind, t, n: i, done: li.classList.contains('done') });
          });
          return;
        }
        if (tag === 'DIV' && ch.classList.contains('callout')) {
          flush();
          const t = Array.from(ch.children).map(c => c.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' · ') || ch.textContent.replace(/\s+/g, ' ').trim();
          if (t) lines.push({ k: 'callout', t, sticker: ch.getAttribute('data-sticker') || '' });
          return;
        }
        if (BLOCK.test(tag)) { flush(); walk(ch); flush(); return; }
        walk(ch);
      });
    })(doc.body);
    flush();
    return { lines: lines.slice(0, max), more: lines.length > max };
  }
  function richPreview(n, max) {
    const { lines, more } = previewLines(n.html, max);
    if (!lines.length) return null;
    const box = el('div', { class: 'n-rich' });
    lines.forEach(l => box.append(el('div', { class: 'pl pl-' + l.k + (l.done ? ' done' : '')},
      el('span', { class: 'pl-m', 'aria-hidden': 'true', text: l.k === 'ul' ? '•' : l.k === 'ol' ? l.n + '.' : l.k === 'check' ? (l.done ? '●' : '○') : l.k === 'callout' ? (l.sticker || '') : '' }),
      el('span', { class: 'pl-t', text: l.t }))));
    if (more) box.append(el('div', { class: 'pl pl-more', 'aria-hidden': 'true', text: '…' }));
    return box;
  }

  /* ---------- long-press (mobile) + action sheet ---------- */
  const isMobile = () => window.matchMedia('(max-width: 899px)').matches;
  function onLongPress(node, handler) {
    let timer = null, sx = 0, sy = 0;
    const cancel = () => { clearTimeout(timer); timer = null; };
    node.addEventListener('pointerdown', e => {
      if (!isMobile() || (e.pointerType === 'mouse' && e.button !== 0)) return;
      sx = e.clientX; sy = e.clientY; cancel();
      timer = setTimeout(() => {
        timer = null; node._lp = true; setTimeout(() => { node._lp = false; }, 600);
        if (navigator.vibrate) { try { navigator.vibrate(12); } catch (_) {} }
        handler();
      }, 480);
    });
    node.addEventListener('pointermove', e => { if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) cancel(); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => node.addEventListener(t, cancel));
    node.addEventListener('contextmenu', e => { if (isMobile()) e.preventDefault(); });
    // swallow the click that follows a long press so it doesn't also open the note / folder
    node.addEventListener('click', e => { if (node._lp) { node._lp = false; e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  }

  let sheetPending = null;
  const sheetIsOpen = () => !$('#sheetLayer').hidden;
  let sheetAnchor = null;
  // The menu pops up from the pressed item: below it when there is room, otherwise above, and
  // lined up with the item's left or right edge (whichever side of the screen the item is on).
  function placeSheet(anchor) {
    const sheet = $('#sheet'), M = 12, vw = window.innerWidth, vh = window.innerHeight;
    sheet.style.left = sheet.style.top = '0px';
    const w = sheet.offsetWidth, h = sheet.offsetHeight;
    if (!anchor || !anchor.isConnected) { sheet.style.left = Math.round((vw - w) / 2) + 'px'; sheet.style.top = Math.round((vh - h) / 2) + 'px'; sheet.style.transformOrigin = '50% 50%'; return; }
    const r = anchor.getBoundingClientRect(), gap = 8;
    const rightSide = r.left + r.width / 2 > vw / 2 && r.width < vw * 0.8;
    let left = rightSide ? r.right - w : r.left;
    left = Math.max(M, Math.min(left, vw - w - M));
    const below = vh - r.bottom - gap - M, above = r.top - gap - M;
    let top, up = false;
    if (h <= below) top = r.bottom + gap;
    else if (h <= above) { top = r.top - gap - h; up = true; }
    else { up = above > below; top = up ? Math.max(M, r.top - gap - h) : Math.min(vh - h - M, r.bottom + gap); }
    sheet.style.left = Math.round(left) + 'px'; sheet.style.top = Math.round(top) + 'px';
    const ox = Math.max(0, Math.min(w, (r.left + r.width / 2) - left));
    sheet.style.transformOrigin = ox + 'px ' + (up ? '100%' : '0%');
  }
  function openSheet(title, items, anchor) {
    const box = $('#sheetItems'); box.textContent = '';
    $('#sheetTitle').textContent = title;
    items.forEach(it => box.append(el('button', { class: it.danger ? 'danger' : false, onclick: () => requestCloseSheet(it.fn) },
      el('span', { class: 's-ico', 'aria-hidden': 'true' }, IPATHS[it.icon] ? icon(svgIco(it.icon, 20)) : (it.icon || '')), it.label)));
    $('#sheetLayer').hidden = false;
    if (sheetAnchor) sheetAnchor.classList.remove('lp-active');
    sheetAnchor = anchor || null; if (sheetAnchor) sheetAnchor.classList.add('lp-active');
    placeSheet(sheetAnchor);
    history.pushState({ kind: 'sheet' }, '');
    const first = $('button', box); if (first) first.focus({ preventScroll: true });
  }
  function hideSheet() { $('#sheetLayer').hidden = true; if (sheetAnchor) { sheetAnchor.classList.remove('lp-active'); sheetAnchor = null; } }
  // Closing goes through history.back() so the entry opening pushed is removed again; the chosen
  // action runs once the popstate arrives and history is back on the real screen.
  function requestCloseSheet(fn) {
    sheetPending = fn || null;
    if (history.state && history.state.kind === 'sheet') history.back();
    else { hideSheet(); const f = sheetPending; sheetPending = null; if (f) f(); }
  }

  function noteSheet(n, anchor) {
    const items = [];
    if (n.trashed) {
      items.push({ icon: 'restore', label: 'Restore', fn: () => restoreNote(n.id) });
      items.push({ icon: 'close', label: 'Delete forever', danger: true, fn: () => deleteForever(n.id) });
    } else {
      if (!n.archived) items.push({ icon: 'pin', label: n.pinned ? 'Unpin' : 'Pin', fn: () => togglePin(n.id) });
      items.push({ icon: 'folder', label: 'Move to folder…', fn: () => moveNoteDialog(n.id) });
      items.push({ icon: 'archive', label: n.archived ? 'Unarchive' : 'Archive', fn: () => archiveNote(n.id, !n.archived) });
      items.push({ icon: 'trash', label: 'Move to Trash', danger: true, fn: () => trashNote(n.id) });
    }
    openSheet(n.title.trim() || L.makePreview(n.text, 40) || 'Untitled', items, anchor);
  }
  function folderSheet(f, anchor) {
    openSheet(f.name, [
      { icon: 'edit', label: 'Rename', fn: () => renameFolder(f.id) },
      { icon: 'trash', label: 'Delete folder', danger: true, fn: () => deleteFolder(f.id) }
    ], anchor);
  }
  async function editHero() {
    const p = state.prefs;
    const v = await dialog({ kind: 'form', title: 'Edit your space', ok: 'Save', fields: [
      { value: p.heroTitle, placeholder: 'Title', label: 'Title', max: 60 }, { value: p.heroSub, placeholder: 'Subtitle', label: 'Subtitle', max: 90 }] });
    if (!v) return;
    setPref('heroTitle', v[0].trim() || DEFAULT_PREFS.heroTitle); setPref('heroSub', v[1].trim() || DEFAULT_PREFS.heroSub);
    renderNotes(); toast('Saved');
  }
  function resetHero() { setPref('heroTitle', DEFAULT_PREFS.heroTitle); setPref('heroSub', DEFAULT_PREFS.heroSub); renderNotes(); toast('Back to the default'); }
  async function togglePin(id) {
    const n = noteById(id); if (!n) return;
    await patchNote(n, { pinned: !n.pinned }); toast(n.pinned ? 'Pinned' : 'Unpinned'); render();
  }
  async function moveNoteDialog(id) {
    const n = noteById(id); if (!n) return;
    const v = await dialog({ kind: 'select', title: 'Move to folder', options: folderOptions().concat([['__new__', '＋ New folder…']]), value: n.folderId || '', ok: 'Move' });
    if (v == null) return;
    let target = v || null;
    if (v === '__new__') { const f = await createFolder(null); if (!f) return; target = f.id; }
    await patchNote(n, { folderId: target }); toast('Moved'); render();
  }

  function noteCard(n) {
    const pv = L.makePreview(n.text, 220);
    const rich = n.title.trim() ? richPreview(n, 4) : null;
    const card = el('article', { class: 'note', style: n.color !== 'default' ? '--nc:var(' + COLOR_VAR[n.color] + ')' : false, tabindex: '0', role: 'button', 'aria-label': 'Open note ' + L.titleOf(n),
      onclick: e => { if (!e.target.closest('.row-actions')) openEditor(n.id); },
      onkeydown: e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === card) { e.preventDefault(); openEditor(n.id); } } },
      n.pinned ? el('span', { class: 'pin-mark', title: 'Pinned' }, el('span', { class: 'pm-emoji', text: '📌' }), icon(ICONS.pin)) : null,
      el('div', { class: 'n-title', text: n.title.trim() || (pv ? L.makePreview(pv, 40) : 'Untitled') }),
      pv ? el('div', { class: 'n-prev', text: n.title.trim() ? pv : '' }) : null,
      rich,
      (n.tags || []).length ? el('div', { class: 'n-tags' }, n.tags.slice(0, 5).map(t => el('span', { class: 'tag', text: '#' + t }))) : null,
      el('div', { class: 'n-meta' + (n.folderId && folderById(n.folderId) ? ' has-folder' : '') }, (n.folderId && folderById(n.folderId) ? [icon(svgIco('folder', 14)), el('span', { class: 'n-fname', text: folderById(n.folderId).name }), el('span', { class: 'n-date', text: ' · ' + L.formatDate(n.updated) })] : [el('span', { class: 'n-date', text: L.formatDate(n.updated) })])));
    if (n.trashed) {
      card.append(el('div', { class: 'row-actions' },
        el('button', { onclick: () => restoreNote(n.id) }, 'Restore'),
        el('button', { class: 'btn-danger', style: 'border-color:var(--danger);color:var(--danger)', onclick: () => deleteForever(n.id) }, 'Delete forever')));
    } else if (n.archived && state.view === 'archive') {
      card.append(el('div', { class: 'row-actions' }, el('button', { onclick: () => archiveNote(n.id, false) }, 'Restore to notes')));
    }
    if (card.querySelector('.row-actions')) card.classList.add('has-actions');
    onLongPress(card, () => noteSheet(n, card));
    return card;
  }

  /* ---------- note actions ---------- */
  async function patchNote(n, patch, touch) {
    Object.assign(n, patch);
    if (touch !== false) n.updated = Date.now();
    await persistNote(n);
  }
  async function archiveNote(id, on) {
    const n = noteById(id); if (!n) return;
    await patchNote(n, { archived: on, pinned: on ? false : n.pinned });
    toast(on ? 'Archived' : 'Restored from archive'); render();
  }
  async function trashNote(id) {
    const n = noteById(id); if (!n) return;
    await patchNote(n, { trashed: true, trashedAt: Date.now(), pinned: false }, false);
    toast('Moved to Trash'); render();
  }
  async function restoreNote(id) {
    const n = noteById(id); if (!n) return;
    await patchNote(n, { trashed: false, trashedAt: null }, false);
    toast('Note restored'); render();
  }
  async function deleteForever(id) {
    const n = noteById(id); if (!n) return;
    if (!await dialog({ title: 'Delete forever?', message: 'This note will be permanently deleted. This cannot be undone.', ok: 'Delete forever', danger: true })) return;
    await NotesDB.remove('notes', id);
    state.notes = state.notes.filter(x => x.id !== id);
    toast('Deleted permanently'); render();
  }
  async function emptyTrash() {
    const ids = state.notes.filter(n => n.trashed).map(n => n.id);
    if (!ids.length) return;
    if (!await dialog({ title: 'Empty Trash?', message: ids.length + ' note(s) will be permanently deleted. This cannot be undone.', ok: 'Empty Trash', danger: true })) return;
    await NotesDB.removeMany('notes', ids);
    state.notes = state.notes.filter(n => !n.trashed);
    toast('Trash emptied'); render();
  }

  /* ---------- folders ---------- */
  async function createFolder() {
    const name = await dialog({ kind: 'prompt', title: 'New folder', placeholder: 'Folder name', ok: 'Create' });
    if (name == null) return null;
    const nm = name.trim(); if (!nm) { toast('Folder name can’t be empty.'); return null; }
    const f = { id: L.uid(), name: nm.slice(0, 100), parentId: null, created: Date.now() };
    await NotesDB.put('folders', f); state.folders.push(f); render(); return f;
  }
  async function renameFolder(id) {
    const f = folderById(id); if (!f) return;
    const name = await dialog({ kind: 'prompt', title: 'Rename folder', value: f.name, ok: 'Rename' });
    if (name == null || !name.trim()) return;
    f.name = name.trim().slice(0, 100); await NotesDB.put('folders', f); render();
  }
  async function deleteFolder(id) {
    const f = folderById(id); if (!f) return;
    const ids = new Set([id]);
    const count = state.notes.filter(n => n.folderId === id).length;
    if (!await dialog({ title: 'Delete folder “' + f.name + '”?', message: 'Notes inside (' + count + ') are kept and moved to “No folder”.', ok: 'Delete folder', danger: true })) return;
    const moved = [];
    state.notes.forEach(n => { if (ids.has(n.folderId)) { n.folderId = null; moved.push(n); } });
    await NotesDB.putMany('notes', moved);
    await NotesDB.removeMany('folders', Array.from(ids));
    state.folders = state.folders.filter(x => !ids.has(x.id));
    if (state.folderId && ids.has(state.folderId)) state.folderId = null;
    toast('Folder deleted'); render();
  }
  function folderOptions() {
    return [['', 'No folder']].concat(L.folderTree(state.folders).map(({ folder }) => [folder.id, folder.name]));
  }

  /* ---------- editor ---------- */
  const ed = {};
  function setSaveStatus(s) { setStatus(s); }
  function syncEditorViewport() {
    const layer = $('#editorLayer'), vv = window.visualViewport;
    if (!layer || layer.hidden) return;
    if (!isMobile() || !vv) { layer.style.removeProperty('--vvh'); layer.style.removeProperty('--vvt'); return; }
    layer.style.setProperty('--vvh', Math.round(vv.height) + 'px'); layer.style.setProperty('--vvt', Math.round(vv.offsetTop) + 'px');
    if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
    requestAnimationFrame(() => NotesEditor.keepCaretVisible());
  }
  function openEditor(id, isNew) {
    const n = noteById(id); if (!n) return;
    state.openId = id; state.dirty = false;
    if (!(history.state && history.state.kind === 'editor')) history.pushState({ kind: 'editor' }, '');
    $('#editorLayer').hidden = false; document.body.style.overflow = 'hidden'; syncEditorViewport();
    $('#edTitle').value = n.title;
    NotesEditor.load(n.html); NotesEditor.keyboard(true); $('#edTitle').inputMode = 'text';
    paintEditorMeta(n); setSaveStatus(n.trashed ? 'In Trash' : 'Saved');
    const ro = n.trashed;
    NotesEditor.el().contentEditable = ro ? 'false' : 'true'; $('#edTitle').readOnly = ro;
    const isDesktop = window.matchMedia('(min-width: 900px)').matches;
    $('#toolbar').hidden = !isDesktop; // desktop: always show; mobile: hidden by default
    $$('#edBar .bar-btn').forEach(b => { b.hidden = ro; b.setAttribute('aria-pressed', 'false'); }); $('#edBar').hidden = ro;
    const edFmtD = $('#edFmtDesktop'); if (edFmtD) { edFmtD.hidden = ro; edFmtD.setAttribute('aria-pressed', isDesktop && !ro ? 'true' : 'false'); }
    // phones: opening an existing note must not pop the keyboard up (tap the text to start typing)
    if (isDesktop || isNew) setTimeout(() => { (isNew || !n.html ? $('#edTitle') : NotesEditor.el()).focus({ preventScroll: true }); }, 30);
  }
  function paintEditorMeta(n) {
    $('#edPinLabel').textContent = n.pinned ? 'Unpin' : 'Pin';
    // Desktop pin button
    const pinBtn = $('#edPin'); if (pinBtn) pinBtn.textContent = n.pinned ? 'Unpin' : 'Pin';
    $('#editor').classList.toggle('nc', n.color !== 'default');
    $('#editor').style.setProperty('--nc', n.color !== 'default' ? 'var(' + COLOR_VAR[n.color] + ')' : '');
    const tags = $('#edTags'); tags.textContent = '';
    (n.tags || []).forEach(t => tags.append(el('span', { class: 'tag', text: '#' + t })));
    $('#edInfo').textContent = 'Edited ' + L.formatDate(n.updated); $('#edMenuInfo').textContent = 'Edited ' + L.formatDate(n.updated);
    // Desktop folder select
    const fs = $('#edFolder');
    if (fs) {
      fs.textContent = '';
      folderOptions().forEach(([v, label]) => fs.append(el('option', { value: v, text: label, selected: (n.folderId || '') === v })));
      fs.value = n.folderId || '';
    }
    // Desktop color swatches
    // color swatches: desktop row under the title, phones inside the ⋮ menu (both write the same note colour)
    ['#edColors', '#edMenuColors'].forEach(selr => {
      const sw = $(selr); if (!sw) return;
      sw.textContent = '';
      L.COLORS.forEach(c => {
        sw.append(el('button', { class: 'swatch' + (n.color === c ? ' on' : ''), style: 'background:var(' + COLOR_VAR[c] + ')', title: c, 'aria-label': c + ' color', 'aria-pressed': n.color === c ? 'true' : 'false',
          onclick: e => { e.stopPropagation(); n.color = c; markDirty(); paintEditorMeta(n); }
        }));
      });
    });
  }
  function collect(n) {
    const html = NotesEditor.getHTML(), title = $('#edTitle').value.slice(0, 200);
    const text = L.htmlToText(html);
    n.title = title; n.html = html; n.text = text;
    n.tags = L.extractTags(title + '\n' + text);
  }
  function markDirty() {
    if (!state.openId) return;
    state.dirty = true;
    if (state.prefs.autosave) { setSaveStatus('Saving…'); clearTimeout(state.saveTimer); state.saveTimer = setTimeout(saveOpen, 500); }
    else setSaveStatus('Unsaved changes');
  }
  function saveOpen() {
    clearTimeout(state.saveTimer);
    const n = noteById(state.openId);
    if (!n || !state.dirty || n.trashed) return state.saving;
    collect(n); n.updated = Date.now(); state.dirty = false;
    const snapshot = JSON.parse(JSON.stringify(n));
    state.saving = state.saving.then(() => NotesDB.put('notes', snapshot)).then(() => {
      if (state.openId === n.id) { setSaveStatus(state.dirty ? 'Saving…' : 'Saved'); paintEditorMeta(n); }
    }).catch(err => { state.dirty = true; setSaveStatus('Not saved'); toast('Could not save: ' + (err && err.message ? err.message : 'storage error') + '. Export a backup to be safe.', 6000); });
    return state.saving;
  }
  async function closeEditor() {
    if (!state.openId) return;
    clearTimeout(state.saveTimer);
    const n = noteById(state.openId);
    if (n && !n.trashed) {
      // Discard completely empty new notes instead of cluttering the list.
      collect(n);
      if (!n.title.trim() && !n.text.trim() && !/<img/i.test(n.html)) {
        state.openId = null; state.dirty = false;
        await state.saving; await NotesDB.remove('notes', n.id);
        state.notes = state.notes.filter(x => x.id !== n.id);
      } else { state.dirty = true; await saveOpen(); }
    }
    state.openId = null; state.dirty = false;
    NotesEditor.hideSuggest();
    $('#editorLayer').hidden = true; document.body.style.overflow = ''; $('#editorLayer').style.removeProperty('--vvh'); $('#editorLayer').style.removeProperty('--vvt'); $('#edMenu').hidden = true;
    $('#globalStatus').textContent = '';
    render();
  }
  async function createAndOpen() {
    const extra = {};
    if (state.folderId && state.folderId !== L.NO_FOLDER) extra.folderId = state.folderId;
    const n = newNote(extra);
    if (state.tag) { n.html = '<p>#' + state.tag + ' </p>'; n.text = '#' + state.tag; n.tags = [state.tag]; }
    state.notes.push(n);
    try { await persistNote(n); } catch (e) { toast('Could not create note: ' + e.message); }
    openEditor(n.id, true);
  }

  async function editorMenu(act) {
    $('#edMenu').hidden = true; $('#edMenuBtn').setAttribute('aria-expanded', 'false');
    const n = noteById(state.openId); if (!n) return;
    if (act === 'archive') { state.dirty = true; await saveOpen(); await closeEditorKeep(); await archiveNote(n.id, !n.archived); }
    else if (act === 'delete') {
      if (!await dialog({ title: 'Move to Trash?', message: 'You can restore it from Trash later.', ok: 'Move to Trash', danger: true })) return;
      state.dirty = true; await saveOpen(); await closeEditorKeep(); await trashNote(n.id);
    } else if (act === 'move') {
      const v = await dialog({ kind: 'select', title: 'Move to folder', options: folderOptions().concat([['__new__', '＋ New folder…']]), value: n.folderId || '', ok: 'Move' });
      if (v == null) return;
      let target = v || null;
      if (v === '__new__') { const f = await createFolder(null); if (!f) return; target = f.id; }
      n.folderId = target; state.dirty = true; await saveOpen(); toast('Moved');
    } else if (act === 'pin') {
      n.pinned = !n.pinned; state.dirty = true; await saveOpen(); paintEditorMeta(n);
    }
  }
  async function closeEditorKeep() { // close without extra render churn when followed by another action
    state.openId = null; state.dirty = false; await state.saving;
    $('#editorLayer').hidden = true; document.body.style.overflow = ''; $('#editorLayer').style.removeProperty('--vvh'); $('#editorLayer').style.removeProperty('--vvt');
    if (history.state && history.state.kind === 'editor') history.back();
  }

  /* ---------- settings screen ---------- */
  function row(label, hint, control) {
    return el('div', { class: 'set-row' }, el('div', {}, el('span', { text: label }), hint ? el('small', { text: hint }) : null), control);
  }
  function sel(options, value, onchange, label) {
    const s = el('select', { 'aria-label': label, onchange: e => onchange(e.target.value) });
    options.forEach(([v, l]) => s.append(el('option', { value: v, text: l, selected: v === value })));
    s.value = value; return s;
  }
  function renderSettings() {
    const p = state.prefs, root = $('#settingsView'); root.textContent = '';
    const themeBtns = el('div', { class: 'theme-grid' }, THEMES.map(([id, dot, name]) => el('button', { class: 'theme-btn', 'aria-pressed': p.theme === id, onclick: () => { setPref('theme', id); renderSettings(); } }, el('span', { class: 'theme-dot', style: '--d:' + dot }), name)));
    root.append(
      el('section', { class: 'set-card' }, el('h2', { text: 'Appearance' }),
        row('Mode', 'Light or dark', sel([['light', 'Light'], ['dark', 'Dark']], p.mode, v => { setPref('mode', v); renderSettings(); }, 'Mode')),
        el('div', { class: 'set-row', style: 'display:block' }, el('div', { text: 'Theme', style: 'margin-bottom:8px' }), themeBtns)),
      el('section', { class: 'set-card' }, el('h2', { text: 'Editor' }),
        row('Default font', 'Only affects text without its own font — existing formatting is kept', sel(FONTS, p.fontFamily, v => setPref('fontFamily', v), 'Default font')),
        row('Default font size', 'In pixels (12–28)', el('input', { type: 'number', min: 12, max: 28, value: p.fontSize, 'aria-label': 'Default font size', onchange: e => { const v = Math.min(28, Math.max(12, Number(e.target.value) || 16)); e.target.value = v; setPref('fontSize', v); } }))),
      el('section', { class: 'set-card' }, el('h2', { text: 'Behavior' }),
        row('Autosave', 'Save a moment after you stop typing. When off, notes save when you go back.', el('input', { type: 'checkbox', checked: p.autosave, 'aria-label': 'Autosave', onchange: e => setPref('autosave', e.target.checked) })),
        row('Animations', 'Turn off for a still interface (also follows your system setting)', el('input', { type: 'checkbox', checked: p.motion !== 'off', 'aria-label': 'Animations', onchange: e => setPref('motion', e.target.checked ? 'on' : 'off') }))),
      dataCard(),
      el('section', { class: 'set-card about' }, el('img', { class: 'about-logo', src: 'assets/logo.svg', alt: 'MochiNote logo', width: 72, height: 72 }), el('h2', { text: 'About' }),
        el('p', { text: 'MochiNote · version ' + APP_VERSION }),
        el('p', { text: 'A calm, cozy, local-first notes app. Your notes live only in this browser — nothing is uploaded and there is no cloud sync.' }),
        el('p', { text: 'Credits: built with plain HTML, CSS and JavaScript. No third-party libraries, fonts or assets are used.' })));
    storageInfo();
  }
  function dataCard() {
    const lb = state.prefs.lastBackup;
    return el('section', { class: 'set-card' }, el('h2', { text: 'Data management' }),
      el('div', { class: 'set-row', style: 'display:block' }, el('p', { id: 'storageInfo', style: 'margin:0 0 8px;color:var(--muted)', text: 'Checking storage…' }),
        el('p', { style: 'margin:0 0 12px;color:var(--muted)', text: lb ? 'Last backup exported: ' + new Date(lb).toLocaleString() : 'No backup exported yet.' }),
        el('div', { class: 'btn-row' },
          el('button', { class: 'btn-primary', onclick: exportBackup }, 'Export backup'),
          el('button', { class: 'btn-ghost', onclick: () => importBackup('merge') }, 'Import (merge)'),
          el('button', { class: 'btn-ghost', onclick: () => importBackup('replace') }, 'Restore (replace all)'))),
      el('input', { type: 'file', id: 'importFile', accept: 'application/json,.json', hidden: true }));
  }
  async function storageInfo() {
    const e = await NotesDB.estimate(); const t = $('#storageInfo'); if (!t) return;
    let msg = NotesDB.isPersistent() ? 'Stored in this browser (IndexedDB).' : '⚠ Browser storage is unavailable — notes will be lost when you close this tab. Export a backup often.';
    if (e && e.quota) msg += ' Using ' + (e.usage / 1048576).toFixed(1) + ' MB of about ' + Math.round(e.quota / 1048576) + ' MB available.';
    msg += ' Clearing site data deletes your notes — export backups regularly.';
    t.textContent = msg;
  }

  /* ---------- backup ---------- */
  function exportBackup() {
    const data = { app: 'little-notes', version: 1, exportedAt: new Date().toISOString(), notes: state.notes, folders: state.folders, settings: { theme: state.prefs.theme, mode: state.prefs.mode, fontFamily: state.prefs.fontFamily, fontSize: state.prefs.fontSize } };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: 'mochinote-backup-' + new Date().toISOString().slice(0, 10) + '.json' });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    state.prefs.lastBackup = Date.now(); savePrefs(); toast('Backup downloaded (' + state.notes.length + ' notes)');
    if (state.view === 'settings') renderSettings();
  }
  function importBackup(mode) {
    const inp = $('#importFile'); inp.value = '';
    inp.onchange = async () => {
      const file = inp.files[0]; if (!file) return;
      try {
        if (file.size > 100 * 1048576) throw new Error('That file is too large to be a backup.');
        let data; try { data = JSON.parse(await file.text()); } catch (_) { throw new Error('That file is not valid JSON.'); }
        const res = L.validateImport(data, { sanitize: NotesEditor.sanitize });
        const msg = res.notes.length + ' note(s) and ' + res.folders.length + ' folder(s) found' + (res.skippedNotes + res.skippedFolders ? ' (' + (res.skippedNotes + res.skippedFolders) + ' damaged item(s) will be skipped)' : '') + '.\n' + (mode === 'replace' ? 'This will REPLACE everything currently in the app.' : 'They will be added to your current notes.');
        if (!await dialog({ title: mode === 'replace' ? 'Restore backup?' : 'Import backup?', message: msg, ok: mode === 'replace' ? 'Replace everything' : 'Import', danger: mode === 'replace' })) return;
        L.flattenFolders(res.folders);
        if (mode === 'replace') {
          await NotesDB.replaceAll(res);
          state.notes = res.notes; state.folders = res.folders;
        } else {
          const nIds = new Set(state.notes.map(n => n.id)), fIds = new Set(state.folders.map(f => f.id)), remap = new Map();
          res.folders.forEach(f => { if (fIds.has(f.id)) { const nid = L.uid(); remap.set(f.id, nid); f.id = nid; } });
          res.folders.forEach(f => { if (f.parentId && remap.has(f.parentId)) f.parentId = remap.get(f.parentId); });
          res.notes.forEach(n => { if (nIds.has(n.id)) n.id = L.uid(); if (n.folderId && remap.has(n.folderId)) n.folderId = remap.get(n.folderId); });
          await NotesDB.putMany('folders', res.folders); await NotesDB.putMany('notes', res.notes);
          state.notes = state.notes.concat(res.notes); state.folders = state.folders.concat(res.folders);
        }
        toast('Imported ' + res.notes.length + ' note(s)'); render();
      } catch (e) { await dialog({ title: 'Import failed', message: e.message || 'Unknown error', ok: 'OK', hideCancel: true }); }
    };
    inp.click();
  }

  /* ---------- wiring ---------- */
  /* Browser/Android Back: each screen the user can "go back" from is a history entry
     (view/filter changes, the open menu, the open editor), so Back returns to the previous
     page instead of leaving the app. */
  const viewState = () => ({ kind: 'view', view: state.view, folderId: state.folderId, tag: state.tag });
  const sameView = (a, b) => a && b && a.kind === 'view' && b.kind === 'view' && a.view === b.view && a.folderId === b.folderId && a.tag === b.tag;
  function pushView() {
    const cur = history.state, vs = viewState();
    if (cur && cur.kind === 'sidebar') history.replaceState(vs, '');
    else if (!sameView(cur, vs)) history.pushState(vs, '');
  }
  const sidebarIsOpen = () => $('#sidebar').classList.contains('open');
  function openSidebar() { if (sidebarIsOpen()) return; history.pushState({ kind: 'sidebar' }, ''); $('#sidebar').classList.add('open'); $('#scrim').classList.add('show'); }
  function closeSidebar() { $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('show'); }
  function requestCloseSidebar() { if (history.state && history.state.kind === 'sidebar') history.back(); else closeSidebar(); }
  function requestCloseEditor() { if (history.state && history.state.kind === 'editor') history.back(); else closeEditor(); }
  window.addEventListener('popstate', e => {
    const s = e.state;
    if (sheetIsOpen() && !(s && s.kind === 'sheet')) { hideSheet(); const f = sheetPending; sheetPending = null; if (f) f(); return; }
    if (state.openId) { closeEditor(); return; }
    if (sidebarIsOpen() && !(s && s.kind === 'sidebar')) { closeSidebar(); return; }
    if (s && s.kind === 'view') { state.view = s.view; state.folderId = s.folderId; state.tag = s.tag; closeSidebar(); render(); }
    else if (s && (s.kind === 'editor' || s.kind === 'sheet')) history.replaceState(viewState(), '');   // forward into a closed editor / sheet
  });

  /* phones: the header shows a search icon; tapping it opens the field, the ✕ clears and closes it */
  function openSearch() {
    $('#headFixed').classList.add('searching'); const b = $('#searchBtn'); b.setAttribute('aria-expanded', 'true'); b.setAttribute('aria-label', 'Close search'); b.title = 'Close search';
    $('#search').focus();
  }
  function closeSearch() {
    const had = state.query !== '';
    $('#search').value = ''; state.query = '';
    $('#headFixed').classList.remove('searching'); const b = $('#searchBtn'); b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-label', 'Search'); b.title = 'Search';
    if (had) renderNotes();
  }
  const focusSearch = () => { if (isMobile()) openSearch(); else $('#search').focus(); };

  function wire() {
    $$('.nav-item').forEach(b => b.addEventListener('click', () => go(b.dataset.view)));
    $('#openSidebar').onclick = () => { if (state.view === 'settings') { if (history.state && history.state.kind === 'view' && history.length > 1) history.back(); else go('all'); } else openSidebar(); }; $('#scrim').onclick = requestCloseSidebar;
    $('#addFolderBtn').onclick = () => createFolder(null);
    $('#newNote').onclick = createAndOpen;
    $('#emptyTrash').onclick = emptyTrash;
    $('#sheetScrim').onclick = () => requestCloseSheet();
    window.addEventListener('resize', () => { if (sheetIsOpen()) placeSheet(sheetAnchor); });
    $('#showAllFolders').onclick = () => go('folders');
    $('#heroEdit').onclick = editHero;
    onLongPress($('#hero'), () => openSheet('Your space', [
      { icon: 'edit', label: 'Edit', fn: editHero },
      { icon: 'restore', label: 'Reset to default', fn: resetHero }
    ], $('#hero')));
    $('#foldersBack').onclick = () => { if (history.state && history.state.kind === 'view' && history.length > 1) history.back(); else go('all'); };
    $('#foldersNew').onclick = () => createFolder(null);
    $('#fvGrid').onclick = () => { setPref('folderView', 'grid'); renderNotes(); };
    $('#fvList').onclick = () => { setPref('folderView', 'list'); renderNotes(); };
    $('#searchBtn').onclick = () => { if ($('#headFixed').classList.contains('searching')) closeSearch(); else openSearch(); };
    let st; $('#search').addEventListener('input', e => { clearTimeout(st); st = setTimeout(() => { state.query = e.target.value; renderNotes(); }, 80); });
    $('#sortSelect').onchange = e => { setPref('sort', e.target.value); renderNotes(); };
    $('#viewGrid').onclick = () => { setPref('view', 'grid'); renderNotes(); };
    $('#viewList').onclick = () => { setPref('view', 'list'); renderNotes(); };

    // editor chrome
    $('#edBack').onclick = requestCloseEditor;
    $('#editorBackdrop').onclick = requestCloseEditor;
    // Mobile: Aa opens the format bar (bottom) and hides the keyboard; closing it brings the keyboard back
    // Footer icons (+ / Aa / list): each opens its own short options row above the footer; the same icon again closes it
    const barBtns = $$('#edBar .bar-btn'); let openGroup = '';
    const paintBar = () => barBtns.forEach(b => b.setAttribute('aria-pressed', String(!$('#toolbar').hidden && b.dataset.open === openGroup)));
    // the bar is always above the keyboard; options open/close without touching the keyboard
    const openFormat = grp => {
      openGroup = grp || openGroup || 'aa'; $('#toolbar').dataset.open = openGroup; $('#toolbar').hidden = false; paintBar();
      NotesEditor.keepCaretVisible(); setTimeout(NotesEditor.keepCaretVisible, 120); setTimeout(NotesEditor.keepCaretVisible, 300);
    };
    const closeFormat = () => {
      $('#toolbar').hidden = true; paintBar();
      NotesEditor.keepCaretVisible(); setTimeout(NotesEditor.keepCaretVisible, 120); setTimeout(NotesEditor.keepCaretVisible, 350);
    };
    barBtns.forEach(b => {
      b.addEventListener('mousedown', e => e.preventDefault());
      b.onclick = () => { if (b.hidden) return; if (!$('#toolbar').hidden && openGroup === b.dataset.open) closeFormat(); else openFormat(b.dataset.open); };
    });
    // Phones: the editor always matches the *visible* area, so the header never scrolls away when the keyboard opens
    const vv = window.visualViewport;
    if (vv) { vv.addEventListener('resize', syncEditorViewport); vv.addEventListener('scroll', syncEditorViewport); }
    window.addEventListener('orientationchange', () => setTimeout(syncEditorViewport, 250));
    $('#tbClose').onclick = () => closeFormat();
    // Desktop: Format toggle
    const edFmtDesk = $('#edFmtDesktop');
    if (edFmtDesk) edFmtDesk.onclick = () => { const tb = $('#toolbar'); tb.hidden = !tb.hidden; edFmtDesk.setAttribute('aria-pressed', String(!tb.hidden)); };
    // Desktop: Pin button
    const edPinBtn = $('#edPin');
    if (edPinBtn) edPinBtn.onclick = () => editorMenu('pin');
    // Desktop: folder select
    const edFolderSel = $('#edFolder');
    if (edFolderSel) edFolderSel.onchange = async e => {
      const n = noteById(state.openId); if (!n) return;
      const v = e.target.value;
      if (v === '__new__') { const f = await createFolder(null); if (!f) { e.target.value = n.folderId || ''; return; } n.folderId = f.id; }
      else n.folderId = v || null;
      state.dirty = true; await saveOpen(); toast('Moved');
    };
    $('#edTitle').addEventListener('input', markDirty);
    $('#edMenuBtn').onclick = e => { e.stopPropagation(); const m = $('#edMenu'); m.hidden = !m.hidden; $('#edMenuBtn').setAttribute('aria-expanded', !m.hidden); };
    $('#edMenu').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b) editorMenu(b.dataset.act); });
    document.addEventListener('click', e => { if (!e.target.closest('#edMenu, #edMenuBtn')) $('#edMenu').hidden = true; });

    NotesEditor.init({
      root: $('#editor'), body: $('#edBody'), suggestEl: $('#tagSuggest'),
      onChange: markDirty, toast,
      getKnownTags: () => allTags().map(t => t[0]),
      askLink: () => dialog({ kind: 'prompt', title: 'Insert link', placeholder: 'https://example.com', ok: 'Add link' })
    });

    // keyboard
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if ($('#dlg').open) return;
        if (sheetIsOpen()) { requestCloseSheet(); return; }
        if (!state.openId && $('#headFixed').classList.contains('searching')) { closeSearch(); return; }
        if (!$('#edMenu').hidden) { $('#edMenu').hidden = true; return; }
        if (state.openId) requestCloseEditor(); else requestCloseSidebar();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && state.openId) { e.preventDefault(); state.dirty = true; saveOpen(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !state.openId) { e.preventDefault(); if (state.view === 'settings' || state.view === 'folders') go('all'); focusSearch(); }
      if (e.key === '/' && !state.openId && !/input|textarea|select/i.test(e.target.tagName) && !e.target.isContentEditable) { e.preventDefault(); focusSearch(); }
    });
    // data-loss protection: flush on hide/close, warn if a save is pending
    const flush = () => { if (state.openId && state.dirty) saveOpen(); };
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', e => { if (state.openId && state.dirty) { flush(); e.preventDefault(); e.returnValue = ''; } });
    window.matchMedia && window.matchMedia('(min-width: 900px)').addEventListener && window.matchMedia('(min-width: 900px)').addEventListener('change', () => { closeSidebar(); if (!isMobile() && state.view === 'folders') go('all'); else render(); });
  }

  /* ---------- boot ---------- */
  async function purgeOldTrash() {
    const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
    const old = state.notes.filter(n => n.trashed && n.trashedAt && n.trashedAt < cutoff);
    if (!old.length) return;
    // Trash is kept until the user empties it; we only mention notes that have been there a while.
  }
  async function boot() {
    loadPrefs(); applyPrefs(); wire(); history.replaceState(viewState(), '');
    const ok = await NotesDB.open();
    try { state.notes = await NotesDB.getAll('notes'); state.folders = await NotesDB.getAll('folders'); }
    catch (e) { toast('Could not read saved notes: ' + e.message, 7000); }
    // older versions allowed subfolders: lift them to the top level (their notes stay in them)
    const lifted = L.flattenFolders(state.folders);
    if (lifted.length) { try { await NotesDB.putMany('folders', lifted); } catch (_) {} }
    state.notes.forEach(n => { n.tags = n.tags || L.extractTags((n.title || '') + '\n' + (n.text || '')); if (!L.COLORS.includes(n.color)) n.color = 'default'; });
    if (!ok) await dialog({ title: 'Storage unavailable', message: 'Your browser is blocking local storage, so notes will only last until this tab closes. Use Settings → Export backup to keep your work.', ok: 'Got it', hideCancel: true });
    NotesDB.requestPersist();
    render();
  }
  boot();
  window.__mochiNote = { state, go, render };
  window.__littleNotes = window.__mochiNote; // backwards compat
})();
