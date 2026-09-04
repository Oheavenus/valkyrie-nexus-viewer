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
  let scheduled = false;

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

  function start() {
    const body = document.querySelector('#cardModalBody');
    if (body) new MutationObserver(schedule).observe(body, { childList:true, subtree:true });
    document.addEventListener('click', e => {
      if (e.target.closest?.('.card-trigger')) schedule();
    }, true);
    patchModal();
  }

  window.VN_RULE_NOTES = Object.freeze({
    ...(window.VN_RULE_NOTES || {}),
    ...RULE_NOTES
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
