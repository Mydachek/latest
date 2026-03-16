import { state, setState } from "../../state.js";
import { openModal } from "./windowsRoot.js";

// NW-style Gems window
// Tabs (как в Ninja World):
// 1) Вставка — вставка/снятие (у нас уже идеально)
// 2) Улучшение — 2 одинаковых самоцвита -> 1 следующего уровня (включая Ярость)
// 3) Пробуждение — самоцвет 12 уровня -> Звёздный ★0 за 2000 (купон+золото)
// 4) Звёздные — прокачка звёздных камней через EXP (с шансом / 100% за золото)

const GEM_TABLE_MAIN = [1.5, 3, 4.5, 6, 7.5, 10.5, 13.5, 18, 24, 30, 37.5, 45];
const GEM_TABLE_CRIT = [1, 2, 3, 4, 5, 7, 9, 12, 16, 20, 25, 30];
const GEM_TABLE_FURY = [null, null, null, 8, 10, 12, 14, 16, 18, 20, 22, 24];

// Star gems (0..10 stars)
const GEM_TABLE_STAR_MAIN = [46, 47, 48, 50, 52, 55, 58, 62, 66, 70, 75];
const GEM_TABLE_STAR_MIGHT = [32, 34, 36, 40, 44, 50, 56, 64, 72, 80, 90];

// Royal EXP requirements (per star up 0->1 .. 9->10)
const STAR_EXP_REQ = {
  chakra: [2250, 3375, 5070, 7605, 11415, 17130, 25695, 38550, 57825, 86745],
  agility: [3000, 4500, 6760, 10140, 15220, 22840, 34260, 51400, 77100, 115660],
  spirit: [1500, 2250, 3380, 5070, 7610, 11420, 17130, 25700, 38550, 57830],
  might: [1500, 2250, 3380, 5070, 7610, 11420, 17130, 25700, 38550, 57825],
};

const FEED_EXP_BY_LEVEL = [12, 24, 48, 96, 192, 384, 768, 1536, 3072, 6144, 12288, 24576];
const FEED_SAFE_GOLD_BY_LEVEL = [5, 10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120, 10240];

const GEM_META = {
  spirit: { label: "Сила Духа", table: GEM_TABLE_MAIN, kind: "main" },
  chakra: { label: "Чакра", table: GEM_TABLE_MAIN, kind: "main" },
  agility: { label: "Ловкость", table: GEM_TABLE_MAIN, kind: "main" },
  might: { label: "Сила", table: GEM_TABLE_CRIT, kind: "main" },

  accuracyRate: { label: "Точность", table: GEM_TABLE_MAIN, kind: "sec" },
  dodgeRate: { label: "Уворот", table: GEM_TABLE_CRIT, kind: "sec" },
  critRate: { label: "Крит", table: GEM_TABLE_CRIT, kind: "sec" },
  blockRate: { label: "Блок", table: GEM_TABLE_CRIT, kind: "sec" },
  contraRate: { label: "Отражение", table: GEM_TABLE_MAIN, kind: "sec" },
  sAttackRate: { label: "S-атака", table: GEM_TABLE_MAIN, kind: "sec" },

  initialFury: { label: "Ярость", table: GEM_TABLE_FURY, kind: "fury" },

  // Star gems
  star_spirit: { label: "Звёздный: Сила Духа", table: GEM_TABLE_STAR_MAIN, kind: "star" },
  star_chakra: { label: "Звёздный: Чакра", table: GEM_TABLE_STAR_MAIN, kind: "star" },
  star_agility: { label: "Звёздный: Ловкость", table: GEM_TABLE_STAR_MAIN, kind: "star" },
  star_might: { label: "Звёздный: Сила", table: GEM_TABLE_STAR_MIGHT, kind: "star" },
};

const SLOT_LABELS = {
  weapon: "Оружие",
  armor: "Броня",
  head: "Шлем",
  cloak: "Плащ",
  belt: "Пояс",
  shoes: "Обувь",
};

const TABS = [
  { id: "insert", label: "Вставка" },
  { id: "synth", label: "Улучшение" },
  { id: "awaken", label: "Пробуждение" },
  { id: "stars", label: "Звёздные" },
];

