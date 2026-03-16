import { state, setState } from "../../state.js";
import { openModal } from "./windowsRoot.js";
import { openStatsWindow } from "./teamStatsWindow.js";
import { openTeamTransferWindow } from "./teamTransferWindow.js";
import { openTeamManageWindow } from "./teamManageWindow.js";
import { openEnhanceWindow } from "./enhanceWindow.js";
import { openGemsWindow } from "./gemsWindow.js";

export function openTeamWindow() {
  const modal = openModal({
    title: "Информация",
    contentHtml: render(state),
  });
  bind();
  // підтягуємо інвентар/екіпу з сервера (щоб можна було вдягати речі)
  Promise.all([loadTeamData(), refreshHeroesAndStats()]).then(()=>rerender()).catch(()=>{});
  return modal;
}

function rerender() {
  const body = document.querySelector("#windows-root .modalBody");
  if (!body) return;
  body.innerHTML = render(state);
  bind();
}

function render(s) {
  const heroes = s.heroes;
  if (!Array.isArray(heroes) || heroes.length === 0) {
    return `<div class="badge">Герої ще завантажуються...</div>`;
  }
  const selectedId = s.team.selectedHeroId || heroes[0].id;
  const selected = heroes.find(h => h.id === selectedId) || heroes[0];

  const raw = selected.__raw || {};
  const expNow = Number(raw.exp ?? selected.exp ?? 0);
  const expNeed = Number(raw.expToNext ?? selected.expToNext ?? 0);
  const displayLvl = Number(raw.level ?? selected.lvl ?? selected.level ?? 1) || 1;

  const eq = getEquippedForHero(s, selectedId);
  const tab = s.team.centerTab || "clothes";
  const rightTab = s.team.rightTab || "clothes";
  const showAll = !!s.team.showAll;

  const list = getInventoryList(s, rightTab);

  const pageSize = 24;
  const page = s.team.invPage || 1;
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const start = (pageSafe - 1) * pageSize;
  const visible = list.slice(start, start + pageSize);

  const cells = visible
    .map(itemCell)
    .concat(Array.from({ length: pageSize - visible.length }).map(() => emptyCell()));

  return `
    <div class="tw2-wrap">

      <!-- LEFT -->
      <div class="tw2-left">
        <div class="tw2-leftHead">
          <div>Ниндзя</div>
          <div class="tw2-leftMeta">1/10</div>
          <button class="tw2-plus" title="Добавить">+</button>
        </div>

        <div class="tw2-heroList">
          ${heroes.map(h => heroRow(h, selectedId)).join("")}
        </div>

        <div class="tw2-leftBottom">
          <button class="tw2-btn" data-left-action="transfer">Переодеть</button>
          <button class="tw2-btn" data-left-action="manage">Управление</button>
        </div>
      </div>

      <!-- CENTER -->
      <div class="tw2-center">
        <div class="tw2-tabs">
          <button class="tw2-tab ${tab === "clothes" ? "is-active" : ""}" data-tab="clothes">Одежда</button>
          <button class="tw2-tab ${tab === "jewelry" ? "is-active" : ""}" data-tab="jewelry">Украшение</button>
        </div>

        <div class="tw2-centerBox">
          <div class="tw2-topLine">
            <div class="tw2-title">
              <span class="tw2-rank" data-rank-tip="1">${selected.rank || ""}</span>
              <span class="tw2-name">${esc(selected.name)}</span>
              <span class="tw2-lvl">Lv.${displayLvl}</span>
            </div>

            <div class="tw2-exp">Опыт: ${fmt(expNow)}/${fmt(expNeed)}</div>
          </div>

          <div class="tw2-body">
            <div class="tw2-equipArea">
              ${renderRingLayout(selected, tab, eq)}
              <div class="tw2-equipHint">
                Клік по предмету справа → одягнути. Клік по слоту з предметом → зняти.
              </div>
            </div>

            <div class="tw2-power">
              <div class="tw2-powerLabel">Мощь</div>
              <div class="tw2-powerVal">${fmtStat(s.stats[selectedId]?.power ?? 0)}</div>
            </div>

            <div class="tw2-centerActions">
              <button class="tw2-btn2" data-center-action="remove">Убрать</button>
              <button class="tw2-btn2" data-open-stats="1">Детали</button>
              <button class="tw2-btn2" data-center-action="enhance">Усиление</button>
              <button class="tw2-btn2" data-center-action="gems">Самоцветы</button>
            </div>
          </div>

          <div class="tw2-statsMini">
            <div class="tw2-miniTabs">
              <button class="tw2-miniTab is-active">PVE</button>
              <button class="tw2-miniTab">PVP</button>
            </div>
            <div class="tw2-miniGrid">
              ${miniStat("Сила духа", s.stats[selectedId]?.spirit)}
              ${miniStat("Чакра", s.stats[selectedId]?.chakra)}
              ${miniStat("Сила", s.stats[selectedId]?.strength)}
              ${miniStat("Ловкость", s.stats[selectedId]?.agility)}
              ${miniStat("Жизнь", s.stats[selectedId]?.hp)}
              ${miniStat("Физ.защита", s.stats[selectedId]?.physDef)}
              ${miniStat("Стратег.защита", s.stats[selectedId]?.stratDef)}
              ${miniStat("Скорость", s.stats[selectedId]?.speed)}
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT: інвентар -->
      <div class="tw2-right">
        <div class="tw2-rightTabs">
          <button class="tw2-rTab ${rightTab === "clothes" ? "is-active" : ""}" data-rtab="clothes">Одежда</button>
          <button class="tw2-rTab ${rightTab === "items" ? "is-active" : ""}" data-rtab="items">Вещи</button>
          <button class="tw2-rTab ${rightTab === "jewelry" ? "is-active" : ""}" data-rtab="jewelry">Украшение</button>
        </div>

        <div class="tw2-invGrid">
          ${cells.join("")}
        </div>

        <div class="tw2-invBottom">
          <label class="tw2-check">
            <input type="checkbox" data-showall ${showAll ? "checked" : ""}>
            Показать все
          </label>

          <div class="tw2-page">
            <button class="tw2-pageBtn" data-page="prev">◀</button>
            <div class="tw2-pageVal">${pageSafe}/${totalPages}</div>
            <button class="tw2-pageBtn" data-page="next">▶</button>
          </div>
        </div>
      </div>

      <div id="tw2-tooltip" class="tw2-tooltip" style="display:none"></div>
    </div>
  `;
}

