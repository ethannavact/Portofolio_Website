import { getCollection, type CollectionEntry } from 'astro:content';
import { SHOW_DRAFTS } from './env';
import { getProjects, type Project } from './projects';

export type Service = CollectionEntry<'services'>;

const byOrder = (a: Service, b: Service) => a.data.order - b.data.order || a.id.localeCompare(b.id);

/** Servicios visibles (publicados; también borradores en local/preview), ordenados. */
export async function getServices(): Promise<Service[]> {
  const all = await getCollection('services', ({ data }) => data.published || SHOW_DRAFTS);
  return all.sort(byOrder);
}

/** Proyectos de ejemplo de un servicio, en el orden elegido, solo los que se pueden mostrar. */
export async function examplesFor(service: Service): Promise<Project[]> {
  const visible = new Map((await getProjects()).map((p) => [p.id, p]));
  return service.data.projects.map((id) => visible.get(id)).filter((p): p is Project => Boolean(p));
}

/** Servicios que usan un proyecto como ejemplo (para enlazar desde el caso). */
export async function servicesFor(project: Project): Promise<Service[]> {
  const list = await getServices();
  return list.filter((s) => s.data.projects.includes(project.id));
}
