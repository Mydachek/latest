const express = require("express");
const fs = require("fs");
const path = require("path");
const { runDungeonBattle } = require("../engine/dungeonBattle");

const router = express.Router();
const dataDir = path.join(__dirname, "..", "data");

function readJSON(name, fallback) {
  const fp = path.join(dataDir, name);
  if (!fs.existsSync(fp)) return fallback;
  try {
    const raw = fs.readFileSync(fp, "utf8");
    return raw.trim() ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(name, obj) {
  const fp = path.join(dataDir, name);
  const tmp = fp + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), "utf8");
  fs.renameSync(tmp, fp);
}
function asArray(v) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object") return Object.values(v);
  return [];
}
function normalizePlayersDb(db) {
  if (Array.isArray(db)) return db;
  if (db && Array.isArray(db.players)) return db.players;
  return [];
}
function savePlayers(arr, original) {
  if (Array.isArray(original)) return writeJSON("players.json", arr);
  return writeJSON("players.json", { players: arr });
}
function getPlayer(playerId) {
  const raw = readJSON("players.json", { players: [] });
  const players = normalizePlayersDb(raw);
  const idx = players.findIndex(p => p && String(p.id) === String(playerId));
  return { raw, players, idx, player: idx >= 0 ? players[idx] : null };
}
function getFormationRecord(playerId) {
  const raw = readJSON("formations.json", { formations: [] });
  const list = asArray(raw.formations ?? raw);
  return list.find(x => x && String(x.playerId) === String(playerId)) || null;
}
function extractFormationIds(rec) {
  const f = rec?.formation || rec || {};
  if (Array.isArray(f.activeHeroIds)) return f.activeHeroIds.filter(Boolean).slice(0,5);
  if (Array.isArray(f.top) || Array.isArray(f.middle) || Array.isArray(f.bottom)) {
    return [...(f.top||[]), ...(f.middle||[]), ...(f.bottom||[])].filter(Boolean).slice(0,5);
  }
  if (f.slots && typeof f.slots === "object") return Object.values(f.slots).filter(Boolean).slice(0,5);
  return [];
}
function getHeroesByIds(playerId, ids) {
  const raw = readJSON("heroes.json", { heroes: [] });
  const list = asArray(raw.heroes ?? raw).filter(h => h && String(h.playerId) === String(playerId));
  const map = new Map(list.map(h => [String(h.id), h]));
  return ids.map(id => map.get(String(id))).filter(Boolean);
}
function spendEnergy(playerId, cost) {
  const { raw, players, idx, player } = getPlayer(playerId);
  if (!player) return { ok: false, error: "player_not_found" };
  const energy = Number(player.energy ?? player.stamina ?? player.vitality ?? 0);
  if (energy < cost) return { ok: false, error: "not_enough_energy", have: energy, need: cost };
  players[idx] = { ...player, energy: energy - cost };
  savePlayers(players, raw);
  return { ok: true, player: players[idx] };
}

router.get(["/", "/list"], (req, res) => {
  const dungeons = readJSON("dungeons.json", []);
  res.json({ ok: true, dungeons: Array.isArray(dungeons) ? dungeons : [] });
});

router.post("/start", (req, res) => {
  try {
    const { playerId, dungeonId } = req.body || {};
    if (!playerId || !dungeonId) return res.status(400).json({ ok: false, error: "playerId and dungeonId required" });

    const dungeons = readJSON("dungeons.json", []);
    const enemiesDb = readJSON("dungeon_enemies.json", {});
    const dungeon = (Array.isArray(dungeons) ? dungeons : []).find(d => String(d.id) === String(dungeonId));
    if (!dungeon) return res.status(404).json({ ok: false, error: "dungeon_not_found" });

    const formation = getFormationRecord(playerId);
    const heroIds = extractFormationIds(formation);
    if (!heroIds.length) return res.status(400).json({ ok: false, error: "empty_formation" });

    const heroes = getHeroesByIds(playerId, heroIds);
    if (!heroes.length) return res.status(400).json({ ok: false, error: "heroes_not_found" });

    const cost = Number(dungeon.energyCost ?? 1);
    const spent = spendEnergy(playerId, cost);
    if (!spent.ok) return res.status(400).json(spent);

    const enemyTemplates = Array.isArray(enemiesDb[String(dungeon.enemyPackId || dungeon.id)]) ? enemiesDb[String(dungeon.enemyPackId || dungeon.id)] : [];
    if (enemyTemplates.length !== 5) return res.status(500).json({ ok: false, error: "enemy_pack_must_have_5_units" });

    const battle = runDungeonBattle({ playerId, dungeon, heroes, enemies: enemyTemplates });
    return res.json({ ok: true, dungeon, player: { id: spent.player.id, energy: Number(spent.player.energy ?? 0) }, battle });
  } catch (e) {
    console.error("/api/dungeons/start", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

module.exports = router;
