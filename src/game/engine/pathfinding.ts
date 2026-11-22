import { OFFICE_COLS, OFFICE_ROWS, PERK_FURNITURE_SPECS } from '@/src/game/data/officeLayout';
import { FurnitureItem, GridPoint, OfficeState, RoomId } from '@/src/types/game';

/**
 * Builds a boolean walkability grid (true = walkable) for the 36x24 office.
 * Corridor runs horizontally at y=11 and y=12, connecting all 8 rooms through doorways.
 */
export function buildWalkabilityGrid(office: OfficeState): boolean[][] {
  const grid: boolean[][] = Array.from({ length: OFFICE_ROWS }, () =>
    Array.from({ length: OFFICE_COLS }, () => false)
  );

  // Outer perimeter walls at x=0, x=35, y=0, y=23 remain non-walkable.
  // Central corridor y=11..12, x=1..34 is walkable.
  for (let y = 11; y <= 12; y++) {
    for (let x = 1; x < OFFICE_COLS - 1; x++) {
      grid[y][x] = true;
    }
  }

  // Rooms interior (inset by 1 tile for shared walls, with 2-tile doorway onto corridor)
  const rooms = Object.values(office.rooms);
  for (const room of rooms) {
    if (!room.unlocked) continue;
    const { x, y, w, h } = room.bounds;
    const isTopRow = y < 11;
    // Interior tiles
    for (let ry = y + 1; ry < y + h - 1; ry++) {
      for (let rx = x + 1; rx < x + w - 1; rx++) {
        if (rx > 0 && rx < OFFICE_COLS - 1 && ry > 0 && ry < OFFICE_ROWS - 1) {
          grid[ry][rx] = true;
        }
      }
    }
    // Doorway connecting room to corridor (y=10 for top row, y=13 for bottom row)
    const doorX1 = x + Math.floor(w / 2) - 1;
    const doorX2 = doorX1 + 1;
    const doorY = isTopRow ? y + h - 1 : y;
    if (doorY >= 0 && doorY < OFFICE_ROWS) {
      grid[doorY][doorX1] = true;
      grid[doorY][doorX2] = true;
    }
  }

  // Block furniture footprints
  for (const item of office.furniture) {
    for (let dy = 0; dy < item.height; dy++) {
      for (let dx = 0; dx < item.width; dx++) {
        const fx = item.tile.x + dx;
        const fy = item.tile.y + dy;
        if (fy >= 0 && fy < OFFICE_ROWS && fx >= 0 && fx < OFFICE_COLS) {
          grid[fy][fx] = false;
        }
      }
    }
  }

  return grid;
}

export function findRoomAtTile(office: OfficeState, tile: GridPoint): RoomId | null {
  for (const room of Object.values(office.rooms)) {
    const { x, y, w, h } = room.bounds;
    if (tile.x >= x && tile.x < x + w && tile.y >= y && tile.y < y + h) {
      return room.id;
    }
  }
  return null;
}

export function findNearestWalkable(
  grid: boolean[][],
  desired: GridPoint
): GridPoint {
  const startX = Math.max(1, Math.min(OFFICE_COLS - 2, Math.round(desired.x)));
  const startY = Math.max(1, Math.min(OFFICE_ROWS - 2, Math.round(desired.y)));
  if (grid[startY]?.[startX]) return { x: startX, y: startY };

  const visited = new Set<string>();
  const queue: GridPoint[] = [{ x: startX, y: startY }];
  visited.add(`${startX},${startY}`);

  const dirs = [
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: -1, y: 0 },
  ];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const d of dirs) {
      const nx = curr.x + d.x;
      const ny = curr.y + d.y;
      if (nx < 1 || nx >= OFFICE_COLS - 1 || ny < 1 || ny >= OFFICE_ROWS - 1) continue;
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      if (grid[ny][nx]) return { x: nx, y: ny };
      visited.add(key);
      queue.push({ x: nx, y: ny });
    }
  }

  return { x: 4, y: 11 };
}

export function findPath(
  grid: boolean[][],
  from: GridPoint,
  to: GridPoint
): GridPoint[] {
  const start = findNearestWalkable(grid, from);
  const goal = findNearestWalkable(grid, to);
  if (start.x === goal.x && start.y === goal.y) return [];

  const queue: GridPoint[] = [start];
  const parent = new Map<string, string | null>();
  const startKey = `${start.x},${start.y}`;
  const goalKey = `${goal.x},${goal.y}`;
  parent.set(startKey, null);

  const dirs = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const currKey = `${curr.x},${curr.y}`;
    if (currKey === goalKey) break;

    for (const d of dirs) {
      const nx = curr.x + d.x;
      const ny = curr.y + d.y;
      if (nx < 1 || nx >= OFFICE_COLS - 1 || ny < 1 || ny >= OFFICE_ROWS - 1) continue;
      if (!grid[ny][nx]) continue;
      const nextKey = `${nx},${ny}`;
      if (parent.has(nextKey)) continue;
      parent.set(nextKey, currKey);
      queue.push({ x: nx, y: ny });
    }
  }

  if (!parent.has(goalKey)) return [];

  const path: GridPoint[] = [];
  let trace: string | null = goalKey;
  while (trace && trace !== startKey) {
    const [sx, sy] = trace.split(',').map(Number);
    path.push({ x: sx, y: sy });
    trace = parent.get(trace) ?? null;
  }
  path.reverse();
  return path;
}

