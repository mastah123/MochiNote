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
      // some browsers write alignment as an align attribute; keep it as a style so it is saved
      if (/^(DIV|P|H[1-6]|LI|UL|OL|BLOCKQUOTE)$/.test(tag) && ch.hasAttribute('align')) {
        const al = ch.getAttribute('align').toLowerCase();
        if (/^(left|right|center|justify)$/.test(al) && !/text-align/i.test(ch.getAttribute('style') || '')) ch.style.textAlign = al;
      }
      Array.from(ch.attributes).forEach(a => {
        const n = a.name.toLowerCase(), v = a.value;
        let ok = false;
        if (n === 'style') { const c = cleanStyle(v); if (c) { ch.setAttribute('style', c); ok = true; } }
        else if (n === 'class' && (tag === 'UL' || tag === 'LI' || tag === 'DIV')) {
          const c = v.split(/\s+/).filter(x => (tag === 'UL' && x === 'checklist') || (tag === 'LI' && x === 'done') || (tag === 'DIV' && x === 'callout'));
          if (c.length) { ch.setAttribute('class', c.join(' ')); ok = true; }
        }
        else if (tag === 'DIV' && n === 'data-sticker' && /^[^<>"'&\s]{1,8}$/.test(v)) ok = true;
        else if (tag === 'OL' && n === 'start' && /^\d{1,4}$/.test(v)) ok = true;
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
      if (tag === 'DIV' && ch.hasAttribute('data-sticker') && !ch.classList.contains('callout')) ch.removeAttribute('data-sticker');
      if (tag === 'IMG' && !ch.getAttribute('src')) ch.remove();
    });
  }
  function sanitize(html) {
    const doc = new DOMParser().parseFromString('<body>' + String(html || '') + '</body>', 'text/html');
    cleanNode(doc.body);
    // browsers wrap pasted blocks (e.g. a list) in a bare <div>; keep the stored HTML clean
    Array.from(doc.body.children).forEach(d => { if (d.tagName === 'DIV' && !d.attributes.length && d.children.length && d.children.length === d.childNodes.length && Array.from(d.children).every(c => /^(DIV|UL|OL|P|H[1-3]|BLOCKQUOTE)$/.test(c.tagName))) d.replaceWith(...Array.from(d.childNodes)); });
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
  function exec(cmd, val) { focusBody(); const jf = /^justify/.test(cmd); if (jf) document.execCommand('styleWithCSS', false, true); const ok = document.execCommand(cmd, false, val); if (jf) document.execCommand('styleWithCSS', false, false); saveRange(); changed(); updateToolbar(); return ok; }

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

  /* ---------- card: a <div class="callout" [data-sticker]> holding ordinary block children; the sticker is optional ---------- */
  const calloutOf = n => { const el = n && (n.nodeType === 1 ? n : n.parentElement); const c = el && el.closest && el.closest('.callout'); return c && body.contains(c) ? c : null; };
  const topBlock = n => { while (n && n.parentNode !== body) n = n.parentNode; return n; };
  const INLINE = /^(B|STRONG|I|EM|U|S|STRIKE|DEL|A|SPAN|FONT|MARK|IMG|BR)$/;
  function caretIn(node, atEnd) {
    const r = document.createRange(); r.selectNodeContents(node); r.collapse(!atEnd);
    sel().removeAllRanges(); sel().addRange(r); saveRange();
  }
  function toggleCallout() {
    focusBody();
    const r = currentRange(); if (!r) { caretIn(body, true); return toggleCallout(); }
    const existing = calloutOf(r.startContainer);
    if (existing) {                       // unwrap: the children become normal blocks again
      const kids = Array.from(existing.childNodes), last = kids[kids.length - 1];
      kids.forEach(k => existing.parentNode.insertBefore(k, existing)); existing.remove();
      if (last) caretIn(last, true);
      changed(); updateToolbar(); return;
    }
    const first = topBlock(r.startContainer), lastB = topBlock(r.endContainer);
    const card = document.createElement('div'); card.className = 'callout';
    if (!first || first === body) {       // empty note
      const d = document.createElement('div'); d.appendChild(document.createElement('br')); card.appendChild(d); body.appendChild(card);
      caretIn(d, false); changed(); updateToolbar(); return;
    }
    const run = []; for (let n = first; n; n = n.nextSibling) { run.push(n); if (n === lastB) break; }
    body.insertBefore(card, first);
    let inlineWrap = null;
    run.forEach(n => {
      const isInline = n.nodeType === 3 || (n.nodeType === 1 && INLINE.test(n.tagName));
      if (isInline) { if (!inlineWrap) { inlineWrap = document.createElement('div'); card.appendChild(inlineWrap); } inlineWrap.appendChild(n); }
      else { inlineWrap = null; card.appendChild(n); }
    });
    if (!card.firstChild) { const d = document.createElement('div'); d.appendChild(document.createElement('br')); card.appendChild(d); }
    caretIn(card.lastChild, true); changed(); updateToolbar();
  }
  // Enter on an empty last line of a callout leaves the card (otherwise you could never type below it).
  function maybeExitCallout(e) {
    const r = currentRange(); if (!r || !r.collapsed) return false;
    const card = calloutOf(r.startContainer); if (!card || card.children.length < 2) return false;
    const line = card.lastElementChild;
    if (!line || line.textContent.trim() !== '' || line.querySelector('img,ul,ol') || !line.contains(r.startContainer) && line !== r.startContainer) return false;
    e.preventDefault(); line.remove();
    const d = document.createElement('div'); d.appendChild(document.createElement('br'));
    card.parentNode.insertBefore(d, card.nextSibling); caretIn(d, false); changed(); return true;
  }

  /* ---------- copy / cut: plain text keeps list numbering, bullets and checkboxes (mobile only) ---------- */
  const isMobileView = () => window.matchMedia('(max-width: 899px)').matches;
  function rangeToText(range) {
    const lines = []; let buf = '';
    const part = t => { let v = t.nodeValue; if (t === range.endContainer) v = v.slice(0, range.endOffset); if (t === range.startContainer) v = v.slice(range.startOffset); return v; };
    const flush = () => { const t = buf.replace(/\s+/g, ' ').trim(); if (t) lines.push(t); buf = ''; };
    const BLOCK = /^(DIV|P|H[1-6]|BLOCKQUOTE)$/;
    const list = (el, depth) => {
      const ordered = el.tagName === 'OL'; let i = ordered ? (parseInt(el.getAttribute('start'), 10) || 1) - 1 : 0; const check = el.classList.contains('checklist');
      Array.from(el.children).forEach(li => {
        if (li.tagName !== 'LI') return; i++;
        if (!range.intersectsNode(li)) return;
        const marker = ordered ? i + '. ' : check ? (li.classList.contains('done') ? '☑ ' : '☐ ') : '• ';
        buf = ''; Array.from(li.childNodes).forEach(c => { if (c.nodeType === 1 && /^(UL|OL)$/.test(c.tagName)) return; inline(c); });
        const t = buf.replace(/\s+/g, ' ').trim(); buf = ''; lines.push('  '.repeat(depth) + marker + t);
        Array.from(li.children).forEach(c => { if (/^(UL|OL)$/.test(c.tagName)) list(c, depth + 1); });
      });
    };
    const inline = n => {
      if (!range.intersectsNode(n)) return;
      if (n.nodeType === 3) { buf += part(n); return; }
      if (n.nodeType !== 1 || n.tagName === 'IMG') return;
      if (n.tagName === 'BR') { flush(); return; }
      Array.from(n.childNodes).forEach(inline);
    };
    (function walk(node, inCallout) {
      Array.from(node.childNodes).forEach(ch => {
        if (!range.intersectsNode(ch)) return;
        if (ch.nodeType === 3) { buf += part(ch); return; }
        if (ch.nodeType !== 1 || ch.tagName === 'IMG') return;
        const tag = ch.tagName;
        if (tag === 'BR') { flush(); return; }
        if (tag === 'UL' || tag === 'OL') { flush(); list(ch, 0); return; }
        if (BLOCK.test(tag)) {
          flush();
          if (ch.classList.contains('callout')) { const n0 = lines.length; walk(ch, true); flush(); if (lines.length > n0 && ch.getAttribute('data-sticker')) lines[n0] = ch.getAttribute('data-sticker') + ' ' + lines[n0]; }
          else { walk(ch, false); flush(); }
          return;
        }
        walk(ch, inCallout);
      });
    })(body, false);
    flush();
    return lines.join('\n');
  }
  function onCopyCut(e) {
    if (!isMobileView()) return;
    const r = currentRange(); if (!r || r.collapsed || !e.clipboardData) return;
    const wrap = document.createElement('div'); wrap.appendChild(r.cloneContents());
    e.clipboardData.setData('text/plain', rangeToText(r));
    e.clipboardData.setData('text/html', wrap.innerHTML);
    e.preventDefault();
    if (e.type === 'cut') { document.execCommand('delete'); changed(); }
  }

  /* ---------- on-screen keyboard control (mobile format bar) ---------- */
  // inputmode="none" lets us keep focus/selection in the note without the keyboard popping up, so the
  // format bar can take the keyboard's place and buttons still act on the selected text.
  function keyboard(on) { if (body) body.inputMode = on ? 'text' : 'none'; }
  function hideKeyboard() { saveRange(); keyboard(false); if (document.activeElement === body) body.blur(); }
  function resumeKeyboard() { keyboard(true); if (document.activeElement === body) body.blur(); restoreRange(); }

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
      document.execCommand('insertParagraph');          // a fresh line under the picture, so typing continues below it
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
        if (/^h[123]$/.test(cmd)) { const s0 = sel(); const e0 = s0.anchorNode && (s0.anchorNode.nodeType === 1 ? s0.anchorNode : s0.anchorNode.parentElement); const hh = e0 && e0.closest && e0.closest('h1,h2,h3'); on = !!(hh && body.contains(hh) && hh.tagName.toLowerCase() === cmd); }
        if (cmd === 'callout') { const r0 = currentRange(); on = !!(r0 && calloutOf(r0.startContainer)); }
      }
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    if (active) {
      const s = sel(); let el = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement);
      const h = el && el.closest && el.closest('h1,h2,h3');
      const bs = root.querySelector('#blockSel'); if (bs) bs.value = h && body.contains(h) ? h.tagName.toLowerCase() : 'p';
    }
  }

  // Keep the line being typed above the format bar / keyboard (like the keyboard does): scroll the note area so the caret is visible.
  function caretRect() {
    const r = currentRange(); if (!r) return null;
    let rect = r.getClientRects()[0];
    if (rect && (rect.height || rect.width)) return rect;
    // collapsed at an element boundary: measure the line the caret is on (the last leaf before it), not the whole container
    let n = r.startContainer;
    if (n.nodeType === 1) { n = n.childNodes[r.startOffset - 1] || n.childNodes[r.startOffset] || n; while (n.lastChild) n = n.lastChild; }
    const rr = document.createRange();
    if (n.nodeType === 3) { rr.selectNodeContents(n); const rs = rr.getClientRects(); if (rs.length) return rs[rs.length - 1]; }
    const el = n.nodeType === 1 && n !== body ? n : n.parentElement;
    const er = el && el.getBoundingClientRect();
    return er && er.height ? (el.tagName === 'BR' ? el.parentElement.getBoundingClientRect() : er) : null;
  }
  function keepCaretVisible() {
    const sc = body && body.closest('.ed-scroll'); const rect = caretRect(); if (!sc || !rect || !rect.height) return;
    const box = sc.getBoundingClientRect(), pad = Math.min(36, box.height / 4);
    if (rect.bottom > box.bottom - pad) sc.scrollTop += rect.bottom - (box.bottom - pad);
    else if (rect.top < box.top + 6) sc.scrollTop -= (box.top + 6) - rect.top;
  }

  function onBodyInput(e) {
    if (e.inputType === 'insertParagraph') {      // new checklist item shouldn't inherit "done"
      const r = currentRange(), li = r && (r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement).closest('li.done');
      if (li) li.classList.remove('done');
    }
    changed(); updateSuggest();
    if (window.matchMedia('(max-width: 899px)').matches) requestAnimationFrame(keepCaretVisible);
  }

  /* ---------- stickers: tiny emoji picker. From the toolbar it inserts at the caret; from a card's gutter it sets the card's own sticker ---------- */
  const STICKERS = ['💡', '⭐', '❤️', '🔥', '✅', '❗', '❓', '📌', '📝', '🎯', '🌱', '☁️', '🍡', '🌸', '🎨', '🎵', '📚', '💬', '🛒', '🏠', '✈️', '💰', '🔔', '🧠', '😊', '🎉', '⚡', '🌙'];
  let stickerCb = null, stickerAnchor = null;
  function hideSticker() { const p = root && root.querySelector('#stickerPop'); if (p) p.hidden = true; stickerCb = null; stickerAnchor = null; }
  function openSticker(anchor, title, current, cb) {
    const pop = root.querySelector('#stickerPop'), grid = root.querySelector('#stickerGrid'), inp = root.querySelector('#stickerInput'), none = root.querySelector('#stickerNone');
    saveRange(); stickerCb = cb; stickerAnchor = anchor;
    root.querySelector('#stickerTitle').textContent = title; inp.value = ''; none.hidden = !current;
    if (!grid.childNodes.length) STICKERS.forEach(s => { const b = document.createElement('button'); b.type = 'button'; b.className = 'sticker'; b.textContent = s; b.setAttribute('aria-label', 'Sticker ' + s); b.dataset.s = s; grid.appendChild(b); });
    Array.from(grid.children).forEach(b => b.classList.toggle('on', b.dataset.s === current));
    pop.hidden = false;
    const r = anchor.getBoundingClientRect(), er = (root.matches('#editor') ? root : root.querySelector('#editor') || root).getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight, M = 8;
    let left = Math.max(er.left + M, Math.min(r.left, er.right - pw - M)), top = r.bottom + 6;
    if (top + ph > er.bottom - M) top = Math.max(er.top + M, r.top - ph - 6);
    pop.style.left = Math.round(left - er.left) + 'px'; pop.style.top = Math.round(top - er.top) + 'px';
  }
  function pickSticker(s) { const cb = stickerCb; hideSticker(); if (cb) cb(s); }
  function insertSticker(s) { restoreRange(); document.execCommand('insertText', false, s); saveRange(); changed(); updateToolbar(); }
  function setCardSticker(card, s) { if (s) card.setAttribute('data-sticker', s); else card.removeAttribute('data-sticker'); changed(); }

  function onBodyClick(e) {
    const card = e.target.classList && e.target.classList.contains('callout') ? e.target : null;
    if (card && e.clientX - card.getBoundingClientRect().left < 46) {         // the card's sticker slot
      const cur = card.getAttribute('data-sticker') || '';
      openSticker(card, 'Card sticker', cur, s => setCardSticker(card, s)); return;
    }
    const li = e.target;
    if (li && li.tagName === 'LI' && li.parentElement.classList.contains('checklist') && e.clientX - li.getBoundingClientRect().left < 34) {
      li.classList.toggle('done'); changed();
    }
    const a = e.target.closest && e.target.closest('a');
    if (a && (e.ctrlKey || e.metaKey)) window.open(a.href, '_blank', 'noopener');
  }

  /* ---------- pasted "- item", "1. item", "☐ item" lines become real lists ---------- */
  const MARKERS = [
    { kind: 'check', re: /^(\s*(?:[-*•]\s+)?)(\[( |x|X|✓|✔)\]|[☐☑☒✅⬜✔✓])\s+/ },
    { kind: 'ul', re: /^(\s*)[-*•·▪◦‣]\s+/ },
    { kind: 'ol', re: /^(\s*)(\d{1,4})[.)]\s+/ }
  ];
  function classifyLine(text) {
    const t = text.replace(/\u00a0/g, ' ');
    for (const m of MARKERS) {
      const x = m.re.exec(t);
      if (x && t.length > x[0].length && t.slice(x[0].length).trim()) {
        return { kind: m.kind, len: x[0].length, done: m.kind === 'check' && /[xX✓✔☑☒✅]/.test(x[2]), num: m.kind === 'ol' ? parseInt(x[2], 10) : 0 };
      }
    }
    return null;
  }
  function stripLead(div, n) {                       // remove the first n characters of text (across inline tags)
    const w = document.createTreeWalker(div, NodeFilter.SHOW_TEXT); let t;
    while (n > 0 && (t = w.nextNode())) { const k = Math.min(n, t.nodeValue.length); t.nodeValue = t.nodeValue.slice(k); n -= k; }
  }
  // Split pasted content into lines (<br> and block boundaries); headings / quotes stay whole.
  function linesFromDom(rootEl) {
    const lines = []; let cur = document.createElement('div');
    const flush = force => { if (cur.childNodes.length || force) lines.push({ el: cur }); cur = document.createElement('div'); };
    (function walk(node) {
      Array.from(node.childNodes).forEach(ch => {
        if (ch.nodeType === 1 && ch.tagName === 'BR') { flush(true); return; }
        if (ch.nodeType === 1 && /^(H[1-3]|BLOCKQUOTE)$/.test(ch.tagName)) { if (cur.childNodes.length) flush(); lines.push({ el: ch.cloneNode(true), atomic: true }); return; }
        if (ch.nodeType === 1 && /^(DIV|P)$/.test(ch.tagName)) { if (cur.childNodes.length) flush(); walk(ch); if (cur.childNodes.length) flush(); return; }
        cur.appendChild(ch.cloneNode(true));
      });
    })(rootEl);
    if (cur.childNodes.length) flush();
    return lines;
  }
  // Returns HTML with real <ul>/<ol>/checklist for runs of 2+ marker lines (1 line when allowSingle), or null.
  function listifyLines(lines, allowSingle) {
    const info = lines.map(l => l.atomic ? null : classifyLine(l.el.textContent));
    let out = '', found = false, i = 0;
    const plain = l => l.atomic ? l.el.outerHTML : '<div>' + (l.el.innerHTML || '<br>') + '</div>';
    while (i < lines.length) {
      const c = info[i];
      if (!c) { out += plain(lines[i]); i++; continue; }
      let j = i; while (j < lines.length && info[j] && info[j].kind === c.kind) j++;
      if (j - i < 2 && !(allowSingle && lines.length === 1)) { for (let k = i; k < j; k++) out += plain(lines[k]); i = j; continue; }
      found = true;
      const items = []; for (let k = i; k < j; k++) { const d = lines[k].el.cloneNode(true); stripLead(d, info[k].len); items.push('<li' + (info[k].done ? ' class="done"' : '') + '>' + (d.innerHTML || '<br>') + '</li>'); }
      out += c.kind === 'ol' ? '<ol' + (c.num > 1 ? ' start="' + c.num + '"' : '') + '>' + items.join('') + '</ol>' : c.kind === 'check' ? '<ul class="checklist">' + items.join('') + '</ul>' : '<ul>' + items.join('') + '</ul>';
      i = j;
    }
    return found ? out : null;
  }
  function listifyHtml(clean, allowSingle) {
    const box = document.createElement('div'); box.innerHTML = clean;
    if (box.querySelector('ul,ol,li')) return null;      // already real lists: keep as they are
    return listifyLines(linesFromDom(box), allowSingle);
  }
  function listifyText(text, allowSingle) {
    const lines = text.replace(/\r\n?/g, '\n').replace(/\n+$/, '').split('\n').map(t => { const d = document.createElement('div'); d.textContent = t; return { el: d }; });
    return listifyLines(lines, allowSingle);
  }
  function caretLineIsEmpty() {
    const r = currentRange(); if (!r) return false;
    const b = topBlock(r.startContainer); if (!b || b === body) return !body.textContent.trim();
    return !b.textContent.trim() && !b.querySelector('img,ul,ol');
  }

  // Pasting block HTML onto an empty line replaces that line (no wrapper <div>, undo still works).
  function insertBlocks(h) {
    const r = currentRange();
    if (r && r.collapsed && caretLineIsEmpty()) {
      const b = topBlock(r.startContainer);
      if (b && b !== body && /^(DIV|P)$/.test(b.tagName) && !b.classList.contains('callout') && !b.querySelector('li')) {
        const rr = document.createRange(); rr.selectNode(b); sel().removeAllRanges(); sel().addRange(rr);
      }
    }
    document.execCommand('insertHTML', false, h);
  }

  function onPaste(e) {
    e.preventDefault();
    const cd = e.clipboardData;
    const html = cd.getData('text/html'), text = cd.getData('text/plain');
    const single = caretLineIsEmpty();
    if (html) {
      const clean = sanitize(html);
      const lists = listifyHtml(clean, single && !/\n/.test(text.trim())) || (/<(ul|ol)\b/i.test(clean) ? null : (text && listifyText(text, false)));
      insertBlocks(lists || clean);
    }
    else if (text) {
      const lists = listifyText(text, single);
      if (lists) insertBlocks(lists); else document.execCommand('insertText', false, text);
    }
    else {
      const f = Array.from(cd.files || []).find(x => x.type.startsWith('image/'));
      if (f) attachImage(f);
    }
    changed();
  }

  /* ---------- caret in front of a list item (before its number / bullet / checkbox) ---------- */
  function liAtLineStart() {
    const r = currentRange(); if (!r || !r.collapsed) return null;
    const el = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
    const li = el && el.closest('li'); if (!li || !body.contains(li)) return null;
    const pre = document.createRange(); pre.selectNodeContents(li); pre.setEnd(r.startContainer, r.startOffset);
    return pre.toString() === '' && !pre.cloneContents().querySelector('img') ? li : null;
  }
  // A list at the very top of a note has no line above it. Enter in front of its first item (or Arrow Up)
  // adds a normal line above and leaves the list exactly as it was.
  function lineAboveTopList(e, onlyIfText) {
    const li = liAtLineStart(); if (!li) return false;
    const list = li.parentElement, wrap = list.parentNode !== body && list.parentNode.parentNode === body && list.parentNode.tagName === 'DIV' && !list.parentNode.attributes.length && list.parentNode.childNodes.length === 1 ? list.parentNode : null;
    const top = (list.parentNode === body || wrap) && /^(UL|OL)$/.test(list.tagName);
    if (!top || li !== list.firstElementChild) return false;
    const block = wrap || list;
    let prev = block.previousSibling; while (prev && prev.nodeType === 3 && !prev.nodeValue.trim()) prev = prev.previousSibling;
    if (prev) return false;
    if (onlyIfText && !li.textContent.trim()) return false;      // an empty first item: Enter keeps its normal "leave the list" behaviour
    e.preventDefault();
    const d = document.createElement('div'); d.appendChild(document.createElement('br')); body.insertBefore(d, block);
    caretIn(d, false);
    changed(); updateToolbar(); return true;
  }

  function onKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) { if (lineAboveTopList(e, true)) return; maybeExitCallout(e); return; }
    if (e.key === 'ArrowUp' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) { lineAboveTopList(e, false); return; }
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
      else if (cmd === 'callout') toggleCallout();
      else if (cmd === 'sticker') openSticker(b, 'Insert a sticker', '', s => insertSticker(s));
      else if (/^h[123]$/.test(cmd)) { const cur = (document.queryCommandValue('formatBlock') || '').toLowerCase().replace(/[<>]/g, ''); exec('formatBlock', '<' + (cur === cmd ? 'p' : cmd) + '>'); }
      else if (cmd === 'link') insertLink();
      else if (cmd === 'image') { saveRange(); root.querySelector('#imgInput').click(); }
      else exec(cmd);
    });
    root.querySelectorAll('.ed-top [data-cmd]').forEach(b => {
      b.addEventListener('mousedown', e => e.preventDefault());
      b.addEventListener('click', () => { restoreRange(); exec(b.dataset.cmd); });
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
    const sp = root.querySelector('#stickerPop');
    sp.addEventListener('mousedown', e => { if (e.target.id !== 'stickerInput') e.preventDefault(); });
    sp.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.classList.contains('sticker')) pickSticker(b.dataset.s);
      else if (b.id === 'stickerUse') { const v = root.querySelector('#stickerInput').value.trim(); if (v) pickSticker(v.slice(0, 8)); }
      else if (b.id === 'stickerNone') pickSticker('');
    });
    root.querySelector('#stickerInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); root.querySelector('#stickerUse').click(); } });
    document.addEventListener('pointerdown', e => { if (!sp.hidden && !sp.contains(e.target) && !(stickerAnchor && stickerAnchor.contains && stickerAnchor.contains(e.target))) hideSticker(); }, true);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sp.hidden) { e.stopImmediatePropagation(); e.preventDefault(); hideSticker(); } }, true);
    window.addEventListener('popstate', hideSticker);
    root.querySelector('#imgInput').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) attachImage(f); });

    // body events are delegated through root so the body element can be replaced (resets undo history per note)
    root.addEventListener('input', e => { if (e.target === body) onBodyInput(e); });
    root.addEventListener('click', e => { if (e.target.closest && body.contains(e.target)) onBodyClick(e); });
    root.addEventListener('paste', e => { if (e.target === body || body.contains(e.target)) onPaste(e); });
    root.addEventListener('copy', e => { if (e.target === body || inBody(e.target)) onCopyCut(e); });
    root.addEventListener('cut', e => { if (e.target === body || inBody(e.target)) onCopyCut(e); });
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

  return { init, load, sanitize, hideSuggest, hideSticker, hideKeyboard, resumeKeyboard, keyboard, saveRange, getHTML: () => sanitize(body.innerHTML), keepCaretVisible, el: () => body, focus: () => focusBody(), updateToolbar };
})();
