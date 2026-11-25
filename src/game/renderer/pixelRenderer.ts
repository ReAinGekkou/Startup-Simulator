import {
  CITY_BUILDINGS,
  CITY_STREET_PROPS,
  CityBuildingSpec,
  StreetProp,
  WORLD_MAX_X,
  WORLD_MAX_Y,
  WORLD_MIN_X,
  WORLD_MIN_Y,
} from '@/src/game/data/cityWorld';
import {
  FURNITURE_CATALOG,
  OFFICE_COLS,
  OFFICE_ROWS,
  PERK_FURNITURE_SPECS,
  TILE_SIZE,
} from '@/src/game/data/officeLayout';
import {
  getCharacterFootWorld,
  getIsoDepth,
  getTileDiamondCorners,
  ISO_HALF_H,
  ISO_HALF_W,
  IsoPoint,
  screenToWorld,
  worldToIso,
} from '@/src/game/engine/isoMath';
import { canPlaceFurnitureAt } from '@/src/game/engine/pathfinding';
import { getEffectiveWeatherSnapshot, WeatherSnapshot } from '@/src/game/systems/weatherSystem';
import { getFurnitureLocalized, getRoomLocalized, t } from '@/src/localization';
import {
  BusinessPropertyState,
  CharacterAppearance,
  Employee,
  Founder,
  FurnitureItem,
  GameState,
  GridPoint,
  OfficeRoom,
  OfficeState,
  RoomId,
  WorldLocationId,
} from '@/src/types/game';
import { formatCurrency } from '@/src/utils/format';

export interface CameraState {
  x: number; // isometric center x
  y: number; // isometric center y
  zoom: number;
}

export interface Particle {
  x: number;
  y: number;
  wx?: number;
  wy?: number;
  wz?: number;
  vx: number;
  vy: number;
  vz?: number;
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
  hoveredLocationId?: WorldLocationId | null;
  selectedRoomId: RoomId | null;
  selectedFurnitureId?: string | null;
  selectedLocationId?: WorldLocationId | null;
  selectedEmployeeId: string | null;
  selectedWorldNpcId?: string | null;
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

function tracePoly(ctx: CanvasRenderingContext2D, pts: IsoPoint[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].x, pts[i].y);
  }
  ctx.closePath();
}

