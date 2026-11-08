// Estado compartido de la capa de movimiento.
import type Lenis from 'lenis';

export const root = document.documentElement;

/** Movimiento activo: botón del header + prefers-reduced-motion (ver Base.astro). */
export const isMotion = () => root.dataset.motion !== 'off';

/** Mouse o trackpad (los efectos de hover y los planos WebGL solo existen ahí). */
export const finePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

export interface EngineApi {
  ready: boolean;
  /** Vista previa nítida que sigue al cursor (listas). */
  preview(src: string | null): void;
  setMotion(on: boolean): void;
  render(time: number): void;
}

export const state: {
  lenis: Lenis | null;
  /** Velocidad de scroll suavizada, de -1 a 1. */
  velocity: number;
  engine: EngineApi | null;
} = { lenis: null, velocity: 0, engine: null };

/**
 * Funciones que corren en cada cuadro, justo después de que Lenis mueve el scroll y antes
 * de dibujar el WebGL. Así lo que depende del scroll (la ruleta) se mueve en el mismo cuadro
 * que las imágenes, sin el cuadro de retraso del evento `scroll`.
 */
export const frameHooks = new Set<(time: number) => void>();

export const onIdle = (fn: () => void, timeout = 1500) => {
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
    .requestIdleCallback;
  if (ric) ric(fn, { timeout });
  else window.setTimeout(fn, 250);
};

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
