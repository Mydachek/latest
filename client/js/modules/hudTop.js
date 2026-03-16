let root = null;

export async function initHudTop(){
  root = document.getElementById("hudTopRoot");
}

export function renderHudTop(s){
  if (!root) return;

  const p = s.player;
  const adminBadge = p.isAdminHidden ? `<span class="badge" style="border-color:rgba(255,70,70,.45);box-shadow:0 0 0 3px rgba(255,70,70,.10) inset;">ADMIN</span>` : "";

  const teamPower = calcFormationPower(s);
  const expNow = Number(p.exp || 0);
  const expNeed = Math.max(1, Number(p.expToNext || 0) || 1);
  const expPct = Math.max(0, Math.min(100, Math.round((expNow / expNeed) * 100)));

  root.innerHTML = `
    <div class="hudTop">
      <div class="block">
        <div class="title">Гравець</div>
        <div class="value">
          <span>${escapeHtml(p.name)} <span class="badge">LV ${p.level}</span></span>
          ${adminBadge}
          <span class="badge">Мощь: ${num(teamPower)}</span>
          <span class="badge">Gold: ${num(p.gold)}</span>
        </div>
        <div class="value" style="margin-top:8px">
          <span class="badge">Silver: ${num(p.silver)}</span>
          <span class="badge">Coupons: ${num(p.coupons)}</span>
          <span class="badge">VIP: ${num(p.vip)}</span>
          <span class="badge">SVIP: ${num(p.svip)}</span>
        </div>
      </div>

      <div class="block">
        <div class="title">Онлайн</div>
        <div class="value">
          <span class="badge">${formatServerClock(s)}</span>
          <span class="badge">Village</span>
        </div>
        <div class="value" style="margin-top:8px">
          <span class="badge">EXP: ${num(expNow)}/${num(expNeed)} (${expPct}%)</span>
        </div>
      </div>

      <div class="block">
        <div class="title">Хоткеї</div>
        <div class="value">
          <span class="badge">F1 Команда</span>
          <span class="badge">F2 Сумка</span>
          <span class="badge">F3 Формація</span>
        </div>
      </div>
    </div>
  `;
}

function calcFormationPower(s){
  const slots = s?.formation?.slots || {};
  const ids = Object.values(slots).filter(Boolean);
  let sum = 0;
  for(const id of ids){
    const st = s?.stats?.[id];
    if(st && Number.isFinite(Number(st.power))) sum += Number(st.power);
  }
  return sum;
}

function num(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatServerClock(s){
  const ms = Number(s?.ui?.serverTimeMs);
  if(!Number.isFinite(ms)) return "--:--:--";
  try{
    const tz = String(s?.ui?.serverTz || "Europe/Dublin");
    const d = new Date(ms);
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    return fmt.format(d);
  }catch(e){
    const d = new Date(ms);
    return d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", second:"2-digit" });
  }
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}