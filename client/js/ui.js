// client/js/ui.js
import { state, subscribe, tickOnline, setState } from "./state.js";

import { renderHudTop } from "./modules/hudTop.js";
import { renderHudLeft } from "./modules/hudLeft.js";
import { renderHudRight } from "./modules/hudRight.js";
import { renderHudBottom } from "./modules/hudBottom.js";

import { openModal } from "./modules/windows/windowsRoot.js";
import { openFormationWindow } from "./modules/windows/formationWindow.js";
import { openTeamWindow } from "./modules/windows/teamWindow.js";

export function initUI() {
  // первинний рендер
  renderAll(state);

  // ререндер при змінах state
  subscribe(renderAll);

  // онлайн таймер
  setInterval(tickOnline, 1000);

  // підтягуємо дані гравця з сервера
  refreshPlayerFromServer();
  refreshServerTime();
  refreshHeroesFromServer();
  refreshFormationFromServer();
  // періодичне оновлення валюти/VIP (можна потім зробити через socket)
  setInterval(refreshPlayerFromServer, 5000);
  // resync server clock occasionally (in case of drift)
  setInterval(refreshServerTime, 60000);

  // кнопки + хоткеї
  bindActions();
  bindHotkeys();
}

async function refreshServerTime(){
  try{
    const res = await fetch(`/api/time`);
    const data = await safeJson(res);
    if(!res.ok || !data?.ok) return;
    setState(s=>{
      s.ui ||= {};
      s.ui.serverTimeMs = Number(data.nowMs || Date.now());
      s.ui.serverTz = String(data.tz || "Europe/Dublin");
    });
  }catch(e){}
}

async function refreshHeroesFromServer(){
  const playerId = localStorage.getItem("playerId") || "";
  if(!playerId) return;
  try{
    const res = await fetch(`/api/heroes/list?playerId=${encodeURIComponent(playerId)}`);
    const data = await safeJson(res);
    if(!res.ok || !data?.ok || !Array.isArray(data.heroes)) return;

    const mapRole = (r)=>{
      const x = String(r||"").toLowerCase();
      if(x==="support") return "helper";
      if(x==="avantgard" || x==="vanguard") return "tank";
      if(x==="tank") return "tank";
      if(x==="helper") return "helper";
      if(x==="assault") return "assault";
      return x || "assault";
    };

    setState(s=>{
      s.heroes = data.heroes.map(h=>({
        id: h.id,
        name: h.name,
        role: mapRole(h.role) || "assault",
        isMain: Boolean(h.isMain),
        lvl: Number(h.level||1),
        rank: String(h.rarity || "C"),
        classType: h.classType || "taijutsu",
        skills: Array.isArray(h.skills) ? h.skills : [],
        skillBookSkills: Array.isArray(h.skillBookSkills) ? h.skillBookSkills : [],
        growthPerLevel: h.growthPerLevel || null,
        growth: h.growth || null,
        // під стати
        __raw: h
      }));
      // вибір героя за замовченням
      if(!s.team.selectedHeroId){
        const gg = s.heroes.find(x=>x.isMain) || s.heroes[0];
        s.team.selectedHeroId = gg ? gg.id : null;
      }

      // швидкий stats cache
      s.stats ||= {};
      for(const h of data.heroes){
        if(!h?.stats) continue;
        const m = h.stats.main || {};
        const p = h.stats.primary || {};
        const se = h.stats.secondary || {};

        // Плоский кеш статів для UI (TeamStats/Power/тултіпи).
        // Якщо якесь поле не покладемо сюди — воно буде 0 у вікні характеристик.
        s.stats[h.id] = {
          // main
          spirit: Number(m.spirit||0) || 0,
          // у нас в main це might, але UI читає strength
          might: Number(m.might||0) || 0,
          strength: Number(m.might||0) || 0,
          chakra: Number(m.chakra||0) || 0,
          agility: Number(m.agility||0) || 0,

          // primary
          hp: Number(p.hp||0) || 0,
          physAtk: Number(p.physAtk||0) || 0,
          physDef: Number(p.physDef||0) || 0,
          stratAtk: Number(p.stratAtk||0) || 0,
          stratDef: Number(p.stratDef||0) || 0,
          speed: Number(p.speed||0) || 0,
          initialFury: Number(p.initialFury||0) || 0,

          // secondary
          damageRate: Number(se.damageRate||0) || 0,
          accuracyRate: Number(se.accuracyRate||0) || 0,
          critRate: Number(se.critRate||0) || 0,
          successRate: Number(se.successRate||0) || 0,
          punchRate: Number(se.punchRate||0) || 0,
          avoidDamageRate: Number(se.avoidDamageRate||0) || 0,
          dodgeRate: Number(se.dodgeRate||0) || 0,
          contraRate: Number(se.contraRate||0) || 0,
          blockRate: Number(se.blockRate||0) || 0,
          helpRate: Number(se.helpRate||0) || 0,
          healRate: Number(se.healRate||0) || 0,

          // наша нова характеристика "S-атака" (антиблок) — % (0..90)
          sAttackRate: Number(se.sAttackRate||0) || 0,

          // power
          power: Number(h.power || p.power || 0) || 0,
        };
      }
    });
  }catch(e){}
}

