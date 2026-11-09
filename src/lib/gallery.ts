import type { AnyImage } from './images';
import { SHOW_DRAFTS } from './env';
import { getProjects, type Project } from './projects';

type T = { es: string; en: string };

export interface GalleryItem {
  key: string;
  project: Project;
  image?: AnyImage;
  alt: T;
  caption: T;
  note: string;
  /** Proporción del marcador cuando aún no hay archivo. */
  aspect: string;
}

const empty: T = { es: '', en: '' };

type Pic = { image?: AnyImage; alt?: T; caption?: T; note?: string; mediaId?: string; mediaIndex?: number };

/**
 * Stills destacados: toda imagen marcada como "Still destacado (Galería)" en cualquier
 * proyecto visible, en el orden de Trabajo y, dentro de cada proyecto, en el orden de su
 * pestaña Media del estudio. Sin archivo, solo aparece como marcador en local/preview.
 */
export async function getGalleryItems(): Promise<GalleryItem[]> {
  const items: GalleryItem[] = [];
  for (const project of await getProjects()) {
    const d = project.data;
    const mine: (GalleryItem & { index: number })[] = [];
    const seen = new Set<string>();
    const push = (key: string, pic: Pic, aspect = '4/3') => {
      if (!pic.image && !SHOW_DRAFTS) return;
      // La misma imagen puede estar en varios bloques: en la Galería sale una vez.
      if (pic.mediaId) {
        if (seen.has(pic.mediaId)) return;
        seen.add(pic.mediaId);
      }
      mine.push({
        key: `${project.id}-${key}`,
        project,
        image: pic.image,
        alt: pic.alt ?? empty,
        caption: pic.caption ?? empty,
        note: pic.note ?? '',
        aspect,
        index: pic.mediaIndex ?? -1,
      });
    };

    if (d.coverInGallery) push('cover', { image: d.cover, alt: d.coverAlt, note: d.coverNote, mediaId: d.coverMediaId, mediaIndex: d.coverMediaIndex }, '16/9');

    d.blocks.forEach((block, i) => {
      const v = block.value as any;
      switch (block.discriminant) {
        case 'image':
        case 'split':
          if (v.inGallery) push(`b${i}`, v, v.aspect);
          break;
        case 'gallery':
          v.items.forEach((pic: any, j: number) => pic.inGallery && push(`b${i}-${j}`, pic, v.aspect));
          break;
        case 'process':
          v.steps.forEach((step: any, j: number) => step.inGallery && push(`b${i}-${j}`, step));
          break;
      }
    });

    // Orden de la pestaña Media; lo que no tiene lugar (un marcador sin media) va al final.
    const at = (it: { index: number }) => (it.index < 0 ? Number.MAX_SAFE_INTEGER : it.index);
    mine.sort((a, b) => at(a) - at(b));
    items.push(...mine.map(({ index: _index, ...it }) => it));
  }
  return items;
}
