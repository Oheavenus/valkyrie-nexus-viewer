// Public viewer collection tracker.
// Each visitor keeps owned-card counts in localStorage. Public collection data
// never writes back to the private repository.
(function () {
  if (!window.VN_PUBLIC_VIEWER) return;

  const STORAGE_KEY = 'vn-viewer-collection-v1';
  const MAX_COPIES = 3;
  const DEFAULT_N_COUNT = 3;
  const RARITIES = ['N', 'R', 'SR', 'UR'];
  let counts = loadCounts();
  let observer = null;
  let started = false;
  let decorateScheduled = false;

  document.documentElement.classList.add('vn-public-viewer');
  document.body?.classList.add('vn-public-viewer');

  function idKey(value) { return String(value || '').padStart(3, '0'); }
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
          const key = idKey(id), count = normalizeCount(value);
          if (/^\d{3,}$/.test(key)) clean[key] = count;
        });
      }
      return clean;
    } catch (_) { return {}; }
  }
  function saveCounts() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(counts)); } catch (_) {}
  }
  function ownedCount(id) {
    const key = idKey(id);
    if (Object.prototype.hasOwnProperty.call(counts, key)) return normalizeCount(counts[key]);
    return cardById(key)?.rarity === 'N' ? DEFAULT_N_COUNT : 0;
  }
  function cardById(id) {
    const key = idKey(id);
    try { return Array.isArray(allCards) ? allCards.find(card => card.card_id === key) || null : null; }
    catch (_) { return null; }
  }

  function applyCountsToModel() {
    try {
      if (!Array.isArray(allCards)) return false;
      const nextCollection = new Map();
      allCards.forEach(card => {
        const id = idKey(card.card_id), count = ownedCount(id);
        card.count = count;
        nextCollection.set(id, { card_id:id, name:card.name || '', count, last_verified:card.last_verified || '' });
      });
      collection = nextCollection;
      return true;
    } catch (_) { return false; }
  }

  function setCount(id, nextValue) {
    const key = idKey(id);
    if (!/^\d{3,}$/.test(key)) return;
    const next = normalizeCount(nextValue);
    counts[key] = next;
    saveCounts();
    const card = cardById(key);
    if (card) card.count = next;
    try {
      const existing = collection.get(key) || { card_id:key, name:card?.name || '' };
      collection.set(key, { ...existing, count:next });
    } catch (_) {}
    refreshAfterOwnershipChange();
  }
  function changeCount(id, delta) { setCount(id, ownedCount(id) + Number(delta || 0)); }

  function refreshQuickDeckOwnership() {
    let draft = [];
    try { draft = window.VN_QUICK_DECK?.get?.() || []; } catch (_) {}
    const byId = new Map(draft.map(item => [idKey(item.id), Number(item.qty || 0)]));
    document.querySelectorAll('.quick-deck-row[data-card-id]').forEach(row => {
      const id = idKey(row.dataset.cardId), card = cardById(id), have = ownedCount(id), qty = byId.get(id) || 0;
      const shortage = Math.max(0, qty - have), meta = row.querySelector('.quick-deck-meta');
      if (!meta) return;
      meta.classList.toggle('need', shortage > 0);
      const text = `Cost ${card?.cost ?? '—'} · 所持 ${have}${shortage ? ` · 不足 ${shortage}` : ''}`;
      if (meta.textContent !== text) meta.textContent = text;
    });
  }

  function collectionStats() {
    const cards = Array.isArray(allCards) ? allCards : [];
    const totalKinds = cards.length;
    const ownedKinds = cards.filter(card => ownedCount(card.card_id) > 0).length;
    const totalCopies = cards.reduce((sum, card) => sum + ownedCount(card.card_id), 0);
    const maxedKinds = cards.filter(card => ownedCount(card.card_id) >= MAX_COPIES).length;
    const missingKinds = Math.max(0, totalKinds - ownedKinds);
    const completion = totalKinds ? (ownedKinds / totalKinds) * 100 : 0;
    const rarity = Object.fromEntries(RARITIES.map(r => [r, { total:0, owned:0, copies:0, maxed:0 }]));
    const type = { 'ユニット':{ total:0, owned:0, copies:0 }, 'アーツ':{ total:0, owned:0, copies:0 } };
    cards.forEach(card => {
      const count = ownedCount(card.card_id), r = rarity[card.rarity], t = type[card.type];
      if (r) { r.total++; r.copies += count; if (count > 0) r.owned++; if (count >= MAX_COPIES) r.maxed++; }
      if (t) { t.total++; t.copies += count; if (count > 0) t.owned++; }
    });
    return { totalKinds, ownedKinds, totalCopies, maxedKinds, missingKinds, completion, rarity, type };
  }
  function ratioText(owned, total) {
    const pct = total ? Math.round((owned / total) * 1000) / 10 : 0;
    return `${owned} / ${total} (${pct}%)`;
  }

  function renderPublicStats() {
    const panel = document.querySelector('#pullsPanel');
    if (!panel || !Array.isArray(allCards) || !allCards.length) return;
    const s = collectionStats();
    panel.hidden = false;
    panel.style.removeProperty('display');
    panel.innerHTML = `<div class="viewer-stats-intro"><div><strong>所持統計</strong><span>Nは全種3枚を既定値とし、それ以外はカード一覧で登録したこのブラウザの所持状況だけを集計します。</span></div></div>
      <div class="viewer-stats-overview">
        <div class="viewer-stat-card"><span>所持種類</span><b>${s.ownedKinds} / ${s.totalKinds}</b></div>
        <div class="viewer-stat-card"><span>コンプリート率</span><b>${s.completion.toFixed(1)}%</b></div>
        <div class="viewer-stat-card"><span>総所持枚数</span><b>${s.totalCopies}</b></div>
        <div class="viewer-stat-card"><span>3枚所持</span><b>${s.maxedKinds}種</b></div>
        <div class="viewer-stat-card"><span>未所持</span><b>${s.missingKinds}種</b></div>
      </div>
      <section class="viewer-stats-section"><h2>レアリティ別</h2><div class="viewer-rarity-grid">${RARITIES.map(rarity => {
        const r = s.rarity[rarity], pct = r.total ? (r.owned / r.total) * 100 : 0;
        return `<article class="viewer-rarity-card rarity-${rarity}"><div class="viewer-rarity-head"><span class="rarity ${rarity}">${rarity}</span><b>${ratioText(r.owned, r.total)}</b></div><div class="viewer-progress"><span style="width:${pct}%"></span></div><div class="viewer-rarity-meta"><span>総枚数 ${r.copies}</span><span>3枚所持 ${r.maxed}種</span></div></article>`;
      }).join('')}</div></section>
      <section class="viewer-stats-section"><h2>カード種別</h2><div class="viewer-type-grid"><article class="viewer-type-card"><span>ミニオン</span><b>${ratioText(s.type['ユニット'].owned, s.type['ユニット'].total)}</b><small>総枚数 ${s.type['ユニット'].copies}</small></article><article class="viewer-type-card"><span>スペル</span><b>${ratioText(s.type['アーツ'].owned, s.type['アーツ'].total)}</b><small>総枚数 ${s.type['アーツ'].copies}</small></article></div></section>`;
    panel.dataset.viewerStatsReady = 'true';
  }

  function ensureStatisticsUI() {
    const tabs = document.querySelector('.header-tabs');
    if (tabs) {
      let tab = tabs.querySelector('.tab[data-tab="pulls"]');
      if (!tab) {
        tab = document.createElement('button');
        tab.className = 'tab';
        tab.dataset.tab = 'pulls';
        tab.type = 'button';
        tabs.insertBefore(tab, tabs.querySelector('#viewerCollectionReset'));
      }
      if (tab.textContent !== '所持統計') tab.textContent = '所持統計';
    }
    let panel = document.querySelector('#pullsPanel');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'pullsPanel';
      panel.className = 'panel';
      document.querySelector('main')?.appendChild(panel);
    }
    panel.hidden = false;
    panel.style.removeProperty('display');
    if (panel.dataset.viewerStatsReady !== 'true') renderPublicStats();
  }

  function refreshAfterOwnershipChange() {
    try { if (typeof renderSummary === 'function') renderSummary(); } catch (_) {}
    setPublicHeaderText();
    try { if (typeof filterCards === 'function') filterCards(); } catch (_) {}
    try { if (typeof renderDecks === 'function') Promise.resolve(renderDecks()).catch(() => {}); } catch (_) {}
    refreshQuickDeckOwnership();
    renderPublicStats();
    scheduleDecorate();
  }

  function editorHTML(id) {
    const key = idKey(id), count = ownedCount(key);
    return `<span class="viewer-owned-editor" data-viewer-owned-card="${key}" role="group" aria-label="所持枚数 ${count}枚"><span class="viewer-owned-label">所持</span><span class="viewer-owned-button dec${count <= 0 ? ' disabled' : ''}" role="button" tabindex="${count <= 0 ? '-1' : '0'}" aria-disabled="${count <= 0 ? 'true' : 'false'}" data-owned-action="dec" data-card-id="${key}" title="所持を1枚減らす">−</span><span class="viewer-owned-count" aria-live="polite">${count}</span><span class="viewer-owned-button inc${count >= MAX_COPIES ? ' disabled' : ''}" role="button" tabindex="${count >= MAX_COPIES ? '-1' : '0'}" aria-disabled="${count >= MAX_COPIES ? 'true' : 'false'}" data-owned-action="inc" data-card-id="${key}" title="獲得したカードを1枚追加">＋</span></span>`;
  }
  function syncEditor(editor, id) {
    if (!editor) return;
    const key = idKey(id), count = ownedCount(key);
    editor.dataset.viewerOwnedCard = key;
    editor.setAttribute('aria-label', `所持枚数 ${count}枚`);
    const countEl = editor.querySelector('.viewer-owned-count');
    if (countEl && countEl.textContent !== String(count)) countEl.textContent = String(count);
    const dec = editor.querySelector('[data-owned-action="dec"]'), inc = editor.querySelector('[data-owned-action="inc"]');
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
        const count = ownedCount(id), text = `×${count}`;
        if (badge.textContent !== text) badge.textContent = text;
        badge.classList.toggle('owned', count > 0);
        badge.classList.toggle('missing', count <= 0);
        badge.removeAttribute('aria-hidden');
      }
      const deckAdd = tile.querySelector('.tile-add-btn');
      if (deckAdd) {
        if (deckAdd.textContent !== '+') deckAdd.textContent = '+';
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
    const match = document.querySelector('#cardModal .modal-kicker')?.textContent?.match(/No\.(\d+)/);
    return match ? idKey(match[1]) : '';
  }
  function decorateModal() {
    const modal = document.querySelector('#cardModal');
    if (!modal || modal.hidden) return;
    const id = modalCardId(), tags = modal.querySelector('.modal-tags');
    if (!id || !tags) return;
    [...tags.children].forEach(child => {
      if (!child.classList?.contains('viewer-owned-editor') && child.tagName === 'SPAN' && /^所持\s*\d+/.test(child.textContent || '')) child.remove();
    });
    let editor = tags.querySelector('.viewer-owned-editor');
    if (!editor) {
      tags.insertAdjacentHTML('beforeend', editorHTML(id));
      editor = tags.querySelector('.viewer-owned-editor');
    }
    syncEditor(editor, id);
  }

  function ensureHeaderResetControl() {
    const tabs = document.querySelector('.header-tabs');
    if (!tabs || tabs.querySelector('#viewerCollectionReset')) return;
    const button = document.createElement('button');
    button.id = 'viewerCollectionReset';
    button.className = 'viewer-header-reset';
    button.type = 'button';
    button.textContent = '所持リセット';
    button.title = 'このブラウザの所持補正を消去し、N全種3枚・その他0枚へ戻す';
    tabs.appendChild(button);
  }
  function removeLegacyFooterArtifacts() {
    document.querySelectorAll('.footer-filter-row #viewerCollectionReset, .viewer-local-note').forEach(el => el.remove());
  }
  function setPublicHeaderText() {
    const updated = document.querySelector('#updatedText');
    const text = 'カード情報: 公開DB / 所持データ: このブラウザに保存';
    if (updated && updated.textContent !== text) updated.textContent = text;
  }
  function activateTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabName));
    document.querySelectorAll('.panel').forEach(panel => panel.classList.remove('active'));
    document.querySelector(`#${tabName}Panel`)?.classList.add('active');
  }

  function observeTargets() {
    if (!observer) return;
    observer.disconnect();
    ['#cardsGallery', '#cardsBody', '#cardModalBody', '#quickDeckList', '.header-tabs'].forEach(selector => {
      const node = document.querySelector(selector);
      if (node) observer.observe(node, { childList:true, subtree:true });
    });
  }
  function decorateAll() {
    decorateScheduled = false;
    if (!window.VN_PUBLIC_VIEWER) return;
    if (observer) observer.disconnect();
    try {
      document.body?.classList.add('vn-public-viewer');
      ensureHeaderResetControl();
      ensureStatisticsUI();
      removeLegacyFooterArtifacts();
      decorateGallery();
      decorateTable();
      decorateModal();
      refreshQuickDeckOwnership();
      setPublicHeaderText();
    } finally {
      observeTargets();
    }
  }
  function scheduleDecorate() {
    if (decorateScheduled) return;
    decorateScheduled = true;
    requestAnimationFrame(decorateAll);
  }
  function setupObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(scheduleDecorate);
    observeTargets();
  }

  function setupEvents() {
    document.addEventListener('click', event => {
      const action = event.target.closest?.('[data-owned-action][data-card-id]');
      if (action) {
        event.preventDefault();
        event.stopPropagation();
        if (action.getAttribute('aria-disabled') !== 'true') changeCount(action.dataset.cardId, action.dataset.ownedAction === 'inc' ? 1 : -1);
        return;
      }
      if (event.target.closest?.('#viewerCollectionReset')) {
        event.preventDefault();
        event.stopPropagation();
        if (!window.confirm('このブラウザの所持補正を消去し、N全種3枚・R/SR/URは0枚へ戻しますか？')) return;
        counts = {};
        saveCounts();
        applyCountsToModel();
        refreshAfterOwnershipChange();
        return;
      }
      if (event.target.closest?.('.tab[data-tab="pulls"]')) {
        event.preventDefault();
        event.stopPropagation();
        activateTab('pulls');
      }
    }, true);
    document.addEventListener('keydown', event => {
      const action = event.target.closest?.('[data-owned-action][data-card-id]');
      if (!action || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      event.stopPropagation();
      if (action.getAttribute('aria-disabled') !== 'true') changeCount(action.dataset.cardId, action.dataset.ownedAction === 'inc' ? 1 : -1);
    }, true);
  }

  function startWhenReady(attempt = 0) {
    let ready = false;
    try { ready = Array.isArray(allCards) && allCards.length > 0; } catch (_) {}
    if (!ready) {
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
    try { if (typeof filterCards === 'function') filterCards(); } catch (_) {}
    try { if (typeof renderDecks === 'function') Promise.resolve(renderDecks()).catch(() => {}); } catch (_) {}
    ensureHeaderResetControl();
    ensureStatisticsUI();
    removeLegacyFooterArtifacts();
    setupEvents();
    setupObserver();
    decorateAll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => startWhenReady(), { once:true });
  else startWhenReady();

  window.VN_VIEWER_COLLECTION = {
    get:() => ({ ...counts }),
    set:(id,count) => setCount(id,count),
    increment:id => changeCount(id,1),
    decrement:id => changeCount(id,-1),
    reset:() => { counts = {}; saveCounts(); applyCountsToModel(); refreshAfterOwnershipChange(); },
    stats:collectionStats,
    maxCopies:MAX_COPIES
  };
})();
