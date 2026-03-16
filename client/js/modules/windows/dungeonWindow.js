import { openModal } from "./windowsRoot.js";

export function openDungeonWindow(payload){
  const battle = payload?.battle;
  const modal = openModal({
    title: `Данж: ${escapeHtml(payload?.dungeon?.name || battle?.dungeonId || "Бой")}`,
    modalClass: "nw-modal",
    contentHtml: renderBattle(payload)
  });
  const body = modal?.overlay?.querySelector(".modalBody");
  bind(body, payload);
  return modal;
}

function renderBattle(payload){
  const battle = payload?.battle || { allies: [], enemies: [], rounds: [], rewards: {} };
  return `
    <div class="nwDungeonBattle" style="display:grid;gap:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
        <div><b>${escapeHtml(payload?.dungeon?.name || "")}</b></div>
        <div style="display:flex;gap:6px;">
          <button class="btn" data-speed="1">x1</button>
          <button class="btn" data-speed="2">x2</button>
          <button class="btn" data-skip="1">Пропустить</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div><div style="margin-bottom:6px;font-weight:700;">Команда</div>${renderTeam(battle.allies, "ally")}</div>
        <div><div style="margin-bottom:6px;font-weight:700;">Ворог</div>${renderTeam(battle.enemies, "enemy")}</div>
      </div>
      <div style="border:1px solid rgba(255,255,255,.15);border-radius:12px;padding:10px;background:rgba(0,0,0,.18);min-height:180px;">
        <div style="font-weight:700;margin-bottom:8px;">Лог боя</div>
        <div data-battle-log style="display:grid;gap:6px;max-height:280px;overflow:auto;"></div>
      </div>
      <div data-battle-result style="display:none;border:1px solid rgba(255,255,255,.15);border-radius:12px;padding:10px;background:rgba(0,0,0,.18);"></div>
    </div>
  `;
}

function renderTeam(units, side){
  return `
    <div style="display:grid;gap:8px;">
      ${units.map(u => `
        <div data-unit="${side}:${u.id}" style="border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:8px;background:rgba(0,0,0,.16);">
          <div style="display:flex;justify-content:space-between;gap:8px;">
            <span>${escapeHtml(u.name)}</span>
            <span>HP <b data-hp-text="${side}:${u.id}">${Number(u.hpMax||0)}</b> / ${Number(u.hpMax||0)}</span>
          </div>
          <div style="height:8px;background:rgba(255,255,255,.08);border-radius:999px;overflow:hidden;margin-top:6px;">
            <div data-hp-bar="${side}:${u.id}" style="width:100%;height:100%;background:linear-gradient(90deg,#46c86b,#78e08f);"></div>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function bind(body, payload){
  if (!body) return;
  const battle = payload?.battle;
  if (!battle) return;
  let speed = 1;
  let skipped = false;
  const logEl = body.querySelector("[data-battle-log]");
  const resultEl = body.querySelector("[data-battle-result]");
  body.querySelectorAll("[data-speed]").forEach(btn => btn.addEventListener("click", () => { speed = Number(btn.getAttribute("data-speed")) || 1; }));
  body.querySelector("[data-skip]")?.addEventListener("click", () => { skipped = true; finalize(resultEl, payload); });
  play();

  async function play(){
    for (const round of battle.rounds || []) {
      if (skipped) return;
      append(logEl, `<div style="opacity:.8;">Раунд ${Number(round.round||0)}</div>`);
      for (const act of round.actions || []) {
        if (skipped) return;
        updateHp(body, act.targetSide, act.targetId, act.targetHpAfter, findHpMax(battle, act.targetSide, act.targetId));
        const typeText = act.type === "skill" ? `использует ${escapeHtml(act.skillName || "навык")}` : "атакует";
        append(logEl, `<div><b>${escapeHtml(act.actorName)}</b> ${typeText} <b>${escapeHtml(act.targetName)}</b> · -${Number(act.damage||0)} HP${act.killed ? " · <span style='color:#ff8b8b'>побежден</span>" : ""}</div>`);
        await delay(speed === 2 ? 260 : 520);
      }
    }
    finalize(resultEl, payload);
  }
}

function findHpMax(battle, side, id){
  const list = side === "ally" ? (battle.allies||[]) : (battle.enemies||[]);
  return Number((list.find(x => String(x.id) === String(id)) || {}).hpMax || 1);
}
function updateHp(body, side, id, hp, hpMax){
  const txt = body.querySelector(`[data-hp-text="${side}:${id}"]`);
  const bar = body.querySelector(`[data-hp-bar="${side}:${id}"]`);
  if (txt) txt.textContent = String(Math.max(0, Number(hp||0)));
  if (bar) bar.style.width = `${Math.max(0, Math.min(100, (Number(hp||0) / Math.max(1, hpMax)) * 100))}%`;
}
function finalize(resultEl, payload){
  if (!resultEl) return;
  resultEl.style.display = "block";
  const won = payload?.battle?.result === "win";
  resultEl.innerHTML = `
    <div style="font-weight:700;font-size:18px;${won ? "color:#8ee08e" : "color:#ff9d9d"}">${won ? "Победа" : "Поражение"}</div>
    <div style="margin-top:8px;">Silver: <b>${Number(payload?.battle?.rewards?.silver||0)}</b></div>
    <div>Awakened points: <b>${Number(payload?.battle?.rewards?.awakenedPoints||0)}</b></div>
    ${payload?.player ? `<div style="margin-top:6px;opacity:.8;">Энергия после боя: ${Number(payload.player.energy||0)}</div>` : ""}
  `;
}
function append(el, html){ if (!el) return; const row = document.createElement("div"); row.innerHTML = html; el.appendChild(row); el.scrollTop = el.scrollHeight; }
function delay(ms){ return new Promise(r => setTimeout(r, ms)); }
function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}