function heroRow(h, selectedId) {
  const active = h.id === selectedId ? "is-active" : "";
  return `
    <div class="tw2-heroRow ${active}" data-select-hero="${h.id}">
      <div class="tw2-heroName">${esc(h.name)}</div>
    </div>
  `;
}

/* -------------------- RING LAYOUT (Naruto Online-like) -------------------- */
function renderRingLayout(selected, tab, eq) {
  const clothesPos = {
    helm:   { x: 50, y: 12 },
    // ⚠️ Only ONE weapon slot. Kunai/Shuriken/Scroll are weapon subtypes.
    weapon: { x: 22, y: 32 },
    armor:  { x: 78, y: 32 },
    shoes:  { x: 22, y: 74 },
    belt:   { x: 78, y: 74 },
    cloak:  { x: 50, y: 92 },
  };

  const jewelryPos = {
    j1: { x: 10, y: 16 },
    j2: { x: 6,  y: 50 },
    j3: { x: 10, y: 84 },
    j4: { x: 90, y: 16 },
    j5: { x: 94, y: 50 },
    j6: { x: 90, y: 84 },
    j7: { x: 38, y: 98 },
    j8: { x: 62, y: 98 },
  };

  const heroHtml = `
    <div class="tw2-heroCenter">
      <div class="tw2-heroFrame">
        ${
          selected?.image
            ? `<img class="tw2-heroImg" src="${esc(selected.image)}" alt="">`
            : `<div class="tw2-heroPlaceholder">${esc(selected?.name || "Hero")}</div>`
        }
      </div>
    </div>
  `;

  const clothesKeys = [
    ["weapon", "оружие"],
    ["armor", "броня"],
    ["shoes", "обувь"],
    ["helm", "шлем"],
    ["cloak", "плащ"],
    ["belt", "пояс"],
  ];

  const jewelryKeys = ["j1","j2","j3","j4","j5","j6","j7","j8"];

  const clothesSlots = clothesKeys.map(([k, label]) => {
    const pos = clothesPos[k];
    return slotBoxRing(label, eq.clothes?.[k], k, "clothes", pos);
  }).join("");

  const targetJ = state?.team?.targetJewelrySlot || null;

  const jewelrySlots = jewelryKeys.map((k, i) => {
    const pos = jewelryPos[k];
    return slotBoxRing(`слот ${i + 1}`, eq.jewelry?.[k], k, "jewelry", pos, targetJ);
  }).join("");

  const hiddenClothes = tab === "clothes" ? "" : "is-hidden";
  const hiddenJewelry = tab === "jewelry" ? "" : "is-hidden";

  return `
    <div class="tw2-eqRing">
      ${heroHtml}
      <div class="tw2-ringLayer ${hiddenClothes}" data-ring-layer="clothes">
        ${clothesSlots}
      </div>
      <div class="tw2-ringLayer ${hiddenJewelry}" data-ring-layer="jewelry">
        ${jewelrySlots}
      </div>
    </div>
  `;
}

