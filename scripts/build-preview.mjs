// Build de vista previa con rutas relativas para abrirse fuera de la raíz de un dominio.
// Por defecto incluye borradores y marcadores de media pendiente.
// Con PUBLIC_PREVIEW_DRAFTS=false queda igual que producción: solo lo publicado (y solo su media).
// Funciona igual en Windows, macOS y Linux.  Uso: npm run build:preview [carpeta]
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { build } from 'astro';

const outDir = process.argv[2] ?? 'dist-preview';

process.env.PUBLIC_PREVIEW = 'true';
const drafts = process.env.PUBLIC_PREVIEW_DRAFTS !== 'false';
// La media del estudio se copia dentro del preview (así se ve sin el estudio abierto).
process.env.STUDIO_MEDIA_BASE ||= '/media/';
// Carpeta de assets sin "_" inicial: algunos hosts de previews reservan esos nombres.
await build({ outDir, build: { assets: 'assets' } });

const studio = resolve(process.env.STUDIO_DIR ?? '../ethan-estudio');
const studioMedia = resolve(studio, 'media');
if (!existsSync(studioMedia)) {
  console.warn(`No encontré ${studioMedia}: el preview no tendrá las imágenes de los proyectos.`);
} else if (drafts) {
  cpSync(studioMedia, resolve(outDir, 'media'), { recursive: true });
} else {
  // Solo la media de los proyectos publicados (la de los borradores no sale de tu computadora).
  const content = JSON.parse(readFileSync(resolve(studio, 'dist', 'content.json'), 'utf8'));
  const files = new Set();
  for (const p of content.projects)
    for (const m of p.media) {
      for (const v of m.variants ?? []) files.add(v.src);
      for (const v of m.sources ?? []) files.add(v.src);
      for (const v of m.poster?.variants ?? []) files.add(v.src);
    }
  for (const f of files) {
    const to = resolve(outDir, 'media', f);
    mkdirSync(dirname(to), { recursive: true });
    cpSync(resolve(studioMedia, f), to);
  }
  console.log(`→ ${files.size} archivos de media publicados`);
}

execFileSync(process.execPath, ['scripts/preview-relative.mjs', outDir], { stdio: 'inherit' });
