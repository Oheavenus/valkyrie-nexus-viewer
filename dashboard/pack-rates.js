// Official rarity rates shown in the in-game 排出率 panel, verified 2026-09-03.
window.VN_OFFICIAL_PACK_RATES = Object.freeze({
  N: 41.27,
  R: 40.48,
  SR: 16.67,
  UR: 1.59
});
window.VN_OFFICIAL_PACK_RATE_SOURCE = 'ゲーム内「排出率」画面 / 2026-09-03';

// Shared lightweight presentation layer:
// - keeps the dashboard favicon aligned with the current VN emblem
// - makes cards/copies that are currently treated as unowned visually distinct
(function () {
  const FAVICON = 'data:image/png;base64,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';

  function installBranding() {
    let link = document.querySelector('link[rel~="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = 'image/png';
    link.sizes = '32x32';
    link.href = FAVICON;
  }

  function installOwnershipStyle() {
    if (document.getElementById('vnOwnershipVisualStyle')) return;
    const style = document.createElement('style');
    style.id = 'vnOwnershipVisualStyle';
    style.textContent = `
.card-tile:has(.tile-owned.missing) .card-art,
.card-table-view tr:has(td.missing) .card-art,
.deck-copy-card.missing-copy .card-art {
  filter: grayscale(1) saturate(0) brightness(.70) contrast(.94);
  opacity: .72;
  transition: filter .16s ease, opacity .16s ease;
}
.card-tile:has(.tile-owned.missing):hover .card-art,
.card-tile:has(.tile-owned.missing):focus-within .card-art {
  filter: grayscale(.82) saturate(.18) brightness(.76) contrast(.96);
  opacity: .82;
}
.card-tile:has(.tile-owned.missing) .tile-owned {
  background: rgba(28,33,48,.92);
  border-color: #596277;
  color: #c0c6d3;
}
`;
    document.head.appendChild(style);
  }

  const apply = () => {
    installBranding();
    installOwnershipStyle();
  };

  installOwnershipStyle();
  setTimeout(apply, 0);
  setTimeout(apply, 250);
  window.addEventListener('load', apply, { once:true });
})();
