import React, { useCallback, useEffect, useRef } from 'react';
import {
  CITY_BUILDINGS,
  findCityLocationAtTile,
  WORLD_LOCATIONS,
  WORLD_MAX_X,
  WORLD_MAX_Y,
  WORLD_MIN_X,
  WORLD_MIN_Y,
} from '@/src/game/data/cityWorld';
import { OFFICE_COLS, OFFICE_ROWS, TILE_SIZE } from '@/src/game/data/officeLayout';
import {
  clampIsoCamera,
  getCharacterFootWorld,
  getWorldIsoBounds,
  hitTestIsoCharacters,
  screenToWorld,
  worldToIso,
  worldToScreen,
  zoomAroundScreenPoint,
} from '@/src/game/engine/isoMath';
import { findRoomAtTile, isNavWalkable } from '@/src/game/engine/pathfinding';
import { buildFullWorldNavGrid } from '@/src/game/systems/openWorldSystem';
import {
  CameraState,
  getRenderableFurniture,
  isFurnitureInUse,
  Particle,
  renderOfficeScene,
  RenderInteractionState,
} from '@/src/game/renderer/pixelRenderer';
import {
  Employee,
  GameState,
  GridPoint,
  RoomId,
  WorldLocationId,
} from '@/src/types/game';

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
  focusFounder: () => void;
  focusLocation: (locationId: WorldLocationId) => void;
  setFollowFounder: (enabled: boolean) => void;
  zoomIn: () => void;
  zoomOut: () => void;
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
    const spriteMatch =
      Math.abs(tx - cx) <= 0.78 && ty >= e.position.y - 0.35 && ty <= e.position.y + 1.15;
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
  selectedRoomId: RoomId | null;
  selectedFurnitureId?: string | null;
  selectedEmployeeId: string | null;
  selectedLocationId?: WorldLocationId | null;
  selectedWorldNpcId?: string | null;
  movingFurnitureId: string | null;
  placingTemplateId: string | null;
  highlightedRoomIds?: RoomId[];
  highlightedEmployeeId?: string | null;
  onFollowFounderChange?: (enabled: boolean) => void;
  onTileClick: (
    tile: GridPoint,
    hitEmployeeId: string | null,
    hitFurnitureId: string | null,
    hitRoomId: RoomId | null,
    worldExtra?: { worldNpcId: string | null; locationId: WorldLocationId | null }
  ) => void;
  onCameraActionRef?: React.MutableRefObject<CameraActionHandle | null>;
}

function getActiveWorldBounds(_state: GameState) {
  return getWorldIsoBounds(WORLD_MIN_X, WORLD_MAX_X + 1, WORLD_MIN_Y, WORLD_MAX_Y + 1);
}

