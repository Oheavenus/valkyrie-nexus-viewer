// Public viewer mobile interaction layer.
// Public-only: compact filter sheet, effect overlay, deck drawer and mobile feedback.
(function () {
  if (!window.VN_PUBLIC_VIEWER) return;

  const media = window.matchMedia('(max-width: 760px)');
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const isMobile = () => media.matches;
  const idKey = v => String(v || '').padStart(3, '0');

  let filterOpen = false;
  let effectOpen = false;
  let drawerPinned = false;
  let drawerPeekTimer = 0;
  let scrollStopTimer = 0;
  let lastScrollY = window.scrollY || 0;
  let effectPlaceholder = null;
  let effectPanel = null;
  let started = false;

  document.documentElement.classList.add('vn-public-viewer');
  document.body?.classList.add('vn-public-viewer');

  function esc(v='') {
    return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function cardById(id) {
    try {
      const key = idKey(id);
      return Array.isArray(allCards) ? allCards.find(c => c.card_id === key) || null : null;
    } catch (_) { return null; }
  }

  function draftQuantity(id) {
    try {
      const key = idKey(id);
      return Number(window.VN_QUICK_DECK?.get?.().find(x => idKey(x.id) === key)?.qty || 0);
    } catch (_) { return 0; }
  }

  function syncPublicHeader() {
    const statsTab = $('.tab[data-tab="pulls"]');
    if (statsTab) statsTab.textContent = '所持統計';

    const tabs = $('.header-tabs');
    if (tabs && !$('#viewerCollectionReset')) {
      const reset = document.createElement('button');
      reset.id = 'viewerCollectionReset';
      reset.type = 'button';
      reset.className = 'viewer-header-reset';
      reset.textContent = '所持リセット';
      reset.title = 'このブラウザの所持状況をすべて0枚に戻す';
      tabs.appendChild(reset);
    }
  }

  function ensureEffectFilter() {
    const panel = $('#effectFilterPanel');
    if (!panel) return;
    effectPanel = panel;

    let ready = panel.querySelector('.effect-filter-options');
    if (!ready) {
      let cards = [];
      try { cards = Array.isArray(allCards) ? allCards : []; } catch (_) {}
      if (cards.length) {
        const counts = new Map();
        cards.forEach(card => {
          String(card.keywords || '').split(';').map(x => x.trim()).filter(Boolean)
            .forEach(k => counts.set(k, (counts.get(k) || 0) + 1));
        });
        const items = [...counts.entries()].sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'));
        panel.innerHTML = `<div class="effect-filter-head"><strong>効果で絞り込む</strong><div class="viewer-effect-head-actions"><button type="button" id="effectFilterClear">解除</button><button type="button" id="viewerEffectClose">閉じる</button></div></div>
          <div class="effect-filter-options">${items.map(([name,count]) => `<label><input type="checkbox" name="effectKeyword" value="${esc(name)}"><span>${esc(name)}</span><small>${count}</small></label>`).join('')}</div>`;
        panel.dataset.ready = '1';
      }
    }

    const head = panel.querySelector('.effect-filter-head');
    if (head && !$('#viewerEffectClose')) {
      const close = document.createElement('button');
      close.id = 'viewerEffectClose';
      close.className = 'viewer-effect-close';
      close.type = 'button';
      close.textContent = '閉じる';
      head.appendChild(close);
    }

    if (!panel.dataset.mobileBound) {
      panel.dataset.mobileBound = '1';
      panel.addEventListener('change', () => {
        updateEffectCount();
        try { if (typeof filterCards === 'function') filterCards(); } catch (_) {}
      });
    }
  }

  function updateEffectCount() {
    const n = $$('#effectFilterPanel input[name="effectKeyword"]:checked').length;
    const badge = $('#effectFilterCount');
    if (badge) badge.textContent = n ? String(n) : '';
    $('#effectFilterButton')?.classList.toggle('active', n > 0);
  }

  function mountEffectPanelToBody() {
    ensureEffectFilter();
    const panel = effectPanel || $('#effectFilterPanel');
    if (!panel || panel.parentElement === document.body) return;
    effectPlaceholder = document.createComment('effect-filter-placeholder');
    panel.parentNode.insertBefore(effectPlaceholder, panel);
    document.body.appendChild(panel);
  }

  function restoreEffectPanel() {
    const panel = effectPanel || $('#effectFilterPanel');
    if (!panel || !effectPlaceholder?.parentNode) return;
    effectPlaceholder.parentNode.insertBefore(panel, effectPlaceholder);
    effectPlaceholder.remove();
    effectPlaceholder = null;
  }

  function ensureChrome() {
    syncPublicHeader();
    ensureEffectFilter();

    const footer = $('.card-control-footer');
    if (footer && !$('#viewerFooterHandle')) {
      footer.id = footer.id || 'viewerFilterSheet';
      const handle = document.createElement('button');
      handle.id = 'viewerFooterHandle';
      handle.className = 'viewer-footer-handle';
      handle.type = 'button';
      handle.setAttribute('aria-controls', footer.id);
      handle.setAttribute('aria-expanded', 'false');
      handle.innerHTML = '<span aria-hidden="true">∧</span><b>絞り込み</b>';
      footer.prepend(handle);
    }

    if (!$('#viewerFilterBackdrop')) {
      document.body.insertAdjacentHTML('beforeend','<button id="viewerFilterBackdrop" class="viewer-filter-backdrop" type="button" aria-label="絞り込みを閉じる"></button>');
    }
    if (!$('#viewerEffectBackdrop')) {
      document.body.insertAdjacentHTML('beforeend','<button id="viewerEffectBackdrop" class="viewer-effect-backdrop" type="button" aria-label="効果フィルターを閉じる"></button>');
    }
    if (!$('#viewerDeckDrawerToggle')) {
      document.body.insertAdjacentHTML('beforeend','<button id="viewerDeckDrawerToggle" class="viewer-deck-drawer-toggle" type="button" aria-label="デッキ一覧を開く" aria-expanded="false">‹</button>');
    }
    if (!$('#viewerDeckToast')) {
      document.body.insertAdjacentHTML('beforeend','<div id="viewerDeckToast" class="viewer-deck-toast" role="status" aria-live="polite"></div>');
    }
    if (!$('#viewerBackToTop')) {
      document.body.insertAdjacentHTML('beforeend','<button id="viewerBackToTop" class="viewer-back-top" type="button" aria-label="一番上に戻る">↑</button>');
    }

    syncHeaderHeight();
    syncFooterHandle();
    syncDrawerToggle();
    syncDeckToggleVisibility();
  }

  function syncHeaderHeight() {
    if (!isMobile()) {
      document.documentElement.style.removeProperty('--vn-mobile-header-h');
      return;
    }
    const header = $('.topbar');
    if (!header) return;
    const h = Math.ceil(header.getBoundingClientRect().height);
    if (h > 0) document.documentElement.style.setProperty('--vn-mobile-header-h', `${h}px`);
  }

  function syncFooterHandle() {
    const handle = $('#viewerFooterHandle');
    if (!handle) return;
    handle.setAttribute('aria-expanded', filterOpen ? 'true' : 'false');
    handle.innerHTML = filterOpen
      ? '<span aria-hidden="true">∨</span><b>閉じる</b>'
      : '<span aria-hidden="true">∧</span><b>絞り込み</b>';
  }

  function setFiltersOpen(open) {
    filterOpen = Boolean(open && isMobile());
    document.body.classList.toggle('viewer-filters-open', filterOpen);
    if (!filterOpen && effectOpen) setEffectOpen(false);
    syncFooterHandle();
  }

  function setEffectOpen(open) {
    effectOpen = Boolean(open && isMobile());
    if (effectOpen) {
      if (!filterOpen) setFiltersOpen(true);
      mountEffectPanelToBody();
      document.body.classList.add('viewer-effect-open');
      $('#effectFilterWrap')?.classList.remove('open');
    } else {
      document.body.classList.remove('viewer-effect-open');
      restoreEffectPanel();
    }
  }

  function syncDrawerToggle() {
    const toggle = $('#viewerDeckDrawerToggle');
    if (!toggle) return;
    const open = document.body.classList.contains('viewer-deck-drawer-open');
    toggle.textContent = open ? '›' : '‹';
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'デッキ一覧を閉じる' : 'デッキ一覧を開く');
  }

  function setDrawerOpen(open, pinned=false) {
    const actual = Boolean(open && isMobile());
    drawerPinned = Boolean(actual && pinned);
    clearTimeout(drawerPeekTimer);
    document.body.classList.toggle('viewer-deck-drawer-open', actual);
    document.body.classList.toggle('viewer-deck-drawer-pinned', drawerPinned);
    document.body.classList.remove('viewer-deck-drawer-peek');
    syncDrawerToggle();
  }

  function peekDrawer() {
    if (!isMobile() || drawerPinned) return;
    document.body.classList.add('viewer-deck-drawer-open','viewer-deck-drawer-peek');
    syncDrawerToggle();
    clearTimeout(drawerPeekTimer);
    drawerPeekTimer = setTimeout(() => {
      document.body.classList.remove('viewer-deck-drawer-peek','viewer-deck-drawer-open');
      syncDrawerToggle();
    }, 1250);
  }

  function showDeckToast(id) {
    if (!isMobile()) return;
    const toast = $('#viewerDeckToast');
    if (!toast) return;
    const card = cardById(id);
    const qty = draftQuantity(id);
    toast.textContent = `${card?.name || `No.${idKey(id)}`} をデッキに追加${qty > 1 ? ` ×${qty}` : ''}`;
    toast.classList.remove('show');
    void toast.offsetWidth;
    toast.classList.add('show');
    clearTimeout(Number(toast.dataset.timer || 0));
    toast.dataset.timer = String(setTimeout(() => toast.classList.remove('show'), 1300));
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
    $('#viewerBackToTop')?.classList.toggle('show', y > 500);

    const overlayOpen = filterOpen || effectOpen || drawerPinned || document.body.classList.contains('modal-open');
    if (!overlayOpen && header && y > 90 && y > lastScrollY + 1) {
      header.classList.add('viewer-header-scrolling');
    } else if (header && (y < lastScrollY - 1 || y < 90)) {
      header.classList.remove('viewer-header-scrolling');
    }
    lastScrollY = y;
    clearTimeout(scrollStopTimer);
    scrollStopTimer = setTimeout(() => {
      header?.classList.remove('viewer-header-scrolling');
      syncHeaderHeight();
    }, 140);
  }

  function handleReset() {
    if (!confirm('このブラウザに登録した所持状況をすべて0枚に戻しますか？')) return;
    if (window.VN_VIEWER_COLLECTION?.reset) {
      window.VN_VIEWER_COLLECTION.reset();
    } else {
      try { localStorage.removeItem('vn-viewer-collection-v1'); } catch (_) {}
      location.reload();
    }
  }

  function setupEvents() {
    document.addEventListener('click', event => {
      if (!isMobile()) return;

      if (event.target.closest?.('#effectFilterButton')) {
        event.preventDefault();
        event.stopPropagation();
        setEffectOpen(!effectOpen);
        return;
      }
      if (event.target.closest?.('#viewerEffectClose,#viewerEffectBackdrop')) {
        event.preventDefault();
        event.stopPropagation();
        setEffectOpen(false);
        return;
      }
      if (event.target.closest?.('#effectFilterClear')) {
        event.preventDefault();
        $$('#effectFilterPanel input[name="effectKeyword"]:checked').forEach(x => { x.checked = false; });
        updateEffectCount();
        try { if (typeof filterCards === 'function') filterCards(); } catch (_) {}
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
        window.scrollTo({top:0,behavior:'smooth'});
        return;
      }
      if (event.target.closest?.('#viewerCollectionReset')) {
        event.preventDefault();
        event.stopPropagation();
        handleReset();
        return;
      }

      const add = event.target.closest?.('.tile-add-btn[data-card-id]');
      if (add && add.getAttribute('aria-disabled') !== 'true') {
        const id = add.dataset.cardId;
        setTimeout(() => { if (draftQuantity(id) > 0) showDeckToast(id); }, 0);
        return;
      }

      if (event.target.closest?.('.tab')) {
        setTimeout(() => {
          syncPublicHeader();
          syncDeckToggleVisibility();
          setFiltersOpen(false);
          syncHeaderHeight();
        }, 0);
      }
    }, true);

    window.addEventListener('scroll', onScroll, {passive:true});
    window.addEventListener('resize', () => {
      syncHeaderHeight();
      syncDeckToggleVisibility();
      if (!isMobile()) {
        setEffectOpen(false);
        setFiltersOpen(false);
        setDrawerOpen(false,false);
      }
    }, {passive:true});

    media.addEventListener?.('change', () => {
      if (!isMobile()) {
        setEffectOpen(false);
        setFiltersOpen(false);
        setDrawerOpen(false,false);
        $('.topbar')?.classList.remove('viewer-header-scrolling');
      }
      ensureChrome();
    });
  }

  function start() {
    if (started) return;
    started = true;
    document.documentElement.classList.add('vn-mobile-v2');
    document.body?.classList.add('vn-public-viewer','vn-mobile-v2');
    document.body?.classList.remove('viewer-deck-drawer-open','viewer-deck-drawer-pinned','viewer-deck-drawer-peek');

    ensureChrome();
    setupEvents();
    onScroll();

    // No full-page MutationObserver here: it caused avoidable render churn on phones.
    [80,300,800,1600].forEach(ms => setTimeout(() => {
      ensureChrome();
      ensureEffectFilter();
      syncPublicHeader();
      syncHeaderHeight();
    }, ms));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, {once:true});
  } else {
    start();
  }
})();