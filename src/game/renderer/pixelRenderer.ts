import {
  FURNITURE_CATALOG,
  OFFICE_COLS,
  OFFICE_ROWS,
  PERK_FURNITURE_SPECS,
  TILE_SIZE,
} from '@/src/game/data/officeLayout';
import { canPlaceFurnitureAt } from '@/src/game/engine/pathfinding';
import { getWeatherSnapshot, WeatherSnapshot } from '@/src/game/systems/weatherSystem';
import {
  CharacterAppearance,
  Employee,
  Founder,
  FurnitureItem,
  GameState,
  GridPoint,
  OfficeRoom,
  OfficeState,
  RoomId,
  VisitorNPC,
} from '@/src/types/game';
import { getFurnitureLocalized, getRoomLocalized, t } from '@/src/localization';
import { formatCurrency } from '@/src/utils/format';

export interface CameraState {
  x: number; // world center x
  y: number; // world center y
  zoom: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity?: number;
  life: number;
  maxLife: number;
  color: string;
  text?: string;
  size: number;
}

export interface RenderInteractionState {
  hoveredTile: GridPoint | null;
  hoveredEntityId: string | null;
  hoveredRoomId?: RoomId | null;
  selectedRoomId: RoomId | null;
  selectedEmployeeId: string | null;
  movingFurnitureId: string | null;
  placingTemplateId: string | null;
  highlightedRoomIds?: RoomId[];
  highlightedEmployeeId?: string | null;
}

const FLOOR_COLORS: Record<OfficeRoom['floorStyle'], { base: string; alt: string; seam: string }> = {
  WOOD: { base: '#C79663', alt: '#BF8D5B', seam: '#9E6E42' },
  CARPET_BLUE: { base: '#96A9BF', alt: '#8CA0B7', seam: '#778A9F' },
  CARPET_WARM: { base: '#C98A7D', alt: '#BF8073', seam: '#A4685C' },
  TILE: { base: '#E8E3D5', alt: '#DED8C8', seam: '#C7BFAE' },
  CONCRETE: { base: '#7B8F86', alt: '#72867D', seam: '#5E7068' },
};

function drawRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function getSkyColor(hour: number, weather: WeatherSnapshot): string {
  if (hour >= 17.5) return '#303B38';
  if (weather.rainIntensity >= 0.4) return '#7B8FA3';
  if (weather.overcastIntensity >= 0.4) return '#9AA8B7';
  if (hour < 9.5) return '#A8B8CE';
  if (hour < 15.5) return weather.sunlightIntensity > 0.55 ? '#C8D8EA' : '#BDCCE0';
  return '#D9A66C';
}

function drawRoomFloor(ctx: CanvasRenderingContext2D, room: OfficeRoom) {
  const { x, y, w, h } = room.bounds;
  const palette = FLOOR_COLORS[room.floorStyle];

  for (let ty = y + 1; ty < y + h - 1; ty++) {
    for (let tx = x + 1; tx < x + w - 1; tx++) {
      const px = tx * TILE_SIZE;
      const py = ty * TILE_SIZE;
      const isAlt =
        room.floorStyle === 'WOOD'
          ? ty % 2 === 0
          : (tx + ty) % 2 === 0;
      drawRect(ctx, px, py, TILE_SIZE, TILE_SIZE, isAlt ? palette.alt : palette.base);
      ctx.fillStyle = palette.seam;
      if (room.floorStyle === 'WOOD') {
        ctx.fillRect(px, py + TILE_SIZE - 2, TILE_SIZE, 1);
        if ((tx + ty) % 2 === 0) {
          ctx.fillRect(px + 14, py, 1, TILE_SIZE);
        }
      } else {
        ctx.fillRect(px, py, TILE_SIZE, 1);
        ctx.fillRect(px, py, 1, TILE_SIZE);
      }
    }
  }

  // CEO Office cozy woven rug (Dusty Rose + Warm Wood + Sage trim)
  if (room.id === 'CEO_OFFICE') {
    const rx = (x + 2) * TILE_SIZE + 6;
    const ry = (y + 3) * TILE_SIZE + 4;
    drawRect(ctx, rx, ry, 4 * TILE_SIZE - 12, 4 * TILE_SIZE - 8, '#D68B7B');
    drawRect(ctx, rx + 4, ry + 4, 4 * TILE_SIZE - 20, 4 * TILE_SIZE - 16, '#D9A66C');
    drawRect(ctx, rx + 8, ry + 8, 4 * TILE_SIZE - 28, 4 * TILE_SIZE - 24, '#F3F0E7');
    drawRect(ctx, rx + 14, ry + 14, 4 * TILE_SIZE - 40, 4 * TILE_SIZE - 36, '#78978A');
  }

  // Break Room cozy soft-cream floor mat
  if (room.id === 'BREAK_ROOM') {
    const rx = (x + 2) * TILE_SIZE + 8;
    const ry = (y + 2) * TILE_SIZE + 8;
    drawRect(ctx, rx, ry, 3 * TILE_SIZE - 16, 2 * TILE_SIZE - 16, 'rgba(243, 240, 231, 0.45)');
  }
}

