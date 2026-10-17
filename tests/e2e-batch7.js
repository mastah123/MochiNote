// Batch 7 (v5): pinned always first, no "Last 7 days", no "No folder" menu entry (still a move choice) — phone AND desktop.
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
  for (const [label, vp] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 800 }]]) {
    const page = await (await browser.newContext({ viewport: vp })).newPage();
    page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
    await page.goto(url); await page.waitForSelector('#newNote');
    await page.evaluate(() => {
      const S = window.__mochiNote.state, now = Date.now();
      S.folders.push({ id: 'f0', name: 'Work', parentId: null, created: now });
      const mk = (id, title, extra) => S.notes.push(Object.assign({ id, title, html: '<div>x</div>', text: 'x', tags: [], folderId: null, color: 'default', pinned: false, archived: false, trashed: false, trashedAt: null, created: now, updated: now }, extra));
      mk('a', 'Alpha', {}); mk('b', 'Bravo', {}); mk('z', 'Zulu', { pinned: true, updated: now - 9e9, created: now - 9e9 });
      mk('old', 'Ancient', { updated: now - 30 * 864e5 });
      window.__mochiNote.render();
    });
    const titles = () => page.$$eval('#notes .note .n-title', e => e.map(x => x.textContent.trim()));
    ok(label + ': no Pinned first / Last 7 days controls', (await page.locator('#pinnedFirst, #recentOnly').count()) === 0 && !/Pinned first|Last 7 days/.test(await page.textContent('body')));
    for (const [s, first] of [['edited', 'Zulu'], ['title-asc', 'Zulu'], ['title-desc', 'Zulu'], ['created-asc', 'Zulu'], ['created-desc', 'Zulu']]) {
      await page.selectOption('#sortSelect', s); await page.waitForTimeout(100);
      ok(label + ': pinned note first with sort ' + s, (await titles())[0] === first, (await titles()).join());
    }
    await page.selectOption('#sortSelect', 'title-asc'); await page.waitForTimeout(100);
    ok(label + ': rest follows the sort, old notes still listed (no 7-day filter)', (await titles()).join() === 'Zulu,Alpha,Ancient,Bravo', (await titles()).join());
    if (label === 'phone') await page.click('#openSidebar');
    ok(label + ': menu has no "No folder" entry', (await page.locator('#sideFolders .side-item').count()) === 1 && (await page.locator('#sideFolders .side-item >> text=Work').count()) === 1);
    if (label === 'phone') { await page.keyboard.press('Escape'); await page.waitForTimeout(200); }
    // moving a note still offers "No folder"
    await page.evaluate(() => { window.__mochiNote.state.notes.find(n => n.id === 'a').folderId = 'f0'; window.__mochiNote.render(); });
    await page.click('.note >> text=Alpha'); await page.waitForTimeout(250);
    await page.click('#edMenuBtn'); await page.click('[data-act=move]'); await page.waitForTimeout(250);
    const opts = await page.$$eval('#dialog select option, .dialog select option, select option', o => o.map(x => x.textContent.trim()));
    ok(label + ': Move-to dialog still has "No folder"', opts.includes('No folder'), opts.join('|'));
  }
  ok('no console/page errors', errs.length === 0, errs.join(' | '));
  const pass = results.filter(Boolean).length; console.log(`\n${pass}/${results.length} passed`);
  await browser.close(); srv.close(); process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
