// V8 modal polish: render Cost / ATK / HP as game-like stat symbols.
(function () {
  function makeStat(kind, value, label) {
    const span = document.createElement('span');
    span.className = `modal-game-stat stat-${kind}`;
    span.innerHTML = `<span class="stat-symbol stat-symbol-${kind}"><b>${String(value ?? '—')}</b></span><span class="modal-stat-label">${label}</span>`;
    return span;
  }

  function decorateModalStats() {
    const tags = document.querySelector('#cardModalBody .modal-tags');
    if (!tags || tags.dataset.v8Stats === '1') return;

    const children = [...tags.children];
    const costNode = children.find(el => /^Cost\s+/i.test(el.textContent.trim()));
    const statNode = children.find(el => /^ATK\/HP\s+/i.test(el.textContent.trim()));

    if (costNode) {
      const value = costNode.textContent.trim().replace(/^Cost\s+/i, '') || '—';
      costNode.replaceWith(makeStat('cost', value, 'COST'));
    }

    if (statNode) {
      const raw = statNode.textContent.trim().replace(/^ATK\/HP\s+/i, '');
      if (raw && raw !== '—') {
        const [atk = '—', hp = '—'] = raw.split('/');
        const frag = document.createDocumentFragment();
        frag.appendChild(makeStat('atk', atk, 'ATK'));
        frag.appendChild(makeStat('hp', hp, 'HP'));
        statNode.replaceWith(frag);
      } else {
        statNode.remove();
      }
    }

    tags.dataset.v8Stats = '1';
  }

  const body = document.querySelector('#cardModalBody');
  if (body) {
    new MutationObserver(() => requestAnimationFrame(decorateModalStats)).observe(body, { childList:true });
  }

  document.addEventListener('click', e => {
    if (e.target.closest?.('.card-trigger')) requestAnimationFrame(decorateModalStats);
  }, true);
})();
