// client/movement.js
let __scene = null;

function initMovementScene(canvasId){
  const cv = document.getElementById(canvasId);
  const ctx = cv.getContext("2d");

  const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

  function resize(){
    // keep canvas internal pixels in sync with CSS size
    const rect = cv.getBoundingClientRect();
    cv.width = Math.floor(rect.width * DPR);
    cv.height = Math.floor(rect.height * DPR);
  }
  resize();
  window.addEventListener("resize", resize);

  const hero = { x: 0.5, y: 0.6, tx: 0.5, ty: 0.6, speed: 0.05 };
  const npcs = [];

  cv.addEventListener("click", (e)=>{
    const rect = cv.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;
    hero.tx = mx; hero.ty = my;
  });

  __scene = {
    cv, ctx, DPR, hero, npcs,
    addNpc(n){ npcs.push(n); }
  };

  function draw(){
    const w = cv.width, h = cv.height;
    ctx.clearRect(0,0,w,h);

    // floor-ish gradient
    const g = ctx.createRadialGradient(w*0.5,h*0.75,10,w*0.5,h*0.75,w*0.9);
    g.addColorStop(0,"rgba(90,80,130,0.20)");
    g.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0,0,w,h);

    // NPCs
    for(const n of npcs){
      const x = n.x / 1100 * w;
      const y = n.y / 650 * h;

      // glow
      ctx.beginPath();
      ctx.arc(x,y,18*DPR,0,Math.PI*2);
      ctx.fillStyle = "rgba(217,179,92,0.18)";
      ctx.fill();

      // marker
      ctx.beginPath();
      ctx.arc(x,y,10*DPR,0,Math.PI*2);
      ctx.fillStyle = "rgba(217,179,92,0.55)";
      ctx.fill();

      ctx.font = `${12*DPR}px system-ui`;
      ctx.fillStyle = "rgba(231,238,252,0.85)";
      ctx.textAlign="center";
      ctx.fillText(n.name, x, y - 16*DPR);
    }

    // Hero move
    hero.x += (hero.tx - hero.x) * hero.speed;
    hero.y += (hero.ty - hero.y) * hero.speed;

    const hx = hero.x * w;
    const hy = hero.y * h;

    // shadow
    ctx.beginPath();
    ctx.ellipse(hx, hy+10*DPR, 20*DPR, 8*DPR, 0, 0, Math.PI*2);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fill();

    // hero body
    ctx.beginPath();
    ctx.arc(hx, hy, 16*DPR, 0, Math.PI*2);
    ctx.fillStyle = "rgba(93,224,141,0.85)";
    ctx.fill();

    // target indicator
    ctx.beginPath();
    ctx.arc(hero.tx*w, hero.ty*h, 10*DPR, 0, Math.PI*2);
    ctx.strokeStyle = "rgba(255,107,107,0.7)";
    ctx.lineWidth = 2*DPR;
    ctx.stroke();

    requestAnimationFrame(draw);
  }
  draw();
}

function addNpc(npc){
  if(__scene) __scene.addNpc(npc);
}