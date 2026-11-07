# Publicar el sitio en línea

Flujo: **Estudio → «Publicar» → R2 (media + content.json) → Deploy Hook → Cloudflare Pages reconstruye el sitio (1–2 min).**
Home, Servicios e Info se editan con Keystatic en local (`npm run dev` → /keystatic) y se publican con `git push`.

Datos de tu cuenta:
- Account ID: `6ff83d6d9d6a10ce96e1a5f032062b4d`
- Bucket: `ethan-portofolio`
- Repo: `ethannavact/Portofolio_Website` (déjalo **privado**: los servicios tienen notas internas)

## 1. R2: acceso público y CORS
1. Cloudflare → R2 → `ethan-portofolio` → **Settings**.
2. **Public Development URL (r2.dev)** → Allow. Copia la URL (`https://pub-….r2.dev`). Más adelante, con dominio propio, usa **Custom Domains** (r2.dev tiene límite de tráfico).
3. **CORS policy** → Add / Edit y pega esto. Es obligatorio: las imágenes y videos se cargan con `crossorigin` para WebGL; sin CORS no se ven.

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 86400
  }
]
```

## 2. R2: token para el estudio
R2 → **Manage API tokens** → Create API token → permiso **Object Read & Write**, solo el bucket `ethan-portofolio`. Copia **Access Key ID** y **Secret Access Key** (el secreto se muestra una sola vez).

## 3. Estudio: `.env`
En la carpeta `ethan-estudio`, abre `.env` (ya viene con Account ID y bucket) y llena:
- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (paso 2)
- `PUBLIC_MEDIA_URL` = la URL r2.dev del paso 1, sin `/` final

Corre el estudio (`npm.cmd run estudio`) y da **Publicar** una vez. Comprueba que abre `https://pub-….r2.dev/content.json`.

## 4. Subir el código a GitHub
Necesitas Git para Windows (https://git-scm.com/download/win). En PowerShell, dentro de `Portofolio_Website`:

```powershell
git push -u origin main
```

La primera vez abre el navegador para iniciar sesión en GitHub. Si el repo ya tenía un commit (README o licencia), usa `git push -u origin main --force` (borra ese commit inicial).

## 5. Cloudflare Pages
1. Workers & Pages → **Create** → pestaña **Pages** → **Connect to Git** → elige `Portofolio_Website`.
2. Nombre del proyecto: `ethan-nava` (si está tomado, otro; ajusta `SITE_URL`).
3. Framework preset: **Astro**. Build command: `npm run build`. Output: `dist`.
4. **Environment variables** (Production):
   - `STUDIO_CONTENT` = `https://pub-….r2.dev/content.json`
   - `SITE_URL` = `https://ethan-nava.pages.dev` (o tu dominio)
5. Save and Deploy. La versión de Node sale de `.node-version` (22).

## 6. Deploy Hook (que «Publicar» reconstruya el sitio)
Pages → proyecto → Settings → Builds → **Deploy hooks** → Add (rama `main`). Copia la URL y pégala en `PAGES_DEPLOY_HOOK` del `.env` del estudio. Reinicia el estudio.

## 7. Prueba
Cambia el orden de un proyecto en el estudio → Publicar → espera 1–2 min → recarga el sitio.

## Opcional
- GitHub Actions (`.github/workflows/ci.yml`) revisa tipos y build en cada push si defines la variable `STUDIO_CONTENT` en el repo (Settings → Secrets and variables → Actions → Variables).
- Dominio propio: Pages → Custom domains, y en R2 → Custom Domains para la media (`media.tudominio.com`); luego actualiza `PUBLIC_MEDIA_URL`, `STUDIO_CONTENT` y `SITE_URL`, y vuelve a Publicar.
