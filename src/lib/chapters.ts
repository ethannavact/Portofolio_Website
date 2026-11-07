// Convierte los bloques de un caso en «capítulos» para la página del caso:
// a la izquierda (fijo) el texto del capítulo; a la derecha, la media que le sigue.
//  · Un bloque de texto, imagen + texto o proceso abre capítulo.
//  · Cifras, listas y citas se suman al capítulo anterior si aún no tiene media.
//  · Imágenes, videos y galerías van al último capítulo abierto.
// Luego se agrupan: cada grupo empieza en un capítulo con media y suma los capítulos
// sin media que le siguen (su media se queda fija mientras ese texto avanza).
import type { AnyImage } from './images';
import { pick } from '../i18n/ui';
import type { Lang } from '../i18n/routes';
import { isRenderable, type Block } from './projects';
import { SHOW_DRAFTS } from './env';

type T = { es: string; en: string };

export type ChapterMedia =
  | { kind: 'image'; image?: AnyImage; alt: string; caption: string; note: string; aspect?: string; label?: string }
  | { kind: 'video'; video: any; caption: string; note: string; label?: string };

export interface Chapter {
  heading: string;
  body: string;
  stats: { value: string; label: string }[];
  list: { numbered: boolean; items: { title: string; body: string }[] } | null;
  steps: { title: string; body: string }[];
  quote: { text: string; author: string; role: string } | null;
  media: ChapterMedia[];
  words: number;
}

export interface ChapterGroup {
  chapters: number[];
  media: ChapterMedia[];
}

const words = (...parts: string[]) => parts.join(' ').split(/\s+/).filter(Boolean).length;

const blank = (): Chapter => ({ heading: '', body: '', stats: [], list: null, steps: [], quote: null, media: [], words: 0 });

/** intro: la media del primer capítulo (portada o video principal) y su texto se arman en la vista. */
export function buildChapters(blocks: Block[], lang: Lang, intro: ChapterMedia[]) {
  const chapters: Chapter[] = [{ ...blank(), media: [...intro] }];
  const last = () => chapters[chapters.length - 1];
  // Cifras/listas/citas: se suman al capítulo anterior si es de texto y todavía no tiene media.
  const attachable = () => chapters.length > 1 && last().media.length === 0;
  const open = (heading: string, body: string) => {
    const c = { ...blank(), heading, body, words: words(heading, body) };
    chapters.push(c);
    return c;
  };
  const p = (v: T | undefined) => pick(v, lang);

  for (const block of blocks.filter(isRenderable)) {
    const v = block.value as any;
    switch (block.discriminant) {
      case 'text':
        open(p(v.heading), p(v.body));
        break;
      case 'split': {
        const c = open(p(v.heading), p(v.body));
        if (v.image || SHOW_DRAFTS) c.media.push({ kind: 'image', image: v.image, alt: p(v.alt), caption: p(v.caption), note: v.note, aspect: v.aspect });
        break;
      }
      case 'process': {
        const c = open(p(v.heading), '');
        for (const s of v.steps) {
          c.steps.push({ title: p(s.title), body: p(s.body) });
          c.words += words(p(s.title), p(s.body));
          if (s.image || SHOW_DRAFTS) c.media.push({ kind: 'image', image: s.image, alt: p(s.alt) || p(s.title), caption: p(s.title), note: s.note, aspect: '16/9' });
        }
        break;
      }
      case 'stats': {
        const items = v.items.filter((i: any) => i.value).map((i: any) => ({ value: i.value, label: p(i.label) }));
        const c = attachable() ? last() : open(p(v.heading), '');
        c.stats.push(...items);
        c.words += items.length * 4;
        break;
      }
      case 'list': {
        const items = v.items.map((i: any) => ({ title: p(i.title), body: p(i.body) }));
        const c = attachable() && !last().list ? last() : open(p(v.heading), '');
        c.list = { numbered: v.numbered, items };
        c.words += items.reduce((n: number, i: { title: string; body: string }) => n + words(i.title, i.body), 0);
        break;
      }
      case 'quote': {
        const c = attachable() && !last().quote ? last() : open('', '');
        c.quote = { text: p(v.text), author: v.author, role: p(v.role) };
        c.words += words(p(v.text));
        break;
      }
      case 'image':
        last().media.push({ kind: 'image', image: v.image, alt: p(v.alt), caption: p(v.caption), note: v.note, aspect: v.aspect });
        break;
      case 'video':
        last().media.push({ kind: 'video', video: v.video, caption: p(v.caption), note: v.note });
        break;
      case 'gallery': {
        const items = v.items.filter((i: any) => i.image || SHOW_DRAFTS);
        items.forEach((i: any, n: number) =>
          last().media.push({
            kind: 'image',
            image: i.image,
            alt: p(i.alt),
            caption: p(i.caption),
            note: i.note,
            aspect: v.aspect,
            label: n === 0 ? p(v.heading) : undefined,
          }),
        );
        break;
      }
    }
  }

  // Capítulos vacíos (p. ej. un proceso sin pasos) no cuentan.
  const kept = chapters.filter((c, i) => i === 0 || c.heading || c.body || c.stats.length || c.list || c.steps.length || c.quote || c.media.length);

  const groups: ChapterGroup[] = [];
  kept.forEach((c, i) => {
    if (i === 0 || c.media.length > 0) groups.push({ chapters: [i], media: c.media });
    else groups[groups.length - 1].chapters.push(i);
  });
  return { chapters: kept, groups };
}
