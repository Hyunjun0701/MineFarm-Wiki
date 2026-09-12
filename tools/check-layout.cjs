// Static checks only: no browser, game server, or public-site mutation.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'.preview');
const index=JSON.parse(fs.readFileSync(path.join(OUT,'search-index.json'),'utf8'));
const counts={pages:index.length,hints:0,cards:0,tabs:0,steps:0,expandables:0};
const failures=[];
for(const entry of index){
 const file=path.join(OUT,entry.path),html=fs.readFileSync(file,'utf8');
 const article=html.match(/<article>([\s\S]*?)<\/article>/)?.[1]||'';
 if((article.match(/<h1>/g)||[]).length!==1)failures.push(entry.path+': main heading');
 if(/{%|gb-preview-block|\*\*[^<]+\*\*/.test(article))failures.push(entry.path+': unrendered source');
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 if(new Set(ids).size!==ids.length)failures.push(entry.path+': duplicate ids');
 for(const m of html.matchAll(/(?:href|src)="([^"]+)"/g)){
  if(/^(?:https?:|data:|mailto:)/.test(m[1]))continue;
  const [ref,fragment]=m[1].split('#');const target=ref?path.resolve(path.dirname(file),ref):file;
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
assert.equal((homeHtml.match(/class="card-cover"/g)||[]).length,6,'Home guide covers');
console.log(JSON.stringify({counts,failures}));
if(failures.length)process.exitCode=1;
