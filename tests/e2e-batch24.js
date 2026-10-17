const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const M={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const root=path.join(__dirname,'..');
const srv=http.createServer((q,s)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';fs.readFile(path.join(root,p),(e,d)=>{if(e){s.writeHead(404);return s.end()}s.writeHead(200,{'content-type':M[path.extname(p)]||'text/plain'});s.end(d)})});
(async()=>{await new Promise(r=>srv.listen(0,r));const url='http://localhost:'+srv.address().port+'/';
const b=await chromium.launch({executablePath:process.env.CHROME});let ok=0,bad=0;const t=(n,c,x)=>{c?ok++:(bad++,console.log('FAIL',n,x||''))};
const shots=process.env.SHOTS||'/tmp';
for(const [label,vp] of [['phone',{width:390,height:780}],['desktop',{width:1280,height:800}]]){
 const L=label+': ';const pg=await b.newPage({viewport:vp});await pg.goto(url);await pg.waitForTimeout(600);
 const mobile=vp.width<900;
 await pg.click('#newNote');await pg.waitForTimeout(300);
 await pg.fill('#edTitle','Info test');await pg.click('#edBody');await pg.keyboard.type('one two three four');
 await pg.waitForTimeout(900);
 /* info line */
 const info=await pg.textContent('#edNoteInfo');
 t(L+'info line shows words, created and saved',/4 words/.test(info)&&/Created /.test(info)&&/Saved /.test(info),info);
 t(L+'info line is faint and small',await pg.$eval('#edNoteInfo',e=>parseFloat(getComputedStyle(e).fontSize)<=13&&parseFloat(getComputedStyle(e).opacity)<1));
 const ty=await pg.evaluate(()=>{const a=document.getElementById('edTitle').getBoundingClientRect(),b=document.getElementById('edNoteInfo').getBoundingClientRect(),c=document.getElementById('edBody').getBoundingClientRect();return a.bottom<=b.top+1&&b.bottom<=c.top+1});
 t(L+'info line sits between title and note',ty);
 /* save button hidden with autosave on */
 t(L+'save icon hidden while autosave is on',!(await pg.isVisible('#edStatus')));
 /* px sizes */
 const labels=await pg.$$eval('#sizeSel option',o=>o.map(x=>x.textContent).filter(x=>x!=='Size'));
 t(L+'sizes are px',labels.length>=6&&labels.every(x=>/^\d+ px$/.test(x)),labels.join());
 if(mobile) await pg.click('#edBar [data-open=style]');
 await pg.keyboard.press('Control+a');await pg.click('#ddSize .dd-btn');
 const items=await pg.$$eval('#ddMenu button',a=>a.map(x=>x.textContent.trim()));t(L+'size menu lists px values',items.includes('24 px'));
 await pg.click('#ddMenu button >> text=24 px');await pg.waitForTimeout(100);
 t(L+'size applied in px',/font-size: 24px/.test(await pg.evaluate(()=>NotesEditor.getHTML())));
 /* link goes where the caret was, even if the browser moved the caret during the dialog */
 await pg.evaluate(()=>{const b=document.getElementById('edBody');b.innerHTML='<div>alpha beta</div><div>gamma delta</div>';const tn=b.children[1].firstChild;const r=document.createRange();r.setStart(tn,6);r.collapse(true);b.focus();const s=getSelection();s.removeAllRanges();s.addRange(r);});
 if(mobile) await pg.click('#edBar [data-open=plus]');
 await pg.click('[data-cmd=link]');await pg.waitForTimeout(250);
 await pg.fill('#dlgInput','example.com');
 await pg.evaluate(()=>{const b=document.getElementById('edBody');const r=document.createRange();r.setStart(b,0);r.collapse(true);const s=getSelection();s.removeAllRanges();s.addRange(r);});
 await pg.click('#dlgOk');await pg.waitForTimeout(300);
 const lh=await pg.evaluate(()=>document.getElementById('edBody').innerHTML);
 t(L+'link inserted at the typing position (second line, after "gamma ")',/<div>gamma&nbsp;<a[^>]*>example\.com<\/a>|<div>gamma <a[^>]*>example\.com<\/a>/.test(lh)&&!/^<a/.test(lh),lh);
 /* image fits the area */
 const fit=await pg.evaluate(async()=>{const mk=(w,h,c)=>{const cv=document.createElement('canvas');cv.width=w;cv.height=h;const x=cv.getContext('2d');x.fillStyle=c;x.fillRect(0,0,w,h);return cv.toDataURL('image/png')};
  const b=document.getElementById('edBody');b.innerHTML='<img src="'+mk(2400,600,'#c33')+'"><img src="'+mk(600,2400,'#33c')+'"><img src="'+mk(80,60,'#3c3')+'">';await new Promise(r=>setTimeout(r,300));
  const body=b.getBoundingClientRect();return [...b.querySelectorAll('img')].map(i=>{const r=i.getBoundingClientRect();return {w:r.width,h:r.height,inside:r.left>=body.left-1&&r.right<=body.right+1,nw:i.naturalWidth,nh:i.naturalHeight}})});
 t(L+'wide image fills the width and stays inside the area',fit[0].inside&&fit[0].w>(mobile?250:300),JSON.stringify(fit[0]));
 t(L+'tall image is capped in height, undistorted',fit[1].inside&&fit[1].h<=vp.height*0.65+14&&Math.abs((fit[1].w-12)/(fit[1].h-12)-0.25)<0.03,JSON.stringify(fit[1]));
 t(L+'small image keeps its natural size',fit[2].inside&&fit[2].w<=80+13,JSON.stringify(fit[2]));
 await pg.screenshot({path:shots+'/b24-'+label+'.png'});
 /* autosave off: save icon appears, dot when unsaved, press saves */
 await pg.evaluate(()=>{window.__mochiNote.state.prefs.autosave=false;});
 await pg.click('#edBack');await pg.waitForTimeout(400);
 await pg.click('.note');await pg.waitForTimeout(400);
 t(L+'save icon appears when autosave is off',await pg.isVisible('#edStatus'));
 await pg.click('#edTitle');await pg.keyboard.press('End');await pg.keyboard.type(' more');await pg.waitForTimeout(300);
 t(L+'unsaved dot shows',await pg.$eval('#edStatus',e=>e.classList.contains('dirty')));
 t(L+'info line says unsaved',/Unsaved changes/.test(await pg.textContent('#edNoteInfo')));
 await pg.click('#edStatus');await pg.waitForTimeout(500);
 t(L+'pressing the icon saves',!(await pg.$eval('#edStatus',e=>e.classList.contains('dirty')))&&/Saved /.test(await pg.textContent('#edNoteInfo')));
 const stored=await pg.evaluate(()=>window.__mochiNote.state.notes[0].html);t(L+'save reached storage',/more/.test(await pg.evaluate(()=>window.__mochiNote.state.notes[0].title)));
 await pg.close();}
console.log(ok+' passed, '+bad+' failed');await b.close();srv.close();process.exit(bad?1:0)})();
