// server/engine/level.js
function expToNext(level) {
  // L1->L2 = 100, далі росте
  return 100 + Math.max(0, (level ?? 1) - 1) * 50;
}

function applyExp(player, addExp) {
  let lvl = player.level ?? 1;
  let exp = player.exp ?? 0;

  exp += Math.max(0, Number(addExp || 0));

  while (exp >= expToNext(lvl)) {
    exp -= expToNext(lvl);
    lvl += 1;
  }

  player.level = lvl;
  player.exp = exp;
  return player;
}

module.exports = { expToNext, applyExp };