// Persistent quick deck builder layered on top of the read-only canonical data.
// This never writes data/*.csv or decks/*.csv; it is browser-local working state.
(function () {
  const STORAGE_KEY = 'vn-quick-deck-v1';
  const MAX_DECK = 30;
  const MAX_COPIES = 3; // 4 copies or more are not allowed.
  let draft = loadDraft();
  let galleryObserver = null;

  function normalizeDraft(items) {
    const merged = [];
    const byId = new Map();
    for (const raw of Array.isArray(items) ? items : []) {
      const id = String(raw?.id || '').padStart(3, '0');
      if (!/^\d{3,}$/.test(id)) continue;
      const qty = Math.max(1, Math.min(MAX_COPIES, Number(raw?.qty || 1)));
      if (byId.has(id)) {
        byId.get(id).qty = Math.min(MAX_COPIES, byId.get(id).qty + qty);
      } else {
        const item = { id, qty };
        byId.set(id, item);
        merged.push(item);
      }
    }
    let total = merged.reduce((sum, x) => sum + x.qty, 0);
    for (let i = merged.length - 1; i >= 0 && total > MAX_DECK; i--) {
      const cut = Math.min(merged[i].qty, total - MAX_DECK);
      merged[i].qty -= cut;
      total -= cut;
    }
    return merged.filter(x => x.qty > 0);
  }

  function loadDraft() {
    try {
      return normalizeDraft(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
    } catch (_) {
      return [];
    }
  }

  function saveDraft() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(draft)); } catch (_) {}
  }

  function cardById(id) {
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

  function sortedDraft() {
    return [...draft].sort((a, b) => {
      const ac = cardById(a.id), bc = cardById(b.id);
      return cardCost(ac) - cardCost(bc) || a.id.localeCompare(b.id);
    });
  }

  function totalCards() {
    return draft.reduce((sum, x) => sum + Number(x.qty || 0), 0);
  }

  function canAdd(id) {
    id = String(id).padStart(3, '0');
    const item = draft.find(x => x.id === id);
    return totalCards() < MAX_DECK && (!item || item.qty < MAX_COPIES);
  }

  function addCard(id, amount = 1) {
    id = String(id).padStart(3, '0');
    if (!canAdd(id)) return false;
    const roomDeck = MAX_DECK - totalCards();
    const existing = draft.find(x => x.id === id);
    const roomCard = MAX_COPIES - (existing?.qty || 0);
    const add = Math.max(0, Math.min(Number(amount || 1), roomDeck, roomCard));
    if (!add) return false;
    if (existing) existing.qty += add;
    else draft.push({ id, qty: add });
    commitDraft();
    return true;
  }

  function changeQty(id, delta) {
    id = String(id).padStart(3, '0');
    const item = draft.find(x => x.id === id);
    if (!item) return false;
    if (delta > 0) return addCard(id, delta);
    item.qty += Number(delta || -1);
    if (item.qty <= 0) draft = draft.filter(x => x.id !== id);
    commitDraft();
    return true;
  }

  function removeCard(id) {
    id = String(id).padStart(3, '0');
    const before = draft.length;
    draft = draft.filter(x => x.id !== id);
    if (draft.length !== before) commitDraft();
  }

  function commitDraft() {
    draft = normalizeDraft(draft);
    saveDraft();
    renderQuickDeck();
    renderDraftDeckPanel();
    decorateGallery();
  }

  function cardThumb(id, size = 'thumb') {
    try {
      if (typeof cardArtHTML === 'function') return cardArtHTML(id, size);
    } catch (_) {}
    return `<div class="card-art ${size} placeholder">?</div>`;
  }

  function rarityClass(card) {
    const r = String(card?.rarity || 'N').replace(/[^A-Z]/g, '');
    return `rarity-${r || 'N'}`;
  }

  function quickDeckRow(item) {
    const c = cardById(item.id);
    const have = Number(c?.count || 0);
    const shortage = Math.max(0, item.qty - have);
    const plusDisabled = item.qty >= MAX_COPIES || totalCards() >= MAX_DECK;
    return `<div class="quick-deck-row ${rarityClass(c)}" draggable="true" data-card-id="${item.id}">
      <div class="quick-deck-row-art">${cardThumb(item.id)}</div>
      <div class="quick-deck-text">
        <div class="quick-deck-name">${typeof esc === 'function' ? esc(c?.name || `No.${item.id}`) : (c?.name || `No.${item.id}`)}</div>
        <div class="quick-deck-meta ${shortage ? 'need' : ''}">Cost ${c?.cost ?? '—'} · 所持 ${have}${shortage ? ` · 不足 ${shortage}` : ''}</div>
      </div>
      <div class="quick-deck-controls">
        <button type="button" draggable="false" data-qdeck-action="dec" data-card-id="${item.id}" aria-label="1枚減らす">−</button>
        <span class="quick-deck-qty">${item.qty}</span>
        <button type="button" draggable="false" data-qdeck-action="inc" data-card-id="${item.id}" aria-label="1枚増やす" ${plusDisabled ? 'disabled' : ''}>＋</button>
      </div>
    </div>`;
  }

  function renderQuickDeck() {
    const list = document.querySelector('#quickDeckList');
    const count = document.querySelector('#quickDeckCount');
    const unique = document.querySelector('#quickDeckUnique');
    if (!list || !count || !unique) return;
    count.textContent = `${totalCards()} / ${MAX_DECK}枚`;
    unique.textContent = `${draft.length}種`;
    list.innerHTML = draft.length
      ? sortedDraft().map(quickDeckRow).join('')
      : '<div class="quick-deck-empty">カード左下の＋で追加<br>またはカードをここへD&amp;D</div>';
  }

  function draftCopies() {
    const copies = [];
    for (const item of sortedDraft()) {
      const c = cardById(item.id);
      const have = Number(c?.count || 0);
      for (let i = 0; i < item.qty; i++) copies.push({ item, card:c, missing:i >= have });
    }
    return copies;
  }

  function renderDraftDeckPanel() {
    const panel = document.querySelector('#draftDeckPanel');
    if (!panel) return;
    if (!draft.length) {
      panel.hidden = true;
      panel.innerHTML = '';
      return;
    }
    const shortage = draft.reduce((sum, item) => {
      const c = cardById(item.id);
      return sum + Math.max(0, item.qty - Number(c?.count || 0));
    }, 0);
    const copies = draftCopies();
    panel.hidden = false;
    panel.innerHTML = `<div class="draft-compact-head">
      <div><strong>作成中デッキ</strong><span>${draft.length}種 / ${totalCards()}枚</span></div>
      <span class="${shortage ? 'need' : 'ready'}">${shortage ? `不足 ${shortage}枚` : '構築可能'}</span>
    </div>
    <div class="draft-mini-grid">${copies.map(x => `<button class="draft-mini-card card-trigger ${rarityClass(x.card)} ${x.missing ? 'missing-copy' : ''}" type="button" data-card-id="${x.item.id}" title="${typeof esc === 'function' ? esc(x.card?.name || x.item.id) : (x.card?.name || x.item.id)}">${cardThumb(x.item.id, 'gallery')}</button>`).join('')}</div>`;
  }

  function decorateGallery() {
    const gallery = document.querySelector('#cardsGallery');
    if (!gallery) return;
    const totalFull = totalCards() >= MAX_DECK;
    gallery.querySelectorAll('.card-tile[data-card-id]').forEach(tile => {
      tile.draggable = true;
      const shell = tile.querySelector('.tile-art-shell');
      if (!shell) return;
      let add = shell.querySelector('.tile-add-btn');
      if (!add) {
        add = document.createElement('span');
        add.className = 'tile-add-btn';
        add.setAttribute('role', 'button');
        add.setAttribute('tabindex', '0');
        add.setAttribute('aria-label', 'デッキに追加');
        add.dataset.cardId = tile.dataset.cardId;
        add.textContent = '+';
        shell.appendChild(add);
      }
      const item = draft.find(x => x.id === tile.dataset.cardId);
      const blocked = totalFull || (item?.qty || 0) >= MAX_COPIES;
      add.classList.toggle('limit-reached', blocked);
      add.setAttribute('aria-disabled', blocked ? 'true' : 'false');
      add.title = blocked ? ((item?.qty || 0) >= MAX_COPIES ? '同一カードは3枚まで' : 'デッキは30枚まで') : 'デッキに追加';
    });
  }

  function setupGalleryObserver() {
    const gallery = document.querySelector('#cardsGallery');
    if (!gallery) return;
    if (galleryObserver) galleryObserver.disconnect();
    galleryObserver = new MutationObserver(() => decorateGallery());
    galleryObserver.observe(gallery, { childList:true });
    decorateGallery();
  }

  function openDeckTab() {
    renderDraftDeckPanel();
    document.querySelector('.tab[data-tab="decks"]')?.click();
  }

  document.addEventListener('click', e => {
    const add = e.target.closest?.('.tile-add-btn[data-card-id]');
    if (add) {
      e.preventDefault();
      e.stopPropagation();
      if (add.getAttribute('aria-disabled') !== 'true') addCard(add.dataset.cardId);
      return;
    }
  }, true);

  document.addEventListener('keydown', e => {
    const add = e.target.closest?.('.tile-add-btn[data-card-id]');
    if (add && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      e.stopPropagation();
      if (add.getAttribute('aria-disabled') !== 'true') addCard(add.dataset.cardId);
    }
  }, true);

  document.addEventListener('click', e => {
    const action = e.target.closest?.('[data-qdeck-action]');
    if (action) {
      if (action.dataset.qdeckAction === 'inc' && !action.disabled) changeQty(action.dataset.cardId, 1);
      if (action.dataset.qdeckAction === 'dec') changeQty(action.dataset.cardId, -1);
      return;
    }
    if (e.target.closest?.('#quickDeckOpen')) openDeckTab();
    if (e.target.closest?.('#quickDeckClear')) {
      if (!draft.length || window.confirm('作成中デッキをクリアしますか？')) {
        draft = [];
        commitDraft();
      }
    }
  });

  document.addEventListener('dragstart', e => {
    const tile = e.target.closest?.('.card-tile[data-card-id]');
    if (tile && !e.target.closest('.tile-add-btn')) {
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('application/x-vn-card', tile.dataset.cardId);
      e.dataTransfer.setData('text/plain', tile.dataset.cardId);
      tile.classList.add('dragging-card');
      return;
    }
    const row = e.target.closest?.('.quick-deck-row[data-card-id]');
    if (row && !e.target.closest('button')) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('application/x-vn-deck-card', row.dataset.cardId);
      row.classList.add('dragging');
    }
  });

  document.addEventListener('dragend', e => {
    e.target.closest?.('.card-tile')?.classList.remove('dragging-card');
    e.target.closest?.('.quick-deck-row')?.classList.remove('dragging');
    document.querySelectorAll('.deck-drop-active,.trash-active').forEach(x => x.classList.remove('deck-drop-active','trash-active'));
  });

  const quickDeck = document.querySelector('#quickDeck');
  const quickDeckList = document.querySelector('#quickDeckList');
  const trash = document.querySelector('#quickDeckTrash');

  quickDeck?.addEventListener('dragover', e => {
    if (e.dataTransfer.types.includes('application/x-vn-card')) {
      e.preventDefault();
      quickDeck.classList.add('deck-drop-active');
    }
  });
  quickDeck?.addEventListener('dragleave', e => {
    if (!quickDeck.contains(e.relatedTarget)) quickDeck.classList.remove('deck-drop-active');
  });

  quickDeckList?.addEventListener('dragover', e => {
    if (!e.dataTransfer.types.includes('application/x-vn-card')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  quickDeckList?.addEventListener('drop', e => {
    e.preventDefault();
    quickDeck?.classList.remove('deck-drop-active');
    const cardId = e.dataTransfer.getData('application/x-vn-card');
    if (cardId) addCard(cardId);
  });

  trash?.addEventListener('dragover', e => {
    if (!e.dataTransfer.types.includes('application/x-vn-deck-card')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    trash.classList.add('trash-active');
  });
  trash?.addEventListener('dragleave', () => trash.classList.remove('trash-active'));
  trash?.addEventListener('drop', e => {
    e.preventDefault();
    trash.classList.remove('trash-active');
    const id = e.dataTransfer.getData('application/x-vn-deck-card');
    if (id) removeCard(id);
  });

  function startWhenReady() {
    const ready = document.querySelector('#cardsGallery') && document.querySelector('#quickDeckList');
    if (!ready) return false;
    setupGalleryObserver();
    commitDraft();
    return true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (!startWhenReady()) setTimeout(startWhenReady, 50);
    }, { once:true });
  } else if (!startWhenReady()) {
    setTimeout(startWhenReady, 50);
  }

  window.VN_QUICK_DECK = {
    add: addCard,
    remove: removeCard,
    clear: () => { draft = []; commitDraft(); },
    get: () => draft.map(x => ({ ...x })),
    limits: { deck:MAX_DECK, copies:MAX_COPIES }
  };
})();
