// client/js/modules/windows/bagWindow.js
// Inventory ("Сумка") window — styled to match reference screenshots.
// ✅ Browser ESM module. No require() here.

import { state, setState } from "../../state.js";
import { openModal } from "./windowsRoot.js";

// ✅ Canonical tabs for Variant B (per spec)
const TABS = [
  { id: "items", label: "Вещи", hint: "Усі предмети, окрім екип/самоцветів/артефактів/значків/украшень" },
  { id: "equipment", label: "Экиперовка", hint: "Зброя/шолом/нагрудник/плащ/ботінки/пояс" },
  { id: "materials", label: "Материалы", hint: "Матеріали для крафту" },
  { id: "gems", label: "Самоцветы", hint: "Самоцвіти" },
  { id: "artifacts", label: "Артефакты", hint: "Артефакти" },
  { id: "jewelry", label: "Украшения", hint: "Біжутерія" },
  { id: "badge", label: "Значок", hint: "Значки" },
  { id: "temp", label: "Временная сумка", hint: "Тимчасова сумка (будь-які типи)" },
];

// UI state (module-local)
let ui = {
  // Back-compat: old tab ids were all|equip
  tab: "items",
  page: 1,
  perPage: 30, // 6 columns * 5 rows
  capacity: 60,
  selectedId: null,
  toast: "",
  toastTs: 0,
};

export function openBagWindow() {
  const modal = openModal({
    title: "Сумка",
    contentHtml: renderShell(),
  });

  // First render quickly from fallback then refresh from API
  const initial = fallbackBagItems();
  renderBag(initial, { warn: "" });

  loadBag().catch((err) => {
    renderBag(fallbackBagItems(), { warn: `Не вдалося завантажити з сервера: ${String(err?.message || err)}` });
  });

  return modal;
}

/* ===================== LOAD ===================== */

function getPlayerId() {
  return state?.player?.id || localStorage.getItem("playerId") || "";
}

async function safeJson(res) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await res.json();
  const text = await res.text();
  return { ok: false, error: "Server returned non-JSON", details: text.slice(0, 300) };
}

function fallbackBagItems() {
  const arr = Array.isArray(state?.inventory?.items) ? state.inventory.items : [];
  return arr.map((x) => ({
    id: x.id,
    name: x.name,
    type: x.type,
    slot: x.slot ?? null,
    rarity: x.rarity || "",
    qty: Number(x.qty ?? 1),
    desc: x.desc || "",
    tplId: x.tplId || null,
  }));
}

async function loadBag() {
  const playerId = getPlayerId();
  if (!playerId) {
    renderBag(fallbackBagItems(), { warn: "Немає playerId. Показано демо-сумку." });
    return;
  }

  const res = await fetch(`/api/inventory/get?playerId=${encodeURIComponent(playerId)}`);
  const data = await safeJson(res);

  if (!res.ok || !data?.ok) {
    renderBag(fallbackBagItems(), { warn: `Сервер не віддав сумку (${data?.error || res.status}). Показано демо.` });
    return;
  }

  const bagItems = normalizeBagItems(data.inventory, ui.tab);
  // cache heroes for EXP item usage
  try {
    const hr = await fetch(`/api/heroes/list?playerId=${encodeURIComponent(playerId)}`);
    const hd = await safeJson(hr);
    ui.heroes = Array.isArray(hd?.heroes) ? hd.heroes : [];
  } catch (_) {
    ui.heroes = [];
  }
  // capacity can be stored server-side later; now we keep default 60
  if (Number.isFinite(data?.inventory?.capacity)) ui.capacity = Number(data.inventory.capacity);

  renderBag(bagItems, { warn: "" });
}

function normalizeBagItems(inv, tab) {
  const src = tab === "temp"
    ? (Array.isArray(inv.tempBagItems) ? inv.tempBagItems : [])
    : (Array.isArray(inv.bagItems) ? inv.bagItems : []);

  return src
    .filter(Boolean)
    .map((x) => ({
      id: x.id || x.tplId || cryptoId(),
      tplId: x.tplId || null,
      name: x.name || x.tplId || x.id || "Предмет",
      type: x.type || "misc",
      slot: x.slot ?? null,
      rarity: x.rarity || "",
      qty: Number(x.qty ?? 1),
      desc: x.desc || "",
      effects: x.effects || null,
      icon: x.icon || null,
    }));
}


function cryptoId() {
  // stable enough for UI fallback
  return "itm_" + Math.random().toString(16).slice(2) + Date.now().toString(16);
}

/* ===================== RENDER ===================== */

