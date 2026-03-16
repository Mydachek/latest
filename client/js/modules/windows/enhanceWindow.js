// client/js/modules/windows/enhanceWindow.js
import { state, setState } from "../../state.js";
import { openModal } from "./windowsRoot.js";

// NW-like equipment systems (Phase1-2 UI):
// Tabs:
//  - Усиление: +0.3%/lvl (server does real math)
//  - Наследие: transfer enhanceLevel between equipped items (silver)
//  - Сделать вещь: test craft (materials -> equipment)
//  - Проточка: unlock gem slot on equipment (materials)
//  - Усилить вещь: separate upgrade with chance (materials, divine stone gives 100%)

const ENH_SLOTS = ["weapon", "armor", "head", "cloak", "belt", "shoes"]; // 6 вещей
const SLOT_LABEL = {
  weapon: "Оружие",
  armor: "Броня",
  head: "Шлем",
  cloak: "Плащ",
  belt: "Пояс",
  shoes: "Обувь",
};

// Test recipes (can extend later)
const RECIPES = [
  {
    id: "craft_akatsuki_cloak",
    outTplId: "set_akatsuki_cloak",
    title: "Акацукі: Плащ",
    req: [
      { tplId: "mat_base", qty: 10 },
      { tplId: "mat_akatsuki", qty: 5 },
    ],
  },
  {
    id: "craft_akatsuki_kunai",
    outTplId: "set_akatsuki_kunai",
    title: "Акацукі: Кунай",
    req: [
      { tplId: "mat_base", qty: 10 },
      { tplId: "mat_akatsuki", qty: 5 },
    ],
  },
];

let _overlay = null;
let _ui = {
  heroId: null,
  slot: "weapon",
  tab: "enhance",
  heritageFrom: "weapon",
  heritageTo: "armor",
  craftId: RECIPES[0]?.id || null,
};

export function openEnhanceWindow({ heroId } = {}) {
  _ui.heroId = heroId || state.team.selectedHeroId || state.heroes?.[0]?.id || null;
  _ui.slot = ENH_SLOTS.includes(_ui.slot) ? _ui.slot : "weapon";

  const modal = openModal({
    title: "Усиление",
    contentHtml: `<div class="badge">Загрузка...</div>`,
    modalClass: "nw-modal",
  });
  _overlay = modal.overlay;

  ensureData().then(() => rerender()).catch(() => rerender());
  return modal;
}

function bodyEl() {
  return _overlay?.querySelector(".modalBody");
}

function rerender() {
  const body = bodyEl();
  if (!body) return;
  body.innerHTML = render(state);
  bind();
}

function render(s) {
  const heroes = Array.isArray(s.heroes) ? s.heroes : [];
  if (!heroes.length) return `<div class="badge">Герои не загружены</div>`;

  const heroId = _ui.heroId || s.team.selectedHeroId || heroes[0].id;
  const hero = heroes.find((h) => h.id === heroId) || heroes[0];

  const inv = s.team?.serverInv;
  const eq = inv?.equippedItemsByHero?.[hero.id] || inv?.equippedItemsByHero?.[heroId] || {};
  const cat = s.team?.catalogMap || {};

  const tab = String(_ui.tab || "enhance");
  const tabBar = renderTabBar(tab);

  if (tab === "enhance") return renderEnhance({ hero, heroes, inv, eq, cat, tabBar });
  if (tab === "heritage") return renderHeritage({ hero, heroes, inv, eq, cat, tabBar });
  if (tab === "craft") return renderCraft({ hero, heroes, inv, eq, cat, tabBar });
  if (tab === "socket") return renderSocket({ hero, heroes, inv, eq, cat, tabBar });
  if (tab === "upgrade") return renderUpgrade({ hero, heroes, inv, eq, cat, tabBar });

  return `<div class="enh-wrap">${tabBar}<div class="badge">Скоро</div></div>`;
}

function renderTabBar(active) {
  const tabs = [
    ["enhance", "Усиление"],
    ["heritage", "Наследие"],
    ["craft", "Сделать вещь"],
    ["socket", "Проточка"],
    ["upgrade", "Усилить вещь"],
  ];
  return `
    <div class="enh-tabs">
      ${tabs
        .map(
          ([id, label]) =>
            `<button class="enh-tab ${active === id ? "is-active" : ""}" data-enh-tab="${id}">${label}</button>`
        )
        .join("")}
    </div>
  `;
}