async function refreshFormationFromServer(){
  const playerId = localStorage.getItem("playerId") || "";
  if(!playerId) return;
  try{
    const res = await fetch(`/api/formation/get?playerId=${encodeURIComponent(playerId)}`);
    const data = await safeJson(res);
    if(!res.ok || !data?.ok || !data?.formation) return;
    const f = data.formation;
    const top = Array.isArray(f.top) ? f.top : [null,null];
    const mid = Array.isArray(f.middle) ? f.middle : [null,null,null];
    const bot = Array.isArray(f.bottom) ? f.bottom : [null,null];
    setState(s=>{
      s.formation.slots = {
        r1c1: top[0]||null,
        r1c2: top[1]||null,
        r2c1: mid[0]||null,
        r2c2: mid[1]||null,
        r2c3: mid[2]||null,
        r3c1: bot[0]||null,
        r3c2: bot[1]||null,
      };
    });
  }catch(e){}
}

async function refreshPlayerFromServer(){
  const playerId = localStorage.getItem("playerId") || "";
  if(!playerId) return;
  try{
    const res = await fetch(`/api/player/me?playerId=${encodeURIComponent(playerId)}`);
    const ct = res.headers.get("content-type") || "";
    const data = ct.includes("application/json") ? await res.json() : null;
    if(!res.ok || !data?.ok || !data?.player) return;

    const p = data.player;
    const cur = p.currency || {};

    // синхронізуємо state.player для HUD
    state.player.id = p.id;
    state.player.name = p.nickname || p.name || state.player.name;
    state.player.level = Number(p.level || 1);
    state.player.exp = Number(p.exp || 0);
    state.player.expToNext = Number(p.expToNext || 0);
    state.player.gold = Number(cur.gold ?? p.gold ?? 0);
    state.player.silver = Number(cur.silver ?? p.silver ?? 0);
    state.player.coupons = Number(cur.coupons ?? p.coupons ?? 0);
    state.player.vip = Number(p.vip ?? 0);
    state.player.svip = Number(p.svip ?? 0);
    state.player.isAdminHidden = Boolean(p.isAdminHidden ?? false);

    // легкий "тригер" ререндеру
    // (setState тут не імпортуємо, щоб не переробляти архітектуру; subscribe рендерить по tickOnline)
  }catch(e){
    // тихо ігноруємо
  }
}

function renderAll(s) {
  renderHudTop(s);
  renderHudLeft(s);
  renderHudRight(s);
  renderHudBottom(s);
}

function bindActions() {
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;

    if (action === "formation") {
      openFormationWindow();
      return;
    }

    if (action === "team") {
      openTeamWindow();
      return;
    }

    if (action === "bag") {
      // ✅ Сумісність: НЕ імпортуємо статично, щоб не валило всю сторінку
      try {
        const mod = await import("./modules/windows/bagWindow.js");
        if (mod?.openBagWindow) mod.openBagWindow();
        else {
          openModal({
            title: "Сумка",
            contentHtml: `<div class="badge">bagWindow.js завантажився, але openBagWindow не знайдено</div>`,
          });
        }
      } catch (err) {
        openModal({
          title: "Сумка",
          contentHtml: `
            <div class="badge">Не вдалося відкрити Сумку</div>
            <div class="badge" style="margin-top:10px;opacity:.85">
              ${escapeHtml(String(err?.message || err))}
            </div>
            <div class="badge" style="margin-top:10px;opacity:.85">
              Перевір шлях: <b>client/js/modules/windows/bagWindow.js</b>
            </div>
          `,
        });
      }
      return;
    }

    if (action === "skills") {
      try {
        const mod = await import("./modules/windows/skillBookWindow.js");
        if (mod?.openSkillBookWindow) mod.openSkillBookWindow();
        else throw new Error("openSkillBookWindow not found");
      } catch (err) {
        openModal({
          title: "Уміння",
          contentHtml: `<div class="badge">Не вдалося відкрити книгу умінь</div><div class="badge" style="margin-top:10px">${escapeHtml(String(err?.message || err))}</div>`,
        });
      }
      return;
    }

    if (action === "map") {
      openModal({
        title: "Карта",
        contentHtml: `<div class="badge">Поки заглушка. Тут буде карта/локації.</div>`,
      });
      return;
    }

    if (action === "mail") {
      openMailWindow();
      return;
    }
  });
}

