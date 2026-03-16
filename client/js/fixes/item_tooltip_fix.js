
export function applyItemTitle(el, item){
  if(!el || !item) return;
  el.setAttribute("title", item.title || item.name || "Item");
}
