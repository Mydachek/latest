// server/index.js
require("dotenv").config();

const path = require("path");
const fs = require("fs");
const express = require("express");
const dungeonsRoute = require("./routes/dungeons");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// ===== static =====
const clientDir = path.join(__dirname, "..", "client");
app.use(express.static(clientDir));

app.get("/health", (req, res) => res.json({ ok: true }));

// ===== storage =====
const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });

function filePath(name) {
  return path.join(dataDir, name);
}

function readJSON(name, fallback) {
  const fp = filePath(name);
  if (!fs.existsSync(fp)) return fallback;
  const raw = fs.readFileSync(fp, "utf8") || "";
  if (!raw.trim()) return fallback;
  try {
    return JSON.parse(raw);
  } catch (e) {
    const bad = filePath(`${name}.bad-${Date.now()}.json`);
    fs.writeFileSync(bad, raw, "utf8");
    return fallback;
  }
}

function writeJSON(name, obj) {
  const fp = filePath(name);
  const tmp = fp + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), "utf8");
  fs.renameSync(tmp, fp);
}

function uid(prefix) {
  return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

function asArray(v) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object") return Object.values(v);
  return [];
}

function setAsArray(db, key, arr) {
  if (!db || typeof db !== "object") db = {};
  db[key] = Array.isArray(arr) ? arr : [];
  return db;
}

// ===== catalog + derived stats (Variant B) =====
let __itemsCatalogCache = null;
function getItemsCatalog() {
  if (__itemsCatalogCache) return __itemsCatalogCache;
  const raw = readJSON("items_catalog.json", { items: [] });
  const items = asArray(raw.items);
  const map = new Map();
  for (const it of items) {
    if (!it || !it.tplId) continue;
    map.set(String(it.tplId), it);
  }
  __itemsCatalogCache = { items, map };
  return __itemsCatalogCache;
}

// ===== Set boxes content =====
const SET_CONTENTS = {
  akatsuki: [
    "set_akatsuki_kunai",
    "set_akatsuki_shuriken",
    "set_akatsuki_scroll",
    "set_akatsuki_helm",
    "set_akatsuki_armor",
    "set_akatsuki_cloak",
    "set_akatsuki_boots",
    "set_akatsuki_belt",
  ],
  angel: [
    "set_angel_kunai",
    "set_angel_shuriken",
    "set_angel_scroll",
    "set_angel_helm",
    "set_angel_armor",
    "set_angel_cloak",
    "set_angel_boots",
    "set_angel_belt",
  ],
  ice: [
    "set_ice_kunai",
    "set_ice_shuriken",
    "set_ice_scroll",
    "set_ice_helm",
    "set_ice_armor",
    "set_ice_cloak",
    "set_ice_boots",
    "set_ice_belt",
  ],
  abyss: [
    "set_abyss_kunai",
    "set_abyss_shuriken",
    "set_abyss_scroll",
    "set_abyss_helm",
    "set_abyss_armor",
    "set_abyss_cloak",
    "set_abyss_boots",
    "set_abyss_belt",
  ],

  // ===== Jewelry sets (8 pieces each) =====
  j_akatsuki: [
    "jset_akatsuki_spirit_1","jset_akatsuki_chakra_1","jset_akatsuki_agility_1","jset_akatsuki_spirit_2",
    "jset_akatsuki_chakra_2","jset_akatsuki_agility_2","jset_akatsuki_hp_1","jset_akatsuki_hp_2",
  ],
  j_prizrak: [
    "jset_prizrak_spirit_1","jset_prizrak_chakra_1","jset_prizrak_agility_1","jset_prizrak_spirit_2",
    "jset_prizrak_chakra_2","jset_prizrak_agility_2","jset_prizrak_hp_1","jset_prizrak_hp_2",
  ],
  j_king: [
    "jset_king_spirit_1","jset_king_chakra_1","jset_king_agility_1","jset_king_spirit_2",
    "jset_king_chakra_2","jset_king_agility_2","jset_king_hp_1","jset_king_hp_2",
  ],
  j_sixpaths: [
    "jset_sixpaths_spirit_1","jset_sixpaths_chakra_1","jset_sixpaths_agility_1","jset_sixpaths_spirit_2",
    "jset_sixpaths_chakra_2","jset_sixpaths_agility_2","jset_sixpaths_hp_1","jset_sixpaths_hp_2",
  ],
};

function getInventory(playerId) {
  const db = readJSON("inventories.json", { inventories: [] });
  const arr = asArray(db.inventories);
  const rec = arr.find((x) => x && x.playerId === playerId);
  const inv = rec?.inventory || { bagItems: [], equippedItemsByHero: {}, capacity: 30, tempBagItems: [], tempCapacity: 30, freeExpands: [], paidExpands: 0, onlineClaims: 0 };

  inv.bagItems = Array.isArray(inv.bagItems) ? inv.bagItems : [];
  inv.tempBagItems = Array.isArray(inv.tempBagItems) ? inv.tempBagItems : [];
  inv.equippedItemsByHero = inv.equippedItemsByHero && typeof inv.equippedItemsByHero === "object" ? inv.equippedItemsByHero : {};
  inv.capacity = Number(inv.capacity || 30);
  inv.tempCapacity = Number(inv.tempCapacity || 30);
  inv.freeExpands = Array.isArray(inv.freeExpands) ? inv.freeExpands : [];
  inv.paidExpands = Number(inv.paidExpands || 0);
  inv.onlineClaims = Number(inv.onlineClaims || 0);

  return inv;
}

function normalizeRole(role) {
  const r = String(role || "").toLowerCase();
  if (r === "vanguard" || r === "tank" || r === "defender" || r === "авангард") return "tank"; // ✅ авангард = танк
  if (r === "support" || r === "helper" || r === "помічник") return "support";
  return "assault";
}

function sumEquipBonuses(playerId, heroId) {
  const inv = getInventory(playerId);
  const eq = inv.equippedItemsByHero?.[heroId] || {};
  const { map } = getItemsCatalog();

  // ===== SET BONUSES (2/4/6) =====
  const SET_BONUSES = {
    akatsuki: {
      2: { secondary: { damageRate: 8 } },
      4: { main: { agility: 1000 }, secondary: { avoidDamageRate: 6 } },
      6: { secondary: { punchRate: 8 } },
    },
    angel: {
      2: { secondary: { avoidDamageRate: 15 } },
      4: { main: { agility: 2000 }, secondary: { damageRate: 10 } },
      6: { secondary: { punchRate: 10 }, primary: { hp: 5000 } },
    },
    ice: {
      2: { main: { agility: 2000 }, secondary: { damageRate: 10 } },
      4: { primary: { hp: 5000 }, secondary: { enemyDefDownRate: 20 } },
      6: { secondary: { critDamageRate: 20, avoidDamageRate: 15 } },
    },
    abyss: {
      2: { main: { agility: 2000 }, secondary: { avoidDamageRate: 15 } },
      4: { main: { agility: 2000 }, secondary: { enemyAtkDownRate: 20 } },
      6: { main: { agility: 3000 }, secondary: { damageRate: 20 } },
    },
  };

  // Clothes + 8 jewelry slots (keep legacy "jewelry" for backward compatibility)
  // ⚠️ Only ONE weapon slot. Kunai/Shuriken/Scroll are weapon subtypes, not extra slots.
  const slots = [
    "weapon", "armor", "head", "cloak", "belt", "shoes",
    "jewelry", "j1", "j2", "j3", "j4", "j5", "j6", "j7", "j8",
  ];

  // Enhance applies ONLY to 6 clothes slots (NW rule)
  const ENHANCE_SLOTS = new Set(["weapon","armor","head","cloak","belt","shoes"]);
  const bonus = {
    // main
    spirit: 0, chakra: 0, might: 0, agility: 0,
    // primary
    hp: 0, physAtk: 0, physDef: 0, speed: 0, initialFury: 0, stratDef: 0, stratAtk: 0,
    // secondary
    damageRate: 0, accuracyRate: 0, critRate: 0, successRate: 0, punchRate: 0,
    sAttackRate: 0,
    avoidDamageRate: 0, dodgeRate: 0, contraRate: 0, blockRate: 0, sAttackRate: 0, helpRate: 0, healRate: 0,
    // special (set effects placeholders — used later in battle engine)
    critDamageRate: 0,
    enemyDefDownRate: 0,
    enemyAtkDownRate: 0,

    // Jewelry extras (used by jewelry set bonuses)
    extraRoundRate: 0,
    chaosAntiControlRate: 0,
  };

  // Count set pieces
  const setCount = {};

  // Jewelry set counters: per jewelry-setId -> per statType -> count
  const jSetCount = {}; // { [setId]: { spirit: n, chakra: n, agility: n, might: n, total: n } }

  for (const s of slots) {
    const item = eq?.[s];
    if (!item) continue;
    const tpl = map.get(String(item.tplId || ""));
    const st = tpl?.stats || item?.stats || {};
    const enhLvl = ENHANCE_SLOTS.has(String(s)) ? Number(item.enhanceLevel || 0) : 0;
    const mult = ENHANCE_SLOTS.has(String(s)) ? (1 + enhLvl * 0.003) : 1;

    for (const k of Object.keys(bonus)) {
      const v = Number(st?.[k] || 0);
      if (!v) continue;
      bonus[k] += ENHANCE_SLOTS.has(String(s)) ? Math.round(v * mult) : v;
    }

    const setId = String(tpl?.setId || item?.setId || "");
    if (setId) setCount[setId] = (setCount[setId] || 0) + 1;

    // Track jewelry sets separately (only for j1..j8)
    if (s.startsWith("j") && s !== "jewelry") {
      const jSetId = String(tpl?.jewelrySetId || item?.jewelrySetId || "");
      const jType = String(tpl?.jewelryStatType || item?.jewelryStatType || tpl?.statType || "").toLowerCase();
      if (jSetId) {
        jSetCount[jSetId] = jSetCount[jSetId] || { spirit: 0, chakra: 0, agility: 0, might: 0, total: 0 };
        if (["spirit", "chakra", "agility", "might"].includes(jType)) {
          jSetCount[jSetId][jType] += 1;
          jSetCount[jSetId].total += 1;
        }
      }
    }
  }

  // Apply set bonuses (2/4/6). If you have 4 pieces -> apply 2+4; if 6+ -> apply 2+4+6
  for (const [setId, cnt] of Object.entries(setCount)) {
    const def = SET_BONUSES[setId];
    if (!def) continue;
    const tiers = [2, 4, 6].filter((n) => cnt >= n);
    for (const t of tiers) {
      const b = def[t] || {};
      if (b.main) {
        bonus.spirit += Number(b.main.spirit || 0);
        bonus.chakra += Number(b.main.chakra || 0);
        bonus.might += Number(b.main.might || 0);
        bonus.agility += Number(b.main.agility || 0);
      }
      if (b.primary) {
        bonus.hp += Number(b.primary.hp || 0);
        bonus.physAtk += Number(b.primary.physAtk || 0);
        bonus.physDef += Number(b.primary.physDef || 0);
        bonus.stratAtk += Number(b.primary.stratAtk || 0);
        bonus.stratDef += Number(b.primary.stratDef || 0);
        bonus.speed += Number(b.primary.speed || 0);
      }
      if (b.secondary) {
        for (const k of Object.keys(b.secondary)) {
          if (k in bonus) bonus[k] += Number(b.secondary[k] || 0);
        }
      }
    }
  }

  // ===== JEWELRY SET BONUSES (2 pieces of each stat type; optional 8/8) =====
  // Notes:
  // - Bonuses apply per stat-type pair inside ONE jewelry set.
  // - Each jewelry set can have its own mapping.
  const JEWELRY_SET_BONUSES = {
    j_akatsuki: {
      spirit2: { secondary: { avoidDamageRate: 10 } },   // рейтинг защиты +10%
      chakra2: { secondary: { damageRate: 10 } },        // рейтинг атаки +10%
      agility2: { secondary: { accuracyRate: 20 } },     // точность +20%
      might2: { secondary: { helpRate: 15 } },           // рейтинг помощи +15%
      all8: null,
    },
    j_prizrak: {
      spirit2: { secondary: { damageRate: 10 } },        // рейтинг атаки +10%
      chakra2: { secondary: { extraRoundRate: 10 } },    // экстра раунд +10%
      agility2: { secondary: { avoidDamageRate: 10 } },  // рейтинг защиты +10%
      might2: { main: { might: 50000 } },                // сила +50000
      all8: null,
    },
    j_king: {
      spirit2: { secondary: { chaosAntiControlRate: 20 } },
      chakra2: { secondary: { chaosAntiControlRate: 30 } },
      agility2: { secondary: { damageRate: 15 } },
      might2: { secondary: { avoidDamageRate: 10 } },
      all8: null,
    },
    j_sixpaths: {
      spirit2: { secondary: { chaosAntiControlRate: 20 } },
      chakra2: { secondary: { chaosAntiControlRate: 30 } },
      agility2: { secondary: { damageRate: 15 } },
      might2: { secondary: { avoidDamageRate: 10 } },
      all8: null,
    },
  };

  for (const [jSetId, cnts] of Object.entries(jSetCount)) {
    const def = JEWELRY_SET_BONUSES[jSetId];
    if (!def) continue;
    const apply = (b) => {
      if (!b) return;
      if (b.main) {
        bonus.spirit += Number(b.main.spirit || 0);
        bonus.chakra += Number(b.main.chakra || 0);
        bonus.might += Number(b.main.might || 0);
        bonus.agility += Number(b.main.agility || 0);
      }
      if (b.primary) {
        bonus.hp += Number(b.primary.hp || 0);
        bonus.physAtk += Number(b.primary.physAtk || 0);
        bonus.physDef += Number(b.primary.physDef || 0);
        bonus.stratAtk += Number(b.primary.stratAtk || 0);
        bonus.stratDef += Number(b.primary.stratDef || 0);
        bonus.speed += Number(b.primary.speed || 0);
      }
      if (b.secondary) {
        for (const k of Object.keys(b.secondary)) {
          if (!(k in bonus)) bonus[k] = 0;
          bonus[k] += Number(b.secondary[k] || 0);
        }
      }
    };

    if (cnts.spirit >= 2) apply(def.spirit2);
    if (cnts.chakra >= 2) apply(def.chakra2);
    if (cnts.agility >= 2) apply(def.agility2);
    if (cnts.might >= 2) apply(def.might2);
    if (cnts.total >= 8) apply(def.all8);
  }
  return bonus;
}

function computeHeroDerived(hero) {
  const h = hero || {};
  const lvl = Math.max(1, Number(h.level || 1));

  // Support both schemas:
  //  - GG / old: h.stats.main + h.growth.main
  //  - Catalog/new: h.baseStats + h.growthPerLevel
  const schemaBBase = h.baseStats
    ? {
        spirit: Number(h.baseStats.spirit || 0),
        chakra: Number(h.baseStats.chakra || 0),
        might: Number(h.baseStats.might || h.baseStats.power || 0),
        agility: Number(h.baseStats.agility || 0),
      }
    : null;

  const baseMain = schemaBBase || h.base?.main || h.stats?.main || { spirit: 0, chakra: 0, might: 0, agility: 0 };

  const basePrimary = h.base?.primary || h.stats?.primary || {};

  const schemaBGrowth = h.growthPerLevel
    ? {
        spirit: Number(h.growthPerLevel.spirit || 0),
        chakra: Number(h.growthPerLevel.chakra || 0),
        might: Number(h.growthPerLevel.might || 0),
        agility: Number(h.growthPerLevel.agility || 0),
        hp: Number(h.growthPerLevel.hp || 0),
      }
    : null;

  // Support legacy/catalog tokens schema where growth is stored flat:
  // hero.growth = { spirit, chakra?, might, agility, hp }
  const schemaTokenGrowth = (h.growth && typeof h.growth === "object" && !h.growth.main)
    ? {
        spirit: Number(h.growth.spirit || 0),
        chakra: Number(h.growth.chakra || 0),
        might: Number(h.growth.might || 0),
        agility: Number(h.growth.agility || 0),
        hp: Number(h.growth.hp || 0),
      }
    : null;

  const defaultMainGrowth = h.isMain
    ? { spirit: 1.2, chakra: 1.2, might: 1.2, agility: 1.2, hp: 0 }
    : { spirit: 0, chakra: 0, might: 0, agility: 0, hp: 0 };

  const growth = h.growth?.main || schemaBGrowth || schemaTokenGrowth || defaultMainGrowth;

  const main = {
    spirit: Math.round(Number(baseMain.spirit || 0) + (lvl - 1) * Number(growth.spirit || 0)),
    chakra: Math.round(Number(baseMain.chakra || 0) + (lvl - 1) * Number(growth.chakra || 0)),
    might: Math.round(Number(baseMain.might || 0) + (lvl - 1) * Number(growth.might || 0)),
    agility: Math.round(Number(baseMain.agility || 0) + (lvl - 1) * Number(growth.agility || 0)),
  };

  // Primary stats based on your definitions:
  // spirit -> physAtk (1:1) and physDef
  // chakra -> stratAtk (1:1) and stratDef
  // agility -> speed (1:1)
  // might -> hp
  const primary = {
    hp: Math.round((Number(basePrimary.hp ?? 0) || 0) + main.might * 10 + (lvl - 1) * Number(growth.hp || 0)),
    physAtk: Math.round((Number(basePrimary.physAtk ?? 0) || 0) + main.spirit * 1),
    physDef: Math.round((Number(basePrimary.physDef ?? 0) || 0) + main.spirit * 1),
    stratAtk: Math.round((Number(basePrimary.stratAtk ?? 0) || 0) + main.chakra * 1),
    stratDef: Math.round((Number(basePrimary.stratDef ?? 0) || 0) + main.chakra * 1),
    speed: Math.round((Number(basePrimary.speed ?? 0) || 0) + main.agility * 1),
    initialFury: Number(basePrimary.initialFury ?? 50) || 50,
  };

  const secondary = h.stats?.secondary || h.base?.secondary || {
    damageRate: 0, accuracyRate: 0, critRate: 0, successRate: 0, punchRate: 0,
    avoidDamageRate: 0, dodgeRate: 0, contraRate: 0, blockRate: 0, sAttackRate: 0, helpRate: 0, healRate: 0,
    // special (placeholders)
    critDamageRate: 0,
    enemyDefDownRate: 0,
    enemyAtkDownRate: 0
  };

  return { main, primary, secondary };
}

function applyBonusesToDerived(derived, bonus) {
  const d = JSON.parse(JSON.stringify(derived));
  const b = bonus || {};

  const dSpirit = Number(b.spirit || 0);
  const dChakra = Number(b.chakra || 0);
  const dMight  = Number(b.might || 0);
  const dAgil   = Number(b.agility || 0);

  // main
  d.main.spirit += dSpirit;
  d.main.chakra += dChakra;
  d.main.might  += dMight;
  d.main.agility += dAgil;

  // primary (Variant B mapping)
  d.primary.hp += Number(b.hp || 0) + dMight * 10;
  d.primary.physAtk += Number(b.physAtk || 0) + dSpirit;
  d.primary.physDef += Number(b.physDef || 0) + dSpirit;
  d.primary.stratAtk += Number(b.stratAtk || 0) + dChakra;
  d.primary.stratDef += Number(b.stratDef || 0) + dChakra;
  d.primary.speed += Number(b.speed || 0) + dAgil;
  d.primary.initialFury += Number(b.initialFury || 0);

  // secondary
  const secKeys = [
    "damageRate","accuracyRate","critRate","successRate","punchRate",
    "avoidDamageRate","dodgeRate","contraRate","blockRate","sAttackRate",
    "helpRate","healRate",
    "critDamageRate","enemyDefDownRate","enemyAtkDownRate",
    "extraRoundRate","chaosAntiControlRate"
  ];
  d.secondary ||= {};
  for (const k of secKeys) {
    if (b[k] != null) d.secondary[k] = Number(d.secondary[k] || 0) + Number(b[k] || 0);
  }

  return d;
}

function ensureGemSlotsOnItem(item) {
  if (!item || typeof item !== "object") return item;
  if (Array.isArray(item.gemSlots) && item.gemSlots.length === 8) return item;
  item.gemSlots = Array.from({ length: 8 }, (_, i) => ({ open: i < 6, gem: null }));
  return item;
}

function normalizeGemRef(g) {
  if (!g) return null;
  if (typeof g === "string") return { tplId: g };
  if (typeof g === "object") return g.tplId ? g : null;
  return null;
}

function applyGemsToDerived(playerId, heroId, derived) {
  const inv = getInventory(playerId);
  const eq = inv.equippedItemsByHero?.[heroId] || {};
  const { map } = getItemsCatalog();

  const clothesSlots = ["weapon","armor","head","cloak","belt","shoes"];

  const pctMain = { spirit: 0, chakra: 0, might: 0, agility: 0 };
  const pctSec = { accuracyRate: 0, dodgeRate: 0, critRate: 0, blockRate: 0, contraRate: 0, sAttackRate: 0 };
  let pctFury = 0;

  for (const s of clothesSlots) {
    const it = eq?.[s];
    if (!it) continue;
    ensureGemSlotsOnItem(it);
    for (const slot of it.gemSlots || []) {
      if (!slot?.open) continue;
      const gref = normalizeGemRef(slot.gem);
      if (!gref) continue;
      const tpl = map.get(String(gref.tplId || ""));
      if (!tpl || String(tpl.type) !== "gem") continue;
      const target = String(tpl.gemTarget || "");
      const pct = Number(tpl.gemPct || 0);
      if (!pct || !target) continue;

      if (target in pctMain) pctMain[target] += pct;
      else if (target === "initialFury") pctFury += pct;
      else if (target in pctSec) pctSec[target] += pct;
    }
  }

  const d = JSON.parse(JSON.stringify(derived));
  const baseMain = { ...d.main };

  const addMain = (k) => {
    const pct = Number(pctMain[k] || 0);
    if (!pct) return 0;
    return Math.round(Number(baseMain[k] || 0) * pct / 100);
  };

  const dSpirit = addMain("spirit");
  const dChakra = addMain("chakra");
  const dMight  = addMain("might");
  const dAgil   = addMain("agility");

  d.main.spirit += dSpirit;
  d.main.chakra += dChakra;
  d.main.might  += dMight;
  d.main.agility += dAgil;

  d.primary.hp += dMight * 10;
  d.primary.physAtk += dSpirit;
  d.primary.physDef += dSpirit;
  d.primary.stratAtk += dChakra;
  d.primary.stratDef += dChakra;
  d.primary.speed += dAgil;

  const cap90 = new Set(["critRate","blockRate","contraRate","sAttackRate"]);
  d.secondary ||= {};
  for (const [k, pct] of Object.entries(pctSec)) {
    if (!pct) continue;
    d.secondary[k] = Number(d.secondary[k] || 0) + Number(pct || 0);
    if (cap90.has(k)) d.secondary[k] = Math.min(90, Number(d.secondary[k] || 0));
  }

  if (pctFury) {
    const baseF = Number(d.primary.initialFury ?? 50) || 50;
    d.primary.initialFury = baseF + Math.round(baseF * pctFury / 100);
  }

  return d;
}

function calcPowerFromDerived(derived) {
  const p = derived?.primary || {};
  const m = derived?.main || {};
  const power =
    (Number(m.spirit || 0) + Number(m.chakra || 0) + Number(m.might || 0) + Number(m.agility || 0)) * 0.8 +
    Number(p.hp || 0) / 10 +
    (Number(p.physAtk || 0) + Number(p.stratAtk || 0)) * 0.6 +
    (Number(p.physDef || 0) + Number(p.stratDef || 0)) * 0.4 +
    Number(p.speed || 0) * 0.2;
  return Math.max(0, Math.round(power));
}



