let rootEl = null;

export function initWindowsRoot(){
  rootEl = document.getElementById("windows-root");
  if (!rootEl) {
    console.warn("No #windows-root in HTML");
    return;
  }
  rootEl.innerHTML = "";
}

export function openModal({
  title = "Вікно",
  contentHtml = "",
  onClose,
  hideHeader = false,
  modalClass = ""
} = {}){
  if (!rootEl) throw new Error("windows-root not initialized (call initWindowsRoot())");

  const overlay = document.createElement("div");
  overlay.className = "modalOverlay";
  overlay.innerHTML = `
    <div class="modal ${escapeHtml(modalClass)}" role="dialog" aria-modal="true">
      ${hideHeader ? "" : `
        <div class="modalHeader">
          <div class="modalTitle">${escapeHtml(title)}</div>
          <button class="modalClose" data-close>Закрити</button>
        </div>
      `}
      <div class="modalBody">${contentHtml}</div>
    </div>
  `;

  const close = () => {
    overlay.remove();
    if (typeof onClose === "function") onClose();
  };

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  const closeBtn = overlay.querySelector("[data-close]");
  if (closeBtn) closeBtn.addEventListener("click", close);

  rootEl.appendChild(overlay);
  // Return overlay too so callers can reliably rerender the correct modal
  // when multiple modals are opened at the same time.
  return { close, overlay };
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}