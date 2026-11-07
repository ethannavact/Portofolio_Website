// En local (npm run dev) se muestran borradores y marcadores de media pendiente; en producción nunca.
// El preview publicado (PUBLIC_PREVIEW=true) los muestra salvo que PUBLIC_PREVIEW_DRAFTS=false:
// así se puede publicar una vista previa idéntica a producción.
export const IS_PREVIEW = import.meta.env.PUBLIC_PREVIEW === 'true';

export const SHOW_DRAFTS = import.meta.env.DEV || (IS_PREVIEW && import.meta.env.PUBLIC_PREVIEW_DRAFTS !== 'false');
