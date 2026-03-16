import { state, setState } from "../../state.js";
import { openModal } from "./windowsRoot.js";

// "Управление" в стиле NWK = передача опыта (наследование % опыта).
// Логика:
//  - выбери ниндзя-источник (донор опыта)
//  - выбери ниндзя-цель (получатель)
//  - выбери 10% (серебро) или 20% (золото)
//  - нажми "Наследовать"

export async function openTeamManageWindow(initialSourceHeroId) {
  // Always fetch fresh heroes to avoid stale Lv.1/exp glitches.
  await refreshHeroes();
  let heroes = (state.heroes || []).slice();
  if (!heroes.length) return;

  // Strict selection like NW:
  //  - first click selects source
  //  - second click selects target
  //  - third click starts over (new source)
  let sourceId = initialSourceHeroId || null;
  let targetId = null;
  let phase = sourceId ? 1 : 0; // 0: need source, 1: need target, 2: ready
  let percent = 10;

  const renderSlot = (heroId) => {
    const h = heroes.find(x => x.id === heroId);
    if (!h) return `<div class="nwkSlotInner"><div class="nwkSlotLvl">LV.0</div></div>`;
    return `
      <div class="nwkSlotInner">
        <div class="nwkSlotName">${h.name}</div>
        <div class="nwkSlotLvl">LV.${Number(h.level || 1)}</div>
      </div>
    `;
  };

  const html = `
    <div class="nwkFrame nwkThemeGreen" data-nwk="manage">
      <div class="nwkTitleBar">
        <div class="nwkTitle">Передача опыта</div>
        <button class="nwkClose" type="button" data-nwk-close aria-label="Закрыть">×</button>
      </div>

      <div class="nwkContent">
        <div class="nwkSide">
          <div class="nwkSideHeader">Выберите ниндзя</div>
          <div class="nwkHeroList" id="tw2-manageHeroList">
            ${heroes.map(h => `
              <button class="nwkHeroCard ${h.id===sourceId ? "is-active" : ""}" type="button" data-m-hero="${h.id}">
                <div class="nwkAvatar"></div>
                <div class="nwkHeroMeta">
                  <div class="nwkHeroName">${h.name}</div>
                  <div class="nwkHeroLvl">Lv.${Number(h.level || 1)}</div>
                </div>
              </button>
            `).join("")}
          </div>

          <div class="nwkPager">
            <button class="nwkPagerBtn" type="button" disabled>◀</button>
            <div class="nwkPagerVal">1/1</div>
            <button class="nwkPagerBtn" type="button" disabled>▶</button>
          </div>
        </div>

        <div class="nwkMain">
          <div class="nwkManageBoard">
            <div class="nwkTransferBoard">
              <div class="nwkSlot nwkSlotLeft" id="tw2-slotSource" title="Источник">
                ${renderSlot(sourceId)}
              </div>
              <div class="nwkSeal" aria-hidden="true"></div>
              <div class="nwkSlot nwkSlotRight" id="tw2-slotTarget" title="Цель">
                ${renderSlot(targetId)}
              </div>
            </div>

            <div class="nwkInheritOpts">
              <label class="nwkOptRow">
                <input type="radio" name="tw2-inherit" value="10" checked>
                <span>Наследовать 10% оп</span>
                <span class="nwkOptPrice">Цена <b id="tw2-price10">0</b> Серебро</span>
              </label>
              <label class="nwkOptRow">
                <input type="radio" name="tw2-inherit" value="20">
                <span>Наследовать 20% оп</span>
                <span class="nwkOptPrice">Цена <b id="tw2-price20">0</b> Золото</span>
              </label>
            </div>

            <div class="nwkHint" style="margin-top:-4px;">
              Будет передано: <b id="tw2-gainVal">—</b> опыта
            </div>

            <div class="nwkTransferActions">
              <button class="nwkActionBtn" type="button" id="tw2-inheritBtn" disabled>Наследовать</button>
            </div>
          </div>

          <div class="nwkHint">
            После обмена опытом, уровень оригинального ниндзя не изменится. Количество опыта для обмена равно количеству опыта полученного после найма ниндзя.
          </div>
        </div>
      </div>
    </div>
  `;

  const modal = openModal({
    title: "Управление",
    contentHtml: html,
    hideHeader: true,
    modalClass: "modal--nwk"
  });

  const root = document.querySelector('[data-nwk="manage"]');
  const closeBtn = root?.querySelector('[data-nwk-close]');
  if (closeBtn) closeBtn.addEventListener('click', () => modal?.close?.());

  const slotSource = document.getElementById('tw2-slotSource');
  const slotTarget = document.getElementById('tw2-slotTarget');
  const seal = root?.querySelector('.nwkSeal');
  const gainEl = document.getElementById('tw2-gainVal');
  const price10El = document.getElementById('tw2-price10');
  const price20El = document.getElementById('tw2-price20');
  const inheritBtn = document.getElementById('tw2-inheritBtn');

  const computeGain = () => {
    if (!sourceId || !targetId) return null;
    const from = heroes.find(h => h.id === sourceId);
    if (!from) return null;
    const totalFrom = heroTotalExpClient(from);
    return Math.floor((totalFrom * (percent || 10)) / 100);
  };

  const computeCosts = (_gain, pct) => {
    // Must match server costs in /api/heroes/inheritExp
    const silver = (pct === 10) ? 10000 : 0;
    const gold = (pct === 20) ? 10 : 0;
    return { silver, gold };
  };

  const updateGainUi = () => {
    const gain = computeGain();
    if (gainEl) gainEl.textContent = (gain == null) ? '—' : String(gain);

    // update prices (both rows) + keep confirm in sync
    if (price10El) price10El.textContent = String(computeCosts(gain || 0, 10).silver);
    if (price20El) price20El.textContent = String(computeCosts(gain || 0, 20).gold);

    if (inheritBtn) inheritBtn.disabled = !(sourceId && targetId && sourceId !== targetId);
  };

  const updateSlots = () => {
    if (slotSource) slotSource.innerHTML = renderSlot(sourceId);
    if (slotTarget) slotTarget.innerHTML = renderSlot(targetId);
    // highlight source in list
    document.querySelectorAll('[data-m-hero]').forEach(b => {
      b.classList.toggle('is-active', b.dataset.mHero === sourceId);
      b.classList.toggle('is-target', b.dataset.mHero === targetId);
    });
    updateGainUi();
  };

  // Click heroes: strict selection.
  document.querySelectorAll('[data-m-hero]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.mHero;
      if (!id) return;
      if (phase === 0) {
        // select source
        sourceId = id;
        targetId = null;
        phase = 1;
        updateSlots();
        return;
      }

      if (phase === 1) {
        // select target
        if (id === sourceId) return; // ignore
        targetId = id;
        phase = 2;
        updateSlots();
        return;
      }

      // phase === 2 -> start over with new source
      sourceId = id;
      targetId = null;
      phase = 1;
      updateSlots();
    });
  });

  // radio selection
  root?.querySelectorAll('input[name="tw2-inherit"]').forEach(r => {
    r.addEventListener('change', () => {
      percent = Number(r.value || 10);
      updateGainUi();
    });
  });

  if (inheritBtn) inheritBtn.addEventListener('click', async () => {
    if (!sourceId || !targetId) return;
    if (sourceId === targetId) return;

    const from = heroes.find(h => h.id === sourceId);
    const to = heroes.find(h => h.id === targetId);
    const gain = computeGain();
    if (!from || !to || gain == null) return;

    const { silver, gold } = computeCosts(gain, percent);
    const ok = await openInheritConfirm({ from, to, percent, gain, silverCost: silver, goldCost: gold });
    if (!ok) return;

    // Animate seal during transfer
    seal?.classList.add('is-animating');
    inheritBtn.disabled = true;
    try {
      await inheritOnServer(sourceId, targetId, percent);
      await refreshHeroes();

      // keep local snapshot fresh too
      heroes = (state.heroes || []).slice();

      // Reset selection after success
      sourceId = null;
      targetId = null;
      phase = 0;
      updateSlots();
    } catch (e) {
      alert(String(e?.message || e));
    } finally {
      seal?.classList.remove('is-animating');
      updateGainUi();
    }
  });

  updateSlots();
  return modal;
}

