# Ethan Nava — sitio y portafolio

Astro 7 (sitio estático) · ES/EN · listo para Cloudflare Pages.
Los **proyectos** vienen del [Estudio de contenido](../ethan-estudio) (proyecto aparte, sirve para cualquier versión de la web). Servicios, Home e Info se editan aquí con Keystatic.
La base es neutra a propósito: la dirección de arte entra por `src/styles/tokens.css` y la capa generativa, sin tocar contenido ni estructura.

## Arranque

Requiere Node 22.12 o superior.

1. Abre el estudio. En la carpeta `ethan-estudio`, en una terminal:

   ```bash
   npm run estudio
   ```

2. Abre el sitio. En esta carpeta, en otra terminal:

   ```bash
   npm install   # solo la primera vez
   npm run dev
   ```

- Sitio: http://127.0.0.1:4321. Cuando guardas en el estudio, se actualiza solo.
- Editor de servicios, Home e Info: http://127.0.0.1:4321/keystatic
- Si el estudio está cerrado, el sitio usa el último export (`../ethan-estudio/dist/`) y avisa que las imágenes no se verán.

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Sitio + editor en local. Muestra borradores y marcadores de media pendiente. |
| `npm run build` | Build de producción en `dist/`. Solo publicados, sin marcadores. |
| `npm run preview` | Sirve `dist/` para revisarlo como quedará publicado. |
| `npm run build:preview` | Build de revisión en `dist-preview/` con borradores y rutas relativas (para compartir sin publicar). |
| `npm run check` | Revisa tipos y que todo el contenido cumpla el esquema. |
| `npm run test:a11y` | Auditoría axe (WCAG 2.2 AA) contra `npm run preview`. Usa tu Chrome o Edge. |

## Contenido

| Qué | Dónde se edita | Archivo |
| --- | --- | --- |
| Proyectos (textos, imágenes, videos, galería) | **Estudio de contenido** | `ethan-estudio/content/projects/<slug>.json` |
| Servicios | Keystatic | `src/content/services/<slug>.yaml` |
| Sitio y Home (incluye el reel) | Keystatic | `src/content/singletons/site.yaml` |
| Info y trayectoria | Keystatic | `src/content/singletons/about.yaml` |

`src/lib/studio.ts` adapta el contenido del estudio al esquema del sitio. Las vistas no saben de dónde viene.

Reglas de un proyecto (se marcan en el estudio):

- **Publicado** apagado = borrador: no existe en producción; en local y en la vista previa aparece marcado.
- **Destacado en la Home**: se muestran hasta 4, en el orden del índice.
- **Orden**: menor número primero; empates por año más reciente.
- **Tipo**: Producido, Pitch / Concepto o Personal (se muestra como etiqueta).
- **Campos bilingües**: si el inglés está vacío, se muestra el español.
- **Notas internas** y **Pendientes por confirmar** nunca se publican.
- **Slug** = URL del caso: `/trabajo/<slug>/` y `/en/work/<slug>/`. Cambiarlo cambia la URL.

La página de cada caso se arma con bloques: Texto, Imagen, Video, Galería / carrusel, Imagen + texto, Cifras, Proceso / breakdown, Lista y Cita. Un espacio de media pendiente se ve como marcador con su nota en local; en producción se omite solo. Al final de cada caso salen el siguiente caso y hasta 3 **proyectos similares** (los calcula el estudio).

### Servicios

Cada servicio tiene su página (`/servicios/<slug>/`, `/en/services/<slug>/`) con frase corta, introducción, ejemplos, qué incluye, cuándo tiene sentido y cómo trabajo. Los **Ejemplos** se eligen en el campo "Ejemplos (proyectos)" de Keystatic (la lista sale del estudio) y se muestran como tarjetas en ese orden; los borradores no aparecen en producción. Cada caso enlaza de vuelta a los servicios que lo usan como ejemplo. La Home lista todos los servicios publicados.

### Galería

`/galeria/` (`/en/gallery/`) se arma sola: muestra toda imagen marcada con **★** en el estudio, de cualquier proyecto publicado, en el orden del índice. Al dar clic se abre un visor a pantalla completa con flechas del teclado, y cada still enlaza a su caso.

Flujo para publicar:
- **Proyectos:** en el estudio, Publicar en línea. Si configuraste el Deploy Hook, Cloudflare reconstruye solo.
- **Servicios, Home e Info:** edita en Keystatic → commit + push → Cloudflare reconstruye.

### Imágenes y video

