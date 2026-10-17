// Batch 11 (v8): one icon set, single grid/list toggle, note colours on cards (+ theme in the ⋮ menu), editable "Your space", no menu close button.
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
  const open = async vp => { const page = await (await browser.newContext({ viewport: vp, deviceScaleFactor: 2 })).newPage(); page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text())); await page.goto(url); await page.waitForSelector('#newNote'); return page; };
  const seed = page => page.evaluate(() => {
    const S = window.__mochiNote.state, now = Date.now();
    S.folders.push({ id: 'f0', name: 'Work', parentId: null, created: now });
    ['default', 'yellow', 'green', 'blue', 'pink', 'lilac'].forEach((c, i) => S.notes.push({ id: 'n' + i, title: 'Note ' + c, html: '<div>hello</div>', text: 'hello', tags: [], folderId: i === 0 ? 'f0' : null, color: c, pinned: i === 0, archived: false, trashed: false, trashedAt: null, created: now - i, updated: now - i }));
    window.__mochiNote.render();
  });
  const vis = (p, s) => p.locator(s).first().isVisible();
  const press = async (page, sel) => { const b = await page.locator(sel).first().boundingBox(); await page.mouse.move(b.x + 40, b.y + 30); await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up(); await page.waitForTimeout(300); };
  const bg = (page, sel) => page.locator(sel).first().evaluate(e => getComputedStyle(e).backgroundColor);
  const cssVar = (page, v) => page.evaluate(v => { const d = document.createElement('div'); d.style.background = 'var(' + v + ')'; document.body.append(d); const c = getComputedStyle(d).backgroundColor; d.remove(); return c; }, v);

  /* ---------------- phone ---------------- */
  const m = await open({ width: 390, height: 844 }); await seed(m); await m.waitForTimeout(300);

  // 13: no close button in the menu
  await m.click('#openSidebar'); await m.waitForTimeout(250);
  ok('menu has no Close button', (await m.locator('#closeSidebar').count()) === 0 && !/Close/.test(await m.textContent('#sidebar')));
  // 1: icons
  ok('menu items use line icons (svg), no emoji', (await m.locator('#nav .nav-item .nav-ico svg').count()) === 5 && !/[📌🗄🗑⚙▤]/u.test(await m.textContent('#nav')));
  ok('sidebar folder rows use the folder icon', (await m.locator('#sideFolders .side-item .fl-name svg').count()) === 1 && !/📁/.test(await m.textContent('#sideFolders')));
  ok('icons share the home icon style (stroke 1.9, round)', await m.$$eval('#nav .nav-ico svg', e => e.every(s => s.getAttribute('stroke-width') === '1.9' && s.getAttribute('stroke-linecap') === 'round')));
  await m.evaluate(() => history.back()); await m.waitForTimeout(250);
  ok('phone Back / scrim closes the menu (no button needed)', (await m.locator('#sidebar.open').count()) === 0);
  await m.click('#openSidebar'); await m.waitForTimeout(200); await m.evaluate(() => document.getElementById('scrim').click()); await m.waitForTimeout(250);
  ok('tapping outside closes the menu', (await m.locator('#sidebar.open').count()) === 0);

  // 2: single grid/list icon
  ok('notes: only one view icon visible (list icon while in grid)', await vis(m, '#viewList') && !(await vis(m, '#viewGrid')));
  ok('folders: only one view icon visible', await vis(m, '#fvList') && !(await vis(m, '#fvGrid')));
  const vb = await m.locator('#viewList').boundingBox(), fb = await m.locator('#fvList').boundingBox();
  ok('the single icon is one button wide (not two side by side)', vb.width <= 44 && fb.width <= 44);
  await m.click('#viewList'); await m.waitForTimeout(200);
  ok('tapping switches notes to list and the icon flips to grid', await m.$eval('#notes', e => e.classList.contains('list')) && await vis(m, '#viewGrid') && !(await vis(m, '#viewList')));
  await m.click('#viewGrid'); await m.waitForTimeout(200);
  ok('tapping again switches back to grid', await m.$eval('#notes', e => e.classList.contains('grid')) && await vis(m, '#viewList'));
  await m.click('#fvList'); await m.waitForTimeout(150);
  ok('folder toggle flips too, independently of notes', await vis(m, '#fvGrid') && !(await vis(m, '#fvList')) && await vis(m, '#viewList'));
  await m.click('#fvGrid'); await m.waitForTimeout(150);

  // 11: note colours on home cards
  const cols = { yellow: '--c-yellow', green: '--c-green', blue: '--c-blue', pink: '--c-pink', lilac: '--c-lilac', default: '--c-default' };
  let all = true;
  for (const [c, v] of Object.entries(cols)) { const got = await bg(m, '.note[aria-label="Open note Note ' + c + '"]'); const exp = await cssVar(m, v); if (c !== 'default' ? got !== exp : got === (await cssVar(m, '--c-yellow'))) all = false; if (got !== exp && c !== 'default') console.log('   ', c, got, exp); }
  ok('home cards show each note\'s own colour', all);
  ok('coloured and default cards differ', (await bg(m, '.note[aria-label="Open note Note pink"]')) !== (await bg(m, '.note[aria-label="Open note Note default"]')));
  // theme from the ⋮ menu
  await m.click('.note[aria-label="Open note Note default"]'); await m.waitForTimeout(250);
  await m.click('#edMenuBtn'); await m.waitForTimeout(150);
  ok('⋮ menu has a Theme row with the 6 colours (phone)', await vis(m, '#edMenuTheme') && (await m.locator('#edMenuColors .swatch').count()) === 6);
  ok('⋮ menu items have icons', (await m.locator('#edMenu [data-act] svg').count()) === 4);
  await m.click('#edMenuColors .swatch[title="blue"]'); await m.waitForTimeout(150);
  ok('picking a colour keeps the menu open and tints the note', await vis(m, '#edMenu') && (await m.$eval('#editor', e => e.classList.contains('nc'))) && (await m.locator('#edMenuColors .swatch.on').getAttribute('title')) === 'blue');
  await m.keyboard.press('Escape'); await m.waitForTimeout(150);
  await m.click('#edBack'); await m.waitForTimeout(700);
  ok('after saving, the home card follows the new colour', (await bg(m, '.note[aria-label="Open note Note default"]')) === (await cssVar(m, '--c-blue')));
  ok('colour is stored on the note', await m.evaluate(() => window.__mochiNote.state.notes.find(n => n.id === 'n0').color) === 'blue');

  // 12: Your space card
  ok('Your space card has an edit button', await vis(m, '#heroEdit'));
  await m.click('#heroEdit'); await m.waitForTimeout(250);
  ok('edit opens a dialog with the title and subtitle', await vis(m, '#dlg') && (await m.inputValue('#dlgInput')) === 'A little bit of everything ☁️' && (await m.inputValue('#dlgInput2')) === 'Ideas, reminders & random thoughts.');
  await m.fill('#dlgInput', 'My cozy corner 🌿'); await m.fill('#dlgInput2', 'Notes for later.'); await m.click('#dlgOk'); await m.waitForTimeout(300);
  ok('card shows the new text', (await m.textContent('#heroTitle')) === 'My cozy corner 🌿' && (await m.textContent('#heroSub')) === 'Notes for later.' && /Your space/i.test(await m.textContent('#hero')));
  await m.reload(); await m.waitForSelector('#newNote'); await m.waitForTimeout(300);
  ok('the edit is remembered after a reload', (await m.textContent('#heroTitle')) === 'My cozy corner 🌿');
  await seed(m); await m.waitForTimeout(250);
  await press(m, '#hero');
  ok('long-press on the card opens a popup next to it', await vis(m, '#sheetLayer') && (await m.textContent('#sheetTitle')) === 'Your space' && (await m.$$eval('#sheetItems button', e => e.map(x => x.lastChild.textContent.trim()))).join('|') === 'Edit|Reset to default');
  const hb = await m.locator('#hero').boundingBox(), sb = await m.locator('#sheet').boundingBox();
  ok('popup sits below the card and on screen', sb.y >= hb.y + hb.height && sb.x >= 0 && sb.x + sb.width <= 390, JSON.stringify({ hb, sb }));
  await m.click('#sheetItems >> text=Edit'); await m.waitForTimeout(400);
  ok('Edit from the popup opens the dialog', await vis(m, '#dlg') && (await m.inputValue('#dlgInput')) === 'My cozy corner 🌿');
  await m.fill('#dlgInput', ''); await m.fill('#dlgInput2', ''); await m.click('#dlgOk'); await m.waitForTimeout(300);
  ok('empty fields fall back to the defaults', (await m.textContent('#heroTitle')) === 'A little bit of everything ☁️' && (await m.textContent('#heroSub')) === 'Ideas, reminders & random thoughts.');
  await m.click('#heroEdit'); await m.fill('#dlgInput', 'Temp'); await m.click('#dlgOk'); await m.waitForTimeout(250);
  await press(m, '#hero'); await m.click('#sheetItems >> text=Reset to default'); await m.waitForTimeout(350);
  ok('Reset to default restores the original text', (await m.textContent('#heroTitle')) === 'A little bit of everything ☁️');
  await m.click('#heroEdit'); await m.waitForTimeout(200); await m.click('#dlgCancel'); await m.waitForTimeout(200);
  ok('Cancel keeps things unchanged', (await m.textContent('#heroTitle')) === 'A little bit of everything ☁️');
  await m.screenshot({ path: (process.env.SHOTS || '/tmp') + '/b11-phone.png' });

  // editor back + more icons
  await m.click('.note[aria-label="Open note Note green"]'); await m.waitForTimeout(250);
  ok('editor back and more buttons are svg icons', (await m.locator('#edBack svg').count()) === 1 && (await m.locator('#edMenuBtn svg').count()) === 1 && (await m.textContent('#edBack')).trim() === '');
  await m.click('#edMenuBtn'); await m.click('[data-act=pin]'); await m.waitForTimeout(250);
  await m.click('#edMenuBtn');
  ok('Pin/Unpin label still toggles', (await m.textContent('#edPinItem')).trim() === 'Unpin');
  await m.keyboard.press('Escape');

  /* ---------------- desktop ---------------- */
  const d = await open({ width: 1280, height: 800 }); await seed(d); await d.waitForTimeout(300);
  ok('desktop: sidebar nav uses the same line icons', (await d.locator('#nav .nav-ico svg').count()) === 5 && (await d.locator('#sideFolders .fl-name svg').count()) === 1);
  ok('desktop: search field has the line search icon', await vis(d, '.search-ico svg'));
  ok('desktop: no close button either', (await d.locator('#closeSidebar').count()) === 0);
  ok('desktop: Grid / List keep their two labelled buttons side by side', await vis(d, '#viewGrid') && await vis(d, '#viewList') && await vis(d, '#viewGrid .seg-txt'));
  ok('desktop: no "Your space" card / edit button', !(await vis(d, '#hero')) && !(await vis(d, '#heroEdit')));
  await d.click('.note[aria-label="Open note Note green"]'); await d.waitForTimeout(250);
  ok('desktop: swatch row visible, Theme row in ⋮ hidden', await vis(d, '#edColors') && (await d.locator('#edColors .swatch').count()) === 6);
  await d.click('#edMenuBtn'); await d.waitForTimeout(150);
  ok('desktop: ⋮ menu has no Theme row but has icons', !(await vis(d, '#edMenuTheme')) && (await d.locator('#edMenu [data-act] svg').count()) === 4);
  await d.keyboard.press('Escape');
  await d.click('#edColors .swatch[title="pink"]'); await d.waitForTimeout(800);
  await d.click('#edBack'); await d.waitForTimeout(500);
  ok('desktop: card follows the colour picked in the row', (await bg(d, '.note[aria-label="Open note Note green"]')) === (await cssVar(d, '--c-pink')));
  await d.click('#nav [data-view=settings]'); await d.waitForTimeout(250);
  ok('desktop: settings view still opens', (await d.textContent('#viewTitle')) === 'Settings');

  ok('no console/page errors', errs.length === 0, errs.join(' | '));
  const pass = results.filter(Boolean).length; console.log(`\n${pass}/${results.length} passed`);
  await browser.close(); srv.close(); process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
