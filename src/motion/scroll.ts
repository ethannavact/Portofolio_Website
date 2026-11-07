// Coreografía de scroll. Atributos que se usan en las vistas:
//   data-reveal="lines|fade"  entra desenfocado (líneas enmascaradas o bloque)
//   data-reveal-group         sus hijos entran escalonados
//   data-scrub-words          las palabras se enfocan conforme avanza el scroll
//   data-parallax="60"        se desplaza ±60 px al cruzar la pantalla (≥ 48rem)
//   data-drift                deriva horizontal sutil de títulos grandes
//   data-reel / data-case-head  composiciones propias de la Home y del caso
//   data-marquee              lista que corre en bucle y acelera con el scroll
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { onIdle, root, state } from './core';

let ctx: gsap.Context | null = null;
let mm: gsap.MatchMedia | null = null;
const cleanups: (() => void)[] = [];

const inFirstView = (el: Element) => el.getBoundingClientRect().top < innerHeight * 0.95;

let intro = 0;
let done = new WeakSet<Element>();
let generation = 0;

/** first=true: solo lo visible al cargar (entra de inmediato); false: todo lo que falte. */
function reveals(first: boolean) {
  const delayFor = (el: Element) => (inFirstView(el) ? 0.2 + intro++ * 0.08 : 0);
  const trigger = (el: Element) => (inFirstView(el) ? undefined : { trigger: el, start: 'top 90%', once: true });
  // Cada elemento se prepara una sola vez, aunque el scroll haya cambiado entre pasadas.
  const take = (el: Element) => {
    if (done.has(el) || (first && !inFirstView(el))) return false;
    done.add(el);
    return true;
  };

  document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
    if (!take(el)) return;
    const delay = delayFor(el);
    if (el.dataset.reveal === 'lines') {
      SplitText.create(el, {
        type: 'lines',
        mask: 'lines',
        autoSplit: true,
        onSplit(self) {
          gsap.set(el, { opacity: 1 });
          return gsap.from(self.lines, {
            yPercent: 115,
            filter: 'blur(8px)',
            duration: 1.3,
            ease: 'expo.out',
            stagger: 0.09,
            delay,
            scrollTrigger: trigger(el),
          });
        },
      });
    } else {
      gsap.fromTo(
        el,
        { opacity: 0, y: 40, filter: 'blur(14px)' },
        {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          duration: 1.4,
          ease: 'expo.out',
          delay,
          clearProps: 'filter,transform',
          scrollTrigger: trigger(el),
        },
      );
    }
  });

  document.querySelectorAll<HTMLElement>('[data-reveal-group]').forEach((group) => {
    if (!take(group)) return;
    const items = Array.from(group.children) as HTMLElement[];
    if (!items.length) return;
    gsap.fromTo(
      items,
      { opacity: 0, y: 28, filter: 'blur(10px)' },
      {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        duration: 1.2,
        ease: 'expo.out',
        stagger: 0.07,
        delay: delayFor(group),
        clearProps: 'filter,transform',
        scrollTrigger: trigger(group),
      },
    );
  });
}

function statement() {
  document.querySelectorAll<HTMLElement>('[data-scrub-words]').forEach((el) => {
    SplitText.create(el, {
      type: 'words',
      autoSplit: true,
      onSplit(self) {
        return gsap.fromTo(
          self.words,
          { opacity: 0.55, filter: 'blur(4px)' },
          {
            opacity: 1,
            filter: 'blur(0px)',
            ease: 'none',
            stagger: 0.12,
            scrollTrigger: { trigger: el, start: 'top 85%', end: 'bottom 50%', scrub: 0.6 },
          },
        );
      },
    });
  });
}

