// client/player.js
// Клієнтські API-хелпери (fetch до сервера)

async function apiFetch(url, opts = {}) {
  try {
    const res = await fetch(url, opts);
    const ct = res.headers.get("content-type") || "";
    let data = null;

    if (ct.includes("application/json")) data = await res.json();
    else data = { ok: false, error: "Non-JSON response", details: (await res.text()).slice(0, 300) };

    if (!res.ok && data && data.ok !== true) {
      return { ok: false, error: data.error || `HTTP ${res.status}`, details: data.details };
    }
    return data;
  } catch (e) {
    return { ok: false, error: "Network error", details: String(e?.message || e) };
  }
}

// ===== PLAYER =====
function apiGetPlayer(playerId) {
  return apiFetch(`/api/player/me?playerId=${encodeURIComponent(playerId)}`);
}
function apiAddExp(playerId, amount) {
  return apiFetch(`/api/player/addExp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, amount }),
  });
}

// ===== HEROES =====
function apiListHeroes(playerId) {
  return apiFetch(`/api/heroes/list?playerId=${encodeURIComponent(playerId)}`);
}

// ===== FORMATION =====
function apiGetFormation(playerId) {
  return apiFetch(`/api/formation/get?playerId=${encodeURIComponent(playerId)}`);
}
function apiSetFormation(playerId, formation) {
  return apiFetch(`/api/formation/set`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, formation }),
  });
}

// ===== INVENTORY =====
function apiGetInventory(playerId) {
  return apiFetch(`/api/inventory/get?playerId=${encodeURIComponent(playerId)}`);
}
function apiEquipHero(playerId, heroId, itemId) {
  return apiFetch(`/api/inventory/equip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, heroId, itemId }),
  });
}
function apiUnequipHero(playerId, heroId, slot) {
  return apiFetch(`/api/inventory/unequip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, heroId, slot }),
  });
}

// ===== MAIL =====
function apiMailList(playerId) {
  return apiFetch(`/api/mail/list?playerId=${encodeURIComponent(playerId)}`);
}
function apiMailSeed(playerId) {
  return apiFetch(`/api/mail/seed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId }),
  });
}
function apiMailClaim(playerId, letterId) {
  return apiFetch(`/api/mail/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, letterId }),
  });
}