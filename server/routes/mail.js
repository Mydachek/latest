// server/routes/mail.js
const express = require("express");
const { readJSON, writeJSON, uid } = require("../utils/storage");

const router = express.Router();

router.get("/list", (req, res) => {
  const playerId = req.query.playerId;
  if (!playerId) return res.status(400).json({ ok: false, error: "playerId required" });

  const mailDB = readJSON("mail.json", { mail: {} });
  res.json({ ok: true, letters: mailDB.mail[playerId] || [] });
});

// тест
router.post("/seed", (req, res) => {
  const { playerId } = req.body || {};
  if (!playerId) return res.status(400).json({ ok: false, error: "playerId required" });

  const mailDB = readJSON("mail.json", { mail: {} });
  mailDB.mail[playerId] ||= [];

  mailDB.mail[playerId].push({
    id: uid("mail"),
    from: "Система",
    title: "Вход в деревню",
    body: "Добро пожаловать! Это тестовое письмо.",
    attachments: ["item_starter_weapon", "item_starter_armor"],
    claimed: false,
    createdAt: Date.now()
  });

  writeJSON("mail.json", mailDB);
  res.json({ ok: true });
});

// ✅ "Адмінка" (поки API). Надіслати лист з itemIds
router.post("/send", (req, res) => {
  const { playerId, title, body, attachments } = req.body || {};
  if (!playerId) return res.status(400).json({ ok: false, error: "playerId required" });

  const mailDB = readJSON("mail.json", { mail: {} });
  mailDB.mail[playerId] ||= [];

  mailDB.mail[playerId].push({
    id: uid("mail"),
    from: "Admin",
    title: title || "Награда",
    body: body || "Вам выдана награда.",
    attachments: Array.isArray(attachments) ? attachments : [],
    claimed: false,
    createdAt: Date.now()
  });

  writeJSON("mail.json", mailDB);
  res.json({ ok: true });
});

// ✅ Claim: додає items у bag (підтримка старої + нової структури inventories.json)
router.post("/claim", (req, res) => {
  const { playerId, mailId } = req.body || {};
  if (!playerId || !mailId) return res.status(400).json({ ok: false, error: "playerId+mailId required" });

  const mailDB = readJSON("mail.json", { mail: {} });

  // inventories.json у тебе зараз масивом: { inventories: [...] }
  const invDB = readJSON("inventories.json", { inventories: [] });

  // items.json старого формату: { items: { itemId: {...} } }
  const itemsDB = readJSON("items.json", { items: {} });

  const letters = mailDB.mail[playerId] || [];
  const letter = letters.find(x => x.id === mailId);
  if (!letter) return res.status(404).json({ ok: false, error: "mail not found" });
  if (letter.claimed) return res.json({ ok: true });

  // --- знайти інвентар гравця у масиві ---
  let recIndex = -1;
  let rec = null;

  if (Array.isArray(invDB.inventories)) {
    recIndex = invDB.inventories.findIndex(x => x && x.playerId === playerId);
    rec = recIndex >= 0 ? invDB.inventories[recIndex] : null;
  }

  // Якщо не знайшли — спробуємо знайти legacy запис без playerId (не ідеально, але не падаємо)
  // (краще завжди мати playerId-запис)
  if (!rec) {
    return res.status(404).json({ ok: false, error: "inventory not found (no record for playerId)" });
  }

  // Нова структура: rec.inventory.bagItems (масив об'єктів)
  // Стара структура: rec.bag (масив itemId)
  const invNew = rec.inventory;
  const invLegacy = rec;

  const atts = Array.isArray(letter.attachments) ? letter.attachments : [];

  // додаємо вкладення
  if (invNew && Array.isArray(invNew.bagItems)) {
    invNew.bagItems ||= [];
    for (const itemId of atts) {
      const tpl = itemsDB.items[itemId];
      if (!tpl) continue;

      invNew.bagItems.push({
        id: uid("itm"),
        tplId: itemId,
        type: tpl.type || (tpl.slot ? "equipment" : "misc"),
        slot: tpl.slot ?? null,
        name: tpl.name || itemId,
        desc: tpl.desc || "",
      });
    }
  } else {
    invLegacy.bag ||= [];
    for (const itemId of atts) {
      if (itemsDB.items[itemId]) invLegacy.bag.push(itemId);
    }
  }

  letter.claimed = true;

  // запис назад
  if (invNew) rec.inventory = invNew;
  invDB.inventories[recIndex] = rec;

  writeJSON("inventories.json", invDB);
  writeJSON("mail.json", mailDB);

  res.json({ ok: true });
});

module.exports = router;