// server/engine/rage.js

function rageBonus(rage) {
  // Each 4 rage above 100 => +1% damage
  if (rage <= 100) return 1;
  return 1 + ((rage - 100) / 4) / 100;
}

function rageGain({ isCrit, targetDodged }) {
  if (targetDodged) return 0;
  return isCrit ? 100 : 50;
}

module.exports = { rageBonus, rageGain };