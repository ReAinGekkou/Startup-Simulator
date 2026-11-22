import {
  FurnitureItem,
  OfficePerkDefinition,
  OfficeRoom,
  OfficeState,
  RoomId,
} from '@/src/types/game';

export const OFFICE_COLS = 36;
export const OFFICE_ROWS = 24;
export const TILE_SIZE = 32;

export interface OfficeLevelSpec {
  level: 1 | 2 | 3 | 4;
  name: string;
  monthlyRent: number;
  maxEmployees: number;
  upgradeCost: number;
  description: string;
}

export const OFFICE_LEVELS: Record<1 | 2 | 3 | 4, OfficeLevelSpec> = {
  1: {
    level: 1,
    name: 'Startup Office',
    monthlyRent: 1600,
    maxEmployees: 6,
    upgradeCost: 0,
    description: 'A compact starter suite with room for a small founding crew.',
  },
  2: {
    level: 2,
    name: 'Product Studio',
    monthlyRent: 3200,
    maxEmployees: 10,
    upgradeCost: 14000,
    description: 'Expanded workstations, faster network gear, and dedicated studio space.',
  },
  3: {
    level: 3,
    name: 'Client Lounge',
    monthlyRent: 5400,
    maxEmployees: 15,
    upgradeCost: 34000,
    description: 'Executive client reception, upgraded meeting suite, and enterprise readiness.',
  },
  4: {
    level: 4,
    name: 'Large Technology Company',
    monthlyRent: 8800,
    maxEmployees: 22,
    upgradeCost: 75000,
    description: 'Full-floor modern tech HQ with high morale comfort and maximum capacity.',
  },
};

export interface FurnitureTemplate {
  templateId: string;
  name: string;
  cost: number;
  width: number;
  height: number;
  comfortBonus: number;
  productivityBonus: number;
  interactiveAction: string;
  allowedRooms: RoomId[];
  description: string;
}

export const FURNITURE_CATALOG: FurnitureTemplate[] = [
  {
    templateId: 'WORKSTATION',
    name: 'Developer Desk',
    cost: 1200,
    width: 2,
    height: 1,
    comfortBonus: 2,
    productivityBonus: 4,
    interactiveAction: 'OPEN_PRODUCTS',
    allowedRooms: ['ENGINEERING', 'FINANCE_DEPT', 'HR_DEPT', 'LEGAL_DEPT'],
    description: 'Adds an active desk seat and +4% workstation output.',
  },
  {
    templateId: 'ESPRESSO_BAR',
    name: 'Espresso Machine',
    cost: 1600,
    width: 2,
    height: 1,
    comfortBonus: 10,
    productivityBonus: 2,
    interactiveAction: 'OPEN_BREAK_ROOM',
    allowedRooms: ['BREAK_ROOM'],
    description: 'Speeds up employee energy recovery during breaks.',
  },
  {
    templateId: 'PLANT_FIDDLE',
    name: 'Fiddle-Leaf Plant',
    cost: 450,
    width: 1,
    height: 1,
    comfortBonus: 5,
    productivityBonus: 1,
    interactiveAction: 'INSPECT_COMFORT',
    allowedRooms: ['CEO_OFFICE', 'HR_DEPT', 'FINANCE_DEPT', 'ENGINEERING', 'LEGAL_DEPT', 'MEETING_ROOM', 'BREAK_ROOM', 'LOBBY'],
    description: 'Cozy office greenery that softens stress across the team.',
  },
  {
    templateId: 'SERVER_RACK',
    name: 'Server Rack',
    cost: 2800,
    width: 1,
    height: 2,
    comfortBonus: 0,
    productivityBonus: 8,
    interactiveAction: 'OPEN_PRODUCTS',
    allowedRooms: ['ENGINEERING'],
    description: 'Boosts engineering build speed and lowers outage risk.',
  },
  {
    templateId: 'LOUNGE_SOFA',
    name: 'Lounge Sofa',
    cost: 1400,
    width: 2,
    height: 1,
    comfortBonus: 9,
    productivityBonus: 1,
    interactiveAction: 'OPEN_BREAK_ROOM',
    allowedRooms: ['BREAK_ROOM', 'LOBBY', 'CEO_OFFICE'],
    description: 'Improves comfort score and visitor impression.',
  },
  {
    templateId: 'WHITEBOARD',
    name: 'Strategy Whiteboard',
    cost: 900,
    width: 2,
    height: 1,
    comfortBonus: 2,
    productivityBonus: 5,
    interactiveAction: 'OPEN_PRODUCTS',
    allowedRooms: ['MEETING_ROOM', 'ENGINEERING', 'CEO_OFFICE'],
    description: 'Supports roadmap alignment and feature quality.',
  },
  {
    templateId: 'ARCADE_CABINET',
    name: 'Retro Arcade',
    cost: 2400,
    width: 1,
    height: 1,
    comfortBonus: 14,
    productivityBonus: 2,
    interactiveAction: 'OPEN_BREAK_ROOM',
    allowedRooms: ['BREAK_ROOM'],
    description: 'Major morale booster that cuts team stress daily.',
  },
];

