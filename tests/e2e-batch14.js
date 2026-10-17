// Batch 14 (v11): card icon (no lightbulb) + optional stickers (phone AND desktop); image frames hug the picture, centred, new line after insert.
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
  for (const [label, vp, maxH] of [['phone', { width: 390, height: 844 }, 520], ['desktop', { width: 1280, height: 800 }, 520]]) {
    const page = await (await browser.newContext({ viewport: vp, deviceScaleFactor: 2 })).newPage();
    page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
    await page.goto(url); await page.waitForSelector('#newNote');
    const L = label + ': ';
    await page.click('#newNote'); await page.waitForSelector('#edBody'); await page.waitForTimeout(300);
    const html = () => page.evaluate(() => NotesEditor.getHTML().replace(/<br>/g, ''));
    const setBody = h => page.evaluate(h => { const b = document.getElementById('edBody'); b.innerHTML = h; b.focus(); }, h);
    const caretIn = sel => page.evaluate(sel => { const e = document.querySelector('#edBody ' + sel); const t = e.firstChild && e.firstChild.nodeType === 3 ? e.firstChild : e; const r = document.createRange(); r.setStart(t, t.nodeType === 3 ? t.nodeValue.length : 0); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.getElementById('edBody').focus(); }, sel);
    const bar = async (g = 'aa') => { if (label === 'phone') { const vis = await page.locator('#toolbar').isVisible(); if (!vis || (await page.getAttribute('#toolbar', 'data-open')) !== g) await page.click('#edBar [data-open=' + g + ']'); } await page.waitForTimeout(150); };
    const pop = () => page.locator('#stickerPop').isVisible();
    const gutter = async () => { const b = await page.locator('#edBody .callout').first().boundingBox(); return [b.x + 18, b.y + 22]; };

    // ---- item 6: card icon ----
    await bar('plus');
    ok(L + 'Card button has the card icon, no lightbulb', await page.locator('[data-cmd=callout]').isVisible() && !/💡/.test(await page.textContent('#toolbar')) && await page.locator('[data-cmd=callout] svg').count() === 1);
    ok(L + 'Sticker option is removed from the format toolbar', !(await page.locator('[data-cmd=sticker]').isVisible()));
    await setBody('<div>Random thought</div><div>body</div>'); await caretIn('div:first-child'); await bar('plus');
    await page.click('[data-cmd=callout]'); await page.waitForTimeout(150);
    ok(L + 'Card wraps the lines with no sticker by default', /<div class="callout"><div>Random thought<\/div><\/div><div>body<\/div>/.test(await html()), await html());
    const cc = await page.evaluate(() => { const c = document.querySelector('#edBody .callout'); const ct = getComputedStyle(c, '::before').content; return { ct, bg: getComputedStyle(c).backgroundColor }; });
    ok(L + 'the empty card shows a faint "+" slot, not a lightbulb', cc.ct.includes('+') && !cc.ct.includes('💡'), JSON.stringify(cc));

    // ---- stickers on the card ----
    let g = await gutter(); await page.mouse.click(g[0], g[1]); await page.waitForTimeout(250);
    ok(L + 'tapping the card\'s slot opens the sticker picker', await pop() && (await page.textContent('#stickerTitle')) === 'Card sticker' && (await page.locator('#stickerGrid .sticker').count()) >= 24);
    const pr = await page.locator('#stickerPop').boundingBox(); 
    ok(L + 'picker stays on screen', pr.x >= 0 && pr.x + pr.width <= vp.width && pr.y >= 0 && pr.y + pr.height <= vp.height, JSON.stringify(pr));
    ok(L + '"No sticker" is hidden while the card has none', !(await page.locator('#stickerNone').isVisible()));
    await page.click('#stickerGrid .sticker[data-s="⭐"]'); await page.waitForTimeout(200);
    ok(L + 'choosing a sticker puts it on the card (saved as data-sticker)', /<div class="callout" data-sticker="⭐">/.test(await html()) && !(await pop()), await html());
    ok(L + 'the card now shows the sticker', await page.evaluate(() => getComputedStyle(document.querySelector('#edBody .callout'), '::before').content.includes('⭐')));
    g = await gutter(); await page.mouse.click(g[0], g[1]); await page.waitForTimeout(250);
    ok(L + 'tapping it again lets you change or remove it', await pop() && await page.locator('#stickerNone').isVisible() && await page.locator('#stickerGrid .sticker.on').count() === 1);
    await page.fill('#stickerInput', '🍕'); await page.click('#stickerUse'); await page.waitForTimeout(200);
    ok(L + 'you can type your own sticker', /data-sticker="🍕"/.test(await html()), await html());
    g = await gutter(); await page.mouse.click(g[0], g[1]); await page.waitForTimeout(250);
    await page.click('#stickerNone'); await page.waitForTimeout(200);
    ok(L + '"No sticker" removes it again', !/data-sticker/.test(await html()) && /<div class="callout">/.test(await html()), await html());
    g = await gutter(); await page.mouse.click(g[0], g[1]); await page.waitForTimeout(250);
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    ok(L + 'Escape closes the picker without closing the note', !(await pop()) && await page.locator('#editorLayer').isVisible());
    await page.mouse.click(g[0], g[1]); await page.waitForTimeout(250);
    { const ib = await page.locator('#edTitle').boundingBox(); await page.mouse.click(ib.x + ib.width / 2, ib.y + ib.height / 2); } await page.waitForTimeout(200);
    ok(L + 'tapping outside closes the picker', !(await pop()));
    await page.mouse.click(g[0], g[1]); await page.waitForTimeout(250); await page.click('#stickerGrid .sticker[data-s="🌸"]'); await page.waitForTimeout(150);
    ok(L + 'tapping the text of the card does not open the picker', await (async () => { const b = await page.locator('#edBody .callout > div').first().boundingBox(); await page.mouse.click(b.x + 30, b.y + 8); await page.waitForTimeout(200); return !(await pop()); })());

    // sanitizer
    const san = await page.evaluate(() => [NotesEditor.sanitize('<div class="callout" data-sticker="⭐"><div>a</div></div>'), NotesEditor.sanitize('<div data-sticker="⭐">b</div>'), NotesEditor.sanitize('<div class="callout" data-sticker="<b>x</b>"><div>c</div></div>'), NotesEditor.sanitize('<div class="callout" data-sticker="waytoolongtext"><div>d</div></div>')]);
    ok(L + 'sanitizer keeps a short sticker on a card only', san[0] === '<div class="callout" data-sticker="⭐"><div>a</div></div>' && san[1] === '<div>b</div>' && !/data-sticker/.test(san[2]) && !/data-sticker/.test(san[3]), JSON.stringify(san));

    // preview on the home card
    await page.fill('#edTitle', 'My note'); await page.waitForTimeout(700);
    await page.click('#edBack'); await page.waitForTimeout(500);
    const prev = await page.evaluate(() => { const l = document.querySelector('.n-rich .pl-callout'); return l ? { m: l.querySelector('.pl-m').textContent, t: l.textContent } : null; });
    if (label === 'phone') ok(L + 'the home card preview shows the card with its sticker', prev && prev.m === '🌸' && /Random thought/.test(prev.t), JSON.stringify(prev));
    else ok(L + 'desktop home card keeps its plain-text preview', await page.locator('.note .n-prev').first().isVisible());
    await page.click('.note'); await page.waitForTimeout(300);

    // ---- item 14: images ----
    const big = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 800; c.height = 400; const x = c.getContext('2d'); x.fillStyle = '#88aabb'; x.fillRect(0, 0, 800, 400); return c.toDataURL('image/png'); });
    const tall = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 300; c.height = 900; const x = c.getContext('2d'); x.fillStyle = '#bb88aa'; x.fillRect(0, 0, 300, 900); return c.toDataURL('image/png'); });
    await setBody('<div>before</div>'); await caretIn('div');
    await page.setInputFiles('#imgInput', { name: 'a.png', mimeType: 'image/png', buffer: Buffer.from(big.split(',')[1], 'base64') }); await page.waitForTimeout(700);
    const h1 = await html();
    ok(L + 'adding an image adds an empty line under it', /<img [^>]*><\/div><div><\/div>$|<img [^>]*><div><\/div>$|<div>before<\/div><div><img [^>]*><\/div><div><\/div>$/.test(h1) || /<img[^>]*>(<\/div>)?<div><\/div>$/.test(h1), h1.replace(/src="[^"]*"/, 'src=…'));
    await page.keyboard.type('below');
    const after = await page.evaluate(() => { const b = document.getElementById('edBody'); const img = b.querySelector('img'); const r = img.getBoundingClientRect(); const s = getSelection().anchorNode; const sr = (s.nodeType === 3 ? s.parentElement : s).getBoundingClientRect(); return { below: sr.top >= r.bottom - 1, text: b.textContent, only: b.querySelectorAll('img').length }; });
    ok(L + 'typing right after adding goes below the image', after.below && after.text.endsWith('below') && after.only === 1, JSON.stringify(after));
    // the frame hugs the picture
    const f1 = await page.evaluate(() => { const i = document.querySelector('#edBody img'); const cs = getComputedStyle(i), r = i.getBoundingClientRect(), b = document.getElementById('edBody').getBoundingClientRect(), bs = getComputedStyle(document.getElementById('edBody')); return { w: r.width, h: r.height, pad: parseFloat(cs.paddingLeft), disp: cs.display, left: r.left - b.left - parseFloat(bs.paddingLeft), right: b.right - parseFloat(bs.paddingRight) - r.right, nw: i.naturalWidth, nh: i.naturalHeight }; });
    ok(L + 'the frame is just the picture plus an even border (hugs it, no empty bars)', Math.abs((f1.w - 2 * f1.pad) / (f1.h - 2 * f1.pad) - f1.nw / f1.nh) < 0.03 && f1.pad >= 4, JSON.stringify(f1));
    ok(L + 'the picture is centred', Math.abs(f1.left - f1.right) <= 2 && f1.disp === 'block', JSON.stringify(f1));
    ok(L + 'a wide picture is scaled into the box (max ' + maxH + 'px tall)', f1.h - 2 * f1.pad <= maxH + 1, JSON.stringify(f1));
    await setBody('<div>x</div>'); await caretIn('div');
    await page.setInputFiles('#imgInput', { name: 'b.png', mimeType: 'image/png', buffer: Buffer.from(tall.split(',')[1], 'base64') }); await page.waitForTimeout(700);
    const f2 = await page.evaluate(() => { const i = document.querySelector('#edBody img'); const cs = getComputedStyle(i), r = i.getBoundingClientRect(); const p = parseFloat(cs.paddingLeft); return { w: r.width - 2 * p, h: r.height - 2 * p, nw: i.naturalWidth, nh: i.naturalHeight }; });
    ok(L + 'a tall picture keeps its shape (narrow frame, max ' + maxH + 'px tall)', f2.h <= maxH + 1 && Math.abs(f2.w / f2.h - f2.nw / f2.nh) < 0.03, JSON.stringify(f2));
    ok(L + 'a huge inline size in pasted HTML cannot break the box', await page.evaluate(([png, mh]) => { const b = document.getElementById('edBody'); b.innerHTML = '<img src="' + png + '" style="width:4000px;height:4000px">'; const r = b.querySelector('img').getBoundingClientRect(); return r.height <= mh + 14 && r.width <= b.getBoundingClientRect().width; }, [big, maxH]));
    await page.screenshot({ path: (process.env.SHOTS || '/tmp') + '/b14-' + label + '.png' });
  }
  ok('no console/page errors', errs.length === 0, errs.join(' | '));
  const pass = results.filter(Boolean).length; console.log(`\n${pass}/${results.length} passed`);
  await browser.close(); srv.close(); process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
