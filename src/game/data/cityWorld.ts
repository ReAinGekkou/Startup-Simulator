import { BusinessPropertyState, GridPoint, WorldLocationId } from '@/src/types/game';

export const WORLD_MIN_X = -14;
export const WORLD_MAX_X = 51;
export const WORLD_MIN_Y = -4;
export const WORLD_MAX_Y = 44;

export interface CityBuildingSpec {
  id: Exclude<WorldLocationId, 'COMPANY_HQ' | 'MAIN_STREET'>;
  bounds: { x: number; y: number; w: number; h: number };
  entranceTile: GridPoint;
  roofColor: string;
  wallLeftColor: string;
  wallRightColor: string;
  accentColor: string;
  heightPx: number;
  icon: string;
}

export interface WorldLocationMeta {
  id: WorldLocationId;
  bounds: { x: number; y: number; w: number; h: number };
  focusTile: GridPoint;
  entranceTile: GridPoint;
}

export const CITY_BUILDINGS: CityBuildingSpec[] = [
  {
    id: 'COFFEE_SHOP',
    bounds: { x: -12, y: 14, w: 8, h: 6 },
    entranceTile: { x: -8, y: 21 },
    roofColor: '#D68B7B',
    wallLeftColor: '#FAF8F2',
    wallRightColor: '#EAE5D8',
    accentColor: '#9E6E42',
    heightPx: 42,
    icon: '☕',
  },
  {
    id: 'COWORKING_SPACE',
    bounds: { x: 39, y: 13, w: 9, h: 7 },
    entranceTile: { x: 43, y: 21 },
    roofColor: '#78978A',
    wallLeftColor: '#E8E3D5',
    wallRightColor: '#D5CEBD',
    accentColor: '#D9A66C',
    heightPx: 46,
    icon: '💻',
  },
  {
    id: 'INVESTOR_CENTER',
    bounds: { x: -10, y: 33, w: 9, h: 7 },
    entranceTile: { x: -5, y: 32 },
    roofColor: '#303B38',
    wallLeftColor: '#A8B8CE',
    wallRightColor: '#8B9EB6',
    accentColor: '#D9A66C',
    heightPx: 58,
    icon: '🏦',
  },
  {
    id: 'EVENT_HALL',
    bounds: { x: 12, y: 33, w: 13, h: 7 },
    entranceTile: { x: 18, y: 32 },
    roofColor: '#D9A66C',
    wallLeftColor: '#FAF8F2',
    wallRightColor: '#DDD6C6',
    accentColor: '#78978A',
    heightPx: 50,
    icon: '🎤',
  },
  {
    id: 'BUSINESS_PROPERTIES',
    bounds: { x: 31, y: 34, w: 18, h: 6 },
    entranceTile: { x: 40, y: 32 },
    roofColor: '#78978A',
    wallLeftColor: '#F3F0E7',
    wallRightColor: '#DDD6C6',
    accentColor: '#D9A66C',
    heightPx: 38,
    icon: '🏬',
  },
];

export const WORLD_LOCATIONS: Record<WorldLocationId, WorldLocationMeta> = {
  COMPANY_HQ: {
    id: 'COMPANY_HQ',
    bounds: { x: 0, y: 0, w: 36, h: 24 },
    focusTile: { x: 18, y: 12 },
    entranceTile: { x: -1, y: 12 },
  },
  MAIN_STREET: {
    id: 'MAIN_STREET',
    bounds: { x: -13, y: 23, w: 63, h: 9 },
    focusTile: { x: 16, y: 27 },
    entranceTile: { x: 16, y: 26 },
  },
  COFFEE_SHOP: {
    id: 'COFFEE_SHOP',
    bounds: { x: -13, y: 13, w: 10, h: 10 },
    focusTile: { x: -8, y: 19 },
    entranceTile: { x: -8, y: 21 },
  },
  COWORKING_SPACE: {
    id: 'COWORKING_SPACE',
    bounds: { x: 38, y: 12, w: 11, h: 11 },
    focusTile: { x: 43, y: 19 },
    entranceTile: { x: 43, y: 21 },
  },
  INVESTOR_CENTER: {
    id: 'INVESTOR_CENTER',
    bounds: { x: -11, y: 31, w: 11, h: 10 },
    focusTile: { x: -5, y: 35 },
    entranceTile: { x: -5, y: 32 },
  },
  EVENT_HALL: {
    id: 'EVENT_HALL',
    bounds: { x: 11, y: 31, w: 15, h: 10 },
    focusTile: { x: 18, y: 35 },
    entranceTile: { x: 18, y: 32 },
  },
  BUSINESS_PROPERTIES: {
    id: 'BUSINESS_PROPERTIES',
    bounds: { x: 30, y: 31, w: 20, h: 10 },
    focusTile: { x: 40, y: 35 },
    entranceTile: { x: 40, y: 32 },
  },
};

