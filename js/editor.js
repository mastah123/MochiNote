/* editor.js — rich-text editor built on contenteditable + document.execCommand.
   Handles the toolbar, checklists, hashtag suggestions, image attachment, paste cleaning and HTML sanitizing. */
const NotesEditor = (function () {
  'use strict';

  /* ---------------- sanitizer (whitelist) ---------------- */
  const KEEP = new Set(['P', 'DIV', 'BR', 'H1', 'H2', 'H3', 'UL', 'OL', 'LI', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'A', 'SPAN', 'FONT', 'MARK', 'IMG', 'BLOCKQUOTE']);
  const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'LINK', 'META', 'TITLE', 'HEAD', 'NOSCRIPT', 'TEMPLATE', 'VIDEO', 'AUDIO', 'CANVAS']);
  const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]+)$/i;
  const STYLE_RULES = {
    'font-family': v => /^[\w\s,'"-]+$/.test(v),
    'font-size': v => /^([\d.]+(px|em|rem|%|pt)|xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large)$/i.test(v),
    'color': v => COLOR_RE.test(v),
    'background-color': v => COLOR_RE.test(v),
    'text-align': v => /^(left|right|center|justify)$/i.test(v),
    'text-decoration': v => /^[a-z\s-]+$/i.test(v),
    'font-weight': v => /^(normal|bold|[1-9]00)$/i.test(v),
    'font-style': v => /^(normal|italic)$/i.test(v)
  };
  function cleanStyle(value) {
    return String(value).split(';').map(d => {
      const i = d.indexOf(':');
      if (i < 0) return '';
      const prop = d.slice(0, i).trim().toLowerCase(), val = d.slice(i + 1).trim();
      return STYLE_RULES[prop] && STYLE_RULES[prop](val) ? prop + ': ' + val : '';
    }).filter(Boolean).join('; ');
  }
  function safeUrl(u, allowData) {
    const v = String(u).trim();
    if (/^(https?:|mailto:)/i.test(v) && !allowData) return v;
    if (allowData && (/^https:/i.test(v) || /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(v))) return v;
    return null;
  }
  function cleanNode(node) {
    Array.from(node.childNodes).forEach(ch => {
      if (ch.nodeType === 3) return;
      if (ch.nodeType !== 1) { ch.remove(); return; }
      if (DROP.has(ch.tagName.toUpperCase())) { ch.remove(); return; }
      cleanNode(ch);
      const tag = ch.tagName.toUpperCase();
      if (!KEEP.has(tag)) { while (ch.firstChild) node.insertBefore(ch.firstChild, ch); ch.remove(); return; }
      Array.from(ch.attributes).forEach(a => {
        const n = a.name.toLowerCase(), v = a.value;
        let ok = false;
        if (n === 'style') { const c = cleanStyle(v); if (c) { ch.setAttribute('style', c); ok = true; } }
        else if (n === 'class' && (tag === 'UL' || tag === 'LI')) {
          const c = v.split(/\s+/).filter(x => (tag === 'UL' && x === 'checklist') || (tag === 'LI' && x === 'done'));
          if (c.length) { ch.setAttribute('class', c.join(' ')); ok = true; }
        }
        else if (tag === 'A' && n === 'href') { const u = safeUrl(v); if (u) { ch.setAttribute('href', u); ok = true; } }
        else if (tag === 'IMG' && n === 'src') { const u = safeUrl(v, true); if (u) { ch.setAttribute('src', u); ok = true; } }
        else if (tag === 'IMG' && n === 'alt') { ch.setAttribute('alt', v.slice(0, 200)); ok = true; }
        else if (tag === 'FONT' && n === 'size' && /^[1-7]$/.test(v)) ok = true;
        else if (tag === 'FONT' && n === 'face' && /^[\w\s,'"-]+$/.test(v)) ok = true;
        else if (tag === 'FONT' && n === 'color' && COLOR_RE.test(v)) ok = true;
        if (!ok) ch.removeAttribute(a.name);
      });
      if (tag === 'A') {
        if (!ch.getAttribute('href')) { while (ch.firstChild) node.insertBefore(ch.firstChild, ch); ch.remove(); return; }
        ch.setAttribute('target', '_blank'); ch.setAttribute('rel', 'noopener noreferrer');
      }
      if (tag === 'IMG' && !ch.getAttribute('src')) ch.remove();
    });
  }
  function sanitize(html) {
    const doc = new DOMParser().parseFromString('<body>' + String(html || '') + '</body>', 'text/html');
    cleanNode(doc.body);
    return doc.body.innerHTML;
  }

  /* ---------------- editor controller ---------------- */
  let opts = null, root = null, body = null, savedRange = null;
  const SIZES = { '2': '0.85em', '3': '1em', '4': '1.25em', '5': '1.6em', '6': '2.1em' };

  const sel = () => window.getSelection();
  const inBody = n => !!(n && body && body.contains(n));
  function focusBody() { if (document.activeElement !== body) body.focus({ preventScroll: true }); }
  function saveRange() {
    const s = sel();
    if (s.rangeCount && inBody(s.anchorNode)) savedRange = s.getRangeAt(0).cloneRange();
  }
  function restoreRange() {
    // If the editor still has focus and a live selection, keep it: savedRange may be stale
    // (execCommand reshapes the DOM before the async selectionchange event refreshes it).
    if (document.activeElement === body && currentRange()) return;
    focusBody();
    if (savedRange) { const s = sel(); s.removeAllRanges(); s.addRange(savedRange); }
  }
  const currentRange = () => { const s = sel(); return s.rangeCount && inBody(s.anchorNode) ? s.getRangeAt(0) : null; };
  function listsInSelection(tag) {
    const r = currentRange();
    if (!r) return [];
    return Array.from(body.querySelectorAll(tag)).filter(l => r.intersectsNode(l));
  }
  const changed = () => opts.onChange();
  function exec(cmd, val) { focusBody(); const ok = document.execCommand(cmd, false, val); saveRange(); changed(); updateToolbar(); return ok; }

  function uncheck(uls) { uls.forEach(u => { u.classList.remove('checklist'); u.querySelectorAll('li.done').forEach(li => li.classList.remove('done')); if (!u.getAttribute('class')) u.removeAttribute('class'); }); }
  function toggleBullet() {
    focusBody();
    const uls = listsInSelection('ul');
    if (uls.some(u => u.classList.contains('checklist'))) { uncheck(uls); changed(); updateToolbar(); return; }
    exec('insertUnorderedList');
  }
  function toggleNumbered() {
    focusBody();
    const uls = listsInSelection('ul').filter(u => u.classList.contains('checklist'));
    if (uls.length) uncheck(uls);
    exec('insertOrderedList');
  }
  function toggleChecklist() {
    focusBody();
    const uls = listsInSelection('ul');
    if (uls.length && uls.every(u => u.classList.contains('checklist'))) { document.execCommand('insertUnorderedList'); }
    else if (uls.length) { uls.forEach(u => u.classList.add('checklist')); }
    else {
      if (listsInSelection('ol').length) document.execCommand('insertOrderedList');
      document.execCommand('insertUnorderedList');
      listsInSelection('ul').forEach(u => u.classList.add('checklist'));
    }
    changed(); updateToolbar();
  }

  function applySize(key) {
    const r = currentRange();
    if (!r || r.collapsed) { opts.toast('Select some text first, then choose a size.'); return; }
    document.execCommand('fontSize', false, '7');
    const spans = [];
    body.querySelectorAll('font[size="7"]').forEach(f => {
      const s = document.createElement('span');
      s.style.fontSize = SIZES[key];
      while (f.firstChild) s.appendChild(f.firstChild);
      f.replaceWith(s); spans.push(s);
    });
    if (spans.length) {
      const range = document.createRange();
      range.setStartBefore(spans[0]); range.setEndAfter(spans[spans.length - 1]);
      sel().removeAllRanges(); sel().addRange(range);
    }
    changed();
  }

  async function insertLink() {
    saveRange();
    const hadText = savedRange && !savedRange.collapsed;
    let url = await opts.askLink();
    if (!url) { restoreRange(); return; }
    url = url.trim();
    if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = (url.includes('@') && !url.includes('/') ? 'mailto:' : 'https://') + url;
    if (!safeUrl(url)) { opts.toast('Only http(s) and mailto links are supported.'); restoreRange(); return; }
    restoreRange();
    if (hadText) document.execCommand('createLink', false, url);
    else {
      const a = document.createElement('a'); a.href = url; a.textContent = url.replace(/^(https?:\/\/|mailto:)/i, '');
      document.execCommand('insertHTML', false, a.outerHTML + '&nbsp;');
    }
    changed();
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image.')); };
      img.src = url;
    });
  }
  async function attachImage(file) {
    if (!file || !/^image\/(png|jpe?g|gif|webp|bmp)/i.test(file.type)) { opts.toast('Please choose a PNG, JPG, GIF or WebP image.'); return; }
    try {
      const img = await loadImage(file);
      const max = 1280, k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const data = c.toDataURL('image/webp', 0.85);
      restoreRange();
      document.execCommand('insertImage', false, data);
      if (data.length > 1.5e6) opts.toast('Large image added — it uses a lot of local storage.');
      changed();
    } catch (e) { opts.toast(e.message || 'Could not add that image.'); }
  }

  /* hashtag suggestions */
  function hideSuggest() { opts.suggestEl.hidden = true; opts.suggestEl.textContent = ''; }
  function updateSuggest() {
    const s = sel();
    if (!s.rangeCount || !s.isCollapsed || !inBody(s.anchorNode) || s.anchorNode.nodeType !== 3) return hideSuggest();
    const node = s.anchorNode, off = s.anchorOffset, before = node.textContent.slice(0, off);
    const m = /(^|[\s(])#([\p{L}\p{N}_-]+)$/u.exec(before);
    if (!m) return hideSuggest();
    const prefix = m[2].toLowerCase();
    const matches = opts.getKnownTags().filter(t => t.startsWith(prefix) && t !== prefix).slice(0, 6);
    if (!matches.length) return hideSuggest();
    opts.suggestEl.textContent = '';
    matches.forEach(t => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'tag'; b.textContent = '#' + t;
      b.addEventListener('mousedown', e => e.preventDefault());
      b.addEventListener('click', () => {
        const start = off - m[2].length - 1;
        node.textContent = node.textContent.slice(0, start) + '#' + t + ' ' + node.textContent.slice(off);
        const r = document.createRange(); r.setStart(node, start + t.length + 2); r.collapse(true);
        sel().removeAllRanges(); sel().addRange(r);
        hideSuggest(); changed();
      });
      opts.suggestEl.appendChild(b);
    });
    opts.suggestEl.hidden = false;
  }

  /* toolbar state */
  function updateToolbar() {
    if (!body || root.hidden) return;
    const active = currentRange() !== null;
    root.querySelectorAll('#toolbar [data-cmd]').forEach(b => {
      const cmd = b.dataset.cmd; let on = false;
      if (active) {
        try {
          if (['bold', 'italic', 'underline', 'strikeThrough', 'justifyLeft', 'justifyCenter', 'justifyRight'].includes(cmd)) on = document.queryCommandState(cmd);
        } catch (_) {}
        if (cmd === 'insertUnorderedList') on = listsInSelection('ul').some(u => !u.classList.contains('checklist'));
        if (cmd === 'insertOrderedList') on = listsInSelection('ol').length > 0;
        if (cmd === 'checklist') on = listsInSelection('ul').some(u => u.classList.contains('checklist'));
      }
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    if (active) {
      const s = sel(); let el = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement);
      const h = el && el.closest && el.closest('h1,h2,h3');
      const bs = root.querySelector('#blockSel'); if (bs) bs.value = h && body.contains(h) ? h.tagName.toLowerCase() : 'p';
    }
  }

  function onBodyInput(e) {
    if (e.inputType === 'insertParagraph') {      // new checklist item shouldn't inherit "done"
      const r = currentRange(), li = r && (r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement).closest('li.done');
      if (li) li.classList.remove('done');
    }
    changed(); updateSuggest();
  }

  function onBodyClick(e) {
    const li = e.target;
    if (li && li.tagName === 'LI' && li.parentElement.classList.contains('checklist') && e.clientX - li.getBoundingClientRect().left < 34) {
      li.classList.toggle('done'); changed();
    }
    const a = e.target.closest && e.target.closest('a');
    if (a && (e.ctrlKey || e.metaKey)) window.open(a.href, '_blank', 'noopener');
  }

  function onPaste(e) {
    e.preventDefault();
    const cd = e.clipboardData;
    const html = cd.getData('text/html'), text = cd.getData('text/plain');
    if (html) document.execCommand('insertHTML', false, sanitize(html));
    else if (text) document.execCommand('insertText', false, text);
    else {
      const f = Array.from(cd.files || []).find(x => x.type.startsWith('image/'));
      if (f) attachImage(f);
    }
    changed();
  }

  function onKeydown(e) {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === 'k') { e.preventDefault(); insertLink(); }
    else if (e.shiftKey && (e.key === '8' || e.key === '*')) { e.preventDefault(); toggleBullet(); }
    else if (e.shiftKey && (e.key === '7' || e.key === '&')) { e.preventDefault(); toggleNumbered(); }
    else if (e.shiftKey && (e.key === '9' || e.key === '(')) { e.preventDefault(); toggleChecklist(); }
  }

  function init(o) {
    opts = o; root = o.root; body = o.body;
    const tb = root.querySelector('#toolbar');
    tb.addEventListener('mousedown', e => { if (!e.target.closest('select, label, input')) e.preventDefault(); });
    tb.addEventListener('click', e => {
      const b = e.target.closest('[data-cmd]'); if (!b) return;
      const cmd = b.dataset.cmd; restoreRange();
      if (cmd === 'insertUnorderedList') toggleBullet();
      else if (cmd === 'insertOrderedList') toggleNumbered();
      else if (cmd === 'checklist') toggleChecklist();
      else if (cmd === 'link') insertLink();
      else if (cmd === 'image') { saveRange(); root.querySelector('#imgInput').click(); }
      else exec(cmd);
    });
    const withRange = fn => () => { restoreRange(); fn(); updateToolbar(); };
    root.querySelector('#blockSel').addEventListener('change', e => { const v = e.target.value; withRange(() => exec('formatBlock', '<' + v + '>'))(); });
    root.querySelector('#fontSel').addEventListener('change', e => { const v = e.target.value; if (v) withRange(() => exec('fontName', v))(); e.target.value = ''; });
    root.querySelector('#sizeSel').addEventListener('change', e => { const v = e.target.value; if (v) withRange(() => applySize(v))(); e.target.value = ''; });
    root.querySelector('#hlSel').addEventListener('change', e => {
      const v = e.target.value;
      if (v) withRange(() => { document.execCommand('styleWithCSS', false, true); exec('hiliteColor', v === 'none' ? 'transparent' : v); document.execCommand('styleWithCSS', false, false); })();
      e.target.value = '';
    });
    root.querySelector('#imgInput').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) attachImage(f); });

    // body events are delegated through root so the body element can be replaced (resets undo history per note)
    root.addEventListener('input', e => { if (e.target === body) onBodyInput(e); });
    root.addEventListener('click', e => { if (e.target.closest && body.contains(e.target)) onBodyClick(e); });
    root.addEventListener('paste', e => { if (e.target === body || body.contains(e.target)) onPaste(e); });
    root.addEventListener('keydown', e => { if (e.target === body) onKeydown(e); });
    root.addEventListener('keyup', e => { if (e.target === body) { updateToolbar(); if (e.key.startsWith('Arrow')) hideSuggest(); } });
    root.addEventListener('focusout', e => { if (e.target === body) setTimeout(() => { if (!opts.suggestEl.matches(':hover')) hideSuggest(); }, 150); });
    document.addEventListener('selectionchange', () => { if (currentRange()) { saveRange(); updateToolbar(); } });
    try { document.execCommand('defaultParagraphSeparator', false, 'div'); } catch (_) {}
  }

  // Replace the editable element so the browser's undo stack never leaks between notes.
  function load(html) {
    const fresh = body.cloneNode(false);
    fresh.innerHTML = sanitize(html);
    body.replaceWith(fresh);
    body = fresh; savedRange = null; hideSuggest();
    return body;
  }

  return { init, load, sanitize, hideSuggest, getHTML: () => sanitize(body.innerHTML), el: () => body, focus: () => focusBody(), updateToolbar };
})();
