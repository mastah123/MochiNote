const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const M={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const root=path.join(__dirname,'..');
const srv=http.createServer((q,s)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';fs.readFile(path.join(root,p),(e,d)=>{if(e){s.writeHead(404);return s.end()}s.writeHead(200,{'content-type':M[path.extname(p)]||'text/plain'});s.end(d)})});
(async()=>{await new Promise(r=>srv.listen(0,r));const url='http://localhost:'+srv.address().port+'/';
const b=await chromium.launch({executablePath:process.env.CHROME});let ok=0,bad=0;const t=(n,c,x)=>{c?ok++:(bad++,console.log('FAIL',n,x||''))};
const seed=async pg=>{await pg.evaluate(()=>{const s=window.__mochiNote.state;s.folders.push({id:'ff',name:'Work',created:1,updated:1});for(let i=0;i<5;i++)s.notes.push({id:'n'+i,title:'Note '+i,html:'<div>'+('word '.repeat(i*30+3))+'</div>',text:'word '.repeat(i*30+3),tags:[],folderId:i?null:'ff',pinned:false,archived:false,trashed:false,created:Date.now()-i,updated:Date.now()-i});window.__mochiNote.render&&window.__mochiNote.render();});await pg.waitForTimeout(300)};
/* desktop */
const d=await b.newPage({viewport:{width:1280,height:800}});await d.goto(url);await d.waitForTimeout(600);await seed(d);
await d.click('#viewGrid').catch(()=>{});await d.waitForTimeout(200);
const sizes=await d.$$eval('#notes .note',a=>a.map(e=>{const r=e.getBoundingClientRect();return Math.round(r.width)+'x'+Math.round(r.height)}));
t('desktop grid cards share one fixed size',new Set(sizes).size===1&&sizes.length>=4,JSON.stringify(sizes));
await d.click('#notes .note >> nth=1',{button:'right'});await d.waitForTimeout(250);
t('right-click note opens options',await d.isVisible('#sheet')&&(await d.$$eval('#sheetItems button',a=>a.map(x=>x.textContent.trim()).join(','))).includes('Pin'));
const near=await d.evaluate(()=>{const r=document.querySelector('#sheet').getBoundingClientRect();return r.left;});t('menu opens at the cursor area',near>0);
await d.keyboard.press('Escape');await d.waitForTimeout(250);
t('menu closes with Escape',!(await d.isVisible('#sheet')));
await d.click('#folderStrip .folder-card',{button:'right'});await d.waitForTimeout(250);
t('right-click folder opens Rename/Delete',(await d.$$eval('#sheetItems button',a=>a.map(x=>x.textContent.trim()).join(','))).includes('Rename'));
await d.keyboard.press('Escape');await d.waitForTimeout(250);
await d.click('#newNote');await d.waitForTimeout(300);await d.click('#edBody');await d.keyboard.type('hello');await d.keyboard.press('Control+a');
for(const [id,expect] of [['ddFont',3],['ddSize',5],['ddHl',5]]){await d.click('#'+id+' .dd-btn');await d.waitForTimeout(100);
 const info=await d.evaluate(()=>{const m=document.getElementById('ddMenu');const r=m.getBoundingClientRect();return {vis:!m.hidden,n:m.children.length,top:r.top}});
 const bt=await d.$eval('#'+id+' .dd-btn',e=>e.getBoundingClientRect().bottom);
 t(id+' opens a menu below the button on desktop',info.vis&&info.n>=expect&&info.top>=bt,JSON.stringify(info));
 await d.click('#ddMenu button >> nth=1');await d.waitForTimeout(120);}
const html=await d.evaluate(()=>NotesEditor.getHTML());t('font, size and highlight applied',/font-family|face=/.test(html)&&/font size|font-size|size=/.test(html)&&/background-color/.test(html),html);
await d.screenshot({path:(process.env.SHOTS||'/tmp')+'/b23-desktop.png'});
/* phone */
const m=await b.newPage({viewport:{width:390,height:780}});await m.goto(url);await m.waitForTimeout(600);
await m.click('#newNote');await m.waitForTimeout(300);await m.click('#edBody');await m.keyboard.type('hi');
await m.click('#edBar [data-open=style]');await m.click('#ddFont .dd-btn');await m.waitForTimeout(150);
const pm=await m.evaluate(()=>{const mn=document.getElementById('ddMenu').getBoundingClientRect(),bt=document.querySelector('#ddFont .dd-btn').getBoundingClientRect();return {vis:!document.getElementById('ddMenu').hidden,above:mn.bottom<=bt.top+1}});
t('phone: dropdown pops up above the button',pm.vis&&pm.above,JSON.stringify(pm));
await m.screenshot({path:(process.env.SHOTS||'/tmp')+'/b23-phone.png'});
await m.click('#ddMenu button >> nth=1');await m.waitForTimeout(100);
t('phone: menu closes after picking',await m.evaluate(()=>document.getElementById('ddMenu').hidden));
/* about */
await m.click('#edBack');await m.waitForTimeout(400);await m.click('#openSidebar');await m.waitForTimeout(300);
console.log(ok+' passed, '+bad+' failed');await b.close();srv.close();process.exit(bad?1:0)})();