export function openGemsWindow({ heroId } = {}) {
  const pid = state?.player?.id || localStorage.getItem("playerId") || "";
  const initialHeroId = heroId || state.team.selectedHeroId || state.heroes?.[0]?.id;

  const modal = openModal({
    title: "Самоцветы",
    contentHtml: `<div class="badge">Загрузка…</div>`,
  });

  const ui = {
    tab: "insert",
    heroId: initialHeroId,
    equipSlot: "weapon",
    selectedGemId: null,
    filter: "all",
    page: 1,
    perPage: 12,

    // synth
    synthFromTplId: null,

    // awaken
    awakenFromTplId: null,

    // stars (royal)
    starItemId: null,
    feedTplId: null,
    feedQty: 1,
    feedSafe: false,
  };

  (async () => {
    await ensureTeamData(pid);
    if (!ui.heroId) ui.heroId = state.heroes?.[0]?.id || null;
    const eq = state.team?.serverInv?.equippedItemsByHero?.[ui.heroId] || {};
    const first = ["weapon", "armor", "head", "cloak", "belt", "shoes"].find((s) => eq?.[s]);
    if (first) ui.equipSlot = first;
    await Promise.resolve();
    rerender(modal, ui);
  })();

  const root = modal?.overlay || document;

  root.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-gems-action]");
    if (!btn) return;
    const action = btn.getAttribute("data-gems-action");

    if (action === "tab") {
      ui.tab = btn.getAttribute("data-tab") || "insert";
      ui.selectedGemId = null;
      ui.page = 1;
      rerender(modal, ui);
      return;
    }

    if (action === "pickHero") {
      ui.heroId = btn.getAttribute("data-hero-id");
      ui.selectedGemId = null;
      ui.page = 1;
      const eq = state.team?.serverInv?.equippedItemsByHero?.[ui.heroId] || {};
      ui.equipSlot = ["weapon", "armor", "head", "cloak", "belt", "shoes"].find((s) => eq?.[s]) || "weapon";
      rerender(modal, ui);
      return;
    }

    if (action === "pickEquip") {
      ui.equipSlot = btn.getAttribute("data-equip-slot");
      ui.selectedGemId = null;
      rerender(modal, ui);
      return;
    }

    if (action === "pickGem") {
      ui.selectedGemId = btn.getAttribute("data-gem-id");
      rerender(modal, ui);
      return;
    }

    if (action === "page") {
      const dir = btn.getAttribute("data-dir");
      ui.page = Math.max(1, ui.page + (dir === "prev" ? -1 : 1));
      rerender(modal, ui);
      return;
    }

    // INSERT tab actions
    if (action === "slotClick") {
      const slotIdx = Number(btn.getAttribute("data-slot-idx"));
      const hasGem = btn.getAttribute("data-has-gem") === "1";
      const open = btn.getAttribute("data-open") === "1";
      if (!open) return;

      if (hasGem) {
        await apiGemsRemove(pid, ui.heroId, ui.equipSlot, slotIdx);
        await refreshAfterGemChange(pid);
        ui.selectedGemId = null;
        rerender(modal, ui);
        return;
      }

      if (!ui.selectedGemId) return;
      await apiGemsInsert(pid, ui.heroId, ui.equipSlot, ui.selectedGemId);
      await refreshAfterGemChange(pid);
      ui.selectedGemId = null;
      rerender(modal, ui);
      return;
    }

    // SYNTH tab actions
    if (action === "synth") {
      const fromTplId = String(btn.getAttribute("data-from") || "");
      const times = Number(btn.getAttribute("data-times") || 1);
      if (!fromTplId) return;
      await apiGemsSynthesize(pid, fromTplId, times);
      await refreshAfterGemChange(pid);
      rerender(modal, ui);
      return;
    }

    // AWAKEN tab actions
    if (action === "awaken") {
      const fromTplId = String(btn.getAttribute("data-from") || "");
      if (!fromTplId) return;
      await apiGemsAwaken(pid, fromTplId);
      await refreshAfterGemChange(pid);
      rerender(modal, ui);
      return;
    }

    // STARS (ROYAL) tab actions
    if (action === "pickStarItem") {
      ui.starItemId = String(btn.getAttribute("data-id") || "");
      rerender(modal, ui);
      return;
    }
    if (action === "feed") {
      const starItemId = String(btn.getAttribute("data-star-id") || "");
      const feedTplId = String(btn.getAttribute("data-feed") || "");
      const qty = Number(btn.getAttribute("data-qty") || 1);
      const safe = btn.getAttribute("data-safe") === "1";
      if (!starItemId || !feedTplId) return;
      await apiGemsStarFeed(pid, starItemId, feedTplId, qty, safe);
      await refreshAfterGemChange(pid);
      rerender(modal, ui);
      return;
    }
  });

  root.addEventListener("change", (e) => {
    const sel = e.target.closest("select[data-gems-filter]");
    if (sel) {
      ui.filter = sel.value || "all";
      ui.page = 1;
      rerender(modal, ui);
      return;
    }

    const sel2 = e.target.closest("select[data-synth-from]");
    if (sel2) {
      ui.synthFromTplId = sel2.value || null;
      rerender(modal, ui);
      return;
    }

    const sel3 = e.target.closest("select[data-awaken-from]");
    if (sel3) {
      ui.awakenFromTplId = sel3.value || null;
      rerender(modal, ui);
      return;
    }

    const sel4 = e.target.closest("select[data-feed-from]");
    if (sel4) {
      ui.feedTplId = sel4.value || null;
      rerender(modal, ui);
      return;
    }

    const inpQty = e.target.closest("input[data-feed-qty]");
    if (inpQty) {
      ui.feedQty = Math.max(1, Math.min(9999, Number(inpQty.value || 1)));
      rerender(modal, ui);
      return;
    }

    const chk = e.target.closest("input[data-feed-safe]");
    if (chk) {
      ui.feedSafe = Boolean(chk.checked);
      rerender(modal, ui);
      return;
    }
  });

  return modal;
}

