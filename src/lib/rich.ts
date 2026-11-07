// Renderizador mínimo y seguro para los textos del editor.
// Soporta: párrafos (línea en blanco), listas con "- ", **negritas**, *itálicas* y [enlaces](url).
// Todo el HTML del autor se escapa: no se puede inyectar marcado.

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const safeUrl = (url: string) => {
  const u = url.trim();
  if (/^(https?:|mailto:|tel:|\/|#)/i.test(u)) return u;
  return '#';
};

const inline = (raw: string) => {
  let s = escapeHtml(raw);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text: string, url: string) => {
    const href = safeUrl(url.replace(/&amp;/g, '&'));
    const external = /^https?:/i.test(href);
    return `<a href="${escapeHtml(href)}"${external ? ' rel="noopener" target="_blank"' : ''}>${text}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  return s;
};

export function rich(text: string | undefined): string {
  if (!text) return '';
  const blocks = text.replace(/\r\n/g, '\n').trim().split(/\n{2,}/);
  return blocks
    .map((block) => {
      const lines = block.split('\n');
      if (lines.every((l) => /^\s*[-•]\s+/.test(l))) {
        return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-•]\s+/, ''))}</li>`).join('')}</ul>`;
      }
      if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
        return `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\s*\d+[.)]\s+/, ''))}</li>`).join('')}</ol>`;
      }
      return `<p>${lines.map(inline).join('<br>')}</p>`;
    })
    .join('');
}

/** Versión en una sola línea (sin párrafos), para bajadas y pies. */
export function richInline(text: string | undefined): string {
  if (!text) return '';
  return inline(text.replace(/\s*\n\s*/g, ' ').trim());
}

/** Texto plano (para meta descripciones). */
export function plain(text: string | undefined, max = 160): string {
  if (!text) return '';
  const s = text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}