export const OFFICE_PERKS: OfficePerkDefinition[] = [
  {
    id: 'perk_coffee_machine',
    name: 'Coffee Machine',
    description: 'Artisan espresso & cold brew station keeping daily stamina topped up.',
    cost: 1200,
    minOfficeLevel: 1,
    moraleBonusPerDay: 0.5,
    energyRecoveryPerDay: 4,
    stressReductionPerDay: 0.5,
    comfortBonus: 4,
  },
  {
    id: 'perk_ergonomic_chairs',
    name: 'Ergonomic Chairs',
    description: 'Lumbar-support seating that eases physical fatigue and work strain.',
    cost: 2200,
    minOfficeLevel: 1,
    moraleBonusPerDay: 1,
    energyRecoveryPerDay: 2,
    stressReductionPerDay: 2,
    comfortBonus: 6,
  },
  {
    id: 'perk_ping_pong',
    name: 'Ping Pong Table',
    description: 'Friendly office rallies that lift team morale and dissolve crunch stress.',
    cost: 2800,
    minOfficeLevel: 1,
    moraleBonusPerDay: 2.5,
    energyRecoveryPerDay: 1,
    stressReductionPerDay: 2.5,
    comfortBonus: 7,
  },
  {
    id: 'perk_snack_pantry',
    name: 'Stocked Snack Pantry',
    description: 'Healthy snacks and hydration to sustain energy through long sprints.',
    cost: 3600,
    minOfficeLevel: 2,
    moraleBonusPerDay: 1.5,
    energyRecoveryPerDay: 5,
    stressReductionPerDay: 1.5,
    comfortBonus: 6,
  },
  {
    id: 'perk_quiet_pods',
    name: 'Acoustic Focus Pods',
    description: 'Soundproof booths that cut meeting noise and deep-work stress.',
    cost: 5500,
    minOfficeLevel: 2,
    moraleBonusPerDay: 1.5,
    energyRecoveryPerDay: 2,
    stressReductionPerDay: 4,
    comfortBonus: 8,
  },
  {
    id: 'perk_wellness_suite',
    name: 'Wellness & Nap Suite',
    description: 'Dedicated recovery lounge with quiet recharge pods and stretching mats.',
    cost: 8500,
    minOfficeLevel: 3,
    moraleBonusPerDay: 3,
    energyRecoveryPerDay: 7,
    stressReductionPerDay: 4,
    comfortBonus: 10,
  },
];

export interface PerkFurnitureSpec {
  perkId: string;
  templateId: string;
  name: string;
  roomId: RoomId;
  preferredTile: { x: number; y: number };
  width: number;
  height: number;
  interactiveAction: string;
  comfortBonus: number;
  productivityBonus: number;
}

export const PERK_FURNITURE_SPECS: PerkFurnitureSpec[] = [
  {
    perkId: 'perk_coffee_machine',
    templateId: 'PERK_COFFEE_MACHINE',
    name: 'Specialty Coffee Machine',
    roomId: 'BREAK_ROOM',
    preferredTile: { x: 31, y: 14 },
    width: 1,
    height: 1,
    interactiveAction: 'USE_PERK_COFFEE',
    comfortBonus: 4,
    productivityBonus: 2,
  },
  {
    perkId: 'perk_ping_pong',
    templateId: 'PERK_PING_PONG',
    name: 'Ping Pong Table',
    roomId: 'BREAK_ROOM',
    preferredTile: { x: 29, y: 16 },
    width: 2,
    height: 1,
    interactiveAction: 'USE_PERK_PING_PONG',
    comfortBonus: 7,
    productivityBonus: 2,
  },
  {
    perkId: 'perk_snack_pantry',
    templateId: 'PERK_SNACK_PANTRY',
    name: 'Stocked Snack Pantry',
    roomId: 'BREAK_ROOM',
    preferredTile: { x: 32, y: 14 },
    width: 1,
    height: 1,
    interactiveAction: 'USE_PERK_SNACK',
    comfortBonus: 6,
    productivityBonus: 2,
  },
  {
    perkId: 'perk_quiet_pods',
    templateId: 'PERK_QUIET_POD',
    name: 'Acoustic Focus Pod',
    roomId: 'ENGINEERING',
    preferredTile: { x: 24, y: 19 },
    width: 1,
    height: 2,
    interactiveAction: 'USE_PERK_FOCUS',
    comfortBonus: 8,
    productivityBonus: 4,
  },
  {
    perkId: 'perk_wellness_suite',
    templateId: 'PERK_WELLNESS_SUITE',
    name: 'Wellness & Nap Suite',
    roomId: 'BREAK_ROOM',
    preferredTile: { x: 28, y: 19 },
    width: 2,
    height: 1,
    interactiveAction: 'USE_PERK_WELLNESS',
    comfortBonus: 10,
    productivityBonus: 3,
  },
];

