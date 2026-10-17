// Batch 10 (v7): long-press menus pop up from the pressed item (phone). Desktop has no long-press menus.
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
  const page = await (await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 })).newPage();
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await page.goto(url); await page.waitForSelector('#newNote');
  await page.evaluate(() => {
    const S = window.__mochiNote.state, now = Date.now();
    ['Personal', 'Ideas', 'Work'].forEach((n, i) => S.folders.push({ id: 'f' + i, name: n, parentId: null, created: now + i }));
    for (let i = 0; i < 12; i++) S.notes.push({ id: 'n' + i, title: 'Note ' + i, html: '<div>text ' + i + '</div>', text: 'text ' + i, tags: [], folderId: null, color: 'default', pinned: false, archived: false, trashed: false, trashedAt: null, created: now - i, updated: now - i * 1000 });
    window.__mochiNote.render();
  });
  const R = sel => page.locator(sel).first().evaluate(e => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; });
  const press = async sel => { const b = await page.locator(sel).first().boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up(); await page.waitForTimeout(300); };
  const toTop = async sel => { const t = await page.locator(sel).first().evaluate(e => e.getBoundingClientRect().top); await page.evaluate(d => window.scrollBy(0, d), t - 150); await page.waitForTimeout(250); };
  const close = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(250); };
  const inView = s => s.l >= 0 && s.r <= 390 && s.t >= 0 && s.b <= 780;
  const overlap = (a, b) => !(a.r <= b.l || b.r <= a.l || a.b <= b.t || b.b <= a.t);

  // top-left card: menu opens below it, left edges lined up
  await toTop('.note[aria-label="Open note Note 0"]');
  await press('.note[aria-label="Open note Note 0"]');
  let c = await R('.note[aria-label="Open note Note 0"]'), s = await R('#sheet');
  ok('menu opens (hidden scrim ok) and is no longer a full-width bottom sheet', await page.locator('#sheetLayer').isVisible() && s.w < 300 && s.b < 780 - 20, JSON.stringify(s));
  ok('left-column card: menu sits right below the card, left-aligned', Math.abs(s.t - (c.b + 8)) <= 2 && Math.abs(s.l - c.l) <= 2, JSON.stringify({ c, s }));
  ok('menu stays inside the screen', inView(s), JSON.stringify(s));
  ok('pressed card is highlighted while the menu is open', await page.locator('.note[aria-label="Open note Note 0"].lp-active').count() === 1);
  ok('menu has the same items and title as before', (await page.textContent('#sheetTitle')) === 'Note 0' && (await page.$$eval('#sheetItems button', e => e.map(x => x.lastChild.textContent.trim()))).join('|') === 'Pin|Move to folder…|Archive|Move to Trash');
  await close();
  ok('highlight is removed when the menu closes', await page.locator('.lp-active').count() === 0 && !(await page.locator('#sheetLayer').isVisible()));

  // right-column card: menu right-aligned to the card
  await toTop('.note[aria-label="Open note Note 1"]');
  await press('.note[aria-label="Open note Note 1"]');
  c = await R('.note[aria-label="Open note Note 1"]'); s = await R('#sheet');
  ok('right-column card: menu right edge lines up with the card', Math.abs(s.r - c.r) <= 2 && inView(s), JSON.stringify({ c, s }));
  ok('menu does not cover the pressed card', !overlap(s, c) || s.t >= c.b || s.b <= c.t, JSON.stringify({ c, s }));
  await close();

  // card near the bottom: menu opens above it
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(300);
  const last = await page.evaluate(() => { const els = [...document.querySelectorAll('#notes .note')]; const e = els.filter(x => { const r = x.getBoundingClientRect(); return r.bottom > 500 && r.bottom <= 770; }).pop() || els[els.length - 1]; return e.getAttribute('aria-label'); });
  await press('.note[aria-label="' + last + '"]');
  c = await R('.note[aria-label="' + last + '"]'); s = await R('#sheet');
  ok('card near the bottom: menu opens above it', s.b <= c.t - 6 && inView(s), JSON.stringify({ last, c, s }));
  ok('transform origin follows the card (pops up from it)', (await page.$eval('#sheet', e => e.style.transformOrigin)).endsWith('100%'), await page.$eval('#sheet', e => e.style.transformOrigin));
  await close();
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(200);

  // folder card
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(200);
  await press('#folderStrip .folder-card:nth-child(2)');
  c = await R('#folderStrip .folder-card:nth-child(2)'); s = await R('#sheet');
  ok('folder card: menu pops up from the folder (right column -> right aligned)', Math.abs(s.r - c.r) <= 2 && s.t >= c.b && inView(s), JSON.stringify({ c, s }));
  ok('folder menu items', (await page.$$eval('#sheetItems button', e => e.map(x => x.lastChild.textContent.trim()))).join('|') === 'Rename|Delete folder');
  ok('folder is highlighted', await page.locator('#folderStrip .folder-card.lp-active').count() === 1);
  await page.click('#sheetScrim', { position: { x: 5, y: 5 } }); await page.waitForTimeout(250);
  ok('tapping outside closes it', !(await page.locator('#sheetLayer').isVisible()) && await page.locator('.lp-active').count() === 0);

  // list view: wide row -> menu under the row
  await page.click('#viewList'); await page.waitForTimeout(200);
  await toTop('.note[aria-label="Open note Note 2"]');
  await press('.note[aria-label="Open note Note 2"]');
  c = await R('.note[aria-label="Open note Note 2"]'); s = await R('#sheet');
  ok('list row: menu pops up under the row and fits on screen', s.t >= c.b - 1 && inView(s), JSON.stringify({ c, s }));
  await page.click('#sheetItems >> text=Pin'); await page.waitForTimeout(400);
  ok('actions still work (Pin)', await page.evaluate(() => window.__mochiNote.state.notes.find(n => n.id === 'n2').pinned === true) && await page.locator('.lp-active').count() === 0);
  await page.click('#viewGrid'); await page.waitForTimeout(150);

  // sidebar folder
  await page.click('#openSidebar'); await page.waitForTimeout(250);
  await press('#sideFolders .side-item >> text=Work');
  c = await R('#sideFolders .side-item >> text=Work'); s = await R('#sheet');
  ok('sidebar folder: menu pops up from that row and fits on screen', inView(s) && (s.t >= c.b - 1 || s.b <= c.t + 1), JSON.stringify({ c, s }));
  await close(); await page.waitForTimeout(150);

  // rotate / resize keeps it anchored
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  ok('no console/page errors', errs.length === 0, errs.join(' | '));
  const pass = results.filter(Boolean).length; console.log(`\n${pass}/${results.length} passed`);
  await browser.close(); srv.close(); process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
