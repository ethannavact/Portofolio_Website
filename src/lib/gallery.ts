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

/**
 * Stills destacados: toda imagen marcada como "Still destacado (Galería)" en cualquier
 * proyecto visible, en el orden del índice y del caso. Sin archivo, solo aparece como
 * marcador en local/preview.
 */
export async function getGalleryItems(): Promise<GalleryItem[]> {
  const items: GalleryItem[] = [];
  for (const project of await getProjects()) {
    const d = project.data;
    const push = (key: string, pic: { image?: AnyImage; alt?: T; caption?: T; note?: string }, aspect = '4/3') => {
      if (!pic.image && !SHOW_DRAFTS) return;
      items.push({
        key: `${project.id}-${key}`,
        project,
        image: pic.image,
        alt: pic.alt ?? empty,
        caption: pic.caption ?? empty,
        note: pic.note ?? '',
        aspect,
      });
    };

    if (d.coverInGallery) push('cover', { image: d.cover, alt: d.coverAlt, note: d.coverNote }, '16/9');

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
  }
  return items;
}
