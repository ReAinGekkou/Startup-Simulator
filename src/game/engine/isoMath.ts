import { GridPoint } from '@/src/types/game';

export const ISO_TILE_WIDTH = 64;
export const ISO_TILE_HEIGHT = 32;
export const ISO_HALF_W = ISO_TILE_WIDTH / 2;
export const ISO_HALF_H = ISO_TILE_HEIGHT / 2;

export interface IsoPoint {
  x: number;
  y: number;
}

export interface IsoCamera {
  x: number;
  y: number;
  zoom: number;
}

export interface IsoWorldBounds {
  minIsoX: number;
  maxIsoX: number;
  minIsoY: number;
  maxIsoY: number;
  centerIsoX: number;
  centerIsoY: number;
  width: number;
  height: number;
}

/**
 * Projects continuous world grid coordinates (wx, wy) into 2:1 isometric space.
 * Standard right-handed isometric axis: +X goes down-right, +Y goes down-left.
 */
export function worldToIso(wx: number, wy: number, elevationPx = 0): IsoPoint {
  return {
    x: (wx - wy) * ISO_HALF_W,
    y: (wx + wy) * ISO_HALF_H - elevationPx,
  };
}

/**
 * Exact inverse projection from isometric plane (elevation = 0) back to continuous world grid coords.
 */
export function isoToWorld(isoX: number, isoY: number): GridPoint {
  const u = isoX / ISO_HALF_W;
  const v = isoY / ISO_HALF_H;
  return {
    x: (u + v) * 0.5,
    y: (v - u) * 0.5,
  };
}

export function isoToScreen(
  isoX: number,
  isoY: number,
  canvasWidth: number,
  canvasHeight: number,
  camera: IsoCamera
): IsoPoint {
  return {
    x: canvasWidth * 0.5 + (isoX - camera.x) * camera.zoom,
    y: canvasHeight * 0.5 + (isoY - camera.y) * camera.zoom,
  };
}

export function screenToIso(
  screenX: number,
  screenY: number,
  canvasWidth: number,
  canvasHeight: number,
  camera: IsoCamera
): IsoPoint {
  return {
    x: (screenX - canvasWidth * 0.5) / camera.zoom + camera.x,
    y: (screenY - canvasHeight * 0.5) / camera.zoom + camera.y,
  };
}

export function worldToScreen(
  wx: number,
  wy: number,
  canvasWidth: number,
  canvasHeight: number,
  camera: IsoCamera,
  elevationPx = 0
): IsoPoint {
  const iso = worldToIso(wx, wy, elevationPx);
  return isoToScreen(iso.x, iso.y, canvasWidth, canvasHeight, camera);
}

export function screenToWorld(
  screenX: number,
  screenY: number,
  canvasWidth: number,
  canvasHeight: number,
  camera: IsoCamera
): GridPoint {
  const iso = screenToIso(screenX, screenY, canvasWidth, canvasHeight, camera);
  return isoToWorld(iso.x, iso.y);
}

export function getCharacterFootWorld(pos: GridPoint): GridPoint {
  return {
    x: pos.x + 0.5,
    y: pos.y + 0.5,
  };
}

/**
 * Painter's algorithm depth key in isometric space.
 * Higher (wx + wy) renders closer to the camera (later in draw order).
 */
export function getIsoDepth(wx: number, wy: number, bias = 0): number {
  return wx + wy + bias;
}

export function getTileDiamondCorners(
  wx: number,
  wy: number,
  w = 1,
  h = 1,
  elevationPx = 0
): [IsoPoint, IsoPoint, IsoPoint, IsoPoint] {
  return [
    worldToIso(wx, wy, elevationPx), // North / Top
    worldToIso(wx + w, wy, elevationPx), // East / Right
    worldToIso(wx + w, wy + h, elevationPx), // South / Bottom
    worldToIso(wx, wy + h, elevationPx), // West / Left
  ];
}

export function getWorldIsoBounds(
  minWorldX: number,
  maxWorldX: number,
  minWorldY: number,
  maxWorldY: number
): IsoWorldBounds {
  const top = worldToIso(minWorldX, minWorldY);
  const right = worldToIso(maxWorldX, minWorldY);
  const bottom = worldToIso(maxWorldX, maxWorldY);
  const left = worldToIso(minWorldX, maxWorldY);

  const minIsoX = Math.min(top.x, right.x, bottom.x, left.x);
  const maxIsoX = Math.max(top.x, right.x, bottom.x, left.x);
  const minIsoY = Math.min(top.y, right.y, bottom.y, left.y);
  const maxIsoY = Math.max(top.y, right.y, bottom.y, left.y);

  return {
    minIsoX,
    maxIsoX,
    minIsoY,
    maxIsoY,
    centerIsoX: (minIsoX + maxIsoX) * 0.5,
    centerIsoY: (minIsoY + maxIsoY) * 0.5,
    width: maxIsoX - minIsoX,
    height: maxIsoY - minIsoY,
  };
}

export function clampIsoCamera(
  cam: IsoCamera,
  bounds: IsoWorldBounds,
  paddingPx = 120
): IsoCamera {
  const clampedZoom = Math.max(0.42, Math.min(2.2, cam.zoom));
  return {
    x: Math.max(bounds.minIsoX - paddingPx, Math.min(bounds.maxIsoX + paddingPx, cam.x)),
    y: Math.max(bounds.minIsoY - paddingPx, Math.min(bounds.maxIsoY + paddingPx, cam.y)),
    zoom: clampedZoom,
  };
}

/**
 * Computes new camera position so the world/iso point beneath cursor stays pinned after zoom change.
 */
