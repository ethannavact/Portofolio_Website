import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import {
  ASPECT_VALUES,
  DISCIPLINE_VALUES,
  GALLERY_LAYOUT_VALUES,
  MEDIA_SIZE_VALUES,
  PROJECT_KIND_VALUES,
  VIDEO_PROVIDER_VALUES,
} from './lib/taxonomy';
import { emptyLoader, studioLoader, studioSection } from './lib/studio';
import { SHOW_DRAFTS } from './lib/env';

// Todo viene del Estudio de contenido (src/lib/studio.ts): proyectos y, si el estudio los publica,
// los textos del sitio, Info, servicios y textos de la interfaz. Keystatic (keystatic.config.ts)
// queda de respaldo para lo que el estudio no traiga. Si agregas un campo, agrégalo aquí también.

const t = z.object({ es: z.string().default(''), en: z.string().default('') }).default({ es: '', en: '' });

const link = z.object({ label: z.string().default(''), url: z.string().default('') });

/** Imagen ya optimizada por el estudio (varios anchos en WebP). */
const remoteImage = z.object({
  remote: z.literal(true),
  src: z.string(),
  width: z.number(),
  height: z.number(),
  variants: z.array(z.object({ src: z.string(), width: z.number(), height: z.number() })),
  color: z.string().optional(),
  lqip: z.string().optional(),
});

const projects = defineCollection({
  loader: studioLoader({ drafts: SHOW_DRAFTS }),
  schema: (() => {
    const image = () => remoteImage;
    const video = z
      .object({
        provider: z.enum(VIDEO_PROVIDER_VALUES).default('none'),
        id: z.string().default(''),
        url: z.string().default(''),
        title: t,
        aspect: z.enum(ASPECT_VALUES).default('16/9'),
        loop: z.boolean().default(false),
        poster: image().optional(),
        /** Archivos del estudio: HD y SD. */
        sources: z.array(z.object({ src: z.string(), width: z.number(), height: z.number(), type: z.string() })).optional(),
      })
      .default({ provider: 'none', id: '', url: '', title: { es: '', en: '' }, aspect: '16/9', loop: false });

    const pic = {
      image: image().optional(),
      alt: t,
      caption: t,
      note: z.string().default(''),
      /** Still destacado: aparece en la Galería. */
      inGallery: z.boolean().default(false),
      /** Id y lugar en la pestaña Media del estudio (la Galería sigue ese orden). */
      mediaId: z.string().default(''),
      mediaIndex: z.number().default(-1),
    };

    const block = z.discriminatedUnion('discriminant', [
      z.object({
        discriminant: z.literal('text'),
        value: z.object({
          heading: t,
          body: t,
          style: z.enum(['default', 'lead', 'columns']).default('columns'),
        }),
      }),
      z.object({
        discriminant: z.literal('image'),
        value: z.object({ ...pic, size: z.enum(MEDIA_SIZE_VALUES).default('wide'), aspect: z.enum(ASPECT_VALUES).default('16/9') }),
      }),
      z.object({
        discriminant: z.literal('video'),
        value: z.object({
          video,
          caption: t,
          size: z.enum(MEDIA_SIZE_VALUES).default('wide'),
          note: z.string().default(''),
        }),
      }),
      z.object({
        discriminant: z.literal('gallery'),
        value: z.object({
          heading: t,
          layout: z.enum(GALLERY_LAYOUT_VALUES).default('grid-2'),
          aspect: z.enum(ASPECT_VALUES).default('4/3'),
          items: z.array(z.object(pic)).default([]),
        }),
      }),
      z.object({
        discriminant: z.literal('split'),
        value: z.object({
          ...pic,
          heading: t,
          body: t,
          mediaSide: z.enum(['left', 'right']).default('left'),
          aspect: z.enum(ASPECT_VALUES).default('4/5'),
        }),
      }),
      z.object({
        discriminant: z.literal('stats'),
        value: z.object({
          heading: t,
          items: z.array(z.object({ value: z.string().default(''), label: t })).default([]),
        }),
      }),
      z.object({
        discriminant: z.literal('process'),
        value: z.object({
          heading: t,
          steps: z
            .array(
              z.object({
                title: t,
                body: t,
                image: image().optional(),
                alt: t,
                note: z.string().default(''),
                inGallery: z.boolean().default(false),
                mediaId: z.string().default(''),
                mediaIndex: z.number().default(-1),
              }),
            )
            .default([]),
        }),
      }),
      z.object({
        discriminant: z.literal('list'),
        value: z.object({
          heading: t,
          numbered: z.boolean().default(false),
          items: z.array(z.object({ title: t, body: t })).default([]),
        }),
      }),
      z.object({
        discriminant: z.literal('quote'),
        value: z.object({ text: t, author: z.string().default(''), role: t }),
      }),
    ]);

    return z.object({
      name: z.string(),
      published: z.boolean().default(false),
      featured: z.boolean().default(false),
      order: z.number().nullish().transform((v) => v ?? 100),
      /** Posición en la Home (estudio → Sitio → Orden de proyectos → Home). */
      homeOrder: z.number().nullish().transform((v) => v ?? 1000),
      kind: z.enum(PROJECT_KIND_VALUES).default('produced'),
      title: t,
      summary: t,
      oneLiner: t,
      client: z.string().default(''),
      agency: z.string().default(''),
      studio: z.string().default(''),
      year: z.string().default(''),
      status: t,
      role: t,
      disciplines: z.array(z.enum(DISCIPLINE_VALUES)).default([]),
      tags: z.array(z.string()).default([]),
      cover: image().optional(),
      coverAlt: t,
      coverNote: z.string().default(''),
      coverInGallery: z.boolean().default(false),
      coverMediaId: z.string().default(''),
      coverMediaIndex: z.number().default(-1),
      heroVideo: video,
      blocks: z.array(block).default([]),
      stack: z.array(z.string()).default([]),
      credits: z.array(z.object({ role: t, name: z.string().default(''), url: z.string().default('') })).default([]),
      sources: z.array(link).default([]),
      seoDescription: t,
      /** Proyectos similares (calculados por el estudio). */
      related: z.array(z.string()).default([]),
      reviewNotes: z.string().default(''),
    });
  })(),
});

