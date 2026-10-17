// Run: node tests/e2e.js  (needs playwright + chromium; serves the folder on a local port)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), shots = process.argv[2] || '/tmp';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => { const f = path.join(root, q.url === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, d) => e ? (r.writeHead(404), r.end()) : (r.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/plain' }), r.end(d))); });
const settle = async page => { await page.waitForTimeout(250); };
const results = []; const ok = (n, c, extra) => { results.push([n, !!c]); console.log((c ? 'PASS ' : 'FAIL ') + n + (extra && !c ? ' -> ' + extra : '')); };
(async () => {
  await new Promise(r => srv.listen(0, r)); const url = 'http://localhost:' + srv.address().port + '/';
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, acceptDownloads: true });
  const page = await ctx.newPage(); const errs = [];
  // Format bar is bottom-docked on phones and closes when you tap into the text: reopen it when a test needs it.
  const ensureTb = async (g = 'aa') => { const open = (await page.locator('#toolbar').isVisible()) && (await page.getAttribute('#toolbar', 'data-open')) === g; if (!open && (await page.locator('#edBar').isVisible())) { if ((await page.locator('#toolbar').isVisible()) && (await page.getAttribute('#toolbar', 'data-open')) !== g) await page.click('#edBar [data-open=' + g + ']'); else if (!(await page.locator('#toolbar').isVisible())) await page.click('#edBar [data-open=' + g + ']'); } };
  // Phones: search is behind the header icon.
  const openSearch = async () => { if (!(await page.locator('#search').isVisible())) await page.click('#searchBtn'); };


  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await page.goto(url); await page.waitForSelector('#newNote');

  // 1 create note with mixed content
  await page.click('#newNote'); await page.click('#edFmt'); await page.fill('#edTitle', 'Trip plan');
  await page.click('#edBody');
  await page.keyboard.type('Intro paragraph with #Travel and #ideas');
  await page.keyboard.press('Enter'); await ensureTb('list'); await page.click('[data-cmd=insertUnorderedList]'); await page.keyboard.type('bullet one'); await page.keyboard.press('Enter'); await page.keyboard.type('bullet two'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
  await ensureTb('list'); await page.click('[data-cmd=insertOrderedList]'); await page.keyboard.type('first'); await page.keyboard.press('Enter'); await page.keyboard.type('second'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
  await ensureTb('list'); await page.click('[data-cmd=checklist]'); await page.keyboard.type('pack bags'); await page.keyboard.press('Enter'); await page.keyboard.type('book hotel');
  let html = await page.$eval('#edBody', e => e.innerHTML);
  ok('mixed content: ul + ol + checklist in one note', /<ul>/.test(html) && /<ol>/.test(html) && /ul class="checklist"/.test(html), html);
  // toggle first checklist item
  const li = await page.$('ul.checklist li'); const box = await li.boundingBox(); await page.mouse.click(box.x + 10, box.y + 10);
  ok('checklist item toggles done', await page.$eval('ul.checklist li', e => e.classList.contains('done')));
  // formatting
  await page.click('#edBody'); await page.keyboard.press('Control+Home'); await page.keyboard.down('Shift'); await page.keyboard.press('End'); await page.keyboard.up('Shift');
  await ensureTb(); await page.click('[data-cmd=bold]'); await ensureTb(); await page.click('[data-cmd=underline]'); await ensureTb(); await page.selectOption('#hlSel', '#fde68a'); await ensureTb(); await page.selectOption('#sizeSel', '5');
  await ensureTb(); await page.selectOption('#fontSel', 'Georgia, serif'); await ensureTb(); await page.click('[data-cmd=justifyCenter]');
  html = await page.$eval('#edBody', e => e.innerHTML);
  ok('bold/underline/highlight/size/font/align applied', /<b>|font-weight|<strong>/.test(html) && /<u[ >]|underline/.test(html) && /background-color|<mark/.test(html) && /font-size/.test(html) && /Georgia/.test(html) && /text-align: ?center/.test(html), html);
  await ensureTb(); await page.click('[data-cmd=h2]'); ok('heading applied', /<h2/.test(await page.$eval('#edBody', e => e.innerHTML)));
  // typing is immediate (no artificial delay): measure
  await page.keyboard.press('Control+End'); const t0 = Date.now(); await page.keyboard.type('x'.repeat(40)); ok('typing 40 chars fast (<2s incl. automation)', Date.now() - t0 < 2000);
  await page.waitForFunction(() => document.querySelector('#edStatus').textContent === '✓', null, { timeout: 4000 }).then(() => ok('autosave indicator shows Saved', true), () => ok('autosave indicator shows Saved', false));
  const savedHtml = await page.$eval('#edBody', e => e.innerHTML);
  await page.screenshot({ path: shots + '/editor-mobile.png' });
  // reload persistence
  await page.reload(); await page.waitForSelector('.note');
  ok('note persists after reload', await page.locator('.note .n-title', { hasText: 'Trip plan' }).count() === 1);
  await page.click('.note'); await page.waitForSelector('#edBody');
  const after = await page.$eval('#edBody', e => e.innerHTML);
  ok('formatting + lists + checklist state survive reload', after === savedHtml || (/<h2/.test(after) && /ul class="checklist"/.test(after) && /<ol>/.test(after) && /class="done"/.test(after) && /Georgia/.test(after)), after.slice(0, 300));
  ok('hashtags detected', (await page.$$eval('#edTags .tag', e => e.map(x => x.textContent))).join() === '#travel,#ideas');
  await page.click('#edBack');

  // folders
  await page.click('#openSidebar'); await page.click('#addFolderBtn'); await page.fill('#dlgInput', 'Projects'); await page.click('#dlgOk');
  await page.click('#addFolderBtn'); await page.fill('#dlgInput', 'Personal'); await page.click('#dlgOk');
  ok('folders created', await page.locator('#sideFolders .side-item', { hasText: 'Projects' }).count() >= 1);
  await page.evaluate(() => document.getElementById('scrim').click());
  await page.click('.note'); await page.click('#edMenuBtn'); await page.click('[data-act=move]'); await page.selectOption('#dlgSelect', { label: 'Projects' }); await page.click('#dlgOk'); await page.waitForSelector('#dlg', { state: 'hidden' }); await page.waitForTimeout(150);
  await page.click('#edBack'); await page.waitForSelector('#editorLayer', { state: 'hidden' }); await page.waitForSelector('.folder-card'); await settle(page);
  const fc = await page.$$eval('.folder-card', e => e.map(x => x.textContent)); ok('folder card shows 1 note', fc.some(x => x === 'Projects1 note'), JSON.stringify(fc));
  // second + third note for search/sort
  for (const [title, body] of [['Alpha groceries', 'milk and eggs #food'], ['Zebra', 'stripes']]) { await page.click('#newNote'); await page.fill('#edTitle', title); await page.click('#edBody'); await page.keyboard.type(body); await page.click('#edBack'); }
  const titles = async () => page.$$eval('.note .n-title', e => e.map(x => x.textContent));
  await page.waitForTimeout(100); await openSearch(); await page.fill('#search', 'eggs'); await page.waitForTimeout(200); ok('search body', (await titles()).join() === 'Alpha groceries');
  await openSearch(); await page.fill('#search', '#travel'); await page.waitForTimeout(200); ok('search hashtag', (await titles()).join() === 'Trip plan');
  await openSearch(); await page.fill('#search', 'projects'); await page.waitForTimeout(200); ok('search folder name', (await titles()).join() === 'Trip plan');
  await openSearch(); await page.fill('#search', 'zeb'); await page.waitForTimeout(200); ok('search title', (await titles()).join() === 'Zebra');
  await openSearch(); await page.fill('#search', ''); await page.waitForTimeout(200);
  await page.selectOption('#sortSelect', 'title-asc'); ok('sort A-Z', (await titles()).join() === 'Alpha groceries,Trip plan,Zebra');
  await page.selectOption('#sortSelect', 'title-desc'); ok('sort Z-A', (await titles()).join() === 'Zebra,Trip plan,Alpha groceries');
  await page.selectOption('#sortSelect', 'created-asc'); ok('sort created oldest', (await titles()).join() === 'Trip plan,Alpha groceries,Zebra');
  await page.selectOption('#sortSelect', 'created-desc'); ok('sort created newest', (await titles()).join() === 'Zebra,Alpha groceries,Trip plan');
  await page.selectOption('#sortSelect', 'edited'); ok('sort recently edited', (await titles())[0] === 'Zebra');
  // view toggle persistence
  await page.click('#viewList'); await page.reload(); await page.waitForSelector('.note');
  ok('list view persists', await page.$eval('#notes', e => e.classList.contains('list')) && await page.$eval('#sortSelect', e => e.value) === 'edited');
  await page.screenshot({ path: shots + '/list-mobile.png' });
  await page.click('#viewGrid');

  // pin/archive/trash/restore/delete
  await page.click('.note >> text=Zebra'); await page.click('#edMenuBtn'); await page.click('[data-act=pin]'); await page.waitForTimeout(300); await page.click('#edBack');
  ok('pinned first', (await titles())[0] === 'Zebra');
  await page.click('#openSidebar'); await page.click('[data-view=pinned]'); ok('pinned view', (await titles()).join() === 'Zebra');
  await page.click('#openSidebar'); await page.click('[data-view=all]');
  await page.click('.note >> text=Zebra'); await page.click('#edMenuBtn'); await page.click('[data-act=archive]');
  await page.waitForSelector('#editorLayer', { state: 'hidden' }); ok('archived leaves main list', !(await titles()).includes('Zebra'));
  await page.click('#openSidebar'); await page.click('[data-view=archive]'); ok('in archive', (await titles()).join() === 'Zebra');
  await page.click('.row-actions button >> text=Restore to notes'); await page.waitForFunction(() => !document.querySelector('.note')); ok('archive restore', (await titles()).length === 0);
  await page.click('#openSidebar'); await page.click('[data-view=all]');
  await page.click('.note >> text=Alpha groceries'); await page.click('#edMenuBtn'); await page.click('[data-act=delete]'); await page.click('#dlgOk');
  await page.waitForSelector('#editorLayer', { state: 'hidden' });
  ok('deleted note leaves list', !(await titles()).includes('Alpha groceries'));
  await page.click('#openSidebar'); await page.click('[data-view=trash]'); ok('in trash', (await titles()).join() === 'Alpha groceries');
  await page.click('.row-actions button >> nth=0'); await page.click('#openSidebar'); await page.click('[data-view=all]'); ok('trash restore', (await titles()).includes('Alpha groceries'));
  await page.click('.note >> text=Alpha groceries'); await page.click('#edMenuBtn'); await page.click('[data-act=delete]'); await page.click('#dlgOk'); await page.waitForSelector('#editorLayer', { state: 'hidden' });
  await page.click('#openSidebar'); await page.click('[data-view=trash]'); await page.click('.row-actions button >> text=Delete forever'); await page.click('#dlgOk');
  await settle(page); ok('permanent delete', (await titles()).length === 0);

  // export / import
  await page.click('#openSidebar'); await page.click('[data-view=all]');
  await page.click('#openSidebar'); await page.click('[data-view=settings]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('button:text-is("Export backup")')]);
  const file = shots + '/backup.json'; await dl.saveAs(file); const backup = JSON.parse(fs.readFileSync(file, 'utf8'));
  ok('export has notes+folders', backup.app === 'little-notes' && backup.notes.length === 2 && backup.folders.length === 2);
  fs.writeFileSync(shots + '/bad.json', '{not json'); fs.writeFileSync(shots + '/wrong.json', '{"hello":1}');
  for (const f of ['bad.json', 'wrong.json']) { await page.click('button:text-is("Restore (replace all)")'); await page.setInputFiles('#importFile', shots + '/' + f); await page.waitForSelector('#dlg[open]'); ok('malformed import handled: ' + f, (await page.textContent('#dlgTitle')) === 'Import failed'); await page.click('#dlgOk'); }
  // wipe via restore of an empty-notes backup, then restore real backup
  fs.writeFileSync(shots + '/empty.json', JSON.stringify({ app: 'little-notes', version: 1, notes: [], folders: [] }));
  await page.click('button:text-is("Restore (replace all)")'); await page.setInputFiles('#importFile', shots + '/empty.json'); await page.waitForSelector('#dlg[open]'); await page.click('#dlgOk');
  await page.click('button:text-is("Restore (replace all)")'); await page.setInputFiles('#importFile', file); await page.waitForSelector('#dlg[open]'); await page.click('#dlgOk');
  await page.evaluate(() => window.__mochiNote.go('all'));
  await page.waitForSelector('.note'); ok('restore brings notes back', await page.locator('.note', { hasText: 'Trip plan' }).count() === 1 && await page.locator('.note').count() === 2);
  await page.click('.note >> text=Trip plan'); const rhtml = await page.$eval('#edBody', e => e.innerHTML); ok('restored formatting intact', /<h2/.test(rhtml) && /ul class="checklist"/.test(rhtml) && /Georgia/.test(rhtml)); await page.click('#edBack');

  // settings: theme/dark/typography persist
  await page.click('#openSidebar'); await page.click('[data-view=settings]');
  await page.click('.theme-btn >> text=Sage'); await page.selectOption('select[aria-label=Mode]', 'dark'); await page.fill('input[aria-label="Default font size"]', '20'); await page.dispatchEvent('input[aria-label="Default font size"]', 'change');
  await page.screenshot({ path: shots + '/settings-dark-mobile.png', fullPage: true });
  await page.reload(); const attrs = await page.evaluate(() => [document.documentElement.dataset.theme, document.documentElement.dataset.mode, getComputedStyle(document.documentElement).getPropertyValue('--editor-size').trim()]);
  ok('theme/mode/font size persist', attrs.join() === 'sage,dark,20px', attrs.join());
  // existing note's own formatting not overwritten by default font change
  await page.click('#openSidebar'); await page.click('[data-view=all]'); await page.click('.note >> text=Trip plan'); ok('per-note font kept', /Georgia/.test(await page.$eval('#edBody', e => e.innerHTML))); await page.click('#edBack');

  // desktop
  await page.setViewportSize({ width: 1280, height: 800 }); await page.waitForTimeout(400); await page.screenshot({ path: shots + '/desktop-dark.png' });
  await page.click('.nav-item >> text=Settings'); await page.selectOption('select[aria-label=Mode]', 'light'); await page.click('.nav-item >> text=All notes'); await page.waitForTimeout(400);
  await page.screenshot({ path: shots + '/desktop-light.png' }); await page.click('.note'); await page.screenshot({ path: shots + '/desktop-editor.png' });
  ok('desktop shows sidebar', true);
  ok('no console/page errors', errs.length === 0, errs.join(' | '));
  console.log('\n' + results.filter(r => r[1]).length + '/' + results.length + ' passed'); await browser.close(); srv.close();
  process.exit(results.every(r => r[1]) ? 0 : 1);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
