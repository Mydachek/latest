
import { openModal } from "./windowsRoot.js";

export function openMapWindow() {
  openModal({
    title: "Карта",
    contentHtml: '<div class="badge">Завантаження...</div>',
    width: 1180,
  });
  loadAndRender();
}

async function loadAndRender() {
  const body = document.querySelector("#windows-root .modalBody");
  if (!body) return;
  try {
    const res = await fetch('/api/dungeons');
    const j = await res.json().catch(() => ({ ok:false, dungeons: [] }));
    const list = Array.isArray(j) ? j : (Array.isArray(j.dungeons) ? j.dungeons : []);
    body.innerHTML = render(list);
    bind(list);
  } catch (e) {
    body.innerHTML = `<div class="badge">Не вдалося завантажити карту</div><div class="badge" style="margin-top:10px">${esc(String(e?.message || e))}</div>`;
  }
}

function render(list) {
  return `
    <div class="mapN-wrap" style="display:grid;grid-template-columns:280px 1fr;gap:14px;min-height:620px;">
      <div class="mapN-left" style="border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:14px;background:rgba(0,0,0,.18);">
        <div style="font-weight:800;font-size:18px;margin-bottom:12px;">Данжі</div>
        <div class="mapN-list" style="display:flex;flex-direction:column;gap:8px;">
          ${list.length ? list.map(d => `
            <button class="mapN-item" data-dungeon-id="${esc(d.id)}" style="text-align:left;padding:12px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.25);color:#fff;">
              <div style="font-weight:700;">${esc(d.name || 'Данж')}</div>
              <div style="opacity:.75;font-size:12px;margin-top:4px;">Рівень: ${esc(String(d.level || 1))} • Енергія: ${esc(String(d.energyCost || 1))}</div>
            </button>
          `).join('') : `<div class="badge">Данжів поки немає</div>`}
        </div>
      </div>
      <div class="mapN-right" id="mapN-right" style="border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:14px;background:rgba(0,0,0,.18);">
        <div style="font-weight:800;font-size:18px;margin-bottom:12px;">Оберіть данж</div>
        <div class="badge">Зліва з’явився список данжів. PvE-бій підключимо наступним стабільним патчем.</div>
      </div>
    </div>
  `;
}

function bind(list) {
  const right = document.getElementById('mapN-right');
  document.querySelectorAll('[data-dungeon-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = list.find(x => String(x.id) === String(btn.getAttribute('data-dungeon-id')));
      if (!right || !d) return;
      right.innerHTML = `
        <div style="font-weight:800;font-size:18px;margin-bottom:12px;">${esc(d.name || 'Данж')}</div>
        <div style="display:grid;gap:10px;max-width:520px;">
          <div class="badge">Рекомендований рівень: ${esc(String(d.level || 1))}</div>
          <div class="badge">Витрата енергії: ${esc(String(d.energyCost || 1))}</div>
          <div class="badge">Опис: ${esc(d.description || 'Тестовий PvE данж')}</div>
          <div class="badge">Нагорода: ${esc(String(d.rewardSilver || 0))} silver</div>
          <button disabled style="margin-top:8px;padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(255,180,0,.18);color:#fff;">Скоро: Увійти в данж</button>
        </div>
      `;
    });
  });
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