/** Video subido al estudio (MP4 en R2), p. ej. el reel. */
const fileVideo = z.object({
  url: z.string(),
  sources: z
    .array(z.object({ src: z.string(), width: z.number().optional(), height: z.number().optional(), type: z.string().default('video/mp4') }))
    .default([]),
  poster: remoteImage.optional(),
  aspect: z.string().default('16/9'),
});

const site = defineCollection({
  loader: studioSection('site', glob({ pattern: 'site.yaml', base: './src/content/singletons' }), { drafts: SHOW_DRAFTS }),
  schema: ({ image }) =>
    z.object({
    name: z.string().default('Ethan Nava'),
    jobTitle: t,
    location: t,
    heroLine: t,
    heroIntro: t,
    email: z.string().default(''),
    phone: z.string().default(''),
    availability: t,
    socials: z.array(link).default([]),
    reel: z
      .object({
        provider: z.enum(VIDEO_PROVIDER_VALUES).default('none'),
        id: z.string().default(''),
        url: z.string().default(''),
        title: t,
        poster: image().optional(),
        posterAlt: t,
        /** Si se elige, el póster es la portada de ese proyecto (y su texto alternativo). */
        posterProject: z.string().default(''),
        /** Reel subido al estudio: completo (diálogo) y loop de fondo. Tienen prioridad sobre YouTube. */
        file: fileVideo.optional(),
        loop: fileVideo.optional(),
      })
      .default({ provider: 'none', id: '', url: '', title: { es: '', en: '' }, posterAlt: { es: '', en: '' }, posterProject: '' }),
    modes: z.array(z.object({ title: t, body: t })).default([]),
    ctaTitle: t,
    seoDescription: t,
    generativeLayer: z.boolean().default(false),
  }),
});

const item = z.object({ title: t, body: t });

const services = defineCollection({
  loader: studioSection('services', glob({ pattern: '*.yaml', base: './src/content/services' }), { drafts: SHOW_DRAFTS }),
  schema: z.object({
    name: z.string(),
    published: z.boolean().default(false),
    order: z.number().nullish().transform((v) => v ?? 100),
    title: t,
    tagline: t,
    intro: t,
    fit: z.array(t).default([]),
    includes: z.array(item).default([]),
    process: z.array(item).default([]),
    // Slugs de proyectos del estudio. Los que no existan (o sean borradores en producción) se omiten.
    projects: z.array(z.string()).default([]),
    seoDescription: t,
    reviewNotes: z.string().default(''),
  }),
});

const about = defineCollection({
  loader: studioSection('about', glob({ pattern: 'about.yaml', base: './src/content/singletons' }), { drafts: SHOW_DRAFTS }),
  schema: z.object({
    bio: t,
    approach: t,
    cvUrl: z.string().default(''),
    timeline: z
      .array(z.object({ years: z.string().default(''), place: z.string().default(''), role: t, note: t }))
      .default([]),
    clientGroups: z.array(z.object({ label: t, names: z.array(z.string()).default([]) })).default([]),
    stackGroups: z.array(z.object({ label: t, items: z.array(t).default([]) })).default([]),
  }),
});

// Textos de la interfaz editados en el estudio (menú, botones, títulos). Solo cambian los que el
// estudio trae; los demás quedan como en src/i18n/ui.ts.
const strings = z.record(z.string(), z.string()).default({});
const ui = defineCollection({
  loader: studioSection('ui', emptyLoader, { drafts: SHOW_DRAFTS }),
  schema: z.object({
    es: strings,
    en: strings,
    /** Nombres de los filtros editados en el estudio. */
    disciplines: z.array(z.object({ value: z.string(), es: z.string().default(''), en: z.string().default('') })).default([]),
  }),
});

export const collections = { projects, services, site, about, ui };