function slotBoxRing(label, item, key, group, pos, targetKey = null) {
  const style = pos ? `style="left:${pos.x}%; top:${pos.y}%;"` : "";
  const isTarget = group === "jewelry" && targetKey && String(targetKey) === String(key);
  return `
    <div class="tw2-slot tw2-slotRing ${item ? "has-item" : ""} ${isTarget ? "is-target" : ""}" ${style}
         data-eq="${key}" data-eqgroup="${group}">
      <div class="tw2-slotLabel">${label}</div>
      <div class="tw2-slotInner">
        ${item ? `
          <div class="tw2-itemBadge tw2-r-${esc(item.rarity || "common")}"
               data-equip-slot="${key}" data-equip-group="${group}">
            <div class="tw2-itemName" title="${esc(item.name || item.tplId || "")}">${esc(item.name || item.tplId || "")}</div>
          </div>
        ` : `<div class="tw2-empty"></div>`}
      </div>
    </div>
  `;
}

function miniStat(k, v) {
  return `
    <div class="tw2-statRow">
      <div class="tw2-statK">${k}</div>
      <div class="tw2-statV">${fmtStat(v ?? 0)}</div>
    </div>
  `;
}

function fmtStat(v) {
  const n = Number(v);
  return Number.isFinite(n) ? String(Math.ceil(n)) : String(v ?? 0);
}

/* ---------- Inventory rendering helpers ---------- */

function getInventoryList(s, rightTab) {
  const inv = s.team?.serverInv;
  const bag = Array.isArray(inv?.bagItems) ? inv.bagItems : [];
  const map = s.team?.catalogMap || {};

  const resolve = (it)=>{
    const tpl = map[String(it.tplId||"")] || {};
    const slot = it.slot || tpl.slot || "";
    return {
      ...it,
      name: tpl.name || it.name || it.tplId,
      desc: tpl.desc || it.desc || "",
      rarity: tpl.rarity || it.rarity || "common",
      type: tpl.type || it.type || "misc",
      slot,
    };
  };

  const all = bag.map(resolve).filter(it => (it.qty ?? 1) > 0);
  if (s.team.showAll) return all;

  if (rightTab === "clothes") {
    return all.filter(it => isClothesSlot(it.slot));
  }
  if (rightTab === "jewelry") {
    return all.filter(it => String(it.slot) === "jewelry");
  }
  // items
  return all.filter(it => !isClothesSlot(it.slot) && String(it.slot) !== "jewelry");
}

function itemCell(it) {
  const qty = it.qty ?? 1;
  const badge = `tw2-r-${esc(it.rarity || "common")}`;

  return `
    <div class="tw2-cell tw2-itemCell ${badge}"
         data-item-id="${esc(it.id)}"
         data-item-type="${esc(it.type)}"
         data-item-tab="${esc(it.type === "jewelry" ? "jewelry" : (isClothesType(it.type) ? "clothes" : "items"))}"
         title="${esc(it.name || it.tplId || "Предмет")}">
      <div class="tw2-cellName">${esc(it.name)}</div>
      ${qty > 1 ? `<div class="tw2-cellQty">${qty}</div>` : ``}
    </div>
  `;
}

function emptyCell() {
  return `<div class="tw2-cell"></div>`;
}

function isClothesType(t) {
  // legacy helper (deprecated) — залишили, щоб не ламати верстку
  return ["weapon","armor","shoes","helm","head","cloak","belt"].includes(t);
}

function isClothesSlot(slot){
  const s = String(slot||"");
  return ["weapon","armor","shoes","head","cloak","belt","helm"].includes(s);
}

function getEquippedForHero(s, heroId){
  const inv = s.team?.serverInv;
  const byHero = inv?.equippedItemsByHero || {};
  const eq = byHero?.[heroId] || {};
  // верстка очікує clothes/jewelry групи
  return {
    clothes: {
      weapon: eq.weapon || null,
      armor: eq.armor || null,
      shoes: eq.shoes || null,
      helm: eq.head || null,
      cloak: eq.cloak || null,
      belt: eq.belt || null,
    },
    jewelry: {
      j1: eq.j1 || null,
      j2: eq.j2 || null,
      j3: eq.j3 || null,
      j4: eq.j4 || null,
      j5: eq.j5 || null,
      j6: eq.j6 || null,
      j7: eq.j7 || null,
      j8: eq.j8 || null,
    }
  };
}

async function loadTeamData(){
  const playerId = localStorage.getItem("playerId") || "";
  if(!playerId) return;
  try{
    const [invRes, catRes] = await Promise.all([
      fetch(`/api/inventory/get?playerId=${encodeURIComponent(playerId)}`),
      fetch(`/api/items/catalog`),
    ]);
    const invData = await invRes.json().catch(()=>null);
    const catData = await catRes.json().catch(()=>null);
    if(invRes.ok && invData?.ok && invData.inventory){
      setState(s=>{ s.team.serverInv = invData.inventory; });
    }
    if(catRes.ok && catData?.ok && Array.isArray(catData.items)){
      const map = {};
      for(const it of catData.items){ if(it?.tplId) map[it.tplId] = it; }
      setState(s=>{ s.team.catalogMap = map; });
    }
  }catch(e){
    // silent
  }
}

