// V5 interaction polish: official-style effect colors and simple 10-pull sequence labels.
(function () {
  const EFFECT_CLASS = new Map([
    ['速攻','effect-fast'],['守護','effect-guard'],['隠密','effect-stealth'],['貫通','effect-pierce'],
    ['狙撃','effect-snipe'],['突撃','effect-charge'],['2回攻撃','effect-double'],['攻撃不能','effect-disable'],
    ['鉄壁','effect-wall'],['執念','effect-grit'],['不屈','effect-undying'],['連携','effect-link'],
    ['共鳴','effect-resonance'],['加護','effect-blessing'],['鎮魂','effect-requiem'],['孤立','effect-lone'],
    ['チェイン','effect-chain'],['起動','effect-activate'],['深度','effect-depth'],
    ['神秘','effect-mystic'],['消滅','effect-banish']
  ]);

  function applyEffectColors() {
    document.querySelectorAll('#effectFilterPanel label').forEach(label => {
      const input = label.querySelector('input[name="effectKeyword"]');
      const cls = EFFECT_CLASS.get(input?.value || '');
      if (cls && !label.classList.contains(cls)) label.classList.add(cls);
    });
  }

  function relabelPullRows() {
    const body = document.querySelector('#pullsBody');
    if (!body) return;
    const rows = [...body.querySelectorAll('tr')];
    if (!rows.length) return;
    const head = document.querySelector('#pullsPanel thead th:first-child');
    if (head && head.textContent !== '10連') head.textContent = '10連';

    // renderPulls is newest-first. The oldest recorded ten-pull is #1.
    const total = rows.length;
    rows.forEach((tr, index) => {
      const td = tr.children[0];
      if (!td) return;
      const seq = total - index;
      if (!td.dataset.pullId) td.dataset.pullId = td.textContent.trim();
      td.title = `内部ID: ${td.dataset.pullId}`;
      if (td.dataset.sequence === String(seq)) return;
      td.dataset.sequence = String(seq);
      td.innerHTML = `<span class="pull-sequence">第${seq}回</span>`;
    });
  }

  function installObserver() {
    const body = document.querySelector('#pullsBody');
    if (!body || body.dataset.v5Observed === '1') return;
    body.dataset.v5Observed = '1';
    let pending = false;
    const observer = new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        relabelPullRows();
      });
    });
    observer.observe(body, { childList:true });
    relabelPullRows();
  }

  function refresh() {
    applyEffectColors();
    installObserver();
    relabelPullRows();
  }

  function install() {
    refresh();
    let tries = 0;
    const retry = () => {
      refresh();
      if (++tries < 40 && (!document.querySelector('#effectFilterPanel label') || !document.querySelector('#pullsBody tr'))) {
        setTimeout(retry, 100);
      }
    };
    retry();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();
