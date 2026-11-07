// Página del caso (ver src/views/CaseView.astro): el capítulo cuya «parada» cruza el centro
// de la pantalla se muestra en el panel izquierdo; los demás se desvanecen. Solo en
// escritorio: en teléfono el texto ya va entre la media, en orden de lectura.
const desktop = () => window.matchMedia('(min-width: 64rem)').matches;
const pad = (n: number) => String(n).padStart(2, '0');

export function initCase() {
  const root = document.querySelector<HTMLElement>('[data-case]');
  if (!root) return;
  const chapters = Array.from(root.querySelectorAll<HTMLElement>('[data-chapter]'));
  const slots = Array.from(root.querySelectorAll<HTMLElement>('[data-slot]'));
  const ticks = Array.from(root.querySelectorAll<HTMLElement>('[data-case-ticks] > li'));
  const pos = root.querySelector<HTMLElement>('[data-case-pos]');
  const area = root.querySelector<HTMLElement>('[data-chapters]');
  const medias = Array.from(root.querySelectorAll<HTMLElement>('[data-group-media]'));
  if (!chapters.length || !slots.length) return;

  root.classList.add('is-synced');
  let active = 0;

  const set = (i: number) => {
    if (i === active) return;
    active = i;
    chapters.forEach((c, j) => c.classList.toggle('is-active', j === i));
    ticks.forEach((t, j) => t.classList.toggle('is-active', j <= i));
    if (pos) pos.textContent = pad(i + 1);
    if (area) area.scrollTop = 0;
  };

  // El capítulo activo es la última parada cuyo borde superior ya pasó el centro.
  const update = () => {
    if (!desktop()) return;
    const line = window.innerHeight * 0.5;
    let idx = 0;
    for (const slot of slots) {
      if (slot.getBoundingClientRect().top > line) break;
      idx = Number(slot.dataset.slot) || 0;
    }
    set(idx);
  };

  // Media fija centrada en el espacio libre; si es más alta que la ventana, se fija por su
  // borde inferior (así se ve completa al bajar).
  const fit = () => {
    const gap = parseFloat(getComputedStyle(root.querySelector('.case-grid') ?? root).rowGap) || 8;
    medias.forEach((m) => {
      m.style.top = '';
      if (!desktop()) return;
      const top = parseFloat(getComputedStyle(m).top) || 0;
      const room = window.innerHeight - top - gap;
      const h = m.offsetHeight;
      m.style.top = `${Math.round(h > room ? window.innerHeight - gap - h : top + (room - h) / 2)}px`;
    });
  };

  // Teclado: al enfocar un enlace dentro de un capítulo, ese capítulo se muestra.
  root.addEventListener('focusin', (e) => {
    const ch = (e.target as Element | null)?.closest<HTMLElement>('[data-chapter]');
    if (ch) set(Number(ch.dataset.chapter) || 0);
  });

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', () => {
    fit();
    update();
  });
  const ro = new ResizeObserver(() => fit());
  medias.forEach((m) => ro.observe(m));
  fit();
  update();
}
