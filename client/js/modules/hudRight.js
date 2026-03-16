// client/js/modules/hudRight.js
let root = null;

export async function initHudRight() {
  root = document.getElementById("hudRightRoot");
}

export function renderHudRight() {
  if (!root) return;

  // Права панель лишається (поки заглушка), але додаємо зверху кнопку "Карта"
  // (колишній “Данж”, тепер окремий modal)
  root.innerHTML = `
    <div class="hudRight">
      <div class="hudRightTop">
        <button class="hudTopBtn" data-action="map" title="Карта">
          🗺️ <span>Карта</span>
        </button>
      </div>

      <div class="title">Права панель</div>
      <div class="badge">Поки заглушка (сюди підемо пізніше)</div>
    </div>
  `;
}