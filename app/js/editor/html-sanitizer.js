/* html-sanitizer.js — whitelist HTML cleaner used for stored notes, pasted content and the editor body. */
const NotesSanitizer = (function () {
  'use strict';
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
        else if (tag === 'OL' && n === 'type' && v === 'a') ok = true;
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
  return { sanitize, safeUrl };
})();
