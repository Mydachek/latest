export const state = {
  player: {
    id: null,
    name: "ГГ",
    level: 1,
    isAdminHidden: false,
    vip: 0,
    svip: 0,
    energy: 10,
    energyMax: 10,
    gold: 0,
    silver: 0,
    coupons: 0,
    onlineSeconds: 0
  },

  // ✅ Підтягуємо з сервера (/api/heroes/list)
  heroes: [],

  // ✅ Підтягуємо з сервера (/api/formation/get)
  formation: {
    slots: {
      r1c1: null,
      r1c2: null,
      r2c1: null,
      r2c2: null,
      r2c3: null,
      r3c1: null,
      r3c2: null
    }
  },

  // Пункт 2
  team: {
  selectedHeroId: null,
  centerTab: "clothes", // "clothes" | "jewelry"
  rightTab: "clothes",  // "clothes" | "items" | "jewelry"
  showAll: false,       // чекбокс “Показать все”
  invPage: 1,
  invPageMax: 1,
  serverInv: null,
  catalogMap: {}
},

  // Екіпіровка: ОДЕЖДА=6, БІЖУТЕРІЯ=8
  // Поки демо, далі підключимо до інвентаря сервера
  equipment: {},

  inventory: {
  // Одежда (6 типів)
  clothes: [
    { id: "w2", name: "Кунай новичка", type: "weapon", rarity: "common", levelReq: 1, qty: 1, sellSilver: 15, stats: { strength: 5 } },
    { id: "a2", name: "Броня ученика", type: "armor", rarity: "uncommon", levelReq: 1, qty: 1, sellSilver: 40, stats: { physDef: 12, hp: 40 } },
    { id: "s2", name: "Сандали", type: "shoes", rarity: "common", levelReq: 1, qty: 1, sellSilver: 10, stats: { speed: 6 } },
    { id: "h2", name: "Шлем", type: "helm", rarity: "rare", levelReq: 3, qty: 1, sellSilver: 120, stats: { physDef: 18 } },
    { id: "c2", name: "Плащ", type: "cloak", rarity: "uncommon", levelReq: 2, qty: 1, sellSilver: 55, stats: { magicDef: 10 } },
    { id: "b2", name: "Пояс", type: "belt", rarity: "common", levelReq: 1, qty: 1, sellSilver: 12, stats: { agility: 3 } },
  ],

  // Украшение (8 слотів: j1..j8)
  jewelry: [
    { id: "j101", name: "Кольцо чакры", type: "jewelry", rarity: "uncommon", levelReq: 1, qty: 1, sellSilver: 60, stats: { chakra: 20 } },
    { id: "j102", name: "Амулет скорости", type: "jewelry", rarity: "rare", levelReq: 4, qty: 1, sellSilver: 140, stats: { speed: 25 } },
    { id: "j103", name: "Печать духа", type: "jewelry", rarity: "common", levelReq: 1, qty: 1, sellSilver: 18, stats: { spirit: 8 } },
  ],

  // Вещи (розхідники/книги/матеріали)
  items: [
    { id: "it1", name: "Легендарная книга опыта", type: "consumable", rarity: "legendary", levelReq: 70, qty: 5, sellSilver: 1000, desc: "Опыт персонажа +5000000. Нельзя использовать на нанятых ниндзя." },
    { id: "it2", name: "Рамен", type: "consumable", rarity: "common", levelReq: 1, qty: 12, sellSilver: 2, desc: "Небольшое восстановление." },
    { id: "it3", name: "Купон", type: "currency", rarity: "rare", levelReq: 1, qty: 3, sellSilver: 0, desc: "Особая валюта." }
  ]
},

  // демо стати (для “Детали”)
  // ✅ Стати будемо підвантажувати по героях з сервера
  stats: {},

  ui: {
    activeWindow: null,
    serverTimeMs: null,
    serverTz: "Europe/Dublin"
  }
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setState(mutator) {
  mutator(state);
  for (const fn of listeners) fn(state);
}

export function tickOnline() {
  setState(s => {
    // Keep local online counter for bag window visuals
    s.player.onlineSeconds += 1;
    // Server clock (Europe/Dublin) — updated in real time on client
    if (!s.ui) s.ui = {};
    if (Number.isFinite(Number(s.ui.serverTimeMs))) {
      s.ui.serverTimeMs = Number(s.ui.serverTimeMs) + 1000;
    }
  });
}