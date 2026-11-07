// Vista previa en listas (servicios, índice de trabajo): al pasar el mouse por una fila,
// aparece junto al cursor una miniatura nítida del proyecto. Solo con mouse y movimiento
// activo; la dibuja la capa WebGL (si no hay WebGL, no aparece nada y la lista funciona igual).
import { finePointer, isMotion, state } from './core';
import { sfx } from './sound';

let current: HTMLElement | null = null;
let leaveTimer = 0;

function enter(el: HTMLElement) {
  window.clearTimeout(leaveTimer);
  if (!isMotion() || current === el) return;
  current = el;
  state.engine?.preview(el.dataset.previewSrc ?? null);
  sfx('hover');
}

function reset() {
  current = null;
  state.engine?.preview(null);
}

function leave(el: HTMLElement) {
  window.clearTimeout(leaveTimer);
  leaveTimer = window.setTimeout(() => current === el && reset(), 160);
}

export function initPreview() {
  if (!finePointer()) return;
  document.querySelectorAll<HTMLElement>('[data-preview-src]').forEach((el) => {
    el.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && enter(el));
    el.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && leave(el));
  });
  window.addEventListener('blur', () => current && reset());
  document.addEventListener('motionchange', () => !isMotion() && current && reset());
  window.addEventListener('pagehide', () => current && reset());
}
