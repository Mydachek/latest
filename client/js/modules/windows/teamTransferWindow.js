import { state, setState } from "../../state.js";
import { openModal } from "./windowsRoot.js";

// Переодеть (NWK-like): строго как в оригинале
//  - первый клик по ниндзя = источник (с кого снимаем)
//  - второй клик = цель (кому передаём)
//  - третий клик начинает заново (новый источник)
// Переносим всю экипировку (move)
export async function openTeamTransferWindow(initialSourceHeroId) {
  // Always refresh heroes first to avoid stale Lv.1 display.
  await refreshHeroesSafe();

  const heroes = (state.heroes || []).slice();
  if (!heroes.length) return;

  const html = `
    <div class="nwkFrame nwkThemeBlue" data-nwk="transfer">
      <div class="nwkTitleBar">
        <div class="nwkTitle">Переодеть</div>
        <button class="nwkClose" type="button" data-nwk-close aria-label="Закрыть">×</button>
      </div>

      <div class="nwkContent">
        <div class="nwkSide">
          <div class="nwkSideHeader">Выбрать ниндзя</div>
          <div class="nwkHeroList">
            ${heroes.map(h => `
              <button class="nwkHeroCard" type="button" data-transfer-target="${h.id}">
                <div class="nwkAvatar"></div>
                <div class="nwkHeroMeta">
                  <div class="nwkHeroName">${h.name}</div>
                  <div class="nwkHeroLvl">Lv.${Number(h.level || 1)}</div>
                </div>
              </button>
            `).join("")}
          </div>

          <div class="nwkPager">
            <button class="nwkPagerBtn" type="button" disabled>◀</button>
            <div class="nwkPagerVal">1/1</div>
            <button class="nwkPagerBtn" type="button" disabled>▶</button>
          </div>
        </div>

        <div class="nwkMain">
          <div class="nwkTransferBoard">
            <div class="nwkSlot nwkSlotLeft" id="tw2-t-src" title="Источник"></div>
            <div class="nwkSeal" aria-hidden="true"></div>
            <div class="nwkSlot nwkSlotRight" id="tw2-t-dst" title="Цель"></div>
          </div>

          <div class="nwkTransferActions">
            <button class="nwkActionBtn" type="button" id="tw2-doTransfer">Переодеть</button>
          </div>

          <div class="nwkHint">
            Используя обмен одежды вы сможете передавать экипировку между вашими ниндзя!
          </div>
        </div>
      </div>
    </div>
  `;

  const modal = openModal({
    title: "Переодеть",
    contentHtml: html,
    hideHeader: true,
    modalClass: "modal--nwk"
  });

  bind(initialSourceHeroId, modal);
  return modal;
}

function bind(initialSourceHeroId, modal) {
  let sourceHeroId = initialSourceHeroId || null;
  let targetHeroId = null;
  let phase = sourceHeroId ? 1 : 0;

  const heroes = (state.heroes || []).slice();

  const renderSlot = (heroId) => {
    const h = heroes.find(x => x.id === heroId);
    if (!h) return `<div class="nwkSlotInner"><div class="nwkSlotLvl">LV.0</div></div>`;
    return `
      <div class="nwkSlotInner">
        <div class="nwkSlotName">${h.name}</div>
        <div class="nwkSlotLvl">LV.${Number(h.level || 1)}</div>
      </div>
    `;
  };

  const closeBtn = document.querySelector("[data-nwk=transfer] [data-nwk-close]");
  if (closeBtn) closeBtn.addEventListener("click", () => modal?.close?.());

  const srcSlot = document.getElementById('tw2-t-src');
  const dstSlot = document.getElementById('tw2-t-dst');

  const syncUi = () => {
    if (srcSlot) srcSlot.innerHTML = renderSlot(sourceHeroId);
    if (dstSlot) dstSlot.innerHTML = renderSlot(targetHeroId);
    document.querySelectorAll('[data-transfer-target]').forEach(b => {
      b.classList.toggle('is-active', b.dataset.transferTarget === sourceHeroId);
      b.classList.toggle('is-target', b.dataset.transferTarget === targetHeroId);
    });
    const doBtn = document.getElementById('tw2-doTransfer');
    if (doBtn) doBtn.disabled = !(sourceHeroId && targetHeroId && sourceHeroId !== targetHeroId);
  };

  // strict selection: first click source, second click target, third click restart
  document.querySelectorAll('[data-transfer-target]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.transferTarget;
      if (!id) return;

      if (phase === 0) {
        sourceHeroId = id;
        targetHeroId = null;
        phase = 1;
        syncUi();
        return;
      }
      if (phase === 1) {
        if (id === sourceHeroId) return;
        targetHeroId = id;
        phase = 2;
        syncUi();
        return;
      }
      // phase === 2
      sourceHeroId = id;
      targetHeroId = null;
      phase = 1;
      syncUi();
    });
  });

  const doBtn = document.getElementById("tw2-doTransfer");
  if (doBtn) doBtn.addEventListener("click", () => {
    if (!sourceHeroId || !targetHeroId || sourceHeroId === targetHeroId) return alert("Выберите двух разных ниндзя.");
    (async()=>{
      try{
        await transferOnServer(sourceHeroId, targetHeroId);
        await refreshTeamData();
      }catch(e){
        alert(String(e?.message||e));
      }
      location.reload();
    })();
  });

  // initial draw
  syncUi();
}

async function transferOnServer(fromHeroId, toHeroId){
  const playerId = state?.player?.id || localStorage.getItem("playerId") || "";
  if(!playerId) throw new Error("playerId missing");
  const res = await fetch(`/api/inventory/transferEquip`, {
    method: "POST",
    headers: {"content-type":"application/json"},
    body: JSON.stringify({ playerId, fromHeroId, toHeroId, mode: "move" })
  });
  const data = await res.json().catch(()=>null);
  if(!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
}

async function refreshTeamData(){
  const playerId = localStorage.getItem("playerId") || "";
  if(!playerId) return;
  try{
    const invRes = await fetch(`/api/inventory/get?playerId=${encodeURIComponent(playerId)}`);
    const invData = await invRes.json().catch(()=>null);
    if(invRes.ok && invData?.ok && invData.inventory){
      setState(s=>{ s.team.serverInv = invData.inventory; });
    }
  }catch{}
}

async function refreshHeroesSafe(){
  const playerId = localStorage.getItem('playerId') || '';
  if (!playerId) return;
  try{
    const res = await fetch(`/api/heroes/list?playerId=${encodeURIComponent(playerId)}`);
    const data = await res.json().catch(()=>null);
    if(res.ok && data?.ok && Array.isArray(data?.heroes)){
      setState(s=>{ s.heroes = data.heroes; });
    }
  }catch{}
}