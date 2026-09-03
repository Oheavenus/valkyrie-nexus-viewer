// Card-art renderer.
// Priority (highest last because layers are absolutely positioned):
//   1) embedded verified sprite fallback
//   2) raw upstream id-only screenshot fallback: assets/cards/{id}.jpg
//   3) reviewed/generated PNG crop
//   4) exact id+name canonical JPG: assets/cards/{id}_{name}.jpg
(function () {
  const fallback = {
    '001':[0,0],'002':[1,0],'003':[2,0],'004':[3,0],'005':[4,0],'006':[5,0],'007':[6,0],'008':[7,0],'009':[8,0],'010':[9,0],
    '011':[0,1],'013':[1,1],'014':[2,1],'015':[3,1],'016':[4,1],'017':[5,1],'020':[6,1],'021':[7,1],'022':[8,1],'023':[9,1],
    '025':[0,2],'026':[1,2],'028':[2,2],'030':[3,2],'031':[4,2],'033':[5,2],'034':[6,2],'035':[7,2],'036':[8,2],'039':[9,2],
    '045':[0,3],'062':[1,3],'063':[2,3],'064':[3,3],'067':[4,3],'069':[5,3],'071':[6,3],'074':[7,3],'076':[8,3],'079':[9,3],
    '084':[0,4],'094':[1,4],'100':[2,4],'102':[3,4],'111':[4,4],'113':[5,4],'124':[6,4],'131':[7,4],'150':[8,4],'157':[9,4]
  };
  const generated = new Set((window.VN_GENERATED_CARD_IDS || []).map(v => String(v).padStart(3, '0')));
  const canonical = new Set((window.VN_CANONICAL_CARD_IDS || []).map(v => String(v).padStart(3, '0')));
  const raw = new Set((window.VN_RAW_CARD_IDS || []).map(v => String(v).padStart(3, '0')));

  function spriteLayer(key) {
    const pos = fallback[key];
    if (!pos || !window.VN_CARD_SPRITE) return null;
    return {
      size: '1000% 500%',
      position: `${pos[0] / 9 * 100}% ${pos[1] / 4 * 100}%`
    };
  }

  function sourceInfo(key) {
    if (canonical.has(key)) {
      return { src:`generated-card-assets/${key}.jpg`, kind:'canonical', label:'確認済みカード原画像（ID+名称一致）' };
    }
    if (generated.has(key)) {
      return { src:`generated-card-images/${key}.png`, kind:'reviewed', label:'動画から抽出した確認済みカード画像' };
    }
    if (raw.has(key)) {
      return { src:`generated-card-assets/${key}.raw.jpg`, kind:'raw', label:'外部追加スクリーンショット（フォールバック）' };
    }
    if (spriteLayer(key)) {
      return { src:window.VN_CARD_SPRITE, kind:'sprite', label:'ゲーム内画像の埋め込みフォールバック' };
    }
    return null;
  }

  window.VN_CARD_IMAGE_SOURCE = function (id) {
    return sourceInfo(String(id).padStart(3, '0'));
  };

  hasCardImage = function (id) {
    return Boolean(sourceInfo(String(id).padStart(3, '0')));
  };

  function imageTag(src, hasLowerFallback, sourceKind = '', fallbackSrc = '', eager = false) {
    const terminalError = hasLowerFallback
      ? "this.remove()"
      : "this.remove();this.parentElement.classList.add('placeholder');this.parentElement.textContent='?'";
    const onerror = fallbackSrc
      ? `if(this.dataset.fallbackSrc){const s=this.dataset.fallbackSrc;delete this.dataset.fallbackSrc;this.src=s}else{${terminalError}}`
      : terminalError;
    const loading = eager ? 'eager' : 'lazy';
    const priority = eager ? 'high' : 'low';
    const fallbackAttr = fallbackSrc ? ` data-fallback-src="${fallbackSrc}"` : '';
    // All sources share the official 2:3 artwork viewport. Canonical images are
    // already close to this geometry; older reviewed/raw sources are cropped at
    // the viewport edge rather than letterboxed, preventing visible size jitter.
    return `<img class="card-source-image ${sourceKind ? `source-${sourceKind}` : ''}" src="${src}"${fallbackAttr} alt="" aria-hidden="true" width="120" height="180" loading="${loading}" decoding="async" fetchpriority="${priority}" onerror="${onerror}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center center;display:block">`;
  }

  function localImageTags(key, hasSprite, size) {
    const useThumb = size === 'thumb' || size === 'gallery';
    // Load only the highest-priority local source. Layering every fallback made
    // the browser decode two or three images for one visible card.
    if (canonical.has(key)) {
      const full = `generated-card-assets/${key}.jpg`;
      return imageTag(useThumb ? `generated-card-thumbs/${key}.jpg` : full, hasSprite, 'canonical', useThumb ? full : '', !useThumb);
    }
    if (generated.has(key)) {
      return imageTag(`generated-card-images/${key}.png`, hasSprite, 'reviewed', '', !useThumb);
    }
    if (raw.has(key)) {
      const full = `generated-card-assets/${key}.raw.jpg`;
      return imageTag(useThumb ? `generated-card-thumbs/${key}.raw.jpg` : full, hasSprite, 'raw', useThumb ? full : '', !useThumb);
    }
    return '';
  }

  cardArtHTML = function (id, size = 'thumb') {
    const key = String(id).padStart(3, '0');
    const layer = spriteLayer(key);
    const hasLocal = canonical.has(key) || generated.has(key) || raw.has(key);
    if (!layer && !hasLocal) {
      return `<div class="card-art placeholder ${size}" aria-label="画像未登録">?</div>`;
    }

    const fallbackStyle = layer
      ? `background-image:url(${window.VN_CARD_SPRITE});background-size:${layer.size};background-position:${layer.position};`
      : '';
    const originalBg = size === 'original' && layer && !hasLocal
      ? 'background-size:1000% 500%;background-repeat:no-repeat;'
      : '';
    return `<div class="card-art ${size}" aria-label="ゲーム内カード画像" style="${fallbackStyle}${originalBg}position:relative;overflow:hidden">${localImageTags(key, Boolean(layer), size)}</div>`;
  };

  function updateImageCountNote() {
    const el = document.querySelector('#cardCount');
    if (!el) return;
    const available = new Set([...Object.keys(fallback), ...generated, ...canonical, ...raw]);
    el.textContent = el.textContent.replace(/画像登録\s*\d+枚/, `画像登録 ${available.size}枚`);
  }

  if (typeof filterCards === 'function') {
    const originalFilterCards = filterCards;
    filterCards = function (...args) {
      const result = originalFilterCards.apply(this, args);
      updateImageCountNote();
      return result;
    };
  }

  const refresh = () => {
    try { if (typeof filterCards === 'function') filterCards(); } catch (_) {}
    try { if (typeof renderDecks === 'function') renderDecks(); } catch (_) {}
    try { updateImageCountNote(); } catch (_) {}
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(refresh, 0), { once:true });
  } else {
    setTimeout(refresh, 0);
  }
})();
