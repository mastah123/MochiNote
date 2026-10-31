/* logic.js — pure, DOM-free helpers (tags, filtering, sorting, import validation).
   Kept separate so it can be unit-tested in Node and reused in an extension/Android WebView. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NotesLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TINTS = ['pink', 'blue', 'lilac', 'green', 'yellow'];
  const okIcon = v => (typeof v === 'string' && /^[a-z0-9]{2,12}$/.test(v)) ? v : null;
  const COLORS = ['default', 'yellow', 'green', 'blue', 'pink', 'lilac'];
  const SORTS = ['edited', 'created-desc', 'created-asc', 'title-asc', 'title-desc'];
  const NO_FOLDER = '__none__';
  const WEEK = 7 * 24 * 3600 * 1000;

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ---------- text + tags ---------- */
  const ENT = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" };
  function htmlToText(html) {
    let s = String(html || '');
    s = s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');
    s = s.replace(/<img[^>]*>/gi, ' ');
    s = s.replace(/<br\s*\/?>/gi, '\n');
    // Block tags break lines on both sides: the first line of a contenteditable is often bare text
    // followed by <div>, which must not glue to the next line ("one two<div>#tag" -> "one two\n#tag").
    s = s.replace(/<\/?(p|div|h[1-6]|li|ul|ol|blockquote)\b[^>]*>/gi, '\n');
    s = s.replace(/<[^>]+>/g, '');
    s = s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') {
        const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        try { return String.fromCodePoint(code); } catch (_) { return ''; }
      }
      const v = ENT[e.toLowerCase()];
      return v === undefined ? m : v;
    });
    s = s.replace(/ /g, ' ').split('\n').map(l => l.replace(/\s+$/, '')).join('\n');
    return s.replace(/\n{2,}/g, '\n').trim();
  }

  // A tag starts at the beginning of text or after whitespace/punctuation; not inside URLs (#frag) or entities.
  const TAG_RE = /(^|[^\p{L}\p{N}_&/#-])#([\p{L}\p{N}_][\p{L}\p{N}_-]*)/gu;
  function normalizeTag(t) { return String(t).replace(/^#+/, '').toLowerCase(); }
  function extractTags(text) {
    const out = [];
    const seen = new Set();
    const s = String(text || '');
    let m;
    TAG_RE.lastIndex = 0;
    while ((m = TAG_RE.exec(s))) {
      const t = normalizeTag(m[2].replace(/[-_]+$/, ''));
      if (!t || /^\d+$/.test(t) || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
    return out;
  }

  function makePreview(text, n) {
    const flat = String(text || '').replace(/\s+/g, ' ').trim();
    return flat.length > (n || 220) ? flat.slice(0, n || 220).trimEnd() + '…' : flat;
  }

  /* ---------- folders ---------- */
  function folderMap(folders) { const m = new Map(); folders.forEach(f => m.set(f.id, f)); return m; }
  function folderDescendants(folders, id) {
    const ids = new Set([id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const f of folders) if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) { ids.add(f.id); grew = true; }
    }
    return ids;
  }
  function folderPath(folders, id) {
    const m = folderMap(folders);
    const names = [];
    let cur = m.get(id), guard = 0;
    while (cur && guard++ < 20) { names.unshift(cur.name); cur = cur.parentId ? m.get(cur.parentId) : null; }
    return names;
  }
  function folderDepth(folders, id) { return Math.max(0, folderPath(folders, id).length - 1); }
  // Subfolders are no longer used: make every folder top level (notes keep their folder). Returns the folders that changed.
  function flattenFolders(folders) {
    const changed = [];
    folders.forEach(f => { if (f.parentId) { f.parentId = null; changed.push(f); } });
    return changed;
  }
  // Folders in tree order (children after their parent), with depth.
  function folderTree(folders) {
    const out = [];
    const byParent = new Map();
    const ids = new Set(folders.map(f => f.id));
    folders.forEach(f => {
      const p = f.parentId && ids.has(f.parentId) ? f.parentId : '';
      if (!byParent.has(p)) byParent.set(p, []);
      byParent.get(p).push(f);
    });
    const walk = (p, depth) => {
      (byParent.get(p) || []).slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
        .forEach(f => { out.push({ folder: f, depth }); walk(f.id, depth + 1); });
    };
    walk('', 0);
    return out;
  }

  /* ---------- filtering ---------- */
  function haystack(note, folders) {
    const path = note.folderId ? folderPath(folders, note.folderId).join(' / ') : '';
    return [note.title || '', note.text || '', (note.tags || []).map(t => '#' + t).join(' '), path].join('\n').toLowerCase();
  }
  function matchesQuery(note, folders, query) {
    const terms = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return true;
    const hay = haystack(note, folders);
    return terms.every(term => {
      if (term[0] === '#') {
        const p = normalizeTag(term);
        return p === '' ? (note.tags || []).length > 0 : (note.tags || []).some(t => t.startsWith(p));
      }
      return hay.includes(term);
    });
  }

  // f: { view: all|pinned|archive|trash, folderId, tag, query, recentOnly, now }
  function filterNotes(notes, folders, f) {
    const now = f.now || Date.now();
    const folderIds = f.folderId && f.folderId !== NO_FOLDER ? folderDescendants(folders, f.folderId) : null;
    const tag = f.tag ? normalizeTag(f.tag) : null;
    return notes.filter(n => {
      if (f.view === 'trash') { if (!n.trashed) return false; }
      else {
        if (n.trashed) return false;
        if (f.view === 'archive') { if (!n.archived) return false; }
        else if (n.archived) return false;
        if (f.view === 'pinned' && !n.pinned) return false;
      }
      if (f.folderId === NO_FOLDER && n.folderId) return false;
      if (folderIds && !folderIds.has(n.folderId)) return false;
      if (tag && !(n.tags || []).includes(tag)) return false;
      if (f.recentOnly && (n.updated || 0) < now - WEEK) return false;
      return matchesQuery(n, folders, f.query);
    });
  }

  /* ---------- sorting ---------- */
  const titleOf = n => (n.title || '').trim() || 'Untitled';
  const collate = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
  const COMPARE = {
    'edited': (a, b) => (b.updated || 0) - (a.updated || 0),
    'created-desc': (a, b) => (b.created || 0) - (a.created || 0),
    'created-asc': (a, b) => (a.created || 0) - (b.created || 0),
    'title-asc': (a, b) => collate(titleOf(a), titleOf(b)),
    'title-desc': (a, b) => collate(titleOf(b), titleOf(a))
  };
  function sortNotes(list, sort, pinnedFirst) {
    const cmp = COMPARE[sort] || COMPARE.edited;
    return list.slice().sort((a, b) =>
      (pinnedFirst ? (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) : 0) || cmp(a, b) || String(a.id).localeCompare(String(b.id)));
  }

  /* ---------- dates ---------- */
  function formatDate(ts, now) {
    now = now || Date.now();
    const d = new Date(ts), n = new Date(now), diff = now - ts;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (d.toDateString() === n.toDateString()) return Math.floor(diff / 3600000) + 'h ago';
    const opts = d.getFullYear() === n.getFullYear() ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' };
    return d.toLocaleDateString(undefined, opts);
  }

  /* ---------- import validation ---------- */
  const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
  const ts = (v, fb) => (typeof v === 'number' && isFinite(v) && v > 0 ? v : fb);

  // Returns { notes, folders, skippedNotes, skippedFolders, settings } or throws Error with a friendly message.
  function validateImport(data, opts) {
    opts = opts || {};
    const sanitize = opts.sanitize || (h => h);
    const now = opts.now || Date.now();
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('This file is not a little notes backup.');
    if (data.app !== 'little-notes') throw new Error('This file was not created by little notes.');
    if (typeof data.version !== 'number' || data.version > 1) throw new Error('This backup comes from a newer version of the app.');
    if (!Array.isArray(data.notes) || (data.folders !== undefined && !Array.isArray(data.folders))) throw new Error('The backup is missing its notes list.');

    let skippedFolders = 0, skippedNotes = 0;
    const folders = [], folderIds = new Set();
    (data.folders || []).forEach(f => {
      if (!f || typeof f !== 'object' || typeof f.id !== 'string' || !f.id || !str(f.name, 100).trim() || folderIds.has(f.id)) { skippedFolders++; return; }
      folderIds.add(f.id);
      const nf = { id: f.id, name: str(f.name, 100).trim(), parentId: typeof f.parentId === 'string' ? f.parentId : null, created: ts(f.created, now) };
      if (okIcon(f.icon)) nf.icon = f.icon; if (TINTS.includes(f.color)) nf.color = f.color;
      folders.push(nf);
    });
    folders.forEach(f => { if (f.parentId && (!folderIds.has(f.parentId) || f.parentId === f.id)) f.parentId = null; });
    // break parent cycles
    folders.forEach(f => {
      const seen = new Set([f.id]); let cur = f.parentId;
      const m = folderMap(folders);
      while (cur) { if (seen.has(cur)) { f.parentId = null; break; } seen.add(cur); cur = m.get(cur) && m.get(cur).parentId; }
    });

    const notes = [], noteIds = new Set();
    data.notes.forEach(n => {
      if (!n || typeof n !== 'object' || (typeof n.html !== 'string' && typeof n.title !== 'string')) { skippedNotes++; return; }
      let id = typeof n.id === 'string' && n.id ? n.id : uid();
      while (noteIds.has(id)) id = uid();
      noteIds.add(id);
      const html = sanitize(typeof n.html === 'string' ? n.html : '');
      const title = str(n.title, 200);
      const text = htmlToText(html);
      const created = ts(n.created, now);
      const nn = {
        id, title, html, text,
        tags: extractTags(title + '\n' + text),
        folderId: typeof n.folderId === 'string' && folderIds.has(n.folderId) ? n.folderId : null,
        color: COLORS.includes(n.color) ? n.color : 'default',
        pinned: n.pinned === true, archived: n.archived === true, trashed: n.trashed === true,
        trashedAt: n.trashed === true ? ts(n.trashedAt, now) : null,
        created, updated: ts(n.updated, created)
      };
      if (okIcon(n.icon)) nn.icon = n.icon; if (TINTS.includes(n.tint)) nn.tint = n.tint;
      if (typeof n.due === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(n.due) && !isNaN(new Date(n.due).getTime())) nn.due = n.due;
      notes.push(nn);
    });
    return { notes, folders, skippedNotes, skippedFolders, settings: data.settings && typeof data.settings === 'object' ? data.settings : null };
  }

  return { COLORS, SORTS, NO_FOLDER, uid, htmlToText, extractTags, normalizeTag, makePreview, folderMap, folderDescendants, folderPath, folderDepth, flattenFolders, folderTree, matchesQuery, filterNotes, sortNotes, formatDate, validateImport, titleOf };
});
