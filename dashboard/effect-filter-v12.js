// VN V12: accessibility, placement and tabs for the existing effect filter.
(function(){
'use strict';
function init(){
  const panel=document.getElementById('effectFilterPanel');
  const wrap=document.getElementById('effectFilterWrap');
  const trigger=document.getElementById('effectFilterButton');
  const footer=document.querySelector('.card-control-footer');
  if(!panel||!wrap||!trigger||!footer)return;
  if(panel.dataset.vnV12==='ready')return;
  const keywords=panel.querySelector('.effect-filter-options');
  const semantic=panel.querySelector('#vnSemanticOptions');
  if(!keywords||!semantic)return;
  panel.dataset.vnV12='ready';
  keywords.id='vnEffectKeywords';
  keywords.setAttribute('role','tabpanel');
  keywords.setAttribute('aria-label','キーワード');
  semantic.setAttribute('role','tabpanel');
  semantic.setAttribute('aria-label','効果内容');
  const tabs=document.createElement('div');
  tabs.className='vn-effect-tabs';
  tabs.setAttribute('role','tablist');
  tabs.setAttribute('aria-label','効果検索の分類');
  const buttons={};
  for(const [key,label,target] of [['keywords','キーワード','vnEffectKeywords'],['semantic','効果内容','vnSemanticOptions']]){
    const button=document.createElement('button');
    button.className='vn-effect-tab';
    button.type='button';
    button.id='vnTab-'+key;
    button.textContent=label;
    button.setAttribute('role','tab');
    button.setAttribute('aria-controls',target);
    button.addEventListener('click',()=>activate(key));
    tabs.appendChild(button);
    buttons[key]=button;
  }
  panel.insertBefore(tabs,keywords);
  function activate(which){
    const second=which==='semantic';
    keywords.hidden=second;
    semantic.hidden=!second;
    buttons.keywords.setAttribute('aria-selected',String(!second));
    buttons.semantic.setAttribute('aria-selected',String(second));
    buttons.keywords.tabIndex=second?-1:0;
    buttons.semantic.tabIndex=second?0:-1;
  }
  activate('keywords');
  // Move the existing DOM node, preserving listeners attached by ui-v4.js.
  // This avoids positioning relative to the footer button (and footer blur).
  document.body.appendChild(panel);
  panel.setAttribute('role','region');
  trigger.setAttribute('aria-controls','effectFilterPanel');
  trigger.setAttribute('aria-expanded','false');
  trigger.setAttribute('aria-haspopup','true');
  function place(){
    if(panel.dataset.vnOpen!=='true')return;
    const footerTop=footer.getBoundingClientRect().top;
    panel.style.setProperty('bottom',Math.max(6,window.innerHeight-footerTop+9)+'px','important');
  }
  function sync(){
    const opened=wrap.classList.contains('open');
    panel.dataset.vnOpen=String(opened);
    trigger.setAttribute('aria-expanded',String(opened));
    if(opened)place();
  }
  function close(restoreFocus){
    if(!wrap.classList.contains('open'))return;
    wrap.classList.remove('open');
    sync();
    if(restoreFocus)trigger.focus();
  }
  // ui-v4's click handler toggles .open before this listener runs.
  trigger.addEventListener('click',sync);
  document.addEventListener('pointerdown',event=>{
    if(!wrap.contains(event.target)&&!panel.contains(event.target))close(false);
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&wrap.classList.contains('open')){
      event.preventDefault();close(true);
    }
    if((event.key==='ArrowLeft'||event.key==='ArrowRight')&&tabs.contains(document.activeElement)){
      event.preventDefault();
      const next=document.activeElement===buttons.keywords?'semantic':'keywords';
      activate(next);buttons[next].focus();
    }
  });
  window.addEventListener('resize',place,{passive:true});
  panel.addEventListener('change',updateTabCounts);
  panel.addEventListener('click',e=>{
    if(e.target.closest('#effectFilterClear'))setTimeout(updateTabCounts,0);
  });
  function updateTabCounts(){
    const a=panel.querySelectorAll('input[name="effectKeyword"]:checked').length;
    const b=panel.querySelectorAll('input[name="effectSemantic"]:checked').length;
    buttons.keywords.textContent='キーワード'+(a?' ('+a+')':'');
    buttons.semantic.textContent='効果内容'+(b?' ('+b+')':'');
  }
  updateTabCounts();
  sync();
}
function boot(){
  const panel=document.getElementById('effectFilterPanel');
  if(!panel)return;
  let pending=false;
  const watcher=new MutationObserver(()=>{
    if(pending)return;
    pending=true;
    queueMicrotask(()=>{pending=false;init();if(panel.dataset.vnV12==='ready')watcher.disconnect();});
  });
  watcher.observe(panel,{childList:true});
  init();
  if(panel.dataset.vnV12==='ready')watcher.disconnect();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();
