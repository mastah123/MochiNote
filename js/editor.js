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
    'text-decoration-line': v => /^[a-z\s-]+$/i.test(v),
    'font-weight': v => /^(normal|bold|[1-9]00)$/i.test(v),
    'font-style': v => /^(normal|italic)$/i.test(v),
    'line-height': v => /^[\d.]+px$/i.test(v)
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
          const c = v.split(/\s+/).filter(x => (tag === 'UL' && x === 'checklist') || (tag === 'LI' && x === 'done') || (tag === 'DIV' && /^(callout|codecard|promptcard|linkcard)$/.test(x)));
          if (c.length) { ch.setAttribute('class', c.join(' ')); ok = true; }
        }
        else if (tag === 'UL' && n === 'data-title' && ch.classList.contains('checklist')) { const t = v.replace(/[<>]/g, '').trim().slice(0, 60); if (t) { ch.setAttribute('data-title', t); ok = true; } }
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
      if (tag === 'DIV') {
        if (ch.classList.contains('linkcard')) {      // a link card needs its link; the shown host is derived from it
          const a = ch.querySelector('a[href]'); let host = '';
          try { host = a ? new URL(a.getAttribute('href')).hostname.replace(/^www\./, '') : ''; } catch (_) {}
          if (host) ch.setAttribute('data-host', host); else { ch.removeAttribute('class'); ch.removeAttribute('data-host'); }
        } else ch.removeAttribute('data-host');
      }
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
  // After a dialog or the file picker the browser may have moved the caret (often to the very start): put it back where the person was typing
  function forceRestore(r) { focusBody(); const use = r || savedRange; if (use) { const s = sel(); s.removeAllRanges(); s.addRange(use); savedRange = use.cloneRange(); } }
  const currentRange = () => { const s = sel(); return s.rangeCount && inBody(s.anchorNode) ? s.getRangeAt(0) : null; };
  function listsInSelection(tag) {
    const r = currentRange();
    if (!r) return [];
    return Array.from(body.querySelectorAll(tag)).filter(l => r.intersectsNode(l));
  }
  const changed = () => opts.onChange();
  /* Typing style override: Bold/Italic/Underline/Strike pressed with a plain caret decide how the NEXT typed characters look.
     Browsers lose or ignore that pending style in some places (caret at the start of a bold word, Android keyboards), so the
     choice is remembered here and re-applied to what is typed, until the caret moves somewhere else. */
  const TOGGLE_CMDS = ['bold', 'italic', 'underline', 'strikeThrough'];
  let ov = null, composing = false, ovValid = true;
  const ovHere = () => { const s = sel(); return s.rangeCount && s.isCollapsed && ov && s.anchorNode === ov.node && s.anchorOffset === ov.off; };
  const ovAll = () => { const o = {}; TOGGLE_CMDS.forEach(c => { o[c] = caretFormat(c); }); return o; };
  /* at a plain caret, fix what the toolbar shows right now as the format of whatever gets typed next
     (so a style the browser would otherwise drag along from the line above cannot sneak in) */
  function ovEnsure() {
    const s = sel(); if (!s.rangeCount || !s.isCollapsed || !inBody(s.anchorNode)) return;
    if (ov && ovHere()) return;
    const el = s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement;
    if (el && el.closest && el.closest('.codecard,.promptcard,.linkcard')) { ov = null; return; }
    ov = { cmds: ovAll(), node: s.anchorNode, off: s.anchorOffset };
  }
  function ovMark() { const s = sel(); if (ov && s.rangeCount) { ov.node = s.anchorNode; ov.off = s.anchorOffset; } }
  function ovFix(n) {
    if (!ov || !n) return;
    const s = sel(); if (!s.rangeCount || !s.isCollapsed) { ov = null; return; }
    const nd = s.anchorNode, off = s.anchorOffset;
    if (!nd || nd.nodeType !== 3 || off < n) { ov = null; return; }
    const r = document.createRange(); r.setStart(nd, off - n); r.setEnd(nd, off);
    s.removeAllRanges(); s.addRange(r);
    Object.keys(ov.cmds).forEach(c => { let st; try { st = document.queryCommandState(c); } catch (_) { return; } if (st !== ov.cmds[c]) document.execCommand(c, false); });
    if (ov.sty) { const cur = sel(); if (cur.rangeCount && !cur.isCollapsed) { const f = cur.getRangeAt(0).startContainer; applyPendingStyles(f.nodeType === 3 ? f : (f.firstChild || f)); } }
    s.collapseToEnd(); ovMark();
  }
  /* font / size / highlight chosen at a plain caret: remembered with the toggles and applied to what is typed next */
  function setPending(kind, val) {
    ovEnsure();
    if (!ov) { opts.toast('Not available inside this card.'); return; }
    (ov.sty || (ov.sty = {}))[kind] = val; ovMark(); updateToolbar();
  }
  const hlOf = t => { for (let e = t.parentElement; e && e !== body; e = e.parentElement) if (e.style && e.style.backgroundColor) return e; return null; };
  function unhighlight(r) {          // really takes the highlight off the chosen text (a child can't hide a parent's colour, so the parent is split)
    let sc = r.startContainer, so = r.startOffset, ec = r.endContainer, eo = r.endOffset;
    if (ec.nodeType === 3 && eo < ec.length) ec.splitText(eo);
    if (sc.nodeType === 3 && so > 0) { const n = sc.splitText(so); if (ec === sc) ec = n; sc = n; }
    const range = document.createRange();
    range.setStart(sc, sc.nodeType === 3 ? 0 : so); range.setEnd(ec, ec.nodeType === 3 ? ec.length : eo);
    const nodes = [], w = document.createTreeWalker(body, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) if (n.data && range.intersectsNode(n)) nodes.push(n);
    nodes.forEach(t => {
      for (let a = hlOf(t), guard = 0; a && guard < 20; a = hlOf(t), guard++) {
        const before = document.createRange(); before.setStart(a, 0); before.setEndBefore(t.parentNode === a ? t : t);
        const f1 = before.extractContents(); if (f1.textContent) { const c = a.cloneNode(false); c.appendChild(f1); a.before(c); }
        const after = document.createRange(); after.setStartAfter(t); after.setEnd(a, a.childNodes.length);
        const f2 = after.extractContents(); if (f2.textContent) { const c = a.cloneNode(false); c.appendChild(f2); a.after(c); }
        a.style.removeProperty('background-color'); a.style.removeProperty('background');
        if (!a.getAttribute('style')) a.removeAttribute('style');
        if (a.tagName === 'SPAN' && !a.attributes.length) { while (a.firstChild) a.before(a.firstChild); a.remove(); }
      }
    });
    if (nodes.length) { const rr = document.createRange(); rr.setStart(nodes[0], 0); rr.setEnd(nodes[nodes.length - 1], nodes[nodes.length - 1].length); sel().removeAllRanges(); sel().addRange(rr); }
  }
  function highlightSelection(v) {
    const r = currentRange(); if (!r) return;
    if (v === 'none') { unhighlight(r); changed(); return; }
    document.execCommand('styleWithCSS', false, true); document.execCommand('hiliteColor', false, v); document.execCommand('styleWithCSS', false, false); changed();
  }
  function applyHighlight(v) {
    const r = currentRange(); if (!r) return;
    if (r.collapsed) setPending('hl', v); else highlightSelection(v);
  }
  function applyFont(v) {
    const r = currentRange(); if (!r) return;
    if (r.collapsed) setPending('font', v); else exec('fontName', v);
  }
  const colorKey = c => { const p = document.createElement('span'); p.style.backgroundColor = c; return p.style.backgroundColor; };
  function effectiveBg(el) { for (let e = el; e && e !== body; e = e.parentElement) { const b = getComputedStyle(e).backgroundColor; if (b && b !== 'rgba(0, 0, 0, 0)' && b !== 'transparent') return b; } return ''; }
  function applyPendingStyles(t) {   // t: the text node holding what was just typed (selected)
    const el = t.parentElement; if (!el || !ov || !ov.sty) return;
    const st = ov.sty;
    if (st.size && getComputedStyle(el).fontSize !== st.size) sizeOnSelection(parseInt(st.size, 10));
    if (st.font) { const fam = getComputedStyle(el).fontFamily.replace(/["']/g, '').toLowerCase(); if (fam !== st.font.replace(/["']/g, '').toLowerCase()) document.execCommand('fontName', false, st.font); }
    if (st.hl) {
      if (st.hl === 'none') { if (effectiveBg(el)) { const rr = currentRange(); if (rr) unhighlight(rr); } }
      else if (effectiveBg(el) !== colorKey(st.hl)) { document.execCommand('styleWithCSS', false, true); document.execCommand('hiliteColor', false, st.hl); document.execCommand('styleWithCSS', false, false); }
    }
  }
  // what the next typed character will really look like at a plain caret (queryCommandState is unreliable on empty lines / run edges)
  function caretFormat(cmd) {
    if (ov && ovHere() && cmd in ov.cmds) return ov.cmds[cmd];
    const s = sel(); let el = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement);
    if (!el || !body.contains(el)) { try { return document.queryCommandState(cmd); } catch (_) { return false; } }
    const cs = getComputedStyle(el);
    if (cmd === 'bold') return cs.fontWeight === 'bold' || parseInt(cs.fontWeight, 10) >= 600;
    if (cmd === 'italic') return cs.fontStyle === 'italic' || cs.fontStyle === 'oblique';
    const want = cmd === 'underline' ? 'underline' : 'line-through';
    for (let n = el; n && n !== body; n = n.parentElement) { const d = getComputedStyle(n).textDecorationLine || ''; if (d.includes(want)) return true; }
    return false;
  }
  function exec(cmd, val) { focusBody();
    const r0 = TOGGLE_CMDS.includes(cmd) ? currentRange() : null;
    if (r0 && r0.collapsed) {            // plain caret: remember the choice for the next typed characters
      ovEnsure();
      if (!ov) { ov = { cmds: ovAll(), node: null, off: 0 }; }
      ov.cmds[cmd] = !ov.cmds[cmd]; ovMark(); updateToolbar(); return true;
    }
    const jf = /^justify/.test(cmd); if (jf) document.execCommand('styleWithCSS', false, true); const ok = document.execCommand(cmd, false, val); if (jf) document.execCommand('styleWithCSS', false, false); saveRange(); changed(); updateToolbar(); return ok; }

  function uncheck(uls) { uls.forEach(u => { u.classList.remove('checklist'); u.removeAttribute('data-title'); u.querySelectorAll('li.done').forEach(li => li.classList.remove('done')); if (!u.getAttribute('class')) u.removeAttribute('class'); }); }
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

  /* ---------- code / prompt / link cards ---------- */
  const TEXTCARD = '.codecard, .promptcard';
  const textCardOf = n => { const el = n && (n.nodeType === 1 ? n : n.parentElement); const c = el && el.closest && el.closest(TEXTCARD); return c && body.contains(c) ? c : null; };
  const cardText = card => { const c = card.cloneNode(true); c.querySelectorAll('br').forEach(b => b.replaceWith('\n')); return c.textContent.replace(/\n$/, ''); };
  // put a block card below the current line (or in place of an empty one) and keep a free line under it for typing
  function placeBlockCard(card, r) {
    let b = r ? topBlock(r.startContainer) : null;
    if (!b || b === body) body.appendChild(card);
    else if (/^(DIV|P)$/.test(b.tagName) && !b.classList.contains('callout') && !b.matches('.codecard, .promptcard, .linkcard') && !b.textContent.trim() && !b.querySelector('img,ul,ol')) b.replaceWith(card);
    else b.after(card);
    if (!card.nextSibling) { const d = document.createElement('div'); d.appendChild(document.createElement('br')); card.after(d); }
  }
  function toggleTextCard(kind) {
    focusBody();
    let r = currentRange(); if (!r) { caretIn(body, true); r = currentRange(); }
    const ex = textCardOf(r.startContainer);
    if (ex) {                                                       // second press: back to normal lines
      const frag = document.createDocumentFragment();
      cardText(ex).split('\n').forEach(l => { const d = document.createElement('div'); if (l) d.textContent = l; else d.appendChild(document.createElement('br')); frag.appendChild(d); });
      const lastD = frag.lastChild; ex.replaceWith(frag); if (lastD) caretIn(lastD, true);
      changed(); updateToolbar(); return;
    }
    const card = document.createElement('div'); card.className = kind;
    const picked = r.collapsed ? '' : r.toString();
    if (picked) { const lines = picked.split('\n'); lines.forEach((l, i) => { if (i) card.appendChild(document.createElement('br')); card.appendChild(document.createTextNode(l)); }); r.deleteContents(); }
    else card.appendChild(document.createElement('br'));
    placeBlockCard(card, r);
    caretIn(card, true); changed(); updateToolbar();
  }
  function insertLinkCard(url) {
    let host = ''; try { host = new URL(url).hostname.replace(/^www\./, ''); } catch (_) {}
    const r = currentRange();
    const card = document.createElement('div'); card.className = 'linkcard'; card.setAttribute('data-host', host);
    const a = document.createElement('a'); a.href = url; a.textContent = url.replace(/^https?:\/\//i, '').replace(/\/$/, ''); card.appendChild(a);
    placeBlockCard(card, r);
    const nxt = card.nextSibling; if (nxt) caretIn(nxt, false);
    changed();
  }
  function copyText(text) {
    const done = () => opts.toast('Copied');
    const fallback = () => { const t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;opacity:0;top:0;left:0'; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (_) { opts.toast('Could not copy'); } t.remove(); const s = savedRange; if (s) { focusBody(); } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  }
  const inCopyZone = (card, e) => { const r = card.getBoundingClientRect(); return e.clientX > r.right - 48 && e.clientY < r.top + 40; };
  const linkCardOf = n => { const el = n && (n.nodeType === 1 ? n : n.parentElement); const c = el && el.closest && el.closest('.linkcard'); return c && body.contains(c) ? c : null; };
  // Enter inside a link card must not split / copy the card: it just starts a fresh line under it
  function onEnterInLinkCard(e) {
    const r = currentRange(); if (!r) return false;
    const card = linkCardOf(r.startContainer); if (!card) return false;
    e.preventDefault();
    let nxt = card.nextElementSibling;
    if (!(nxt && nxt.tagName === 'DIV' && !nxt.getAttribute('class') && !nxt.textContent.trim() && !nxt.querySelector('img,ul,ol'))) { nxt = document.createElement('div'); nxt.appendChild(document.createElement('br')); card.after(nxt); }
    caretIn(nxt, false); changed(); return true;
  }
  function onBeforeInput(e) {
    if (e.target === body && ov) ovValid = composing || /Composition/.test(e.inputType) || ovHere();   // only keep the choice if the caret hasn't moved since
    if (e.target === body && e.inputType === 'insertText' && !composing) { if (ov && !ovValid) ov = null; ovEnsure(); ovValid = true; }
    if (e.target === body) autoCap(e);
    if (e.target !== body || e.inputType !== 'insertParagraph') return;
    if (onEnterInLinkCard(e)) return;
    onEnterInTextCard(e);
  }
  // Enter inside a code / prompt card adds a line inside it; Enter on an empty last line leaves the card
  function onEnterInTextCard(e) {
    const r = currentRange(); if (!r) return false;
    const card = textCardOf(r.startContainer); if (!card) return false;
    e.preventDefault();
    const atEnd = r.collapsed && (() => { const t = document.createRange(); t.selectNodeContents(card); t.setStart(r.startContainer, r.startOffset); return t.toString().replace(/\n/g, '') === ''; })();
    if (atEnd && cardText(card).endsWith('\n')) {
      for (let n = card.lastChild; n;) {                       // drop the blank line(s) at the end of the card
        if (n.nodeName === 'BR') { const p = n.previousSibling; n.remove(); n = p; }
        else if (n.nodeType === 3 && /\n$/.test(n.textContent)) { n.textContent = n.textContent.replace(/\n+$/, ''); if (!n.textContent) { const p = n.previousSibling; n.remove(); n = p; } else break; }
        else break;
      }
      if (!card.firstChild) card.appendChild(document.createElement('br'));
      let nxt = card.nextSibling; if (!nxt) { nxt = document.createElement('div'); nxt.appendChild(document.createElement('br')); card.after(nxt); }
      caretIn(nxt, false); changed(); return true;
    }
    document.execCommand('insertLineBreak'); changed(); return true;
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
    if (!r) return;
    if (r.collapsed) { setPending('size', (Math.min(96, Math.max(8, parseInt(key, 10) || 16))) + 'px'); return; }   // plain caret: applies to what is typed next
    sizeOnSelection(key);
  }
  function sizeOnSelection(key) {
    document.execCommand('fontSize', false, '7');
    const spans = [];
    body.querySelectorAll('font[size="7"]').forEach(f => {
      const s = document.createElement('span');
      s.style.fontSize = (Math.min(96, Math.max(8, parseInt(key, 10) || 16))) + 'px';
      if (f.getAttribute('face')) s.style.fontFamily = f.getAttribute('face');   // keep an already chosen font
      if (f.getAttribute('color')) s.style.color = f.getAttribute('color');
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

  const BLOCK_SEL = 'div,p,li,h1,h2,h3,h4,h5,h6,blockquote';
  function applyLineHeight(key) {
    const r = currentRange(); if (!r) return;
    const px = parseInt(key, 10), set = new Set();
    const blockOf = n => { const el = n.nodeType === 1 ? n : n.parentElement; const b = el && el.closest(BLOCK_SEL); return b && body.contains(b) && b !== body ? b : null; };
    const a = blockOf(r.startContainer), z = blockOf(r.endContainer);
    if (a) set.add(a); if (z) set.add(z);
    if (!r.collapsed) body.querySelectorAll(BLOCK_SEL).forEach(b => { if (r.intersectsNode(b) && !b.querySelector(BLOCK_SEL)) set.add(b); });
    if (!set.size) { opts.toast('Tap inside a line first.'); return; }
    set.forEach(b => {
      const card = b.closest('.codecard,.promptcard,.linkcard'); const t = card || b;
      if (px > 0) t.style.lineHeight = px + 'px'; else { t.style.removeProperty('line-height'); if (!t.getAttribute('style')) t.removeAttribute('style'); }
    });
    changed();
  }

  /* auto capitalization: first letter of a line / sentence, and a lone "i" */
  let pendingCap = false;
  function capNow() {            // runs after the browser inserted one lowercase letter: replace it by its capital
    pendingCap = false;
    const s = sel(); if (!s.rangeCount || !s.isCollapsed) return;
    const nd = s.anchorNode, off = s.anchorOffset;
    if (!nd || nd.nodeType !== 3 || off < 1) return;
    const ch = nd.textContent[off - 1]; if (!/[a-z]/.test(ch)) return;
    const r = document.createRange(); r.setStart(nd, off - 1); r.setEnd(nd, off);
    s.removeAllRanges(); s.addRange(r); document.execCommand('insertText', false, ch.toUpperCase());
  }
  function autoCap(e) {
    pendingCap = false;
    if (!opts.autoCap || !opts.autoCap() || e.inputType !== 'insertText' || !e.data || e.data.length !== 1) return;
    const r = currentRange(); if (!r || !r.collapsed) return;
    const el = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
    if (!el || el.closest('.codecard,.promptcard,.linkcard,a,pre,code')) return;
    const blk = el.closest(BLOCK_SEL) || body;
    const pre = document.createRange(); pre.selectNodeContents(blk); pre.setEnd(r.startContainer, r.startOffset);
    const before = pre.toString().replace(/\u200b/g, '');
    const ch = e.data;
    if (/[a-z]/.test(ch) && /(^\s*$|[.!?]["')\]]*\s+$)/.test(before)) {
      pendingCap = true; return;      // the browser inserts the letter normally (keeping its format); input() swaps it for the capital
    }
    if (/[\s.,!?;:')]/.test(ch) && /(^|[\s(])i$/.test(before) && r.startContainer.nodeType === 3 && r.startOffset > 0) {
      const t = r.startContainer, o = r.startOffset;
      const rr = document.createRange(); rr.setStart(t, o - 1); rr.setEnd(t, o);
      sel().removeAllRanges(); sel().addRange(rr);
      document.execCommand('insertText', false, 'I');
    }
  }

  async function insertLink() {
    saveRange();
    const at = savedRange ? savedRange.cloneRange() : null;   // the dialog and its closing move the caret, so remember where it was
    const hadText = at && !at.collapsed;
    let url = await opts.askLink();
    if (!url) { forceRestore(at); return; }
    url = url.trim();
    if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = (url.includes('@') && !url.includes('/') ? 'mailto:' : 'https://') + url;
    if (!safeUrl(url)) { opts.toast('Only http(s) and mailto links are supported.'); forceRestore(at); return; }
    forceRestore(at);
    if (hadText) document.execCommand('createLink', false, url);
    else {
      if (/^https?:/i.test(url)) { insertLinkCard(url); return; }
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
  let imgAt = null;   // caret position when the picture button was pressed (the file picker moves it)
  async function attachImage(file) {
    if (!file || !/^image\/(png|jpe?g|gif|webp|bmp)/i.test(file.type)) { opts.toast('Please choose a PNG, JPG, GIF or WebP image.'); return; }
    try {
      const img = await loadImage(file);
      const max = 1280, k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const data = c.toDataURL('image/webp', 0.85);
      forceRestore(imgAt);
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
          if (['bold', 'italic', 'underline', 'strikeThrough', 'justifyLeft', 'justifyCenter', 'justifyRight'].includes(cmd)) on = (TOGGLE_CMDS.includes(cmd) && currentRange().collapsed) ? caretFormat(cmd) : document.queryCommandState(cmd);
        } catch (_) {}
        if (cmd === 'insertUnorderedList') on = listsInSelection('ul').some(u => !u.classList.contains('checklist'));
        if (cmd === 'insertOrderedList') on = listsInSelection('ol').length > 0;
        if (cmd === 'checklist') on = listsInSelection('ul').some(u => u.classList.contains('checklist'));
        if (/^h[123]$/.test(cmd)) { const s0 = sel(); const e0 = s0.anchorNode && (s0.anchorNode.nodeType === 1 ? s0.anchorNode : s0.anchorNode.parentElement); const hh = e0 && e0.closest && e0.closest('h1,h2,h3'); on = !!(hh && body.contains(hh) && hh.tagName.toLowerCase() === cmd); }
        if (cmd === 'callout') { const r0 = currentRange(); on = !!(r0 && calloutOf(r0.startContainer)); }
        if (cmd === 'codeblock' || cmd === 'promptcard') { const r0 = currentRange(), tc = r0 && textCardOf(r0.startContainer); on = !!(tc && tc.classList.contains(cmd === 'codeblock' ? 'codecard' : 'promptcard')); }
      }
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    if (active) {
      const s = sel(); let el = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement);
      const h = el && el.closest && el.closest('h1,h2,h3');
      const bs = root.querySelector('#blockSel'); if (bs) bs.value = h && body.contains(h) ? h.tagName.toLowerCase() : 'p';
    }
    paintStyleButtons(active);
  }
  /* Size / Font / Highlight buttons light up like the others; Size shows the number in use */
  function paintStyleButtons(active) {
    const dd = id => root.querySelector('#' + id + ' .dd-btn');
    const bS = dd('ddSize'), bF = dd('ddFont'), bH = dd('ddHl'); if (!bS || !bF || !bH) return;
    let size = '', font = false, hl = false;
    if (active) {
      const s = sel(); const el = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement);
      const pend = ov && ovHere() && ov.sty ? ov.sty : null;
      if (el && body.contains(el)) {
        const fs = el.closest('[style*="font-size"]'); if (fs && body.contains(fs) && fs.style.fontSize) size = fs.style.fontSize;
        font = !!(el.closest('[style*="font-family"], font[face]') && body.contains(el.closest('[style*="font-family"], font[face]')));
        hl = !!hlOf(s.anchorNode.nodeType === 3 ? s.anchorNode : (s.anchorNode.firstChild || s.anchorNode));
      }
      if (pend) { if (pend.size) size = pend.size; if (pend.font) font = true; if (pend.hl) hl = pend.hl !== 'none'; }
    }
    const lab = bS.querySelector('.dd-l'); if (lab) lab.textContent = size ? parseInt(size, 10) + ' px' : 'Size';
    bS.classList.toggle('on', !!size); bF.classList.toggle('on', font); bH.classList.toggle('on', hl);
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
    if (pendingCap && e.inputType === 'insertText') capNow();
    if (ov && !ovValid) ov = null;
    if (ov && e.inputType === 'insertText' && e.data) ovFix(e.data.length);
    if (ov && /^insert(Paragraph|LineBreak)$/.test(e.inputType)) { const s1 = sel(); if (s1.rangeCount && s1.isCollapsed) { ovMark(); updateToolbar(); } else ov = null; }   // Enter keeps the chosen format for the new line
    if (ov && /^delete/.test(e.inputType)) { const s0 = sel(); if (s0.rangeCount && s0.isCollapsed) { ovMark(); updateToolbar(); } else ov = null; }   // deleting a letter keeps the chosen format
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
    const tc = e.target && e.target.nodeType === 1 && e.target.matches && e.target.matches(TEXTCARD) ? e.target : null;
    if (tc && inCopyZone(tc, e)) { copyText(cardText(tc)); tc.classList.add('copied'); setTimeout(() => { tc.classList.remove('copied'); if (!tc.getAttribute('class')) tc.removeAttribute('class'); }, 1300); return; }
    const lc = e.target && e.target.classList && e.target.classList.contains('linkcard') ? e.target : null;
    if (lc) { const a0 = lc.querySelector('a[href]'); if (a0) window.open(a0.href, '_blank', 'noopener'); return; }
    const li = e.target;
    if (body.isContentEditable && li && li.tagName === 'LI' && li.parentElement.classList.contains('checklist') && (() => { const dx = e.clientX - li.getBoundingClientRect().left; return dx >= 22 && dx < 52; })()) {
      li.classList.toggle('done'); changed(); clScheduleLayout();
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
    const r0 = currentRange(), inCard = r0 && textCardOf(r0.startContainer);
    if (inCard && text) { document.execCommand('insertHTML', false, text.replace(/\r/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')); changed(); return; }
    if (single && /^https?:\/\/\S+$/i.test(text.trim()) && safeUrl(text.trim())) { insertLinkCard(text.trim()); return; }
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
    if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) { const r0 = currentRange(); if (r0 && textCardOf(r0.startContainer)) { e.preventDefault(); document.execCommand('insertText', false, '  '); changed(); return; } }
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) { const r1 = currentRange(); if (r1 && (textCardOf(r1.startContainer) || linkCardOf(r1.startContainer))) return; if (lineAboveTopList(e, true)) return; maybeExitCallout(e); return; }
    if (e.key === 'ArrowUp' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) { lineAboveTopList(e, false); return; }
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === 'k') { e.preventDefault(); insertLink(); }
    else if (e.shiftKey && (e.key === '8' || e.key === '*')) { e.preventDefault(); toggleBullet(); }
    else if (e.shiftKey && (e.key === '7' || e.key === '&')) { e.preventDefault(); toggleNumbered(); }
    else if (e.shiftKey && (e.key === '9' || e.key === '(')) { e.preventDefault(); toggleChecklist(); }
  }


  /* ---------- checklist controls: title + progress header, drag handle, remove ----------
     They live in an overlay layer next to the editable area (never inside the note HTML), positioned over each list. */
  const CL = { layer: null, scroller: null, heads: new Set(), ctls: new Set(), raf: 0, mo: null, ro: null, drag: null, wired: false };
  const CL_SVG = {
    grip: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.7"/><circle cx="15" cy="6" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="18" r="1.7"/><circle cx="15" cy="18" r="1.7"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    sort: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 5v14M7 19l-3-3M7 19l3-3"/><path d="M14 6h6M14 12h4.5M14 18h3"/></svg>'
  };
  const clScheduleLayout = () => { if (CL.raf) return; CL.raf = requestAnimationFrame(() => { CL.raf = 0; clLayout(); }); };
  const clLists = () => Array.from(body.querySelectorAll('ul.checklist'));
  const clTop = ul => !(ul.parentElement && ul.parentElement.closest('li'));
  const clItems = ul => Array.from(ul.children).filter(c => c.tagName === 'LI');
  function clMakeHead(ul) {
    const el = document.createElement('div'); el.className = 'cl-head';
    el.innerHTML = '<span class="cl-fill"></span><input class="cl-title" type="text" maxlength="60" placeholder="Checklist" aria-label="Checklist title" autocomplete="off" enterkeyhint="done"><button type="button" class="cl-sort" title="Sort: completed last" aria-label="Sort: completed last">' + CL_SVG.sort + '</button><span class="cl-count" aria-label="Completed items"></span>';
    const H = { el, ul, title: el.querySelector('.cl-title'), fill: el.querySelector('.cl-fill'), count: el.querySelector('.cl-count'), sort: el.querySelector('.cl-sort') };
    H.title.addEventListener('input', () => {
      const v = H.title.value.replace(/[<>]/g, '').slice(0, 60);
      if (v.trim()) H.ul.setAttribute('data-title', v); else H.ul.removeAttribute('data-title');
      changed();
    });
    H.title.addEventListener('keydown', ev => {
      if (ev.key !== 'Enter') return;
      ev.preventDefault(); const li = clItems(H.ul)[0]; H.title.blur();
      if (li) { focusBody(); const r = document.createRange(); r.selectNodeContents(li); r.collapse(true); const s = sel(); s.removeAllRanges(); s.addRange(r); saveRange(); }
    });
    H.sort.addEventListener('mousedown', ev => ev.preventDefault());
    H.sort.addEventListener('click', () => {
      const items = clItems(H.ul), isDone = li => li.classList.contains('done');
      const doneLast = items.every((li, i) => i === 0 || !(isDone(items[i - 1]) && !isDone(li)));
      const open = items.filter(li => !isDone(li)), done = items.filter(isDone);
      (doneLast ? [...done, ...open] : [...open, ...done]).forEach(li => H.ul.append(li));
      changed(); clLayout();
    });
    CL.layer.append(el); CL.heads.add(H); return H;
  }
  function clMakeCtl(li) {
    const h = document.createElement('button'); h.type = 'button'; h.className = 'cl-h'; h.title = 'Drag to reorder'; h.setAttribute('aria-label', 'Drag to reorder'); h.innerHTML = CL_SVG.grip;
    const x = document.createElement('button'); x.type = 'button'; x.className = 'cl-x'; x.title = 'Remove item'; x.setAttribute('aria-label', 'Remove item'); x.innerHTML = CL_SVG.x;
    const C = { li, h, x };
    [h, x].forEach(b => b.addEventListener('mousedown', ev => ev.preventDefault()));
    x.addEventListener('click', () => {
      const ul = li.parentElement; li.remove();
      if (ul && !clItems(ul).length) { const p = document.createElement('div'); p.innerHTML = '<br>'; ul.replaceWith(p); }
      changed(); clLayout();
    });
    h.addEventListener('pointerdown', ev => {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      ev.preventDefault(); try { h.setPointerCapture(ev.pointerId); } catch (_) {}
      CL.drag = { li, id: ev.pointerId }; li.classList.add('cl-drag');
    });
    h.addEventListener('pointermove', ev => {
      const d = CL.drag; if (!d || d.id !== ev.pointerId) return;
      const ul = d.li.parentElement; if (!ul) return;
      let before = null;
      for (const s of clItems(ul)) { if (s === d.li) continue; const r = s.getBoundingClientRect(); if (ev.clientY < r.top + r.height / 2) { before = s; break; } }
      if (before) { if (d.li.nextElementSibling !== before) ul.insertBefore(d.li, before); }
      else if (ul.lastElementChild !== d.li) ul.append(d.li);
      const sr = CL.scroller.getBoundingClientRect();
      if (ev.clientY < sr.top + 50) CL.scroller.scrollTop -= 12; else if (ev.clientY > sr.bottom - 50) CL.scroller.scrollTop += 12;
      clLayout();
    });
    const end = ev => { const d = CL.drag; if (!d || d.id !== ev.pointerId) return; CL.drag = null; d.li.classList.remove('cl-drag'); if (!d.li.getAttribute('class')) d.li.removeAttribute('class'); changed(); clLayout(); };
    h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
    CL.layer.append(h, x); CL.ctls.add(C); return C;
  }
  function clLayout() {
    if (!body || !CL.layer || root.hidden) return;
    const sc = CL.scroller, sr = sc.getBoundingClientRect(), st = sc.scrollTop;
    const ro = body.getAttribute('contenteditable') === 'false';
    CL.layer.classList.toggle('ro', ro);
    const lists = clLists(), liveL = new Set();
    lists.forEach(ul => {
      const r = ul.getBoundingClientRect(); if (!r.width) return;
      let H = null;
      if (clTop(ul)) {
      CL.heads.forEach(x => { if (x.ul === ul) H = x; });
      if (!H) H = clMakeHead(ul);
      H.el.style.left = Math.round(r.left - sr.left) + 'px'; H.el.style.top = Math.round(r.top - sr.top + st - 42) + 'px'; H.el.style.width = Math.round(r.width) + 'px';
      const hItems = clItems(ul), done = hItems.filter(li => li.classList.contains('done')).length;
      H.count.textContent = done + '/' + hItems.length;
      H.fill.style.width = (hItems.length ? Math.round(done / hItems.length * 100) : 0) + '%';
      if (document.activeElement !== H.title) H.title.value = ul.getAttribute('data-title') || '';
      H.title.readOnly = ro;
      H.el.dataset.live = '1'; liveL.add(H);
      }
      const items = clItems(ul);
      items.forEach(li => {
        let C = null; CL.ctls.forEach(x => { if (x.li === li) C = x; });
        if (!C) C = clMakeCtl(li);
        const lr = li.getBoundingClientRect(), lh = parseFloat(getComputedStyle(li).lineHeight) || 24;
        const top = Math.round(lr.top - sr.top + st + 3 + lh / 2 - 14) + 'px';
        C.h.style.left = Math.round(lr.left - sr.left) + 'px'; C.h.style.top = top;
        C.x.style.left = Math.round(lr.right - sr.left - 26) + 'px'; C.x.style.top = top;
        C.live = true;
      });
    });
    CL.heads.forEach(H => { if (!liveL.has(H)) { H.el.remove(); CL.heads.delete(H); } });
    CL.ctls.forEach(C => { if (!C.live || !body.contains(C.li)) { C.h.remove(); C.x.remove(); CL.ctls.delete(C); } else C.live = false; });
  }
  function clAttach() {
    if (!CL.layer) return;
    if (CL.mo) CL.mo.disconnect(); if (CL.ro) CL.ro.disconnect();
    CL.mo = new MutationObserver(clScheduleLayout);
    CL.mo.observe(body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'data-title'], characterData: true });
    if (window.ResizeObserver) { CL.ro = new ResizeObserver(clScheduleLayout); CL.ro.observe(body); }
    clScheduleLayout();
  }
  function clInit() {
    CL.layer = root.querySelector('#clLayer'); CL.scroller = root.querySelector('#edScroll');
    if (!CL.layer || !CL.scroller) return;
    if (!CL.wired) { CL.wired = true; window.addEventListener('resize', clScheduleLayout); root.addEventListener('load', clScheduleLayout, true); }
    clAttach();
  }

  function init(o) {
    opts = o; root = o.root; body = o.body;
    clInit();
    const tb = root.querySelector('#toolbar');
    tb.addEventListener('mousedown', e => { if (!e.target.closest('select, label, input')) e.preventDefault(); });
    tb.addEventListener('click', e => {
      const b = e.target.closest('[data-cmd]'); if (!b) return;
      const cmd = b.dataset.cmd; restoreRange();
      if (cmd === 'insertUnorderedList') toggleBullet();
      else if (cmd === 'insertOrderedList') toggleNumbered();
      else if (cmd === 'checklist') toggleChecklist();
      else if (cmd === 'callout') toggleCallout();
      else if (cmd === 'codeblock') toggleTextCard('codecard');
      else if (cmd === 'promptcard') toggleTextCard('promptcard');
      else if (cmd === 'sticker') openSticker(b, 'Insert a sticker', '', s => insertSticker(s));
      else if (/^h[123]$/.test(cmd)) { const cur = (document.queryCommandValue('formatBlock') || '').toLowerCase().replace(/[<>]/g, ''); exec('formatBlock', '<' + (cur === cmd ? 'p' : cmd) + '>'); }
      else if (cmd === 'link') insertLink();
      else if (cmd === 'image') { saveRange(); imgAt = savedRange ? savedRange.cloneRange() : null; root.querySelector('#imgInput').click(); }
      else exec(cmd);
    });
    root.querySelectorAll('.ed-top [data-cmd]').forEach(b => {
      b.addEventListener('mousedown', e => e.preventDefault());
      b.addEventListener('click', () => { restoreRange(); exec(b.dataset.cmd); });
    });
    const withRange = fn => () => { restoreRange(); fn(); updateToolbar(); };
    root.querySelector('#blockSel').addEventListener('change', e => { const v = e.target.value; withRange(() => exec('formatBlock', '<' + v + '>'))(); });
    root.querySelector('#lineSel').addEventListener('change', e => { const v = e.target.value; if (v !== '') withRange(() => applyLineHeight(v))(); e.target.value = ''; });
    root.querySelector('#fontSel').addEventListener('change', e => { const v = e.target.value; if (v) withRange(() => applyFont(v))(); e.target.value = ''; });
    root.querySelector('#sizeSel').addEventListener('change', e => { const v = e.target.value; if (v) withRange(() => applySize(v))(); e.target.value = ''; });
    /* font / size / highlight: drop-down menus (below the button on desktop, popping up above it on phones) */
    (function initDropdowns() {
      const menu = document.getElementById('ddMenu'), layer = document.getElementById('editorLayer');
      if (!menu || !layer) return;
      let openFor = null;
      const close = () => { menu.hidden = true; if (openFor) { const b = openFor.querySelector('.dd-btn'); b.setAttribute('aria-expanded', 'false'); b.classList.remove('open'); } openFor = null; };
      const pick = (wrap, val) => { const s = root.querySelector('#' + wrap.dataset.for); s.value = val; s.dispatchEvent(new Event('change')); close(); };
      function open(wrap) {
        const s = root.querySelector('#' + wrap.dataset.for), btn = wrap.querySelector('.dd-btn');
        menu.textContent = '';
        Array.from(s.options).filter(o => o.value !== '').forEach(o => {
          const it = document.createElement('button'); it.type = 'button'; it.setAttribute('role', 'option');
          if (wrap.id === 'ddHl') { const dot = document.createElement('span'); dot.className = 'dd-dot'; if (o.value !== 'none') dot.style.background = o.value; else dot.classList.add('none'); it.append(dot); }
          const tx = document.createElement('span'); tx.textContent = o.textContent; if (wrap.id === 'ddFont') tx.style.fontFamily = o.value; it.append(tx);
          it.addEventListener('mousedown', ev => ev.preventDefault());
          it.addEventListener('click', () => pick(wrap, o.value));
          menu.append(it);
        });
        menu.hidden = false; openFor = wrap; btn.setAttribute('aria-expanded', 'true'); btn.classList.add('open');
        const L = layer.getBoundingClientRect(), r = btn.getBoundingClientRect(), up = window.matchMedia('(max-width: 899px)').matches;
        const w = menu.offsetWidth;
        menu.style.left = Math.round(Math.max(8, Math.min(r.left - L.left, L.width - w - 8))) + 'px';
        if (up) { menu.style.top = 'auto'; menu.style.bottom = Math.round(L.bottom - r.top + 6) + 'px'; menu.style.maxHeight = Math.max(120, Math.min(260, r.top - L.top - 12)) + 'px'; }
        else { menu.style.bottom = 'auto'; menu.style.top = Math.round(r.bottom - L.top + 6) + 'px'; menu.style.maxHeight = Math.max(120, Math.min(300, L.bottom - r.bottom - 14)) + 'px'; }
      }
      root.querySelectorAll('.dd').forEach(wrap => {
        const btn = wrap.querySelector('.dd-btn');
        btn.addEventListener('mousedown', ev => ev.preventDefault());
        btn.addEventListener('click', ev => { ev.stopPropagation(); if (openFor === wrap) close(); else { close(); open(wrap); } });
      });
      document.addEventListener('click', ev => { if (openFor && !ev.target.closest('.dd, #ddMenu')) close(); });
      document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && openFor) { close(); ev.stopPropagation(); } }, true);
      window.addEventListener('resize', close);
      root.addEventListener('click', ev => { if (openFor && ev.target.closest('#edBar')) close(); });
    })();
    root.querySelector('#hlSel').addEventListener('change', e => {
      const v = e.target.value;
      if (v) withRange(() => applyHighlight(v))();
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
    root.addEventListener('mousedown', e => { const t = e.target; if (t && t.nodeType === 1 && t.matches && t.matches(TEXTCARD) && inCopyZone(t, e)) e.preventDefault(); });
    root.addEventListener('beforeinput', onBeforeInput);
    root.addEventListener('paste', e => { if (e.target === body || body.contains(e.target)) onPaste(e); });
    root.addEventListener('copy', e => { if (e.target === body || inBody(e.target)) onCopyCut(e); });
    root.addEventListener('cut', e => { if (e.target === body || inBody(e.target)) onCopyCut(e); });
    root.addEventListener('keydown', e => { if (e.target === body) onKeydown(e); });
    root.addEventListener('keyup', e => { if (e.target === body) { updateToolbar(); if (e.key.startsWith('Arrow')) hideSuggest(); } });
    root.addEventListener('focusout', e => { if (e.target === body) setTimeout(() => { if (!opts.suggestEl.matches(':hover')) hideSuggest(); }, 150); });
    document.addEventListener('selectionchange', () => { if (ov && !composing && !ovHere()) ov = null; if (currentRange()) { saveRange(); updateToolbar(); } });
    root.addEventListener('compositionstart', e => { if (e.target !== body) return; composing = true; if (!(ov && ovHere())) { ov = null; ovEnsure(); } });
    root.addEventListener('compositionend', e => { if (e.target !== body) return; composing = false; if (ov && e.data) { ovFix(e.data.length); updateToolbar(); } else if (ov) ovMark(); });
    try { document.execCommand('defaultParagraphSeparator', false, 'div'); } catch (_) {}
  }

  // Replace the editable element so the browser's undo stack never leaks between notes.
  function load(html) {
    const fresh = body.cloneNode(false);
    fresh.innerHTML = sanitize(html);
    body.replaceWith(fresh);
    body = fresh; savedRange = null; hideSuggest();
    CL.heads.forEach(H => H.el.remove()); CL.heads.clear(); CL.ctls.forEach(C => { C.h.remove(); C.x.remove(); }); CL.ctls.clear();
    clAttach(); setTimeout(clScheduleLayout, 60);
    return body;
  }

  return { init, load, sanitize, hideSuggest, hideSticker, hideKeyboard, resumeKeyboard, keyboard, saveRange, getHTML: () => sanitize(body.innerHTML), keepCaretVisible, relayout: () => clScheduleLayout(), el: () => body, focus: () => focusBody(), updateToolbar };
})();