const SKILL_BOOK_PAGES = [
  {
    id: "rin",
    name: "Рин",
    nodes: [
      { level: 1, kind: "stat", cost: 100, effects: { assaultDamageRate: 5, flatMain: { chakra: 20, spirit: 20 } }, text: ["РА штурмовикам +0,05", "Чакра/СД ГГ +20"] },
      { level: 2, kind: "skill", cost: 100, skillId: "gg_rin_2", text: ["Атакует танка с силой 170%", "уменьшает защиту врага на 30% на 4 раунда"] },
      { level: 3, kind: "stat", cost: 100, effects: { assaultDamageRate: 5, flatMain: { chakra: 20, spirit: 20 } }, text: ["РА штурмовикам +0,05", "Чакра/СД ГГ +20"] },
      { level: 4, kind: "stat", cost: 150, effects: { assaultDamageRate: 5, flatMain: { chakra: 20, spirit: 20 } }, text: ["РА штурмовикам +0,05", "Чакра/СД ГГ +20"] },
      { level: 5, kind: "stat", cost: 250, effects: { tankHpPct: 20, flatMain: { chakra: 20, spirit: 20 } }, text: ["ХП танка +20%", "Чакра/СД ГГ +20"] },
      { level: 6, kind: "skill", cost: 350, skillId: "gg_rin_6", text: ["Атакует танка с силой 145%", "100% шанс контроля"] },
      { level: 7, kind: "stat", cost: 350, effects: { tankHpPct: 20, growthMain: { spirit: 0.2 } }, text: ["ХП танка +20%", "Прирост СД ГГ +0,2"] },
      { level: 8, kind: "stat", cost: 400, effects: { tankHpPct: 20, growthMain: { chakra: 0.2 } }, text: ["ХП танка +20%", "Прирост чакры ГГ +0,2"] },
      { level: 9, kind: "stat", cost: 450, effects: { tankAvoidDamageRate: 5, growthMain: { hp: 0.2 } }, text: ["РЗ танка +0,05", "Прирост ХП ГГ +0,2"] },
      { level: 10, kind: "stat", cost: 500, effects: { growthMain: { agility: 0.2 } }, text: ["Прирост ловкости ГГ +0,2"] },
    ],
  },
  {
    id: "jin",
    name: "Джин",
    nodes: [
      { level: 1, kind: "stat", cost: 1000, effects: { supportSpeedPct: 5, growthMain: { spirit: 0.2 } }, text: ["Скорость саппорта +0,05", "Прирост СД ГГ +0,2"] },
      { level: 2, kind: "stat", cost: 1400, effects: { supportSpeedPct: 5, growthMain: { chakra: 0.2 } }, text: ["Скорость саппорта +0,05", "Прирост чакры ГГ +0,2"] },
      { level: 3, kind: "stat", cost: 1800, effects: { supportSpeedPct: 5, growthMain: { hp: 0.2 } }, text: ["Скорость саппорта +0,05", "Прирост ХП ГГ +0,2"] },
      { level: 4, kind: "skill", cost: 2200, skillId: "gg_jin_4", text: ["Атакует танка с силой 140%", "увеличивает уворот штурмовиков на 3 раунда"] },
      { level: 5, kind: "stat", cost: 2600, effects: { tankHealRate: 20, growthMain: { agility: 0.2 } }, text: ["Рейтинг хила танка +0,2", "Прирост ловкости ГГ +0,2"] },
      { level: 6, kind: "stat", cost: 3000, effects: { tankHealRate: 20, growthMain: { spirit: 0.2 } }, text: ["Рейтинг хила танка +0,2", "Прирост СД ГГ +0,2"] },
      { level: 7, kind: "skill", cost: 3400, skillId: "gg_jin_7", text: ["Атакует танка с силой 185%", "уменьшает эффект хила врага на 4 раунда"] },
      { level: 8, kind: "stat", cost: 3800, effects: { growthMain: { chakra: 0.2 } }, text: ["Прирост чакры ГГ +0,2"] },
      { level: 9, kind: "stat", cost: 4400, effects: { growthMain: { hp: 0.2 } }, text: ["Прирост ХП ГГ +0,2"] },
      { level: 10, kind: "stat", cost: 5000, effects: { growthMain: { agility: 0.2 } }, text: ["Прирост ловкости ГГ +0,2"] },
    ],
  },
  {
    id: "zen",
    name: "Зэн",
    nodes: [
      { level: 1, kind: "skill", cost: 6000, skillId: "gg_zen_1", text: ["Атакует танка с силой 140%"] },
      { level: 2, kind: "stat", cost: 7000, effects: { growthMain: { spirit: 0.2 } }, text: ["Прирост СД ГГ +0,2"] },
      { level: 3, kind: "stat", cost: 8000, effects: { growthMain: { chakra: 0.2 } }, text: ["Прирост чакры ГГ +0,2"] },
      { level: 4, kind: "stat", cost: 9000, effects: { growthMain: { might: 0.2 } }, text: ["Прирост силы ГГ +0,2"] },
      { level: 5, kind: "stat", cost: 10000, effects: { growthMain: { agility: 0.2 } }, text: ["Прирост ловкости ГГ +0,2"] },
      { level: 6, kind: "skill", cost: 11000, skillId: "gg_zen_6", text: ["Атакует штурмовиков с силой 120%", "увеличивает себе помощь на 100 на 1 раунд"] },
      { level: 7, kind: "stat", cost: 12000, effects: { growthMain: { spirit: 0.2 } }, text: ["Прирост СД ГГ +0,2"] },
      { level: 8, kind: "stat", cost: 13000, effects: { growthMain: { chakra: 0.2 } }, text: ["Прирост чакры ГГ +0,2"] },
      { level: 9, kind: "stat", cost: 14000, effects: { growthMain: { might: 0.2 } }, text: ["Прирост силы ГГ +0,2"] },
      { level: 10, kind: "stat", cost: 15000, effects: { growthMain: { agility: 0.2 } }, text: ["Прирост ловкости ГГ +0,2"] },
      { level: 11, kind: "skill", cost: 16000, skillId: "gg_zen_11", text: ["Атакует штурмовиков с силой 120%", "увеличивает экстру на 100% на 1 раунд"] },
      { level: 12, kind: "stat", cost: 17000, effects: { growthMain: { spirit: 0.2 } }, text: ["Прирост СД ГГ +0,2"] },
      { level: 13, kind: "stat", cost: 18000, effects: { growthMain: { chakra: 0.2 } }, text: ["Прирост чакры ГГ +0,2"] },
      { level: 14, kind: "stat", cost: 19000, effects: { growthMain: { might: 0.2 } }, text: ["Прирост силы ГГ +0,2"] },
      { level: 15, kind: "stat", cost: 20000, effects: { growthMain: { agility: 0.2 } }, text: ["Прирост ловкости ГГ +0,2"] },
    ],
  },
  {
    id: "zai",
    name: "Заи",
    nodes: [
      { level: 1, kind: "skill", cost: 22000, skillId: "gg_zai_1", text: ["Атакует танка с силой 170%", "увеличивает атаку штурмовиков на 15% на 3 раунда"] },
      { level: 2, kind: "stat", cost: 24000, effects: { growthMain: { spirit: 0.2 } }, text: ["Прирост СД ГГ +0,2"] },
      { level: 3, kind: "stat", cost: 26000, effects: { growthMain: { chakra: 0.2 } }, text: ["Прирост чакры ГГ +0,2"] },
      { level: 4, kind: "stat", cost: 28000, effects: { growthMain: { might: 0.2 } }, text: ["Прирост силы ГГ +0,2"] },
      { level: 5, kind: "stat", cost: 30000, effects: { growthMain: { agility: 0.2 } }, text: ["Прирост ловкости ГГ +0,2"] },
      { level: 6, kind: "skill", cost: 30000, skillId: "gg_zai_6", text: ["Атакует танка с силой 220%", "уменьшает защиту на 30% на 4 раунда"] },
      { level: 7, kind: "stat", cost: 32500, effects: { growthMain: { spirit: 0.2 } }, text: ["Прирост СД ГГ +0,2"] },
      { level: 8, kind: "stat", cost: 35000, effects: { growthMain: { chakra: 0.2 } }, text: ["Прирост чакры ГГ +0,2"] },
      { level: 9, kind: "stat", cost: 37500, effects: { growthMain: { might: 0.2 } }, text: ["Прирост силы ГГ +0,2"] },
      { level: 10, kind: "stat", cost: 40000, effects: { growthMain: { agility: 0.2 } }, text: ["Прирост ловкости ГГ +0,2"] },
      { level: 11, kind: "skill", cost: 50000, skillId: "gg_zai_11", text: ["Атакует танка с силой 250%", "уменьшает рейтинг хила на 4 раунда"] },
      { level: 12, kind: "stat", cost: 55000, effects: { growthMain: { spirit: 0.2 } }, text: ["Прирост СД ГГ +0,2"] },
      { level: 13, kind: "stat", cost: 60000, effects: { growthMain: { chakra: 0.2 } }, text: ["Прирост чакры ГГ +0,2"] },
      { level: 14, kind: "stat", cost: 65000, effects: { growthMain: { might: 0.2 } }, text: ["Прирост силы ГГ +0,2"] },
      { level: 15, kind: "stat", cost: 70000, effects: { growthMain: { agility: 0.2 } }, text: ["Прирост ловкости ГГ +0,2"] },
      { level: 16, kind: "skill", cost: 75000, skillId: "gg_zai_16", text: ["Атакует штурмовиков с силой 210%"] },
      { level: 17, kind: "stat", cost: 80000, effects: { growthMain: { spirit: 0.2 } }, text: ["Прирост СД ГГ +0,2"] },
      { level: 18, kind: "stat", cost: 85000, effects: { growthMain: { chakra: 0.2 } }, text: ["Прирост чакры ГГ +0,2"] },
      { level: 19, kind: "stat", cost: 90000, effects: { growthMain: { might: 0.2 } }, text: ["Прирост силы ГГ +0,2"] },
      { level: 20, kind: "stat", cost: 100000, effects: { growthMain: { agility: 0.2 } }, text: ["Прирост ловкости ГГ +0,2"] },
    ],
  },
  {
    id: "fire",
    name: "Огонь",
    nodes: [
      { level: 1, kind: "skill", cost: 200000, skillId: "gg_fire_1", text: ["Атакует всех врагов с силой 158%"] },
      { level: 2, kind: "stat", cost: 160000, effects: { growthMain: { spirit: 0.3 } }, text: ["Прирост СД ГГ +0,3"] },
      { level: 3, kind: "stat", cost: 160000, effects: { growthMain: { chakra: 0.3 } }, text: ["Прирост чакры ГГ +0,3"] },
      { level: 4, kind: "stat", cost: 160000, effects: { growthMain: { might: 0.3 } }, text: ["Прирост силы ГГ +0,3"] },
      { level: 5, kind: "stat", cost: 160000, effects: { growthMain: { agility: 0.3 } }, text: ["Прирост ловкости ГГ +0,3"] },
      { level: 6, kind: "skill", cost: 400000, skillId: "gg_fire_6", text: ["Атакует танка с силой 260%", "увеличивает свою защиту на 500% на 1 раунд"] },
      { level: 7, kind: "stat", cost: 320000, effects: { growthMain: { spirit: 0.4 } }, text: ["Прирост СД ГГ +0,4"] },
      { level: 8, kind: "stat", cost: 320000, effects: { growthMain: { chakra: 0.4 } }, text: ["Прирост чакры ГГ +0,4"] },
      { level: 9, kind: "stat", cost: 320000, effects: { growthMain: { might: 0.4 } }, text: ["Прирост силы ГГ +0,4"] },
      { level: 10, kind: "stat", cost: 320000, effects: { growthMain: { agility: 0.4 } }, text: ["Прирост ловкости ГГ +0,4"] },
      { level: 11, kind: "skill", cost: 800000, skillId: "gg_fire_11", text: ["Атакует штурмовика силой 170%", "увеличивает экстру на 100% на 3 раунда"] },
      { level: 12, kind: "stat", cost: 640000, effects: { growthMain: { spirit: 0.6 } }, text: ["Прирост СД ГГ +0,6"] },
      { level: 13, kind: "stat", cost: 640000, effects: { growthMain: { chakra: 0.6 } }, text: ["Прирост чакры ГГ +0,6"] },
      { level: 14, kind: "stat", cost: 640000, effects: { growthMain: { might: 0.6 } }, text: ["Прирост силы ГГ +0,6"] },
      { level: 15, kind: "stat", cost: 640000, effects: { growthMain: { agility: 0.6 } }, text: ["Прирост ловкости ГГ +0,6"] },
      { level: 16, kind: "skill", cost: 1600000, skillId: "gg_fire_16", text: ["Атакует танка с силой 290%", "увеличивает атаку штурмовиков на 15%"] },
      { level: 17, kind: "stat", cost: 1280000, effects: { growthMain: { spirit: 0.8 } }, text: ["Прирост СД ГГ +0,8"] },
      { level: 18, kind: "stat", cost: 1280000, effects: { growthMain: { chakra: 0.8 } }, text: ["Прирост чакры ГГ +0,8"] },
      { level: 19, kind: "stat", cost: 1280000, effects: { growthMain: { might: 0.8 } }, text: ["Прирост силы ГГ +0,8"] },
      { level: 20, kind: "stat", cost: 1280000, effects: { growthMain: { agility: 0.8 } }, text: ["Прирост ловкости ГГ +0,8"] },
    ],
  },
  {
    id: "earth",
    name: "Земля",
    nodes: [
      { level: 1, kind: "stat", cost: 320000, awakenCost: 30000, effects: { growthMain: { spirit: 0.4 } }, text: ["Прирост СД ГГ +0,4"] },
      { level: 2, kind: "stat", cost: 320000, awakenCost: 30000, effects: { growthMain: { chakra: 0.4 } }, text: ["Прирост чакры ГГ +0,4"] },
      { level: 3, kind: "stat", cost: 320000, awakenCost: 30000, effects: { growthMain: { might: 0.4 } }, text: ["Прирост силы ГГ +0,4"] },
      { level: 4, kind: "stat", cost: 320000, awakenCost: 30000, effects: { growthMain: { agility: 0.4 } }, text: ["Прирост ловкости ГГ +0,4"] },
      { level: 5, kind: "skill", cost: 800000, awakenCost: 60000, skillId: "gg_earth_5", text: ["Запретный навык - Песня Дракона Огня"] },
      { level: 6, kind: "stat", cost: 320000, awakenCost: 40000, effects: { growthMain: { spirit: 0.6 } }, text: ["Прирост СД ГГ +0,6"] },
      { level: 7, kind: "stat", cost: 320000, awakenCost: 40000, effects: { growthMain: { chakra: 0.6 } }, text: ["Прирост чакры ГГ +0,6"] },
      { level: 8, kind: "stat", cost: 320000, awakenCost: 40000, effects: { growthMain: { might: 0.6 } }, text: ["Прирост силы ГГ +0,6"] },
      { level: 9, kind: "stat", cost: 320000, awakenCost: 40000, effects: { growthMain: { agility: 0.6 } }, text: ["Прирост ловкости ГГ +0,6"] },
      { level: 10, kind: "skill", cost: 800000, awakenCost: 80000, skillId: "gg_earth_10", text: ["Искусство Мудреца - Воплощение Древа"] },
      { level: 11, kind: "stat", cost: 320000, awakenCost: 50000, effects: { growthMain: { spirit: 0.8 } }, text: ["Прирост СД ГГ +0,8"] },
      { level: 12, kind: "stat", cost: 320000, awakenCost: 50000, effects: { growthMain: { chakra: 0.8 } }, text: ["Прирост чакры ГГ +0,8"] },
      { level: 13, kind: "stat", cost: 320000, awakenCost: 50000, effects: { growthMain: { might: 0.8 } }, text: ["Прирост силы ГГ +0,8"] },
      { level: 14, kind: "stat", cost: 320000, awakenCost: 50000, effects: { growthMain: { agility: 0.8 } }, text: ["Прирост ловкости ГГ +0,8"] },
    ],
  },
  {
    id: "heaven",
    name: "Небеса",
    nodes: [
      { level: 1, kind: "stat", cost: 640000, awakenCost: 60000, effects: { growthMain: { spirit: 1.0 } }, text: ["Прирост СД ГГ +1"] },
      { level: 2, kind: "stat", cost: 640000, awakenCost: 60000, effects: { growthMain: { chakra: 1.0 } }, text: ["Прирост чакры ГГ +1"] },
      { level: 3, kind: "stat", cost: 640000, awakenCost: 60000, effects: { growthMain: { might: 1.0 } }, text: ["Прирост силы ГГ +1"] },
      { level: 4, kind: "stat", cost: 640000, awakenCost: 60000, effects: { growthMain: { agility: 1.0 } }, text: ["Прирост ловкости ГГ +1"] },
      { level: 5, kind: "skill", cost: 1600000, awakenCost: 100000, skillId: "gg_heaven_5", text: ["Воля Огня"] },
      { level: 6, kind: "stat", cost: 640000, awakenCost: 60000, effects: { growthMain: { spirit: 1.2 } }, text: ["Прирост СД ГГ +1,2"] },
      { level: 7, kind: "stat", cost: 640000, awakenCost: 60000, effects: { growthMain: { chakra: 1.2 } }, text: ["Прирост чакры ГГ +1,2"] },
      { level: 8, kind: "stat", cost: 640000, awakenCost: 60000, effects: { growthMain: { might: 1.2 } }, text: ["Прирост силы ГГ +1,2"] },
      { level: 9, kind: "stat", cost: 640000, awakenCost: 60000, effects: { growthMain: { agility: 1.2 } }, text: ["Прирост ловкости ГГ +1,2"] },
      { level: 10, kind: "skill", cost: 1600000, awakenCost: 120000, skillId: "gg_heaven_10", text: ["Шесть Путей - Адский паразит"] },
      { level: 11, kind: "stat", cost: 640000, awakenCost: 80000, effects: { growthMain: { spirit: 1.4 } }, text: ["Прирост СД ГГ +1,4"] },
      { level: 12, kind: "stat", cost: 640000, awakenCost: 80000, effects: { growthMain: { chakra: 1.4 } }, text: ["Прирост чакры ГГ +1,4"] },
      { level: 13, kind: "stat", cost: 640000, awakenCost: 80000, effects: { growthMain: { might: 1.4 } }, text: ["Прирост силы ГГ +1,4"] },
      { level: 14, kind: "stat", cost: 640000, awakenCost: 80000, effects: { growthMain: { agility: 1.4 } }, text: ["Прирост ловкости ГГ +1,4"] },
    ],
  },
  {
    id: "void",
    name: "Пустота",
    nodes: [
      { level: 1, kind: "stat", cost: 640000, awakenCost: 80000, effects: { growthMain: { spirit: 1.6 } }, text: ["Прирост СД ГГ +1,6"] },
      { level: 2, kind: "stat", cost: 640000, awakenCost: 80000, effects: { growthMain: { chakra: 1.6 } }, text: ["Прирост чакры ГГ +1,6"] },
      { level: 3, kind: "stat", cost: 640000, awakenCost: 80000, effects: { growthMain: { might: 1.6 } }, text: ["Прирост силы ГГ +1,6"] },
      { level: 4, kind: "stat", cost: 640000, awakenCost: 80000, effects: { growthMain: { agility: 1.6 } }, text: ["Прирост ловкости ГГ +1,6"] },
      { level: 5, kind: "skill", cost: 1600000, awakenCost: 160000, skillId: "gg_void_5", text: ["Одеяние Огненных Зверей - Молния"] },
      { level: 6, kind: "stat", cost: 640000, awakenCost: 80000, effects: { growthMain: { spirit: 1.8 } }, text: ["Прирост СД ГГ +1,8"] },
      { level: 7, kind: "stat", cost: 640000, awakenCost: 80000, effects: { growthMain: { chakra: 1.8 } }, text: ["Прирост чакры ГГ +1,8"] },
      { level: 8, kind: "stat", cost: 640000, awakenCost: 80000, effects: { growthMain: { might: 1.8 } }, text: ["Прирост силы ГГ +1,8"] },
      { level: 9, kind: "stat", cost: 640000, awakenCost: 80000, effects: { growthMain: { agility: 1.8 } }, text: ["Прирост ловкости ГГ +1,8"] },
      { level: 10, kind: "skill", cost: 1600000, awakenCost: 200000, skillId: "gg_void_10", text: ["Свиток Конца"] },
      { level: 11, kind: "stat", cost: 640000, awakenCost: 100000, effects: { growthMain: { spirit: 2.0 } }, text: ["Прирост СД ГГ +2"] },
      { level: 12, kind: "stat", cost: 640000, awakenCost: 100000, effects: { growthMain: { chakra: 2.0 } }, text: ["Прирост чакры ГГ +2"] },
      { level: 13, kind: "stat", cost: 640000, awakenCost: 100000, effects: { growthMain: { might: 2.0 } }, text: ["Прирост силы ГГ +2"] },
      { level: 14, kind: "stat", cost: 640000, awakenCost: 100000, effects: { growthMain: { agility: 2.0 } }, text: ["Прирост ловкости ГГ +2"] },
    ],
  },
];

const SKILL_BOOK_SKILLS = {
  gg_rin_2: { id: "gg_rin_2", name: "Рин • Удар разрушения", desc: "Атакует танка с силой 170%, уменьшает защиту врага на 30% на 4 раунда." },
  gg_rin_6: { id: "gg_rin_6", name: "Рин • Контроль печати", desc: "Атакует танка с силой 145%, с шансом 100% берёт в контроль." },
  gg_jin_4: { id: "gg_jin_4", name: "Джин • Танец ветра", desc: "Атакует танка с силой 140%, увеличивает уворот штурмовиков на 3 раунда." },
  gg_jin_7: { id: "gg_jin_7", name: "Джин • Рассечение потока", desc: "Атакует танка с силой 185%, уменьшает эффект хила врага на 4 раунда." },
  gg_zen_1: { id: "gg_zen_1", name: "Зэн • Первый удар", desc: "Атакует танка с силой 140%." },
  gg_zen_6: { id: "gg_zen_6", name: "Зэн • Помощь молнии", desc: "Атакует штурмовиков с силой 120%, увеличивает себе помощь на 100 на 1 раунд." },
  gg_zen_11: { id: "gg_zen_11", name: "Зэн • Экстра импульс", desc: "Атакует штурмовиков с силой 120%, увеличивает экстру на 100% на 1 раунд." },
  gg_zai_1: { id: "gg_zai_1", name: "Заи • Боевой приказ", desc: "Атакует танка с силой 170%, увеличивает атаку штурмовиков на 15% на 3 раунда." },
  gg_zai_6: { id: "gg_zai_6", name: "Заи • Пробитие защиты", desc: "Атакует танка с силой 220%, уменьшает защиту на 30% на 4 раунда." },
  gg_zai_11: { id: "gg_zai_11", name: "Заи • Срыв лечения", desc: "Атакует танка с силой 250%, уменьшает рейтинг хила на 4 раунда." },
  gg_zai_16: { id: "gg_zai_16", name: "Заи • Удар по штурмовикам", desc: "Атакует штурмовиков с силой 210%." },
  gg_fire_1: { id: "gg_fire_1", name: "Огонь • Пламя по площади", desc: "Атакует всех врагов с силой 158%." },
  gg_fire_6: { id: "gg_fire_6", name: "Огонь • Железная защита", desc: "Атакует танка с силой 260%, увеличивает свою защиту на 500% на 1 раунд." },
  gg_fire_11: { id: "gg_fire_11", name: "Огонь • Печать экстра", desc: "Атакует штурмовика с силой 170%, увеличивает экстру на 100% на 3 раунда." },
  gg_fire_16: { id: "gg_fire_16", name: "Огонь • Приказ штурма", desc: "Атакует танка с силой 290%, увеличивает атаку штурмовиков на 15%." },
  gg_earth_5: { id: "gg_earth_5", name: "Запретный Навык - Песня Дракона Огня", desc: "Атакует всех врагов, сила атаки 280%. 70% шанс Коллапса на авангарда на 2 раунда. Увеличивает рейтинг уворота союзников на 100% на 1 раунд. Снижает защиту авангарда на 30% на 2 раунда. Увеличивает урон помощников на 30% и скорость на 25% на 2 раунда. Накладывает Дот с силой 140% на 1 раунд." },
  gg_earth_10: { id: "gg_earth_10", name: "Искусство Мудреца - Воплощение Древа", desc: "Атакует всех врагов, сила атаки 280%. 70% шанс Коллапса на штурмовиков на 2 раунда. Снижает ярость противника на 50 и рейтинг защиты штурмовиков на 30% на 2 раунда. Увеличивает атаку авангарда на 25% и скорость на 50% на 2 раунда, снимает негативные эффекты с него. Восстанавливает всем союзникам хп в размере 160% от атаки." },
  gg_heaven_5: { id: "gg_heaven_5", name: "Воля Огня", desc: "Атакует всех врагов, сила атаки 280%. 60% шанс Коллапса на 2 раунда. Снижает помощникам защиту на 30% и скорость на 25% на 2 раунда. Увеличивает атаку штурмовиков на 30% на 2 раунда. Очищает союзников от дебаффов. Восстанавливает 50 ярости штурмовикам." },
  gg_heaven_10: { id: "gg_heaven_10", name: "Шесть путей - Адский Паразит", desc: "Атакует всех врагов, сила атаки 300%. Накладывает метку смерти на 2 случайных противников. Снижает рейтинг защиты авангарда на 50% и рейтинг пробития штурмовиков на 100% на 2 раунда. Увеличивает штурмовикам шанс наложения контроля на 25% и помощникам скорость на 20% на 2 раунда. Три случайных союзника получат защиту от метки смерти." },
  gg_void_5: { id: "gg_void_5", name: "Одеяние Огненных Зверей - Молния", desc: "Атакует всех врагов, сила атаки 300%. Увеличивает союзникам скорость на 20% на 1 раунд, штурмовикам шанс контроля на 25% и рейтинг урона на 25% на 2 раунда. Снижает штурмовикам противника рейтинг урона на 30% и рейтинг помощи на 50% на 2 раунда. Накладывает запрет на восстановление хп." },
  gg_void_10: { id: "gg_void_10", name: "Свиток Конца", desc: "Атакует всех врагов, сила атаки 300%. Накладывает на союзников щит ярости (+30% дополнительного урона). Снижает помощникам противника шанс контроля на 25% и рейтинг урона на 25% на 2 раунда. Увеличивает помощникам атаку на 30% на 2 раунда и себе рейтинг пробития на 100% на 1 раунд, накладывает супер уворот на 3 случайных союзников на 1 раунд." },
};

function getSkillBookPageById(pageId) {
  return SKILL_BOOK_PAGES.find((p) => p.id === pageId) || null;
}

function collectUnlockedSkillBookSkills(state) {
  const sb = state && typeof state === "object" ? state : {};
  const purchased = sb.purchased && typeof sb.purchased === "object" ? sb.purchased : {};
  const out = [];
  const seen = new Set();
  for (const page of SKILL_BOOK_PAGES) {
    const bought = new Set(Array.isArray(purchased[page.id]) ? purchased[page.id] : []);
    for (const node of page.nodes) {
      if (!bought.has(node.level) || !node.skillId || !SKILL_BOOK_SKILLS[node.skillId]) continue;
      if (seen.has(node.skillId)) continue;
      seen.add(node.skillId);
      out.push(SKILL_BOOK_SKILLS[node.skillId]);
    }
  }
  return out;
}

function createDefaultSkillBookState() {
  return {
    currentPageId: SKILL_BOOK_PAGES[0].id,
    skillPoints: 0,
    awakenedPoints: 0,
    purchased: {},
    equippedSkills: [],
    dungeonRuns: 0,
    lastDungeonAt: 0,
  };
}

function normalizeSkillBookState(raw) {
  const base = createDefaultSkillBookState();
  const out = { ...base, ...(raw && typeof raw === "object" ? raw : {}) };
  out.currentPageId = getSkillBookPageById(out.currentPageId)?.id || SKILL_BOOK_PAGES[0].id;
  out.skillPoints = Math.max(0, Math.floor(Number(out.skillPoints || 0)));
  out.awakenedPoints = Math.max(0, Math.floor(Number(out.awakenedPoints || 0)));
  out.dungeonRuns = Math.max(0, Math.floor(Number(out.dungeonRuns || 0)));
  out.lastDungeonAt = Math.max(0, Math.floor(Number(out.lastDungeonAt || 0)));
  out.purchased = out.purchased && typeof out.purchased === "object" ? out.purchased : {};
  for (const page of SKILL_BOOK_PAGES) {
    const src = out.purchased[page.id];
    const norm = Array.isArray(src) ? src : [];
    out.purchased[page.id] = Array.from(new Set(norm.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))).sort((a, b) => a - b);
  }
  const unlockedSkillIds = collectUnlockedSkillBookSkills(out).map((x) => x.id);
  const unlockedSet = new Set(unlockedSkillIds);
  const eqSrc = Array.isArray(out.equippedSkills) ? out.equippedSkills : [];
  const eq = [];
  for (const id of eqSrc) {
    const sid = String(id || "");
    if (!sid || !unlockedSet.has(sid) || eq.includes(sid)) continue;
    if (eq.length >= 8) break;
    eq.push(sid);
  }
  if (!eq.length && unlockedSkillIds.length) eq.push(...unlockedSkillIds.slice(0, 8));
  out.equippedSkills = eq;
  const currentIndex = Math.max(0, SKILL_BOOK_PAGES.findIndex((p) => p.id === out.currentPageId));
  for (let i = 0; i < SKILL_BOOK_PAGES.length; i++) {
    const page = SKILL_BOOK_PAGES[i];
    const bought = new Set(out.purchased[page.id] || []);
    const complete = page.nodes.every((n) => bought.has(n.level));
    if (!complete) {
      out.currentPageId = page.id;
      return out;
    }
  }
  out.currentPageId = SKILL_BOOK_PAGES[SKILL_BOOK_PAGES.length - 1].id;
  return out;
}

function getPlayerSkillBook(playerId) {
  const db = readJSON("players.json", { players: [] });
  const arr = asArray(db.players);
  const idx = arr.findIndex((x) => x && x.id === playerId);
  if (idx === -1) return null;
  const p = arr[idx];
  const skillBook = normalizeSkillBookState(p.skillBook);
  if (JSON.stringify(skillBook) !== JSON.stringify(p.skillBook || {})) {
    p.skillBook = skillBook;
    writeJSON("players.json", { players: arr });
  }
  return skillBook;
}

function savePlayerSkillBook(playerId, skillBook) {
  const db = readJSON("players.json", { players: [] });
  const arr = asArray(db.players);
  const idx = arr.findIndex((x) => x && x.id === playerId);
  if (idx === -1) return null;
  const normalized = normalizeSkillBookState(skillBook);
  arr[idx].skillBook = normalized;
  writeJSON("players.json", { players: arr });
  return normalized;
}

