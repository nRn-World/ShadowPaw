import React, { useEffect, useRef } from 'react';
import { isReducedMotion, useProgress } from '../context/ProgressContext';

/**
 * The home-page hero clip: a short, real gameplay loop recorded straight from
 * the game (see scripts/record-gameplay.mjs). It autoplays muted and loops so
 * the first screen shows how Shadow Paw actually plays. Reduced-motion players
 * get a single held frame instead of continuous motion.
 */
const GameplayVideo: React.FC<{ label?: string }> = ({ label }) => {
  const { progress } = useProgress();
  const reduceMotion = isReducedMotion(progress.settings.reduceMotion);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (reduceMotion) {
      v.pause();
      // Hold a busy mid-run frame rather than the emptier opening second.
      const seek = () => {
        const d = Number.isFinite(v.duration) ? v.duration : 6;
        try { v.currentTime = Math.min(3, d * 0.5); } catch { /* not seekable yet */ }
      };
      if (v.readyState >= 1) seek();
      else {
        v.addEventListener('loadedmetadata', seek, { once: true });
        return () => v.removeEventListener('loadedmetadata', seek);
      }
    } else {
      v.play().catch(() => { /* autoplay blocked: the poster frame still shows */ });
    }
  }, [reduceMotion]);

  return (
    <video
      ref={ref}
      className="h-full w-full object-cover"
      src="./gameplay-loop.webm"
      muted
      loop
      playsInline
      autoPlay={!reduceMotion}
      preload="metadata"
      aria-label={label}
    />
  );
};

export default GameplayVideo;