function findItemById(s, id){
  const inv = s.team?.serverInv;
  const bag = Array.isArray(inv?.bagItems) ? inv.bagItems : [];
  const byHero = inv?.equippedItemsByHero || {};
  for(const it of bag){ if(it && String(it.id)===String(id)) return it; }
  for(const heroId of Object.keys(byHero)){
    const eq = byHero[heroId] || {};
    for(const v of Object.values(eq)){
      if(v && String(v.id)===String(id)) return v;
    }
  }
  return null;
}

function resolveItemUi(s, it){
  if(!it) return null;
  const map = s.team?.catalogMap || {};
  const tpl = map[String(it.tplId||"")] || {};
  return {
    ...it,
    name: tpl.name || it.name || it.tplId || "Предмет",
    desc: tpl.desc || it.desc || "",
    rarity: tpl.rarity || it.rarity || "common",
    type: tpl.type || it.type || "misc",
    slot: it.slot || tpl.slot || null,
    effects: tpl.effects || it.effects || null,
  };
}

function getEquippedItem(s, heroId, group, slot){
  const inv = s.team?.serverInv;
  const eq = inv?.equippedItemsByHero?.[heroId] || {};
  const mapSlot = (group==="clothes" && slot==="helm") ? "head" : slot;
  return eq?.[mapSlot] || null;
}

/* ---------- Bind ---------- */

