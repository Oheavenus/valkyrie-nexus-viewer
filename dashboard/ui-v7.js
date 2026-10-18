// V7 interaction layer: move view mode into the header, keep reset on the footer right edge,
// and add browser-local editable deck comments without changing canonical deck files.
(function () {
  const COMMENT_KEY = 'vn-deck-comment-overrides-v1';
  const DRAFT_COMMENT_KEY = 'vn-quick-deck-comment-v1';
  let footerScheduled = false;
  let deckScheduled = false;

  function loadMap() {
    try {
      const v = JSON.parse(localStorage.getItem(COMMENT_KEY) || '{}');
      return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    } catch (_) { return {}; }
  }
  function saveMap(v) {
    try { localStorage.setItem(COMMENT_KEY, JSON.stringify(v)); } catch (_) {}
  }
  function draftComment() {
    try { return localStorage.getItem(DRAFT_COMMENT_KEY) || ''; } catch (_) { return ''; }
  }
  function saveDraftComment(v) {
    try {
      if (v) localStorage.setItem(DRAFT_COMMENT_KEY, v);
      else localStorage.removeItem(DRAFT_COMMENT_KEY);
    } catch (_) {}
  }

  function placeHeaderViewSwitch() {
    const tabs = document.querySelector('.header-tabs');
    const view = document.querySelector('.view-switch');
    if (!tabs || !view) return false;
    view.classList.add('header-view-switch');
    // In the public viewer, ownership tools belong immediately after the
    // view-mode toggle. Do not keep moving the toggle past that pair.
    const ownership = tabs.querySelector('#viewerOwnershipControls');
    if (ownership) {
      if (view.parentElement !== tabs || view.nextElementSibling !== ownership) {
        tabs.insertBefore(view, ownership);
      }
    } else if (view.parentElement !== tabs || tabs.lastElementChild !== view) {
      tabs.appendChild(view);
    }
    return true;
  }

  function placeFooterControls() {
    footerScheduled = false;
    const row = document.querySelector('.footer-filter-row');
    if (!row) return false;
    // Order *whole* controls; detaching #searchInput from .vn-search-shell
    // caused an orphaned input, a blank search shell, and a wrapped footer.
    const ordered = [
      '.vn-search-shell', '#setFilter', '#typeFilter', '#rarityFilter',
      '#ownedButtons', '#effectFilterWrap', '#sortSelect'
    ].map(s => document.querySelector(s)).filter(Boolean);

    const visibleOrderedChildren = [...row.children].filter(el => ordered.includes(el));
    const alreadyOrdered = visibleOrderedChildren.length === ordered.length &&
      visibleOrderedChildren.every((el, index) => el === ordered[index]);
    if (!alreadyOrdered) ordered.forEach(el => row.appendChild(el));
    return ordered.length >= 6;
  }

  function scheduleFooterPlacement() {
    if (footerScheduled) return;
    footerScheduled = true;
    requestAnimationFrame(() => {
      placeHeaderViewSwitch();
      placeFooterControls();
      scheduleFooterMeasure();
    });
  }


  // Keep the eighth atlas row scrollable above the measured fixed footer.
  // The footer can grow with browser zoom or a narrower viewport.
  let footerMeasureScheduled = false;
  function measureFooterAndGallery() {
    footerMeasureScheduled = false;
    const footer = document.querySelector('#cardsPanel .card-control-footer');
    const cardsMain = document.querySelector('#cardsPanel .cards-main');
    if (!footer || !cardsMain) return;
    const footerBox = footer.getBoundingClientRect();
    const cardsBox = cardsMain.getBoundingClientRect();
    document.documentElement.style.setProperty('--vn-footer-height', Math.ceil(footerBox.height) + 'px');
    if (window.innerWidth > 900) {
      const available = Math.max(140, Math.floor(footerBox.top - cardsBox.top - 8));
      cardsMain.style.setProperty('--vn-cards-viewport-height', available + 'px');
    } else {
      cardsMain.style.removeProperty('--vn-cards-viewport-height');
    }
  }
  function scheduleFooterMeasure() {
    if (footerMeasureScheduled) return;
    footerMeasureScheduled = true;
    requestAnimationFrame(measureFooterAndGallery);
  }
  function monitorFooterHeight() {
    const footer = document.querySelector('#cardsPanel .card-control-footer');
    if (!footer || footer.dataset.vnMeasured === '1') return;
    footer.dataset.vnMeasured = '1';
    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(scheduleFooterMeasure).observe(footer);
    }
    window.addEventListener('resize', scheduleFooterMeasure, { passive: true });
    scheduleFooterMeasure();
  }

  function setTextIfChanged(el, value) {
    if (el && el.textContent !== value) el.textContent = value;
  }

  function decorateDeckComments() {
    deckScheduled = false;
    const comments = loadMap();

    document.querySelectorAll('.deck-compact-card[data-deck-id]').forEach(card => {
      const id = card.dataset.deckId;
      const summary = card.querySelector('.deck-compact-summary');
      const actions = card.querySelector('.deck-card-actions');
      if (!summary || !actions) return;

      if (!summary.dataset.v7Original) summary.dataset.v7Original = summary.textContent.trim();
      const wanted = Object.prototype.hasOwnProperty.call(comments, id) ? comments[id] : summary.dataset.v7Original;
      setTextIfChanged(summary, wanted);

      if (!actions.querySelector('[data-v7-deck-comment]')) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'deck-comment-edit';
        btn.dataset.v7DeckComment = id;
        btn.textContent = 'コメント編集';
        const rename = actions.querySelector('[data-deck-action="rename"]');
        if (rename) rename.after(btn); else actions.appendChild(btn);
      }
    });

    const draft = document.querySelector('#draftDeckPanel');
    const head = draft?.querySelector('.draft-compact-head');
    const actions = draft?.querySelector('.draft-v4-actions');
    if (draft && !draft.hidden && head && actions) {
      let note = head.querySelector('.draft-v7-comment');
      if (!note) {
        note = document.createElement('div');
        note.className = 'draft-v7-comment';
        actions.before(note);
      }
      const value = draftComment();
      setTextIfChanged(note, value || 'コメント未設定');
      note.classList.toggle('muted', !value);

      if (!actions.querySelector('[data-v7-draft-comment]')) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'draft-comment-edit';
        btn.dataset.v7DraftComment = '1';
        btn.textContent = 'コメント編集';
        const rename = actions.querySelector('[data-draft-action="rename"]');
        if (rename) rename.after(btn); else actions.appendChild(btn);
      }
    }
  }

  function scheduleDeckDecorate() {
    if (deckScheduled) return;
    deckScheduled = true;
    requestAnimationFrame(decorateDeckComments);
  }

  function installObservers() {
    const footer = document.querySelector('.footer-filter-row');
    if (footer && footer.dataset.v7Observed !== '1') {
      footer.dataset.v7Observed = '1';
      new MutationObserver(scheduleFooterPlacement).observe(footer, { childList:true });
    }
    const decks = document.querySelector('#decksContainer');
    if (decks && decks.dataset.v7Observed !== '1') {
      decks.dataset.v7Observed = '1';
      new MutationObserver(scheduleDeckDecorate).observe(decks, { childList:true });
    }
    const draft = document.querySelector('#draftDeckPanel');
    if (draft && draft.dataset.v7Observed !== '1') {
      draft.dataset.v7Observed = '1';
      new MutationObserver(scheduleDeckDecorate).observe(draft, { childList:true, attributes:true, attributeFilter:['hidden'] });
    }
  }

  document.addEventListener('click', e => {
    const deckBtn = e.target.closest?.('[data-v7-deck-comment]');
    if (deckBtn) {
      e.preventDefault();
      e.stopPropagation();
      const id = deckBtn.dataset.v7DeckComment;
      const card = deckBtn.closest('.deck-compact-card');
      const summary = card?.querySelector('.deck-compact-summary');
      if (!id || !summary) return;
      const comments = loadMap();
      const current = Object.prototype.hasOwnProperty.call(comments, id) ? comments[id] : summary.textContent.trim();
      const next = prompt('デッキコメント（空欄で元コメントに戻す）', current);
      if (next === null) return;
      const value = next.trim();
      if (value) comments[id] = value;
      else delete comments[id];
      saveMap(comments);
      decorateDeckComments();
      return;
    }

    const draftBtn = e.target.closest?.('[data-v7-draft-comment]');
    if (draftBtn) {
      e.preventDefault();
      e.stopPropagation();
      const next = prompt('作成中デッキのコメント', draftComment());
      if (next === null) return;
      saveDraftComment(next.trim());
      decorateDeckComments();
    }
  }, true);

  function install() {
    placeHeaderViewSwitch();
    scheduleFooterPlacement();
    installObservers();
    monitorFooterHeight();
    scheduleDeckDecorate();

    // V6 still performs a short settling pass after load. Re-apply V7 placement
    // until all older timers have finished, then observers keep it stable.
    let tries = 0;
    const settle = () => {
      placeHeaderViewSwitch();
      placeFooterControls();
      installObservers();
      scheduleFooterMeasure();
      decorateDeckComments();
      if (++tries < 6) setTimeout(settle, 80);
    };
    settle();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();
