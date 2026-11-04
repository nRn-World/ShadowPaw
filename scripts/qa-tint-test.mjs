// Render tint variants side by side to pick the best skin-blend recipe.
import { launchBrowser } from './browser.mjs';

const BASE = (process.argv[2] || 'http://localhost:3001').replace(/\/$/, '');
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1400, height: 500 }, deviceScaleFactor: 2 });

const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#0a1220;display:flex;gap:8px;align-items:flex-end;padding:16px">
<script>
const variants = [
  { label: 'orig .28/.08', m: 0.28, l: 0.08 },
  { label: 'new .5/.12', m: 0.5, l: 0.12 },
  { label: '.65/.15', m: 0.65, l: 0.15 },
  { label: '.5+.35color', m: 0.5, l: 0.35, colorBlend: true },
  { label: '.35+.5color', m: 0.35, l: 0.5, colorBlend: true },
  { label: 'ember .5/.12', m: 0.5, l: 0.12, skin: '#e85d2c', acc: '#ffcf6b' },
  { label: 'frost .5/.12', m: 0.5, l: 0.12, skin: '#62b7ff', acc: '#9df3ff' },
];
const img = new Image();
img.onload = () => {
  for (const v of variants) {
    const W = 200, H = 140;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const scale = Math.min(W / img.width, H / img.height) * 0.92;
    const w = img.width * scale, h = img.height * scale;
    const x = (W - w) / 2, y = H - h - 6;
    const sil = (fill) => {
      const layer = document.createElement('canvas'); layer.width = w; layer.height = h;
      const lc = layer.getContext('2d');
      lc.drawImage(img, 0, 0, w, h);
      lc.globalCompositeOperation = 'source-in';
      lc.fillStyle = fill; lc.fillRect(0, 0, w, h);
      return layer;
    };
    const fur = sil(v.skin || '#4169E1'), neon = sil(v.acc || '#2bee79');
    ctx.drawImage(img, x, y, w, h);
    ctx.save(); ctx.translate(x, y);
    ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = v.m; ctx.drawImage(fur, 0, 0);
    if (v.colorBlend) { ctx.globalCompositeOperation = 'color'; ctx.globalAlpha = v.l; ctx.drawImage(fur, 0, 0); }
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = v.colorBlend ? 0.1 : v.l; ctx.drawImage(neon, 0, 0);
    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.font = '11px sans-serif'; ctx.fillText(v.label, 6, 14);
    document.body.appendChild(c);
  }
};
img.src = '${BASE}/cat_character.png';
<\/script></body>`;

await page.goto(BASE); // same-origin for the image
await page.setContent(html);
await page.waitForTimeout(2500);
await page.screenshot({ path: 'tmp-atlas-test/tint-variants.png' });
await browser.close();
console.log('done');
