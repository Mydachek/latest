import { setState } from "./state.js";
import { openStatsModal } from "./modals/statsModal.js";

export function bindUI({ bottomBarRoot, getState }){
  bottomBarRoot.addEventListener("click", (e)=>{
    const btn = e.target.closest("button[data-open]");
    if (!btn) return;
    handleAction(btn.dataset.open, getState);
  });

  window.addEventListener("keydown", (e)=>{
    if (e.key === "F1"){ e.preventDefault(); handleAction("team", getState); }
    if (e.key === "F2"){ e.preventDefault(); handleAction("bag", getState); }
    if (e.key === "F3"){ e.preventDefault(); handleAction("formation", getState); }
  });
}

function handleAction(action, getState){
  const s = getState();

  if (action === "dungeon"){
    // витрачаємо 1 ЕНЕРГІЇ на похід
    setState(st => {
      if (st.player.energy > 0) st.player.energy -= 1;
    });
    return;
  }

  // Поки що показуємо демо-модалку характеристик
  if (action === "team"){
    openStatsModal(s);
    return;
  }

  if (action === "bag"){
    openStatsModal(s);
    return;
  }

  if (action === "formation"){
    openStatsModal(s);
    return;
  }
}