// Mapa de rutas ES / EN. El español vive en la raíz y el inglés en /en/.
// El selector de idioma lleva siempre a la misma página en el otro idioma.

export type Lang = 'es' | 'en';
export const LANGS: Lang[] = ['es', 'en'];
export const otherLang = (lang: Lang): Lang => (lang === 'es' ? 'en' : 'es');

export const HTML_LANG: Record<Lang, string> = { es: 'es-MX', en: 'en' };
export const OG_LOCALE: Record<Lang, string> = { es: 'es_MX', en: 'en_US' };

export type RouteKey = 'home' | 'work' | 'services' | 'gallery' | 'info';

const ROUTES: Record<RouteKey, Record<Lang, string>> = {
  home: { es: '/', en: '/en/' },
  work: { es: '/trabajo/', en: '/en/work/' },
  services: { es: '/servicios/', en: '/en/services/' },
  gallery: { es: '/galeria/', en: '/en/gallery/' },
  info: { es: '/info/', en: '/en/info/' },
};

export const route = (key: RouteKey, lang: Lang) => ROUTES[key][lang];

export const caseRoute = (slug: string, lang: Lang) =>
  lang === 'es' ? `/trabajo/${slug}/` : `/en/work/${slug}/`;

export const serviceRoute = (slug: string, lang: Lang) =>
  lang === 'es' ? `/servicios/${slug}/` : `/en/services/${slug}/`;

export const serviceAlternates = (slug: string): Alternates => ({
  es: serviceRoute(slug, 'es'),
  en: serviceRoute(slug, 'en'),
});

/** Rutas de la misma página en ambos idiomas (para hreflang y el selector). */
export type Alternates = Record<Lang, string>;

export const alternatesFor = (key: RouteKey): Alternates => ({ ...ROUTES[key] });

export const caseAlternates = (slug: string): Alternates => ({
  es: caseRoute(slug, 'es'),
  en: caseRoute(slug, 'en'),
});

/** Ancla de contacto (vive en Info). */
export const contactRoute = (lang: Lang) => `${ROUTES.info[lang]}#contacto`;
