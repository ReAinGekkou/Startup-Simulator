import React, { useEffect, useRef } from 'react';
import { CinematicVisualKind } from '@/src/game/data/storyData';
import { CharacterAppearance, GameState } from '@/src/types/game';

interface CinematicCanvasStageProps {
  visual: CinematicVisualKind;
  companyName: string;
  founderAppearance?: CharacterAppearance;
  employees?: Array<{ appearance: CharacterAppearance; name?: string }>;
  cameraPan?: 'LEFT_TO_RIGHT' | 'ZOOM_IN' | 'ZOOM_OUT' | 'GENTLE_DRIFT';
  locked?: boolean;
  compact?: boolean;
  gameState?: GameState;
}

function drawPixelChar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  app: CharacterAppearance,
  phase: number,
  scale = 2,
  mood: 'HAPPY' | 'NEUTRAL' | 'STRESSED' = 'NEUTRAL',
  holdingCup = false
) {
  const s = scale;
  const bob = Math.sin(phase) > 0.3 ? -1 * s : 0;
  const cy = y + bob;

  // Shadow
  ctx.fillStyle = 'rgba(20, 26, 24, 0.32)';
  ctx.fillRect(x - 4 * s, y + 10 * s, 9 * s, 2 * s);

  // Legs
  ctx.fillStyle = app.pantsColor;
  ctx.fillRect(x - 3 * s, cy + 5 * s, 2 * s, 5 * s);
  ctx.fillRect(x + 1 * s, cy + 5 * s, 2 * s, 5 * s);

  // Shirt torso
  ctx.fillStyle = app.shirtColor;
  ctx.fillRect(x - 4 * s, cy - 1 * s, 8 * s, 6 * s);

  // Arms
  ctx.fillStyle = app.skinTone;
  ctx.fillRect(x - 5 * s, cy, 1 * s, 4 * s);
  ctx.fillRect(x + 4 * s, cy, 1 * s, 4 * s);

  if (holdingCup) {
    ctx.fillStyle = '#F3F0E7';
    ctx.fillRect(x + 4 * s, cy + 1 * s, 2 * s, 2 * s);
    ctx.fillStyle = '#6f4e37';
    ctx.fillRect(x + 4 * s, cy + 1 * s, 2 * s, 1 * s);
  }

  // Head
  ctx.fillStyle = app.skinTone;
  ctx.fillRect(x - 4 * s, cy - 8 * s, 8 * s, 7 * s);

  // Hair
  ctx.fillStyle = app.hairColor;
  if (app.hairStyle !== 'BALD') {
    ctx.fillRect(x - 4 * s, cy - 9 * s, 8 * s, 3 * s);
    if (app.hairStyle === 'BOB' || app.hairStyle === 'PONYTAIL') {
      ctx.fillRect(x - 5 * s, cy - 8 * s, 1 * s, 5 * s);
      ctx.fillRect(x + 4 * s, cy - 8 * s, 1 * s, 5 * s);
    } else if (app.hairStyle === 'SPIKY') {
      ctx.fillRect(x - 3 * s, cy - 10 * s, 2 * s, 1 * s);
      ctx.fillRect(x + 1 * s, cy - 10 * s, 2 * s, 1 * s);
    }
  }

  // Eyes
  ctx.fillStyle = '#1E2422';
  ctx.fillRect(x - 2 * s, cy - 5 * s, 1 * s, 1 * s);
  ctx.fillRect(x + 1 * s, cy - 5 * s, 1 * s, 1 * s);
  if (app.hasGlasses) {
    ctx.fillStyle = 'rgba(243,240,231,0.75)';
    ctx.fillRect(x - 3 * s, cy - 5 * s, 2 * s, 1 * s);
    ctx.fillRect(x + 1 * s, cy - 5 * s, 2 * s, 1 * s);
  }

  // Expression cue
  if (mood === 'HAPPY') {
    ctx.fillStyle = '#D9A66C';
    ctx.fillRect(x - 1 * s, cy - 3 * s, 2 * s, 1 * s);
  } else if (mood === 'STRESSED') {
    ctx.fillStyle = '#60A5FA';
    ctx.fillRect(x + 3 * s, cy - 7 * s, 1 * s, 2 * s);
  }
}

