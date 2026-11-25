import { OFFICE_COLS, OFFICE_ROWS, PERK_FURNITURE_SPECS } from '@/src/game/data/officeLayout';
import { FurnitureItem, GridPoint, OfficeState, RoomId } from '@/src/types/game';

export interface WorldNavGrid {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  cells: boolean[][]; // indexed [y - minY][x - minX]
}

export function gridToNav(grid: boolean[][]): WorldNavGrid {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  return {
    minX: 0,
    maxX: cols - 1,
    minY: 0,
    maxY: rows - 1,
    cells: grid,
  };
}

export function isNavWalkable(nav: WorldNavGrid, tx: number, ty: number): boolean {
  if (tx < nav.minX || tx > nav.maxX || ty < nav.minY || ty > nav.maxY) return false;
  return Boolean(nav.cells[ty - nav.minY]?.[tx - nav.minX]);
}

export function setNavWalkable(nav: WorldNavGrid, tx: number, ty: number, walkable: boolean): void {
  if (tx < nav.minX || tx > nav.maxX || ty < nav.minY || ty > nav.maxY) return;
  const row = nav.cells[ty - nav.minY];
  if (row) row[tx - nav.minX] = walkable;
}

/**
 * Builds a boolean walkability grid (true = walkable) for the 36x24 HQ office.
 * Corridor runs horizontally at y=11 and y=12, connecting all 8 rooms through doorways.
 * When `openSouthEntrance` is true, the Lobby main entrance at x=4..5, y=23 opens onto Main Street.
 */
export function buildWalkabilityGrid(
  office: OfficeState,
  openSouthEntrance = true
): boolean[][] {
  const grid: boolean[][] = Array.from({ length: OFFICE_ROWS }, () =>
    Array.from({ length: OFFICE_COLS }, () => false)
  );

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
    for (let ry = y + 1; ry < y + h - 1; ry++) {
      for (let rx = x + 1; rx < x + w - 1; rx++) {
        if (rx > 0 && rx < OFFICE_COLS - 1 && ry > 0 && ry < OFFICE_ROWS - 1) {
          grid[ry][rx] = true;
        }
      }
    }
    const doorX1 = x + Math.floor(w / 2) - 1;
    const doorX2 = doorX1 + 1;
    const doorY = isTopRow ? y + h - 1 : y;
    if (doorY >= 0 && doorY < OFFICE_ROWS) {
      grid[doorY][doorX1] = true;
      grid[doorY][doorX2] = true;
    }

    // Lobby main entrance connecting HQ seamlessly onto Main Street (y=22..23)
    if (openSouthEntrance && room.id === 'LOBBY') {
      grid[22][4] = true;
      grid[22][5] = true;
      grid[23][4] = true;
      grid[23][5] = true;
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

export function findNearestNavWalkable(
  nav: WorldNavGrid,
  desired: GridPoint
): GridPoint {
  const startX = Math.max(nav.minX, Math.min(nav.maxX, Math.round(desired.x)));
  const startY = Math.max(nav.minY, Math.min(nav.maxY, Math.round(desired.y)));
  if (isNavWalkable(nav, startX, startY)) return { x: startX, y: startY };

  const visited = new Set<string>();
  const queue: GridPoint[] = [{ x: startX, y: startY }];
  visited.add(`${startX},${startY}`);

  const dirs = [
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: -1, y: 0 },
  ];

  let qHead = 0;
  while (qHead < queue.length && qHead < 1800) {
    const curr = queue[qHead++];
    for (const d of dirs) {
      const nx = curr.x + d.x;
      const ny = curr.y + d.y;
      if (nx < nav.minX || nx > nav.maxX || ny < nav.minY || ny > nav.maxY) continue;
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      if (isNavWalkable(nav, nx, ny)) return { x: nx, y: ny };
      visited.add(key);
      queue.push({ x: nx, y: ny });
    }
  }

  return { x: 4, y: 11 };
}

export function findNearestWalkable(
  grid: boolean[][],
  desired: GridPoint
): GridPoint {
  return findNearestNavWalkable(gridToNav(grid), desired);
}

interface AStarNode {
  x: number;
  y: number;
  g: number;
  f: number;
}

class MinHeap {
  private data: AStarNode[] = [];

  get size() {
    return this.data.length;
  }

  push(node: AStarNode) {
    this.data.push(node);
    let idx = this.data.length - 1;
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (this.data[parent].f <= this.data[idx].f) break;
      [this.data[parent], this.data[idx]] = [this.data[idx], this.data[parent]];
      idx = parent;
    }
  }

  pop(): AStarNode | undefined {
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0 && last) {
      this.data[0] = last;
      let idx = 0;
      const n = this.data.length;
      while (true) {
        let smallest = idx;
        const left = idx * 2 + 1;
        const right = idx * 2 + 2;
        if (left < n && this.data[left].f < this.data[smallest].f) smallest = left;
        if (right < n && this.data[right].f < this.data[smallest].f) smallest = right;
        if (smallest === idx) break;
        [this.data[idx], this.data[smallest]] = [this.data[smallest], this.data[idx]];
        idx = smallest;
      }
    }
    return top;
  }
}

