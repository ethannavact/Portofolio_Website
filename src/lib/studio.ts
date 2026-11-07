// Los proyectos vienen del Estudio de contenido (proyecto aparte: ethan-estudio).
// Este loader lee su content.json y lo adapta al esquema de este sitio, así las vistas
// no cambian. Orden de búsqueda:
//   1. STUDIO_CONTENT (URL o ruta a un content.json): producción → la URL pública en R2.
//   2. El estudio abierto en tu computadora: http://127.0.0.1:4400
//   3. El último export en ../ethan-estudio/dist/
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Loader } from 'astro/loaders';

const LOCAL = process.env.STUDIO_URL || 'http://127.0.0.1:4400';
const E = { es: '', en: '' };
type T = { es: string; en: string };
type M = Record<string, any>;

async function readSource(drafts: boolean, logger: { warn: (m: string) => void; info: (m: string) => void }) {
  const file = drafts ? 'content.drafts.json' : 'content.json';
  const env = process.env.STUDIO_CONTENT?.trim();
  if (env) {
    if (/^https?:/.test(env)) {
      const res = await fetch(env);
      if (!res.ok) throw new Error(`No se pudo leer STUDIO_CONTENT (${env}): ${res.status}`);
      return res.json();
    }
    return JSON.parse(await fs.readFile(path.resolve(env), 'utf8'));
  }
  try {
    const res = await fetch(`${LOCAL}/${file}`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) return res.json();
  } catch {
    /* el estudio no está abierto */
  }
  const fallback = path.resolve(process.cwd(), '..', 'ethan-estudio', 'dist', file);
  try {
    const data = JSON.parse(await fs.readFile(fallback, 'utf8'));
    logger.warn(`El estudio no está abierto: uso ${fallback}. Abre el estudio (npm run estudio) para ver las imágenes.`);
    return { ...data, mediaBase: data.mediaBase || `${LOCAL}/media/` };
  } catch {
    throw new Error(
      'No encontré el contenido de los proyectos. Abre el estudio (en ethan-estudio: npm run estudio) o define STUDIO_CONTENT con la URL de content.json.',
    );
  }
}

const ASPECTS: [string, number][] = [['16/9', 16 / 9], ['21/9', 21 / 9], ['4/3', 4 / 3], ['1/1', 1], ['4/5', 4 / 5], ['9/16', 9 / 16]];
const nearestAspect = (w?: number, h?: number) =>
  w && h ? ASPECTS.reduce((a, b) => (Math.abs(b[1] - w / h) < Math.abs(a[1] - w / h) ? b : a))[0] : '16/9';