function drawDesk(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  litMonitor: boolean,
  hasBox = false
) {
  ctx.fillStyle = '#8C6239';
  ctx.fillRect(x, y, 42, 16);
  ctx.fillStyle = '#5C3D22';
  ctx.fillRect(x + 2, y + 16, 4, 12);
  ctx.fillRect(x + 36, y + 16, 4, 12);
  // Monitor
  ctx.fillStyle = '#303B38';
  ctx.fillRect(x + 13, y - 14, 16, 12);
  ctx.fillStyle = litMonitor ? '#B8E0C8' : '#26302E';
  ctx.fillRect(x + 15, y - 12, 12, 8);
  ctx.fillStyle = '#303B38';
  ctx.fillRect(x + 19, y - 2, 4, 2);

  if (hasBox) {
    ctx.fillStyle = '#D9A66C';
    ctx.fillRect(x + 32, y + 6, 14, 12);
    ctx.fillStyle = '#A87946';
    ctx.fillRect(x + 32, y + 11, 14, 2);
  }
}

function drawPlant(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#B86B4B';
  ctx.fillRect(x, y, 10, 9);
  ctx.fillStyle = '#5E8A6E';
  ctx.fillRect(x - 2, y - 9, 14, 8);
  ctx.fillStyle = '#78978A';
  ctx.fillRect(x + 1, y - 13, 8, 5);
}

const DEFAULT_FOUNDER: CharacterAppearance = {
  skinTone: '#F1C6A8',
  hairColor: '#303B38',
  hairStyle: 'SHORT',
  shirtColor: '#78978A',
  pantsColor: '#303B38',
  hasGlasses: false,
};

const DEFAULT_TEAM: CharacterAppearance[] = [
  {
    skinTone: '#f6d5b8',
    hairColor: '#1e1b18',
    hairStyle: 'SHORT',
    shirtColor: '#3b82f6',
    pantsColor: '#1e293b',
    hasGlasses: true,
  },
  {
    skinTone: '#c68b63',
    hairColor: '#4a3222',
    hairStyle: 'BOB',
    shirtColor: '#ec4899',
    pantsColor: '#334155',
    hasGlasses: false,
  },
  {
    skinTone: '#e8b896',
    hairColor: '#8c5a32',
    hairStyle: 'SPIKY',
    shirtColor: '#f59e0b',
    pantsColor: '#1e3a5f',
    hasGlasses: false,
  },
];