function renderEnhance({ hero, heroes, inv, eq, cat, tabBar }) {
  const slot = ENH_SLOTS.includes(_ui.slot) ? _ui.slot : "weapon";
  const item = eq?.[slot] || null;
  const tpl = item?.tplId ? cat[item.tplId] : null;

  const cur = Math.max(0, Number(item?.enhanceLevel || 0));
  const next = cur + 1;
  const max = Math.max(1, Number(hero.level || 1));
  const canEnh = !!item && next <= max;

  return `
    <div class="enh-wrap">
      ${tabBar}

      <div class="enh-cols">
        <div class="enh-left">
          <div class="enh-title">Персонажи</div>
          <div class="enh-heroes">
            ${heroes
              .map(
                (h) => `
              <button class="enh-hero ${h.id === hero.id ? "is-active" : ""}" data-hero="${h.id}">
                <span class="enh-heroName">${escapeHtml(h.name || "—")}</span>
                <span class="enh-heroLvl">Lv ${Number(h.level || 1)}</span>
              </button>
            `
              )
              .join("")}
          </div>
        </div>

        <div class="enh-mid">
          <div class="enh-title">Экипировка</div>
          <div class="enh-items">
            ${ENH_SLOTS.map((sk) => {
              const it = eq?.[sk] || null;
              const t = it?.tplId ? cat[it.tplId] : null;
              const name = it?.name || t?.name || t?.title || sk;
              const lvl = Math.max(0, Number(it?.enhanceLevel || 0));
              return `
                <button class="enh-item ${sk === slot ? "is-active" : ""}" data-slot="${sk}">
                  <div class="enh-itemIcon"></div>
                  <div class="enh-itemBody">
                    <div class="enh-itemTop">
                      <span class="enh-itemSlot">${escapeHtml(SLOT_LABEL[sk] || sk)}</span>
                      <span class="enh-plus">+${lvl}</span>
                    </div>
                    <div class="enh-itemName">${it ? escapeHtml(name) : "<i>пусто</i>"}</div>
                  </div>
                </button>
              `;
            }).join("")}
          </div>
        </div>

        <div class="enh-right">
          <div class="enh-title">Усиление</div>

          <div class="enh-card">
            <div class="enh-bigIcon"></div>
            <div class="enh-statRows">
              <div class="enh-row"><span>Будет</span><b>${item ? "+" + next : "—"}</b></div>
              <div class="enh-row"><span>Сейчас</span><b>${item ? "+" + cur : "—"}</b></div>
              <div class="enh-row"><span>Цена</span><b><span class="enh-cost">${canEnh ? "..." : "—"}</span> <span class="muted">silver</span></b></div>
              <div class="enh-row"><span>Макс</span><b>+${max}</b></div>
            </div>
          </div>

          <div class="enh-options">
            <label class="enh-opt"><input type="checkbox" disabled /> Двойное усиление <span class="muted">(скоро)</span></label>
            <label class="enh-opt"><input type="checkbox" disabled /> Скидка <span class="muted">(скоро)</span></label>
          </div>

          <div class="enh-footer">
            <button class="enh-mainBtn" data-enhance ${canEnh ? "" : "disabled"}>Усиление</button>
            <div class="muted" style="margin-top:6px;">
              +0.3% к статам предмета за уровень. Заточка доступна только для 6 вещей.
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderHeritage({ hero, heroes, inv, eq, cat, tabBar }) {
  const from = ENH_SLOTS.includes(_ui.heritageFrom) ? _ui.heritageFrom : "weapon";
  const to = ENH_SLOTS.includes(_ui.heritageTo) ? _ui.heritageTo : "armor";

  const fromIt = eq?.[from] || null;
  const toIt = eq?.[to] || null;
  const fromLvl = Math.max(0, Number(fromIt?.enhanceLevel || 0));
  const toLvl = Math.max(0, Number(toIt?.enhanceLevel || 0));
  const cost = heritageCost(fromLvl);
  const fromHigher = fromLvl > toLvl;
  const gain = fromHigher ? Math.max(0, fromLvl - toLvl) : Math.floor(fromLvl / 2);
  const resultLvl = !!fromIt && !!toIt ? toLvl + gain : 0;
  const modeLabel = fromHigher ? "Полное наследие" : "Штраф 50%";
  const can = !!fromIt && !!toIt && from !== to && fromLvl > 0 && gain > 0;

  return `
    <div class="enh-wrap">
      ${tabBar}

      <div class="enh-cols enh-cols-heritage">
        <div class="enh-left">
          <div class="enh-title">Персонажи</div>
          <div class="enh-heroes">
            ${heroes
              .map(
                (h) => `
              <button class="enh-hero ${h.id === hero.id ? "is-active" : ""}" data-hero="${h.id}">
                <span class="enh-heroName">${escapeHtml(h.name || "—")}</span>
                <span class="enh-heroLvl">Lv ${Number(h.level || 1)}</span>
              </button>
            `
              )
              .join("")}
          </div>
        </div>

        <div class="enh-mid enh-mid-heritage">
          <div class="enh-title">Наследие уровня заточки</div>

          <div class="enh-two enh-two-heritage">
            <div class="enh-sel enh-sel-heritage">
              <div class="enh-sub">Источник</div>
              ${slotPicker(from, "heritageFrom")}
              ${itemMiniCard(fromIt, cat)}
              <div class="enh-pill">Уровень: <b>+${fromLvl}</b></div>
            </div>

            <div class="enh-arrow enh-arrow-heritage">⇄</div>

            <div class="enh-sel enh-sel-heritage">
              <div class="enh-sub">Цель</div>
              ${slotPicker(to, "heritageTo")}
              ${itemMiniCard(toIt, cat)}
              <div class="enh-pill">Будет: <b>+${resultLvl}</b> <span class="muted">(сейчас +${toLvl})</span></div>
            </div>
          </div>

          <div class="enh-panel enh-panel-heritage" style="margin-top:12px;">
            <div class="enh-row2"><span>Режим</span><b>${modeLabel}</b></div>
            <div class="enh-row2"><span>Прирост цели</span><b>+${gain}</b></div>
            <div class="enh-row2"><span>Цена</span><b>${fmt(cost)} <span class="muted">silver</span></b></div>
            <div class="muted enh-heritageHint" style="margin-top:6px;">Если источник выше цели — передаётся полный уровень источника. Если источник ниже или равен цели — цель получает только 50% уровня источника. Источник после наследия становится +0.</div>
            <button class="enh-mainBtn" data-heritage ${can ? "" : "disabled"} style="margin-top:10px;">Наследие</button>
          </div>
        </div>

        <div class="enh-right enh-right-heritage">
          <div class="enh-title">Подсказка</div>
          <div class="enh-panel enh-panel-heritageInfo">
            <div class="enh-row2"><span>Источник</span><b>+${fromLvl}</b></div>
            <div class="enh-row2"><span>Цель сейчас</span><b>+${toLvl}</b></div>
            <div class="enh-row2"><span>Цель после</span><b>+${resultLvl}</b></div>
            <div class="muted" style="margin-top:8px;">Пример штрафного режима: +34 и +7 → +37. Это защищает систему от абуза дешёвых уровней.</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderCraft({ hero, heroes, inv, eq, cat, tabBar }) {
  const recipes = RECIPES;
  const active = recipes.find((r) => r.id === _ui.craftId) || recipes[0];

  const counts = materialCounts(inv);

  return `
    <div class="enh-wrap">
      ${tabBar}

      <div class="enh-cols">
        <div class="enh-left">
          <div class="enh-title">Персонажи</div>
          <div class="enh-heroes">
            ${heroes
              .map(
                (h) => `
              <button class="enh-hero ${h.id === hero.id ? "is-active" : ""}" data-hero="${h.id}">
                <span class="enh-heroName">${escapeHtml(h.name || "—")}</span>
                <span class="enh-heroLvl">Lv ${Number(h.level || 1)}</span>
              </button>
            `
              )
              .join("")}
          </div>
        </div>

        <div class="enh-mid">
          <div class="enh-title">Сделать вещь</div>
          <div class="enh-recipes">
            ${recipes
              .map((r) => {
                const isA = r.id === active.id;
                return `
                  <button class="enh-recipeCard ${isA ? "is-active" : ""}" data-recipe="${r.id}">
                    <div class="enh-recipeTop">
                      <div class="enh-recipeName">${escapeHtml(r.title)}</div>
                      <div class="enh-recipeOut">${escapeHtml(cat[r.outTplId]?.rarity || "")}</div>
                    </div>
                    <div class="enh-req">
                      ${r.req
                        .map((q) => {
                          const have = counts[q.tplId] || 0;
                          const ok = have >= q.qty;
                          const nm = cat[q.tplId]?.name || q.tplId;
                          return `<div class="enh-reqRow ${ok ? "ok" : "bad"}"><span>${escapeHtml(nm)}</span><b>${have}/${q.qty}</b></div>`;
                        })
                        .join("")}
                    </div>
                  </button>
                `;
              })
              .join("")}
          </div>

          <div class="enh-panel" style="margin-top:12px;">
            <div class="enh-row2"><span>Результат</span><b>${escapeHtml(active.title)}</b></div>
            <div class="muted" style="margin-top:6px;">Предмет будет добавлен в сумку (или во временную сумку, если нет места).</div>
            <button class="enh-mainBtn" data-craft style="margin-top:10px;">Сделать</button>
          </div>
        </div>

        <div class="enh-right">
          <div class="enh-title">Материалы</div>
          <div class="enh-panel">
            ${["mat_base", "mat_akatsuki", "tool_socket", "stone_divine", "stone_rainbow"]
              .map((tplId) => {
                const nm = cat[tplId]?.name || tplId;
                const have = counts[tplId] || 0;
                return `<div class="enh-row2"><span>${escapeHtml(nm)}</span><b>${have}</b></div>`;
              })
              .join("")}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderSocket({ hero, heroes, inv, eq, cat, tabBar }) {
  const slot = ENH_SLOTS.includes(_ui.slot) ? _ui.slot : "weapon";
  const item = eq?.[slot] || null;
  const sockets = Math.max(0, Number(item?.gemSlots || item?.socketSlots || 0));
  const maxSockets = 3;

  const counts = materialCounts(inv);
  const needTool = 1;
  const needBase = 2;
  const haveTool = counts.tool_socket || 0;
  const haveBase = counts.mat_base || 0;

  const can = !!item && sockets < maxSockets && haveTool >= needTool && haveBase >= needBase;

  return `
    <div class="enh-wrap">
      ${tabBar}

      <div class="enh-cols">
        <div class="enh-left">
          <div class="enh-title">Персонажи</div>
          <div class="enh-heroes">
            ${heroes
              .map(
                (h) => `
              <button class="enh-hero ${h.id === hero.id ? "is-active" : ""}" data-hero="${h.id}">
                <span class="enh-heroName">${escapeHtml(h.name || "—")}</span>
                <span class="enh-heroLvl">Lv ${Number(h.level || 1)}</span>
              </button>
            `
              )
              .join("")}
          </div>
        </div>

        <div class="enh-mid">
          <div class="enh-title">Проточка (слоты самоцветов)</div>
          <div class="enh-items">
            ${ENH_SLOTS.map((sk) => {
              const it = eq?.[sk] || null;
              const t = it?.tplId ? cat[it.tplId] : null;
              const name = it?.name || t?.name || sk;
              const sN = Math.max(0, Number(it?.gemSlots || it?.socketSlots || 0));
              return `
                <button class="enh-item ${sk === slot ? "is-active" : ""}" data-slot="${sk}">
                  <div class="enh-itemIcon"></div>
                  <div class="enh-itemBody">
                    <div class="enh-itemTop">
                      <span class="enh-itemSlot">${escapeHtml(SLOT_LABEL[sk] || sk)}</span>
                      <span class="enh-plus">${sN}/${maxSockets}</span>
                    </div>
                    <div class="enh-itemName">${it ? escapeHtml(name) : "<i>пусто</i>"}</div>
                  </div>
                </button>
              `;
            }).join("")}
          </div>

          <div class="enh-panel" style="margin-top:12px;">
            <div class="enh-row2"><span>Слоты</span><b>${sockets}/${maxSockets}</b></div>
            <div class="enh-row2"><span>Нужно</span><b>${escapeHtml(cat.tool_socket?.name || "tool_socket")} x${needTool} + ${escapeHtml(cat.mat_base?.name || "mat_base")} x${needBase}</b></div>
            <button class="enh-mainBtn" data-socket ${can ? "" : "disabled"} style="margin-top:10px;">Открыть слот</button>
            <div class="muted" style="margin-top:6px;">Открывает 1 слот (максимум 3). Материалы тратятся.</div>
          </div>
        </div>

        <div class="enh-right">
          <div class="enh-title">В наличии</div>
          <div class="enh-panel">
            <div class="enh-row2"><span>${escapeHtml(cat.tool_socket?.name || "Инструмент")}</span><b>${haveTool}</b></div>
            <div class="enh-row2"><span>${escapeHtml(cat.mat_base?.name || "Базовый материал")}</span><b>${haveBase}</b></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderUpgrade({ hero, heroes, inv, eq, cat, tabBar }) {
  const slot = ENH_SLOTS.includes(_ui.slot) ? _ui.slot : "weapon";
  const item = eq?.[slot] || null;
  const up = Math.max(0, Number(item?.upgradeLevel || 0));
  const counts = materialCounts(inv);

  const haveRainbow = counts.stone_rainbow || 0;
  const hasDivine = (counts.stone_divine || 0) > 0;

  const chance = hasDivine ? 100 : 50;
  const can = !!item && haveRainbow >= 1;

  return `
    <div class="enh-wrap">
      ${tabBar}

      <div class="enh-cols">
        <div class="enh-left">
          <div class="enh-title">Персонажи</div>
          <div class="enh-heroes">
            ${heroes
              .map(
                (h) => `
              <button class="enh-hero ${h.id === hero.id ? "is-active" : ""}" data-hero="${h.id}">
                <span class="enh-heroName">${escapeHtml(h.name || "—")}</span>
                <span class="enh-heroLvl">Lv ${Number(h.level || 1)}</span>
              </button>
            `
              )
              .join("")}
          </div>
        </div>

        <div class="enh-mid">
          <div class="enh-title">Усилить вещь</div>
          <div class="enh-items">
            ${ENH_SLOTS.map((sk) => {
              const it = eq?.[sk] || null;
              const t = it?.tplId ? cat[it.tplId] : null;
              const name = it?.name || t?.name || sk;
              const lvl = Math.max(0, Number(it?.upgradeLevel || 0));
              return `
                <button class="enh-item ${sk === slot ? "is-active" : ""}" data-slot="${sk}">
                  <div class="enh-itemIcon"></div>
                  <div class="enh-itemBody">
                    <div class="enh-itemTop">
                      <span class="enh-itemSlot">${escapeHtml(SLOT_LABEL[sk] || sk)}</span>
                      <span class="enh-plus">+${lvl}</span>
                    </div>
                    <div class="enh-itemName">${it ? escapeHtml(name) : "<i>пусто</i>"}</div>
                  </div>
                </button>
              `;
            }).join("")}
          </div>

          <div class="enh-panel" style="margin-top:12px;">
            <div class="enh-row2"><span>Шанс успеха</span><b>${chance}%</b></div>
            <div class="enh-row2"><span>Нужно</span><b>${escapeHtml(cat.stone_rainbow?.name || "stone_rainbow")} x1</b></div>
            <div class="muted" style="margin-top:6px;">${hasDivine ? "Божественный камень найден — 100% шанс (не тратится)." : "Без божественного камня шанс 50%."}</div>
            <button class="enh-mainBtn" data-upgrade ${can ? "" : "disabled"} style="margin-top:10px;">Усилить</button>
          </div>
        </div>

        <div class="enh-right">
          <div class="enh-title">Материалы</div>
          <div class="enh-panel">
            <div class="enh-row2"><span>${escapeHtml(cat.stone_rainbow?.name || "Радужный")}</span><b>${haveRainbow}</b></div>
            <div class="enh-row2"><span>${escapeHtml(cat.stone_divine?.name || "Божественный")}</span><b>${counts.stone_divine || 0}</b></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function slotPicker(value, kind) {
  return `
    <select class="enh-select" data-${kind}>
      ${ENH_SLOTS.map((s) => `<option value="${s}" ${s === value ? "selected" : ""}>${escapeHtml(SLOT_LABEL[s] || s)}</option>`).join("")}
    </select>
  `;
}

function itemMiniCard(item, cat) {
  if (!item) {
    return `<div class="enh-miniCard"><div class="muted">пусто</div></div>`;
  }
  const tpl = item?.tplId ? cat[item.tplId] : null;
  const name = item?.name || tpl?.name || item?.tplId || "предмет";
  const desc = tpl?.desc || item?.desc || "";
  return `
    <div class="enh-miniCard">
      <div class="enh-miniTop">
        <div class="enh-miniName">${escapeHtml(name)}</div>
        <div class="enh-miniTag">${escapeHtml(tpl?.rarity || "")}</div>
      </div>
      <div class="muted">${escapeHtml(desc)}</div>
    </div>
  `;
}

function heritageCost(level) {
  const L = Math.max(0, Number(level || 0));
  if (L <= 0) return 0;
  // simple scaling (can tune later)
  return Math.floor(2000 + L * L * 35);
}

function materialCounts(inv) {
  const out = {};
  const add = (it) => {
    if (!it || !it.tplId) return;
    const q = Number(it.qty || 1);
    out[it.tplId] = (out[it.tplId] || 0) + q;
  };
  (inv?.bagItems || []).forEach(add);
  (inv?.tempBagItems || []).forEach(add);
  return out;
}

function fmt(n) {
  const x = Number(n || 0);
  if (!Number.isFinite(x)) return "0";
  return String(Math.floor(x));
}

function bind() {
  const body = bodyEl();
  if (!body) return;

  body.querySelectorAll("[data-enh-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      _ui.tab = btn.dataset.enhTab;
      rerender();
    });
  });

  body.querySelectorAll("[data-hero]").forEach((btn) => {
    btn.addEventListener("click", () => {
      _ui.heroId = btn.dataset.hero;
      rerender();
    });
  });

  body.querySelectorAll("[data-slot]").forEach((btn) => {
    btn.addEventListener("click", () => {
      _ui.slot = btn.dataset.slot;
      rerender();
    });
  });

  const selFrom = body.querySelector("[data-heritageFrom]");
  if (selFrom) {
    selFrom.addEventListener("change", () => {
      _ui.heritageFrom = selFrom.value;
      rerender();
    });
  }
  const selTo = body.querySelector("[data-heritageTo]");
  if (selTo) {
    selTo.addEventListener("change", () => {
      _ui.heritageTo = selTo.value;
      rerender();
    });
  }

  body.querySelectorAll("[data-recipe]").forEach((btn) => {
    btn.addEventListener("click", () => {
      _ui.craftId = btn.dataset.recipe;
      rerender();
    });
  });

  // Actions
  const playerId = state.player?.id || localStorage.getItem("playerId") || "";

  const enhBtn = body.querySelector("[data-enhance]");
  if (enhBtn) {
    enhBtn.addEventListener("click", async () => {
      if (!playerId || !_ui.heroId || !_ui.slot) return;
      enhBtn.disabled = true;
      try {
        const r = await api("/api/equipment/enhance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, heroId: _ui.heroId, equipSlot: _ui.slot }),
        });
        if (!r.ok) alert(r.error || "Ошибка усиления");
        await ensureData();
      } catch (e) {
        alert(String(e?.message || e));
      } finally {
        enhBtn.disabled = false;
        rerender();
      }
    });

    // fill cost placeholder (approx, matches server)
    const inv = state.team?.serverInv;
    const eq = inv?.equippedItemsByHero?.[_ui.heroId] || {};
    const item = eq?.[_ui.slot];
    const cur = Math.max(0, Number(item?.enhanceLevel || 0));
    const next = cur + 1;
    const hero = (state.heroes || []).find((h) => h.id === _ui.heroId);
    const max = Math.max(1, Number(hero?.level || 1));
    const costEl = body.querySelector(".enh-cost");
    if (costEl && item && next <= max) {
      const cost = Math.floor(1000 * Math.pow(1.07, Math.max(0, next - 1)));
      costEl.textContent = String(cost);
    }
  }

  const heritageBtn = body.querySelector("[data-heritage]");
  if (heritageBtn) {
    heritageBtn.addEventListener("click", async () => {
      if (!playerId || !_ui.heroId) return;
      heritageBtn.disabled = true;
      try {
        const r = await api("/api/equipment/heritage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, heroId: _ui.heroId, fromSlot: _ui.heritageFrom, toSlot: _ui.heritageTo }),
        });
        if (!r.ok) alert(r.error || "Ошибка");
        await ensureData();
      } catch (e) {
        alert(String(e?.message || e));
      } finally {
        heritageBtn.disabled = false;
        rerender();
      }
    });
  }

  const craftBtn = body.querySelector("[data-craft]");
  if (craftBtn) {
    craftBtn.addEventListener("click", async () => {
      if (!playerId) return;
      const rec = RECIPES.find((r) => r.id === _ui.craftId) || RECIPES[0];
      if (!rec) return;
      craftBtn.disabled = true;
      try {
        const r = await api("/api/equipment/craft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, recipeId: rec.id }),
        });
        if (!r.ok) alert(r.error || "Ошибка крафта");
        await ensureData();
      } catch (e) {
        alert(String(e?.message || e));
      } finally {
        craftBtn.disabled = false;
        rerender();
      }
    });
  }

  const socketBtn = body.querySelector("[data-socket]");
  if (socketBtn) {
    socketBtn.addEventListener("click", async () => {
      if (!playerId || !_ui.heroId || !_ui.slot) return;
      socketBtn.disabled = true;
      try {
        const r = await api("/api/equipment/socket", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, heroId: _ui.heroId, equipSlot: _ui.slot }),
        });
        if (!r.ok) alert(r.error || "Ошибка");
        await ensureData();
      } catch (e) {
        alert(String(e?.message || e));
      } finally {
        socketBtn.disabled = false;
        rerender();
      }
    });
  }

  const upgradeBtn = body.querySelector("[data-upgrade]");
  if (upgradeBtn) {
    upgradeBtn.addEventListener("click", async () => {
      if (!playerId || !_ui.heroId || !_ui.slot) return;
      upgradeBtn.disabled = true;
      try {
        const r = await api("/api/equipment/upgrade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, heroId: _ui.heroId, equipSlot: _ui.slot }),
        });
        if (!r.ok) alert(r.error || "Ошибка");
        await ensureData();
      } catch (e) {
        alert(String(e?.message || e));
      } finally {
        upgradeBtn.disabled = false;
        rerender();
      }
    });
  }
}

async function ensureData() {
  const playerId = localStorage.getItem("playerId") || state.player?.id || "";
  if (!playerId) return;

  const [heroes, inv, player, cat] = await Promise.all([
    api(`/api/heroes/list?playerId=${encodeURIComponent(playerId)}`),
    api(`/api/inventory/get?playerId=${encodeURIComponent(playerId)}`),
    api(`/api/player/me?playerId=${encodeURIComponent(playerId)}`),
    api(`/api/items/catalog`),
  ]);

  if (heroes?.ok && Array.isArray(heroes.heroes)) {
    setState((s) => {
      s.heroes = heroes.heroes;
    });
    if (!_ui.heroId) _ui.heroId = heroes.heroes[0]?.id || null;
  }
  if (inv?.ok && inv.inventory) {
    setState((s) => {
      s.team.serverInv = inv.inventory;
    });
  }
  if (player?.ok && player.player) {
    setState((s) => {
      s.player.id = player.player.id || s.player.id;
      s.player.level = Number(player.player.level || s.player.level);
      s.player.gold = Number(player.player.currency?.gold ?? player.player.gold ?? s.player.gold);
      s.player.silver = Number(player.player.currency?.silver ?? player.player.silver ?? s.player.silver);
      s.player.coupons = Number(player.player.currency?.coupons ?? player.player.coupons ?? s.player.coupons);
    });
  }
  if (cat?.ok && Array.isArray(cat.items)) {
    const map = {};
    for (const it of cat.items) {
      if (it?.tplId) map[it.tplId] = it;
    }
    setState((s) => {
      s.team.catalogMap = map;
    });
  }
}

async function api(url, opts) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, ...(data || {}), status: res.status };
  return data;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
