// Batch 1: Back button, thin fixed header, More menu, format hidden by default, no spare bottom space.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), shots = process.argv[2] || '/tmp';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => { const f = path.join(root, q.url === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, d) => e ? (r.writeHead(404), r.end()) : (r.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/plain' }), r.end(d))); });
const results = []; const ok = (n, c, x) => { results.push(!!c); console.log((c ? 'PASS ' : 'FAIL ') + n + (!c && x ? ' -> ' + x : '')); };
(async () => {
  await new Promise(r => srv.listen(0, r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 })).newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
  const url = 'http://localhost:' + srv.address().port + '/'; await page.goto(url); await page.waitForSelector('#newNote');
  const title = () => page.textContent('#viewTitle'), edOpen = () => page.locator('#editorLayer').isVisible();
  // a note to open
  await page.click('#newNote'); await page.fill('#edTitle', 'Back test'); await page.click('#edBody'); await page.keyboard.type('line one'); await page.waitForTimeout(700);
  // format hidden by default + toggle
  ok('format bar hidden on new note', !(await page.locator('#toolbar').isVisible()));
  await page.click('#edFmt'); ok('Aa shows format bar', await page.locator('#toolbar').isVisible()); await page.click('#edFmt'); ok('Aa hides it again', !(await page.locator('#toolbar').isVisible()));
  // header: thin + stable while the status changes
  const hdr = await page.$eval('.ed-top', e => e.getBoundingClientRect().height); ok('header is thin (<=48px)', hdr <= 48, String(hdr));
  const pos = () => page.evaluate(() => ['edBack', 'edFmt', 'edMenuBtn'].map(i => { const r = document.getElementById(i).getBoundingClientRect(); return Math.round(r.x) + ',' + Math.round(r.y) + ',' + Math.round(r.width); }).join('|') + '|h=' + Math.round(document.querySelector('.ed-top').getBoundingClientRect().height));
  const p0 = await pos(); const seen = new Set([p0]);
  for (let i = 0; i < 6; i++) { await page.keyboard.type('abc'); seen.add(await pos()); await page.waitForTimeout(120); }
  await page.waitForTimeout(700); seen.add(await pos()); ok('header buttons never move while Saving…/Saved', seen.size === 1, [...seen].join(' / '));
  // More menu contents
  await page.click('#edMenuBtn'); const items = await page.$$eval('#edMenu [data-act]', e => e.map(x => x.textContent.trim()));
  ok('More = ⋮ icon', (await page.textContent('#edMenuBtn')).trim() === '' && await page.locator('#edMenuBtn svg').count() === 1);
  ok('More has Pin, Move, Archive, Trash only', items.join('|') === 'Pin|Move to folder…|Archive|Move to Trash', items.join('|'));
  ok('no folder dropdown / colour row under the title (colours now live in the ⋮ menu)', await page.locator('#edFolder:visible, #edColors:visible, #edMeta:visible').count() === 0);
  await page.click('[data-act=pin]'); await page.waitForTimeout(400); await page.click('#edMenuBtn'); ok('Pin lives in More and toggles to Unpin', (await page.textContent('#edPinItem')) === 'Unpin'); await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  // no spare space at the bottom of the editor
  const gap = await page.evaluate(() => { const f = document.querySelector('.ed-bar').getBoundingClientRect(); return { gap: Math.round(innerHeight - f.bottom), pad: getComputedStyle(document.querySelector('.ed-bar')).paddingBottom }; });
  ok('editor footer sits flush with the bottom', gap.gap === 0 && parseFloat(gap.pad) <= 8, JSON.stringify(gap));
  await page.screenshot({ path: shots + '/b1-editor.png' });
  // Back button closes the editor, not the app
  ok('editor is open', await edOpen()); await page.goBack(); await page.waitForTimeout(400);
  ok('Back closes the editor and stays in the app', !(await edOpen()) && page.url() === url && await page.locator('.note', { hasText: 'Back test' }).count() === 1);
  // view navigation: All -> Trash -> Back -> All
  await page.click('#openSidebar'); await page.click('[data-view=trash]'); ok('went to Trash', (await title()) === 'Trash');
  await page.goBack(); await page.waitForTimeout(300); ok('Back from Trash returns to All notes', (await title()) === 'All notes' && page.url() === url);
  // sidebar: open -> Back closes it
  await page.click('#openSidebar'); ok('sidebar open', await page.$eval('#sidebar', e => e.classList.contains('open'))); await page.goBack(); await page.waitForTimeout(300);
  ok('Back closes the menu', !(await page.$eval('#sidebar', e => e.classList.contains('open'))) && page.url() === url);
  // folder -> note -> Back -> Back
  await page.click('#openSidebar'); await page.click('#addFolderBtn'); await page.fill('#dlgInput', 'Zed'); await page.click('#dlgOk'); await page.waitForTimeout(250);
  await page.click('#sideFolders button:has-text("Zed")'); await page.waitForTimeout(250); ok('opened folder view', (await title()) === 'Zed');
  await page.click('#newNote'); await page.waitForTimeout(300); ok('new note opens', await edOpen());
  await page.goBack(); await page.waitForTimeout(400); ok('Back 1: editor closes, still in folder', !(await edOpen()) && (await title()) === 'Zed');
  await page.goBack(); await page.waitForTimeout(300); ok('Back 2: previous page (All notes)', (await title()) === 'All notes');
  // archive from More pops the editor entry cleanly
  await page.click('.note >> text=Back test'); await page.click('#edMenuBtn'); await page.click('[data-act=archive]'); await page.waitForTimeout(500);
  ok('archive via More closes editor and stays on list', !(await edOpen()) && (await title()) === 'All notes' && await page.locator('.note', { hasText: 'Back test' }).count() === 0);
  ok('after archive the history is back at the list entry', await page.evaluate(() => history.state && history.state.kind === 'view'));
  // list screen has no extra bottom padding beyond the FAB clearance
  const mp = await page.$eval('.main', e => parseFloat(getComputedStyle(e).paddingBottom)); ok('home bottom padding is only FAB clearance (<=84px)', mp <= 84, String(mp));
  const fab = await page.$eval('#newNote', e => { const r = e.getBoundingClientRect(); return { pos: getComputedStyle(e).position, gap: Math.round(innerHeight - r.bottom) }; }); ok('New note is fixed + floating', fab.pos === 'fixed' && fab.gap === 18, JSON.stringify(fab));
  ok('no console/page errors', errs.length === 0, errs.join(' | '));
  console.log('\n' + results.filter(Boolean).length + '/' + results.length + ' passed'); await browser.close(); srv.close(); process.exit(results.every(Boolean) ? 0 : 1);
})().catch(e => { console.error('CRASH', e.message.split('\n').slice(0, 6).join('\n')); process.exit(2); });
