// Textos de la interfaz que se editaron en el estudio (Sitio → Textos de la interfaz).
// Se leen una vez al construir el sitio; si el estudio no los publica, no cambia nada.
import { getEntry } from 'astro:content';

type Strings = Record<string, string>;
type Discipline = { value: string; es: string; en: string };

let data: { es: Strings; en: Strings; disciplines: Discipline[] } = { es: {}, en: {}, disciplines: [] };
try {
  const entry = await getEntry('ui', 'strings');
  if (entry) data = entry.data as typeof data;
} catch {
  /* sin textos del estudio */
}

export const uiOverrides = data;
