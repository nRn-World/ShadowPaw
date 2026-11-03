/**
 * One portable browser launcher for every QA/baking script in this repo.
 *
 * The old harnesses each hard-coded `C:\Program Files\Google\Chrome\...`, so
 * none of them ran on Linux or in CI. This resolves, in order:
 *   1. CHROME_PATH / --chrome (any local Chrome or Chromium binary)
 *   2. the Chromium shipped in @sparticuz/chromium (CI / bare Linux)
 * It also inflates the Amazon Linux 2023 libraries that binary needs.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

export const resolveExecutable = async () => {
  const chromeArgIndex = process.argv.indexOf('--chrome');
  const fromArg = chromeArgIndex >= 0 ? process.argv[chromeArgIndex + 1] : undefined;
  const fromEnv = process.env.CHROME_PATH || fromArg;
  if (fromEnv && existsSync(fromEnv)) return { executablePath: fromEnv, args: ['--no-sandbox', '--disable-dev-shm-usage'] };

  const chromiumPkg = await import('@sparticuz/chromium').then((m) => m.default);
  const { inflate } = await import('@sparticuz/chromium');
  const libs = await inflate('node_modules/@sparticuz/chromium/bin/al2023.tar.br');
  process.env.LD_LIBRARY_PATH = [join(libs, 'lib'), join(libs, 'usr/lib64'), process.env.LD_LIBRARY_PATH]
    .filter(Boolean).join(':');
  return {
    executablePath: await chromiumPkg.executablePath(),
    args: [...chromiumPkg.args, '--no-sandbox', '--disable-dev-shm-usage'],
  };
};

export const launchBrowser = async (options = {}) => {
  const { executablePath, args } = await resolveExecutable();
  return chromium.launch({ executablePath, headless: true, args, ...options });
};

/** Stub canvas painting for clock-driven tests. The game simulation and React
    state stay real; only rasterisation is skipped (software rendering a 720p
    neon scene is 30x slower). */
export function noCanvasPainting() {
  const P = CanvasRenderingContext2D.prototype;
  const noop = function () {};
  const methods = [
    'fill', 'stroke', 'fillRect', 'strokeRect', 'clearRect', 'fillText', 'strokeText',
    'drawImage', 'arc', 'ellipse', 'beginPath', 'closePath', 'moveTo', 'lineTo',
    'quadraticCurveTo', 'bezierCurveTo', 'rect', 'roundRect', 'arcTo', 'save',
    'restore', 'translate', 'scale', 'rotate', 'transform', 'setTransform',
    'resetTransform', 'setLineDash', 'clip', 'putImageData',
  ];
  for (const m of methods) if (typeof P[m] === 'function') P[m] = noop;
  const gradient = () => ({ addColorStop: noop });
  P.createLinearGradient = gradient;
  P.createRadialGradient = gradient;
  P.createPattern = () => ({});
  P.measureText = (text) => ({ width: String(text).length * 8 });
  P.createImageData = (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
  P.getImageData = (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
}
