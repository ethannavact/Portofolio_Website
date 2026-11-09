// Reel de la Home: corre en loop, mudo, de fondo (cuando el movimiento está activo),
// y se abre completo con sonido en un diálogo. Siempre se puede pausar (WCAG 2.2.2).
// Fuente: el MP4 subido al estudio (R2) si existe; si no, YouTube.
import { isMotion, onIdle, state } from './core';

const YT_ORIGIN = 'https://www.youtube-nocookie.com';

const ytSrc = (id: string, bg: boolean) => {
  const p = new URLSearchParams({
    autoplay: '1',
    rel: '0',
    playsinline: '1',
    modestbranding: '1',
    iv_load_policy: '3',
    enablejsapi: '1',
    origin: location.origin,
  });
  if (bg) {
    p.set('mute', '1');
    p.set('loop', '1');
    p.set('playlist', id);
    p.set('controls', '0');
    p.set('disablekb', '1');
  }
  return `${YT_ORIGIN}/embed/${encodeURIComponent(id)}?${p}`;
};

/** HD en pantallas grandes; SD en teléfonos o con ahorro de datos. */
const bySize = (hd?: string, sd?: string) => {
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  const small = saveData || window.innerWidth * Math.min(window.devicePixelRatio || 1, 2) < 1600;
  return (small ? sd || hd : hd || sd) || '';
};

const command = (iframe: HTMLIFrameElement | null, func: 'playVideo' | 'pauseVideo') =>
  iframe?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args: [] }), YT_ORIGIN);

export function initReel() {
  const section = document.querySelector<HTMLElement>('[data-reel]');
  if (!section) return;
  const id = section.dataset.yt ?? '';
  const bgBox = section.querySelector<HTMLElement>('[data-reel-bg]');
  const toggle = section.querySelector<HTMLButtonElement>('[data-reel-toggle]');
  const openBtn = section.querySelector<HTMLAnchorElement>('[data-reel-open]');
  const dialog = section.querySelector<HTMLDialogElement>('[data-reel-dialog]');
  const player = section.querySelector<HTMLElement>('[data-reel-player]');
  const closeBtn = section.querySelector<HTMLButtonElement>('[data-reel-close]');
  const preview = section.dataset.preview === 'true';
  const fileFull = bySize(section.dataset.fileHd, section.dataset.fileSd);
  const fileLoop = bySize(section.dataset.loopHd, section.dataset.loopSd);
  let bgFrame: HTMLIFrameElement | null = null;
  let bgVideo: HTMLVideoElement | null = null;
  let heard = false; // YouTube respondió: el reproductor existe y acepta comandos
  let shown = false; // YouTube confirmó que reproduce: el video ya se ve
  let userPaused = false;
  let visible = true;
  let playing = false;

  const renderToggle = () => {
    if (!toggle) return;
    toggle.hidden = !shown;
    toggle.setAttribute('aria-pressed', String(playing));
    toggle.textContent = playing ? (toggle.dataset.labelPause ?? '') : (toggle.dataset.labelPlay ?? '');
  };

  const setPlaying = (on: boolean) => {
    if (bgVideo) {
      if (on) bgVideo.play().catch(() => {});
      else bgVideo.pause();
    } else {
      if (!bgFrame || !heard) return;
      command(bgFrame, on ? 'playVideo' : 'pauseVideo');
    }
    playing = on;
    renderToggle();
  };

  const update = () => {
    if (!bgFrame && !bgVideo) return;
    const should = visible && isMotion() && !userPaused && !dialog?.open;
    if (should !== playing) setPlaying(should);
    bgBox?.classList.toggle('is-hidden', !isMotion());
  };

  // Loop de fondo desde el MP4 del estudio: mudo, sin controles, solo se muestra cuando ya corre.
  const mountFileBackground = () => {
    if (!bgBox) return;
    const video = document.createElement('video');
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('aria-hidden', 'true');
    video.tabIndex = -1;
    video.src = fileLoop;
    video.addEventListener('playing', () => {
      if (shown) return;
      shown = true;
      bgBox.classList.add('is-playing');
      renderToggle();
    });
    bgBox.append(video);
    bgVideo = video;
    heard = true;
    playing = false;
    update();
  };

  const mountBackground = () => {
    if (bgFrame || bgVideo || !bgBox || preview || !isMotion()) return;
    if (fileLoop) return mountFileBackground();
    if (!id) return;
    const iframe = document.createElement('iframe');
    iframe.src = ytSrc(id, true);
    iframe.title = section.dataset.title ?? 'Reel';
    iframe.allow = 'autoplay; encrypted-media';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.tabIndex = -1;
    bgBox.append(iframe);
    bgFrame = iframe;
    playing = true;
    // Solo se muestra cuando YouTube confirma que reproduce. Si YouTube está bloqueado
    // o no carga, se queda el póster (nunca una página de error encima).
    window.addEventListener('message', (e) => {
      if (e.origin !== YT_ORIGIN || e.source !== iframe.contentWindow || typeof e.data !== 'string') return;
      if (!heard) {
        heard = true;
        update();
      }
      try {
        const data = JSON.parse(e.data);
        if (data?.info?.playerState === 1 && !shown) {
          shown = true;
          bgBox.classList.add('is-playing');
          renderToggle();
        }
      } catch {
        /* mensajes ajenos */
      }
    });
    // Saludo del protocolo de la API de YouTube; se repite hasta que responda (máx. ~1 s).
    iframe.addEventListener(
      'load',
      () => {
        let tries = 0;
        const hello = () => {
          if (heard || tries++ > 4) return;
          iframe.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 'reel' }), YT_ORIGIN);
          window.setTimeout(hello, 250);
        };
        hello();
      },
      { once: true },
    );
  };

  toggle?.addEventListener('click', () => {
    userPaused = playing;
    setPlaying(!playing);
  });

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    update();
  }, { threshold: 0.05 }).observe(section);

  document.addEventListener('motionchange', () => {
    if (isMotion()) mountBackground();
    update();
  });

  // Reel completo con sonido.
  // Sin diálogo, sin id o en el preview publicado (no admite iframes): el enlace abre YouTube.
  openBtn?.addEventListener('click', (event) => {
    if (!dialog || !player || preview || (!fileFull && !id)) return;
    event.preventDefault();
    if (fileFull) {
      const video = document.createElement('video');
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      if (section.dataset.poster) video.poster = section.dataset.poster;
      video.src = fileFull;
      player.replaceChildren(video);
      dialog.showModal();
      state.lenis?.stop();
      update();
      video.play().catch(() => {});
      closeBtn?.focus();
      return;
    }
    const iframe = document.createElement('iframe');
    iframe.src = ytSrc(id, false);
    iframe.title = section.dataset.title ?? 'Reel';
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    player.replaceChildren(iframe);
    dialog.showModal();
    state.lenis?.stop();
    update();
    closeBtn?.focus();
  });
  closeBtn?.addEventListener('click', () => dialog?.close());
  dialog?.addEventListener('click', (e) => e.target === dialog && dialog.close());
  dialog?.addEventListener('close', () => {
    player?.replaceChildren();
    state.lenis?.start();
    update();
    openBtn?.focus();
  });

  // El video pesa: se monta cuando la página ya cargó y el navegador está libre.
  const later = () => onIdle(mountBackground, 2500);
  if (document.readyState === 'complete') later();
  else window.addEventListener('load', later, { once: true });
}
