// client/js/modules/hudBottom.js
let root = null;

export async function initHudBottom() {
  root = document.getElementById("hudBottomRoot");
}

export function renderHudBottom() {
  if (!root) return;

  // Кнопки як в “ідеалі”: іконка + підпис
  // Данж прибрали. Додали: Уміння, Пошта
  root.innerHTML = `
    <div class="hudBottom hudNav">
      <button class="hudNavBtn" data-action="team" title="Команда">
        <span class="hudNavIcon" aria-hidden="true">👥</span>
        <span class="hudNavText">Команда</span>
      </button>

      <button class="hudNavBtn" data-action="skills" title="Уміння">
        <span class="hudNavIcon" aria-hidden="true">📘</span>
        <span class="hudNavText">Уміння</span>
      </button>

      <button class="hudNavBtn" data-action="formation" title="Формація">
        <span class="hudNavIcon" aria-hidden="true">🧩</span>
        <span class="hudNavText">Формація</span>
      </button>

      <button class="hudNavBtn" data-action="bag" title="Сумка">
        <span class="hudNavIcon" aria-hidden="true">🎒</span>
        <span class="hudNavText">Сумка</span>
      </button>

      <button class="hudNavBtn" data-action="mail" title="Пошта">
        <span class="hudNavIcon" aria-hidden="true">📮</span>
        <span class="hudNavText">Пошта</span>
      </button>
    </div>
  `;
}