- **Imágenes y videos de proyectos**: se suben en el estudio, que los optimiza (WebP en 4 tamaños; MP4 HD/SD con póster). El sitio los usa tal cual, con `crossorigin` para WebGL. Cada imagen lleva su texto alternativo en ES/EN.
- **Imágenes propias del sitio** (póster del reel, marcadores): las optimiza Astro en WebP (AVIF se descartó: multiplicaba el tiempo de build por diez).
- **Media pendiente**: en local y en la vista previa, un hueco sin imagen se llena con una imagen abstracta de `src/assets/placeholders/` (para ver los efectos sobre algo real). En producción no aparece.
- **YouTube / Vimeo**: solo el ID. El reproductor se carga hasta que alguien da clic (fachada ligera; YouTube va por youtube-nocookie).
- **Reel de la Home** (Keystatic → Sitio y Home → Reel): ID de YouTube + póster. Es la primera sección: corre mudo de fondo cuando la página ya cargó y abre el reel completo con sonido en un diálogo. El loop solo aparece cuando YouTube confirma que reproduce; si YouTube está bloqueado o no carga, se queda el póster.
- **Archivo propio**: loops mudos sin controles; solo corren en pantalla y con movimiento activado. Cloudflare Pages no sirve archivos de más de 25 MB: los videos pesados van en YouTube/Vimeo o en almacenamiento externo.

## Movimiento e interacción

Todo vive en `src/motion/`. Un solo reloj (GSAP) mueve el scroll suave (Lenis), las animaciones de scroll (ScrollTrigger) y la capa WebGL (Three.js) en el mismo cuadro.

| Archivo | Qué hace |
| --- | --- |
| `index.ts` | Arranque, scroll suave y botón de Movimiento. |
| `scroll.ts` | Entradas con desenfoque, palabras que se enfocan con el scroll, parallax, reel que se aleja, marquee de clientes. |
| `gl/engine.ts`, `gl/shaders.ts` | Canvas WebGL detrás del contenido: fondo sutil, imágenes con lente, desenfoque y curvatura con la velocidad del scroll. |
| `ruleta.ts` | Ruleta de proyectos (Home y Trabajo, componente `Ruleta.astro`): la tira de portadas, el tambor de nombres, el panel izquierdo que cambia con un fundido, los datos de la derecha, el indicador de scroll, los filtros y el imán al soltar el scroll. |
| `case.ts` | Página del caso: el capítulo que cruza el centro de la pantalla se muestra en el panel fijo de la izquierda; la media de cada grupo se queda fija mientras pasan sus capítulos. Los capítulos se arman en `src/lib/chapters.ts`. |
| `preview.ts` | En listas (servicios, índice de Trabajo), una vista previa nítida sigue al cursor. |
| `reel.ts` | Reel de la Home: loop mudo de fondo, botón de pausa y reel completo con sonido en un diálogo. |
| `sound.ts` | Sonido ambiente y de interfaz, apagado por defecto (botón Sonido del header). Procedural, sin archivos. |

Las vistas usan atributos, no código: `data-reveal="lines|fade"`, `data-reveal-group`, `data-scrub-words`, `data-parallax="60"`, `data-drift` y `data-preview-src` (vista previa en listas). Toda imagen de `Media` se dibuja en WebGL (`data-gl-media`); el `<img>` sigue en el DOM.

Rendimiento:

- La capa WebGL (Three.js, 130 KB gzip) se carga con la primera interacción (mover el mouse, scroll, tocar o teclado) y compila sus shaders sin bloquear. La carga inicial solo lleva el script base (28 KB) y GSAP (26 KB).
- Las entradas que están fuera de pantalla se preparan cuando el navegador queda libre.
- El relevo `<img>` → WebGL es invisible: el plano empieza idéntico a la imagen y después se asienta en su estado normal.

Reglas que se respetan siempre:

- Con el botón Movimiento apagado o `prefers-reduced-motion`, no hay scroll suave, ni entradas, ni WebGL animado: el contenido está completo y quieto.
- Sin WebGL (o en teléfonos), las imágenes son las del DOM.
- El texto nunca vive dentro del canvas.

## Marca: dónde entra

`src/styles/tokens.css` es el contrato de marca. Las secciones marcadas `BRAND` son las que se cambian:

- Color: tema claro único, tomado de la referencia (quynh.moe).
- Tipografía (`--font-display`, `--font-body`, `--font-mono`). Provisional: Inter Tight y JetBrains Mono desde Google Fonts (`Base.astro`). Las de marca se autoalojan (`.woff2` en `public/fonts/` + `@font-face`).
- Forma (`--radius`) y movimiento (duraciones y curvas).

Los componentes solo leen tokens, así que cambiar la marca no exige tocarlos.

**Capa generativa** (`src/generative/sketch.ts`): hoy es un ejemplo neutro de retícula de puntos, apagado. Se enciende en Keystatic → Sitio y Home → "Capa generativa en la Home". Puede reemplazarse por Three.js o shaders respetando el contrato que está documentado en el archivo: decorativa, sin información, pausada fuera de pantalla y con el movimiento apagado, DPR ≤ 1.5.

