
import { openModal } from "./windowsRoot.js";

const pageOrder = ["rin","jin","zen","zai","fire","earth","heaven","void"];
const pageName = { rin:"Рин", jin:"Джин", zen:"Зэн", zai:"Заи", fire:"Огонь", earth:"Земля", heaven:"Небеса", void:"Пустота" };
let ui = { selectedPageId: null, data: null, inv: null };

export function openSkillBookWindow() {
  openModal({ title: "Свиток смысла", contentHtml: '<div class="badge">Завантаження...</div>', width: 1180 });
  loadAll();
}

function playerId(){ return localStorage.getItem("playerId") || ""; }
async function jfetch(url, opts){ const r = await fetch(url, opts); const j = await r.json().catch(()=>null); return { r, j }; }

async function loadAll(){
  const pid = playerId();
  const [{j:skillBook},{j:inv}] = await Promise.all([
    jfetch(`/api/skillbook/get?playerId=${encodeURIComponent(pid)}`),
    jfetch(`/api/inventory/get?playerId=${encodeURIComponent(pid)}`),
  ]);
  ui.data = skillBook?.skillBook || null;
  ui.inv = inv?.inventory || null;
  if (!ui.selectedPageId) ui.selectedPageId = ui.data?.currentPageId || "rin";
  render();
}

