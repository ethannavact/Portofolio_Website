// Capa WebGL compartida: un solo canvas fijo detrás del contenido.
//  1) Fondo: shader muy sutil (y la imagen del proyecto en foco, desenfocada).
//  2) Planos: cada imagen marcada con [data-gl-media] se redibuja en WebGL para poder
//     desenfocarla, deformarla con lente y curvarla con el scroll. El <img> real
//     sigue en el DOM (accesible, indexable) y solo se oculta visualmente.
// Sin WebGL, o con el movimiento apagado, el sitio se ve igual que sin esta capa.
import {
  ClampToEdgeWrapping,
  ColorManagement,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  LinearSRGBColorSpace,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Texture,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';
import { gsap } from 'gsap';
import { bgFrag, compFrag, planeFrag, planeVert, quadVert } from './shaders';
import { clamp, isMotion, root, state, type EngineApi } from '../core';

ColorManagement.enabled = false;

const BG_SCALE = 1 / 3;
const MAX_DPR = 1.75;

type U<T> = { value: T };

/** Convierte cualquier color CSS a RGB 0–1 (usa el parser del navegador). */
const parseColor = (() => {
  const ctx = document.createElement('canvas').getContext('2d');
  return (css: string, fallback: Vector3) => {
    if (!ctx || !css.trim()) return fallback.clone();
    ctx.fillStyle = '#000';
    ctx.fillStyle = css.trim();
    const v = ctx.fillStyle;
    if (v.startsWith('#')) {
      const n = parseInt(v.slice(1), 16);
      return new Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
    }
    const m = v.match(/[\d.]+/g);
    return m ? new Vector3(+m[0] / 255, +m[1] / 255, +m[2] / 255) : fallback.clone();
  };
})();

const imgReady = (img: HTMLImageElement) =>
  img.complete && img.naturalWidth
    ? Promise.resolve()
    : new Promise<void>((resolve, reject) => {
        img.addEventListener('load', () => resolve(), { once: true });
        img.addEventListener('error', () => reject(new Error('img')), { once: true });
      });

class Plane {
  el: HTMLElement;
  img: HTMLImageElement;
  mesh: Mesh;
  u: Record<string, U<any>>;
  ready = false;
  pending = false;
  visible = false;
  hoverEl: HTMLElement;
  clipEl: HTMLElement | null;
  dimTarget = 0;
  defocus = 0;
  zoomRest: number;
  /** 0 = idéntico al <img> (sin zoom, parallax ni desenfoque); 1 = estado normal. */
  settle = 1;

  constructor(private engine: Engine, el: HTMLElement, img: HTMLImageElement) {
    this.el = el;
    this.img = img;
    this.hoverEl = (el.closest('a, [data-gl-hover]') as HTMLElement) ?? el;
    this.clipEl = el.closest('[data-gl-clip]');
    this.zoomRest = el.hasAttribute('data-gl-still') ? 1.0 : 1.07;
    this.u = {
      uTex: { value: engine.blank },
      uPlane: { value: new Vector2(1, 1) },
      uImage: { value: new Vector2(1, 1) },
      uReveal: { value: 0 },
      uHover: { value: 0 },
      uMouse: { value: new Vector2(0.5, 0.5) },
      uVelocity: { value: 0 },
      uParallax: { value: 0 },
      uDefocus: { value: 0 },
      uDim: { value: 0 },
      uAlpha: { value: 0 },
      uZoom: { value: this.zoomRest },
      uClip: { value: new Vector4(-1e5, -1e5, 1e5, 1e5) },
      uViewH: engine.viewH,
      uDpr: engine.dprU,
      uRadius: { value: parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0 },
    };
    this.mesh = new Mesh(
      engine.planeGeo,
      new ShaderMaterial({
        vertexShader: planeVert,
        fragmentShader: planeFrag,
        uniforms: this.u,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    engine.scene.add(this.mesh);

    // Sin hover donde las imágenes pasan solas bajo el cursor (la ruleta): ahí el efecto se
    // disparaba al hacer scroll y movía la imagen unos píxeles de golpe.
    if (!el.closest('[data-gl-nohover]')) {
      this.hoverEl.addEventListener('pointerenter', this.onEnter);
      this.hoverEl.addEventListener('pointerleave', this.onLeave);
      this.hoverEl.addEventListener('pointermove', this.onMove);
    }
    this.load();
  }

  private onEnter = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    // El punto de la lente arranca donde está el cursor (no donde quedó la última vez).
    gsap.killTweensOf(this.u.uMouse.value);
    this.u.uMouse.value.copy(this.pointerUv(e));
    gsap.to(this.u.uHover, { value: 1, duration: 0.9, ease: 'expo.out', overwrite: true });
  };
  private onLeave = () => gsap.to(this.u.uHover, { value: 0, duration: 0.9, ease: 'expo.out', overwrite: true });
  private pointerUv(e: PointerEvent) {
    const r = this.el.getBoundingClientRect();
    return new Vector2(clamp((e.clientX - r.left) / r.width, 0, 1), clamp(1 - (e.clientY - r.top) / r.height, 0, 1));
  }
  private onMove = (e: PointerEvent) => {
    const { x, y } = this.pointerUv(e);
    gsap.to(this.u.uMouse.value, {
      x,
      y,
      duration: 0.6,
      ease: 'power3.out',
      overwrite: true,
    });
  };

  private async load() {
    try {
      await imgReady(this.img);
      const tex = await this.engine.textureFromImage(this.img, 1600);
      this.u.uTex.value = tex;
      this.u.uImage.value.set((tex.image as { width: number }).width, (tex.image as { height: number }).height);
      // El relevo espera a que el canvas termine de aparecer (si no, la imagen se vería
      // a media opacidad durante el fundido del canvas).
      await this.engine.shown;
      this.ready = true;
      const r = this.el.getBoundingClientRect();
      const inView = r.bottom > 0 && r.top < innerHeight && r.width > 0;
      if (inView) {
        // Ya está en pantalla: relevo invisible. El plano empieza idéntico al <img>
        // y después se asienta suave en su estado normal (zoom, parallax, foco).
        this.u.uReveal.value = 1;
        this.settle = 0;
        this.mesh.visible = this.engine.planesOn;
        gsap.to(this.u.uAlpha, {
          value: 1,
          duration: 0.4,
          onComplete: () => {
            if (this.engine.planesOn) this.el.classList.add('is-gl');
            gsap.to(this, { settle: 1, duration: 1.6, ease: 'power2.inOut' });
          },
        });
      } else {
        this.u.uAlpha.value = 1;
        this.pending = true;
        if (this.engine.planesOn) this.el.classList.add('is-gl');
      }
    } catch {
      /* Imagen rota o sin soporte: se queda el <img> del DOM. */
    }
  }

  reveal() {
    if (!this.pending || !this.ready) return;
    this.pending = false;
    gsap.fromTo(this.u.uReveal, { value: 0 }, { value: 1, duration: 1.8, ease: 'expo.out' });
  }

  update(vh: number, velocity: number) {
    const r = this.el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;
    this.mesh.position.set(r.left + r.width / 2, -(r.top + r.height / 2), 0);
    this.mesh.scale.set(r.width, r.height, 1);
    this.u.uPlane.value.set(r.width, r.height);
    this.u.uVelocity.value = velocity * this.settle;
    this.u.uZoom.value = 1 + (this.zoomRest - 1) * this.settle;
    const c = r.top + r.height / 2;
    this.u.uParallax.value = clamp((c - vh / 2) / (vh / 2 + r.height / 2), -1, 1);
    const d = Math.abs(c - vh / 2) / (vh / 2);
    this.defocus += (clamp((d - 0.6) / 0.7, 0, 1) - this.defocus) * 0.15;
    this.u.uDefocus.value = this.defocus * this.settle;
    this.u.uDim.value += (this.dimTarget - this.u.uDim.value) * 0.09;
    if (this.clipEl) {
      const k = this.clipEl.getBoundingClientRect();
      this.u.uClip.value.set(k.left, k.top, k.right, k.bottom);
    }
  }

  setActive(on: boolean) {
    if (!this.ready) return;
    this.el.classList.toggle('is-gl', on);
    if (!on) this.mesh.visible = false;
    if (on) {
      this.u.uReveal.value = 1;
      this.settle = 0;
      gsap.to(this, { settle: 1, duration: 1.6, ease: 'power2.inOut', overwrite: true });
    }
  }
}

class Engine implements EngineApi {
  ready = false;
  renderer: WebGLRenderer;
  scene = new Scene();
  bgScene = new Scene();
  camera: OrthographicCamera;
  bgRT: WebGLRenderTarget;
  planeGeo = new PlaneGeometry(1, 1, 24, 24);
  blank: DataTexture;
  viewH: U<number> = { value: innerHeight };
  /** Tamaño real del canvas en px CSS. No es innerWidth: en Windows la barra de scroll le
   *  quita ~15 px y, con innerWidth, todo el WebGL se dibujaba comprimido y corrido a la
   *  izquierda; las imágenes brincaban unos px de derecha a izquierda al pasar del <img> al WebGL. */
  viewW = innerWidth;
  dprU: U<number> = { value: 1 };
  planes: Plane[] = [];
  planesWanted: boolean;
  planesOn: boolean;
  private markShown: () => void = () => {};
  /** Se resuelve cuando el canvas ya es completamente visible. */
  shown = new Promise<void>((resolve) => (this.markShown = resolve));
  motion: boolean;
  dirty = true;

  bgU: Record<string, U<any>>;
  compU: Record<string, U<any>>;
  private mouse = new Vector2(0.5, 0.5);
  private mouseTarget = new Vector2(0.5, 0.5);
  private mouseAmt = 0;
  private mouseAmtTarget = 0;
  private textures = new Map<string, Promise<Texture>>();
  private pv: { plane: Mesh; u: Record<string, U<any>>; pos: Vector2; src: string | null } | null = null;
  private observer: IntersectionObserver;
  private revealer: IntersectionObserver;

  constructor(canvas: HTMLCanvasElement, opts: { planes: boolean }) {
    this.renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = LinearSRGBColorSpace;
    this.camera = new OrthographicCamera(0, innerWidth, 0, -innerHeight, -100, 100);
    this.bgRT = new WebGLRenderTarget(1, 1, { depthBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter });
    this.blank = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, RGBAFormat);
    this.blank.needsUpdate = true;
    this.motion = isMotion();
    this.planesWanted = opts.planes;
    this.planesOn = opts.planes && this.motion;

    const base = new Vector3(0.95, 0.95, 0.94);
    this.bgU = {
      uTime: { value: 0 },
      uRes: { value: new Vector2(1, 1) },
      uMouse: { value: this.mouse },
      uMouseAmt: { value: 0 },
      uVel: { value: 0 },
      uBg: { value: base.clone() },
      uTone: { value: base.clone() },
      uGlow: { value: base.clone() },
      uFocusA: { value: this.blank },
      uFocusB: { value: this.blank },
      uSizeA: { value: new Vector2(1, 1) },
      uSizeB: { value: new Vector2(1, 1) },
      uFocus: { value: 0 },
      uMix: { value: 0 },
      uLens: { value: 0 },
    };
    const bgQuad = new Mesh(new PlaneGeometry(2, 2), new ShaderMaterial({ vertexShader: quadVert, fragmentShader: bgFrag, uniforms: this.bgU, depthTest: false, depthWrite: false }));
    bgQuad.frustumCulled = false;
    this.bgScene.add(bgQuad);

    this.compU = {
      uBgTex: { value: this.bgRT.texture },
      uTime: { value: 0 },
      uGrain: { value: 0.022 },
      uRes: { value: new Vector2(1, 1) },
    };
    const comp = new Mesh(new PlaneGeometry(2, 2), new ShaderMaterial({ vertexShader: quadVert, fragmentShader: compFrag, uniforms: this.compU, depthTest: false, depthWrite: false }));
    comp.frustumCulled = false;
    comp.renderOrder = -10;
    this.scene.add(comp);

    this.readTheme();
    this.resize();

    this.observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        const p = this.planes.find((x) => x.el === e.target);
        if (p) p.visible = e.isIntersecting;
      }),
      { rootMargin: '30% 0px' },
    );
    this.revealer = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (!e.isIntersecting) return;
        this.planes.find((x) => x.el === e.target)?.reveal();
      }),
      { threshold: 0.12 },
    );
    if (opts.planes) this.collectPlanes();

    window.addEventListener('resize', () => this.resize());
    // La barra de scroll puede aparecer o irse sin que cambie la ventana.
    new ResizeObserver(() => this.resize()).observe(canvas);
    window.addEventListener('pointermove', (e) => {
      this.mouseTarget.set(e.clientX / this.viewW, 1 - e.clientY / this.viewH.value);
      this.mouseAmtTarget = 1;
      if (this.pv) this.pv.pos.set(e.clientX, e.clientY);
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => (this.mouseAmtTarget = 0));
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => requestAnimationFrame(() => this.readTheme()));
    new MutationObserver(() => this.readTheme()).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('pageswap', () => root.classList.add('gl-snapshot'));
    window.addEventListener('pageshow', () => root.classList.remove('gl-snapshot'));

    // Compila los shaders sin bloquear cuando el navegador lo permite
    // (KHR_parallel_shader_compile); si no, en una tarea aparte. Luego aparece.
    const r = this.renderer;
    const compiled = r.extensions.has('KHR_parallel_shader_compile')
      ? Promise.all([r.compileAsync(this.bgScene, this.camera), r.compileAsync(this.scene, this.camera)])
      : new Promise<void>((resolve) =>
          window.setTimeout(() => {
            r.compile(this.bgScene, this.camera);
            r.compile(this.scene, this.camera);
            resolve();
          }, 0),
        );
    compiled
      .catch(() => {})
      .then(() => {
        this.ready = true;
        this.renderFrame(0);
        root.classList.add('gl-on');
        // El canvas aparece con un fundido de 0.9 s (base.css).
        window.setTimeout(this.markShown, 950);
      });
  }

  private collectPlanes() {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-gl-media]'));
    // Una imagen por tarea: subir texturas grandes de golpe bloquearía el hilo principal.
    const next = () => {
      const el = els.shift();
      if (!el) return;
      const img = el.querySelector('img');
      if (img) {
        const plane = new Plane(this, el, img);
        this.planes.push(plane);
        this.observer.observe(el);
        this.revealer.observe(el);
      }
      window.setTimeout(next, 16);
    };
    next();
  }

  private readTheme() {
    const cs = getComputedStyle(root);
    const bg = parseColor(cs.getPropertyValue('--bg'), new Vector3(0.95, 0.95, 0.94));
    const fg = parseColor(cs.getPropertyValue('--fg'), new Vector3(0.08, 0.08, 0.08));
    const surface = parseColor(cs.getPropertyValue('--surface'), bg);
    this.bgU.uBg.value.copy(bg);
    this.bgU.uTone.value.copy(bg).lerp(fg, 0.04);
    this.bgU.uGlow.value.copy(bg).lerp(surface, 0.95);
    const dark = bg.x + bg.y + bg.z < 1.2;
    this.compU.uGrain.value = dark ? 0.03 : 0.022;
    this.dirty = true;
  }

  resize() {
    const el = this.renderer.domElement;
    const w = el.clientWidth || innerWidth;
    const h = el.clientHeight || innerHeight;
    this.viewW = w;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.bgRT.setSize(Math.max(2, Math.ceil(w * BG_SCALE)), Math.max(2, Math.ceil(h * BG_SCALE)));
    this.camera.right = w;
    this.camera.bottom = -h;
    this.camera.updateProjectionMatrix();
    this.bgU.uRes.value.set(w, h);
    this.compU.uRes.value.set(w * dpr, h * dpr);
    this.viewH.value = h;
    this.dprU.value = dpr;
    this.dirty = true;
  }

  /** Textura desde un <img> ya cargado; reduce su tamaño fuera del hilo principal si se puede. */
  async textureFromImage(img: HTMLImageElement, max: number): Promise<Texture> {
    let source: HTMLImageElement | ImageBitmap = img;
    let flipY = true;
    try {
      await img.decode();
      const scale = Math.min(1, max / img.naturalWidth);
      source = await createImageBitmap(img, {
        imageOrientation: 'flipY',
        resizeWidth: Math.round(img.naturalWidth * scale),
        resizeHeight: Math.round(img.naturalHeight * scale),
        resizeQuality: 'high',
      });
      flipY = false;
    } catch {
      source = img;
    }
    const tex = new Texture(source as any);
    tex.flipY = flipY;
    tex.generateMipmaps = true;
    tex.minFilter = LinearMipmapLinearFilter;
    tex.magFilter = LinearFilter;
    tex.wrapS = tex.wrapT = ClampToEdgeWrapping;
    tex.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    tex.needsUpdate = true;
    this.renderer.initTexture(tex);
    return tex;
  }

  private texture(src: string): Promise<Texture> {
    let p = this.textures.get(src);
    if (!p) {
      p = new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        // Las imágenes del estudio vienen de otro origen: sin CORS, WebGL no puede usarlas.
        img.crossOrigin = 'anonymous';
        img.decoding = 'async';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      }).then((img) => this.textureFromImage(img, 640));
      this.textures.set(src, p);
    }
    return p;
  }

  preview(src: string | null) {
    if (!this.planesOn) return;
    if (!this.pv) {
      const u: Record<string, U<any>> = {
        uTex: { value: this.blank },
        uPlane: { value: new Vector2(320, 200) },
        uImage: { value: new Vector2(16, 10) },
        uReveal: { value: 0 },
        uHover: { value: 0 },
        uMouse: { value: new Vector2(0.5, 0.5) },
        uVelocity: { value: 0 },
        uParallax: { value: 0 },
        uDefocus: { value: 0 },
        uDim: { value: 0 },
        uAlpha: { value: 1 },
        uZoom: { value: 1 },
        uClip: { value: new Vector4(-1e5, -1e5, 1e5, 1e5) },
        uViewH: this.viewH,
        uDpr: this.dprU,
        uRadius: { value: 6 },
      };
      const plane = new Mesh(this.planeGeo, new ShaderMaterial({ vertexShader: planeVert, fragmentShader: planeFrag, uniforms: u, transparent: true, depthTest: false, depthWrite: false }));
      plane.renderOrder = 10;
      plane.frustumCulled = false;
      plane.visible = false;
      this.scene.add(plane);
      this.pv = { plane, u, pos: new Vector2(innerWidth / 2, innerHeight / 2), src: null };
    }
    const pv = this.pv;
    pv.src = src;
    if (!src) {
      gsap.to(pv.u.uReveal, { value: 0, duration: 0.5, ease: 'power2.out', overwrite: true, onComplete: () => !pv.src && (pv.plane.visible = false) });
      return;
    }
    this.texture(src).then((tex) => {
      if (pv.src !== src) return;
      pv.u.uTex.value = tex;
      pv.u.uImage.value.set((tex.image as { width: number }).width, (tex.image as { height: number }).height);
      if (!pv.plane.visible) {
        // Aparece junto al cursor (sin cruzar la pantalla desde la esquina).
        const w = Math.min(380, innerWidth * 0.26);
        pv.plane.position.set(pv.pos.x + w * 0.55, -pv.pos.y, 0);
      }
      pv.plane.visible = true;
      gsap.to(pv.u.uReveal, { value: 1, duration: 1.1, ease: 'expo.out', overwrite: true });
    });
  }

  setMotion(on: boolean) {
    this.motion = on;
    this.planesOn = on && this.planesWanted;
    this.planes.forEach((p) => p.setActive(on));
    this.dirty = true;
  }

  private last = 0;

  render(time: number) {
    if (!this.ready) return;
    if (!this.motion && !this.dirty) return;
    this.renderFrame(time);
  }

  private renderFrame(time: number) {
    this.dirty = false;
    const vh = this.viewH.value;
    const v = this.motion ? state.velocity : 0;
    this.mouse.lerp(this.mouseTarget, this.motion ? 0.06 : 1);
    this.mouseAmt += (this.mouseAmtTarget - this.mouseAmt) * (this.motion ? 0.04 : 1);
    this.bgU.uMouseAmt.value = this.mouseAmt;
    this.bgU.uTime.value = this.motion ? time : 40;
    this.bgU.uVel.value = v;
    this.compU.uTime.value = this.motion ? time : 0;

    if (this.planesOn) {
      for (const p of this.planes) {
        if (p.ready && p.visible) p.update(vh, v);
        else p.mesh.visible = false;
      }
    }
    if (this.pv?.plane.visible) {
      const pv = this.pv;
      const w = Math.min(380, innerWidth * 0.26);
      const h = w * 0.625;
      const cur = pv.plane.position;
      const tx = pv.pos.x + w * 0.55;
      const ty = -(pv.pos.y);
      cur.x += (tx - cur.x) * 0.12;
      cur.y += (ty - cur.y) * 0.12;
      if (Math.abs(time - this.last) > 1) {
        cur.x = tx;
        cur.y = ty;
      }
      pv.plane.scale.set(w, h, 1);
      pv.u.uPlane.value.set(w, h);
      pv.u.uVelocity.value = clamp((tx - cur.x) / 400, -1, 1);
    }
    this.last = time;

    this.renderer.setRenderTarget(this.bgRT);
    this.renderer.render(this.bgScene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
  }
}

export function createEngine(canvas: HTMLCanvasElement, opts: { planes: boolean }): EngineApi {
  return new Engine(canvas, opts);
}