export function getOfficePerkBonuses(office: OfficeState): {
  moraleBonusPerDay: number;
  energyRecoveryPerDay: number;
  stressReductionPerDay: number;
} {
  const owned = new Set(office.purchasedPerks ?? []);
  return OFFICE_PERKS.reduce(
    (acc, perk) => {
      if (owned.has(perk.id)) {
        acc.moraleBonusPerDay += perk.moraleBonusPerDay;
        acc.energyRecoveryPerDay += perk.energyRecoveryPerDay;
        acc.stressReductionPerDay += perk.stressReductionPerDay;
      }
      return acc;
    },
    { moraleBonusPerDay: 0, energyRecoveryPerDay: 0, stressReductionPerDay: 0 }
  );
}

export function createInitialRooms(): Record<RoomId, OfficeRoom> {
  return {
    CEO_OFFICE: {
      id: 'CEO_OFFICE',
      name: 'CEO Office',
      description: 'Company overview, founder strategy, and executive decisions.',
      bounds: { x: 1, y: 1, w: 8, h: 10 },
      floorStyle: 'WOOD',
      level: 1,
      unlocked: true,
      unlockCost: 0,
      upgradeCost: 2500,
      unlockCondition: 'Available from Day 1',
    },
    HR_DEPT: {
      id: 'HR_DEPT',
      name: 'HR Department',
      description: 'Talent recruitment, training, and team morale.',
      bounds: { x: 9, y: 1, w: 8, h: 10 },
      floorStyle: 'CARPET_WARM',
      level: 1,
      unlocked: false,
      unlockCost: 600,
      upgradeCost: 2200,
      unlockCondition: 'Unlocks automatically on Day 2, or unlock early for $600.',
    },
    FINANCE_DEPT: {
      id: 'FINANCE_DEPT',
      name: 'Finance Department',
      description: 'Cash flow ledger, payroll, credit, and tax planning.',
      bounds: { x: 17, y: 1, w: 9, h: 10 },
      floorStyle: 'CARPET_BLUE',
      level: 1,
      unlocked: false,
      unlockCost: 800,
      upgradeCost: 2400,
      unlockCondition: 'Unlocks automatically on Day 2, or unlock early for $800.',
    },
    LEGAL_DEPT: {
      id: 'LEGAL_DEPT',
      name: 'Legal Department',
      description: 'Client contract reviews, compliance, and risk shields.',
      bounds: { x: 26, y: 1, w: 9, h: 10 },
      floorStyle: 'WOOD',
      level: 1,
      unlocked: false,
      unlockCost: 1600,
      upgradeCost: 2600,
      unlockCondition: 'Unlocks at 10+ paying customers, or unlock early for $1,600.',
    },
    LOBBY: {
      id: 'LOBBY',
      name: 'Lobby',
      description: 'Visitors, investors, partners, and reception.',
      bounds: { x: 1, y: 13, w: 8, h: 10 },
      floorStyle: 'TILE',
      level: 1,
      unlocked: false,
      unlockCost: 1400,
      upgradeCost: 2000,
      unlockCondition: 'Unlocks at 5+ paying customers, or unlock early for $1,400.',
    },
    MEETING_ROOM: {
      id: 'MEETING_ROOM',
      name: 'Meeting Room',
      description: 'Client pitches, internal syncs, and campaign planning.',
      bounds: { x: 9, y: 13, w: 8, h: 10 },
      floorStyle: 'CARPET_BLUE',
      level: 1,
      unlocked: false,
      unlockCost: 1200,
      upgradeCost: 2400,
      unlockCondition: 'Unlocks when you launch your first MVP, or unlock early for $1,200.',
    },
    ENGINEERING: {
      id: 'ENGINEERING',
      name: 'Engineering Room',
      description: 'Product development, bug fixing, and server infrastructure.',
      bounds: { x: 17, y: 13, w: 10, h: 10 },
      floorStyle: 'CONCRETE',
      level: 1,
      unlocked: true,
      unlockCost: 0,
      upgradeCost: 3000,
      unlockCondition: 'Available from Day 1',
    },
    BREAK_ROOM: {
      id: 'BREAK_ROOM',
      name: 'Break Room',
      description: 'Espresso bar, lounge rest, and employee energy recovery.',
      bounds: { x: 27, y: 13, w: 8, h: 10 },
      floorStyle: 'TILE',
      level: 1,
      unlocked: false,
      unlockCost: 900,
      upgradeCost: 2200,
      unlockCondition: 'Unlocks automatically on Day 3, or unlock early for $900.',
    },
  };
}

