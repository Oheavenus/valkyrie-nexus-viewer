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