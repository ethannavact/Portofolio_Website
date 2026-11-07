import type { Lang } from '../i18n/routes';
import { pick } from '../i18n/ui';
import type { AboutData, Project, SiteData } from './projects';

// Datos estructurados (JSON-LD) para buscadores.

export function personLd(site: SiteData, about: AboutData | undefined, lang: Lang, base: URL) {
  const sameAs = site.socials.map((s) => s.url).filter(Boolean);
  const knowsAbout = (about?.stackGroups ?? []).flatMap((g) => g.items.map((i) => pick(i, lang))).filter(Boolean);
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': new URL('/#person', base).href,
    name: site.name,
    jobTitle: pick(site.jobTitle, lang),
    url: new URL(lang === 'es' ? '/' : '/en/', base).href,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Ciudad de México',
      addressCountry: 'MX',
    },
    ...(site.email ? { email: `mailto:${site.email}` } : {}),
    ...(site.phone ? { telephone: site.phone } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(knowsAbout.length ? { knowsAbout } : {}),
  };
}

export function websiteLd(site: SiteData, lang: Lang, base: URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': new URL('/#website', base).href,
    name: site.name,
    url: base.href,
    inLanguage: ['es-MX', 'en'],
    publisher: { '@id': new URL('/#person', base).href },
    description: pick(site.seoDescription, lang),
  };
}

export function caseLd(project: Project, lang: Lang, url: string, imageUrl: string | undefined, base: URL) {
  const d = project.data;
  return {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: pick(d.title, lang),
    description: pick(d.seoDescription, lang) || pick(d.summary, lang),
    url,
    inLanguage: lang === 'es' ? 'es-MX' : 'en',
    ...(d.year ? { dateCreated: d.year.slice(0, 4) } : {}),
    creator: { '@id': new URL('/#person', base).href },
    ...(d.client ? { sourceOrganization: { '@type': 'Organization', name: d.client } } : {}),
    ...(d.tags.length ? { keywords: d.tags.join(', ') } : {}),
    ...(imageUrl ? { image: imageUrl } : {}),
  };
}

export function breadcrumbLd(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function serviceLd(name: string, description: string, url: string, base: URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    description,
    url,
    provider: { '@id': new URL('/#person', base).href },
    areaServed: 'MX',
  };
}
