import { openModal } from "./windowsRoot.js";

// Адмін панель (Ctrl+Shift+A)
// Вимагає x-admin-key (з localStorage.adminKey), перевіряється на сервері по ADMIN_KEY.

export function openAdminWindow({ state, refreshPlayerFromServer } = {}) {
  const userId = localStorage.getItem("userId") || "";
  if (!userId) {
    openModal({ title: "Адмін", contentHtml: `<div class="badge">Немає userId. Перезайди через /</div>` });
    return;
  }

  openModal({
    title: "Адмін-панель",
    contentHtml: renderShell({ isAdmin: Boolean(state?.player?.isAdminHidden) }),
  });

  bindAdminUI({ state, refreshPlayerFromServer });
}

function renderShell({ isAdmin }) {
  const savedKey = localStorage.getItem("adminKey") || "";
  return `
  <div class="admWrap">
    <div class="admTop">
      <div class="badge">Статус: <b>${isAdmin ? "ADMIN" : "звичайний"}</b> <span style="opacity:.75">(${savedKey ? "ключ збережено" : "нема ключа"})</span></div>
      <div class="admTabs">
        <button class="admTab is-active" data-tab="mail">Пошта</button>
        <button class="admTab" data-tab="players">Гравці</button>
        <button class="admTab" data-tab="inv">Інвентар</button>
        <button class="admTab" data-tab="self">Мій статус</button>
      </div>
    </div>

    <div class="admPanel" data-panel="mail">${renderMailPanel()}</div>
    <div class="admPanel" data-panel="players" style="display:none">${renderPlayersPanel()}</div>
    <div class="admPanel" data-panel="inv" style="display:none">${renderInvPanel()}</div>
    <div class="admPanel" data-panel="self" style="display:none">${renderSelfPanel()}</div>

    <div class="badge" id="admNote" style="margin-top:12px;white-space:pre-wrap"></div>

    <style>
      .admWrap{display:flex;flex-direction:column;gap:10px}
      .admTop{display:flex;flex-direction:column;gap:10px}
      .admTabs{display:flex;gap:8px;flex-wrap:wrap}
      .admTab{padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.18);color:#e9eef6;font-weight:900;cursor:pointer}
      .admTab.is-active{border-color:rgba(255,176,46,.55);box-shadow:0 0 0 2px rgba(255,176,46,.14) inset}
      .admPanel{border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(0,0,0,.16);padding:12px}
      .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
      .inp{flex:1;min-width:160px;padding:10px 10px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.22);color:#e9eef6;outline:none}
      .inp:focus{border-color:rgba(255,176,46,.55)}
      /* виправлення "білий текст на білому" у великих селектах браузера */
      select.inp{background:#0b0f16;color:#e9eef6}
      select.inp option{background:#0b0f16;color:#e9eef6}
      .btn{padding:10px 12px;border-radius:12px;border:0;background:#ffb02e;color:#1b1205;font-weight:900;cursor:pointer}
      .btn.secondary{background:transparent;color:#e9eef6;border:1px solid rgba(255,255,255,.12)}
      .btn.danger{background:rgba(255,70,70,.18);color:#ffd6d6;border:1px solid rgba(255,70,70,.30)}
      .tbl{width:100%;border-collapse:collapse;font-size:13px;margin-top:10px}
      .tbl th,.tbl td{border-bottom:1px solid rgba(255,255,255,.10);padding:8px 6px;text-align:left;vertical-align:top}
      .small{font-size:12px;opacity:.8}
      .pill{display:inline-block;padding:4px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.18);font-weight:800}
      .grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      @media (max-width: 860px){ .grid2{grid-template-columns:1fr} }
    </style>
  </div>`;
}

