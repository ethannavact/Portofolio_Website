// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import keystatic from '@keystatic/astro';
import { loadEnv } from 'vite';

// El editor (Keystatic) solo corre en local con `npm run dev`.
// El build de producción queda 100% estático: sin servidor, sin costo.
const isDev = process.argv.includes('dev');

// Dominio final: SITE_URL en .env (local) o en las variables del proyecto en Cloudflare.
const env = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), '');
const SITE = env.SITE_URL || 'https://ethan-nava.pages.dev';
for (const k of ['STUDIO_CONTENT', 'STUDIO_URL', 'STUDIO_MEDIA_BASE']) if (env[k] && !process.env[k]) process.env[k] = env[k];

/**
 * En desarrollo, cuando guardas algo en el Estudio de contenido, el sitio vuelve a leer
 * los proyectos solo (sin reiniciar `npm run dev`).
 * @returns {import('astro').AstroIntegration}
 */
function estudioEnVivo() {
  return {
    name: 'estudio-en-vivo',
    hooks: {
      'astro:server:setup': ({ refreshContent, logger }) => {
        if (!refreshContent || process.env.STUDIO_CONTENT) return;
        const url = `${process.env.STUDIO_URL || 'http://127.0.0.1:4400'}/api/version`;
        let last = '';
        const timer = setInterval(async () => {
          try {
            const { v } = await (await fetch(url, { signal: AbortSignal.timeout(1500) })).json();
            if (last && v !== last) {
              await refreshContent({ loaders: ['estudio'] });
              logger.info('Proyectos actualizados desde el estudio');
            }
            last = v;
          } catch {
            /* estudio cerrado */
          }
        }, 2000);
        timer.unref?.();
      },
    },
  };
}

export default defineConfig({
  site: SITE,
  trailingSlash: 'ignore',
  i18n: {
    defaultLocale: 'es',
    locales: ['es', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
  image: {
    // Tamaños de salida para imágenes responsivas.
    breakpoints: [480, 768, 1080, 1440, 1920, 2560],
  },
  integrations: [
    sitemap({ filter: (page) => !page.includes('/keystatic') }),
    ...(isDev ? [react(), keystatic(), estudioEnVivo()] : []),
  ],
  devToolbar: { enabled: false },
});
