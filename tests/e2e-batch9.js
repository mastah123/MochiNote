// Batch 9 (v6): editor never scrolls sideways, checklist layout is stable, images have a fixed box (phone vs desktop).
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => { const f = path.join(root, q.url === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, d) => e ? (r.writeHead(404), r.end()) : (r.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/plain' }), r.end(d))); });
const results = []; const ok = (n, c, x) => { results.push(!!c); console.log((c ? 'PASS ' : 'FAIL ') + n + (!c && x ? ' -> ' + x : '')); };
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR4nGP4z8Dwn+E/AwAJCQIB0iVYGAAAAABJRU5ErkJggg==';
(async () => {
  await new Promise(r => srv.listen(0, r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME });
  const url = 'http://localhost:' + srv.address().port + '/'; const errs = [];
  for (const [label, vp, imgH] of [['phone', { width: 360, height: 740 }, 200], ['desktop', { width: 1280, height: 800 }, 300]]) {
    const page = await (await browser.newContext({ viewport: vp })).newPage();
    page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
    await page.goto(url); await page.waitForSelector('#newNote');
    await page.click('#newNote'); await page.waitForSelector('#edBody');
    const long = 'Averyveryverylongunbrokenwordthatwouldnormallystretchthewholepageandmakeitscrollsidewaysforever'.repeat(2);
    const big = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 800; c.height = 400; const x = c.getContext('2d'); x.fillStyle = '#88aabb'; x.fillRect(0, 0, 800, 400); return c.toDataURL('image/png'); });
    await page.evaluate(([png, long]) => {
      const b = document.getElementById('edBody');
      b.innerHTML = '<div>' + long + '</div><div><a href="https://example.com/' + long + '">' + long + '</a></div>' +
        '<ul class="checklist"><li>Plain item</li><li class="done">Done item</li><li>Mix <b>bold</b> and <i>italic</i> <span>span</span> text that is long enough to wrap onto a second line of the card</li><li><br></li></ul>' +
        '<img src="' + png + '"><img src="' + png + '" style="width:3000px;height:3000px">';
      b.dispatchEvent(new Event('input', { bubbles: true }));
    }, [big, long]);
    await page.waitForTimeout(200);
    const g = await page.evaluate(() => {
      const q = s => document.querySelector(s), b = q('#edBody'), sc = q('.ed-scroll'), ed = q('.editor');
      const R = e => e.getBoundingClientRect();
      const lis = [...b.querySelectorAll('ul.checklist li')].map(li => { const r = R(li), c = getComputedStyle(li, '::before'); return { h: Math.round(r.height), w: Math.round(r.width) }; });
      const mix = b.querySelectorAll('ul.checklist li')[2];
      return {
        docW: document.documentElement.scrollWidth, innerW: innerWidth,
        scW: sc.scrollWidth, scC: sc.clientWidth, bW: b.scrollWidth, bC: b.clientWidth, edW: ed.scrollWidth, edC: ed.clientWidth,
        imgs: [...b.querySelectorAll('img')].map(i => ({ w: Math.round(R(i).width), h: Math.round(R(i).height), bodyW: Math.round(R(b).width) })),
        lis, mixKids: [...mix.childNodes].map(n => n.nodeType === 1 ? Math.round(R(n).left) : null),
        textLeft: Math.round(R(b.querySelector('ul.checklist li')).left), cs: getComputedStyle(b.querySelector('ul.checklist li')).display,
        top: Math.round(R(q('.ed-top')).top), topH: Math.round(R(q('.ed-top')).height)
      };
    });
    ok(label + ': page has no sideways overflow', g.docW <= g.innerW + 1, JSON.stringify(g));
    ok(label + ': note area does not scroll sideways', g.scW <= g.scC + 1 && g.bW <= g.bC + 1 && g.edW <= g.edC + 1, JSON.stringify(g));
    ok(label + ': images are scaled into the fixed box (never taller than ' + imgH + 'px) keeping their 2:1 shape', g.imgs.every(i => i.h - 12 <= imgH + 1 && Math.abs((i.w - 12) / (i.h - 12) - 2) < 0.05), JSON.stringify(g.imgs));
    ok(label + ': images are centred', await page.evaluate(() => [...document.querySelectorAll('#edBody img')].every(i => { const r = i.getBoundingClientRect(), b = document.getElementById('edBody').getBoundingClientRect(), cs = getComputedStyle(document.getElementById('edBody')); const l = r.left - b.left - parseFloat(cs.paddingLeft), rt = b.right - parseFloat(cs.paddingRight) - r.right; return Math.abs(l - rt) <= 2; })));
    ok(label + ': images never wider than the note area', g.imgs.every(i => i.w <= i.bodyW), JSON.stringify(g.imgs));
    ok(label + ': both images identical in size despite huge inline size', g.imgs[0].w === g.imgs[1].w && g.imgs[0].h === g.imgs[1].h);
    ok(label + ': checklist items are block rows (not flex)', g.cs === 'block');
    // mixed formatting stays inline: all inline children sit on a common left/line, not separate columns
    const sameRow = await page.evaluate(() => { const li = document.querySelectorAll('#edBody ul.checklist li')[2]; const rs = [...li.querySelectorAll('b,i,span')].map(e => e.getBoundingClientRect()); const first = li.getBoundingClientRect(); return rs.every(r => r.top >= first.top && r.top < first.top + 40) && rs[0].left > first.left + 30 && rs[1].left > rs[0].left; });
    ok(label + ': bold/italic/span inside a checklist item flow inline with the text', sameRow);
    ok(label + ': the empty checklist item keeps its height', g.lis[3].h >= 24, JSON.stringify(g.lis));
    ok(label + ': header stays at the top', g.top <= (label === 'desktop' ? 120 : 0) && g.topH >= 40);
    // tick toggles; typing + Enter in a checklist keeps working
    await page.evaluate(() => { const li = document.querySelectorAll('#edBody ul.checklist li')[0]; const r = li.getBoundingClientRect(); window.__clk = [r.left + 12, r.top + 12]; });
    const [cx, cy] = await page.evaluate(() => window.__clk);
    await page.mouse.click(cx, cy); await page.waitForTimeout(100);
    ok(label + ': tapping the circle ticks the item', await page.evaluate(() => document.querySelectorAll('#edBody ul.checklist li')[0].classList.contains('done')));
    await page.mouse.click(cx, cy); await page.waitForTimeout(100);
    ok(label + ': tapping again unticks it', !(await page.evaluate(() => document.querySelectorAll('#edBody ul.checklist li')[0].classList.contains('done'))));
    // add a real image through the file input
    await page.evaluate(() => { const b = document.getElementById('edBody'); b.innerHTML = '<div>hi</div>'; });
    await page.focus('#edBody'); await page.keyboard.press('End');
    const buf = Buffer.from(big.split(',')[1], 'base64');
    await page.setInputFiles('#imgInput', { name: 'a.png', mimeType: 'image/png', buffer: buf }); await page.waitForTimeout(600);
    const ih = await page.$eval('#edBody img', i => Math.round(i.getBoundingClientRect().height)).catch(() => -1);
    ok(label + ': an image added from the toolbar is scaled into the fixed box', ih > 12 && ih - 12 <= imgH + 1, String(ih));
    const sw = await page.evaluate(() => document.querySelector('.ed-scroll').scrollWidth <= document.querySelector('.ed-scroll').clientWidth + 1);
    ok(label + ': still no sideways scroll after adding an image', sw);
    await page.screenshot({ path: (process.env.SHOTS || '/tmp') + '/b9-' + label + '.png' });
  }
  ok('no console/page errors', errs.length === 0, errs.join(' | '));
  const pass = results.filter(Boolean).length; console.log(`\n${pass}/${results.length} passed`);
  await browser.close(); srv.close(); process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