Lo que la marca debe conservar para no romper accesibilidad:

- Contraste AA: 4.5:1 en texto y 3:1 en controles.
- Foco visible en todo lo interactivo.
- Botón de movimiento y respeto a `prefers-reduced-motion`.
- Nada suena solo y todo el texto es texto real.

Después de cambiar tokens, corre `npm run test:a11y`.

## Versión 2 (6 nov 2026)

- Diseño blanco en todo el sitio, como la referencia. Sin el fondo de proyecto al pasar el mouse.
- Ruleta de proyectos en Trabajo (con filtros) y en Trabajo seleccionado de la Home (con «Todo el trabajo»).
- Caso por capítulos: texto fijo a la izquierda, media en retícula a la derecha.
- Datos de contacto (correo, teléfono, Instagram) con botón de copiar: CTA de la Home, Info y pie.
- Stack por grupos (Dirección, Formatos, Técnica), trayectoria corregida y «Para agencias» con copy nuevo.
- Reel: el botón es un enlace real a YouTube; en el sitio abre el diálogo.
- Vista previa igual a producción: `PUBLIC_PREVIEW_DRAFTS=false npm run build:preview` (solo lo publicado y solo su media).

## Estado (21 oct 2026)

- Proyectos desde el estudio (25 oct): 35 migrados, 13 publicados. NIAG quedó como borrador hasta la aprobación de Nike. Producción: 61 páginas.
- axe WCAG 2.2 AA: 0 problemas en 16 páginas × escritorio/móvil × claro/oscuro.
- Lighthouse con la capa de movimiento (móvil simulado, Home, Caso, Servicio y Galería): Rendimiento 93–99 · Accesibilidad 100 · Buenas prácticas 100 · SEO 100 · CLS 0.
- SEO: canonical, hreflang ES/EN, Open Graph, JSON-LD (Person, WebSite, CreativeWork, Service, Breadcrumbs), sitemap y robots.

Contenido cargado desde Notion (Portafolio Master y Portafolio V2): 35 proyectos, 14 publicados y 21 borradores. 12 servicios con ejemplos vinculados; Worldbuilding se basa en The Worldbuilding Playbook 3.1. Las portadas de los 14 publicados están marcadas para la Galería.

Provisional, por decidir:

- Todo el copy (se reescribe con la identidad, pensado para agencias).
- Texto del hero.
- Los 4 destacados.
- Títulos de los borradores.
- Todos los tokens de marca.
- Media: faltan stills de 9 de los 14 publicados (en local se ven imágenes de muestra); el reel ideal es un MP4 mudo de 20–30 s para el fondo.

Cada proyecto trae su lista en "Pendientes por confirmar".

## Publicar en Cloudflare Pages

1. Sube el proyecto a un repositorio de GitHub.
2. En Cloudflare: Workers & Pages → crear un proyecto de Pages conectado a ese repositorio.
3. Ajustes de build:
   - Preset: Astro
   - Comando: `npm run build`
   - Carpeta de salida: `dist`
   - Variable `SITE_URL` con la URL final
   - Variable `STUDIO_CONTENT` con la URL pública de `content.json` del estudio (p. ej. `https://media.tudominio.com/content.json`)
4. Cada push a `main` publica. Las otras ramas generan URLs de preview.

`SITE_URL` alimenta canonical, sitemap y Open Graph. Por defecto es `https://ethan-nava.pages.dev`; cámbiala si el proyecto de Pages se llama distinto o cuando conectes tu dominio. `public/_headers` ya define caché inmutable para `/_astro/*` y encabezados de seguridad. `.github/workflows/ci.yml` corre `check` y `build` en cada push.

### Editor en producción (opcional)

Hoy Keystatic corre solo en tu computadora. Para editar desde el navegador sin abrir el proyecto se cambia el `storage` de `keystatic.config.ts` a modo GitHub y se agrega el adapter de Cloudflare para las rutas `/keystatic`. Es un paso aparte.

## Estructura

```
src/
  content/            servicios y singletons (YAML, Keystatic)
  content.config.ts   esquema del contenido
  lib/studio.ts       lee los proyectos del estudio
  styles/             tokens.css (marca) + base.css
  components/         header, tarjetas, media, bloques
  views/              Home, Trabajo, Caso, Info, 404 (compartidas ES/EN)
  pages/              rutas ES en la raíz, EN bajo /en/
  i18n/               rutas y textos de interfaz
  generative/         capa generativa
keystatic.config.ts   formularios del editor
scripts/              auditoría a11y y build de vista previa
```