function getSkillBookProgressView(playerId) {
  const state = normalizeSkillBookState(getPlayerSkillBook(playerId) || {});
  const currentIndex = Math.max(0, SKILL_BOOK_PAGES.findIndex((p) => p.id === state.currentPageId));
  const pages = SKILL_BOOK_PAGES.map((page, idx) => {
    const bought = new Set(state.purchased[page.id] || []);
    const complete = page.nodes.every((n) => bought.has(n.level));
    return {
      id: page.id,
      name: page.name,
      index: idx,
      unlocked: idx <= currentIndex,
      complete,
      purchasedLevels: Array.from(bought),
      nodes: page.nodes,
    };
  });
  return {
    currentPageId: state.currentPageId,
    skillPoints: state.skillPoints,
    awakenedPoints: state.awakenedPoints,
    dungeonRuns: state.dungeonRuns,
    lastDungeonAt: state.lastDungeonAt,
    equippedSkills: Array.isArray(state.equippedSkills) ? state.equippedSkills.slice(0, 8) : [],
    allUnlockedSkills: collectUnlockedSkillBookSkills(state),
    pages,
  };
}

function getSkillBookBonuses(playerId) {
  const state = getPlayerSkillBook(playerId);
  const bonus = {
    mainFlat: { spirit: 0, chakra: 0, might: 0, agility: 0, hp: 0 },
    mainGrowth: { spirit: 0, chakra: 0, might: 0, agility: 0, hp: 0 },
    role: {
      assault: { damageRate: 0 },
      tank: { hpPct: 0, avoidDamageRate: 0, healRate: 0 },
      helper: { speedPct: 0 },
    },
    skills: [],
  };
  if (!state) return bonus;

  for (const page of SKILL_BOOK_PAGES) {
    const bought = new Set(state.purchased[page.id] || []);
    for (const node of page.nodes) {
      if (!bought.has(node.level)) continue;
      const eff = node.effects || {};
      if (eff.flatMain) {
        for (const k of Object.keys(eff.flatMain)) bonus.mainFlat[k] = Number(bonus.mainFlat[k] || 0) + Number(eff.flatMain[k] || 0);
      }
      if (eff.growthMain) {
        for (const k of Object.keys(eff.growthMain)) bonus.mainGrowth[k] = Number(bonus.mainGrowth[k] || 0) + Number(eff.growthMain[k] || 0);
      }
      if (eff.assaultDamageRate) bonus.role.assault.damageRate += Number(eff.assaultDamageRate || 0);
      if (eff.tankHpPct) bonus.role.tank.hpPct += Number(eff.tankHpPct || 0);
      if (eff.tankAvoidDamageRate) bonus.role.tank.avoidDamageRate += Number(eff.tankAvoidDamageRate || 0);
      if (eff.tankHealRate) bonus.role.tank.healRate += Number(eff.tankHealRate || 0);
      if (eff.supportSpeedPct) bonus.role.helper.speedPct += Number(eff.supportSpeedPct || 0);
      if (node.skillId && SKILL_BOOK_SKILLS[node.skillId]) bonus.skills.push(SKILL_BOOK_SKILLS[node.skillId]);
    }
  }
  return bonus;
}

function applySkillBookBonuses(playerId, hero, derived) {
  const d = JSON.parse(JSON.stringify(derived || {}));
  const role = normalizeRole(hero?.role);
  const sb = getSkillBookBonuses(playerId);
  d.main ||= { spirit: 0, chakra: 0, might: 0, agility: 0 };
  d.primary ||= { hp: 0, physAtk: 0, physDef: 0, stratAtk: 0, stratDef: 0, speed: 0, initialFury: 50 };
  d.secondary ||= {};

  if (hero?.isMain) {
    const lvlBonus = Math.max(0, Number(hero?.level || 1) - 1);
    const dSpirit = Number(sb.mainFlat.spirit || 0) + lvlBonus * Number(sb.mainGrowth.spirit || 0);
    const dChakra = Number(sb.mainFlat.chakra || 0) + lvlBonus * Number(sb.mainGrowth.chakra || 0);
    const dMight = Number(sb.mainFlat.might || 0) + lvlBonus * Number(sb.mainGrowth.might || 0);
    const dAgility = Number(sb.mainFlat.agility || 0) + lvlBonus * Number(sb.mainGrowth.agility || 0);
    const dHp = Number(sb.mainFlat.hp || 0) + lvlBonus * Number(sb.mainGrowth.hp || 0);
    d.main.spirit += dSpirit;
    d.main.chakra += dChakra;
    d.main.might += dMight;
    d.main.agility += dAgility;
    d.primary.hp += dHp + dMight * 10;
    d.primary.physAtk += dSpirit;
    d.primary.physDef += dSpirit;
    d.primary.stratAtk += dChakra;
    d.primary.stratDef += dChakra;
    d.primary.speed += dAgility;
  }

  if (role === "assault") {
    d.secondary.damageRate = Number(d.secondary.damageRate || 0) + Number(sb.role.assault.damageRate || 0);
  }
  if (role === "tank") {
    const hpPct = Number(sb.role.tank.hpPct || 0);
    if (hpPct) d.primary.hp = Math.round(Number(d.primary.hp || 0) * (1 + hpPct / 100));
    d.secondary.avoidDamageRate = Number(d.secondary.avoidDamageRate || 0) + Number(sb.role.tank.avoidDamageRate || 0);
    d.secondary.healRate = Number(d.secondary.healRate || 0) + Number(sb.role.tank.healRate || 0);
  }
  if (role === "helper") {
    const speedPct = Number(sb.role.helper.speedPct || 0);
    if (speedPct) d.primary.speed = Math.round(Number(d.primary.speed || 0) * (1 + speedPct / 100));
  }
  return d;
}

function deriveFallbackGrowthValue(hero, stat, growth) {
  const h = hero || {};
  const g = growth || {};
  const spirit = Number(g.spirit || 0);
  const might = Number(g.might || 0);
  const agility = Number(g.agility || 0);
  const classType = String(h.classType || "").toLowerCase();

  if (stat === "chakra") {
    if (classType === "ninjutsu") return Math.round((spirit > 0 ? spirit : Math.max(might, agility, 1)) * 10) / 10;
    if (classType === "genjutsu" || classType === "medical" || classType === "support") {
      return Math.round(Math.max(spirit, agility * 0.9, 1) * 10) / 10;
    }
    if (classType === "taijutsu") return Math.round(Math.max((spirit > 0 ? spirit * 0.6 : Math.max(might, agility) * 0.5), 0.1) * 10) / 10;
    return Math.round(Math.max((spirit > 0 ? spirit * 0.75 : Math.max(might, agility) * 0.5), 0.1) * 10) / 10;
  }

  return Number(g[stat] || 0);
}

function ensureHeroGrowth(hero) {
  const h = hero || {};
  const flatGrowth = (h.growth && typeof h.growth === "object" && !h.growth.main) ? h.growth : null;
  const nestedGrowth = (h.growth && typeof h.growth === "object" && h.growth.main) ? h.growth.main : null;
  const gpl = h.growthPerLevel && typeof h.growthPerLevel === "object" ? h.growthPerLevel : null;

  const source = nestedGrowth || flatGrowth || gpl || {};
  const norm = {
    spirit: Number(source.spirit || 0),
    chakra: Number(source.chakra || 0),
    might: Number(source.might || 0),
    agility: Number(source.agility || 0),
    hp: Number(source.hp || 0),
  };

  if (!(norm.chakra > 0)) norm.chakra = deriveFallbackGrowthValue(h, "chakra", norm);

  const out = { ...h };
  if (nestedGrowth) out.growth = { ...h.growth, main: { ...nestedGrowth, ...norm } };
  else out.growth = { ...(flatGrowth || {}), ...norm };
  out.growthPerLevel = { ...(gpl || {}), ...norm };
  return out;
}

function withComputedHero(playerId, hero) {
  const normalizedHero = ensureHeroGrowth(hero);
  const sb = normalizedHero.isMain ? getSkillBookBonuses(playerId) : null;
  const effectiveHero = (() => {
    if (!normalizedHero.isMain || !sb) return normalizedHero;
    const baseGrowth = normalizedHero.growthPerLevel || normalizedHero.growth?.main || normalizedHero.growth || {};
    const nextGrowth = {
      spirit: Number(baseGrowth.spirit || 0) + Number(sb.mainGrowth.spirit || 0),
      chakra: Number(baseGrowth.chakra || 0) + Number(sb.mainGrowth.chakra || 0),
      might: Number(baseGrowth.might || 0) + Number(sb.mainGrowth.might || 0),
      agility: Number(baseGrowth.agility || 0) + Number(sb.mainGrowth.agility || 0),
      hp: Number(baseGrowth.hp || 0) + Number(sb.mainGrowth.hp || 0),
    };
    const out = { ...normalizedHero, growthPerLevel: nextGrowth };
    if (normalizedHero.growth && typeof normalizedHero.growth === "object" && normalizedHero.growth.main) {
      out.growth = { ...normalizedHero.growth, main: { ...normalizedHero.growth.main, ...nextGrowth } };
    } else {
      out.growth = { ...(normalizedHero.growth || {}), ...nextGrowth };
    }
    return out;
  })();
  const derived0 = computeHeroDerived(effectiveHero);
  const bonus = sumEquipBonuses(playerId, effectiveHero.id);
  const derived = applyBonusesToDerived(derived0, bonus);
  const derived2 = applyGemsToDerived(playerId, effectiveHero.id, derived);
  const derived3 = applySkillBookBonuses(playerId, effectiveHero, derived2);
  const power = calcPowerFromDerived(derived3);
  const skillBookSkills = effectiveHero.isMain ? (sb?.skills || []) : [];
  const baseSkills = Array.isArray(effectiveHero.skills) ? effectiveHero.skills : [];
  const equippedSkillIds = effectiveHero.isMain ? (Array.isArray(getPlayerSkillBook(playerId)?.equippedSkills) ? getPlayerSkillBook(playerId).equippedSkills.slice(0, 8) : []) : [];
  const skillMap = new Map(skillBookSkills.map((x) => [x.id, x]));
  const equippedSkillBookSkills = equippedSkillIds.map((id) => skillMap.get(id)).filter(Boolean);
  const extraSkillBookSkills = skillBookSkills.filter((x) => !equippedSkillIds.includes(x.id));
  return {
    ...effectiveHero,
    role: normalizeRole(hero.role),
    stats: derived3,
    power,
    skillBookSkills,
    equippedSkillIds,
    skills: effectiveHero.isMain ? [...baseSkills, ...equippedSkillBookSkills, ...extraSkillBookSkills] : baseSkills,
    expToNext: expToNext(hero.level),
  };
}

// ===== EXP curve (1 -> 120) =====
// IMPORTANT:
//  - Table values are "XP required to go from level L to level L+1".
//  - Game currently caps at level 120 (future: 150 + rebirth, not in this patch).
const EXP_MAX_LEVEL = 120;

// 1-based index. Only levels 1..119 are used (120 is cap).
const __EXP_TO_NEXT = (() => {
  const arr = [];
  // Level: XP required to go from this level -> next level
  const rows = {
    1: 100,
    2: 200,
    3: 300,
    4: 450,
    5: 600,
    6: 750,
    7: 900,
    8: 1050,
    9: 1200,
    10: 1350,
    11: 1500,
    12: 1650,
    13: 1800,
    14: 2000,
    15: 2200,
    16: 2400,
    17: 2600,
    18: 2800,
    19: 3000,
    20: 3200,
    21: 3400,
    22: 3600,
    23: 3800,
    24: 4000,
    25: 6600,
    26: 6900,
    27: 7200,
    28: 7500,
    29: 20000,
    30: 35000,
    31: 37515,
    32: 51760,
    33: 66950,
    34: 83130,
    35: 100345,
    36: 130548,
    37: 162710,
    38: 196974,
    39: 233448,
    40: 275643,
    41: 320502,
    42: 368145,
    43: 418692,
    44: 472384,
    45: 549440,
    46: 631331,
    47: 718282,
    48: 810518,
    49: 908264,
    50: 1011956,
    51: 1096823,
    52: 1186416,
    53: 1280915,
    54: 1380751,
    55: 1485873,
    56: 1596732,
    57: 1713538,
    58: 1836501,
    59: 1965831,
    60: 2102049,
    61: 2245395,
    62: 2396109,
    63: 2554772,
    64: 2721654,
    65: 2897025,
    66: 3081155,
    67: 3274695,
    68: 3477945,
    69: 3691606,
    70: 3916008,
    71: 4348701,
    72: 4807026,
    73: 5344878,
    74: 5914212,
    75: 6573434,
    76: 7329834,
    77: 8191768,
    78: 9168202,
    79: 10202280,
    80: 11297994,
    81: 12456874,
    82: 13684890,
    83: 14982358,
    84: 16354254,
    85: 17803548,
    86: 19334381,
    87: 20949888,
    88: 22655766,
    89: 24455480,
    90: 26352495,
    91: 26625032,
    92: 27099363,
    93: 33857467,
    94: 35245621,
    95: 36688128,
    96: 38185923,
    97: 39738316,
    98: 41351575,
    99: 43025049,
    100: 44759820,
    101: 61458714,
    102: 69943658,
    103: 79210731,
    104: 89301031,
    105: 100275966,
    106: 112180641,
    107: 125075912,
    108: 139026952,
    109: 154089237,
    110: 162716148,
    111: 171927487,
    112: 181757366,
    113: 192241492,
    114: 203411816,
    115: 215318092,
    116: 227995908,
    117: 241482072,
    118: 255826717,
    119: 271076368,
    120: 287279568,
  };
  for (const [k, v] of Object.entries(rows)) arr[Number(k)] = Number(v);
  return arr;
})();

function expToNext(level) {
  const lvl = Math.max(1, Number(level || 1));
  if (lvl >= EXP_MAX_LEVEL) return Number.POSITIVE_INFINITY;
  return __EXP_TO_NEXT[lvl] || 100;
}

// Total cumulative EXP at the *start* of a level.
// startExp(1)=0, startExp(2)=expToNext(1), ...
const __EXP_START = (() => {
  const arr = new Array(EXP_MAX_LEVEL + 2).fill(0);
  let sum = 0;
  arr[1] = 0;
  for (let lvl = 2; lvl <= EXP_MAX_LEVEL + 1; lvl += 1) {
    sum += expToNext(lvl - 1);
    arr[lvl] = sum;
  }
  return arr;
})();

function startExp(level) {
  const lvl = Math.max(1, Math.min(EXP_MAX_LEVEL, Number(level || 1)));
  return __EXP_START[lvl] || 0;
}

function heroTotalExp(h) {
  const lvl = Math.max(1, Math.min(EXP_MAX_LEVEL, Number(h?.level || 1)));
  const within = Math.max(0, Number(h?.exp || 0));
  return startExp(lvl) + within;
}

function levelFromTotalExp(total) {
  let lvl = 1;
  let rest = Math.max(0, Number(total || 0));
  while (lvl < EXP_MAX_LEVEL) {
    const need = expToNext(lvl);
    if (rest < need) break;
    rest -= need;
    lvl += 1;
  }
  if (lvl >= EXP_MAX_LEVEL) return { level: EXP_MAX_LEVEL, exp: 0 };
  return { level: lvl, exp: rest };
}

function normalizePlayer(p) {
  if (!p || typeof p !== "object") return null;
  const classType = p.classType || p.type || null;
  const exp = Number(p.exp ?? 0);
  const level = Number(p.level ?? 1);
  const vip = Number(p.vip ?? 0);
  const svip = Number(p.svip ?? 0);
  const isAdminHidden = Boolean(p.isAdminHidden ?? false);
  const currency = {
    silver: Number(p.currency?.silver ?? p.silver ?? 0),
    gold: Number(p.currency?.gold ?? p.gold ?? 0),
    coupons: Number(p.currency?.coupons ?? p.coupons ?? 0),
  };
  const skillBook = normalizeSkillBookState(p.skillBook);
  return { ...p, classType, exp, level, vip, svip, isAdminHidden, currency, skillBook };
}

// ===== users (auth) =====
const crypto = require("crypto");

function ensureUsersFile() {
  const db = readJSON("users.json", { users: [] });
  if (!db || typeof db !== "object") writeJSON("users.json", { users: [] });
  if (!Array.isArray(db.users)) writeJSON("users.json", { users: asArray(db.users) });
}

function normalizeLogin(login) {
  return String(login || "").trim().toLowerCase();
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 32, "sha256").toString("hex");
  return { salt, hash };
}

function verifyPassword(password, rec) {
  try {
    const salt = String(rec?.passSalt || "");
    const hash = String(rec?.passHash || "");
    if (!salt || !hash) return false;
    const got = crypto.pbkdf2Sync(String(password), salt, 120000, 32, "sha256").toString("hex");
    return crypto.timingSafeEqual(Buffer.from(got, "hex"), Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

function getUsersDb() {
  ensureUsersFile();
  const db = readJSON("users.json", { users: [] });
  return { users: asArray(db.users) };
}

function saveUsersDb(usersArr) {
  writeJSON("users.json", { users: Array.isArray(usersArr) ? usersArr : [] });
}

function getUserById(userId) {
  const db = getUsersDb();
  return db.users.find((u) => u && u.id === userId) || null;
}

function getUserByLogin(login) {
  const l = normalizeLogin(login);
  const db = getUsersDb();
  return db.users.find((u) => normalizeLogin(u?.login) === l) || null;
}

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    login: u.login,
    serverId: u.serverId || null,
    playerId: u.playerId || null,
    isAdminHidden: Boolean(u.isAdminHidden ?? false),
    createdAt: u.createdAt || null,
  };
}

function createPlayerAndSeed({ type, gender, nickname, serverId }) {
  let playersDb = readJSON("players.json", { players: [] });
  let playersArr = asArray(playersDb.players);

  const nick = String(nickname || "").trim();
  const exists = playersArr.some((p) => String(p?.nickname || "").toLowerCase() === nick.toLowerCase());
  if (exists) return { ok: false, error: "Нік вже зайнятий" };

  const playerId = uid("player");
  const player = {
    id: playerId,
    nickname: nick,
    gender,
    classType: type,
    level: 1,
    exp: 0,
    vip: 0,
    svip: 0,
    isAdminHidden: false,
    serverId: serverId || null,
    currency: { silver: 1000, gold: 0, coupons: 0 },
    createdAt: Date.now(),
    skillBook: createDefaultSkillBookState(),
  };

  playersArr.push(player);
  playersDb = setAsArray(playersDb, "players", playersArr);
  writeJSON("players.json", playersDb);
  ensurePlayerSeed(playerId);
  return { ok: true, player };
}

// ===== admin guard =====
function adminGuard(req, res) {
  const need = String(process.env.ADMIN_KEY || "");
  if (!need) return true; // якщо ключ не заданий — адмінка відкрита (локально)
  const got = String(req.headers["x-admin-key"] || "");
  if (got !== need) {
    res.status(401).json({ ok: false, error: "Unauthorized (bad admin key)" });
    return false;
  }
  return true;
}

// ===== seed (GG + formation + inventory + mail) =====
function ensurePlayerSeed(playerId) {
  const playersDbRaw = readJSON("players.json", { players: [] });
  const playersArr = asArray(playersDbRaw.players);
  const p0 = playersArr.find((x) => x && x.id === playerId);
  if (!p0) return { ok: false, error: "Player not found" };

  const player = normalizePlayer(p0);
  if (JSON.stringify(player.skillBook || {}) !== JSON.stringify(p0.skillBook || {})) {
    p0.skillBook = player.skillBook;
    writeJSON("players.json", { players: playersArr });
  }

  // heroes
  let heroesDb = readJSON("heroes.json", { heroes: [] });
  let heroesArr = asArray(heroesDb.heroes);
  // cleanup legacy demo hero "Ірука" якщо він колись був засіджений
  const beforeLen = heroesArr.length;
  heroesArr = heroesArr.filter((h) => !(h && h.playerId === playerId && !h.isMain && String(h.name || "").toLowerCase().includes("ирука")));
  if (heroesArr.length !== beforeLen) {
    heroesDb = setAsArray(heroesDb, "heroes", heroesArr);
    writeJSON("heroes.json", heroesDb);
  }

  let myHeroes = heroesArr.filter((h) => h && h.playerId === playerId);
  let gg = myHeroes.find((h) => h && h.isMain);
  // NOTE: демо-героя (Ірука) більше не сідуємо. Персонажі мають з’являтися через токени/активацію.
  let iruka = null;

  if (!gg) {
    const type = player.classType || "taijutsu";
    gg = {
      id: uid("h"),
      playerId,
      name: player.nickname || "Hero",
      isMain: true,
      level: player.level ?? 1,
      rarity: "C",
      role: "assault",
      classType: type,
      stats: {
        // ✅ Стартові характеристики ГГ на LV1 (референс)
        main: { spirit: 29, chakra: 41, might: 64, agility: 54 },
        primary: { hp: 462, physAtk: 64, physDef: 45, stratAtk: 29, stratDef: 29, speed: 54 },
        secondary: {
          damageRate: 100,
          accuracyRate: 100,
          critRate: 0,
          dodgeRate: 0,
          counterRate: 0,
          blockRate: 0,
          antiInjuryRate: 0,
          punchRate: 0,
          aidRate: 0,
        },
      },
      skills: [
        { name: "Базова атака", desc: "Звичайна атака.", power: 1.0, scale: type === "taijutsu" ? "physAtk" : "stratAtk", rageCost: 0 },
        { name: "Техніка", desc: "Посилена атака.", power: 1.2, scale: type === "taijutsu" ? "physAtk" : "stratAtk", rageCost: 100 },
      ],
      createdAt: new Date().toISOString(),
    };
    heroesArr.push(gg);
    heroesDb = setAsArray(heroesDb, "heroes", heroesArr);
    writeJSON("heroes.json", heroesDb);
    myHeroes = heroesArr.filter((h) => h && h.playerId === playerId);
  } else {
    // ✅ якщо старий ГГ був засіджений з "перебільшеними" статами — нормалізуємо на LV1
    try {
      const hp = Number(gg?.stats?.primary?.hp || 0);
      const lvl = Number(gg?.level || 1);
      if (lvl <= 1 && hp > 5000) {
        gg.stats = {
          main: { spirit: 29, chakra: 41, might: 64, agility: 54 },
          primary: { hp: 462, physAtk: 64, physDef: 45, stratAtk: 29, stratDef: 29, speed: 54 },
          secondary: {
            damageRate: 100,
            accuracyRate: 100,
            critRate: 0,
            dodgeRate: 0,
            counterRate: 0,
            blockRate: 0,
            antiInjuryRate: 0,
            punchRate: 0,
            aidRate: 0,
          },
        };
        heroesDb = setAsArray(heroesDb, "heroes", heroesArr);
        writeJSON("heroes.json", heroesDb);
      }
    } catch(_e) {}
  }

  // ❌ прибрали автосід Іруки

  // formations
  let formationsDb = readJSON("formations.json", { formations: [] });
  let formationsArr = asArray(formationsDb.formations);
  let recF = formationsArr.find((x) => x && x.playerId === playerId);

  if (!recF) {
    // дефолт: ГГ по центру (штурмовик)
    recF = { playerId, formation: { top: [null, null], middle: [null, gg.id, null], bottom: [null, null] } };
    formationsArr.push(recF);
    formationsDb = setAsArray(formationsDb, "formations", formationsArr);
    writeJSON("formations.json", formationsDb);
  } else {
    const f = recF.formation || {};
    if (!Array.isArray(f.top) || f.top.length !== 2) f.top = [null, null];
    if (!Array.isArray(f.middle) || f.middle.length !== 3) f.middle = [null, null, null];
    if (!Array.isArray(f.bottom) || f.bottom.length !== 2) f.bottom = [null, null];
    // прибираємо посилання на видалених/чужих героїв
    const ownedIds = new Set(myHeroes.map((h) => h.id));
    for (const arr of [f.top, f.middle, f.bottom]) {
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] && !ownedIds.has(arr[i])) arr[i] = null;
      }
    }
    const all = [...f.top, ...f.middle, ...f.bottom].filter(Boolean);
    if (!all.includes(gg.id)) f.middle[1] = gg.id;
    // не підставляємо демо-героїв
    recF.formation = f;
    formationsDb = setAsArray(formationsDb, "formations", formationsArr);
    writeJSON("formations.json", formationsDb);
  }

  // inventories
  let invDb = readJSON("inventories.json", { inventories: [] });
  let invArr = asArray(invDb.inventories);
  let recI = invArr.find((x) => x && x.playerId === playerId);

  if (!recI) {
    recI = {
      playerId,
      inventory: {
        bagItems: [],
        capacity: 30,
        equippedItemsByHero: {
          [gg.id]: { weapon: null, armor: null, jewelry: null, head: null, cloak: null, belt: null, shoes: null, j1:null,j2:null,j3:null,j4:null,j5:null,j6:null,j7:null,j8:null },
          ...(iruka ? { [iruka.id]: { weapon: null, armor: null, jewelry: null, head: null, cloak: null, belt: null, shoes: null, j1:null,j2:null,j3:null,j4:null,j5:null,j6:null,j7:null,j8:null } } : {}),
        },
      },
    };
    invArr.push(recI);
    invDb = setAsArray(invDb, "inventories", invArr);
    writeJSON("inventories.json", invDb);
  } else {
    const inv = recI.inventory || {};
    if (!Array.isArray(inv.bagItems)) inv.bagItems = [];
    if (!inv.equippedItemsByHero || typeof inv.equippedItemsByHero !== "object") inv.equippedItemsByHero = {};
    if (!inv.equippedItemsByHero[gg.id]) inv.equippedItemsByHero[gg.id] = { weapon: null, armor: null, jewelry: null, head: null, cloak: null, belt: null, shoes: null, j1:null,j2:null,j3:null,j4:null,j5:null,j6:null,j7:null,j8:null };
    if (iruka && !inv.equippedItemsByHero[iruka.id]) inv.equippedItemsByHero[iruka.id] = { weapon: null, armor: null, jewelry: null, head: null, cloak: null, belt: null, shoes: null, j1:null,j2:null,j3:null,j4:null,j5:null,j6:null,j7:null,j8:null };
    if (!Number.isFinite(Number(inv.capacity))) inv.capacity = 30;
    recI.inventory = inv;
    invDb = setAsArray(invDb, "inventories", invArr);
    writeJSON("inventories.json", invDb);
  }

  // ⚠️ No starter equipment seeding here. Admin/gameplay should provide items.

  // mail
  const mailDb = readJSON("mail.json", { letters: [] });
  writeJSON("mail.json", { letters: asArray(mailDb.letters) });

  // items catalog
  ensureItemsCatalog();

  return { ok: true };
}

function syncMainHeroWithPlayer(playerId) {
  const playersDb = readJson(DB.players);
  const heroesDb = readJson(DB.heroes);
  const p = playersDb[playerId];
  if (!p) return;

  const idx = heroesDb.findIndex((h) => h.ownerPlayerId === playerId && h.isMain);
  if (idx === -1) return;

  const gg = heroesDb[idx];
  const playerLevel = Math.max(1, Number(p.level || 1));
  gg.level = playerLevel;

  // Ensure GG has growth, so stats/power scale with level.
  gg.growth = gg.growth || {};
  gg.growth.main = gg.growth.main || { spirit: 1.2, chakra: 1.2, might: 1.2, agility: 1.2 };

  heroesDb[idx] = gg;
  writeJson(DB.heroes, heroesDb);
}

