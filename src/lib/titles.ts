// «DJ Silver: una DJ virtual que el público dirige en vivo» → nombre corto + frase.
// El nombre corto va en el tambor de la ruleta y como título grande; la frase, debajo.
export function splitTitle(title: string): { short: string; tagline: string } {
  const i = title.indexOf(': ');
  if (i > 0 && i <= 40) return { short: title.slice(0, i).trim(), tagline: title.slice(i + 2).trim() };
  return { short: title.trim(), tagline: '' };
}
