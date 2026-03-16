function ceil(n) { return Math.ceil(Number(n || 0)); }
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function pickAlive(arr) { return arr.filter(x => x.alive); }

function heroToUnit(hero, side, pos) {
  const main = hero.stats?.main || {};
  const primary = hero.stats?.primary || {};
  const secondary = hero.stats?.secondary || {};
  const level = Number(hero.level ?? hero.lvl ?? 1) || 1;
  return {
    id: String(hero.id), side, pos,
    name: hero.name || `Hero ${pos+1}`,
    level,
    role: hero.role || "assault",
    hpMax: ceil(primary.hp || (1000 + level * 80)),
    hp: ceil(primary.hp || (1000 + level * 80)),
    atk: ceil(Math.max(primary.physAtk || 0, primary.stratAtk || 0, 50 + level * 10)),
    def: ceil(Math.max(primary.physDef || 0, primary.stratDef || 0, 20 + level * 5)),
    speed: ceil(primary.speed || main.agility || 10 + level * 2),
    rage: clamp(Number(primary.initialFury || hero.initialFury || 0), 0, 200),
    helpRate: Number(secondary.helpRate || 0),
    healRate: Number(secondary.healRate || 0),
    alive: true,
  };
}
function enemyToUnit(enemy, side, pos) {
  const level = Number(enemy.level || 1);
  return {
    id: String(enemy.id || `${side}_${pos+1}`), side, pos,
    name: enemy.name || `Enemy ${pos+1}`,
    level,
    role: enemy.role || "assault",
    hpMax: ceil(enemy.hp || (900 + level * 90)),
    hp: ceil(enemy.hp || (900 + level * 90)),
    atk: ceil(enemy.atk || (80 + level * 12)),
    def: ceil(enemy.def || (25 + level * 6)),
    speed: ceil(enemy.speed || (20 + level * 2)),
    rage: clamp(Number(enemy.initialFury || 0), 0, 200),
    skillName: enemy.skillName || "Техніка",
    alive: true,
  };
}
function targetFor(attacker, enemies) {
  return pickAlive(enemies).sort((a,b) => a.pos - b.pos)[0] || null;
}
function calcDamage(attacker, defender, isSkill) {
  const base = Number(attacker.atk || 0);
  const def = Number(defender.def || 0);
  const mult = isSkill ? 1.45 : 1;
  return ceil(Math.max(1, base * mult - def * 0.55));
}
function runDungeonBattle({ dungeon, heroes, enemies }) {
  const allies = heroes.slice(0,5).map((h, i) => heroToUnit(h, "ally", i));
  const foes = enemies.slice(0,5).map((e, i) => enemyToUnit(e, "enemy", i));
  const rounds = [];
  let roundNum = 1;
  while (roundNum <= 20 && pickAlive(allies).length && pickAlive(foes).length) {
    const order = [...pickAlive(allies), ...pickAlive(foes)].sort((a,b) => (b.speed - a.speed) || (a.side === "ally" ? -1 : 1) || (a.pos - b.pos));
    const actions = [];
    for (const actor of order) {
      if (!actor.alive) continue;
      const enemiesArr = actor.side === "ally" ? foes : allies;
      const target = targetFor(actor, enemiesArr);
      if (!target) break;
      const isSkill = Number(actor.rage || 0) >= 100;
      const damage = calcDamage(actor, target, isSkill);
      const before = target.hp;
      target.hp = Math.max(0, target.hp - damage);
      if (target.hp <= 0) target.alive = false;
      const rageBefore = actor.rage;
      actor.rage = isSkill ? Math.max(0, actor.rage - 100) : Math.min(200, actor.rage + 50);
      actions.push({
        actorId: actor.id, actorSide: actor.side, actorName: actor.name,
        targetId: target.id, targetSide: target.side, targetName: target.name,
        type: isSkill ? "skill" : "attack", skillName: isSkill ? (actor.skillName || "Техніка") : null,
        damage, targetHpBefore: before, targetHpAfter: target.hp,
        actorRageBefore: rageBefore, actorRageAfter: actor.rage,
        killed: !target.alive
      });
      if (!pickAlive(allies).length || !pickAlive(foes).length) break;
    }
    rounds.push({ round: roundNum, actions });
    roundNum += 1;
  }
  const win = pickAlive(allies).length > 0 && pickAlive(foes).length === 0;
  const rewards = win ? { silver: Number(dungeon.rewards?.silver || 0), awakenedPoints: Number(dungeon.rewards?.awakenedPoints || 0) } : { silver: 0, awakenedPoints: 0 };
  return {
    mode: "pve",
    result: win ? "win" : "lose",
    dungeonId: dungeon.id,
    allies: allies.map(u => ({ id:u.id, name:u.name, hpMax:u.hpMax, pos:u.pos, side:u.side })),
    enemies: foes.map(u => ({ id:u.id, name:u.name, hpMax:u.hpMax, pos:u.pos, side:u.side })),
    rounds,
    rewards
  };
}
module.exports = { runDungeonBattle };
