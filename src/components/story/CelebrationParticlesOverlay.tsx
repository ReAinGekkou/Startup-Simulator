import React, { useEffect, useRef, useState } from 'react';
import {
  CelebrationParticle,
  createCelebrationParticles,
  hashTriggerSeed,
  stepCelebrationParticles,
} from '@/src/game/systems/celebrationParticles';

interface CelebrationParticlesOverlayProps {
  triggerKey: string | null;
}

export const CelebrationParticlesOverlay: React.FC<CelebrationParticlesOverlayProps> = ({
  triggerKey,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [reducedFadeOut, setReducedFadeOut] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const clearCanvas = () => {
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return { w, h };
    };

    if (!triggerKey) {
      setReducedFadeOut(false);
      clearCanvas();
      return;
    }

    const mediaQuery =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    const prefersReducedMotion = Boolean(mediaQuery?.matches);

    let dpr = 1;
    let width = 0;
    let height = 0;

    const syncSize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth || window.innerWidth;
      height = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
    };

    syncSize();
    const seed = hashTriggerSeed(triggerKey);
    const particles: CelebrationParticle[] = createCelebrationParticles(
      width,
      height,
      seed,
      width < 768
    );

    const drawPixelSparkle = (
      px: number,
      py: number,
      size: number,
      color: string,
      alpha: number,
      twinkle: number
    ) => {
      if (alpha <= 0.02) return;
      const x = Math.round(px);
      const y = Math.round(py);
      const arm = twinkle > 0.55 ? size + 1 : Math.max(2, size - 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      // Crisp pixel cross sparkle
      ctx.fillRect(x - arm, y, arm * 2 + 1, 1);
      ctx.fillRect(x, y - arm, 1, arm * 2 + 1);
      ctx.fillStyle = '#FAF8F2';
      ctx.fillRect(x, y, 1, 1);
    };

    if (prefersReducedMotion) {
      setReducedFadeOut(false);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, width, height);

      // Gentle static pixel sparkles along outer corners (no continuous motion)
      const sparkles = particles.filter((p) => p.kind === 'SPARKLE').slice(0, 12);
      sparkles.forEach((p, idx) => {
        drawPixelSparkle(p.x, p.y, p.size, p.color, 0.72, idx % 2 === 0 ? 0.8 : 0.4);
      });
      ctx.globalAlpha = 1;

      const fadeTimer = window.setTimeout(() => setReducedFadeOut(true), 450);
      const clearTimer = window.setTimeout(() => {
        clearCanvas();
      }, 1500);
      window.addEventListener('resize', syncSize);
      return () => {
        window.clearTimeout(fadeTimer);
        window.clearTimeout(clearTimer);
        window.removeEventListener('resize', syncSize);
      };
    }

    setReducedFadeOut(false);
    let rafId = 0;
    let lastTime = performance.now();

    const drawParticles = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        if (p.ageSec < p.delaySec) continue;
        const activeAge = p.ageSec - p.delaySec;
        if (activeAge >= p.lifeSec) continue;

        const progress = activeAge / p.lifeSec;
        const fadeIn = Math.min(1, activeAge / 0.25);
        const fadeOut = progress > 0.7 ? Math.max(0, (1 - progress) / 0.3) : 1;
        const alpha = 0.82 * fadeIn * fadeOut;

        if (p.kind === 'SPARKLE') {
          const twinkle = 0.5 + 0.5 * Math.sin(activeAge * 6.5 + p.twinklePhase);
          drawPixelSparkle(p.x, p.y, p.size, p.color, alpha * (0.45 + 0.55 * twinkle), twinkle);
        } else {
          // 2-step pixel flutter ratio without soft rotation blur
          const flutter = Math.abs(Math.sin(activeAge * 5.2 + p.twinklePhase));
          const w = Math.max(2, Math.round(p.size + 1));
          const h = flutter > 0.35 ? Math.max(2, p.size - 1) : 1;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = p.color;
          ctx.fillRect(Math.round(p.x), Math.round(p.y), w, h);
        }
      }
      ctx.globalAlpha = 1;
    };

    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      let alive = true;
      if (!document.hidden) {
        alive = stepCelebrationParticles(particles, dt);
        drawParticles();
      }

      if (alive) {
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = 0;
        clearCanvas();
      }
    };

    window.addEventListener('resize', syncSize);
    rafId = requestAnimationFrame(tick);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', syncSize);
      clearCanvas();
    };
  }, [triggerKey]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`fixed inset-0 z-[55] w-full h-full pointer-events-none select-none transition-opacity duration-1000 ${
        reducedFadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    />
  );
};
