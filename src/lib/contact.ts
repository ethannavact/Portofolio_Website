// Formatos de los datos de contacto (teléfono legible y usuario de Instagram).

/** +525530602263 → +52 55 3060 2263 (México); otros números se muestran tal cual. */
export function formatPhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');
  const mx = digits.match(/^\+52(\d{2})(\d{4})(\d{4})$/);
  return mx ? `+52 ${mx[1]} ${mx[2]} ${mx[3]}` : raw.trim();
}

/** Para el enlace tel: (solo dígitos y +). */
export const telHref = (raw: string) => `tel:${raw.replace(/[^\d+]/g, '')}`;

/** https://www.instagram.com/ethan_nava/ → @ethan_nava (otras redes: la URL sin protocolo). */
export function socialHandle(url: string): string {
  const ig = url.match(/instagram\.com\/([^/?#]+)/i);
  if (ig) return `@${ig[1]}`;
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
}