function renderSelfPanel(){
  const pid = localStorage.getItem("playerId") || "";
  const uid = localStorage.getItem("userId") || "";
  return `
    <div class="grid2">
      <div>
        <div class="pill">userId</div>
        <div class="small" style="margin-top:6px">${esc(uid||"—")}</div>
      </div>
      <div>
        <div class="pill">playerId</div>
        <div class="small" style="margin-top:6px">${esc(pid||"—")}</div>
      </div>
    </div>

    <div style="margin-top:12px" class="pill">Вхід/Вихід ADMIN</div>
    <div class="row" style="margin-top:8px">
      <input class="inp" id="admKey" placeholder="ADMIN ключ" value="${escAttr(localStorage.getItem("adminKey")||"")}" />
      <button class="btn" id="admEnter">Увійти</button>
      <button class="btn secondary" id="admExit">Вийти</button>
    </div>
    <div class="small" style="margin-top:8px">Скрито: Ctrl+Shift+A — відкрити адмінку</div>
  `;
}

function renderMailPanel(){
  return `
    <div class="pill">Відправка пошти</div>
    <div class="row" style="margin-top:10px">
      <select class="inp" id="mailToPlayer"></select>
      <input class="inp" id="mailToNick" placeholder="або нік (опційно)" />
    </div>
    <div class="row" style="margin-top:8px">
      <input class="inp" id="mailTitle" placeholder="Тема" value="Лист від адміністратора" />
    </div>
    <div class="row" style="margin-top:8px">
      <input class="inp" id="mailBody" placeholder="Текст листа" />
    </div>

    <div class="grid2" style="margin-top:10px">
      <div>
        <div class="pill">Валюта (видається одразу)</div>
        <div class="row" style="margin-top:8px">
          <input class="inp" id="attSilver" placeholder="Silver" />
          <input class="inp" id="attGold" placeholder="Gold" />
          <input class="inp" id="attCoupons" placeholder="Coupons" />
        </div>

        <div class="pill" style="margin-top:12px">Досвід (EXP)</div>
        <div class="row" style="margin-top:8px">
          <input class="inp" id="attExp" placeholder="EXP" />
        </div>
      </div>

      <div>
        <div class="pill">Предмети/Герої (падають в сумку)</div>
        <div class="row" style="margin-top:8px">
          <select class="inp" id="attItemSelect"></select>
          <input class="inp" id="attItemQty" placeholder="К-сть" value="1" />
          <button class="btn" id="attAdd">Додати</button>
        </div>
        <div class="small" style="margin-top:6px">Герої — це токени (предмети). Потім активуються в “Сумці”.</div>
        <div id="attList" class="small" style="margin-top:10px;white-space:pre-wrap"></div>
      </div>
    </div>

    <div class="row" style="margin-top:12px">
      <button class="btn" id="mailSend">Відправити</button>
      <button class="btn secondary" id="mailClear">Очистити вкладення</button>
    </div>
  `;
}

function renderPlayersPanel(){
  return `
    <div class="pill">Список гравців</div>
    <div class="row" style="margin-top:10px">
      <input class="inp" id="plSearch" placeholder="Пошук по ніку..." />
      <button class="btn" id="plReload">Оновити</button>
    </div>

    <div id="plTableWrap"></div>

    <div class="pill" style="margin-top:12px">Редагування вибраного гравця</div>
    <div class="row" style="margin-top:10px">
      <select class="inp" id="plPick"></select>
    </div>
    <div class="grid2" style="margin-top:10px">
      <div>
        <div class="small">Валюта</div>
        <div class="row" style="margin-top:6px">
          <input class="inp" id="plSilver" placeholder="Silver" />
          <input class="inp" id="plGold" placeholder="Gold" />
          <input class="inp" id="plCoupons" placeholder="Coupons" />
        </div>
        <div class="row" style="margin-top:8px">
          <button class="btn" id="plApplyCurrency">Застосувати</button>
        </div>
      </div>
      <div>
        <div class="small">VIP / SVIP</div>
        <div class="row" style="margin-top:6px">
          <input class="inp" id="plVip" placeholder="VIP" />
          <input class="inp" id="plSvip" placeholder="SVIP" />
        </div>
        <div class="row" style="margin-top:8px">
          <button class="btn" id="plApplyVip">Застосувати</button>
        </div>
      </div>
    </div>
  `;
}