function getPage(id){ return (ui.data?.pages || []).find(p => p.id === id) || null; }
function pagePurchased(page, lvl){ return new Set(page?.purchasedLevels || []).has(lvl); }
function isPageOpen(page){ return !!page?.unlocked; }
function fmt(n){ return Number(n||0).toLocaleString('ru-RU'); }
function esc(s){ return String(s||"").replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

function getScrollRows(){
  const rows = [];
  const bag = Array.isArray(ui.inv?.bagItems) ? ui.inv.bagItems : [];
  for (const it of bag){
    const eff = it?.effects || {};
    if (Number(eff.skillPoints||0) > 0 || Number(eff.awakenedSkillPoints||0) > 0) rows.push(it);
  }
  return rows;
}

function render(){
  const host = document.querySelector('#windows-root .modalBody');
  if (!host) return;
  const page = getPage(ui.selectedPageId) || getPage(ui.data?.currentPageId) || { nodes: [] };
  const skills = (ui.data?.pages || []).flatMap(p => p.nodes.filter(n => (p.purchasedLevels||[]).includes(n.level) && n.kind === 'skill').map(n => ({ page: p.name, text: n.text?.[0] || 'Навик' })));
  const scrolls = getScrollRows();
  host.innerHTML = `
  <style>
    .sb-wrap{display:grid;grid-template-columns:1fr 290px;gap:16px;color:#f7e6b4}
    .sb-card{background:linear-gradient(180deg,#6b3f1f,#4c2b17);border:2px solid #b8894a;border-radius:14px;box-shadow:0 8px 20px rgba(0,0,0,.35)}
    .sb-main{padding:14px}
    .sb-top{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px}
    .sb-title{font-size:18px;font-weight:800;color:#ffe7a3}
    .sb-counters{display:flex;gap:10px;flex-wrap:wrap}
    .sb-pill{background:#2c1a0f;border:1px solid #bb8f52;border-radius:999px;padding:6px 12px;font-weight:700}
    .sb-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
    .sb-tab{padding:8px 12px;border-radius:10px;border:1px solid #b8894a;background:#3d2414;color:#f7e6b4;cursor:pointer;font-weight:700}
    .sb-tab.active{background:#7a4824;color:#fff6cf;box-shadow:inset 0 0 0 1px rgba(255,255,255,.18)}
    .sb-tab.locked{opacity:.45}
    .sb-sheet{background:linear-gradient(180deg,#efdba6,#e9d198);border:2px solid #c99e60;border-radius:16px;padding:18px;min-height:420px;position:relative;color:#3d2a18}
    .sb-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:16px;align-items:start}
    .sb-node{min-height:88px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;text-align:center;gap:8px}
    .sb-badge{width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:16px;background:#f9efcf;border:3px solid #7b5a30;box-shadow:0 2px 8px rgba(0,0,0,.15)}
    .sb-badge.skill{border-radius:12px;background:#2d2317;color:#f6e2b6;font-size:24px}
    .sb-badge.done{background:#86c05a;color:#173109}
    .sb-badge.locked{opacity:.4}
    .sb-nodeTxt{font-size:12px;line-height:1.2;max-width:140px}
    .sb-nodeCost{font-size:12px;font-weight:700;color:#7a3b14}
    .sb-btnBar{display:flex;justify-content:center;margin-top:12px}
    .sb-train{padding:10px 24px;border:none;border-radius:999px;background:linear-gradient(180deg,#82d16f,#5ca44f);font-weight:900;font-size:18px;color:#20300e;cursor:pointer}
    .sb-train:disabled{opacity:.45;cursor:not-allowed}
    .sb-side{padding:14px;display:flex;flex-direction:column;gap:12px}
    .sb-side h4{margin:0 0 8px 0;color:#ffe7a3}
    .sb-scroll,.sb-skillRow{background:#2c1a0f;border:1px solid #a27746;border-radius:10px;padding:10px}
    .sb-mini{font-size:12px;opacity:.9}
    .sb-act{margin-top:8px;padding:8px 10px;border:none;border-radius:8px;background:#866331;color:#fff1c4;font-weight:700;cursor:pointer}
  </style>
  <div class="sb-wrap">
    <div class="sb-card sb-main">
      <div class="sb-top">
        <div>
          <div class="sb-title">Сачь ао нгіа — ${esc(page.name || '')}</div>
          <div class="sb-mini">Після повного завершення сторінки автоматично відкривається наступна.</div>
        </div>
        <div class="sb-counters">
          <div class="sb-pill">Очки навика: ${fmt(ui.data?.skillPoints)}</div>
          <div class="sb-pill">Пробуджені очки: ${fmt(ui.data?.awakenedPoints)}</div>
        </div>
      </div>
      <div class="sb-tabs">
        ${pageOrder.map(id => {
          const p = getPage(id); const locked = !isPageOpen(p); const active = id === page.id;
          return `<button class="sb-tab ${active?'active':''} ${locked?'locked':''}" data-sb-page="${id}" ${locked?'disabled':''}>${esc(pageName[id])}</button>`;
        }).join('')}
      </div>
      <div class="sb-sheet">
        <div class="sb-grid">
          ${(page.nodes || []).map(node => {
            const bought = pagePurchased(page, node.level);
            const prevOk = node.level === 1 || pagePurchased(page, node.level - 1);
            const locked = !bought && !prevOk;
            const costTxt = node.awakenCost ? `${fmt(node.cost)} + ${fmt(node.awakenCost)}` : fmt(node.cost);
            return `<div class="sb-node">
              <div class="sb-badge ${node.kind==='skill'?'skill':''} ${bought?'done':''} ${locked?'locked':''}" data-sb-upgrade="${page.id}:${node.level}">${node.kind==='skill'?'卍':node.level}</div>
              <div class="sb-nodeTxt">${(node.text||[]).map(t=>`<div>${esc(t)}</div>`).join('')}</div>
              <div class="sb-nodeCost">${esc(costTxt)}</div>
            </div>`;
          }).join('')}
        </div>
        <div class="sb-btnBar"><button class="sb-train" data-sb-dungeon>Тестовий PvE данж (+ пробуджені очки)</button></div>
      </div>
    </div>
    <div class="sb-card sb-side">
      <div>
        <h4>Сувої навика</h4>
        ${scrolls.length ? scrolls.map(it => `<div class="sb-scroll"><div><b>${esc(it.name)}</b> × ${fmt(it.qty||1)}</div><div class="sb-mini">${esc(it.desc||'')}</div><button class="sb-act" data-sb-scroll="${esc(it.id)}">Використати 1</button></div>`).join('') : '<div class="sb-scroll">У сумці немає сувоїв навика.</div>'}
      </div>
      <div>
        <h4>Відкриті навики</h4>
        ${skills.length ? skills.map(s => `<div class="sb-skillRow"><b>${esc(s.page)}</b><div class="sb-mini">${esc(s.text)}</div></div>`).join('') : '<div class="sb-skillRow">Поки ще немає відкритих skill-вузлів.</div>'}
      </div>
    </div>
  </div>`;
  bind();
}

function bind(){
  document.querySelectorAll('[data-sb-page]').forEach(btn => btn.addEventListener('click', () => { ui.selectedPageId = btn.dataset.sbPage; render(); }));
  document.querySelectorAll('[data-sb-upgrade]').forEach(btn => btn.addEventListener('click', async () => {
    const [pageId, lvl] = String(btn.dataset.sbUpgrade || '').split(':');
    const pid = playerId();
    const { j } = await jfetch('/api/skillbook/upgrade', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ playerId: pid, pageId, level: Number(lvl) }) });
    if (!j?.ok) { alert('Не вдалося прокачати: ' + (j?.error || 'помилка')); return; }
    ui.data = j.skillBook;
    if (j.skillBook?.currentPageId) ui.selectedPageId = j.skillBook.currentPageId;
    render();
  }));
  document.querySelectorAll('[data-sb-scroll]').forEach(btn => btn.addEventListener('click', async () => {
    const pid = playerId();
    const itemId = btn.dataset.sbScroll;
    const { j } = await jfetch('/api/skillbook/useScroll', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ playerId: pid, itemId, qty: 1 }) });
    if (!j?.ok) { alert('Не вдалося використати сувій: ' + (j?.error || 'помилка')); return; }
    ui.data = j.skillBook;
    await loadAll();
  }));
  const d = document.querySelector('[data-sb-dungeon]');
  if (d) d.addEventListener('click', async () => {
    const pid = playerId();
    const { j } = await jfetch('/api/skillbook/dungeon', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ playerId: pid }) });
    if (!j?.ok) { alert('Данж не завершився: ' + (j?.error || 'помилка')); return; }
    ui.data = j.skillBook;
    alert(`Перемога! +${fmt(j.reward)} пробуджених очок.`);
    render();
  });
}