export function zoomAroundScreenPoint(
  camera: IsoCamera,
  nextZoom: number,
  cursorX: number,
  cursorY: number,
  canvasWidth: number,
  canvasHeight: number
): IsoCamera {
  const clampedZoom = Math.max(0.42, Math.min(2.2, nextZoom));
  const before = screenToIso(cursorX, cursorY, canvasWidth, canvasHeight, camera);
  const nx = before.x - (cursorX - canvasWidth * 0.5) / clampedZoom;
  const ny = before.y - (cursorY - canvasHeight * 0.5) / clampedZoom;
  return { x: nx, y: ny, zoom: clampedZoom };
}

/**
 * Isometric screen-space hit test for characters (checks front-most sprite first).
 */
export function hitTestIsoCharacters(
  characters: Array<{ id: string; position: GridPoint }>,
  screenX: number,
  screenY: number,
  canvasWidth: number,
  canvasHeight: number,
  camera: IsoCamera
): string | null {
  const sortedFrontFirst = [...characters].sort((a, b) => {
    const da = getIsoDepth(a.position.x + 0.5, a.position.y + 0.5);
    const db = getIsoDepth(b.position.x + 0.5, b.position.y + 0.5);
    return db - da;
  });

  const halfW = 19 * camera.zoom;
  const heightAbove = 44 * camera.zoom;
  const depthBelow = 11 * camera.zoom;

  for (const ch of sortedFrontFirst) {
    const foot = getCharacterFootWorld(ch.position);
    const sp = worldToScreen(foot.x, foot.y, canvasWidth, canvasHeight, camera);
    if (
      screenX >= sp.x - halfW &&
      screenX <= sp.x + halfW &&
      screenY >= sp.y - heightAbove &&
      screenY <= sp.y + depthBelow
    ) {
      return ch.id;
    }
  }
  return null;
}

/**
 * Maps screen-space WASD input to normalized isometric world movement vector.
 * W -> screen up (-X, -Y)
 * S -> screen down (+X, +Y)
 * A -> screen left (-X, +Y)
 * D -> screen right (+X, -Y)
 */
export function getIsoMovementVector(keys: {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}): GridPoint {
  let sx = 0;
  let sy = 0;
  if (keys.up) sy -= 1;
  if (keys.down) sy += 1;
  if (keys.left) sx -= 1;
  if (keys.right) sx += 1;
  if (sx === 0 && sy === 0) return { x: 0, y: 0 };

  // Convert desired screen direction vector (sx, sy) into world axis directions:
  // screen +x corresponds to world (+1, -1)
  // screen +y corresponds to world (+1, +1)
  const wx = sx + sy;
  const wy = sy - sx;
  const len = Math.hypot(wx, wy);
  return len > 0 ? { x: wx / len, y: wy / len } : { x: 0, y: 0 };
}

export interface ScreenSpaceRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/**
 * Calculates the precise viewport-space position / bounding rectangle of a given DOM element
 * or world-space coordinate, factoring in current camera pan and zoom levels, to provide a reliable target for tutorial overlays.
 */
export function getScreenSpaceCoordinates(
  targetOrWx: Element | HTMLElement | { x: number; y: number } | number,
  wyOrCanvasWidth?: number,
  canvasWidthOrHeight?: number,
  canvasHeightOrCamera?: number | IsoCamera,
  cameraOrObjectWidth?: IsoCamera | number,
  objectWidthPx = 40,
  objectHeightPx = 50,
  elevationPx = 0
): ScreenSpaceRect {
  // Case 1: DOM Element
  if (targetOrWx && typeof targetOrWx === 'object' && 'getBoundingClientRect' in targetOrWx) {
    const rect = (targetOrWx as Element).getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  }

  // Case 2: World coordinates { x, y } object
  let wx = 0;
  let wy = 0;
  let cw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  let ch = typeof window !== 'undefined' ? window.innerHeight : 720;
  let cam: IsoCamera = { x: 0, y: 0, zoom: 1 };
  let objW = objectWidthPx;
  let objH = objectHeightPx;
  let elev = elevationPx;

  if (targetOrWx && typeof targetOrWx === 'object' && 'x' in targetOrWx && 'y' in targetOrWx) {
    wx = (targetOrWx as { x: number; y: number }).x;
    wy = (targetOrWx as { x: number; y: number }).y;
    cw = wyOrCanvasWidth ?? cw;
    ch = canvasWidthOrHeight ?? ch;
    cam = (canvasHeightOrCamera as IsoCamera) ?? cam;
    if (typeof cameraOrObjectWidth === 'number') objW = cameraOrObjectWidth;
  } else if (typeof targetOrWx === 'number' && typeof wyOrCanvasWidth === 'number') {
    // Case 3: (wx, wy, canvasWidth, canvasHeight, camera, objectWidth, objectHeight, elevation)
    wx = targetOrWx;
    wy = wyOrCanvasWidth;
    cw = canvasWidthOrHeight ?? cw;
    ch = typeof canvasHeightOrCamera === 'number' ? canvasHeightOrCamera : ch;
    cam =
      typeof canvasHeightOrCamera === 'object' && canvasHeightOrCamera !== null
        ? canvasHeightOrCamera
        : typeof cameraOrObjectWidth === 'object' && cameraOrObjectWidth !== null
          ? cameraOrObjectWidth
          : cam;
    objW = objectWidthPx;
    objH = objectHeightPx;
    elev = elevationPx;
  }

  const screenPos = worldToScreen(wx, wy, cw, ch, cam, elev);
  const scaledW = objW * cam.zoom;
  const scaledH = objH * cam.zoom;
  const left = screenPos.x - scaledW * 0.5;
  const top = screenPos.y - scaledH;
  return {
    left,
    top,
    right: left + scaledW,
    bottom: top + scaledH,
    width: scaledW,
    height: scaledH,
  };
}

