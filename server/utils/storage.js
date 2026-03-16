// server/utils/storage.js
const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "..", "data");

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

function filePath(name) {
  ensureDataDir();
  return path.join(dataDir, name);
}

function readJSON(name, fallback) {
  const fp = filePath(name);
  if (!fs.existsSync(fp)) {
    writeJSON(name, fallback ?? {});
    return fallback ?? {};
  }
  try {
    const raw = fs.readFileSync(fp, "utf8");
    return raw ? JSON.parse(raw) : (fallback ?? {});
  } catch (e) {
    // If corrupted, back up and reset
    try {
      fs.copyFileSync(fp, fp + ".bak");
    } catch {}
    writeJSON(name, fallback ?? {});
    return fallback ?? {};
  }
}

function writeJSON(name, obj) {
  const fp = filePath(name);
  const tmp = fp + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), "utf8");
  fs.renameSync(tmp, fp);
}

function uid(prefix = "id") {
  // good-enough id
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

module.exports = { readJSON, writeJSON, uid };