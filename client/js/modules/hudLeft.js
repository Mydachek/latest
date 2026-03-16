let root = null;

export async function initHudLeft(){
  root = document.getElementById("hudLeftRoot");
}

export function renderHudLeft(s){
  if (!root) return;

  const p = s.player;
  const pct = p.energyMax > 0 ? (p.energy / p.energyMax) * 100 : 0;

  root.innerHTML = `
    <div class="hudLeft">
      <div class="energyWrap">
        <div class="energyLabel">ЕНЕРГІЯ</div>
        <div class="energyBar" title="Енергія витрачається 1 при поході в данж">
          <div class="energyFill" style="height:${clamp(pct,0,100)}%"></div>
        </div>
        <div class="energyValue">${p.energy}/${p.energyMax}</div>
      </div>
    </div>
  `;
}

function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }