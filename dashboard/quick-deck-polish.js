// Presentation layer for the browser-local quick deck.
// Keeps the existing storage/interaction model intact, but renders the right
// sidebar in Cost order with cropped card art behind each row.
(function () {
  let scheduled = false;
  let observing = false;

  function getCard(id) {
    try {
      if (typeof allCards !== 'undefined' && Array.isArray(allCards)) {
        return allCards.find(c => c.card_id === String(id).padStart(3, '0')) || null;
      }
    } catch (_) {}
    return null;
  }

  function cardCost(card) {
    const raw = card?.cost;
    if (raw === '' || raw === null || raw === undefined) return 99;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 99;
  }

  function rarityClass(card) {
    const r = String(card?.rarity || 'N').replace(/[^A-Z]/g, '');
    return `rarity-${r || 'N'}`;
  }

  function ensureRowArt(row) {
    const id = row.dataset.cardId;
    const card = getCard(id);
    row.classList.remove('rarity-N', 'rarity-R', 'rarity-SR', 'rarity-UR');
    row.classList.add(rarityClass(card));

    row.querySelector('.quick-deck-thumb')?.remove();
    let art = row.querySelector('.quick-deck-row-art');
    if (!art) {
      art = document.createElement('div');
      art.className = 'quick-deck-row-art';
      try {
        if (typeof cardArtHTML === 'function') art.innerHTML = cardArtHTML(id, 'thumb');
      } catch (_) {}
      row.prepend(art);
    }
  }

  function sortRowsByCost(list) {
    const rows = [...list.querySelectorAll('.quick-deck-row[data-card-id]')];
    if (rows.length < 2) return;
    const sorted = [...rows].sort((a, b) => {
      const ac = getCard(a.dataset.cardId);
      const bc = getCard(b.dataset.cardId);
      return cardCost(ac) - cardCost(bc) || String(a.dataset.cardId).localeCompare(String(b.dataset.cardId));
    });
    if (rows.every((row, i) => row === sorted[i])) return;
    const frag = document.createDocumentFragment();
    sorted.forEach(row => frag.appendChild(row));
    list.appendChild(frag);
  }

  function polish() {
    scheduled = false;
    const list = document.querySelector('#quickDeckList');
    if (!list) return;
    list.querySelectorAll('.quick-deck-row[data-card-id]').forEach(ensureRowArt);
    sortRowsByCost(list);

    const foot = document.querySelector('.quick-deck-foot span:last-child');
    if (foot) foot.textContent = 'Cost順 / ＋ − で枚数変更';
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(polish);
  }

  function start() {
    const list = document.querySelector('#quickDeckList');
    if (!list) return false;
    if (!observing) {
      observing = true;
      new MutationObserver(schedule).observe(list, { childList: true });
    }
    schedule();
    setTimeout(schedule, 120);
    setTimeout(schedule, 500);
    return true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (!start()) setTimeout(start, 60);
    }, { once: true });
  } else if (!start()) {
    setTimeout(start, 60);
  }
})();

