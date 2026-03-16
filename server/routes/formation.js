// server/routes/formation.js
const express = require("express");
const { readJSON, writeJSON } = require("../utils/storage");

const router = express.Router();

// slot role mapping for grid:
// top:    [support, assault]
// middle: [support, assault, tank]
// bottom: [support, assault]
const ROLE_MAP = {
  top:    ["support", "assault"],
  middle: ["support", "assault", "tank"],
  bottom: ["support", "assault"]
};

function validateShape(f) {
  return (
    f &&
    Array.isArray(f.top) && f.top.length === 2 &&
    Array.isArray(f.middle) && f.middle.length === 3 &&
    Array.isArray(f.bottom) && f.bottom.length === 2
  );
}

router.get("/get", (req, res) => {
  const playerId = req.query.playerId;
  if (!playerId) return res.status(400).json({ ok: false, error: "playerId required" });

  const formationsDB = readJSON("formations.json", { formations: {} });
  res.json({ ok: true, formation: formationsDB.formations[playerId] || null });
});

router.post("/set", (req, res) => {
  const { playerId, formation } = req.body || {};
  if (!playerId || !formation) return res.status(400).json({ ok: false, error: "playerId+formation required" });

  if (!validateShape(formation)) {
    return res.status(400).json({ ok: false, error: "Formation must be {top[2], middle[3], bottom[2]}" });
  }

  const heroesDB = readJSON("heroes.json", { heroes: {} });
  const ownedHeroes = Object.values(heroesDB.heroes).filter(h => h.ownerId === playerId);
  const ownedMap = new Map(ownedHeroes.map(h => [h.id, h]));

  const allIds = [...formation.top, ...formation.middle, ...formation.bottom].filter(Boolean);

  // ✅ no duplicates
  const set = new Set(allIds);
  if (set.size !== allIds.length) {
    return res.status(400).json({ ok: false, error: "Duplicate hero in formation is not allowed" });
  }

  // ✅ validate ownership + role matches slot
  for (const rowKey of ["top", "middle", "bottom"]) {
    const row = formation[rowKey];
    for (let i = 0; i < row.length; i++) {
      const heroId = row[i];
      if (!heroId) continue;

      const hero = ownedMap.get(heroId);
      if (!hero) return res.status(400).json({ ok: false, error: `Hero ${heroId} not owned by player` });

      const requiredRole = ROLE_MAP[rowKey][i];
      if ((hero.role || "") !== requiredRole) {
        return res.status(400).json({
          ok: false,
          error: `Hero role mismatch. Slot ${rowKey}[${i}] requires ${requiredRole}, got ${hero.role}`
        });
      }

      // ✅ GG cannot change role anyway (enforced by hero.role=assault)
      if (hero.isMain && hero.role !== "assault") {
        return res.status(400).json({ ok: false, error: "Main hero role must be assault" });
      }
    }
  }

  const formationsDB = readJSON("formations.json", { formations: {} });
  formationsDB.formations[playerId] = formation;
  writeJSON("formations.json", formationsDB);

  res.json({ ok: true });
});

module.exports = router;