export function createInitialFurniture(): FurnitureItem[] {
  return [
    {
      id: 'furn_ceo_desk',
      templateId: 'CEO_DESK',
      name: 'Executive Desk',
      roomId: 'CEO_OFFICE',
      tile: { x: 3, y: 4 },
      width: 3,
      height: 2,
      tier: 1,
      interactiveAction: 'OPEN_CEO',
      comfortBonus: 5,
      productivityBonus: 5,
    },
    {
      id: 'furn_ceo_plant',
      templateId: 'PLANT_FIDDLE',
      name: 'Fiddle-Leaf Plant',
      roomId: 'CEO_OFFICE',
      tile: { x: 2, y: 2 },
      width: 1,
      height: 1,
      tier: 1,
      interactiveAction: 'INSPECT_COMFORT',
      comfortBonus: 5,
      productivityBonus: 1,
    },
    {
      id: 'furn_hr_desk',
      templateId: 'HR_BOARD',
      name: 'Recruitment Board',
      roomId: 'HR_DEPT',
      tile: { x: 11, y: 3 },
      width: 2,
      height: 1,
      tier: 1,
      interactiveAction: 'OPEN_HR',
      comfortBonus: 2,
      productivityBonus: 3,
    },
    {
      id: 'furn_hr_station',
      templateId: 'WORKSTATION',
      name: 'HR Workstation',
      roomId: 'HR_DEPT',
      tile: { x: 12, y: 6 },
      width: 2,
      height: 1,
      tier: 1,
      interactiveAction: 'OPEN_HR',
      comfortBonus: 2,
      productivityBonus: 4,
    },
    {
      id: 'furn_fin_desk',
      templateId: 'FINANCE_TERMINAL',
      name: 'Ledger Terminal',
      roomId: 'FINANCE_DEPT',
      tile: { x: 19, y: 4 },
      width: 2,
      height: 1,
      tier: 1,
      interactiveAction: 'OPEN_FINANCE',
      comfortBonus: 2,
      productivityBonus: 4,
    },
    {
      id: 'furn_fin_safe',
      templateId: 'SAFE_VAULT',
      name: 'Company Vault',
      roomId: 'FINANCE_DEPT',
      tile: { x: 23, y: 2 },
      width: 1,
      height: 1,
      tier: 1,
      interactiveAction: 'OPEN_FINANCE',
      comfortBonus: 0,
      productivityBonus: 2,
    },
    {
      id: 'furn_legal_desk',
      templateId: 'LEGAL_DESK',
      name: 'Contracts Desk',
      roomId: 'LEGAL_DEPT',
      tile: { x: 28, y: 4 },
      width: 2,
      height: 1,
      tier: 1,
      interactiveAction: 'OPEN_LEGAL',
      comfortBonus: 2,
      productivityBonus: 4,
    },
    {
      id: 'furn_legal_shelf',
      templateId: 'BOOKSHELF',
      name: 'Compliance Library',
      roomId: 'LEGAL_DEPT',
      tile: { x: 32, y: 2 },
      width: 2,
      height: 1,
      tier: 1,
      interactiveAction: 'OPEN_LEGAL',
      comfortBonus: 3,
      productivityBonus: 2,
    },
    {
      id: 'furn_lobby_desk',
      templateId: 'RECEPTION_DESK',
      name: 'Reception Desk',
      roomId: 'LOBBY',
      tile: { x: 3, y: 15 },
      width: 2,
      height: 1,
      tier: 1,
      interactiveAction: 'OPEN_LOBBY',
      comfortBonus: 4,
      productivityBonus: 2,
    },
    {
      id: 'furn_lobby_sofa',
      templateId: 'LOUNGE_SOFA',
      name: 'Visitor Sofa',
      roomId: 'LOBBY',
      tile: { x: 2, y: 19 },
      width: 2,
      height: 1,
      tier: 1,
      interactiveAction: 'OPEN_LOBBY',
      comfortBonus: 6,
      productivityBonus: 1,
    },
    {
      id: 'furn_meet_table',
      templateId: 'MEETING_TABLE',
      name: 'Conference Table',
      roomId: 'MEETING_ROOM',
      tile: { x: 11, y: 16 },
      width: 4,
      height: 2,
      tier: 1,
      interactiveAction: 'OPEN_MARKET',
      comfortBonus: 4,
      productivityBonus: 5,
    },
    {
      id: 'furn_meet_board',
      templateId: 'WHITEBOARD',
      name: 'Strategy Whiteboard',
      roomId: 'MEETING_ROOM',
      tile: { x: 12, y: 14 },
      width: 2,
      height: 1,
      tier: 1,
      interactiveAction: 'OPEN_MARKET',
      comfortBonus: 2,
      productivityBonus: 4,
    },
    {
      id: 'furn_eng_desk_1',
      templateId: 'WORKSTATION',
      name: 'Dev Workstation 1',
      roomId: 'ENGINEERING',
      tile: { x: 18, y: 15 },
      width: 2,
      height: 1,
      tier: 1,
      interactiveAction: 'OPEN_PRODUCTS',
      comfortBonus: 2,
      productivityBonus: 5,
    },
    {
      id: 'furn_eng_desk_2',
      templateId: 'WORKSTATION',
      name: 'Dev Workstation 2',
      roomId: 'ENGINEERING',
      tile: { x: 22, y: 15 },
      width: 2,
      height: 1,
      tier: 1,
      interactiveAction: 'OPEN_PRODUCTS',
      comfortBonus: 2,
      productivityBonus: 5,
    },
    {
      id: 'furn_eng_desk_3',
      templateId: 'WORKSTATION',
      name: 'Dev Workstation 3',
      roomId: 'ENGINEERING',
      tile: { x: 18, y: 19 },
      width: 2,
      height: 1,
      tier: 1,
      interactiveAction: 'OPEN_PRODUCTS',
      comfortBonus: 2,
      productivityBonus: 5,
    },
    {
      id: 'furn_eng_server',
      templateId: 'SERVER_RACK',
      name: 'Core Server Rack',
      roomId: 'ENGINEERING',
      tile: { x: 25, y: 14 },
      width: 1,
      height: 2,
      tier: 1,
      interactiveAction: 'OPEN_PRODUCTS',
      comfortBonus: 0,
      productivityBonus: 6,
    },
    {
      id: 'furn_break_coffee',
      templateId: 'ESPRESSO_BAR',
      name: 'Espresso Machine',
      roomId: 'BREAK_ROOM',
      tile: { x: 28, y: 14 },
      width: 2,
      height: 1,
      tier: 1,
      interactiveAction: 'OPEN_BREAK_ROOM',
      comfortBonus: 9,
      productivityBonus: 2,
    },
    {
      id: 'furn_break_sofa',
      templateId: 'LOUNGE_SOFA',
      name: 'Break Sofa',
      roomId: 'BREAK_ROOM',
      tile: { x: 30, y: 19 },
      width: 2,
      height: 1,
      tier: 1,
      interactiveAction: 'OPEN_BREAK_ROOM',
      comfortBonus: 8,
      productivityBonus: 1,
    },
    {
      id: 'furn_break_plant',
      templateId: 'PLANT_FIDDLE',
      name: 'Corner Plant',
      roomId: 'BREAK_ROOM',
      tile: { x: 33, y: 15 },
      width: 1,
      height: 1,
      tier: 1,
      interactiveAction: 'INSPECT_COMFORT',
      comfortBonus: 5,
      productivityBonus: 1,
    },
  ];
}

export function createInitialOfficeState(): OfficeState {
  const furniture = createInitialFurniture();
  const comfortScore = Math.min(
    100,
    30 + furniture.reduce((sum, f) => sum + f.comfortBonus, 0)
  );
  return {
    level: 1,
    name: OFFICE_LEVELS[1].name,
    monthlyRent: OFFICE_LEVELS[1].monthlyRent,
    maxEmployees: OFFICE_LEVELS[1].maxEmployees,
    comfortScore,
    techTier: 1,
    rooms: createInitialRooms(),
    furniture,
    purchasedPerks: [],
  };
}