function composition() {
  mm = gsap.matchMedia();
  mm.add('(min-width: 48rem)', () => {
    document.querySelectorAll<HTMLElement>('[data-parallax]').forEach((el) => {
      const amount = parseFloat(el.dataset.parallax || '60');
      gsap.fromTo(
        el,
        { y: amount },
        { y: -amount, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } },
      );
    });
    document.querySelectorAll<HTMLElement>('[data-drift]').forEach((el) => {
      gsap.fromTo(
        el,
        { xPercent: -2.5 },
        { xPercent: 2.5, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } },
      );
    });
  });

  // Reel: al bajar, el cuadro se aleja y el texto se desenfoca (profundidad de campo).
  const reel = document.querySelector<HTMLElement>('[data-reel]');
  const frame = reel?.querySelector<HTMLElement>('[data-reel-frame]');
  if (reel && frame) {
    const end = () => frame.offsetHeight;
    gsap.to(frame, { scale: 0.9, yPercent: 5, ease: 'none', scrollTrigger: { start: 0, end, scrub: true } });
    const overlay = reel.querySelector('[data-reel-overlay]');
    if (overlay) {
      gsap.to(overlay, {
        opacity: 0,
        y: -50,
        filter: 'blur(12px)',
        ease: 'none',
        scrollTrigger: { start: 0, end: () => frame.offsetHeight * 0.6, scrub: true },
      });
    }
  }

  // Caso: el encabezado se desenfoca al salir, la portada sigue en foco.
  document.querySelectorAll<HTMLElement>('[data-case-head]').forEach((head) => {
    gsap.to(head, {
      opacity: 0.1,
      y: -60,
      filter: 'blur(10px)',
      ease: 'none',
      scrollTrigger: { trigger: head, start: 'center 30%', end: 'bottom top', scrub: true },
    });
  });
}

function marquees() {
  document.querySelectorAll<HTMLElement>('[data-marquee]').forEach((box) => {
    const list = box.querySelector<HTMLElement>('ul');
    if (!list || box.classList.contains('is-marquee')) return;
    const track = document.createElement('div');
    track.className = 'marquee-track';
    list.before(track);
    track.append(list);
    const clone = list.cloneNode(true) as HTMLElement;
    clone.setAttribute('aria-hidden', 'true');
    track.append(clone);
    box.classList.add('is-marquee');

    let width = list.offsetWidth;
    const measure = () => (width = list.offsetWidth);
    window.addEventListener('resize', measure);
    let x = 0;
    let dir = -1;
    const setX = gsap.quickSetter(track, 'x', 'px');
    const tick = (_t: number, dt: number) => {
      const v = state.velocity;
      if (Math.abs(v) > 0.03) dir = v > 0 ? -1 : 1;
      x += dir * (36 + Math.abs(v) * 520) * (dt / 1000);
      if (x <= -width) x += width;
      if (x > 0) x -= width;
      setX(x);
    };
    gsap.ticker.add(tick);
    cleanups.push(() => {
      gsap.ticker.remove(tick);
      window.removeEventListener('resize', measure);
      track.before(list);
      track.remove();
      box.classList.remove('is-marquee');
    });
  });
}

/** Arranca la coreografía. withReveals=false cuando el movimiento se reactiva a mitad de visita. */
export function initScrollFx(withReveals = true) {
  const gen = ++generation;
  intro = 0;
  done = new WeakSet();
  ctx = gsap.context(() => {
    if (withReveals) reveals(true);
    statement();
    composition();
  });
  // Las entradas fuera de pantalla se preparan cuando el navegador queda libre:
  // la carga inicial no se bloquea partiendo textos que nadie ve todavía.
  onIdle(() => {
    if (gen !== generation || !ctx) return;
    if (withReveals) ctx.add(() => reveals(false));
    marquees();
    ScrollTrigger.refresh();
  }, 300);
  window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
}

/** Apaga todo y deja el contenido en su estado final (sin animaciones). */
export function killScrollFx() {
  generation++;
  mm?.revert();
  mm = null;
  ctx?.revert();
  ctx = null;
  cleanups.splice(0).forEach((fn) => fn());
  root.classList.remove('motion-js');
}