function renderShell() {
  // We render full UI into this root
  return `
    <style>
      /* scoped-ish: prefix .bag- */
      .bag-wrap{ display:grid; grid-template-columns: 220px 1fr 240px; gap:14px; min-height: calc(92vh - 90px); }
      .bag-panel{
        background: rgba(0,0,0,.18);
        border: 1px solid var(--line);
        border-radius: 16px;
        overflow: hidden;
      }
      .bag-left{ display:flex; flex-direction:column; }
      .bag-leftHead{
        padding:12px 12px 10px;
        border-bottom:1px solid var(--line);
        font-weight:700;
        opacity:.95;
      }
      .bag-tabs{ padding:10px; display:flex; flex-direction:column; gap:8px; }
      .bag-tab{
        width:100%;
        text-align:left;
        border:1px solid var(--line);
        background: rgba(255,255,255,.03);
        color: var(--text);
        border-radius: 12px;
        padding:10px 10px;
        cursor:pointer;
        display:flex; align-items:center; justify-content:space-between;
      }
      .bag-tab:hover{ background: rgba(255,255,255,.06); }
      .bag-tab.is-active{
        border-color: rgba(217,179,92,.55);
        box-shadow: 0 0 0 1px rgba(217,179,92,.25) inset;
      }
      .bag-tab small{ opacity:.75; font-weight:600; }

      .bag-actions{
        margin-top:auto;
        padding:12px;
        border-top:1px solid var(--line);
        display:flex; flex-direction:column; gap:10px;
      }
      .bag-btn{
        width:100%;
        border:1px solid var(--line);
        background: rgba(255,255,255,.03);
        color: var(--text);
        border-radius:12px;
        padding:10px;
        cursor:pointer;
        font-weight:700;
      }
      .bag-btn:hover{ background: rgba(255,255,255,.06); }

      .bag-online{
        display:flex; align-items:center; justify-content:space-between;
        gap:10px;
        margin-top:6px;
      }
      .bag-online .badge{ margin:0; }

      .bag-center{ display:flex; flex-direction:column; }
      .bag-centerTop{
        display:flex; align-items:flex-end; justify-content:space-between;
        gap:10px;
        margin-bottom:10px;
      }
      .bag-title{ font-size:18px; font-weight:800; }
      .bag-sub{ opacity:.75; font-weight:600; margin-top:4px; }
      .bag-warn{ margin-top:10px; opacity:.9; }

      .bag-grid{
        background: rgba(0,0,0,.14);
        border: 1px solid var(--line);
        border-radius: 16px;
        padding:12px;
        flex:1;
        display:grid;
        grid-template-columns: repeat(6, 1fr);
        gap:10px;
        align-content:start;
      }
      .bag-slot{
        aspect-ratio: 1 / 1;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,.10);
        background: rgba(0,0,0,.22);
        color: var(--text);
        position:relative;
        overflow:hidden;
        cursor:pointer;
        display:flex;
        flex-direction:column;
        justify-content:space-between;
        padding:8px;
        text-align:left;
      }
      .bag-slot.is-empty{
        opacity:.45;
        cursor:default;
      }
      .bag-slot:hover{ background: rgba(0,0,0,.30); }
      .bag-slot.is-selected{
        border-color: rgba(217,179,92,.65);
        box-shadow: 0 0 0 2px rgba(217,179,92,.20) inset;
      }
      .bag-icon{
        width:100%;
        height:100%;
        position:absolute;
        inset:0;
        background-position:center;
        background-repeat:no-repeat;
        background-size:contain;
        /* subtle gloss on top of icon */
        box-shadow: inset 0 0 0 999px rgba(0,0,0,.00);
        pointer-events:none;
      }
      .bag-name{ font-weight:800; font-size:12px; line-height:1.1; text-shadow:0 1px 0 rgba(0,0,0,.5); z-index:1; }
      .bag-meta{ font-size:11px; opacity:.8; z-index:1; }
      .bag-qty{
        position:absolute;
        right:6px;
        bottom:6px;
        font-weight:900;
        background: rgba(0,0,0,.55);
        border:1px solid rgba(255,255,255,.12);
        border-radius:999px;
        padding:2px 7px;
        font-size:12px;
      }

      .bag-right{ display:flex; flex-direction:column; }
      .bag-rightHead{
        padding:12px 12px 10px;
        border-bottom:1px solid var(--line);
        font-weight:800;
        display:flex;
        justify-content:space-between;
        align-items:center;
      }
      .bag-sellBox{ padding:12px; display:flex; flex-direction:column; gap:10px; }
      .bag-sellEmpty{ opacity:.75; }
      .bag-sellName{ font-weight:900; font-size:14px; }
      .bag-sellDesc{ opacity:.85; font-size:12px; line-height:1.35; white-space:pre-wrap; }
      .bag-sellBtn{
        margin-top:6px;
        border:1px solid rgba(255,255,255,.14);
        background: rgba(255,70,70,.14);
        color: var(--text);
        border-radius:12px;
        padding:10px;
        cursor:pointer;
        font-weight:900;
      }
      .bag-sellBtn:hover{ background: rgba(255,70,70,.20); }

      .bag-expBox{margin-top:10px; padding:10px; border-radius:12px; border:1px solid rgba(255,255,255,.08); background: rgba(0,0,0,.15)}
      .bag-expRow{display:flex; gap:10px; align-items:center; margin-top:8px}
      .bag-expSelect,.bag-expQty{flex:1; background: rgba(0,0,0,.25); border:1px solid rgba(255,255,255,.12); color: var(--text); border-radius:10px; padding:8px 10px; outline:none}

      .bag-bottomBar{
        margin-top:12px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
      }
      .bag-pager{
        display:flex;
        align-items:center;
        gap:8px;
      }
      .bag-pageBtn{
        width:42px;
        height:34px;
        border-radius:10px;
        border:1px solid var(--line);
        background: rgba(255,255,255,.03);
        color: var(--text);
        cursor:pointer;
        font-weight:900;
      }
      .bag-pageBtn:hover{ background: rgba(255,255,255,.06); }
      .bag-pageLabel{ min-width:60px; text-align:center; font-weight:900; opacity:.9; }

      .bag-toast{
        position:absolute;
        left:50%;
        transform:translateX(-50%);
        bottom:18px;
        background: rgba(0,0,0,.60);
        border:1px solid rgba(255,255,255,.12);
        color: var(--text);
        padding:10px 14px;
        border-radius:12px;
        max-width:min(760px, 92%);
        text-align:center;
        font-weight:800;
        opacity:0;
        pointer-events:none;
        transition:opacity .18s ease;
      }
      .bag-toast.is-show{ opacity:1; }
    </style>

    <div class="bag-wrap" id="bagRoot">
      <!-- left / center / right rendered by JS -->
    </div>

    <div class="bag-toast" id="bagToast"></div>
  `;
}