/** Convierte un content.json del estudio en entradas con el esquema de este sitio. */
export function toEntries(data: M, mediaBase?: string) {
  const base = String(mediaBase ?? data.mediaBase ?? '').replace(/\/?$/, '/');
  const url = (src: string) => (/^(https?:|data:|\/)/.test(src) ? src : base + src);

  return (data.projects as M[]).map((p) => {
    const byId = (id?: string) => (id ? p.media.find((m: M) => m.id === id) : undefined);
    const img = (m?: M) => {
      if (!m || m.pending || !m.variants?.length) return undefined;
      const variants = m.variants.map((v: M) => ({ src: url(v.src), width: v.w, height: v.h }));
      const mid = variants.find((v: M) => v.width >= 1600) ?? variants[variants.length - 1];
      return { remote: true as const, src: mid.src, width: m.width, height: m.height, variants, color: m.color, lqip: m.lqip };
    };
    const pic = (id?: string) => {
      const m = byId(id);
      return { image: m?.type === 'image' ? img(m) : undefined, alt: (m?.alt ?? E) as T, caption: (m?.caption ?? E) as T, note: m?.pending ? m.note ?? '' : '', inGallery: Boolean(m?.gallery) };
    };
    const video = (id?: string) => {
      const m = byId(id);
      const none = { provider: 'none' as const, id: '', url: '', title: (m?.title ?? E) as T, aspect: m?.aspect ?? '16/9', loop: Boolean(m?.loop) };
      if (!m || m.type !== 'video' || m.pending) return none;
      if (m.provider === 'file' && m.sources?.length) {
        return {
          provider: 'file' as const,
          id: '',
          url: url(m.sources[0].src),
          sources: m.sources.map((s: M) => ({ src: url(s.src), width: s.w, height: s.h, type: s.type })),
          title: (m.title ?? E) as T,
          aspect: nearestAspect(m.width, m.height),
          loop: Boolean(m.loop),
          poster: m.poster ? img({ ...m.poster }) : undefined,
        };
      }
      if (m.provider === 'youtube' || m.provider === 'vimeo') return { ...none, provider: m.provider, id: m.videoId ?? '' };
      return none;
    };

    const blocks = (p.blocks as M[]).map((b) => {
      switch (b.type) {
        case 'text':
          return { discriminant: 'text', value: { heading: b.heading ?? E, body: b.body ?? E, style: b.style ?? 'columns' } };
        case 'image':
          return { discriminant: 'image', value: { ...pic(b.media), size: b.size ?? 'wide', aspect: b.aspect ?? '16/9' } };
        case 'video': {
          const m = byId(b.media);
          return { discriminant: 'video', value: { video: video(b.media), caption: b.caption ?? E, size: b.size ?? 'wide', note: m?.pending ? m.note ?? '' : '' } };
        }
        case 'gallery':
          return { discriminant: 'gallery', value: { heading: b.heading ?? E, layout: b.layout ?? 'grid-2', aspect: b.aspect ?? '4/3', items: (b.items ?? []).map((id: string) => pic(id)) } };
        case 'split':
          return { discriminant: 'split', value: { ...pic(b.media), heading: b.heading ?? E, body: b.body ?? E, mediaSide: b.mediaSide ?? 'left', aspect: b.aspect ?? '4/5' } };
        case 'stats':
          return { discriminant: 'stats', value: { heading: b.heading ?? E, items: b.items ?? [] } };
        case 'process':
          return {
            discriminant: 'process',
            value: {
              heading: b.heading ?? E,
              steps: (b.steps ?? []).map((s: M) => {
                const { caption: _c, ...rest } = pic(s.media);
                return { title: s.title ?? E, body: s.body ?? E, ...rest };
              }),
            },
          };
        case 'list':
          return { discriminant: 'list', value: { heading: b.heading ?? E, numbered: Boolean(b.numbered), items: b.items ?? [] } };
        case 'quote':
          return { discriminant: 'quote', value: { text: b.text ?? E, author: b.author ?? '', role: b.role ?? E } };
        default:
          return null;
      }
    }).filter(Boolean);

    const cover = pic(p.cover);
    return {
      id: p.slug as string,
      data: {
        name: p.name,
        published: p.published,
        featured: p.featured,
        order: p.order,
        kind: p.kind,
        title: p.title,
        summary: p.summary,
        oneLiner: p.oneLiner,
        client: p.client,
        agency: p.agency,
        studio: p.studio,
        year: p.year,
        status: p.status,
        role: p.role,
        disciplines: p.disciplines,
        tags: p.tags,
        cover: cover.image,
        coverAlt: cover.alt,
        coverNote: cover.note,
        coverInGallery: cover.inGallery,
        heroVideo: video(p.heroVideo),
        blocks,
        stack: p.stack,
        credits: p.credits,
        sources: p.sources,
        seoDescription: p.seoDescription,
        related: p.related ?? [],
        reviewNotes: '',
      },
    };
  });
}

/** Loader de Astro. `refreshContent({ loaders: ['estudio'] })` lo vuelve a leer en dev. */
export function studioLoader({ drafts }: { drafts: boolean }): Loader {
  return {
    name: 'estudio',
    load: async ({ store, parseData, generateDigest, logger }) => {
      const data = await readSource(drafts, logger);
      if (data?.format !== 'ethan-content') throw new Error('El archivo de contenido no viene del estudio (format ≠ ethan-content).');
      const entries = toEntries(data, process.env.STUDIO_MEDIA_BASE);
      store.clear();
      for (const e of entries) {
        const parsed = await parseData({ id: e.id, data: e.data });
        store.set({ id: e.id, data: parsed, digest: generateDigest(e.data) });
      }
      // Lista ligera de proyectos para el editor de servicios (Keystatic).
      const index = entries.map((e) => ({ value: e.id, label: e.data.title?.es || e.data.name }));
      const file = path.resolve('src/content/projects-index.json');
      const next = JSON.stringify(index, null, 2) + '\n';
      const prev = await fs.readFile(file, 'utf8').catch(() => '');
      if (prev !== next) await fs.writeFile(file, next);
      logger.info(`${entries.length} proyectos desde el estudio`);
    },
  };
}
