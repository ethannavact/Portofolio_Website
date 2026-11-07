// Auditoría de accesibilidad (axe-core, WCAG 2.2 A/AA) sobre el build de producción.
// Uso:
//   npm run build && npm run preview   (en otra terminal)
//   npm run test:a11y                  (o BASE_URL=https://tu-dominio npm run test:a11y)
// Usa el Chrome o Edge que ya tengas instalado. Si no hay ninguno:
// define CHROME_PATH o corre `npx playwright@1.56.1 install chromium` una vez.
import { chromium } from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';

async function launchBrowser() {
  if (process.env.CHROME_PATH) return chromium.launch({ executablePath: process.env.CHROME_PATH });
  for (const channel of ['chrome', 'msedge']) {
    try {
      return await chromium.launch({ channel });
    } catch {
      // No instalado: probar el siguiente.
    }
  }
  try {
    return await chromium.launch();
  } catch {
    console.error('No encontré Chrome, Edge ni Chromium. Define CHROME_PATH o corre: npx playwright@1.56.1 install chromium');
    process.exit(2);
  }
}

const BASE = process.env.BASE_URL ?? 'http://localhost:4321';
const PAGES = [
  '/',
  '/trabajo/',
  '/info/',
  '/trabajo/dj-silver-heineken/',
  '/trabajo/the-mind-thesis/',
  '/en/',
  '/en/work/',
  '/en/info/',
  '/en/work/utopia-coyoacan/',
  '/servicios/',
  '/servicios/worldbuilding/',
  '/galeria/',
  '/en/services/',
  '/en/services/fooh/',
  '/en/gallery/',
  '/404.html',
];
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];
const SCHEMES = ['light', 'dark'];

const browser = await launchBrowser();
let total = 0;

for (const vp of VIEWPORTS) {
  for (const scheme of SCHEMES) {
    const context = await browser.newContext({ viewport: vp, colorScheme: scheme, reducedMotion: 'reduce' });
    const page = await context.newPage();
    for (const path of PAGES) {
      await page.goto(BASE + path, { waitUntil: 'networkidle' });
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
        .analyze();
      total += violations.length;
      const label = `${vp.name}/${scheme} ${path}`;
      if (!violations.length) {
        console.log(`✓ ${label}`);
        continue;
      }
      console.log(`✗ ${label}`);
      for (const v of violations) {
        console.log(`   [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length})`);
        for (const n of v.nodes.slice(0, 3)) console.log(`      ${n.target.join(' ')}  ${n.failureSummary?.split('\n')[1] ?? ''}`);
      }
    }
    await context.close();
  }
}

await browser.close();
console.log(total ? `\n${total} problemas encontrados.` : '\nSin problemas de accesibilidad detectados.');
process.exit(total ? 1 : 0);
