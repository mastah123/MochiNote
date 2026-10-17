// Batch 3: long-press menus (notes + folders), rich card previews, desktop unchanged.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => { const f = path.join(root, q.url === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, d) => e ? (r.writeHead(404), r.end()) : (r.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/plain' }), r.end(d))); });
const results = []; const ok = (n, c, x) => { results.push(!!c); console.log((c ? 'PASS ' : 'FAIL ') + n + (!c && x ? ' -> ' + x : '')); };

const NOTE_HTML = '<div>Intro line</div><ul><li>apple</li><li>pear</li></ul><ol><li>first</li><li>second</li></ol><ul class="checklist"><li class="done">done thing</li><li>todo thing</li></ul>';

(async () => {
  await new Promise(r => srv.listen(0, r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME });
  const url = 'http://localhost:' + srv.address().port + '/';
  const errs = [];
  const open = async vp => {
    const page = await (await browser.newContext({ viewport: vp, deviceScaleFactor: 2 })).newPage();
    page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
    await page.goto(url); await page.waitForSelector('#newNote'); return page;
  };
  const seed = (page, notes, folders) => page.evaluate(([notes, folders]) => {
    const S = window.__mochiNote.state, now = Date.now();
    (folders || []).forEach(f => S.folders.push(Object.assign({ parentId: null, created: now }, f)));
    notes.forEach((n, i) => S.notes.push(Object.assign({ id: 'n' + i, title: '', html: '', text: '', tags: [], folderId: null, color: 'default', pinned: false, archived: false, trashed: false, trashedAt: null, created: now - i, updated: now - i }, n)));
    window.__mochiNote.render();
  }, [notes, folders]);
  const state = (page, fn, arg) => page.evaluate(fn, arg);
  const press = async (page, sel, ms) => { const b = await page.locator(sel).first().boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await page.waitForTimeout(ms || 650); await page.mouse.up(); await page.waitForTimeout(150); };
  const sheetOpen = page => page.locator('#sheetLayer').isVisible();
  const sheetItems = page => page.$$eval('#sheetItems button', e => e.map(x => x.lastChild.textContent.trim()));
  const histKind = page => page.evaluate(() => history.state && history.state.kind);

  /* ---------------- mobile ---------------- */
  const m = await open({ width: 390, height: 780 });
  await seed(m, [{ id: 'a', title: 'Shopping', html: NOTE_HTML, text: 'Intro line apple pear first second done thing todo thing' }, { id: 'b', title: 'Plain', html: '<div>just text</div>', text: 'just text' }], [{ id: 'f1', name: 'Work' }, { id: 'f2', name: 'Home' }]);

  // rich preview
  const rich = await m.$$eval('.note[aria-label="Open note Shopping"] .n-rich .pl:not(.pl-more)', els => els.map(e => e.className.replace('pl ', '') + ':' + e.querySelector('.pl-m').textContent + '|' + e.querySelector('.pl-t').textContent));
  ok('card preview is visible on mobile', await m.locator('.note[aria-label="Open note Shopping"] .n-rich').isVisible());
  ok('plain-text preview hidden on mobile', !(await m.locator('.note[aria-label="Open note Shopping"] .n-prev').isVisible()));
  ok('preview shows paragraph line', rich[0] && rich[0].startsWith('pl-p') && rich[0].endsWith('Intro line'), JSON.stringify(rich));
  ok('preview shows bullets', rich[1] === 'pl-ul:•|apple' && rich[2] === 'pl-ul:•|pear', JSON.stringify(rich));
  const richAll = await m.$$eval('.note[aria-label="Open note Shopping"] .n-rich .pl', els => els.length);
  ok('preview capped (4 lines + ellipsis)', richAll === 5, String(richAll));
  // numbering + checklist: view more lines via a dedicated note
  await seed(m, [{ id: 'c', title: 'Lists', html: '<ol><li>first</li><li>second</li><li>third</li></ol><ul class="checklist"><li class="done">ok</li></ul>', text: 'first second third ok' }]);
  const ol = await m.$$eval('.note[aria-label="Open note Lists"] .n-rich .pl', els => els.map(e => e.querySelector('.pl-m').textContent + e.querySelector('.pl-t').textContent));
  ok('preview keeps numbering 1. 2. 3.', ol[0] === '1.first' && ol[1] === '2.second' && ol[2] === '3.third', JSON.stringify(ol));
  ok('preview shows checklist markers (● done)', ol[3] === '●ok', JSON.stringify(ol));
  ok('done checklist item is struck through', (await m.$eval('.note[aria-label="Open note Lists"] .pl-check.done .pl-t', e => getComputedStyle(e).textDecorationLine)) === 'line-through');

  // tap still opens the note
  await m.click('.note[aria-label="Open note Plain"]'); await m.waitForTimeout(200);
  ok('short tap opens the editor', await m.locator('#editorLayer').isVisible() && !(await sheetOpen(m)));
  await m.click('#edBack'); await m.waitForTimeout(250);

  // long-press a note
  await press(m, '.note[aria-label="Open note Plain"]');
  ok('long-press opens the action sheet', await sheetOpen(m));
  ok('long-press does not also open the editor', !(await m.locator('#editorLayer').isVisible()));
  ok('sheet title is the note title', (await m.textContent('#sheetTitle')) === 'Plain');
  const items = await sheetItems(m);
  ok('sheet has Pin / Move / Archive / Trash', JSON.stringify(items) === JSON.stringify(['Pin', 'Move to folder…', 'Archive', 'Move to Trash']), JSON.stringify(items));
  // Back closes the sheet only
  const titleBefore = await m.textContent('#viewTitle');
  await m.evaluate(() => history.back()); await m.waitForTimeout(250);
  ok('Back closes the sheet and stays in the app', !(await sheetOpen(m)) && (await m.textContent('#viewTitle')) === titleBefore && (await histKind(m)) === 'view', await histKind(m));
  // scrim closes
  await press(m, '.note[aria-label="Open note Plain"]'); await m.click('#sheetScrim', { position: { x: 10, y: 10 } }); await m.waitForTimeout(250);
  ok('tapping outside closes the sheet', !(await sheetOpen(m)) && (await histKind(m)) === 'view');
  // Escape closes
  await press(m, '.note[aria-label="Open note Plain"]'); await m.keyboard.press('Escape'); await m.waitForTimeout(250);
  ok('Escape closes the sheet', !(await sheetOpen(m)) && (await histKind(m)) === 'view');
  // moving finger cancels
  const b = await m.locator('.note[aria-label="Open note Plain"]').boundingBox();
  await m.mouse.move(b.x + 20, b.y + 20); await m.mouse.down(); await m.mouse.move(b.x + 20, b.y + b.height + 120, { steps: 4 }); await m.waitForTimeout(650); await m.mouse.up();
  ok('dragging cancels the long-press', !(await sheetOpen(m)));

  // pin via sheet
  await press(m, '.note[aria-label="Open note Plain"]'); await m.click('#sheetItems >> text=Pin'); await m.waitForTimeout(350);
  ok('Pin from the sheet pins the note', await state(m, () => window.__mochiNote.state.notes.find(n => n.id === 'b').pinned) === true);
  ok('sheet closed and history is back on the list after an action', !(await sheetOpen(m)) && (await histKind(m)) === 'view');
  await press(m, '.note[aria-label="Open note Plain"]');
  ok('pinned note offers Unpin', (await sheetItems(m))[0] === 'Unpin');
  await m.click('#sheetItems >> text=Unpin'); await m.waitForTimeout(300);

  // move via sheet
  await press(m, '.note[aria-label="Open note Plain"]'); await m.click('#sheetItems >> text=Move to folder');
  await m.waitForSelector('#dlg[open]'); await m.selectOption('#dlgSelect', 'f1'); await m.click('#dlgOk'); await m.waitForTimeout(350);
  ok('Move from the sheet moves the note', await state(m, () => window.__mochiNote.state.notes.find(n => n.id === 'b').folderId) === 'f1');

  // archive via sheet
  await press(m, '.note[aria-label="Open note Plain"]'); await m.click('#sheetItems >> text=Archive'); await m.waitForTimeout(350);
  ok('Archive from the sheet archives the note', await state(m, () => window.__mochiNote.state.notes.find(n => n.id === 'b').archived) === true);
  ok('archived note left the list', (await m.locator('.note[aria-label="Open note Plain"]').count()) === 0);
  // unarchive via archive view
  await m.evaluate(() => window.__mochiNote.go('archive')); await m.waitForTimeout(200);
  await press(m, '.note[aria-label="Open note Plain"]');
  ok('archive sheet offers Unarchive (no Pin)', JSON.stringify(await sheetItems(m)) === JSON.stringify(['Move to folder…', 'Unarchive', 'Move to Trash']), JSON.stringify(await sheetItems(m)));
  await m.click('#sheetItems >> text=Unarchive'); await m.waitForTimeout(300);
  ok('Unarchive restores it', await state(m, () => window.__mochiNote.state.notes.find(n => n.id === 'b').archived) === false);

  // trash + restore + delete forever via sheet
  await m.evaluate(() => window.__mochiNote.go('all')); await m.waitForTimeout(200);
  await press(m, '.note[aria-label="Open note Plain"]'); await m.click('#sheetItems >> text=Move to Trash'); await m.waitForTimeout(350);
  ok('Trash from the sheet trashes the note', await state(m, () => window.__mochiNote.state.notes.find(n => n.id === 'b').trashed) === true);
  await m.evaluate(() => window.__mochiNote.go('trash')); await m.waitForTimeout(200);
  await press(m, '.note[aria-label="Open note Plain"]');
  ok('trash sheet offers Restore / Delete forever', JSON.stringify(await sheetItems(m)) === JSON.stringify(['Restore', 'Delete forever']), JSON.stringify(await sheetItems(m)));
  await m.click('#sheetItems >> text=Restore'); await m.waitForTimeout(300);
  ok('Restore from the sheet works', await state(m, () => window.__mochiNote.state.notes.find(n => n.id === 'b').trashed) === false);

  // folders: card long-press
  await m.evaluate(() => window.__mochiNote.go('all')); await m.waitForTimeout(250);
  await press(m, '.folder-card >> text=Work');
  ok('long-press on a folder card opens its sheet', await sheetOpen(m) && (await m.textContent('#sheetTitle')).includes('Work'));
  ok('folder sheet has Rename / Delete (no subfolders)', JSON.stringify(await sheetItems(m)) === JSON.stringify(['Rename', 'Delete folder']), JSON.stringify(await sheetItems(m)));
  ok('long-press on a folder does not open the folder', (await m.textContent('#viewTitle')) === 'All notes');
  await m.click('#sheetItems >> text=Rename'); await m.waitForSelector('#dlg[open]'); await m.fill('#dlgInput', 'Work2'); await m.click('#dlgOk'); await m.waitForTimeout(300);
  ok('Rename from the folder sheet renames it', await state(m, () => window.__mochiNote.state.folders.find(f => f.id === 'f1').name) === 'Work2');
  await press(m, '.folder-card >> text=Home'); await m.click('#sheetItems >> text=Delete folder');
  await m.waitForSelector('#dlg[open]'); await m.click('#dlgOk'); await m.waitForTimeout(300);
  ok('Delete from the folder sheet deletes it', await state(m, () => !window.__mochiNote.state.folders.some(f => f.id === 'f2')));
  // tapping a folder card still opens it
  await m.click('.folder-card >> text=Work2'); await m.waitForTimeout(250);
  ok('tapping a folder card still opens the folder', (await m.textContent('#viewTitle')) === 'Work2');

  // sidebar folder long-press
  await m.click('#openSidebar'); await m.waitForTimeout(300);
  await press(m, '#sideFolders .side-item >> text=Work2');
  ok('long-press on a sidebar folder opens its sheet', await sheetOpen(m) && (await m.textContent('#sheetTitle')).includes('Work2'));
  await m.keyboard.press('Escape'); await m.waitForTimeout(250);
  ok('sidebar stays open after closing the sheet', await m.locator('#sidebar.open').count() === 1 && !(await sheetOpen(m)));
  ok('sidebar no longer lists a "No folder" entry', (await m.locator('#sideFolders .side-item >> text=No folder').count()) === 0);

  /* ---------------- desktop unchanged ---------------- */
  const d = await open({ width: 1280, height: 800 });
  await seed(d, [{ id: 'a', title: 'Shopping', html: NOTE_HTML, text: 'Intro line apple pear first second done thing todo thing' }], [{ id: 'f1', name: 'Work' }]);
  ok('desktop keeps the plain-text preview', await d.locator('.note .n-prev').isVisible() && !(await d.locator('.note .n-rich').isVisible()));
  await press(d, '.note');
  ok('desktop: long-press does nothing special', !(await sheetOpen(d)));
  await d.waitForTimeout(300);
  await d.keyboard.press('Escape'); await d.waitForTimeout(200);
  await d.click('.note'); await d.waitForTimeout(250);
  ok('desktop: click opens the editor as before', await d.locator('#editorLayer').isVisible());
  await d.click('#edBack'); await d.waitForTimeout(250);
  await press(d, '.folder-card >> text=Work');
  ok('desktop: folder long-press does nothing special', !(await sheetOpen(d)));

  // About shows v2
  await m.evaluate(() => window.__mochiNote.go('settings')); await m.waitForTimeout(250);
  ok('About shows the app name and a version', /MochiNote · version \d+\.\d+\.\d+/.test(await m.textContent('.about')));

  ok('no console/page errors', errs.length === 0, errs.join(' | '));
  const pass = results.filter(Boolean).length; console.log(`\n${pass}/${results.length} passed`);
  await browser.close(); srv.close(); process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
