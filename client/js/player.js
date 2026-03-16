// client/player.js

function getAdminKey(){
  return localStorage.getItem("adminKey") || "";
}

async function _json(url, options){
  const r = await fetch(url, options);
  const ct = r.headers.get("content-type") || "";
  let data = null;
  try {
    data = ct.includes("application/json") ? await r.json() : { ok:false, error:"Non-JSON response" };
  } catch(e){
    data = { ok:false, error:"Bad JSON", details:String(e?.message||e) };
  }
  if(!r.ok && data && data.ok !== true){
    data.httpStatus = r.status;
  }
  return data;
}

// CREATE
async function apiCreatePlayer(payload){
  const body = {
    nickname: payload?.nickname,
    gender: payload?.gender,
    type: payload?.type || payload?.classType,
  };
  return _json("/api/hero/create", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(body)
  });
}

// PLAYER
async function apiGetPlayer(playerId){
  return _json(`/api/player/me?playerId=${encodeURIComponent(playerId)}`);
}
async function apiAddExp(playerId, amount){
  return _json("/api/player/addExp", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ playerId, amount })
  });
}

// HEROES
async function apiListHeroes(playerId){
  return _json(`/api/heroes/list?playerId=${encodeURIComponent(playerId)}`);
}

// FORMATION
async function apiGetFormation(playerId){
  return _json(`/api/formation/get?playerId=${encodeURIComponent(playerId)}`);
}
async function apiSetFormation(playerId, formation){
  return _json("/api/formation/set", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ playerId, formation })
  });
}

// INVENTORY
async function apiGetInventory(playerId){
  return _json(`/api/inventory/get?playerId=${encodeURIComponent(playerId)}`);
}
async function apiEquipHero(playerId, heroId, itemId){
  return _json("/api/inventory/equip", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ playerId, heroId, itemId })
  });
}
async function apiUnequipHero(playerId, heroId, slot){
  return _json("/api/inventory/unequip", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ playerId, heroId, slot })
  });
}

// MAIL
async function apiMailList(playerId){
  return _json(`/api/mail/list?playerId=${encodeURIComponent(playerId)}`);
}
async function apiMailSeed(playerId){
  return _json("/api/mail/seed", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ playerId })
  });
}
async function apiMailClaim(playerId, letterId){
  return _json("/api/mail/claim", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ playerId, letterId })
  });
}

// ================= ADMIN =================
async function apiAdminPlayersList(){
  return _json("/api/admin/players/list", {
    method:"GET",
    headers:{ "x-admin-key": getAdminKey() }
  });
}
async function apiAdminItemsCatalog(){
  return _json("/api/admin/items/catalog", {
    method:"GET",
    headers:{ "x-admin-key": getAdminKey() }
  });
}
async function apiAdminPlayerUpdate(playerId, patch){
  return _json("/api/admin/player/update", {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "x-admin-key": getAdminKey()
    },
    body: JSON.stringify({ playerId, patch })
  });
}
async function apiAdminMailSend(payload){
  return _json("/api/admin/mail/send", {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "x-admin-key": getAdminKey()
    },
    body: JSON.stringify(payload)
  });
}