export function getRoomSeatTile(office: OfficeState, roomId: RoomId, indexOffset = 0): GridPoint {
  const room = office.rooms[roomId];
  const grid = buildWalkabilityGrid(office);
  const { x, y, w, h } = room.bounds;
  const candidates: GridPoint[] = [];

  for (let ry = y + 2; ry < y + h - 1; ry++) {
    for (let rx = x + 2; rx < x + w - 1; rx++) {
      if (grid[ry]?.[rx]) {
        candidates.push({ x: rx, y: ry });
      }
    }
  }

  if (candidates.length === 0) {
    return findNearestWalkable(grid, { x: x + Math.floor(w / 2), y: y + Math.floor(h / 2) });
  }
  return candidates[indexOffset % candidates.length];
}

export function canPlaceFurnitureAt(
  office: OfficeState,
  tile: GridPoint,
  width: number,
  height: number,
  ignoreFurnitureId?: string
): { valid: boolean; roomId: RoomId | null; reason?: string } {
  const roomId = findRoomAtTile(office, tile);
  if (!roomId) {
    return { valid: false, roomId: null, reason: 'Furniture must be placed inside a room.' };
  }
  const room = office.rooms[roomId];
  if (!room || !room.unlocked) {
    return { valid: false, roomId: null, reason: 'Room is locked.' };
  }

  const { x, y, w, h } = room.bounds;
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const tx = tile.x + dx;
      const ty = tile.y + dy;
      // Must stay strictly inside room interior walls
      if (tx <= x || tx >= x + w - 1 || ty <= y || ty >= y + h - 1) {
        return { valid: false, roomId, reason: 'Cannot block walls or doorways.' };
      }
      // Must not overlap existing furniture
      const overlaps = office.furniture.some((item) => {
        if (ignoreFurnitureId && item.id === ignoreFurnitureId) return false;
        return (
          tx >= item.tile.x &&
          tx < item.tile.x + item.width &&
          ty >= item.tile.y &&
          ty < item.tile.y + item.height
        );
      });
      if (overlaps) {
        return { valid: false, roomId, reason: 'Space overlaps existing furniture.' };
      }
    }
  }

  return { valid: true, roomId };
}

export function findAdjacentWalkableTile(
  grid: boolean[][],
  item: FurnitureItem
): GridPoint | null {
  const candidates: GridPoint[] = [];
  for (let ty = item.tile.y - 1; ty <= item.tile.y + item.height; ty++) {
    for (let tx = item.tile.x - 1; tx <= item.tile.x + item.width; tx++) {
      const insideItem =
        tx >= item.tile.x &&
        tx < item.tile.x + item.width &&
        ty >= item.tile.y &&
        ty < item.tile.y + item.height;
      if (insideItem) continue;
      // Prefer cardinal adjacency first
      const cardinal =
        tx >= item.tile.x && tx < item.tile.x + item.width ||
        ty >= item.tile.y && ty < item.tile.y + item.height;
      if (!cardinal) continue;
      if (grid[ty]?.[tx]) {
        candidates.push({ x: tx, y: ty });
      }
    }
  }
  return candidates[0] ?? null;
}

export function syncPurchasedPerkFurniture(office: OfficeState): void {
  const owned = office.purchasedPerks ?? [];
  for (const perkId of owned) {
    const spec = PERK_FURNITURE_SPECS.find((p) => p.perkId === perkId);
    if (!spec) continue;
    const alreadyExists = office.furniture.some(
      (f) => f.templateId === spec.templateId || f.id === `furn_${spec.perkId}`
    );
    if (alreadyExists) continue;

    let chosenTile: GridPoint | null = null;
    let chosenRoom: RoomId = spec.roomId;

    if (canPlaceFurnitureAt(office, spec.preferredTile, spec.width, spec.height).valid) {
      chosenTile = { ...spec.preferredTile };
    } else {
      const roomOrder: RoomId[] = [
        spec.roomId,
        'BREAK_ROOM',
        'MEETING_ROOM',
        'LOBBY',
        'ENGINEERING',
      ];
      for (const rId of roomOrder) {
        const room = office.rooms[rId];
        if (!room || !room.unlocked) continue;
        for (let ry = room.bounds.y + 1; ry < room.bounds.y + room.bounds.h - 1; ry++) {
          for (let rx = room.bounds.x + 1; rx < room.bounds.x + room.bounds.w - 1; rx++) {
            const check = canPlaceFurnitureAt(office, { x: rx, y: ry }, spec.width, spec.height);
            if (check.valid) {
              chosenTile = { x: rx, y: ry };
              chosenRoom = rId;
              break;
            }
          }
          if (chosenTile) break;
        }
        if (chosenTile) break;
      }
    }

    if (chosenTile) {
      office.furniture.push({
        id: `furn_${spec.perkId}`,
        templateId: spec.templateId,
        name: spec.name,
        roomId: chosenRoom,
        tile: chosenTile,
        width: spec.width,
        height: spec.height,
        tier: 1,
        interactiveAction: spec.interactiveAction,
        comfortBonus: spec.comfortBonus,
        productivityBonus: spec.productivityBonus,
      });
    }
  }
}
