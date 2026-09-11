// V10 rule layer: ver1.1.3 terminology and behavior clarifications.
(function () {
  const RULE_NOTES = Object.freeze({
    '神秘': '相手はこのユニットを効果の対象に選べない。全体効果・ランダム対象の効果・通常の攻撃は受ける。自分の効果では対象に選べる。',
    '消滅': '消滅したカードは墓地へ送られず、死亡時の効果も発動しない。破壊とは別の扱いで、不屈でも防げない。',
    '不屈': 'ver1.1.3で「消滅は防げない」と説明に追記された。破壊と消滅は別の扱い。',
    '復活': 'ver1.1.3以降、復活したカードは墓地から取り除かれる。同じ1度の死亡から何度も復活させることはできない。復活後に再び倒れた場合は墓地へ戻る。'
  });

  const CARD_NOTES = Object.freeze({
    '083': 'ver1.1.3：フォルンの被ダメージ時効果は、そのダメージで倒れた場合でも1度発動する。',
    '155': 'ver1.1.3：シルビアの起動は隣に味方がいない場合でも使用でき、その場合は効果文どおり自身が+3/+3を得る。'
  });

  const RESURRECTION_IDS = new Set(['060', '068', '100', '135']);
  const FAVICON_DATA_URI = 'data:image/png;base64,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';
  let scheduled = false;

  function installFavicon() {
    let link = document.querySelector('link[rel~="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = 'image/png';
    link.sizes = '64x64';
    link.href = FAVICON_DATA_URI;
  }

  function cardById(id) {
    const key = String(id || '').padStart(3, '0');
    try {
      return Array.isArray(allCards) ? allCards.find(card => card.card_id === key) || null : null;
    } catch (_) {
      return null;
    }
  }

  function modalCard() {
    const body = document.querySelector('#cardModalBody');
    const match = body?.querySelector('.modal-kicker')?.textContent?.match(/No\.(\d+)/);
    return match ? cardById(match[1]) : null;
  }

  function keywords(card) {
    return String(card?.keywords || '').split(/[;,、]/).map(v => v.trim()).filter(Boolean);
  }

  function noteRows(card) {
    const rows = [];
    const keys = keywords(card);
    for (const key of ['神秘', '消滅', '不屈']) {
      if (keys.includes(key) && RULE_NOTES[key]) rows.push([key, RULE_NOTES[key]]);
    }
    if (RESURRECTION_IDS.has(card.card_id)) rows.push(['墓地・復活', RULE_NOTES['復活']]);
    if (CARD_NOTES[card.card_id]) rows.push(['ver1.1.3', CARD_NOTES[card.card_id]]);
    return rows;
  }

  function patchModal() {
    scheduled = false;
    const body = document.querySelector('#cardModalBody');
    if (!body) return;
    body.querySelectorAll('.official-v113-rule-note').forEach(node => node.remove());

    const card = modalCard();
    const details = body.querySelector('.card-details');
    if (!card || !details) return;

    for (const [label, text] of noteRows(card)) {
      const dt = document.createElement('dt');
      dt.className = 'official-v113-rule-note';
      dt.textContent = `ルール補足：${label}`;
      const dd = document.createElement('dd');
      dd.className = 'official-v113-rule-note';
      dd.textContent = text;
      details.append(dt, dd);
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(patchModal);
  }

  function loadPrivateDataLayer() {
    if (window.VN_PUBLIC_VIEWER || document.querySelector('script[data-vn-private-data-layer]')) return;
    const script = document.createElement('script');
    script.src = 'private-data-layer-v2.js';
    script.dataset.vnPrivateDataLayer = '2';
    script.async = false;
    script.onerror = () => console.error('Private data layer could not be loaded.');
    document.body.appendChild(script);
  }

  function start() {
    installFavicon();
    const body = document.querySelector('#cardModalBody');
    if (body) new MutationObserver(schedule).observe(body, { childList:true, subtree:true });
    document.addEventListener('click', e => {
      if (e.target.closest?.('.card-trigger')) schedule();
    }, true);
    patchModal();
    loadPrivateDataLayer();
  }

  window.VN_RULE_NOTES = Object.freeze({
    ...(window.VN_RULE_NOTES || {}),
    ...RULE_NOTES
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
