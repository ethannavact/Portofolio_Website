// Imágenes de dos orígenes:
//  - del Estudio de contenido (proyectos): ya vienen optimizadas en varios anchos (RemoteImage);
//  - locales del sitio (póster del reel, marcadores): las optimiza Astro (ImageMetadata).
import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';

export interface RemoteImage {
  remote: true;
  src: string;
  width: number;
  height: number;
  variants: { src: string; width: number; height: number }[];
  color?: string;
  lqip?: string;
}

export type AnyImage = ImageMetadata | RemoteImage;

export const isRemote = (img: unknown): img is RemoteImage =>
  Boolean(img && typeof img === 'object' && (img as RemoteImage).remote === true);

export const pickVariant = (img: RemoteImage, width: number) =>
  img.variants.find((v) => v.width >= width) ?? img.variants[img.variants.length - 1];

export const remoteSrcset = (img: RemoteImage) => img.variants.map((v) => `${v.src} ${v.width}w`).join(', ');

/** URL de la imagen a un ancho aproximado (WebP). */
export async function imageUrl(img: AnyImage, width: number, opts: { quality?: number } = {}): Promise<string> {
  if (isRemote(img)) return pickVariant(img, width).src;
  return (await getImage({ src: img, width: Math.min(width, img.width), format: 'webp', ...opts })).src;
}

/** Imagen para Open Graph (1200×630 en JPG si es local; la variante de 1600 si viene del estudio). */
export async function ogImage(img: AnyImage) {
  if (isRemote(img)) {
    const v = pickVariant(img, 1600);
    return { src: v.src, width: v.width, height: v.height };
  }
  const og = await getImage({ src: img, width: 1200, height: 630, fit: 'cover', format: 'jpg', quality: 82 });
  return { src: og.src, width: 1200, height: 630 };
}