function bind() {
  document.querySelectorAll("[data-select-hero]").forEach(el => {
    el.addEventListener("click", () => {
      const id = el.dataset.selectHero;
      setState(s => { s.team.selectedHeroId = id; });
      rerender();
    });
  });

  document.querySelectorAll("[data-tab]").forEach(el => {
    el.addEventListener("click", () => {
      const t = el.dataset.tab;
      setState(s => { s.team.centerTab = t; });
      rerender();
    });
  });

  document.querySelectorAll("[data-rtab]").forEach(el => {
    el.addEventListener("click", () => {
      const t = el.dataset.rtab;
      setState(s => {
        s.team.rightTab = t;
        s.team.invPage = 1;
      });
      rerender();
    });
  });

  const showAll = document.querySelector("[data-showall]");
  if (showAll) {
    showAll.addEventListener("change", () => {
      setState(s => {
        s.team.showAll = !!showAll.checked;
        s.team.invPage = 1;
      });
      rerender();
    });
  }

  document.querySelectorAll("[data-page]").forEach(btn => {
    btn.addEventListener("click", () => {
      const dir = btn.dataset.page;
      setState(s => {
        const rightTab = s.team.rightTab || "clothes";
        const list = getInventoryList(s, rightTab);
        const totalPages = Math.max(1, Math.ceil(list.length / 24));
        const cur = s.team.invPage || 1;
        if (dir === "prev") s.team.invPage = Math.max(1, cur - 1);
        if (dir === "next") s.team.invPage = Math.min(totalPages, cur + 1);
      });
      rerender();
    });
  });

  const tooltip = document.getElementById("tw2-tooltip");

  const rankEl = document.querySelector("[data-rank-tip]");
  if (rankEl) {
    rankEl.addEventListener("mousemove", (e) => {
      if (!tooltip) return;
      const heroId = state.team.selectedHeroId || state.heroes?.[0]?.id;
      const hero = (state.heroes || []).find(h => String(h.id) === String(heroId)) || state.heroes?.[0];
      if (!hero) return;
      tooltip.style.display = "block";
      tooltip.style.left = (e.clientX + 16) + "px";
      tooltip.style.top = (e.clientY + 16) + "px";
      tooltip.innerHTML = renderRankGrowthTooltip(hero);
    });
    rankEl.addEventListener("mouseleave", () => {
      if (!tooltip) return;
      tooltip.style.display = "none";
    });
  }
  document.querySelectorAll("[data-item-id]").forEach(cell => {
    cell.addEventListener("mousemove", (e) => {
      if (!tooltip) return;
      const id = cell.dataset.itemId;
      const it0 = findItemById(state, id);
      const it = resolveItemUi(state, it0);
      if (!it) return;

      tooltip.style.display = "block";
      tooltip.style.left = (e.clientX + 16) + "px";
      tooltip.style.top = (e.clientY + 16) + "px";
      tooltip.innerHTML = renderTooltip(it);
    });

    cell.addEventListener("mouseleave", () => {
      if (!tooltip) return;
      tooltip.style.display = "none";
    });

    cell.addEventListener("click", () => {
      const id = cell.dataset.itemId;
      const it0 = findItemById(state, id);
      const it = resolveItemUi(state, it0);
      if (!it) return;

      const heroId = state.team.selectedHeroId || "hero_main";

      // ✅ equip на сервері (clothes+jewelry)
      if (isClothesSlot(it.slot) || String(it.slot) === "jewelry") {
        (async()=>{
          try{
            // If user selected a jewelry slot (j1..j8) — target equip there.
            const equipSlot = (String(it.slot) === "jewelry")
              ? (state?.team?.targetJewelrySlot || null)
              : null;

            await equipOnServer(heroId, it.id, equipSlot);
            await loadTeamData();
            await refreshHeroesAndStats();
          }catch(e){
            toast(`Не вдалося вдягнути: ${String(e?.message||e)}`);
          }
          rerender();
        })();
        return;
      }

      // ✅ Use "things" in Team window
      (async()=>{
        try{
          // hero token activation
          if(String(it.type)==="hero"){
            await activateOnServer(it.id);
            await loadTeamData();
            await refreshHeroesAndStats();
            rerender();
            return;
          }

          // EXP consumables (scrolls)
          const expGain = Number(it.effects?.exp || 0);
          if(expGain){
            await useExpOnServer(heroId, it.id, 1);
            await loadTeamData();
            await refreshHeroesAndStats();
            rerender();
            return;
          }

          // fallback
          openModal({
            title: it.name,
            contentHtml: `<div class="badge">${esc(it.desc || "Предмет")}</div>`
          });
        }catch(e){
          toast(String(e?.message||e));
        }
      })();
    });
  });

  document.querySelectorAll("[data-equip-slot]").forEach(el => {
    el.addEventListener("click", () => {
      const slot = el.dataset.equipSlot;
      const group = el.dataset.equipGroup;
      const heroId = state.team.selectedHeroId || "hero_main";
      (async()=>{
        try{
          // тільки серверний слот
          await unequipOnServer(heroId, slot);
          await loadTeamData();
          await refreshHeroesAndStats();
        }catch(e){
          toast(`Не вдалося зняти: ${String(e?.message||e)}`);
        }
        rerender();
      })();
    });

    el.addEventListener("mousemove", (e) => {
      if (!tooltip) return;
      const slot = el.dataset.equipSlot;
      const group = el.dataset.equipGroup;
      const heroId = state.team.selectedHeroId || "hero_main";
      const it = getEquippedItem(state, heroId, group, slot);
      if (!it) return;

      tooltip.style.display = "block";
      tooltip.style.left = (e.clientX + 16) + "px";
      tooltip.style.top = (e.clientY + 16) + "px";
      tooltip.innerHTML = renderTooltip(it);
    });

    el.addEventListener("mouseleave", () => {
      if (!tooltip) return;
      tooltip.style.display = "none";
    });
  });

  // ✅ Select target jewelry slot by clicking an EMPTY jewelry slot
  // (does not unequip; unequip is still by clicking the item badge)
  document.querySelectorAll("[data-eq][data-eqgroup='jewelry']").forEach(el => {
    el.addEventListener("click", () => {
      const slotKey = el.dataset.eq;
      const heroId = state.team.selectedHeroId || "hero_main";
      const it = getEquippedItem(state, heroId, "jewelry", slotKey);
      if (it) return; // occupied: remove happens on badge click
      setState(s => {
        s.team ||= {};
        s.team.targetJewelrySlot = String(slotKey || "");
      });
      rerender();
    });
  });

  const details = document.querySelector("[data-open-stats='1']");
  if (details) {
    details.addEventListener("click", () => {
      openStatsWindow(state.team.selectedHeroId || "hero_main");
    });
  }

  // ✅ NEW: Переодеть (transfer between heroes)
  document.querySelectorAll("[data-left-action='transfer']").forEach(btn => {
    btn.addEventListener("click", () => {
      const heroId = state.team.selectedHeroId || state.heroes?.[0]?.id;
      if (!heroId) return;
      openTeamTransferWindow(heroId);
    });
  });

  // ✅ NEW: Управление (manage hero)
  document.querySelectorAll("[data-left-action='manage']").forEach(btn => {
    btn.addEventListener("click", () => {
      const heroId = state.team.selectedHeroId || state.heroes?.[0]?.id;
      if (!heroId) return;
      openTeamManageWindow(heroId);
    });
  });

  document.querySelectorAll("[data-center-action='remove']").forEach(btn => {
    btn.addEventListener("click", () => {
      openModal({
        title: "Убрать",
        contentHtml: `<div class="badge">Клікни по предмету в слоті, щоб зняти.</div>`
      });
    });
  });

  document.querySelectorAll("[data-center-action='enhance']").forEach(btn => {
    btn.addEventListener("click", () => {
      const heroId = state.team.selectedHeroId || state.heroes?.[0]?.id;
      if (!heroId) return;
      openEnhanceWindow({ heroId });
    });
  });

  document.querySelectorAll("[data-center-action='gems']").forEach(btn => {
    btn.addEventListener("click", () => {
      const heroId = state.team.selectedHeroId || state.heroes?.[0]?.id;
      if (!heroId) return;
      openGemsWindow({ heroId });
    });
  });
}

/* ---------- Equip logic ---------- */

