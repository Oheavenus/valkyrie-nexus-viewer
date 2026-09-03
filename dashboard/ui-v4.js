// V4 UI layer: game-like filters, editable local deck workspace, 10x3 deck boards,
// and official-vs-observed pack-rate comparison.
(function () {
  const OFFICIAL = window.VN_OFFICIAL_PACK_RATES || { N:41.27, R:40.48, SR:16.67, UR:1.59 };
  const RATE_SOURCE = window.VN_OFFICIAL_PACK_RATE_SOURCE || 'ゲーム内排出率';
  const DECK_NAMES_KEY = 'vn-deck-name-overrides-v1';
  const DECK_HIDDEN_KEY = 'vn-deck-hidden-v1';
  const DRAFT_NAME_KEY = 'vn-quick-deck-name-v1';

  const loadJSONLocal = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch (_) { return fallback; }
  };
  const saveJSONLocal = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} };
  const deckNames = loadJSONLocal(DECK_NAMES_KEY, {});
  const hiddenDecks = new Set(loadJSONLocal(DECK_HIDDEN_KEY, []));

  function checkedValues(selector) {
    return new Set([...document.querySelectorAll(selector + ' input[type="checkbox"]:checked')].map(x => x.value));
  }
  function allCount(selector) { return document.querySelectorAll(selector + ' input[type="checkbox"]').length; }
  function rangeMatch(value, key) {
    const n = Number(value);
    if (!Number.isFinite(n)) return false;
    if (key === 'le1') return n <= 1;
    if (key === 'ge7') return n >= 7;
    if (key === 'ge10') return n >= 10;
    return n === Number(key);
  }
  function groupedMatch(value, selected, totalOptions) {
    if (selected.size === totalOptions) return true;
    if (!selected.size) return false;
    return [...selected].some(k => rangeMatch(value, k));
  }
  function cardKeywords(card) {
    return String(card?.keywords || '').split(';').map(x => x.trim()).filter(Boolean);
  }

  function buildEffectFilter() {
    const panel = document.querySelector('#effectFilterPanel');
    if (!panel || !Array.isArray(allCards) || !allCards.length || panel.dataset.ready === '1') return;
    const counts = new Map();
    allCards.forEach(c => cardKeywords(c).forEach(k => counts.set(k, (counts.get(k) || 0) + 1)));
    const items = [...counts.entries()].sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'));
    panel.innerHTML = `<div class="effect-filter-head"><strong>効果で絞り込む</strong><button type="button" id="effectFilterClear">解除</button></div>
      <div class="effect-filter-options">${items.map(([name,count]) => `<label><input type="checkbox" name="effectKeyword" value="${esc(name)}"><span>${esc(name)}</span><small>${count}</small></label>`).join('')}</div>`;
    panel.dataset.ready = '1';
  }

  function updateEffectCount() {
    const n = document.querySelectorAll('#effectFilterPanel input[name="effectKeyword"]:checked').length;
    const badge = document.querySelector('#effectFilterCount');
    if (badge) badge.textContent = n ? String(n) : '';
    document.querySelector('#effectFilterButton')?.classList.toggle('active', n > 0);
  }

  filteredCards = function () {
    const q = document.querySelector('#searchInput')?.value.trim().toLowerCase() || '';
    const rarities = checkedValues('#rarityFilter');
    const types = checkedValues('#typeFilter');
    const costs = checkedValues('#costFilter');
    const atks = checkedValues('#atkFilter');
    const hps = checkedValues('#hpFilter');
    const effects = new Set([...document.querySelectorAll('#effectFilterPanel input[name="effectKeyword"]:checked')].map(x => x.value));
    const own = document.querySelector('#ownedFilter')?.value || '';
    const sort = document.querySelector('#sortSelect')?.value || 'id';
    const costTotal = allCount('#costFilter'), atkTotal = allCount('#atkFilter'), hpTotal = allCount('#hpFilter');

    const rows = allCards.filter(c => {
      if (q && ![c.name, c.effect_text, c.keywords, c.card_id].join(' ').toLowerCase().includes(q)) return false;
      if (!rarities.has(c.rarity)) return false;
      if (!types.has(c.type)) return false;
      if (!groupedMatch(c.cost, costs, costTotal)) return false;
      if (atks.size !== atkTotal && (c.type !== 'ユニット' || !groupedMatch(c.atk, atks, atkTotal))) return false;
      if (hps.size !== hpTotal && (c.type !== 'ユニット' || !groupedMatch(c.hp, hps, hpTotal))) return false;
      if (effects.size && !cardKeywords(c).some(k => effects.has(k))) return false;
      if (own && (own === 'owned' ? c.count <= 0 : c.count > 0)) return false;
      return true;
    });

    rows.sort((a,b) => {
      if (sort === 'cost') return (Number(a.cost || 99) - Number(b.cost || 99)) || a.card_id.localeCompare(b.card_id);
      if (sort === 'rarity') return (rid[a.rarity] ?? 99) - (rid[b.rarity] ?? 99) || a.card_id.localeCompare(b.card_id);
      if (sort === 'count') return b.count - a.count || a.card_id.localeCompare(b.card_id);
      return a.card_id.localeCompare(b.card_id);
    });
    return rows;
  };

  // Avoid the previous "スペル / Cost / スペル" duplication in hover details.
  cardTileHTML = function (c) {
    const unit = c.type === 'ユニット';
    const stats = unit ? `${esc(c.atk)}/${esc(c.hp)}` : '—';
    const ownedClass = c.count ? 'owned' : 'missing';
    return `<button class="card-tile card-trigger rarity-${esc(c.rarity)}" type="button" data-card-id="${esc(c.card_id)}" aria-label="No.${esc(c.card_id)} ${esc(c.name)} の詳細を表示">
      <div class="tile-art-shell">
        ${cardArtHTML(c.card_id, 'gallery')}
        <div class="tile-topline"><span class="tile-no">No.${esc(c.card_id)}</span><span class="rarity ${esc(c.rarity)}">${esc(c.rarity)}</span></div>
        <span class="tile-owned ${ownedClass}">×${c.count}</span>
      </div>
      <div class="tile-caption"><span class="tile-caption-name">${esc(c.name)}</span><span class="tile-caption-meta">Cost ${esc(c.cost)}${unit ? ` · ${stats}` : ''}</span></div>
    </button>`;
  };

  function numCost(card) {
    const n = Number(card?.cost);
    return Number.isFinite(n) ? n : 99;
  }
  function compactCurve(rows) {
    const counts = new Map();
    rows.forEach(r => {
      const key = r.card?.cost === '' ? 'A' : String(r.card?.cost ?? '?');
      counts.set(key, (counts.get(key) || 0) + Number(r.quantity || 0));
    });
    const entries = [...counts.entries()].sort((a,b) => a[0] === 'A' ? 1 : b[0] === 'A' ? -1 : Number(a[0]) - Number(b[0]));
    const max = Math.max(1, ...entries.map(x => x[1]));
    return `<div class="curve-title">マナカーブ</div><div class="curve-bars">${entries.map(([cost,n]) => `<div class="deck-mini-curve-col"><span class="curve-count">${n}</span><div class="deck-mini-curve-bar" style="height:${Math.max(4,Math.round(n/max*34))}px"></div><span class="curve-cost">${esc(cost)}</span></div>`).join('')}</div>`;
  }
  function deckCopies(rows) {
    const sorted = [...rows].sort((a,b) => numCost(a.card) - numCost(b.card) || a.card_id.localeCompare(b.card_id));
    const copies = [];
    sorted.forEach(r => { for (let i=0;i<Number(r.quantity||0);i++) copies.push({ ...r, missing:i>=Number(r.have||0) }); });
    return copies;
  }
  function deckCopyHTML(r) {
    const name = r.card?.name || r.name || `No.${r.card_id}`;
    return `<button class="deck-copy-card card-trigger rarity-${esc(r.card?.rarity || 'N')} ${r.missing ? 'missing-copy' : ''}" type="button" data-card-id="${esc(r.card_id)}" title="${esc(name)} / Cost ${esc(r.card?.cost ?? '—')}">${cardArtHTML(r.card_id,'gallery')}<span class="deck-copy-cost">${esc(r.card?.cost ?? '—')}</span></button>`;
  }
  function visibleTitle(meta) { return deckNames[meta.id] || meta.title; }
  function persistDeckPrefs() {
    saveJSONLocal(DECK_NAMES_KEY, deckNames);
    saveJSONLocal(DECK_HIDDEN_KEY, [...hiddenDecks]);
  }

  renderDecks = async function () {
    const metas = await loadJSON('decks.json');
    const html = [];
    deckViews = new Map();
    for (const meta of metas) {
      const rawRows = await loadCSV(meta.file);
      const rows = rawRows.map((r,order) => {
        const card_id = padId(r.card_id), card = allCards.find(c => c.card_id === card_id);
        const have = collection.get(card_id)?.count || 0, need = Math.max(0, Number(r.quantity)-have);
        return { ...r, card_id, card, have, need, order };
      });
      deckViews.set(meta.id, { rows, meta });
      if (hiddenDecks.has(meta.id)) continue;
      const total = rows.reduce((a,r)=>a+Number(r.quantity||0),0);
      const shortage = rows.reduce((a,r)=>a+r.need,0);
      const copies = deckCopies(rows);
      html.push(`<article class="deck-compact-card" data-deck-id="${esc(meta.id)}">
        <div class="deck-compact-head">
          <div class="deck-compact-copy">
            <div class="deck-compact-title">${esc(visibleTitle(meta))}</div>
            <div class="deck-compact-summary">${esc(meta.summary)}</div>
            <div class="deck-compact-flags"><span class="pill">${esc(meta.status)}</span><span class="pill">${esc(meta.target)}</span><span class="pill ${shortage?'':'good'}">${shortage?`不足 ${shortage}`:'構築可能'}</span></div>
          </div>
          <div class="deck-compact-score"><span>構築確度</span><b>${esc(meta.confidence)}</b><span class="${shortage?'need':'ready'}">${total} cards</span></div>
          <div class="deck-card-actions">
            <button type="button" data-deck-action="adjust" data-deck-id="${esc(meta.id)}">調整</button>
            <button type="button" data-deck-action="rename" data-deck-id="${esc(meta.id)}">名前変更</button>
            <button type="button" data-deck-action="delete" data-deck-id="${esc(meta.id)}">削除</button>
          </div>
        </div>
        <div class="deck-copy-grid">${copies.map(deckCopyHTML).join('')}</div>
        <div class="deck-info-side">${compactCurve(rows)}<div class="deck-info-note">Cost順 / 10列×3段</div></div>
      </article>`);
    }
    if (hiddenDecks.size) html.unshift(`<div class="deck-library-tools"><span>${hiddenDecks.size}件を非表示</span><button type="button" id="restoreHiddenDecks">削除済みを戻す</button></div>`);
    document.querySelector('#decksContainer').innerHTML = html.join('');
  };

  function importDeckToWorkspace(deckId) {
    const view = deckViews.get(deckId);
    if (!view || !window.VN_QUICK_DECK) return;
    window.VN_QUICK_DECK.clear();
    view.rows.forEach(r => window.VN_QUICK_DECK.add(r.card_id, Number(r.quantity || 0)));
    try { localStorage.setItem(DRAFT_NAME_KEY, visibleTitle(view.meta)); } catch (_) {}
    enhanceDraftPanel();
    document.querySelector('.tab[data-tab="cards"]')?.click();
  }

  function currentDraftName() {
    try { return localStorage.getItem(DRAFT_NAME_KEY) || '作成中デッキ'; }
    catch (_) { return '作成中デッキ'; }
  }
  function setDraftName(name) {
    try { localStorage.setItem(DRAFT_NAME_KEY, name || '作成中デッキ'); } catch (_) {}
    enhanceDraftPanel();
  }
  function draftRowsForCurve() {
    const data = window.VN_QUICK_DECK?.get?.() || [];
    return data.map(x => ({ quantity:x.qty, card:allCards.find(c=>c.card_id===x.id), card_id:x.id }));
  }
  function enhanceDraftPanel() {
    const panel = document.querySelector('#draftDeckPanel');
    if (!panel || panel.hidden || !panel.children.length) return;
    const strong = panel.querySelector('.draft-compact-head strong');
    if (strong) strong.textContent = currentDraftName();
    if (!panel.querySelector('.draft-v4-actions')) {
      const head = panel.querySelector('.draft-compact-head');
      head?.insertAdjacentHTML('beforeend', `<div class="draft-v4-actions"><button type="button" data-draft-action="adjust">調整</button><button type="button" data-draft-action="rename">名前変更</button><button type="button" data-draft-action="delete">削除</button></div>`);
    }
    let curve = panel.querySelector('.draft-v4-curve');
    if (!curve) {
      curve = document.createElement('div');
      curve.className = 'draft-v4-curve';
      const grid = panel.querySelector('.draft-mini-grid');
      grid?.after(curve);
    }
    curve.innerHTML = compactCurve(draftRowsForCurve());
  }

  const draftObserver = new MutationObserver(() => requestAnimationFrame(enhanceDraftPanel));
  function observeDraft() {
    const panel = document.querySelector('#draftDeckPanel');
    if (panel) draftObserver.observe(panel,{childList:true,attributes:true,attributeFilter:['hidden']});
  }

  function deltaLabel(delta) {
    if (Math.abs(delta) < 0.05) return { cls:'flat', text:'ほぼ公称通り' };
    return delta > 0 ? { cls:'up', text:`上振れ +${delta.toFixed(2)}pt` } : { cls:'down', text:`下振れ ${delta.toFixed(2)}pt` };
  }

  renderPulls = function () {
    const groups = new Map();
    for (const p of pulls) {
      if (!groups.has(p.pull_id)) groups.set(p.pull_id,{id:p.pull_id,at:p.opened_at,N:0,R:0,SR:0,UR:0,newCount:0,dust:0});
      const g = groups.get(p.pull_id); g[p.rarity]=(g[p.rarity]||0)+1; g.newCount += String(p.is_new).toLowerCase()==='true'?1:0; g.dust += Number(p.dust_gained||0);
    }
    const gs=[...groups.values()].sort((a,b)=>b.at.localeCompare(a.at));
    const rarity={N:0,R:0,SR:0,UR:0}; pulls.forEach(p=>{if(rarity[p.rarity]!==undefined)rarity[p.rarity]++;});
    const newTotal=gs.reduce((a,g)=>a+g.newCount,0), dust=gs.reduce((a,g)=>a+g.dust,0), total=Math.max(1,pulls.length);
    const pct=k=>rarity[k]/total*100, nEnd=pct('N'), rEnd=nEnd+pct('R'), srEnd=rEnd+pct('SR');
    const rarePct=(rarity.SR+rarity.UR)/total*100, newPct=newTotal/total*100;

    document.querySelector('#pullStats').innerHTML = [
      ['記録10連',gs.length],['総カード',pulls.length],['SR / UR',`${rarity.SR} / ${rarity.UR}`],['NEW',newTotal],['確認Dust',dust]
    ].map(([a,b])=>`<div class="stat-card"><span>${a}</span><b>${b}</b></div>`).join('');

    const rateCards=['N','R','SR','UR'].map(k=>{
      const actual=pct(k), official=Number(OFFICIAL[k]||0), delta=actual-official, state=deltaLabel(delta), expected=pulls.length*official/100;
      return `<div class="rate-compare-card rarity-${k}"><div class="rate-compare-head"><span class="rarity ${k}">${k}</span><strong>${actual.toFixed(2)}%</strong></div><div class="rate-compare-official">公称 ${official.toFixed(2)}% / 期待 ${expected.toFixed(1)}枚</div><div class="rate-compare-delta ${state.cls}">${state.text}</div><div class="rate-compare-count">実測 ${rarity[k]}枚</div></div>`;
    }).join('');

    const chart=document.querySelector('#pullCharts');
    if(chart) chart.innerHTML=`<div class="pull-main-dashboard">
      <div class="pull-hero">
        <div class="pull-donut-card"><div class="rarity-donut" style="--n:${nEnd.toFixed(3)}%;--r:${rEnd.toFixed(3)}%;--sr:${srEnd.toFixed(3)}%"><div class="rarity-donut-center"><b>${pulls.length}</b><span>cards</span></div></div><div class="pull-legend">${['N','R','SR','UR'].map(k=>`<div class="pull-legend-row"><span class="pull-legend-chip rarity ${k}">${k}</span><strong>${rarity[k]}</strong><span>${pct(k).toFixed(1)}%</span></div>`).join('')}</div></div>
        <div class="pull-insights"><div class="pull-insight"><span>SR以上</span><b>${rarePct.toFixed(1)}%</b><small>${rarity.SR+rarity.UR} / ${pulls.length}枚</small></div><div class="pull-insight"><span>UR比率</span><b>${pct('UR').toFixed(1)}%</b><small>${rarity.UR} / ${pulls.length}枚</small></div><div class="pull-insight"><span>NEW比率</span><b>${newPct.toFixed(1)}%</b><small>${newTotal} / ${pulls.length}枚</small></div></div>
      </div>
      <div class="rate-compare-section"><div class="rate-compare-title"><strong>公称排出率との比較</strong><span>${esc(RATE_SOURCE)}</span></div><div class="rate-compare-grid">${rateCards}</div></div>
    </div>`;
    document.querySelector('#pullsBody').innerHTML=gs.map(g=>`<tr><td>${esc(g.id)}</td><td>${esc(g.at.replace('T',' '))}</td><td>${g.N}</td><td>${g.R}</td><td>${g.SR}</td><td>${g.UR}</td><td>${g.newCount}</td><td>${g.dust}</td></tr>`).join('');
  };

  function wireV4() {
    buildEffectFilter();
    ['costFilter','atkFilter','hpFilter','typeFilter'].forEach(id => document.querySelector('#'+id)?.addEventListener('change', filterCards));
    document.querySelector('#effectFilterPanel')?.addEventListener('change',()=>{updateEffectCount();filterCards();});
    document.querySelector('#effectFilterButton')?.addEventListener('click',e=>{e.preventDefault();document.querySelector('#effectFilterWrap')?.classList.toggle('open');});
    document.querySelector('#effectFilterClear')?.addEventListener('click',e=>{e.preventDefault();document.querySelectorAll('#effectFilterPanel input:checked').forEach(x=>x.checked=false);updateEffectCount();filterCards();});
    observeDraft();
    enhanceDraftPanel();
  }

  document.addEventListener('click', async e => {
    const deckBtn=e.target.closest?.('[data-deck-action][data-deck-id]');
    if(deckBtn){
      const id=deckBtn.dataset.deckId, action=deckBtn.dataset.deckAction, view=deckViews.get(id);
      if(action==='adjust') importDeckToWorkspace(id);
      if(action==='rename' && view){ const next=prompt('デッキ名',visibleTitle(view.meta)); if(next!==null){ const s=next.trim(); if(s) deckNames[id]=s; else delete deckNames[id]; persistDeckPrefs(); await renderDecks(); } }
      if(action==='delete' && view && confirm(`「${visibleTitle(view.meta)}」をダッシュボードから削除しますか？\nGitHub上の元データは削除しません。`)){ hiddenDecks.add(id); persistDeckPrefs(); await renderDecks(); }
      return;
    }
    if(e.target.closest?.('#restoreHiddenDecks')){ hiddenDecks.clear(); persistDeckPrefs(); await renderDecks(); return; }
    const draftBtn=e.target.closest?.('[data-draft-action]');
    if(draftBtn){
      const action=draftBtn.dataset.draftAction;
      if(action==='adjust') document.querySelector('.tab[data-tab="cards"]')?.click();
      if(action==='rename'){ const next=prompt('デッキ名',currentDraftName()); if(next!==null && next.trim()) setDraftName(next.trim()); }
      if(action==='delete' && confirm(`「${currentDraftName()}」を削除しますか？`)){ window.VN_QUICK_DECK?.clear?.(); setDraftName('作成中デッキ'); }
    }
  });

  function refreshWhenReady() {
    if (!Array.isArray(allCards) || !allCards.length) return false;
    buildEffectFilter();
    try { filterCards(); } catch(_) {}
    try { renderPulls(); } catch(_) {}
    try { renderDecks(); } catch(_) {}
    enhanceDraftPanel();
    return true;
  }

  function start() {
    wireV4();
    let tries=0;
    const tick=()=>{tries++; if(refreshWhenReady()||tries>40)return; setTimeout(tick,60);};
    tick();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
