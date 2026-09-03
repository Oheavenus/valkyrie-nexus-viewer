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

// Public viewer statistics:
// A collection is complete only when every card is owned at the 3-copy cap.
// "Owned kinds" remains a separate unique-card coverage metric.
(function () {
  if (!window.VN_PUBLIC_VIEWER) return;

  const MAX_COPIES = 3;
  const RARITIES = ['N', 'R', 'SR', 'UR'];
  const TYPES = ['ユニット', 'アーツ'];
  let scheduled = false;
  let observer = null;

  function pct(value, max) {
    return max > 0 ? (Number(value || 0) / max) * 100 : 0;
  }

  function pctText(value) {
    return (Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, '');
  }

  function ratio(copies, kinds) {
    const maxCopies = Number(kinds || 0) * MAX_COPIES;
    const percent = pct(copies, maxCopies);
    return `${Number(copies || 0)} / ${maxCopies} (${pctText(percent)}%)`;
  }

  function applyThreeCopyCompletion() {
    scheduled = false;
    const api = window.VN_VIEWER_COLLECTION;
    const panel = document.querySelector('#pullsPanel');
    if (!api?.stats || !panel) return;

    const stats = api.stats();
    const maxTotalCopies = Number(stats.totalKinds || 0) * MAX_COPIES;
    const completion = pct(stats.totalCopies, maxTotalCopies);

    const overviewCards = [...panel.querySelectorAll('.viewer-stat-card')];
    const completionCard = overviewCards.find(card => card.querySelector('span')?.textContent?.trim() === 'コンプリート率');
    if (completionCard) {
      const value = completionCard.querySelector('b');
      if (value) value.textContent = `${pctText(completion)}%`;
      completionCard.title = `全${maxTotalCopies}枚（各カード3枚）のうち ${Number(stats.totalCopies || 0)}枚`;
    }

    RARITIES.forEach(rarity => {
      const data = stats.rarity?.[rarity];
      const card = panel.querySelector(`.viewer-rarity-card.rarity-${rarity}`);
      if (!data || !card) return;
      const maxCopies = Number(data.total || 0) * MAX_COPIES;
      const percent = pct(data.copies, maxCopies);
      const value = card.querySelector('.viewer-rarity-head b');
      const bar = card.querySelector('.viewer-progress span');
      if (value) value.textContent = ratio(data.copies, data.total);
      if (bar) bar.style.width = `${percent}%`;
      card.title = `${rarity}は全${maxCopies}枚（各3枚）のうち ${Number(data.copies || 0)}枚所持`;
    });

    const typeCards = [...panel.querySelectorAll('.viewer-type-card')];
    TYPES.forEach((type, index) => {
      const data = stats.type?.[type];
      const card = typeCards[index];
      if (!data || !card) return;
      const value = card.querySelector('b');
      if (value) value.textContent = ratio(data.copies, data.total);
      card.title = `全${Number(data.total || 0) * MAX_COPIES}枚（各3枚）のうち ${Number(data.copies || 0)}枚所持`;
    });
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(applyThreeCopyCompletion);
  }

  function start() {
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList:true, subtree:true });
    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();

// v1.1.2 official terminology / rule clarification layer.
// Keep stored DB values as ユニット / アーツ and make the visible dashboard
// match the terminology used by the current in-game card list.
(function () {
  let scheduled = false;
  let observer = null;

  function cardById(id) {
    try {
      const key = String(id || '').padStart(3, '0');
      return Array.isArray(allCards) ? allCards.find(card => card.card_id === key) || null : null;
    } catch (_) {
      return null;
    }
  }

  function officialTypeLabel(card) {
    if (card?.type === 'ユニット') return 'ユニット';
    if (card?.type === 'アーツ') return 'アーツ';
    return '—';
  }

  // app.js defines this as a global function; replace the informal labels for
  // future renders while retaining the underlying type values.
  try { typeLabel = officialTypeLabel; } catch (_) {}
  window.VN_RULE_NOTES = Object.freeze({
    ...(window.VN_RULE_NOTES || {}),
    '狙撃': '攻撃時に反撃を受けない。ver1.1.2で命中時の「反撃回避!」表示と行動ログが追加され、挙動が明確化された。'
  });

  function setTextIfDifferent(node, text) {
    if (node && node.textContent !== text) node.textContent = text;
  }

  function patchTypeFilter() {
    const unit = document.querySelector('#typeFilter input[value="ユニット"] + span');
    const arts = document.querySelector('#typeFilter input[value="アーツ"] + span');
    setTextIfDifferent(unit, 'ユニット');
    setTextIfDifferent(arts, 'アーツ');
  }

  function patchRenderedCards() {
    document.querySelectorAll('.type-badge').forEach(badge => {
      if (badge.classList.contains('minion')) {
        setTextIfDifferent(badge, 'ユニット');
        badge.title = 'ユニット：ゲーム内では剣（ATK）とハート（HP）で識別';
      } else if (badge.classList.contains('spell')) {
        setTextIfDifferent(badge, 'アーツ');
        badge.title = 'アーツ：ゲーム内では紫の宝石アイコンで識別';
      }
    });

    document.querySelectorAll('.card-tile[data-card-id]').forEach(tile => {
      const card = cardById(tile.dataset.cardId);
      const row = tile.querySelector('.tile-stat-row');
      if (!card || !row) return;
      const parts = row.children;
      if (parts[0]) setTextIfDifferent(parts[0], officialTypeLabel(card));
      if (card.type === 'アーツ' && parts[2] && parts[2].textContent === 'スペル') {
        parts[2].textContent = 'アーツ';
      }
    });
  }

  function patchViewerStatsLabels() {
    document.querySelectorAll('.viewer-type-card > span').forEach(label => {
      const text = label.textContent?.trim();
      if (text === 'ミニオン') label.textContent = 'ユニット';
      if (text === 'スペル') label.textContent = 'アーツ';
    });
  }

  function patchSniperRuleNote() {
    const body = document.querySelector('#cardModalBody');
    if (!body) return;
    const match = body.querySelector('.modal-kicker')?.textContent?.match(/No\.(\d+)/);
    const card = match ? cardById(match[1]) : null;
    const details = body.querySelector('.card-details');
    const existing = body.querySelector('.official-v112-sniper-note');

    if (!card || !details || !(card.keywords || '').split(/[;,、]/).map(v => v.trim()).includes('狙撃')) {
      existing?.remove();
      return;
    }
    if (existing) return;

    const dt = document.createElement('dt');
    dt.className = 'official-v112-sniper-note';
    dt.textContent = 'ルール補足';
    const dd = document.createElement('dd');
    dd.className = 'official-v112-sniper-note';
    dd.textContent = window.VN_RULE_NOTES['狙撃'];
    details.append(dt, dd);
  }

  function patch() {
    scheduled = false;
    patchTypeFilter();
    patchRenderedCards();
    patchViewerStatsLabels();
    patchSniperRuleNote();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(patch);
  }

  function start() {
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList:true, subtree:true });
    patch();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
