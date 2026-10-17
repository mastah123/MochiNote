// Batch 6 (+ folder/2-column parts of batch 8): new mobile home — fixed icon header, "Your space" card, folders with Show all,
// independent grid/list toggles, 2-column fixed-size notes, search icon, all-folders page. Desktop unchanged.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => { const f = path.join(root, q.url === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, d) => e ? (r.writeHead(404), r.end()) : (r.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/plain' }), r.end(d))); });
const results = []; const ok = (n, c, x) => { results.push(!!c); console.log((c ? 'PASS ' : 'FAIL ') + n + (!c && x ? ' -> ' + x : '')); };

(async () => {
  await new Promise(r => srv.listen(0, r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME });
  const url = 'http://localhost:' + srv.address().port + '/';
  const errs = [];
  const open = async vp => {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
    await page.goto(url); await page.waitForSelector('#newNote'); return page;
  };
  const seed = page => page.evaluate(() => {
    const S = window.__mochiNote.state, now = Date.now();
    ['Personal', 'Ideas', 'Work', 'Travel', 'Recipes'].forEach((n, i) => S.folders.push({ id: 'f' + i, name: n, parentId: null, created: now + i }));
    S.folders.push({ id: 'fs', name: 'Sub', parentId: 'f0', created: now + 9 });
    const mk = (id, title, html, extra) => S.notes.push(Object.assign({ id, title, html, text: html.replace(/<[^>]+>/g, ' '), tags: [], folderId: null, color: 'default', pinned: false, archived: false, trashed: false, trashedAt: null, created: now, updated: now - parseInt(id.slice(1), 10) * 1000 }, extra));
    mk('n1', 'Pinned idea', '<div>Things to build someday and a very long line that goes on and on</div>', { pinned: true, folderId: 'f0' });
    mk('n2', 'Averyveryverylongunbrokentitlethatshouldnotstretchthecardwideropen', '<div>Averyveryverylongunbrokenwordinsidethepreviewthatmustclipnotoverflow</div>', { tags: ['ideas', 'projects', 'home'] });
    mk('n3', 'Checklist', '<ul class="checklist"><li class="done">Groceries</li><li>Laundry</li></ul><ol><li>Call mum</li></ol>', {});
    for (let i = 4; i < 30; i++) mk('n' + i, 'Filler ' + i, '<div>Some filler text ' + i + '</div>', {});
    window.__mochiNote.render();
  });
  const vis = (page, sel) => page.locator(sel).first().isVisible();
  const box = (page, sel) => page.locator(sel).first().boundingBox();
  const hist = page => page.evaluate(() => history.state && JSON.stringify(history.state));
  const titles = page => page.$$eval('#notes .note .n-title', e => e.map(x => x.textContent.trim()));

  /* ---------------- mobile ---------------- */
  const m = await open({ width: 390, height: 844 });
  await seed(m); await m.waitForTimeout(300);

  // header
  ok('header shows the menu icon (no text)', await vis(m, '#openSidebar') && (await m.textContent('#openSidebar')).trim() === '' && (await m.getAttribute('#openSidebar', 'aria-label')) === 'Open menu');
  ok('header shows a search icon (no text)', await vis(m, '#searchBtn') && (await m.textContent('#searchBtn')).trim() === '');
  ok('menu icon is left, search icon is right', (await box(m, '#openSidebar')).x < 40 && (await box(m, '#searchBtn')).x > 320);
  ok('"All notes" title is not shown on home', !(await vis(m, '#viewTitle')));
  ok('search field is hidden until the icon is tapped', !(await vis(m, '#search')));
  ok('"Your space" card is shown on home', await vis(m, '#hero') && /Your space/i.test(await m.textContent('#hero')) && /A little bit of everything/.test(await m.textContent('#hero')));

  // folders section
  const fh = await box(m, '.fh-title'), sa = await box(m, '#showAllFolders');
  ok('"Show all" sits on the right of the Folders label, same row', sa.x > fh.x + fh.width && Math.abs((sa.y + sa.height / 2) - (fh.y + fh.height / 2)) < 12, JSON.stringify([fh, sa]));
  ok('home shows only 2 folders in grid view', (await m.locator('#folderStrip .folder-card').count()) === 2 && (await m.locator('#folderStrip .folder-card .fname').allTextContents()).join() === 'Personal,Ideas');
  ok('folder cards have an icon, name and count', await m.locator('#folderStrip .folder-card:first-child .f-ico').isVisible() && /1 note|2 notes/.test(await m.textContent('#folderStrip .folder-card:first-child .fcount')));
  const f0 = await box(m, '#folderStrip .folder-card:nth-child(1)'), f1 = await box(m, '#folderStrip .folder-card:nth-child(2)');
  ok('the 2 folders sit side by side', Math.abs(f0.y - f1.y) < 2 && f1.x > f0.x + f0.width - 1, JSON.stringify([f0, f1]));
  const noteClassBefore = await m.$eval('#notes', e => e.className);
  await m.click('#fvList'); await m.waitForTimeout(200);
  ok('folder list view shows 4 folders in 2 columns x 2 rows', await (async () => {
    const c = await m.$$eval('#folderStrip .folder-card', els => els.map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.height)]; }));
    return c.length === 4 && c[0][1] === c[1][1] && c[2][1] === c[3][1] && c[2][1] > c[0][1] && c[0][0] === c[2][0] && c[1][0] === c[3][0] && c.every(x => x[2] === 64);
  })());
  ok('folder toggle does not change the notes view', (await m.$eval('#notes', e => e.className)) === noteClassBefore && (await m.getAttribute('#fvList', 'aria-pressed')) === 'true');
  ok('folder view choice is saved in preferences', await m.evaluate(() => JSON.parse(localStorage.getItem('mochinote:prefs') || '{}').folderView === 'list'));
  await m.click('#fvGrid'); await m.waitForTimeout(150);
  ok('back to grid shows 2 folders again', (await m.locator('#folderStrip .folder-card').count()) === 2);

  // notes: 2 columns, fixed size, no overflow
  const cards = await m.$$eval('#notes .note', els => els.slice(0, 6).map(e => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), sw: e.scrollWidth, cw: e.clientWidth }; }));
  ok('notes grid is 2 columns', cards[0].y === cards[1].y && cards[1].x > cards[0].x + cards[0].w - 1 && cards[2].y > cards[0].y && cards[2].x === cards[0].x, JSON.stringify(cards.slice(0, 3)));
  ok('every card has the same fixed size', cards.every(c => c.h === 176 && c.w === cards[0].w), JSON.stringify(cards));
  ok('long unbroken words do not stretch or overflow a card', cards.every(c => c.sw <= c.cw + 1), JSON.stringify(cards));
  ok('page has no sideways overflow', await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.body.scrollWidth <= innerWidth + 1));
  ok('pinned card shows an icon pin (not the emoji) above the title', await m.locator('.note:has(.pin-mark) .pm-ico').first().isVisible() && !(await m.locator('.note:has(.pin-mark) .pm-emoji').first().isVisible()));
  ok('pinned note is first', (await titles(m))[0] === 'Pinned idea');
  ok('notes label says "Recent notes" for the default sort', (await m.textContent('#notesLabel')) === 'Recent notes' && await vis(m, '#notesLabel'));

  // icon-only controls
  ok('sort is an icon (no "Sort" text) and still works', !(await vis(m, '.sel-txt')) && await vis(m, '.sel-ico'));
  await m.selectOption('#sortSelect', 'title-asc'); await m.waitForTimeout(200);
  ok('changing sort re-orders and relabels ("Notes")', (await m.textContent('#notesLabel')) === 'Notes' && (await titles(m))[0] === 'Pinned idea', (await titles(m)).slice(0, 4).join('|'));
  await m.selectOption('#sortSelect', 'edited'); await m.waitForTimeout(150);
  ok('grid / list are icons (no text)', await vis(m, '#viewGrid .seg-ico') && !(await vis(m, '#viewGrid .seg-txt')) && await vis(m, '#viewList .seg-ico'));
  ok('pinned-first / last-7-days checkboxes are not shown on phones', !(await vis(m, '#pinnedFirst')) && !(await vis(m, '#recentOnly')));

  // fixed header + sticky notes row; only content scrolls
  await m.evaluate(() => window.scrollTo(0, 900)); await m.waitForTimeout(250);
  const hb = await box(m, '#headFixed'), cb = await box(m, '.controls');
  ok('header stays fixed at the top while scrolling', Math.round(hb.y) === 0 && hb.width >= 389 && await vis(m, '#openSidebar') && await vis(m, '#searchBtn'), JSON.stringify(hb));
  ok('"Recent notes" + sort + grid/list stay pinned under the header', Math.abs(cb.y - 60) <= 2 && await vis(m, '#viewList'), JSON.stringify(cb));
  ok('hero and folders scrolled away', !(await m.evaluate(() => { const r = document.getElementById('hero').getBoundingClientRect(); return r.bottom > 60; })));
  ok('nothing but the content moved (touching header area hits the header)', await m.evaluate(() => !!document.elementFromPoint(195, 10).closest('#headFixed')));
  await m.evaluate(() => window.scrollTo(0, 0));

  // list view for notes
  await m.click('#viewList'); await m.waitForTimeout(200);
  const rows = await m.$$eval('#notes .note', els => els.slice(0, 8).map(e => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), w: Math.round(r.width), h: Math.round(r.height), sw: e.scrollWidth, cw: e.clientWidth }; }));
  ok('list view: one full-width column of fixed-height rows', rows.every(r => r.h === 96 && r.w === rows[0].w && r.x === rows[0].x) && rows[0].w > 340, JSON.stringify(rows.slice(0, 3)));
  ok('list rows never overflow', rows.every(r => r.sw <= r.cw + 1) && await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  ok('list view: the notes toggle shows list as active', (await m.getAttribute('#viewList', 'aria-pressed')) === 'true' && (await m.getAttribute('#fvGrid', 'aria-pressed')) === 'true');
  await m.click('#viewGrid'); await m.waitForTimeout(150);

  // search icon
  await m.click('#searchBtn'); await m.waitForTimeout(150);
  ok('search icon opens the field and focuses it', await vis(m, '#search') && (await m.evaluate(() => document.activeElement.id)) === 'search' && (await m.getAttribute('#searchBtn', 'aria-expanded')) === 'true');
  ok('menu icon is still there while searching', await vis(m, '#openSidebar'));
  await m.fill('#search', 'filler 7'); await m.waitForTimeout(250);
  ok('typing filters the notes', (await titles(m)).join() === 'Filler 17,Filler 27,Filler 7' || (await titles(m)).sort().join() === 'Filler 17,Filler 27,Filler 7', (await titles(m)).join());
  ok('hero and folders hide while searching', !(await vis(m, '#hero')) && !(await vis(m, '#folderSection')));
  ok('label says Results while searching', (await m.textContent('#notesLabel')) === 'Results');
  await m.click('#searchBtn'); await m.waitForTimeout(200);
  ok('✕ clears the search, closes the field and restores the home', !(await vis(m, '#search')) && (await m.inputValue('#search')) === '' && await vis(m, '#hero') && (await m.locator('#notes .note').count()) === 29);
  await m.click('#searchBtn'); await m.fill('#search', 'zzz'); await m.waitForTimeout(200); await m.keyboard.press('Escape'); await m.waitForTimeout(200);
  ok('Escape also closes search and restores everything', !(await vis(m, '#search')) && (await m.locator('#notes .note').count()) === 29);

  // all-folders page
  await m.click('#showAllFolders'); await m.waitForTimeout(250);
  ok('Show all opens a separate Folders page', (await m.getAttribute('#main', 'data-view')) === 'folders' && await vis(m, '#foldersView') && !(await vis(m, '#notesView')) && JSON.stringify(JSON.parse(await hist(m)).view) === '"folders"');
  ok('the page lists every folder (incl. subfolder path)', (await m.$$eval('#allFolders .folder-card .fname', e => e.map(x => x.textContent))).join('|') === 'Ideas|Personal|Personal / Sub|Recipes|Travel|Work', (await m.$$eval('#allFolders .folder-card .fname', e => e.map(x => x.textContent))).join('|'));
  ok('folders page has a back arrow and a New folder button; no New note button', await vis(m, '#foldersBack') && await vis(m, '#foldersNew') && !(await vis(m, '#newNote')) && !(await vis(m, '#searchBtn')));
  await m.click('#foldersBack'); await m.waitForTimeout(250);
  ok('back arrow returns to home', (await m.getAttribute('#main', 'data-view')) === 'all' && await vis(m, '#hero'));
  await m.click('#showAllFolders'); await m.waitForTimeout(200); await m.evaluate(() => history.back()); await m.waitForTimeout(250);
  ok('phone Back button also returns to home', (await m.getAttribute('#main', 'data-view')) === 'all');
  await m.click('#showAllFolders'); await m.waitForTimeout(200); await m.click('#allFolders .folder-card >> text=Work'); await m.waitForTimeout(250);
  ok('tapping a folder on that page opens it', (await m.textContent('#viewTitle')) === 'Work' && (await m.textContent('#notesLabel')) === 'Work' && !(await vis(m, '#hero')) && !(await vis(m, '#folderSection')));
  await m.evaluate(() => window.__mochiNote.go('all')); await m.waitForTimeout(150);

  // other views: label + trash cards with action buttons
  await m.evaluate(() => { const n = window.__mochiNote.state.notes.find(x => x.id === 'n5'); n.trashed = true; n.trashedAt = Date.now(); window.__mochiNote.go('trash'); }); await m.waitForTimeout(250);
  ok('Trash view: label is Trash, no hero or folders', (await m.textContent('#notesLabel')) === 'Trash' && !(await vis(m, '#hero')) && !(await vis(m, '#folderSection')));
  const tb = await m.evaluate(() => { const c = document.querySelector('#notes .note').getBoundingClientRect(); const bs = Array.from(document.querySelectorAll('#notes .note .row-actions button')).map(b => b.getBoundingClientRect()); return { c: [c.top, c.bottom], b: bs.map(r => [r.top, r.bottom, r.right]) }; });
  ok('Trash cards grow to fit their Restore / Delete buttons', tb.b.length === 2 && tb.b.every(b => b[0] >= tb.c[0] && b[1] <= tb.c[1] + 1 && b[2] <= 390), JSON.stringify(tb));
  await m.evaluate(() => window.__mochiNote.go('settings')); await m.waitForTimeout(250);
  ok('Settings: header shows the Settings title, no search icon', (await m.textContent('#viewTitle')) === 'Settings' && await vis(m, '#viewTitle') && !(await vis(m, '#searchBtn')));
  await m.evaluate(() => window.__mochiNote.go('all')); await m.waitForTimeout(150);
  await m.click('#openSidebar'); await m.waitForTimeout(250);
  ok('menu icon opens the sidebar', (await m.locator('#sidebar.open').count()) === 1);

  /* ---------------- desktop unchanged ---------------- */
  const d = await open({ width: 1280, height: 800 });
  await seed(d); await d.waitForTimeout(300);
  ok('desktop: "All notes" title still shown', await vis(d, '#viewTitle') && (await d.textContent('#viewTitle')) === 'All notes');
  ok('desktop: search field is visible, no search icon / menu icon', await vis(d, '#search') && !(await vis(d, '#searchBtn')) && !(await vis(d, '#openSidebar')));
  ok('desktop: Sort / Grid / List keep their text, checkboxes still there', await vis(d, '.sel-txt') && await vis(d, '#viewGrid .seg-txt') && !(await vis(d, '#viewGrid .seg-ico')) && await vis(d, '#pinnedFirst') && await vis(d, '#recentOnly'));
  ok('desktop: no hero card, no folder header, no notes label', !(await vis(d, '#hero')) && !(await vis(d, '.folder-head')) && !(await vis(d, '#notesLabel')));
  ok('desktop: all top-level folders still shown (not limited to 2)', (await d.locator('#folderStrip .folder-card').count()) === 5 && await vis(d, '#folderStrip .folder-strip-head'));
  ok('desktop: folder cards have no icon', !(await vis(d, '#folderStrip .f-ico')));
  ok('desktop: header is not fixed', (await d.$eval('#headFixed', e => getComputedStyle(e).position)) === 'static');
  const dn = await d.$$eval('#notes .note', els => els.slice(0, 4).map(e => Math.round(e.getBoundingClientRect().height)));
  ok('desktop: note cards keep their natural (not fixed) height and plain preview', new Set(dn).size > 1 && await vis(d, '#notes .note .n-prev') && !(await vis(d, '#notes .note .n-rich')), JSON.stringify(dn));
  ok('desktop: pinned card keeps the 📌 emoji', await vis(d, '.pin-mark .pm-emoji') && !(await vis(d, '.pin-mark .pm-ico')));
  const dc = await d.$$eval('#notes .note', els => els.slice(0, 5).map(e => Math.round(e.getBoundingClientRect().x)));
  ok('desktop: grid still auto-fills more than 2 columns', new Set(dc).size >= 3, JSON.stringify(dc));

  ok('no console/page errors', errs.length === 0, errs.join(' | '));
  const pass = results.filter(Boolean).length; console.log(`\n${pass}/${results.length} passed`);
  await browser.close(); srv.close(); process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
