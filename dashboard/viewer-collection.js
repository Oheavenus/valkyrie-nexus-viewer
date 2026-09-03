// Public viewer collection tracker.
// Keeps each visitor's owned-card counts in that browser only; never writes the
// private repository collection.csv and never sends collection data anywhere.
(function () {
  if (!window.VN_PUBLIC_VIEWER) return;

  const STORAGE_KEY = 'vn-viewer-collection-v1';
  const MAX_COPIES = 3;
  let counts = loadCounts();
  let observer = null;
  let started = false;
  let decorateScheduled = false;

  document.documentElement.classList.add('vn-public-viewer');
  document.body?.classList.add('vn-public-viewer');

  function idKey(value) {
    return String(value || '').padStart(3, '0');
  }

  function normalizeCount(value) {
    const n = Number(value || 0);
    return Math.max(0, Math.min(MAX_COPIES, Number.isFinite(n) ? Math.round(n) : 0));
  }

  function loadCounts() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      const clean = {};
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        Object.entries(raw).forEach(([id, value]) => {
          const key = idKey(id);
          const count = normalizeCount(value);
          if (/^\d{3,}$/.test(key) && count > 0) clean[key] = count;
        });
      }
      return clean;
    } catch (_) {
      return {};
    }
  }

  function saveCounts() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(counts)); } catch (_) {}
  }

  function ownedCount(id) {
    return normalizeCount(counts[idKey(id)] || 0);
  }

  function cardById(id) {
    const key = idKey(id);
    try {
      return Array.isArray(allCards) ? allCards.find(card => card.card_id === key) || null : null;
    } catch (_) {
      return null;
    }
  }

  function applyCountsToModel() {
    try {
      if (!Array.isArray(allCards)) return false;
      const nextCollection = new Map();
      allCards.forEach(card => {
        const id = idKey(card.card_id);
        const count = ownedCount(id);
        card.count = count;
        nextCollection.set(id, {
          card_id: id,
          name: card.name || '',
          count,
          last_verified: card.last_verified || ''
        });
      });
      collection = nextCollection;
      return true;
    } catch (_) {
      return false;
    }
  }

  function setCount(id, nextValue) {
    const key = idKey(id);
    if (!/^\d{3,}$/.test(key)) return;
    const next = normalizeCount(nextValue);
    if (next === ownedCount(key)) return;
    if (next > 0) counts[key] = next;
    else delete counts[key];
    saveCounts();

    const card = cardById(key);
    if (card) card.count = next;
    try {
      const existing = collection.get(key) || { card_id:key, name:card?.name || '' };
      collection.set(key, { ...existing, count:next });
    } catch (_) {}

    refreshAfterOwnershipChange(key);
  }

  function changeCount(id, delta) {
    setCount(id, ownedCount(id) + Number(delta || 0));
  }

  function scheduleDecorate() {
    if (decorateScheduled) return;
    decorateScheduled = true;
    requestAnimationFrame(() => {
      decorateScheduled = false;
      decorateAll();
    });
  }

  function refreshAfterOwnershipChange(changedId) {
    try { if (typeof renderSummary === 'function') renderSummary(); } catch (_) {}
    try { if (typeof filterCards === 'function') filterCards(); } catch (_) {}
    try {
      if (typeof renderDecks === 'function') Promise.resolve(renderDecks()).catch(() => {});
    } catch (_) {}

    const modal = document.querySelector('#cardModal');
    if (modal && !modal.hidden) {
      const shown = modal.querySelector('[data-viewer-owned-card]')?.dataset.viewerOwnedCard;
      const target = shown || modal.querySelector('.modal-kicker')?.textContent?.match(/No\.(\d+)/)?.[1];
      if (target && (!changedId || idKey(target) === idKey(changedId))) {
        try { openCardModal(target); } catch (_) {}
      }
    }

    scheduleDecorate();
  }

  function editorHTML(id, compact = false) {
    const key = idKey(id);
    const count = ownedCount(key);
    return `<span class="viewer-owned-editor${compact ? ' compact' : ''}" data-viewer-owned-card="${key}" data-owned-count="${count}" role="group" aria-label="所持枚数 ${count}枚">
      <span class="viewer-owned-label">所持</span>
      <span class="viewer-owned-button dec${count <= 0 ? ' disabled' : ''}" role="button" tabindex="${count <= 0 ? '-1' : '0'}" aria-disabled="${count <= 0 ? 'true' : 'false'}" data-owned-action="dec" data-card-id="${key}" title="所持を1枚減らす">−</span>
      <span class="viewer-owned-count" aria-live="polite">${count}</span>
      <span class="viewer-owned-button inc${count >= MAX_COPIES ? ' disabled' : ''}" role="button" tabindex="${count >= MAX_COPIES ? '-1' : '0'}" aria-disabled="${count >= MAX_COPIES ? 'true' : 'false'}" data-owned-action="inc" data-card-id="${key}" title="獲得したカードを1枚追加">＋</span>
    </span>`;
  }

  function editorNeedsRefresh(editor, id) {
    return !editor || editor.dataset.viewerOwnedCard !== idKey(id) || Number(editor.dataset.ownedCount) !== ownedCount(id);
  }

  function decorateGallery() {
    const gallery = document.querySelector('#cardsGallery');
    if (!gallery) return;
    gallery.querySelectorAll('.card-tile[data-card-id]').forEach(tile => {
      const shell = tile.querySelector('.tile-art-shell');
      if (!shell) return;
      tile.querySelector('.tile-owned')?.setAttribute('aria-hidden', 'true');
      const editor = shell.querySelector('.viewer-owned-editor');
      if (editorNeedsRefresh(editor, tile.dataset.cardId)) {
        if (editor) editor.outerHTML = editorHTML(tile.dataset.cardId, true);
        else shell.insertAdjacentHTML('beforeend', editorHTML(tile.dataset.cardId, true));
      }
      const deckAdd = shell.querySelector('.tile-add-btn');
      if (deckAdd) {
        if (deckAdd.textContent !== 'D＋') deckAdd.textContent = 'D＋';
        deckAdd.setAttribute('aria-label', 'デッキに追加');
        if (deckAdd.getAttribute('aria-disabled') !== 'true') deckAdd.title = 'デッキに追加';
      }
    });
  }

  function decorateTable() {
    document.querySelectorAll('#cardsBody tr[data-card-id]').forEach(row => {
      const cell = row.children?.[7];
      if (!cell) return;
      const count = ownedCount(row.dataset.cardId);
      cell.classList.toggle('owned', count > 0);
      cell.classList.toggle('missing', count === 0);
      const editor = cell.querySelector('.viewer-owned-editor');
      if (editorNeedsRefresh(editor, row.dataset.cardId)) cell.innerHTML = editorHTML(row.dataset.cardId);
    });
  }

  function decorateModal() {
    const modal = document.querySelector('#cardModal');
    if (!modal || modal.hidden) return;
    const match = modal.querySelector('.modal-kicker')?.textContent?.match(/No\.(\d+)/);
    if (!match) return;
    const id = idKey(match[1]);
    const tags = modal.querySelector('.modal-tags');
    if (!tags) return;
    const editor = tags.querySelector('.viewer-owned-editor');
    if (editorNeedsRefresh(editor, id)) {
      if (editor) editor.outerHTML = editorHTML(id);
      else tags.insertAdjacentHTML('beforeend', editorHTML(id));
    }
  }

  function refreshQuickDeckOwnership() {
    document.querySelectorAll('.quick-deck-row[data-card-id]').forEach(row => {
      const id = idKey(row.dataset.cardId);
      const card = cardById(id);
      const have = ownedCount(id);
      const qty = Number(row.querySelector('.quick-deck-qty')?.textContent || 0);
      const shortage = Math.max(0, qty - have);
      const meta = row.querySelector('.quick-deck-meta');
      if (meta) {
        const text = `Cost ${card?.cost ?? '—'} · 所持 ${have}${shortage ? ` · 不足 ${shortage}` : ''}`;
        if (meta.textContent !== text) meta.textContent = text;
        meta.classList.toggle('need', shortage > 0);
      }
    });

    try {
      const draft = window.VN_QUICK_DECK?.get?.() || [];
      let totalShortage = 0;
      draft.forEach(item => {
        const have = ownedCount(item.id);
        totalShortage += Math.max(0, Number(item.qty || 0) - have);
        const copies = [...document.querySelectorAll(`.draft-mini-card[data-card-id="${idKey(item.id)}"]`)];
        copies.forEach((button, index) => button.classList.toggle('missing-copy', index >= have));
      });
      const status = document.querySelector('.draft-compact-head > span:last-child');
      if (status) {
        const text = totalShortage ? `不足 ${totalShortage}枚` : '構築可能';
        if (status.textContent !== text) status.textContent = text;
        status.classList.toggle('need', totalShortage > 0);
        status.classList.toggle('ready', totalShortage === 0);
      }
    } catch (_) {}
  }

  function ensureResetControl() {
    const row = document.querySelector('.footer-filter-row');
    if (!row || row.querySelector('#viewerCollectionReset')) return;
    const button = document.createElement('button');
    button.id = 'viewerCollectionReset';
    button.className = 'viewer-collection-reset';
    button.type = 'button';
    button.textContent = '所持をリセット';
    button.title = 'このブラウザに保存した所持枚数をすべて0に戻す';
    const ownedFilter = document.querySelector('#ownedFilter');
    if (ownedFilter?.nextSibling) ownedFilter.parentNode.insertBefore(button, ownedFilter.nextSibling);
    else row.appendChild(button);
  }

  function ensureLocalNote() {
    const status = document.querySelector('.footer-status-row');
    if (status && !status.querySelector('.viewer-local-note')) {
      const note = document.createElement('div');
      note.className = 'section-note viewer-local-note';
      note.textContent = '所持枚数はこのブラウザ内だけに保存されます';
      status.appendChild(note);
    }
    const updated = document.querySelector('#updatedText');
    if (updated && updated.textContent !== 'カード情報: 公開DB / 所持データ: このブラウザに保存') {
      updated.textContent = 'カード情報: 公開DB / 所持データ: このブラウザに保存';
    }
  }

  function decorateAll() {
    if (!window.VN_PUBLIC_VIEWER) return;
    document.body?.classList.add('vn-public-viewer');
    decorateGallery();
    decorateTable();
    decorateModal();
    refreshQuickDeckOwnership();
    ensureResetControl();
    ensureLocalNote();
  }

  function setupObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(scheduleDecorate);
    observer.observe(document.body, { childList:true, subtree:true });
  }

  function setupEvents() {
    document.addEventListener('click', event => {
      const action = event.target.closest?.('[data-owned-action][data-card-id]');
      if (action) {
        event.preventDefault();
        event.stopPropagation();
        if (action.getAttribute('aria-disabled') === 'true') return;
        changeCount(action.dataset.cardId, action.dataset.ownedAction === 'inc' ? 1 : -1);
        return;
      }

      if (event.target.closest?.('#viewerCollectionReset')) {
        event.preventDefault();
        event.stopPropagation();
        if (Object.keys(counts).length && !window.confirm('このブラウザに登録した所持状況をすべて0枚に戻しますか？')) return;
        counts = {};
        saveCounts();
        applyCountsToModel();
        refreshAfterOwnershipChange('');
      }
    }, true);

    document.addEventListener('keydown', event => {
      const action = event.target.closest?.('[data-owned-action][data-card-id]');
      if (!action || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      event.stopPropagation();
      if (action.getAttribute('aria-disabled') === 'true') return;
      changeCount(action.dataset.cardId, action.dataset.ownedAction === 'inc' ? 1 : -1);
    }, true);
  }

  function startWhenReady(attempt = 0) {
    let ready = false;
    try { ready = Array.isArray(allCards) && allCards.length > 0; } catch (_) {}
    if (!ready) {
      if (attempt < 100) setTimeout(() => startWhenReady(attempt + 1), 50);
      return;
    }
    if (started) return;
    started = true;
    applyCountsToModel();
    try { renderSummary(); } catch (_) {}
    try { filterCards(); } catch (_) {}
    try { Promise.resolve(renderDecks()).catch(() => {}); } catch (_) {}
    ensureResetControl();
    ensureLocalNote();
    decorateAll();
    setupObserver();
    setupEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => startWhenReady(), { once:true });
  } else {
    startWhenReady();
  }

  window.VN_VIEWER_COLLECTION = {
    get: () => ({ ...counts }),
    set: (id, count) => setCount(id, count),
    increment: id => changeCount(id, 1),
    decrement: id => changeCount(id, -1),
    reset: () => {
      counts = {};
      saveCounts();
      applyCountsToModel();
      refreshAfterOwnershipChange('');
    },
    maxCopies: MAX_COPIES
  };
})();