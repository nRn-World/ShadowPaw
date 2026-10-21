import React, { useEffect, useRef } from 'react';
import { drawCatSprite } from './catSprite';

/** The real cat sprite on a small canvas, used by the shop. `animated` adds a gentle idle bob. */
const CatPreview: React.FC<{
  color: string;
  accent?: string;
  width: number;
  height: number;
  scale: number;
  animated?: boolean;
  className?: string;
}> = ({ color, accent, width, height, scale, animated = false, className }) => {
  const ref = useRef<HTMLCanvasElement>(null);

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
      const feetY = height - 14 * scale * 0.5;
      const bob = animated ? Math.sin(t * 2.2) * 1.5 * scale * 0.5 : 0;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(width / 2, feetY + 1, 17 * scale, 3.4 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      drawCatSprite(ctx, width / 2 - 1 * scale, feetY + bob, { color, accent, t, running: false, jumping: false, sx: scale, sy: scale });
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
  }, [color, accent, width, height, scale, animated]);

  return <canvas ref={ref} className={className} style={{ width, height }} aria-hidden="true" />;
};

export default CatPreview;
