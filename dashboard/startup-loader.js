(function () {
  const overlay = document.getElementById('startupLoader');
  const bar = document.getElementById('startupLoaderBar');
  const text = document.getElementById('startupLoaderText');
  const progress = document.getElementById('startupLoaderProgress');
  if (!overlay || !bar || !text || !progress) return;

  document.body.setAttribute('aria-busy', 'true');

  let finished = false;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function setProgress(done, total, label) {
    const ratio = total > 0 ? Math.min(1, done / total) : 0;
    bar.style.width = `${Math.round(ratio * 100)}%`;
    progress.textContent = total > 0
      ? `${done} / ${total}  (${Math.round(ratio * 100)}%)`
      : '準備中…';
    if (label) text.textContent = label;
  }

  function finish(label = '準備完了') {
    if (finished) return;
    finished = true;
    clearTimeout(failSafeTimer);
    bar.style.width = '100%';
    progress.textContent = '100%';
    text.textContent = label;
    document.body.removeAttribute('aria-busy');
    requestAnimationFrame(() => {
      overlay.classList.add('is-complete');
      setTimeout(() => overlay.remove(), 260);
    });
  }

  function absoluteUrl(value) {
    if (!value) return '';
    try { return new URL(value, document.baseURI).href; }
    catch (_) { return value; }
  }

  async function waitForGalleryRender() {
    let previous = '';
    let stable = 0;

    for (let i = 0; i < 100; i++) {
      await sleep(50);
      const tiles = document.querySelectorAll('#cardsGallery .card-tile').length;
      const images = document.querySelectorAll('#cardsGallery img.card-source-image').length;
      const signature = `${tiles}:${images}`;

      if (tiles > 0 && signature === previous) stable += 1;
      else stable = 0;

      previous = signature;
      if (tiles > 0 && stable >= 4) return;
    }
  }

  function collectAssets() {
    const assets = new Map();
    const nodes = document.querySelectorAll('#cardsGallery img.card-source-image');

    nodes.forEach(node => {
      const primary = absoluteUrl(node.getAttribute('src'));
      const fallback = absoluteUrl(node.dataset.fallbackSrc || '');
      if (!primary) return;
      const key = `${primary}\n${fallback}`;
      if (!assets.has(key)) assets.set(key, { primary, fallback });
    });

    const sprite = absoluteUrl(window.VN_CARD_SPRITE || '');
    if (sprite && !sprite.startsWith('data:')) {
      const key = `${sprite}\n`;
      if (!assets.has(key)) assets.set(key, { primary: sprite, fallback: '' });
    }

    return [...assets.values()];
  }

  function preloadAsset(asset) {
    return new Promise(resolve => {
      const img = new Image();
      let settled = false;

      const done = async () => {
        if (settled) return;
        settled = true;
        try {
          if (typeof img.decode === 'function') await img.decode();
        } catch (_) {}
        resolve();
      };

      const load = (src, fallback) => {
        img.onload = done;
        img.onerror = () => {
          if (fallback) load(fallback, '');
          else done();
        };
        img.src = src;
      };

      load(asset.primary, asset.fallback);
    });
  }

  async function preloadAssets(assets) {
    if (!assets.length) return;

    let cursor = 0;
    let done = 0;
    const concurrency = Math.min(12, assets.length);
    setProgress(0, assets.length, 'カード画像を読み込んでいます…');

    async function worker() {
      while (true) {
        const index = cursor++;
        if (index >= assets.length) return;
        await preloadAsset(assets[index]);
        done += 1;
        setProgress(done, assets.length, 'カード画像を読み込んでいます…');
      }
    }

    await Promise.all(Array.from({ length: concurrency }, worker));
  }

  async function settleGalleryImages() {
    const images = [...document.querySelectorAll('#cardsGallery img.card-source-image')];
    if (!images.length) return;

    text.textContent = 'カード画像を表示用に準備しています…';

    images.forEach(img => {
      img.loading = 'eager';
      img.setAttribute('fetchpriority', 'high');
    });

    await Promise.allSettled(images.map(async img => {
      const deadline = Date.now() + 5000;
      while (img.isConnected && !img.complete && Date.now() < deadline) {
        await sleep(40);
      }
      try {
        if (img.isConnected && typeof img.decode === 'function') await img.decode();
      } catch (_) {}
    }));
  }

  async function start() {
    try {
      await waitForGalleryRender();
      const assets = collectAssets();
      await preloadAssets(assets);
      await settleGalleryImages();
      finish('準備完了');
    } catch (error) {
      console.error('Startup loader failed:', error);
      finish('読み込みを継続しながら表示します');
    }
  }

  const failSafeTimer = setTimeout(() => {
    finish('読み込みを継続しながら表示します');
  }, 20000);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();

(function () {
  try {
    const craftCostKey = 'vn-craft-costs-v1';
    if (localStorage.getItem(craftCostKey) === null) {
      localStorage.setItem(craftCostKey, JSON.stringify({ R: 5, SR: 30, UR: 150 }));
    }
  } catch (_) {}

  if (document.querySelector('script[data-vn-deck-library-v2]')) return;
  const script = document.createElement('script');
  script.src = 'deck-library-v2.js';
  script.dataset.vnDeckLibraryV2 = '1';
  document.head.appendChild(script);
})();

(function () {
  if (window.VN_DECK_LAYOUT_V3) return;
  window.VN_DECK_LAYOUT_V3 = 1;

  const layoutCss = `
#decksPanel .deck-intro,#decksPanel #decksContainer{display:none!important}
#decksPanel #draftDeckPanel,
#decksPanel #savedDeckLibrary .saved-deck-card{
  display:grid!important;
  grid-template-columns:minmax(640px,min(48vw,800px)) minmax(0,1fr)!important;
  grid-template-rows:auto minmax(0,1fr)!important;
  grid-template-areas:"cards head" "cards info"!important;
  min-height:445px!important;
  max-height:none!important;
  align-items:stretch!important;
  overflow:hidden!important;
}
#decksPanel #draftDeckPanel .draft-mini-grid,
#decksPanel #savedDeckLibrary .saved-deck-card>.deck-copy-grid{
  grid-area:cards!important;
  width:100%!important;
  height:auto!important;
  box-sizing:border-box!important;
  align-self:center!important;
  justify-self:stretch!important;
  grid-template-columns:repeat(10,minmax(0,1fr))!important;
  grid-template-rows:repeat(3,auto)!important;
  gap:3px!important;
  padding:12px!important;
  background:#0d1223!important;
}
#decksPanel #draftDeckPanel .draft-mini-card,
#decksPanel #savedDeckLibrary .saved-deck-card .deck-copy-card{
  position:relative!important;
  width:100%!important;
  height:auto!important;
  min-width:0!important;
  min-height:0!important;
  aspect-ratio:8/13!important;
}
#decksPanel #draftDeckPanel .draft-compact-head,
#decksPanel #savedDeckLibrary .saved-deck-card>.deck-compact-head{
  grid-area:head!important;
  min-height:142px!important;
  padding:16px 18px 13px!important;
  align-content:start!important;
  box-sizing:border-box!important;
}
#decksPanel #draftDeckPanel>.v2analytics,
#decksPanel #savedDeckLibrary .saved-deck-card>.v2analytics{
  grid-area:info!important;
  display:grid!important;
  grid-template-columns:minmax(340px,1.05fr) minmax(280px,.95fr)!important;
  gap:14px!important;
  min-height:286px!important;
  padding:14px 16px 16px!important;
  box-sizing:border-box!important;
  align-self:stretch!important;
}
#decksPanel #draftDeckPanel>.draft-v4-curve,
#decksPanel #draftDeckPanel>.deck-info-side,
#decksPanel #savedDeckLibrary .saved-deck-card>.deck-info-side{display:none!important}
#decksPanel #draftDeckPanel>.v2analytics .v2d,
#decksPanel #savedDeckLibrary .saved-deck-card>.v2analytics .v2d{width:96px!important;height:96px!important}
#decksPanel #draftDeckPanel>.v2analytics .v2d:after,
#decksPanel #savedDeckLibrary .saved-deck-card>.v2analytics .v2d:after{inset:21px!important}
#decksPanel #draftDeckPanel>.v2analytics .v2dw,
#decksPanel #savedDeckLibrary .saved-deck-card>.v2analytics .v2dw{gap:5px!important;font-size:10px!important}
#decksPanel #draftDeckPanel>.v2analytics .v2dw>strong,
#decksPanel #savedDeckLibrary .saved-deck-card>.v2analytics .v2dw>strong{font-size:11px!important}
#decksPanel #draftDeckPanel>.v2analytics .v2legend,
#decksPanel #savedDeckLibrary .saved-deck-card>.v2analytics .v2legend{gap:7px!important;font-size:9.5px!important}
.v3-type-donut .v2legend span{padding:2px 5px!important;border-radius:5px!important;border:1px solid #313d61!important;background:#151d34!important}
.v3-type-donut .v2legend span:first-child{border-color:#2c9b78!important;background:#133a32!important;color:#7ce4bf!important}
.v3-type-donut .v2legend span:last-child{border-color:#945bd0!important;background:#302046!important;color:#d2a9ff!important}
.v3-card-type{
  position:absolute!important;right:3px!important;top:3px!important;z-index:8!important;
  padding:2px 4px!important;border-radius:5px!important;border:1px solid rgba(255,255,255,.42)!important;
  box-shadow:0 1px 4px rgba(0,0,0,.6)!important;color:#fff!important;
  font-size:8px!important;font-weight:900!important;line-height:1.2!important;white-space:nowrap!important;
  pointer-events:none!important;text-shadow:0 1px 2px #000!important;
}
.v3-card-type.unit{background:rgba(25,126,99,.94)!important}
.v3-card-type.arts{background:rgba(121,67,184,.95)!important}
@media(max-width:1399px){
  #decksPanel #draftDeckPanel,#decksPanel #savedDeckLibrary .saved-deck-card{
    grid-template-columns:minmax(590px,47vw) minmax(0,1fr)!important;
    min-height:420px!important;
  }
  #decksPanel #draftDeckPanel>.v2analytics,#decksPanel #savedDeckLibrary .saved-deck-card>.v2analytics{
    grid-template-columns:minmax(300px,1fr) minmax(250px,.9fr)!important;gap:10px!important;padding:12px!important;
  }
  #decksPanel #draftDeckPanel>.v2analytics .v2d,#decksPanel #savedDeckLibrary .saved-deck-card>.v2analytics .v2d{width:86px!important;height:86px!important}
  #decksPanel #draftDeckPanel>.v2analytics .v2d:after,#decksPanel #savedDeckLibrary .saved-deck-card>.v2analytics .v2d:after{inset:19px!important}
}
`;

  function ensureStyle() {
    let style = document.getElementById('vnDeckLayoutV3Style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'vnDeckLayoutV3Style';
      style.textContent = layoutCss;
    }
    if (style.parentNode !== document.head || document.head.lastElementChild !== style) {
      document.head.appendChild(style);
    }
  }

  function cardById(id) {
    try {
      return typeof allCards !== 'undefined' && Array.isArray(allCards)
        ? allCards.find(c => c.card_id === String(id || '').padStart(3, '0')) || null
        : null;
    } catch (_) { return null; }
  }

  function decorateTypeBadges() {
    document.querySelectorAll('#draftDeckPanel .draft-mini-card[data-card-id],#savedDeckLibrary .saved-deck-card .deck-copy-card[data-card-id]').forEach(el => {
      const card = cardById(el.dataset.cardId);
      if (!card || (card.type !== 'ユニット' && card.type !== 'アーツ')) return;
      let badge = el.querySelector(':scope>.v3-card-type');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'v3-card-type';
        el.appendChild(badge);
      }
      badge.classList.toggle('unit', card.type === 'ユニット');
      badge.classList.toggle('arts', card.type === 'アーツ');
      badge.textContent = card.type;
      badge.title = card.type;
    });
  }

  function clarifyTypeDonut() {
    document.querySelectorAll('#decksPanel .v2dw').forEach(block => {
      const title = block.querySelector(':scope>strong');
      if (!title || title.textContent.trim() !== 'ユニット / アーツ') return;
      title.textContent = 'カード種別';
      block.classList.add('v3-type-donut');
      const spans = block.querySelectorAll('.v2legend span');
      spans.forEach(span => {
        span.textContent = span.textContent.replace(/^U\s+/, 'ユニット ').replace(/^A\s+/, 'アーツ ');
      });
    });
  }

  let queued = false;
  function refresh() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      ensureStyle();
      decorateTypeBadges();
      clarifyTypeDonut();
    });
  }

  function start() {
    ensureStyle();
    const panel = document.getElementById('decksPanel');
    if (panel) new MutationObserver(refresh).observe(panel, { childList:true, subtree:true, attributes:true, attributeFilter:['hidden'] });
    refresh();
    setTimeout(refresh, 120);
    setTimeout(refresh, 500);
    setTimeout(refresh, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();

(function () {
  function installPublicWatermark() {
    if (!window.VN_PUBLIC_VIEWER) return;
    if (document.querySelector('link[data-vn-viewer-watermark]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'viewer-watermark.css';
    link.dataset.vnViewerWatermark = '1';
    document.head.appendChild(link);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installPublicWatermark, { once:true });
  } else {
    setTimeout(installPublicWatermark, 0);
  }
})();
