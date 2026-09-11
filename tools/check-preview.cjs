const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..','.preview');
const BASE='http://127.0.0.1:8765/';
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge',args:['--disable-gpu']});
 const failures=[],shots=[];let pagesChecked=0;
 try{
  const context=await browser.newContext();const page=await context.newPage();
  page.on('pageerror',e=>failures.push({type:'script',message:e.message}));
  const index=JSON.parse(fs.readFileSync(path.join(ROOT,'search-index.json'),'utf8'));
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:900});
   for(const entry of index){
    const response=await page.goto(BASE+entry.path,{waitUntil:'load'});
    const result=await page.evaluate(()=>({h1:document.querySelectorAll('h1').length,width:innerWidth,scroll:document.documentElement.scrollWidth,broken:[...document.images].filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.getAttribute('src'))}));
    if(response.status()!==200||result.h1!==1||result.scroll>width+1||result.broken.length)failures.push({page:entry.path,width,...result});
    pagesChecked++;
   }
   for(const target of ['README.html','atlas/visual-index.html','residents/people/farmer-glenn.html','jobs/README.html']){
    await page.goto(BASE+target,{waitUntil:'load'});
    await page.evaluate(()=>Promise.all([...document.images].map(async i=>{i.loading='eager';try{await i.decode()}catch{}})));
    const dest=path.join(ROOT,'qa-'+width+'-'+target.replaceAll('/','-')+'.png');
    try{await page.screenshot({path:dest,fullPage:false});shots.push(dest)}catch(e){failures.push({type:'screenshot',target,width,message:e.message})}
   }
  }
  await page.goto(BASE+'README.html');
  await page.locator('#search').fill('글렌');await page.locator('#search-results a').first().waitFor();
  if(!(await page.locator('#search-results a').first().textContent()).includes('글렌'))failures.push({type:'search',query:'글렌'});
  await page.locator('#search').fill('변속기');await page.waitForFunction(()=>document.querySelector('#search-results')?.textContent.includes('변속기'));
  await page.locator('#menu-toggle').click();if(await page.locator('#menu-toggle').getAttribute('aria-expanded')!=='true')failures.push({type:'mobile-menu'});
  await page.keyboard.press('Escape');await page.locator('#theme-toggle').click();
  if(await page.locator('html').getAttribute('data-theme')!=='dark')failures.push({type:'theme'});
  const links=[];
  for(const entry of index){const html=fs.readFileSync(path.join(ROOT,entry.path),'utf8');for(const m of html.matchAll(/(?:href|src)="([^"#]+)"/g)){const ref=m[1].split('#')[0];if(/^(?:https?:|data:)/.test(ref))continue;const resolved=path.resolve(path.dirname(path.join(ROOT,entry.path)),ref);if(!fs.existsSync(resolved))links.push({page:entry.path,ref});}}
  failures.push(...links.map(l=>({type:'missing-local-file',...l})));
  const report={pagesChecked,viewports:[1440,390],searchChecks:['글렌','변속기'],shots,failures};
  fs.writeFileSync(path.join(ROOT,'qa-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  if(failures.length)process.exitCode=1;
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
