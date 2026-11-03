import React, { useEffect, useRef, useState } from 'react';
import { drawCatSprite } from './catSprite';
import { drawCatAtlasSprite, loadCatAtlas, whenCatAtlasReady } from './catAtlasSprite';

/** The real cat sprite on a small canvas, used by the shop. `animated` adds a gentle idle bob. */
const CatPreview: React.FC<{
  color: string;
  accent?: string;
  original?: boolean;
  width: number;
  height: number;
  scale: number;
  animated?: boolean;
  className?: string;
}> = ({ color, accent, original, width, height, scale, animated = false, className }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  // The shop previews a static skin, so the atlas is drawn in its idle pose
  // with the skin tint applied. This state only exists to redraw once the
  // PNG has decoded; until then the vector cat stands in.
  const [atlasReady, setAtlasReady] = useState(false);

  useEffect(() => {
    loadCatAtlas();
    let alive = true;
    void whenCatAtlasReady().then(() => {
      if (alive) setAtlasReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const draw = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const feetY = height - 10 * scale;
      const bob = animated ? Math.sin(t * 2.2) * 0.55 * scale : 0;
      // Soft contact shadow: the paws sit exactly on its top edge, which is
      // what makes the preview read as standing on a floor.
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.beginPath();
      ctx.ellipse(width / 2, feetY + 1.5, 18 * scale, 3.2 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      const atlasW = 44 * scale;
      const drawn = drawCatAtlasSprite(ctx, width / 2, feetY + bob, {
        color,
        accent,
        original,
        t,
        running: false,
        jumping: false,
        grounded: true,
        w: atlasW,
      });
      if (!drawn) {
        drawCatSprite(ctx, width / 2, feetY, {
          color,
          accent,
          t,
          running: false,
          jumping: false,
          grounded: true,
          sx: scale,
          sy: scale,
        });
      }
    };

    if (!animated || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      draw(0);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      draw((now - start) / 1000);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [color, accent, original, width, height, scale, animated, atlasReady]);

  return <canvas ref={ref} className={className} style={{ width, height }} aria-hidden="true" />;
};

export default CatPreview;
