(() => {
  const showPanel=(group,index,focus=false)=>{
    const buttons=[...group.querySelector('.tab-buttons').children];
    const panels=[...group.children].filter(el=>el.matches('[role=tabpanel]'));
    buttons.forEach((b,i)=>{b.setAttribute('aria-selected',String(i===index));b.tabIndex=i===index?0:-1;panels[i].hidden=i!==index});
    if(focus)buttons[index].focus();
  };
  document.querySelectorAll('[data-tabs]').forEach(group=>{
    group.classList.add('is-enhanced');showPanel(group,0);
    const buttons=[...group.querySelector('.tab-buttons').children];
    buttons.forEach((button,index)=>{
      button.addEventListener('click',()=>showPanel(group,index));
      button.addEventListener('keydown',e=>{
        const next=e.key==='ArrowRight'?(index+1)%buttons.length:e.key==='ArrowLeft'?(index+buttons.length-1)%buttons.length:e.key==='Home'?0:e.key==='End'?buttons.length-1:null;
        if(next!==null){e.preventDefault();showPanel(group,next,true)}
      });
    });
  });
  const revealHash=()=>{
    let id;try{id=decodeURIComponent(location.hash.slice(1))}catch{return}
    const target=document.getElementById(id);if(!target)return;
    for(let el=target;el;el=el.parentElement){
      if(el.tagName==='DETAILS')el.open=true;
      if(el.matches('[role=tabpanel]')){const group=el.parentElement;showPanel(group,[...group.children].filter(c=>c.matches('[role=tabpanel]')).indexOf(el))}
    }
    target.scrollIntoView();
  };
  window.addEventListener('hashchange',revealHash);if(location.hash)revealHash();
  const input=document.querySelector('#search'),results=document.querySelector('#search-results');
  let indexPromise;
  const loadIndex=()=>indexPromise??=fetch(window.WIKI_ROOT+'search-index.json').then(r=>{if(!r.ok)throw Error('검색 파일을 읽지 못했습니다.');return r.json()});
  input.addEventListener('focus',()=>loadIndex().catch(()=>{}));
  input.addEventListener('input',async()=>{
    const query=input.value.trim().toLocaleLowerCase();
    results.replaceChildren();results.hidden=!query;if(!query)return;
    try{
      const entries=await loadIndex();if(query!==input.value.trim().toLocaleLowerCase())return;
      const tokens=query.split(/\s+/),matches=entries.filter(e=>tokens.every(t=>(e.title+' '+e.text).toLocaleLowerCase().includes(t))).sort((a,b)=>Number(b.title.toLocaleLowerCase().includes(query))-Number(a.title.toLocaleLowerCase().includes(query))).slice(0,12);
      results.replaceChildren();
      if(!matches.length){results.textContent='찾는 내용이 없습니다. 짧은 이름으로 다시 검색해 보세요.';return;}
      for(const entry of matches){const a=document.createElement('a');a.href=window.WIKI_ROOT+entry.path;a.textContent=entry.title;const small=document.createElement('small');const pos=Math.max(0,entry.text.toLocaleLowerCase().indexOf(tokens[0])-25);small.textContent=entry.text.slice(pos,pos+100)+'…';a.append(small);results.append(a);}
    }catch{results.textContent='검색 정보를 불러오지 못했습니다. 왼쪽 목차를 이용해 주세요.';}
  });
  input.addEventListener('keydown',e=>{if(e.key==='Enter')results.querySelector('a')?.click()});
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();input.focus()}if(e.key==='Escape'){results.hidden=true;document.body.classList.remove('nav-open');document.querySelector('#menu-toggle').setAttribute('aria-expanded','false')}});
  document.addEventListener('click',e=>{if(!e.target.closest('.search'))results.hidden=true});
  const menu=document.querySelector('#menu-toggle');menu.addEventListener('click',()=>{const open=document.body.classList.toggle('nav-open');menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'목차 닫기':'목차 열기')});
  try{document.documentElement.dataset.theme=localStorage.getItem('wiki-theme')||'light'}catch{}
  document.querySelector('#theme-toggle').addEventListener('click',()=>{const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;try{localStorage.setItem('wiki-theme',theme)}catch{}});
})();