function renderInvPanel(){
  return `
    <div class="pill">Інвентар гравця</div>
    <div class="row" style="margin-top:10px">
      <select class="inp" id="invPick"></select>
      <button class="btn" id="invLoad">Завантажити</button>
      <button class="btn" id="invOpen" disabled>Переглянути</button>
    </div>

    <div class="row" style="margin-top:10px">
      <div class="pill">Розширити сумку</div>
      <input class="inp" id="invExpandBy" placeholder="+ слоти" value="30" />
      <button class="btn" id="invExpand">Розширити</button>
    </div>

    <div class="pill" style="margin-top:12px">Додати предмет напряму</div>
    <div class="row" style="margin-top:8px">
      <input class="inp" id="invItemSearch" placeholder="Пошук по назві..." />
    </div>
    <div class="row" style="margin-top:8px">
      <select class="inp" id="invItemSelect"></select>
      <input class="inp" id="invItemQty" placeholder="К-сть" value="1" />
      <button class="btn" id="invAddItem">Додати</button>
    </div>

    <div id="invInfo" class="small" style="margin-top:10px;white-space:pre-wrap"></div>
  `;
}

function bindAdminUI({ state, refreshPlayerFromServer }) {
  const note = document.getElementById("admNote");
  const setNote = (msg, isErr=false) => {
    if (!note) return;
    note.textContent = msg || "";
    note.style.color = isErr ? "#ff9f9f" : "";
  };

  function adminKey(){ return String(localStorage.getItem("adminKey")||""); }

  async function safeJson(res){
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return await res.json();
    const txt = await res.text();
    return { ok:false, error:"Non-JSON", details: txt.slice(0,300) };
  }

  async function adminPost(url, body){
    const res = await fetch(url, {
      method:"POST",
      headers: { "Content-Type":"application/json", "x-admin-key": adminKey() },
      body: JSON.stringify(body||{})
    });
    return { res, data: await safeJson(res) };
  }
  async function adminGet(url){
    const res = await fetch(url, { headers: { "x-admin-key": adminKey() } });
    return { res, data: await safeJson(res) };
  }

  // tabs
  document.querySelectorAll(".admTab").forEach(btn=>{
    btn.onclick = ()=>{
      document.querySelectorAll(".admTab").forEach(b=>b.classList.remove("is-active"));
      btn.classList.add("is-active");
      const tab = btn.getAttribute("data-tab");
      document.querySelectorAll(".admPanel").forEach(p=>p.style.display="none");
      const panel = document.querySelector(`.admPanel[data-panel="${tab}"]`);
      if(panel) panel.style.display="block";
    };
  });

  // SELF enter/exit
  const keyInput = document.getElementById("admKey");
  const enterBtn = document.getElementById("admEnter");
  const exitBtn = document.getElementById("admExit");

  if (enterBtn) enterBtn.onclick = async ()=>{
    const key = String(keyInput?.value||"").trim();
    if(!key){ setNote("Введи ADMIN ключ", true); return; }
    localStorage.setItem("adminKey", key);

    const userId = localStorage.getItem("userId") || "";
    // ✅ server expects adminKey in body for /api/admin/enter
    const { res, data } = await adminPost("/api/admin/enter", { userId, adminKey: key });
    if(!res.ok || !data?.ok){ setNote(`❌ ${data?.error||res.status}`, true); return; }
    setNote("✅ ADMIN активовано");
    refreshPlayerFromServer && refreshPlayerFromServer();
  };
  if (exitBtn) exitBtn.onclick = async ()=>{
    const userId = localStorage.getItem("userId") || "";
    const { res, data } = await adminPost("/api/admin/exit", { userId });
    if(!res.ok || !data?.ok){ setNote(`❌ ${data?.error||res.status}`, true); return; }
    setNote("✅ ADMIN вимкнено");
    refreshPlayerFromServer && refreshPlayerFromServer();
  };

  // load players list for dropdowns
  let players = [];
  async function loadPlayers(){
    const { res, data } = await adminGet("/api/admin/players/list");
    if(!res.ok || !data?.ok){ setNote(`❌ Не вдалося завантажити гравців: ${data?.error||res.status}`, true); return; }
    players = Array.isArray(data.players) ? data.players : [];
    fillPlayerSelect("mailToPlayer", players);
    fillPlayerSelect("plPick", players);
    fillPlayerSelect("invPick", players);
    setNote(`✅ Гравців: ${players.length}`);
    renderPlayersTable(players);
    applySearchFilter();
  }

  function fillPlayerSelect(id, arr){
    const el = document.getElementById(id);
    if(!el) return;
    el.innerHTML = `<option value="">— вибери —</option>` + arr.map(p=>`<option value="${escAttr(p.id)}">${esc(p.nickname||p.id)}</option>`).join("");
  }

  // items catalog
  let catalog = [];
  async function loadCatalog(){
    const { res, data } = await adminGet("/api/admin/items/catalog");
    if(!res.ok || !data?.ok){ setNote(`❌ Catalog: ${data?.error||res.status}`, true); return; }
    catalog = Array.isArray(data.items) ? data.items : [];
    fillItemSelect("attItemSelect", catalog);
    fillItemSelect("invItemSelect", catalog);
  }
  function fillItemSelect(id, arr){
    const el = document.getElementById(id);
    if(!el) return;
    el.innerHTML = arr.map(it=>`<option value="${escAttr(it.tplId)}">${esc(it.name)} <span class="small">(${esc(it.tplId)})</span></option>`).join("");
  }

  // MAIL attachments builder
  let builtItems = [];
  const attList = document.getElementById("attList");
  const renderAttList = ()=>{
    if(!attList) return;
    if(!builtItems.length){ attList.textContent = "Вкладення: (порожньо)"; return; }
    attList.textContent = "Вкладення:\n" + builtItems.map(x=>`- ${x.tplId} x${x.qty}`).join("\n");
  };
  renderAttList();

  const attAdd = document.getElementById("attAdd");
  if(attAdd) attAdd.onclick = ()=>{
    const sel = document.getElementById("attItemSelect");
    const qtyEl = document.getElementById("attItemQty");
    const tplId = String(sel?.value||"").trim();
    const qty = Math.max(1, Math.min(999, Number(qtyEl?.value||1)));
    if(!tplId) return;
    const existing = builtItems.find(x=>x.tplId===tplId);
    if(existing) existing.qty += qty;
    else builtItems.push({ tplId, qty });
    renderAttList();
  };

  const mailClear = document.getElementById("mailClear");
  if(mailClear) mailClear.onclick = ()=>{ builtItems = []; renderAttList(); };

  const mailSend = document.getElementById("mailSend");
  if(mailSend) mailSend.onclick = async ()=>{
    const toPlayerId = String(document.getElementById("mailToPlayer")?.value||"").trim();
    const toNickname = String(document.getElementById("mailToNick")?.value||"").trim();
    const title = String(document.getElementById("mailTitle")?.value||"").trim();
    const body = String(document.getElementById("mailBody")?.value||"").trim();

    const silver = Number(document.getElementById("attSilver")?.value||0);
    const gold = Number(document.getElementById("attGold")?.value||0);
    const coupons = Number(document.getElementById("attCoupons")?.value||0);
    const exp = Number(document.getElementById("attExp")?.value||0);

    const attachments = [];
    if ((silver||0)!==0 || (gold||0)!==0 || (coupons||0)!==0){
      attachments.push({ kind:"currency", value:{ silver, gold, coupons }});
    }
    if (Number.isFinite(exp) && exp > 0){
      attachments.push({ kind:"exp", value:{ amount: exp }});
    }
    for(const it of builtItems){
      attachments.push({ kind:"item", tplId: it.tplId, qty: it.qty });
    }

    const { res, data } = await adminPost("/api/admin/mail/send", { toPlayerId, toNickname, title, body, attachments });
    if(!res.ok || !data?.ok){ setNote(`❌ Mail: ${data?.error||res.status}`, true); return; }
    setNote("✅ Лист відправлено");
  };

  // PLAYERS tab table + edits
  const plReload = document.getElementById("plReload");
  if(plReload) plReload.onclick = ()=>loadPlayers();

  const plPick = document.getElementById("plPick");
  if(plPick) plPick.onchange = ()=>{
    const id = String(plPick.value||"");
    const p = players.find(x=>x.id===id);
    if(!p) return;
    document.getElementById("plSilver").value = p.currency?.silver ?? 0;
    document.getElementById("plGold").value = p.currency?.gold ?? 0;
    document.getElementById("plCoupons").value = p.currency?.coupons ?? 0;
    document.getElementById("plVip").value = p.vip ?? 0;
    document.getElementById("plSvip").value = p.svip ?? 0;
  };

  const plApplyCurrency = document.getElementById("plApplyCurrency");
  if(plApplyCurrency) plApplyCurrency.onclick = async ()=>{
    const playerId = String(plPick?.value||"");
    if(!playerId){ setNote("Вибери гравця", true); return; }
    const patch = { currency: {
      silver: Number(document.getElementById("plSilver")?.value||0),
      gold: Number(document.getElementById("plGold")?.value||0),
      coupons: Number(document.getElementById("plCoupons")?.value||0),
    }};
    const { res, data } = await adminPost("/api/admin/player/update", { playerId, patch });
    if(!res.ok || !data?.ok){ setNote(`❌ Update: ${data?.error||res.status}`, true); return; }
    setNote("✅ Валюта оновлена");
    await loadPlayers();
  };

  const plApplyVip = document.getElementById("plApplyVip");
  if(plApplyVip) plApplyVip.onclick = async ()=>{
    const playerId = String(plPick?.value||"");
    if(!playerId){ setNote("Вибери гравця", true); return; }
    const patch = { vip: Number(document.getElementById("plVip")?.value||0), svip: Number(document.getElementById("plSvip")?.value||0) };
    const { res, data } = await adminPost("/api/admin/player/update", { playerId, patch });
    if(!res.ok || !data?.ok){ setNote(`❌ Update: ${data?.error||res.status}`, true); return; }
    setNote("✅ VIP/SVIP оновлено");
    await loadPlayers();
  };

  // Search filter + table
  const plSearch = document.getElementById("plSearch");
  const applySearchFilter = ()=>{
    const q = String(plSearch?.value||"").trim().toLowerCase();
    const filtered = !q ? players : players.filter(p=>String(p.nickname||"").toLowerCase().includes(q));
    renderPlayersTable(filtered);
  };
  if(plSearch) plSearch.oninput = applySearchFilter;

  function renderPlayersTable(arr){
    const wrap = document.getElementById("plTableWrap");
    if(!wrap) return;
    if(!arr.length){ wrap.innerHTML = `<div class="small">Порожньо</div>`; return; }
    wrap.innerHTML = `
      <table class="tbl">
        <thead>
          <tr><th>Нік</th><th>LV</th><th>Silver</th><th>Gold</th><th>Coupons</th><th>VIP</th><th>SVIP</th></tr>
        </thead>
        <tbody>
          ${arr.map(p=>`
            <tr>
              <td><b>${esc(p.nickname||p.id)}</b><div class="small">${esc(p.id)}</div></td>
              <td>${num(p.level)}</td>
              <td>${num(p.currency?.silver)}</td>
              <td>${num(p.currency?.gold)}</td>
              <td>${num(p.currency?.coupons)}</td>
              <td>${num(p.vip)}</td>
              <td>${num(p.svip)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  // INVENTORY tab
  const invPick = document.getElementById("invPick");
  const invInfo = document.getElementById("invInfo");
  const invOpen = document.getElementById("invOpen");
  let lastInv = null;
  let lastInvPlayerId = null;

  const invLoad = document.getElementById("invLoad");
  if(invLoad) invLoad.onclick = async ()=>{
    const playerId = String(invPick?.value||"");
    if(!playerId){ setNote("Вибери гравця", true); return; }
    const { res, data } = await adminGet(`/api/admin/player/inventory?playerId=${encodeURIComponent(playerId)}`);
    if(!res.ok || !data?.ok){ setNote(`❌ Inventory: ${data?.error||res.status}`, true); return; }
    const inv = data.inventory || {};
    lastInv = inv;
    lastInvPlayerId = playerId;
    if(invOpen) invOpen.disabled = false;
    const cap = Number(inv.capacity||60);
    const cnt = Array.isArray(inv.bagItems)? inv.bagItems.length : 0;
    invInfo.textContent = `Сумка: ${cnt}/${cap}\nЕкіпіровка по героях: ${Object.keys(inv.equippedItemsByHero||{}).length}`;
    setNote("✅ Інвентар завантажено");
  };


  if(invOpen) invOpen.onclick = ()=>{
    if(!lastInv){ setNote("Спочатку натисни 'Завантажити'", true); return; }
    const bag = Array.isArray(lastInv.bagItems) ? lastInv.bagItems : [];
    const cap = Number(lastInv.capacity||60);
    const eq = lastInv.equippedItemsByHero || {};
    const bagHtml = bag.length ? bag.map(it=>`<div class="mailAtt"><b>${esc(it.name||it.tplId||"item")}</b> <span style="opacity:.75">(${esc(it.type||"")})</span></div>`).join("") : `<div class="badge">Сумка порожня</div>`;
    openModal({
      title: `Інвентар: ${esc(lastInvPlayerId||"")}`,
      contentHtml: `
        <div class="pill">Сумка: ${bag.length}/${cap}</div>
        <div class="mailDAttsGrid" style="margin-top:10px">${bagHtml}</div>
        <div class="pill" style="margin-top:12px">Екіпіровка по героях: ${Object.keys(eq||{}).length}</div>
      `
    });
  };

  const invExpand = document.getElementById("invExpand");
  if(invExpand) invExpand.onclick = async ()=>{
    const playerId = String(invPick?.value||"");
    if(!playerId){ setNote("Вибери гравця", true); return; }
    const add = Number(document.getElementById("invExpandBy")?.value||0);
    const { res, data } = await adminPost("/api/admin/player/inventory/expand", { playerId, add });
    if(!res.ok || !data?.ok){ setNote(`❌ Expand: ${data?.error||res.status}`, true); return; }
    setNote(`✅ Новий capacity: ${data.capacity}`);
    invLoad && invLoad.onclick();
  };

  // Inventory add item with search filter
  const invItemSearch = document.getElementById("invItemSearch");
  const invItemSelect = document.getElementById("invItemSelect");
  const filterInvItems = ()=>{
    const q = String(invItemSearch?.value||"").trim().toLowerCase();
    const arr = !q ? catalog : catalog.filter(it=>String(it.name||"").toLowerCase().includes(q));
    if(invItemSelect){
      invItemSelect.innerHTML = arr.map(it=>`<option value="${escAttr(it.tplId)}">${esc(it.name)} (${esc(it.tplId)})</option>`).join("");
    }
  };
  if(invItemSearch) invItemSearch.oninput = filterInvItems;

  const invAddItem = document.getElementById("invAddItem");
  if(invAddItem) invAddItem.onclick = async ()=>{
    const playerId = String(invPick?.value||"");
    if(!playerId){ setNote("Вибери гравця", true); return; }
    const tplId = String(invItemSelect?.value||"").trim();
    const qty = Number(document.getElementById("invItemQty")?.value||1);
    const { res, data } = await adminPost("/api/admin/player/inventory/addItem", { playerId, tplId, qty });
    if(!res.ok || !data?.ok){ setNote(`❌ AddItem: ${data?.error||res.status}`, true); return; }
    setNote(`✅ Додано: ${data.added} (в сумці: ${data.bagCount}/${data.capacity})`);
    invLoad && invLoad.onclick();
  };

  // init load
  loadPlayers();
  loadCatalog();
}

function num(v){ const n = Number(v); return Number.isFinite(n)? n : 0; }
function esc(s){ return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;"); }
function escAttr(s){ return esc(s).replaceAll("'","&#039;"); }
