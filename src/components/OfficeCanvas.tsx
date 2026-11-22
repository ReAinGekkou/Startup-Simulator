import React, { useEffect, useRef, useState } from 'react';
import { FastForward, Pause, Play } from 'lucide-react';
import { OFFICE_COLS, OFFICE_ROWS, TILE_SIZE } from '@/src/game/data/officeLayout';
import { buildWalkabilityGrid, findRoomAtTile } from '@/src/game/engine/pathfinding';
import {
  CameraState,
  getRenderableFurniture,
  isFurnitureInUse,
  Particle,
  renderOfficeScene,
  RenderInteractionState,
} from '@/src/game/renderer/pixelRenderer';
import { useLocalization } from '@/src/hooks/useLocalization';
import { Employee, GameState, GridPoint, RoomId, SimulationSpeed } from '@/src/types/game';

export interface ScreenRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export type WorldTutorialTarget =
  | { kind: 'EMPLOYEE'; employeeId?: string }
  | { kind: 'FOUNDER' }
  | { kind: 'ROOM'; roomId: RoomId };

export interface CameraActionHandle {
  focusRoom: (roomId: RoomId) => void;
  focusEmployee: (employeeId?: string) => void;
  resetView: () => void;
  getWorldTargetRect: (target: WorldTutorialTarget) => ScreenRect | null;
}

export function hitTestEmployee(
  employees: Pick<Employee, 'id' | 'position'>[],
  tile: GridPoint,
  wxTile?: number,
  wyTile?: number
): string | null {
  const tx = wxTile ?? tile.x + 0.5;
  const ty = wyTile ?? tile.y + 0.5;
  let bestId: string | null = null;
  let bestDist = Infinity;

  for (const e of employees) {
    const roundedMatch =
      Math.round(e.position.x) === tile.x && Math.round(e.position.y) === tile.y;
    const cx = e.position.x + 0.5;
    const cy = e.position.y + 0.45;
    const spriteMatch = Math.abs(tx - cx) <= 0.78 && ty >= e.position.y - 0.35 && ty <= e.position.y + 1.15;
    if (roundedMatch || spriteMatch) {
      const dist = Math.hypot(tx - cx, ty - cy);
      if (dist < bestDist) {
        bestDist = dist;
        bestId = e.id;
      }
    }
  }
  return bestId;
}

interface OfficeCanvasProps {
  stateRef: React.MutableRefObject<GameState>;
  isTitlePan?: boolean;
  speed?: SimulationSpeed;
  speedShortcutPulseId?: number;
  selectedRoomId: RoomId | null;
  selectedEmployeeId: string | null;
  movingFurnitureId: string | null;
  placingTemplateId: string | null;
  highlightedRoomIds?: RoomId[];
  highlightedEmployeeId?: string | null;
  onTileClick: (tile: GridPoint, hitEmployeeId: string | null, hitFurnitureId: string | null, hitRoomId: RoomId | null) => void;
  onCameraActionRef?: React.MutableRefObject<CameraActionHandle | null>;
}