/**
 * A* pathfinding across any WorldNavGrid (works for HQ 36x24 and full Open World).
 */
export function findWorldPath(
  nav: WorldNavGrid,
  from: GridPoint,
  to: GridPoint
): GridPoint[] {
  const start = findNearestNavWalkable(nav, from);
  const goal = findNearestNavWalkable(nav, to);
  if (start.x === goal.x && start.y === goal.y) return [];

  const open = new MinHeap();
  const gScore = new Map<string, number>();
  const parent = new Map<string, string | null>();
  const closed = new Set<string>();

  const startKey = `${start.x},${start.y}`;
  const goalKey = `${goal.x},${goal.y}`;
  const h0 = Math.abs(goal.x - start.x) + Math.abs(goal.y - start.y);

  gScore.set(startKey, 0);
  parent.set(startKey, null);
  open.push({ x: start.x, y: start.y, g: 0, f: h0 });

  const dirs = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  let expansions = 0;
  const maxExpansions = 6000;

  while (open.size > 0 && expansions < maxExpansions) {
    const curr = open.pop()!;
    const currKey = `${curr.x},${curr.y}`;
    if (currKey === goalKey) break;
    if (closed.has(currKey)) continue;
    closed.add(currKey);
    expansions++;

    for (const d of dirs) {
      const nx = curr.x + d.x;
      const ny = curr.y + d.y;
      if (!isNavWalkable(nav, nx, ny)) continue;
      const nextKey = `${nx},${ny}`;
      if (closed.has(nextKey)) continue;

      const tentativeG = curr.g + 1;
      const prevG = gScore.get(nextKey);
      if (prevG === undefined || tentativeG < prevG) {
        gScore.set(nextKey, tentativeG);
        parent.set(nextKey, currKey);
        const h = Math.abs(goal.x - nx) + Math.abs(goal.y - ny);
        open.push({ x: nx, y: ny, g: tentativeG, f: tentativeG + h });
      }
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

export function findPath(
  grid: boolean[][],
  from: GridPoint,
  to: GridPoint
): GridPoint[] {
  return findWorldPath(gridToNav(grid), from, to);
}

/**
 * Checks whether a continuous character coordinate (top-left of character tile footprint)
 * is safely standing on a walkable tile (checking its center tile + slight collision margin).
 */
export function isContinuousPosWalkable(
  nav: WorldNavGrid,
  posX: number,
  posY: number
): boolean {
  const cx = posX + 0.5;
  const cy = posY + 0.5;
  const tx = Math.floor(cx);
  const ty = Math.floor(cy);
  if (!isNavWalkable(nav, tx, ty)) return false;

  // Check cardinal 0.20 radius margin to prevent clipping through wall edges/desks
  const pad = 0.2;
  const checks: [number, number][] = [
    [Math.floor(cx - pad), ty],
    [Math.floor(cx + pad), ty],
    [tx, Math.floor(cy - pad)],
    [tx, Math.floor(cy + pad)],
  ];
  for (const [qx, qy] of checks) {
    if (!isNavWalkable(nav, qx, qy)) return false;
  }
  return true;
}

/**
 * Steps a continuous entity position along a normalized direction vector with smooth wall sliding.
 */
export function stepContinuousPosition(
  nav: WorldNavGrid,
  pos: GridPoint,
  dir: GridPoint,
  speedTilesPerSec: number,
  dt: number
): { pos: GridPoint; facing: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'; moved: boolean } {
  const mag = Math.hypot(dir.x, dir.y);
  if (mag < 0.01 || dt <= 0) {
    return { pos, facing: 'DOWN', moved: false };
  }
  const nx = dir.x / mag;
  const ny = dir.y / mag;
  const stepX = nx * speedTilesPerSec * dt;
  const stepY = ny * speedTilesPerSec * dt;

  let facing: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' = 'DOWN';
  if (Math.abs(nx) >= Math.abs(ny)) {
    facing = nx > 0 ? 'RIGHT' : 'LEFT';
  } else {
    facing = ny > 0 ? 'DOWN' : 'UP';
  }

  let nextX = pos.x;
  let nextY = pos.y;
  let moved = false;

  if (isContinuousPosWalkable(nav, pos.x + stepX, pos.y + stepY)) {
    nextX = pos.x + stepX;
    nextY = pos.y + stepY;
    moved = true;
  } else {
    // Axis-independent sliding so diagonal keys glide cleanly along walls & desks
    if (Math.abs(stepX) > 1e-4 && isContinuousPosWalkable(nav, pos.x + stepX, pos.y)) {
      nextX = pos.x + stepX;
      moved = true;
    }
    if (Math.abs(stepY) > 1e-4 && isContinuousPosWalkable(nav, nextX, pos.y + stepY)) {
      nextY = pos.y + stepY;
      moved = true;
    }
  }

  return {
    pos: { x: nextX, y: nextY },
    facing,
    moved,
  };
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
      if (tx <= x || tx >= x + w - 1 || ty <= y || ty >= y + h - 1) {
        return { valid: false, roomId, reason: 'Cannot block walls or doorways.' };
      }
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
      const cardinal =
        (tx >= item.tile.x && tx < item.tile.x + item.width) ||
        (ty >= item.tile.y && ty < item.tile.y + item.height);
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