// ===== items catalog (what "exists" in game) =====
// stored in server/data/items_catalog.json : { items: [...] }
function ensureItemsCatalog() {
  const db = readJSON("items_catalog.json", { items: [] });
  const items = asArray(db.items);

  if (items.length) return;

  // default catalog (ти потім розшириш через адмінку/редактор)
  const seed = [
    { tplId: "itm_kunai", type: "weapon", slot: "weapon", name: "Кунай", desc: "+2 physAtk" },
    { tplId: "itm_vest", type: "armor", slot: "armor", name: "Жилет шинобі", desc: "+2 physDef" },
    { tplId: "itm_ring", type: "jewelry", slot: "jewelry", name: "Кільце", desc: "+1 critRate" },
    { tplId: "itm_potion", type: "consumable", name: "Зілля", desc: "Тестовий предмет" },
  ];

  writeJSON("items_catalog.json", { items: seed });
}


function getHeroTokenCatalog() {
  // Герої як "предмети" (токени). Після активації створюється герой і предмет зникає.
  return [
    {
      tplId: "hero_token_taijutsu_c",
      type: "hero",
      slot: null,
      name: "Токен героя: Тайдзютсу (C)",
      desc: "Активуй у сумці щоб отримати героя Тайдзютсу.",
      hero: { classType: "taijutsu", rarity: "C" },
    },
    {
      tplId: "hero_token_ninjutsu_c",
      type: "hero",
      slot: null,
      name: "Токен героя: Ніндзютсу (C)",
      desc: "Активуй у сумці щоб отримати героя Ніндзютсу.",
      hero: { classType: "ninjutsu", rarity: "C" },
    },
    {
      tplId: "hero_token_genjutsu_c",
      type: "hero",
      slot: null,
      name: "Токен героя: Гензютсу (C)",
      desc: "Активуй у сумці щоб отримати героя Гензютсу.",
      hero: { classType: "genjutsu", rarity: "C" },
    },

    // ===== S-герої (з твоїх ТЗ) =====
    {
      tplId: "hero_token_sasuke_curse_s",
      type: "hero",
      slot: null,
      name: "Токен героя: Проклятая печать Саске (S)",
      desc: "Активуй у сумці щоб отримати штурмовика S рангу.",
      hero: { templateId: "sasuke_curse_s" },
    },
    {
      tplId: "hero_token_itachi_susanoo_s",
      type: "hero",
      slot: null,
      name: "Токен героя: Сусано Итачи (S)",
      desc: "Активуй у сумці щоб отримати танка S рангу.",
      hero: { templateId: "itachi_susanoo_s" },
    },

    // ===== герої зі скрінів (S / SSS) =====
    {
      tplId: "hero_token_sakura_star_s",
      type: "hero",
      slot: null,
      name: "Токен героя: Звезда Сакура (S)",
      desc: "Активуй у сумці щоб отримати штурмовика S рангу.",
      hero: { templateId: "sakura_star_s" },
    },
    {
      tplId: "hero_token_madara_6paths_sss",
      type: "hero",
      slot: null,
      name: "Токен героя: Мадара 6-ти путей (SSS)",
      desc: "Активуй у сумці щоб отримати підтримку SSS рангу.",
      hero: { templateId: "madara_6paths_sss" },
    },
    {
      tplId: "hero_token_shisui_sss",
      type: "hero",
      slot: null,
      name: "Токен героя: Учиха Шисуи (SSS)",
      desc: "Активуй у сумці щоб отримати штурмовика SSS рангу.",
      hero: { templateId: "shisui_sss" },
    },
    {
      tplId: "hero_token_obito_outer_sss",
      type: "hero",
      slot: null,
      name: "Токен героя: Внешний Путь Обито (SSS)",
      desc: "Активуй у сумці щоб отримати помічника SSS рангу.",
      hero: { templateId: "obito_outer_sss" },
    },
    {
      tplId: "hero_token_itachi_reanimated_sss",
      type: "hero",
      slot: null,
      name: "Токен героя: Воскрешенный Итачи (SSS)",
      desc: "Активуй у сумці щоб отримати авангард SSS рангу.",
      hero: { templateId: "itachi_reanimated_sss" },
    },
  ];
}

function getHeroTemplates() {
  const fromFile = readJSON("hero_templates.json", { heroTemplates: [] });
  const rows = asArray(fromFile.heroTemplates);
  if (rows.length) {
    return Object.fromEntries(rows.filter(Boolean).map((row) => [String(row.templateId || ""), row]).filter(([k]) => k));
  }
  return {
    sasuke_curse_s: {
      name: "Проклятая печать Саске",
      rarity: "S",
      role: "assault",
      classType: "taijutsu",
      base: { spirit: 100, chakra: 50, might: 100, agility: 100, hp: 300 },
      growth: { spirit: 2.6, might: 2.2, agility: 2.4, hp: 2.6 },
      ratings: { atk: 1.2, def: 1.1 },
      auras: [
        { name: "Врожденная сила", desc: "Підвищує власну Силу на 40%", self: true, stat: "might", pct: 40 },
      ],
      skills: [
        {
          name: "Печать: удар по всем",
          desc: "Атакує всіх 100%. Дає штурмовикам +40% helpRate і +5% atk на 3 раунди. Собі +5% def.",
          power: 1.0,
          target: "allEnemies",
        },
      ],
    },
    itachi_susanoo_s: {
      name: "Сусано Итачи",
      rarity: "S",
      role: "tank",
      classType: "genjutsu",
      base: { spirit: 1500, chakra: 800, might: 1000, agility: 1200, hp: 5000 },
      growth: { spirit: 4.8, might: 3.8, agility: 4.1, hp: 4.4 },
      ratings: { atk: 1.4, def: 1.3 },
      auras: [
        { name: "Сусано: защита", desc: "+40% Spirit і Agility. +15% Speed. +20% Block. Імунітет до стану.", self: true },
      ],
      skills: [
        {
          name: "Сусано: подавление",
          desc: "Атакує всіх 190%. -30% S-атаки та -15% захисту ворогам на 3 раунди. Собі +100% пробиття і +30% атаки на 1 раунд. +25 ярості.",
          power: 1.9,
          target: "allEnemies",
          rageGain: 25,
        },
      ],
    },

    // ================== скріни (S/SSS) ==================
    sakura_star_s: {
      name: "Звезда Сакура",
      rarity: "S",
      role: "assault",
      classType: "taijutsu",
      base: { spirit: 1200, chakra: 500, might: 400, agility: 700, hp: 3000 },
      growth: { spirit: 4.0, might: 3.0, agility: 3.4, hp: 3.6 },
      ratings: { atk: 1.15, def: 1.05 },
      auras: [
        { name: "Цветок сакуры", desc: "Врождено +40% ловкость (собі). +100% рейтинг урона (собі).", self: true },
      ],
      skills: [
        {
          name: "Удар Сакуры",
          desc: "Атакует вражеского авангарда силой 100%. Снижает защиту на 20% на 2 раунда. Увеличивает себе атаку на 100% на 1 раунд.",
          power: 1.0,
          target: "enemyVanguard",
        },
      ],
    },

    madara_6paths_sss: {
      name: "Мадара 6-ти путей",
      rarity: "SSS",
      role: "support",
      classType: "genjutsu",
      base: { spirit: 1400, chakra: 1400, might: 2000, agility: 1400, hp: 6000 },
      growth: { spirit: 4.2, chakra: 4.2, might: 5.2, agility: 4.5, hp: 4.6 },
      ratings: { atk: 2.3, def: 1.15 },
      auras: [
        { name: "Контроль Инь-Янь", desc: "Врождено +40% ловкость и чакра. +10% экстра-раунд. +15% рейтинг защиты. Иммунитет к оглушению и снижению ярости.", self: true },
      ],
      skills: [
        {
          name: "Поиск истины",
          desc: "Атакует всех врагов силой 230%. Снижает авангарду рейтинг защиты на 50% на 1 раунд. Снижает штурмовикам и помощникам рейтинг урона на 30% на 1 раунд. Восстанавливает ярость: себе 50, остальным 30.",
          power: 2.3,
          target: "allEnemies",
          rageGain: 50,
          rageGainAllies: 30,
        },
      ],
    },

    shisui_sss: {
      name: "Учиха Шисуи",
      rarity: "SSS",
      role: "assault",
      classType: "taijutsu",
      base: { spirit: 2000, chakra: 900, might: 1500, agility: 1600, hp: 10000 },
      growth: { spirit: 5.0, might: 4.5, agility: 4.8, hp: 5.0 },
      ratings: { atk: 2.0, def: 1.2 },
      auras: [
        { name: "Небесное наказание", desc: "Врождено +40% ловкость, сила духа и здоровье. +20% скорость (собі), +15% рейтинг атаки. Иммунитет к оглушению.", self: true },
      ],
      skills: [
        {
          name: "Сусаноо: Взрыв",
          desc: "Атакует всех врагов силой 200%. Снижает скорость на 15% и защиту на 20% на 2 раунда. Увеличивает помощникам рейтинг помощи на 65% на 2 раунда. Увеличивает всем союзникам рейтинг уворота на 50% на 1 раунд. Восстанавливает себе 68 ярости.",
          power: 2.0,
          target: "allEnemies",
          rageGain: 68,
        },
      ],
    },

    obito_outer_sss: {
      name: "Внешний Путь Обито",
      rarity: "SSS",
      role: "support",
      classType: "genjutsu",
      base: { spirit: 700, chakra: 600, might: 800, agility: 1000, hp: 2000 },
      growth: { spirit: 3.6, might: 4.0, agility: 4.0, hp: 4.0 },
      ratings: { atk: 1.5, def: 1.1 },
      auras: [
        { name: "Сила Внешнего пути", desc: "Врождено +40% ловкость. +10% экстра-раунд (собі). Иммунитет к снижению ярости.", self: true },
      ],
      skills: [
        {
          name: "Гедо Мазо",
          desc: "Атакует всех врагов силой 150%. Накладывает на помощников иммунитет к контролям на 2 раунда. Очищает помощников от негативных эффектов. Восстанавливает ярость: себе 100, остальным 30.",
          power: 1.5,
          target: "allEnemies",
          rageGain: 100,
          rageGainAllies: 30,
        },
      ],
    },

    itachi_reanimated_sss: {
      name: "Воскрешенный Итачи",
      rarity: "SSS",
      role: "assault",
      classType: "ninjutsu",
      base: { spirit: 2200, chakra: 1200, might: 1900, agility: 1600, hp: 9000 },
      growth: { spirit: 5.0, might: 4.3, agility: 4.5, hp: 5.8 },
      ratings: { atk: 2.4, def: 1.2 },
      auras: [
        { name: "Мощь Шарингана", desc: "Врождено +40% сила духа и сила. +20% рейтинг защиты (собі). Иммунитет к оглушению и молчанию.", self: true },
      ],
      skills: [
        {
          name: "Аматерасу",
          desc: "Атакует всех врагов силой 240%. С 55% шансом накладывает хаос на 2 раунда. Накладывает воспламенение силой 80% на 1 раунд. Повышает союзным штурмовикам рейтинг помощи на 65% на 3 раунда.",
          power: 2.4,
          target: "allEnemies",
          proc: { chance: 0.55, effect: "chaos", rounds: 2 },
          dot: { effect: "burn", power: 0.8, rounds: 1 },
        },
      ],
    },
  };
}

function getCatalog() {
  ensureItemsCatalog();
  const db = readJSON("items_catalog.json", { items: [] });
  const raw = asArray(db.items).concat(getHeroTokenCatalog());
  // ✅ у публічному каталозі лишаємо тільки активовані hero_token_* (щоб не було дублей/"Bad hero token")
  return raw.filter((it) => {
    if (!it) return false;
    if (it.type !== "hero") return true;
    const tplId = String(it.tplId || "");
    return tplId.startsWith("hero_token_") || !!it.hero;
  });
}

function cloneItemFromTpl(tpl) {
  // bag item gets unique id
  const it = {
    id: uid("itm"),
    type: tpl.type,
    slot: tpl.slot || null,
    name: tpl.name,
    desc: tpl.desc || "",
    tplId: tpl.tplId || null,
    icon: tpl.icon || null,
  };

  // stackable items (e.g., EXP scrolls)
  if (Number(tpl?.maxStack || 0) > 1) {
    it.qty = 1;
    it.maxStack = Number(tpl.maxStack);
  }
  if (tpl?.effects) it.effects = tpl.effects;
  if (tpl?.rarity) it.rarity = tpl.rarity;

  return it;
}



function ensureInvDefaults(inv) {
  if (!inv || typeof inv !== "object") inv = {};
  inv.bagItems = Array.isArray(inv.bagItems) ? inv.bagItems : [];
  inv.tempBagItems = Array.isArray(inv.tempBagItems) ? inv.tempBagItems : [];
  inv.equippedItemsByHero = inv.equippedItemsByHero && typeof inv.equippedItemsByHero === "object" ? inv.equippedItemsByHero : {};
  inv.capacity = Number(inv.capacity || 30);
  // Temporary bag is a real "overflow" bag with limited capacity.
  // User spec: 30 slots max.
  inv.tempCapacity = Number(inv.tempCapacity || 30);
  inv.freeExpands = Array.isArray(inv.freeExpands) ? inv.freeExpands : [];
  // Paid expands counter (for price growth)
  inv.paidExpands = Number(inv.paidExpands || 0);
  // How many online-hours have been claimed into bag slots
  inv.onlineClaims = Number(inv.onlineClaims || 0);
  return inv;
}

function addTplToInventory(inv, tpl, qty) {
  inv = ensureInvDefaults(inv);
  if (!tpl) return { added: 0, movedToTemp: 0 };

  const maxStack = Number(tpl.maxStack || 1);
  let added = 0;
  let movedToTemp = 0;

  for (let i = 0; i < qty; i++) {
    // 1) try stack into bag
    if (maxStack > 1) {
      const stack = inv.bagItems.find((x) => x && x.tplId === tpl.tplId && Number(x.qty || 1) < maxStack);
      if (stack) {
        stack.qty = Number(stack.qty || 1) + 1;
        added++;
        continue;
      }
    }

    // 2) if bag has free slot
    if (inv.bagItems.length < inv.capacity) {
      inv.bagItems.push(cloneItemFromTpl(tpl));
      added++;
      continue;
    }

    // 3) move to temp bag (stack first)
    if (maxStack > 1) {
      const tstack = inv.tempBagItems.find((x) => x && x.tplId === tpl.tplId && Number(x.qty || 1) < maxStack);
      if (tstack) {
        tstack.qty = Number(tstack.qty || 1) + 1;
        movedToTemp++;
        continue;
      }
    }
    if (inv.tempBagItems.length < inv.tempCapacity) {
      inv.tempBagItems.push(cloneItemFromTpl(tpl));
      movedToTemp++;
    }
  }

  return { added, movedToTemp };
}

function consumeTplFromInventory(inv, tplId, qty) {
  inv = ensureInvDefaults(inv);
  const id = String(tplId || "");
  let need = Math.max(0, Number(qty || 0));
  if (!id || need <= 0) return { ok: true, removed: 0 };

  const takeFrom = (arr) => {
    for (let i = 0; i < arr.length && need > 0; i++) {
      const it = arr[i];
      if (!it || String(it.tplId) !== id) continue;
      const have = Math.max(1, Number(it.qty || 1));
      const take = Math.min(have, need);
      const left = have - take;
      need -= take;
      if (left <= 0) {
        arr.splice(i, 1);
        i--;
      } else {
        it.qty = left;
      }
    }
  };

  takeFrom(inv.bagItems);
  takeFrom(inv.tempBagItems);

  if (need > 0) return { ok: false, error: "not_enough", missing: need };
  return { ok: true, removed: qty };
}

// Public items catalog (for UI names)
app.get("/api/items/catalog", (req, res) => {
  const items = getCatalog().map((it) => ({ tplId: it.tplId, type: it.type, slot: it.slot || null, name: it.name, desc: it.desc || "" }));
  return res.json({ ok: true, items });
});
// ===================== API =====================

// ---------- AUTH ----------
// register: { login, password }
app.post("/api/auth/register", (req, res) => {
  try {
    const loginRaw = req.body?.login;
    const password = String(req.body?.password || "");

    const login = normalizeLogin(loginRaw);
    if (!login || login.length < 3 || login.length > 24) {
      return res.status(400).json({ ok: false, error: "Логін має бути 3-24 символи" });
    }
    if (!/^[a-z0-9._-]+$/.test(login)) {
      return res.status(400).json({ ok: false, error: "Логін: тільки латиниця/цифри . _ -" });
    }
    if (!password || password.length < 6 || password.length > 64) {
      return res.status(400).json({ ok: false, error: "Пароль має бути 6-64 символи" });
    }

    const db = getUsersDb();
    const exists = db.users.some((u) => normalizeLogin(u?.login) === login);
    if (exists) return res.status(409).json({ ok: false, error: "Такий логін вже існує" });

    const { salt, hash } = hashPassword(password);
    const user = {
      id: uid("user"),
      login,
      passSalt: salt,
      passHash: hash,
      serverId: null,
      playerId: null,
      isAdminHidden: false, // 🔒 прихований статус адміна (пізніше зробимо логіку входу)
      createdAt: Date.now(),
    };

    db.users.push(user);
    saveUsersDb(db.users);
    return res.json({ ok: true, user: publicUser(user) });
  } catch (e) {
    console.error("POST /api/auth/register error:", e);
    return res.status(500).json({ ok: false, error: "Server error", details: String(e?.message || e) });
  }
});

// login: { login, password }
app.post("/api/auth/login", (req, res) => {
  try {
    const login = normalizeLogin(req.body?.login);
    const password = String(req.body?.password || "");
    if (!login || !password) return res.status(400).json({ ok: false, error: "login/password required" });

    const user = getUserByLogin(login);
    if (!user) return res.status(401).json({ ok: false, error: "Невірний логін або пароль" });
    if (!verifyPassword(password, user)) return res.status(401).json({ ok: false, error: "Невірний логін або пароль" });

    return res.json({ ok: true, user: publicUser(user) });
  } catch (e) {
    console.error("POST /api/auth/login error:", e);
    return res.status(500).json({ ok: false, error: "Server error", details: String(e?.message || e) });
  }
});

// me: ?userId=
app.get("/api/auth/me", (req, res) => {
  const userId = String(req.query.userId || "");
  if (!userId) return res.status(400).json({ ok: false, error: "userId required" });
  const user = getUserById(userId);
  if (!user) return res.status(404).json({ ok: false, error: "User not found" });
  return res.json({ ok: true, user: publicUser(user) });
});

// select server: { userId, serverId }
app.post("/api/auth/selectServer", (req, res) => {
  try {
    const userId = String(req.body?.userId || "");
    const serverId = String(req.body?.serverId || "");
    if (!userId || !serverId) return res.status(400).json({ ok: false, error: "userId/serverId required" });

    const db = getUsersDb();
    const idx = db.users.findIndex((u) => u && u.id === userId);
    if (idx === -1) return res.status(404).json({ ok: false, error: "User not found" });

    db.users[idx] = { ...db.users[idx], serverId };
    saveUsersDb(db.users);
    return res.json({ ok: true, user: publicUser(db.users[idx]) });
  } catch (e) {
    console.error("POST /api/auth/selectServer error:", e);
    return res.status(500).json({ ok: false, error: "Server error", details: String(e?.message || e) });
  }
});

// create character: { userId, type, gender, nickname }
app.post("/api/auth/createCharacter", (req, res) => {
  try {
    const userId = String(req.body?.userId || "");
    const type = req.body?.type;
    const gender = req.body?.gender;
    const nickname = req.body?.nickname;

    if (!userId) return res.status(400).json({ ok: false, error: "userId required" });
    if (!type || !["ninjutsu", "taijutsu", "genjutsu"].includes(type)) {
      return res.status(400).json({ ok: false, error: "Невірний тип героя" });
    }
    if (!gender || !["male", "female"].includes(gender)) {
      return res.status(400).json({ ok: false, error: "Невірний гендер" });
    }
    const nick = String(nickname || "").trim();
    if (!nick || nick.length < 2 || nick.length > 20) {
      return res.status(400).json({ ok: false, error: "Нік має бути 2-20 символів" });
    }

    const db = getUsersDb();
    const idx = db.users.findIndex((u) => u && u.id === userId);
    if (idx === -1) return res.status(404).json({ ok: false, error: "User not found" });
    const user = db.users[idx];
    if (!user.serverId) return res.status(400).json({ ok: false, error: "Спочатку обери сервер" });
    if (user.playerId) return res.status(409).json({ ok: false, error: "Персонаж вже створений" });

    const created = createPlayerAndSeed({ type, gender, nickname: nick, serverId: user.serverId });
    if (!created.ok) return res.status(409).json({ ok: false, error: created.error || "Не вдалося створити" });

    db.users[idx] = { ...user, playerId: created.player.id };
    saveUsersDb(db.users);

    return res.json({ ok: true, user: publicUser(db.users[idx]), player: created.player });
  } catch (e) {
    console.error("POST /api/auth/createCharacter error:", e);
    return res.status(500).json({ ok: false, error: "Server error", details: String(e?.message || e) });
  }
});

