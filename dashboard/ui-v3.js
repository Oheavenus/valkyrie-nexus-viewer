// V3 UI layer: multi-rarity filtering, compact 30-card deck boards and pull rarity visualization.
(function () {
  function selectedRarities() {
    return new Set([...document.querySelectorAll('#rarityFilter input[name="rarity"]:checked')].map(x => x.value));
  }

  // Replace the single-select rarity behavior while preserving every existing sort/filter mode.
  filteredCards = function () {
    const q = document.querySelector('#searchInput')?.value.trim().toLowerCase() || '';
    const selected = selectedRarities();
    const own = document.querySelector('#ownedFilter')?.value || '';
    const type = document.querySelector('#typeFilter')?.value || '';
    const sort = document.querySelector('#sortSelect')?.value || 'id';
    const rows = allCards.filter(c =>
      (!q || [c.name, c.effect_text, c.keywords, c.card_id].join(' ').toLowerCase().includes(q)) &&
      selected.has(c.rarity) &&
      (!type || c.type === type) &&
      (!own || (own === 'owned' ? c.count > 0 : c.count === 0))
    );
    rows.sort((a, b) => {
      if (sort === 'cost') return (Number(a.cost || 99) - Number(b.cost || 99)) || a.card_id.localeCompare(b.card_id);
      if (sort === 'rarity') return (rid[a.rarity] ?? 99) - (rid[b.rarity] ?? 99) || a.card_id.localeCompare(b.card_id);
      if (sort === 'count') return b.count - a.count || a.card_id.localeCompare(b.card_id);
      return a.card_id.localeCompare(b.card_id);
    });
    return rows;
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
    const entries = [...counts.entries()].sort((a, b) => {
      if (a[0] === 'A') return 1;
      if (b[0] === 'A') return -1;
      return Number(a[0]) - Number(b[0]);
    });
    const max = Math.max(1, ...entries.map(x => x[1]));
    return entries.map(([cost, n]) => `<div class="deck-mini-curve-col"><span>${n}</span><div class="deck-mini-curve-bar" style="height:${Math.max(2, Math.round(n / max * 15))}px"></div><span>${esc(cost)}</span></div>`).join('');
  }

  function deckCopies(rows) {
    const sorted = [...rows].sort((a, b) => numCost(a.card) - numCost(b.card) || a.card_id.localeCompare(b.card_id));
    const copies = [];
    sorted.forEach(r => {
      const qty = Number(r.quantity || 0);
      for (let i = 0; i < qty; i++) copies.push({ ...r, missing:i >= Number(r.have || 0) });
    });
    return copies;
  }

  function deckCopyHTML(r) {
    const name = r.card?.name || r.name || `No.${r.card_id}`;
    return `<button class="deck-copy-card card-trigger ${r.missing ? 'missing-copy' : ''}" type="button" data-card-id="${esc(r.card_id)}" title="${esc(name)} / Cost ${esc(r.card?.cost ?? '—')}">
      ${cardArtHTML(r.card_id, 'gallery')}
      <span class="deck-copy-cost">${esc(r.card?.cost ?? '—')}</span>
    </button>`;
  }

  renderDecks = async function () {
    const metas = await loadJSON('decks.json');
    const html = [];
    deckViews = new Map();
    for (const meta of metas) {
      const rawRows = await loadCSV(meta.file);
      const rows = rawRows.map((r, order) => {
        const card_id = padId(r.card_id);
        const card = allCards.find(c => c.card_id === card_id);
        const have = collection.get(card_id)?.count || 0;
        const need = Math.max(0, Number(r.quantity) - have);
        return { ...r, card_id, card, have, need, order };
      });
      deckViews.set(meta.id, { rows, meta });
      const total = rows.reduce((a, r) => a + Number(r.quantity || 0), 0);
      const shortage = rows.reduce((a, r) => a + r.need, 0);
      const copies = deckCopies(rows);
      html.push(`<article class="deck-compact-card">
        <div class="deck-compact-head">
          <div>
            <div class="deck-compact-title">${esc(meta.title)}</div>
            <div class="deck-compact-summary">${esc(meta.summary)}</div>
            <div class="deck-compact-flags"><span class="pill">${esc(meta.status)}</span><span class="pill">${esc(meta.target)}</span><span class="pill ${shortage ? '' : 'good'}">${shortage ? `不足 ${shortage}` : '構築可能'}</span></div>
          </div>
          <div class="deck-compact-score"><span>構築確度</span><b>${esc(meta.confidence)}</b><span class="${shortage ? 'need' : 'ready'}">${total} cards</span></div>
        </div>
        <div class="deck-mini-curve">${compactCurve(rows)}</div>
        <div class="deck-copy-grid">${copies.map(deckCopyHTML).join('')}</div>
      </article>`);
    }
    document.querySelector('#decksContainer').innerHTML = html.join('');
  };

  renderPulls = function () {
    const groups = new Map();
    for (const p of pulls) {
      if (!groups.has(p.pull_id)) groups.set(p.pull_id, { id:p.pull_id, at:p.opened_at, N:0, R:0, SR:0, UR:0, newCount:0, dust:0 });
      const g = groups.get(p.pull_id);
      g[p.rarity] = (g[p.rarity] || 0) + 1;
      g.newCount += String(p.is_new).toLowerCase() === 'true' ? 1 : 0;
      g.dust += Number(p.dust_gained || 0);
    }
    const gs = [...groups.values()].sort((a, b) => b.at.localeCompare(a.at));
    const rarity = { N:0, R:0, SR:0, UR:0 };
    pulls.forEach(p => { if (rarity[p.rarity] !== undefined) rarity[p.rarity]++; });
    const newTotal = gs.reduce((a, g) => a + g.newCount, 0);
    const dust = gs.reduce((a, g) => a + g.dust, 0);
    const total = Math.max(1, pulls.length);
    const pct = key => rarity[key] / total * 100;
    const nEnd = pct('N');
    const rEnd = nEnd + pct('R');
    const srEnd = rEnd + pct('SR');
    const rarePct = (rarity.SR + rarity.UR) / total * 100;
    const newPct = newTotal / total * 100;

    document.querySelector('#pullStats').innerHTML = [
      ['記録10連', gs.length], ['総カード', pulls.length], ['SR / UR', `${rarity.SR} / ${rarity.UR}`], ['NEW', newTotal], ['確認Dust', dust]
    ].map(([a,b]) => `<div class="stat-card"><span>${a}</span><b>${b}</b></div>`).join('');

    const chart = document.querySelector('#pullCharts');
    if (chart) chart.innerHTML = `<div class="pull-dashboard">
      <div class="pull-donut-card">
        <div class="rarity-donut" style="--n:${nEnd.toFixed(3)}%;--r:${rEnd.toFixed(3)}%;--sr:${srEnd.toFixed(3)}%"><div class="rarity-donut-center"><b>${pulls.length}</b><span>cards</span></div></div>
        <div class="pull-legend">${['N','R','SR','UR'].map(k => `<div class="pull-legend-row"><span class="pull-legend-chip rarity ${k}">${k}</span><strong>${rarity[k]}</strong><span>${pct(k).toFixed(1)}%</span></div>`).join('')}</div>
      </div>
      <div class="pull-insights">
        <div class="pull-insight"><span>SR以上</span><b>${rarePct.toFixed(1)}%</b><small>${rarity.SR + rarity.UR} / ${pulls.length}枚</small></div>
        <div class="pull-insight"><span>UR比率</span><b>${pct('UR').toFixed(1)}%</b><small>${rarity.UR} / ${pulls.length}枚</small></div>
        <div class="pull-insight"><span>NEW比率</span><b>${newPct.toFixed(1)}%</b><small>${newTotal} / ${pulls.length}枚</small></div>
      </div>
    </div>`;

    document.querySelector('#pullsBody').innerHTML = gs.map(g => `<tr><td>${esc(g.id)}</td><td>${esc(g.at.replace('T',' '))}</td><td>${g.N}</td><td>${g.R}</td><td>${g.SR}</td><td>${g.UR}</td><td>${g.newCount}</td><td>${g.dust}</td></tr>`).join('');
  };

  function refreshV3() {
    if (!document.querySelector('#cardsGallery') || typeof allCards === 'undefined' || !Array.isArray(allCards) || !allCards.length) return false;
    try { filterCards(); } catch (_) {}
    try { renderPulls(); } catch (_) {}
    try { renderDecks(); } catch (_) {}
    return true;
  }

  function start() {
    const rarityBox = document.querySelector('#rarityFilter');
    rarityBox?.addEventListener('change', () => filterCards());
    let tries = 0;
    const tick = () => {
      tries++;
      if (refreshV3() || tries > 30) return;
      setTimeout(tick, 60);
    };
    tick();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