export const OfficeCanvas: React.FC<OfficeCanvasProps> = ({
  stateRef,
  isTitlePan = false,
  selectedRoomId,
  selectedFurnitureId = null,
  selectedEmployeeId,
  selectedLocationId = null,
  selectedWorldNpcId = null,
  movingFurnitureId,
  placingTemplateId,
  highlightedRoomIds,
  highlightedEmployeeId,
  onFollowFounderChange,
  onTileClick,
  onCameraActionRef,
}) => {
  const followFounderRef = useRef(false);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = mq.matches;
    const onChange = (ev: MediaQueryListEvent) => {
      reducedMotionRef.current = ev.matches;
    };
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const setFollowFounder = useCallback(
    (next: boolean) => {
      followFounderRef.current = next;
      onFollowFounderChange?.(next);
    },
    [onFollowFounderChange]
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const initialCenter = worldToIso(OFFICE_COLS / 2, OFFICE_ROWS / 2);
  const cameraRef = useRef<CameraState>({
    x: initialCenter.x,
    y: initialCenter.y,
    zoom: 0.9,
  });
  const targetCameraRef = useRef<CameraState>({
    x: initialCenter.x,
    y: initialCenter.y,
    zoom: 0.9,
  });
  const didInitCameraRef = useRef(false);

  const interactionRef = useRef<RenderInteractionState>({
    hoveredTile: null,
    hoveredEntityId: null,
    hoveredRoomId: null,
    hoveredLocationId: null,
    selectedRoomId,
    selectedFurnitureId,
    selectedLocationId,
    selectedEmployeeId,
    selectedWorldNpcId,
    movingFurnitureId,
    placingTemplateId,
    highlightedRoomIds,
    highlightedEmployeeId,
  });

  interactionRef.current.selectedRoomId = selectedRoomId;
  interactionRef.current.selectedFurnitureId = selectedFurnitureId;
  interactionRef.current.selectedLocationId = selectedLocationId;
  interactionRef.current.selectedEmployeeId = selectedEmployeeId;
  interactionRef.current.selectedWorldNpcId = selectedWorldNpcId;
  interactionRef.current.movingFurnitureId = movingFurnitureId;
  interactionRef.current.placingTemplateId = placingTemplateId;
  interactionRef.current.highlightedRoomIds = highlightedRoomIds;
  interactionRef.current.highlightedEmployeeId = highlightedEmployeeId;

  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
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

  const computeFitCamera = useCallback((): CameraState => {
    const canvas = canvasRef.current;
    const w = canvas?.clientWidth || window.innerWidth;
    const h = canvas?.clientHeight || window.innerHeight;
    const bounds = getWorldIsoBounds(0, OFFICE_COLS, 0, OFFICE_ROWS);
    const fitZoom = Math.min((w - 48) / bounds.width, (h - 48) / bounds.height);
    const zoom = Math.max(0.45, Math.min(1.25, fitZoom));
    return {
      x: bounds.centerIsoX,
      y: bounds.centerIsoY,
      zoom,
    };
  }, []);

  const adjustZoom = useCallback(
    (factor: number) => {
      const canvas = canvasRef.current;
      const bounds = getActiveWorldBounds(stateRef.current);
      if (!canvas) {
        targetCameraRef.current = clampIsoCamera(
          {
            ...targetCameraRef.current,
            zoom: targetCameraRef.current.zoom * factor,
          },
          bounds
        );
        return;
      }
      const zoomed = zoomAroundScreenPoint(
        targetCameraRef.current,
        targetCameraRef.current.zoom * factor,
        canvas.clientWidth * 0.5,
        canvas.clientHeight * 0.5,
        canvas.clientWidth,
        canvas.clientHeight
      );
      targetCameraRef.current = clampIsoCamera(zoomed, bounds);
    },
    [stateRef]
  );

  const resetView = useCallback(() => {
    setFollowFounder(false);
    const fit = computeFitCamera();
    targetCameraRef.current = fit;
    if (!didInitCameraRef.current) {
      cameraRef.current = { ...fit };
    }
  }, [computeFitCamera, setFollowFounder]);

  const focusFounderImmediate = useCallback(() => {
    const st = stateRef.current;
    const foot = getCharacterFootWorld(st.founder.position);
    const iso = worldToIso(foot.x, foot.y);
    const bounds = getActiveWorldBounds(st);
    targetCameraRef.current = clampIsoCamera(
      {
        x: iso.x,
        y: iso.y,
        zoom: Math.max(1.05, targetCameraRef.current.zoom),
      },
      bounds
    );
  }, [stateRef]);

  const focusLocationImmediate = useCallback(
    (locationId: WorldLocationId) => {
      const meta = WORLD_LOCATIONS[locationId];
      if (!meta) return;
      setFollowFounder(false);
      const iso = worldToIso(meta.focusTile.x + 0.5, meta.focusTile.y + 0.5);
      const bounds = getActiveWorldBounds(stateRef.current);
      targetCameraRef.current = clampIsoCamera(
        {
          x: iso.x,
          y: iso.y,
          zoom: Math.max(locationId === 'MAIN_STREET' ? 0.8 : 0.95, targetCameraRef.current.zoom),
        },
        bounds
      );
    },
    [setFollowFounder, stateRef]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const initOrClamp = () => {
      if (!didInitCameraRef.current) {
        const fit = computeFitCamera();
        cameraRef.current = { ...fit };
        targetCameraRef.current = { ...fit };
        didInitCameraRef.current = true;
      } else {
        const bounds = getActiveWorldBounds(stateRef.current);
        targetCameraRef.current = clampIsoCamera(targetCameraRef.current, bounds);
        cameraRef.current = clampIsoCamera(cameraRef.current, bounds);
      }
    };

    initOrClamp();

    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => initOrClamp()) : null;
    if (observer) {
      observer.observe(canvas);
    }

    if (onCameraActionRef) {
      onCameraActionRef.current = {
        focusRoom: (roomId: RoomId) => {
          const room = stateRef.current.office.rooms[roomId];
          if (!room) return;
          setFollowFounder(false);
          const iso = worldToIso(
            room.bounds.x + room.bounds.w / 2,
            room.bounds.y + room.bounds.h / 2
          );
          const bounds = getActiveWorldBounds(stateRef.current);
          targetCameraRef.current = clampIsoCamera(
            {
              x: iso.x,
              y: iso.y,
              zoom: Math.max(1.0, targetCameraRef.current.zoom),
            },
            bounds
          );
        },
        focusEmployee: (employeeId?: string) => {
          const st = stateRef.current;
          const emp = employeeId
            ? st.employees.find((e) => e.id === employeeId)
            : st.employees[0];
          if (!emp) return;
          setFollowFounder(false);
          const foot = getCharacterFootWorld(emp.position);
          const iso = worldToIso(foot.x, foot.y);
          const bounds = getActiveWorldBounds(st);
          targetCameraRef.current = clampIsoCamera(
            {
              x: iso.x,
              y: iso.y,
              zoom: Math.max(1.12, targetCameraRef.current.zoom),
            },
            bounds
          );
        },
        focusFounder: focusFounderImmediate,
        focusLocation: focusLocationImmediate,
        setFollowFounder,
        zoomIn: () => adjustZoom(1.16),
        zoomOut: () => adjustZoom(0.86),
        resetView,
        getWorldTargetRect: (target: WorldTutorialTarget): ScreenRect | null => {
          const c = canvasRef.current;
          if (!c) return null;
          const rect = c.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return null;
          const cam = cameraRef.current;
          const st = stateRef.current;

          let wx = 0;
          let wy = 0;
          let elev = 12;
          let bw = 46 * cam.zoom;
          let bh = 54 * cam.zoom;

          if (target.kind === 'EMPLOYEE') {
            const emp = target.employeeId
              ? st.employees.find((e) => e.id === target.employeeId)
              : st.employees[0];
            if (!emp) return null;
            wx = emp.position.x + 0.5;
            wy = emp.position.y + 0.5;
          } else if (target.kind === 'FOUNDER') {
            wx = st.founder.position.x + 0.5;
            wy = st.founder.position.y + 0.5;
          } else {
            const room = st.office.rooms[target.roomId];
            if (!room) return null;
            wx = room.bounds.x + room.bounds.w / 2;
            wy = room.bounds.y + room.bounds.h / 2;
            elev = 4;
            bw = Math.min(room.bounds.w - 2, 4.2) * 32 * cam.zoom;
            bh = Math.min(room.bounds.h - 2, 3.0) * 24 * cam.zoom;
          }

          const sp = worldToScreen(wx, wy, rect.width, rect.height, cam, elev);
          const sx = rect.left + sp.x;
          const sy = rect.top + sp.y;
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
  }, [
    adjustZoom,
    computeFitCamera,
    focusFounderImmediate,
    focusLocationImmediate,
    isTitlePan,
    onCameraActionRef,
    resetView,
    setFollowFounder,
    stateRef,
  ]);

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

      if (isTitlePan) {
        const center = worldToIso(OFFICE_COLS * 0.5, OFFICE_ROWS * 0.5);
        cameraRef.current.x = center.x + Math.sin(timeSec * 0.18) * 120;
        cameraRef.current.y = center.y + Math.cos(timeSec * 0.14) * 55;
        cameraRef.current.zoom = Math.max(0.62, Math.min(1.05, cw / 1400));
        targetCameraRef.current = { ...cameraRef.current };
      } else {
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
              const roomCenterIso = worldToIso(
                targetRoom.bounds.x + targetRoom.bounds.w * 0.5,
                targetRoom.bounds.y + targetRoom.bounds.h * 0.5
              );
              if (!followFounderRef.current) {
                targetCameraRef.current = clampIsoCamera(
                  {
                    x: roomCenterIso.x,
                    y: roomCenterIso.y,
                    zoom: targetCameraRef.current.zoom,
                  },
                  getActiveWorldBounds(state)
                );
              }
              for (let i = 0; i < 24; i++) {
                const wx =
                  targetRoom.bounds.x + 1 + Math.random() * Math.max(1, targetRoom.bounds.w - 2);
                const wy =
                  targetRoom.bounds.y + 1 + Math.random() * Math.max(1, targetRoom.bounds.h - 2);
                particlesRef.current.push({
                  x: wx * TILE_SIZE,
                  y: wy * TILE_SIZE,
                  wx,
                  wy,
                  wz: 12 + Math.random() * 14,
                  vx: (Math.random() - 0.5) * 1.4,
                  vy: (Math.random() - 0.5) * 1.4,
                  vz: 26 + Math.random() * 28,
                  gravity: 48,
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
              for (let k = 0; k < 4; k++) {
                particlesRef.current.push({
                  x: (pos.x + 0.5) * TILE_SIZE,
                  y: pos.y * TILE_SIZE,
                  wx: pos.x + 0.5 + (Math.random() - 0.5) * 0.4,
                  wy: pos.y + 0.5 + (Math.random() - 0.5) * 0.4,
                  wz: 22,
                  vx: (Math.random() - 0.5) * 1.1,
                  vy: (Math.random() - 0.5) * 1.1,
                  vz: 22 + Math.random() * 20,
                  gravity: 44,
                  life: 1.2 + Math.random() * 0.7,
                  maxLife: 1.9,
                  color: confettiPalette[(idx + k) % confettiPalette.length],
                  size: 3,
                });
              }
            });
          }
        }

        if (activeCel && activeCel.remainingSec > 1.6) {
          celebrationBurstTimerRef.current += dt;
          if (celebrationBurstTimerRef.current >= 0.24) {
            celebrationBurstTimerRef.current = 0;
            const targetRoom = state.office.rooms[activeCel.targetRoomId];
            if (targetRoom) {
              const wx =
                targetRoom.bounds.x + 1 + Math.random() * Math.max(1, targetRoom.bounds.w - 2);
              const wy =
                targetRoom.bounds.y + 1 + Math.random() * Math.max(1, targetRoom.bounds.h - 2);
              particlesRef.current.push({
                x: wx * TILE_SIZE,
                y: wy * TILE_SIZE,
                wx,
                wy,
                wz: 32,
                vx: (Math.random() - 0.5) * 0.6,
                vy: (Math.random() - 0.5) * 0.6,
                vz: -10,
                gravity: 16,
                life: 1.35,
                maxLife: 1.35,
                color: confettiPalette[Math.floor(Math.random() * confettiPalette.length)],
                size: 3,
              });
            }
          }
        }

        // Follow-Founder mode tracks Founder's isometric foot-point smoothly when not dragging
        if (followFounderRef.current && !dragRef.current.active && activePointersRef.current.size === 0) {
          const foot = getCharacterFootWorld(state.founder.position);
          const iso = worldToIso(foot.x, foot.y);
          targetCameraRef.current = clampIsoCamera(
            {
              x: iso.x,
              y: iso.y,
              zoom: targetCameraRef.current.zoom,
            },
            getActiveWorldBounds(state)
          );
        }

        // Smooth camera interpolation toward targetCameraRef
        if (!dragRef.current.active && activePointersRef.current.size === 0) {
          const cam = cameraRef.current;
          const target = targetCameraRef.current;
          const blend = Math.min(1, dt * 10);
          const dx = target.x - cam.x;
          const dy = target.y - cam.y;
          const dz = target.zoom - cam.zoom;
          cam.x = Math.abs(dx) < 0.25 ? target.x : cam.x + dx * blend;
          cam.y = Math.abs(dy) < 0.25 ? target.y : cam.y + dy * blend;
          cam.zoom = Math.abs(dz) < 0.001 ? target.zoom : cam.zoom + dz * blend;
        }
      }

      // Ambient steam / perk particles in world-space
      steamTimer += dt;
      if (steamTimer > 0.28) {
        steamTimer = 0;
        const renderable = getRenderableFurniture(state.office);
        for (const item of renderable) {
          const active = isFurnitureInUse(item, state);
          if (item.templateId === 'ESPRESSO_BAR' || item.templateId === 'PERK_COFFEE_MACHINE') {
            if (active || Math.random() < 0.45) {
              const wx = item.tile.x + item.width * 0.5 + (Math.random() - 0.5) * 0.2;
              const wy = item.tile.y + 0.5;
              particlesRef.current.push({
                x: wx * TILE_SIZE,
                y: wy * TILE_SIZE,
                wx,
                wy,
                wz: 18,
                vx: (Math.random() - 0.5) * 0.2,
                vy: (Math.random() - 0.5) * 0.2,
                vz: active ? 16 : 11,
                life: active ? 1.25 : 0.95,
                maxLife: active ? 1.25 : 0.95,
                color: active ? 'rgba(254, 243, 199, 0.78)' : 'rgba(248, 250, 252, 0.55)',
                size: active ? 3 : 2,
              });
            }
          } else if (item.templateId === 'PERK_PING_PONG' && active && Math.random() < 0.55) {
            const wx = item.tile.x + 0.4 + Math.random() * 1.2;
            const wy = item.tile.y + 0.5;
            particlesRef.current.push({
              x: wx * TILE_SIZE,
              y: wy * TILE_SIZE,
              wx,
              wy,
              wz: 14,
              vx: (Math.random() - 0.5) * 0.5,
              vy: (Math.random() - 0.5) * 0.5,
              vz: 14,
              life: 0.55,
              maxLife: 0.55,
              color: 'rgba(251, 191, 36, 0.85)',
              size: 2,
            });
          } else if (item.templateId === 'PERK_WELLNESS_SUITE' && active && Math.random() < 0.6) {
            const wx = item.tile.x + 1.55;
            const wy = item.tile.y + 0.5;
            particlesRef.current.push({
              x: wx * TILE_SIZE,
              y: wy * TILE_SIZE,
              wx,
              wy,
              wz: 12,
              vx: 0,
              vy: 0,
              vz: 10,
              life: 1.3,
              maxLife: 1.3,
              color: 'rgba(196, 181, 253, 0.7)',
              size: 3,
            });
          }
        }
      }

      const alive: Particle[] = [];
      for (const p of particlesRef.current) {
        if (p.wx !== undefined && p.wy !== undefined) {
          p.vz = (p.vz ?? 0) - (p.gravity ?? 0) * dt;
          p.wx += p.vx * dt;
          p.wy += p.vy * dt;
          p.wz = Math.max(0, (p.wz ?? 0) + (p.vz ?? 0) * dt);
        } else {
          p.vy += (p.gravity ?? 0) * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        }
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
        timeSec,
        reducedMotionRef.current
      );

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [isTitlePan, stateRef]);

  const screenToWorldCoords = (
    clientX: number,
    clientY: number
  ): {
    sx: number;
    sy: number;
    rectW: number;
    rectH: number;
    tile: GridPoint;
    wxTile: number;
    wyTile: number;
  } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const wPos = screenToWorld(sx, sy, rect.width, rect.height, cameraRef.current);
    const tx = Math.floor(wPos.x);
    const ty = Math.floor(wPos.y);
    if (tx < WORLD_MIN_X || tx > WORLD_MAX_X || ty < WORLD_MIN_Y || ty > WORLD_MAX_Y) return null;
    return {
      sx,
      sy,
      rectW: rect.width,
      rectH: rect.height,
      tile: { x: tx, y: ty },
      wxTile: wPos.x,
      wyTile: wPos.y,
    };
  };

  const findHitAtCoords = (
    sx: number,
    sy: number,
    rectW: number,
    rectH: number,
    tile: GridPoint,
    wxTile: number,
    wyTile: number
  ) => {
    const state = stateRef.current;
    const hitIsoEmpId = hitTestIsoCharacters(
      state.employees,
      sx,
      sy,
      rectW,
      rectH,
      cameraRef.current
    );
    const hitEmpId = hitIsoEmpId ?? hitTestEmployee(state.employees, tile, wxTile, wyTile);

    const worldNpcs = state.world?.npcs ?? [];
    const hitWorldNpcId = hitEmpId
      ? null
      : hitTestIsoCharacters(worldNpcs, sx, sy, rectW, rectH, cameraRef.current) ??
        hitTestEmployee(worldNpcs, tile, wxTile, wyTile);

    const furn = getRenderableFurniture(state.office).find(
      (f) =>
        tile.x >= f.tile.x &&
        tile.x < f.tile.x + f.width &&
        tile.y >= f.tile.y &&
        tile.y < f.tile.y + f.height
    );
    const roomId = findRoomAtTile(state.office, tile);

    const hitBuilding = CITY_BUILDINGS.find(
      (b) =>
        tile.x >= b.bounds.x &&
        tile.x < b.bounds.x + b.bounds.w &&
        tile.y >= b.bounds.y &&
        tile.y < b.bounds.y + b.bounds.h
    );
    const locationId: WorldLocationId | null =
      hitBuilding?.id ?? (!roomId ? findCityLocationAtTile(tile) : null);

    return {
      employeeId: hitEmpId,
      worldNpcId: hitWorldNpcId,
      furnitureId: furn?.id ?? null,
      roomId,
      locationId,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isTitlePan) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointersRef.current.size === 1) {
      dragRef.current = {
        active: true,
        moved: false,
        startX: e.clientX,
        startY: e.clientY,
        camStartX: cameraRef.current.x,
        camStartY: cameraRef.current.y,
      };
    } else {
      // Multi-touch pinch engaged: disable single-finger click trigger
      dragRef.current.moved = true;
      dragRef.current.active = false;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isTitlePan) return;
    const canvas = canvasRef.current;
    const prevPtr = activePointersRef.current.get(e.pointerId);
    if (prevPtr) {
      if (activePointersRef.current.size === 2 && canvas) {
        // 2-finger pinch zoom + midpoint pan
        const pts = Array.from(activePointersRef.current.entries());
        const other = pts.find(([id]) => id !== e.pointerId)?.[1];
        if (other) {
          const prevMidX = (prevPtr.x + other.x) * 0.5;
          const prevMidY = (prevPtr.y + other.y) * 0.5;
          const prevDist = Math.hypot(prevPtr.x - other.x, prevPtr.y - other.y);

          activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

          const nextMidX = (e.clientX + other.x) * 0.5;
          const nextMidY = (e.clientY + other.y) * 0.5;
          const nextDist = Math.hypot(e.clientX - other.x, e.clientY - other.y);

          const rect = canvas.getBoundingClientRect();
          const panDx = nextMidX - prevMidX;
          const panDy = nextMidY - prevMidY;
          let nextCam = {
            ...cameraRef.current,
            x: cameraRef.current.x - panDx / cameraRef.current.zoom,
            y: cameraRef.current.y - panDy / cameraRef.current.zoom,
          };

          if (prevDist > 12 && nextDist > 12) {
            const scale = nextDist / prevDist;
            nextCam = zoomAroundScreenPoint(
              nextCam,
              nextCam.zoom * scale,
              nextMidX - rect.left,
              nextMidY - rect.top,
              rect.width,
              rect.height
            );
          }

          if (followFounderRef.current) setFollowFounder(false);
          const clamped = clampIsoCamera(nextCam, getActiveWorldBounds(stateRef.current));
          cameraRef.current = clamped;
          targetCameraRef.current = clamped;
          return;
        }
      }

      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (dragRef.current.active && activePointersRef.current.size <= 1) {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      if (Math.hypot(dx, dy) > 6) {
        dragRef.current.moved = true;
        if (followFounderRef.current) setFollowFounder(false);
        const clamped = clampIsoCamera(
          {
            x: dragRef.current.camStartX - dx / cameraRef.current.zoom,
            y: dragRef.current.camStartY - dy / cameraRef.current.zoom,
            zoom: cameraRef.current.zoom,
          },
          getActiveWorldBounds(stateRef.current)
        );
        cameraRef.current = clamped;
        targetCameraRef.current = clamped;
      }
    }

    const coords = screenToWorldCoords(e.clientX, e.clientY);
    interactionRef.current.hoveredTile = coords?.tile ?? null;
    if (coords) {
      const hit = findHitAtCoords(
        coords.sx,
        coords.sy,
        coords.rectW,
        coords.rectH,
        coords.tile,
        coords.wxTile,
        coords.wyTile
      );
      interactionRef.current.hoveredRoomId = hit.roomId ?? null;
      interactionRef.current.hoveredLocationId = hit.locationId ?? null;
      const roomUnlocked = hit.roomId
        ? stateRef.current.office.rooms[hit.roomId]?.unlocked !== false
        : true;
      interactionRef.current.hoveredEntityId =
        hit.employeeId ?? hit.worldNpcId ?? (roomUnlocked ? hit.furnitureId : null) ?? null;
    } else {
      interactionRef.current.hoveredRoomId = null;
      interactionRef.current.hoveredLocationId = null;
      interactionRef.current.hoveredEntityId = null;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    activePointersRef.current.delete(e.pointerId);
    if (isTitlePan) return;
    const wasMoved = dragRef.current.moved;
    if (activePointersRef.current.size === 0) {
      dragRef.current.active = false;
    }
    if (wasMoved || activePointersRef.current.size > 0) return;

    const coords = screenToWorldCoords(e.clientX, e.clientY);
    if (!coords) return;

    const hit = findHitAtCoords(
      coords.sx,
      coords.sy,
      coords.rectW,
      coords.rectH,
      coords.tile,
      coords.wxTile,
      coords.wyTile
    );
    const worldNav = buildFullWorldNavGrid(stateRef.current);
    const isWalkable = isNavWalkable(worldNav, coords.tile.x, coords.tile.y);
    if (hit.employeeId || hit.worldNpcId || hit.furnitureId || hit.roomId || hit.locationId || isWalkable) {
      onTileClick(coords.tile, hit.employeeId, hit.furnitureId, hit.roomId, {
        worldNpcId: hit.worldNpcId,
        locationId: hit.locationId,
      });
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    activePointersRef.current.delete(e.pointerId);
    dragRef.current.active = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (isTitlePan) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const factor = e.deltaY > 0 ? 0.9 : 1.11;
    const nextZoom = targetCameraRef.current.zoom * factor;
    const zoomed = zoomAroundScreenPoint(
      targetCameraRef.current,
      nextZoom,
      sx,
      sy,
      rect.width,
      rect.height
    );
    targetCameraRef.current = clampIsoCamera(zoomed, getActiveWorldBounds(stateRef.current));
  };

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={() => {
          activePointersRef.current.clear();
          dragRef.current.active = false;
          interactionRef.current.hoveredTile = null;
          interactionRef.current.hoveredRoomId = null;
          interactionRef.current.hoveredLocationId = null;
          interactionRef.current.hoveredEntityId = null;
        }}
        onWheel={handleWheel}
        className="w-full h-full block pixel-canvas cursor-pointer touch-none select-none"
      />
    </div>
  );
};
