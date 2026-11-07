import { collection, config, fields, singleton } from '@keystatic/core';
import { VIDEO_PROVIDERS } from './src/lib/taxonomy';
import projectIndex from './src/content/projects-index.json';

// ─────────────────────────────────────────────────────────────
// Editor de contenido del sitio: servicios, Home e Info. Abre
// http://127.0.0.1:4321/keystatic con `npm run dev`.
// Los PROYECTOS se editan en el Estudio de contenido (proyecto ethan-estudio).
// Si cambias un campo aquí, actualiza también src/content.config.ts.
// ─────────────────────────────────────────────────────────────

/** Proyectos del estudio (lo actualiza el loader en cada `npm run dev` / build). */
const projectOptions: { label: string; value: string }[] = projectIndex;

/** Texto bilingüe (ES / EN) lado a lado. */
const t = (label: string, opts: { multiline?: boolean; description?: string; required?: boolean } = {}) =>
  fields.object(
    {
      es: fields.text({
        label: 'Español',
        multiline: opts.multiline,
        validation: opts.required ? { isRequired: true } : undefined,
      }),
      en: fields.text({ label: 'English', multiline: opts.multiline }),
    },
    { label, description: opts.description, layout: [6, 6] },
  );

const richHelp =
  'Párrafos separados por una línea en blanco. Admite **negritas**, *itálicas*, [enlaces](https://…) y listas con "- ".';

