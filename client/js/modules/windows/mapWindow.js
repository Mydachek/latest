import { openModal } from "./windowsRoot.js";
import { openDungeonWindow } from "./dungeonWindow.js";

async function safeJson(res){
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await res.json();
  const text = await res.text();
  return { ok:false, error:text.slice(0,300) };
}

export function openMapWindow() {
  const modal = openModal({
    title: "Карта",
    contentHtml: `<div class="nwMapWin"><div class="nwMapLoading">Загрузка карты...</div></div>`,
    modalClass: "nw-modal"
  });
  const body = modal?.overlay?.querySelector(".modalBody");
  load(body);
  return modal;
}

async function load(body){
  if (!body) return;
  try {
    const res = await fetch("/api/dungeons");
    const data = await safeJson(res);
    const list = Array.isArray(data?.dungeons) ? data.dungeons : [];
    if (!res.ok || !data?.ok || !list.length) throw new Error(data?.error || "Пустая карта");
    body.innerHTML = `
      <div class="nwMapWin">
        <div style="display:grid;gap:10px;">
          ${list.map(d => `
            <div class="nwMapCard" data-dungeon-id="${String(d.id)}" style="border:1px solid rgba(255,255,255,.18);border-radius:12px;padding:10px;background:rgba(0,0,0,.2);">
              <div style="font-weight:700;font-size:16px;">${escapeHtml(d.name || d.id)}</div>
              <div style="opacity:.8;font-size:12px;margin-top:4px;">Уровень: ${Number(d.level||1)} · Энергия: ${Number(d.energyCost||1)}</div>
              <div style="opacity:.8;font-size:12px;margin-top:2px;">Награда: silver ${Number(d.rewards?.silver||0)}, awakened ${Number(d.rewards?.awakenedPoints||0)}</div>
              <div style="margin-top:8px;"><button class="btn" data-dungeon-enter="${String(d.id)}">Войти</button></div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
    body.querySelectorAll("[data-dungeon-enter]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const dungeonId = btn.getAttribute("data-dungeon-enter");
        const playerId = localStorage.getItem("playerId") || "";
        if (!playerId) { alert("Нет playerId"); return; }
        btn.disabled = true;
        try {
          const res = await fetch("/api/dungeons/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playerId, dungeonId })
          });
          const data = await safeJson(res);
          if (!res.ok || !data?.ok) {
            alert(data?.error || `Ошибка ${res.status}`);
            return;
          }
          openDungeonWindow(data);
        } finally {
          btn.disabled = false;
        }
      });
    });
  } catch (e) {
    body.innerHTML = `<div class="nwMapWin"><div style="padding:12px;border:1px solid rgba(255,255,255,.12);border-radius:10px;">Карта пока пустая.<br>${escapeHtml(String(e?.message||e))}</div></div>`;
  }
}

function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}