export const CinematicCanvasStage: React.FC<CinematicCanvasStageProps> = ({
  visual,
  companyName,
  founderAppearance = DEFAULT_FOUNDER,
  employees = [],
  cameraPan = 'GENTLE_DRIFT',
  locked = false,
  compact = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const startMs = performance.now();
    const teamApps =
      employees.length > 0
        ? employees.slice(0, 4).map((e) => e.appearance)
        : DEFAULT_TEAM;

    const renderFrame = (now: number) => {
      const elapsed = (now - startMs) / 1000;
      const W = 320;
      const H = 180;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, W, H);

      const isNight =
        visual === 'ENDING_BURNOUT_NIGHT' || visual === 'ENDING_LAST_DAY_BOXES';
      const isSunrise =
        visual === 'SUNRISE_CITY' ||
        visual === 'ENDING_DREAM_SKYLINE' ||
        visual === 'ENDING_LEGACY_FUTURE' ||
        visual === 'MILESTONE_OPPORTUNITY' ||
        visual === 'MILESTONE_FUTURE';

      if (isSunrise) {
        // Warm sunrise / golden-hour pixel skyline
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#465B63');
        grad.addColorStop(0.5, '#D9A66C');
        grad.addColorStop(1, '#F3DFC1');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // Rising pixel sun
        const sunY = 92 - Math.min(20, elapsed * 2.2);
        ctx.fillStyle = '#FFF5D6';
        ctx.beginPath();
        ctx.arc(160, sunY, 24, 0, Math.PI * 2);
        ctx.fill();

        // Distant & mid skyline buildings with lighting-up windows
        const buildings = [
          { x: 6, w: 34, h: 78 },
          { x: 42, w: 42, h: 96 },
          { x: 86, w: 30, h: 66 },
          { x: 118, w: 46, h: 108 },
          { x: 168, w: 38, h: 86 },
          { x: 208, w: 44, h: 102 },
          { x: 254, w: 32, h: 74 },
          { x: 288, w: 28, h: 88 },
        ];
        buildings.forEach((b, bi) => {
          const by = H - b.h;
          ctx.fillStyle = bi % 2 === 0 ? '#303B38' : '#3E4C48';
          ctx.fillRect(b.x, by, b.w, b.h);
          for (let wy = by + 8; wy < H - 14; wy += 10) {
            for (let wx = b.x + 5; wx < b.x + b.w - 7; wx += 8) {
              const litThreshold = ((bi * 7 + wx + wy) % 10) * 0.25;
              const isLit = elapsed > litThreshold || visual !== 'SUNRISE_CITY';
              ctx.fillStyle = isLit ? '#F6D992' : '#252E2B';
              ctx.fillRect(wx, wy, 4, 5);
            }
          }
        });

        // Foreground cozy studio rooftop/office silhouette for specific visuals
        if (visual === 'ENDING_DREAM_SKYLINE' || visual === 'ENDING_LEGACY_FUTURE') {
          ctx.fillStyle = '#EAE2CF';
          ctx.fillRect(0, 126, W, 54);
          ctx.fillStyle = '#303B38';
          ctx.fillRect(0, 124, W, 3);
          drawPlant(ctx, 20, 148);
          drawPlant(ctx, 290, 148);
          drawPixelChar(ctx, 150, 140, founderAppearance, elapsed * 2, 2, 'HAPPY');
          teamApps.slice(0, 3).forEach((app, i) => {
            drawPixelChar(
              ctx,
              70 + i * 52 + (i >= 2 ? 40 : 0),
              144,
              app,
              elapsed * 4 + i,
              2,
              'HAPPY',
              i === 1
            );
          });
        }
      } else {
        // Interior office background (Cozy cream wall + warm wood floor, or twilight/night tint)
        ctx.fillStyle = isNight ? '#26302E' : '#EAE5D8';
        ctx.fillRect(0, 0, W, 62);
        ctx.fillStyle = isNight ? '#1D2523' : '#DFC8A2';
        ctx.fillRect(0, 62, W, H - 62);

        // Wood plank floor lines
        ctx.fillStyle = isNight ? 'rgba(0,0,0,0.22)' : 'rgba(140,98,57,0.16)';
        for (let fy = 74; fy < H; fy += 14) {
          ctx.fillRect(0, fy, W, 1);
        }

        // Tall office windows
        [36, 134, 232].forEach((wx) => {
          ctx.fillStyle = isNight ? '#16202A' : '#CFE6E8';
          ctx.fillRect(wx, 12, 52, 34);
          ctx.strokeStyle = '#303B38';
          ctx.lineWidth = 2;
          ctx.strokeRect(wx, 12, 52, 34);
          if (!isNight) {
            ctx.fillStyle = 'rgba(255, 236, 179, 0.25)';
            ctx.beginPath();
            ctx.moveTo(wx, 46);
            ctx.lineTo(wx + 52, 46);
            ctx.lineTo(wx + 66, 118);
            ctx.lineTo(wx - 10, 118);
            ctx.closePath();
            ctx.fill();
          }
        });

        // Desks, plants & specific visual storytelling props
        const hasBoxes =
          visual === 'SMALL_OFFICE_BOXES' || visual === 'ENDING_LAST_DAY_BOXES';
        const litScreens = visual !== 'ENDING_LAST_DAY_BOXES';

        drawDesk(ctx, 36, 86, litScreens, hasBoxes);
        drawDesk(ctx, 138, 86, litScreens, false);
        drawDesk(ctx, 238, 86, litScreens && visual !== 'ENDING_BURNOUT_NIGHT', hasBoxes);
        drawPlant(ctx, 14, 72);
        drawPlant(ctx, 294, 72);

        // Coffee bar in corner
        ctx.fillStyle = '#6B4F3A';
        ctx.fillRect(14, 134, 48, 22);
        ctx.fillStyle = '#303B38';
        ctx.fillRect(24, 122, 16, 12);
        // Rising steam pixel puffs
        if (!isNight && (visual === 'FIRST_TEAM_COFFEE' || visual === 'ENDING_COZY_COFFEE')) {
          const steamOffset = (elapsed * 12) % 10;
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.fillRect(30, 118 - steamOffset, 2, 3);
          ctx.fillRect(35, 114 - ((steamOffset + 4) % 10), 2, 3);
        }

        if (visual === 'FOUNDER_DESK_WAKEUP' || visual === 'MILESTONE_FOUNDING') {
          drawPixelChar(ctx, 160, 82, founderAppearance, elapsed * 3, 2, 'HAPPY');
          // Glowing company name banner on centerpiece screen/wall
          ctx.fillStyle = '#303B38';
          ctx.fillRect(96, 18, 128, 24);
          ctx.fillStyle = '#F3F0E7';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(companyName.slice(0, 18), 160, 34);
          teamApps.slice(0, 3).forEach((app, i) => {
            drawPixelChar(ctx, 56 + i * 102, 138, app, elapsed * 3 + i, 2, 'HAPPY');
          });
        } else if (visual === 'FIRST_TEAM_COFFEE' || visual === 'ENDING_COZY_COFFEE') {
          teamApps.slice(0, 3).forEach((app, i) => {
            drawPixelChar(ctx, 88 + i * 54, 132, app, elapsed * 3 + i, 2, 'HAPPY', i < 2);
          });
          drawPixelChar(ctx, 250, 132, founderAppearance, elapsed * 2.5, 2, 'HAPPY', true);
        } else if (visual === 'ENDING_BURNOUT_NIGHT') {
          // Warm desk lamp cone around solo exhausted founder
          ctx.fillStyle = 'rgba(246, 200, 110, 0.20)';
          ctx.beginPath();
          ctx.arc(160, 88, 46, 0, Math.PI * 2);
          ctx.fill();
          drawPixelChar(ctx, 160, 86, founderAppearance, elapsed * 1.4, 2, 'STRESSED');
        } else if (visual === 'ENDING_LAST_DAY_BOXES') {
          // Employees walking quietly toward exit with boxes
          const walkX = Math.min(295, 100 + elapsed * 14);
          teamApps.slice(0, 2).forEach((app, i) => {
            drawPixelChar(ctx, walkX - i * 38, 138, app, elapsed * 5 + i, 2, 'NEUTRAL');
          });
          drawPixelChar(ctx, 160, 126, founderAppearance, elapsed * 1.2, 2, 'NEUTRAL');
        } else if (visual === 'ENDING_ACQUISITION_PRESS') {
          ctx.fillStyle = '#303B38';
          ctx.fillRect(88, 14, 144, 28);
          ctx.fillStyle = '#D9A66C';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(companyName.slice(0, 16).toUpperCase(), 160, 32);
          drawPixelChar(ctx, 140, 134, founderAppearance, elapsed * 2.5, 2, 'NEUTRAL');
          teamApps.slice(0, 2).forEach((app, i) => {
            drawPixelChar(ctx, 200 + i * 38, 134, app, elapsed * 3 + i, 2, 'NEUTRAL');
          });
        } else if (visual === 'TITLE_CARD') {
          ctx.fillStyle = 'rgba(48, 59, 56, 0.85)';
          ctx.fillRect(0, 0, W, H);
          drawPixelChar(ctx, 160, 126, founderAppearance, elapsed * 2, 2, 'HAPPY');
        } else {
          // Milestones & general office scene
          drawPixelChar(ctx, 158, 86, founderAppearance, elapsed * 3, 2, 'HAPPY');
          teamApps.slice(0, 3).forEach((app, i) => {
            drawPixelChar(ctx, 56 + i * 100, 132, app, elapsed * 3.5 + i, 2, 'HAPPY', i === 0);
          });
        }
      }

      if (locked) {
        ctx.fillStyle = 'rgba(30, 38, 36, 0.72)';
        ctx.fillRect(0, 0, W, H);
      }

      if (!compact) {
        rafId = requestAnimationFrame(renderFrame);
      }
    };

    if (compact) {
      renderFrame(performance.now() + 2500);
    } else {
      rafId = requestAnimationFrame(renderFrame);
    }
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [visual, companyName, founderAppearance, employees, locked, compact]);

  const panClass =
    compact
      ? ''
      : cameraPan === 'ZOOM_IN'
        ? 'scale-[1.06] transition-transform duration-[6000ms] ease-out'
        : cameraPan === 'ZOOM_OUT'
          ? 'scale-[0.98] transition-transform duration-[6000ms] ease-out'
          : cameraPan === 'LEFT_TO_RIGHT'
            ? 'translate-x-1 transition-transform duration-[6000ms] ease-in-out'
            : '';

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#242D2B]">
      <canvas
        ref={canvasRef}
        width={320}
        height={180}
        className={`w-full h-full object-cover ${panClass}`}
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
};