function renderBag(allItems, { warn } = {}) {
  const root = document.getElementById("bagRoot");
  if (!root) return;

  // keep in state for fallback usage
  syncStateInventory(allItems);

  const onlineSec = Number(state?.player?.onlineSeconds || 0);
  const online = formatOnline(onlineSec);
  const level = Number(state?.player?.level || 1);

  // capacity: default 60 like screenshots
  const capacity = Number(ui.capacity || 60);
  const perPage = Number(ui.perPage || 30);
  const totalPages = Math.max(1, Math.ceil(capacity / perPage));

  if (ui.page > totalPages) ui.page = totalPages;
  if (ui.page < 1) ui.page = 1;

  const filtered = filterByTab(allItems, ui.tab);

  // Fill slots up to perPage, but allow empty slots based on capacity (page window)
  const startSlotIndex = (ui.page - 1) * perPage;
  const endSlotIndex = startSlotIndex + perPage;

  // We display the page slice of slots: items packed from 0..filtered.length-1 into slots 0..capacity-1.
  // For UI: build pageSlots with either item or empty if beyond capacity or missing item.
  const pageSlots = [];
  for (let slot = startSlotIndex; slot < endSlotIndex; slot++) {
    if (slot >= capacity) {
      pageSlots.push({ kind: "locked" }); // beyond capacity
      continue;
    }
    const item = filtered[slot] || null;
    if (!item) pageSlots.push({ kind: "empty" });
    else pageSlots.push({ kind: "item", item });
  }

  const selected = ui.selectedId ? allItems.find((x) => String(x.id) === String(ui.selectedId)) : null;

  root.innerHTML = `
    ${renderLeft(level, online)}
    ${renderCenter(pageSlots, filtered.length, warn, totalPages, capacity)}
    ${renderRight(selected)}
  `;

  bindBagUI(allItems, level, onlineSec, totalPages, capacity);
  updateToast(); // show if exists
}

