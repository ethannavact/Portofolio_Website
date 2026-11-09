import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import { SHOW_DRAFTS } from './env';

export type Project = CollectionEntry<'projects'>;
export type ProjectData = Project['data'];
export type Block = ProjectData['blocks'][number];

const byOrder = (a: Project, b: Project) =>
  a.data.order - b.data.order || (b.data.year || '').localeCompare(a.data.year || '') || a.id.localeCompare(b.id);

/** Proyectos visibles: publicados (y borradores en local/preview), ordenados. */
export async function getProjects(): Promise<Project[]> {
  const all = await getCollection('projects', ({ data }) => data.published || SHOW_DRAFTS);
  return all.sort(byOrder);
}

export async function getFeatured(limit = 6): Promise<Project[]> {
  const list = await getProjects();
  // Orden propio de la Home (estudio → Sitio → Orden de proyectos); si no hay, el del índice.
  const featured = list
    .filter((p) => p.data.featured && p.data.published)
    .sort((a, b) => a.data.homeOrder - b.data.homeOrder || byOrder(a, b));
  return (featured.length ? featured : list.filter((p) => p.data.published)).slice(0, limit);
}

/** Siguiente caso en el orden del índice (cíclico). */
export function nextProject(list: Project[], current: Project): Project | undefined {
  const i = list.findIndex((p) => p.id === current.id);
  if (i === -1 || list.length < 2) return undefined;
  return list[(i + 1) % list.length];
}

const hasText = (v: { es: string; en: string }) => Boolean(v.es.trim() || v.en.trim());

/** ¿El bloque tiene algo que mostrar? En producción se omiten los que solo tienen marcadores. */
export function isRenderable(block: Block): boolean {
  if (SHOW_DRAFTS) return true;
  const v = block.value as any;
  switch (block.discriminant) {
    case 'text':
      return hasText(v.heading) || hasText(v.body);
    case 'image':
      return Boolean(v.image);
    case 'video':
      return v.video.provider !== 'none' && Boolean(v.video.id || v.video.url);
    case 'gallery':
      return v.items.some((i: { image?: unknown }) => i.image);
    case 'split':
      return Boolean(v.image) || hasText(v.body);
    case 'stats':
      return v.items.some((i: { value: string }) => i.value);
    case 'process':
      return v.steps.length > 0;
    case 'list':
      return v.items.length > 0;
    case 'quote':
      return hasText(v.text);
    default:
      return false;
  }
}

export async function getSite() {
  const entry = await getEntry('site', 'site');
  if (!entry) throw new Error('Falta src/content/singletons/site.yaml');
  return entry.data;
}

export async function getAbout() {
  const entry = await getEntry('about', 'about');
  if (!entry) throw new Error('Falta src/content/singletons/about.yaml');
  return entry.data;
}

export type SiteData = Awaited<ReturnType<typeof getSite>>;
export type AboutData = Awaited<ReturnType<typeof getAbout>>;
