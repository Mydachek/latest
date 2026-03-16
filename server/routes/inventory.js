// server/routes/inventory.js
const express = require("express");
const { readJSON, writeJSON } = require("../utils/storage");

const router = express.Router();

router.get("/get", (req, res) => {
  const playerId = req.query.playerId;
  if (!playerId) return res.status(400).json({ ok: false, error: "playerId required" });

  const invDB = readJSON("inventories.json", { inventories: {} });
  const itemsDB = readJSON("items.json", { items: {} });
  const heroesDB = readJSON("heroes.json", { heroes: {} });

  const inv = invDB.inventories[playerId];
  if (!inv) return res.status(404).json({ ok: false, error: "inventory not found" });

  // ensure equippedByHero exists for all player heroes
  const ownedHeroes = Object.values(heroesDB.heroes).filter(h => h.ownerId === playerId);
  inv.equippedByHero ||= {};
  for (const h of ownedHeroes) {
    inv.equippedByHero[h.id] ||= { weapon: null, armor: null, jewelry: null };
  }

  const bagItems = (inv.bag || []).map(id => itemsDB.items[id]).filter(Boolean);

  // Build equipped resolved items per hero
  const equippedResolved = {};
  for (const [heroId, eq] of Object.entries(inv.equippedByHero || {})) {
    equippedResolved[heroId] = {};
    for (const [slot, itemId] of Object.entries(eq || {})) {
      equippedResolved[heroId][slot] = itemId ? (itemsDB.items[itemId] || null) : null;
    }
  }

  // persist any auto-fixes
  invDB.inventories[playerId] = inv;
  writeJSON("inventories.json", invDB);

  res.json({
    ok: true,
    inventory: {
      bag: inv.bag || [],
      bagItems,
      equippedByHero: inv.equippedByHero,
      equippedItemsByHero: equippedResolved
    }
  });
});

router.post("/equipHero", (req, res) => {
  const { playerId, heroId, itemId } = req.body || {};
  if (!playerId || !heroId || !itemId) return res.status(400).json({ ok: false, error: "playerId+heroId+itemId required" });

  const invDB = readJSON("inventories.json", { inventories: {} });
  const itemsDB = readJSON("items.json", { items: {} });
  const heroesDB = readJSON("heroes.json", { heroes: {} });

  const inv = invDB.inventories[playerId];
  if (!inv) return res.status(404).json({ ok: false, error: "inventory not found" });

  const hero = heroesDB.heroes[heroId];
  if (!hero || hero.ownerId !== playerId) return res.status(400).json({ ok: false, error: "hero not owned" });

  const item = itemsDB.items[itemId];
  if (!item) return res.status(404).json({ ok: false, error: "item not found" });
  if (!item.slot) return res.status(400).json({ ok: false, error: "item has no slot" });

  inv.bag ||= [];
  if (!inv.bag.includes(itemId)) return res.status(400).json({ ok: false, error: "item not in bag" });

  inv.equippedByHero ||= {};
  inv.equippedByHero[heroId] ||= { weapon: null, armor: null, jewelry: null };

  const slot = item.slot;
  const old = inv.equippedByHero[heroId][slot];
  if (old) inv.bag.push(old);

  inv.equippedByHero[heroId][slot] = itemId;
  inv.bag = inv.bag.filter(x => x !== itemId);

  invDB.inventories[playerId] = inv;
  writeJSON("inventories.json", invDB);

  res.json({ ok: true });
});

router.post("/unequipHero", (req, res) => {
  const { playerId, heroId, slot } = req.body || {};
  if (!playerId || !heroId || !slot) return res.status(400).json({ ok: false, error: "playerId+heroId+slot required" });

  const invDB = readJSON("inventories.json", { inventories: {} });
  const heroesDB = readJSON("heroes.json", { heroes: {} });

  const inv = invDB.inventories[playerId];
  if (!inv) return res.status(404).json({ ok: false, error: "inventory not found" });

  const hero = heroesDB.heroes[heroId];
  if (!hero || hero.ownerId !== playerId) return res.status(400).json({ ok: false, error: "hero not owned" });

  inv.equippedByHero ||= {};
  inv.equippedByHero[heroId] ||= { weapon: null, armor: null, jewelry: null };

  const itemId = inv.equippedByHero[heroId][slot];
  if (!itemId) return res.json({ ok: true });

  inv.equippedByHero[heroId][slot] = null;
  inv.bag ||= [];
  inv.bag.push(itemId);

  invDB.inventories[playerId] = inv;
  writeJSON("inventories.json", invDB);

  res.json({ ok: true });
});

module.exports = router;