function renderLeft(level, online) {
  return `
    <div class="bag-panel bag-left">
      <div class="bag-leftHead">Категорії</div>

      <div class="bag-tabs">
        ${TABS.map((t) => {
          const active = t.id === ui.tab ? "is-active" : "";
          return `
            <button class="bag-tab ${active}" data-bag-tab="${escAttr(t.id)}" title="${escAttr(t.hint)}">
              <span>${esc(t.label)}</span>
              <small>${esc(tabCountHint(t.id))}</small>
            </button>
          `;
        }).join("")}
      </div>

      <div class="bag-actions">
        <button class="bag-btn" data-bag-action="expand">Расширить</button>
        <button class="bag-btn" data-bag-action="sort">Сортировка</button>
        <div class="bag-online">
          <span class="badge">Время онлайн</span>
          <span class="badge" id="bagOnline" title="Натисни щоб отримати +1 слот за кожну повну годину онлайн">${esc(online)}</span>
        </div>
        <div class="badge" style="opacity:.75">Рівень: ${Number.isFinite(level) ? level : 1}</div>
      </div>
    </div>
  `;
}

function renderCenter(pageSlots, filteredCount, warn, totalPages, capacity) {
  // The title line matches your screenshot: "Предмети: 3"
  return `
    <div class="bag-center">
      <div class="bag-centerTop">
        <div>
          <div class="bag-title">Предмети: ${filteredCount}</div>
          <div class="bag-sub">Тут тільки загальна сумка (без інвентаря персонажів).</div>
          ${warn ? `<div class="badge bag-warn">${esc(warn)}</div>` : ``}
        </div>

        <div class="badge">Сумка&nbsp;&nbsp;<b>${Math.min(filteredCount, capacity)}</b>/<b>${capacity}</b></div>
      </div>

      <div class="bag-grid">
        ${pageSlots
          .map((s, idx) => {
            if (s.kind === "locked") {
              return `
                <div class="bag-slot is-empty" title="Немає слоту (розширити сумку)">
                  <div class="bag-icon"></div>
                  <div class="bag-name">—</div>
                  <div class="bag-meta">locked</div>
                </div>
              `;
            }
            if (s.kind === "empty") {
              return `
                <div class="bag-slot is-empty" title="Порожній слот">
                  <div class="bag-icon"></div>
                  <div class="bag-name"> </div>
                  <div class="bag-meta"> </div>
                </div>
              `;
            }
            const it = s.item;
            const sel = ui.selectedId && String(ui.selectedId) === String(it.id) ? "is-selected" : "";
            const qty = Number(it.qty ?? 1);
            const qtyHtml = qty > 1 ? `<div class="bag-qty">${qty}</div>` : "";
            const icon = iconUrlForItem(it);
            const iconStyle = icon ? `style="background-image:url('${escAttr(icon)}')"` : "";
            return `
              <button class="bag-slot ${sel}" data-bag-item="${escAttr(it.id)}" title="${escAttr(it.desc || it.name)}">
                <div class="bag-icon" ${iconStyle}></div>
                <div class="bag-name">${esc(it.name)}</div>
                <div class="bag-meta">${esc(it.type || "")}${it.slot ? ` • ${esc(it.slot)}` : ""}</div>
                ${qtyHtml}
              </button>
            `;
          })
          .join("")}
      </div>

      <div class="bag-bottomBar">
        <div class="bag-pager">
          <button class="bag-pageBtn" data-bag-page="prev" title="Попередня сторінка">◀</button>
          <div class="bag-pageLabel"><span id="bagPage">${ui.page}</span>/<span id="bagPages">${totalPages}</span></div>
          <button class="bag-pageBtn" data-bag-page="next" title="Наступна сторінка">▶</button>
        </div>

        <div class="badge" style="opacity:.85">
          Сторінки йдуть по слотах (як у прикладі)
        </div>
      </div>
    </div>
  `;
}

function iconUrlForItem(it){
  if(!it) return "";
  if(it.icon) return `/assets/items/${String(it.icon)}`;
  const tplId = String(it.tplId||"");
  // Boxes fallback by tplId
  if(tplId === "box_set_akatsuki") return "/assets/items/box_akatsuki.png";
  if(tplId === "box_set_angel") return "/assets/items/box_angel.png";
  if(tplId === "box_set_ice") return "/assets/items/box_ice.png";
  if(tplId === "box_set_abyss") return "/assets/items/box_abyss.png";
  if(tplId === "box_jset_akatsuki") return "/assets/items/jbox_akatsuki.png";
  if(tplId === "box_jset_prizrak") return "/assets/items/jbox_prizrak.png";
  if(tplId === "box_jset_king") return "/assets/items/jbox_king.png";
  if(tplId === "box_jset_sixpaths") return "/assets/items/jbox_sixpaths.png";
  return "";
}

