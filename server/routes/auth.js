// server/routes/auth.js
const express = require("express");
const { readJSON, writeJSON, uid } = require("../utils/storage");

const router = express.Router();

function ensureSeed() {
  readJSON("players.json", { players: {} });
  readJSON("heroes.json", { heroes: {} });
  readJSON("formations.json", { formations: {} });
  // NEW inventory structure
  readJSON("inventories.json", { inventories: {} });
  readJSON("mail.json", { mail: {} });
}

router.post("/create", (req, res) => {
  ensureSeed();

  const { nickname, gender, classType } = req.body || {};
  if (!nickname || !gender || !classType) {
    return res.status(400).json({ ok: false, error: "nickname/gender/classType required" });
  }

  const playersDB = readJSON("players.json", { players: {} });
  const heroesDB = readJSON("heroes.json", { heroes: {} });
  const formationsDB = readJSON("formations.json", { formations: {} });
  const invDB = readJSON("inventories.json", { inventories: {} });

  const playerId = uid("player");
  const ggHeroId = uid("hero");

  // ✅ MAIN HERO: role ALWAYS assault, cannot change
  const gg = {
    id: ggHeroId,
    ownerId: playerId,
    name: nickname,
    isMain: true,

    // classType = ninjutsu/taijutsu/genjutsu (тип чакри/стилю)
    classType,
    // role = support/assault/tank (позиційна роль у формації)
    role: "assault",

    gender,
    rarity: "A",
    level: 1,
    exp: 0,
    rageStart: 50,

    baseStats: {
      spirit: classType === "taijutsu" ? 7 : 5,
      chakra: classType === "ninjutsu" ? 7 : (classType === "genjutsu" ? 6 : 5),
      might: 6,
      agility: 5
    },
    growthPerLevel: {
      spirit: classType === "taijutsu" ? 1.2 : 1.0,
      chakra: classType === "ninjutsu" ? 1.2 : (classType === "genjutsu" ? 1.1 : 1.0),
      might: 1.1,
      agility: 1.0
    },

    skills: ["skill_basic_strike", "skill_power_hit"],
    auras: ["aura_starter"]
  };

  // Starter heroes пример (тут можеш замінити імена на Кіба/Ірука і т.д.)
  const support = {
    id: uid("hero"),
    ownerId: playerId,
    name: "Помощник",
    isMain: false,
    classType: "supportStyle",
    role: "support",
    gender: "male",
    rarity: "A-",
    level: 1,
    exp: 0,
    rageStart: 50,
    baseStats: { spirit: 4, chakra: 6, might: 5, agility: 4 },
    growthPerLevel: { spirit: 0.9, chakra: 1.1, might: 1.0, agility: 0.9 },
    skills: ["skill_basic_strike", "skill_support_chakra"],
    auras: ["aura_support"]
  };

  const tank = {
    id: uid("hero"),
    ownerId: playerId,
    name: "Защитник",
    isMain: false,
    classType: "tankStyle",
    role: "tank",
    gender: "male",
    rarity: "A",
    level: 1,
    exp: 0,
    rageStart: 50,
    baseStats: { spirit: 6, chakra: 4, might: 7, agility: 3 },
    growthPerLevel: { spirit: 1.0, chakra: 0.9, might: 1.2, agility: 0.8 },
    skills: ["skill_basic_strike", "skill_guard"],
    auras: ["aura_tank"]
  };

  heroesDB.heroes[gg.id] = gg;
  heroesDB.heroes[support.id] = support;
  heroesDB.heroes[tank.id] = tank;

  playersDB.players[playerId] = {
    id: playerId,
    nickname,
    gender,
    classType,
    level: 1,
    exp: 0,
    currency: { silver: 1000, gold: 100, coupons: 50 },
    createdAt: Date.now()
  };

  // ✅ Formation grid: 3 rows like:
  // rowTop:    [ support, assault ]
  // rowMiddle: [ support, assault, tank ]
  // rowBottom: [ support, assault ]
  formationsDB.formations[playerId] = {
    top:    [null, gg.id],        // GG auto on assault slot (top assault)
    middle: [null, null, null],   // tank slot is middle[2]
    bottom: [null, null]
  };

  // ✅ Inventory: bag shared, equipped PER HERO
  invDB.inventories[playerId] = {
    bag: ["item_potion_small", "item_scroll_basic"],
    equippedByHero: {
      [gg.id]: { weapon: null, armor: null, jewelry: null },
      [support.id]: { weapon: null, armor: null, jewelry: null },
      [tank.id]: { weapon: null, armor: null, jewelry: null }
    }
  };

  writeJSON("players.json", playersDB);
  writeJSON("heroes.json", heroesDB);
  writeJSON("formations.json", formationsDB);
  writeJSON("inventories.json", invDB);

  res.json({ ok: true, playerId });
});

module.exports = router;