async function ensureTeamData(playerId) {
  if (!playerId) return;
  try {
    const [invRes, heroesRes] = await Promise.all([
      fetch(`/api/inventory/get?playerId=${encodeURIComponent(playerId)}`),
      fetch(`/api/heroes/list?playerId=${encodeURIComponent(playerId)}`),
    ]);
    const inv = await invRes.json().catch(() => null);
    const heroes = await heroesRes.json().catch(() => null);

    if (invRes.ok && inv?.ok && inv.inventory) {
      setState((s) => {
        s.team.serverInv = inv.inventory;
      });
    }

    if (heroesRes.ok && heroes?.ok && Array.isArray(heroes.heroes)) {
      const mapRole = (r) => {
        const x = String(r || "").toLowerCase();
        if (x === "support") return "helper";
        if (x === "avantgard" || x === "vanguard") return "tank";
        if (x === "tank") return "tank";
        if (x === "helper") return "helper";
        if (x === "assault") return "assault";
        return x || "assault";
      };
      setState((s) => {
        s.heroes = heroes.heroes.map((h) => ({
          id: h.id,
          name: h.name,
          role: mapRole(h.role),
          isMain: Boolean(h.isMain),
          lvl: Number(h.level || 1),
          rank: String(h.rarity || "C"),
          classType: h.classType || "taijutsu",
          __raw: h,
        }));
      });
    }
  } catch {
    // ignore
  }
}

async function refreshAfterGemChange(playerId) {
  await ensureTeamData(playerId);
}

function rerender(modal, ui) {
  const overlay = modal?.overlay || null;
  const findBody = () => {
    if (overlay) return overlay.querySelector(".modalBody");
    return document.querySelector("#windows-root .modalOverlay:last-child .modalBody") || document.querySelector("#windows-root .modalBody");
  };

  const body = findBody();
  if (!body) {
    setTimeout(() => {
      const b2 = findBody();
      if (b2) b2.innerHTML = render(ui);
    }, 0);
    return;
  }
  body.innerHTML = render(ui);
}

