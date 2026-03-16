// server/engine/skills.js
const { readJSON } = require("../utils/storage");

function getSkillsDB() {
  return readJSON("skills.json", { skills: [] });
}

function listSkills() {
  return getSkillsDB().skills || [];
}

function getSkillById(id) {
  return listSkills().find(s => s.id === id) || null;
}

module.exports = { listSkills, getSkillById };