// V6 interaction layer: ownership toggle buttons, toolbar alignment, anchored effect behavior.
(function () {
  function safeFilter() {
    try { if (typeof filterCards === 'function') filterCards(); } catch (_) {}
  }

  function installOwnedButtons() {
    const select = document.querySelector('#ownedFilter');
    if (!select || document.querySelector('#ownedButtons')) return;

    const group = document.createElement('fieldset');
    group.id = 'ownedButtons';
    group.className = 'filter-multi owned-multi';
    group.setAttribute('aria-label', '所持状態で絞り込む');
    group.innerHTML = `
      <label class="owned-check"><input type="checkbox" value="owned" checked><span>所持</span></label>
      <label class="missing-check"><input type="checkbox" value="missing" checked><span>未所持</span></label>`;

    document.querySelector('#effectFilterWrap')?.before(group);
    select.classList.add('owned-select-hidden');
    select.setAttribute('aria-hidden', 'true');
    select.tabIndex = -1;

    const inputs = [...group.querySelectorAll('input[type="checkbox"]')];
    const sync = (runFilter = true) => {
      let checked = inputs.filter(x => x.checked);
      if (!checked.length) {
        inputs.forEach(x => { x.checked = true; });
        checked = inputs;
      }
      select.value = checked.length === 2 ? '' : checked[0].value;
      if (runFilter) safeFilter();
    };

    inputs.forEach(input => input.addEventListener('change', () => sync(true)));
    select.addEventListener('change', () => {
      const value = select.value;
      inputs.forEach(input => {
        input.checked = !value || input.value === value;
      });
    });
    sync(false);
  }

  function moveResetButton() {
    const reset = document.querySelector('#resetCardFilters');
    const search = document.querySelector('#searchInput');
    if (!reset || !search) return false;
    if (search.nextElementSibling !== reset) search.after(reset);
    return true;
  }

  function resetOwnedButtons() {
    const group = document.querySelector('#ownedButtons');
    const select = document.querySelector('#ownedFilter');
    if (!group || !select) return;
    group.querySelectorAll('input[type="checkbox"]').forEach(x => { x.checked = true; });
    select.value = '';
  }

  function installEffectDismiss() {
    if (document.documentElement.dataset.effectDismissV6 === '1') return;
    document.documentElement.dataset.effectDismissV6 = '1';
    document.addEventListener('click', e => {
      const wrap = document.querySelector('#effectFilterWrap');
      if (!wrap) return;
      if (e.target.closest?.('#effectFilterWrap')) return;
      wrap.classList.remove('open');
    });
  }

  function install() {
    installOwnedButtons();
    installEffectDismiss();
    let tries = 0;
    const settle = () => {
      installOwnedButtons();
      const moved = moveResetButton();
      if (++tries < 30 && !moved) setTimeout(settle, 50);
    };
    settle();
  }

  document.addEventListener('click', e => {
    if (e.target.closest?.('#resetCardFilters')) {
      resetOwnedButtons();
      requestAnimationFrame(safeFilter);
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();