async function equipOnServer(heroId, itemId, equipSlot){
  const playerId = state?.player?.id || localStorage.getItem("playerId") || "";
  if(!playerId || !heroId || !itemId) return;
  const res = await fetch(`/api/inventory/equip`, {
    method: "POST",
    headers: {"content-type":"application/json"},
    body: JSON.stringify({ playerId, heroId, itemId, equipSlot: equipSlot || null })
  });
  const data = await res.json().catch(()=>null);
  if(!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
}

async function unequipOnServer(heroId, slot){
  const playerId = state?.player?.id || localStorage.getItem("playerId") || "";
  if(!playerId || !heroId || !slot) return;
  const realSlot = slot === "helm" ? "head" : slot;
  const res = await fetch(`/api/inventory/unequip`, {
    method: "POST",
    headers: {"content-type":"application/json"},
    body: JSON.stringify({ playerId, heroId, slot: realSlot })
  });
  const data = await res.json().catch(()=>null);
  if(!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
}

async function activateOnServer(itemId){
  const playerId = state?.player?.id || localStorage.getItem("playerId") || "";
  if(!playerId || !itemId) return;
  const res = await fetch(`/api/inventory/activate`, {
    method: "POST",
    headers: {"content-type":"application/json"},
    body: JSON.stringify({ playerId, itemId })
  });
  const data = await res.json().catch(()=>null);
  if(!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
}

async function useExpOnServer(heroId, itemId, qty){
  const playerId = state?.player?.id || localStorage.getItem("playerId") || "";
  if(!playerId || !heroId || !itemId) return;
  const res = await fetch(`/api/inventory/useExp`, {
    method: "POST",
    headers: {"content-type":"application/json"},
    body: JSON.stringify({ playerId, heroId, itemId, qty: Number(qty||1) })
  });
  const data = await res.json().catch(()=>null);
  if(!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
}

async function refreshHeroesAndStats(){
  const playerId = localStorage.getItem("playerId") || "";
  if(!playerId) return;
  const res = await fetch(`/api/heroes/list?playerId=${encodeURIComponent(playerId)}`);
  const data = await res.json().catch(()=>null);
  if(!res.ok || !data?.ok || !Array.isArray(data.heroes)) return;
  const mapRole = (r)=>{
    const x = String(r||"").toLowerCase();
    if(x==="support") return "helper";
    if(x==="avantgard" || x==="vanguard") return "tank";
    if(x==="tank") return "tank";
    if(x==="helper") return "helper";
    if(x==="assault") return "assault";
    return x || "assault";
  };
  setState(s=>{
    s.heroes = data.heroes.map(h=>({
      id: h.id,
      name: h.name,
      role: mapRole(h.role),
      isMain: Boolean(h.isMain),
      lvl: Number(h.level||1),
      rank: String(h.rarity || "C"),
      classType: h.classType || "taijutsu",
      __raw: h
    }));
    s.stats ||= {};
    for(const h of data.heroes){
      if(h?.stats?.primary){
        const p = h.stats.primary;
        const sec = h.stats.secondary || {};
        const stratDef = Number(p.stratDef ?? p.magicDef ?? p.magDef ?? 0) || 0;
        const stratAtk = Number(p.stratAtk ?? p.magicAtk ?? p.magAtk ?? 0) || 0;
        s.stats[h.id] = {
          power: Number(h.power || p.power || 0) || 0,
          spirit: Number(h.stats.main?.spirit||0) || 0,
          chakra: Number(h.stats.main?.chakra||0) || 0,
          strength: Number(h.stats.main?.might||0) || 0,
          agility: Number(h.stats.main?.agility||0) || 0,
          hp: Number(p.hp||0) || 0,
          physAtk: Number(p.physAtk||0) || 0,
          physDef: Number(p.physDef||0) || 0,
          // legacy alias
          magicDef: stratDef,
          speed: Number(p.speed||0) || 0,

          initialFury: Number(p.initialFury ?? 50) || 50,
          stratDef,
          stratAtk,

          damageRate: Number(sec.damageRate||0) || 0,
          accuracyRate: Number(sec.accuracyRate||0) || 0,
          critRate: Number(sec.critRate||0) || 0,
          successRate: Number(sec.successRate||0) || 0,
          punchRate: Number(sec.punchRate||0) || 0,
          sAttackRate: Number(sec.sAttackRate||0) || 0,
          avoidDamageRate: Number(sec.avoidDamageRate||0) || 0,
          dodgeRate: Number(sec.dodgeRate||0) || 0,
          contraRate: Number(sec.contraRate||0) || 0,
          blockRate: Number(sec.blockRate||0) || 0,
          helpRate: Number(sec.helpRate||0) || 0,
          healRate: Number(sec.healRate||0) || 0,
        };
      }
    }
  });
}

/* ---------- Tooltip ---------- */

function renderRankGrowthTooltip(hero) {
  const h = hero || {};
  const raw = hero?.__raw || hero || {};
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

  const gMain = (h.growth && h.growth.main) ? h.growth.main : ((raw.growth && raw.growth.main) ? raw.growth.main : null);
  const gFlat = (h.growth && typeof h.growth === "object" && !h.growth.main) ? h.growth : ((raw.growth && typeof raw.growth === "object" && !raw.growth.main) ? raw.growth : null);
  const gPer = h.growthPerLevel || raw.growthPerLevel || null;
  const growth = {
    spirit: Number(gMain?.spirit ?? gPer?.spirit ?? gFlat?.spirit ?? 0),
    chakra: Number(gMain?.chakra ?? gPer?.chakra ?? gFlat?.chakra ?? 0),
    might: Number(gMain?.might ?? gPer?.might ?? gFlat?.might ?? 0),
    agility: Number(gMain?.agility ?? gPer?.agility ?? gFlat?.agility ?? 0),
  };

  const row = (k, v) => `<div class="tw2-rankTipRow"><span>${k}</span><b>+${Number(v || 0).toFixed(1).replace(/\.0$/, "")}</b></div>`;

  return `
    <div class="tw2-rankTip">
      <div class="tw2-rankTipTitle">Ранг ${esc(hero?.rank || h.rarity || "?")}</div>
      <div class="tw2-rankTipSub">Прирост характеристик за рівень</div>
      <div class="tw2-rankTipGrid">
        ${row("Сила духа", growth.spirit)}
        ${row("Чакра", growth.chakra)}
        ${row("Сила", growth.might)}
        ${row("Ловкость", growth.agility)}
              </div>
    </div>
  `;
}

function renderTooltip(it) {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

  // Catalog may be a map (tplId -> tpl) OR an array [{tplId,...}]
  const rawCat = _tooltipCtx?.cat || {};
  const cat = Array.isArray(rawCat)
    ? rawCat.reduce((acc, x) => (x && x.tplId ? (acc[String(x.tplId)] = x, acc) : acc), {})
    : rawCat;

  const tpl = cat[String(it.tplId || "")] || it || {};

  // Title shows "Имя +заточка"
  const enh = Number(it.enhanceLevel ?? it.enh ?? tpl.enhanceLevel ?? 0) || 0;
  const title = `${tpl.name || it.name || "Предмет"}${enh > 0 ? ` +${enh}` : ""}`;

  // Required level / sell
  const req = Number(tpl.reqLevel ?? tpl.requiredLevel ?? it.reqLevel ?? it.requiredLevel ?? 1) || 1;
  const sell = Number(tpl.sell ?? it.sell ?? 0) || 0;

  // Determine main stat by slot (weapon->stratAtk, armor/head/cloak/belt/shoes->stratDef by default)
  const slot = String(it.slot || tpl.slot || "");
  const slotMainKey = (() => {
    if (slot === "weapon") return "stratAtk";
    if (slot === "armor" || slot === "head" || slot === "cloak" || slot === "belt" || slot === "shoes") return "stratDef";
    return null;
  })();

  const LABEL = {
    stratAtk: "Стратег. атака",
    stratDef: "Стратег. защита",
    physAtk: "Физ. атака",
    physDef: "Физ. защита",
    hp: "Жизнь",
    speed: "Скорость",
  };
  const statLabel = (k) => LABEL[k] || k;

  // Read current main stat value from item stats (already includes some bonuses)
  const stats = it.stats || tpl.stats || {};
  const mainNow = slotMainKey ? Number(stats[slotMainKey] ?? 0) : 0;

  // "Усиление/заточка" bonus is +0.3% per level (already used elsewhere in project)
  const enhRate = 0.003;
  const baseNoEnh = (slotMainKey && mainNow > 0 && enh > 0)
    ? Math.round(mainNow / (1 + enh * enhRate))
    : mainNow;

  const enhAdd = (slotMainKey && enh > 0)
    ? Math.max(0, Math.round(baseNoEnh * enh * enhRate))
    : 0;

  const baseLine = slotMainKey
    ? `<div class="tw2-tipLine"><b>${esc(statLabel(slotMainKey))}</b> ${baseNoEnh}${enh > 0 ? ` <span style="color:rgba(180,255,200,.9)">( +${enhAdd} )</span>` : ""}</div>`
    : "";

  // "Усилить вещь" (separate upgrade) info
  const upLvl = Number(it.upgradeLevel ?? it.upLvl ?? 0) || 0; // +1..+20
  const upRate = 0.03; // 3% per level
  const upAdd = (slotMainKey && upLvl > 0)
    ? Math.max(0, Math.round(baseNoEnh * upLvl * upRate))
    : 0;

  const enhLine = `<div class="tw2-tipLine">Усиление: <b>+${enh}</b>${enh > 0 ? ` <span style="color:rgba(180,255,200,.9)">( +${enhAdd} )</span>` : ""}</div>`;
  const upLine = `<div class="tw2-tipLine">Усилить вещь: <b>+${upLvl}</b>${upLvl > 0 ? ` <span style="color:rgba(180,255,200,.9)">( +${upAdd} )</span>` : ""}</div>`;

  // Gems: show 8 slots (6 open + 2 locked). Use inserted list from item.gems (array) or gemSlots (object)
  const gemSlots = (() => {
    if (Array.isArray(it.gems)) return it.gems;
    if (Array.isArray(it.gemSlots)) return it.gemSlots;
    if (it.gems && typeof it.gems === "object") return Object.values(it.gems);
    return [];
  })();

  const toGemLine = (g) => {
    if (!g) return null;
    const tpl = cat[String(g.tplId || "")] || g || {};
    const target = String(tpl.gemTarget || g.gemTarget || "");
    const lvl = tpl.gemLevel ?? g.gemLevel;
    const pct = tpl.gemPct ?? g.gemPct;
    if (!target) return null;
    return `${esc(tpl.name ? tpl.name.replace(/^Самоцвет:\s*/i,"") : statLabel(target))} ${lvl ?? ""} <span style="color:rgba(180,255,200,.9)">${pct != null ? `${Number(pct)}%` : ""}</span>`;
  };

  const filled = gemSlots.map(toGemLine).filter(Boolean);
  const lockedCount = Number(it.gemLocked ?? it.gemLockedSlots ?? 0) || 0; // if exists
  const totalSlots = 8;
  const openSlots = Math.max(0, totalSlots - lockedCount);
  const emptyCount = Math.max(0, openSlots - filled.length);

  const gemList = [
    ...filled,
    ...Array.from({ length: emptyCount }, () => `<span style="color:rgba(255,255,255,.55)">не вставлено</span>`),
    ...Array.from({ length: lockedCount }, () => `<span style="color:rgba(255,255,255,.35)">закрыто</span>`),
  ];

  const gemBlock = `<div class="tw2-tipLine" style="margin-top:8px;">
    Самоцветы: <b>${Math.min(filled.length, openSlots)}/${totalSlots}</b><br>
    ${gemList.slice(0, totalSlots).join("<br>")}
  </div>`;

  // Set detection: use prefix before ":" (e.g., "Акацуки: Нагрудник") for 6-piece sets
  const detectSet = (name) => {
    const s = String(name || "").trim();
    const idx = s.indexOf(":");
    if (idx <= 0) return "";
    return s.slice(0, idx).trim();
  };
  const setName = detectSet(tpl.name || it.name);
  const setKey = setName.toLowerCase();

  const SET_BONUS_TEXT = {
    "акацуки": {
      2: "Урон +8%",
      4: "Сопротивление урону +6%",
      6: "Крит. урон +8% (и доп. бонус)",
    },
    "бездна": {
      2: "Бонус (2 части)",
      4: "Бонус (4 части)",
      6: "Бонус (6 частей)",
    }
  };

  let setBlock = "";
  if (setName) {
    const eq = _tooltipCtx?.eq || {};
    const pieces = Object.values(eq).filter(Boolean);
    const cnt = pieces.reduce((acc, x) => acc + (detectSet(x.name) === setName ? 1 : 0), 0);

    const tiers = [2, 4, 6].map((t) => {
      const active = cnt >= t;
      const c = active ? "rgba(235,245,255,.92)" : "rgba(255,255,255,.35)";
      const txt = (SET_BONUS_TEXT[setKey] && SET_BONUS_TEXT[setKey][t]) ? SET_BONUS_TEXT[setKey][t] : "—";
      return `<div style="margin-top:4px;color:${c}">${t} части: ${esc(txt)}</div>`;
    }).join("");

    setBlock = `<div class="tw2-tipLine" style="margin-top:10px;">Бонус сета <b>${esc(setName)}</b> (${cnt}/6):${tiers}</div>`;
  }

  const desc = tpl.desc ? `<div class="tw2-tipDesc">${esc(tpl.desc)}</div>` : (it.desc ? `<div class="tw2-tipDesc">${esc(it.desc)}</div>` : "");

  return `
    <div class="tw2-tipTitle tw2-r-${esc(it.rarity || tpl.rarity || "common")}">${esc(title)}</div>
    <div class="tw2-tipLine">Требуемый уровень: <b>${req}</b></div>
    ${baseLine}
    ${enhLine}
    ${upLine}
    ${gemBlock}
    ${setBlock}
    ${desc}
    <div class="tw2-tipLine tw2-tipSell">Цена продажи: <b>${sell}</b></div>
  `;
}

function fmt(n){
  const x = Number(n||0);
  try{ return x.toLocaleString("ru-RU"); }catch{ return String(x); }
}

function labelStat(k) {
  const map = {
    power: "Мощь",
    spirit: "Сила духа",
    chakra: "Чакра",
    strength: "Сила",
    agility: "Ловкость",
    hp: "Жизнь",
    physDef: "Физ. защита",
    stratDef: "Стратег. защита",
    speed: "Скорость"
  };
  return map[k] || k;
}

function esc(str) {
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function toast(msg){
  try{
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = String(msg||"");
    document.body.appendChild(el);
    setTimeout(()=>{ el.classList.add("show"); }, 10);
    setTimeout(()=>{ el.classList.remove("show"); el.remove(); }, 2400);
  }catch{}
}
