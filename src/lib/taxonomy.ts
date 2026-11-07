// Taxonomías compartidas por el esquema de contenido, el editor y la UI.
// Cambiar una etiqueta aquí la cambia en todo el sitio.

export const DISCIPLINES = [
  { value: 'live-show', es: 'Shows en vivo', en: 'Live shows' },
  { value: 'interactive', es: 'Juegos e interactivos', en: 'Games & interactive' },
  { value: 'immersive', es: 'Inmersivo y exposiciones', en: 'Immersive & exhibitions' },
  { value: 'fooh-vfx', es: 'FOOH y VFX', en: 'FOOH & VFX' },
  { value: 'film-music-video', es: 'Videoclips y series', en: 'Music videos & series' },
  { value: 'dooh', es: 'DOOH y pantallas', en: 'DOOH & screens' },
  { value: 'creative-direction', es: 'Dirección creativa', en: 'Creative direction' },
  { value: 'research', es: 'Exploración', en: 'Research' },
] as const;

export type Discipline = (typeof DISCIPLINES)[number]['value'];
export const DISCIPLINE_VALUES = DISCIPLINES.map((d) => d.value) as [Discipline, ...Discipline[]];

export const PROJECT_KINDS = [
  { value: 'produced', es: 'Producido', en: 'Produced' },
  { value: 'concept', es: 'Pitch / Concepto', en: 'Pitch / Concept' },
  { value: 'personal', es: 'Proyecto personal', en: 'Personal project' },
] as const;

export type ProjectKind = (typeof PROJECT_KINDS)[number]['value'];
export const PROJECT_KIND_VALUES = PROJECT_KINDS.map((k) => k.value) as [ProjectKind, ...ProjectKind[]];

export const MEDIA_SIZES = [
  { value: 'full', label: 'Sangre completa' },
  { value: 'wide', label: 'Ancho de contenido' },
  { value: 'inset', label: 'Centrado (angosto)' },
] as const;
export type MediaSize = (typeof MEDIA_SIZES)[number]['value'];
export const MEDIA_SIZE_VALUES = MEDIA_SIZES.map((s) => s.value) as [MediaSize, ...MediaSize[]];

export const GALLERY_LAYOUTS = [
  { value: 'grid-2', label: 'Rejilla de 2' },
  { value: 'grid-3', label: 'Rejilla de 3' },
  { value: 'carousel', label: 'Carrusel' },
  { value: 'stack', label: 'Pila (una debajo de otra)' },
] as const;
export type GalleryLayout = (typeof GALLERY_LAYOUTS)[number]['value'];
export const GALLERY_LAYOUT_VALUES = GALLERY_LAYOUTS.map((l) => l.value) as [GalleryLayout, ...GalleryLayout[]];

export const VIDEO_PROVIDERS = [
  { value: 'none', label: 'Sin video' },
  { value: 'youtube', label: 'YouTube (ID del video)' },
  { value: 'vimeo', label: 'Vimeo (ID del video)' },
  { value: 'file', label: 'Archivo (URL de MP4: R2, Bunny, Mux…)' },
] as const;
export type VideoProvider = (typeof VIDEO_PROVIDERS)[number]['value'];
export const VIDEO_PROVIDER_VALUES = VIDEO_PROVIDERS.map((p) => p.value) as [VideoProvider, ...VideoProvider[]];

export const ASPECTS = [
  { value: '16/9', label: '16:9' },
  { value: '21/9', label: '21:9' },
  { value: '4/3', label: '4:3' },
  { value: '1/1', label: '1:1' },
  { value: '4/5', label: '4:5' },
  { value: '9/16', label: '9:16 (vertical)' },
] as const;
export type Aspect = (typeof ASPECTS)[number]['value'];
export const ASPECT_VALUES = ASPECTS.map((a) => a.value) as [Aspect, ...Aspect[]];
