// Read-only decoder for the game-issued VN1 deck code. The last byte is not re-signed.
(function(){
'use strict';
function decode(raw){
const source=String(raw||'').trim();
if(!/^VN1-[A-Za-z0-9_-]+={0,2}$/.test(source))throw Error('VN1- で始まるデッキコードを入力してください。');
let b64=source.slice(4).replace(/-/g,'+').replace(/_/g,'/');
b64=b64.padEnd(Math.ceil(b64.length/4)*4,'=');
let binary;try{binary=atob(b64);}catch(_){throw Error('Base64を読み取れませんでした。');}
const bytes=Uint8Array.from(binary,ch=>ch.charCodeAt(0));
if(bytes.length!==33||bytes[0]!==1||bytes[1]!==30)throw Error('VN1のフォーマット／30枚条件と一致しません。');
const mapping=window.VN_DECK_CODE_MAP||{},counts=new Map(),missing=new Set();
for(const id of bytes.slice(2,32)){
const mapped=mapping[String(id)];
if(!mapped){missing.add('0x'+id.toString(16).toUpperCase().padStart(2,'0'));continue;}
counts.set(mapped,(counts.get(mapped)||0)+1);
}
if(missing.size)throw Error('未解析カードID: '+[...missing].join('、')+'。誤変換を避けるためデッキは変更していません。');
if([...counts.values()].some(n=>n>3))throw Error('同じカードが4枚以上あります。コードを確認してください。');
if([...counts.values()].reduce((a,b)=>a+b,0)!==30)throw Error('デッキは30枚ではありません。');
return {counts,checksum:bytes[32]};
}
function setup(){
if(document.querySelector('#vnDeckCodeImport'))return;
const panel=document.querySelector('#quickDeck'),head=panel?.querySelector('.quick-deck-head');
if(!panel||!head||!window.VN_QUICK_DECK)return;
const root=document.createElement('details');root.id='vnDeckCodeImport';root.className='vn-deck-import';
const summary=document.createElement('summary');summary.textContent='ゲームのデッキコードを読み込む';
const form=document.createElement('form');form.className='vn-deck-import-form';
const label=document.createElement('label');label.textContent='VN1- デッキコード';
const input=document.createElement('textarea');input.name='code';input.rows=2;input.placeholder='VN1-...';input.spellcheck=false;input.autocomplete='off';label.append(input);
const button=document.createElement('button');button.type='submit';button.textContent='30枚をデッキ構築に反映';
const info=document.createElement('p');info.textContent='内部カードIDを既知の123種類と照合します。未知IDを含むコードは適用しません。末尾の検証バイトは未解析のため、ゲームへ出力できるコードの生成はできません。';
const status=document.createElement('div');status.className='vn-deck-code-status';status.setAttribute('role','status');
form.append(label,button,info,status);root.append(summary,form);head.insertAdjacentElement('afterend',root);
form.addEventListener('submit',e=>{
e.preventDefault();status.textContent='';
let parsed;
try{parsed=decode(input.value);}catch(err){status.textContent=err.message;status.dataset.state='error';return;}
if(typeof allCards==='undefined'||!Array.isArray(allCards)||!allCards.length){status.textContent='カード情報の読み込み完了後にお試しください。';return;}
const unknown=[...parsed.counts.keys()].filter(id=>!allCards.some(c=>c.card_id===id));
if(unknown.length){status.textContent='現在のカードマスタに存在しないNo.: '+unknown.join('、');status.dataset.state='error';return;}
const api=window.VN_QUICK_DECK,previous=api.get();
if(previous.length&& !window.confirm('現在の作成中デッキを30枚のデッキコードで置き換えますか？'))return;
api.clear();
let ok=true;
for(const [id,amount] of parsed.counts){if(!api.add(id,amount)){ok=false;break;}}
if(!ok){api.clear();for(const row of previous)api.add(row.id,row.qty);status.textContent='読み込みに失敗したため元のデッキに戻しました。';status.dataset.state='error';return;}
status.textContent='30枚を読み込みました（'+parsed.counts.size+'種類）。チェックサムの正否は検証していません。';status.dataset.state='success';
});
const style=document.createElement('style');style.id='vnDeckImportCss';
style.textContent='.vn-deck-import{margin:4px 8px 10px;border:1px solid #8295b666;border-radius:8px;font-size:12px}.vn-deck-import>summary{cursor:pointer;padding:9px;color:#bbd6ff;font-weight:bold}.vn-deck-import-form{padding:7px 10px 12px;display:grid;gap:7px}.vn-deck-import-form label{display:grid;gap:4px}.vn-deck-import-form textarea{box-sizing:border-box;width:100%;resize:vertical;min-height:48px;background:#0e1626;color:#e8f2ff;border:1px solid #6c82a5;border-radius:6px;padding:7px;font:12px monospace}.vn-deck-import-form button{border:1px solid #6e9eca;background:#274a70;color:white;padding:8px;border-radius:6px;cursor:pointer}.vn-deck-import-form p{margin:0;opacity:.8;line-height:1.5}.vn-deck-code-status{line-height:1.45;overflow-wrap:anywhere}.vn-deck-code-status[data-state=error]{color:#ffbdbd}.vn-deck-code-status[data-state=success]{color:#adefc1}';
document.head.append(style);
}
function boot(){[0,100,300,700,1400].forEach(ms=>setTimeout(setup,ms));}
window.VN_DECK_CODE_DECODE=decode;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();