/* Build a disposable, offline design preview from the GitBook Markdown source.
 * This preview does not change GitBook hosting or promise identical rendering.
 * Dependencies: the bundled marked package (resolve with NODE_PATH).
 */
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {pathToFileURL} = require('node:url');
const {icon, pageSource} = require('./preview-icons.cjs');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '.preview');
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const htmlPath = p => p.replace(/\.md$/, '.html');
const slug = s => s.toLowerCase().replace(/<[^>]*>/g,'').replace(/[^\p{L}\p{N}\s-]/gu,'').trim().replace(/\s+/g,'-');

async function main() {
  const {marked} = await import(pathToFileURL(require.resolve('marked')).href);
  const render = require('./preview-blocks.cjs')(marked, esc);
  // Stable across unchanged builds, different when the asset bytes change.
  const assetVersion = file => createHash('sha256').update(fs.readFileSync(path.join(__dirname,file))).digest('hex').slice(0,12);
  const themeVersion = assetVersion('preview-theme.css');
  const appVersion = assetVersion('preview-app.js');
  fs.mkdirSync(OUT,{recursive:true});
  const summary = fs.readFileSync(path.join(ROOT,'SUMMARY.md'),'utf8');
  const entries = [...summary.matchAll(/^(\s*)\* \[([^\]]+)\]\(([^)]+\.md)\)/gm)].map(m=>({depth:m[1].replace(/\n/g,'').length,title:m[2],file:m[3]}));
  if(new Set(entries.map(e=>e.file)).size!==entries.length)throw Error('Duplicate navigation destination');
  const expected = new Set(['index.html', ...entries.map(e=>htmlPath(e.file))]);
  // Delete only stale generated HTML inside this preview, never source documents.
  for(const item of fs.readdirSync(OUT,{recursive:true,withFileTypes:true})){
    if(!item.isFile()||!item.name.endsWith('.html'))continue;
    const target=path.resolve(item.parentPath||item.path,item.name);
    const relative=path.relative(OUT,target).split(path.sep).join('/');
    if(relative.startsWith('../')||path.isAbsolute(relative))throw Error('Unsafe preview cleanup');
    if(!expected.has(relative))fs.unlinkSync(target);
  }
  // Read native GitBook frontmatter once. The sidebar and page heading share it.
  for(const entry of entries) entry.source = pageSource(fs.readFileSync(path.join(ROOT,entry.file),'utf8'));
  const groups=[],stack=[];
  for(const entry of entries){
    const node={entry,children:[]};
    while(stack.length&&stack.at(-1).entry.depth>=entry.depth)stack.pop();
    (stack.length?stack.at(-1).children:groups).push(node);stack.push(node);
  }
  const search=[];
  for(let i=0;i<entries.length;i++){
    const entry=entries[i];
    const md=entry.source.body;
    const prefix='../'.repeat(entry.file.split('/').length-1);
    const href=file=>prefix+htmlPath(file);
    let content=render(md);
    if(entry.source.icon) content=content.replace('<h1>', '<h1>'+icon(entry.source.icon, 'page')+' ');
    if (/{%\s*(?:end)?(?:hint|tabs?|step(?:per)?)\b/.test(content)) throw Error('Unrendered GitBook block: '+entry.file);
    content=content.replace(/href="([^"#]+)\.md(#[^"]*)?"/g,'href="$1.html$2"');
    const headings=[],usedIds=new Map();
    content=content.replace(/<h([23])>(.*?)<\/h\1>/gs,(_,level,title)=>{
      const explicit=title.match(/<a\s+href="#[^"]*"\s+id="([^"]+)"><\/a>/);
      if(explicit)title=title.replace(explicit[0],'').trim();
      const base=explicit?explicit[1]:slug(title),count=usedIds.get(base)||0;usedIds.set(base,count+1);const id=base+(count?'-'+count:'');
      headings.push({level,title:title.replace(/<[^>]+>/g,''),id});return `<h${level} id="${esc(id)}">${title}</h${level}>`;
    });
    content=content.replace(/<table>/g,'<div class="table-scroll" tabindex="0" role="region" aria-label="가로로 넘겨 볼 수 있는 정보 표"><table>').replace(/<\/table>/g,'</table></div>');
    content=content.replace(/<img /g,'<img loading="lazy" decoding="async" ');
    const containsCurrent=g=>g.entry.file===entry.file||g.children.some(containsCurrent);
    const renderNav=g=>{
      const current=containsCurrent(g);
      const label=e=>(e.source.icon?icon(e.source.icon, 'nav')+' ':'')+`<span class="nav-label">${esc(e.title)}</span>`;
      const link=e=>`<a ${e.file===entry.file?'aria-current="page" ':''}href="${esc(href(e.file))}">${label(e)}</a>`;
      return g.children.length?`<details ${current?'open':''}><summary>${label(g.entry)}</summary>${link(g.entry)}<div class="nav-children">${g.children.map(renderNav).join('')}</div></details>`:link(g.entry);
    };
    const nav=groups.map(renderNav).join('');
    const toc=headings.map(h=>`<a class="level-${h.level}" href="#${esc(h.id)}">${esc(h.title)}</a>`).join('');
    const pager=[entries[i-1],entries[i+1]].map((e,j)=>e?`<a href="${esc(href(e.file))}"><small>${j?'다음 문서 →':'← 이전 문서'}</small>${esc(e.title)}</a>`:'<span></span>').join('');
    const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(entry.title)} · MineValley 위키</title><link rel="icon" href="${prefix}assets/images/brand/wiki-emblem-v1.png"><link rel="stylesheet" href="${prefix}theme.css?v=${themeVersion}"></head><body>
<a class="skip" href="#main">본문 바로가기</a>
<header><button id="menu-toggle" aria-label="목차 열기" aria-expanded="false">☰</button><a class="brand" href="${href('README.md')}"><img src="${prefix}assets/images/brand/wiki-emblem-v1.png" width="40" height="40" alt=""><span>MineValley<small>마인밸리 플레이어 위키</small></span></a><div class="search"><label for="search">위키 검색</label><input id="search" type="search" placeholder="아이템, 직업, 주민 검색" autocomplete="off" aria-controls="search-results"><div id="search-results" hidden></div></div><button id="theme-toggle" aria-label="화면 밝기 전환">◐</button></header>
<div class="preview-note">공개 전 디자인 시안 · 빈 프레임은 사진·영상 자료를 받을 자리입니다 · 실제 GitBook 배치와 다를 수 있습니다</div>
<div class="layout"><nav id="sidebar" aria-label="문서 목차">${nav}</nav><main id="main" class="${entry.file==='README.md'?'home':''}"><div class="breadcrumb">MINEVALLEY GUIDE <span>/ ${esc(entry.title)}</span></div><article>${content}</article><div class="pager">${pager}</div><footer>게임 속 현재 안내와 함께 확인해 주세요. · <a href="${href('help/README.md')}">도움말</a></footer></main><aside aria-label="이 페이지의 목차"><strong>이 페이지에서</strong>${toc}</aside></div>
<script>window.WIKI_ROOT=${JSON.stringify(prefix)};</script><script src="${prefix}app.js?v=${appVersion}"></script></body></html>`;
    const dest=path.join(OUT,htmlPath(entry.file));fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,html);
    // Use rendered text so linked item images do not leak Markdown paths into snippets.
    const searchText=content.replace(/<!--[\s\S]*?-->/g,' ').replace(/<[^>]*>/g,' ').replace(/&(amp|lt|gt|quot|#39|nbsp);/g,(_,entity)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'",nbsp:' '}[entity])).replace(/\s+/g,' ').trim();
    search.push({title:entry.title,path:htmlPath(entry.file),text:searchText});
  }
  fs.writeFileSync(path.join(OUT,'search-index.json'),JSON.stringify(search));
  fs.writeFileSync(path.join(OUT,'index.html'),'<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=README.html"><a href="README.html">MineValley 위키 열기</a>');
  for(const entry of fs.readdirSync(path.join(ROOT,'assets'),{recursive:true,withFileTypes:true})){
    if(!entry.isFile()||!/\.(?:png|svg)$/.test(entry.name))continue;
    const src=path.join(entry.parentPath||entry.path,entry.name),dest=path.join(OUT,path.relative(ROOT,src));fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(src,dest);
  }
  fs.copyFileSync(path.join(__dirname,'preview-theme.css'),path.join(OUT,'theme.css'));
  fs.copyFileSync(path.join(__dirname,'preview-app.js'),path.join(OUT,'app.js'));
  console.log(JSON.stringify({pages:entries.length,output:OUT,searchEntries:search.length}));
}
main().catch(e=>{console.error(e);process.exit(1)});
