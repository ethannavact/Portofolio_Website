// Convierte el build en un sitio navegable con rutas relativas (para previews
// que no viven en la raíz de un dominio). Uso: node scripts/preview-relative.mjs dist-preview
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, posix } from 'node:path';

const root = process.argv[2] ?? 'dist-preview';

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const toTarget = (url) => {
  const [pathPart, hash = ''] = url.split('#');
  let path = pathPart;
  if (path === '' ) return null;
  if (path.endsWith('/')) path += 'index.html';
  else if (!posix.basename(path).includes('.')) path += '/index.html';
  return { path: path.replace(/^\//, ''), hash: hash ? `#${hash}` : '' };
};

const rewrite = (html, fileRel) => {
  const fromDir = posix.dirname(fileRel.split('\\').join('/'));
  const rel = (url) => {
    if (!url.startsWith('/') || url.startsWith('//')) return url;
    const t = toTarget(url);
    if (!t) return url;
    let r = posix.relative(fromDir === '.' ? '' : fromDir, t.path) || 'index.html';
    return r + t.hash;
  };
  html = html.replace(/(\s(?:href|src|poster|action|data-focus-src|data-preview-src|data-full)=")([^"]+)"/g, (_m, a, url) => `${a}${rel(url)}"`);
  html = html.replace(/(\ssrcset=")([^"]+)"/g, (_m, a, set) =>
    `${a}${set
      .split(',')
      .map((part) => {
        const [u, d] = part.trim().split(/\s+/);
        return [rel(u), d].filter(Boolean).join(' ');
      })
      .join(', ')}"`,
  );
  html = html.replace(/url\((['"]?)(\/[^'")]+)\1\)/g, (_m, q, u) => `url(${q}${rel(u)}${q})`);
  return html;
};

const files = walk(root).filter((f) => f.endsWith('.html'));
for (const file of files) {
  const fileRel = relative(root, file);
  writeFileSync(file, rewrite(readFileSync(file, 'utf8'), fileRel));
}

// Página principal "desnuda" (sin doctype/html/head/body) para hosts que envuelven la página.
const home = readFileSync(join(root, 'index.html'), 'utf8');
const head = (home.match(/<head>([\s\S]*?)<\/head>/) ?? [, ''])[1];
const body = (home.match(/<body[^>]*>([\s\S]*?)<\/body>/) ?? [, ''])[1];
const title = (head.match(/<title>[\s\S]*?<\/title>/) ?? [''])[0];
const headRest = head.replace(title, '').replace(/<meta charset="utf-8"\s*\/?>/i, '').replace(/<meta name="viewport"[^>]*>/i, '');
writeFileSync(join(root, 'entry.html'), `${title}\n${headRest}\n${body}`);
console.log(`→ ${files.length} páginas con rutas relativas · entrada: ${join(root, 'entry.html')}`);
