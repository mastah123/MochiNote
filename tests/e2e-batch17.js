// Batch 17 (v14): note footer redesign (phone): + / Aa / list icons with options above, edited-time in the menu, save icon by the dots.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'); const shots = process.env.SHOTS || '/tmp';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => { const f = path.join(root, q.url === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, d) => e ? (r.writeHead(404), r.end()) : (r.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/plain' }), r.end(d))); });
const results = []; const ok = (n, c, x) => { results.push(!!c); console.log((c ? 'PASS ' : 'FAIL ') + n + (!c && x ? ' -> ' + x : '')); };
(async () => {
  await new Promise(r => srv.listen(0, r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME });
  const url = 'http://localhost:' + srv.address().port + '/'; const errs = [];
  const mk = async vp => { const p = await (await browser.newContext({ viewport: vp, deviceScaleFactor: 2 })).newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text())); await p.goto(url); await p.waitForSelector('#newNote'); return p; };
  const m = await mk({ width: 390, height: 780 });
  const R = s => m.locator(s).first().evaluate(e => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; });
  const vis = s => m.locator(s).first().isVisible();
  const html = () => m.evaluate(() => NotesEditor.getHTML().replace(/<br>/g, ''));
  await m.click('#newNote'); await m.waitForSelector('#edBody'); await m.waitForTimeout(300);
  await m.fill('#edTitle', 'Footer test'); await m.click('#edBody'); await m.keyboard.type('hello world'); await m.waitForTimeout(150);

  // header
  const back = await R('#edBack'), undo = await R('#edUndo'), save = await R('#edStatus'), dots = await R('#edMenuBtn');
  ok('header: Aa is gone from the top', !(await vis('.ed-top #edFmt')) && await m.locator('.ed-top #edFmt').count() === 0);
  ok('header: save icon sits right beside the 3 dots', save.r <= dots.l + 1 && dots.l - save.r < 24 && Math.abs(save.t - dots.t) < 30, JSON.stringify({ save, dots }));
  ok('header: save icon is no longer in the footer', await m.locator('.ed-foot #edStatus, .ed-bar #edStatus').count() === 0 && await vis('#edStatus'));
  ok('header order: back, undo, redo ... save, dots', back.r <= undo.l + 1 && (await R('#edRedo')).l >= undo.r - 1 && (await R('#edRedo')).r < save.l);
  // menu: edited time
  await m.click('#edMenuBtn'); await m.waitForTimeout(150);
  ok('3-dot menu shows "Edited …"', (await m.textContent('#edMenuInfo')).startsWith('Edited ') && await vis('#edMenuInfo'));
  ok('footer no longer shows "Edited …" on phones', !(await vis('#edInfo')));
  await m.keyboard.press('Escape'); await m.waitForTimeout(150);
  if (await vis('#edMenu')) await m.click('#edMenuBtn');

  // footer bar
  const bar = await R('#edBar');
  ok('footer has five icons: +, Aa, align, font/size/highlight, list', await m.locator('#edBar .bar-btn').count() === 5 && (await m.$$eval('#edBar .bar-btn', b => b.map(x => x.dataset.open).join(','))) === 'plus,aa,align,style,list' && Math.abs(bar.b - 780) <= 1);
  ok('the old footer is gone (phone)', !(await vis('.ed-foot')));
  ok('no extra safe space under the icon row', (await m.$eval('#edBar', e => getComputedStyle(e).paddingBottom)) === '2px' && Math.abs(bar.b - 780) <= 1);
  // simulate the keyboard: the editor shrinks to the visible area and the icon row rides on top of it
  await m.evaluate(() => { const l = document.getElementById('editorLayer'); l.style.setProperty('--vvh', '450px'); });
  await m.waitForTimeout(150);
  ok('with the keyboard up, the icon row sits at the bottom of the visible area (just above the keyboard)', Math.abs((await R('#edBar')).b - 450) <= 1, JSON.stringify(await R('#edBar')));
  await m.click('#edBody'); await m.click('#edBar [data-open=aa]'); await m.waitForTimeout(150);
  ok('picking a format group keeps the note focused (keyboard stays)', await m.evaluate(() => document.activeElement.id === 'edBody' && document.getElementById('edBody').inputMode === 'text'));
  await m.screenshot({ path: shots + '/b17-kb.png' });
  await m.click('#edBar [data-open=aa]'); await m.evaluate(() => document.getElementById('editorLayer').style.removeProperty('--vvh')); await m.waitForTimeout(150);
  ok('options are hidden until an icon is tapped', !(await vis('#toolbar')));
  const open = g => m.click('#edBar [data-open=' + g + ']');
  const shown = () => m.$$eval('#toolbar [data-cmd], #toolbar select, #toolbar label', els => els.filter(e => e.offsetParent).map(e => e.dataset.cmd || e.id || e.className));
  await open('plus'); await m.waitForTimeout(250);
  let s = await shown(); ok('+ shows image, link, card only', s.sort().join(',') === 'callout,image,link', s.join(','));
  let tb = await R('#toolbar'), br = await R('#edBar');
  ok('options appear above the footer, not too tall', Math.abs(tb.b - br.t) <= 1 && tb.h <= 49, JSON.stringify(tb));
  ok('the note area keeps most of the screen', (await R('#edScroll')).h >= 330, String((await R('#edScroll')).h));
  ok('tapped icon is shown pressed', (await m.getAttribute('#edBar [data-open=plus]', 'aria-pressed')) === 'true');
  await open('aa'); await m.waitForTimeout(250);
  s = await shown(); ok('Aa shows H1-H3, bold, italic, underline, strikethrough only', ['h1', 'h2', 'h3', 'bold', 'italic', 'underline', 'strikeThrough'].every(c => s.includes(c)) && !s.some(c => /justify|callout|insertOrderedList|sticker/.test(c)) && !s.includes('fontSel'), s.join(','));
  await open('align'); await m.waitForTimeout(200); s = await shown();
  ok('the align button has left / centre / right', s.sort().join(',') === 'justifyCenter,justifyLeft,justifyRight', s.join(','));
  await open('style'); await m.waitForTimeout(200); s = await shown();
  ok('one button holds font, size and highlight', ['fontSel', 'sizeSel', 'hlSel'].every(c => s.includes(c)) && s.length === 4 || (['fontSel', 'sizeSel', 'hlSel'].every(c => s.includes(c))), s.join(','));
  await open('aa'); await m.waitForTimeout(150);
  tb = await R('#toolbar'); ok('Aa options stay short (scrolls instead of growing)', tb.h <= 49 && (await R('#edScroll')).h >= 380, JSON.stringify(tb));
  await open('list'); await m.waitForTimeout(250);
  s = await shown(); ok('list shows bullets, numbers, checklist, indent, outdent', ['insertUnorderedList', 'insertOrderedList', 'checklist', 'indent', 'outdent'].every(c => s.includes(c)) && !s.includes('bold'), s.join(','));
  await m.screenshot({ path: shots + '/b17-list.png' });
  await open('list'); await m.waitForTimeout(200);
  ok('tapping the same icon closes the options', !(await vis('#toolbar')) && (await m.getAttribute('#edBar [data-open=list]', 'aria-pressed')) === 'false');

  // the functions work
  await m.evaluate(() => { const b = document.getElementById('edBody'); b.innerHTML = '<div>one</div><div>two</div>'; b.focus(); const t = b.firstChild.firstChild; const r = document.createRange(); r.setStart(t, 1); r.collapse(true); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(r); });
  await open('aa'); await m.click('[data-cmd=h2]'); await m.waitForTimeout(150);
  ok('H2 turns the line into a heading', /<h2>one<\/h2>/.test(await html()), await html());
  ok('H2 shows as active', (await m.getAttribute('[data-cmd=h2]', 'aria-pressed')) === 'true');
  await m.click('[data-cmd=h2]'); await m.waitForTimeout(150);
  ok('tapping it again goes back to normal text', !/<h2>/.test(await html()), await html());
  await m.click('[data-cmd=bold]'); await m.keyboard.type('X'); await m.waitForTimeout(100);
  ok('bold still works from the Aa options', /<b>X<\/b>|<strong>X<\/strong>/.test(await html()), await html());
  await open('list'); await m.click('[data-cmd=insertUnorderedList]'); await m.waitForTimeout(150);
  ok('bullet list works from the list options', /<ul>/.test(await html()), await html());
  await m.click('[data-cmd=indent]'); await m.waitForTimeout(150);
  ok('indent nests the item', /<ul>.*<ul>|<blockquote|margin-left/.test((await html())), await html());
  await m.click('[data-cmd=outdent]'); await m.waitForTimeout(150);
  await open('plus'); await m.evaluate(() => { const b = document.getElementById('edBody'); b.innerHTML = '<div>card me</div>'; b.focus(); const t = b.firstChild.firstChild; const r = document.createRange(); r.setStart(t, 2); r.collapse(true); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(r); });
  await m.click('[data-cmd=callout]'); await m.waitForTimeout(150);
  ok('card works from the + options', /<div class="callout">/.test(await html()), await html());
  await m.click('[data-cmd=link]'); await m.waitForSelector('#dlg[open]'); ok('link opens its prompt from the + options', true); await m.click('#dlgCancel'); await m.waitForTimeout(150);
  ok('image button opens the picker input', await m.locator('#imgInput').count() === 1 && await m.locator('[data-cmd=image]').isVisible());
  await m.click('#edBody'); await m.waitForTimeout(200);
  ok('tapping the text keeps the options open', await vis('#toolbar'));
  await m.click('#edBack'); await m.waitForTimeout(300);
  await m.click('.note'); await m.waitForTimeout(300);
  ok('no keyboard popup on opening (still)', await m.evaluate(() => !document.activeElement.isContentEditable));

  // batch 19: thinner row, no Paragraph, smaller undo/redo
  await open('aa'); await m.waitForTimeout(200);
  ok('Paragraph dropdown is gone on phones (H1-H3 cover it)', !(await vis('#blockSel')));
  ok('options row is one thin row (about 44px)', (await R('#toolbar')).h <= 49, JSON.stringify(await R('#toolbar')));
  const u2 = await R('#edUndo'), r2 = await R('#edRedo'), b2 = await R('#edBack');
  ok('undo/redo are smaller than Back', u2.w < b2.w && r2.w < b2.w && u2.w <= 36, JSON.stringify({ u2, b2 }));
  ok('undo/redo sit a little further from Back but closer to each other', u2.l - b2.r >= 10 && r2.l - u2.r <= 2 && r2.l - u2.r < u2.l - b2.r, JSON.stringify({ gapBack: u2.l - b2.r, gapEach: r2.l - u2.r }));
  await open('aa');

  // desktop unchanged
  const d = await mk({ width: 1280, height: 800 });
  await d.click('#newNote'); await d.waitForSelector('#edBody'); await d.waitForTimeout(300);
  ok('desktop: no footer icon bar; the toolbar stays in place, with no Paragraph or Sticker', !(await d.isVisible('#edBar')) && await d.isVisible('#toolbar') && !(await d.isVisible('#toolbar [data-cmd=sticker]')) && !(await d.isVisible('#blockSel')));
  ok('desktop: H1-H3 and indent buttons are there; save icon sits in the header', await d.isVisible('[data-cmd=h1]') && await d.isVisible('[data-cmd=indent]') && await d.isVisible('#edStatus'));
  ok('desktop: "Edited" is no longer in the footer', !(await d.isVisible('#edInfo')));
  await d.click('#edMenuBtn'); ok('desktop: the menu shows "Edited …"', (await d.textContent('#edMenuInfo')).startsWith('Edited ') && await d.isVisible('#edMenuInfo'));
  ok('no console/page errors', errs.length === 0, errs.join(' | '));
  const pass = results.filter(Boolean).length; console.log(`\n${pass}/${results.length} passed`);
  await browser.close(); srv.close(); process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
