// server/engine/rarity.js
const RARITY_MULT = {
  "A-": 0.9,
  "A": 1.0,
  "A+": 1.1,
  "S-": 1.2,
  "S": 1.3,
  "S+": 1.4,
  "SS": 1.6,
  "SSS": 1.8,
  "SR": 2.0,
  "SSR": 2.5
};

function rarityMultiplier(rarity) {
  return RARITY_MULT[rarity] ?? 1.0;
}

module.exports = { rarityMultiplier, RARITY_MULT };