// Deck workflow stage 1:
// - Card list remains the actual deck-building workspace.
// - The old "デッキ構築" tab becomes a saved-deck list.
// - The quick-deck primary action saves a browser-local copy, clears the draft,
//   then opens the saved-deck list.
// - Draft cards shown on the list tab get an explicit Cost badge.
(function () {
  const SAVED_KEY = 'vn-saved-decks-v1';
  const DRAFT_NAME_KEY = 'vn-quick-deck-name-v1';
  const DRAFT_COMMENT_KEY = 'vn-quick-deck-comment-v1';
  const MAX_DECK = 30;
  let draftObserver = null;
  let quickObserver = null;

  const styleText = `
    .saved-deck-library{margin:0 0 10px;border:1px solid var(--line,#29304a);border-radius:10px;background:rgba(13,19,37,.72);overflow:hidden}
    .saved-deck-library-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 12px;border-bottom:1px solid var(--line,#29304a);background:rgba(104,69,190,.13)}
    .saved-deck-library-head strong{font-size:14px}.saved-deck-library-head span{font-size:11px;color:var(--muted,#8f9ab7)}
    .saved-deck-empty{padding:18px 14px;color:var(--muted,#8f9ab7);font-size:12px}
    .saved-deck-card{position:relative}.saved-deck-card.saved-highlight{outline:2px solid #a868ff;outline-offset:-2px}
    .saved-deck-card .deck-compact-summary{white-space:normal}
    .saved-deck-card .deck-card-actions button[data-saved-action="edit"]{border-color:#5684c8}
    .saved-deck-card .deck-card-actions button[data-saved-action="delete"]{border-color:#7b3b48;color:#f0a5b0}
    .draft-mini-card{position:relative}
    .draft-card-cost{position:absolute;left:3px;top:3px;z-index:8;min-width:18px;height:18px;padding:0 4px;display:grid;place-items:center;border-radius:5px;background:rgba(5,12,24,.92);border:1px solid rgba(116,231,255,.65);color:#eefaff;font-size:10px;font-weight:800;line-height:1;box-shadow:0 1px 4px rgba(0,0,0,.5);pointer-events:none}
    #quickDeckOpen:disabled{opacity:.45;cursor:not-allowed}
  `;

  function ensureStyle() {
    if (document.querySelector('#vnDeckWorkflowStage1Style')) return;
    const style = document.createElement('style');
    style.id = 'vnDeckWorkflowStage1Style';
    style.textContent = styleText;
    document.head.appendChild(style);
  }

  function padId(value) { return String(value || '').padStart(3, '0'); }
  function getCard(id) {
    try { return Array.isArray(allCards) ? allCards.find(card => card.card_id === padId(id)) || null : null; }
    catch (_) { return null; }
  }
  function costOf(id) {
    const raw = getCard(id)?.cost;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 99;
  }
  function escapeText(value) {
    try { return typeof esc === 'function' ? esc(value ?? '') : String(value ?? ''); }
    catch (_) { return String(value ?? ''); }
  }

  function normalizeCards(items) {
    const map = new Map();
    for (const raw of Array.isArray(items) ? items : []) {
      const id = padId(raw?.id);
      if (!/^\d{3,}$/.test(id)) continue;
      const qty = Math.max(1, Math.min(3, Math.round(Number(raw?.qty || 1))));
      map.set(id, Math.min(3, (map.get(id) || 0) + qty));
    }
    let total = 0;
    const out = [];
    for (const [id, qtyRaw] of map) {
      const qty = Math.min(qtyRaw, Math.max(0, MAX_DECK - total));
      if (qty > 0) out.push({ id, qty });
      total += qty;
      if (total >= MAX_DECK) break;
    }
    return out;
  }

  function loadSaved() {
    try {
      const raw = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
      if (!Array.isArray(raw)) return [];
      return raw.map((entry, index) => ({
        id: String(entry?.id || `legacy-${index}`),
        title: String(entry?.title || `デッキ ${index + 1}`),
        createdAt: String(entry?.createdAt || ''),
        updatedAt: String(entry?.updatedAt || entry?.createdAt || ''),
        cards: normalizeCards(entry?.cards)
      })).filter(entry => entry.cards.length);
    } catch (_) { return []; }
  }

  function saveSaved(entries) {
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(entries)); } catch (_) {}
  }

  function nextDeckTitle(entries) {
    let max = 0;
    for (const entry of entries) {
      const m = String(entry.title || '').match(/^デッキ\s*(\d+)$/);
      if (m) max = Math.max(max, Number(m[1]) || 0);
    }
    return `デッキ ${max + 1}`;
  }

  function currentDraftTitle(entries) {
    try {
      const name = (localStorage.getItem(DRAFT_NAME_KEY) || '').trim();
      if (name && name !== '作成中デッキ') return name;
    } catch (_) {}
    return nextDeckTitle(entries);
  }

  function draftItems() {
    try { return normalizeCards(window.VN_QUICK_DECK?.get?.() || []); }
    catch (_) { return []; }
  }

  function totalCards(cards) { return cards.reduce((sum, item) => sum + Number(item.qty || 0), 0); }

  function tabLabel() {
    const tab = document.querySelector('.tab[data-tab="decks"]');
    if (tab && tab.textContent !== 'デッキ一覧') tab.textContent = 'デッキ一覧';
  }

  function patchSaveButton() {
    const button = document.querySelector('#quickDeckOpen');
    if (!button) return;
    if (button.textContent !== '保存') button.textContent = '保存';
    button.title = '作成中デッキをこのブラウザに保存';
    button.disabled = draftItems().length === 0;
  }

  function cardCopyHtml(id, missing) {
    const card = getCard(id);
    const rarity = String(card?.rarity || 'N').replace(/[^A-Z]/g, '') || 'N';
    let art = '<div class="card-art gallery placeholder">?</div>';
    try { if (typeof cardArtHTML === 'function') art = cardArtHTML(id, 'gallery'); } catch (_) {}
    return `<button class="deck-copy-card card-trigger rarity-${rarity}${missing ? ' missing-copy' : ''}" type="button" data-card-id="${escapeText(id)}" title="${escapeText(card?.name || `No.${id}`)} / Cost ${escapeText(card?.cost ?? '—')}">${art}<span class="deck-copy-cost">${escapeText(card?.cost ?? '—')}</span></button>`;
  }

  function savedDeckHtml(entry) {
    const sorted = [...entry.cards].sort((a, b) => costOf(a.id) - costOf(b.id) || a.id.localeCompare(b.id));
    const copies = [];
    let shortage = 0;
    for (const item of sorted) {
      const have = Number(getCard(item.id)?.count || 0);
      shortage += Math.max(0, item.qty - have);
      for (let i = 0; i < item.qty; i++) copies.push(cardCopyHtml(item.id, i >= have));
    }
    const total = totalCards(entry.cards);
    const completeness = total === MAX_DECK ? '30 / 30枚' : `${total} / 30枚`;
    return `<article class="deck-compact-card saved-deck-card" data-saved-deck-id="${escapeText(entry.id)}">
      <div class="deck-compact-head">
        <div class="deck-compact-copy">
          <div class="deck-compact-title">${escapeText(entry.title)}</div>
          <div class="deck-compact-summary">このブラウザに保存したデッキ</div>
          <div class="deck-compact-flags"><span class="pill">保存デッキ</span><span class="pill ${total === MAX_DECK ? 'good' : ''}">${completeness}</span><span class="pill ${shortage ? '' : 'good'}">${shortage ? `所持不足 ${shortage}` : '構築可能'}</span></div>
        </div>
        <div class="deck-card-actions">
          <button type="button" data-saved-action="edit" data-saved-id="${escapeText(entry.id)}">編集</button>
          <button type="button" data-saved-action="delete" data-saved-id="${escapeText(entry.id)}">削除</button>
        </div>
      </div>
      <div class="deck-copy-grid">${copies.join('')}</div>
    </article>`;
  }

  function ensureLibrary() {
    const panel = document.querySelector('#decksPanel');
    if (!panel) return null;
    let library = panel.querySelector('#savedDeckLibrary');
    if (!library) {
      library = document.createElement('section');
      library.id = 'savedDeckLibrary';
      library.className = 'saved-deck-library';
      const intro = panel.querySelector('.deck-intro');
      if (intro) intro.before(library);
      else panel.prepend(library);
    }
    return library;
  }

  function renderSavedDecks(highlightId = '') {
    const library = ensureLibrary();
    if (!library) return;
    const entries = loadSaved();
    library.innerHTML = `<div class="saved-deck-library-head"><strong>保存デッキ</strong><span>${entries.length}件 / このブラウザに保存</span></div>${entries.length ? `<div class="saved-deck-list">${entries.map(savedDeckHtml).join('')}</div>` : '<div class="saved-deck-empty">まだ保存されたデッキはありません。カード一覧で作成中デッキを組み、「保存」を押すとここに追加されます。</div>'}`;
    if (highlightId) {
      const card = library.querySelector(`[data-saved-deck-id="${CSS.escape(highlightId)}"]`);
      if (card) {
        card.classList.add('saved-highlight');
        setTimeout(() => card.classList.remove('saved-highlight'), 1600);
        requestAnimationFrame(() => card.scrollIntoView({ behavior:'smooth', block:'nearest' }));
      }
    }
  }

  function decorateDraftCosts() {
    document.querySelectorAll('#draftDeckPanel .draft-mini-card[data-card-id]').forEach(button => {
      if (button.querySelector('.draft-card-cost')) return;
      const badge = document.createElement('span');
      badge.className = 'draft-card-cost';
      badge.textContent = String(getCard(button.dataset.cardId)?.cost ?? '—');
      button.appendChild(badge);
    });
  }

  function clearDraftMetadata() {
    try {
      localStorage.removeItem(DRAFT_NAME_KEY);
      localStorage.removeItem(DRAFT_COMMENT_KEY);
    } catch (_) {}
  }

  function saveCurrentDraft() {
    const cards = draftItems();
    if (!cards.length) return;
    const entries = loadSaved();
    const now = new Date().toISOString();
    const entry = {
      id: `saved-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: currentDraftTitle(entries),
      createdAt: now,
      updatedAt: now,
      cards
    };
    entries.unshift(entry);
    saveSaved(entries);
    try { window.VN_QUICK_DECK?.clear?.(); } catch (_) {}
    clearDraftMetadata();
    patchSaveButton();
    renderSavedDecks(entry.id);
    document.querySelector('.tab[data-tab="decks"]')?.click();
  }

  function editSavedDeck(id) {
    const entry = loadSaved().find(deck => deck.id === id);
    if (!entry || !window.VN_QUICK_DECK) return;
    window.VN_QUICK_DECK.clear();
    entry.cards.forEach(item => window.VN_QUICK_DECK.add(item.id, item.qty));
    try { localStorage.setItem(DRAFT_NAME_KEY, entry.title); } catch (_) {}
    patchSaveButton();
    document.querySelector('.tab[data-tab="cards"]')?.click();
  }

  function deleteSavedDeck(id) {
    const entries = loadSaved();
    const target = entries.find(deck => deck.id === id);
    if (!target) return;
    if (!window.confirm(`「${target.title}」を削除しますか？`)) return;
    saveSaved(entries.filter(deck => deck.id !== id));
    renderSavedDecks();
  }

  function installObservers() {
    const draft = document.querySelector('#draftDeckPanel');
    if (draft && !draftObserver) {
      draftObserver = new MutationObserver(() => requestAnimationFrame(decorateDraftCosts));
      draftObserver.observe(draft, { childList:true, subtree:true, attributes:true, attributeFilter:['hidden'] });
    }
    const quick = document.querySelector('#quickDeckList');
    if (quick && !quickObserver) {
      quickObserver = new MutationObserver(() => requestAnimationFrame(patchSaveButton));
      quickObserver.observe(quick, { childList:true, subtree:true });
    }
  }

  document.addEventListener('click', e => {
    const save = e.target.closest?.('#quickDeckOpen');
    if (!save) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!save.disabled) saveCurrentDraft();
  }, true);

  document.addEventListener('click', e => {
    const action = e.target.closest?.('[data-saved-action][data-saved-id]');
    if (!action) return;
    e.preventDefault();
    e.stopPropagation();
    if (action.dataset.savedAction === 'edit') editSavedDeck(action.dataset.savedId);
    if (action.dataset.savedAction === 'delete') deleteSavedDeck(action.dataset.savedId);
  }, true);

  function install() {
    ensureStyle();
    tabLabel();
    patchSaveButton();
    renderSavedDecks();
    decorateDraftCosts();
    installObservers();

    let tries = 0;
    const settle = () => {
      tabLabel();
      patchSaveButton();
      renderSavedDecks();
      decorateDraftCosts();
      installObservers();
      if (++tries < 8) setTimeout(settle, 100);
    };
    settle();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();

  window.VN_SAVED_DECKS = {
    list: () => loadSaved().map(deck => ({ ...deck, cards:deck.cards.map(card => ({ ...card })) })),
    saveDraft: saveCurrentDraft,
    render: renderSavedDecks
  };
})();