function render(ui) {
  const heroes = state.heroes || [];
  const inv = state.team?.serverInv || null;
  const eq = inv?.equippedItemsByHero?.[ui.heroId] || {};
  const bag = Array.isArray(inv?.bagItems) ? inv.bagItems : [];
  const equipSlots = ["weapon", "armor", "head", "cloak", "belt", "shoes"];

  const tabs = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 14px 0;">
      ${TABS.map((t) => {
        const active = ui.tab === t.id;
        return `<button class="tw2-btn2" data-gems-action="tab" data-tab="${t.id}" style="padding:8px 12px;${active ? "box-shadow:0 0 0 2px rgba(255,255,255,.25) inset;" : ""}">${t.label}</button>`;
      }).join("")}
    </div>
  `;

  const heroList = heroes
    .map((h) => {
      const active = String(h.id) === String(ui.heroId);
      return `
        <button class="tw2-btn2" data-gems-action="pickHero" data-hero-id="${esc(h.id)}" style="width:100%; text-align:left; margin-bottom:6px; ${
        active ? "box-shadow:0 0 0 2px rgba(255,255,255,.25) inset;" : ""
      }">
          <div style="display:flex;justify-content:space-between;gap:10px;">
            <span>${esc(h.name || "-")}</span>
            <span style="opacity:.8;">Lv.${Number(h.lvl || 1)}</span>
          </div>
        </button>
      `;
    })
    .join("");

  const equipCards = equipSlots
    .map((s) => {
      const it = eq?.[s];
      const active = ui.equipSlot === s;
      return `
        <button class="tw2-card" data-gems-action="pickEquip" data-equip-slot="${s}" style="display:flex;align-items:center;gap:10px; padding:10px; width:100%; text-align:left; ${
        active ? "outline:2px solid rgba(255,255,255,.35);" : ""
      }">
          <div style="width:44px;height:44px;border-radius:10px;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;">${
            it ? "🗡️" : "—"
          }</div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;">${esc(SLOT_LABELS[s] || s)}</div>
            <div style="opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${
              it ? esc(it.name || it.tplId || "Предмет") : "Пусто"
            }</div>
          </div>
        </button>
      `;
    })
    .join("");

  // right panel depends on tab
  let rightPanel = "";
  if (ui.tab === "insert") rightPanel = renderInsertTab(ui, inv, eq, bag);
  else if (ui.tab === "synth") rightPanel = renderSynthTab(ui, inv, bag);
  else if (ui.tab === "awaken") rightPanel = renderAwakenTab(ui, inv, bag);
  else if (ui.tab === "stars") rightPanel = renderStarsTab(ui, inv, bag);

  return `
    ${tabs}
    <div style="display:grid;grid-template-columns: 230px 380px 1fr; gap:16px; align-items:start;">
      <div>
        <div style="font-weight:800; margin-bottom:10px;">Герои</div>
        ${heroList || `<div class="badge">Нет героев</div>`}
      </div>

      <div>
        <div style="font-weight:800; margin-bottom:10px;">Экипировка</div>
        <div style="display:flex;flex-direction:column; gap:10px;">${equipCards}</div>
        <div style="margin-top:10px; opacity:.7; font-size:12px;">2 последних слота в вещи — закрыты. Откроем через “Усиление”.</div>
      </div>

      <div>
        ${rightPanel}
      </div>
    </div>
  `;
}

function renderInsertTab(ui, inv, eq, bag) {
  const item = eq?.[ui.equipSlot] || null;
  const slots = ensureGemSlots(item);

  const slotsHtml = slots
    .map((gs, idx) => {
      const open = Boolean(gs.open);
      const hasGem = Boolean(gs.gem);
      const label = hasGem ? gemShortLabel(gs.gem, inv) : open ? "+" : "🔒";
      const sub = hasGem ? gemSubLabel(gs.gem, inv) : "";
      return `
        <button class="tw2-card" data-gems-action="slotClick" data-slot-idx="${idx}" data-has-gem="${hasGem ? 1 : 0}" data-open="${open ? 1 : 0}" style="width:84px;height:84px;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;${
          open ? "" : "opacity:.45;"
        }${hasGem ? "background:rgba(255,255,255,.08);" : ""}">
          <div style="font-size:22px;">💎</div>
          <div style="font-size:12px; font-weight:800; text-align:center; line-height:1.1;">${esc(label)}</div>
          ${sub ? `<div style="font-size:12px; opacity:.85;">${esc(sub)}</div>` : ``}
        </button>
      `;
    })
    .join("");

  const gems = bag.filter((x) => isGemItem(x));
  const filtered = filterGems(gems, ui.filter);
  const totalPages = Math.max(1, Math.ceil(filtered.length / ui.perPage));
  ui.page = Math.min(ui.page, totalPages);
  const pageItems = filtered.slice((ui.page - 1) * ui.perPage, ui.page * ui.perPage);

  const miniInv = pageItems
    .map((g) => {
      const active = String(ui.selectedGemId) === String(g.id);
      return `
        <button class="tw2-card" data-gems-action="pickGem" data-gem-id="${esc(g.id)}" style="width:84px;height:84px;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;${
          active ? "outline:2px solid rgba(255,255,255,.35);" : ""
        }">
          <div style="font-size:22px;">💎</div>
          <div style="font-size:12px; font-weight:800; text-align:center; line-height:1.1;">${esc(gemLabelFromItem(g))}</div>
          <div style="font-size:12px; opacity:.85;">${esc(gemPctFromItem(g))}</div>
          ${Number(g.qty || 1) > 1 ? `<div class="badge" style="margin-top:2px;">${Number(g.qty)}</div>` : ``}
        </button>
      `;
    })
    .join("");

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
      <div style="font-weight:800;">Слоты самоцветов</div>
      <div class="badge" style="opacity:.85;">Оружие: ${esc(eq?.weapon?.name || "—")}</div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(4,84px);gap:10px;margin-top:10px;">${slotsHtml}</div>

    <div style="font-weight:800;margin-top:18px;">Мини-инвентарь (Сумка)</div>

    <div style="display:flex;align-items:center;justify-content:flex-end;gap:10px;margin:8px 0;">
      <select data-gems-filter style="padding:8px 10px;border-radius:10px;background:rgba(0,0,0,.35);color:#fff;border:1px solid rgba(255,255,255,.12);">
        <option value="all" ${ui.filter === "all" ? "selected" : ""}>Все</option>
        <option value="main" ${ui.filter === "main" ? "selected" : ""}>Основные</option>
        <option value="sec" ${ui.filter === "sec" ? "selected" : ""}>Второстепенные</option>
        <option value="fury" ${ui.filter === "fury" ? "selected" : ""}>Ярость</option>
        <option value="star" ${ui.filter === "star" ? "selected" : ""}>Звёздные</option>
      </select>

      <button class="tw2-btn2" data-gems-action="page" data-dir="prev">◀</button>
      <div class="badge">${ui.page}/${totalPages}</div>
      <button class="tw2-btn2" data-gems-action="page" data-dir="next">▶</button>
    </div>

    <div style="display:grid;grid-template-columns:repeat(6,84px);gap:10px;">${miniInv || `<div class="badge">Нет самоцветов</div>`}</div>

    <div style="margin-top:10px; opacity:.7; font-size:12px;">Ограничение: в 1 вещи только 1 тип самоцвета. Если вставляешь тот же тип — заменяем только если уровень выше.</div>
  `;
}

