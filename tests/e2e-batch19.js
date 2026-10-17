// v19 (desktop): note top bar follows the phone: undo/redo icons, save icon by the dots, Edited + theme in the menu, no Format/Pin text buttons, no meta row
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'); const shots = process.env.SHOTS || '/tmp';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const f = path.join(root, q.url === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, d) => e ? (r.writeHead(404), r.end()) : (r.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/plain' }), r.end(d))); });
const results = []; const ok = (n, c, x) => { results.push(!!c); console.log((c ? 'PASS ' : 'FAIL ') + n + (!c && x ? ' -> ' + x : '')); };
(async () => {
  await new Promise(r => srv.listen(0, r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME });
  const url = 'http://localhost:' + srv.address().port + '/'; const errs = [];
  const d = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })).newPage();
  d.on('pageerror', e => errs.push(e.message)); d.on('console', x => x.type() === 'error' && errs.push(x.text()));
  await d.goto(url); await d.waitForSelector('#newNote');
  const R = s => d.locator(s).first().evaluate(e => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; });
  const vis = s => d.locator(s).first().isVisible();
  await d.click('#newNote'); await d.waitForSelector('#edBody'); await d.waitForTimeout(300);
  await d.fill('#edTitle', 'Desktop top bar'); await d.click('#edBody'); await d.keyboard.type('hello world'); await d.waitForTimeout(900);
  const back = await R('#edBack'), undo = await R('#edUndo'), redo = await R('#edRedo'), save = await R('#edStatus'), dots = await R('#edMenuBtn');
  ok('header: back, undo, redo on the left', back.r <= undo.l + 1 && undo.r <= redo.l + 4 && redo.r - back.l < 160, JSON.stringify({ back, undo, redo }));
  ok('header: undo/redo are small icons, like the phone', undo.w <= 36 && redo.w <= 36 && (await d.locator('#edUndo svg').count()) === 1);
  ok('header: save icon sits beside the 3 dots on the right', save.r <= dots.l + 1 && dots.l - save.r < 24 && dots.l > 600, JSON.stringify({ save, dots }));
  ok('save icon shows the status', ['✓', '⟳', '●'].includes((await d.textContent('#edStatus')).trim()) && (await d.getAttribute('#edStatus', 'aria-label')).length > 0);
  ok('the text save pill, Format and Pin text buttons are gone', await d.locator('#edStatusDesktop, #edFmtDesktop, #edPin').count() === 0);
  ok('the folder / colour row under the title is gone', await d.locator('#edMeta, #edFolder, #edColors').count() === 0);
  ok('the footer shows nothing when the note has no tags', !(await vis('.ed-foot')));
  ok('the toolbar is still there with its text labels (layout unchanged), without its own undo/redo', await vis('#toolbar') && await vis('[data-cmd=bold]') && !(await vis('#toolbar [data-cmd=undo]')));
  // undo / redo work
  await d.click('#edUndo'); await d.waitForTimeout(150);
  ok('undo removes the typing', !(await d.textContent('#edBody')).includes('hello world'), await d.textContent('#edBody'));
  await d.click('#edRedo'); await d.waitForTimeout(150);
  ok('redo brings it back', (await d.textContent('#edBody')).includes('hello world'));
  // menu
  await d.click('#edMenuBtn'); await d.waitForTimeout(150);
  ok('menu: Edited line', (await d.textContent('#edMenuInfo')).startsWith('Edited ') && await vis('#edMenuInfo'));
  ok('menu: theme swatches and the four actions with icons', (await d.locator('#edMenuColors .swatch').count()) === 6 && (await d.locator('#edMenu [data-act] svg').count()) === 4);
  ok('menu: the menu stays inside the window', (await R('#edMenu')).r <= 1280 && (await R('#edMenu')).b <= 800);
  await d.screenshot({ path: shots + '/b19-desktop.png' });
  await d.click('[data-act=pin]'); await d.waitForTimeout(400);
  ok('Pin works from the menu', await d.evaluate(() => window.__mochiNote.state.notes[0].pinned === true));
  await d.click('#edMenuBtn'); await d.click('#edMenuColors .swatch[title="pink"]'); await d.waitForTimeout(300);
  ok('theme works from the menu', await d.evaluate(() => window.__mochiNote.state.notes[0].color === 'pink'));
  await d.keyboard.press('Escape');
  ok('no console/page errors', errs.length === 0, errs.join(' | '));
  const pass = results.filter(Boolean).length; console.log(`\n${pass}/${results.length} passed`);
  await browser.close(); srv.close(); process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