function renderRight(selected) {
  // Right panel: "Продати" + selected item details
  if (!selected) {
    return `
      <div class="bag-panel bag-right">
        <div class="bag-rightHead">
          <span>Продати</span>
          <span class="badge">панель</span>
        </div>
        <div class="bag-sellBox">
          <div class="bag-sellEmpty">Обери предмет у сітці зліва, щоб побачити деталі та кнопку продажу.</div>
          <div class="badge" style="opacity:.75">Продаж — прототип (далі прив’яжемо до API).</div>
        </div>
      </div>
    `;
  }

  const isHeroToken = selected.type === "hero";
  const isExpItem = !!(selected.effects && Number(selected.effects.exp || 0) > 0);
  const isSkillScroll = !!(selected.effects && (Number(selected.effects.skillPoints || 0) > 0 || Number(selected.effects.awakenedSkillPoints || 0) > 0));
  const isBox = !!(selected.effects && String(selected.effects.openSet || ""));
  const expTarget = String(selected?.effects?.target || "");
  const heroes = Array.isArray(ui.heroes) ? ui.heroes : [];
  const usableHeroes = heroes.filter((h) => {
    const main = !!h?.isMain;
    if (expTarget === "main") return main;
    if (expTarget === "secondary") return !main;
    return false;
  });

  return `
    <div class="bag-panel bag-right">
      <div class="bag-rightHead">
        <span>Продати</span>
        <span class="badge">${esc(selected.type || "item")}</span>
      </div>

      <div class="bag-sellBox">
        <div class="bag-sellName">${esc(selected.name)}</div>
        <div class="badge">ID: ${esc(selected.id)}</div>
        ${selected.slot ? `<div class="badge">Слот: ${esc(selected.slot)}</div>` : ``}
        ${selected.rarity ? `<div class="badge">Рідкість: ${esc(selected.rarity)}</div>` : ``}
        <div class="badge">Ціна продажу: ${Number(selected.sell || 0)} срібло</div>
        <div class="bag-sellDesc">${esc(selected.desc || "(без опису)")}</div>

        ${isHeroToken ? `
          <div class="bag-expBox">
            <div class="bag-expRow">
              <div class="badge" style="min-width:64px">К-сть</div>
              <input id="bagActivateQty" class="bag-expQty" type="number" min="1" max="${Math.max(1, Number(selected.qty||1))}" value="1" />
            </div>
          </div>
          <button class="bag-sellBtn" style="background: rgba(255,176,46,.18); border-color: rgba(255,176,46,.35)" data-bag-action="activate" data-bag-activate="${escAttr(selected.id)}">Активувати</button>
        ` : ``}

        ${isBox ? `
          <div class="bag-expBox">
            <div class="bag-expRow">
              <div class="badge" style="min-width:64px">К-сть</div>
              <input id="bagOpenBoxQty" class="bag-expQty" type="number" min="1" max="${Math.max(1, Number(selected.qty||1))}" value="1" />
            </div>
          </div>
          <button class="bag-sellBtn" style="background: rgba(70,255,180,.14); border-color: rgba(70,255,180,.30)" data-bag-action="openbox" data-bag-openbox="${escAttr(selected.id)}">Открыть набор</button>
        ` : ``}

        ${isExpItem ? `
          <div class="bag-expBox">
            <div class="bag-expRow">
              <div class="badge" style="min-width:64px">Герой</div>
              <select id="bagExpHero" class="bag-expSelect">
                ${usableHeroes.map((h)=>`<option value="${escAttr(h.id)}">${esc(h.name || h.tplId || h.id)}</option>`).join("")}
              </select>
            </div>
            <div class="bag-expRow">
              <div class="badge" style="min-width:64px">К-сть</div>
              <input id="bagExpQty" class="bag-expQty" type="number" min="1" max="${Math.max(1, Number(selected.qty||1))}" value="1" />
            </div>
          </div>
          <button class="bag-sellBtn" style="background: rgba(255,176,46,.18); border-color: rgba(255,176,46,.35)" data-bag-action="useexp" data-bag-useexp="${escAttr(selected.id)}" ${usableHeroes.length?"":"disabled"}>
            Використати
          </button>
        ` : ``}

        ${isSkillScroll ? `
          <div class="bag-expBox">
            <div class="bag-expRow"><div class="badge">Навик</div><div class="badge">+${Number(selected.effects?.skillPoints||0)} очок</div></div>
            ${Number(selected.effects?.awakenedSkillPoints||0) ? `<div class="bag-expRow"><div class="badge">Пробудж.</div><div class="badge">+${Number(selected.effects?.awakenedSkillPoints||0)}</div></div>` : ``}
            <div class="bag-expRow">
              <div class="badge" style="min-width:64px">К-сть</div>
              <input id="bagSkillQty" class="bag-expQty" type="number" min="1" max="${Math.max(1, Number(selected.qty||1))}" value="1" />
            </div>
          </div>
          <button class="bag-sellBtn" style="background: rgba(108,180,255,.18); border-color: rgba(108,180,255,.35)" data-bag-action="useskillscroll" data-bag-useskillscroll="${escAttr(selected.id)}">
            Використати на книгу ГГ
          </button>
        ` : ``}

        <button class="bag-sellBtn" data-bag-action="sell" data-bag-sell="${escAttr(selected.id)}">
          Продать
        </button>

        <div class="badge" style="opacity:.75">
          Пізніше зробимо підтвердження, ціну, і реальний продаж через сервер.
        </div>
      </div>
    </div>
  `;
}

