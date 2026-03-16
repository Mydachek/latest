import { state } from "../../state.js";
import { openModal } from "./windowsRoot.js";

export function openStatsWindow(heroId) {
  const hero = state.heroes.find(h => h.id === heroId) || state.heroes[0];
  const st = state.stats?.[heroId] || {};

  return openModal({
    title: `Детали • ${hero?.name || "Ниндзя"}`,
    contentHtml: render(st)
  });
}

function render(st) {
  if (!st || typeof st !== "object" || !Object.keys(st).length) {
    return `<div class="ts2-wrap"><div class="ts2-empty">Немає статів</div></div>`;
  }

  const sec = (title, rows) => `
    <div class="ts2-sec">
      <div class="ts2-secTitle">${title}</div>
      <div class="ts2-secBody">
        ${rows.map(([k]) => `
          <div class="ts2-row">
            <div class="ts2-k">${label(k)}</div>
            <div class="ts2-v">${val(st[k])}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  const mainRows = [
    ["spirit"], ["strength"], ["chakra"], ["agility"]
  ];
  const primaryRows = [
    ["hp"], ["physAtk"], ["physDef"], ["speed"], ["initialFury"], ["stratDef"], ["stratAtk"]
  ];
  const secondaryRows = [
    ["damageRate"], ["accuracyRate"], ["critRate"], ["successRate"], ["punchRate"],
    ["avoidDamageRate"], ["dodgeRate"], ["contraRate"], ["blockRate"], ["helpRate"], ["healRate"]
  ];

  // S-атака (антиблок) — окрема характеристика, теж у %
  secondaryRows.splice(4, 0, ["sAttackRate"]);

  return `
    <div class="ts2-wrap">
      ${sec("Мощь", [["power"]])}
      ${sec("Основные статы", mainRows)}
      ${sec("Первостепенные статы", primaryRows)}
      ${sec("Второстепенные статы", secondaryRows)}
    </div>
  `;
}

function label(k) {
  const map = {
    power: "Мощь",
    spirit: "Сила духа",
    chakra: "Чакра",
    strength: "Сила",
    agility: "Ловкость",
    hp: "Очки здоровья",
    physAtk: "Физ. атака",
    physDef: "Физ. защита",
    stratDef: "Стратег. защита",
    stratAtk: "Стратег. атака",
    speed: "Скорость",
    initialFury: "Начальная ярость",

    damageRate: "Рейт урона",
    accuracyRate: "Рейт точности",
    critRate: "Рейт крита",
    successRate: "Рейт успешной атаки",
    sAttackRate: "S-атака",
    punchRate: "Экстра раунд",
    avoidDamageRate: "Рейт избежания урона",
    dodgeRate: "Рейт уворота",
    contraRate: "Рейт отражения",
    blockRate: "Рейт блока",
    helpRate: "Рейт помощи",
    healRate: "Рейт восстановления",

    ratingAtk: "Рейтинг атаки",
    accuracy: "Точность",
    crit: "Крит",
    dodge: "Уворот",
    block: "Блок",
    counter: "Контратака"
  };
  return map[k] || k;
}

function val(v){
  if (v == null || v === "") return "0";
  const n = Number(v);
  return Number.isFinite(n) ? String(Math.round(n)) : String(v);
}