function drawWallsAndCorridor(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  timeSec: number,
  selectedRoomId: RoomId | null,
  weather: WeatherSnapshot
) {
  // Cozy warm cream-stone corridor floor y=11..12
  for (let ty = 11; ty <= 12; ty++) {
    for (let tx = 1; tx < OFFICE_COLS - 1; tx++) {
      const px = tx * TILE_SIZE;
      const py = ty * TILE_SIZE;
      const alt = (tx + ty) % 2 === 0;
      drawRect(ctx, px, py, TILE_SIZE, TILE_SIZE, alt ? '#DDD6C6' : '#D5CEBD');
      drawRect(ctx, px, py + TILE_SIZE - 2, TILE_SIZE, 1, '#BFB7A6');
    }
  }
  // Cozy sage & wood corridor runner
  drawRect(ctx, TILE_SIZE, 11 * TILE_SIZE + 26, (OFFICE_COLS - 2) * TILE_SIZE, 12, '#78978A');
  drawRect(ctx, TILE_SIZE, 11 * TILE_SIZE + 28, (OFFICE_COLS - 2) * TILE_SIZE, 8, '#D9A66C');

  const sky = getSkyColor(state.hourOfDay, weather);

  // Draw cozy framed walls & sunlit windows
  for (const room of Object.values(state.office.rooms)) {
    const { x, y, w, h } = room.bounds;
    const isTop = y < 11;
    const doorX1 = x + Math.floor(w / 2) - 1;
    const doorX2 = doorX1 + 1;

    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) {
        const isBorder = tx === x || tx === x + w - 1 || ty === y || ty === y + h - 1;
        if (!isBorder) continue;

        const isDoor =
          (isTop && ty === y + h - 1 && (tx === doorX1 || tx === doorX2)) ||
          (!isTop && ty === y && (tx === doorX1 || tx === doorX2));

        const px = tx * TILE_SIZE;
        const py = ty * TILE_SIZE;

        if (isDoor && room.unlocked) {
          // Warm wood doorway threshold with crisp side jambs
          drawRect(ctx, px, py, TILE_SIZE, TILE_SIZE, '#D5CEBD');
          drawRect(ctx, px, py + 11, TILE_SIZE, 10, '#D9A66C');
          drawRect(ctx, px, py + 19, TILE_SIZE, 2, '#9E6E42');
          drawRect(ctx, px, py + 6, 3, 20, '#303B38');
          drawRect(ctx, px + TILE_SIZE - 3, py + 6, 3, 20, '#303B38');
          continue;
        }

        // Cozy dark-charcoal architectural wall with warm cream wainscotting
        drawRect(ctx, px, py, TILE_SIZE, TILE_SIZE, '#303B38');
        drawRect(ctx, px, py, TILE_SIZE, 9, '#495853');
        drawRect(ctx, px + 2, py + 9, TILE_SIZE - 4, TILE_SIZE - 13, '#3B4844');
        drawRect(ctx, px, py + TILE_SIZE - 4, TILE_SIZE, 4, '#242D2A');

        // Exterior windows along top & bottom outer walls
        if ((ty === 0 || ty === OFFICE_ROWS - 1) && tx % 3 === 0 && tx > 1 && tx < OFFICE_COLS - 2) {
          drawRect(ctx, px + 4, py + 6, TILE_SIZE - 8, 18, '#D9A66C');
          drawRect(ctx, px + 6, py + 8, TILE_SIZE - 12, 14, sky);
          // Window mullion
          drawRect(ctx, px + 15, py + 8, 2, 14, '#F3F0E7');
          // Subtle glass glint or animated window raindrop streaks
          if (weather.rainIntensity >= 0.35) {
            const dropShift = Math.floor(timeSec * 8 + tx) % 4;
            drawRect(ctx, px + 8, py + 9 + dropShift * 2, 2, 4, 'rgba(243, 240, 231, 0.55)');
            drawRect(ctx, px + 19, py + 14 - dropShift, 2, 3, 'rgba(243, 240, 231, 0.45)');
          } else if (Math.floor(timeSec) % 4 !== 0) {
            drawRect(ctx, px + 8, py + 10, 4, 3, 'rgba(243, 240, 231, 0.55)');
          }
          // Warm daytime light shaft spilling onto room floor (brightens on sunlit shifts, softens during rain)
          if (state.hourOfDay < 17.5 && room.unlocked) {
            const sunPulse = 0.08 + weather.sunlightIntensity * 0.1 + 0.03 * Math.sin(timeSec * 0.65 + tx);
            const shaftAlpha = Math.max(0.03, sunPulse * (1 - weather.rainIntensity * 0.7));
            ctx.fillStyle =
              state.hourOfDay >= 15.5 || weather.sunlightIntensity > 0.5
                ? `rgba(217, 166, 108, ${shaftAlpha.toFixed(3)})`
                : `rgba(243, 240, 231, ${shaftAlpha.toFixed(3)})`;
            if (ty === 0) {
              ctx.fillRect(px + 6, py + TILE_SIZE, TILE_SIZE - 12, TILE_SIZE * 1.4);
            } else {
              ctx.fillRect(px + 6, py - TILE_SIZE * 1.2, TILE_SIZE - 12, TILE_SIZE * 1.2);
            }
          }
        } else if (ty === 0 && tx === 17 && room.id === 'ENGINEERING') {
          // Animated cozy pixel wall clock (placed between exterior windows)
          const cx = px + 16;
          const cy = py + 15;
          drawRect(ctx, cx - 8, cy - 8, 16, 16, '#9E6E42');
          drawRect(ctx, cx - 6, cy - 6, 12, 12, '#F3F0E7');
          // Subtle clock tick markers
          drawRect(ctx, cx - 1, cy - 5, 2, 1, '#303B38');
          drawRect(ctx, cx + 4, cy - 1, 1, 2, '#303B38');
          drawRect(ctx, cx - 1, cy + 4, 2, 1, '#303B38');
          drawRect(ctx, cx - 5, cy - 1, 1, 2, '#303B38');
          // Rotating hour & minute hands driven by hourOfDay
          const hourAngle = ((state.hourOfDay % 12) / 12) * Math.PI * 2 - Math.PI / 2;
          const minAngle = ((state.hourOfDay % 1) * Math.PI * 2) - Math.PI / 2;
          ctx.save();
          ctx.strokeStyle = '#303B38';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(hourAngle) * 3.5, cy + Math.sin(hourAngle) * 3.5);
          ctx.stroke();
          ctx.strokeStyle = '#78978A';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(minAngle) * 4.8, cy + Math.sin(minAngle) * 4.8);
          ctx.stroke();
          ctx.restore();
          drawRect(ctx, cx - 1, cy - 1, 2, 2, '#D9A66C');
        }
      }
    }

    // Room label plaque only on unlocked rooms (or currently selected locked room) to avoid canvas clutter
    if (room.unlocked || selectedRoomId === room.id) {
      const plaqueX = (x + w / 2) * TILE_SIZE;
      const plaqueY = isTop ? (y + 1) * TILE_SIZE + 9 : (y + h - 1) * TILE_SIZE - 9;
      const localizedRoom = getRoomLocalized(room.id, room.unlockCost);
      ctx.save();
      ctx.font = 'bold 12px Arial, Helvetica, sans-serif';
      ctx.textAlign = 'center';
      const text = localizedRoom.name;
      const tw = ctx.measureText(text).width + 14;
      drawRect(ctx, plaqueX - tw / 2, plaqueY - 10, tw, 17, '#F3F0E7');
      ctx.strokeStyle = 'rgba(48, 59, 56, 0.48)';
      ctx.lineWidth = 1;
      ctx.strokeRect(plaqueX - tw / 2, plaqueY - 10, tw, 17);
      ctx.fillStyle = '#303B38';
      ctx.fillText(text, plaqueX, plaqueY + 2);
      ctx.restore();
    }
  }
}

export function getRenderableFurniture(office: OfficeState): FurnitureItem[] {
  const items = [...office.furniture];
  const ownedPerks = office.purchasedPerks ?? [];
  for (const perkId of ownedPerks) {
    const spec = PERK_FURNITURE_SPECS.find((p) => p.perkId === perkId);
    if (!spec) continue;
    const exists = items.some(
      (f) => f.templateId === spec.templateId || f.id === `furn_${spec.perkId}`
    );
    if (!exists) {
      items.push({
        id: `furn_${spec.perkId}`,
        templateId: spec.templateId,
        name: spec.name,
        roomId: spec.roomId,
        tile: { ...spec.preferredTile },
        width: spec.width,
        height: spec.height,
        tier: 1,
        interactiveAction: spec.interactiveAction,
        comfortBonus: spec.comfortBonus,
        productivityBonus: spec.productivityBonus,
      });
    }
  }
  return items;
}

export function isFurnitureInUse(item: FurnitureItem, state: GameState): boolean {
  const cx = item.tile.x + item.width / 2;
  const cy = item.tile.y + item.height / 2;

  const nearByEmp = state.employees.some((emp) => {
    if (emp.state === 'WALKING') return false;
    const dist = Math.hypot(emp.position.x + 0.5 - cx, emp.position.y + 0.5 - cy);
    return dist <= 2.3;
  });
  if (nearByEmp) return true;

  const founderNearby =
    state.founder.state !== 'WALKING' &&
    Math.hypot(state.founder.position.x + 0.5 - cx, state.founder.position.y + 0.5 - cy) <= 1.8;
  if (founderNearby) return true;

  if (
    item.templateId === 'PERK_QUIET_POD' ||
    item.templateId === 'WORKSTATION' ||
    item.templateId === 'CEO_DESK'
  ) {
    return state.employees.some(
      (e) => e.homeRoom === item.roomId && e.state === 'WORKING'
    );
  }

  return false;
}

