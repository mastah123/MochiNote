// Batch 15 (v12): subfolders removed (phone + desktop); old subfolders are lifted to the top level.
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
  for (const [label, vp] of [['phone', { width: 390, height: 780 }], ['desktop', { width: 1280, height: 800 }]]) {
    const page = await (await browser.newContext({ viewport: vp })).newPage();
    page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
    await page.goto(url); await page.waitForSelector('#newNote');
    // legacy data: a nested folder with a note, written straight to the database
    await page.evaluate(async () => {
      const now = Date.now();
      await NotesDB.put('folders', { id: 'p', name: 'Parent', parentId: null, created: now });
      await NotesDB.put('folders', { id: 'c', name: 'Child', parentId: 'p', created: now + 1 });
      await NotesDB.put('notes', { id: 'n1', title: 'Deep note', html: '<div>x</div>', text: 'x', tags: [], folderId: 'c', color: 'default', pinned: false, archived: false, trashed: false, trashedAt: null, created: now, updated: now });
    });
    await page.reload(); await page.waitForSelector('#newNote'); await page.waitForTimeout(400);
    const st = await page.evaluate(() => ({ f: window.__mochiNote.state.folders.map(f => [f.id, f.parentId]), n: window.__mochiNote.state.notes.find(n => n.id === 'n1') }));
    ok(label + ': old subfolders are moved to the top level', st.f.length === 2 && st.f.every(([, p]) => p === null), JSON.stringify(st.f));
    ok(label + ': notes keep their folder', st.n && st.n.folderId === 'c');
    await page.reload(); await page.waitForSelector('#newNote'); await page.waitForTimeout(300);
    const saved = await page.evaluate(() => window.__mochiNote.state.folders.every(f => !f.parentId));
    ok(label + ': the change was saved', saved);
    // no subfolder UI
    if (label === 'phone') await page.click('#openSidebar'); await page.waitForTimeout(250);
    ok(label + ': no "+ Subfolder" / indentation in the sidebar', await page.locator('.folder-tools button:text-is("+ Subfolder")').count() === 0 && await page.evaluate(() => new Set(Array.from(document.querySelectorAll('#sideFolders .side-item')).map(b => getComputedStyle(b).paddingLeft)).size <= 1));
    await page.click('#addFolderBtn'); await page.waitForSelector('#dlg[open]');
    ok(label + ': new folder dialog has no subfolder wording', (await page.textContent('#dlgTitle')) === 'New folder');
    await page.fill('#dlgInput', 'Fresh'); await page.click('#dlgOk'); await page.waitForTimeout(300);
    ok(label + ': created folder is top level', await page.evaluate(() => { const f = window.__mochiNote.state.folders.find(x => x.name === 'Fresh'); return f && f.parentId === null; }));
    await page.close();
  }
  // import flattens
  const page = await (await browser.newContext({ viewport: { width: 390, height: 780 } })).newPage();
  await page.goto(url); await page.waitForSelector('#newNote');
  const flat = await page.evaluate(() => { const r = NotesLogic.validateImport({ app: 'little-notes', version: 1, folders: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B', parentId: 'a' }], notes: [] }, {}); NotesLogic.flattenFolders(r.folders); return r.folders.map(f => f.parentId); });
  ok('import: flattening clears parentId', flat.every(p => !p), JSON.stringify(flat));
  ok('no console/page errors', errs.length === 0, errs.join(' | '));
  const pass = results.filter(Boolean).length; console.log(`\n${pass}/${results.length} passed`);
  await browser.close(); srv.close(); process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
