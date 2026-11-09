import { launchBrowser } from './browser.mjs';
import fs from 'node:fs';
const target = Number(process.argv[2] || 5);
const b = await launchBrowser();
const p = await b.newPage({ viewport: { width: 1200, height: 780 } });
const cdp = await p.context().newCDPSession(p);
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1800);
await p.getByRole('button', { name: /play now/i }).first().click();
await p.waitForTimeout(1500);
await p.keyboard.press('Space');
await p.waitForTimeout(1500);
// Step to the requested level with the debug next-level handle.
for (let guard = 0; guard < 30; guard++) {
  const lv = await p.evaluate(() => window.__SP?.level);
  if (lv === target) break;
  await p.evaluate(() => window.__SP_NEXT?.());
  await p.waitForTimeout(1400);
  await p.keyboard.press('Space');
  await p.waitForTimeout(1200);
}
await p.waitForTimeout(1500);
const info = await p.evaluate(() => ({ level: window.__SP?.level, theme: window.__SP?.theme, tod: window.__SP?.timeOfDay }));
console.log(JSON.stringify(info));
const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(`screenshots/now-${info.level}.png`, Buffer.from(data, 'base64'));
await b.close();