function drawFurnitureItem(
  ctx: CanvasRenderingContext2D,
  item: FurnitureItem,
  timeSec: number,
  techTier: number,
  hasErgonomicChairs: boolean,
  inUse: boolean,
  isHovered: boolean,
  isMoving: boolean
) {
  const px = item.tile.x * TILE_SIZE;
  const py = item.tile.y * TILE_SIZE;
  const pw = item.width * TILE_SIZE;
  const ph = item.height * TILE_SIZE;

  // Soft drop shadow
  ctx.fillStyle = 'rgba(48, 59, 56, 0.24)';
  ctx.fillRect(px + 3, py + ph - 5, pw - 4, 8);

  switch (item.templateId) {
    case 'CEO_DESK': {
      const screenGlow = 0.14 + 0.08 * Math.sin(timeSec * 2.2 + px * 0.03);
      drawRect(ctx, px + 2, py + 6, pw - 4, ph - 10, '#9E6E42');
      drawRect(ctx, px + 4, py + 8, pw - 8, ph - 18, '#D9A66C');
      // Soft monitor glow halo on desk surface
      ctx.fillStyle = `rgba(184, 201, 223, ${screenGlow.toFixed(3)})`;
      ctx.fillRect(px + 20, py + 8, 48, 18);
      // Dual monitors (Soft Blue screens + active cursor glint)
      drawRect(ctx, px + 22, py + 10, 20, 12, '#303B38');
      drawRect(ctx, px + 24, py + 12, 16, 8, '#A8B8CE');
      drawRect(ctx, px + 46, py + 10, 20, 12, '#303B38');
      drawRect(ctx, px + 48, py + 12, 16, 8, '#B8C9DF');
      const ceoScan = Math.floor(timeSec * 2.5) % 3;
      drawRect(ctx, px + 26, py + 13 + ceoScan * 2, 9, 1, '#F3F0E7');
      drawRect(ctx, px + 50, py + 14 + ((ceoScan + 1) % 3) * 2, 10, 1, '#F3F0E7');
      // Warm brass desk lamp with soft ambient glow
      drawRect(ctx, px + 10, py + 14, 8, 8, '#D9A66C');
      drawRect(ctx, px + 12, py + 16, 4, 4, '#F3F0E7');
      // Cozy mug + subtle steam wisp
      drawRect(ctx, px + pw - 16, py + 15, 5, 5, '#D68B7B');
      if (Math.sin(timeSec * 2.6 + px) > 0) {
        const wispY = Math.round(Math.sin(timeSec * 3.5) * 1.5);
        drawRect(ctx, px + pw - 14, py + 11 + wispY, 2, 2, 'rgba(243, 240, 231, 0.72)');
      }
      if (hasErgonomicChairs) {
        const swivel = inUse ? Math.round(Math.sin(timeSec * 4)) : 0;
        drawRect(ctx, px + pw / 2 - 9 + swivel, py + ph - 4, 18, 8, '#303B38');
        drawRect(ctx, px + pw / 2 - 7 + swivel, py + ph - 2, 14, 3, '#78978A');
      }
      break;
    }
    case 'WORKSTATION': {
      const wsGlow = (inUse ? 0.2 : 0.1) + 0.07 * Math.sin(timeSec * 2.4 + px * 0.05);
      drawRect(ctx, px + 2, py + 4, pw - 4, ph - 6, '#9E6E42');
      drawRect(ctx, px + 4, py + 6, pw - 8, ph - 12, '#D9A66C');
      // Subtle monitor screen halo
      ctx.fillStyle = `rgba(184, 201, 223, ${wsGlow.toFixed(3)})`;
      ctx.fillRect(px + 16, py + 3, 28, 17);
      // Monitor (Soft Blue -> Sage upgrades with techTier!)
      const screenColor =
        techTier >= 3 ? '#78978A' : techTier === 2 ? '#9CC0B0' : '#A8B8CE';
      drawRect(ctx, px + 18, py + 4, 24, 13, '#303B38');
      drawRect(ctx, px + 20, py + 6, 20, 9, screenColor);
      // Animated code lines
      const lineOffset = Math.floor(timeSec * (inUse ? 5 : 2)) % 3;
      drawRect(ctx, px + 22, py + 8 + lineOffset * 2, 10, 1, '#F3F0E7');
      drawRect(ctx, px + 22, py + 7 + ((lineOffset + 1) % 3) * 2, 7, 1, 'rgba(243,240,231,0.6)');
      // Keyboard + dusty rose mug + tiny steam wisp when active
      drawRect(ctx, px + 22, py + 20, 16, 4, '#303B38');
      drawRect(ctx, px + 48, py + 16, 6, 6, '#F3F0E7');
      drawRect(ctx, px + 49, py + 17, 4, 4, '#D68B7B');
      if (inUse && Math.sin(timeSec * 2.8 + px) > 0.1) {
        const wispY = Math.round(Math.sin(timeSec * 3.8 + py) * 1.5);
        drawRect(ctx, px + 50, py + 12 + wispY, 2, 2, 'rgba(243, 240, 231, 0.7)');
      }
      if (hasErgonomicChairs) {
        const swivel = inUse ? Math.round(Math.sin(timeSec * 5)) : 0;
        drawRect(ctx, px + 23 + swivel, py + ph - 4, 18, 7, '#303B38');
        drawRect(ctx, px + 25 + swivel, py + ph - 2, 14, 3, '#78978A');
      }
      break;
    }
    case 'ESPRESSO_BAR': {
      drawRect(ctx, px + 2, py + 4, pw - 4, ph - 6, '#9E6E42');
      drawRect(ctx, px + 4, py + 6, pw - 8, ph - 12, '#D9A66C');
      // Cozy cream espresso machine unit
      drawRect(ctx, px + 10, py + 4, 24, 18, '#F3F0E7');
      drawRect(ctx, px + 14, py + 8, 16, 8, '#303B38');
      drawRect(ctx, px + 28, py + 10, 3, 3, '#D68B7B');
      // Cups
      drawRect(ctx, px + 42, py + 14, 6, 6, '#F3F0E7');
      drawRect(ctx, px + 50, py + 14, 6, 6, '#D68B7B');
      break;
    }
    case 'SERVER_RACK': {
      drawRect(ctx, px + 4, py + 4, pw - 8, ph - 6, '#303B38');
      drawRect(ctx, px + 6, py + 6, pw - 12, ph - 12, '#414F4B');
      for (let row = 0; row < 5; row++) {
        const sy = py + 10 + row * 9;
        drawRect(ctx, px + 8, sy, pw - 16, 6, '#303B38');
        const blink = Math.floor(timeSec * 4 + row) % 3 === 0;
        drawRect(ctx, px + 10, sy + 2, 3, 2, blink ? '#78978A' : '#4E675C');
        drawRect(ctx, px + 15, sy + 2, 3, 2, row % 2 === 0 ? '#A8B8CE' : '#D9A66C');
      }
      break;
    }
    case 'MEETING_TABLE': {
      drawRect(ctx, px + 6, py + 8, pw - 12, ph - 14, '#9E6E42');
      drawRect(ctx, px + 10, py + 12, pw - 20, ph - 22, '#D9A66C');
      // Laptops & warm cream notepads
      drawRect(ctx, px + 26, py + 18, 14, 10, '#303B38');
      drawRect(ctx, px + 28, py + 20, 10, 6, '#A8B8CE');
      drawRect(ctx, px + 76, py + 32, 14, 10, '#303B38');
      drawRect(ctx, px + 78, py + 34, 10, 6, '#A8B8CE');
      drawRect(ctx, px + 54, py + 24, 12, 14, '#F3F0E7');
      break;
    }
    case 'WHITEBOARD': {
      drawRect(ctx, px + 4, py + 4, pw - 8, ph - 10, '#9E6E42');
      drawRect(ctx, px + 6, py + 6, pw - 12, ph - 14, '#F3F0E7');
      drawRect(ctx, px + 10, py + 10, 12, 6, '#A8B8CE');
      drawRect(ctx, px + 26, py + 10, 14, 6, '#D9A66C');
      drawRect(ctx, px + 44, py + 12, 10, 5, '#78978A');
      drawRect(ctx, px + 14, py + 18, 10, 4, '#D68B7B');
      break;
    }
    case 'PLANT_FIDDLE': {
      const leafSway = Math.round(Math.sin(timeSec * 1.4 + px * 0.05));
      // Terracotta Dusty Rose Pot
      drawRect(ctx, px + 9, py + 18, 14, 11, '#B86E5F');
      drawRect(ctx, px + 7, py + 16, 18, 4, '#D68B7B');
      // Cozy Sage Leaves gently swaying in office breeze
      drawRect(ctx, px + 6 + leafSway, py + 6, 10, 10, '#5A786B');
      drawRect(ctx, px + 15 + leafSway, py + 4, 11, 11, '#78978A');
      drawRect(ctx, px + 10 + Math.round(leafSway * 0.5), py + 9, 12, 9, '#8FB0A2');
      break;
    }
    case 'LOUNGE_SOFA': {
      drawRect(ctx, px + 3, py + 6, pw - 6, ph - 8, '#303B38');
      drawRect(ctx, px + 6, py + 4, pw - 12, 8, '#5A786B');
      drawRect(ctx, px + 6, py + 12, pw - 12, ph - 16, '#78978A');
      // Cozy pillows
      drawRect(ctx, px + 9, py + 12, 10, 10, '#D9A66C');
      drawRect(ctx, px + pw - 19, py + 12, 10, 10, '#D68B7B');
      break;
    }
    case 'ARCADE_CABINET': {
      drawRect(ctx, px + 5, py + 3, 22, 26, '#303B38');
      drawRect(ctx, px + 7, py + 7, 18, 12, '#F3F0E7');
      const glow = Math.floor(timeSec * 3) % 2 === 0 ? '#D68B7B' : '#A8B8CE';
      drawRect(ctx, px + 9, py + 9, 14, 8, glow);
      drawRect(ctx, px + 9, py + 21, 4, 3, '#D9A66C');
      drawRect(ctx, px + 18, py + 21, 4, 3, '#78978A');
      break;
    }
    case 'SAFE_VAULT': {
      drawRect(ctx, px + 4, py + 4, 24, 24, '#303B38');
      drawRect(ctx, px + 7, py + 7, 18, 18, '#A8B8CE');
      drawRect(ctx, px + 13, py + 13, 6, 6, '#D9A66C');
      break;
    }
    case 'BOOKSHELF': {
      drawRect(ctx, px + 2, py + 4, pw - 4, ph - 6, '#9E6E42');
      drawRect(ctx, px + 4, py + 6, pw - 8, ph - 10, '#D9A66C');
      drawRect(ctx, px + 6, py + 8, 8, 12, '#D68B7B');
      drawRect(ctx, px + 15, py + 8, 8, 12, '#A8B8CE');
      drawRect(ctx, px + 24, py + 8, 8, 12, '#78978A');
      drawRect(ctx, px + 34, py + 8, 10, 12, '#F3F0E7');
      drawRect(ctx, px + 46, py + 8, 8, 12, '#303B38');
      break;
    }
    case 'PERK_COFFEE_MACHINE': {
      // Warm charcoal & brass artisan espresso bar
      drawRect(ctx, px + 3, py + 6, 26, 22, '#303B38');
      drawRect(ctx, px + 5, py + 8, 22, 18, '#495853');
      // Brewer body + hopper
      drawRect(ctx, px + 7, py + 3, 18, 16, '#D9A66C');
      drawRect(ctx, px + 9, py + 2, 14, 4, '#9E6E42');
      drawRect(ctx, px + 9, py + 8, 14, 9, '#303B38');
      // Status LED
      const ledColor = inUse
        ? Math.floor(timeSec * 4) % 2 === 0
          ? '#78978A'
          : '#D9A66C'
        : '#D9A66C';
      drawRect(ctx, px + 21, py + 5, 3, 3, ledColor);
      // Cream mug & animated brew drip when in use
      drawRect(ctx, px + 13, py + 15, 6, 6, '#F3F0E7');
      if (inUse) {
        const drip = Math.floor(timeSec * 10) % 2;
        drawRect(ctx, px + 15, py + 11 + drip, 2, 4, '#9E6E42');
      }
      break;
    }
    case 'PERK_PING_PONG': {
      // Muted Sage & charcoal ping-pong table (2x1)
      drawRect(ctx, px + 3, py + 5, pw - 6, ph - 8, '#303B38');
      drawRect(ctx, px + 5, py + 7, pw - 10, ph - 12, '#78978A');
      // Warm cream border & center line
      drawRect(ctx, px + 5, py + 7, pw - 10, 1, '#F3F0E7');
      drawRect(ctx, px + 5, py + ph - 6, pw - 10, 1, '#F3F0E7');
      drawRect(ctx, px + 5, py + Math.floor(ph / 2), pw - 10, 1, 'rgba(243,240,231,0.65)');
      // Net in the middle
      drawRect(ctx, px + Math.floor(pw / 2) - 1, py + 4, 2, ph - 6, '#F3F0E7');

      if (inUse) {
        const leftY = py + 11 + Math.sin(timeSec * 6.5) * 4;
        const rightY = py + 11 - Math.sin(timeSec * 6.5) * 4;
        drawRect(ctx, px + 8, leftY, 4, 7, '#D68B7B');
        drawRect(ctx, px + pw - 12, rightY, 4, 7, '#D9A66C');
        const sweep = (Math.sin(timeSec * 6.5) + 1) / 2;
        const ballX = px + 13 + sweep * (pw - 28);
        const bounce = Math.abs(Math.sin(timeSec * 13)) * 5;
        const ballY = py + 14 - bounce;
        drawRect(ctx, ballX, ballY, 3, 3, '#F3F0E7');
      } else {
        drawRect(ctx, px + 8, py + 12, 4, 7, '#D68B7B');
        drawRect(ctx, px + pw - 12, py + 12, 4, 7, '#D9A66C');
        drawRect(ctx, px + 14, py + 14, 3, 3, '#F3F0E7');
      }
      break;
    }
    case 'PERK_SNACK_PANTRY': {
      // Stocked warm-wood & cream pantry shelf
      drawRect(ctx, px + 4, py + 3, 24, 26, '#303B38');
      drawRect(ctx, px + 7, py + 6, 18, 16, inUse ? '#495853' : '#242D2A');
      const lightShift = inUse && Math.floor(timeSec * 4) % 2 === 0;
      drawRect(ctx, px + 9, py + 8, 4, 4, lightShift ? '#F3F0E7' : '#D9A66C');
      drawRect(ctx, px + 14, py + 8, 4, 4, '#D68B7B');
      drawRect(ctx, px + 19, py + 8, 4, 4, '#78978A');
      drawRect(ctx, px + 9, py + 14, 4, 4, '#A8B8CE');
      drawRect(ctx, px + 14, py + 14, 4, 4, '#D9A66C');
      drawRect(ctx, px + 19, py + 14, 4, 4, '#D68B7B');
      drawRect(ctx, px + 9, py + 24, 14, 3, '#9E6E42');
      break;
    }
    case 'PERK_QUIET_POD': {
      // 1x2 oak-framed acoustic focus booth
      drawRect(ctx, px + 3, py + 3, pw - 6, ph - 5, '#9E6E42');
      drawRect(ctx, px + 5, py + 7, pw - 10, ph - 12, '#303B38');
      drawRect(ctx, px + 7, py + 10, pw - 14, ph - 20, inUse ? '#495853' : '#3B4844');
      // Occupancy strip on roof
      drawRect(ctx, px + 8, py + 4, pw - 16, 3, inUse ? '#78978A' : '#A8B8CE');
      // Desk + mini laptop inside
      drawRect(ctx, px + 8, py + 20, pw - 16, 8, '#D9A66C');
      drawRect(ctx, px + 11, py + 17, 10, 6, inUse ? '#A8B8CE' : '#495853');
      // Bench cushion
      drawRect(ctx, px + 8, py + ph - 18, pw - 16, 10, '#78978A');
      break;
    }
    case 'PERK_WELLNESS_SUITE': {
      // 2x1 sage & cream wellness tatami nook + lantern
      drawRect(ctx, px + 3, py + 5, pw - 6, ph - 8, '#5A786B');
      drawRect(ctx, px + 6, py + 7, pw - 12, ph - 12, '#78978A');
      drawRect(ctx, px + 10, py + 10, 26, 12, '#F3F0E7');
      drawRect(ctx, px + 11, py + 11, 7, 10, '#D68B7B');
      const glow = inUse && Math.floor(timeSec * 3) % 2 === 0 ? '#F3F0E7' : '#D9A66C';
      drawRect(ctx, px + pw - 18, py + 9, 10, 10, '#303B38');
      drawRect(ctx, px + pw - 16, py + 11, 6, 6, inUse ? glow : '#9E6E42');
      break;
    }
    case 'HR_BOARD': {
      // Cork pinboard with candidate cards & notes
      drawRect(ctx, px + 3, py + 4, pw - 6, ph - 8, '#9E6E42');
      drawRect(ctx, px + 6, py + 7, pw - 12, ph - 14, '#D9A66C');
      drawRect(ctx, px + 9, py + 10, 11, 10, '#F3F0E7');
      drawRect(ctx, px + 13, py + 9, 3, 2, '#D68B7B');
      drawRect(ctx, px + 24, py + 10, 12, 10, '#F3F0E7');
      drawRect(ctx, px + 29, py + 9, 3, 2, '#78978A');
      drawRect(ctx, px + 40, py + 10, 12, 10, '#A8B8CE');
      drawRect(ctx, px + 45, py + 9, 3, 2, '#303B38');
      break;
    }
    case 'FINANCE_TERMINAL': {
      // Warm walnut desk + dual ledger chart monitor + brass lamp
      drawRect(ctx, px + 2, py + 5, pw - 4, ph - 8, '#9E6E42');
      drawRect(ctx, px + 4, py + 7, pw - 8, ph - 12, '#D9A66C');
      drawRect(ctx, px + 10, py + 5, 24, 14, '#303B38');
      drawRect(ctx, px + 12, py + 7, 20, 10, '#A8B8CE');
      // Mini bar chart inside screen
      drawRect(ctx, px + 14, py + 13, 3, 3, '#78978A');
      drawRect(ctx, px + 19, py + 11, 3, 5, '#78978A');
      drawRect(ctx, px + 24, py + 9, 3, 7, '#F3F0E7');
      // Ledger binder
      drawRect(ctx, px + pw - 20, py + 12, 12, 12, '#F3F0E7');
      drawRect(ctx, px + pw - 18, py + 14, 8, 2, '#303B38');
      break;
    }
    case 'LEGAL_DESK': {
      // Walnut legal desk + sealed parchment dossier & brass lamp
      drawRect(ctx, px + 2, py + 5, pw - 4, ph - 8, '#9E6E42');
      drawRect(ctx, px + 4, py + 7, pw - 8, ph - 12, '#D9A66C');
      // Dossier stack with dusty rose wax seal
      drawRect(ctx, px + 10, py + 10, 16, 13, '#F3F0E7');
      drawRect(ctx, px + 12, py + 12, 10, 2, '#303B38');
      drawRect(ctx, px + 21, py + 18, 4, 4, '#D68B7B');
      // Brass lamp
      drawRect(ctx, px + pw - 18, py + 8, 10, 10, '#303B38');
      drawRect(ctx, px + pw - 16, py + 10, 6, 6, '#F3F0E7');
      break;
    }
    case 'RECEPTION_DESK': {
      // Lobby reception counter + welcome bell & plant pot
      drawRect(ctx, px + 2, py + 5, pw - 4, ph - 8, '#9E6E42');
      drawRect(ctx, px + 4, py + 7, pw - 8, ph - 12, '#D9A66C');
      drawRect(ctx, px + 6, py + 18, pw - 12, 3, '#78978A');
      // Terminal + visitor guestbook + service bell
      drawRect(ctx, px + 10, py + 7, 16, 10, '#303B38');
      drawRect(ctx, px + 12, py + 9, 12, 6, '#A8B8CE');
      drawRect(ctx, px + 32, py + 11, 10, 8, '#F3F0E7');
      drawRect(ctx, px + pw - 14, py + 12, 6, 6, '#D9A66C');
      break;
    }
    default: {
      drawRect(ctx, px + 2, py + 5, pw - 4, ph - 8, '#9E6E42');
      drawRect(ctx, px + 5, py + 8, pw - 10, ph - 14, '#D9A66C');
      drawRect(ctx, px + 12, py + 8, 16, 10, '#303B38');
      drawRect(ctx, px + 14, py + 10, 12, 6, '#A8B8CE');
      drawRect(ctx, px + pw - 20, py + 12, 10, 12, '#F3F0E7');
      break;
    }
  }

  if (isHovered || isMoving) {
    ctx.strokeStyle = isMoving ? '#78978A' : '#303B38';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, py + 1, pw - 2, ph - 2);
  }

  if (isHovered && !isMoving) {
    const furnLoc = getFurnitureLocalized(item.templateId, item.name);
    ctx.save();
    ctx.font = 'bold 12px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    const labelText = inUse ? `${furnLoc.name} · ${t('drawer.inUse')}` : furnLoc.name;
    const tw = ctx.measureText(labelText).width + 14;
    const tx = px + pw / 2;
    const ty = py - 8;
    drawRect(ctx, tx - tw / 2, ty - 12, tw, 17, '#F3F0E7');
    ctx.strokeStyle = '#303B38';
    ctx.lineWidth = 1;
    ctx.strokeRect(tx - tw / 2, ty - 12, tw, 17);
    ctx.fillStyle = '#303B38';
    ctx.fillText(labelText, tx, ty);
    ctx.restore();
  }
}