export const OfficeCanvas: React.FC<OfficeCanvasProps> = ({
  stateRef,
  isTitlePan = false,
  speed = 1,
  speedShortcutPulseId = 0,
  selectedRoomId,
  selectedEmployeeId,
  movingFurnitureId,
  placingTemplateId,
  highlightedRoomIds,
  highlightedEmployeeId,
  onTileClick,
  onCameraActionRef,
}) => {
  const { t } = useLocalization();
  const [pulseActive, setPulseActive] = useState(false);

  useEffect(() => {
    if (!speedShortcutPulseId) return;
    setPulseActive(true);
    const timer = window.setTimeout(() => {
      setPulseActive(false);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [speedShortcutPulseId]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraRef = useRef<CameraState>({
    x: (OFFICE_COLS * TILE_SIZE) / 2,
    y: (OFFICE_ROWS * TILE_SIZE) / 2,
    zoom: 1,
  });

  const interactionRef = useRef<RenderInteractionState>({
    hoveredTile: null,
    hoveredEntityId: null,
    hoveredRoomId: null,
    selectedRoomId,
    selectedEmployeeId,
    movingFurnitureId,
    placingTemplateId,
    highlightedRoomIds,
    highlightedEmployeeId,
  });

  interactionRef.current.selectedRoomId = selectedRoomId;
  interactionRef.current.selectedEmployeeId = selectedEmployeeId;
  interactionRef.current.movingFurnitureId = movingFurnitureId;
  interactionRef.current.placingTemplateId = placingTemplateId;
  interactionRef.current.highlightedRoomIds = highlightedRoomIds;
  interactionRef.current.highlightedEmployeeId = highlightedEmployeeId;

  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    camStartX: number;
    camStartY: number;
  }>({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    camStartX: 0,
    camStartY: 0,
  });

  const particlesRef = useRef<Particle[]>([]);
  const lastCelebrationIdRef = useRef<string | null>(null);
  const celebrationBurstTimerRef = useRef<number>(0);
  const cameraPanGoalRef = useRef<{ x: number; y: number } | null>(null);

  // Fit initial zoom to container and refit when layout container resizes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fitCamera = () => {
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      const worldW = OFFICE_COLS * TILE_SIZE;
      const worldH = OFFICE_ROWS * TILE_SIZE;
      const fitZoom = Math.min((w - 32) / worldW, (h - 32) / worldH);
      cameraRef.current.zoom = Math.max(0.55, Math.min(1.45, fitZoom));
      cameraRef.current.x = worldW / 2;
      cameraRef.current.y = worldH / 2;
      cameraPanGoalRef.current = null;
    };
    fitCamera();

    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => fitCamera()) : null;
    if (observer) {
      observer.observe(canvas);
    }

    if (onCameraActionRef) {
      onCameraActionRef.current = {
        focusRoom: (roomId: RoomId) => {
          const room = stateRef.current.office.rooms[roomId];
          if (!room) return;
          cameraRef.current.x = (room.bounds.x + room.bounds.w / 2) * TILE_SIZE;
          cameraRef.current.y = (room.bounds.y + room.bounds.h / 2) * TILE_SIZE;
          cameraRef.current.zoom = Math.max(1.15, cameraRef.current.zoom);
          cameraPanGoalRef.current = null;
        },
        focusEmployee: (employeeId?: string) => {
          const st = stateRef.current;
          const emp = employeeId
            ? st.employees.find((e) => e.id === employeeId)
            : st.employees[0];
          if (!emp) return;
          cameraRef.current.x = (emp.position.x + 0.5) * TILE_SIZE;
          cameraRef.current.y = (emp.position.y + 0.5) * TILE_SIZE;
          cameraRef.current.zoom = Math.max(1.25, cameraRef.current.zoom);
          cameraPanGoalRef.current = null;
        },
        resetView: fitCamera,
        getWorldTargetRect: (target: WorldTutorialTarget): ScreenRect | null => {
          const c = canvasRef.current;
          if (!c) return null;
          const rect = c.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return null;
          const cam = cameraRef.current;
          const st = stateRef.current;

          let wx = 0;
          let wy = 0;
          let bw = TILE_SIZE * 1.4 * cam.zoom;
          let bh = TILE_SIZE * 1.5 * cam.zoom;

          if (target.kind === 'EMPLOYEE') {
            const emp = target.employeeId
              ? st.employees.find((e) => e.id === target.employeeId)
              : st.employees[0];
            if (!emp) return null;
            wx = (emp.position.x + 0.5) * TILE_SIZE;
            wy = (emp.position.y + 0.35) * TILE_SIZE;
          } else if (target.kind === 'FOUNDER') {
            wx = (st.founder.position.x + 0.5) * TILE_SIZE;
            wy = (st.founder.position.y + 0.35) * TILE_SIZE;
          } else {
            const room = st.office.rooms[target.roomId];
            if (!room) return null;
            wx = (room.bounds.x + room.bounds.w / 2) * TILE_SIZE;
            wy = (room.bounds.y + room.bounds.h / 2) * TILE_SIZE;
            bw = Math.min(room.bounds.w - 2, 3.2) * TILE_SIZE * cam.zoom;
            bh = Math.min(room.bounds.h - 2, 2.2) * TILE_SIZE * cam.zoom;
          }

          const sx = rect.left + rect.width / 2 + (wx - cam.x) * cam.zoom;
          const sy = rect.top + rect.height / 2 + (wy - cam.y) * cam.zoom;
          const clampedX = Math.max(rect.left + 28, Math.min(rect.right - 28, sx));
          const clampedY = Math.max(rect.top + 28, Math.min(rect.bottom - 28, sy));
          const left = clampedX - bw / 2;
          const top = clampedY - bh / 2;
          return {
            left,
            top,
            right: left + bw,
            bottom: top + bh,
            width: bw,
            height: bh,
          };
        },
      };
    }

    return () => {
      observer?.disconnect();
    };
  }, [isTitlePan, onCameraActionRef, stateRef]);

  // 60fps canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let lastTime = performance.now();
    let steamTimer = 0;
    const confettiPalette = ['#D9A66C', '#78978A', '#D68B7B', '#A8B8CE', '#F3F0E7'];

    const render = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const timeSec = now / 1000;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
        canvas.width = Math.round(cw * dpr);
        canvas.height = Math.round(ch * dpr);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const state = stateRef.current;

      // Gentle camera pan on Title Screen
      if (isTitlePan) {
        const worldW = OFFICE_COLS * TILE_SIZE;
        const worldH = OFFICE_ROWS * TILE_SIZE;
        cameraRef.current.x = worldW / 2 + Math.sin(timeSec * 0.18) * 140;
        cameraRef.current.y = worldH / 2 + Math.cos(timeSec * 0.14) * 60;
        cameraRef.current.zoom = Math.max(0.9, Math.min(1.25, cw / 1150));
      } else {
        // Trigger initial celebration confetti burst & gentle camera glide toward target room
        const activeCel =
          state.screen === 'PLAYING' &&
          state.activeCelebration &&
          !state.activeEvent &&
          !state.pendingDailyReport &&
          !state.pendingMonthlyReport &&
          !state.story?.activeCinematic &&
          !state.story?.activeStoryEvent
            ? state.activeCelebration
            : null;

        if ((activeCel?.id ?? null) !== lastCelebrationIdRef.current) {
          lastCelebrationIdRef.current = activeCel?.id ?? null;
          if (activeCel) {
            const targetRoom = state.office.rooms[activeCel.targetRoomId];
            if (targetRoom) {
              const rx = (targetRoom.bounds.x + targetRoom.bounds.w / 2) * TILE_SIZE;
              const ry = (targetRoom.bounds.y + targetRoom.bounds.h / 2) * TILE_SIZE;
              cameraPanGoalRef.current = { x: rx, y: ry };
              for (let i = 0; i < 24; i++) {
                particlesRef.current.push({
                  x: rx + (Math.random() - 0.5) * (targetRoom.bounds.w - 2) * TILE_SIZE * 0.85,
                  y: ry + (Math.random() - 0.5) * (targetRoom.bounds.h - 2) * TILE_SIZE * 0.5,
                  vx: (Math.random() - 0.5) * 75,
                  vy: -55 - Math.random() * 55,
                  gravity: 95,
                  life: 1.5 + Math.random() * 0.9,
                  maxLife: 2.4,
                  color: confettiPalette[i % confettiPalette.length],
                  size: i % 3 === 0 ? 4 : 3,
                });
              }
            }
            const celebratingCoords: GridPoint[] = [
              state.founder.position,
              ...state.employees.map((e) => e.position),
            ];
            celebratingCoords.forEach((pos, idx) => {
              const px = (pos.x + 0.5) * TILE_SIZE;
              const py = pos.y * TILE_SIZE - 8;
              for (let k = 0; k < 4; k++) {
                particlesRef.current.push({
                  x: px + (Math.random() - 0.5) * 14,
                  y: py,
                  vx: (Math.random() - 0.5) * 48,
                  vy: -42 - Math.random() * 34,
                  gravity: 80,
                  life: 1.2 + Math.random() * 0.7,
                  maxLife: 1.9,
                  color: confettiPalette[(idx + k) % confettiPalette.length],
                  size: 3,
                });
              }
            });
          } else {
            cameraPanGoalRef.current = null;
          }
        }

        if (activeCel && activeCel.remainingSec > 1.6) {
          celebrationBurstTimerRef.current += dt;
          if (celebrationBurstTimerRef.current >= 0.24) {
            celebrationBurstTimerRef.current = 0;
            const targetRoom = state.office.rooms[activeCel.targetRoomId];
            if (targetRoom) {
              const rx = (targetRoom.bounds.x + 1 + Math.random() * (targetRoom.bounds.w - 2)) * TILE_SIZE;
              const ry = (targetRoom.bounds.y + 1 + Math.random() * 1.8) * TILE_SIZE;
              particlesRef.current.push({
                x: rx,
                y: ry,
                vx: (Math.random() - 0.5) * 24,
                vy: 14 + Math.random() * 18,
                gravity: 22,
                life: 1.35,
                maxLife: 1.35,
                color: confettiPalette[Math.floor(Math.random() * confettiPalette.length)],
                size: 3,
              });
            }
          }
        }

        // Smooth camera glide when celebration starts (stops immediately on user drag)
        if (cameraPanGoalRef.current && !dragRef.current.active) {
          const goal = cameraPanGoalRef.current;
          const dx = goal.x - cameraRef.current.x;
          const dy = goal.y - cameraRef.current.y;
          if (Math.hypot(dx, dy) < 2) {
            cameraPanGoalRef.current = null;
          } else {
            const blend = Math.min(1, dt * 4.5);
            cameraRef.current.x += dx * blend;
            cameraRef.current.y += dy * blend;
          }
        }
      }

      // Spawn ambient particles for coffee machines & active office perks
      steamTimer += dt;
      if (steamTimer > 0.28) {
        steamTimer = 0;
        const renderable = getRenderableFurniture(state.office);
        for (const item of renderable) {
          const active = isFurnitureInUse(item, state);
          if (item.templateId === 'ESPRESSO_BAR' || item.templateId === 'PERK_COFFEE_MACHINE') {
            if (active || Math.random() < 0.45) {
              particlesRef.current.push({
                x: (item.tile.x + item.width * 0.5) * TILE_SIZE + (Math.random() - 0.5) * 6,
                y: item.tile.y * TILE_SIZE + 4,
                vx: (Math.random() - 0.5) * 6,
                vy: -(active ? 20 : 14) - Math.random() * 8,
                life: active ? 1.25 : 0.95,
                maxLife: active ? 1.25 : 0.95,
                color: active ? 'rgba(254, 243, 199, 0.78)' : 'rgba(248, 250, 252, 0.55)',
                size: active ? 3 : 2,
              });
            }
          } else if (item.templateId === 'PERK_PING_PONG' && active && Math.random() < 0.55) {
            particlesRef.current.push({
              x: (item.tile.x + 0.4 + Math.random() * 1.2) * TILE_SIZE,
              y: (item.tile.y + 0.3) * TILE_SIZE,
              vx: (Math.random() - 0.5) * 18,
              vy: -18 - Math.random() * 10,
              life: 0.55,
              maxLife: 0.55,
              color: 'rgba(251, 191, 36, 0.85)',
              size: 2,
            });
          } else if (item.templateId === 'PERK_WELLNESS_SUITE' && active && Math.random() < 0.6) {
            particlesRef.current.push({
              x: (item.tile.x + 1.55) * TILE_SIZE + (Math.random() - 0.5) * 4,
              y: item.tile.y * TILE_SIZE + 6,
              vx: (Math.random() - 0.5) * 5,
              vy: -12 - Math.random() * 6,
              life: 1.3,
              maxLife: 1.3,
              color: 'rgba(196, 181, 253, 0.7)',
              size: 3,
            });
          } else if (item.templateId === 'PERK_SNACK_PANTRY' && active && Math.random() < 0.4) {
            particlesRef.current.push({
              x: (item.tile.x + 0.5) * TILE_SIZE + (Math.random() - 0.5) * 10,
              y: item.tile.y * TILE_SIZE + 6,
              vx: (Math.random() - 0.5) * 8,
              vy: -14,
              life: 0.7,
              maxLife: 0.7,
              color: 'rgba(52, 211, 153, 0.8)',
              size: 2,
            });
          }
        }
      }

      // Update particles
      const alive: Particle[] = [];
      for (const p of particlesRef.current) {
        p.vy += (p.gravity ?? 0) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life > 0) alive.push(p);
      }
      particlesRef.current = alive;

      renderOfficeScene(
        ctx,
        cw,
        ch,
        state,
        cameraRef.current,
        interactionRef.current,
        particlesRef.current,
        timeSec
      );

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [isTitlePan, stateRef]);

  const screenToWorldCoords = (
    clientX: number,
    clientY: number
  ): { tile: GridPoint; wxTile: number; wyTile: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const cam = cameraRef.current;
    const wx = (sx - rect.width / 2) / cam.zoom + cam.x;
    const wy = (sy - rect.height / 2) / cam.zoom + cam.y;
    const wxTile = wx / TILE_SIZE;
    const wyTile = wy / TILE_SIZE;
    const tx = Math.floor(wxTile);
    const ty = Math.floor(wyTile);
    if (tx < 0 || tx >= OFFICE_COLS || ty < 0 || ty >= OFFICE_ROWS) return null;
    return { tile: { x: tx, y: ty }, wxTile, wyTile };
  };

  const findHitAtCoords = (tile: GridPoint, wxTile: number, wyTile: number) => {
    const state = stateRef.current;
    const hitEmpId = hitTestEmployee(state.employees, tile, wxTile, wyTile);
    const furn = getRenderableFurniture(state.office).find(
      (f) =>
        tile.x >= f.tile.x &&
        tile.x < f.tile.x + f.width &&
        tile.y >= f.tile.y &&
        tile.y < f.tile.y + f.height
    );
    const roomId = findRoomAtTile(state.office, tile);
    return {
      employeeId: hitEmpId,
      furnitureId: furn?.id ?? null,
      roomId,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isTitlePan) return;
    cameraPanGoalRef.current = null;
    dragRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      camStartX: cameraRef.current.x,
      camStartY: cameraRef.current.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isTitlePan) return;
    if (dragRef.current.active) {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      if (Math.hypot(dx, dy) > 6) {
        dragRef.current.moved = true;
        cameraRef.current.x = dragRef.current.camStartX - dx / cameraRef.current.zoom;
        cameraRef.current.y = dragRef.current.camStartY - dy / cameraRef.current.zoom;
      }
    }

    const coords = screenToWorldCoords(e.clientX, e.clientY);
    interactionRef.current.hoveredTile = coords?.tile ?? null;
    if (coords) {
      const hit = findHitAtCoords(coords.tile, coords.wxTile, coords.wyTile);
      interactionRef.current.hoveredRoomId = hit.roomId ?? null;
      const roomUnlocked = hit.roomId ? stateRef.current.office.rooms[hit.roomId]?.unlocked !== false : true;
      interactionRef.current.hoveredEntityId =
        hit.employeeId ?? (roomUnlocked ? hit.furnitureId : null) ?? null;
    } else {
      interactionRef.current.hoveredRoomId = null;
      interactionRef.current.hoveredEntityId = null;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isTitlePan) return;
    const wasMoved = dragRef.current.moved;
    dragRef.current.active = false;
    if (wasMoved) return;

    const coords = screenToWorldCoords(e.clientX, e.clientY);
    if (!coords) return;

    const hit = findHitAtCoords(coords.tile, coords.wxTile, coords.wyTile);
    // Validate walkability when just clicking floor
    const grid = buildWalkabilityGrid(stateRef.current.office);
    const isWalkable = Boolean(grid[coords.tile.y]?.[coords.tile.x]);
    if (hit.employeeId || hit.furnitureId || isWalkable || hit.roomId) {
      onTileClick(coords.tile, hit.employeeId, hit.furnitureId, hit.roomId);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (isTitlePan) return;
    cameraPanGoalRef.current = null;
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    cameraRef.current.zoom = Math.max(0.5, Math.min(2.2, cameraRef.current.zoom + delta));
  };

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          dragRef.current.active = false;
          interactionRef.current.hoveredTile = null;
        }}
        onWheel={handleWheel}
        className="w-full h-full block pixel-canvas cursor-pointer touch-none select-none"
      />

      {!isTitlePan && (
        <div
          role="status"
          aria-live="polite"
          aria-label={`${t('canvasSpeed.label')}: ${speed}x (${t(`canvasSpeed.s${speed}`)})`}
          className={`pointer-events-none select-none absolute top-3 left-3 z-10 flex items-center gap-2 px-3 py-1.5 border transition-colors ${
            pulseActive
              ? 'bg-[#78978A] border-2 border-[#303B38] text-[#303B38]'
              : speed === 0
                ? 'bg-[#EAE5D8]/95 border-[#303B38]/55 text-[#303B38]'
                : 'bg-[#F3F0E7]/95 border-[#303B38]/35 text-[#303B38]'
          }`}
        >
          {pulseActive && (
            <span
              key={`canvas-speed-pulse-${speedShortcutPulseId}`}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 border-2 border-[#303B38] animate-speed-pulse"
            />
          )}
          <span className="flex items-center justify-center w-5 h-5 bg-[#78978A]/40 border border-[#303B38]/30 shrink-0">
            {speed === 0 ? (
              <Pause className="w-3.5 h-3.5 text-[#303B38]" aria-hidden="true" />
            ) : speed === 1 ? (
              <Play className="w-3.5 h-3.5 text-[#303B38]" aria-hidden="true" />
            ) : (
              <FastForward className="w-3.5 h-3.5 text-[#303B38]" aria-hidden="true" />
            )}
          </span>
          <span className="text-[15px] font-bold font-mono-num text-[#303B38] leading-none">
            {speed}x
          </span>
          <span className="text-[13px] font-medium text-[#303B38]/85 leading-none whitespace-nowrap">
            · {t(`canvasSpeed.s${speed}`)}
          </span>
        </div>
      )}
    </div>
  );
};
