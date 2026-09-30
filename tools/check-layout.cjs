// Static checks only: no browser, game server, or public-site mutation.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'.preview');
const index=JSON.parse(fs.readFileSync(path.join(OUT,'search-index.json'),'utf8'));
const counts={pages:index.length,hints:0,cards:0,tabs:0,steps:0,expandables:0};
const {pageSource} = require('./preview-icons.cjs');
counts.pagesWithNativeIcons=0;
counts.inlineIcons=0;
const failures=[];
const assetHashes={};
for(const [output,source] of [['theme.css','preview-theme.css'],['app.js','preview-app.js']]){
 const bytes=fs.readFileSync(path.join(OUT,output));
 assert.deepEqual(bytes,fs.readFileSync(path.join(__dirname,source)),output+': generated asset is current');
 assetHashes[output]=createHash('sha256').update(bytes).digest('hex').slice(0,12);
}
for(const entry of index){
 const file=path.join(OUT,entry.path),html=fs.readFileSync(file,'utf8');
 for(const [asset,hash] of Object.entries(assetHashes))assert.ok(html.includes(asset+'?v='+hash+'"'),entry.path+': content hash for '+asset);
 for(const svg of html.matchAll(/<svg\b([^>]*)>/g))if(svg[1].includes('wiki-icon')&&(!svg[1].includes('width="24"')||!svg[1].includes('height="24"')))failures.push(entry.path+': missing intrinsic icon size');
 const article=html.match(/<article>([\s\S]*?)<\/article>/)?.[1]||'';
 const source=fs.readFileSync(path.join(ROOT,entry.path.replace(/\.html$/,'.md')),'utf8');
 const pageIcon=pageSource(source).icon;
 if(pageIcon){
  counts.pagesWithNativeIcons++;
  if(!article.includes('wiki-icon--page" data-icon="'+pageIcon+'"'))failures.push(entry.path+': page icon metadata missing in heading');
  if(!html.includes('wiki-icon--nav" data-icon="'+pageIcon+'"'))failures.push(entry.path+': page icon metadata missing in navigation');
 }
 if(/<i class="fa-|^icon:\s/m.test(article))failures.push(entry.path+': unrendered icon source');
 counts.inlineIcons+=(article.match(/wiki-icon--inline/g)||[]).length;
 for(const svg of article.matchAll(/<svg\b([^>]*)>/g))if(!svg[1].includes('aria-hidden="true"')||!svg[1].includes('focusable="false"'))failures.push(entry.path+': decorative icon accessibility');
 if((article.match(/<h1>/g)||[]).length!==1)failures.push(entry.path+': main heading');
 if(/{%|gb-preview-block|\*\*[^<]+\*\*/.test(article))failures.push(entry.path+': unrendered source');
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 if(new Set(ids).size!==ids.length)failures.push(entry.path+': duplicate ids');
 for(const m of html.matchAll(/(?:href|src)="([^"]+)"/g)){
  if(/^(?:https?:|data:|mailto:)/.test(m[1]))continue;
  const [ref,fragment]=m[1].split('#');const refPath=ref.split('?')[0];const target=refPath?path.resolve(path.dirname(file),refPath):file;
  if(!fs.existsSync(target)){failures.push(entry.path+': missing '+m[1]);continue}
  if(fragment&&target.endsWith('.html')){const targetHtml=fs.readFileSync(target,'utf8');if(!targetHtml.includes('id="'+decodeURIComponent(fragment)+'"'))failures.push(entry.path+': missing anchor '+m[1]);}
 }
 for(const m of article.matchAll(/aria-controls="([^"]+)"/g))if(!ids.includes(m[1]))failures.push(entry.path+': missing tab panel');
 counts.hints+=(article.match(/class="hint /g)||[]).length;
 counts.cards+=(article.match(/class="info-card"/g)||[]).length;
 counts.tabs+=(article.match(/data-tabs/g)||[]).length;
 counts.steps+=(article.match(/class="guide-steps"/g)||[]).length;
 counts.expandables+=(article.match(/<details/g)||[]).length;
}
const summary=fs.readFileSync(path.join(ROOT,'SUMMARY.md'),'utf8');
assert.match(summary,/  \* \[주문소\]\(economy\/public-orders.md\)\r?\n    \* \[방랑가 전용 개인 주문\]/);
const orders=fs.readFileSync(path.join(OUT,'economy/public-orders.html'),'utf8');
assert.match(orders,/<h2 id="wanderer-private-orders">/);
assert.match(orders,/<a class="info-card" href="private-orders.html">/);
assert.ok(counts.tabs>=6&&counts.steps>=8&&counts.expandables>=12&&counts.cards>=20);
const media=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/media-slots.json'),'utf8'));
assert.equal(new Set(media.slots.map(s=>s.id)).size,media.slots.length,'Duplicate media slot id');
assert.ok(fs.existsSync(path.join(ROOT,media.placeholder)),'Missing blank media frame');
for(const page of new Set(media.slots.map(s=>s.page))){
 const html=fs.readFileSync(path.join(OUT,page.replace(/\.md$/,'.html')),'utf8');
 const reserved=[...html.matchAll(/<img\b[^>]*src="[^"]*\/media-slots\/landscape\.svg"/g)].length;
 assert.equal(reserved,media.slots.filter(s=>s.page===page).length,page+': reserved media count');
}
const homeHtml=fs.readFileSync(path.join(OUT,'README.html'),'utf8');
assert.equal((homeHtml.match(/class="card-cover"/g)||[]).length,2,'Home retains the two reserved real-capture guide covers');
assert.match(homeHtml,/assets\/images\/jobs\/jobs-banner-v1\.png/,'Approved introduction artwork');
assert.match(homeHtml,/href="https:\/\/minevalley\.imissjuly2\.workers\.dev\/"/,'Return path to the homepage');
for(const id of ['start-here','find-a-guide','next-life'])assert.ok(homeHtml.includes('id="'+id+'"'),'Preserved home anchor: '+id);
for(const href of ['getting-started/connect.html','getting-started/first-steps.html','economy/npc-shops.html#first-sale'])assert.ok(homeHtml.includes('href="'+href+'"'),'Beginner path: '+href);
assert.ok(counts.pagesWithNativeIcons>=18,'Major pages have native GitBook icon metadata');
assert.ok(counts.inlineIcons>=25,'Home and menu guidance retain inline icon context');
const menuHtml=fs.readFileSync(path.join(OUT,'guides/menu-and-navigation.html'),'utf8');
for(const id of ['open-and-move','menu-map','지금-하려는-일로-이동하기','직업-화면-읽기','보이지-않거나-열리지-않을-때'])assert.ok(menuHtml.includes('id="'+id+'"'),'Preserved menu anchor: '+id);
console.log(JSON.stringify({counts,failures}));
if(failures.length)process.exitCode=1;
