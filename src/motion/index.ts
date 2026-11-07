// Entrada de la capa de movimiento (se carga en todas las páginas desde Base.astro).
// Un solo reloj (gsap.ticker) mueve el scroll suave, ScrollTrigger y el WebGL en el mismo
// cuadro, así las imágenes de WebGL nunca se despegan de su lugar en el DOM.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { finePointer, isMotion, onIdle, root, state } from './core';
import { initScrollFx, killScrollFx } from './scroll';
import { initPreview } from './preview';
import { initRuleta } from './ruleta';
import { initCase } from './case';
import { initSound } from './sound';
import { initReel } from './reel';

gsap.registerPlugin(ScrollTrigger, SplitText);

function startLenis() {
  if (state.lenis) return;
  const lenis = new Lenis({
    lerp: 0.085,
    smoothWheel: true,
    prevent: (node: HTMLElement) => Boolean(node.closest?.('dialog[open], [data-lenis-prevent]')),
  });
  lenis.on('scroll', ScrollTrigger.update);
  state.lenis = lenis;
}

function stopLenis() {
  state.lenis?.destroy();
  state.lenis = null;
}

gsap.ticker.lagSmoothing(0);
// Solo para grabar demos cuadro a cuadro (no se usa en el sitio).
const captureFps = (window as unknown as { __tickerFps?: number }).__tickerFps;
if (captureFps) gsap.ticker.fps(captureFps);
gsap.ticker.add((time) => {
  const lenis = state.lenis;
  if (lenis) lenis.raf(time * 1000);
  const target = lenis ? Math.max(-1, Math.min(1, lenis.velocity / 28)) : 0;
  state.velocity += (target - state.velocity) * 0.12;
  state.engine?.render(time);
});

function loadEngine() {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-gl]');
  if (!canvas || !('WebGL2RenderingContext' in window)) return;
  if ((navigator as unknown as { connection?: { saveData?: boolean } }).connection?.saveData) return;
  const go = () =>
    import('./gl/engine')
      .then(({ createEngine }) => {
        state.engine = createEngine(canvas, { planes: finePointer() });
      })
      .catch(() => {
        /* Sin WebGL: el sitio sigue igual, con el respaldo en CSS. */
      });
  // Se carga con la primera interacción (mover el mouse, scroll, tocar, teclado):
  // la carga inicial queda libre y la capa aparece justo cuando hace falta.
  const events = ['pointermove', 'pointerdown', 'wheel', 'touchstart', 'keydown', 'scroll'] as const;
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    events.forEach((ev) => window.removeEventListener(ev, start));
    onIdle(go, 600);
  };
  const arm = () => events.forEach((ev) => window.addEventListener(ev, start, { passive: true, once: true }));
  if (document.readyState === 'complete') arm();
  else window.addEventListener('load', arm, { once: true });
}

function boot() {
  (window as unknown as { __motionReady: boolean }).__motionReady = true;
  initSound();
  initReel();
  if (isMotion()) {
    startLenis();
    initScrollFx(true);
  }
  initPreview();
  initRuleta();
  initCase();
  loadEngine();

  document.addEventListener('motionchange', () => {
    if (isMotion()) {
      startLenis();
      initScrollFx(false);
    } else {
      killScrollFx();
      stopLenis();
    }
    state.engine?.setMotion(isMotion());
  });
}

boot();
root.classList.add('motion-booted');
