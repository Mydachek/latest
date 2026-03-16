import { initHudTop } from "./modules/hudTop.js";
import { initHudLeft } from "./modules/hudLeft.js";
import { initHudRight } from "./modules/hudRight.js";
import { initHudBottom } from "./modules/hudBottom.js";

import { initScene } from "./modules/scene.js";
import { initWindowsRoot } from "./modules/windows/windowsRoot.js";
import { initUI } from "./ui.js";

document.addEventListener("DOMContentLoaded", async () => {
  const playerId = localStorage.getItem("playerId");
  if (!playerId) {
    location.href = "/";
    return;
  }

  initWindowsRoot();

  await initScene();
  await initHudTop();
  await initHudLeft();
  await initHudRight();
  await initHudBottom();

  initUI();
});