export default config({
  storage: { kind: 'local' },
  locale: 'es-ES',
  ui: {
    brand: { name: 'Ethan Nava' },
    navigation: {
      Contenido: ['services'],
      Sitio: ['site', 'about'],
    },
  },
  collections: {
    services: collection({
      label: 'Servicios',
      slugField: 'name',
      path: 'src/content/services/*',
      format: { data: 'yaml' },
      previewUrl: '/servicios/{slug}/',
      columns: ['name', 'published', 'order'],
      schema: {
        name: fields.slug({
          name: { label: 'Nombre interno' },
          slug: { label: 'Slug (URL)', description: 'URL del servicio: /servicios/<slug>/' },
        }),
        published: fields.checkbox({ label: 'Publicado', defaultValue: true }),
        order: fields.integer({ label: 'Orden', description: 'Menor número = aparece antes.', defaultValue: 100 }),
        title: t('Servicio', { required: true }),
        tagline: t('Frase corta', { multiline: true, description: 'Una línea. Aparece en la lista de servicios y en la Home.' }),
        intro: t('Introducción', { multiline: true, description: richHelp }),
        fit: fields.array(t('Situación'), {
          label: 'Cuándo tiene sentido',
          description: 'Situaciones de cliente o agencia en las que este servicio resuelve algo.',
          itemLabel: (props) => props.fields.es.value || 'Situación',
        }),
        includes: fields.array(
          fields.object({ title: t('Entregable'), body: t('Detalle', { multiline: true }) }),
          { label: 'Qué incluye', itemLabel: (props) => props.fields.title.fields.es.value || 'Entregable' },
        ),
        process: fields.array(
          fields.object({ title: t('Paso'), body: t('Detalle', { multiline: true }) }),
          { label: 'Cómo trabajo', itemLabel: (props) => props.fields.title.fields.es.value || 'Paso' },
        ),
        projects: fields.array(
          projectOptions.length
            ? fields.select({ label: 'Proyecto', options: projectOptions, defaultValue: projectOptions[0].value })
            : fields.text({ label: 'Proyecto (slug)' }),
          {
            label: 'Ejemplos (proyectos)',
            description: 'Proyectos del estudio que muestran este servicio, en orden. Los borradores no se ven en producción.',
            itemLabel: (props) => projectOptions.find((o) => o.value === props.value)?.label ?? String(props.value ?? 'Proyecto'),
          },
        ),
        seoDescription: t('Descripción para buscadores (opcional)', { multiline: true }),
        reviewNotes: fields.text({ label: 'Pendientes por confirmar (no se publica)', multiline: true }),
      },
    }),
  },
  singletons: {
    site: singleton({
      label: 'Sitio y Home',
      path: 'src/content/singletons/site',
      format: { data: 'yaml' },
      previewUrl: '/',
      schema: {
        name: fields.text({ label: 'Nombre' }),
        jobTitle: t('Título profesional'),
        location: t('Ubicación'),
        heroLine: t('Frase principal de la Home', { multiline: true }),
        heroIntro: t('Introducción de la Home', { multiline: true }),
        email: fields.text({ label: 'Correo de contacto' }),
        phone: fields.text({ label: 'Teléfono', description: 'Con lada internacional, por ejemplo +525512345678.' }),
        availability: t('Disponibilidad (opcional)'),
        socials: fields.array(
          fields.object({ label: fields.text({ label: 'Red' }), url: fields.text({ label: 'URL' }) }),
          { label: 'Redes', itemLabel: (props) => props.fields.label.value || 'Red' },
        ),
        reel: fields.object(
          {
            provider: fields.select({ label: 'Fuente', options: VIDEO_PROVIDERS, defaultValue: 'youtube' }),
            id: fields.text({ label: 'ID (YouTube o Vimeo)' }),
            url: fields.text({ label: 'URL del archivo' }),
            title: t('Título accesible'),
            poster: fields.image({
              label: 'Póster del reel',
              description: 'Imagen que se ve mientras carga el video y cuando el movimiento está apagado. Ideal 16:9, mínimo 1920 px.',
              directory: 'src/assets/site',
              publicPath: '../../assets/site/',
            }),
            posterAlt: t('Texto alternativo del póster'),
          },
          { label: 'Reel (primera sección de la Home)' },
        ),
        modes: fields.array(
          fields.object({ title: t('Modalidad'), body: t('Descripción', { multiline: true }) }),
          { label: 'Cómo colaboro con agencias', itemLabel: (props) => props.fields.title.fields.es.value || 'Modalidad' },
        ),
        ctaTitle: t('Llamado a la acción (contacto)'),
        seoDescription: t('Descripción para buscadores', { multiline: true }),
        generativeLayer: fields.checkbox({
          label: 'Capa generativa en la Home',
          description: 'Activa el canvas de src/generative/sketch.ts (apagado hasta tener dirección de arte).',
        }),
      },
    }),
    about: singleton({
      label: 'Info y trayectoria',
      path: 'src/content/singletons/about',
      format: { data: 'yaml' },
      previewUrl: '/info/',
      schema: {
        bio: t('Bio', { multiline: true, description: richHelp }),
        approach: t('Enfoque (opcional)', { multiline: true, description: richHelp }),
        cvUrl: fields.text({ label: 'URL del CV (PDF)' }),
        timeline: fields.array(
          fields.object({
            years: fields.text({ label: 'Años', description: 'Ej. «2021» o «2018 —». Si termina en «—», el sitio muestra «Actualidad».' }),
            place: fields.text({ label: 'Lugar / estudio' }),
            role: t('Rol'),
            note: t('Nota (opcional)'),
          }),
          { label: 'Trayectoria', itemLabel: (props) => `${props.fields.years.value} · ${props.fields.place.value}` },
        ),
        clientGroups: fields.array(
          fields.object({
            label: t('Grupo'),
            names: fields.array(fields.text({ label: 'Nombre' }), { label: 'Nombres', itemLabel: (props) => props.value }),
          }),
          { label: 'Clientes', itemLabel: (props) => props.fields.label.fields.es.value || 'Grupo' },
        ),
        stackGroups: fields.array(
          fields.object({
            label: t('Grupo'),
            items: fields.array(t('Elemento'), {
              label: 'Elementos',
              itemLabel: (props) => props.fields.es.value || 'Elemento',
            }),
          }),
          { label: 'Stack (por grupos)', itemLabel: (props) => props.fields.label.fields.es.value || 'Grupo' },
        ),
      },
    }),
  },
});
