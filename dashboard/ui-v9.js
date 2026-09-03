// V9 performance layer: render only the visible card view and coalesce filter updates.
(function () {
  let scheduled = false;
  let imageCount = null;
  let gallerySignature = '';
  let tableSignature = '';

  function signature(rows) {
    // Include owned count so browser-local collection edits can refresh the
    // visible card without forcing a full filter/view reset.
    return rows.map(card => `${card.card_id}:${Number(card.count || 0)}`).join(',');
  }

  function updateViewButtons(thumbnail) {
    const gallery = document.querySelector('#cardsGallery');
    const table = document.querySelector('#cardsTableView');
    const thumbButton = document.querySelector('#thumbnailViewBtn');
    const detailButton = document.querySelector('#detailViewBtn');
    if (gallery) gallery.hidden = !thumbnail;
    if (table) table.hidden = thumbnail;
    if (thumbButton) {
      thumbButton.classList.toggle('active', thumbnail);
      thumbButton.setAttribute('aria-pressed', thumbnail ? 'true' : 'false');
    }
    if (detailButton) {
      detailButton.classList.toggle('active', !thumbnail);
      detailButton.setAttribute('aria-pressed', thumbnail ? 'false' : 'true');
    }
  }

  function renderVisibleCardView() {
    scheduled = false;
    if (!Array.isArray(allCards) || !allCards.length) return;

    const rows = filteredCards();
    const thumbnail = cardViewMode !== 'detail';
    const gallery = document.querySelector('#cardsGallery');
    const tableBody = document.querySelector('#cardsBody');
    const key = signature(rows);

    if (imageCount === null) {
      imageCount = allCards.reduce((count, card) => count + (hasCardImage(card.card_id) ? 1 : 0), 0);
    }
    const count = document.querySelector('#cardCount');
    if (count) count.textContent = `${rows.length}枚表示 / 全${allCards.length}枚 / 画像登録 ${imageCount}枚`;

    updateViewButtons(thumbnail);
    if (thumbnail) {
      if (tableBody?.childNodes.length) tableBody.replaceChildren();
      tableSignature = '';
      if (gallery && (gallerySignature !== key || !gallery.childElementCount)) {
        gallery.innerHTML = rows.map(cardTileHTML).join('');
        gallerySignature = key;
      }
    } else {
      if (gallery?.childNodes.length) gallery.replaceChildren();
      gallerySignature = '';
      if (tableBody && (tableSignature !== key || !tableBody.childElementCount)) {
        tableBody.innerHTML = rows.map(cardRowHTML).join('');
        tableSignature = key;
      }
    }
  }

  filterCards = function () {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(renderVisibleCardView);
  };

  setCardViewMode = function (mode) {
    cardViewMode = mode === 'detail' ? 'detail' : 'thumbnail';
    saveViewMode(cardViewMode);
    updateViewButtons(cardViewMode === 'thumbnail');
    filterCards();
  };
})();

// Collection statistics patch:
// The percentage shown beside each rarity/type represents its share of the
// cards actually owned, not completion against the entire card pool.
(function () {
  const RARITIES = ['N', 'R', 'SR', 'UR'];
  const TYPES = ['ユニット', 'アーツ'];
  let scheduled = false;
  let observer = null;

  function pctText(value) {
    return String(Math.round(value * 10) / 10);
  }

  function sharePercent(copies, totalCopies) {
    return totalCopies > 0 ? (Number(copies || 0) / totalCopies) * 100 : 0;
  }

  function applyOwnedSharePercentages() {
    scheduled = false;
    const api = window.VN_VIEWER_COLLECTION;
    const panel = document.querySelector('#pullsPanel');
    if (!api?.stats || !panel) return;

    const stats = api.stats();
    const totalCopies = Number(stats.totalCopies || 0);

    RARITIES.forEach(rarity => {
      const data = stats.rarity?.[rarity];
      const card = panel.querySelector(`.viewer-rarity-card.rarity-${rarity}`);
      if (!data || !card) return;
      const pct = sharePercent(data.copies, totalCopies);
      const label = `${data.owned} / ${data.total} (${pctText(pct)}%)`;
      const value = card.querySelector('.viewer-rarity-head b');
      const bar = card.querySelector('.viewer-progress span');
      if (value && value.textContent !== label) value.textContent = label;
      if (bar && bar.style.width !== `${pct}%`) bar.style.width = `${pct}%`;
      card.title = `総所持${totalCopies}枚のうち ${data.copies}枚 (${pctText(pct)}%)`;
    });

    const typeCards = [...panel.querySelectorAll('.viewer-type-card')];
    TYPES.forEach((type, index) => {
      const data = stats.type?.[type];
      const card = typeCards[index];
      if (!data || !card) return;
      const pct = sharePercent(data.copies, totalCopies);
      const label = `${data.owned} / ${data.total} (${pctText(pct)}%)`;
      const value = card.querySelector('b');
      if (value && value.textContent !== label) value.textContent = label;
      card.title = `総所持${totalCopies}枚のうち ${data.copies}枚 (${pctText(pct)}%)`;
    });
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(applyOwnedSharePercentages);
  }

  function start() {
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList:true, subtree:true });
    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();