function bindHotkeys() {
  window.addEventListener("keydown", (e) => {
    if (e.key === "F1") { e.preventDefault(); clickAction("team"); }
    if (e.key === "F2") { e.preventDefault(); clickAction("bag"); }
    if (e.key === "F3") { e.preventDefault(); clickAction("formation"); }

    // 🔒 прихований вхід в адмінку: Ctrl+Shift+A
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && String(e.key || "").toLowerCase() === "a") {
      e.preventDefault();
      openAdminWindowSafe();
    }
  });
}

async function openAdminWindowSafe() {
  try {
    const mod = await import("./modules/windows/adminWindow.js");
    if (mod?.openAdminWindow) mod.openAdminWindow({ state, refreshPlayerFromServer });
    else {
      openModal({
        title: "Адмін",
        contentHtml: `<div class="badge">adminWindow.js завантажився, але openAdminWindow не знайдено</div>`,
      });
    }
  } catch (err) {
    openModal({
      title: "Адмін",
      contentHtml: `
        <div class="badge">Не вдалося відкрити адмінку</div>
        <div class="badge" style="margin-top:10px;opacity:.85">${escapeHtml(String(err?.message || err))}</div>
      `,
    });
  }
}

function clickAction(action) {
  const btn = document.querySelector(`button[data-action="${action}"]`);
  if (btn) btn.click();
}

/* ===================== MAIL WINDOW ===================== */

function getPlayerId() {
  return state?.player?.id || localStorage.getItem("playerId") || "";
}

async function safeJson(res) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await res.json();
  const text = await res.text();
  return { ok: false, error: "Server returned non-JSON", details: text.slice(0, 300) };
}

function openMailWindow() {
  const playerId = getPlayerId();
  if (!playerId) {
    openModal({
      title: "Пошта",
      contentHtml: `<div class="badge">Немає playerId. Перезайди в гру.</div>`,
    });
    return;
  }

  openModal({
    title: "Пошта",
    contentHtml: `<div class="badge">Завантаження...</div>`,
  });

  loadAndRenderMail(playerId).catch((err) => {
    const body = document.querySelector("#windows-root .modalBody");
    if (body) body.innerHTML = `<div class="badge">❌ Помилка: ${escapeHtml(String(err?.message || err))}</div>`;
  });
}

async function loadAndRenderMail(playerId) {
  const body = document.querySelector("#windows-root .modalBody");
  if (!body) return;

  const res = await fetch(`/api/mail/list?playerId=${encodeURIComponent(playerId)}`);
  const data = await safeJson(res);

  if (!res.ok || !data?.ok) {
    body.innerHTML = `
      <div class="badge">❌ Не вдалося завантажити пошту</div>
      <div class="badge" style="margin-top:10px; opacity:.85">
        ${escapeHtml(data?.error || "unknown")}
      </div>
    `;
    return;
  }

  const letters = Array.isArray(data.letters) ? data.letters : [];

  await getCatalogMap();

  body.innerHTML = `
    <div class="mailWrap">
      <div class="mailTop">
        <div class="mailHint">Клікни по листу, щоб переглянути. “Забрати” — якщо є вкладення.</div>
      </div>

      <div class="mailList">
        ${letters.length ? letters
          .slice()
          .sort((a,b)=> (b.createdAt||0)-(a.createdAt||0))
          .map(renderMailRow)
          .join("") : `<div class="badge">Пошта порожня</div>`}
      </div>

      <div class="mailDetails" id="mailDetails">
        <div class="badge">Обери лист зліва</div>
      </div>
    </div>
  `;

  bindMailUi(playerId, letters);
}

function renderMailRow(l) {
  const created = l.createdAt ? new Date(l.createdAt).toLocaleString() : "";
  const claimed = l.claimed ? `<span class="mailTag mailTagClaimed">Забрано</span>` : "";
  const hasAtt = Array.isArray(l.attachments) && l.attachments.length > 0;
  const att = hasAtt ? `<span class="mailTag">Вкладення: ${l.attachments.length}</span>` : "";

  return `
    <button class="mailRow ${l.claimed ? "is-claimed" : ""}" data-mail-open="${escapeAttr(l.id)}">
      <div class="mailRowTop">
        <div class="mailTitle">${escapeHtml(l.title || "Лист")}</div>
        <div class="mailMeta">${escapeHtml(created)}</div>
      </div>
      <div class="mailRowBottom">
        <div class="mailFrom">Від: ${escapeHtml(l.from || "?" )}</div>
        <div class="mailTags">${claimed}${att}</div>
      </div>
    </button>
  `;
}

