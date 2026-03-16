import { state, setState } from "../../state.js";
import { openModal } from "./windowsRoot.js";

let selectedHeroId = null;
let activeTabRole = "tank"; // як на скріні знизу (Захисник)
let selectedSkillSlot = 0;

export function openFormationWindow() {
  selectedHeroId = null;

  const modal = openModal({
    title: "Формація",
    contentHtml: render(state),
    onClose: () => {
      selectedHeroId = null;
      activeTabRole = "tank";
      selectedSkillSlot = 0;
    }
  });

  bind();
  refreshFormationData().then(() => rerender()).catch(() => {});
  return modal;
}

function rerender() {
  const body = document.querySelector("#windows-root .modalBody");
  if (!body) return;
  body.innerHTML = render(state);
  bind();
}

function render(s) {
  if (!Array.isArray(s.heroes) || s.heroes.length === 0) {
    return `<div class="badge">Герої ще завантажуються...</div>`;
  }
  const slots = s.formation.slots;
  const availableAll = s.heroes.slice();

  const main = s.heroes.find(h => h.isMain) || s.heroes[0];
  const available = availableAll.filter(h => h.role === activeTabRole);

  // Підказка “Міць” (поки просто приклад)
  const power = calcPower(s);

  const tile = (slotKey, role) => {
    const heroId = slots[slotKey];
    const hero = heroId ? s.heroes.find(h => h.id === heroId) : null;

    return `
      <div class="fmN-tile ${role} ${hero ? "has-hero" : ""}"
           data-slot="${slotKey}"
           data-need="${role}">
        <div class="fmN-rune ${role}"></div>

        ${hero ? `
          <div class="fmN-unit" draggable="true" data-hero="${hero.id}">
            <div class="fmN-name">${esc(hero.name)}${hero.isMain ? ` <span class="fmN-main">(ГГ)</span>` : ""}</div>
            <div class="fmN-role">${roleLabel(hero.role)}</div>
          </div>
          ${!hero.isMain ? `<button class="fmN-x" data-remove="${slotKey}" title="Зняти">✕</button>` : ""}
        ` : `
          <div class="fmN-empty">Порожньо</div>
        `}
      </div>
    `;
  };

  const rosterCard = (h) => {
    const placedSlot = findHeroSlot(s, h.id);
    return `
      <div class="fmN-card ${selectedHeroId === h.id ? "is-selected" : ""} ${placedSlot ? "is-placed" : ""}"
           draggable="true"
           data-hero="${h.id}">
        <div class="fmN-ava">${initials(h.name)}</div>
        <div class="fmN-cardText">
          <div class="fmN-cardName">${esc(h.name)}${h.isMain ? ` <span class="fmN-main">(ГГ)</span>` : ""}</div>
          <div class="fmN-cardRole">${roleLabel(h.role)}${placedSlot ? ` • у формації` : ""}</div>
        </div>
      </div>
    `;
  };

  return `
    <div class="fmN-wrap">

      <!-- LEFT big board -->
      <div class="fmN-left">
        <div class="fmN-topbar">
          <div class="fmN-power">
            <div class="fmN-powerLabel">Міць</div>
            <div class="fmN-powerVal">${power}</div>
          </div>

          <div class="fmN-hint">
            Переміщай персонажа (Drag&Drop або клік по герою → клік по плитці)
          </div>
        </div>

        <div class="fmN-board">
          <div class="fmN-grid">
            <!-- Ряд 1: 1 2 -->
            <div class="fmN-row r1">
              ${tile("r1c1", "helper")}
              ${tile("r1c2", "assault")}
            </div>

            <!-- Ряд 2: 1 2 3 -->
            <div class="fmN-row r2">
              ${tile("r2c1", "helper")}
              ${tile("r2c2", "assault")}
              ${tile("r2c3", "tank")}
            </div>

            <!-- Ряд 3: 1 2 -->
            <div class="fmN-row r3">
              ${tile("r3c1", "helper")}
              ${tile("r3c2", "assault")}
            </div>
          </div>

          <div class="fmN-legend">
            <div class="fmN-legendItem helper"><span class="dot"></span> Помічник</div>
            <div class="fmN-legendItem assault"><span class="dot"></span> Штурмовик</div>
            <div class="fmN-legendItem tank"><span class="dot"></span> Захисник</div>
          </div>
        </div>

        <!-- BOTTOM roster panel -->
        <div class="fmN-roster">
          <div class="fmN-tabs">
            <button class="fmN-tab ${activeTabRole === "tank" ? "is-active" : ""}" data-tab="tank">Захисник</button>
            <button class="fmN-tab ${activeTabRole === "assault" ? "is-active" : ""}" data-tab="assault">Штурмовик</button>
            <button class="fmN-tab ${activeTabRole === "helper" ? "is-active" : ""}" data-tab="helper">Помічник</button>
          </div>

          <div class="fmN-rosterStrip">
            ${available.length ? available.map(rosterCard).join("") : `<div class="fmN-muted">Немає доступних героїв цієї ролі</div>`}
          </div>
        </div>
      </div>

      <!-- RIGHT panel: main hero skills -->
      <div class="fmN-right">
        <div class="fmN-rightHead">
          <div class="fmN-rightTitle">Навик</div>
          <div class="fmN-rightSub">${esc(main?.name || "ГГ")} • ${roleLabel(main?.role || "assault")}</div>
        </div>

        <div class="fmN-skillBig">
          <div class="fmN-skillIcon">📖</div>
          <div class="fmN-skillName">${esc(getSelectedSkill(main)?.name || getHeroSkillList(main)[0]?.name || "Базова техніка")}</div>
        </div>

        <div class="fmN-skillSlots">
          ${renderSkillSlots(main)}
        </div>

        <div class="fmN-rightHint">
          Обери слот 1–8, потім натисни навичку зі списку нижче. Відкриті навички з книги ГГ зберігаються окремо і тепер можна міняти місцями.
        </div>

        <div class="fmN-skillList">
          ${renderSkillList(main)}
        </div>
      </div>

    </div>
  `;
}