function renderSynthTab(ui, inv, bag) {
  const gems = (bag || []).filter((x) => isGemItem(x) && !isStarGemItem(x));

  // unique by tplId
  const map = new Map();
  for (const g of gems) {
    const tplId = String(g.tplId || "");
    map.set(tplId, (map.get(tplId) || 0) + Number(g.qty || 1));
  }

  const options = Array.from(map.entries())
    .map(([tplId, cnt]) => ({ tplId, cnt, label: `${gemLabelFromTplId(tplId)} (${cnt})` }))
    .sort((a, b) => a.label.localeCompare(b.label));

  if (!ui.synthFromTplId && options[0]) ui.synthFromTplId = options[0].tplId;

  const selected = options.find((o) => o.tplId === ui.synthFromTplId) || null;
  const cnt = selected ? selected.cnt : 0;
  const can = Math.floor(cnt / 2);

  const explain = `2 одинаковых самоцвета → 1 следующего уровня. Работает и для Ярости.`;

  return `
    <div style="font-weight:800;margin-bottom:10px;">Улучшение самоцветов</div>
    <div class="badge" style="opacity:.85;margin-bottom:10px;">${esc(explain)}</div>

    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
      <select data-synth-from style="min-width:360px;padding:10px 12px;border-radius:12px;background:rgba(0,0,0,.35);color:#fff;border:1px solid rgba(255,255,255,.12);">
        ${options
          .map((o) => `<option value="${esc(o.tplId)}" ${o.tplId === ui.synthFromTplId ? "selected" : ""}>${esc(o.label)}</option>`)
          .join("")}
      </select>

      <div class="badge">Можно: ${can}</div>

      <button class="tw2-btn2" data-gems-action="synth" data-from="${esc(ui.synthFromTplId || "")}" data-times="1" ${can <= 0 ? "disabled" : ""}>Синтез ×1</button>
      <button class="tw2-btn2" data-gems-action="synth" data-from="${esc(ui.synthFromTplId || "")}" data-times="10" ${can < 10 ? "disabled" : ""}>×10</button>
      <button class="tw2-btn2" data-gems-action="synth" data-from="${esc(ui.synthFromTplId || "")}" data-times="9999" ${can <= 0 ? "disabled" : ""}>Макс</button>
    </div>

    <div style="margin-top:14px; opacity:.7; font-size:12px;">Уровень 12 здесь не улучшается — используй вкладку «Пробуждение».</div>
  `;
}

function renderAwakenTab(ui, inv, bag) {
  const p = state.player || {};
  const gold = Number(p.gold || 0);
  const coupons = Number(p.coupons || 0);
  const cost = 2000;

  const awakenables = (bag || []).filter((x) => {
    if (!isGemItem(x) || isStarGemItem(x)) return false;
    const lvl = getGemLevelByTplId(String(x.tplId || ""));
    if (lvl !== 12) return false;
    const meta = getGemMetaByTplId(String(x.tplId || ""));
    return meta && (meta.key === "spirit" || meta.key === "chakra" || meta.key === "agility" || meta.key === "might");
  });

  const map = new Map();
  for (const g of awakenables) {
    const tplId = String(g.tplId || "");
    map.set(tplId, (map.get(tplId) || 0) + Number(g.qty || 1));
  }

  const options = Array.from(map.entries())
    .map(([tplId, cnt]) => ({ tplId, cnt, label: `${gemLabelFromTplId(tplId)} (${cnt})` }))
    .sort((a, b) => a.label.localeCompare(b.label));

  if (!ui.awakenFromTplId && options[0]) ui.awakenFromTplId = options[0].tplId;
  const sel = options.find((o) => o.tplId === ui.awakenFromTplId) || null;

  const useCoupons = Math.min(coupons, cost);
  const needGold = Math.max(0, cost - useCoupons);
  const canPay = gold >= needGold;

  return `
    <div style="font-weight:800;margin-bottom:10px;">Пробуждение (12 → ★0)</div>
    <div class="badge" style="opacity:.85;margin-bottom:10px;">Самоцвет 12 уровня превращается в Звёздный ★0. Стоимость: 2000 (сначала купоны, потом золото).</div>

    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
      <select data-awaken-from style="min-width:360px;padding:10px 12px;border-radius:12px;background:rgba(0,0,0,.35);color:#fff;border:1px solid rgba(255,255,255,.12);">
        ${options
          .map((o) => `<option value="${esc(o.tplId)}" ${o.tplId === ui.awakenFromTplId ? "selected" : ""}>${esc(o.label)}</option>`)
          .join("")}
      </select>

      <div class="badge">Купоны: ${coupons} | Золото: ${gold}</div>
      <div class="badge">Списываем: ${useCoupons} куп. + ${needGold} зол.</div>

      <button class="tw2-btn2" data-gems-action="awaken" data-from="${esc(ui.awakenFromTplId || "")}" ${!sel || !canPay ? "disabled" : ""}>Пробудить</button>
    </div>

    ${options.length ? "" : `<div class="badge" style="margin-top:12px;">Нет самоцветов 12 уровня для пробуждения (Дух/Чакра/Ловкость/Сила).</div>`}
  `;
}