function drawCharacterSprite(
  ctx: CanvasRenderingContext2D,
  pos: GridPoint,
  appearance: CharacterAppearance,
  isWalking: boolean,
  isWorking: boolean,
  isResting: boolean,
  moodTone: 'HAPPY' | 'NEUTRAL' | 'STRESSED',
  isFounder: boolean,
  label: string,
  thoughtIcon: string | null,
  isSelected: boolean,
  isHovered: boolean,
  timeSec: number,
  isCelebrating = false,
  celebrateSeed = 0
) {
  const cx = pos.x * TILE_SIZE + TILE_SIZE / 2;
  const cy = pos.y * TILE_SIZE + TILE_SIZE / 2;

  const bob = isCelebrating
    ? Math.abs(Math.sin(timeSec * 7.2 + celebrateSeed)) * 4.5
    : isWalking
      ? Math.abs(Math.sin(timeSec * 12)) * 3
      : isWorking
        ? Math.sin(timeSec * 6) * 0.9
        : isResting
          ? Math.sin(timeSec * 2) * 0.6
          : Math.sin(timeSec * 2.5) * 0.8;

  // Selection / hover ring
  if (isSelected || isHovered || isFounder) {
    ctx.strokeStyle = isSelected
      ? '#D9A66C'
      : isFounder
        ? '#303B38'
        : '#78978A';
    ctx.lineWidth = isSelected ? 2.5 : 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 11, 12, 5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Soft drop shadow
  ctx.fillStyle = 'rgba(48, 59, 56, 0.34)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 11, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  const stride = isWalking ? Math.sin(timeSec * 14) * 3 : 0;
  const topY = cy - 13 - bob;

  // Legs / pants
  drawRect(ctx, cx - 5, topY + 20, 4, 6 + stride * 0.4, appearance.pantsColor);
  drawRect(ctx, cx + 1, topY + 20, 4, 6 - stride * 0.4, appearance.pantsColor);

  // Torso / shirt with crisp silhouette outline for office visibility
  drawRect(ctx, cx - 8, topY + 10, 16, 12, 'rgba(48, 59, 56, 0.35)');
  drawRect(ctx, cx - 7, topY + 11, 14, 10, appearance.shirtColor);
  // Subtle shirt shading
  drawRect(ctx, cx - 7, topY + 18, 14, 3, 'rgba(0,0,0,0.18)');

  // Arms (raised cheering cadence during milestone celebrations)
  if (isCelebrating) {
    const wave = Math.sin(timeSec * 10 + celebrateSeed) * 2.2;
    drawRect(ctx, cx - 9, topY + 4 + wave, 3, 8, appearance.shirtColor);
    drawRect(ctx, cx + 6, topY + 4 - wave, 3, 8, appearance.shirtColor);
    drawRect(ctx, cx - 9, topY + 2 + wave, 3, 2, appearance.skinTone);
    drawRect(ctx, cx + 6, topY + 2 - wave, 3, 2, appearance.skinTone);
  } else {
    const armOffset = isWorking
      ? Math.sin(timeSec * 14) * 1.5
      : isResting
        ? Math.sin(timeSec * 2.2) * 0.6
        : 0;
    drawRect(ctx, cx - 9, topY + 12 + armOffset, 3, 7, appearance.shirtColor);
    drawRect(ctx, cx + 6, topY + 12 - armOffset, 3, 7, appearance.shirtColor);
  }

  // Warm coffee mug in hand when resting / break room
  if (isResting && !isWalking && !isCelebrating) {
    drawRect(ctx, cx + 8, topY + 16, 4, 4, '#F3F0E7');
    drawRect(ctx, cx + 9, topY + 17, 2, 2, '#D9A66C');
  }

  // Head with crisp subtle outline
  drawRect(ctx, cx - 7, topY, 14, 12, 'rgba(48, 59, 56, 0.35)');
  drawRect(ctx, cx - 6, topY + 1, 12, 10, appearance.skinTone);
  // Warm rosy cheek detail
  drawRect(ctx, cx - 6, topY + 7, 2, 1, 'rgba(214, 139, 123, 0.55)');
  drawRect(ctx, cx + 4, topY + 7, 2, 1, 'rgba(214, 139, 123, 0.55)');
  // Eyes
  drawRect(ctx, cx - 4, topY + 6, 2, 2, '#303B38');
  drawRect(ctx, cx + 2, topY + 6, 2, 2, '#303B38');

  if (appearance.hasGlasses) {
    ctx.strokeStyle = '#303B38';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - 5, topY + 5, 4, 4);
    ctx.strokeRect(cx + 1, topY + 5, 4, 4);
  }

  // Hair styles
  if (appearance.hairStyle !== 'BALD') {
    drawRect(ctx, cx - 7, topY - 1, 14, 4, appearance.hairColor);
    if (appearance.hairStyle === 'BOB' || appearance.hairStyle === 'PONYTAIL') {
      drawRect(ctx, cx - 7, topY + 2, 2, 6, appearance.hairColor);
      drawRect(ctx, cx + 5, topY + 2, 2, 6, appearance.hairColor);
    }
    if (appearance.hairStyle === 'SPIKY') {
      drawRect(ctx, cx - 4, topY - 3, 3, 3, appearance.hairColor);
      drawRect(ctx, cx + 1, topY - 3, 3, 3, appearance.hairColor);
    }
  }

  // Founder golden wood crown pip
  if (isFounder) {
    drawRect(ctx, cx - 4, topY - 5, 8, 3, '#D9A66C');
    drawRect(ctx, cx - 4, topY - 7, 2, 2, '#E8C08B');
    drawRect(ctx, cx - 1, topY - 7, 2, 2, '#E8C08B');
    drawRect(ctx, cx + 2, topY - 7, 2, 2, '#E8C08B');
  }

  // Subtle mood feedback pip beside head (or celebratory sparkle when celebrating)
  if (isCelebrating && Math.sin(timeSec * 6 + celebrateSeed) > -0.2) {
    drawRect(ctx, cx + 8, topY - 1, 3, 3, '#D9A66C');
    drawRect(ctx, cx - 10, topY + 1, 2, 2, '#78978A');
  } else if (!isFounder && !isWalking) {
    if (moodTone === 'HAPPY' && Math.sin(timeSec * 3.5 + cx) > 0.25) {
      drawRect(ctx, cx + 8, topY + 1, 3, 3, '#D68B7B');
    } else if (moodTone === 'STRESSED') {
      drawRect(ctx, cx + 7, topY + 3, 2, 3, '#A8B8CE');
    }
  }

  // Cozy thought bubble (shown while celebrating even if standing/cheering)
  if (thoughtIcon && (!isWalking || isCelebrating)) {
    const floatY = topY - 18 + Math.sin(timeSec * 3 + celebrateSeed) * 2;
    drawRect(ctx, cx - 9, floatY - 6, 18, 14, '#F3F0E7');
    ctx.strokeStyle = isCelebrating ? '#D9A66C' : '#303B38';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - 9, floatY - 6, 18, 14);
    ctx.font = '11px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(thoughtIcon, cx, floatY + 4);
  }

  // Nameplate when founder or hovered/selected
  if (isFounder || isSelected || isHovered) {
    ctx.save();
    ctx.font = 'bold 12px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    const tw = ctx.measureText(label).width + 12;
    drawRect(ctx, cx - tw / 2, cy + 15, tw, 16, '#F3F0E7');
    ctx.strokeStyle = isSelected ? '#D9A66C' : '#303B38';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - tw / 2, cy + 15, tw, 16);
    ctx.fillStyle = '#303B38';
    ctx.fillText(label, cx, cy + 27);
    ctx.restore();
  }
}