export interface StreetProp {
  id: string;
  kind: 'TREE' | 'LAMP' | 'BENCH' | 'CAFE_TABLE' | 'BILLBOARD' | 'BUS_STOP';
  tile: GridPoint;
}

export const CITY_STREET_PROPS: StreetProp[] = [
  // Sidewalk trees
  { id: 'tree_w1', kind: 'TREE', tile: { x: -11, y: 23 } },
  { id: 'tree_w2', kind: 'TREE', tile: { x: -3, y: 23 } },
  { id: 'tree_hq1', kind: 'TREE', tile: { x: 10, y: 23 } },
  { id: 'tree_hq2', kind: 'TREE', tile: { x: 24, y: 23 } },
  { id: 'tree_hq3', kind: 'TREE', tile: { x: 33, y: 23 } },
  { id: 'tree_e1', kind: 'TREE', tile: { x: 47, y: 23 } },
  { id: 'tree_s1', kind: 'TREE', tile: { x: 3, y: 30 } },
  { id: 'tree_s2', kind: 'TREE', tile: { x: 9, y: 30 } },
  { id: 'tree_s3', kind: 'TREE', tile: { x: 27, y: 30 } },
  { id: 'tree_n1', kind: 'TREE', tile: { x: 8, y: -2 } },
  { id: 'tree_n2', kind: 'TREE', tile: { x: 24, y: -2 } },
  // Streetlamps (glow warmly at dusk/evening)
  { id: 'lamp_1', kind: 'LAMP', tile: { x: -9, y: 24 } },
  { id: 'lamp_2', kind: 'LAMP', tile: { x: 1, y: 24 } },
  { id: 'lamp_3', kind: 'LAMP', tile: { x: 15, y: 24 } },
  { id: 'lamp_4', kind: 'LAMP', tile: { x: 29, y: 24 } },
  { id: 'lamp_5', kind: 'LAMP', tile: { x: 41, y: 24 } },
  { id: 'lamp_6', kind: 'LAMP', tile: { x: -2, y: 29 } },
  { id: 'lamp_7', kind: 'LAMP', tile: { x: 21, y: 29 } },
  { id: 'lamp_8', kind: 'LAMP', tile: { x: 38, y: 29 } },
  // Benches & outdoor coffee tables
  { id: 'bench_1', kind: 'BENCH', tile: { x: 12, y: 23 } },
  { id: 'bench_2', kind: 'BENCH', tile: { x: 22, y: 23 } },
  { id: 'bench_3', kind: 'BENCH', tile: { x: 14, y: 30 } },
  { id: 'cafe_tbl_1', kind: 'CAFE_TABLE', tile: { x: -11, y: 21 } },
  { id: 'cafe_tbl_2', kind: 'CAFE_TABLE', tile: { x: -5, y: 21 } },
  // Landmark props
  { id: 'bus_stop', kind: 'BUS_STOP', tile: { x: 7, y: 24 } },
  { id: 'billboard_hq', kind: 'BILLBOARD', tile: { x: 27, y: 29 } },
];

export function createInitialBusinessProperties(): BusinessPropertyState[] {
  return [
    {
      id: 'prop_retail_kiosk',
      name: 'Main Street Pop-Up Kiosk',
      lotTile: { x: 32, y: 34 },
      cost: 6500,
      monthlyRevenue: 850,
      reputationBonus: 3,
      teamCapacityBonus: 0,
      owned: false,
      purchasedDay: null,
    },
    {
      id: 'prop_sales_hub',
      name: 'Harbor Regional Sales Hub',
      lotTile: { x: 38, y: 34 },
      cost: 16000,
      monthlyRevenue: 2200,
      reputationBonus: 5,
      teamCapacityBonus: 2,
      owned: false,
      purchasedDay: null,
    },
    {
      id: 'prop_innovation_lab',
      name: 'Foundry Innovation Studio',
      lotTile: { x: 44, y: 34 },
      cost: 32000,
      monthlyRevenue: 4600,
      reputationBonus: 8,
      teamCapacityBonus: 3,
      owned: false,
      purchasedDay: null,
    },
  ];
}

export function findCityLocationAtTile(tile: GridPoint): WorldLocationId | null {
  if (tile.x >= 0 && tile.x <= 35 && tile.y >= 0 && tile.y <= 23) {
    return 'COMPANY_HQ';
  }
  const order: Exclude<WorldLocationId, 'COMPANY_HQ' | 'MAIN_STREET'>[] = [
    'COFFEE_SHOP',
    'COWORKING_SPACE',
    'INVESTOR_CENTER',
    'EVENT_HALL',
    'BUSINESS_PROPERTIES',
  ];
  for (const id of order) {
    const { x, y, w, h } = WORLD_LOCATIONS[id].bounds;
    if (tile.x >= x && tile.x < x + w && tile.y >= y && tile.y < y + h) {
      return id;
    }
  }
  if (tile.x >= -13 && tile.x <= 49 && tile.y >= 23 && tile.y <= 31) {
    return 'MAIN_STREET';
  }
  return null;
}
