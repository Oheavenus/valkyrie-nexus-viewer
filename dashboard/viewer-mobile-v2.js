// Public viewer mobile interaction layer.
// Loaded only by the exported GitHub Pages viewer; private/local dashboard behavior is unchanged.
(function () {
  if (!window.VN_PUBLIC_VIEWER) return;

  const media = window.matchMedia('(max-width: 760px)');
  let filterOpen = false;
  let effectOpen = false;
  let drawerPinned = false;
  let drawerPeekTimer = 0;
  let scrollStopTimer = 0;
  let lastScrollY = window.scrollY || 0;
  let started = false;
  let dynamicObserver = null;
  let dynamicScheduled = false;

  const $ = selector => document.querySelector(selector);
  const isMobile = () => media.matches;
  const idKey = value => String(value || '').padStart(3, '0');

  function cardById(id) {
    const key = idKey(id);
    try {
      return Array.isArray(allCards) ? allCards.find(card => card.card_id === key) || null : null;
    } catch (_) {
      return null;
    }
  }

  function draftQuantity(id) {
    try {
      const key = idKey(id);
      return Number(window.VN_QUICK_DECK?.get?.().find(item => idKey(item.id) === key)?.qty || 0);
    } catch (_) {
      return 0;
    }
  }

  function ensureMobileChrome() {
    const footer = $('.card-control-footer');
    if (footer && !$('#viewerFooterHandle')) {
      const button = document.createElement('button');
      button.id = 'viewerFooterHandle';
      button.className = 'viewer-footer-handle';
      button.type = 'button';
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-controls', 'viewerFilterSheet');
      button.dataset.open = '0';
      button.innerHTML = '<span aria-hidden="true">∧</span><b>絞り込み</b>';
      footer.prepend(button);
      footer.id = footer.id || 'viewerFilterSheet';
    }

    const effectHead = $('#effectFilterPanel .effect-filter-head');
    if (effectHead && !$('#viewerEffectClose')) {
      const close = document.createElement('button');
      close.id = 'viewerEffectClose';
      close.className = 'viewer-effect-close';
      close.type = 'button';
      close.textContent = '閉じる';
      effectHead.appendChild(close);
    }

    if (!$('#viewerFilterBackdrop')) {
      document.body.insertAdjacentHTML('beforeend', '<button id="viewerFilterBackdrop" class="viewer-filter-backdrop" type="button" aria-label="絞り込みを閉じる"></button>');
    }
    if (!$('#viewerEffectBackdrop')) {
      document.body.insertAdjacentHTML('beforeend', '<button id="viewerEffectBackdrop" class="viewer-effect-backdrop" type="button" aria-label="効果フィルターを閉じる"></button>');
    }
    if (!$('#viewerDeckDrawerToggle')) {
      document.body.insertAdjacentHTML('beforeend', '<button id="viewerDeckDrawerToggle" class="viewer-deck-drawer-toggle" type="button" aria-label="デッキ一覧を開く" aria-expanded="false" data-open="0">‹</button>');
    }
    if (!$('#viewerDeckToast')) {
      document.body.insertAdjacentHTML('beforeend', '<div id="viewerDeckToast" class="viewer-deck-toast" role="status" aria-live="polite"></div>');
    }
    if (!$('#viewerBackToTop')) {
      document.body.insertAdjacentHTML('beforeend', '<button id="viewerBackToTop" class="viewer-back-top" type="button" aria-label="一番上に戻る">↑</button>');
    }

    syncHeaderHeight();
    syncDeckToggleVisibility();
    syncFooterHandle();
    syncDrawerToggle();
  }

  function syncHeaderHeight() {
    if (!isMobile()) {
      document.documentElement.style.removeProperty('--vn-mobile-header-h');
      return;
    }
    const header = $('.topbar');
    if (!header) return;
    const h = Math.max(0, Math.ceil(header.getBoundingClientRect().height));
    if (h) document.documentElement.style.setProperty('--vn-mobile-header-h', `${h}px`);
  }

  function syncFooterHandle() {
    const button = $('#viewerFooterHandle');
    if (!button) return;
    const state = filterOpen ? '1' : '0';
    if (button.dataset.open === state) return;
    button.dataset.open = state;
    button.setAttribute('aria-expanded', filterOpen ? 'true' : 'false');
    button.innerHTML = filterOpen
      ? '<span aria-hidden="true">∨</span><b>閉じる</b>'
      : '<span aria-hidden="true">∧</span><b>絞り込み</b>';
  }

  function setFiltersOpen(open) {
    filterOpen = Boolean(open && isMobile());
    document.body.classList.toggle('viewer-filters-open', filterOpen);
    if (!filterOpen) setEffectOpen(false);
    syncFooterHandle();
  }

  function setEffectOpen(open) {
    effectOpen = Boolean(open && isMobile());
    document.body.classList.toggle('viewer-effect-open', effectOpen);
    $('#effectFilterWrap')?.classList.remove('open');
    if (effectOpen) {
      setFiltersOpen(true);
      window.setTimeout(() => $('#effectFilterPanel input:checked')?.focus?.(), 0);
    }
  }

  function syncDrawerToggle() {
    const toggle = $('#viewerDeckDrawerToggle');
    if (!toggle) return;
    const open = document.body.classList.contains('viewer-deck-drawer-open');
    const state = open ? '1' : '0';
    if (toggle.dataset.open === state) return;
    toggle.dataset.open = state;
    toggle.textContent = open ? '›' : '‹';
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'デッキ一覧を閉じる' : 'デッキ一覧を開く');
  }

  function setDrawerOpen(open, pinned = false) {
    if (!isMobile()) open = false;
    drawerPinned = Boolean(open && pinned);
    window.clearTimeout(drawerPeekTimer);
    document.body.classList.toggle('viewer-deck-drawer-open', Boolean(open));
    document.body.classList.toggle('viewer-deck-drawer-pinned', drawerPinned);
    if (!open) document.body.classList.remove('viewer-deck-drawer-peek');
    syncDrawerToggle();
  }

  function peekDrawer() {
    if (!isMobile() || drawerPinned) return;
    document.body.classList.add('viewer-deck-drawer-open', 'viewer-deck-drawer-peek');
    syncDrawerToggle();
    window.clearTimeout(drawerPeekTimer);
    drawerPeekTimer = window.setTimeout(() => {
      document.body.classList.remove('viewer-deck-drawer-peek');
      if (!drawerPinned) document.body.classList.remove('viewer-deck-drawer-open');
      syncDrawerToggle();
    }, 1500);
  }

  function showDeckToast(id) {
    if (!isMobile()) return;
    const toast = $('#viewerDeckToast');
    if (!toast) return;
    const card = cardById(id);
    const qty = draftQuantity(id);
    const text = `${card?.name || `No.${idKey(id)}`} をデッキに追加${qty > 1 ? ` ×${qty}` : ''}`;
    if (toast.textContent !== text) toast.textContent = text;
    toast.classList.remove('show');
    void toast.offsetWidth;
    toast.classList.add('show');
    window.clearTimeout(Number(toast.dataset.timer || 0));
    const timer = window.setTimeout(() => toast.classList.remove('show'), 1400);
    toast.dataset.timer = String(timer);
    peekDrawer();
  }

  function syncDeckToggleVisibility() {
    const toggle = $('#viewerDeckDrawerToggle');
    if (!toggle) return;
    const visible = isMobile() && $('#cardsPanel')?.classList.contains('active');
    toggle.classList.toggle('is-hidden', !visible);
    if (!visible) setDrawerOpen(false, false);
  }

  function onScroll() {
    if (!isMobile()) return;
    const y = window.scrollY || 0;
    const header = $('.topbar');
    const topButton = $('#viewerBackToTop');
    if (topButton) topButton.classList.toggle('show', y > 520);

    const overlaysOpen = filterOpen || effectOpen || drawerPinned || document.body.classList.contains('modal-open');
    if (!overlaysOpen && header && y > 80 && y > lastScrollY + 1) {
      header.classList.add('viewer-header-scrolling');
    } else if (header && (y < lastScrollY - 1 || y < 80)) {
      header.classList.remove('viewer-header-scrolling');
    }
    lastScrollY = y;
    window.clearTimeout(scrollStopTimer);
    scrollStopTimer = window.setTimeout(() => {
      $('.topbar')?.classList.remove('viewer-header-scrolling');
      syncHeaderHeight();
    }, 130);
  }

  function handleAddFeedback(target) {
    if (!isMobile() || !target || target.getAttribute('aria-disabled') === 'true') return;
    const id = target.dataset.cardId;
    window.setTimeout(() => {
      if (draftQuantity(id) > 0) showDeckToast(id);
    }, 0);
  }

  function setupEvents() {
    document.addEventListener('click', event => {
      if (!isMobile()) return;

      const effectButton = event.target.closest?.('#effectFilterButton');
      if (effectButton) {
        event.preventDefault();
        event.stopPropagation();
        setEffectOpen(!effectOpen);
        return;
      }
      if (event.target.closest?.('#viewerEffectClose, #viewerEffectBackdrop')) {
        event.preventDefault();
        setEffectOpen(false);
        return;
      }
      if (event.target.closest?.('#viewerFooterHandle')) {
        event.preventDefault();
        setFiltersOpen(!filterOpen);
        return;
      }
      if (event.target.closest?.('#viewerFilterBackdrop')) {
        event.preventDefault();
        setFiltersOpen(false);
        return;
      }
      if (event.target.closest?.('#viewerDeckDrawerToggle')) {
        event.preventDefault();
        const open = document.body.classList.contains('viewer-deck-drawer-open');
        setDrawerOpen(!open, !open);
        return;
      }
      if (event.target.closest?.('#viewerBackToTop')) {
        event.preventDefault();
        $('.topbar')?.classList.remove('viewer-header-scrolling');
        window.scrollTo({ top:0, behavior:'smooth' });
        return;
      }
      const add = event.target.closest?.('.tile-add-btn[data-card-id]');
      if (add) {
        handleAddFeedback(add);
        return;
      }
      if (event.target.closest?.('#quickDeckOpen')) {
        window.setTimeout(() => setDrawerOpen(false, false), 0);
      }
      if (event.target.closest?.('.tab')) {
        window.setTimeout(() => {
          syncDeckToggleVisibility();
          setFiltersOpen(false);
          syncHeaderHeight();
        }, 0);
      }
    }, true);

    document.addEventListener('keydown', event => {
      if (!isMobile() || (event.key !== 'Enter' && event.key !== ' ')) return;
      const add = event.target.closest?.('.tile-add-btn[data-card-id]');
      if (add) handleAddFeedback(add);
    }, true);

    window.addEventListener('scroll', onScroll, { passive:true });
    window.addEventListener('resize', () => {
      syncHeaderHeight();
      syncDeckToggleVisibility();
    }, { passive:true });
    window.addEventListener('orientationchange', () => window.setTimeout(syncHeaderHeight, 120), { passive:true });
    media.addEventListener?.('change', () => {
      if (!isMobile()) {
        setFiltersOpen(false);
        setEffectOpen(false);
        setDrawerOpen(false, false);
        $('.topbar')?.classList.remove('viewer-header-scrolling');
      }
      ensureMobileChrome();
    });
  }

  function observeDynamicTargets() {
    if (!dynamicObserver) return;
    dynamicObserver.disconnect();
    dynamicObserver.observe(document.body, { childList:true, subtree:true });
  }

  function runDynamicSync() {
    dynamicScheduled = false;
    if (dynamicObserver) dynamicObserver.disconnect();
    try {
      ensureMobileChrome();
      syncDeckToggleVisibility();
    } finally {
      observeDynamicTargets();
    }
  }

  function scheduleDynamicSync() {
    if (dynamicScheduled) return;
    dynamicScheduled = true;
    requestAnimationFrame(runDynamicSync);
  }

  function observeDynamicUI() {
    if (dynamicObserver) dynamicObserver.disconnect();
    dynamicObserver = new MutationObserver(scheduleDynamicSync);
    observeDynamicTargets();
  }

  function start() {
    if (started) return;
    started = true;
    document.documentElement.classList.add('vn-mobile-v2');
    document.body?.classList.add('vn-mobile-v2');
    document.body?.classList.remove('viewer-deck-drawer-open', 'viewer-deck-drawer-pinned', 'viewer-deck-drawer-peek');
    drawerPinned = false;
    ensureMobileChrome();
    setupEvents();
    observeDynamicUI();
    onScroll();
    window.setTimeout(syncHeaderHeight, 80);
    window.setTimeout(syncHeaderHeight, 350);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once:true });
  } else {
    start();
  }
})();