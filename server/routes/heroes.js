// server/routes/heroes.js
const express = require("express");
const { readJSON } = require("../utils/storage");
const { calcAllStats } = require("../engine/stats");
const { getAuraById } = require("../engine/auras");
const { getSkillById } = require("../engine/skills");

const router = express.Router();

router.get("/list", (req, res) => {
  const playerId = req.query.playerId;
  if (!playerId) return res.status(400).json({ ok: false, error: "playerId required" });

  const heroesDB = readJSON("heroes.json", { heroes: {} });
  const invDB = readJSON("inventories.json", { inventories: {} });
  const itemsDB = readJSON("items.json", { items: {} });

  const inv = invDB.inventories[playerId] || { bag: [], equippedByHero: {} };

  const heroes = Object.values(heroesDB.heroes).filter(h => h.ownerId === playerId);

  const out = heroes.map(h => {
    const eq = inv.equippedByHero?.[h.id] || { weapon: null, armor: null, jewelry: null };
    const equippedIds = Object.values(eq).filter(Boolean);
    const equippedItems = equippedIds.map(id => itemsDB.items[id]).filter(Boolean);

    const auras = (h.auras || []).map(getAuraById).filter(Boolean);
    const stats = calcAllStats(h, { items: equippedItems, auras });
    const skills = (h.skills || []).map(getSkillById).filter(Boolean);

    return { ...h, stats, skills, auras, equipped: eq };
  });

  res.json({ ok: true, heroes: out });
});

module.exports = router;