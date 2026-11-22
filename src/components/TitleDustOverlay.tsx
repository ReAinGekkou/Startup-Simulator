import React, { useEffect, useRef } from 'react';

export interface DustMote {
  x: number; // normalized [0..1]
  y: number; // normalized [0..1]
  radius: number; // CSS px
  vx: number; // normalized horizontal drift per second
  vy: number; // normalized vertical drift per second
  swayAmp: number; // normalized horizontal sway amplitude
  swayFreq: number; // radians/sec
  phase: number;
  baseAlpha: number;
  warmTint: boolean;
}

function seededUnit(index: number, salt: number): number {
  const s = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

export function createDustMotes(count = 28): DustMote[] {
  const motes: DustMote[] = [];
  for (let i = 0; i < count; i++) {
    const r1 = seededUnit(i, 1);
    const r2 = seededUnit(i, 2);
    const r3 = seededUnit(i, 3);
    const r4 = seededUnit(i, 4);
    const r5 = seededUnit(i, 5);
    const r6 = seededUnit(i, 6);

    motes.push({
      x: 0.08 + r1 * 0.88,
      y: r2,
      radius: 1.2 + r3 * 1.8,
      vx: (r4 - 0.35) * 0.008,
      vy: -(0.004 + r5 * 0.009),
      swayAmp: 0.004 + r6 * 0.009,
      swayFreq: 0.45 + r3 * 0.55,
      phase: r1 * Math.PI * 2,
      baseAlpha: 0.22 + r5 * 0.36,
      warmTint: i % 3 !== 0,
    });
  }
  return motes;
}

export function stepDustMotes(motes: DustMote[], dtSeconds: number, elapsedSeconds: number): void {
  const dt = Math.min(Math.max(dtSeconds, 0), 0.1);
  for (const mote of motes) {
    mote.x += (mote.vx + Math.sin(elapsedSeconds * mote.swayFreq + mote.phase) * mote.swayAmp) * dt;
    mote.y += mote.vy * dt;

    if (mote.y < -0.04) {
      mote.y = 1.04;
    } else if (mote.y > 1.04) {
      mote.y = -0.04;
    }

    if (mote.x < -0.04) {
      mote.x = 1.04;
    } else if (mote.x > 1.04) {
      mote.x = -0.04;
    }
  }
}

export const TitleDustOverlay: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const motes = createDustMotes(28);
    const reduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let dpr = 1;

    const syncCanvasSize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth || window.innerWidth;
      height = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
    };

    const drawFrame = (elapsedSec: number) => {
      if (width <= 0 || height <= 0) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // Gentle diagonal window sunbeam highlights on the upper-right office region
      const beam = ctx.createLinearGradient(width * 0.45, 0, width * 0.92, height * 0.78);
      beam.addColorStop(0, 'rgba(255, 245, 214, 0.14)');
      beam.addColorStop(0.55, 'rgba(255, 245, 214, 0.06)');
      beam.addColorStop(1, 'rgba(255, 245, 214, 0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(width * 0.42, 0);
      ctx.lineTo(width * 0.78, 0);
      ctx.lineTo(width, height * 0.65);
      ctx.lineTo(width * 0.62, height * 0.85);
      ctx.closePath();
      ctx.fill();

      // Floating cozy dust motes catching ambient office light
      for (const mote of motes) {
        const px = mote.x * width;
        const py = mote.y * height;
        const shimmer = reduceMotion
          ? 1
          : 0.68 + 0.32 * Math.sin(elapsedSec * 1.35 + mote.phase);
        const alpha = mote.baseAlpha * shimmer;

        // Soft outer halo
        ctx.fillStyle = mote.warmTint
          ? `rgba(255, 242, 200, ${(alpha * 0.32).toFixed(3)})`
          : `rgba(243, 240, 231, ${(alpha * 0.28).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(px, py, mote.radius * 2.2, 0, Math.PI * 2);
        ctx.fill();

        // Crisp core mote
        ctx.fillStyle = mote.warmTint
          ? `rgba(255, 249, 224, ${alpha.toFixed(3)})`
          : `rgba(250, 248, 242, ${(alpha * 0.9).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(px, py, mote.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    syncCanvasSize();
    drawFrame(0);

    if (reduceMotion) {
      window.addEventListener('resize', syncCanvasSize);
      return () => window.removeEventListener('resize', syncCanvasSize);
    }

    let rafId = 0;
    let lastTime = performance.now();
    let elapsed = 0;

    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      if (!document.hidden) {
        elapsed += Math.min(dt, 0.1);
        stepDustMotes(motes, dt, elapsed);
        drawFrame(elapsed);
      }
      rafId = requestAnimationFrame(tick);
    };

    const handleResize = () => {
      syncCanvasSize();
      drawFrame(elapsed);
    };

    window.addEventListener('resize', handleResize);
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 w-full h-full pointer-events-none select-none"
    />
  );
};
