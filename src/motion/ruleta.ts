// Ruleta de proyectos (ver src/components/Ruleta.astro). El scroll mueve la tira de
// portadas; aquí se calcula qué proyecto está en la línea de foco, se gira el tambor de
// nombres y se cambian el panel izquierdo y los datos de la derecha con un fundido.
import { clamp, isMotion, state } from './core';

type Info = Record<'short' | 'tagline' | 'summary' | 'client' | 'year' | 'role' | 'status' | 'cat', string>;

/** Grados entre filas del tambor y radio en px (la separación cerca del centro ≈ R·STEP). */
const STEP = 24;
const RADIUS = 78;
const RAD = Math.PI / 180;

const desktop = () => window.matchMedia('(min-width: 64rem)').matches;
const pad = (n: number) => String(n).padStart(2, '0');

export function initRuleta() {
  document.querySelectorAll<HTMLElement>('[data-ruleta]').forEach(setup);
}

function setup(section: HTMLElement) {
  const list = section.querySelector<HTMLElement>('[data-ruleta-list]');
  const stage = section.querySelector<HTMLElement>('[data-ruleta-stage]');
  let data: Info[] = [];
  try {
    data = JSON.parse(section.querySelector('[data-ruleta-json]')?.textContent || '[]');
  } catch {
    /* sin datos: se queda la lista */
  }
  if (!list || !stage || !data.length) return;

  const items = Array.from(list.children) as HTMLElement[];
  const hrefs = items.map((li) => li.querySelector('a')?.getAttribute('href') ?? '#');
  const cats = Array.from(section.querySelectorAll<HTMLElement>('[data-drum-cat] > li'));
  const names = Array.from(section.querySelectorAll<HTMLElement>('[data-drum-name] > li'));
  const ticks = Array.from(section.querySelectorAll<HTMLElement>('[data-ruleta-ticks] > li'));
  const ruler = section.querySelector<HTMLElement>('[data-ruleta-ruler]');
  const swappers = [section.querySelector<HTMLElement>('[data-ruleta-info]'), section.querySelector<HTMLElement>('[data-ruleta-facts]')].filter(
    (el): el is HTMLElement => Boolean(el),
  );
  const fields = Array.from(section.querySelectorAll<HTMLElement>('[data-f]'));
  const indexEl = section.querySelector<HTMLElement>('[data-ruleta-index]');
  const posEl = section.querySelector<HTMLElement>('[data-ruleta-pos]');
  const totalEl = section.querySelector<HTMLElement>('[data-ruleta-total]');
  const countEl = section.querySelector<HTMLElement>('[data-ruleta-count]');
  const panel = section.querySelector<HTMLElement>('.r-panel');
  const buttons = Array.from(section.querySelectorAll<HTMLButtonElement>('[data-filter]'));

  section.classList.add('is-live');

  let visible = items.map((_, i) => i);
  let slot = 0;
  let focusY = 0;
  let progress = 0;
  let active = -1;
  let shown = 0;
  let near = true;
  let swapTimer = 0;
  let snapTimer = 0;

  // ── Medidas: caja de portada, alto de cada parada y línea de foco ──
  function layout() {
    const wide = desktop();
    const stageH = stage!.clientHeight;
    const colW = list!.clientWidth;
    if (!stageH || !colW) return;
    const gap = parseFloat(getComputedStyle(section).rowGap) || 8;
    const aspect = wide ? 4 / 3 : 1;
    // En teléfono el panel tapa la parte baja del escenario: el foco sube.
    const cover = wide ? 0 : (panel?.offsetHeight ?? 0) + gap;
    const avail = Math.max(stageH - cover, stageH * 0.5);
    const boxH = Math.min(colW / aspect, avail * (wide ? 0.74 : 0.9));
    slot = boxH + gap;
    focusY = avail / 2;
    section.style.setProperty('--box-w', `${(boxH * aspect).toFixed(1)}px`);
    section.style.setProperty('--slot-h', `${slot.toFixed(1)}px`);
    section.style.setProperty('--focus-y', `${focusY.toFixed(1)}px`);
    section.style.setProperty('--pad-top', `${(focusY - slot / 2).toFixed(1)}px`);
    section.style.setProperty('--pad-bottom', `${(stageH - focusY - slot / 2).toFixed(1)}px`);
    update();
  }

  // ── Scroll → progreso continuo (0 = primera portada en la línea de foco) ──
  function update() {
    if (!slot) return;
    const p = clamp((stage!.getBoundingClientRect().top - list!.getBoundingClientRect().top) / slot, 0, Math.max(0, visible.length - 1));
    progress = p;
    spin(p);
    const a = Math.round(p);
    if (a !== active) setActive(a);
  }

  function spin(p: number) {
    visible.forEach((i, k) => {
      const d = k - p;
      const th = d * STEP;
      const pair = [cats[i], names[i]];
      if (Math.abs(th) > 84) {
        pair.forEach((el) => el && (el.style.opacity = '0'));
        return;
      }
      const y = Math.sin(th * RAD) * RADIUS;
      const o = Math.cos(th * RAD) ** 2 * (Math.abs(d) < 0.5 ? 1 : 0.6);
      const transform = `translate3d(0, ${y.toFixed(2)}px, 0) rotateX(${(-th).toFixed(2)}deg)`;
      pair.forEach((el) => {
        if (!el) return;
        el.style.transform = transform;
        el.style.opacity = o.toFixed(3);
      });
    });
    ruler?.style.setProperty('--tick-shift', `${(-(p % 1) * 9).toFixed(2)}px`);
  }

  function setActive(a: number) {
    active = a;
    const i = visible[a];
    if (i === undefined) return;
    const n = pad(a + 1);
    if (indexEl) indexEl.textContent = n;
    if (posEl) posEl.textContent = n;
    ticks.forEach((el, j) => el.classList.toggle('is-active', j === i));
    cats.forEach((el, j) => el.classList.toggle('is-active', j === i));
    names.forEach((el, j) => el.classList.toggle('is-active', j === i));
    if (i === shown) {
      window.clearTimeout(swapTimer);
      swappers.forEach((el) => el.classList.remove('is-swapping'));
      return;
    }
    if (!isMotion()) {
      fill(i);
      return;
    }
    // Fundido: sale el anterior, entra el nuevo (si el scroll sigue, gana el último).
    window.clearTimeout(swapTimer);
    swappers.forEach((el) => el.classList.add('is-swapping'));
    swapTimer = window.setTimeout(() => {
      fill(visible[active] ?? i);
      swappers.forEach((el) => el.classList.remove('is-swapping'));
    }, 220);
  }

  function fill(i: number) {
    shown = i;
    const d = data[i];
    if (!d) return;
    fields.forEach((el) => {
      const key = el.dataset.f as keyof Info | 'href';
      if (key === 'href') {
        el.setAttribute('href', hrefs[i]);
        return;
      }
      const value = d[key] ?? '';
      el.textContent = value;
      const row = el.closest<HTMLElement>('[data-f-row]');
      if (row) row.hidden = !value;
      else if (el.hasAttribute('data-f-hide')) el.hidden = !value;
    });
  }

  // ── Imán suave: al soltar el scroll, la portada más cercana queda en el foco ──
  function snap() {
    const lenis = state.lenis;
    if (!lenis || !isMotion() || !desktop() || !near) return;
    const target = Math.round(progress);
    const delta = (target - progress) * slot;
    if (progress <= 0 || progress >= visible.length - 1 || Math.abs(delta) < 2) return;
    lenis.scrollTo(lenis.targetScroll + delta, { duration: 0.6, easing: (t: number) => 1 - (1 - t) ** 3 });
  }

  const onScroll = () => {
    if (!near) return;
    update();
    window.clearTimeout(snapTimer);
    snapTimer = window.setTimeout(snap, 170);
  };

  // ── Filtros (página de Trabajo) ──
  function applyFilter(value: string) {
    visible = [];
    items.forEach((li, i) => {
      const match = value === 'all' || (li.dataset.disciplines ?? '').split(' ').includes(value);
      li.hidden = !match;
      [cats[i], names[i], ticks[i]].forEach((el) => el && (el.hidden = !match));
      if (match) visible.push(i);
    });
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === value)));
    const n = visible.length;
    if (countEl) countEl.textContent = n === 1 ? (countEl.dataset.one ?? '') : (countEl.dataset.many ?? '').replace('{n}', String(n));
    if (totalEl) totalEl.textContent = pad(n);
    active = -1;
    // Si ya se había bajado, vuelve al inicio de la ruleta.
    const top = section.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(stage!).top) || 0);
    if (window.scrollY > top + 2) {
      if (state.lenis) state.lenis.scrollTo(top, { immediate: !isMotion(), duration: 0.9 });
      else window.scrollTo({ top, behavior: isMotion() ? 'smooth' : 'auto' });
    }
    if (isMotion()) list!.animate([{ opacity: 0, filter: 'blur(8px)' }, { opacity: 1, filter: 'blur(0px)' }], { duration: 600, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
    layout();
    section.dispatchEvent(new CustomEvent('ruleta:filter', { detail: value, bubbles: true }));
  }
  buttons.forEach((b) => b.addEventListener('click', () => applyFilter(b.dataset.filter ?? 'all')));

  new IntersectionObserver(([entry]) => {
    near = entry.isIntersecting;
    if (near) update();
  }, { rootMargin: '20% 0px' }).observe(section);

  window.addEventListener('scroll', onScroll, { passive: true });
  // Solo cambios de ancho de la columna o de alto del escenario (no los que provoca layout()).
  let lastW = 0;
  let lastH = 0;
  const relayout = () => {
    const w = list.clientWidth;
    const h = stage.clientHeight;
    if (w === lastW && h === lastH) return;
    lastW = w;
    lastH = h;
    layout();
  };
  new ResizeObserver(relayout).observe(list);
  window.addEventListener('resize', relayout);
  document.fonts?.ready.then(layout).catch(() => {});
  layout();
}