function openInheritConfirm({ from, to, percent, gain, silverCost = 0, goldCost = 0 }) {
  return new Promise((resolve) => {
    const html = `
      <div class="nwkFrame nwkConfirm nwkThemeGreen" data-nwk="confirm">
        <div class="nwkTitleBar">
          <div class="nwkTitle">Подтверждение</div>
          <button class="nwkClose" type="button" data-nwk-close aria-label="Закрыть">×</button>
        </div>
        <div class="nwkConfirmBody">
          <div class="nwkConfirmText">Передать опыт с <b>${escapeHtml(from.name)}</b> на <b>${escapeHtml(to.name)}</b>?</div>
          <div class="nwkConfirmRow"><span>Процент:</span><b>${percent}%</b></div>
          <div class="nwkConfirmRow"><span>Будет передано:</span><b>${gain}</b></div>
          <div class="nwkConfirmRow"><span>Цена:</span><b>${silverCost} Серебро / ${goldCost} Золото</b></div>
        </div>
        <div class="nwkConfirmActions">
          <button class="nwkActionBtn nwkAlt" type="button" data-nwk-cancel>Отмена</button>
          <button class="nwkActionBtn" type="button" data-nwk-ok>Подтвердить</button>
        </div>
      </div>
    `;

    const m = openModal({
      title: "Подтверждение",
      contentHtml: html,
      hideHeader: true,
      modalClass: "modal--nwk"
    });

    const root = document.querySelector('[data-nwk="confirm"]');
    const close = () => { m?.close?.(); };
    root?.querySelector('[data-nwk-close]')?.addEventListener('click', () => { close(); resolve(false); });
    root?.querySelector('[data-nwk-cancel]')?.addEventListener('click', () => { close(); resolve(false); });
    root?.querySelector('[data-nwk-ok]')?.addEventListener('click', () => { close(); resolve(true); });
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// Client-side total exp calculation (matches server EXP table 1..120)
function heroTotalExpClient(hero) {
  const lvl = Math.max(1, Number(hero?.level || 1));
  const curExp = Math.max(0, Number(hero?.exp || 0));
  let total = 0;
  for (let l = 1; l < lvl; l++) total += expToNextClient(l);
  total += curExp;
  return total;
}

function expToNextClient(level) {
  const l = Number(level || 1);
  if (l >= 120) return 0;
  return EXP_TO_NEXT[l] || 0;
}

const EXP_TO_NEXT = {
  1: 100, 2: 200, 3: 300, 4: 450, 5: 600, 6: 750, 7: 900, 8: 1050, 9: 1200, 10: 1350,
  11: 1500, 12: 1650, 13: 1800, 14: 2000, 15: 2200, 16: 2400, 17: 2600, 18: 2800, 19: 3000, 20: 3200,
  21: 3400, 22: 3600, 23: 3800, 24: 4000, 25: 6600, 26: 6900, 27: 7200, 28: 7500, 29: 20000, 30: 35000,
  31: 37515, 32: 51760, 33: 66950, 34: 83130, 35: 100345, 36: 130548, 37: 162710, 38: 196974, 39: 233448, 40: 275643,
  41: 320502, 42: 368145, 43: 418692, 44: 472384, 45: 549440, 46: 631331, 47: 718282, 48: 810518, 49: 908264, 50: 1011956,
  51: 1096823, 52: 1186416, 53: 1280915, 54: 1380751, 55: 1485873, 56: 1596732, 57: 1713538, 58: 1836501, 59: 1965831, 60: 2102049,
  61: 2245395, 62: 2396109, 63: 2554772, 64: 2721654, 65: 2897025, 66: 3081155, 67: 3274695, 68: 3477945, 69: 3691606, 70: 3916008,
  71: 4348701, 72: 4807026, 73: 5344878, 74: 5914212, 75: 6573434, 76: 7329834, 77: 8191768, 78: 9168202, 79: 10202280, 80: 11297994,
  81: 12456874, 82: 13684890, 83: 14982358, 84: 16354254, 85: 17803548, 86: 19334381, 87: 20949888, 88: 22655766, 89: 24455480, 90: 26352495,
  91: 26625032, 92: 27099363, 93: 33857467, 94: 35245621, 95: 36688128, 96: 38185923, 97: 39738316, 98: 41351575, 99: 43025049, 100: 44759820,
  101: 61458714, 102: 69943658, 103: 79210731, 104: 89301031, 105: 100275966, 106: 112180641, 107: 125075912, 108: 139026952, 109: 154089237, 110: 162716148,
  111: 171927487, 112: 181757366, 113: 192241492, 114: 203411816, 115: 215318092, 116: 227995908, 117: 241482072, 118: 255826717, 119: 271076368
};

async function inheritOnServer(fromHeroId, toHeroId, percent) {
  const playerId = state?.player?.id || localStorage.getItem('playerId') || '';
  if (!playerId) throw new Error('playerId missing');
  const res = await fetch('/api/heroes/inheritExp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ playerId, fromHeroId, toHeroId, percent })
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);

  // Sync updated player currency immediately (server returns normalized currency)
  if (data?.playerCurrency) {
    state.player = state.player || {};
    state.player.currency = data.playerCurrency;
    // keep legacy flat fields if UI reads them
    if (typeof data.playerCurrency.silver === 'number') state.player.silver = data.playerCurrency.silver;
    if (typeof data.playerCurrency.gold === 'number') state.player.gold = data.playerCurrency.gold;
    if (typeof data.playerCurrency.coupons === 'number') state.player.coupons = data.playerCurrency.coupons;
  }

  return data;
}

async function refreshHeroes() {
  const playerId = localStorage.getItem('playerId') || '';
  if (!playerId) return;
  const res = await fetch(`/api/heroes/list?playerId=${encodeURIComponent(playerId)}`);
  const data = await res.json().catch(() => null);
  if (res.ok && data?.ok && Array.isArray(data?.heroes)) {
    setState(s => {
      s.heroes = data.heroes;
    });
  }
}
