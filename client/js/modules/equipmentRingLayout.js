// client/modules/equipmentRingLayout.js
// 1v1 ring layout (Naruto Online style) for equipment slots around hero panel.
// Pure layout module: computes positions + applies them to slot elements.

const DEFAULT_LAYOUT = {
  // Coordinates are in normalized space relative to a square "ring" area:
  // x,y in [-1..1] where (0,0) is center of hero panel.
  // r is radial distance multiplier.
  clothes: {
    // 6 clothes (example mapping; adjust keys to your actual slot ids)
    weapon:   { x: -0.85, y: -0.15 },
    head:     { x: -0.55, y: -0.70 },
    armor:    { x:  0.55, y: -0.70 },
    belt:     { x:  0.85, y: -0.15 },
    gloves:   { x: -0.55, y:  0.65 },
    shoes:    { x:  0.55, y:  0.65 },
  },

  jewelry: {
    // 8 jewelry around (outer ring feel)
    j1: { x: -0.95, y: -0.55 }, // ring
    j2: { x: -0.95, y:  0.25 }, // ring
    j3: { x: -0.15, y: -0.95 }, // necklace/top
    j4: { x:  0.75, y: -0.55 }, // accessory
    j5: { x:  0.95, y:  0.25 }, // ring
    j6: { x:  0.15, y:  0.95 }, // pendant/bottom
    j7: { x: -0.15, y:  0.95 }, // charm/bottom-left
    j8: { x:  0.75, y:  0.75 }, // extra
  },
};

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function toPx(norm, halfSize) {
  return norm * halfSize;
}

function getRingSize(container) {
  const rect = container.getBoundingClientRect();
  const size = Math.min(rect.width, rect.height);
  return size;
}

/**
 * Apply ring layout to slot elements inside ringRoot.
 * Slot elements must have:
 *  - data-eq-group="clothes|jewelry"
 *  - data-eq-slot="weapon|head|armor|belt|gloves|shoes" or "j1..j8"
 *
 * @param {HTMLElement} ringRoot
 * @param {object} options
 * @param {object} options.layout - override DEFAULT_LAYOUT
 * @param {number} options.slotSize - base slot size (px), will be scaled
 */
export function initEquipmentRingLayout(ringRoot, options = {}) {
  const layout = options.layout || DEFAULT_LAYOUT;

  let rafId = null;

  const apply = () => {
    rafId = null;

    const ringSize = getRingSize(ringRoot);
    // Base scaling: slot size depends on ringSize.
    // Naruto Online feel: slots are chunky but not too big.
    const scale = clamp(ringSize / 420, 0.75, 1.25);
    const slotSize = Math.round((options.slotSize || 54) * scale);

    ringRoot.style.setProperty("--eq-slot-size", `${slotSize}px`);

    const half = ringSize / 2;

    const slots = ringRoot.querySelectorAll(".eq-slot[data-eq-group][data-eq-slot]");
    slots.forEach((el) => {
      const group = el.dataset.eqGroup;
      const slot = el.dataset.eqSlot;

      const pos =
        (group === "clothes" ? layout.clothes?.[slot] : null) ||
        (group === "jewelry" ? layout.jewelry?.[slot] : null);

      if (!pos) return;

      // Position: center + offset
      const x = toPx(pos.x, half);
      const y = toPx(pos.y, half);

      el.style.left = `calc(50% + ${x}px)`;
      el.style.top = `calc(50% + ${y}px)`;
    });
  };

  const schedule = () => {
    if (rafId) return;
    rafId = requestAnimationFrame(apply);
  };

  const ro = new ResizeObserver(schedule);
  ro.observe(ringRoot);

  // First apply
  schedule();

  return {
    refresh: schedule,
    destroy() {
      ro.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    },
  };
}