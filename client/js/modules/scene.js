export async function initScene(){
  const canvas = document.getElementById("scene");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);

    // фон
    ctx.fillStyle = "#0b0f14";
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // зона сцени (заглушка)
    ctx.fillStyle = "rgba(255,255,255,.08)";
    ctx.fillRect(140, 110, 1000, 500);

    ctx.fillStyle = "rgba(255,255,255,.75)";
    ctx.font = "18px system-ui";
    ctx.fillText("Canvas scene (заглушка). Далі підключимо твою сцену.", 170, 150);

    requestAnimationFrame(draw);
  }

  draw();
}