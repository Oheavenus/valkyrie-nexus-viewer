// Public viewer collection tracker.
// Each visitor keeps owned-card counts in localStorage. Public collection data
// never writes back to the private repository.
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
    if (next > 0) counts[key] = next;
    else delete counts[key];
    saveCounts();

    const card = cardById(key);
    if (card) card.count = next;
    try {
      const existing = collection.get(key) || { card_id:key, name:card?.name || '' };
      collection.set(key, { ...existing, count:next });
    } catch (_) {}

    refreshAfterOwnershipChange();
  }

  function changeCount(id, delta) {
    setCount(id, ownedCount(id) + Number(delta || 0));
  }

  function refreshQuickDeckOwnership() {
    let draft = [];
    try { draft = window.VN_QUICK_DECK?.get?.() || []; } catch (_) {}
    const byId = new Map(draft.map(item => [idKey(item.id), Number(item.qty || 0)]));
    document.querySelectorAll('.quick-deck-row[data-card-id]').forEach(row => {
      const id = idKey(row.dataset.cardId);
      const card = cardById(id);
      const have = ownedCount(id);
      const qty = byId.get(id) || 0;
      const shortage = Math.max(0, qty - have);
      const meta = row.querySelector('.quick-deck-meta');
      if (!meta) return;
      meta.classList.toggle('need', shortage > 0);
      meta.textContent = `Cost ${card?.cost ?? '—'} · 所持 ${have}${shortage ? ` · 不足 ${shortage}` : ''}`;
    });
  }

  function refreshAfterOwnershipChange() {
    try { if (typeof renderSummary === 'function') renderSummary(); } catch (_) {}
    setPublicHeaderText();
    try { if (typeof filterCards === 'function') filterCards(); } catch (_) {}
    try { if (typeof renderDecks === 'function') Promise.resolve(renderDecks()).catch(() => {}); } catch (_) {}
    refreshQuickDeckOwnership();
    scheduleDecorate();
  }

  function editorHTML(id) {
    const key = idKey(id);
    const count = ownedCount(key);
    return `<span class="viewer-owned-editor" data-viewer-owned-card="${key}" role="group" aria-label="所持枚数 ${count}枚">
      <span class="viewer-owned-label">所持</span>
      <span class="viewer-owned-button dec${count <= 0 ? ' disabled' : ''}" role="button" tabindex="${count <= 0 ? '-1' : '0'}" aria-disabled="${count <= 0 ? 'true' : 'false'}" data-owned-action="dec" data-card-id="${key}" title="所持を1枚減らす">−</span>
      <span class="viewer-owned-count" aria-live="polite">${count}</span>
      <span class="viewer-owned-button inc${count >= MAX_COPIES ? ' disabled' : ''}" role="button" tabindex="${count >= MAX_COPIES ? '-1' : '0'}" aria-disabled="${count >= MAX_COPIES ? 'true' : 'false'}" data-owned-action="inc" data-card-id="${key}" title="獲得したカードを1枚追加">＋</span>
    </span>`;
  }

  function syncEditor(editor, id) {
    if (!editor) return;
    const key = idKey(id);
    const count = ownedCount(key);
    editor.dataset.viewerOwnedCard = key;
    editor.setAttribute('aria-label', `所持枚数 ${count}枚`);
    const countEl = editor.querySelector('.viewer-owned-count');
    if (countEl) countEl.textContent = String(count);
    const dec = editor.querySelector('[data-owned-action="dec"]');
    const inc = editor.querySelector('[data-owned-action="inc"]');
    if (dec) {
      const disabled = count <= 0;
      dec.classList.toggle('disabled', disabled);
      dec.setAttribute('aria-disabled', disabled ? 'true' : 'false');
      dec.tabIndex = disabled ? -1 : 0;
      dec.dataset.cardId = key;
    }
    if (inc) {
      const disabled = count >= MAX_COPIES;
      inc.classList.toggle('disabled', disabled);
      inc.setAttribute('aria-disabled', disabled ? 'true' : 'false');
      inc.tabIndex = disabled ? -1 : 0;
      inc.dataset.cardId = key;
    }
  }

  function decorateGallery() {
    const gallery = document.querySelector('#cardsGallery');
    if (!gallery) return;
    gallery.querySelectorAll('.card-tile[data-card-id]').forEach(tile => {
      const id = idKey(tile.dataset.cardId);
      tile.querySelectorAll('.viewer-owned-editor').forEach(el => el.remove());
      const badge = tile.querySelector('.tile-owned');
      if (badge) {
        const count = ownedCount(id);
        badge.textContent = `×${count}`;
        badge.classList.toggle('owned', count > 0);
        badge.classList.toggle('missing', count <= 0);
        badge.removeAttribute('aria-hidden');
      }
      const deckAdd = tile.querySelector('.tile-add-btn');
      if (deckAdd) {
        deckAdd.textContent = '+';
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
      cell.classList.toggle('missing', count <= 0);
      if (cell.textContent !== String(count)) cell.textContent = String(count);
    });
  }

  function modalCardId() {
    const kicker = document.querySelector('#cardModal .modal-kicker');
    const match = kicker?.textContent?.match(/No\.(\d+)/);
    return match ? idKey(match[1]) : '';
  }

  function decorateModal() {
    const modal = document.querySelector('#cardModal');
    if (!modal || modal.hidden) return;
    const id = modalCardId();
    if (!id) return;
    const tags = modal.querySelector('.modal-tags');
    if (!tags) return;

    [...tags.children].forEach(child => {
      if (child.classList?.contains('viewer-owned-editor')) return;
      if (child.tagName === 'SPAN' && /^所持\s*\d+/.test(child.textContent || '')) child.remove();
    });

    let editor = tags.querySelector('.viewer-owned-editor');
    if (!editor) {
      tags.insertAdjacentHTML('beforeend', editorHTML(id));
      editor = tags.querySelector('.viewer-owned-editor');
    }
    syncEditor(editor, id);
  }

  function removeStatisticsUI(final = false) {
    document.querySelector('.tab[data-tab="pulls"]')?.remove();
    const panel = document.querySelector('#pullsPanel');
    if (!panel) return;
    panel.classList.remove('active');
    panel.hidden = true;
    panel.style.display = 'none';
    if (final) panel.remove();
  }

  function ensureHeaderResetControl() {
    const tabs = document.querySelector('.header-tabs');
    if (!tabs || tabs.querySelector('#viewerCollectionReset')) return;
    const button = document.createElement('button');
    button.id = 'viewerCollectionReset';
    button.className = 'viewer-header-reset';
    button.type = 'button';
    button.textContent = '所持リセット';
    button.title = 'このブラウザに保存した所持枚数をすべて0に戻す';
    tabs.appendChild(button);
  }

  function removeLegacyFooterArtifacts() {
    document.querySelectorAll('.footer-filter-row #viewerCollectionReset, .viewer-local-note').forEach(el => el.remove());
  }

  function setPublicHeaderText() {
    const updated = document.querySelector('#updatedText');
    if (updated) updated.textContent = 'カード情報: 公開DB / 所持データ: このブラウザに保存';
  }

  function decorateAll() {
    decorateScheduled = false;
    if (!window.VN_PUBLIC_VIEWER) return;
    document.body?.classList.add('vn-public-viewer');
    removeStatisticsUI(started);
    ensureHeaderResetControl();
    removeLegacyFooterArtifacts();
    decorateGallery();
    decorateTable();
    decorateModal();
    refreshQuickDeckOwnership();
    setPublicHeaderText();
  }

  function scheduleDecorate() {
    if (decorateScheduled) return;
    decorateScheduled = true;
    requestAnimationFrame(decorateAll);
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
        if (!window.confirm('このブラウザに登録した所持状況をすべて0枚に戻しますか？')) return;
        counts = {};
        saveCounts();
        applyCountsToModel();
        refreshAfterOwnershipChange();
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
      removeStatisticsUI(false);
      ensureHeaderResetControl();
      removeLegacyFooterArtifacts();
      if (attempt < 100) setTimeout(() => startWhenReady(attempt + 1), 50);
      return;
    }
    if (started) return;
    started = true;
    applyCountsToModel();
    try { renderSummary(); } catch (_) {}
    setPublicHeaderText();
    try { filterCards(); } catch (_) {}
    try { Promise.resolve(renderDecks()).catch(() => {}); } catch (_) {}
    removeStatisticsUI(true);
    ensureHeaderResetControl();
    removeLegacyFooterArtifacts();
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
      refreshAfterOwnershipChange();
    },
    maxCopies: MAX_COPIES
  };
})();