// Batch 4: bottom format bar (icons + close), keyboard hiding, 💡 callout, copy/cut keeping list numbering. Desktop unchanged.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => { const f = path.join(root, q.url === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, d) => e ? (r.writeHead(404), r.end()) : (r.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/plain' }), r.end(d))); });
const results = []; const ok = (n, c, x) => { results.push(!!c); console.log((c ? 'PASS ' : 'FAIL ') + n + (!c && x ? ' -> ' + x : '')); };

const LISTS = '<div>Intro</div><ul><li>apple</li><li>pear</li></ul><ol><li>first</li><li>second</li><li>third</li></ol><ul class="checklist"><li class="done">done thing</li><li>todo thing</li></ul>';

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
  const body = page => page.$eval('#edBody', e => e.innerHTML);
  const newNote = async (page, title) => { await page.click('#newNote'); await page.waitForTimeout(150); await page.fill('#edTitle', title || 'T'); await page.click('#edBody'); };
  const active = page => page.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.tagName));
  const copyText = (page, mode) => page.evaluate(m => {
    const dt = new DataTransfer(); const ev = new ClipboardEvent(m || 'copy', { clipboardData: dt, bubbles: true, cancelable: true });
    document.getElementById('edBody').dispatchEvent(ev); return { text: dt.getData('text/plain'), html: dt.getData('text/html'), prevented: ev.defaultPrevented };
  }, mode);
  const selectAll = page => page.evaluate(() => { const b = document.getElementById('edBody'); b.focus(); const r = document.createRange(); r.selectNodeContents(b); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });

  /* ---------------- mobile ---------------- */
  const m = await open({ width: 390, height: 780 });
  await newNote(m, 'Fmt test'); await m.keyboard.type('hello world');
  await m.click('#edFmt'); await m.waitForTimeout(250);

  // bottom bar
  const geo = await m.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(); return { tb: r('#toolbar'), sc: r('#edScroll'), ft: r('.ed-bar'), top: r('.ed-top'), vh: innerHeight }; });
  ok('format bar is below the text area', geo.tb.top >= geo.sc.bottom - 1, JSON.stringify([geo.tb.top, geo.sc.bottom]));
  ok('options row sits just above the footer icons, footer flush with the bottom', Math.abs(geo.tb.bottom - geo.ft.top) <= 1 && Math.abs(geo.ft.bottom - geo.vh) <= 1, JSON.stringify([geo.tb.bottom, geo.ft.top, geo.ft.bottom, geo.vh]));
  ok('header still thin and on top', geo.top.height <= 48 && geo.top.top === 0);
  ok('footer has + / Aa / align / style / list icons, Aa is shown pressed', await m.locator('#edBar .bar-btn').count() === 5 && (await m.getAttribute('#edFmt', 'aria-pressed')) === 'true');
  await m.click('#edBar [data-open=list]'); await m.waitForTimeout(150);
  ok('buttons use icons, not text, on mobile', await m.locator('[data-cmd=insertOrderedList] .t-ico').isVisible() && !(await m.locator('[data-cmd=insertOrderedList] .t-txt').isVisible()));
  const small = await m.$$eval('#toolbar button', els => els.filter(e => e.offsetParent && (e.getBoundingClientRect().width < 39 || e.getBoundingClientRect().height < 39)).map(e => e.dataset.cmd || e.id));
  ok('every format button is at least 40px (touch friendly)', small.length === 0, small.join(','));
  const offscreen = await m.$$eval('#toolbar button, #toolbar select', els => els.filter(e => e.offsetParent && (e.getBoundingClientRect().right > innerWidth + 1 || e.getBoundingClientRect().left < -1)).map(e => e.dataset.cmd || e.id));
  ok('no format control is pushed off screen', offscreen.length === 0, offscreen.join(','));
  await m.click('#edBar [data-open=plus]'); await m.waitForTimeout(150);
  ok('callout button is available', await m.locator('[data-cmd=callout]').isVisible());
  await m.click('#edBar [data-open=aa]'); await m.waitForTimeout(150);

  // keyboard
  ok('opening Format keeps the keyboard (inputmode text, note still focused)', (await m.$eval('#edBody', e => e.inputMode)) === 'text' && (await active(m)) === 'edBody', await active(m));
  await m.evaluate(() => { const t = document.getElementById('edBody').firstChild; const r = document.createRange(); r.setStart(t, 0); r.setEnd(t, 5); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
  await m.click('[data-cmd=bold]'); await m.waitForTimeout(100);
  ok('formatting applies to the selection', /<b>hello<\/b>/.test(await body(m)), await body(m));
  ok('keyboard stays open after using a format button', (await m.$eval('#edBody', e => e.inputMode)) === 'text' && (await active(m)) === 'edBody', await active(m));
  await m.click('#edBar .bar-btn[aria-pressed=true]'); await m.waitForTimeout(200);
  ok('tapping the icon again closes the options', !(await m.locator('#toolbar').isVisible()));
  ok('closing the options leaves the keyboard open', (await m.$eval('#edBody', e => e.inputMode)) === 'text' && (await active(m)) === 'edBody', await active(m));
  await m.click('#edFmt'); await m.waitForTimeout(150); await m.click('#edBody'); await m.waitForTimeout(150);
  ok('tapping the text keeps the options open (typing continues)', (await m.locator('#toolbar').isVisible()) && (await m.$eval('#edBody', e => e.inputMode)) === 'text');
  await m.click('#edFmt'); await m.waitForTimeout(150);
  await m.click('#edFmt'); await m.fill('#edTitle', 'x', { force: true }).catch(() => {}); await m.click('#edBar .bar-btn[aria-pressed=true]'); await m.click('#edBack'); await m.waitForTimeout(300);
  await m.click('#newNote'); await m.waitForTimeout(200);
  ok('a new note starts with the keyboard allowed', (await m.$eval('#edBody', e => e.inputMode)) === 'text' && (await m.$eval('#edTitle', e => e.inputMode)) === 'text');
  await m.click('#edBack'); await m.waitForTimeout(250);

  // callout
  await newNote(m, 'Callout test'); await m.keyboard.type('Random thought');
  await m.click('#edBar [data-open=plus]'); await m.click('[data-cmd=callout]'); await m.waitForTimeout(150);
  ok('callout wraps the current line', /<div class="callout"><div>Random thought<\/div><\/div>/.test(await body(m)), await body(m));
  ok('callout button shows as active inside a callout', (await m.getAttribute('[data-cmd=callout]', 'aria-pressed')) === 'true');
  await m.keyboard.press('Enter'); await m.keyboard.type('This is the body of the card');
  const ce = await m.$$eval('#edBody .callout > div', e => e.map(x => x.textContent));
  ok('callout is editable: Enter adds lines inside it', ce.length === 2 && ce[1] === 'This is the body of the card', JSON.stringify(ce));
  ok('callout title (first line) is emphasised, body is not', await m.evaluate(() => { const c = document.querySelectorAll('#edBody .callout > div'); return getComputedStyle(c[0]).fontWeight >= 600 && getComputedStyle(c[1]).fontWeight < 600; }));
  ok('callout is a rounded card with a faint "+" sticker slot, no lightbulb', await m.evaluate(() => { const c = document.querySelector('#edBody .callout'); const ct = getComputedStyle(c, '::before').content; return ct.includes('+') && !ct.includes('💡') && parseFloat(getComputedStyle(c).borderTopLeftRadius) >= 12; }));
  await m.keyboard.press('Enter'); await m.keyboard.press('Enter'); await m.keyboard.type('outside the card');
  const after = await m.evaluate(() => { const b = document.getElementById('edBody'); const c = b.querySelector('.callout'); return { inside: c.textContent, next: c.nextElementSibling && c.nextElementSibling.textContent, kids: c.children.length }; });
  ok('Enter on an empty last line leaves the callout', after.next === 'outside the card' && after.kids === 2 && !after.inside.includes('outside'), JSON.stringify(after));
  await m.waitForTimeout(700);
  // card preview + persistence
  await m.click('#edBack'); await m.waitForTimeout(350);
  ok('note card preview shows the callout line without any lightbulb', await m.evaluate(() => document.querySelectorAll('.n-rich .pl-callout').length === 1 && !document.querySelector('.n-rich .pl-callout .pl-m').textContent && /Random thought/.test(document.querySelector('.n-rich .pl-callout').textContent)));
  await m.reload(); await m.waitForSelector('.note'); await m.click('.note'); await m.waitForTimeout(250);
  ok('callout survives save + reload (sanitizer keeps it)', (await m.$$eval('#edBody .callout', e => e.length)) === 1);
  // unwrap
  await m.click('#edBody .callout > div:first-child'); await m.click('#edBar [data-open=plus]'); await m.click('[data-cmd=callout]'); await m.waitForTimeout(150);
  ok('toggling again unwraps the callout back into normal lines', (await m.$$eval('#edBody .callout', e => e.length)) === 0 && /Random thought/.test(await body(m)) && /This is the body/.test(await body(m)), await body(m));
  // wrapping several lines + a bare first line
  await m.evaluate(() => { document.getElementById('edBody').innerHTML = 'bare first<div>second</div><div>third</div>'; });
  await m.evaluate(() => { const b = document.getElementById('edBody'); b.focus(); const r = document.createRange(); r.setStart(b.firstChild, 2); r.setEnd(b.lastChild.firstChild, 2); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
  await ensureOpen(m, 'plus'); await m.click('[data-cmd=callout]'); await m.waitForTimeout(150);
  ok('a multi-line selection (even a bare first line) is wrapped as one callout', await m.evaluate(() => { const c = document.querySelectorAll('#edBody .callout'); return c.length === 1 && Array.from(c[0].children).map(x => x.textContent).join('|') === 'bare first|second|third'; }), await body(m));
  // sanitizer
  const san = await m.evaluate(() => [NotesEditor.sanitize('<div class="callout evil" onclick="x()"><div>a</div></div>'), NotesEditor.sanitize('<span class="callout">b</span>'), NotesEditor.sanitize('<p class="callout">c</p>')]);
  ok('sanitizer keeps class=callout on div only, drops other classes/handlers', san[0] === '<div class="callout"><div>a</div></div>' && san[1] === '<span>b</span>' && san[2] === '<p>c</p>', JSON.stringify(san));

  // copy keeps numbering
  await m.evaluate(h => { document.getElementById('edBody').innerHTML = h; }, LISTS);
  await selectAll(m);
  const c1 = await copyText(m);
  ok('copy of everything keeps bullets, numbering and checkboxes', c1.text === 'Intro\n• apple\n• pear\n1. first\n2. second\n3. third\n☑ done thing\n☐ todo thing', JSON.stringify(c1.text));
  ok('copy also carries rich HTML (lists intact)', /<ol>/.test(c1.html) && /<ul/.test(c1.html));
  ok('copy default is replaced (no double handling)', c1.prevented);
  await m.evaluate(() => { const b = document.getElementById('edBody'); const li = b.querySelectorAll('ol li')[1]; const r = document.createRange(); r.setStart(li.firstChild, 0); r.setEnd(b.querySelectorAll('ol li')[2].firstChild, 5); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
  const c2 = await copyText(m);
  ok('partial selection keeps the real item numbers (2., 3.)', c2.text === '2. second\n3. third', JSON.stringify(c2.text));
  await m.evaluate(() => { document.getElementById('edBody').innerHTML = '<ol><li>one<ol><li>inner</li></ol></li><li>two</li></ol><div class="callout"><div>Title</div><div>Body</div></div>'; });
  await selectAll(m);
  const c3 = await copyText(m);
  ok('nested lists indent; a card with no sticker copies as plain lines', c3.text === '1. one\n  1. inner\n2. two\nTitle\nBody', JSON.stringify(c3.text));
  await m.evaluate(h => { document.getElementById('edBody').innerHTML = h; }, '<div>keep</div><ol><li>gone</li></ol>');
  await m.evaluate(() => { const b = document.getElementById('edBody'); b.focus(); const r = document.createRange(); r.selectNodeContents(b.querySelector('ol')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
  const cut = await copyText(m, 'cut');
  ok('cut puts numbered text on the clipboard and removes the selection', cut.text === '1. gone' && !/gone/.test(await body(m)), JSON.stringify([cut.text, await body(m)]));
  await m.click('#edBack').catch(() => {}); await m.waitForTimeout(300);

  /* ---------------- desktop unchanged ---------------- */
  const d = await open({ width: 1280, height: 800 });
  await newNote(d, 'Desktop'); await d.keyboard.type('hello');
  const dg = await d.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(); return { tb: r('#toolbar'), sc: r('#edScroll') }; });
  ok('desktop: format bar still above the text', dg.tb.bottom <= dg.sc.top + 1, JSON.stringify(dg));
  ok('desktop: toolbar visible by default, with the same icon buttons as the phone', await d.locator('[data-cmd=bold]').isVisible() && await d.locator('[data-cmd=insertOrderedList] .t-ico').isVisible() && !(await d.locator('[data-cmd=insertOrderedList] .t-txt').isVisible()));
  ok('desktop: no close button, but the Card button is now there too', !(await d.locator('#tbClose').isVisible()) && await d.locator('[data-cmd=callout]').isVisible());
  ok('desktop: keyboard mode untouched', (await d.$eval('#edBody', e => e.inputMode)) !== 'none');
  await d.evaluate(h => { document.getElementById('edBody').innerHTML = h; }, LISTS); await selectAll(d);
  const dc = await copyText(d);
  ok('desktop: copy is left to the browser (original behaviour)', dc.prevented === false && dc.text === '', JSON.stringify(dc));
  await d.evaluate(() => { document.getElementById('edBody').innerHTML = '<div class="callout"><div>Made on mobile</div><div>body</div></div>'; });
  ok('desktop: callouts made on mobile still render as cards', await d.evaluate(() => { const c = document.querySelector('#edBody .callout'); return getComputedStyle(c, '::before').content.includes('+') && parseFloat(getComputedStyle(c).borderTopLeftRadius) >= 12; }));

  ok('no console/page errors', errs.length === 0, errs.join(' | '));
  const pass = results.filter(Boolean).length; console.log(`\n${pass}/${results.length} passed`);
  await browser.close(); srv.close(); process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });

async function ensureOpen(page, g = 'aa') { if (!(await page.locator('#toolbar').isVisible()) || (await page.getAttribute('#toolbar', 'data-open')) !== g) await page.click('#edBar [data-open=' + g + ']'); }
