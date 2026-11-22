import { CinematicSceneId } from '@/src/types/game';

export type CelebrationParticleKind = 'CONFETTI' | 'SPARKLE';

export interface CelebrationParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  kind: CelebrationParticleKind;
  ageSec: number;
  delaySec: number;
  lifeSec: number;
  swayPhase: number;
  swayFreq: number;
  swayAmp: number;
  twinklePhase: number;
}

export const COZY_CELEBRATION_COLORS = [
  '#D9A66C', // Warm honey gold
  '#78978A', // Muted sage
  '#D68B7B', // Dusty coral rose
  '#A8B8CE', // Soft slate blue
  '#F6D992', // Sunlight buttercream
  '#FAF8F2', // Warm paper cream
] as const;

const CELEBRATORY_CINEMATICS = new Set<CinematicSceneId>([
  'CHAPTER_1_MILESTONE',
  'CHAPTER_2_MILESTONE',
  'CHAPTER_3_MILESTONE',
  'CHAPTER_4_MILESTONE',
  'CHAPTER_5_MILESTONE',
  'CHAPTER_6_MILESTONE',
  'ENDING_DREAM_COMPANY',
  'ENDING_SMALL_BUT_HAPPY',
  'ENDING_ACQUISITION',
  'ENDING_LEGACY',
]);

export function isCelebratoryCinematic(
  cinematicId: CinematicSceneId | null | undefined
): boolean {
  if (!cinematicId) return false;
  return CELEBRATORY_CINEMATICS.has(cinematicId);
}

export function hashTriggerSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRand(index: number, salt: number, seed: number): number {
  const x = Math.sin((index + 1) * 12.9898 + salt * 78.233 + (seed % 9973) * 0.37) * 43758.5453;
  return x - Math.floor(x);
}

export function createCelebrationParticles(
  width: number,
  height: number,
  seed: number,
  isCompactViewport: boolean
): CelebrationParticle[] {
  const safeW = Math.max(320, width);
  const safeH = Math.max(320, height);
  const count = isCompactViewport ? 22 : 34;
  const particles: CelebrationParticle[] = [];

  for (let i = 0; i < count; i++) {
    const r1 = seededRand(i, 1, seed);
    const r2 = seededRand(i, 2, seed);
    const r3 = seededRand(i, 3, seed);
    const r4 = seededRand(i, 4, seed);
    const r5 = seededRand(i, 5, seed);
    const r6 = seededRand(i, 6, seed);

    const isSparkle = i % 3 === 0;
    const color = COZY_CELEBRATION_COLORS[i % COZY_CELEBRATION_COLORS.length];

    if (isSparkle) {
      // Soft sparkles placed along margins & upper canvas so center dialog remains completely readable
      const edgeBand = i % 2 === 0 ? r1 * 0.24 : 0.76 + r1 * 0.22;
      const verticalBand = 0.08 + r2 * 0.74;
      particles.push({
        x: edgeBand * safeW,
        y: verticalBand * safeH,
        vx: (r3 - 0.5) * 8,
        vy: -(8 + r4 * 14),
        size: isCompactViewport ? 3 : 4,
        color: i % 6 === 0 ? '#FAF8F2' : color,
        kind: 'SPARKLE',
        ageSec: 0,
        delaySec: r5 * 0.85,
        lifeSec: 2.2 + r6 * 1.1,
        swayPhase: r1 * Math.PI * 2,
        swayFreq: 1.4 + r3 * 1.1,
        swayAmp: 4,
        twinklePhase: r4 * Math.PI * 2,
      });
    } else {
      // Gentle falling pixel confetti from top header band
      const xStart = (0.04 + r1 * 0.92) * safeW;
      const yStart = -8 - r2 * Math.min(80, safeH * 0.14);
      particles.push({
        x: xStart,
        y: yStart,
        vx: (r3 - 0.5) * 26,
        vy: 36 + r4 * 34,
        size: isCompactViewport ? 3 + Math.round(r5) : 3 + Math.round(r5 * 2),
        color,
        kind: 'CONFETTI',
        ageSec: 0,
        delaySec: r6 * 0.7,
        lifeSec: 2.9 + r2 * 1.0,
        swayPhase: r1 * Math.PI * 2,
        swayFreq: 2.2 + r3 * 1.6,
        swayAmp: 12 + r4 * 14,
        twinklePhase: r5 * Math.PI * 2,
      });
    }
  }

  return particles;
}

export function stepCelebrationParticles(
  particles: CelebrationParticle[],
  rawDtSec: number
): boolean {
  const dt = Math.min(Math.max(rawDtSec, 0), 0.05);
  let anyAlive = false;

  for (const p of particles) {
    p.ageSec += dt;
    if (p.ageSec < p.delaySec) {
      anyAlive = true;
      continue;
    }
    const activeAge = p.ageSec - p.delaySec;
    if (activeAge >= p.lifeSec) {
      continue;
    }
    anyAlive = true;

    if (p.kind === 'CONFETTI') {
      const sway = Math.sin(activeAge * p.swayFreq + p.swayPhase) * p.swayAmp;
      p.x += (p.vx + sway) * dt;
      p.y += p.vy * dt;
      p.vy = Math.min(78, p.vy + 14 * dt);
    } else {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  return anyAlive;
}

export interface CelebrationBurstCoordinator {
  shouldTriggerBurst: (key: string, nowMs: number, mergeWindowMs?: number) => boolean;
  reset: () => void;
}

export function createCelebrationBurstCoordinator(): CelebrationBurstCoordinator {
  const seenKeys = new Set<string>();
  let lastTriggerAtMs = -Infinity;

  return {
    shouldTriggerBurst(key: string, nowMs: number, mergeWindowMs = 1500): boolean {
      if (!key) return false;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);

      if (nowMs - lastTriggerAtMs < mergeWindowMs) {
        return false;
      }
      lastTriggerAtMs = nowMs;
      return true;
    },
    reset() {
      seenKeys.clear();
      lastTriggerAtMs = -Infinity;
    },
  };
}
