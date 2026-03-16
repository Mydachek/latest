
const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

function readJSON(name, fallback) {
  const fp = path.join(__dirname, '..', 'data', name);
  if (!fs.existsSync(fp)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch {
    return fallback;
  }
}

router.get('/', (req, res) => {
  const dungeons = readJSON('dungeons.json', { dungeons: [] });
  const list = Array.isArray(dungeons) ? dungeons : (Array.isArray(dungeons.dungeons) ? dungeons.dungeons : []);
  res.json({ ok: true, dungeons: list });
});

module.exports = router;