export function renderOfficeScene(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  state: GameState,
  camera: CameraState,
  interaction: RenderInteractionState,
  particles: Particle[],
  timeSec: number
) {
  ctx.imageSmoothingEnabled = false;

  // Calm Warm Cream canvas backdrop matching the minimalist UI
  drawRect(ctx, 0, 0, canvasWidth, canvasHeight, '#F3F0E7');

  ctx.save();
  ctx.translate(Math.round(canvasWidth / 2), Math.round(canvasHeight / 2));
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(Math.round(-camera.x), Math.round(-camera.y));

  // World exterior subtle cream-charcoal terrace frame
  const worldW = OFFICE_COLS * TILE_SIZE;
  const worldH = OFFICE_ROWS * TILE_SIZE;
  drawRect(ctx, -12, -12, worldW + 24, worldH + 24, '#D9D4C5');
  ctx.strokeStyle = 'rgba(48, 59, 56, 0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(-12, -12, worldW + 24, worldH + 24);

  const weather = getWeatherSnapshot(state.seed, state.totalDays, state.hourOfDay);

  // 1. Rooms floors
  for (const room of Object.values(state.office.rooms)) {
    drawRoomFloor(ctx, room);
  }

  // 2. Walls, windows & corridor
  drawWallsAndCorridor(ctx, state, timeSec, interaction.selectedRoomId, weather);

  // 3. Selected room highlight & tutorial room highlight
  if (interaction.highlightedRoomIds && interaction.highlightedRoomIds.length > 0) {
    const pulse = 0.45 + Math.abs(Math.sin(timeSec * 3.2)) * 0.45;
    for (const rId of interaction.highlightedRoomIds) {
      const r = state.office.rooms[rId];
      if (!r) continue;
      ctx.save();
      ctx.strokeStyle = `rgba(120, 151, 138, ${pulse})`;
      ctx.lineWidth = 4;
      ctx.strokeRect(
        r.bounds.x * TILE_SIZE + 3,
        r.bounds.y * TILE_SIZE + 3,
        r.bounds.w * TILE_SIZE - 6,
        r.bounds.h * TILE_SIZE - 6
      );
      ctx.restore();
    }
  }

  if (interaction.selectedRoomId) {
    const r = state.office.rooms[interaction.selectedRoomId];
    if (r) {
      ctx.strokeStyle = '#78978A';
      ctx.lineWidth = 3;
      ctx.strokeRect(
        r.bounds.x * TILE_SIZE + 2,
        r.bounds.y * TILE_SIZE + 2,
        r.bounds.w * TILE_SIZE - 4,
        r.bounds.h * TILE_SIZE - 4
      );
    }
  }

  // 4. Furniture placement / hover tile indicator
  if (interaction.hoveredTile) {
    const ht = interaction.hoveredTile;
    if (interaction.movingFurnitureId || interaction.placingTemplateId) {
      const movingItem = interaction.movingFurnitureId
        ? state.office.furniture.find((f) => f.id === interaction.movingFurnitureId)
        : null;
      const tpl = interaction.placingTemplateId
        ? FURNITURE_CATALOG.find((f) => f.templateId === interaction.placingTemplateId)
        : null;
      const w = movingItem?.width ?? tpl?.width ?? 1;
      const h = movingItem?.height ?? tpl?.height ?? 1;
      const check = canPlaceFurnitureAt(
        state.office,
        ht,
        w,
        h,
        interaction.movingFurnitureId ?? undefined
      );
      ctx.fillStyle = check.valid ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)';
      ctx.fillRect(ht.x * TILE_SIZE, ht.y * TILE_SIZE, w * TILE_SIZE, h * TILE_SIZE);
      ctx.strokeStyle = check.valid ? '#10b981' : '#ef4444';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        ht.x * TILE_SIZE + 1,
        ht.y * TILE_SIZE + 1,
        w * TILE_SIZE - 2,
        h * TILE_SIZE - 2
      );
    } else if (!interaction.hoveredRoomId || state.office.rooms[interaction.hoveredRoomId]?.unlocked !== false) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(ht.x * TILE_SIZE + 1, ht.y * TILE_SIZE + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    }
  }

  // 5. Furniture (including dynamically rendered purchased perks)
  const renderableFurniture = getRenderableFurniture(state.office);
  const hasErgonomicChairs = (state.office.purchasedPerks ?? []).includes('perk_ergonomic_chairs');
  for (const item of renderableFurniture) {
    const roomUnlocked = state.office.rooms[item.roomId]?.unlocked !== false;
    drawFurnitureItem(
      ctx,
      item,
      timeSec,
      state.office.techTier,
      hasErgonomicChairs,
      isFurnitureInUse(item, state),
      roomUnlocked && interaction.hoveredEntityId === item.id,
      interaction.movingFurnitureId === item.id
    );
  }

  const activeCelebration =
    state.screen === 'PLAYING' &&
    state.activeCelebration &&
    !state.activeEvent &&
    !state.pendingDailyReport &&
    !state.pendingMonthlyReport &&
    !state.story?.activeCinematic &&
    !state.story?.activeStoryEvent
      ? state.activeCelebration
      : null;

  if (activeCelebration) {
    const targetRoom = state.office.rooms[activeCelebration.targetRoomId];
    if (targetRoom) {
      const pulse = 0.45 + Math.abs(Math.sin(timeSec * 3.4)) * 0.45;
      const rx = (targetRoom.bounds.x + 1) * TILE_SIZE;
      const ry = (targetRoom.bounds.y + 1) * TILE_SIZE;
      const rw = (targetRoom.bounds.w - 2) * TILE_SIZE;
      const rh = (targetRoom.bounds.h - 2) * TILE_SIZE;
      ctx.save();
      ctx.fillStyle = `rgba(217, 166, 108, ${(0.08 * pulse).toFixed(3)})`;
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = `rgba(217, 166, 108, ${(0.72 * pulse).toFixed(3)})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(rx + 2, ry + 2, rw - 4, rh - 4);
      // Warm pixel corner glints inside target room
      if (Math.sin(timeSec * 5.2) > 0) {
        drawRect(ctx, rx + 7, ry + 7, 4, 4, '#D9A66C');
        drawRect(ctx, rx + rw - 11, ry + rh - 11, 4, 4, '#78978A');
      } else {
        drawRect(ctx, rx + rw - 11, ry + 7, 4, 4, '#D68B7B');
        drawRect(ctx, rx + 7, ry + rh - 11, 4, 4, '#D9A66C');
      }
      ctx.restore();
    }
  }

  // 6. Visitors in Lobby
  for (const vis of state.visitors) {
    drawCharacterSprite(
      ctx,
      vis.position,
      {
        skinTone: '#e8b896',
        hairColor: '#303B38',
        hairStyle: 'SHORT',
        shirtColor: '#A8B8CE',
        pantsColor: '#303B38',
        hasGlasses: true,
      },
      false,
      false,
      false,
      'NEUTRAL',
      false,
      vis.name,
      '💼',
      false,
      interaction.hoveredEntityId === vis.id,
      timeSec
    );
  }

  // 7. Sort characters by Y for proper top-down overlap
  type DrawableChar =
    | { kind: 'FOUNDER'; y: number; data: Founder }
    | { kind: 'EMP'; y: number; idx: number; data: Employee };

  const chars: DrawableChar[] = [
    { kind: 'FOUNDER' as const, y: state.founder.position.y, data: state.founder },
    ...state.employees.map((e, idx) => ({ kind: 'EMP' as const, y: e.position.y, idx, data: e })),
  ].sort((a, b) => a.y - b.y);

  const launchEmotes = ['🎉', '🚀', '👏', '✨', '🥂'];
  const expansionEmotes = ['✨', '🎉', '🏢', '👏', '☕'];
  const emotePool =
    activeCelebration?.kind === 'PRODUCT_MVP_LAUNCH' ||
    activeCelebration?.kind === 'PRODUCT_MATURE_RELEASE'
      ? launchEmotes
      : expansionEmotes;

  for (const ch of chars) {
    if (ch.kind === 'FOUNDER') {
      const f = ch.data;
      const founderBubble = activeCelebration ? emotePool[0] : null;
      drawCharacterSprite(
        ctx,
        f.position,
        f.appearance,
        f.state === 'WALKING',
        false,
        false,
        'HAPPY',
        true,
        `${f.name} (CEO)`,
        founderBubble,
        false,
        false,
        timeSec,
        Boolean(activeCelebration),
        0.35
      );
    } else {
      const e = ch.data;
      const isTutEmp = interaction.highlightedEmployeeId === e.id;
      const moodTone: 'HAPPY' | 'NEUTRAL' | 'STRESSED' =
        e.stress > 70 || e.morale < 45 ? 'STRESSED' : e.morale >= 75 ? 'HAPPY' : 'NEUTRAL';
      if (isTutEmp) {
        const pulse = 0.45 + Math.abs(Math.sin(timeSec * 3.4)) * 0.45;
        const ex = e.position.x * TILE_SIZE + TILE_SIZE / 2;
        const ey = e.position.y * TILE_SIZE + TILE_SIZE / 2 + 11;
        ctx.save();
        ctx.strokeStyle = `rgba(217, 166, 108, ${pulse})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(ex, ey, 16, 7, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      const empCelebrationBubble = activeCelebration
        ? emotePool[(ch.idx + 1 + Math.floor(timeSec * 0.6)) % emotePool.length]
        : e.thoughtIcon;
      drawCharacterSprite(
        ctx,
        e.position,
        e.appearance,
        e.state === 'WALKING',
        e.state === 'WORKING',
        e.state === 'RESTING',
        moodTone,
        false,
        e.name,
        empCelebrationBubble,
        interaction.selectedEmployeeId === e.id || isTutEmp,
        interaction.hoveredEntityId === e.id,
        timeSec,
        Boolean(activeCelebration),
        (ch.idx + 1) * 1.15
      );
    }
  }

  // 8. Pooled particles (steam, cash pops)
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    if (p.text) {
      ctx.font = 'bold 12px Arial, Helvetica, sans-serif';
      ctx.fillStyle = p.color;
      ctx.textAlign = 'center';
      ctx.fillText(p.text, p.x, p.y);
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
  }
  ctx.globalAlpha = 1;

  // 8b. Clean on-floor indicator overlay for locked rooms: subtle frosted preview + pixel padlock & unlock cost
  for (const room of Object.values(state.office.rooms)) {
    if (room.unlocked) continue;
    const rx = (room.bounds.x + 1) * TILE_SIZE;
    const ry = (room.bounds.y + 1) * TILE_SIZE;
    const rw = (room.bounds.w - 2) * TILE_SIZE;
    const rh = (room.bounds.h - 2) * TILE_SIZE;
    const isHovered = interaction.hoveredRoomId === room.id;
    const isSelected = interaction.selectedRoomId === room.id;
    const canAfford = state.finance.cash >= room.unlockCost;

    // Gentle translucent veil keeps floor & preview furniture silhouettes visible
    ctx.fillStyle = isHovered || isSelected ? 'rgba(243, 240, 231, 0.36)' : 'rgba(243, 240, 231, 0.48)';
    ctx.fillRect(rx, ry, rw, rh);

    ctx.save();
    ctx.strokeStyle = isSelected
      ? '#78978A'
      : isHovered
        ? 'rgba(48, 59, 56, 0.52)'
        : 'rgba(48, 59, 56, 0.26)';
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = isHovered || isSelected ? 2 : 1.5;
    ctx.strokeRect(rx + 4, ry + 4, rw - 8, rh - 8);
    ctx.setLineDash([]);

    const cx = rx + rw / 2;
    const cy = ry + rh / 2;
    const costText = formatCurrency(room.unlockCost);
    ctx.font = 'bold 12px Arial, Helvetica, sans-serif';
    const costW = ctx.measureText(costText).width;
    const badgeW = Math.max(78, Math.ceil(costW) + 32);
    const badgeH = 26;
    const badgeX = Math.round(cx - badgeW / 2);
    const badgeY = Math.round(cy - badgeH / 2);

    // Subtle pixel shadow grounding the badge directly onto the room floor
    drawRect(ctx, badgeX + 2, badgeY + 2, badgeW, badgeH, 'rgba(48, 59, 56, 0.22)');

    // Crisp Cozy Pixel Art plaque
    drawRect(ctx, badgeX, badgeY, badgeW, badgeH, '#F3F0E7');
    ctx.strokeStyle = isSelected || isHovered ? '#303B38' : 'rgba(48, 59, 56, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);

    // Stepped 2px corner pixels for crisp pixel-art framing
    const cornerAccent = canAfford ? '#78978A' : '#D9A66C';
    drawRect(ctx, badgeX + 2, badgeY + 2, 2, 2, cornerAccent);
    drawRect(ctx, badgeX + badgeW - 4, badgeY + 2, 2, 2, cornerAccent);
    drawRect(ctx, badgeX + 2, badgeY + badgeH - 4, 2, 2, cornerAccent);
    drawRect(ctx, badgeX + badgeW - 4, badgeY + badgeH - 4, 2, 2, cornerAccent);

    // Compact pixel padlock icon inside badge left side
    const lx = badgeX + 9;
    const ly = badgeY + 6;
    // Shackle
    drawRect(ctx, lx + 2, ly, 6, 2, '#303B38');
    drawRect(ctx, lx + 1, ly + 1, 2, 4, '#303B38');
    drawRect(ctx, lx + 7, ly + 1, 2, 4, '#303B38');
    // Padlock body
    drawRect(ctx, lx, ly + 5, 10, 8, '#D9A66C');
    ctx.strokeStyle = '#303B38';
    ctx.lineWidth = 1;
    ctx.strokeRect(lx, ly + 5, 10, 8);
    // Keyhole pixel
    drawRect(ctx, lx + 4, ly + 7, 2, 3, '#303B38');

    // Unlock cost text
    ctx.fillStyle = '#303B38';
    ctx.textAlign = 'left';
    ctx.fillText(costText, lx + 14, badgeY + 17);
    ctx.restore();
  }

  // 9. Day/Night ambient lighting wash & evening warm desk glow
  const hour = state.hourOfDay;
  if (hour < 9.5) {
    ctx.fillStyle = 'rgba(253, 230, 138, 0.05)';
    ctx.fillRect(0, 0, worldW, worldH);
  } else if (hour >= 16.5 && hour < 17.5) {
    ctx.fillStyle = 'rgba(251, 146, 60, 0.09)';
    ctx.fillRect(0, 0, worldW, worldH);
  } else if (hour >= 17.5) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.24)';
    ctx.fillRect(0, 0, worldW, worldH);
    // Warm monitor/lamp/perk glow pools
    for (const item of renderableFurniture) {
      if (
        item.templateId === 'CEO_DESK' ||
        item.templateId === 'WORKSTATION' ||
        item.templateId === 'ESPRESSO_BAR' ||
        item.templateId === 'PERK_COFFEE_MACHINE' ||
        item.templateId === 'PERK_QUIET_POD' ||
        item.templateId === 'PERK_WELLNESS_SUITE'
      ) {
        const gx = (item.tile.x + item.width / 2) * TILE_SIZE;
        const gy = (item.tile.y + item.height / 2) * TILE_SIZE;
        const grad = ctx.createRadialGradient(gx, gy, 4, gx, gy, 48);
        grad.addColorStop(0, 'rgba(251, 191, 36, 0.22)');
        grad.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(gx - 48, gy - 48, 96, 96);
      }
    }
  }

  ctx.restore();

  // 10. Subtle screen-space weather overlay (rain streaks, sunlight beam shifts, overcast breeze)
  drawWeatherCanvasOverlay(ctx, canvasWidth, canvasHeight, weather, hour, timeSec);
}

function drawWeatherCanvasOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  weather: WeatherSnapshot,
  hourOfDay: number,
  timeSec: number
) {
  if (width <= 0 || height <= 0) return;

  ctx.save();

  // Soft overcast cool-sage veil & drifting cloud shade
  if (weather.overcastIntensity > 0.05) {
    const cloudAlpha = 0.055 * weather.overcastIntensity;
    ctx.fillStyle = `rgba(90, 110, 122, ${cloudAlpha.toFixed(3)})`;
    ctx.fillRect(0, 0, width, height);

    const bandProgress = (timeSec * 18) % (width + 420);
    const bandX = bandProgress - 320;
    const bandGrad = ctx.createLinearGradient(bandX, 0, bandX + 320, height * 0.4);
    bandGrad.addColorStop(0, 'rgba(48, 59, 56, 0)');
    bandGrad.addColorStop(0.5, `rgba(48, 59, 56, ${(0.04 * weather.overcastIntensity).toFixed(3)})`);
    bandGrad.addColorStop(1, 'rgba(48, 59, 56, 0)');
    ctx.fillStyle = bandGrad;
    ctx.fillRect(0, 0, width, height);
  }

  // Warm shifting sunlight ribbons & floating pixel dust motes
  if (weather.sunlightIntensity > 0.08 && hourOfDay < 17.6) {
    const warmWash = 0.04 * weather.sunlightIntensity;
    ctx.fillStyle = `rgba(253, 224, 138, ${warmWash.toFixed(3)})`;
    ctx.fillRect(0, 0, width, height);

    const beamAlpha = 0.055 * weather.sunlightIntensity;
    for (let b = 0; b < 3; b++) {
      const sway = Math.sin(timeSec * 0.25 + b * 2.1) * (width * 0.08);
      const bx = width * (0.18 + b * 0.3) + sway;
      ctx.fillStyle = `rgba(254, 243, 199, ${beamAlpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(bx - 55, 0);
      ctx.lineTo(bx + 65, 0);
      ctx.lineTo(bx + 215, height);
      ctx.lineTo(bx + 75, height);
      ctx.closePath();
      ctx.fill();
    }

    // Gentle floating golden dust motes
    const moteAlpha = 0.28 * weather.sunlightIntensity;
    ctx.fillStyle = `rgba(254, 243, 199, ${moteAlpha.toFixed(3)})`;
    for (let i = 0; i < 16; i++) {
      const rx = ((i * 197 + 43) % 1000) / 1000;
      const ry = ((i * 313 + 91) % 1000) / 1000;
      const mx = (rx * width + timeSec * (4 + (i % 3) * 2) + Math.sin(timeSec * 0.8 + i) * 10) % width;
      const my = (ry * height + Math.cos(timeSec * 0.6 + i * 1.4) * 8 + height) % height;
      ctx.fillRect(Math.round(mx), Math.round(my), 2, 2);
    }
  }

  // Occasional cozy rain shower overlay (light pixel streaks + subtle mist)
  if (weather.rainIntensity > 0.08) {
    const rainAlpha = 0.25 * weather.rainIntensity;
    ctx.strokeStyle = `rgba(214, 226, 236, ${rainAlpha.toFixed(3)})`;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    const dropCount = 40;
    for (let i = 0; i < dropCount; i++) {
      const seedX = ((i * 271 + 37) % 1000) / 1000;
      const seedY = ((i * 419 + 83) % 1000) / 1000;
      const speed = 260 + (i % 5) * 35;
      const len = 9 + (i % 3) * 3;
      const dy = (seedY * height + timeSec * speed) % (height + 24);
      const dx = ((seedX * width - timeSec * (speed * 0.22)) % (width + 24) + width + 24) % (width + 24);
      const sx = Math.round(dx);
      const sy = Math.round(dy - 12);
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - Math.round(len * 0.28), sy + len);
    }
    ctx.stroke();

    // Faint pixel raindrop splash ticks along the terrace / outer edges
    const rippleAlpha = 0.18 * weather.rainIntensity;
    ctx.fillStyle = `rgba(214, 226, 236, ${rippleAlpha.toFixed(3)})`;
    for (let r = 0; r < 10; r++) {
      const phase = (timeSec * 2.2 + r * 0.37) % 1;
      if (phase < 0.35) {
        const px = Math.round((((r * 353 + 109) % 1000) / 1000) * width);
        const py = Math.round((((r * 521 + 211) % 1000) / 1000) * height);
        ctx.fillRect(px - 2, py, 5, 1);
      }
    }
  }

  ctx.restore();
}

