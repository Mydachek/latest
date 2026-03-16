// server/engine/stats.js
const { rarityMultiplier } = require("./rarity");

/**
 * Base stats:
 * spirit, chakra, might, agility
 *
 * Derived:
 * hp = might*10
 * physAtk = spirit
 * physDef = spirit
 * stratAtk = chakra
 * stratDef = chakra
 * speed = agility
 *
 * Growth: perLevelGrowth (object), multiplied by rarity mult.
 */

function calcBaseAtLevel(hero) {
  const level = hero.level ?? 1;
  const rarity = hero.rarity ?? "A";
  const mult = rarityMultiplier(rarity);

  const base = hero.baseStats ?? { spirit: 5, chakra: 5, might: 5, agility: 5 };
  const growth = hero.growthPerLevel ?? { spirit: 1, chakra: 1, might: 1, agility: 1 };

  // Level 1 uses base; each level above adds growth
  const addLevels = Math.max(0, level - 1);

  return {
    spirit: Math.round(base.spirit + addLevels * growth.spirit * mult),
    chakra: Math.round(base.chakra + addLevels * growth.chakra * mult),
    might: Math.round(base.might + addLevels * growth.might * mult),
    agility: Math.round(base.agility + addLevels * growth.agility * mult)
  };
}

function derivePrimary(main) {
  return {
    hp: main.might * 10,
    physAtk: main.spirit,
    physDef: main.spirit,
    stratAtk: main.chakra,
    stratDef: main.chakra,
    speed: main.agility
  };
}

function mergeBonuses(primary, bonus = {}) {
  const out = { ...primary };
  for (const k of Object.keys(bonus)) {
    out[k] = (out[k] ?? 0) + bonus[k];
  }
  return out;
}

/**
 * Secondary stats: stored directly, and can be modified by items/auras
 */
function calcSecondary(hero) {
  const sec = hero.secondary ?? {};
  // default zeros
  return {
    damageRate: sec.damageRate ?? 0,
    accuracyRate: sec.accuracyRate ?? 0,
    critRate: sec.critRate ?? 10,
    successRate: sec.successRate ?? 0,
    punchRate: sec.punchRate ?? 0,
    avoidDamageRate: sec.avoidDamageRate ?? 0,
    dodgeRate: sec.dodgeRate ?? 0,
    contraRate: sec.contraRate ?? 0,
    blockRate: sec.blockRate ?? 0,
    helpRate: sec.helpRate ?? 0,
    healRate: sec.healRate ?? 0
  };
}

function calcAllStats(hero, { items = [], auras = [] } = {}) {
  const main = calcBaseAtLevel(hero);
  let primary = derivePrimary(main);
  let secondary = calcSecondary(hero);

  // Apply item bonuses
  for (const it of items) {
    if (it?.bonusPrimary) primary = mergeBonuses(primary, it.bonusPrimary);
    if (it?.bonusSecondary) secondary = mergeBonuses(secondary, it.bonusSecondary);
    if (it?.bonusMain) {
      // recalc from main? simplest: add to primary directly
      // (for proto)
      const bm = it.bonusMain;
      if (bm.might) primary.hp += bm.might * 10;
      if (bm.spirit) { primary.physAtk += bm.spirit; primary.physDef += bm.spirit; }
      if (bm.chakra) { primary.stratAtk += bm.chakra; primary.stratDef += bm.chakra; }
      if (bm.agility) primary.speed += bm.agility;
    }
  }

  // Apply aura bonuses
  for (const au of auras) {
    if (au?.effect?.primary) primary = mergeBonuses(primary, au.effect.primary);
    if (au?.effect?.secondary) secondary = mergeBonuses(secondary, au.effect.secondary);
  }

  return { main, primary, secondary };
}

module.exports = { calcAllStats };