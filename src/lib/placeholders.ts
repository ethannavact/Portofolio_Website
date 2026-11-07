import type { ImageMetadata } from 'astro';

// Imágenes abstractas para media pendiente (solo en local y en la vista previa).
// Son "pintadas" a propósito: así se ven los efectos de WebGL sobre algo real.
const files = import.meta.glob<{ default: ImageMetadata }>('../assets/placeholders/*.jpg', { eager: true });
const list = Object.keys(files)
  .sort()
  .map((key) => files[key].default);

/** Elige siempre la misma imagen para el mismo texto (hash FNV-1a). */
export function placeholderFor(seed: string): ImageMetadata {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return list[(h >>> 0) % list.length];
}
