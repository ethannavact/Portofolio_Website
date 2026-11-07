// ─────────────────────────────────────────────────────────────
// Capa generativa — EJEMPLO NEUTRO. Reemplázalo por tu dirección de arte
// (Three.js, shaders, lo que quieras): solo respeta el contrato de mount().
//
// Contrato:
//  - Nunca dibuja información (todo el texto vive en el HTML).
//  - Se pausa fuera de pantalla y cuando el movimiento está apagado.
//  - Limita la resolución (DPR ≤ 1.5) para cuidar GPU y batería.
// ─────────────────────────────────────────────────────────────

export function mount(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const root = document.documentElement;
  const motionOn = () => root.dataset.motion !== 'off';
  const ink = () => getComputedStyle(root).getPropertyValue('--line').trim() || '#999';

  let w = 0;
  let h = 0;
  let raf = 0;
  let visible = true;
  let t = 0;

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  };

  // Retícula de puntos que respira: un placeholder deliberadamente discreto.
  const draw = () => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = ink();
    const step = 28;
    for (let y = step / 2; y < h; y += step) {
      for (let x = step / 2; x < w; x += step) {
        const n = Math.sin(x * 0.012 + t * 0.6) * Math.cos(y * 0.015 - t * 0.4);
        const r = 0.6 + Math.max(0, n) * 1.6;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  const loop = () => {
    t += 0.016;
    draw();
    raf = requestAnimationFrame(loop);
  };

  const update = () => {
    cancelAnimationFrame(raf);
    if (visible && motionOn()) raf = requestAnimationFrame(loop);
    else draw();
  };

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    update();
  }).observe(canvas);

  new ResizeObserver(resize).observe(canvas);
  document.addEventListener('motionchange', update);
  resize();
  update();
}