function bind() {
  // Tabs
  document.querySelectorAll(".fmN-tab[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      activeTabRole = btn.dataset.tab;
      selectedHeroId = null;
      rerender();
    });
  });

  // Select hero (roster or already placed)
  document.querySelectorAll("[data-hero]").forEach(el => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      selectedHeroId = el.dataset.hero;
      rerender();
    });
  });

  // Remove
  document.querySelectorAll(".fmN-x[data-remove]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const slotKey = btn.dataset.remove;
      tryRemove(slotKey);
    });
  });

  // Place by click on tile
  document.querySelectorAll(".fmN-tile[data-slot]").forEach(tileEl => {
    tileEl.addEventListener("click", () => {
      if (!selectedHeroId) return;
      tryPlace(selectedHeroId, tileEl.dataset.slot);
    });

    // Drag over / drop
    tileEl.addEventListener("dragover", (e) => {
      e.preventDefault();
      tileEl.classList.add("is-over");
    });
    tileEl.addEventListener("dragleave", () => tileEl.classList.remove("is-over"));
    tileEl.addEventListener("drop", (e) => {
      e.preventDefault();
      tileEl.classList.remove("is-over");
      const heroId = e.dataTransfer.getData("text/heroId");
      if (!heroId) return;
      tryPlace(heroId, tileEl.dataset.slot);
    });
  });

  // Skill slot select
  document.querySelectorAll(".fmN-skillSlot[data-skill-slot]").forEach(el => {
    el.addEventListener("click", async (e) => {
      e.stopPropagation();
      selectedSkillSlot = Number(el.dataset.skillSlot || 0);
      rerender();
    });
  });

  document.querySelectorAll(".fmN-skillClear[data-skill-slot]").forEach(el => {
    el.addEventListener("click", async (e) => {
      e.stopPropagation();
      selectedSkillSlot = Number(el.dataset.skillSlot || 0);
      await equipSkillSlot(null, selectedSkillSlot);
    });
  });

  document.querySelectorAll(".fmN-skillPick[data-skill-id]").forEach(el => {
    el.addEventListener("click", async (e) => {
      e.stopPropagation();
      await equipSkillSlot(el.dataset.skillId, selectedSkillSlot);
    });
  });

  // Drag start for roster & placed heroes
  document.querySelectorAll("[draggable='true'][data-hero]").forEach(el => {
    el.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/heroId", el.dataset.hero);
    });
  });
}


