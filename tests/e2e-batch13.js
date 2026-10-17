// Batch 13 (v10, phone): header stays put when the keyboard opens, typing stays above the format bar, ~5 lines of bottom scroll space. Desktop unchanged.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => { const f = path.join(root, q.url === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, d) => e ? (r.writeHead(404), r.end()) : (r.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/plain' }), r.end(d))); });
const results = []; const ok = (n, c, x) => { results.push(!!c); console.log((c ? 'PASS ' : 'FAIL ') + n + (!c && x ? ' -> ' + x : '')); };
const LONG = Array.from({ length: 60 }, (_, i) => '<div>Line number ' + i + ' of a long note</div>').join('');
(async () => {
  await new Promise(r => srv.listen(0, r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME });
  const url = 'http://localhost:' + srv.address().port + '/'; const errs = [];
  const open = async vp => { const page = await (await browser.newContext({ viewport: vp, deviceScaleFactor: 2 })).newPage(); page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text())); await page.goto(url); await page.waitForSelector('#newNote'); return page; };
  const R = (page, sel) => page.locator(sel).first().evaluate(e => { const r = e.getBoundingClientRect(); return { t: r.top, b: r.bottom, l: r.left, r: r.right, h: r.height }; });
  const endCaret = page => page.evaluate(() => { const b = document.getElementById('edBody'); const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT); let t, last = null; while ((t = w.nextNode())) last = t; const r = document.createRange(); if (last) { r.setStart(last, last.nodeValue.length); r.collapse(true); } else { r.selectNodeContents(b); r.collapse(false); } const s = getSelection(); s.removeAllRanges(); s.addRange(r); b.focus(); });
  const caretVisible = page => page.evaluate(() => { const r = getSelection().getRangeAt(0); let rc = r.getClientRects()[0]; if (!rc || !rc.height) { const n = r.startContainer; rc = (n.nodeType === 1 ? n : n.parentElement).getBoundingClientRect(); } const sc = document.querySelector('.ed-scroll').getBoundingClientRect(); return { rb: rc.bottom, rt: rc.top, sb: sc.bottom, st: sc.top, ok: rc.bottom <= sc.bottom + 1 && rc.top >= sc.top - 1 }; });

  /* ---------------- phone ---------------- */
  const m = await open({ width: 390, height: 844 });
  await m.click('#newNote'); await m.waitForSelector('#edBody');
  await m.evaluate(h => { document.getElementById('edBody').innerHTML = h; }, LONG);
  await m.waitForTimeout(200);

  // 5: header stays with the keyboard (simulate a keyboard with a fake visual viewport)
  const real = await m.evaluate(() => { window.__vv = window.visualViewport; return true; });
  const fake = async (h, top) => { await m.evaluate(([h, top]) => { const real = window.__vv; Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => ({ height: h, offsetTop: top, width: 390, addEventListener() {}, removeEventListener() {} }) }); real.dispatchEvent(new Event('resize')); }, [h, top]); await m.waitForTimeout(250); };
  await fake(844, 0);
  let hd = await R(m, '.ed-top'); const full = await R(m, '#editor');
  ok('keyboard closed: header at the very top, editor fills the screen', Math.round(hd.t) === 0 && Math.round(full.b) === 844, JSON.stringify({ hd, full }));
  await fake(470, 0);                                  // keyboard open: visible area is 470px tall
  hd = await R(m, '.ed-top'); let ed = await R(m, '#editor');
  ok('keyboard open: header stays at the top of the visible area', Math.round(hd.t) === 0 && hd.h >= 40, JSON.stringify(hd));
  ok('keyboard open: the editor shrinks to the visible area (nothing hidden under the keyboard)', Math.round(ed.b) === 470, JSON.stringify(ed));
  const ft = await R(m, '.ed-bar');
  ok('keyboard open: the footer is still visible just above the keyboard', ft.b <= 470.5 && ft.t > 300, JSON.stringify(ft));
  await fake(470, 180);                                // browsers that scroll the visual viewport (iOS) report an offset
  hd = await R(m, '.ed-top'); ed = await R(m, '#editor');
  ok('visual viewport scrolled by the keyboard: the header follows it, still fully visible', Math.round(hd.t) === 180 && Math.round(ed.b) === 180 + 470, JSON.stringify({ hd, ed }));
  ok('header is inside the visible area', hd.t >= 180 && hd.b <= 180 + 470);
  await m.evaluate(() => { Object.defineProperty(window, 'visualViewport', { configurable: true, value: window.__vv }); window.__vv.dispatchEvent(new Event('resize')); }); await m.waitForTimeout(200);
  ok('page itself never scrolls sideways or down behind the editor', await m.evaluate(() => window.scrollX === 0 && window.scrollY === 0));

  // 10: bottom space of ~5 lines
  const pb = await m.evaluate(() => { const b = document.getElementById('edBody'); const cs = getComputedStyle(b); return { pad: parseFloat(cs.paddingBottom), lh: parseFloat(cs.lineHeight) }; });
  ok('note has about 5 lines of free space at the bottom', pb.pad >= pb.lh * 5 - 1 && pb.pad <= pb.lh * 5 + 20, JSON.stringify(pb));
  await m.evaluate(() => { const s = document.querySelector('.ed-scroll'); s.scrollTop = s.scrollHeight; }); await m.waitForTimeout(700);
  const lastLine = await m.evaluate(() => { const b = document.getElementById('edBody'); const l = b.lastElementChild.getBoundingClientRect(); const s = document.querySelector('.ed-scroll').getBoundingClientRect(); return { gap: s.bottom - l.bottom, lh: parseFloat(getComputedStyle(b).lineHeight) }; });
  ok('scrolled to the end, the last line sits 4+ lines above the bottom edge', lastLine.gap >= lastLine.lh * 4, JSON.stringify(lastLine));
  await endCaret(m); await m.keyboard.type(' typed');
  let cv = await caretVisible(m);
  ok('typing at the very end keeps the line visible', cv.ok, JSON.stringify(cv));
  await m.click('.ed-body', { position: { x: 100, y: 20 } }).catch(() => {});

  // 7: format bar takes the keyboard's place; the line being typed lifts above it
  await endCaret(m);
  await m.evaluate(() => { const s = document.querySelector('.ed-scroll'); s.scrollTop = s.scrollHeight; });
  await m.click('#edFmt'); await m.waitForTimeout(500);
  const tbh = await R(m, '#toolbar'), scr = await R(m, '.ed-scroll');
  ok('format bar is open and does not overlap the note area', await m.locator('#toolbar').isVisible() && scr.b <= tbh.t + 1, JSON.stringify({ tbh, scr }));
  cv = await caretVisible(m);
  ok('with the bar open, the caret line is above the bar (typing went up)', cv.ok && cv.rb <= tbh.t, JSON.stringify({ cv, tbh }));
  await m.evaluate(() => { const s = document.querySelector('.ed-scroll'); s.scrollTop = 0; }); await m.waitForTimeout(100);
  await endCaret(m); await m.evaluate(() => NotesEditor.keepCaretVisible()); await m.waitForTimeout(150);
  cv = await caretVisible(m);
  ok('caret far below the visible part is brought back into view', cv.ok, JSON.stringify(cv));
  await m.click('[data-cmd=bold]'); await m.keyboard.type('X'); await m.waitForTimeout(150);
  cv = await caretVisible(m);
  ok('using a format button then typing keeps the line visible', cv.ok, JSON.stringify(cv));
  await m.click('#edBar .bar-btn[aria-pressed=true]'); await m.waitForTimeout(500);
  cv = await caretVisible(m);
  ok('closing the bar keeps the caret line visible', cv.ok, JSON.stringify(cv));
  // Enter at the bottom
  await endCaret(m);
  for (let i = 0; i < 6; i++) await m.keyboard.press('Enter');
  await m.keyboard.type('new line'); await m.waitForTimeout(200);
  cv = await caretVisible(m);
  ok('pressing Enter repeatedly at the bottom keeps scrolling the caret into view', cv.ok, JSON.stringify(cv));
  ok('header still on screen after all that', Math.round((await R(m, '.ed-top')).t) === 0);
  await m.screenshot({ path: (process.env.SHOTS || '/tmp') + '/b13-phone.png' });

  // viewport meta
  ok('viewport meta asks browsers to resize the page for the keyboard', /interactive-widget=resizes-content/.test(await m.getAttribute('meta[name=viewport]', 'content')));

  /* ---------------- desktop unchanged ---------------- */
  const d = await open({ width: 1280, height: 800 });
  await d.click('#newNote'); await d.waitForSelector('#edBody');
  await d.evaluate(h => { document.getElementById('edBody').innerHTML = h; }, LONG); await d.waitForTimeout(200);
  const dpad = await d.evaluate(() => parseFloat(getComputedStyle(document.getElementById('edBody')).paddingBottom));
  ok('desktop: no extra bottom space (original padding)', dpad <= 14, String(dpad));
  ok('desktop: editor layer ignores the phone viewport variables', await d.evaluate(() => { const l = document.getElementById('editorLayer'); return !l.style.getPropertyValue('--vvh') && getComputedStyle(l).top === '0px'; }));
  const dh = await R(d, '#editor');
  ok('desktop: editor still a centred card', dh.h <= 800 * 0.9 + 1 && dh.l > 100);
  ok('no console/page errors', errs.length === 0, errs.join(' | '));
  const pass = results.filter(Boolean).length; console.log(`\n${pass}/${results.length} passed`);
  await browser.close(); srv.close(); process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
