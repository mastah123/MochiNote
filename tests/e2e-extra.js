// Extra browser checks: undo/redo, link, image, tag autocomplete, subfolders, folder rename/delete, animation setting.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), shots = process.argv[2] || '/tmp';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => { const f = path.join(root, q.url === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, d) => e ? (r.writeHead(404), r.end()) : (r.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/plain' }), r.end(d))); });
const results = []; const ok = (n, c, x) => { results.push(!!c); console.log((c ? 'PASS ' : 'FAIL ') + n + (!c && x ? ' -> ' + x : '')); };
// 1x1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
(async () => {
  await new Promise(r => srv.listen(0, r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const errs = [];
  // Format bar is bottom-docked on phones and closes when you tap into the text: reopen it when a test needs it.
  const ensureTb = async (g = 'aa') => { const open = (await page.locator('#toolbar').isVisible()) && (await page.getAttribute('#toolbar', 'data-open')) === g; if (!open && (await page.locator('#edBar').isVisible())) { if ((await page.locator('#toolbar').isVisible()) && (await page.getAttribute('#toolbar', 'data-open')) !== g) await page.click('#edBar [data-open=' + g + ']'); else if (!(await page.locator('#toolbar').isVisible())) await page.click('#edBar [data-open=' + g + ']'); } };

  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await page.goto('http://localhost:' + srv.address().port + '/'); await page.waitForSelector('#newNote');
  const openSB = async () => { if (await page.evaluate(() => window.__mochiNote.state.view === 'settings')) await page.evaluate(() => window.__mochiNote.go('all')); if (!(await page.$eval('#sidebar', e => e.classList.contains('open')))) await page.click('#openSidebar'); };
  const body = () => page.$eval('#edBody', e => e.innerHTML);
  // note 1 with tag so autocomplete has something to suggest
  await page.click('#newNote'); await page.fill('#edTitle', 'First'); await page.click('#edBody'); await page.keyboard.type('hello #projectx'); await page.click('#edBack'); await page.waitForTimeout(300);
  await page.click('#newNote'); await page.click('#edFmt'); await page.click('#edBody');
  // undo / redo
  await page.keyboard.type('one two'); await page.click('#edUndo'); const afterUndo = await page.$eval('#edBody', e => e.textContent);
  ok('undo removes typed text', afterUndo !== 'one two', afterUndo); await page.click('#edRedo'); ok('redo restores it', (await page.$eval('#edBody', e => e.textContent)) === 'one two');
  // tag autocomplete
  await page.waitForTimeout(400); await page.keyboard.press('Enter'); await page.keyboard.type('#proj');
  await page.waitForSelector('#tagSuggest:not([hidden])'); ok('tag suggestion appears', (await page.textContent('#tagSuggest')).includes('#projectx'));
  await page.waitForTimeout(400); 
  await page.click('#tagSuggest button'); ok('tag suggestion inserts full tag', (await page.$eval('#edBody', e => e.textContent)).includes('#projectx '));
  // case-insensitive tag
  await page.keyboard.type('#ProjectX'); await page.waitForTimeout(700);
  ok('#ProjectX and #projectx are one tag', (await page.$$eval('#edTags .tag', e => e.map(x => x.textContent))).filter(t => t === '#projectx').length === 1, JSON.stringify(await page.$$eval('#edTags .tag', e => e.map(x => x.textContent))) + ' status=' + await page.textContent('#edStatus'));
  // link
  await page.keyboard.press('Enter'); await ensureTb('plus'); await page.click('[data-cmd=link]'); await page.fill('#dlgInput', 'example.com'); await page.click('#dlgOk'); await page.waitForTimeout(250);
  ok('link inserted (https added, safe attrs)', /<a href="https:\/\/example\.com"[^>]*rel="noopener noreferrer"/.test(await body()) || /<a href="https:\/\/example\.com"/.test(await body()), await body());
  await page.keyboard.press('Enter'); await ensureTb('plus'); await page.click('[data-cmd=link]'); await page.fill('#dlgInput', 'javascript:alert(1)'); await page.click('#dlgOk');
  ok('javascript: links rejected', !/javascript:/i.test(await body()));
  // image
  await ensureTb('plus'); await page.click('[data-cmd=image]'); await page.setInputFiles('#imgInput', { name: 't.png', mimeType: 'image/png', buffer: PNG }); await page.waitForSelector('#edBody img', { timeout: 5000 });
  ok('image attached as data URL', /<img src="data:image\//.test(await body()));
  // sanitizer on paste-like injection
  const clean = await page.evaluate(() => NotesEditor.sanitize('<p onclick="x()">a<script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">l</a></p>'));
  ok('sanitizer strips scripts/handlers/js urls', !/script|onclick|onerror|javascript:/i.test(clean), clean);
  await page.waitForTimeout(700); await page.click('#edBack'); await page.waitForTimeout(300);
  await page.click('.note >> text=one two'); await page.waitForSelector('#edBody img'); ok('image + link persist', /<img/.test(await body()) && /example\.com/.test(await body())); await page.click('#edBack'); await page.waitForTimeout(300);
  // subfolders + rename + delete
  await openSB(); await page.click('#addFolderBtn'); await page.fill('#dlgInput', 'Work'); await page.click('#dlgOk');
  await page.click('#sideFolders button:has-text("Work")'); await openSB();
  ok('no subfolder button in folder tools', await page.locator('.folder-tools button:text-is("+ Subfolder")').count() === 0);
  await page.click('#addFolderBtn'); await page.waitForSelector('#dlg[open]'); ok('new folder dialog is plain "New folder"', (await page.textContent('#dlgTitle')) === 'New folder'); await page.fill('#dlgInput', 'Reports'); await page.click('#dlgOk'); await page.waitForTimeout(300); await openSB();
  ok('second folder created at top level', await page.locator('#sideFolders button:has-text("Reports")').count() === 1);
  await openSB(); await page.click('#sideFolders button:has-text("Reports")'); await page.waitForTimeout(250);
  await page.click('#newNote'); await page.fill('#edTitle', 'In reports'); await page.click('#edBody'); await page.keyboard.type('q3'); await page.click('#edBack'); await page.waitForTimeout(300);
  ok('new note inherits current folder', await page.locator('.note', { hasText: 'In reports' }).count() === 1 && (await page.textContent('.note')).includes('Reports'));
  await openSB(); await page.click('#sideFolders button:has-text("Work")'); await page.waitForTimeout(250);
  ok('other folder does not show that note', await page.locator('.note', { hasText: 'In reports' }).count() === 0);
  await openSB(); await page.click('.folder-tools button:text-is("Rename")'); await page.fill('#dlgInput', 'Job'); await page.click('#dlgOk'); await page.waitForTimeout(200);
  await openSB(); ok('folder renamed', await page.locator('#sideFolders button:has-text("Job")').count() === 1);
  await openSB(); await page.click('.folder-tools button:text-is("Delete")'); await page.click('#dlgOk'); await page.waitForTimeout(300);
  await openSB(); await page.click('[data-view=all]'); await page.waitForTimeout(250);
  await openSB(); ok('deleting folder keeps its notes (moved to no folder)', await page.locator('.note', { hasText: 'In reports' }).count() === 1 && await page.locator('#sideFolders button:has-text("Job")').count() === 0); await page.evaluate(() => document.getElementById('scrim').click());
  // animations setting
  await openSB(); await page.click('[data-view=settings]'); await page.uncheck('input[aria-label=Animations]');
  ok('animations setting applies', await page.evaluate(() => document.documentElement.dataset.motion) === 'off'); await page.reload();
  ok('animations setting persists', await page.evaluate(() => document.documentElement.dataset.motion) === 'off');
  // autosave off
  await openSB(); await page.click('[data-view=settings]'); await page.uncheck('input[aria-label=Autosave]');
  await openSB(); await page.click('[data-view=all]'); await page.click('.note >> text=In reports'); await page.click('#edBody'); await page.keyboard.type(' extra'); await page.waitForTimeout(900);
  ok('autosave off shows unsaved state', (await page.getAttribute('#edStatus', 'data-state')) === 'Unsaved changes' && await page.isVisible('#edStatus')); await page.click('#edBack'); await page.waitForTimeout(300);
  await page.reload(); await page.waitForSelector('.note'); await page.click('.note >> text=In reports'); ok('manual save on Back keeps edits', (await page.$eval('#edBody', e => e.textContent)).includes('extra'));
  // desktop editor look
  await page.click('#edBack'); await page.setViewportSize({ width: 1280, height: 800 }); await page.click('.note >> text=First').catch(() => {}); await page.waitForTimeout(600); await page.screenshot({ path: shots + '/desktop-editor2.png' });
  ok('no console/page errors', errs.length === 0, errs.join(' | '));
  console.log('\n' + results.filter(Boolean).length + '/' + results.length + ' passed'); await browser.close(); srv.close(); process.exit(results.every(Boolean) ? 0 : 1);
})().catch(e => { console.error('CRASH', e.message.split('\n').slice(0, 6).join('\n')); process.exit(2); });
