// server/engine/auras.js
const { readJSON } = require("../utils/storage");

function getAurasDB() {
  return readJSON("auras.json", { auras: [] });
}

function listAuras() {
  return getAurasDB().auras || [];
}

function getAuraById(id) {
  return listAuras().find(a => a.id === id) || null;
}

module.exports = { listAuras, getAuraById };