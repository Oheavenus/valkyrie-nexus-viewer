// Small interaction patch for V4 filter controls and pull-history readability.
(function () {
  function resetFilters() {
    const search = document.querySelector('#searchInput');
    if (search) search.value = '';
    document.querySelectorAll('#typeFilter input[type="checkbox"],#rarityFilter input[type="checkbox"],#costFilter input[type="checkbox"],#atkFilter input[type="checkbox"],#hpFilter input[type="checkbox"]').forEach(x => x.checked = true);
    document.querySelectorAll('#effectFilterPanel input[name="effectKeyword"]').forEach(x => x.checked = false);
    const owned = document.querySelector('#ownedFilter'); if (owned) owned.value = '';
    const sort = document.querySelector('#sortSelect'); if (sort) sort.value = 'id';
    const count = document.querySelector('#effectFilterCount'); if (count) count.textContent = '';
    document.querySelector('#effectFilterButton')?.classList.remove('active');
    document.querySelector('#effectFilterWrap')?.classList.remove('open');
    if (typeof filterCards === 'function') filterCards();
  }

  function installReset() {
    const row = document.querySelector('.footer-stat-filter-row');
    if (!row || document.querySelector('#resetCardFilters')) return;
    const first = row.firstElementChild;
    const button = document.createElement('button');
    button.id = 'resetCardFilters';
    button.className = 'filter-reset-button';
    button.type = 'button';
    button.textContent = 'リセット';
    if (first) first.replaceWith(button); else row.prepend(button);
  }

  function formatPullTimestamp(raw) {
    const text = String(raw || '').trim();
    const m = text.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (!m) return null;
    return { date: `${m[1]}/${m[2]}/${m[3]}`, time: `${m[4]}:${m[5]}` };
  }

  function formatPullHistoryDates() {
    document.querySelectorAll('#pullsBody tr').forEach(tr => {
      const td = tr.children[1];
      if (!td || (td.dataset.rawTimestamp && td.querySelector('.pull-date-cell'))) return;
      const raw = td.textContent.trim();
      const formatted = formatPullTimestamp(raw);
      if (!formatted) return;
      td.dataset.rawTimestamp = raw;
      td.title = raw;
      td.innerHTML = `<span class="pull-date-cell"><span class="pull-date">${formatted.date}</span><span class="pull-time">${formatted.time}</span></span>`;
    });
  }

  function installPullObserver() {
    const body = document.querySelector('#pullsBody');
    if (!body || body.dataset.v4Observed === '1') return;
    body.dataset.v4Observed = '1';
    let pending = false;
    const observer = new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        formatPullHistoryDates();
      });
    });
    observer.observe(body, { childList:true });
    formatPullHistoryDates();
  }

  document.addEventListener('click', e => {
    if (e.target.closest?.('#resetCardFilters')) { resetFilters(); return; }
    if (e.target.closest?.('#effectFilterClear')) {
      e.preventDefault();
      document.querySelectorAll('#effectFilterPanel input[name="effectKeyword"]:checked').forEach(x => x.checked = false);
      const count = document.querySelector('#effectFilterCount'); if (count) count.textContent = '';
      document.querySelector('#effectFilterButton')?.classList.remove('active');
      if (typeof filterCards === 'function') filterCards();
    }
  });

  function install() {
    installReset();
    installPullObserver();
    let tries = 0;
    const retry = () => {
      installPullObserver();
      formatPullHistoryDates();
      if (++tries < 30 && !document.querySelector('#pullsBody tr')) setTimeout(retry, 100);
    };
    retry();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();