/* ===================== BIND ===================== */

function bindBagUI(allItems, level, onlineSec, totalPages, capacity) {
  // tabs
  document.querySelectorAll("[data-bag-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      ui.tab = btn.dataset.bagTab;
      ui.page = 1;
      ui.selectedId = null;
      // IMPORTANT: temp bag & category filters depend on server inventory,
      // so we must re-load items when switching tabs.
      loadBag().catch(() => renderBag(allItems, { warn: "" }));
    });
  });

  // items click
  document.querySelectorAll("[data-bag-item]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.bagItem;
      ui.selectedId = id;
      renderBag(allItems, { warn: "" });
    });
  });

  // pager
  document.querySelectorAll("[data-bag-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dir = btn.dataset.bagPage;
      if (dir === "prev") ui.page = Math.max(1, ui.page - 1);
      if (dir === "next") ui.page = Math.min(totalPages, ui.page + 1);
      ui.selectedId = null;
      renderBag(allItems, { warn: "" });
    });
  });

  // actions
  document.querySelectorAll("[data-bag-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const act = btn.dataset.bagAction;

      if (act === "sort") {
        const sorted = sortBag(allItems);
        ui.selectedId = null;
        toast("Сортування виконано.");
        renderBag(sorted, { warn: "" });
        return;
      }

      if (act === "expand") {
        (async () => {
          try {
            const playerId = getPlayerId();
            if (!playerId) { toast("Немає playerId"); return; }

            const pRes = await fetch("/api/player/me?playerId=" + encodeURIComponent(playerId));
            const pJson = await pRes.json().catch(() => null);
            if (!pJson?.ok) { toast("Не вдалося отримати гравця"); return; }

            const invRes = await fetch("/api/inventory/get?playerId=" + encodeURIComponent(playerId));
            const invJson = await invRes.json().catch(() => null);
            const inv = invJson?.inventory || {};

            const freeExpands = Array.isArray(inv.freeExpands) ? inv.freeExpands : [];
            const nextFreeLevel = 10 * (freeExpands.length + 1);

            // Option 1: expand by level (free)
            if (Number(pJson.player.level) >= nextFreeLevel) {
              const r = await fetch("/api/inventory/expand", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ playerId, mode: "level" }),
              });
              const j = await r.json().catch(() => null);
              if (!j?.ok) { toast("Не вдалося розширити: " + (j?.error || "помилка")); return; }
              ui.capacity = j.capacity;
              toast("Сумка розширена на 1 слот (за рівень)! ");
              await loadBag();
              return;
            }

            // Option 2: paid (coupons -> gold) with dynamic price
            const paidOk = confirm(
              `Для безкоштовного розширення потрібно Lv ${nextFreeLevel}.\n\nРозширити зараз за купони/золото? (ціна росте кожного разу)`
            );
            if (!paidOk) return;

            const r2 = await fetch("/api/inventory/expand", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ playerId, mode: "paid" }),
            });
            const j2 = await r2.json().catch(() => null);
            if (!j2?.ok) { toast("Не вдалося розширити: " + (j2?.error || "помилка")); return; }
            ui.capacity = j2.capacity;
            toast("Сумка розширена на 1 слот!");
            await loadBag();
          } catch (e) {
            console.error(e);
            toast("Помилка розширення сумки");
          }
        })();

        return;
      }

      if (act === "openbox") {
        (async () => {
          try {
            const playerId = getPlayerId();
            const itemId = btn.dataset.bagOpenbox;
            const qty = Math.max(1, Number(document.querySelector("#bagOpenBoxQty")?.value || 1));
            for (let i = 0; i < qty; i++) {
              const res = await fetch("/api/inventory/openBox", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ playerId, itemId }),
              });
              const data = await safeJson(res);
              if (!res.ok || !data?.ok) {
                toast(`Не вдалося відкрити: ${data?.error || res.status}`);
                return;
              }
            }
            toast("Набір відкрито!");
            await loadBag();
          } catch (e) {
            toast(`Помилка: ${String(e?.message || e)}`);
          }
        })();
        return;
      }


      if (act === "activate") {
        const id = btn.dataset.bagActivate;
        if (!id) return;
        const playerId = getPlayerId();
        const qty = Math.max(1, Number(document.querySelector("#bagActivateQty")?.value || 1));
        if (!playerId) { toast("Немає playerId"); return; }

        fetch("/api/inventory/activate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, itemId: id, qty }),
        })
          .then((r) => r.json().catch(() => null))
          .then((data) => {
            if (!data?.ok) {
              toast(`Не вдалося активувати: ${data?.error || "помилка"}`);
              return;
            }
            toast("Активовано!");
            // reload from API
            loadBag();
          })
          .catch(() => toast("Помилка мережі"));

        return;
      }

      if (act === "useexp") {
        const itemId = btn.dataset.bagUseexp;
        const heroId = document.querySelector("#bagExpHero")?.value;
        const qty = Number(document.querySelector("#bagExpQty")?.value || 1);
        const playerId = getPlayerId();
        if (!playerId || !itemId || !heroId) return;

        fetch("/api/inventory/useExp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, heroId, itemId, qty }),
        })
          .then((r) => r.json().catch(() => null))
          .then((data) => {
            if (!data?.ok) {
              toast(`Не вдалося використати: ${data?.error || "помилка"}`);
              return;
            }
            toast(`+${data.gained} EXP`);
            loadBag();
          })
          .catch(() => toast("Помилка мережі"));

        return;
      }

      if (act === "useskillscroll") {
        const itemId = btn.dataset.bagUseskillscroll;
        const playerId = getPlayerId();
        const qty = Math.max(1, Number(document.querySelector("#bagSkillQty")?.value || 1));
        if (!playerId || !itemId) return;

        fetch("/api/skillbook/useScroll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, itemId, qty }),
        })
          .then((r) => r.json().catch(() => null))
          .then((data) => {
            if (!data?.ok) {
              toast(`Не вдалося використати: ${data?.error || "помилка"}`);
              return;
            }
            toast(`Книга навика: +${data.gainedSkillPoints || 0}` + ((data.gainedAwakenedPoints || 0) ? ` / +${data.gainedAwakenedPoints} пробуджених` : ""));
            loadBag();
          })
          .catch(() => toast("Помилка мережі"));

        return;
      }

      if (act === "sell") {
        const id = btn.dataset.bagSell;
        if (!id) return;
        const idx = allItems.findIndex((x) => String(x.id) === String(id));
        if (idx === -1) return;

        // prototype: remove item
        const removed = allItems.slice();
        const it = removed[idx];
        removed.splice(idx, 1);
        ui.selectedId = null;

        toast(`Продано: ${it?.name || "предмет"} (прототип)`);
        renderBag(removed, { warn: "" });

        // later: call API to sell + update currency
        return;
      }
    });
  });

  // Claim +1 bag slot per full online hour (click on time)
  const bagOnlineEl = document.getElementById("bagOnline");
  if (bagOnlineEl) {
    bagOnlineEl.addEventListener("click", async () => {
      try {
        const playerId = getPlayerId();
        if (!playerId) return;
        const r = await fetch("/api/inventory/expand", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, mode: "online" }),
        });
        const j = await r.json().catch(() => null);
        if (!j?.ok) {
          if (j?.error === "no_hours") {
            toast("Немає доступних годин. За кожну повну годину онлайн — 1 слот.");
          } else {
            toast("Не вдалося отримати слот: " + (j?.error || "помилка"));
          }
          return;
        }
        ui.capacity = j.capacity;
        toast("+1 слот за онлайн!");
        await loadBag();
      } catch (e) {
        toast("Помилка мережі");
      }
    });
  }

  // online timer live update
  const timer = setInterval(() => {
    const el = document.getElementById("bagOnline");
    if (el) el.textContent = formatOnline(Number(state?.player?.onlineSeconds || 0));
  }, 1000);

  // stop timer when modal closes
  const overlay = document.querySelector("#windows-root .modalOverlay");
  if (overlay) {
    const obs = new MutationObserver(() => {
      if (!document.body.contains(overlay)) {
        clearInterval(timer);
        obs.disconnect();
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }
}

/* ===================== LOGIC HELPERS ===================== */

function filterByTab(items, tabId) {
  const arr = Array.isArray(items) ? items : [];

  // back-compat for older saved UI states
  if (tabId === "all") tabId = "items";
  if (tabId === "equip") tabId = "equipment";

  const t = String(tabId || "items");

  const type = (x) => String(x?.type || "").toLowerCase();
  const slot = (x) => String(x?.slot || "").toLowerCase();

  // Equipment pieces: weapon / head/helm / armor/chest / cloak / boots/shoes / belt
  const isEquipment = (x) => {
    const tp = type(x);
    const sl = slot(x);
    if (["weapon", "armor"].includes(tp)) return true;
    if (["weapon", "shuriken", "scroll", "head", "helm", "helmet", "armor", "chest", "cloak", "shoes", "boots", "belt"].includes(sl)) return true;
    return false;
  };

  const isJewelry = (x) => type(x) === "jewelry" || slot(x) === "jewelry";

  // 1) Вещи: everything EXCEPT equipment / gems / artifacts / badges / jewelry
  if (t === "items") {
    return arr.filter((x) => {
      const tp = type(x);
      if (isEquipment(x)) return false;
      if (isJewelry(x)) return false;
      // Materials must live only in the "Материалы" tab.
      if (tp === "material") return false;
      if (["gem", "artifact", "badge"].includes(tp)) return false;
      return true;
    });
  }

  // 2) Екіперовка: only equipment (weapon/head/chest/cloak/shoes/belt)
  if (t === "equipment") return arr.filter((x) => isEquipment(x) && !isJewelry(x));

  // 3) Матеріали / 4) Самоцветы / 5) Артефакты / 6) Украшения / 7) Значок
  if (t === "materials") return arr.filter((x) => type(x) === "material");
  if (t === "gems") return arr.filter((x) => type(x) === "gem");
  if (t === "artifacts") return arr.filter((x) => type(x) === "artifact");
  if (t === "jewelry") return arr.filter((x) => isJewelry(x));
  if (t === "badge") return arr.filter((x) => type(x) === "badge");

  // 8) Временная сумка: show everything from temp bag (no additional filter)
  if (t === "temp") return arr;

  return arr;
}

function sortBag(items) {
  const arr = Array.isArray(items) ? items.slice() : [];
  arr.sort((a, b) => {
    const ta = String(a.type || "");
    const tb = String(b.type || "");
    if (ta !== tb) return ta.localeCompare(tb);
    return String(a.name || "").localeCompare(String(b.name || ""));
  });

  syncStateInventory(arr);
  return arr;
}

function syncStateInventory(items) {
  // keep state.inventory.items for other UI parts
  setState((s) => {
    if (!s.inventory) s.inventory = {};
    s.inventory.items = (Array.isArray(items) ? items : []).map((x) => ({
      id: x.id,
      tplId: x.tplId || null,
      name: x.name,
      type: x.type,
      slot: x.slot ?? null,
      rarity: x.rarity || "",
      qty: Number(x.qty ?? 1),
      desc: x.desc || "",
    }));
  });
}

function tabCountHint(tabId) {
  // purely visual hint on left menu; real count depends on loaded inventory
  // we keep it simple — show dot for now
  if (tabId === ui.tab) return "●";
  return "";
}

/* ===================== TOAST ===================== */

function toast(msg) {
  ui.toast = String(msg || "");
  ui.toastTs = Date.now();
  updateToast(true);
}

function updateToast(forceShow = false) {
  const el = document.getElementById("bagToast");
  if (!el) return;

  if (!ui.toast) {
    el.classList.remove("is-show");
    el.textContent = "";
    return;
  }

  el.textContent = ui.toast;
  el.classList.add("is-show");

  const now = Date.now();
  const age = now - (ui.toastTs || now);

  // auto-hide after 2.2s (like game hint bar)
  if (forceShow || age < 2200) {
    clearTimeout(updateToast._t);
    updateToast._t = setTimeout(() => {
      ui.toast = "";
      el.classList.remove("is-show");
      el.textContent = "";
    }, 2200);
  }
}

/* ===================== UTILS ===================== */

function formatOnline(sec) {
  const s = Math.max(0, Number(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return `${m}:${String(ss).padStart(2, "0")}`;
}

function esc(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escAttr(str) {
  return esc(str).replaceAll("`", "&#096;");
}