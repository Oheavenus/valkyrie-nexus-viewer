const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function esc(v = '') {
  return String(v).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (c === '"') {
      if (quoted && n === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      row.push(field); field = '';
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && n === '\n') i++;
      row.push(field); field = '';
      if (row.some(v => v !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows.shift().map(h => h.trim());
  return rows.map(r => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()])));
}

function snapshotText(path) {
  const s = window.VN_SNAPSHOT;
  if (!s) return null;
  if (path === '../data/cards.csv') return s.cardsCsv;
  if (path === '../data/collection.csv') return s.collectionCsv;
  if (path === '../data/pulls.csv') return s.pullsCsv;
  if (path === 'decks.json') return s.decksJson;
  if (path.startsWith('../decks/')) {
    const name = path.split('/').pop();
    return s.deckFiles?.[name] ?? null;
  }
  return null;
}

async function loadCSV(path) {
  const snap = snapshotText(path);
  if (snap !== null) return parseCSV(snap);
  const r = await fetch(path, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return parseCSV(await r.text());
}

async function loadJSON(path) {
  const snap = snapshotText(path);
  if (snap !== null) return JSON.parse(snap);
  const r = await fetch(path, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

const rid = { N: 0, R: 1, SR: 2, UR: 3 };

// Legacy fallbacks. card-images-hq.js replaces the renderer with the verified
// generated/canonical image set after this script is loaded.
const CARD_IMAGES = {
  '001':[0,0],'002':[1,0],'003':[2,0],'004':[3,0],'005':[4,0],'006':[5,0],'007':[6,0],'008':[7,0],'009':[8,0],'010':[9,0],
  '011':[0,1],'013':[1,1],'014':[2,1],'015':[3,1],'016':[4,1],'017':[5,1],'020':[6,1],'021':[7,1],'022':[8,1],'023':[9,1],
  '025':[0,2],'026':[1,2],'028':[2,2],'030':[3,2],'031':[4,2],'033':[5,2],'034':[6,2],'035':[7,2],'036':[8,2],'039':[9,2],
  '045':[0,3],'062':[1,3],'063':[2,3],'064':[3,3],'067':[4,3],'069':[5,3],'071':[6,3],'074':[7,3],'076':[8,3],'079':[9,3],
  '084':[0,4],'094':[1,4],'100':[2,4],'102':[3,4],'111':[4,4],'113':[5,4],'124':[6,4],'131':[7,4],'150':[8,4],'157':[9,4]
};

const PACK_CROPS = {
  1:[0.175,0.265,0.208,0.142], 2:[0.396,0.265,0.208,0.142], 3:[0.617,0.265,0.208,0.142],
  4:[0.066,0.414,0.208,0.142], 5:[0.287,0.414,0.208,0.142], 6:[0.508,0.414,0.208,0.142], 7:[0.728,0.414,0.208,0.142],
  8:[0.175,0.563,0.208,0.142], 9:[0.396,0.563,0.208,0.142], 10:[0.617,0.563,0.208,0.142]
};
const PACK_SOURCES = {
  '001':['7037.png',7], '002':['7037.png',3], '003':['7041.png',3], '004':['7033.png',7], '005':['7032.png',2],
  '006':['7032.png',4], '007':['7033.png',6], '008':['7037.png',8], '009':['7032.png',1], '010':['7047.png',2],
  '011':['7032.png',6], '013':['7039.png',6], '014':['7039.png',1], '015':['7032.png',9], '016':['7037.png',5],
  '017':['7033.png',1], '020':['7044.png',8], '021':['7044.png',9], '022':['7032.png',7], '023':['7039.png',5],
  '025':['7037.png',6], '026':['7044.png',5], '030':['7032.png',5], '031':['7047.png',9], '034':['7044.png',2],
  '035':['7032.png',8], '036':['7041.png',5], '039':['7039.png',8], '045':['7039.png',9], '062':['7037.png',1],
  '063':['7037.png',4], '064':['7044.png',6], '067':['7041.png',10], '069':['7037.png',10], '071':['7044.png',4],
  '074':['7032.png',10], '076':['7044.png',3], '079':['7039.png',2], '084':['7039.png',4], '094':['7047.png',1],
  '100':['7033.png',8], '102':['7041.png',6], '111':['7044.png',10], '113':['7047.png',10], '124':['7033.png',10],
  '131':['7033.png',2], '150':['7037.png',2], '157':['7039.png',10]
};
const DETAIL_SOURCES = {
  '028':['7045.png',[0.10,0.19,0.80,0.57]],
  '033':['7046.png',[0.10,0.23,0.80,0.57]],
  '131':['7034.png',[0.10,0.19,0.80,0.57]],
  '150':['7038.png',[0.10,0.19,0.80,0.57]],
  '157':['7040.png',[0.10,0.19,0.80,0.57]]
};

let allCards = [], collection = new Map(), pulls = [], deckViews = new Map();
let cardViewMode = readViewMode();

function readViewMode() {
  try {
    const saved = localStorage.getItem('vn-card-view');
    return saved === 'detail' ? 'detail' : 'thumbnail';
  } catch (_) {
    return 'thumbnail';
  }
}

function saveViewMode(mode) {
  try { localStorage.setItem('vn-card-view', mode); } catch (_) {}
}

function padId(v) { return String(v).padStart(3, '0'); }
function typeLabel(card) {
  if (card?.type === 'ユニット') return 'ミニオン';
  if (card?.type === 'アーツ') return 'スペル';
  return '—';
}
function hasCardImage(id) {
  const key = padId(id);
  return Boolean(CARD_IMAGES[key] || PACK_SOURCES[key] || DETAIL_SOURCES[key]);
}

function cropImageTag(src, crop, z = 2) {
  const [x,y,w,h] = crop;
  const width = 100 / w;
  const height = 100 / h;
  const left = -(x / w) * 100;
  const top = -(y / h) * 100;
  return `<img src="${esc(src)}" alt="" aria-hidden="true" onerror="this.style.display='none'" style="position:absolute;z-index:${z};max-width:none;width:${width}%;height:${height}%;left:${left}%;top:${top}%;object-fit:fill">`;
}

function spriteImageTag(id) {
  const pos = CARD_IMAGES[padId(id)];
  if (!pos || !window.VN_CARD_SPRITE) return '';
  return `<img src="${window.VN_CARD_SPRITE}" alt="" aria-hidden="true" style="position:absolute;z-index:1;max-width:none;width:1000%;height:500%;left:-${pos[0] * 100}%;top:-${pos[1] * 100}%;object-fit:fill">`;
}

function cardArtHTML(id, size = 'thumb') {
  const key = padId(id);
  if (!hasCardImage(key) || (!window.VN_CARD_SPRITE && !PACK_SOURCES[key] && !DETAIL_SOURCES[key])) {
    return `<div class="card-art placeholder ${size}" aria-label="画像未登録">?</div>`;
  }
  let layers = spriteImageTag(key);
  const pack = PACK_SOURCES[key];
  if (pack) layers += cropImageTag(`../data/SS/${pack[0]}`, PACK_CROPS[pack[1]], 2);
  const detail = DETAIL_SOURCES[key];
  if ((size === 'detail' || size === 'original') && detail) layers += cropImageTag(`../data/SS/${detail[0]}`, detail[1], 3);
  return `<div class="card-art ${size}" aria-label="ゲーム内カード画像" style="position:relative;overflow:hidden">${layers}</div>`;
}

function renderSummary() {
  const owned = allCards.filter(c => c.count > 0);
  const sr = owned.filter(c => c.rarity === 'SR').length;
  const ur = owned.filter(c => c.rarity === 'UR').length;
  const totalCopies = owned.reduce((a, c) => a + c.count, 0);
  $('#summaryCards').innerHTML = [
    ['所持種類', `${owned.length} / ${allCards.length}`],
    ['SR / UR', `${sr} / ${ur}`],
    ['総所持枚数', totalCopies]
  ].map(([a, b]) => `<div class="summary-card"><span>${a}</span><b>${b}</b></div>`).join('');
  const verified = allCards.map(c => c.last_verified).filter(Boolean).sort().slice(-1)[0];
  const snapBuilt = window.VN_SNAPSHOT?.builtAt;
  $('#updatedText').textContent = verified
    ? `所持データ最終確認: ${verified.replace('T', ' ')}${snapBuilt ? ` / 表示生成: ${snapBuilt.replace('T', ' ')}` : ''}`
    : 'データ読込完了';
}

function filteredCards() {
  const q = $('#searchInput').value.trim().toLowerCase();
  const rar = $('#rarityFilter').value;
  const own = $('#ownedFilter').value;
  const type = $('#typeFilter').value;
  const sort = $('#sortSelect').value;
  const rows = allCards.filter(c =>
    (!q || [c.name, c.effect_text, c.keywords, c.card_id].join(' ').toLowerCase().includes(q)) &&
    (!rar || c.rarity === rar) &&
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
}

function cardTileHTML(c) {
  const unit = c.type === 'ユニット';
  const stats = unit ? `${esc(c.atk)}/${esc(c.hp)}` : '—';
  const ownedClass = c.count ? 'owned' : 'missing';
  return `<button class="card-tile card-trigger" type="button" data-card-id="${esc(c.card_id)}" aria-label="No.${esc(c.card_id)} ${esc(c.name)} の詳細を表示">
    <div class="tile-art-shell">
      ${cardArtHTML(c.card_id, 'gallery')}
      <div class="tile-topline">
        <span class="tile-no">No.${esc(c.card_id)}</span>
        <span class="rarity ${esc(c.rarity)}">${esc(c.rarity)}</span>
      </div>
      <span class="tile-owned ${ownedClass}">×${c.count}</span>
      <div class="tile-overlay" aria-hidden="true">
        <div class="tile-overlay-name">${esc(c.name)}</div>
        <div class="tile-stat-row">
          <span>${typeLabel(c)}</span><span>Cost ${esc(c.cost)}</span><span>${unit ? `ATK/HP ${stats}` : 'スペル'}</span>
        </div>
        <div class="tile-keywords">${esc(c.keywords || 'キーワードなし')}</div>
        <div class="tile-effect">${esc(c.effect_text || '効果未登録')}</div>
      </div>
    </div>
    <div class="tile-caption">
      <span class="tile-caption-name">${esc(c.name)}</span>
      <span class="tile-caption-meta">Cost ${esc(c.cost)}${unit ? ` · ${stats}` : ''}</span>
    </div>
  </button>`;
}

function cardRowHTML(c) {
  return `<tr class="clickable-row card-trigger" data-card-id="${esc(c.card_id)}" tabindex="0" title="クリックでカード詳細">
    <td>${cardArtHTML(c.card_id)}</td>
    <td>${esc(c.card_id)}</td>
    <td class="name">${esc(c.name)}</td>
    <td><span class="rarity ${esc(c.rarity)}">${esc(c.rarity)}</span></td>
    <td><span class="type-badge ${c.type === 'ユニット' ? 'minion' : 'spell'}">${typeLabel(c)}</span></td>
    <td>${esc(c.cost)}</td>
    <td>${c.type === 'ユニット' ? `${esc(c.atk)}/${esc(c.hp)}` : '—'}</td>
    <td class="${c.count ? 'owned' : 'missing'}">${c.count}</td>
    <td>${esc(c.keywords || '—')}</td>
    <td class="effect">${esc(c.effect_text)}</td>
  </tr>`;
}

function applyCardViewMode() {
  const gallery = $('#cardsGallery');
  const table = $('#cardsTableView');
  const thumbBtn = $('#thumbnailViewBtn');
  const detailBtn = $('#detailViewBtn');
  const thumbnail = cardViewMode === 'thumbnail';
  if (gallery) gallery.hidden = !thumbnail;
  if (table) table.hidden = thumbnail;
  if (thumbBtn) {
    thumbBtn.classList.toggle('active', thumbnail);
    thumbBtn.setAttribute('aria-pressed', thumbnail ? 'true' : 'false');
  }
  if (detailBtn) {
    detailBtn.classList.toggle('active', !thumbnail);
    detailBtn.setAttribute('aria-pressed', thumbnail ? 'false' : 'true');
  }
}

function setCardViewMode(mode) {
  cardViewMode = mode === 'detail' ? 'detail' : 'thumbnail';
  saveViewMode(cardViewMode);
  applyCardViewMode();
}

function filterCards() {
  const rows = filteredCards();
  const imageCount = allCards.filter(c => hasCardImage(c.card_id)).length;
  $('#cardCount').textContent = `${rows.length}枚表示 / 全${allCards.length}枚 / 画像登録 ${imageCount}枚`;
  $('#cardsGallery').innerHTML = rows.map(cardTileHTML).join('');
  $('#cardsBody').innerHTML = rows.map(cardRowHTML).join('');
  applyCardViewMode();
}

function curveHTML(deckRows) {
  const curve = {};
  deckRows.forEach(r => {
    const card = allCards.find(c => c.card_id === r.card_id);
    const cost = card?.cost === '' ? 'A' : card?.cost ?? '?';
    curve[cost] = (curve[cost] || 0) + Number(r.quantity);
  });
  const entries = Object.entries(curve).sort((a, b) => {
    if (a[0] === 'A') return 1;
    if (b[0] === 'A') return -1;
    return Number(a[0]) - Number(b[0]);
  });
  const max = Math.max(...entries.map(x => x[1]), 1);
  return entries.map(([cost, n]) => `<div class="curve-col"><div>${n}</div><div class="curve-bar" style="height:${Math.max(4, n / max * 48)}px"></div><div>${cost}</div></div>`).join('');
}

function sortDeckRows(rows, mode) {
  const sorted = [...rows];
  const byCost = (a, b) => {
    const ac = a.card?.cost === '' ? 99 : Number(a.card?.cost ?? 99);
    const bc = b.card?.cost === '' ? 99 : Number(b.card?.cost ?? 99);
    return ac - bc || a.card_id.localeCompare(b.card_id);
  };
  if (mode === 'cost') sorted.sort(byCost);
  else if (mode === 'rarity') sorted.sort((a, b) => (rid[b.card?.rarity] ?? -1) - (rid[a.card?.rarity] ?? -1) || byCost(a, b));
  else if (mode === 'type') sorted.sort((a, b) => typeLabel(a.card).localeCompare(typeLabel(b.card), 'ja') || byCost(a, b));
  else if (mode === 'id') sorted.sort((a, b) => a.card_id.localeCompare(b.card_id));
  else if (mode === 'name') sorted.sort((a, b) => (a.card?.name || a.name).localeCompare(b.card?.name || b.name, 'ja') || byCost(a, b));
  else sorted.sort((a, b) => a.order - b.order);
  return sorted;
}

function deckRowsHTML(rows) {
  return rows.map(r => {
    const c = r.card;
    const ok = r.have >= Number(r.quantity);
    const type = typeLabel(c);
    return `<tr class="clickable-row card-trigger" data-card-id="${r.card_id}" tabindex="0" title="クリックでカード詳細">
      <td>${cardArtHTML(r.card_id)}</td>
      <td>${r.card_id}</td>
      <td class="name">${esc(c?.name || r.name)}</td>
      <td><span class="rarity ${esc(c?.rarity || '')}">${esc(c?.rarity || '—')}</span></td>
      <td><span class="type-badge ${type === 'ミニオン' ? 'minion' : type === 'スペル' ? 'spell' : ''}">${type}</span></td>
      <td>${esc(r.quantity)}</td>
      <td class="${ok ? 'ready' : 'need'}">${r.have}</td>
      <td>${esc(c?.cost ?? '—')}</td>
      <td>${esc(r.role)}</td>
      <td class="effect">${esc(r.notes)}</td>
    </tr>`;
  }).join('');
}

function rerenderDeckRows(deckId, mode) {
  const state = deckViews.get(deckId);
  if (!state) return;
  const body = document.querySelector(`[data-deck-body="${deckId}"]`);
  if (!body) return;
  body.innerHTML = deckRowsHTML(sortDeckRows(state.rows, mode));
}

async function renderDecks() {
  const metas = await loadJSON('decks.json');
  const cards = [];
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
    const total = rows.reduce((a, r) => a + Number(r.quantity), 0);
    const shortages = rows.filter(r => r.need);
    const ready = !shortages.length;
    deckViews.set(meta.id, { rows, meta });
    cards.push(`<article class="deck-card">
      <div class="deck-head"><div>
        <div class="deck-title">${esc(meta.title)}</div>
        <div class="deck-meta">
          <span class="pill">${esc(meta.status)}</span><span class="pill">${esc(meta.target)}</span>
          <span class="pill ${ready ? 'good' : ''}">${ready ? '現在の所持で構築可能' : `不足 ${shortages.reduce((a, r) => a + r.need, 0)}枚`}</span>
        </div>
        <div class="deck-summary">${esc(meta.summary)}</div>
      </div><div class="deck-score"><span class="muted">構築確度</span><b>${esc(meta.confidence)}</b><span>${total} cards</span></div></div>
      <div class="deck-body">
        <div class="deck-curve">${curveHTML(rows)}</div>
        <div class="deck-tools"><label>並び順<select class="deck-sort" data-deck-id="${esc(meta.id)}">
          <option value="recommended">推奨順</option><option value="cost">コスト順</option><option value="rarity">レアリティ順</option>
          <option value="type">ミニオン / スペル順</option><option value="id">No.順</option><option value="name">名前順</option>
        </select></label></div>
        <div class="table-wrap"><table class="deck-table">
          <thead><tr><th>画像</th><th>No.</th><th>カード</th><th>Rarity</th><th>種別</th><th>枚数</th><th>所持</th><th>Cost</th><th>役割</th><th>意図</th></tr></thead>
          <tbody data-deck-body="${esc(meta.id)}">${deckRowsHTML(rows)}</tbody>
        </table></div>
      </div>
    </article>`);
  }
  $('#decksContainer').innerHTML = cards.join('');
  $$('.deck-sort').forEach(select => select.addEventListener('change', () => rerenderDeckRows(select.dataset.deckId, select.value)));
}

function renderPulls() {
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
  pulls.forEach(p => rarity[p.rarity]++);
  const newTotal = gs.reduce((a, g) => a + g.newCount, 0);
  const dust = gs.reduce((a, g) => a + g.dust, 0);
  $('#pullStats').innerHTML = [
    ['記録10連', gs.length], ['総カード', pulls.length], ['SR / UR', `${rarity.SR} / ${rarity.UR}`], ['NEW', newTotal], ['確認Dust', dust]
  ].map(([a,b]) => `<div class="stat-card"><span>${a}</span><b>${b}</b></div>`).join('');
  $('#pullsBody').innerHTML = gs.map(g => `<tr><td>${esc(g.id)}</td><td>${esc(g.at.replace('T',' '))}</td><td>${g.N}</td><td>${g.R}</td><td>${g.SR}</td><td>${g.UR}</td><td>${g.newCount}</td><td>${g.dust}</td></tr>`).join('');
}

function modalSourceLabel(cardId) {
  if (typeof window.VN_CARD_IMAGE_SOURCE === 'function') {
    const info = window.VN_CARD_IMAGE_SOURCE(cardId);
    if (info?.label) return info.label;
  }
  const key = padId(cardId);
  if (DETAIL_SOURCES[key]) return 'ゲーム内カード詳細スクリーンショット由来';
  if (PACK_SOURCES[key]) return 'ゲーム内開封結果スクリーンショット由来';
  if (CARD_IMAGES[key]) return 'ゲーム内スクリーンショット由来（フォールバック）';
  return '画像未登録';
}

function openCardModal(cardId) {
  const c = allCards.find(x => x.card_id === padId(cardId));
  if (!c) return;
  const modal = $('#cardModal');
  const stats = c.type === 'ユニット' ? `${esc(c.atk)}/${esc(c.hp)}` : '—';
  $('#cardModalBody').innerHTML = `<div class="modal-card-grid">
    <div class="modal-art-wrap rarity-${esc(c.rarity)}">
      <div class="modal-art-label">元画像</div>
      ${cardArtHTML(c.card_id, 'original')}
      <div class="image-note">${esc(modalSourceLabel(c.card_id))}</div>
    </div>
    <div class="modal-info">
      <div class="modal-kicker">No.${esc(c.card_id)} <span class="rarity ${esc(c.rarity)}">${esc(c.rarity)}</span></div>
      <h2>${esc(c.name)}</h2>
      <div class="modal-tags">
        <span class="type-badge ${c.type === 'ユニット' ? 'minion' : 'spell'}">${typeLabel(c)}</span>
        <span>Cost ${esc(c.cost)}</span><span>ATK/HP ${stats}</span><span class="${c.count ? 'owned' : 'missing'}">所持 ${c.count}</span>
      </div>
      <dl class="card-details">
        <dt>キーワード</dt><dd>${esc(c.keywords || '—')}</dd>
        <dt>効果</dt><dd>${esc(c.effect_text || '—')}</dd>
        <dt>最終確認</dt><dd>${esc(c.last_verified || '—')}</dd>
      </dl>
    </div>
  </div>`;
  modal.hidden = false;
  document.body.classList.add('modal-open');
  $('.modal-close')?.focus();
}

function closeCardModal() {
  const modal = $('#cardModal');
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  document.body.classList.remove('modal-open');
}

function setupCardInteractions() {
  document.addEventListener('click', e => {
    const trigger = e.target.closest('.card-trigger[data-card-id]');
    if (trigger) openCardModal(trigger.dataset.cardId);
    if (e.target.closest('[data-modal-close]')) closeCardModal();
  });
  document.addEventListener('keydown', e => {
    const trigger = e.target.closest?.('.card-trigger[data-card-id]');
    if (trigger && trigger.tagName !== 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      openCardModal(trigger.dataset.cardId);
    }
    if (e.key === 'Escape') closeCardModal();
  });
}

function setupTabs() {
  $$('.tab').forEach(b => b.addEventListener('click', () => {
    $$('.tab').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    $$('.panel').forEach(x => x.classList.remove('active'));
    $(`#${b.dataset.tab}Panel`).classList.add('active');
  }));
}

function setupViewSwitch() {
  $('#thumbnailViewBtn').addEventListener('click', () => setCardViewMode('thumbnail'));
  $('#detailViewBtn').addEventListener('click', () => setCardViewMode('detail'));
  applyCardViewMode();
}

async function init() {
  try {
    if (!window.VN_SNAPSHOT && location.protocol === 'file:') throw new Error('snapshot.js がありません。start-dashboard.cmd を実行してください。');
    const [cards, owned, pullRows] = await Promise.all([
      loadCSV('../data/cards.csv'), loadCSV('../data/collection.csv'), loadCSV('../data/pulls.csv')
    ]);
    collection = new Map(owned.map(x => [padId(x.card_id), { ...x, count:Number(x.count || 0) }]));
    allCards = cards.map(c => {
      const id = padId(c.card_id), o = collection.get(id);
      return { ...c, card_id:id, count:o?.count || 0, last_verified:o?.last_verified || c.last_verified };
    });
    pulls = pullRows;
    renderSummary();
    filterCards();
    renderPulls();
    await renderDecks();
    ['searchInput','rarityFilter','ownedFilter','typeFilter','sortSelect'].forEach(id =>
      $('#' + id).addEventListener(id === 'searchInput' ? 'input' : 'change', filterCards)
    );
    setupViewSwitch();
    setupTabs();
    setupCardInteractions();
  } catch (e) {
    console.error(e);
    document.querySelector('main').innerHTML = `<div class="error"><b>データを読み込めませんでした。</b><br>${esc(e.message)}<br><br>dashboard/start-dashboard.cmd から起動してください。</div>`;
  }
}

init();
