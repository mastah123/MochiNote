// Batch 16 (v13): Settings back icon, no auto keyboard on opening a note (phone), undo/redo in the note header (phone).
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => { const f = path.join(root, q.url === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, d) => e ? (r.writeHead(404), r.end()) : (r.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/plain' }), r.end(d))); });
const results = []; const ok = (n, c, x) => { results.push(!!c); console.log((c ? 'PASS ' : 'FAIL ') + n + (!c && x ? ' -> ' + x : '')); };
(async () => {
  await new Promise(r => srv.listen(0, r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME });
  const url = 'http://localhost:' + srv.address().port + '/'; const errs = [];
  const mk = async vp => { const p = await (await browser.newContext({ viewport: vp })).newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text())); await p.goto(url); await p.waitForSelector('#newNote'); return p; };
  const seed = p => p.evaluate(() => { const S = window.__mochiNote.state, now = Date.now(); S.notes.push({ id: 'n1', title: 'Hello', html: '<div>some text</div>', text: 'some text', tags: [], folderId: null, color: 'default', pinned: false, archived: false, trashed: false, trashedAt: null, created: now, updated: now }); window.__mochiNote.render(); });
  const m = await mk({ width: 390, height: 780 }); await seed(m);
  // settings back icon
  const menuHtml = await m.innerHTML('#openSidebar');
  await m.click('#openSidebar'); await m.click('.nav-item[data-view=settings]'); await m.waitForTimeout(300);
  ok('settings: header button is a back arrow', (await m.getAttribute('#openSidebar', 'aria-label')) === 'Back' && (await m.innerHTML('#openSidebar')).includes('M19 12H5'));
  await m.click('#openSidebar'); await m.waitForTimeout(300);
  ok('back leaves settings (returns home)', await m.evaluate(() => window.__mochiNote.state.view) === 'all' && (await m.getAttribute('#openSidebar', 'aria-label')) === 'Open menu' && (await m.innerHTML('#openSidebar')) === menuHtml);
  await m.click('#openSidebar'); await m.waitForTimeout(250);
  ok('menu icon still opens the sidebar on home', await m.locator('#sidebar.open').count() === 1); await m.keyboard.press('Escape'); await m.evaluate(() => document.getElementById('scrim').click()); await m.waitForTimeout(250);
  // no auto keyboard
  await m.click('.note[aria-label="Open note Hello"]'); await m.waitForSelector('#editorLayer:not([hidden])'); await m.waitForTimeout(300);
  ok('existing note: nothing is focused on open (no keyboard)', await m.evaluate(() => { const a = document.activeElement; return !(a && (a.id === 'edTitle' || a.isContentEditable)); }));
  ok('new note still focuses the title', (await (async () => { await m.click('#edBack'); await m.waitForTimeout(300); await m.click('#newNote'); await m.waitForTimeout(300); return m.evaluate(() => document.activeElement.id); })()) === 'edTitle');
  await m.click('#edBack'); await m.waitForTimeout(300);
  // undo / redo in header
  await m.click('.note[aria-label="Open note Hello"]'); await m.waitForTimeout(300);
  const R = s => m.locator(s).evaluate(e => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; });
  const b = await R('#edBack'), u = await R('#edUndo'), r = await R('#edRedo');
  ok('undo and redo sit in the top-left, right of Back', u.l >= b.r - 1 && r.l >= u.r - 1 && r.r < 200 && Math.abs((u.t + u.b) / 2 - (b.t + b.b) / 2) < 2, JSON.stringify({ b, u, r }));
  await m.click('#edBody'); await m.keyboard.press('End'); await m.keyboard.type(' more'); await m.waitForTimeout(100);
  const txt = () => m.evaluate(() => document.querySelector('#edBody').innerText);
  ok('typed text present', (await txt()).includes('more'));
  await m.click('#edUndo'); await m.waitForTimeout(150);
  ok('undo removes the typing', !(await txt()).includes('more'), await txt());
  await m.click('#edRedo'); await m.waitForTimeout(150);
  ok('redo brings it back', (await txt()).includes('more'), await txt());
  ok('format bar no longer has its own undo/redo on phone', await m.evaluate(() => ['undo', 'redo'].every(c => getComputedStyle(document.querySelector('#toolbar [data-cmd=' + c + ']')).display === 'none')));
  // desktop unchanged
  const d = await mk({ width: 1280, height: 800 }); await seed(d);
  ok('desktop: the header menu button is hidden', !(await d.isVisible('#openSidebar')));
  await d.click('.note[aria-label="Open note Hello"]'); await d.waitForTimeout(300);
  ok('desktop: header undo/redo are shown and the toolbar no longer repeats them', await d.isVisible('#edUndo') && await d.isVisible('#edRedo') && !(await d.isVisible('#toolbar [data-cmd=undo]')));
  ok('desktop: editor still auto-focuses the text', await d.evaluate(() => document.activeElement.isContentEditable));
  ok('no console/page errors', errs.length === 0, errs.join(' | '));
  const pass = results.filter(Boolean).length; console.log(`\n${pass}/${results.length} passed`);
  await browser.close(); srv.close(); process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