function fillIsoTile(
  ctx: CanvasRenderingContext2D,
  wx: number,
  wy: number,
  w: number,
  h: number,
  fill: string,
  stroke?: string,
  lineWidth = 1,
  elevation = 0
) {
  const pts = getTileDiamondCorners(wx, wy, w, h, elevation);
  tracePoly(ctx, pts);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function drawIsoPrism(
  ctx: CanvasRenderingContext2D,
  wx: number,
  wy: number,
  w: number,
  h: number,
  zBase: number,
  zHeight: number,
  topColor: string,
  leftColor: string, // South-West facing (+y face)
  rightColor: string, // South-East facing (+x face)
  outlineColor?: string
) {
  const b0 = worldToIso(wx, wy, zBase); // North
  const b1 = worldToIso(wx + w, wy, zBase); // East
  const b2 = worldToIso(wx + w, wy + h, zBase); // South
  const b3 = worldToIso(wx, wy + h, zBase); // West

  const t0 = { x: b0.x, y: b0.y - zHeight };
  const t1 = { x: b1.x, y: b1.y - zHeight };
  const t2 = { x: b2.x, y: b2.y - zHeight };
  const t3 = { x: b3.x, y: b3.y - zHeight };

  // Left face (+y / West-to-South edge: t3 -> t2 -> b2 -> b3)
  tracePoly(ctx, [t3, t2, b2, b3]);
  ctx.fillStyle = leftColor;
  ctx.fill();
  if (outlineColor) {
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Right face (+x / East-to-South edge: t2 -> t1 -> b1 -> b2)
  tracePoly(ctx, [t2, t1, b1, b2]);
  ctx.fillStyle = rightColor;
  ctx.fill();
  if (outlineColor) {
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Top face (t0 -> t1 -> t2 -> t3)
  tracePoly(ctx, [t0, t1, t2, t3]);
  ctx.fillStyle = topColor;
  ctx.fill();
  if (outlineColor) {
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function getSkyColor(hour: number, weather: WeatherSnapshot): string {
  if (hour >= 17.5) return '#303B38';
  if (weather.rainIntensity >= 0.4) return '#7B8FA3';
  if (weather.overcastIntensity >= 0.4) return '#9AA8B7';
  if (hour < 9.5) return '#A8B8CE';
  if (hour < 15.5) return weather.sunlightIntensity > 0.55 ? '#C8D8EA' : '#BDCCE0';
  return '#D9A66C';
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

function drawIsoRoomFloor(ctx: CanvasRenderingContext2D, room: OfficeRoom) {
  const { x, y, w, h } = room.bounds;
  const palette = FLOOR_COLORS[room.floorStyle];

  for (let ty = y + 1; ty < y + h - 1; ty++) {
    for (let tx = x + 1; tx < x + w - 1; tx++) {
      const isAlt =
        room.floorStyle === 'WOOD' ? ty % 2 === 0 : (tx + ty) % 2 === 0;
      fillIsoTile(
        ctx,
        tx,
        ty,
        1,
        1,
        isAlt ? palette.alt : palette.base,
        palette.seam,
        0.55
      );
    }
  }

  // CEO Office woven isometric rug
  if (room.id === 'CEO_OFFICE') {
    fillIsoTile(ctx, x + 2.15, y + 3.15, 3.7, 3.7, '#D68B7B', '#9E6E42', 1);
    fillIsoTile(ctx, x + 2.4, y + 3.4, 3.2, 3.2, '#D9A66C');
    fillIsoTile(ctx, x + 2.65, y + 3.65, 2.7, 2.7, '#F3F0E7');
    fillIsoTile(ctx, x + 2.95, y + 3.95, 2.1, 2.1, '#78978A');
  }

  // Break Room cozy lounge mat
  if (room.id === 'BREAK_ROOM') {
    fillIsoTile(
      ctx,
      x + 2.2,
      y + 2.2,
      2.6,
      1.6,
      'rgba(243, 240, 231, 0.52)',
      'rgba(120, 151, 138, 0.45)',
      1
    );
  }
}

function drawIsoCorridorFloor(ctx: CanvasRenderingContext2D) {
  for (let ty = 11; ty <= 12; ty++) {
    for (let tx = 1; tx < OFFICE_COLS - 1; tx++) {
      const alt = (tx + ty) % 2 === 0;
      fillIsoTile(
        ctx,
        tx,
        ty,
        1,
        1,
        alt ? '#DDD6C6' : '#D5CEBD',
        '#BFB7A6',
        0.5
      );
    }
  }
  // Sage & wood corridor runner
  fillIsoTile(ctx, 1.3, 11.72, OFFICE_COLS - 2.6, 0.56, '#78978A');
  fillIsoTile(ctx, 1.4, 11.82, OFFICE_COLS - 2.8, 0.36, '#D9A66C');
}

function isCharBehindWallTile(
  tx: number,
  ty: number,
  charPositions: GridPoint[]
): boolean {
  for (const pos of charPositions) {
    const cx = pos.x + 0.5;
    const cy = pos.y + 0.5;
    // Character is immediately north/west behind this front-facing wall tile
    if (cx >= tx - 1.3 && cx <= tx + 1.5 && cy >= ty - 1.9 && cy <= ty + 0.3) {
      return true;
    }
  }
  return false;
}

function drawIsoWallTile(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  isExteriorSouthOrNorth: 'NORTH' | 'SOUTH' | 'INTERIOR',
  hasWindow: boolean,
  hasClock: boolean,
  state: GameState,
  weather: WeatherSnapshot,
  timeSec: number,
  occludingChar: boolean
) {
  const wallHeight = occludingChar ? 12 : 24;
  ctx.save();
  if (occludingChar) {
    ctx.globalAlpha = 0.45;
  }

  // Slight elevation plinth for crisp 2.5D architectural thickness
  drawIsoPrism(
    ctx,
    tx + 0.04,
    ty + 0.04,
    0.92,
    0.92,
    0,
    wallHeight,
    '#495853',
    '#303B38',
    '#242D2A',
    'rgba(24, 30, 28, 0.45)'
  );

  // Cream cornice trim near top edge
  const topLeft = worldToIso(tx + 0.04, ty + 0.96, wallHeight - 3);
  const topSouth = worldToIso(tx + 0.96, ty + 0.96, wallHeight - 3);
  const topRight = worldToIso(tx + 0.96, ty + 0.04, wallHeight - 3);
  ctx.strokeStyle = '#EAE5D8';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(topLeft.x, topLeft.y);
  ctx.lineTo(topSouth.x, topSouth.y);
  ctx.lineTo(topRight.x, topRight.y);
  ctx.stroke();

  // Exterior windows on outer north or south wall
  if (hasWindow && !occludingChar) {
    const sky = getSkyColor(state.hourOfDay, weather);
    const w0 = worldToIso(tx + 0.22, ty + 0.97, 19);
    const w1 = worldToIso(tx + 0.78, ty + 0.97, 19);
    const w2 = worldToIso(tx + 0.78, ty + 0.97, 7);
    const w3 = worldToIso(tx + 0.22, ty + 0.97, 7);

    tracePoly(ctx, [w0, w1, w2, w3]);
    ctx.fillStyle = sky;
    ctx.fill();
    ctx.strokeStyle = '#D9A66C';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Window rain droplets / glint
    if (weather.rainIntensity >= 0.3) {
      const shift = Math.floor(timeSec * 6 + tx) % 3;
      ctx.fillStyle = `rgba(243, 240, 231, ${(0.45 + weather.rainIntensity * 0.35).toFixed(2)})`;
      ctx.fillRect((w0.x + w1.x) * 0.5 - 2, (w0.y + w3.y) * 0.5 - 3 + shift, 2, 3);
      ctx.fillRect((w0.x + w1.x) * 0.5 + 2, (w0.y + w3.y) * 0.5 - 1 + ((shift + 1) % 3), 1.5, 2.5);
    }

    // Subtle sunlit beam on floor south of north windows
    if (isExteriorSouthOrNorth === 'NORTH' && state.hourOfDay < 17.5) {
      const sunAlpha = Math.max(
        0.02,
        (0.06 + weather.sunlightIntensity * 0.14) *
          (1 - weather.rainIntensity * 0.78) *
          (1 - weather.overcastIntensity * 0.45)
      );
      fillIsoTile(
        ctx,
        tx + 0.15,
        ty + 1.05,
        0.7,
        1.15,
        state.hourOfDay >= 15.5
          ? `rgba(217, 166, 108, ${sunAlpha.toFixed(3)})`
          : `rgba(254, 243, 199, ${sunAlpha.toFixed(3)})`
      );
    }
  }

  // Animated wall clock on north wall above Engineering
  if (hasClock) {
    const cCenter = worldToIso(tx + 0.5, ty + 0.98, 14);
    ctx.fillStyle = '#9E6E42';
    ctx.fillRect(cCenter.x - 6, cCenter.y - 6, 12, 12);
    ctx.fillStyle = '#F3F0E7';
    ctx.fillRect(cCenter.x - 4, cCenter.y - 4, 8, 8);
    const hourAngle = ((state.hourOfDay % 12) / 12) * Math.PI * 2 - Math.PI / 2;
    ctx.strokeStyle = '#303B38';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cCenter.x, cCenter.y);
    ctx.lineTo(cCenter.x + Math.cos(hourAngle) * 3, cCenter.y + Math.sin(hourAngle) * 3);
    ctx.stroke();
  }

  ctx.restore();
}

function drawIsoFurnitureItem(
  ctx: CanvasRenderingContext2D,
  item: FurnitureItem,
  timeSec: number,
  techTier: number,
  hasErgonomicChairs: boolean,
  inUse: boolean,
  isHovered: boolean,
  isMoving: boolean,
  isSelected = false
) {
  const { x: tx, y: ty } = item.tile;
  const w = item.width;
  const h = item.height;

  // Ground contact shadow diamond
  fillIsoTile(ctx, tx + 0.06, ty + 0.06, w - 0.1, h - 0.1, 'rgba(48, 59, 56, 0.22)');

  switch (item.templateId) {
    case 'CEO_DESK': {
      drawIsoPrism(ctx, tx + 0.15, ty + 0.2, w - 0.3, h - 0.35, 0, 12, '#D9A66C', '#9E6E42', '#7D5430', '#303B38');
      // Dual monitors perched on desk top
      drawIsoPrism(ctx, tx + 0.5, ty + 0.45, 0.7, 0.25, 12, 10, '#495853', '#A8B8CE', '#303B38', '#303B38');
      drawIsoPrism(ctx, tx + 1.4, ty + 0.45, 0.7, 0.25, 12, 10, '#495853', '#B8C9DF', '#303B38', '#303B38');
      // Brass lamp + mug
      drawIsoPrism(ctx, tx + 0.28, ty + 0.9, 0.28, 0.28, 12, 7, '#F3F0E7', '#D9A66C', '#9E6E42');
      drawIsoPrism(ctx, tx + w - 0.55, ty + 0.9, 0.22, 0.22, 12, 4, '#F3F0E7', '#D68B7B', '#B86E5F');
      if (hasErgonomicChairs) {
        drawIsoPrism(ctx, tx + w * 0.42, ty + h - 0.22, 0.45, 0.45, 0, 11, '#78978A', '#303B38', '#242D2A');
      }
      break;
    }
    case 'WORKSTATION': {
      drawIsoPrism(ctx, tx + 0.1, ty + 0.15, w - 0.2, h - 0.3, 0, 11, '#D9A66C', '#9E6E42', '#7D5430', '#303B38');
      const screenColor = techTier >= 3 ? '#78978A' : techTier === 2 ? '#9CC0B0' : '#A8B8CE';
      drawIsoPrism(ctx, tx + 0.55, ty + 0.22, 0.65, 0.2, 11, 9, '#495853', screenColor, '#303B38', '#303B38');
      // Mug
      drawIsoPrism(ctx, tx + w - 0.45, ty + 0.42, 0.2, 0.2, 11, 4, '#F3F0E7', '#D68B7B', '#B86E5F');
      if (hasErgonomicChairs) {
        drawIsoPrism(ctx, tx + 0.65, ty + h - 0.15, 0.42, 0.38, 0, 10, '#78978A', '#303B38', '#242D2A');
      }
      break;
    }
    case 'ESPRESSO_BAR': {
      drawIsoPrism(ctx, tx + 0.1, ty + 0.12, w - 0.2, h - 0.24, 0, 11, '#D9A66C', '#9E6E42', '#7D5430', '#303B38');
      drawIsoPrism(ctx, tx + 0.25, ty + 0.22, 0.65, 0.5, 11, 10, '#F3F0E7', '#D68B7B', '#303B38', '#303B38');
      drawIsoPrism(ctx, tx + 1.15, ty + 0.35, 0.25, 0.25, 11, 4, '#F3F0E7', '#D9A66C', '#9E6E42');
      break;
    }
    case 'SERVER_RACK': {
      drawIsoPrism(ctx, tx + 0.14, ty + 0.12, w - 0.28, h - 0.24, 0, 22, '#495853', '#303B38', '#242D2A', '#1E2523');
      for (let row = 0; row < 3; row++) {
        const blink = Math.floor(timeSec * 4 + row) % 3 === 0;
        const p = worldToIso(tx + 0.88, ty + 0.45 + row * 0.45, 7 + row * 5);
        ctx.fillStyle = blink ? '#78978A' : '#A8B8CE';
        ctx.fillRect(p.x - 2, p.y - 1, 3, 2);
      }
      break;
    }
    case 'MEETING_TABLE': {
      drawIsoPrism(ctx, tx + 0.2, ty + 0.2, w - 0.4, h - 0.4, 0, 11, '#D9A66C', '#9E6E42', '#7D5430', '#303B38');
      drawIsoPrism(ctx, tx + 0.7, ty + 0.6, 0.5, 0.35, 11, 5, '#A8B8CE', '#303B38', '#242D2A');
      drawIsoPrism(ctx, tx + 2.3, ty + 0.85, 0.5, 0.35, 11, 5, '#A8B8CE', '#303B38', '#242D2A');
      drawIsoPrism(ctx, tx + 1.5, ty + 0.7, 0.45, 0.45, 11, 2, '#F3F0E7', '#EAE5D8', '#C7BFAE');
      break;
    }
    case 'WHITEBOARD': {
      drawIsoPrism(ctx, tx + 0.15, ty + 0.25, w - 0.3, 0.32, 2, 18, '#9E6E42', '#F3F0E7', '#D9A66C', '#303B38');
      break;
    }
    case 'PLANT_FIDDLE': {
      const sway = Math.sin(timeSec * 1.6 + tx) * 0.05;
      drawIsoPrism(ctx, tx + 0.25, ty + 0.25, 0.5, 0.5, 0, 8, '#D68B7B', '#B86E5F', '#945446', '#303B38');
      drawIsoPrism(ctx, tx + 0.16 + sway, ty + 0.16, 0.68, 0.68, 8, 10, '#8FB0A2', '#78978A', '#5A786B', '#303B38');
      break;
    }
    case 'LOUNGE_SOFA': {
      drawIsoPrism(ctx, tx + 0.1, ty + 0.18, w - 0.2, h - 0.32, 0, 8, '#78978A', '#5A786B', '#465F54', '#303B38');
      drawIsoPrism(ctx, tx + 0.1, ty + 0.18, w - 0.2, 0.28, 8, 8, '#8FB0A2', '#5A786B', '#465F54', '#303B38');
      drawIsoPrism(ctx, tx + 0.22, ty + 0.48, 0.3, 0.3, 8, 4, '#D9A66C', '#9E6E42', '#7D5430');
      drawIsoPrism(ctx, tx + w - 0.52, ty + 0.48, 0.3, 0.3, 8, 4, '#D68B7B', '#B86E5F', '#945446');
      break;
    }
    case 'ARCADE_CABINET': {
      drawIsoPrism(ctx, tx + 0.16, ty + 0.16, 0.68, 0.68, 0, 21, '#303B38', '#495853', '#242D2A', '#1E2523');
      const glow = Math.floor(timeSec * 3) % 2 === 0 ? '#D68B7B' : '#A8B8CE';
      drawIsoPrism(ctx, tx + 0.26, ty + 0.65, 0.46, 0.14, 11, 7, '#F3F0E7', glow, '#303B38');
      break;
    }
    case 'SAFE_VAULT': {
      drawIsoPrism(ctx, tx + 0.15, ty + 0.15, 0.7, 0.7, 0, 16, '#A8B8CE', '#7E8FA6', '#303B38', '#303B38');
      drawIsoPrism(ctx, tx + 0.36, ty + 0.72, 0.26, 0.1, 7, 5, '#D9A66C', '#D9A66C', '#9E6E42');
      break;
    }
    case 'BOOKSHELF': {
      drawIsoPrism(ctx, tx + 0.12, ty + 0.16, w - 0.24, h - 0.32, 0, 19, '#D9A66C', '#9E6E42', '#7D5430', '#303B38');
      drawIsoPrism(ctx, tx + 0.25, ty + 0.58, 0.35, 0.2, 8, 7, '#D68B7B', '#D68B7B', '#945446');
      drawIsoPrism(ctx, tx + 0.75, ty + 0.58, 0.35, 0.2, 8, 7, '#78978A', '#78978A', '#5A786B');
      drawIsoPrism(ctx, tx + 1.25, ty + 0.58, 0.35, 0.2, 8, 7, '#A8B8CE', '#A8B8CE', '#6A7B93');
      break;
    }
    case 'PERK_COFFEE_MACHINE': {
      drawIsoPrism(ctx, tx + 0.16, ty + 0.16, 0.68, 0.68, 0, 10, '#495853', '#303B38', '#242D2A', '#1E2523');
      drawIsoPrism(ctx, tx + 0.24, ty + 0.24, 0.52, 0.52, 10, 9, '#D9A66C', '#9E6E42', '#7D5430', '#303B38');
      break;
    }
    case 'PERK_PING_PONG': {
      drawIsoPrism(ctx, tx + 0.12, ty + 0.14, w - 0.24, h - 0.28, 0, 10, '#78978A', '#5A786B', '#303B38', '#303B38');
      drawIsoPrism(ctx, tx + w * 0.48, ty + 0.14, 0.08, h - 0.28, 10, 4, '#F3F0E7', '#EAE5D8', '#C7BFAE');
      if (inUse) {
        const sweep = (Math.sin(timeSec * 6.5) + 1) * 0.5;
        const bp = worldToIso(tx + 0.3 + sweep * (w - 0.6), ty + 0.5, 13 + Math.abs(Math.sin(timeSec * 13)) * 5);
        ctx.fillStyle = '#F3F0E7';
        ctx.fillRect(bp.x - 2, bp.y - 2, 4, 4);
      }
      break;
    }
    case 'PERK_SNACK_PANTRY': {
      drawIsoPrism(ctx, tx + 0.15, ty + 0.15, 0.7, 0.7, 0, 18, '#495853', '#303B38', '#242D2A', '#303B38');
      drawIsoPrism(ctx, tx + 0.25, ty + 0.65, 0.5, 0.16, 8, 6, '#D9A66C', '#D68B7B', '#78978A');
      break;
    }
    case 'PERK_QUIET_POD': {
      drawIsoPrism(ctx, tx + 0.12, ty + 0.12, w - 0.24, h - 0.24, 0, 21, '#9E6E42', '#495853', '#303B38', '#303B38');
      drawIsoPrism(ctx, tx + 0.22, ty + 0.22, w - 0.44, h - 0.44, 21, 2, inUse ? '#78978A' : '#A8B8CE', '#78978A', '#5A786B');
      break;
    }
    case 'PERK_WELLNESS_SUITE': {
      drawIsoPrism(ctx, tx + 0.12, ty + 0.14, w - 0.24, h - 0.28, 0, 6, '#78978A', '#5A786B', '#465F54', '#303B38');
      drawIsoPrism(ctx, tx + 0.25, ty + 0.26, 0.9, 0.52, 6, 3, '#F3F0E7', '#D68B7B', '#B86E5F');
      break;
    }
    case 'HR_BOARD': {
      drawIsoPrism(ctx, tx + 0.15, ty + 0.2, w - 0.3, 0.32, 0, 18, '#9E6E42', '#D9A66C', '#7D5430', '#303B38');
      break;
    }
    case 'FINANCE_TERMINAL':
    case 'LEGAL_DESK':
    case 'RECEPTION_DESK':
    default: {
      drawIsoPrism(ctx, tx + 0.12, ty + 0.16, w - 0.24, h - 0.32, 0, 11, '#D9A66C', '#9E6E42', '#7D5430', '#303B38');
      drawIsoPrism(ctx, tx + 0.35, ty + 0.35, 0.55, 0.25, 11, 8, '#303B38', '#A8B8CE', '#242D2A');
      break;
    }
  }

  if (isHovered || isSelected || isMoving) {
    fillIsoTile(
      ctx,
      tx,
      ty,
      w,
      h,
      isMoving
        ? 'rgba(120, 151, 138, 0.25)'
        : isSelected
          ? 'rgba(217, 166, 108, 0.22)'
          : 'rgba(217, 166, 108, 0.16)',
      isMoving ? '#78978A' : isSelected ? '#D9A66C' : '#303B38',
      isSelected ? 2.4 : 2
    );
  }

  if (isHovered && !isMoving) {
    const furnLoc = getFurnitureLocalized(item.templateId, item.name);
    const labelCenter = worldToIso(tx + w * 0.5, ty + h * 0.5, 28);
    ctx.save();
    ctx.font = 'bold 12px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    const labelText = inUse ? `${furnLoc.name} · ${t('drawer.inUse')}` : furnLoc.name;
    const tw = ctx.measureText(labelText).width + 14;
    ctx.fillStyle = '#F3F0E7';
    ctx.fillRect(labelCenter.x - tw / 2, labelCenter.y - 12, tw, 17);
    ctx.strokeStyle = '#303B38';
    ctx.lineWidth = 1;
    ctx.strokeRect(labelCenter.x - tw / 2, labelCenter.y - 12, tw, 17);
    ctx.fillStyle = '#303B38';
    ctx.fillText(labelText, labelCenter.x, labelCenter.y);
    ctx.restore();
  }
}

function drawIsoCharacterSprite(
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
  celebrateSeed = 0,
  facing: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' = 'DOWN'
) {
  const footWorld = getCharacterFootWorld(pos);
  const foot = worldToIso(footWorld.x, footWorld.y, 0);
  const cx = Math.round(foot.x);
  const cy = Math.round(foot.y);

  const bob = isCelebrating
    ? Math.abs(Math.sin(timeSec * 7.2 + celebrateSeed)) * 4.5
    : isWalking
      ? Math.abs(Math.sin(timeSec * 12)) * 3
      : isWorking
        ? Math.sin(timeSec * 6) * 0.9
        : isResting
          ? Math.sin(timeSec * 2) * 0.6
          : Math.sin(timeSec * 2.5) * 0.8;

  // Selection / hover / founder ring on the isometric floor directly around foot-point
  if (isSelected || isHovered || isFounder) {
    ctx.strokeStyle = isSelected
      ? '#D9A66C'
      : isFounder
        ? '#303B38'
        : '#78978A';
    ctx.lineWidth = isSelected ? 2.4 : 1.8;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 13, 6.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Foot-point isometric shadow
  ctx.fillStyle = 'rgba(48, 59, 56, 0.34)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, 10, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  const stride = isWalking ? Math.sin(timeSec * 14) * 2.8 : 0;
  // Foot stands directly on (cx, cy); character height rises ~28px above foot-point
  const topY = cy - 27 - bob;
  const eyeShift = facing === 'LEFT' ? -1.5 : facing === 'RIGHT' ? 1.5 : 0;

  // Legs
  ctx.fillStyle = appearance.pantsColor;
  ctx.fillRect(cx - 5, Math.round(topY + 20), 4, Math.round(7 + stride * 0.4));
  ctx.fillRect(cx + 1, Math.round(topY + 20), 4, Math.round(7 - stride * 0.4));

  // Torso outline + fill
  ctx.fillStyle = 'rgba(48, 59, 56, 0.38)';
  ctx.fillRect(cx - 8, Math.round(topY + 10), 16, 12);
  ctx.fillStyle = appearance.shirtColor;
  ctx.fillRect(cx - 7, Math.round(topY + 11), 14, 10);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(cx - 7, Math.round(topY + 18), 14, 3);

  // Arms
  if (isCelebrating) {
    const wave = Math.sin(timeSec * 10 + celebrateSeed) * 2.2;
    ctx.fillStyle = appearance.shirtColor;
    ctx.fillRect(cx - 9, Math.round(topY + 4 + wave), 3, 8);
    ctx.fillRect(cx + 6, Math.round(topY + 4 - wave), 3, 8);
    ctx.fillStyle = appearance.skinTone;
    ctx.fillRect(cx - 9, Math.round(topY + 2 + wave), 3, 2);
    ctx.fillRect(cx + 6, Math.round(topY + 2 - wave), 3, 2);
  } else {
    const armOffset = isWorking
      ? Math.sin(timeSec * 14) * 1.5
      : isResting
        ? Math.sin(timeSec * 2.2) * 0.6
        : 0;
    ctx.fillStyle = appearance.shirtColor;
    ctx.fillRect(cx - 9, Math.round(topY + 12 + armOffset), 3, 7);
    ctx.fillRect(cx + 6, Math.round(topY + 12 - armOffset), 3, 7);
  }

  if (isResting && !isWalking && !isCelebrating) {
    ctx.fillStyle = '#F3F0E7';
    ctx.fillRect(cx + 8, Math.round(topY + 16), 4, 4);
    ctx.fillStyle = '#D9A66C';
    ctx.fillRect(cx + 9, Math.round(topY + 17), 2, 2);
  }

  // Head
  ctx.fillStyle = 'rgba(48, 59, 56, 0.38)';
  ctx.fillRect(cx - 7, Math.round(topY), 14, 12);
  ctx.fillStyle = appearance.skinTone;
  ctx.fillRect(cx - 6, Math.round(topY + 1), 12, 10);
  ctx.fillStyle = 'rgba(214, 139, 123, 0.55)';
  ctx.fillRect(cx - 6, Math.round(topY + 7), 2, 1);
  ctx.fillRect(cx + 4, Math.round(topY + 7), 2, 1);

  if (facing !== 'UP') {
    ctx.fillStyle = '#303B38';
    ctx.fillRect(Math.round(cx - 4 + eyeShift), Math.round(topY + 6), 2, 2);
    ctx.fillRect(Math.round(cx + 2 + eyeShift), Math.round(topY + 6), 2, 2);
    if (appearance.hasGlasses) {
      ctx.strokeStyle = '#303B38';
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(cx - 5 + eyeShift), Math.round(topY + 5), 4, 4);
      ctx.strokeRect(Math.round(cx + 1 + eyeShift), Math.round(topY + 5), 4, 4);
    }
  }

  if (appearance.hairStyle !== 'BALD') {
    ctx.fillStyle = appearance.hairColor;
    ctx.fillRect(cx - 7, Math.round(topY - 1), 14, 4);
    if (appearance.hairStyle === 'BOB' || appearance.hairStyle === 'PONYTAIL') {
      ctx.fillRect(cx - 7, Math.round(topY + 2), 2, 6);
      ctx.fillRect(cx + 5, Math.round(topY + 2), 2, 6);
    }
    if (appearance.hairStyle === 'SPIKY') {
      ctx.fillRect(cx - 4, Math.round(topY - 3), 3, 3);
      ctx.fillRect(cx + 1, Math.round(topY - 3), 3, 3);
    }
  }

  if (isFounder) {
    ctx.fillStyle = '#D9A66C';
    ctx.fillRect(cx - 4, Math.round(topY - 5), 8, 3);
    ctx.fillStyle = '#E8C08B';
    ctx.fillRect(cx - 4, Math.round(topY - 7), 2, 2);
    ctx.fillRect(cx - 1, Math.round(topY - 7), 2, 2);
    ctx.fillRect(cx + 2, Math.round(topY - 7), 2, 2);
  }

  if (isCelebrating && Math.sin(timeSec * 6 + celebrateSeed) > -0.2) {
    ctx.fillStyle = '#D9A66C';
    ctx.fillRect(cx + 8, Math.round(topY - 1), 3, 3);
    ctx.fillStyle = '#78978A';
    ctx.fillRect(cx - 10, Math.round(topY + 1), 2, 2);
  } else if (!isFounder && !isWalking) {
    if (moodTone === 'HAPPY' && Math.sin(timeSec * 3.5 + cx) > 0.25) {
      ctx.fillStyle = '#D68B7B';
      ctx.fillRect(cx + 8, Math.round(topY + 1), 3, 3);
    } else if (moodTone === 'STRESSED') {
      ctx.fillStyle = '#A8B8CE';
      ctx.fillRect(cx + 7, Math.round(topY + 3), 2, 3);
    }
  }

  if (thoughtIcon && (!isWalking || isCelebrating)) {
    const floatY = topY - 18 + Math.sin(timeSec * 3 + celebrateSeed) * 2;
    ctx.fillStyle = '#F3F0E7';
    ctx.fillRect(cx - 9, Math.round(floatY - 6), 18, 14);
    ctx.strokeStyle = isCelebrating ? '#D9A66C' : '#303B38';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - 9, Math.round(floatY - 6), 18, 14);
    ctx.font = '11px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(thoughtIcon, cx, Math.round(floatY + 4));
  }

  if (isFounder || isSelected || isHovered) {
    ctx.save();
    ctx.font = 'bold 12px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    const tw = ctx.measureText(label).width + 12;
    ctx.fillStyle = '#F3F0E7';
    ctx.fillRect(cx - tw / 2, cy + 8, tw, 16);
    ctx.strokeStyle = isSelected ? '#D9A66C' : '#303B38';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - tw / 2, cy + 8, tw, 16);
    ctx.fillStyle = '#303B38';
    ctx.fillText(label, cx, cy + 20);
    ctx.restore();
  }
}

function blendHexColor(a: string, b: string, t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  const rr = Math.round(ar + (br - ar) * clamped);
  const rg = Math.round(ag + (bg - ag) * clamped);
  const rb = Math.round(ab + (bb - ab) * clamped);
  return `#${rr.toString(16).padStart(2, '0')}${rg.toString(16).padStart(2, '0')}${rb.toString(16).padStart(2, '0')}`;
}

export function renderOfficeScene(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  state: GameState,
  camera: CameraState,
  interaction: RenderInteractionState,
  particles: Particle[],
  timeSec: number,
  reducedMotion = false
) {
  ctx.imageSmoothingEnabled = false;

  const weather = getEffectiveWeatherSnapshot(state);

  // Calm Cozy Pixel Art backdrop shifting cleanly across Sunny / Overcast / Rainy skies
  let backdrop = blendHexColor('#F3F0E7', '#E4E8E5', weather.overcastIntensity * 0.85);
  backdrop = blendHexColor(backdrop, '#D4DCE0', weather.rainIntensity * 0.78);
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.save();
  ctx.translate(Math.round(canvasWidth / 2), Math.round(canvasHeight / 2));
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(Math.round(-camera.x), Math.round(-camera.y));

  // Compute viewport-culled world bounds
  const corners = [
    screenToWorld(0, 0, canvasWidth, canvasHeight, camera),
    screenToWorld(canvasWidth, 0, canvasWidth, canvasHeight, camera),
    screenToWorld(canvasWidth, canvasHeight, canvasWidth, canvasHeight, camera),
    screenToWorld(0, canvasHeight, canvasWidth, canvasHeight, camera),
  ];
  const visMinX = Math.max(WORLD_MIN_X, Math.floor(Math.min(...corners.map((c) => c.x))) - 4);
  const visMaxX = Math.min(WORLD_MAX_X, Math.ceil(Math.max(...corners.map((c) => c.x))) + 4);
  const visMinY = Math.max(WORLD_MIN_Y, Math.floor(Math.min(...corners.map((c) => c.y))) - 4);
  const visMaxY = Math.min(WORLD_MAX_Y, Math.ceil(Math.max(...corners.map((c) => c.y))) + 4);

  // 0. Connected City Terrain (Meadow, Breezeways, Sidewalks, Main Street Road, Crosswalks, Plazas)
  drawConnectedCityTerrain(
    ctx,
    state,
    visMinX,
    visMaxX,
    visMinY,
    visMaxY,
    weather,
    timeSec,
    reducedMotion
  );

  // Soft cream terrace rim framing HQ
  fillIsoTile(
    ctx,
    -0.4,
    -0.4,
    OFFICE_COLS + 0.8,
    OFFICE_ROWS + 0.8,
    '#DDD6C6',
    'rgba(48, 59, 56, 0.35)',
    1.5
  );

  // 1. Isometric Room Floors & Corridor
  for (const room of Object.values(state.office.rooms)) {
    drawIsoRoomFloor(ctx, room);
  }
  drawIsoCorridorFloor(ctx);

  // 2. Room highlights & placement overlays on isometric floor plane
  if (interaction.highlightedRoomIds && interaction.highlightedRoomIds.length > 0) {
    const pulse = 0.45 + Math.abs(Math.sin(timeSec * 3.2)) * 0.45;
    for (const rId of interaction.highlightedRoomIds) {
      const r = state.office.rooms[rId];
      if (!r) continue;
      fillIsoTile(
        ctx,
        r.bounds.x + 0.25,
        r.bounds.y + 0.25,
        r.bounds.w - 0.5,
        r.bounds.h - 0.5,
        'rgba(120, 151, 138, 0.08)',
        `rgba(120, 151, 138, ${pulse.toFixed(3)})`,
        3
      );
    }
  }

  if (
    interaction.hoveredRoomId &&
    interaction.hoveredRoomId !== interaction.selectedRoomId &&
    !interaction.hoveredEntityId
  ) {
    const hr = state.office.rooms[interaction.hoveredRoomId];
    if (hr && hr.unlocked) {
      fillIsoTile(
        ctx,
        hr.bounds.x + 0.22,
        hr.bounds.y + 0.22,
        hr.bounds.w - 0.44,
        hr.bounds.h - 0.44,
        'rgba(120, 151, 138, 0.04)',
        'rgba(48, 59, 56, 0.35)',
        1.5
      );
    }
  }

  if (interaction.selectedRoomId) {
    const r = state.office.rooms[interaction.selectedRoomId];
    if (r) {
      fillIsoTile(
        ctx,
        r.bounds.x + 0.18,
        r.bounds.y + 0.18,
        r.bounds.w - 0.36,
        r.bounds.h - 0.36,
        'rgba(120, 151, 138, 0.07)',
        '#78978A',
        2.5
      );
    }
  }

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
      fillIsoTile(
        ctx,
        ht.x,
        ht.y,
        w,
        h,
        check.valid ? 'rgba(16, 185, 129, 0.32)' : 'rgba(239, 68, 68, 0.32)',
        check.valid ? '#10b981' : '#ef4444',
        2
      );
    } else if (
      !interaction.hoveredRoomId ||
      state.office.rooms[interaction.hoveredRoomId]?.unlocked !== false
    ) {
      fillIsoTile(
        ctx,
        ht.x,
        ht.y,
        1,
        1,
        'rgba(243, 240, 231, 0.18)',
        'rgba(48, 59, 56, 0.42)',
        1.2
      );
    }
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
      fillIsoTile(
        ctx,
        targetRoom.bounds.x + 1,
        targetRoom.bounds.y + 1,
        targetRoom.bounds.w - 2,
        targetRoom.bounds.h - 2,
        `rgba(217, 166, 108, ${(0.1 * pulse).toFixed(3)})`,
        `rgba(217, 166, 108, ${(0.75 * pulse).toFixed(3)})`,
        2.5
      );
    }
  }

  // 3. Unified Isometric Depth-Sorted Draw Queue (Walls, Buildings, Props, Furniture, NPCs, Team)
  const charPositions: GridPoint[] = [
    state.founder.position,
    ...state.employees.map((e) => e.position),
    ...state.visitors.map((v) => v.position),
    ...(state.world?.npcs ?? []).map((n) => n.position),
  ];

  type RenderOp = {
    depth: number;
    layerTie: number;
    draw: () => void;
  };
  const ops: RenderOp[] = [];

  // Walls & Doorways
  const seenWallTiles = new Set<string>();
  const lobbyUnlocked = Boolean(state.office.rooms.LOBBY?.unlocked);
  const isOuterWorldDoor = (tx: number, ty: number) =>
    ((tx === 0 || tx === OFFICE_COLS - 1) && (ty === 11 || ty === 12)) ||
    (lobbyUnlocked && ty === OFFICE_ROWS - 1 && (tx === 4 || tx === 5));

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

        if ((isDoor && room.unlocked) || isOuterWorldDoor(tx, ty)) {
          fillIsoTile(ctx, tx, ty, 1, 1, '#D9A66C', '#9E6E42', 1);
          seenWallTiles.add(`${tx},${ty}`);
          continue;
        }

        const key = `${tx},${ty}`;
        if (seenWallTiles.has(key)) continue;
        seenWallTiles.add(key);

        const wallKind: 'NORTH' | 'SOUTH' | 'INTERIOR' =
          ty === 0 ? 'NORTH' : ty === OFFICE_ROWS - 1 ? 'SOUTH' : 'INTERIOR';
        const hasWindow =
          (ty === 0 || ty === OFFICE_ROWS - 1) &&
          tx % 3 === 0 &&
          tx > 1 &&
          tx < OFFICE_COLS - 2;
        const hasClock = ty === 0 && tx === 17;
        const occluding = ty > 0 && isCharBehindWallTile(tx, ty, charPositions);

        ops.push({
          depth: getIsoDepth(tx + 0.5, ty + 0.5, 0.05),
          layerTie: 0,
          draw: () =>
            drawIsoWallTile(
              ctx,
              tx,
              ty,
              wallKind,
              hasWindow,
              hasClock,
              state,
              weather,
              timeSec,
              occluding
            ),
        });
      }
    }
  }

  // Outer perimeter enclosing walls (preserving West/East breezeway doors & Lobby south entrance)
  for (let tx = 0; tx < OFFICE_COLS; tx++) {
    for (const ty of [0, OFFICE_ROWS - 1]) {
      const key = `${tx},${ty}`;
      if (seenWallTiles.has(key)) continue;
      seenWallTiles.add(key);
      if (isOuterWorldDoor(tx, ty)) {
        fillIsoTile(ctx, tx, ty, 1, 1, '#D9A66C', '#9E6E42', 1);
        continue;
      }
      const wallKind: 'NORTH' | 'SOUTH' = ty === 0 ? 'NORTH' : 'SOUTH';
      const hasWindow = tx % 3 === 0 && tx > 1 && tx < OFFICE_COLS - 2;
      const occluding = ty > 0 && isCharBehindWallTile(tx, ty, charPositions);
      ops.push({
        depth: getIsoDepth(tx + 0.5, ty + 0.5, 0.05),
        layerTie: 0,
        draw: () =>
          drawIsoWallTile(
            ctx,
            tx,
            ty,
            wallKind,
            hasWindow,
            false,
            state,
            weather,
            timeSec,
            occluding
          ),
      });
    }
  }
  for (let ty = 1; ty < OFFICE_ROWS - 1; ty++) {
    for (const tx of [0, OFFICE_COLS - 1]) {
      const key = `${tx},${ty}`;
      if (seenWallTiles.has(key)) continue;
      seenWallTiles.add(key);
      if (isOuterWorldDoor(tx, ty)) {
        fillIsoTile(ctx, tx, ty, 1, 1, '#D9A66C', '#9E6E42', 1);
        continue;
      }
      const occluding = isCharBehindWallTile(tx, ty, charPositions);
      ops.push({
        depth: getIsoDepth(tx + 0.5, ty + 0.5, 0.05),
        layerTie: 0,
        draw: () =>
          drawIsoWallTile(
            ctx,
            tx,
            ty,
            'INTERIOR',
            false,
            false,
            state,
            weather,
            timeSec,
            occluding
          ),
      });
    }
  }

  // City District Buildings (viewport-culled)
  for (const b of CITY_BUILDINGS) {
    if (
      b.bounds.x + b.bounds.w < visMinX - 2 ||
      b.bounds.x > visMaxX + 2 ||
      b.bounds.y + b.bounds.h < visMinY - 2 ||
      b.bounds.y > visMaxY + 2
    ) {
      continue;
    }
    const buildingDepth = getIsoDepth(
      b.bounds.x + b.bounds.w * 0.58,
      b.bounds.y + b.bounds.h * 0.58,
      0.12
    );
    ops.push({
      depth: buildingDepth,
      layerTie: 1,
      draw: () =>
        drawIsoCityBuilding(
          ctx,
          b,
          state,
          weather,
          interaction.hoveredLocationId === b.id,
          interaction.selectedLocationId === b.id
        ),
    });
  }

  // Individual Business Property Lots (Kiosk / Sales Hub / Studio)
  for (const prop of state.world?.properties ?? []) {
    if (
      prop.lotTile.x + 4 < visMinX ||
      prop.lotTile.x > visMaxX ||
      prop.lotTile.y + 4 < visMinY ||
      prop.lotTile.y > visMaxY
    ) {
      continue;
    }
    ops.push({
      depth: getIsoDepth(prop.lotTile.x + 2, prop.lotTile.y + 2, 0.16),
      layerTie: 1,
      draw: () => drawIsoBusinessPropertyLot(ctx, prop),
    });
  }

  // Street Props (Trees, Streetlamps, Benches, Cafe Tables, Bus Stop, Company Billboard)
  for (const prop of CITY_STREET_PROPS) {
    if (
      prop.tile.x < visMinX - 2 ||
      prop.tile.x > visMaxX + 2 ||
      prop.tile.y < visMinY - 2 ||
      prop.tile.y > visMaxY + 2
    ) {
      continue;
    }
    ops.push({
      depth: getIsoDepth(prop.tile.x + 0.5, prop.tile.y + 0.5, 0.14),
      layerTie: 1,
      draw: () => drawIsoStreetProp(ctx, prop, state, weather, timeSec, reducedMotion),
    });
  }

  // Furniture
  const renderableFurniture = getRenderableFurniture(state.office);
  const hasErgonomicChairs = (state.office.purchasedPerks ?? []).includes('perk_ergonomic_chairs');
  for (const item of renderableFurniture) {
    const roomUnlocked = state.office.rooms[item.roomId]?.unlocked !== false;
    const itemDepth = getIsoDepth(
      item.tile.x + item.width * 0.55,
      item.tile.y + item.height * 0.55,
      0.1
    );
    ops.push({
      depth: itemDepth,
      layerTie: 1,
      draw: () =>
        drawIsoFurnitureItem(
          ctx,
          item,
          timeSec,
          state.office.techTier,
          hasErgonomicChairs,
          isFurnitureInUse(item, state),
          roomUnlocked && interaction.hoveredEntityId === item.id,
          interaction.movingFurnitureId === item.id,
          roomUnlocked && interaction.selectedFurnitureId === item.id
        ),
    });
  }

  // Visitors
  for (const vis of state.visitors) {
    const foot = getCharacterFootWorld(vis.position);
    ops.push({
      depth: getIsoDepth(foot.x, foot.y, 0.2),
      layerTie: 2,
      draw: () =>
        drawIsoCharacterSprite(
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
        ),
    });
  }

  // Open World City NPCs
  for (const npc of state.world?.npcs ?? []) {
    const foot = getCharacterFootWorld(npc.position);
    ops.push({
      depth: getIsoDepth(foot.x, foot.y, 0.21),
      layerTie: 2,
      draw: () =>
        drawIsoCharacterSprite(
          ctx,
          npc.position,
          npc.appearance,
          false,
          false,
          npc.kind === 'CUSTOMER' && npc.locationId === 'COFFEE_SHOP',
          'HAPPY',
          false,
          npc.name,
          npc.moodIcon,
          interaction.selectedWorldNpcId === npc.id,
          interaction.hoveredEntityId === npc.id,
          timeSec,
          false,
          0,
          npc.facing
        ),
    });
  }

  // Celebration emote pools
  const launchEmotes = ['🎉', '🚀', '👏', '✨', '🥂'];
  const expansionEmotes = ['✨', '🎉', '🏢', '👏', '☕'];
  const emotePool =
    activeCelebration?.kind === 'PRODUCT_MVP_LAUNCH' ||
    activeCelebration?.kind === 'PRODUCT_MATURE_RELEASE'
      ? launchEmotes
      : expansionEmotes;

  // Founder
  {
    const f = state.founder;
    const foot = getCharacterFootWorld(f.position);
    const founderBubble = activeCelebration ? emotePool[0] : null;
    ops.push({
      depth: getIsoDepth(foot.x, foot.y, 0.22),
      layerTie: 3,
      draw: () =>
        drawIsoCharacterSprite(
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
          0.35,
          f.facing
        ),
    });
  }

  // Employees
  state.employees.forEach((e, idx) => {
    const foot = getCharacterFootWorld(e.position);
    const isTutEmp = interaction.highlightedEmployeeId === e.id;
    const moodTone: 'HAPPY' | 'NEUTRAL' | 'STRESSED' =
      e.stress > 70 || e.morale < 45 ? 'STRESSED' : e.morale >= 75 ? 'HAPPY' : 'NEUTRAL';
    const empCelebrationBubble = activeCelebration
      ? emotePool[(idx + 1 + Math.floor(timeSec * 0.6)) % emotePool.length]
      : e.thoughtIcon;

    ops.push({
      depth: getIsoDepth(foot.x, foot.y, 0.22),
      layerTie: 3,
      draw: () => {
        if (isTutEmp) {
          const pulse = 0.45 + Math.abs(Math.sin(timeSec * 3.4)) * 0.45;
          const sp = worldToIso(foot.x, foot.y, 0);
          ctx.save();
          ctx.strokeStyle = `rgba(217, 166, 108, ${pulse})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(sp.x, sp.y, 17, 8.5, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        drawIsoCharacterSprite(
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
          (idx + 1) * 1.15,
          e.facing
        );
      },
    });
  });

  // Sort back-to-front using isometric painter's depth order
  ops.sort((a, b) => a.depth - b.depth || a.layerTie - b.layerTie);
  for (const op of ops) {
    op.draw();
  }

  // 4. Room Plaques (elevated cleanly above room north edge)
  for (const room of Object.values(state.office.rooms)) {
    if (!room.unlocked && interaction.selectedRoomId !== room.id) continue;
    const { x, y, w } = room.bounds;
    const plaqueCenter = worldToIso(x + w * 0.5, y + 0.5, 29);
    const localizedRoom = getRoomLocalized(room.id, room.unlockCost);
    ctx.save();
    ctx.font = 'bold 12px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    const text = localizedRoom.name;
    const tw = ctx.measureText(text).width + 14;
    ctx.fillStyle = '#F3F0E7';
    ctx.fillRect(plaqueCenter.x - tw / 2, plaqueCenter.y - 10, tw, 17);
    ctx.strokeStyle = 'rgba(48, 59, 56, 0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(plaqueCenter.x - tw / 2, plaqueCenter.y - 10, tw, 17);
    ctx.fillStyle = '#303B38';
    ctx.fillText(text, plaqueCenter.x, plaqueCenter.y + 2);
    ctx.restore();
  }

  // 5. Pooled particles projected into isometric coordinates
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    const isoPos =
      p.wx !== undefined && p.wy !== undefined
        ? worldToIso(p.wx, p.wy, p.wz ?? 0)
        : worldToIso(p.x / TILE_SIZE, p.y / TILE_SIZE, 16);
    if (p.text) {
      ctx.font = 'bold 12px Arial, Helvetica, sans-serif';
      ctx.fillStyle = p.color;
      ctx.textAlign = 'center';
      ctx.fillText(p.text, isoPos.x, isoPos.y);
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(isoPos.x), Math.round(isoPos.y), p.size, p.size);
    }
  }
  ctx.globalAlpha = 1;

  // 6. Locked room isometric veil & padlock plaques
  for (const room of Object.values(state.office.rooms)) {
    if (room.unlocked) continue;
    const isHovered = interaction.hoveredRoomId === room.id;
    const isSelected = interaction.selectedRoomId === room.id;
    const canAfford = state.finance.cash >= room.unlockCost;

    fillIsoTile(
      ctx,
      room.bounds.x + 1,
      room.bounds.y + 1,
      room.bounds.w - 2,
      room.bounds.h - 2,
      isHovered || isSelected ? 'rgba(243, 240, 231, 0.38)' : 'rgba(243, 240, 231, 0.5)',
      isSelected
        ? '#78978A'
        : isHovered
          ? 'rgba(48, 59, 56, 0.55)'
          : 'rgba(48, 59, 56, 0.28)',
      isHovered || isSelected ? 2 : 1.4
    );

    const center = worldToIso(
      room.bounds.x + room.bounds.w * 0.5,
      room.bounds.y + room.bounds.h * 0.5,
      6
    );
    const costText = formatCurrency(room.unlockCost);
    ctx.save();
    ctx.font = 'bold 12px Arial, Helvetica, sans-serif';
    const costW = ctx.measureText(costText).width;
    const badgeW = Math.max(78, Math.ceil(costW) + 32);
    const badgeH = 26;
    const badgeX = Math.round(center.x - badgeW / 2);
    const badgeY = Math.round(center.y - badgeH / 2);

    ctx.fillStyle = 'rgba(48, 59, 56, 0.22)';
    ctx.fillRect(badgeX + 2, badgeY + 2, badgeW, badgeH);
    ctx.fillStyle = '#F3F0E7';
    ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
    ctx.strokeStyle = isSelected || isHovered ? '#303B38' : 'rgba(48, 59, 56, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);

    const cornerAccent = canAfford ? '#78978A' : '#D9A66C';
    ctx.fillStyle = cornerAccent;
    ctx.fillRect(badgeX + 2, badgeY + 2, 2, 2);
    ctx.fillRect(badgeX + badgeW - 4, badgeY + 2, 2, 2);
    ctx.fillRect(badgeX + 2, badgeY + badgeH - 4, 2, 2);
    ctx.fillRect(badgeX + badgeW - 4, badgeY + badgeH - 4, 2, 2);

    const lx = badgeX + 9;
    const ly = badgeY + 6;
    ctx.fillStyle = '#303B38';
    ctx.fillRect(lx + 2, ly, 6, 2);
    ctx.fillRect(lx + 1, ly + 1, 2, 4);
    ctx.fillRect(lx + 7, ly + 1, 2, 4);
    ctx.fillStyle = '#D9A66C';
    ctx.fillRect(lx, ly + 5, 10, 8);
    ctx.strokeStyle = '#303B38';
    ctx.lineWidth = 1;
    ctx.strokeRect(lx, ly + 5, 10, 8);
    ctx.fillStyle = '#303B38';
    ctx.fillRect(lx + 4, ly + 7, 2, 3);

    ctx.textAlign = 'left';
    ctx.fillText(costText, lx + 14, badgeY + 17);
    ctx.restore();
  }

  // 7. Day/Night & Global Weather ambient lighting wash across visible Connected World
  const hour = state.hourOfDay;
  const washW = WORLD_MAX_X - WORLD_MIN_X + 2;
  const washH = WORLD_MAX_Y - WORLD_MIN_Y + 2;
  if (hour < 9.5) {
    fillIsoTile(ctx, WORLD_MIN_X - 0.5, WORLD_MIN_Y - 0.5, washW, washH, 'rgba(253, 230, 138, 0.05)');
  } else if (hour >= 16.5 && hour < 17.5) {
    fillIsoTile(ctx, WORLD_MIN_X - 0.5, WORLD_MIN_Y - 0.5, washW, washH, 'rgba(251, 146, 60, 0.08)');
  } else if (hour >= 17.5) {
    fillIsoTile(ctx, WORLD_MIN_X - 0.5, WORLD_MIN_Y - 0.5, washW, washH, 'rgba(15, 23, 42, 0.22)');
  }

  // Weather atmospheric light balance across office & city exterior
  if (weather.sunlightIntensity > 0.2 && hour < 17.3) {
    const sunGlaze = 0.055 * weather.sunlightIntensity;
    fillIsoTile(
      ctx,
      WORLD_MIN_X - 0.5,
      WORLD_MIN_Y - 0.5,
      washW,
      washH,
      `rgba(254, 240, 178, ${sunGlaze.toFixed(3)})`
    );
  }
  if (weather.overcastIntensity > 0.12) {
    const cloudWash = 0.095 * weather.overcastIntensity;
    fillIsoTile(
      ctx,
      WORLD_MIN_X - 0.5,
      WORLD_MIN_Y - 0.5,
      washW,
      washH,
      `rgba(62, 78, 86, ${cloudWash.toFixed(3)})`
    );

    // Slow-drifting isometric cloud shadow bands across the Connected City
    const driftOffset = reducedMotion ? 0 : (timeSec * 1.15) % 44;
    const shadowAlpha = 0.065 * weather.overcastIntensity;
    for (let c = 0; c < 3; c++) {
      const cx = WORLD_MIN_X + ((c * 24 + driftOffset) % 72) - 8;
      const cy = WORLD_MIN_Y + c * 11 + 2;
      fillIsoTile(
        ctx,
        cx,
        cy,
        11,
        7,
        `rgba(36, 48, 52, ${shadowAlpha.toFixed(3)})`
      );
    }
  }
  if (weather.rainIntensity > 0.12) {
    const rainWash = 0.13 * weather.rainIntensity;
    fillIsoTile(
      ctx,
      WORLD_MIN_X - 0.5,
      WORLD_MIN_Y - 0.5,
      washW,
      washH,
      `rgba(30, 48, 66, ${rainWash.toFixed(3)})`
    );
  }

  // Warm interior desk/lamp glow & exterior streetlamp halos in evening OR overcast/rainy weather
  const cozyLampsActive =
    hour >= 17.5 || weather.rainIntensity >= 0.35 || weather.overcastIntensity >= 0.58;
  if (cozyLampsActive) {
    const lampStrength =
      hour >= 17.5
        ? 1
        : Math.max(weather.rainIntensity * 0.9, weather.overcastIntensity * 0.68);
    for (const item of renderableFurniture) {
      if (
        item.templateId === 'CEO_DESK' ||
        item.templateId === 'WORKSTATION' ||
        item.templateId === 'ESPRESSO_BAR' ||
        item.templateId === 'PERK_COFFEE_MACHINE' ||
        item.templateId === 'PERK_QUIET_POD' ||
        item.templateId === 'PERK_WELLNESS_SUITE'
      ) {
        const gp = worldToIso(item.tile.x + item.width * 0.5, item.tile.y + item.height * 0.5, 6);
        const grad = ctx.createRadialGradient(gp.x, gp.y, 4, gp.x, gp.y, 52);
        grad.addColorStop(0, `rgba(251, 191, 36, ${(0.22 * lampStrength).toFixed(3)})`);
        grad.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(gp.x - 52, gp.y - 52, 104, 104);
      }
    }
    for (const prop of CITY_STREET_PROPS) {
      if (prop.kind !== 'LAMP') continue;
      const gp = worldToIso(prop.tile.x + 0.5, prop.tile.y + 0.5, 22);
      const grad = ctx.createRadialGradient(gp.x, gp.y, 4, gp.x, gp.y, 68);
      grad.addColorStop(0, `rgba(251, 191, 36, ${(0.28 * lampStrength).toFixed(3)})`);
      grad.addColorStop(1, 'rgba(251, 191, 36, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(gp.x - 68, gp.y - 68, 136, 136);
    }
  }

  ctx.restore();

  // 8. Subtle screen-space weather overlay (confetti-safe, reduced-motion aware)
  drawWeatherCanvasOverlay(
    ctx,
    canvasWidth,
    canvasHeight,
    weather,
    hour,
    timeSec,
    reducedMotion
  );
}

function drawConnectedCityTerrain(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  visMinX: number,
  visMaxX: number,
  visMinY: number,
  visMaxY: number,
  weather: WeatherSnapshot,
  timeSec: number,
  reducedMotion: boolean
) {
  const wetFactor = Math.max(weather.rainIntensity, weather.overcastIntensity * 0.45);
  const roadLight = blendHexColor('#535F5B', '#44504D', wetFactor * 0.75);
  const roadDark = blendHexColor('#4E5A56', '#3E4A47', wetFactor * 0.75);
  const sidewalkLight = blendHexColor('#E4DEC9', '#D6D1BF', wetFactor * 0.65);
  const sidewalkDark = blendHexColor('#DDD6C3', '#CFC8B6', wetFactor * 0.65);
  const grassLight = blendHexColor(
    weather.sunlightIntensity > 0.4 ? '#C9D6BE' : '#C5D1BF',
    '#B1C1AF',
    wetFactor * 0.6
  );
  const grassDark = blendHexColor(
    weather.sunlightIntensity > 0.4 ? '#C0CEB5' : '#BCC9B6',
    '#A7B8A5',
    wetFactor * 0.6
  );

  // Base meadow outside HQ
  for (let ty = visMinY; ty <= visMaxY; ty++) {
    for (let tx = visMinX; tx <= visMaxX; tx++) {
      if (tx >= 0 && tx < OFFICE_COLS && ty >= 0 && ty < OFFICE_ROWS) continue;

      const isRoad = ty >= 25 && ty <= 28 && tx >= -13 && tx <= 49;
      const isSidewalk =
        (ty === 23 || ty === 24 || ty === 29 || ty === 30 || ty === 31 || ty === 32) &&
        tx >= -13 &&
        tx <= 49;
      const isWestPlaza =
        ((tx >= -3 && tx <= -1 && ty >= 11 && ty <= 22) ||
          (tx >= -13 && tx <= -1 && ty >= 20 && ty <= 22));
      const isEastPlaza =
        ((tx >= 36 && tx <= 38 && ty >= 11 && ty <= 22) ||
          (tx >= 36 && tx <= 49 && ty >= 20 && ty <= 22));

      if (isRoad) {
        const alt = (tx + ty) % 2 === 0;
        fillIsoTile(ctx, tx, ty, 1, 1, alt ? roadLight : roadDark, '#3F4B47', 0.45);
        // Dashed lane separator down center of Main Street
        if (ty === 26 && Math.abs(tx) % 3 !== 0) {
          fillIsoTile(ctx, tx + 0.15, 26.86, 0.7, 0.14, '#EAE5D8');
        }
        // Crisp crosswalk stripes near HQ Lobby, Event Hall & Coworking corner
        if (tx === -5 || tx === 4 || tx === 18 || tx === 38) {
          fillIsoTile(ctx, tx + 0.22, ty + 0.15, 0.56, 0.7, 'rgba(250, 248, 242, 0.72)');
        }
      } else if (isSidewalk || isWestPlaza || isEastPlaza) {
        const alt = (tx + ty) % 2 === 0;
        fillIsoTile(ctx, tx, ty, 1, 1, alt ? sidewalkLight : sidewalkDark, '#C4BCA8', 0.5);
      } else {
        const alt = (tx + ty) % 2 === 0;
        fillIsoTile(ctx, tx, ty, 1, 1, alt ? grassLight : grassDark, 'rgba(48,59,56,0.06)', 0.4);
      }

      // Cozy exterior rain puddles & animated pixel ripples on Main Street road & plazas
      if (weather.rainIntensity >= 0.18 && (isRoad || isSidewalk || isWestPlaza || isEastPlaza)) {
        const hash = ((Math.imul(tx + 97, 73856093) ^ Math.imul(ty + 53, 19349663)) >>> 0) % 19;
        if (hash === 0) {
          const puddleAlpha = Math.min(0.42, 0.18 + weather.rainIntensity * 0.25);
          fillIsoTile(
            ctx,
            tx + 0.2,
            ty + 0.24,
            0.55,
            0.46,
            `rgba(168, 184, 206, ${puddleAlpha.toFixed(3)})`
          );
          if (!reducedMotion && weather.rainIntensity >= 0.35) {
            const centerIso = worldToIso(tx + 0.48, ty + 0.47, 0);
            const ripplePhase = (timeSec * 1.8 + (tx * 0.37 + ty * 0.23)) % 1;
            const rx = 2 + ripplePhase * 5.5;
            const ry = 1 + ripplePhase * 2.6;
            ctx.save();
            ctx.strokeStyle = `rgba(243, 240, 231, ${((1 - ripplePhase) * 0.55 * weather.rainIntensity).toFixed(3)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.ellipse(centerIso.x, centerIso.y, rx, ry, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
        }
      }
    }
  }

  // Curbs bordering Main Street road
  fillIsoTile(ctx, -13, 24.85, 63, 0.15, '#FAF8F2');
  fillIsoTile(ctx, -13, 29.0, 63, 0.15, '#FAF8F2');

  // HQ Breezeway welcome mats
  fillIsoTile(ctx, -1, 11, 1, 2, '#D9A66C', '#9E6E42', 1);
  fillIsoTile(ctx, OFFICE_COLS, 11, 1, 2, '#D9A66C', '#9E6E42', 1);
  if (state.office.rooms.LOBBY?.unlocked) {
    fillIsoTile(ctx, 4, OFFICE_ROWS, 2, 1, '#D9A66C', '#9E6E42', 1);
  }

  // City Building entrance welcome tiles
  for (const b of CITY_BUILDINGS) {
    fillIsoTile(ctx, b.entranceTile.x, b.entranceTile.y, 1, 1, '#D9A66C', '#303B38', 1);
  }
}

function drawIsoCityBuilding(
  ctx: CanvasRenderingContext2D,
  b: CityBuildingSpec,
  state: GameState,
  weather: WeatherSnapshot,
  isHovered: boolean,
  isSelected: boolean
) {
  const { x, y, w, h } = b.bounds;

  // Ground contact shadow
  fillIsoTile(ctx, x - 0.15, y - 0.15, w + 0.3, h + 0.3, 'rgba(48, 59, 56, 0.24)');

  if (b.id === 'BUSINESS_PROPERTIES') {
    // Low architectural plaza base for the 3 expandable commercial lots
    drawIsoPrism(
      ctx,
      x,
      y,
      w,
      h,
      0,
      5,
      '#DDD6C6',
      '#C8C0AE',
      '#B5AD9B',
      isHovered || isSelected ? '#303B38' : 'rgba(48, 59, 56, 0.4)'
    );
  } else {
    // Main 2.5D Isometric Building Shell
    drawIsoPrism(
      ctx,
      x + 0.15,
      y + 0.15,
      w - 0.3,
      h - 0.3,
      0,
      b.heightPx,
      b.roofColor,
      b.wallLeftColor,
      b.wallRightColor,
      isHovered || isSelected ? '#D9A66C' : '#303B38'
    );

    // Rooftop skylight / parapet rim
    drawIsoPrism(
      ctx,
      x + 0.65,
      y + 0.65,
      w - 1.3,
      h - 1.3,
      b.heightPx,
      5,
      b.accentColor,
      b.roofColor,
      '#303B38',
      'rgba(48, 59, 56, 0.45)'
    );

    // Subtle rain sheen on rooftop when raining
    if (weather.rainIntensity >= 0.3) {
      fillIsoTile(
        ctx,
        x + 0.75,
        y + 0.75,
        w - 1.5,
        h - 1.5,
        `rgba(168, 184, 206, ${(0.18 * weather.rainIntensity).toFixed(3)})`,
        undefined,
        1,
        b.heightPx + 5
      );
    }

    // Cozy windows along south-west (+y) storefront wall (glow warmly in evening, rain, or heavy overcast)
    const warmWindowLit =
      state.hourOfDay >= 17.5 ||
      weather.rainIntensity >= 0.35 ||
      weather.overcastIntensity >= 0.55;
    const windowColor = warmWindowLit
      ? '#F7D27A'
      : weather.sunlightIntensity > 0.5
        ? '#C5D8EC'
        : '#A8B8CE';
    for (let wx = x + 1.1; wx < x + w - 1.4; wx += 1.8) {
      const p0 = worldToIso(wx, y + h - 0.14, 24);
      const p1 = worldToIso(wx + 0.9, y + h - 0.14, 24);
      const p2 = worldToIso(wx + 0.9, y + h - 0.14, 12);
      const p3 = worldToIso(wx, y + h - 0.14, 12);
      tracePoly(ctx, [p0, p1, p2, p3]);
      ctx.fillStyle = windowColor;
      ctx.fill();
      ctx.strokeStyle = '#303B38';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Coffee shop striped awning
    if (b.id === 'COFFEE_SHOP') {
      drawIsoPrism(ctx, x + 0.8, y + h - 0.15, w - 1.6, 0.85, 16, 4, '#D68B7B', '#FAF8F2', '#B86E5F', '#303B38');
    }
  }

  // Hover/Selected perimeter glow
  if (isHovered || isSelected) {
    fillIsoTile(
      ctx,
      x,
      y,
      w,
      h,
      'rgba(217, 166, 108, 0.12)',
      isSelected ? '#D9A66C' : '#303B38',
      2.2
    );
  }

  // Clean Cozy Pixel Art District Signboard
  const signPos = worldToIso(
    x + w * 0.5,
    y + h * 0.5,
    b.id === 'BUSINESS_PROPERTIES' ? 24 : b.heightPx + 14
  );
  const label = `${b.icon} ${t(`world.locations.${b.id}.shortName`)}`;
  ctx.save();
  ctx.font = 'bold 12px Arial, Helvetica, sans-serif';
  ctx.textAlign = 'center';
  const tw = ctx.measureText(label).width + 16;
  ctx.fillStyle = isSelected ? '#78978A' : '#F3F0E7';
  ctx.fillRect(signPos.x - tw / 2, signPos.y - 11, tw, 19);
  ctx.strokeStyle = '#303B38';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(signPos.x - tw / 2, signPos.y - 11, tw, 19);
  ctx.fillStyle = '#303B38';
  ctx.fillText(label, signPos.x, signPos.y + 3);
  ctx.restore();
}

function drawIsoBusinessPropertyLot(ctx: CanvasRenderingContext2D, prop: BusinessPropertyState) {
  const { x, y } = prop.lotTile;
  if (prop.owned) {
    drawIsoPrism(ctx, x, y, 4, 4, 5, 22, '#78978A', '#FAF8F2', '#EAE5D8', '#303B38');
    drawIsoPrism(ctx, x + 0.6, y + 0.6, 2.8, 2.8, 27, 4, '#D9A66C', '#9E6E42', '#7D5430', '#303B38');
  } else {
    drawIsoPrism(ctx, x + 0.4, y + 0.4, 3.2, 3.2, 5, 6, '#EAE5D8', '#D9A66C', '#9E6E42', 'rgba(48,59,56,0.6)');
  }
  const badgePos = worldToIso(x + 2, y + 2, prop.owned ? 36 : 15);
  const label = prop.owned ? `✓ ${t(`world.properties.${prop.id}.shortName`)}` : formatCurrency(prop.cost);
  ctx.save();
  ctx.font = 'bold 11px Arial, Helvetica, sans-serif';
  ctx.textAlign = 'center';
  const tw = ctx.measureText(label).width + 12;
  ctx.fillStyle = prop.owned ? '#78978A' : '#FAF8F2';
  ctx.fillRect(badgePos.x - tw / 2, badgePos.y - 9, tw, 16);
  ctx.strokeStyle = '#303B38';
  ctx.lineWidth = 1;
  ctx.strokeRect(badgePos.x - tw / 2, badgePos.y - 9, tw, 16);
  ctx.fillStyle = '#303B38';
  ctx.fillText(label, badgePos.x, badgePos.y + 3);
  ctx.restore();
}

function drawIsoStreetProp(
  ctx: CanvasRenderingContext2D,
  prop: StreetProp,
  state: GameState,
  weather: WeatherSnapshot,
  timeSec: number,
  reducedMotion: boolean
) {
  const { x, y } = prop.tile;
  switch (prop.kind) {
    case 'TREE': {
      const swayFreq = 1.4 + weather.rainIntensity * 0.9;
      const sway = reducedMotion ? 0 : Math.sin(timeSec * swayFreq + x * 0.7) * 0.05;
      drawIsoPrism(ctx, x + 0.36, y + 0.36, 0.28, 0.28, 0, 11, '#9E6E42', '#7D5430', '#5E3D21', '#303B38');
      drawIsoPrism(ctx, x + 0.06 + sway, y + 0.06, 0.88, 0.88, 11, 14, '#8FB0A2', '#78978A', '#5A786B', '#303B38');
      drawIsoPrism(ctx, x + 0.2 + sway * 1.3, y + 0.2, 0.6, 0.6, 25, 7, '#A7C5B8', '#8FB0A2', '#78978A', '#303B38');
      break;
    }
    case 'LAMP': {
      const lit =
        state.hourOfDay >= 17.5 ||
        weather.rainIntensity >= 0.35 ||
        weather.overcastIntensity >= 0.55;
      drawIsoPrism(ctx, x + 0.42, y + 0.42, 0.16, 0.16, 0, 22, '#495853', '#303B38', '#242D2A');
      drawIsoPrism(
        ctx,
        x + 0.3,
        y + 0.3,
        0.4,
        0.4,
        22,
        5,
        lit ? '#FDE68A' : '#FAF8F2',
        lit ? '#FBBF24' : '#D9A66C',
        '#9E6E42',
        '#303B38'
      );
      break;
    }
    case 'BENCH': {
      drawIsoPrism(ctx, x + 0.12, y + 0.25, 0.76, 0.46, 0, 6, '#D9A66C', '#9E6E42', '#7D5430', '#303B38');
      drawIsoPrism(ctx, x + 0.12, y + 0.25, 0.76, 0.14, 6, 5, '#D9A66C', '#9E6E42', '#7D5430', '#303B38');
      break;
    }
    case 'CAFE_TABLE': {
      drawIsoPrism(ctx, x + 0.25, y + 0.25, 0.5, 0.5, 0, 7, '#FAF8F2', '#D9A66C', '#9E6E42', '#303B38');
      drawIsoPrism(ctx, x + 0.45, y + 0.45, 0.1, 0.1, 7, 11, '#303B38', '#303B38', '#242D2A');
      drawIsoPrism(ctx, x + 0.12, y + 0.12, 0.76, 0.76, 18, 3, '#D68B7B', '#B86E5F', '#945446', '#303B38');
      break;
    }
    case 'BUS_STOP': {
      drawIsoPrism(ctx, x + 0.1, y + 0.1, 0.85, 0.75, 0, 17, '#78978A', 'rgba(168, 184, 206, 0.55)', '#303B38', '#303B38');
      break;
    }
    case 'BILLBOARD': {
      drawIsoPrism(ctx, x + 0.38, y + 0.38, 0.24, 0.24, 0, 14, '#303B38', '#495853', '#242D2A');
      drawIsoPrism(ctx, x - 0.6, y + 0.2, 2.2, 0.32, 14, 15, '#D9A66C', '#FAF8F2', '#303B38', '#303B38');
      const bp = worldToIso(x + 0.5, y + 0.36, 22);
      ctx.save();
      ctx.font = 'bold 11px Arial, Helvetica, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#303B38';
      const title =
        state.founder.reputation >= 32
          ? state.config.companyName
          : state.competitors[0]?.name ?? 'Harbor Tech';
      ctx.fillText(title.slice(0, 18), bp.x, bp.y + 3);
      ctx.restore();
      break;
    }
  }
}

function drawWeatherCanvasOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  weather: WeatherSnapshot,
  hourOfDay: number,
  timeSec: number,
  reducedMotion = false
) {
  if (width <= 0 || height <= 0) return;

  const animTime = reducedMotion ? 0.5 : timeSec;

  ctx.save();

  // Overcast sky veil, slow drifting cloud shadow, & soft breeze flecks
  if (weather.overcastIntensity > 0.05) {
    const cloudAlpha = 0.095 * weather.overcastIntensity;
    ctx.fillStyle = `rgba(74, 92, 102, ${cloudAlpha.toFixed(3)})`;
    ctx.fillRect(0, 0, width, height);

    const bandProgress = reducedMotion ? width * 0.45 : (animTime * 22) % (width + 420);
    const bandX = bandProgress - 320;
    const bandGrad = ctx.createLinearGradient(bandX, 0, bandX + 340, height * 0.45);
    bandGrad.addColorStop(0, 'rgba(48, 59, 56, 0)');
    bandGrad.addColorStop(0.5, `rgba(48, 59, 56, ${(0.07 * weather.overcastIntensity).toFixed(3)})`);
    bandGrad.addColorStop(1, 'rgba(48, 59, 56, 0)');
    ctx.fillStyle = bandGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle overcast mist flecks drifting on breeze (when not raining heavily)
    if (weather.rainIntensity < 0.35) {
      const fleckAlpha = 0.18 * weather.overcastIntensity;
      ctx.fillStyle = `rgba(243, 240, 231, ${fleckAlpha.toFixed(3)})`;
      const fleckCount = reducedMotion ? 8 : 14;
      for (let i = 0; i < fleckCount; i++) {
        const rx = ((i * 229 + 61) % 1000) / 1000;
        const ry = ((i * 389 + 47) % 1000) / 1000;
        const fx = (rx * width + animTime * (12 + (i % 3) * 4)) % width;
        const fy = (ry * height + Math.sin(animTime * 0.5 + i) * 5 + height) % height;
        ctx.fillRect(Math.round(fx), Math.round(fy), 3, 1);
      }
    }
  }

  // Sunny warm sunbeams & golden floating dust motes
  if (weather.sunlightIntensity > 0.08 && hourOfDay < 17.6) {
    const warmWash = 0.055 * weather.sunlightIntensity;
    ctx.fillStyle = `rgba(253, 224, 138, ${warmWash.toFixed(3)})`;
    ctx.fillRect(0, 0, width, height);

    const beamAlpha = 0.068 * weather.sunlightIntensity;
    for (let b = 0; b < 3; b++) {
      const sway = reducedMotion ? 0 : Math.sin(animTime * 0.25 + b * 2.1) * (width * 0.07);
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

    const moteAlpha = 0.34 * weather.sunlightIntensity;
    ctx.fillStyle = `rgba(254, 243, 199, ${moteAlpha.toFixed(3)})`;
    const moteCount = reducedMotion ? 10 : 20;
    for (let i = 0; i < moteCount; i++) {
      const rx = ((i * 197 + 43) % 1000) / 1000;
      const ry = ((i * 313 + 91) % 1000) / 1000;
      const mx = (rx * width + animTime * (4 + (i % 3) * 2) + Math.sin(animTime * 0.8 + i) * 9) % width;
      const my = (ry * height + Math.cos(animTime * 0.6 + i * 1.4) * 7 + height) % height;
      ctx.fillRect(Math.round(mx), Math.round(my), 2, 2);
    }
  }

  // Cozy Rainy pixel rain streaks, gentle mist & ground splashes
  if (weather.rainIntensity > 0.08) {
    const rainAlpha = (reducedMotion ? 0.24 : 0.34) * weather.rainIntensity;
    ctx.strokeStyle = `rgba(220, 234, 246, ${rainAlpha.toFixed(3)})`;
    ctx.lineWidth = 1.35;
    ctx.beginPath();
    const dropCount = reducedMotion ? 28 : 56;
    for (let i = 0; i < dropCount; i++) {
      const seedX = ((i * 271 + 37) % 1000) / 1000;
      const seedY = ((i * 419 + 83) % 1000) / 1000;
      const speed = 285 + (i % 5) * 40;
      const len = 10 + (i % 4) * 3;
      const dy = (seedY * height + animTime * speed) % (height + 28);
      const dx =
        ((seedX * width - animTime * (speed * 0.22)) % (width + 28) + width + 28) % (width + 28);
      const sx = Math.round(dx);
      const sy = Math.round(dy - 14);
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - Math.round(len * 0.28), sy + len);
    }
    ctx.stroke();

    if (!reducedMotion) {
      const rippleAlpha = 0.24 * weather.rainIntensity;
      ctx.fillStyle = `rgba(220, 234, 246, ${rippleAlpha.toFixed(3)})`;
      for (let r = 0; r < 14; r++) {
        const phase = (animTime * 2.4 + r * 0.37) % 1;
        if (phase < 0.38) {
          const px = Math.round((((r * 353 + 109) % 1000) / 1000) * width);
          const py = Math.round((((r * 521 + 211) % 1000) / 1000) * height);
          ctx.fillRect(px - 2, py, 5, 1);
          ctx.fillRect(px - 1, py - 1, 2, 1);
        }
      }
    }
  }

  ctx.restore();
}

export { ISO_HALF_W, ISO_HALF_H };