function renderStarsTab(ui, inv, bag) {
  const starItems = (bag || []).filter((x) => isStarGemItem(x));
  const list = starItems
    .map((it) => ({
      id: String(it.id),
      tplId: String(it.tplId || ""),
      label: gemLabelFromTplId(String(it.tplId || "")),
      exp: Math.max(0, Math.floor(Number(it?.meta?.exp || 0))),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  if (!ui.starItemId && list[0]) ui.starItemId = list[0].id;
  const sel = list.find((x) => x.id === ui.starItemId) || null;

  const feedMap = new Map();
  for (const g of (bag || []).filter((x) => isGemItem(x) && !isStarGemItem(x))) {
    const tplId = String(g.tplId || "");
    feedMap.set(tplId, (feedMap.get(tplId) || 0) + Number(g.qty || 1));
  }
  const feedOptions = Array.from(feedMap.entries())
    .map(([tplId, cnt]) => ({ tplId, cnt, lvl: getGemLevelByTplId(tplId), label: `${gemLabelFromTplId(tplId)} (${cnt})` }))
    .sort((a, b) => a.label.localeCompare(b.label));

  if (!ui.feedTplId && feedOptions[0]) ui.feedTplId = feedOptions[0].tplId;
  const feedSel = feedOptions.find((o) => o.tplId === ui.feedTplId) || null;

  const p = state.player || {};
  const gold = Number(p.gold || 0);
  const qty = Math.max(1, Math.min(9999, Number(ui.feedQty || 1)));
  const lvl = feedSel ? Math.max(1, Math.min(12, Number(feedSel.lvl || 1))) : 1;
  const expPer = FEED_EXP_BY_LEVEL[lvl - 1];
  const safeCostPer = FEED_SAFE_GOLD_BY_LEVEL[lvl - 1];
  const totalSafeCost = safeCostPer * qty;

  let stars = 0;
  let kind = null;
  if (sel) {
    const m = sel.tplId.match(/^gem_star_([a-zA-Z]+)_(\d+)$/);
    if (m) {
      kind = m[1];
      stars = Number(m[2] || 0);
    }
  }
  const need = kind && STAR_EXP_REQ[kind] ? STAR_EXP_REQ[kind][stars] : null;
  const curExp = sel ? sel.exp : 0;
  const pct = need ? Math.max(0, Math.min(100, Math.floor((curExp / need) * 100))) : 0;

  return `
    <div style="font-weight:800;margin-bottom:10px;">Звёздные (Royal) — прокачка EXP</div>
    <div class="badge" style="opacity:.85;margin-bottom:10px;">Кормим звёздный камень обычными камнями. Safe = 100% шанс (стоимость в золоте), иначе шанс 50%.</div>

    <div style="display:flex;gap:10px;align-items:flex-start;">
      <div style="flex:1; min-width:340px; max-width:420px;">
        <div style="display:flex; flex-direction:column; gap:8px; max-height:460px; overflow:auto; padding-right:6px;">
          ${
            list
              .map((x) => {
                const active = x.id === ui.starItemId;
                return `<button class="tw2-btn2" data-gems-action="pickStarItem" data-id="${esc(x.id)}" style="width:100%;text-align:left;${
                  active ? "box-shadow:0 0 0 2px rgba(255,255,255,.25) inset;" : ""
                }">
                  <div style="display:flex;justify-content:space-between;gap:10px;">
                    <span>${esc(x.label)}</span>
                    <span style="opacity:.85;">EXP ${x.exp}</span>
                  </div>
                </button>`;
              })
              .join("") || `<div class="badge">Нет звёздных самоцветов</div>`
          }
        </div>
      </div>

      <div style="flex:1;">
        <div class="tw2-card" style="padding:14px;">
          <div style="font-weight:800;">Выбран: ${esc(sel ? sel.label : "—")}</div>
          <div style="opacity:.8;margin-top:6px;">Золото: ${gold}</div>
          <div style="opacity:.8;">Звёзды: ${stars}/10</div>
          ${need ? `<div style="opacity:.8;">Прогресс: ${curExp}/${need} (${pct}%)</div>` : `<div style="opacity:.8;">—</div>`}

          <div style="height:10px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;margin-top:8px;">
            <div style="height:100%;width:${pct}%;background:rgba(255,255,255,.35);"></div>
          </div>

          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:14px;">
            <select data-feed-from style="min-width:320px;padding:10px 12px;border-radius:12px;background:rgba(0,0,0,.35);color:#fff;border:1px solid rgba(255,255,255,.12);">
              ${feedOptions
                .map((o) => `<option value="${esc(o.tplId)}" ${o.tplId === ui.feedTplId ? "selected" : ""}>${esc(o.label)}</option>`)
                .join("")}
            </select>
            <input data-feed-qty type="number" min="1" value="${qty}" style="width:90px;padding:10px 12px;border-radius:12px;background:rgba(0,0,0,.35);color:#fff;border:1px solid rgba(255,255,255,.12);" />
            <label class="badge" style="display:flex;align-items:center;gap:8px;">
              <input data-feed-safe type="checkbox" ${ui.feedSafe ? "checked" : ""} /> Safe
            </label>
          </div>

          <div style="opacity:.75;margin-top:8px; font-size:12px;">
            Даёт: +${expPer} EXP за 1 (×${qty} = +${expPer * qty}). ${ui.feedSafe ? `Safe: стоимость ${totalSafeCost} зол.` : "Шанс 50%"}
          </div>

          <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;">
            <button class="tw2-btn2" data-gems-action="feed" data-star-id="${esc(ui.starItemId || "")}" data-feed="${esc(ui.feedTplId || "")}" data-qty="${qty}" data-safe="${ui.feedSafe ? "1" : "0"}" ${!sel || !feedSel ? "disabled" : ""}>
              Кормить
            </button>
          </div>

          ${feedOptions.length ? "" : `<div class="badge" style="margin-top:12px;">Нет обычных самоцветов для кормления.</div>`}
        </div>
      </div>
    </div>
  `;
}

function renderEnhanceTab(ui, inv, eq, bag) {
  const item = eq?.[ui.equipSlot] || null;
  const slots = ensureGemSlots(item);
  const matCnt = countByTplId(bag, "mat_gem_slot_unlock");

  const cards = slots
    .map((gs, idx) => {
      const open = Boolean(gs.open);
      const locked = !open;
      const hasGem = Boolean(gs.gem);
      let label = locked ? "🔒" : hasGem ? gemShortLabel(gs.gem, inv) : "+";
      let sub = hasGem ? gemSubLabel(gs.gem, inv) : locked ? "Закрыт" : "";

      const canUnlock = locked && idx >= 6 && matCnt > 0;

      return `
        <div class="tw2-card" style="width:120px;padding:12px;border-radius:14px;display:flex;flex-direction:column;align-items:center;gap:6px;${
          locked ? "opacity:.75;" : ""
        }">
          <div style="font-size:22px;">💎</div>
          <div style="font-size:12px;font-weight:800;text-align:center;line-height:1.1;">Слот ${idx + 1}</div>
          <div style="font-size:12px;font-weight:800;text-align:center;line-height:1.1;">${esc(label)}</div>
          <div style="font-size:12px;opacity:.85;">${esc(sub)}</div>
          ${
            canUnlock
              ? `<button class="tw2-btn2" data-gems-action="unlock" data-idx="${idx}" style="margin-top:6px;">Открыть</button>`
              : locked && idx >= 6
                ? `<div style="font-size:12px;opacity:.75;margin-top:6px;">Нужен материал</div>`
                : ``
          }
        </div>
      `;
    })
    .join("");

  return `
    <div style="font-weight:800;margin-bottom:10px;">Усиление</div>
    <div class="badge" style="opacity:.85;margin-bottom:12px;">Открытие 7-8 слота в текущей вещи. Материал: <b>mat_gem_slot_unlock</b>. В сумке: <b>${matCnt}</b></div>
    <div style="display:flex;flex-wrap:wrap;gap:10px;">${cards}</div>
  `;
}

// ----- Helpers -----

function ensureGemSlots(item) {
  if (!item) return Array.from({ length: 8 }).map((_, i) => ({ open: i < 6, gem: null }));
  if (!Array.isArray(item.gemSlots)) item.gemSlots = Array.from({ length: 8 }).map((_, i) => ({ open: i < 6, gem: null }));
  // normalize length
  while (item.gemSlots.length < 8) item.gemSlots.push({ open: item.gemSlots.length < 6, gem: null });
  if (item.gemSlots.length > 8) item.gemSlots = item.gemSlots.slice(0, 8);
  // open defaults
  for (let i = 0; i < 6; i++) item.gemSlots[i].open = true;
  return item.gemSlots;
}

function isGemItem(it) {
  if (!it) return false;
  const t = String(it.type || "").toLowerCase();
  if (t === "gem") return true;
  const tpl = String(it.tplId || "");
  return tpl.startsWith("gem_") || tpl.startsWith("gem_star_");
}

function isStarGemItem(it) {
  const tpl = String(it?.tplId || "");
  return tpl.startsWith("gem_star_");
}

function isFuryGemItem(it) {
  const tpl = String(it?.tplId || "");
  return tpl.startsWith("gem_fury_");
}

function filterGems(list, filter) {
  const f = String(filter || "all");
  if (f === "all") return list;
  return list.filter((g) => {
    const info = gemInfoFromTplId(String(g.tplId || ""));
    if (!info) return false;
    return info.kind === f;
  });
}

function gemInfoFromTplId(tplId) {
  const s = String(tplId || "");

  // Fury gems are stored as gem_fury_<lvl> in the inventory.
  // Map them to our internal meta key: initialFury.
  {
    const fm = s.match(/^gem_fury_(\d+)$/);
    if (fm) {
      const lvl = Number(fm[1] || 0);
      const meta = GEM_META.initialFury;
      if (!meta) return { kind: "fury", label: "Ярость", pct: null, level: lvl, target: "initialFury" };
      const pct = meta.table?.[lvl - 1] ?? null;
      return { kind: meta.kind, label: meta.label, pct, level: lvl, target: "initialFury" };
    }
  }
  if (s.startsWith("gem_star_")) {
    const m = s.match(/^gem_star_([a-zA-Z]+)_(\d+)$/);
    if (!m) return null;
    const tgt = m[1];
    const stars = Number(m[2] || 0);
    const key = `star_${tgt}`;
    const meta = GEM_META[key];
    if (!meta) return { kind: "star", label: s, pct: null, level: stars };
    const pct = meta.table?.[stars] ?? null;
    return { kind: "star", label: meta.label, pct, level: stars, target: tgt };
  }

  const m = s.match(/^gem_([a-zA-Z]+[a-zA-Z0-9]*)_(\d+)$/);
  if (!m) return null;
  const key = m[1];
  const lvl = Number(m[2] || 0);
  const meta = GEM_META[key];
  if (!meta) return null;
  const pct = meta.table?.[lvl - 1] ?? meta.table?.[lvl] ?? null;
  return { kind: meta.kind, label: meta.label, pct, level: lvl, target: key };
}

// Helpers used by tabs
function getGemLevelByTplId(tplId) {
  const s = String(tplId || "");
  const fm = s.match(/^gem_fury_(\d+)$/);
  if (fm) return Number(fm[1] || 0);
  const sm = s.match(/^gem_star_[a-zA-Z]+_(\d+)$/);
  if (sm) return 0;
  const m = s.match(/^gem_[a-zA-Z]+[a-zA-Z0-9]*_(\d+)$/);
  if (!m) return 0;
  return Number(m[1] || 0);
}

function getGemMetaByTplId(tplId) {
  const s = String(tplId || "");
  const fm = s.match(/^gem_fury_(\d+)$/);
  if (fm) return { key: "initialFury", ...GEM_META.initialFury };

  const m = s.match(/^gem_([a-zA-Z]+[a-zA-Z0-9]*)_(\d+)$/);
  if (!m) return null;
  const key = m[1];
  const meta = GEM_META[key];
  if (!meta) return null;
  return { key, ...meta };
}

function gemLabelFromTplId(tplId) {
  const info = gemInfoFromTplId(tplId);
  if (!info) return tplId;
  if (info.kind === "star") return `${info.label} ★${info.level}`;
  return `${info.label} ${info.level}`;
}

function gemLabelFromItem(it) {
  return gemLabelFromTplId(String(it?.tplId || ""));
}

function gemPctFromItem(it) {
  const info = gemInfoFromTplId(String(it?.tplId || ""));
  if (!info) return "";
  if (info.pct == null) return "";
  return `${info.pct}%`;
}

function gemShortLabel(gref, inv) {
  const tplId = typeof gref === "string" ? gref : gref?.tplId;
  const info = gemInfoFromTplId(String(tplId || ""));
  if (!info) return "Самоцвет";
  if (info.kind === "star") {
    // shorter label
    if (info.target === "spirit") return `Дух ${info.level}`;
    if (info.target === "chakra") return `Чакра ${info.level}`;
    if (info.target === "agility") return `Ловк ${info.level}`;
    if (info.target === "might") return `Сила ${info.level}`;
    return `★${info.level}`;
  }
  // normal
  const base = info.label.split(" ")[0];
  return `${base} ${info.level}`;
}

function gemSubLabel(gref, inv) {
  const tplId = typeof gref === "string" ? gref : gref?.tplId;
  const info = gemInfoFromTplId(String(tplId || ""));
  if (!info) return "";
  if (info.pct == null) return "";
  return `${info.pct}%`;
}

function countByTplId(bag, tplId) {
  let n = 0;
  for (const it of bag || []) {
    if (!it || String(it.tplId || "") !== String(tplId)) continue;
    n += Number(it.qty || 1);
  }
  return n;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// ----- API -----

async function apiGemsInsert(playerId, heroId, equipSlot, gemItemId) {
  const r = await fetch("/api/gems/insert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, heroId, equipSlot, gemItemId }),
  });
  await r.json().catch(() => null);
}

async function apiGemsRemove(playerId, heroId, equipSlot, gemSlotIndex) {
  const r = await fetch("/api/gems/remove", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, heroId, equipSlot, gemSlotIndex }),
  });
  await r.json().catch(() => null);
}

async function apiGemsSynthesize(playerId, fromTplId, times) {
  const r = await fetch("/api/gems/synthesize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, fromTplId, times }),
  });
  await r.json().catch(() => null);
}

async function apiGemsAwaken(playerId, fromTplId) {
  const r = await fetch("/api/gems/awaken", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, fromTplId }),
  });
  await r.json().catch(() => null);
}

async function apiGemsUnlock(playerId, heroId, equipSlot, gemSlotIndex) {
  const r = await fetch("/api/gems/unlockSlot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, heroId, equipSlot, gemSlotIndex }),
  });
  await r.json().catch(() => null);
}

async function apiGemsStarUpgrade(playerId, fromTplId, safe) {
  const r = await fetch("/api/gems/starUpgrade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, fromTplId, safe }),
  });
  await r.json().catch(() => null);
}

async function apiGemsStarFeed(playerId, starItemId, feedTplId, qty, safe) {
  const r = await fetch("/api/gems/starFeed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, starItemId, feedTplId, qty, safe }),
  });
  await r.json().catch(() => null);
}