function bindMailUi(playerId, letters) {
  const details = document.getElementById("mailDetails");

  document.querySelectorAll("[data-mail-open]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.mailOpen;
      const l = letters.find(x => x.id === id);
      if (!l || !details) return;

      const atts = Array.isArray(l.attachments) ? l.attachments : [];
      const hasAtt = atts.length > 0;

      details.innerHTML = `
        <div class="mailDetailsInner">
          <div class="mailDTitle">${escapeHtml(l.title || "Лист")}</div>
          <div class="mailDMeta">
            <span class="badge">Від: ${escapeHtml(l.from || "?")}</span>
            ${l.createdAt ? `<span class="badge">${escapeHtml(new Date(l.createdAt).toLocaleString())}</span>` : ``}
          </div>

          <div class="mailDBody">
            ${escapeHtml(l.body || "")}
          </div>

          <div class="mailDAtts">
            <div class="mailDAttsTitle">Вкладення</div>
            ${hasAtt ? `
              <div class="mailDAttsGrid">
                ${atts.map(a => `<div class="mailAtt">${escapeHtml(formatAttachment(a))}</div>`).join("")}
              </div>
            ` : `<div class="badge">Немає вкладень</div>`}
          </div>

          <div class="mailDActions">
            ${hasAtt ? `
              <button class="mailBtn ${l.claimed ? "is-disabled":""}" data-mail-claim="${escapeAttr(l.id)}" ${l.claimed ? "disabled":""}>
                ${l.claimed ? "Вже забрано" : "Забрати"}
              </button>
            ` : ``}
            <button class="mailBtn mailBtnDanger" data-mail-delete="${escapeAttr(l.id)}">Видалити</button>
          </div>
        </div>
      `;

      const claimBtn = details.querySelector("[data-mail-claim]");
      if (claimBtn) {
        claimBtn.addEventListener("click", async () => {
          claimBtn.disabled = true;
          try {
            const res = await fetch("/api/mail/claim", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ playerId, letterId: l.id })
            });
            const data = await safeJson(res);
            if (!res.ok || !data?.ok) {
              alert(`Claim error: ${data?.error || res.status}`);
              return;
            }
            await loadAndRenderMail(playerId);
          } finally {
            claimBtn.disabled = false;
          }
        });
      }

      // ✅ delete must be bound AFTER details HTML is rendered (and inside this open-mail handler)
      const delBtn = details.querySelector("[data-mail-delete]");
      if (delBtn) {
        delBtn.addEventListener("click", async () => {
          if (!confirm("Видалити цей лист?")) return;
          delBtn.disabled = true;
          try {
            const res = await fetch("/api/mail/delete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ playerId, letterId: l.id })
            });
            const data = await safeJson(res);
            if (!res.ok || !data?.ok) {
              alert(`Delete error: ${data?.error || res.status}`);
              return;
            }
            await loadAndRenderMail(playerId);
          } finally {
            delBtn.disabled = false;
          }
        });
      }
    });
  });
}


let __catalogMap = null;
async function getCatalogMap(){
  if(__catalogMap) return __catalogMap;
  try{
    const res = await fetch("/api/items/catalog");
    const data = await safeJson(res);
    if(res.ok && data?.ok && Array.isArray(data.items)){
      __catalogMap = new Map(data.items.map(it=>[String(it.tplId), String(it.name||it.tplId)]));
      return __catalogMap;
    }
  }catch(e){}
  __catalogMap = new Map();
  return __catalogMap;
}

function formatAttachment(a){
  if(!a) return "";
  if(typeof a === "string") return a;
  if(a.kind === "currency"){
    const v = a.value || {};
    const parts = [];
    if(Number(v.silver||0)) parts.push(`Silver +${Number(v.silver)}`);
    if(Number(v.gold||0)) parts.push(`Gold +${Number(v.gold)}`);
    if(Number(v.coupons||0)) parts.push(`Coupons +${Number(v.coupons)}`);
    return parts.length ? parts.join(", ") : "Currency";
  }
  if(a.kind === "exp"){
    const amt = Number(a.value?.amount||0);
    return `EXP +${amt}`;
  }
  if(a.kind === "item"){
    const tplId = String(a.tplId||"");
    const qty = Number(a.qty||1);
    const name = (__catalogMap && __catalogMap.get(tplId)) ? __catalogMap.get(tplId) : tplId;
    return `${name} x${qty}`;
  }
  try { return JSON.stringify(a); } catch(e){ return String(a); }
}


function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(str) {
  return escapeHtml(str);
}