async function refreshFormationData() {
  const playerId = state?.player?.id || localStorage.getItem("playerId") || "";
  if (!playerId) return;
  try {
    const [heroesRes, formationRes] = await Promise.all([
      fetch(`/api/heroes/list?playerId=${encodeURIComponent(playerId)}`),
      fetch(`/api/formation/get?playerId=${encodeURIComponent(playerId)}`),
    ]);
    const [heroesJson, formationJson] = await Promise.all([
      heroesRes.json().catch(() => null),
      formationRes.json().catch(() => null),
    ]);
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
      if (Array.isArray(heroesJson?.heroes)) {
        s.heroes = heroesJson.heroes.map((h) => ({
          id: h.id,
          name: h.name,
          role: mapRole(h.role) || "assault",
          isMain: Boolean(h.isMain),
          lvl: Number(h.level || 1),
          rank: String(h.rarity || "C"),
          classType: h.classType || "taijutsu",
          skills: Array.isArray(h.skills) ? h.skills : [],
          skillBookSkills: Array.isArray(h.skillBookSkills) ? h.skillBookSkills : [],
          equippedSkillIds: Array.isArray(h.equippedSkillIds) ? h.equippedSkillIds : [],
          growthPerLevel: h.growthPerLevel || null,
          growth: h.growth || null,
          __raw: h,
        }));
      }
      if (formationJson?.formation) {
        const f = formationJson.formation || {};
        const top = Array.isArray(f.top) ? f.top : [null, null];
        const mid = Array.isArray(f.middle) ? f.middle : [null, null, null];
        const bot = Array.isArray(f.bottom) ? f.bottom : [null, null];
        s.formation.slots = {
          r1c1: top[0] || null,
          r1c2: top[1] || null,
          r2c1: mid[0] || null,
          r2c2: mid[1] || null,
          r2c3: mid[2] || null,
          r3c1: bot[0] || null,
          r3c2: bot[1] || null,
        };
      }
    });
  } catch (e) {}
}

function findHeroSlot(s, heroId) {
  for (const [k, v] of Object.entries(s?.formation?.slots || {})) {
    if (v === heroId) return k;
  }
  return null;
}

