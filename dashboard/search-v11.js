// Shared VN semantic search and official rule glossary (v1.4.4).
(function(){
'use strict';
const S=[
['draw','ドロー',/カードを\d+枚引く|もう1枚引く|カードを引く/],
['search','サーチ',/デッキから[^。]{0,75}手札に加え|デッキから[^。]{0,75}手札へ/],
['hand','手札追加',/手札に加え|手札に戻す|手札へ/],
['generate','生成',/手札に加え|手札に戻す/],
['disabled','攻撃不能',/攻撃不能/],
['heal','回復',/回復/],
['single','単体除去',/敵ユニット1体[^。]{0,45}(?:破壊|消滅|手札に戻す)|(?:破壊|消滅)[^。]{0,25}敵ユニット1体/],
['area','全体攻撃',/全ての敵ユニット[^。]{0,45}(?:ダメージ|破壊|消滅|ATK-)|敵ユニット全て[^。]{0,35}ダメージ|隣り合っている敵ユニット全て[^。]{0,20}ダメージ/],
['summon','召喚',/召喚/],['revive','復活',/復活/],['grave','墓地関連',/墓地|死亡済み|復活/],
['cost','コスト軽減',/コスト[^。]{0,40}(?:減ら|軽減|を\d+にする)/],
['death','死亡時',/死亡時/],['attack','攻撃時',/攻撃時/],['activate','起動',/起動/],
['depth','深度',/深度/],['chain','チェイン',/チェイン/],['guard','守護',/守護/],
['shield','鉄壁',/鉄壁/],['tenacity','執念',/執念/],['vanish','消滅',/消滅/],
['finisher','奥義',/奥義/],['recursive','再帰',/再帰/]
];
const A={'ドロー':'draw','カードを引く':'draw','引く':'draw','サーチ':'search','デッキ検索':'search','デッキから':'search','回復':'heal','ヒール':'heal','手札追加':'hand','生成':'generate','単体除去':'single','全体攻撃':'area','全体ダメージ':'area','aoe':'area','コスト軽減':'cost','コストダウン':'cost','墓地':'grave','蘇生':'revive','リアニメイト':'revive'};
const R=[
['奥義','ver1.4.3：同名の奥義カードは1ターンに1枚だけ使用可能。'],
['再帰','ver1.4.4：使用後に手札へ加える。第2弾先行カードのルール（未配信カードは現行160枚に含まない）。'],
['鉄壁','1回で受けるダメージは最大3。貫通で無視される。'],
['執念','HP2以上のとき、致死ダメージを受けてもHP1で残る。付与条件は各カード本文を参照。'],
['不屈','効果で破壊されない。ただし消滅は防げない。'],
['消滅','墓地へ送らず、死亡時効果を発動しない。'],
['墓地・復活','ver1.1.3以降、復活したカードは墓地から取り除かれる。捨てた手札も墓地へ送られる。'],
['神秘','相手から効果の対象に選ばれない（全体効果とランダム効果は防げない）。'],
['狙撃','攻撃時に反撃を受けない。'],
['貫通','鉄壁を無視してダメージを与える。'],
['隠密','ver1.1.6：攻撃するまで対象に選ばれない。手札から使う効果の対象にも選べない。'],
['チェイン','そのカードより前に出したカードの枚数で数える。'],
['深度','深度を増やす・消費するカードは効果文にも明記される。']
];
const N={'127':'ver1.4.3：奥義が追加された。','146':'ver1.4.3：執念は攻撃時にターン終了まで得る。','159':'ver1.4.4：コスト軽減の下限は1。ver1.4.0でHP7→3。','144':'ver1.4.0：破壊した味方1体につきリーダーを2回復。','155':'ver1.4.0：死亡時に自身のコピーを手札へ加える。','160':'ver1.4.0：ATK6→8。'};
function text(c){return String(c&&c.effect_text||'')+' '+String(c&&c.keywords||'');}
function tags(c){const value=text(c);return S.filter(s=>s[0]==='generate'?value.split('。').some(part=>/手札に加え|手札に戻す/.test(part)&&!/デッキから/.test(part)):s[2].test(value)).map(s=>s[0]);}
function match(c,q){
const hay=[c.name,c.effect_text,c.keywords,c.card_id,'No.'+c.card_id].join(' ').normalize('NFKC').toLowerCase();
const found=new Set(tags(c));
return String(q||'').normalize('NFKC').toLowerCase().trim().split(/\s+/).every(k=>!k||hay.includes(k)||Boolean(A[k]&&found.has(A[k])));
}
window.VN_CARD_SEARCH_MATCH=match;window.VN_CARD_SEARCH_TAGS=tags;window.VN_CARD_SEARCH_VERSION='1.4.4';
function count(){
const n=document.querySelectorAll('#effectFilterPanel input[type="checkbox"]:checked').length;
const el=document.querySelector('#effectFilterCount');if(el)el.textContent=n?String(n):'';
document.querySelector('#effectFilterButton')?.classList.toggle('active',n>0);
}
function sem(){
const p=document.querySelector('#effectFilterPanel');
if(!p||!p.querySelector('.effect-filter-options')||!Array.isArray(allCards)||!allCards.length)return;
if(p.querySelector('#vnSemanticOptions'))return;
const s=document.createElement('section');s.id='vnSemanticOptions';s.className='vn-semantic';
const h=document.createElement('b');h.textContent='効果内容（複数選択＝OR）';s.append(h);
const grid=document.createElement('div');grid.className='vn-semantic-grid';
S.forEach(([key,label])=>{
const n=allCards.filter(c=>tags(c).includes(key)).length;if(!n)return;
const l=document.createElement('label'),c=document.createElement('input'),span=document.createElement('span'),small=document.createElement('small');
c.type='checkbox';c.name='effectSemantic';c.value=key;span.textContent=label;small.textContent=String(n);l.append(c,span,small);grid.append(l);
});
s.append(grid);p.append(s);
p.addEventListener('change',e=>{if(e.target?.name==='effectSemantic'){count();if(typeof filterCards==='function')filterCards();}});
p.addEventListener('click',e=>{if(e.target.closest('#effectFilterClear'))setTimeout(count,0);});
}
function help(){
if(document.querySelector('#vnRulesHelp'))return;
const before=document.querySelector('#effectFilterWrap');if(!before)return;
const d=document.createElement('details');d.id='vnRulesHelp';d.className='vn-rule-help';
const sm=document.createElement('summary');sm.textContent='ルール・検索';d.append(sm);
const body=document.createElement('div');body.className='vn-rule-help-body';
const p=document.createElement('p');p.textContent='Ver.1.4.4までの公式通知に基づく。名前・効果文に加え、「サーチ」「ドロー」「回復」「全体攻撃」などで検索できます。空白区切りはAND、効果選択はOR。';body.append(p);
const dl=document.createElement('dl');R.forEach(([word,note])=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=word;dd.textContent=note;dl.append(dt,dd);});
body.append(dl);d.append(body);before.insertAdjacentElement('afterend',d);
}
function css(){
if(document.querySelector('#vnSearchV11Style'))return;
const s=document.createElement('style');s.id='vnSearchV11Style';s.textContent='.vn-semantic{border-top:1px solid #6c779066;margin-top:10px;padding:12px 8px}.vn-semantic>b{display:block;font-size:12px;margin-bottom:8px}.vn-semantic-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:5px}.vn-semantic-grid label{display:flex;gap:5px;align-items:center;padding:5px;border:1px solid #7185aa66;border-radius:6px;font-size:12px}.vn-semantic-grid small{margin-left:auto;opacity:.65}.vn-rule-help{position:relative;font-size:12px;z-index:10}.vn-rule-help>summary{cursor:pointer;border:1px solid #7185aa88;padding:9px;border-radius:6px;white-space:nowrap}.vn-rule-help-body{position:absolute;bottom:calc(100% + 7px);right:0;width:min(440px,90vw);max-height:65vh;overflow:auto;padding:14px;background:#141d31;color:#ecf3ff;border:1px solid #7185aa;border-radius:10px;box-shadow:0 10px 30px #0009;line-height:1.5}.vn-rule-help-body p{margin:0 0 9px}.vn-rule-help-body dl{margin:0}.vn-rule-help-body dt{font-weight:bold;color:#a9ccff;margin-top:8px}.vn-rule-help-body dd{margin:2px 0 9px}@media(max-width:650px){.vn-rule-help-body{position:fixed;bottom:12vh;left:5vw;width:90vw}}';document.head.append(s);
}
function annotate(){
const el=document.querySelector('#cardModalBody'),label=el?.querySelector('.modal-kicker')?.textContent?.match(/No\.(\d+)/),dl=el?.querySelector('.card-details');
if(!label||!dl)return;const id=label[1].padStart(3,'0');
if(dl.querySelector('.vn-v11-note'))return;
const c=typeof allCards!=='undefined'&&allCards.find(x=>x.card_id===id);if(!c)return;
const key=String(c.keywords||'').split(/[;,、]/).map(x=>x.trim());
const selected=R.filter(([word])=>!['神秘','消滅','不屈'].includes(word)&&(key.includes(word)||(word==='墓地・復活'&&/墓地|復活/.test(text(c)))));
if(N[id])selected.push(['調整履歴',N[id]]);
if(!selected.length)return;
const frag=document.createDocumentFragment();selected.forEach(([word,note])=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.className=dd.className='vn-v11-note';dt.textContent='ルール補足：'+word;dd.textContent=note;frag.append(dt,dd);});dl.append(frag);
}
function start(){
css();help();
const filterPanel=document.querySelector('#effectFilterPanel');if(filterPanel)new MutationObserver(sem).observe(filterPanel,{childList:true});
const el=document.querySelector('#cardModalBody');if(el){let pending=false;new MutationObserver(()=>{if(!pending){pending=true;requestAnimationFrame(()=>{pending=false;annotate();});}}).observe(el,{childList:true,subtree:true});}
[0,120,350,900,1800,3200].forEach(t=>setTimeout(()=>{sem();help();},t));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();