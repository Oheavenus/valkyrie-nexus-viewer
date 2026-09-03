// Presentation layer for the browser-local quick deck.
// Keeps the existing storage/interaction model intact, but renders the right
// sidebar in Cost order with cropped card art behind each row.
(function () {
  let scheduled = false;
  let observing = false;

  function getCard(id) {
    try {
      if (typeof allCards !== 'undefined' && Array.isArray(allCards)) {
        return allCards.find(c => c.card_id === String(id).padStart(3, '0')) || null;
      }
    } catch (_) {}
    return null;
  }

  function cardCost(card) {
    const raw = card?.cost;
    if (raw === '' || raw === null || raw === undefined) return 99;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 99;
  }

  function rarityClass(card) {
    const r = String(card?.rarity || 'N').replace(/[^A-Z]/g, '');
    return `rarity-${r || 'N'}`;
  }

  function ensureRowArt(row) {
    const id = row.dataset.cardId;
    const card = getCard(id);
    row.classList.remove('rarity-N', 'rarity-R', 'rarity-SR', 'rarity-UR');
    row.classList.add(rarityClass(card));

    row.querySelector('.quick-deck-thumb')?.remove();
    let art = row.querySelector('.quick-deck-row-art');
    if (!art) {
      art = document.createElement('div');
      art.className = 'quick-deck-row-art';
      try {
        if (typeof cardArtHTML === 'function') art.innerHTML = cardArtHTML(id, 'thumb');
      } catch (_) {}
      row.prepend(art);
    }
  }

  function sortRowsByCost(list) {
    const rows = [...list.querySelectorAll('.quick-deck-row[data-card-id]')];
    if (rows.length < 2) return;
    const sorted = [...rows].sort((a, b) => {
      const ac = getCard(a.dataset.cardId);
      const bc = getCard(b.dataset.cardId);
      return cardCost(ac) - cardCost(bc) || String(a.dataset.cardId).localeCompare(String(b.dataset.cardId));
    });
    if (rows.every((row, i) => row === sorted[i])) return;
    const frag = document.createDocumentFragment();
    sorted.forEach(row => frag.appendChild(row));
    list.appendChild(frag);
  }

  function polish() {
    scheduled = false;
    const list = document.querySelector('#quickDeckList');
    if (!list) return;
    list.querySelectorAll('.quick-deck-row[data-card-id]').forEach(ensureRowArt);
    sortRowsByCost(list);

    const foot = document.querySelector('.quick-deck-foot span:last-child');
    if (foot) foot.textContent = 'Cost順 / ＋ − で枚数変更';
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(polish);
  }

  function start() {
    const list = document.querySelector('#quickDeckList');
    if (!list) return false;
    if (!observing) {
      observing = true;
      new MutationObserver(schedule).observe(list, { childList: true });
    }
    schedule();
    setTimeout(schedule, 120);
    setTimeout(schedule, 500);
    return true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (!start()) setTimeout(start, 60);
    }, { once: true });
  } else if (!start()) {
    setTimeout(start, 60);
  }
})();