function getHeroSkillList(main) {
  const skillBookSkills = Array.isArray(main?.skillBookSkills)
    ? main.skillBookSkills
    : Array.isArray(main?.__raw?.skillBookSkills)
      ? main.__raw.skillBookSkills
      : [];
  const baseSkills = Array.isArray(main?.skills)
    ? main.skills
    : Array.isArray(main?.__raw?.skills)
      ? main.__raw.skills
      : [];
  const merged = [...baseSkills, ...skillBookSkills];
  const seen = new Set();
  return merged.filter((x) => {
    const key = String(x?.id || x?.name || "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getUnlockedSkillBookList(main) {
  const skillBookSkills = Array.isArray(main?.skillBookSkills)
    ? main.skillBookSkills
    : Array.isArray(main?.__raw?.skillBookSkills)
      ? main.__raw.skillBookSkills
      : [];
  const seen = new Set();
  return skillBookSkills.filter((x) => {
    const key = String(x?.id || x?.name || "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getEquippedSkillIds(main) {
  const ids = Array.isArray(main?.equippedSkillIds)
    ? main.equippedSkillIds
    : Array.isArray(main?.__raw?.equippedSkillIds)
      ? main.__raw.equippedSkillIds
      : [];
  return ids.slice(0, 8);
}

function getEquippedSkillObjects(main) {
  const unlocked = getUnlockedSkillBookList(main);
  const map = new Map(unlocked.map((x) => [x.id, x]));
  const ids = getEquippedSkillIds(main);
  const out = [];
  for (let i = 0; i < 8; i++) out.push(map.get(ids[i]) || null);
  return out;
}

function getSelectedSkill(main) {
  const equipped = getEquippedSkillObjects(main);
  return equipped[selectedSkillSlot] || null;
}

function tryPlace(heroId, slotKey) {
  const hero = state.heroes.find(h => h.id === heroId);
  if (!hero) return;

  const need = needRoleBySlot(slotKey);

  // role restriction
  if (hero.role !== need) {
    toast(`Цей слот для ролі: ${roleLabel(need)}.`);
    return;
  }

  // GG cannot be removed, only moved inside assault tiles
  if (hero.isMain && need !== "assault") {
    toast("ГГ може стояти тільки в слотах Штурмовика.");
    return;
  }

  // ✅ максимум 5 героїв у формації
  {
    const cur = getPlacedHeroIds(state);
    const already = cur.has(heroId);
    if (!already && cur.size >= 5) {
      toast("У формації максимум 5 персонажів.");
      return;
    }
  }

  setState(s => {
    // remove hero from any other slot (no duplicates)
    for (const k of Object.keys(s.formation.slots)) {
      if (s.formation.slots[k] === heroId) s.formation.slots[k] = null;
    }
    // place into target
    s.formation.slots[slotKey] = heroId;
  });

  selectedHeroId = null;
  saveFormationToServer().finally(()=>rerender());
}

function tryRemove(slotKey) {
  const heroId = state.formation.slots[slotKey];
  if (!heroId) return;

  const hero = state.heroes.find(h => h.id === heroId);
  if (hero?.isMain) {
    toast("ГГ не можна прибрати з формації.");
    return;
  }

  setState(s => {
    s.formation.slots[slotKey] = null;
  });

  saveFormationToServer().finally(()=>rerender());
}

async function saveFormationToServer(){
  const playerId = state?.player?.id || localStorage.getItem("playerId") || "";
  if(!playerId) return;

  const slots = state?.formation?.slots || {};
  const formation = {
    top: [slots.r1c1 || null, slots.r1c2 || null],
    middle: [slots.r2c1 || null, slots.r2c2 || null, slots.r2c3 || null],
    bottom: [slots.r3c1 || null, slots.r3c2 || null],
  };

  try{
    const res = await fetch(`/api/formation/set`, {
      method: "POST",
      headers: { "content-type":"application/json" },
      body: JSON.stringify({ playerId, formation }),
    });
    const data = await res.json().catch(()=>null);
    if(!res.ok || !data?.ok){
      toast(`Не вдалося зберегти формацію: ${data?.error || res.status}`);
    }
  }catch(e){
    toast(`Не вдалося зберегти формацію: ${String(e?.message||e)}`);
  }
}

function needRoleBySlot(slotKey) {
  // r1c1 helper, r1c2 assault
  // r2c1 helper, r2c2 assault, r2c3 tank
  // r3c1 helper, r3c2 assault
  if (slotKey.endsWith("c1")) return "helper";
  if (slotKey.endsWith("c2")) return "assault";
  return "tank";
}

function getPlacedHeroIds(s) {
  const set = new Set();
  Object.values(s.formation.slots).forEach(id => { if (id) set.add(id); });
  return set;
}

function roleLabel(role) {
  if (role === "helper") return "Помічник";
  if (role === "assault") return "Штурмовик";
  return "Захисник";
}

function skillSlot(n) {
  return `<div class="fmN-skillSlot" title="Слот ${n}"></div>`;
}

function calcPower(s) {
  // тимчасово: залежить від кількості зайнятих слотів
  const used = Object.values(s.formation.slots).filter(Boolean).length;
  return 30000 + used * 3421;
}

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/);
  const a = parts[0]?.[0] || "N";
  const b = parts[1]?.[0] || "";
  return (a + b).toUpperCase();
}

function esc(str) {
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function toast(msg) {
  // поки просто alert (потім зробимо гарний тултіп як у грі)
  alert(msg);
}

function renderSkillSlots(main) {
  const list = getEquippedSkillObjects(main);
  const cells = [];
  for (let i = 0; i < 8; i++) {
    const s = list[i];
    const active = selectedSkillSlot === i ? ' is-active' : '';
    const clear = s ? '<button class="fmN-skillClear" data-skill-slot="'+i+'" data-clear="1" title="Очистити слот">×</button>' : '';
    cells.push(`<div class="fmN-skillSlot${active}" data-skill-slot="${i}" title="${esc(s?.desc || s?.name || `Слот ${i+1}`)}"><span>${s ? "⚡" : i + 1}</span>${clear}</div>`);
  }
  return cells.join("");
}

function renderSkillList(main) {
  const unlocked = getUnlockedSkillBookList(main);
  const equippedIds = new Set(getEquippedSkillIds(main));
  if (!unlocked.length) return '<div class="fmN-muted">Поки що немає відкритих книжкових навичок.</div>';
  return unlocked.map((s) => `<div class="fmN-skillPick ${equippedIds.has(s.id) ? 'is-equipped' : ''}" data-skill-id="${esc(s.id)}" title="${esc(s.desc || s.name || '')}"><div class="fmN-skillPickName">${esc(s.name || 'Навик')}</div><div class="fmN-skillPickDesc">${esc(s.desc || '')}</div></div>`).join('');
}

async function equipSkillSlot(skillId, slotIndex) {
  const playerId = state?.player?.id || localStorage.getItem("playerId") || "";
  if (!playerId) return;
  try {
    const res = await fetch(`/api/skillbook/equip`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ playerId, slotIndex, skillId }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      toast(`Не вдалося змінити навик: ${data?.error || res.status}`);
      return;
    }
    await refreshFormationData();
    rerender();
  } catch (e) {
    toast(`Не вдалося змінити навик: ${String(e?.message || e)}`);
  }
}
