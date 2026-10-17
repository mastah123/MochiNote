// v18: alignment in lists keeps the marker with its text; align / style footer buttons work
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
  const m = await (await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 })).newPage();
  m.on('pageerror', e => errs.push(e.message)); m.on('console', x => x.type() === 'error' && errs.push(x.text()));
  await m.goto(url); await m.waitForSelector('#newNote');
  const open = g => m.click('#edBar [data-open=' + g + ']');
  const html = () => m.evaluate(() => NotesEditor.getHTML());
  for (const kind of ['bullet', 'checklist']) {
    await m.click('#newNote'); await m.waitForSelector('#edBody'); await m.waitForTimeout(300);
    await m.evaluate(k => { const b = document.getElementById('edBody'); b.innerHTML = k === 'bullet' ? '<ul><li>alpha</li><li>beta</li></ul>' : '<ul class="checklist"><li>alpha</li><li>beta</li></ul>'; b.focus(); const t = b.querySelectorAll('li')[1].firstChild; const r = document.createRange(); r.setStart(t, 2); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }, kind);
    await open('align'); await m.waitForTimeout(200); await m.click('[data-cmd=justifyRight]'); await m.waitForTimeout(250);
    ok(kind + ': right-align applies to the line', /<li[^>]*style="text-align: right;?"[^>]*>beta<\/li>/.test(await html()), await html());
    const g = await m.evaluate(() => { const li = document.querySelectorAll('#edBody li')[1]; const cs = getComputedStyle(li); const range = document.createRange(); range.selectNodeContents(li); const tr = range.getBoundingClientRect(); const lr = li.getBoundingClientRect(); return { pos: cs.listStylePosition, pl: cs.paddingLeft, textRight: Math.round(tr.right), liRight: Math.round(lr.right), textLeft: Math.round(tr.left) }; });
    ok(kind + ': the marker stays next to the text (inside), not stretched across the row', kind === 'bullet' ? g.pos === 'inside' : g.pl === '0px', JSON.stringify(g));
    ok(kind + ': the text sits at the right edge', g.liRight - g.textRight <= 4, JSON.stringify(g));
    await m.screenshot({ path: shots + '/b18-' + kind + '.png', clip: { x: 0, y: 40, width: 390, height: 200 } });
    await m.click('[data-cmd=justifyLeft]'); await m.waitForTimeout(150);
    await m.click('#edBar [data-open=align]'); await m.click('#edBack'); await m.waitForTimeout(350);
  }
  ok('no console/page errors', errs.length === 0, errs.join(' | '));
  const pass = results.filter(Boolean).length; console.log(`\n${pass}/${results.length} passed`);
  await browser.close(); srv.close(); process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
