// Ruleta de proyectos (ver src/components/Ruleta.astro). El scroll mueve la tira de
// portadas; aquí se calcula qué proyecto está en la línea de foco, se gira el tambor de
// nombres y se cambian el panel izquierdo y los datos de la derecha con un fundido.
//
// Todo se recalcula en el mismo cuadro en que Lenis mueve el scroll (frameHooks), así el
// tambor y las líneas avanzan exactamente con las portadas, sin el cuadro de retraso que
// tenía el evento `scroll`. Cada valor es continuo (nada cambia de golpe al pasar de un
// proyecto a otro): la opacidad y el largo de las líneas dependen de la distancia al foco.
// Entre cada proyecto hay líneas intermedias (no son proyectos): con el scroll, toda la
// regla se estira y se encoge alrededor del foco.
import { clamp, frameHooks, isMotion, state } from './core';

type Info = Record<'short' | 'tagline' | 'summary' | 'client' | 'year' | 'role' | 'status' | 'cat', string>;

/** Grados entre filas del tambor y radio en px (la separación cerca del centro ≈ R·STEP). */
const STEP = 24;
const RADIUS = 78;
const RAD = Math.PI / 180;

/** Líneas por proyecto en la regla: 1 de proyecto + (SUB − 1) intermedias. */
const SUB = 5;
/** Líneas que existen a la vez (las visibles en el tambor, ±3.5 proyectos, y margen). */
const POOL = 7 * SUB + 4;
/** Largo de una línea según su distancia al foco (1 = la más larga). */
const lineScale = (d: number) => 0.1 + 0.9 / (1 + 3 * d * d);
/** Las intermedias son más cortas y tenues que las de proyecto. */
const MINOR_LEN = 0.62;
const MINOR_ALPHA = 0.7;
/** Opacidad por distancia al foco (se multiplica por el giro del tambor). */
const fade = (d: number) => 0.4 + 0.6 * Math.exp(-2.2 * d * d);

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
  // Regla de líneas: un grupo fijo de elementos que se reparte entre las posiciones visibles.
  const lineCol = section.querySelector<HTMLElement>('[data-drum-line]');
  const pool: { li: HTMLElement; bar: HTMLElement; q: number; on: boolean }[] = [];
  if (lineCol) {
    lineCol.textContent = '';
    for (let j = 0; j < POOL; j++) {
      const li = document.createElement('li');
      const bar = document.createElement('span');
      li.append(bar);
      lineCol.append(li);
      pool.push({ li, bar, q: Number.NaN, on: false });
    }
  }
  const ticks = Array.from(section.querySelectorAll<HTMLElement>('[data-ruleta-ticks] > li'));
  const swappers = [section.querySelector<HTMLElement>('[data-ruleta-info]'), section.querySelector<HTMLElement>('[data-ruleta-facts]')].filter(
    (el): el is HTMLElement => Boolean(el),
  );
  const fields = Array.from(section.querySelectorAll<HTMLElement>('[data-f]'));
  const panel = section.querySelector<HTMLElement>('.r-panel');
  const indexEl = section.querySelector<HTMLElement>('[data-ruleta-index]');
  const posEl = section.querySelector<HTMLElement>('[data-ruleta-pos]');
  const totalEl = section.querySelector<HTMLElement>('[data-ruleta-total]');
  const countEl = section.querySelector<HTMLElement>('[data-ruleta-count]');
  const buttons = Array.from(section.querySelectorAll<HTMLButtonElement>('[data-filter]'));
  const foot = section.querySelector<HTMLElement>('[data-ruleta-foot]');
  const toggle = section.querySelector<HTMLButtonElement>('[data-filter-toggle]');
  const currentEl = section.querySelector<HTMLElement>('[data-filter-current]');

  section.classList.add('is-live');

  let visible = items.map((_, i) => i);
  let slot = 0;
  let focusY = 0;
  /** Progreso sin recortar: 0 = primera portada en el foco (negativo antes, > n-1 después). */
  let raw = 0;
  let active = -1;
  let shown = 0;
  let near = true;
  let dirty = true;
  let lastY = Number.NaN;
  let swapTimer = 0;
  let snapTimer = 0;
  let wide = true;
  let padTop = 0;
  let boxH = 0;
  let onBg = false;
  /** Filas que ya quedaron ocultas (fuera del tambor): no se vuelven a escribir. */
  const parked = new Set<number>();

  // ── Medidas: caja de portada, alto de cada parada y línea de foco ──
  function layout() {
    wide = desktop();
    const stageH = stage!.clientHeight;
    const colW = list!.clientWidth;
    if (!stageH || !colW) return;
    const gap = parseFloat(getComputedStyle(section).rowGap) || 8;
    const aspect = wide ? 4 / 3 : 1;
    // En teléfono la info va pegada abajo de la ventana: la portada en foco queda arriba de
    // ella (se mide una vez aquí; si cambia el texto, la tira no se mueve).
    const cover = wide ? 0 : (panel?.offsetHeight ?? 0) + gap;
    const avail = Math.max(stageH - cover, stageH * 0.5);
    boxH = Math.min(colW / aspect, avail * (wide ? 0.74 : 0.92));
    const boxW = boxH * aspect;
    slot = boxH + gap;
    // Escritorio: foco al centro. Teléfono: un poco arriba dentro del espacio libre (menos
    // hueco antes de la primera portada).
    focusY = wide ? stageH / 2 : (avail - boxH) * 0.32 + boxH / 2;
    padTop = focusY - slot / 2;
    section.style.setProperty('--box-w', `${boxW.toFixed(1)}px`);
    section.style.setProperty('--box-h', `${boxH.toFixed(1)}px`);
    section.style.setProperty('--slot-h', `${slot.toFixed(1)}px`);
    section.style.setProperty('--focus-y', `${focusY.toFixed(1)}px`);
    section.style.setProperty('--drum-y', `${focusY.toFixed(1)}px`);
    section.style.setProperty('--panel-x', `${((colW - boxW) / 2).toFixed(1)}px`);
    section.style.setProperty('--pad-top', `${padTop.toFixed(1)}px`);
    section.style.setProperty('--pad-bottom', `${(stageH - focusY - slot / 2).toFixed(1)}px`);
    dirty = true;
    update();
  }

  // ── Scroll → progreso continuo (se llama en cada cuadro; solo trabaja si algo cambió) ──
  function update() {
    if (!slot) return;
    const y = window.scrollY;
    if (!dirty && y === lastY) return;
    dirty = false;
    lastY = y;
    const listTop = list!.getBoundingClientRect().top;
    raw = (stage!.getBoundingClientRect().top - listTop) / slot;
    const p = clamp(raw, 0, Math.max(0, visible.length - 1));
    spin(p);
    if (!wide && panel) {
      // ¿Hay portada detrás de la info? Si no (arena antes de la primera o después de la
      // última), el texto pasa a tinta.
      const r = panel.getBoundingClientRect();
      const mid = (r.top + r.bottom) / 2;
      const inset = (slot - boxH) / 2;
      const first = listTop + padTop + inset;
      const last = listTop + padTop + visible.length * slot - inset;
      const bg = mid < first || mid > last;
      if (bg !== onBg) {
        onBg = bg;
        section.classList.toggle('is-on-bg', bg);
      }
    } else if (onBg) {
      onBg = false;
      section.classList.remove('is-on-bg');
    }
    const a = Math.round(p);
    if (a !== active) setActive(a);
  }

  function spin(p: number) {
    visible.forEach((i, k) => {
      const d = k - p;
      const th = d * STEP;
      const row = [cats[i], names[i]];
      if (Math.abs(th) > 84) {
        if (!parked.has(i)) {
          parked.add(i);
          row.forEach((el) => el && (el.style.opacity = '0'));
        }
        return;
      }
      parked.delete(i);
      const o = (Math.cos(th * RAD) ** 2 * fade(d)).toFixed(3);
      const transform = drumTransform(th);
      row.forEach((el) => {
        if (!el) return;
        el.style.transform = transform;
        el.style.opacity = o;
      });
    });
    rule(p);
  }

  const drumTransform = (th: number) =>
    `translate3d(0, ${(Math.sin(th * RAD) * RADIUS).toFixed(2)}px, 0) rotateX(${(-th).toFixed(2)}deg)`;

  // Regla: posiciones q / SUB (q múltiplo de SUB = proyecto) entre la primera y la última
  // portada visible, solo las que caben en el tambor. Cada q usa siempre el mismo elemento.
  function rule(p: number) {
    if (!pool.length) return;
    const n = visible.length;
    const qMin = Math.max(0, Math.ceil((p - 3.5) * SUB));
    const qMax = Math.min((n - 1) * SUB, Math.floor((p + 3.5) * SUB));
    const used = new Set<number>();
    for (let q = qMin; q <= qMax; q++) {
      const e = pool[q % POOL];
      used.add(q % POOL);
      const d = q / SUB - p;
      const th = d * STEP;
      const major = q % SUB === 0;
      if (e.q !== q) {
        e.q = q;
        e.li.classList.toggle('is-major', major);
      }
      e.on = true;
      e.li.style.transform = drumTransform(th);
      e.li.style.opacity = (Math.cos(th * RAD) ** 2 * fade(d) * (major ? 1 : MINOR_ALPHA)).toFixed(3);
      e.bar.style.transform = `scaleX(${(lineScale(d) * (major ? 1 : MINOR_LEN)).toFixed(3)})`;
    }
    pool.forEach((e, j) => {
      if (e.on && !used.has(j)) {
        e.on = false;
        e.li.style.opacity = '0';
      }
    });
  }

  function setActive(a: number) {
    active = a;
    const i = visible[a];
    if (i === undefined) return;
    const n = pad(a + 1);
    if (indexEl) indexEl.textContent = n;
    if (posEl) posEl.textContent = n;
    ticks.forEach((el, j) => el.classList.toggle('is-active', j === i));
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

  // ── Imán suave: al dejar de girar la rueda, el destino del scroll se ajusta a la portada
  // más cercana. Se reorienta el mismo movimiento de Lenis (con su lerp), sin arrancar una
  // animación nueva: no hay tirón al final.
  function snap() {
    const lenis = state.lenis;
    if (!lenis || !isMotion() || !desktop() || !near || !slot) return;
    const n = visible.length;
    // Solo con el escenario fijo (entre la primera y la última portada).
    if (raw <= 0 || raw >= n - 1) return;
    const base = window.scrollY - raw * slot;
    const goal = (lenis.targetScroll - base) / slot;
    if (goal <= 0 || goal >= n - 1) return;
    const dest = base + Math.round(goal) * slot;
    if (Math.abs(dest - lenis.targetScroll) < 1) return;
    lenis.scrollTo(dest, { lerp: 0.075 });
  }

  const onWheel = () => {
    if (!near) return;
    window.clearTimeout(snapTimer);
    snapTimer = window.setTimeout(snap, 140);
  };

  // ── Filtros (página de Trabajo). En teléfono se despliegan desde un botón. ──
  function setOpen(open: boolean, focusToggle = false) {
    if (!foot || !toggle) return;
    foot.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    if (!open && focusToggle) toggle.focus();
  }

  function applyFilter(value: string, button?: HTMLButtonElement) {
    visible = [];
    items.forEach((li, i) => {
      const match = value === 'all' || (li.dataset.disciplines ?? '').split(' ').includes(value);
      li.hidden = !match;
      [cats[i], names[i], ticks[i]].forEach((el) => el && (el.hidden = !match));
      if (match) visible.push(i);
    });
    parked.clear();
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === value)));
    if (currentEl && button) currentEl.textContent = button.textContent?.trim() ?? '';
    toggle?.classList.toggle('is-filtered', value !== 'all');
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
  buttons.forEach((b) =>
    b.addEventListener('click', () => {
      applyFilter(b.dataset.filter ?? 'all', b);
      if (foot?.classList.contains('is-open')) setOpen(false, true);
    }),
  );
  toggle?.addEventListener('click', () => setOpen(!foot?.classList.contains('is-open')));
  foot?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && foot.classList.contains('is-open')) {
      e.stopPropagation();
      setOpen(false, true);
    }
  });
  document.addEventListener('pointerdown', (e) => {
    if (foot?.classList.contains('is-open') && !foot.contains(e.target as Node)) setOpen(false);
  });

  new IntersectionObserver(([entry]) => {
    near = entry.isIntersecting;
    if (near) dirty = true;
  }, { rootMargin: '20% 0px' }).observe(section);

  frameHooks.add(() => near && update());
  window.addEventListener('wheel', onWheel, { passive: true });
  // Solo cambios de ancho de la columna o de alto del escenario (no los que provoca layout()).
  let lastW = 0;
  let lastH = 0;
  const relayout = () => {
    dirty = true;
    const w = list.clientWidth;
    const h = stage.clientHeight;
    if (w === lastW && h === lastH) return;
    lastW = w;
    lastH = h;
    layout();
  };
  new ResizeObserver(relayout).observe(list);
  new ResizeObserver(relayout).observe(stage);
  window.addEventListener('resize', relayout);
  document.fonts?.ready.then(layout).catch(() => {});
  layout();
}
