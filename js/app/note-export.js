/* note-export.js — turn one note into text, Markdown, a PNG image or a PDF, and share or download it.
   No libraries: the image is drawn through an SVG foreignObject, the PDF is written by hand around JPEG slices. */
const NoteExport = (() => {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- text and Markdown ---------- */
  function convert(note, md) {
    const doc = new DOMParser().parseFromString('<body>' + String(note.html || '') + '</body>', 'text/html');
    const out = [];
    const inline = node => {
      let s = '';
      node.childNodes.forEach(ch => {
        if (ch.nodeType === 3) { s += ch.textContent; return; }
        if (ch.nodeType !== 1) return;
        const t = ch.tagName, inner = () => inline(ch);
        if (t === 'BR') s += '\n';
        else if (t === 'IMG') s += md ? '![image]' : '[image]';
        else if (!md) s += (/^(UL|OL)$/.test(t) ? '' : inner());
        else if (t === 'B' || t === 'STRONG') s += '**' + inner() + '**';
        else if (t === 'I' || t === 'EM') s += '*' + inner() + '*';
        else if (t === 'S' || t === 'STRIKE' || t === 'DEL') s += '~~' + inner() + '~~';
        else if (t === 'CODE') s += '`' + inner() + '`';
        else if (t === 'A' && ch.getAttribute('href')) s += '[' + inner() + '](' + ch.getAttribute('href') + ')';
        else if (!/^(UL|OL)$/.test(t)) s += inner();
      });
      return s;
    };
    const list = (ul, depth) => {
      const ordered = ul.tagName === 'OL', check = ul.classList.contains('checklist');
      let i = ordered ? (parseInt(ul.getAttribute('start'), 10) || 1) : 1;
      Array.from(ul.children).forEach(li => {
        if (li.tagName !== 'LI') return;
        const own = document.createElement('div'); Array.from(li.childNodes).forEach(c => { if (!(c.nodeType === 1 && /^(UL|OL)$/.test(c.tagName))) own.append(c.cloneNode(true)); });
        const pre = '  '.repeat(depth) + (check ? (md ? (li.classList.contains('done') ? '- [x] ' : '- [ ] ') : (li.classList.contains('done') ? '☑ ' : '☐ ')) : ordered ? (i++) + '. ' : (md ? '- ' : '• '));
        out.push(pre + inline(own).trim());
        li.querySelectorAll(':scope > ul, :scope > ol').forEach(sub => list(sub, depth + 1));
      });
    };
    const block = node => {
      node.childNodes.forEach(ch => {
        if (ch.nodeType === 3) { if (ch.textContent.trim()) out.push(ch.textContent.trim()); return; }
        if (ch.nodeType !== 1) return;
        const t = ch.tagName;
        if (t === 'UL' || t === 'OL') list(ch, 0);
        else if (/^H[1-6]$/.test(t)) { const s = inline(ch).trim(); out.push(md ? '#'.repeat(Math.min(3, +t[1] + 1)) + ' ' + s : s); }
        else if (t === 'PRE') out.push(md ? '```\n' + ch.textContent.replace(/\n$/, '') + '\n```' : ch.textContent);
        else if (t === 'BLOCKQUOTE') out.push((md ? '> ' : '') + inline(ch).trim());
        else if (t === 'DIV' && ch.querySelector('ul,ol,div,p,h1,h2,h3,pre')) block(ch);
        else if (t === 'BR') out.push('');
        else out.push(inline(ch).trim());
      });
    };
    block(doc.body);
    const title = (note.title || '').trim();
    const body = out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    return (title ? (md ? '# ' + title : title) + '\n\n' : '') + body + '\n';
  }
  const toText = note => convert(note, false);
  const toMarkdown = note => convert(note, true);

  /* ---------- image (PNG) ---------- */
  const CSS = 'font-family:-apple-system,&quot;Segoe UI&quot;,Roboto,Helvetica,Arial,sans-serif;font-size:17px;line-height:1.55;color:#16233b;background:#fffdfb;padding:44px 40px 48px;box-sizing:border-box;width:720px;' ;
  const SHEET = 'h1.nt{font-size:28px;margin:0 0 18px;line-height:1.25}p,div{margin:0}ul,ol{margin:6px 0;padding-left:26px}ul.checklist{list-style:none;padding-left:4px}ul.checklist li:before{content:"\\2610  "}ul.checklist li.done:before{content:"\\2611  "}ul.checklist li.done{text-decoration:line-through;opacity:.6}img{max-width:100%;height:auto;border-radius:10px}pre{background:#f4efe9;border-radius:10px;padding:12px 14px;white-space:pre-wrap;font-family:Menlo,Consolas,monospace;font-size:14px}blockquote{margin:8px 0;padding:6px 14px;border-left:4px solid #e07a73;background:#fdeeeb;border-radius:8px}h1,h2,h3{margin:12px 0 6px}a{color:#4f86d9}.ft{margin-top:28px;padding-top:12px;border-top:1px solid #ece6df;color:#78879d;font-size:13px}';
  function pageHtml(note) {
    const title = (note.title || '').trim();
    return '<div xmlns="http://www.w3.org/1999/xhtml" style="' + CSS + '"><style>' + SHEET + '</style>' + (title ? '<h1 class="nt">' + esc(title) + '</h1>' : '') + '<div>' + toXhtml(note.html || '') + '</div><div class="ft">MochiNote</div></div>';
  }
  function toXhtml(html) { // well-formed markup for the SVG
    const d = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html');
    return new XMLSerializer().serializeToString(d.body).replace(/^<body[^>]*>/, '').replace(/<\/body>$/, '').replace(/ xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, '');
  }
  async function toCanvas(note, scaleHint) {
    const markup = pageHtml(note);
    const probe = document.createElement('div'); probe.style.cssText = 'position:fixed;left:-99999px;top:0;width:720px;visibility:hidden';
    probe.innerHTML = markup.replace(' xmlns="http://www.w3.org/1999/xhtml"', ''); document.body.append(probe);
    const h = Math.max(200, Math.ceil(probe.firstChild.scrollHeight)); probe.remove();
    const scale = Math.min(scaleHint || 2, 14000 / h);
    if (scale < 0.5) throw new Error('This note is too long to turn into one image.');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="' + h + '"><foreignObject width="720" height="' + h + '">' + markup + '</foreignObject></svg>';
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('Could not draw the note.')); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
    const c = document.createElement('canvas'); c.width = Math.round(720 * scale); c.height = Math.round(h * scale);
    const g = c.getContext('2d'); g.fillStyle = '#fffdfb'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
    return c;
  }
  const toBlob = (c, type, q) => new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('Could not create the file.')), type, q));
  async function toPng(note) { return toBlob(await toCanvas(note, 2), 'image/png'); }

  /* ---------- PDF: A4 pages, each a JPEG slice of the note image ---------- */
  async function toPdf(note) {
    const c = await toCanvas(note, 2), W = 595, H = 842, M = 36, drawW = W - 2 * M, pageHpt = H - 2 * M;
    const sliceH = Math.floor(pageHpt * c.width / drawW), pages = [];
    for (let y = 0; y < c.height; y += sliceH) {
      const hh = Math.min(sliceH, c.height - y), s = document.createElement('canvas'); s.width = c.width; s.height = hh;
      const g = s.getContext('2d'); g.fillStyle = '#fffdfb'; g.fillRect(0, 0, s.width, hh); g.drawImage(c, 0, y, c.width, hh, 0, 0, c.width, hh);
      pages.push({ bytes: new Uint8Array(await (await toBlob(s, 'image/jpeg', 0.9)).arrayBuffer()), w: s.width, h: hh });
    }
    const enc = s => new TextEncoder().encode(s), parts = [], offs = []; let len = 0;
    const push = b => { parts.push(b); len += b.length; };
    const obj = (n, body, stream) => { offs[n] = len; push(enc(n + ' 0 obj\n' + body)); if (stream) { push(stream); push(enc('\nendstream')); } push(enc('\nendobj\n')); };
    push(enc('%PDF-1.4\n'));
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Count ' + pages.length + ' /Kids [' + pages.map((_, i) => (3 + i * 3) + ' 0 R').join(' ') + '] >>');
    pages.forEach((p, i) => {
      const pg = 3 + i * 3, ct = pg + 1, im = pg + 2, dh = p.h * drawW / p.w, content = 'q ' + drawW + ' 0 0 ' + dh.toFixed(2) + ' ' + M + ' ' + (H - M - dh).toFixed(2) + ' cm /Im0 Do Q';
      obj(pg, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /XObject << /Im0 ' + im + ' 0 R >> >> /Contents ' + ct + ' 0 R >>');
      obj(ct, '<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream');
      obj(im, '<< /Type /XObject /Subtype /Image /Width ' + p.w + ' /Height ' + p.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + p.bytes.length + ' >>\nstream\n', p.bytes);
    });
    const n = 3 + pages.length * 3, xref = len;
    let x = 'xref\n0 ' + n + '\n0000000000 65535 f \n'; for (let i = 1; i < n; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
    push(enc(x + 'trailer\n<< /Size ' + n + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF'));
    return new Blob(parts, { type: 'application/pdf' });
  }

  /* ---------- share or download ---------- */
  const safeName = note => ((note.title || '').trim() || 'note').replace(/[\\/:*?"<>|\n\r]+/g, ' ').trim().slice(0, 60) || 'note';
  function download(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  async function deliver(blob, name, title) {
    const file = new File([blob], name, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title }); return 'shared'; } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
    }
    download(blob, name); return 'downloaded';
  }
  async function share(note, format) {
    const base = safeName(note), title = (note.title || '').trim() || 'Note';
    if (format === 'txt') {
      const text = toText(note);
      if (navigator.share) { try { await navigator.share({ title, text }); return 'shared'; } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; } }
      return deliver(new Blob([text], { type: 'text/plain' }), base + '.txt', title);
    }
    if (format === 'md') return deliver(new Blob([toMarkdown(note)], { type: 'text/markdown' }), base + '.md', title);
    if (format === 'png') return deliver(await toPng(note), base + '.png', title);
    if (format === 'pdf') return deliver(await toPdf(note), base + '.pdf', title);
    throw new Error('Unknown format');
  }
  return { toText, toMarkdown, toPng, toPdf, share };
})();
if (typeof module !== 'undefined') module.exports = NoteExport;