// ---------- ADMIN (hidden) ----------
// Enter admin mode: { userId, adminKey }
app.post("/api/admin/enter", (req, res) => {
  try {
    const userId = String(req.body?.userId || "");
    const adminKey = String(req.body?.adminKey || "");
    if (!userId) return res.status(400).json({ ok: false, error: "userId required" });

    const need = String(process.env.ADMIN_KEY || "");
    if (need && adminKey !== need) return res.status(401).json({ ok: false, error: "Bad admin key" });

    const db = getUsersDb();
    const uIdx = db.users.findIndex((u) => u && u.id === userId);
    if (uIdx === -1) return res.status(404).json({ ok: false, error: "User not found" });

    db.users[uIdx] = { ...db.users[uIdx], isAdminHidden: true };
    saveUsersDb(db.users);

    // якщо вже є персонаж — позначимо і його
    const playerId = db.users[uIdx].playerId;
    if (playerId) {
      let playersDb = readJSON("players.json", { players: [] });
      let playersArr = asArray(playersDb.players);
      const pIdx = playersArr.findIndex((p) => p && p.id === playerId);
      if (pIdx !== -1) {
        playersArr[pIdx] = { ...playersArr[pIdx], isAdminHidden: true };
        playersDb = setAsArray(playersDb, "players", playersArr);
        writeJSON("players.json", playersDb);
      }
    }

    return res.json({ ok: true, user: publicUser(db.users[uIdx]) });
  } catch (e) {
    console.error("POST /api/admin/enter error:", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// Exit admin mode: { userId }
app.post("/api/admin/exit", (req, res) => {
  try {
    const userId = String(req.body?.userId || "");
    if (!userId) return res.status(400).json({ ok: false, error: "userId required" });

    // захист: вихід дозволяємо тільки з правильним x-admin-key (або якщо ADMIN_KEY не заданий)
    if (!adminGuard(req, res)) return;

    const db = getUsersDb();
    const uIdx = db.users.findIndex((u) => u && u.id === userId);
    if (uIdx === -1) return res.status(404).json({ ok: false, error: "User not found" });

    db.users[uIdx] = { ...db.users[uIdx], isAdminHidden: false };
    saveUsersDb(db.users);

    const playerId = db.users[uIdx].playerId;
    if (playerId) {
      let playersDb = readJSON("players.json", { players: [] });
      let playersArr = asArray(playersDb.players);
      const pIdx = playersArr.findIndex((p) => p && p.id === playerId);
      if (pIdx !== -1) {
        playersArr[pIdx] = { ...playersArr[pIdx], isAdminHidden: false };
        playersDb = setAsArray(playersDb, "players", playersArr);
        writeJSON("players.json", playersDb);
      }
    }

    return res.json({ ok: true, user: publicUser(db.users[uIdx]) });
  } catch (e) {
    console.error("POST /api/admin/exit error:", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// Admin status (optional): ?userId=
app.get("/api/admin/status", (req, res) => {
  const userId = String(req.query.userId || "");
  if (!userId) return res.status(400).json({ ok: false, error: "userId required" });
  const user = getUserById(userId);
  if (!user) return res.status(404).json({ ok: false, error: "User not found" });
  return res.json({ ok: true, isAdminHidden: Boolean(user.isAdminHidden ?? false) });
});

// Update player fields (admin only): { playerId, patch }
app.post("/api/admin/player/update", (req, res) => {
  try {
    if (!adminGuard(req, res)) return;

    const playerId = String(req.body?.playerId || "");
    const patch = req.body?.patch || {};
    if (!playerId) return res.status(400).json({ ok: false, error: "playerId required" });

    const allowed = {
      silver: "silver",
      gold: "gold",
      coupons: "coupons",
      vip: "vip",
      svip: "svip",
    };

    let playersDb = readJSON("players.json", { players: [] });
    let playersArr = asArray(playersDb.players);
    const idx = playersArr.findIndex((p) => p && p.id === playerId);
    if (idx === -1) return res.status(404).json({ ok: false, error: "Player not found" });

    const cur = playersArr[idx].currency || {
      silver: Number(playersArr[idx].silver ?? 0),
      gold: Number(playersArr[idx].gold ?? 0),
      coupons: Number(playersArr[idx].coupons ?? 0),
    };

    const next = { ...playersArr[idx] };

    // currency
    const cNext = { ...cur };
    const cPatch = (patch && typeof patch === "object" ? (patch.currency || {}) : {});
    for (const k of ["silver", "gold", "coupons"]) {
      if (patch[k] !== undefined || cPatch[k] !== undefined) {
        const raw = (patch[k] !== undefined ? patch[k] : cPatch[k]);
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0) return res.status(400).json({ ok: false, error: `Bad ${k}` });
        cNext[k] = n;
      }
    }
    next.currency = cNext;

    // vip/svip
    for (const k of ["vip", "svip"]) {
      if (patch[k] !== undefined) {
        const n = Number(patch[k]);
        if (!Number.isFinite(n) || n < 0) return res.status(400).json({ ok: false, error: `Bad ${k}` });
        next[k] = n;
      }
    }

    playersArr[idx] = next;
    playersDb = setAsArray(playersDb, "players", playersArr);
    writeJSON("players.json", playersDb);

    return res.json({ ok: true, player: normalizePlayer(next) });
  } catch (e) {
    console.error("POST /api/admin/player/update error:", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// Create player
app.post("/api/hero/create", (req, res) => {
  try {
    const { type, gender, nickname } = req.body || {};

    if (!type || !["ninjutsu", "taijutsu", "genjutsu"].includes(type)) {
      return res.status(400).json({ ok: false, error: "Невірний тип героя" });
    }
    if (!gender || !["male", "female"].includes(gender)) {
      return res.status(400).json({ ok: false, error: "Невірний гендер" });
    }
    const nick = String(nickname || "").trim();
    if (!nick || nick.length < 2 || nick.length > 20) {
      return res.status(400).json({ ok: false, error: "Нік має бути 2-20 символів" });
    }

    const created = createPlayerAndSeed({ type, gender, nickname: nick, serverId: null });
    if (!created.ok) return res.status(409).json({ ok: false, error: created.error || "Не вдалося створити" });
    return res.json({ ok: true, player: created.player });
  } catch (e) {
    console.error("POST /api/hero/create error:", e);
    return res.status(500).json({ ok: false, error: "Server error", details: String(e?.message || e) });
  }
});

// Player me
app.get("/api/player/me", (req, res) => {
  const playerId = req.query.playerId;
  if (!playerId) return res.status(400).json({ ok: false, error: "playerId required" });

  const seed = ensurePlayerSeed(playerId);
  if (!seed.ok) return res.status(404).json({ ok: false, error: seed.error });

  const playersDbRaw = readJSON("players.json", { players: [] });
  const playersArr = asArray(playersDbRaw.players);
  const p0 = playersArr.find((x) => x && x.id === playerId);
  if (!p0) return res.status(404).json({ ok: false, error: "Player not found" });

  // Persisted online time (doesn't reset on refresh)
  // We accumulate time between calls using lastOnlineAt.
  const now = Date.now();
  const last = Number(p0.lastOnlineAt || 0);
  if (last > 0 && now > last) {
    // Cap delta to avoid huge jumps if server was offline (max 10 min per call)
    const deltaSec = Math.max(0, Math.min(600, Math.floor((now - last) / 1000)));
    p0.onlineSeconds = Number(p0.onlineSeconds || 0) + deltaSec;
  }
  p0.lastOnlineAt = now;
  // Save if we changed anything
  playersDbRaw.players = playersArr;
  writeJSON("players.json", playersDbRaw);

  const p = normalizePlayer(p0);
  return res.json({ ok: true, player: { ...p, expToNext: expToNext(p.level) } });
});

// Server time (fixed timezone for events)
app.get("/api/time", (req, res) => {
  try {
    const now = Date.now();
    const d = new Date(now);
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Dublin",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const timeText = fmt.format(d);
    return res.json({ ok: true, nowMs: now, timeText, tz: "Europe/Dublin" });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

// Add exp
app.post("/api/player/addExp", (req, res) => {
  const { playerId, amount } = req.body || {};
  if (!playerId) return res.status(400).json({ ok: false, error: "playerId required" });

  const seed = ensurePlayerSeed(playerId);
  if (!seed.ok) return res.status(404).json({ ok: false, error: seed.error });

  let playersDb = readJSON("players.json", { players: [] });
  let playersArr = asArray(playersDb.players);
  const idx = playersArr.findIndex((x) => x && x.id === playerId);
  if (idx === -1) return res.status(404).json({ ok: false, error: "Player not found" });

  const p = normalizePlayer(playersArr[idx]);
  p.exp = Number(p.exp || 0) + Number(amount || 0);

  while (p.exp >= expToNext(p.level)) {
    p.exp -= expToNext(p.level);
    p.level = Number(p.level || 1) + 1;
  }

  playersArr[idx] = { ...playersArr[idx], level: p.level, exp: p.exp, currency: p.currency, classType: p.classType };
  playersDb = setAsArray(playersDb, "players", playersArr);
  writeJSON("players.json", playersDb);

  return res.json({ ok: true, player: { ...normalizePlayer(playersArr[idx]), expToNext: expToNext(p.level) } });
});

// Heroes list
app.get("/api/heroes/list", (req, res) => {
  const playerId = req.query.playerId;
  if (!playerId) return res.status(400).json({ ok: false, error: "playerId required" });

  const seed = ensurePlayerSeed(playerId);
  if (!seed.ok) return res.status(404).json({ ok: false, error: seed.error });

  const playersDbRaw = readJSON("players.json", { players: [] });
  const playersArr = asArray(playersDbRaw.players);
  const p0 = playersArr.find((x) => x && x.id === playerId);
  const player = normalizePlayer(p0);
  if (JSON.stringify(player.skillBook || {}) !== JSON.stringify(p0.skillBook || {})) {
    p0.skillBook = player.skillBook;
    writeJSON("players.json", { players: playersArr });
  }

  let heroesDb = readJSON("heroes.json", { heroes: [] });
  let heroesArr = asArray(heroesDb.heroes);

  // ✅ Level/EXP sync rule:
  // - Main hero's level/exp must always match player's level/exp.
  // - Secondary heroes keep their own level/exp.
  let changed = false;
  heroesArr = heroesArr.map((h) => {
    if (!h || h.playerId !== playerId) return h;
    if (h.isMain && player) {
      const nl = Number(player.level || 1);
      const ne = Number(player.exp || 0);
      if (Number(h.level || 1) !== nl || Number(h.exp || 0) !== ne) {
        changed = true;
        return { ...h, level: nl, exp: ne };
      }
    }
    return h;
  });

  if (changed) {
    heroesDb = setAsArray(heroesDb, "heroes", heroesArr);
    writeJSON("heroes.json", heroesDb);
  }

  // ✅ Safety: dedupe secondary heroes by templateId (prevents "2 Sakura" cases).
  // Keep the first occurrence, remove the rest.
  const seenTpl = new Set();
  let deduped = false;
  const filtered = [];
  for (const h of heroesArr) {
    if (!h || h.playerId !== playerId) {
      filtered.push(h);
      continue;
    }
    if (h.isMain) {
      filtered.push(h);
      continue;
    }
    const key = h.templateId ? String(h.templateId) : `__id:${String(h.id)}`;
    if (seenTpl.has(key)) {
      deduped = true;
      continue;
    }
    seenTpl.add(key);
    filtered.push(h);
  }
  if (deduped) {
    heroesArr = filtered;
    heroesDb = setAsArray(heroesDb, "heroes", heroesArr);
    writeJSON("heroes.json", heroesDb);
  }

  const heroes = heroesArr
    .filter((h) => h && h.playerId === playerId)
    .map((h) => withComputedHero(playerId, h));

  return res.json({ ok: true, heroes });
});

// Add EXP to a specific hero (secondary heroes).
app.post("/api/heroes/addExp", (req, res) => {
  try {
    const { playerId, heroId, amount } = req.body || {};
    if (!playerId || !heroId) return res.status(400).json({ ok: false, error: "playerId, heroId required" });

    const seed = ensurePlayerSeed(playerId);
    if (!seed.ok) return res.status(404).json({ ok: false, error: seed.error });

    let heroesDb = readJSON("heroes.json", { heroes: [] });
    let heroesArr = asArray(heroesDb.heroes);
    const idx = heroesArr.findIndex((h) => h && h.id === heroId && h.playerId === playerId);
    if (idx === -1) return res.status(404).json({ ok: false, error: "Hero not found" });

    const h0 = heroesArr[idx];
    if (h0.isMain) {
      // Main hero EXP is player EXP.
      return res.status(400).json({ ok: false, error: "Use player/addExp for main hero" });
    }

    let level = Math.max(1, Number(h0.level || 1));
    let exp = Number(h0.exp || 0) + Number(amount || 0);

    while (level < EXP_MAX_LEVEL && exp >= expToNext(level)) {
      exp -= expToNext(level);
      level += 1;
    }
    if (level >= EXP_MAX_LEVEL) {
      level = EXP_MAX_LEVEL;
      exp = 0;
    }

    heroesArr[idx] = { ...h0, level, exp };
    heroesDb = setAsArray(heroesDb, "heroes", heroesArr);
    writeJSON("heroes.json", heroesDb);

    return res.json({ ok: true, hero: withComputedHero(playerId, heroesArr[idx]) });
  } catch (e) {
    console.error("POST /api/heroes/addExp error:", e);
    return res.status(500).json({ ok: false, error: "Server error", details: String(e?.message || e) });
  }
});

// Rename hero (secondary heroes only; GG rename can be done via player profile later)
app.post("/api/heroes/rename", (req, res) => {
  try {
    const { playerId, heroId, name } = req.body || {};
    if (!playerId || !heroId) return res.status(400).json({ ok: false, error: "playerId, heroId required" });
    const newName = String(name || "").trim();
    if (!newName) return res.status(400).json({ ok: false, error: "name required" });

    const seed = ensurePlayerSeed(playerId);
    if (!seed.ok) return res.status(404).json({ ok: false, error: seed.error });

    let heroesDb = readJSON("heroes.json", { heroes: [] });
    let heroesArr = asArray(heroesDb.heroes);
    const idx = heroesArr.findIndex((h) => h && h.id === heroId && h.playerId === playerId);
    if (idx === -1) return res.status(404).json({ ok: false, error: "Hero not found" });

    heroesArr[idx] = { ...heroesArr[idx], name: newName };
    heroesDb = setAsArray(heroesDb, "heroes", heroesArr);
    writeJSON("heroes.json", heroesDb);

    return res.json({ ok: true, hero: withComputedHero(playerId, heroesArr[idx]) });
  } catch (e) {
    console.error("POST /api/heroes/rename error:", e);
    return res.status(500).json({ ok: false, error: "Server error", details: String(e?.message || e) });
  }
});

// Inherit EXP between two heroes of the same player.
// body: { playerId, fromHeroId, toHeroId, percent: 10|20 }
// Rules (per NWK-like behavior):
// - source hero does NOT lose EXP
// - target hero gains floor(sourceTotalExp * percent/100)
// - target level recalculated by EXP table
// - currently capped by EXP_MAX_LEVEL (120)
app.post("/api/heroes/inheritExp", (req, res) => {
  try {
    const { playerId, fromHeroId, toHeroId, percent } = req.body || {};
    if (!playerId || !fromHeroId || !toHeroId) {
      return res.status(400).json({ ok: false, error: "playerId, fromHeroId, toHeroId required" });
    }
    if (String(fromHeroId) === String(toHeroId)) {
      return res.status(400).json({ ok: false, error: "Source and target must differ" });
    }
    const pct = Number(percent || 10);
    if (![10, 20].includes(pct)) {
      return res.status(400).json({ ok: false, error: "percent must be 10 or 20" });
    }

    const seed = ensurePlayerSeed(playerId);
    if (!seed.ok) return res.status(404).json({ ok: false, error: seed.error });

    // Load heroes
    let heroesDb = readJSON("heroes.json", { heroes: [] });
    let heroesArr = asArray(heroesDb.heroes);
    const fromIdx = heroesArr.findIndex((h) => h && h.id === fromHeroId && h.playerId === playerId);
    const toIdx = heroesArr.findIndex((h) => h && h.id === toHeroId && h.playerId === playerId);
    if (fromIdx === -1) return res.status(404).json({ ok: false, error: "Source hero not found" });
    if (toIdx === -1) return res.status(404).json({ ok: false, error: "Target hero not found" });

    const fromH = heroesArr[fromIdx];
    const toH = heroesArr[toIdx];

    // Cost (NWK-like): 10% for silver, 20% for gold.
    // NOTE: Simple fixed costs for now; can be replaced by a formula later.
    const INHERIT_COST_SILVER_10 = 10000;
    const INHERIT_COST_GOLD_20 = 10;
    const silverCost = pct === 10 ? INHERIT_COST_SILVER_10 : 0;
    const goldCost = pct === 20 ? INHERIT_COST_GOLD_20 : 0;

    if (silverCost || goldCost) {
      let playersDb = readJSON("players.json", { players: [] });
      let playersArr = asArray(playersDb.players);
      const pIdx = playersArr.findIndex((p) => p && p.id === playerId);
      if (pIdx === -1) return res.status(404).json({ ok: false, error: "Player not found" });
      const pNorm = normalizePlayer(playersArr[pIdx]);
      if (silverCost && (pNorm.currency?.silver || 0) < silverCost) {
        return res.status(400).json({ ok: false, error: "Not enough silver" });
      }
      if (goldCost && (pNorm.currency?.gold || 0) < goldCost) {
        return res.status(400).json({ ok: false, error: "Not enough gold" });
      }
      pNorm.currency.silver = (pNorm.currency.silver || 0) - silverCost;
      pNorm.currency.gold = (pNorm.currency.gold || 0) - goldCost;
      playersArr[pIdx] = { ...playersArr[pIdx], currency: pNorm.currency, silver: pNorm.currency.silver, gold: pNorm.currency.gold };
      playersDb = setAsArray(playersDb, "players", playersArr);
      writeJSON("players.json", playersDb);
    }

    const totalFrom = heroTotalExp(fromH);
    const gain = Math.floor((totalFrom * pct) / 100);
    const totalTo = heroTotalExp(toH);
    const newTotal = totalTo + gain;
    const { level, exp } = levelFromTotalExp(newTotal);

    heroesArr[toIdx] = { ...toH, level, exp };
    heroesDb = setAsArray(heroesDb, "heroes", heroesArr);
    writeJSON("heroes.json", heroesDb);

    // Return updated currency for immediate client refresh
    const pAfter = readJSON("players.json", { players: [] });
    const pArrAfter = asArray(pAfter.players);
    const pRec = pArrAfter.find((p) => p && p.id === playerId);
    const pNormAfter = pRec ? normalizePlayer(pRec) : null;

    return res.json({
      ok: true,
      gained: gain,
      cost: { silver: silverCost, gold: goldCost },
      playerCurrency: pNormAfter?.currency || null,
      hero: withComputedHero(playerId, heroesArr[toIdx]),
    });
  } catch (e) {
    console.error("POST /api/heroes/inheritExp error:", e);
    return res.status(500).json({ ok: false, error: "Server error", details: String(e?.message || e) });
  }
});

// Formation get
app.get("/api/formation/get", (req, res) => {
  const playerId = req.query.playerId;
  if (!playerId) return res.status(400).json({ ok: false, error: "playerId required" });

  const seed = ensurePlayerSeed(playerId);
  if (!seed.ok) return res.status(404).json({ ok: false, error: seed.error });

  const db = readJSON("formations.json", { formations: [] });
  const arr = asArray(db.formations);
  const rec = arr.find((x) => x && x.playerId === playerId);

  return res.json({
    ok: true,
    formation: rec?.formation || { top: [null, null], middle: [null, null, null], bottom: [null, null] },
  });
});

// Formation set
app.post("/api/formation/set", (req, res) => {
  const { playerId, formation } = req.body || {};
  if (!playerId) return res.status(400).json({ ok: false, error: "playerId required" });
  if (!formation) return res.status(400).json({ ok: false, error: "formation required" });

  const seed = ensurePlayerSeed(playerId);
  if (!seed.ok) return res.status(404).json({ ok: false, error: seed.error });

  const f = formation || {};
  if (!Array.isArray(f.top) || f.top.length !== 2) f.top = [null, null];
  if (!Array.isArray(f.middle) || f.middle.length !== 3) f.middle = [null, null, null];
  if (!Array.isArray(f.bottom) || f.bottom.length !== 2) f.bottom = [null, null];

  // ✅ максимум 5 героїв у формації
  const uniq = new Set([...f.top, ...f.middle, ...f.bottom].filter(Boolean));
  if (uniq.size > 5) return res.status(400).json({ ok: false, error: "Formation limit: max 5 heroes" });

  // ✅ герої у формації мають належати гравцю
  const heroesDb = readJSON("heroes.json", { heroes: [] });
  const owned = new Set(asArray(heroesDb.heroes).filter((h) => h && h.playerId === playerId).map((h) => h.id));
  for (const hid of uniq) {
    if (!owned.has(hid)) return res.status(400).json({ ok: false, error: "Formation contains unknown hero" });
  }

  let db = readJSON("formations.json", { formations: [] });
  let arr = asArray(db.formations);
  const idx = arr.findIndex((x) => x && x.playerId === playerId);

  if (idx === -1) arr.push({ playerId, formation: f });
  else arr[idx].formation = f;

  db = setAsArray(db, "formations", arr);
  writeJSON("formations.json", db);

  return res.json({ ok: true });
});

// Inventory get
app.get("/api/inventory/get", (req, res) => {
  const playerId = req.query.playerId;
  if (!playerId) return res.status(400).json({ ok: false, error: "playerId required" });

  const seed = ensurePlayerSeed(playerId);
  if (!seed.ok) return res.status(404).json({ ok: false, error: seed.error });

  const db = readJSON("inventories.json", { inventories: [] });
  const arr = asArray(db.inventories);
  const rec = arr.find((x) => x && x.playerId === playerId);
  const inv = ensureInvDefaults(rec?.inventory || {});

  // Star gems keep exp => must be non-stackable
  splitStarStacks(inv);

  // normalize equipped items to include gemSlots for clothes
  for (const heroId of Object.keys(inv.equippedItemsByHero || {})) {
    const eq = inv.equippedItemsByHero[heroId] || {};
    for (const s of ["weapon","armor","head","cloak","belt","shoes"]) {
      const it = eq[s];
      if (it && typeof it === "object") ensureGemSlotsOnItem(it);
    }
  }

  if (rec) {
    rec.inventory = inv;
    writeJSON("inventories.json", { inventories: arr });
  }

  return res.json({ ok: true, inventory: inv });
});

// Expand bag capacity
// - Mode "level": free at lvl 10/20/30... once each
// - Mode "paid": price starts at 20 and grows x1.5 each slot; pay coupons first then gold
// - Mode "online": claim +1 slot per full hour online (claimed hours tracked in inventory.onlineClaims)
app.post("/api/inventory/expand", (req, res) => {
  try {
    const { playerId, mode } = req.body || {};
    if (!playerId) return res.status(400).json({ ok: false, error: "playerId required" });

    // Ensure player exists + all seed files are present.
    // NOTE: ensurePlayerSeed() historically returns only {ok:true} and does NOT
    // expose the players DB record. So we must re-load and update players.json
    // ourselves inside this endpoint.
    const seed = ensurePlayerSeed(playerId);
    if (!seed.ok) return res.status(404).json({ ok: false, error: seed.error });

    const playersDbRaw = readJSON("players.json", { players: [] });
    const playersArr = asArray(playersDbRaw.players);
    const p0 = playersArr.find((x) => x && x.id === playerId);
    if (!p0) return res.status(404).json({ ok: false, error: "Player not found" });
    const p = normalizePlayer(p0);

    const invDb = readJSON("inventories.json", { inventories: [] });
    const arr = asArray(invDb.inventories);
    const rec = arr.find((x) => x && x.playerId === playerId) || { playerId, inventory: {} };
    if (!arr.includes(rec)) arr.push(rec);
    const inv = ensureInvDefaults(rec.inventory || {});

    const nextFreeLevel = 10 * (inv.freeExpands.length + 1);
    let extra = null;

    if (mode === "level") {
      if (p.level < nextFreeLevel) {
        return res.json({ ok: false, error: `need_level_${nextFreeLevel}`, nextFreeLevel });
      }
      inv.capacity = Math.min(9999, Number(inv.capacity) + 1);
      inv.freeExpands.push(nextFreeLevel);
    } else if (mode === "online") {
      const totalHours = Math.floor((Number(p.onlineSeconds || 0)) / 3600);
      const claimable = Math.max(0, totalHours - Number(inv.onlineClaims || 0));
      if (claimable <= 0) {
        return res.json({ ok: false, error: "no_hours", claimable: 0, totalHours, onlineClaims: inv.onlineClaims });
      }
      inv.capacity = Math.min(9999, Number(inv.capacity) + 1);
      inv.onlineClaims = Number(inv.onlineClaims || 0) + 1;
      extra = { claimable: claimable - 1, totalHours, onlineClaims: inv.onlineClaims };
      // continue to persist inventory below
    } else if (mode === "paid") {
      // Price: 20 * 1.5^paidExpands (ceil)
      const n = Math.max(0, Number(inv.paidExpands || 0));
      const base = 20;
      const cost = Math.ceil(base * Math.pow(1.5, n));

      // Pay coupons first, then gold
      const haveC = Number(p.currency.coupons || 0);
      const haveG = Number(p.currency.gold || 0);
      let need = cost;
      const useC = Math.min(haveC, need);
      need -= useC;
      const useG = Math.min(haveG, need);
      need -= useG;
      if (need > 0) return res.json({ ok: false, error: "not_enough_currency", cost, coupons: haveC, gold: haveG });

      p.currency.coupons = haveC - useC;
      p.currency.gold = haveG - useG;

      inv.capacity = Math.min(9999, Number(inv.capacity) + 1);
      inv.paidExpands = n + 1;

      // Persist currency back to players.json (support both new and legacy fields)
      p0.currency = { ...p0.currency, ...p.currency };
      p0.gold = p.currency.gold;
      p0.coupons = p.currency.coupons;
      playersDbRaw.players = playersArr;
      writeJSON("players.json", playersDbRaw);
    } else {
      return res.status(400).json({ ok: false, error: "mode must be level|paid|online" });
    }

    rec.inventory = inv;
    writeJSON("inventories.json", { inventories: arr });

    return res.json({ ok: true, capacity: inv.capacity, freeExpands: inv.freeExpands, paidExpands: inv.paidExpands, onlineClaims: inv.onlineClaims, currency: p.currency, nextFreeLevel, ...(extra||{}) });
  } catch (e) {
    console.error("inventory/expand error", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

// Equip
app.post("/api/inventory/equip", (req, res) => {
  try {
    const { playerId, heroId, itemId, equipSlot } = req.body || {};
    if (!playerId || !heroId || !itemId) return res.status(400).json({ ok: false, error: "playerId, heroId, itemId required" });

    const seed = ensurePlayerSeed(playerId);
    if (!seed.ok) return res.status(404).json({ ok: false, error: seed.error });

    let invDb = readJSON("inventories.json", { inventories: [] });
    let invArr = asArray(invDb.inventories);
    let invRec = invArr.find((x) => x && x.playerId === playerId);
    if (!invRec) return res.status(404).json({ ok: false, error: "Inventory not found" });

    const inv = invRec.inventory || {};
    inv.bagItems = Array.isArray(inv.bagItems) ? inv.bagItems : [];
    inv.equippedItemsByHero = inv.equippedItemsByHero && typeof inv.equippedItemsByHero === "object" ? inv.equippedItemsByHero : {};
    inv.equippedItemsByHero[heroId] = inv.equippedItemsByHero[heroId] || {
      weapon: null,
      armor: null,
      head: null,
      cloak: null,
      belt: null,
      shoes: null,
      // legacy
      jewelry: null,
      // new 8 jewelry slots
      j1: null, j2: null, j3: null, j4: null, j5: null, j6: null, j7: null, j8: null,
    };

    const item = inv.bagItems.find((x) => x && x.id === itemId);
    if (!item) return res.status(404).json({ ok: false, error: "Item not found in bag" });

    // Prevent equipping the same instance on multiple heroes (hard lock by instance id)
    for (const [hid, eqMap] of Object.entries(inv.equippedItemsByHero || {})) {
      for (const v of Object.values(eqMap || {})) {
        if (v && v.id === itemId) {
          return res.status(400).json({ ok: false, error: "item_already_equipped" });
        }
      }
    }
    // Slot can be omitted on item instance; resolve from catalog by tplId.
    if (!item.slot) {
      const tpl = getItemsCatalog().map.get(String(item.tplId || ""));
      if (tpl?.slot) item.slot = tpl.slot;
    }
    if (!item.slot) return res.status(400).json({ ok: false, error: "Item has no slot" });

    const allowedClothes = new Set(["weapon", "armor", "head", "cloak", "belt", "shoes"]);

    // init gem slots for clothes items
    if (allowedClothes.has(String(item.slot))) {
      ensureGemSlotsOnItem(item);
    }
    const jewelrySlots = ["j1","j2","j3","j4","j5","j6","j7","j8"];

    const isJewelry = String(item.slot) === "jewelry" || String(item.type || "").toLowerCase() === "jewelry";

    // Jewelry rules (slot -> required main stat type)
    const JEWELRY_RULE = {
      j1: "spirit",
      j2: "chakra",
      j3: "agility",
      j4: "spirit",
      j5: "chakra",
      j6: "agility",
      j7: "might",
      j8: "might",
    };

    const resolveJewelryStatType = (it) => {
      const tpl = getItemsCatalog().map.get(String(it.tplId || ""));
      const v = it.jewelryStatType || tpl?.jewelryStatType || tpl?.statType || null;
      const s = String(v || "").toLowerCase();
      if (!s) return null;
      if (["spirit", "chakra", "agility", "might"].includes(s)) return s;
      return null;
    };

    const pickJewelrySlot = () => {
      const desired = equipSlot ? String(equipSlot) : "";
      const desiredKey = desired ? (desired.startsWith("j") ? desired : `j${desired}`) : "";

      const statType = resolveJewelryStatType(item);

      // If user explicitly picked a target slot: validate + allow (and enforce stat if present)
      if (desiredKey && jewelrySlots.includes(desiredKey)) {
        const need = JEWELRY_RULE[desiredKey];
        if (statType && need && statType !== need) {
          return { ok: false, error: `jewelry_slot_requires_${need}` };
        }
        return { ok: true, slot: desiredKey };
      }

      // Auto: choose first empty compatible slot, else first compatible slot
      const eq = inv.equippedItemsByHero[heroId] || {};
      const compatible = jewelrySlots.filter((k) => {
        const need = JEWELRY_RULE[k];
        return !statType || !need || statType === need;
      });
      const empty = compatible.find((k) => !eq[k]);
      if (empty) return { ok: true, slot: empty };
      if (compatible.length) return { ok: true, slot: compatible[0] };
      return { ok: false, error: "no_compatible_jewelry_slot" };
    };

    let targetSlot = String(item.slot);
    if (isJewelry) {
      const pick = pickJewelrySlot();
      if (!pick.ok) return res.status(400).json({ ok: false, error: pick.error });
      targetSlot = pick.slot;
    } else {
      if (!allowedClothes.has(targetSlot)) {
        return res.status(400).json({ ok: false, error: `Bad slot: ${targetSlot}` });
      }

      // Weapon restrictions by hero class
      if (targetSlot === "weapon") {
        const heroesDb = readJSON("heroes.json", { heroes: [] });
        const hero = asArray(heroesDb.heroes).find((h) => h && h.id === heroId && h.playerId === playerId);
        const heroClass = String(hero?.classType || hero?.type || "").toLowerCase();

        const tpl = getItemsCatalog().map.get(String(item.tplId || ""));
        const weaponKind = String(item.weaponKind || tpl?.weaponKind || "").toLowerCase();

        // Allowed:
        // - taijutsu & ninjutsu: kunai, shuriken
        // - ninjutsu only: scroll
        if (weaponKind === "scroll") {
          if (heroClass !== "ninjutsu") return res.status(400).json({ ok: false, error: "weapon_scroll_requires_ninjutsu" });
        } else if (weaponKind === "kunai" || weaponKind === "shuriken") {
          if (!(heroClass === "taijutsu" || heroClass === "ninjutsu")) {
            return res.status(400).json({ ok: false, error: "weapon_requires_taijutsu_or_ninjutsu" });
          }
        }
      }
    }

    // Move item from bag -> equip (no duplicates)
    const idx = inv.bagItems.findIndex((x) => x && x.id === itemId);
    if (idx === -1) return res.status(404).json({ ok: false, error: "Item not found in bag" });
    const moving = inv.bagItems.splice(idx, 1)[0];

    // If slot already has item -> move it back to bag (or temp if full)
    const prev = inv.equippedItemsByHero[heroId][targetSlot];
    if (prev) {
      const bagHasSpace = inv.bagItems.length < Number(inv.capacity || 30);
      if (bagHasSpace) inv.bagItems.push(prev);
      else {
        inv.tempBagItems = Array.isArray(inv.tempBagItems) ? inv.tempBagItems : [];
        inv.tempBagItems.push(prev);
      }
    }

    inv.equippedItemsByHero[heroId][targetSlot] = moving;

    invRec.inventory = inv;
    invDb = setAsArray(invDb, "inventories", invArr);
    writeJSON("inventories.json", invDb);

    return res.json({ ok: true, inventory: inv });
  } catch (e) {
    console.error("equip error:", e);
    return res.status(500).json({ ok: false, error: "Server error", details: String(e?.message || e) });
  }
});

// Unequip
app.post("/api/inventory/unequip", (req, res) => {
  try {
    const { playerId, heroId, slot } = req.body || {};
    if (!playerId || !heroId || !slot) return res.status(400).json({ ok: false, error: "playerId, heroId, slot required" });

    const seed = ensurePlayerSeed(playerId);
    if (!seed.ok) return res.status(404).json({ ok: false, error: seed.error });

    let invDb = readJSON("inventories.json", { inventories: [] });
    let invArr = asArray(invDb.inventories);
    let invRec = invArr.find((x) => x && x.playerId === playerId);
    if (!invRec) return res.status(404).json({ ok: false, error: "Inventory not found" });

    const inv = invRec.inventory || {};
    inv.equippedItemsByHero = inv.equippedItemsByHero && typeof inv.equippedItemsByHero === "object" ? inv.equippedItemsByHero : {};
    inv.bagItems = Array.isArray(inv.bagItems) ? inv.bagItems : [];
    inv.tempBagItems = Array.isArray(inv.tempBagItems) ? inv.tempBagItems : [];
    inv.capacity = Number(inv.capacity || 30);

    inv.equippedItemsByHero[heroId] = inv.equippedItemsByHero[heroId] || {
      weapon: null,
      armor: null,
      head: null,
      cloak: null,
      belt: null,
      shoes: null,
      jewelry: null,
      j1: null, j2: null, j3: null, j4: null, j5: null, j6: null, j7: null, j8: null,
    };

    const cur = inv.equippedItemsByHero[heroId][slot];
    if (cur) {
      const hasSpace = inv.bagItems.length < inv.capacity;
      if (hasSpace) inv.bagItems.push(cur);
      else inv.tempBagItems.push(cur);
    }
    inv.equippedItemsByHero[heroId][slot] = null;

    invRec.inventory = inv;
    invDb = setAsArray(invDb, "inventories", invArr);
    writeJSON("inventories.json", invDb);

    return res.json({ ok: true, inventory: inv });
  } catch (e) {
    console.error("unequip error:", e);
    return res.status(500).json({ ok: false, error: "Server error", details: String(e?.message || e) });
  }
});

// Transfer all equipped items between heroes
// body: { playerId, fromHeroId, toHeroId, mode: "move"|"swap" }


// ===== GEMS: insert/remove (NW 1:1 core) =====
app.post("/api/gems/insert", (req, res) => {
  try {
    const { playerId, heroId, equipSlot, gemItemId } = req.body || {};
    if (!playerId || !heroId || !equipSlot || !gemItemId) return res.status(400).json({ ok: false, error: "playerId, heroId, equipSlot, gemItemId required" });

    const seed = ensurePlayerSeed(playerId);
    if (!seed.ok) return res.status(404).json({ ok: false, error: seed.error });

    const invDb = readJSON("inventories.json", { inventories: [] });
    const arr = asArray(invDb.inventories);
    const rec = arr.find((x) => x && x.playerId === playerId);
    if (!rec) return res.status(404).json({ ok: false, error: "Inventory not found" });

    const inv = ensureInvDefaults(rec.inventory || {});
    inv.equippedItemsByHero[heroId] = inv.equippedItemsByHero[heroId] || { weapon:null, armor:null, head:null, cloak:null, belt:null, shoes:null, jewelry:null, j1:null,j2:null,j3:null,j4:null,j5:null,j6:null,j7:null,j8:null };

    const slotKey = String(equipSlot);
    const allowed = new Set(["weapon","armor","head","cloak","belt","shoes"]);
    if (!allowed.has(slotKey)) return res.status(400).json({ ok: false, error: "equipSlot_invalid" });

    const item = inv.equippedItemsByHero[heroId]?.[slotKey];
    if (!item) return res.status(400).json({ ok: false, error: "no_item_in_slot" });
    ensureGemSlotsOnItem(item);

    const gem = inv.bagItems.find(x => x && x.id === gemItemId);
    if (!gem) return res.status(404).json({ ok: false, error: "gem_not_found_in_bag" });

    const { map } = getItemsCatalog();
    const tpl = map.get(String(gem.tplId || ""));
    if (!tpl || String(tpl.type) !== "gem") return res.status(400).json({ ok: false, error: "item_is_not_gem" });

    const target = String(tpl.gemTarget || "");
    const lvl = Number(tpl.gemLevel || tpl.gemStars || 0) || 0;

    let existingIdx = -1;
    let existingTpl = null;
    for (let i=0;i<item.gemSlots.length;i++){
      const gs=item.gemSlots[i];
      if(!gs?.open || !gs?.gem) continue;
      const gref=normalizeGemRef(gs.gem);
      const gt=gref? map.get(String(gref.tplId||"")) : null;
      if(gt && String(gt.gemTarget||"") === target){
        existingIdx=i; existingTpl=gt; break;
      }
    }

    const takeOneFromBag = () => {
      if (Number(gem.qty || 0) > 1) {
        gem.qty = Number(gem.qty) - 1;
        return { tplId: gem.tplId };
      }
      inv.bagItems = inv.bagItems.filter(x => x && x.id !== gemItemId);
      return { tplId: gem.tplId };
    };

    const putGemBack = (tplId) => {
      const t = map.get(String(tplId||""));
      if (!t) return;
      addTplToInventory(inv, t, 1);
    };

    if (existingIdx !== -1) {
      const oldLevel = Number(existingTpl?.gemLevel || existingTpl?.gemStars || 0) || 0;
      if (lvl > oldLevel) {
        const oldRef = normalizeGemRef(item.gemSlots[existingIdx].gem);
        item.gemSlots[existingIdx].gem = takeOneFromBag();
        if (oldRef?.tplId) putGemBack(oldRef.tplId);
      } else {
        rec.inventory = inv;
        writeJSON("inventories.json", { inventories: arr });
        return res.json({ ok: true, noChange: true, inventory: inv });
      }
    } else {
      const freeIdx = item.gemSlots.findIndex(gs => gs && gs.open && !gs.gem);
      if (freeIdx === -1) return res.json({ ok: false, error: "no_free_gem_slot" });
      item.gemSlots[freeIdx].gem = takeOneFromBag();
    }

    rec.inventory = inv;
    writeJSON("inventories.json", { inventories: arr });

    return res.json({ ok: true, inventory: inv });
  } catch (e) {
    console.error("/api/gems/insert error", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

app.post("/api/gems/remove", (req, res) => {
  try {
    const { playerId, heroId, equipSlot, gemSlotIndex } = req.body || {};
    if (!playerId || !heroId || !equipSlot || gemSlotIndex == null) return res.status(400).json({ ok: false, error: "playerId, heroId, equipSlot, gemSlotIndex required" });

    const seed = ensurePlayerSeed(playerId);
    if (!seed.ok) return res.status(404).json({ ok: false, error: seed.error });

    const invDb = readJSON("inventories.json", { inventories: [] });
    const arr = asArray(invDb.inventories);
    const rec = arr.find((x) => x && x.playerId === playerId);
    if (!rec) return res.status(404).json({ ok: false, error: "Inventory not found" });

    const inv = ensureInvDefaults(rec.inventory || {});
    const slotKey = String(equipSlot);
    const item = inv.equippedItemsByHero?.[heroId]?.[slotKey];
    if (!item) return res.json({ ok: true, noChange: true, inventory: inv });
    ensureGemSlotsOnItem(item);

    const idx = Number(gemSlotIndex);
    if (!Number.isFinite(idx) || idx < 0 || idx >= item.gemSlots.length) return res.status(400).json({ ok: false, error: "gemSlotIndex_invalid" });

    const gs = item.gemSlots[idx];
    if (!gs?.open || !gs?.gem) return res.json({ ok: true, noChange: true, inventory: inv });

    const { map } = getItemsCatalog();
    const gref = normalizeGemRef(gs.gem);
    gs.gem = null;
    if (gref?.tplId) {
      const tpl = map.get(String(gref.tplId||""));
      if (tpl) addTplToInventory(inv, tpl, 1);
    }

    rec.inventory = inv;
    writeJSON("inventories.json", { inventories: arr });

    return res.json({ ok: true, inventory: inv });
  } catch (e) {
    console.error("/api/gems/remove error", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});


// ===== GEMS: synthesize (12->1) + star upgrade + unlock slots =====

// ===== GEMS CORE 2.1 (NW):
// Tabs mapping:
// 1) Вставка  - already implemented (insert/remove)
// 2) Улучшение - 2 одинаковых -> 1 следующего уровня (включая Ярость)
// 3) Пробуждение - самоцвет 12 уровня -> Звёздный ★0 за 2000 (купон+золото)
// 4) Звёздные - прокачка звёздных камней через EXP (с шансом / 100% за золото)

const STAR_EXP_REQ = {
  // level 1..10 requirements (delta per star up)
  chakra: [2250, 3375, 5070, 7605, 11415, 17130, 25695, 38550, 57825, 86745], // Дракон
  agility: [3000, 4500, 6760, 10140, 15220, 22840, 34260, 51400, 77100, 115660], // Тигр
  spirit: [1500, 2250, 3380, 5070, 7610, 11420, 17130, 25700, 38550, 57830], // Зяблик
  might: [1500, 2250, 3380, 5070, 7610, 11420, 17130, 25700, 38550, 57825], // Черепаха (ХП)
};

const FEED_EXP_BY_LEVEL = [12, 24, 48, 96, 192, 384, 768, 1536, 3072, 6144, 12288, 24576];
const FEED_SAFE_GOLD_BY_LEVEL = [5, 10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120, 10240];

function isStarGemTplId(tplId) {
  return String(tplId || "").startsWith("gem_star_");
}

function splitStarStacks(inv) {
  // Star gems must be non-stackable because they have exp.
  const out = [];
  for (const it of inv.bagItems || []) {
    if (!it) continue;
    if (!isStarGemTplId(it.tplId)) {
      out.push(it);
      continue;
    }
    const q = Math.max(1, Number(it.qty || 1));
    const meta = it.meta && typeof it.meta === "object" ? it.meta : {};
    const exp = Number(meta.exp || 0);
    if (q === 1) {
      it.qty = 1;
      it.meta = { ...meta, exp: Number.isFinite(exp) ? exp : 0 };
      out.push(it);
      continue;
    }
    for (let i = 0; i < q; i++) {
      out.push({
        id: `${it.id || "star"}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        tplId: it.tplId,
        qty: 1,
        meta: { exp: 0 },
      });
    }
  }
  inv.bagItems = out;
}

function addStarGem(inv, tplId, exp = 0) {
  inv.bagItems = inv.bagItems || [];
  inv.bagItems.push({
    id: `star_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    tplId: String(tplId),
    qty: 1,
    meta: { exp: Math.max(0, Math.floor(Number(exp) || 0)) },
  });
}

function _takeFromBagByTpl(inv, tplId, qty) {
  qty = Math.max(0, Number(qty || 0));
  if (!qty) return 0;
  let left = qty;
  for (const it of inv.bagItems || []) {
    if (!it || String(it.tplId || "") !== String(tplId)) continue;
    const q = Number(it.qty || 1);
    if (q > 1) {
      const take = Math.min(q, left);
      it.qty = q - take;
      left -= take;
      if (it.qty <= 0) it._del = true;
    } else {
      it._del = true;
      left -= 1;
    }
    if (!left) break;
  }
  inv.bagItems = (inv.bagItems || []).filter((x) => x && !x._del);
  return qty - left;
}

function _countInBagByTpl(inv, tplId) {
  let n = 0;
  for (const it of inv.bagItems || []) {
    if (!it || String(it.tplId || "") !== String(tplId)) continue;
    n += Number(it.qty || 1);
  }
  return n;
}

function _findTpl(map, tplId) {
  return map.get(String(tplId || "")) || null;
}

function _gemKeyFromTplId(tplId) {
  const s = String(tplId || "");
  const m = s.match(/^gem_([a-zA-Z]+[a-zA-Z0-9]*)_(\d+)$/);
  if (!m) return null;
  return { key: m[1], level: Number(m[2] || 0) };
}

// Улучшение: 2 одинаковых самоцвита -> 1 следующего уровня (включая Ярость)
app.post("/api/gems/synthesize", (req, res) => {
  try {
    const { playerId, fromTplId, times } = req.body || {};
    if (!playerId || !fromTplId) return res.status(400).json({ ok: false, error: "playerId, fromTplId required" });

    const seed = ensurePlayerSeed(playerId);
    if (!seed.ok) return res.status(404).json({ ok: false, error: seed.error });

    const invDb = readJSON("inventories.json", { inventories: [] });
    const arr = asArray(invDb.inventories);
    const rec = arr.find((x) => x && x.playerId === playerId);
    if (!rec) return res.status(404).json({ ok: false, error: "Inventory not found" });

    const inv = ensureInvDefaults(rec.inventory || {});
    const { map } = getItemsCatalog();
    const tpl = _findTpl(map, fromTplId);
    if (!tpl || String(tpl.type) !== "gem") return res.status(400).json({ ok: false, error: "not_a_gem" });

    if (String(tpl.tplId || "").startsWith("gem_star_")) return res.status(400).json({ ok: false, error: "star_not_allowed" });

    const parsed = _gemKeyFromTplId(tpl.tplId);
    if (!parsed) return res.status(400).json({ ok: false, error: "bad_gem_tpl" });

    const lvl = Number(tpl.gemLevel || parsed.level || 0);
    const t = Math.max(1, Math.min(9999, Number(times || 1)));
    const needPer = 2;

    // Allow fury upgrade chain (gem_fury_4..12)
    if (String(tpl.gemTarget || "") === "initialFury") {
      if (lvl < 4 || lvl > 11) return res.status(400).json({ ok: false, error: "fury_level_out_of_range" });
      const toTplId = `gem_fury_${lvl + 1}`;
      const toTpl = _findTpl(map, toTplId);
      if (!toTpl) return res.status(400).json({ ok: false, error: "to_tpl_missing", toTplId });

      const can = Math.floor(_countInBagByTpl(inv, tpl.tplId) / needPer);
      const doTimes = Math.min(t, can);
      if (doTimes <= 0) return res.json({ ok: true, noChange: true, can: 0, inventory: inv });

      const taken = _takeFromBagByTpl(inv, tpl.tplId, doTimes * needPer);
      if (taken < doTimes * needPer) return res.status(400).json({ ok: false, error: "not_enough_items" });

      addTplToInventory(inv, toTpl, doTimes);
      rec.inventory = inv;
      writeJSON("inventories.json", { inventories: arr });
      return res.json({ ok: true, made: doTimes, toTplId, inventory: inv });
    }

    // Normal gems upgrade (lvl1..11). lvl12 cannot be upgraded here.
    if (lvl >= 1 && lvl <= 11) {
      const toTplId = `gem_${parsed.key}_${lvl + 1}`;
      const toTpl = _findTpl(map, toTplId);
      if (!toTpl) return res.status(400).json({ ok: false, error: "to_tpl_missing", toTplId });

      const can = Math.floor(_countInBagByTpl(inv, tpl.tplId) / needPer);
      const doTimes = Math.min(t, can);
      if (doTimes <= 0) return res.json({ ok: true, noChange: true, can: 0, inventory: inv });

      const taken = _takeFromBagByTpl(inv, tpl.tplId, doTimes * needPer);
      if (taken < doTimes * needPer) return res.status(400).json({ ok: false, error: "not_enough_items" });

      addTplToInventory(inv, toTpl, doTimes);
      rec.inventory = inv;
      writeJSON("inventories.json", { inventories: arr });
      return res.json({ ok: true, made: doTimes, toTplId, inventory: inv });
    }

    if (lvl === 12) {
      return res.status(400).json({ ok: false, error: "use_awaken" });
    }

    return res.status(400).json({ ok: false, error: "unsupported_level" });
  } catch (e) {
    console.error("/api/gems/synthesize error", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

// Пробуждение: самоцвет 12 уровня -> Звёздный ★0
// Стоимость: 2000 (сначала купоны, затем золото; если купонов не хватает - остаток золотом)
app.post("/api/gems/awaken", (req, res) => {
  try {
    const { playerId, fromTplId } = req.body || {};
    if (!playerId || !fromTplId) return res.status(400).json({ ok: false, error: "playerId, fromTplId required" });

    const seed = ensurePlayerSeed(playerId);
    if (!seed.ok) return res.status(404).json({ ok: false, error: seed.error });

    const pdb = readJSON("players.json", { players: [] });
    const parr = asArray(pdb.players);
    const pIdx = parr.findIndex((p) => p && p.id === playerId);
    if (pIdx === -1) return res.status(404).json({ ok: false, error: "Player not found" });
    const p = normalizePlayer(parr[pIdx]);

    const invDb = readJSON("inventories.json", { inventories: [] });
    const arr = asArray(invDb.inventories);
    const rec = arr.find((x) => x && x.playerId === playerId);
    if (!rec) return res.status(404).json({ ok: false, error: "Inventory not found" });
    const inv = ensureInvDefaults(rec.inventory || {});
    splitStarStacks(inv);

    const { map } = getItemsCatalog();
    const tpl = _findTpl(map, fromTplId);
    if (!tpl || String(tpl.type) !== "gem" || isStarGemTplId(tpl.tplId)) return res.status(400).json({ ok: false, error: "not_a_normal_gem" });

    const parsed = _gemKeyFromTplId(tpl.tplId);
    const lvl = Number(tpl.gemLevel || parsed?.level || 0);
    if (lvl !== 12) return res.status(400).json({ ok: false, error: "need_level_12" });

    const target = String(tpl.gemTarget || "");
    const starMap = { spirit: "spirit", agility: "agility", chakra: "chakra", might: "might" };
    if (!(target in starMap)) return res.status(400).json({ ok: false, error: "not_awakenable" });

    if (_countInBagByTpl(inv, tpl.tplId) < 1) return res.status(400).json({ ok: false, error: "not_enough_items" });

    const cost = 2000;
    const useCoupons = Math.min(Number(p.currency.coupons || 0), cost);
    const left = cost - useCoupons;
    if (Number(p.currency.gold || 0) < left) return res.status(400).json({ ok: false, error: "not_enough_currency", needGold: left, usedCoupons: useCoupons });

    p.currency.coupons -= useCoupons;
    p.currency.gold -= left;

    _takeFromBagByTpl(inv, tpl.tplId, 1);

    const toTplId = `gem_star_${starMap[target]}_0`;
    const toTpl = _findTpl(map, toTplId);
    if (!toTpl) return res.status(400).json({ ok: false, error: "to_star_missing", toTplId });

    addStarGem(inv, toTplId, 0);

    parr[pIdx] = p;
    writeJSON("players.json", { players: parr });
    rec.inventory = inv;
    writeJSON("inventories.json", { inventories: arr });

    return res.json({ ok: true, toTplId, paid: { coupons: useCoupons, gold: left }, inventory: inv, player: p });
  } catch (e) {
    console.error("/api/gems/awaken error", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

// Звёздные: кормление EXP
// Если safe=false: шанс успеха 50% на каждый камень (при фейле EXP не добавляется)
// Если safe=true: 100% успех, списываем золото по таблице стоимости
app.post("/api/gems/starFeed", (req, res) => {
  try {
    const { playerId, starItemId, feedTplId, qty, safe } = req.body || {};
    if (!playerId || !starItemId || !feedTplId) return res.status(400).json({ ok: false, error: "playerId, starItemId, feedTplId required" });

    const seed = ensurePlayerSeed(playerId);
    if (!seed.ok) return res.status(404).json({ ok: false, error: seed.error });

    const pdb = readJSON("players.json", { players: [] });
    const parr = asArray(pdb.players);
    const pIdx = parr.findIndex((p) => p && p.id === playerId);
    if (pIdx === -1) return res.status(404).json({ ok: false, error: "Player not found" });
    const p = normalizePlayer(parr[pIdx]);

    const invDb = readJSON("inventories.json", { inventories: [] });
    const arr = asArray(invDb.inventories);
    const rec = arr.find((x) => x && x.playerId === playerId);
    if (!rec) return res.status(404).json({ ok: false, error: "Inventory not found" });
    const inv = ensureInvDefaults(rec.inventory || {});
    splitStarStacks(inv);

    const starIt = (inv.bagItems || []).find((it) => it && String(it.id) === String(starItemId));
    if (!starIt || !isStarGemTplId(starIt.tplId)) return res.status(400).json({ ok: false, error: "star_item_not_found" });

    const { map } = getItemsCatalog();
    const feedTpl = _findTpl(map, feedTplId);
    if (!feedTpl || String(feedTpl.type) !== "gem" || isStarGemTplId(feedTpl.tplId)) return res.status(400).json({ ok: false, error: "bad_feed_gem" });

    const parsed = _gemKeyFromTplId(feedTpl.tplId) || (String(feedTpl.tplId||"").match(/^gem_fury_(\d+)$/) ? { level: Number(RegExp.$1), key: "fury" } : null);
    const lvl = Number(feedTpl.gemLevel || parsed?.level || 0);
    if (lvl < 1 || lvl > 12) return res.status(400).json({ ok: false, error: "feed_level_out_of_range" });

    const n = Math.max(1, Math.min(9999, Number(qty || 1)));
    if (_countInBagByTpl(inv, feedTpl.tplId) < n) return res.status(400).json({ ok: false, error: "not_enough_feed" });

    const safeMode = Boolean(safe);
    if (safeMode) {
      const cost = FEED_SAFE_GOLD_BY_LEVEL[lvl - 1] * n;
      if (Number(p.currency.gold || 0) < cost) return res.status(400).json({ ok: false, error: "not_enough_gold", cost });
      p.currency.gold -= cost;
    }

    _takeFromBagByTpl(inv, feedTpl.tplId, n);

    const perExp = FEED_EXP_BY_LEVEL[lvl - 1];
    let gained = 0;
    if (safeMode) {
      gained = perExp * n;
    } else {
      // 50% chance per gem
      for (let i = 0; i < n; i++) {
        if (Math.random() < 0.5) gained += perExp;
      }
    }

    const meta = starIt.meta && typeof starIt.meta === "object" ? starIt.meta : {};
    meta.exp = Math.max(0, Math.floor(Number(meta.exp || 0))) + gained;
    starIt.meta = meta;

    // Auto star level-up based on exp requirements
    const m = String(starIt.tplId).match(/^gem_star_([a-zA-Z]+)_(\d+)$/);
    if (!m) return res.status(400).json({ ok: false, error: "bad_star_tpl" });
    const kind = m[1];
    let stars = Number(m[2] || 0);
    if (!STAR_EXP_REQ[kind]) return res.status(400).json({ ok: false, error: "unknown_star_kind" });

    while (stars < 10) {
      const need = STAR_EXP_REQ[kind][stars]; // stars 0-> need level1
      if (meta.exp < need) break;
      meta.exp -= need;
      stars += 1;
      // change tplId to next stars
      starIt.tplId = `gem_star_${kind}_${stars}`;
    }

    parr[pIdx] = p;
    writeJSON("players.json", { players: parr });
    rec.inventory = inv;
    writeJSON("inventories.json", { inventories: arr });

    return res.json({ ok: true, gainedExp: gained, stars, inventory: inv, player: p });
  } catch (e) {
    console.error("/api/gems/starFeed error", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

app.post("/api/gems/unlockSlot", (req, res) => {
  try {
    const { playerId, heroId, equipSlot, gemSlotIndex } = req.body || {};
    if (!playerId || !heroId || !equipSlot || gemSlotIndex == null) return res.status(400).json({ ok: false, error: "playerId, heroId, equipSlot, gemSlotIndex required" });

    const seed = ensurePlayerSeed(playerId);
    if (!seed.ok) return res.status(404).json({ ok: false, error: seed.error });

    const invDb = readJSON("inventories.json", { inventories: [] });
    const arr = asArray(invDb.inventories);
    const rec = arr.find((x) => x && x.playerId === playerId);
    if (!rec) return res.status(404).json({ ok: false, error: "Inventory not found" });

    const inv = ensureInvDefaults(rec.inventory || {});
    const slotKey = String(equipSlot);
    const item = inv.equippedItemsByHero?.[heroId]?.[slotKey];
    if (!item) return res.status(400).json({ ok: false, error: "no_item_in_slot" });
    ensureGemSlotsOnItem(item);

    const idx = Number(gemSlotIndex);
    if (!Number.isFinite(idx) || idx < 0 || idx >= item.gemSlots.length) return res.status(400).json({ ok: false, error: "gemSlotIndex_invalid" });
    if (idx < 6) return res.status(400).json({ ok: false, error: "slot_is_default" });

    const gs = item.gemSlots[idx];
    if (gs.open) return res.json({ ok: true, noChange: true, inventory: inv });

    const matTplId = "mat_gem_slot_unlock";
    if (_countInBagByTpl(inv, matTplId) < 1) return res.status(400).json({ ok: false, error: "no_unlock_material" });

    _takeFromBagByTpl(inv, matTplId, 1);
    gs.open = true;

    rec.inventory = inv;
    writeJSON("inventories.json", { inventories: arr });
    return res.json({ ok: true, inventory: inv });
  } catch (e) {
    console.error("/api/gems/unlockSlot error", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

// Star upgrade: needs 2 copies of same star gem.
// - Chance mode: consumes 2; success => +1 star, fail => back 1 (so net -1)
// - Safe mode: 100% for gold; consumes 2; success always.
const STAR_UP_CHANCE = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 0.7, 7: 0.7, 8: 0.7, 9: 0.5 };
const STAR_SAFE_GOLD = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 10, 6: 25, 7: 60, 8: 120, 9: 250 };

app.post("/api/gems/starUpgrade", (req, res) => {
  try {
    const { playerId, fromTplId, safe } = req.body || {};
    if (!playerId || !fromTplId) return res.status(400).json({ ok: false, error: "playerId, fromTplId required" });

    const seed = ensurePlayerSeed(playerId);
    if (!seed.ok) return res.status(404).json({ ok: false, error: seed.error });

    const invDb = readJSON("inventories.json", { inventories: [] });
    const arr = asArray(invDb.inventories);
    const rec = arr.find((x) => x && x.playerId === playerId);
    if (!rec) return res.status(404).json({ ok: false, error: "Inventory not found" });

    const inv = ensureInvDefaults(rec.inventory || {});
    const { map } = getItemsCatalog();
    const tpl = _findTpl(map, fromTplId);
    if (!tpl || String(tpl.type) !== "gem" || !String(tpl.tplId || "").startsWith("gem_star_")) {
      return res.status(400).json({ ok: false, error: "not_a_star_gem" });
    }

    const stars = Number(tpl.gemStars ?? 0);
    if (!Number.isFinite(stars) || stars < 0 || stars >= 10) return res.status(400).json({ ok: false, error: "stars_out_of_range" });

    const toTplId = String(tpl.tplId).replace(/_(\d+)$/, `_${stars + 1}`);
    const toTpl = _findTpl(map, toTplId);
    if (!toTpl) return res.status(400).json({ ok: false, error: "to_star_missing", toTplId });

    if (_countInBagByTpl(inv, tpl.tplId) < 2) return res.status(400).json({ ok: false, error: "need_2_same_star_gems" });

    const isSafe = Boolean(safe);

    if (isSafe) {
      const cost = Number(STAR_SAFE_GOLD[stars] || 0);
      if (cost > 0) {
        const pdb = readJSON("players.json", { players: [] });
        const parr = asArray(pdb.players);
        const pIdx = parr.findIndex((p) => p && p.id === playerId);
        if (pIdx === -1) return res.status(404).json({ ok: false, error: "Player not found" });
        const p = normalizePlayer(parr[pIdx]);
        if (Number(p.currency.gold || 0) < cost) return res.status(400).json({ ok: false, error: "not_enough_gold", cost });
        p.currency.gold -= cost;
        parr[pIdx] = { ...parr[pIdx], currency: p.currency, gold: p.currency.gold, silver: p.currency.silver, coupons: p.currency.coupons };
        writeJSON("players.json", setAsArray(pdb, "players", parr));
      }
    }

    // take 2
    _takeFromBagByTpl(inv, tpl.tplId, 2);

    let success = true;
    if (!isSafe) {
      const chance = Number(STAR_UP_CHANCE[stars] ?? 0.5);
      success = Math.random() < chance;
    }

    if (success) {
      addTplToInventory(inv, toTpl, 1);
    } else {
      // fail: give back 1 same star
      addTplToInventory(inv, tpl, 1);
    }

    rec.inventory = inv;
    writeJSON("inventories.json", { inventories: arr });

    return res.json({ ok: true, success, fromTplId: tpl.tplId, toTplId, inventory: inv });
  } catch (e) {
    console.error("/api/gems/starUpgrade error", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});
app.post("/api/inventory/transferEquip", (req, res) => {
  try {
    const { playerId, fromHeroId, toHeroId, mode } = req.body || {};
    if (!playerId || !fromHeroId || !toHeroId) {
      return res.status(400).json({ ok: false, error: "playerId, fromHeroId, toHeroId required" });
    }
    const m = String(mode || "move");
    if (m !== "move" && m !== "swap") return res.status(400).json({ ok: false, error: "mode must be move|swap" });

    const seed = ensurePlayerSeed(playerId);
    if (!seed.ok) return res.status(404).json({ ok: false, error: seed.error });

    let invDb = readJSON("inventories.json", { inventories: [] });
    let invArr = asArray(invDb.inventories);
    let invRec = invArr.find((x) => x && x.playerId === playerId);
    if (!invRec) return res.status(404).json({ ok: false, error: "Inventory not found" });

    const inv = invRec.inventory || {};
    inv.bagItems = Array.isArray(inv.bagItems) ? inv.bagItems : [];
    inv.equippedItemsByHero = inv.equippedItemsByHero && typeof inv.equippedItemsByHero === "object" ? inv.equippedItemsByHero : {};

    const slots = [
      "weapon", "armor", "head", "cloak", "belt", "shoes",
      "jewelry", "j1", "j2", "j3", "j4", "j5", "j6", "j7", "j8",
    ];
    inv.equippedItemsByHero[fromHeroId] ||= { weapon: null, armor: null, jewelry: null, head: null, cloak: null, belt: null, shoes: null, j1:null,j2:null,j3:null,j4:null,j5:null,j6:null,j7:null,j8:null };
    inv.equippedItemsByHero[toHeroId] ||= { weapon: null, armor: null, jewelry: null, head: null, cloak: null, belt: null, shoes: null, j1:null,j2:null,j3:null,j4:null,j5:null,j6:null,j7:null,j8:null };
    const fromEq = inv.equippedItemsByHero[fromHeroId];
    const toEq = inv.equippedItemsByHero[toHeroId];

    if (m === "swap") {
      for (const s of slots) {
        const tmp = fromEq[s] || null;
        fromEq[s] = toEq[s] || null;
        toEq[s] = tmp;
      }
    } else {
      // move: move everything from -> to; existing items on target go to bag
      for (const s of slots) {
        if (toEq[s]) inv.bagItems.push(toEq[s]);
        toEq[s] = fromEq[s] || null;
        fromEq[s] = null;
      }
    }

    invRec.inventory = inv;
    invDb = setAsArray(invDb, "inventories", invArr);
    writeJSON("inventories.json", invDb);

    return res.json({ ok: true });
  } catch (e) {
    console.error("transferEquip error:", e);
    return res.status(500).json({ ok: false, error: "Server error", details: String(e?.message || e) });
  }
});


// Activate item (e.g., hero token)
app.post("/api/inventory/activate", (req, res) => {
  try {
    const { playerId, itemId, qty } = req.body || {};
    if (!playerId || !itemId) return res.status(400).json({ ok: false, error: "playerId, itemId required" });

    const seed = ensurePlayerSeed(playerId);
    if (!seed.ok) return res.status(404).json({ ok: false, error: seed.error });

    let invDb = readJSON("inventories.json", { inventories: [] });
    let invArr = asArray(invDb.inventories);
    let invRec = invArr.find((x) => x && x.playerId === playerId);
    if (!invRec) return res.status(404).json({ ok: false, error: "Inventory not found" });

    const inv = invRec.inventory || {};
    inv.bagItems = Array.isArray(inv.bagItems) ? inv.bagItems : [];

    const idx = inv.bagItems.findIndex((x) => x && x.id === itemId);
    if (idx === -1) return res.status(404).json({ ok: false, error: "Item not found" });

    const item = inv.bagItems[idx];

    // hero token -> create hero instance
    if (item.type === "hero") {
      const tplId = String(item.tplId || "");
      const tpl = getCatalog().find((x) => x && x.tplId === tplId);
      const heroMeta = tpl?.hero || item.hero || null;
      if (!heroMeta) return res.status(400).json({ ok: false, error: "Bad hero token" });

      // ✅ Prevent duplicate activation of the same hero template for the same player.
      // If player already has this templateId (e.g. Sakura already activated), refuse.
      if (heroMeta?.templateId) {
        let heroesDbCheck = readJSON("heroes.json", { heroes: [] });
        let heroesArrCheck = asArray(heroesDbCheck.heroes);
        const already = heroesArrCheck.some(
          (h) => h && h.playerId === playerId && String(h.templateId || "") === String(heroMeta.templateId)
        );
        if (already) {
          return res.status(400).json({ ok: false, error: "Этот герой у вас уже активирован" });
        }
      }

      const templates = getHeroTemplates();
      const t = heroMeta?.templateId ? templates[String(heroMeta.templateId)] : null;

      const have = Math.max(1, Number(item.qty || 1));
      const useN = Math.max(1, Math.min(have, Math.floor(Number(qty || 1)) || 1));
      if (useN !== 1) return res.status(400).json({ ok: false, error: "hero_activation_one_by_one" });

      // create hero
      let heroesDb = readJSON("heroes.json", { heroes: [] });
      let heroesArr = asArray(heroesDb.heroes);

      const classType = t?.classType || heroMeta.classType || "taijutsu";
      const rarity = t?.rarity || heroMeta.rarity || "C";
      const role = t?.role || "support";
      const main = t?.base
        ? { spirit: t.base.spirit, chakra: t.base.chakra, might: t.base.might, agility: t.base.agility }
        : { spirit: 4, chakra: 4, might: 4, agility: 4 };
      const hpBase = Number(t?.base?.hp ?? 100);
      const primary = t?.base
        ? {
            hp: hpBase,
            physAtk: Math.round(main.might),
            stratAtk: Math.round(main.spirit),
            physDef: Math.round(main.might * (t?.ratings?.def ? t.ratings.def : 1.0)),
            stratDef: Math.round(main.spirit * (t?.ratings?.def ? t.ratings.def : 1.0)),
            speed: Math.round(main.agility),
          }
        : { hp: 100, physAtk: 14, physDef: 8, stratAtk: 14, stratDef: 8, speed: 9 };

      const base = {
        id: uid("h"),
        playerId,
        templateId: t ? String(heroMeta.templateId) : null,
        name: t?.name || (classType === "taijutsu" ? "Боєць" : classType === "ninjutsu" ? "Ніндзя" : "Ілюзіоніст"),
        isMain: false,
        level: 1,
        rarity,
        role,
        classType,
        ratings: t?.ratings || null,
        growth: t?.growth || null,
        auras: t?.auras || [],
        stats: {
          main,
          primary,
          secondary: {
            damageRate: 0, accuracyRate: 0, critRate: 3, successRate: 0, punchRate: 0,
            avoidDamageRate: 0, dodgeRate: 2, contraRate: 0, blockRate: 0, helpRate: 0, healRate: 0
          },
        },
        skills: t?.skills?.length
          ? t.skills
          : [{ name: "Базова атака", desc: "Звичайна атака.", power: 1.0, scale: (classType === "taijutsu" ? "physAtk" : "stratAtk"), rageCost: 0 }],
        createdAt: new Date().toISOString(),
      };

      heroesArr.push(base);
      heroesDb = setAsArray(heroesDb, "heroes", heroesArr);
      writeJSON("heroes.json", heroesDb);

      // remove token from bag
      inv.bagItems.splice(idx, 1);

      invRec.inventory = inv;
      invDb = setAsArray(invDb, "inventories", invArr);
      writeJSON("inventories.json", invDb);

      return res.json({ ok: true, activated: "hero", hero: base });
    }

    return res.status(400).json({ ok: false, error: "Nothing to activate for this item" });
  } catch (e) {
    console.error("activate error:", e);
    return res.status(500).json({ ok: false, error: "Server error", details: String(e?.message || e) });
  }
});

// Use EXP consumable (scroll / glass)
// body: { playerId, heroId, itemId, qty }
app.post("/api/inventory/useExp", (req, res) => {
  try {
    const { playerId, heroId, itemId, qty } = req.body || {};
    if (!playerId || !heroId || !itemId) return res.status(400).json({ ok: false, error: "playerId, heroId, itemId required" });

    const seed = ensurePlayerSeed(playerId);
    if (!seed.ok) return res.status(404).json({ ok: false, error: seed.error });

    // load inventory
    let invDb = readJSON("inventories.json", { inventories: [] });
    let invArr = asArray(invDb.inventories);
    let invRec = invArr.find((x) => x && x.playerId === playerId);
    if (!invRec) return res.status(404).json({ ok: false, error: "Inventory not found" });

    const inv = invRec.inventory || {};
    inv.bagItems = Array.isArray(inv.bagItems) ? inv.bagItems : [];

    const idx = inv.bagItems.findIndex((x) => x && x.id === itemId);
    if (idx === -1) return res.status(404).json({ ok: false, error: "Item not found" });
    const item = inv.bagItems[idx];

    const tpl = getItemsCatalog().map.get(String(item.tplId || ""));
    const effects = tpl?.effects || item.effects || null;
    const expGain = Number(effects?.exp || 0);
    const target = String(effects?.target || "");
    if (!expGain) return res.status(400).json({ ok: false, error: "Item has no EXP effect" });
    if (target !== "main" && target !== "secondary") return res.status(400).json({ ok: false, error: "Bad EXP target" });

    // load heroes + player
    const heroesDb = readJSON("heroes.json", { heroes: [] });
    const heroesArr = asArray(heroesDb.heroes);
    const hero = heroesArr.find((h) => h && h.id === heroId && h.playerId === playerId);
    if (!hero) return res.status(404).json({ ok: false, error: "Hero not found" });

    const isMain = !!hero.isMain;
    if (target === "main" && !isMain) return res.status(400).json({ ok: false, error: "Цей предмет можна використовувати лише на ГГ" });
    if (target === "secondary" && isMain) return res.status(400).json({ ok: false, error: "Цей предмет можна використовувати лише на другорядних героїв" });

    const have = Math.max(1, Number(item.qty || 1));
    const useN = Math.max(1, Math.min(have, Number(qty || 1), 999));

    let updatedPlayer = null;
    let updatedHero = null;

    if (isMain) {
      // same logic as /api/player/addExp
      let playersDb = readJSON("players.json", { players: [] });
      let playersArr = asArray(playersDb.players);
      const pIdx = playersArr.findIndex((x) => x && x.id === playerId);
      if (pIdx === -1) return res.status(404).json({ ok: false, error: "Player not found" });
      const p = normalizePlayer(playersArr[pIdx]);
      p.exp = Number(p.exp || 0) + expGain * useN;
      while (p.level < EXP_MAX_LEVEL && p.exp >= expToNext(p.level)) {
        p.exp -= expToNext(p.level);
        p.level = Number(p.level || 1) + 1;
      }
      if (p.level >= EXP_MAX_LEVEL) {
        p.level = EXP_MAX_LEVEL;
        p.exp = 0;
      }
      playersArr[pIdx] = { ...playersArr[pIdx], level: p.level, exp: p.exp, currency: p.currency, classType: p.classType };
      playersDb = setAsArray(playersDb, "players", playersArr);
      writeJSON("players.json", playersDb);
      updatedPlayer = { ...normalizePlayer(playersArr[pIdx]), expToNext: expToNext(p.level) };
    } else {
      // secondary hero
      let heroesDb2 = readJSON("heroes.json", { heroes: [] });
      let heroesArr2 = asArray(heroesDb2.heroes);
      const hIdx = heroesArr2.findIndex((h) => h && h.id === heroId && h.playerId === playerId);
      if (hIdx === -1) return res.status(404).json({ ok: false, error: "Hero not found" });

      const h0 = heroesArr2[hIdx];
      let level = Math.max(1, Number(h0.level || 1));
      let exp = Number(h0.exp || 0) + expGain * useN;
      while (level < EXP_MAX_LEVEL && exp >= expToNext(level)) {
        exp -= expToNext(level);
        level += 1;
      }
      if (level >= EXP_MAX_LEVEL) {
        level = EXP_MAX_LEVEL;
        exp = 0;
      }
      heroesArr2[hIdx] = { ...h0, level, exp };
      heroesDb2 = setAsArray(heroesDb2, "heroes", heroesArr2);
      writeJSON("heroes.json", heroesDb2);
      updatedHero = withComputedHero(playerId, heroesArr2[hIdx]);
    }

    // decrement stack
    const left = have - useN;
    if (left <= 0) inv.bagItems.splice(idx, 1);
    else inv.bagItems[idx] = { ...item, qty: left };

    invRec.inventory = inv;
    invDb = setAsArray(invDb, "inventories", invArr);
    writeJSON("inventories.json", invDb);

    return res.json({ ok: true, used: useN, gained: expGain * useN, player: updatedPlayer, hero: updatedHero });
  } catch (e) {
    console.error("useExp error:", e);
    return res.status(500).json({ ok: false, error: "Server error", details: String(e?.message || e) });
  }
});

// Open set box
// body: { playerId, itemId }

app.post("/api/skillbook/equip", (req, res) => {
  try {
    const { playerId, slotIndex, skillId } = req.body || {};
    if (!playerId) return res.status(400).json({ ok: false, error: "playerId required" });
    const idx = Math.max(0, Math.min(7, Number(slotIndex || 0)));
    const state = normalizeSkillBookState(getPlayerSkillBook(playerId) || {});
    const unlocked = collectUnlockedSkillBookSkills(state);
    const unlockedSet = new Set(unlocked.map((x) => x.id));
    const next = Array.isArray(state.equippedSkills) ? state.equippedSkills.slice(0, 8) : [];
    while (next.length < 8) next.push(null);
    if (!skillId) {
      next[idx] = null;
    } else {
      const sid = String(skillId);
      if (!unlockedSet.has(sid)) return res.status(400).json({ ok: false, error: "skill not unlocked" });
      const prev = next.findIndex((x, i) => x === sid && i !== idx);
      if (prev >= 0) next[prev] = null;
      next[idx] = sid;
    }
    state.equippedSkills = next.filter(Boolean).slice(0, 8);
    savePlayerSkillBook(playerId, state);
    return res.json({ ok: true, skillBook: getSkillBookProgressView(playerId), equippedSkills: state.equippedSkills });
  } catch (e) {
    console.error("/api/skillbook/equip", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

app.get("/api/skillbook/get", (req, res) => {
  const playerId = req.query.playerId;
  if (!playerId) return res.status(400).json({ ok: false, error: "playerId required" });
  const seed = ensurePlayerSeed(playerId);
  if (!seed.ok) return res.status(404).json({ ok: false, error: seed.error });
  return res.json({ ok: true, skillBook: getSkillBookProgressView(playerId) });
});

app.post("/api/skillbook/upgrade", (req, res) => {
  try {
    const { playerId, pageId, level } = req.body || {};
    if (!playerId || !pageId || !level) return res.status(400).json({ ok: false, error: "playerId, pageId, level required" });
    const seed = ensurePlayerSeed(playerId);
    if (!seed.ok) return res.status(404).json({ ok: false, error: seed.error });
    const page = getSkillBookPageById(pageId);
    if (!page) return res.status(404).json({ ok: false, error: "page_not_found" });
    const node = page.nodes.find((n) => Number(n.level) === Number(level));
    if (!node) return res.status(404).json({ ok: false, error: "node_not_found" });

    const currentState = getPlayerSkillBook(playerId) || createDefaultSkillBookState();
    const currentIndex = Math.max(0, SKILL_BOOK_PAGES.findIndex((p) => p.id === currentState.currentPageId));
    const pageIndex = Math.max(0, SKILL_BOOK_PAGES.findIndex((p) => p.id === page.id));
    if (pageIndex > currentIndex) return res.json({ ok: false, error: "page_locked" });

    const bought = new Set(currentState.purchased[page.id] || []);
    if (bought.has(node.level)) return res.json({ ok: false, error: "already_bought" });
    if (node.level > 1 && !bought.has(node.level - 1)) return res.json({ ok: false, error: "previous_required" });

    const needSkill = Math.floor(Number(node.cost || 0));
    const needAw = Math.floor(Number(node.awakenCost || 0));
    if (currentState.skillPoints < needSkill) return res.json({ ok: false, error: "not_enough_skill_points", need: needSkill, have: currentState.skillPoints });
    if (currentState.awakenedPoints < needAw) return res.json({ ok: false, error: "not_enough_awakened_points", need: needAw, have: currentState.awakenedPoints });

    currentState.skillPoints -= needSkill;
    currentState.awakenedPoints -= needAw;
    currentState.purchased[page.id] = Array.from(new Set([...(currentState.purchased[page.id] || []), node.level])).sort((a,b)=>a-b);

    const completed = page.nodes.every((n) => (currentState.purchased[page.id] || []).includes(n.level));
    if (completed && pageIndex < SKILL_BOOK_PAGES.length - 1) currentState.currentPageId = SKILL_BOOK_PAGES[pageIndex + 1].id;
    const saved = savePlayerSkillBook(playerId, currentState);
    return res.json({ ok: true, skillBook: getSkillBookProgressView(playerId), state: saved, node, unlockedSkill: node.skillId ? SKILL_BOOK_SKILLS[node.skillId] || null : null });
  } catch (e) {
    console.error("/api/skillbook/upgrade", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

app.post("/api/skillbook/useScroll", (req, res) => {
  try {
    const { playerId, itemId, qty } = req.body || {};
    if (!playerId || !itemId) return res.status(400).json({ ok: false, error: "playerId, itemId required" });
    const seed = ensurePlayerSeed(playerId);
    if (!seed.ok) return res.status(404).json({ ok: false, error: seed.error });

    let invDb = readJSON("inventories.json", { inventories: [] });
    let invArr = asArray(invDb.inventories);
    let invRec = invArr.find((x) => x && x.playerId === playerId);
    if (!invRec) return res.status(404).json({ ok: false, error: "Inventory not found" });
    const inv = ensureInvDefaults(invRec.inventory || {});
    const idx = inv.bagItems.findIndex((x) => x && x.id === itemId);
    if (idx === -1) return res.status(404).json({ ok: false, error: "Item not found" });
    const item = inv.bagItems[idx];
    const tpl = getItemsCatalog().map.get(String(item.tplId || ""));
    const effects = tpl?.effects || item.effects || {};
    const skillPoints = Math.floor(Number(effects.skillPoints || 0));
    const awakenedPoints = Math.floor(Number(effects.awakenedSkillPoints || 0));
    if (!skillPoints && !awakenedPoints) return res.status(400).json({ ok: false, error: "Item has no skill effect" });
    const have = Math.max(1, Number(item.qty || 1));
    const useN = Math.max(1, Math.min(have, Math.floor(Number(qty || 1))));
    const left = have - useN;
    if (left <= 0) inv.bagItems.splice(idx, 1); else inv.bagItems[idx].qty = left;
    invRec.inventory = inv;
    writeJSON("inventories.json", { inventories: invArr });

    const sb = getPlayerSkillBook(playerId) || createDefaultSkillBookState();
    sb.skillPoints += skillPoints * useN;
    sb.awakenedPoints += awakenedPoints * useN;
    savePlayerSkillBook(playerId, sb);
    return res.json({ ok: true, gainedSkillPoints: skillPoints * useN, gainedAwakenedPoints: awakenedPoints * useN, skillBook: getSkillBookProgressView(playerId) });
  } catch (e) {
    console.error("/api/skillbook/useScroll", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

app.post("/api/skillbook/dungeon", (req, res) => {
  try {
    const { playerId } = req.body || {};
    if (!playerId) return res.status(400).json({ ok: false, error: "playerId required" });
    const seed = ensurePlayerSeed(playerId);
    if (!seed.ok) return res.status(404).json({ ok: false, error: seed.error });
    const sb = getPlayerSkillBook(playerId) || createDefaultSkillBookState();
    const reward = 5000 + Math.floor(sb.dungeonRuns / 3) * 500;
    sb.awakenedPoints += reward;
    sb.dungeonRuns = Number(sb.dungeonRuns || 0) + 1;
    sb.lastDungeonAt = Date.now();
    savePlayerSkillBook(playerId, sb);
    return res.json({ ok: true, victory: true, reward, skillBook: getSkillBookProgressView(playerId) });
  } catch (e) {
    console.error("/api/skillbook/dungeon", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

app.post("/api/inventory/openBox", (req, res) => {
  try {
    const { playerId, itemId } = req.body || {};
    if (!playerId || !itemId) return res.status(400).json({ ok: false, error: "playerId, itemId required" });

    const seed = ensurePlayerSeed(playerId);
    if (!seed.ok) return res.status(404).json({ ok: false, error: seed.error });

    // load inventory
    let invDb = readJSON("inventories.json", { inventories: [] });
    let invArr = asArray(invDb.inventories);
    let invRec = invArr.find((x) => x && x.playerId === playerId);
    if (!invRec) return res.status(404).json({ ok: false, error: "Inventory not found" });

    const inv = ensureInvDefaults(invRec.inventory || {});
    const idx = inv.bagItems.findIndex((x) => x && x.id === itemId);
    if (idx === -1) return res.status(404).json({ ok: false, error: "Item not found" });
    const item = inv.bagItems[idx];

    const tpl = getItemsCatalog().map.get(String(item.tplId || ""));
    const effects = tpl?.effects || item.effects || null;
    const setId = String(effects?.openSet || "");
    if (!setId) return res.status(400).json({ ok: false, error: "not_a_box" });

    const list = SET_CONTENTS[setId];
    if (!Array.isArray(list) || !list.length) return res.status(400).json({ ok: false, error: "unknown_set" });

    // consume 1 box
    const have = Math.max(1, Number(item.qty || 1));
    const left = have - 1;
    if (left <= 0) inv.bagItems.splice(idx, 1);
    else inv.bagItems[idx] = { ...item, qty: left };

    const { items: catItems, map: catMap } = getItemsCatalog();
    const granted = [];
    for (const tplId of list) {
      const t = catMap.get(String(tplId));
      if (!t) continue;
      const r = addTplToInventory(inv, t, 1);
      granted.push({ tplId, added: r.added, movedToTemp: r.movedToTemp });
    }

    invRec.inventory = inv;
    invDb = setAsArray(invDb, "inventories", invArr);
    writeJSON("inventories.json", invDb);

    return res.json({ ok: true, setId, granted, capacity: inv.capacity, bagCount: inv.bagItems.length, tempCount: inv.tempBagItems.length });
  } catch (e) {
    console.error("openBox error:", e);
    return res.status(500).json({ ok: false, error: "Server error", details: String(e?.message || e) });
  }
});


// ===== EQUIPMENT: enhance (NW-like) =====
// body: { playerId, heroId, equipSlot }
app.post("/api/equipment/enhance", (req, res) => {
  try {
    const { playerId, heroId, equipSlot } = req.body || {};
    if (!playerId || !heroId || !equipSlot) return res.status(400).json({ ok: false, error: "playerId, heroId, equipSlot required" });

    const seed = ensurePlayerSeed(playerId);
    if (!seed.ok) return res.status(404).json({ ok: false, error: seed.error });

    const allowedSlots = new Set(["weapon","armor","head","cloak","belt","shoes"]);
    const slotKey = String(equipSlot);
    if (!allowedSlots.has(slotKey)) return res.status(400).json({ ok: false, error: "slot_not_enhanceable" });

    // Load player + hero (for level cap and silver)
    const playersDbRaw = readJSON("players.json", { players: [] });
    const parr = asArray(playersDbRaw.players);
    const pIdx = parr.findIndex((x) => x && x.id === playerId);
    if (pIdx < 0) return res.status(404).json({ ok: false, error: "player_not_found" });
    const p = normalizePlayer(parr[pIdx]);

    const heroesDb = readJSON("heroes.json", { heroes: [] });
    const harr = asArray(heroesDb.heroes);
    const hero = harr.find((h) => h && String(h.id) === String(heroId) && String(h.playerId) === String(playerId));
    if (!hero) return res.status(404).json({ ok: false, error: "hero_not_found" });

    const heroLevel = hero.isMain ? Number(p.level || 1) : Number(hero.level || 1);

    // Inventory record
    const invDb = readJSON("inventories.json", { inventories: [] });
    const arr = asArray(invDb.inventories);
    const rec = arr.find((x) => x && x.playerId === playerId);
    if (!rec) return res.status(404).json({ ok: false, error: "inventory_not_found" });

    const inv = ensureInvDefaults(rec.inventory || {});
    inv.equippedItemsByHero[heroId] = inv.equippedItemsByHero[heroId] || { weapon:null, armor:null, head:null, cloak:null, belt:null, shoes:null, jewelry:null, j1:null,j2:null,j3:null,j4:null,j5:null,j6:null,j7:null,j8:null };

    const item = inv.equippedItemsByHero?.[heroId]?.[slotKey];
    if (!item) return res.status(400).json({ ok: false, error: "no_item_in_slot" });

    const cur = Math.max(0, Number(item.enhanceLevel || 0));
    const next = cur + 1;

    if (next > heroLevel) return res.status(400).json({ ok: false, error: "enhance_level_cap", max: heroLevel });

    // Cost: starts at 1000 and grows (no exact table provided)
    const cost = Math.floor(1000 * Math.pow(1.07, Math.max(0, next - 1)));
    if (Number(p.currency.silver || 0) < cost) return res.status(400).json({ ok: false, error: "not_enough_silver", cost });

    p.currency.silver = Number(p.currency.silver || 0) - cost;
    p.silver = p.currency.silver;

    item.enhanceLevel = next;

    parr[pIdx] = p;
    writeJSON("players.json", { players: parr });

    rec.inventory = inv;
    writeJSON("inventories.json", { inventories: arr });

    return res.json({ ok: true, slot: slotKey, enhanceLevel: next, cost, silver: p.currency.silver });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});


// ===== EQUIPMENT: heritage (transfer enhance level) =====
// body: { playerId, heroId, fromSlot, toSlot }
app.post("/api/equipment/heritage", (req, res) => {
  try {
    const { playerId, heroId, fromSlot, toSlot } = req.body || {};
    if (!playerId || !heroId || !fromSlot || !toSlot) {
      return res.status(400).json({ ok: false, error: "playerId, heroId, fromSlot, toSlot required" });
    }

    const seed = ensurePlayerSeed(playerId);
    if (!seed.ok) return res.status(404).json({ ok: false, error: seed.error });

    const allowedSlots = new Set(["weapon", "armor", "head", "cloak", "belt", "shoes"]);
    const a = String(fromSlot);
    const b = String(toSlot);
    if (!allowedSlots.has(a) || !allowedSlots.has(b) || a === b) {
      return res.status(400).json({ ok: false, error: "bad_slots" });
    }

    // player
    const playersDbRaw = readJSON("players.json", { players: [] });
    const parr = asArray(playersDbRaw.players);
    const pIdx = parr.findIndex((x) => x && x.id === playerId);
    if (pIdx < 0) return res.status(404).json({ ok: false, error: "player_not_found" });
    const p = normalizePlayer(parr[pIdx]);

    // inventory
    const invDb = readJSON("inventories.json", { inventories: [] });
    const arr = asArray(invDb.inventories);
    const rec = arr.find((x) => x && x.playerId === playerId);
    if (!rec) return res.status(404).json({ ok: false, error: "inventory_not_found" });
    const inv = ensureInvDefaults(rec.inventory || {});

    inv.equippedItemsByHero[heroId] =
      inv.equippedItemsByHero[heroId] ||
      {
        weapon: null,
        armor: null,
        head: null,
        cloak: null,
        belt: null,
        shoes: null,
        jewelry: null,
        j1: null,
        j2: null,
        j3: null,
        j4: null,
        j5: null,
        j6: null,
        j7: null,
        j8: null,
      };

    const fromIt = inv.equippedItemsByHero?.[heroId]?.[a];
    const toIt = inv.equippedItemsByHero?.[heroId]?.[b];
    if (!fromIt || !toIt) return res.status(400).json({ ok: false, error: "no_item" });

    const level = Math.max(0, Number(fromIt.enhanceLevel || 0));
    const targetLevel = Math.max(0, Number(toIt.enhanceLevel || 0));
    if (level <= 0) return res.status(400).json({ ok: false, error: "source_level_zero" });

    const gain = level > targetLevel ? Math.max(0, level - targetLevel) : Math.floor(level / 2);
    const resultLevel = targetLevel + gain;
    if (gain <= 0) return res.status(400).json({ ok: false, error: "no_gain" });

    const cost = Math.floor(2000 + level * level * 35);
    if (Number(p.currency.silver || 0) < cost) return res.status(400).json({ ok: false, error: "not_enough_silver", cost });

    p.currency.silver = Number(p.currency.silver || 0) - cost;
    p.silver = p.currency.silver;

    toIt.enhanceLevel = resultLevel;
    fromIt.enhanceLevel = 0;

    parr[pIdx] = p;
    writeJSON("players.json", { players: parr });

    rec.inventory = inv;
    writeJSON("inventories.json", { inventories: arr });

    return res.json({ ok: true, fromSlot: a, toSlot: b, level, targetLevel, gain, resultLevel, cost, silver: p.currency.silver });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});


// ===== EQUIPMENT: craft (test recipes) =====
// body: { playerId, recipeId }
app.post("/api/equipment/craft", (req, res) => {
  try {
    const { playerId, recipeId } = req.body || {};
    if (!playerId || !recipeId) return res.status(400).json({ ok: false, error: "playerId, recipeId required" });

    const seed = ensurePlayerSeed(playerId);
    if (!seed.ok) return res.status(404).json({ ok: false, error: seed.error });

    const invDb = readJSON("inventories.json", { inventories: [] });
    const arr = asArray(invDb.inventories);
    const rec = arr.find((x) => x && x.playerId === playerId);
    if (!rec) return res.status(404).json({ ok: false, error: "inventory_not_found" });
    const inv = ensureInvDefaults(rec.inventory || {});

    const recipes = {
      craft_akatsuki_cloak: {
        outTplId: "set_akatsuki_cloak",
        req: [
          { tplId: "mat_base", qty: 10 },
          { tplId: "mat_akatsuki", qty: 5 },
        ],
      },
      craft_akatsuki_kunai: {
        outTplId: "set_akatsuki_kunai",
        req: [
          { tplId: "mat_base", qty: 10 },
          { tplId: "mat_akatsuki", qty: 5 },
        ],
      },
    };

    const r = recipes[String(recipeId)];
    if (!r) return res.status(400).json({ ok: false, error: "unknown_recipe" });

    // check requirements
    const countTpl = (tplId) => {
      const id = String(tplId);
      let sum = 0;
      for (const it of inv.bagItems) if (it && String(it.tplId) === id) sum += Math.max(1, Number(it.qty || 1));
      for (const it of inv.tempBagItems) if (it && String(it.tplId) === id) sum += Math.max(1, Number(it.qty || 1));
      return sum;
    };
    for (const q of r.req) {
      if (countTpl(q.tplId) < Number(q.qty || 0)) return res.status(400).json({ ok: false, error: "not_enough_materials", tplId: q.tplId });
    }

    // consume
    for (const q of r.req) {
      const c = consumeTplFromInventory(inv, q.tplId, q.qty);
      if (!c.ok) return res.status(400).json({ ok: false, error: "not_enough_materials", tplId: q.tplId });
    }

    const { map: catMap } = getItemsCatalog();
    const tpl = catMap.get(String(r.outTplId));
    if (!tpl) return res.status(500).json({ ok: false, error: "catalog_missing_tpl" });

    const addRes = addTplToInventory(inv, tpl, 1);

    rec.inventory = inv;
    writeJSON("inventories.json", { inventories: arr });

    return res.json({ ok: true, outTplId: r.outTplId, added: addRes.added, movedToTemp: addRes.movedToTemp });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});


// ===== EQUIPMENT: socket unlock =====
// body: { playerId, heroId, equipSlot }
app.post("/api/equipment/socket", (req, res) => {
  try {
    const { playerId, heroId, equipSlot } = req.body || {};
    if (!playerId || !heroId || !equipSlot) return res.status(400).json({ ok: false, error: "playerId, heroId, equipSlot required" });

    const seed = ensurePlayerSeed(playerId);
    if (!seed.ok) return res.status(404).json({ ok: false, error: seed.error });

    const allowedSlots = new Set(["weapon", "armor", "head", "cloak", "belt", "shoes"]);
    const slotKey = String(equipSlot);
    if (!allowedSlots.has(slotKey)) return res.status(400).json({ ok: false, error: "bad_slot" });

    const invDb = readJSON("inventories.json", { inventories: [] });
    const arr = asArray(invDb.inventories);
    const rec = arr.find((x) => x && x.playerId === playerId);
    if (!rec) return res.status(404).json({ ok: false, error: "inventory_not_found" });
    const inv = ensureInvDefaults(rec.inventory || {});

    inv.equippedItemsByHero[heroId] =
      inv.equippedItemsByHero[heroId] ||
      {
        weapon: null,
        armor: null,
        head: null,
        cloak: null,
        belt: null,
        shoes: null,
        jewelry: null,
        j1: null,
        j2: null,
        j3: null,
        j4: null,
        j5: null,
        j6: null,
        j7: null,
        j8: null,
      };

    const item = inv.equippedItemsByHero?.[heroId]?.[slotKey];
    if (!item) return res.status(400).json({ ok: false, error: "no_item_in_slot" });

    const cur = Math.max(0, Number(item.socketSlots || 0));
    if (cur >= 3) return res.status(400).json({ ok: false, error: "max_slots" });

    const c1 = consumeTplFromInventory(inv, "tool_socket", 1);
    if (!c1.ok) return res.status(400).json({ ok: false, error: "not_enough_materials", tplId: "tool_socket" });
    const c2 = consumeTplFromInventory(inv, "mat_base", 2);
    if (!c2.ok) return res.status(400).json({ ok: false, error: "not_enough_materials", tplId: "mat_base" });

    item.socketSlots = cur + 1;

    rec.inventory = inv;
    writeJSON("inventories.json", { inventories: arr });

    return res.json({ ok: true, slot: slotKey, socketSlots: item.socketSlots });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});


// ===== EQUIPMENT: upgrade (chance) =====
// body: { playerId, heroId, equipSlot }
app.post("/api/equipment/upgrade", (req, res) => {
  try {
    const { playerId, heroId, equipSlot } = req.body || {};
    if (!playerId || !heroId || !equipSlot) return res.status(400).json({ ok: false, error: "playerId, heroId, equipSlot required" });

    const seed = ensurePlayerSeed(playerId);
    if (!seed.ok) return res.status(404).json({ ok: false, error: seed.error });

    const allowedSlots = new Set(["weapon", "armor", "head", "cloak", "belt", "shoes"]);
    const slotKey = String(equipSlot);
    if (!allowedSlots.has(slotKey)) return res.status(400).json({ ok: false, error: "bad_slot" });

    const invDb = readJSON("inventories.json", { inventories: [] });
    const arr = asArray(invDb.inventories);
    const rec = arr.find((x) => x && x.playerId === playerId);
    if (!rec) return res.status(404).json({ ok: false, error: "inventory_not_found" });
    const inv = ensureInvDefaults(rec.inventory || {});

    inv.equippedItemsByHero[heroId] =
      inv.equippedItemsByHero[heroId] ||
      {
        weapon: null,
        armor: null,
        head: null,
        cloak: null,
        belt: null,
        shoes: null,
        jewelry: null,
        j1: null,
        j2: null,
        j3: null,
        j4: null,
        j5: null,
        j6: null,
        j7: null,
        j8: null,
      };

    const item = inv.equippedItemsByHero?.[heroId]?.[slotKey];
    if (!item) return res.status(400).json({ ok: false, error: "no_item_in_slot" });

    // consume rainbow stone (always)
    const c = consumeTplFromInventory(inv, "stone_rainbow", 1);
    if (!c.ok) return res.status(400).json({ ok: false, error: "not_enough_materials", tplId: "stone_rainbow" });

    // divine stone gives 100% (not consumed)
    const hasDivine = (() => {
      const id = "stone_divine";
      for (const it of inv.bagItems) if (it && String(it.tplId) === id) return true;
      for (const it of inv.tempBagItems) if (it && String(it.tplId) === id) return true;
      return false;
    })();

    const chance = hasDivine ? 1.0 : 0.5;
    const success = Math.random() < chance;
    const cur = Math.max(0, Number(item.upgradeLevel || 0));
    if (success) item.upgradeLevel = cur + 1;

    rec.inventory = inv;
    writeJSON("inventories.json", { inventories: arr });

    return res.json({ ok: true, success, upgradeLevel: item.upgradeLevel || cur, chance: hasDivine ? 100 : 50 });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});


// ===== MAIL list =====
app.get("/api/mail/list", (req, res) => {
  const playerId = req.query.playerId;
  if (!playerId) return res.status(400).json({ ok: false, error: "playerId required" });

  const seed = ensurePlayerSeed(playerId);
  if (!seed.ok) return res.status(404).json({ ok: false, error: seed.error });

  const db = readJSON("mail.json", { letters: [] });
  const letters = asArray(db.letters).filter((l) => l && l.playerId === playerId);
  return res.json({ ok: true, letters });
});

// ===== MAIL seed =====
app.post("/api/mail/seed", (req, res) => {
  // 🔒 прибрали автогенерацію тестових листів
  return res.status(410).json({ ok: false, error: "Seed mail disabled" });
});

// ===== MAIL claim: applies currency + adds items =====
app.post("/api/mail/claim", (req, res) => {
  try {
    const { playerId, letterId, mailId } = req.body || {};
    const _letterId = String(letterId || mailId || "");
    if (!playerId || !_letterId) return res.status(400).json({ ok: false, error: "playerId, letterId required" });

    const seed = ensurePlayerSeed(playerId);
    if (!seed.ok) return res.status(404).json({ ok: false, error: seed.error });

    const mailDb = readJSON("mail.json", { letters: [] });
    const letters = asArray(mailDb.letters);
    const letter = letters.find((l) => l && l.id === _letterId && l.playerId === playerId);
    if (!letter) return res.status(404).json({ ok: false, error: "Letter not found" });
    if (letter.claimed) return res.json({ ok: true, already: true });

    // inventory
    let invDb = readJSON("inventories.json", { inventories: [] });
    let invArr = asArray(invDb.inventories);
    let invRec = invArr.find((x) => x && x.playerId === playerId);
    if (!invRec) {
      invRec = { playerId, inventory: { bagItems: [], equippedItemsByHero: {} } };
      invArr.push(invRec);
    }
    const inv = invRec.inventory || {};
    inv.bagItems = Array.isArray(inv.bagItems) ? inv.bagItems : [];

    // players (currency apply)
    let playersDb = readJSON("players.json", { players: [] });
    let playersArr = asArray(playersDb.players);
    const pIdx = playersArr.findIndex((p) => p && p.id === playerId);
    if (pIdx === -1) return res.status(404).json({ ok: false, error: "Player not found" });
    const p = normalizePlayer(playersArr[pIdx]);

    const atts = Array.isArray(letter.attachments) ? letter.attachments : [];
    for (const a of atts) {
      if (!a) continue;

      // currency attachment
      if (a.kind === "currency") {
        const add = a.value || {};
        p.currency.silver += Number(add.silver || 0);
        p.currency.gold += Number(add.gold || 0);
        p.currency.coupons += Number(add.coupons || 0);
      }

      // exp attachment: {kind:"exp", value:{amount:123}}
      if (a.kind === "exp") {
        const addExp = Number(a.value?.amount || 0);
        if (Number.isFinite(addExp) && addExp > 0) {
          p.exp += addExp;
          // auto level-up
          let guard = 0;
          while (p.exp >= expToNext(p.level) && guard++ < 200) {
            p.exp -= expToNext(p.level);
            p.level += 1;
          }
        }
      }

      // item attachment: {kind:"item", tplId:"itm_kunai", qty:2}
      if (a.kind === "item") {
        const tplId = String(a.tplId || "");
        const qty = Math.max(1, Math.min(999, Number(a.qty || 1)));
        const tpl = getCatalog().find((x) => x && x.tplId === tplId);
        if (tpl) addTplToInventory(inv, tpl, qty);
      }
    }

    // save player
    playersArr[pIdx] = {
      ...playersArr[pIdx],
      // ✅ EXP/Level з пошти мають зберігатися
      level: p.level,
      exp: p.exp,
      currency: p.currency,
      vip: p.vip,
      svip: p.svip,
      isAdminHidden: p.isAdminHidden,
      silver: p.currency.silver,
      gold: p.currency.gold,
      coupons: p.currency.coupons,
    };
    playersDb = setAsArray(playersDb, "players", playersArr);
    writeJSON("players.json", playersDb);

    // save inv
    invRec.inventory = inv;
    invDb = setAsArray(invDb, "inventories", invArr);
    writeJSON("inventories.json", invDb);

    // mark claimed
    letter.claimed = true;
    writeJSON("mail.json", { letters });

    return res.json({ ok: true });
  } catch (e) {
    console.error("mail claim error:", e);
    return res.status(500).json({ ok: false, error: "Server error", details: String(e?.message || e) });
  }

});

// ===== MAIL delete =====
app.post("/api/mail/delete", (req, res) => {
  try {
    const { playerId, letterId, mailId } = req.body || {};
    const id = String(letterId || mailId || "");
    if (!playerId || !id) return res.status(400).json({ ok: false, error: "playerId, letterId required" });

    const seed = ensurePlayerSeed(playerId);
    if (!seed.ok) return res.status(404).json({ ok: false, error: seed.error });

    const db = readJSON("mail.json", { letters: [] });
    const letters = asArray(db.letters);
    const before = letters.length;
    const next = letters.filter((l) => !(l && l.id === id && l.playerId === playerId));
    if (next.length === before) return res.status(404).json({ ok: false, error: "Letter not found" });

    writeJSON("mail.json", { letters: next });
    return res.json({ ok: true });
  } catch (e) {
    console.error("mail delete error:", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ===================== ADMIN API (in-game admin panel) =====================

// list players
app.get("/api/admin/players/list", (req, res) => {
  if (!adminGuard(req, res)) return;
  const db = readJSON("players.json", { players: [] });
  const players = asArray(db.players).map((p) => normalizePlayer(p)).filter(Boolean);
  return res.json({
    ok: true,
    players: players.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      classType: p.classType,
      level: p.level,
      exp: p.exp,
      vip: p.vip,
      svip: p.svip,
      isAdminHidden: Boolean(p.isAdminHidden),
      currency: p.currency,
    })),
  });
});

// update player currency/level/exp
app.post("/api/admin/player/update_v2", (req, res) => {
  try {
    if (!adminGuard(req, res)) return;

    const { playerId, patch } = req.body || {};
    if (!playerId) return res.status(400).json({ ok: false, error: "playerId required" });

    let db = readJSON("players.json", { players: [] });
    let arr = asArray(db.players);
    const idx = arr.findIndex((p) => p && p.id === playerId);
    if (idx === -1) return res.status(404).json({ ok: false, error: "Player not found" });

    const p = normalizePlayer(arr[idx]);

    const c = patch?.currency || null;
    if (c) {
      p.currency.silver = Number(c.silver ?? p.currency.silver);
      p.currency.gold = Number(c.gold ?? p.currency.gold);
      p.currency.coupons = Number(c.coupons ?? p.currency.coupons);
    }
    if (patch?.level != null) p.level = Math.max(1, Number(patch.level || 1));
    if (patch?.exp != null) p.exp = Math.max(0, Number(patch.exp || 0));
    if (patch?.classType) p.classType = String(patch.classType);
    if (patch?.vip != null) p.vip = Math.max(0, Number(patch.vip || 0));
    if (patch?.svip != null) p.svip = Math.max(0, Number(patch.svip || 0));
    if (patch?.isAdminHidden != null) p.isAdminHidden = Boolean(patch.isAdminHidden);

    arr[idx] = {
      ...arr[idx],
      level: p.level,
      exp: p.exp,
      classType: p.classType,
      currency: p.currency,
      vip: p.vip,
      svip: p.svip,
      isAdminHidden: p.isAdminHidden,
      silver: p.currency.silver,
      gold: p.currency.gold,
      coupons: p.currency.coupons,
    };

    db = setAsArray(db, "players", arr);
    writeJSON("players.json", db);

    return res.json({ ok: true, player: normalizePlayer(arr[idx]) });
  } catch (e) {
    console.error("admin player update error:", e);
    return res.status(500).json({ ok: false, error: "Server error", details: String(e?.message || e) });
  }
});

// items catalog
app.get("/api/admin/items/catalog", (req, res) => {
  if (!adminGuard(req, res)) return;
  return res.json({ ok: true, items: getCatalog() });
});


// admin: get player inventory (with simple capacity)
app.get("/api/admin/player/inventory", (req, res) => {
  try {
    if (!adminGuard(req, res)) return;
    const playerId = String(req.query.playerId || "");
    if (!playerId) return res.status(400).json({ ok: false, error: "playerId required" });

    const seed = ensurePlayerSeed(playerId);
    if (!seed.ok) return res.status(404).json({ ok: false, error: seed.error });

    let invDb = readJSON("inventories.json", { inventories: [] });
    let invArr = asArray(invDb.inventories);
    let invRec = invArr.find((x) => x && x.playerId === playerId);
    if (!invRec) return res.status(404).json({ ok: false, error: "Inventory not found" });

    const inv = invRec.inventory || {};
    inv.bagItems = Array.isArray(inv.bagItems) ? inv.bagItems : [];
    inv.capacity = Number.isFinite(inv.capacity) ? Number(inv.capacity) : 60;

    // persist capacity if missing
    invRec.inventory = inv;
    invDb = setAsArray(invDb, "inventories", invArr);
    writeJSON("inventories.json", invDb);

    return res.json({ ok: true, inventory: inv });
  } catch (e) {
    console.error("admin inventory get error:", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// admin: expand player inventory capacity
app.post("/api/admin/player/inventory/expand", (req, res) => {
  try {
    if (!adminGuard(req, res)) return;
    const { playerId, add } = req.body || {};
    if (!playerId) return res.status(400).json({ ok: false, error: "playerId required" });

    let invDb = readJSON("inventories.json", { inventories: [] });
    let invArr = asArray(invDb.inventories);
    let invRec = invArr.find((x) => x && x.playerId === playerId);
    if (!invRec) return res.status(404).json({ ok: false, error: "Inventory not found" });

    const inv = invRec.inventory || {};
    inv.capacity = Number.isFinite(inv.capacity) ? Number(inv.capacity) : 60;

    const inc = Math.max(1, Math.min(300, Number(add || 0)));
    inv.capacity += inc;

    invRec.inventory = inv;
    invDb = setAsArray(invDb, "inventories", invArr);
    writeJSON("inventories.json", invDb);

    return res.json({ ok: true, capacity: inv.capacity });
  } catch (e) {
    console.error("admin inventory expand error:", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// admin: add item to player bag by tplId
app.post("/api/admin/player/inventory/addItem", (req, res) => {
  try {
    if (!adminGuard(req, res)) return;
    const { playerId, tplId, qty } = req.body || {};
    if (!playerId || !tplId) return res.status(400).json({ ok: false, error: "playerId+tplId required" });

    const seed = ensurePlayerSeed(playerId);
    if (!seed.ok) return res.status(404).json({ ok: false, error: seed.error });

    const tpl = getCatalog().find((x) => x && x.tplId === String(tplId));
    if (!tpl) return res.status(404).json({ ok: false, error: "tplId not found in catalog" });

    let invDb = readJSON("inventories.json", { inventories: [] });
    let invArr = asArray(invDb.inventories);
    let invRec = invArr.find((x) => x && x.playerId === playerId);
    if (!invRec) return res.status(404).json({ ok: false, error: "Inventory not found" });

    const inv = ensureInvDefaults(invRec.inventory || {});

    // Allow big stacks for materials (we use up to 9999 maxStack on new mats)
    const count = Math.max(1, Math.min(9999, Number(qty || 1)));
    const beforeBag = inv.bagItems.length;
    const beforeTemp = inv.tempBagItems.length;
    const r = addTplToInventory(inv, tpl, count);

    invRec.inventory = inv;
    invDb = setAsArray(invDb, "inventories", invArr);
    writeJSON("inventories.json", invDb);

    return res.json({ ok: true, added: r.added, movedToTemp: r.movedToTemp, capacity: inv.capacity, bagCount: inv.bagItems.length, tempCount: inv.tempBagItems.length });
  } catch (e) {
    console.error("admin inventory addItem error:", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// admin mail send (items + currency)
app.post("/api/admin/mail/send", (req, res) => {
  try {
    if (!adminGuard(req, res)) return;

    const { toPlayerId, toNickname, title, body, attachments } = req.body || {};
    if (!toPlayerId && !toNickname) return res.status(400).json({ ok: false, error: "toPlayerId or toNickname required" });

    // ensure target exists
    const pdb = readJSON("players.json", { players: [] });
    const parr = asArray(pdb.players);
    let targetId = String(toPlayerId || "");
    if (!targetId && toNickname) {
      const nn = String(toNickname || "").trim().toLowerCase();
      const found = parr.find((p) => String(p?.nickname || "").trim().toLowerCase() === nn);
      if (found) targetId = found.id;
    }
    if (!parr.some((p) => p && p.id === targetId)) {
      return res.status(404).json({ ok: false, error: "Target player not found" });
    }

    const mailDb = readJSON("mail.json", { letters: [] });
    const letters = asArray(mailDb.letters);

    const letter = {
      id: uid("mail"),
      playerId: targetId,
      from: "Адміністратор",
      title: String(title || "Лист від адміністратора"),
      body: String(body || ""),
      attachments: Array.isArray(attachments) ? attachments : [],
      claimed: false,
      createdAt: new Date().toISOString(),
    };

    letters.push(letter);
    writeJSON("mail.json", { letters });

    return res.json({ ok: true, letter });
  } catch (e) {
    console.error("admin mail send error:", e);
    return res.status(500).json({ ok: false, error: "Server error", details: String(e?.message || e) });
  }
});

// Root
app.get("/", (req, res) => res.sendFile(path.join(clientDir, "index.html")));

app.use("/api/dungeons", dungeonsRoute);

// 404 for API
app.use("/api", (req, res) => res.status(404).json({ ok: false, error: "API route not found" }));

// ===== One-time migration: remove legacy/test equipment, normalize weapon slot, remove extra slots =====
function migrateInventoriesOnce_v2() {
  try {
    const catalog = getItemsCatalog();
    const validTpl = new Set(catalog.items.map((x) => String(x.tplId)));

    const removedTpl = new Set([
      "itm_kunai","itm_armor","itm_ring",
      "itm_kunai_novice","itm_armor_student","itm_sandals","itm_helmet","itm_cloak","itm_belt",
      "itm_ring_chakra","itm_amulet_speed","itm_seal_spirit",
    ]);

    let invDb = readJSON("inventories.json", { inventories: [] });
    let invArr = asArray(invDb.inventories);
    let changed = false;

    for (const rec of invArr) {
      if (!rec || !rec.inventory) continue;
      const inv = ensureInvDefaults(rec.inventory);

      // purge removed/unknown equipment from bag
      const beforeBag = inv.bagItems.length;
      inv.bagItems = inv.bagItems.filter((it) => {
        const tplId = String(it?.tplId || "");
        if (!tplId) return false;
        if (removedTpl.has(tplId)) return false;
        if (!validTpl.has(tplId)) return false;
        return true;
      });
      if (inv.bagItems.length !== beforeBag) changed = true;

      // normalize equipped maps
      for (const [heroId, eq] of Object.entries(inv.equippedItemsByHero || {})) {
        if (!eq || typeof eq !== "object") continue;

        // move legacy extra slots -> bag (they should be in weapon slot)
        for (const legacy of ["shuriken", "scroll"]) {
          if (eq[legacy]) {
            const hasSpace = inv.bagItems.length < inv.capacity;
            if (hasSpace) inv.bagItems.push(eq[legacy]);
            else inv.tempBagItems.push(eq[legacy]);
            eq[legacy] = null;
            changed = true;
          }
        }

        // purge removed/unknown from equipped
        for (const k of Object.keys(eq)) {
          const it = eq[k];
          if (!it) continue;
          const tplId = String(it?.tplId || "");
          if (!tplId || removedTpl.has(tplId) || !validTpl.has(tplId)) {
            eq[k] = null;
            changed = true;
          }
        }

        // ensure only expected keys exist (keep j1..j8)
        const keep = new Set(["weapon","armor","head","cloak","belt","shoes","jewelry","j1","j2","j3","j4","j5","j6","j7","j8"]);
        for (const k of Object.keys(eq)) {
          if (!keep.has(k)) {
            delete eq[k];
            changed = true;
          }
        }
      }

      rec.inventory = inv;
    }

    if (changed) {
      invDb = setAsArray(invDb, "inventories", invArr);
      writeJSON("inventories.json", invDb);
      console.log("✅ inventories migrated");
    }
  } catch (e) {
    console.error("migrateInventoriesOnce_v2 error:", e);
  }
}

migrateInventoriesOnce_v2();

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));