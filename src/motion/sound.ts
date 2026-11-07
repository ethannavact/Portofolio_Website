// Sonido: apagado por defecto. Todo es procedural (Web Audio), sin archivos.
// Ambiente: un pad grave y suave con aire filtrado. Interfaz: hover, clic y transición.
// Los navegadores exigen un gesto del usuario para sonar: al volver a una página con el
// sonido activo, arranca con la primera interacción.

const KEY = 'sound';
let enabled = false;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let bus: BiquadFilterNode | null = null;
let ambient: { stop: () => void } | null = null;
let lastHover = 0;

function ensureContext() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    bus = ctx.createBiquadFilter();
    bus.type = 'lowpass';
    bus.frequency.value = 9000;
    bus.connect(master).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function noiseBuffer(c: AudioContext, seconds: number) {
  const buffer = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    // Ruido "café": más grave y suave que el blanco.
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    data[i] = last * 3.2;
  }
  return buffer;
}

function makeAmbient(c: AudioContext) {
  const out = c.createGain();
  out.gain.value = 0;
  out.gain.setTargetAtTime(0.05, c.currentTime, 2.5);
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 720;
  filter.Q.value = 0.5;
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.045;
  const lfoDepth = c.createGain();
  lfoDepth.gain.value = 260;
  lfo.connect(lfoDepth).connect(filter.frequency);
  lfo.start();

  const nodes: AudioScheduledSourceNode[] = [lfo];
  // Acorde abierto (La, Mi, Si, Do#): estable, sin tensión.
  [110, 164.81, 246.94, 277.18].forEach((f, i) => {
    [-7, 7].forEach((detune) => {
      const osc = c.createOscillator();
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.value = f;
      osc.detune.value = detune;
      const g = c.createGain();
      g.gain.value = i === 0 ? 0.22 : 0.09;
      osc.connect(g).connect(filter);
      osc.start();
      nodes.push(osc);
    });
  });

  const air = c.createBufferSource();
  air.buffer = noiseBuffer(c, 3);
  air.loop = true;
  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 1400;
  band.Q.value = 0.6;
  const airGain = c.createGain();
  airGain.gain.value = 0.05;
  air.connect(band).connect(airGain).connect(out);
  air.start();
  nodes.push(air);

  filter.connect(out).connect(bus!);
  return {
    stop() {
      out.gain.setTargetAtTime(0, c.currentTime, 0.4);
      window.setTimeout(() => nodes.forEach((n) => n.stop()), 1800);
    },
  };
}

function start() {
  const c = ensureContext();
  if (!c || !master) return;
  master.gain.cancelScheduledValues(c.currentTime);
  master.gain.setTargetAtTime(1, c.currentTime, 0.4);
  if (!ambient) ambient = makeAmbient(c);
}

function stop() {
  if (!ctx || !master) return;
  master.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
  ambient?.stop();
  ambient = null;
}

/** Sonidos de interfaz (solo si el sonido está activo y ya hubo un gesto). */
export function sfx(kind: 'hover' | 'click' | 'whoosh') {
  if (!enabled || !ctx || ctx.state !== 'running' || !bus) return;
  const c = ctx;
  const now = c.currentTime;
  const g = c.createGain();
  g.connect(bus);
  if (kind === 'hover') {
    if (now - lastHover < 0.08) return;
    lastHover = now;
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1180, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.09);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.03, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(g);
    osc.start(now);
    osc.stop(now + 0.18);
    return;
  }
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, kind === 'click' ? 0.06 : 0.7);
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = kind === 'click' ? 1.2 : 0.8;
  if (kind === 'click') {
    f.frequency.value = 2600;
    g.gain.setValueAtTime(0.12, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
  } else {
    f.frequency.setValueAtTime(300, now);
    f.frequency.exponentialRampToValueAtTime(2600, now + 0.55);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.09, now + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
  }
  src.connect(f).connect(g);
  src.start(now);
}

export function initSound() {
  const button = document.querySelector<HTMLButtonElement>('[data-sound-toggle]');
  if (!button) return;
  try {
    enabled = localStorage.getItem(KEY) === 'on';
  } catch {
    enabled = false;
  }
  const sync = () => {
    button.setAttribute('aria-pressed', String(enabled));
    document.documentElement.dataset.sound = enabled ? 'on' : 'off';
  };
  sync();

  button.addEventListener('click', () => {
    enabled = !enabled;
    try {
      localStorage.setItem(KEY, enabled ? 'on' : 'off');
    } catch {
      /* sin almacenamiento: dura esta visita */
    }
    if (enabled) start();
    else stop();
    sync();
  });

  if (enabled) {
    // Política de autoplay: el primer gesto en la página reactiva el sonido.
    const resume = () => {
      if (enabled) start();
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('keydown', resume);
    };
    window.addEventListener('pointerdown', resume);
    window.addEventListener('keydown', resume);
  }

  document.addEventListener('click', (e) => {
    const target = (e.target as Element | null)?.closest('a, button');
    if (!target || target === button) return;
    const a = target as HTMLAnchorElement;
    const internal = a.tagName === 'A' && a.origin === location.origin && !a.hash && a.target !== '_blank';
    sfx(internal ? 'whoosh' : 'click');
  });
}
