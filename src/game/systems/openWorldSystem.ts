import {
  CITY_BUILDINGS,
  CITY_STREET_PROPS,
  createInitialBusinessProperties,
  WORLD_LOCATIONS,
  WORLD_MAX_X,
  WORLD_MAX_Y,
  WORLD_MIN_X,
  WORLD_MIN_Y,
} from '@/src/game/data/cityWorld';
import { OFFICE_COLS, OFFICE_ROWS } from '@/src/game/data/officeLayout';
import {
  buildWalkabilityGrid,
  isNavWalkable,
  setNavWalkable,
  WorldNavGrid,
} from '@/src/game/engine/pathfinding';
import { maybeTriggerEvent } from '@/src/game/systems/eventSystem';
import { checkMilestones } from '@/src/game/systems/milestoneSystem';
import {
  ClientContract,
  GameState,
  OpenWorldState,
  WorldNPC,
} from '@/src/types/game';
import { getLocale } from '@/src/localization';
import { clamp, formatCurrency } from '@/src/utils/format';

function createInitialCityNpcs(state: GameState): WorldNPC[] {
  const npcs: WorldNPC[] = [
    {
      id: 'npc_barista_linh',
      name: 'Minh Anh',
      roleTitle: 'Bean & Byte Founder',
      kind: 'CUSTOMER',
      locationId: 'COFFEE_SHOP',
      position: { x: -8, y: 21 },
      homeTile: { x: -8, y: 21 },
      appearance: {
        skinTone: '#f2c9a5',
        hairColor: '#303B38',
        hairStyle: 'BOB',
        shirtColor: '#D68B7B',
        pantsColor: '#303B38',
        hasGlasses: false,
      },
      facing: 'DOWN',
      moodIcon: '☕',
      lastInteractedDay: 0,
    },
    {
      id: 'npc_customer_tuan',
      name: 'Hoang Nam',
      roleTitle: 'SMB Product Buyer',
      kind: 'CUSTOMER',
      locationId: 'MAIN_STREET',
      position: { x: 11, y: 24 },
      homeTile: { x: 11, y: 24 },
      appearance: {
        skinTone: '#e8b896',
        hairColor: '#4A3525',
        hairStyle: 'SHORT',
        shirtColor: '#A8B8CE',
        pantsColor: '#303B38',
        hasGlasses: true,
      },
      facing: 'LEFT',
      moodIcon: '🛍️',
      lastInteractedDay: 0,
    },
    {
      id: 'npc_partner_claire',
      name: 'Claire Vo',
      roleTitle: 'B2B Channel Partner',
      kind: 'PARTNER',
      locationId: 'MAIN_STREET',
      position: { x: 23, y: 24 },
      homeTile: { x: 23, y: 24 },
      appearance: {
        skinTone: '#f5d0b5',
        hairColor: '#7C4D3A',
        hairStyle: 'PONYTAIL',
        shirtColor: '#78978A',
        pantsColor: '#303B38',
        hasGlasses: false,
      },
      facing: 'DOWN',
      moodIcon: '🤝',
      lastInteractedDay: 0,
    },
    {
      id: 'npc_investor_khai',
      name: 'Marcus Khai',
      roleTitle: 'Harbor Seed Partner',
      kind: 'INVESTOR',
      locationId: 'INVESTOR_CENTER',
      position: { x: -5, y: 32 },
      homeTile: { x: -5, y: 32 },
      appearance: {
        skinTone: '#e8b896',
        hairColor: '#4A5568',
        hairStyle: 'SHORT',
        shirtColor: '#303B38',
        pantsColor: '#242D2A',
        hasGlasses: true,
      },
      facing: 'UP',
      moodIcon: '💼',
      lastInteractedDay: 0,
    },
    {
      id: 'npc_host_han',
      name: 'Gia Han',
      roleTitle: 'Civic Demo Organizer',
      kind: 'HOST',
      locationId: 'EVENT_HALL',
      position: { x: 18, y: 32 },
      homeTile: { x: 18, y: 32 },
      appearance: {
        skinTone: '#f2c9a5',
        hairColor: '#303B38',
        hairStyle: 'PONYTAIL',
        shirtColor: '#D9A66C',
        pantsColor: '#303B38',
        hasGlasses: false,
      },
      facing: 'UP',
      moodIcon: '🎤',
      lastInteractedDay: 0,
    },
  ];

  // Mirror top 2 candidates from existing recruitment pool onto Foundry Commons Coworking patio
  const topCandidates = (state.candidates ?? []).slice(0, 2);
  topCandidates.forEach((cand, idx) => {
    npcs.push({
      id: `npc_cand_${cand.id}`,
      name: cand.name,
      roleTitle: cand.role,
      kind: 'CANDIDATE',
      locationId: 'COWORKING_SPACE',
      position: { x: 42 + idx * 2, y: 21 },
      homeTile: { x: 42 + idx * 2, y: 21 },
      appearance: { ...cand.appearance },
      facing: 'DOWN',
      moodIcon: '💡',
      lastInteractedDay: 0,
      linkedCandidateId: cand.id,
    });
  });

  return npcs;
}

export function createInitialOpenWorldState(state: GameState): OpenWorldState {
  return {
    npcs: createInitialCityNpcs(state),
    properties: createInitialBusinessProperties(),
    lastCityRefreshDay: state.totalDays,
    coffeeVisitsToday: 0,
    investorPitchesToday: 0,
    eventsAttendedTotal: 0,
  };
}

export function ensureOpenWorldState(state: GameState): OpenWorldState {
  if (!state.world) {
    state.world = createInitialOpenWorldState(state);
  }
  if (!Array.isArray(state.world.properties) || state.world.properties.length === 0) {
    state.world.properties = createInitialBusinessProperties();
  }
  if (!Array.isArray(state.world.npcs) || state.world.npcs.length === 0) {
    state.world.npcs = createInitialCityNpcs(state);
  }
  return state.world;
}

export function syncCoworkingCandidateNpcs(state: GameState): void {
  const world = ensureOpenWorldState(state);
  const nonCandidates = world.npcs.filter((n) => n.kind !== 'CANDIDATE');
  const candidateNpcs: WorldNPC[] = (state.candidates ?? []).slice(0, 2).map((cand, idx) => ({
    id: `npc_cand_${cand.id}`,
    name: cand.name,
    roleTitle: cand.role,
    kind: 'CANDIDATE',
    locationId: 'COWORKING_SPACE',
    position: { x: 42 + idx * 2, y: 21 },
    homeTile: { x: 42 + idx * 2, y: 21 },
    appearance: { ...cand.appearance },
    facing: 'DOWN',
    moodIcon: '💡',
    lastInteractedDay: 0,
    linkedCandidateId: cand.id,
  }));
  world.npcs = [...nonCandidates, ...candidateNpcs];
}

export function syncOpenWorldDaily(state: GameState): { propertyRevenue: number } {
  const world = ensureOpenWorldState(state);
  world.coffeeVisitsToday = 0;
  world.investorPitchesToday = 0;
  world.lastCityRefreshDay = state.totalDays;
  syncCoworkingCandidateNpcs(state);

  // Subtle passive daily revenue trickle from owned Business Properties
  const ownedProps = world.properties.filter((p) => p.owned);
  const dailyPropertyRevenue = ownedProps.reduce((sum, p) => sum + p.monthlyRevenue / 30, 0);
  return { propertyRevenue: Math.round(dailyPropertyRevenue) };
}

export function getOwnedPropertiesTeamCapacityBonus(state: GameState): number {
  const world = state.world;
  if (!world) return 0;
  return world.properties.reduce(
    (sum, p) => sum + (p.owned ? p.teamCapacityBonus : 0),
    0
  );
}

/**
 * Builds one continuous walkable WorldNavGrid combining Company HQ (0..35, 0..23)
 * with Main Street, Coffee Shop, Coworking Space, Investor Center, Event Hall, and Business Properties.
 */
export function buildFullWorldNavGrid(state: GameState): WorldNavGrid {
  const cols = WORLD_MAX_X - WORLD_MIN_X + 1;
  const rows = WORLD_MAX_Y - WORLD_MIN_Y + 1;
  const cells: boolean[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => false)
  );
  const nav: WorldNavGrid = {
    minX: WORLD_MIN_X,
    maxX: WORLD_MAX_X,
    minY: WORLD_MIN_Y,
    maxY: WORLD_MAX_Y,
    cells,
  };

  // 1. Copy HQ interior grid directly into (0..35, 0..23)
  const hqGrid = buildWalkabilityGrid(state.office, true);
  for (let y = 0; y < OFFICE_ROWS; y++) {
    for (let x = 0; x < OFFICE_COLS; x++) {
      if (hqGrid[y]?.[x]) {
        setNavWalkable(nav, x, y, true);
      }
    }
  }

  // Open HQ West & East breezeway doors from Corridor (y=11..12) so Founder can always walk outside on Day 1
  setNavWalkable(nav, 0, 11, true);
  setNavWalkable(nav, 0, 12, true);
  setNavWalkable(nav, OFFICE_COLS - 1, 11, true);
  setNavWalkable(nav, OFFICE_COLS - 1, 12, true);

  // 2. Carve West Courtyard Walkways & Coffee Shop Patio (-13..-1, 11..23)
  for (let y = 11; y <= 23; y++) {
    for (let x = -3; x <= -1; x++) {
      setNavWalkable(nav, x, y, true);
    }
  }
  for (let y = 21; y <= 23; y++) {
    for (let x = -13; x <= -1; x++) {
      setNavWalkable(nav, x, y, true);
    }
  }

  // 3. Carve East Alleyway & Coworking Patio (36..49, 11..23)
  for (let y = 11; y <= 23; y++) {
    for (let x = 36; x <= 38; x++) {
      setNavWalkable(nav, x, y, true);
    }
  }
  for (let y = 21; y <= 23; y++) {
    for (let x = 36; x <= 49; x++) {
      setNavWalkable(nav, x, y, true);
    }
  }

  // 4. Carve Main Street Promenade & Sidewalks (-13..49, 23..32)
  for (let y = 23; y <= 32; y++) {
    for (let x = -13; x <= 49; x++) {
      setNavWalkable(nav, x, y, true);
    }
  }

  // 5. Block solid city building footprints (keep entranceTile walkable!)
  for (const b of CITY_BUILDINGS) {
    for (let y = b.bounds.y; y < b.bounds.y + b.bounds.h; y++) {
      for (let x = b.bounds.x; x < b.bounds.x + b.bounds.w; x++) {
        setNavWalkable(nav, x, y, false);
      }
    }
    setNavWalkable(nav, b.entranceTile.x, b.entranceTile.y, true);
  }

  // 6. Block solid street props (trees, streetlamps, benches, bus stop, billboard)
  for (const prop of CITY_STREET_PROPS) {
    if (isNavWalkable(nav, prop.tile.x, prop.tile.y)) {
      setNavWalkable(nav, prop.tile.x, prop.tile.y, false);
    }
  }

  return nav;
}

export function handleWorldCoffeeBreak(state: GameState): {
  feedback: string;
  sound: 'CASH' | 'ERROR';
} {
  const vi = getLocale() === 'vi-VN';
  const world = ensureOpenWorldState(state);
  if (world.coffeeVisitsToday >= 2) {
    return {
      feedback: vi
        ? 'Hôm nay bạn đã uống đủ 2 tách cà phê tại Bean & Byte rồi.'
        : 'You already had 2 espresso visits at Bean & Byte today.',
      sound: 'ERROR',
    };
  }
  const cost = 18;
  if (state.finance.cash < cost) {
    return {
      feedback: vi
        ? `Cần ${formatCurrency(cost)} để mua cà phê thủ công.`
        : `Need ${formatCurrency(cost)} for an artisan espresso.`,
      sound: 'ERROR',
    };
  }
  state.finance.cash -= cost;
  state.finance.cumulativeExpenses += cost;
  state.founder.energy = clamp(state.founder.energy + 22, 0, state.founder.maxEnergy);
  state.founder.reputation = clamp(state.founder.reputation + 1, 0, 100);
  world.coffeeVisitsToday += 1;

  return {
    feedback: vi
      ? `Thưởng thức espresso tại Bean & Byte: +22 năng lượng Nhà sáng lập (-${formatCurrency(cost)}).`
      : `Bean & Byte espresso break: +22 Founder energy (-${formatCurrency(cost)}).`,
    sound: 'CASH',
  };
}

export function handleWorldInteractNpc(
  state: GameState,
  npcId: string
): {
  feedback: string;
  sound: 'SUCCESS' | 'CASH' | 'ERROR';
} {
  const vi = getLocale() === 'vi-VN';
  const world = ensureOpenWorldState(state);
  const npc = world.npcs.find((n) => n.id === npcId);
  if (!npc) {
    return {
      feedback: vi ? 'Không tìm thấy nhân vật trong khu vực.' : 'NPC not found.',
      sound: 'ERROR',
    };
  }

  if (npc.lastInteractedDay === state.totalDays && npc.kind !== 'CANDIDATE') {
    return {
      feedback: vi
        ? `Bạn đã trao đổi với ${npc.name} hôm nay rồi. Hãy quay lại vào ngày mai.`
        : `You already connected with ${npc.name} today. Check back tomorrow.`,
      sound: 'ERROR',
    };
  }

  if (state.founder.energy < 10) {
    return {
      feedback: vi
        ? 'Năng lượng Nhà sáng lập dưới 10. Hãy ghé Bean & Byte hoặc nghỉ ngơi.'
        : 'Founder energy is below 10. Grab a coffee or rest first.',
      sound: 'ERROR',
    };
  }

  npc.lastInteractedDay = state.totalDays;
  state.founder.energy = clamp(state.founder.energy - 10, 0, state.founder.maxEnergy);
  state.founder.businessExp += 14;

  if (npc.kind === 'CUSTOMER') {
    const liveProduct =
      state.products.find((p) => p.stage === 'MVP_LIVE' || p.stage === 'MATURE') ??
      state.products[0];
    if (liveProduct && (liveProduct.stage === 'MVP_LIVE' || liveProduct.stage === 'MATURE')) {
      const gained = 2;
      liveProduct.payingCustomers += gained;
      liveProduct.activeUsers += 14;
      liveProduct.marketDemand = clamp(liveProduct.marketDemand + 3, 0, 100);
      state.finance.currentMonthCustomersGained += gained;
      state.founder.reputation = clamp(state.founder.reputation + 1, 0, 100);
      return {
        feedback: vi
          ? `${npc.name} giới thiệu +${gained} khách trả phí cho ${liveProduct.name}!`
          : `${npc.name} referred +${gained} paying customers to ${liveProduct.name}!`,
        sound: 'SUCCESS',
      };
    }
    if (liveProduct) {
      liveProduct.marketDemand = clamp(liveProduct.marketDemand + 5, 0, 100);
    }
    state.founder.reputation = clamp(state.founder.reputation + 1, 0, 100);
    return {
      feedback: vi
        ? `Khảo sát nhu cầu từ ${npc.name}: +5 nhu cầu thị trường & +1 uy tín.`
        : `Customer discovery with ${npc.name}: +5 market demand & +1 reputation.`,
      sound: 'SUCCESS',
    };
  }

  if (npc.kind === 'PARTNER') {
    const newContract: ClientContract = {
      id: `ctr_city_${state.totalDays}_${Math.floor(Math.random() * 1000)}`,
      clientName: `${npc.name} · Partner Lead`,
      segment: 'SMB',
      productId: state.products[0]?.id ?? null,
      monthlyValue: 1800 + state.founder.reputation * 25,
      upfrontBonus: 900,
      durationMonths: 3,
      monthsRemaining: 3,
      requiredQuality: 40,
      legalReviewed: false,
      status: 'PIPELINE',
      expiresDay: state.totalDays + 14,
    };
    if (state.contracts.filter((c) => c.status === 'PIPELINE').length < 6) {
      state.contracts.unshift(newContract);
    }
    state.founder.reputation = clamp(state.founder.reputation + 2, 0, 100);
    return {
      feedback: vi
        ? `${npc.name} mở ra hợp đồng B2B tiềm năng (${formatCurrency(newContract.monthlyValue)}/tháng) trong mục Thị trường!`
        : `${npc.name} opened a new B2B contract lead (${formatCurrency(newContract.monthlyValue)}/mo) in Market!`,
      sound: 'SUCCESS',
    };
  }

  if (npc.kind === 'INVESTOR') {
    return handleWorldPitchInvestor(state);
  }

  if (npc.kind === 'HOST') {
    return handleWorldHostEvent(state);
  }

  // CANDIDATE
  return {
    feedback: vi
      ? `Ứng viên ${npc.name} đang sẵn sàng phỏng vấn tại Foundry Commons.`
      : `Candidate ${npc.name} is open to joining from Foundry Commons.`,
    sound: 'SUCCESS',
  };
}

export function handleWorldPitchInvestor(state: GameState): {
  feedback: string;
  sound: 'SUCCESS' | 'ERROR';
} {
  const vi = getLocale() === 'vi-VN';
  const world = ensureOpenWorldState(state);
  if (world.investorPitchesToday >= 1) {
    return {
      feedback: vi
        ? 'Hôm nay bạn đã thuyết trình gọi vốn tại Harbor Capital rồi.'
        : 'You already pitched at Harbor Capital Investor Center today.',
      sound: 'ERROR',
    };
  }
  if (state.founder.energy < 14) {
    return {
      feedback: vi
        ? 'Cần ít nhất 14 năng lượng để thuyết trình trước quỹ đầu tư.'
        : 'Need at least 14 energy to pitch investors.',
      sound: 'ERROR',
    };
  }
  world.investorPitchesToday += 1;
  state.founder.energy = clamp(state.founder.energy - 14, 0, state.founder.maxEnergy);
  state.founder.investorTrust = clamp(state.founder.investorTrust + 4, 0, 100);
  state.founder.reputation = clamp(state.founder.reputation + 2, 0, 100);
  state.founder.businessExp += 25;

  // Trigger real investor round event if eligible and no active event is blocking
  if (!state.activeEvent && state.founder.investorTrust >= 52) {
    maybeTriggerEvent(state);
  }

  return {
    feedback: vi
      ? `Thuyết trình thành công tại Harbor Capital: +4 Niềm tin Nhà đầu tư, +2 Uy tín.`
      : `Solid pitch at Harbor Capital: +4 Investor Trust, +2 Reputation.`,
    sound: 'SUCCESS',
  };
}

export function handleWorldHostEvent(state: GameState): {
  feedback: string;
  sound: 'CASH' | 'ERROR';
} {
  const vi = getLocale() === 'vi-VN';
  const world = ensureOpenWorldState(state);
  const cost = 650;
  if (state.finance.cash < cost) {
    return {
      feedback: vi
        ? `Cần ${formatCurrency(cost)} để tổ chức gian hàng Demo Day.`
        : `Need ${formatCurrency(cost)} to sponsor a Demo Day showcase booth.`,
      sound: 'ERROR',
    };
  }
  if (state.founder.energy < 14) {
    return {
      feedback: vi
        ? 'Cần ít nhất 14 năng lượng để tham gia Demo Day tại Nhà triển lãm.'
        : 'Need at least 14 energy to host a showcase at Civic Event Hall.',
      sound: 'ERROR',
    };
  }

  state.finance.cash -= cost;
  state.finance.cumulativeExpenses += cost;
  state.founder.energy = clamp(state.founder.energy - 14, 0, state.founder.maxEnergy);
  state.founder.reputation = clamp(state.founder.reputation + 3, 0, 100);
  state.founder.businessExp += 28;
  world.eventsAttendedTotal += 1;

  const liveProduct =
    state.products.find((p) => p.stage === 'MVP_LIVE' || p.stage === 'MATURE') ??
    state.products[0];
  if (liveProduct) {
    liveProduct.activeUsers += 25;
    liveProduct.marketDemand = clamp(liveProduct.marketDemand + 5, 0, 100);
    if (liveProduct.stage === 'MVP_LIVE' || liveProduct.stage === 'MATURE') {
      liveProduct.payingCustomers += 3;
      state.finance.currentMonthCustomersGained += 3;
    }
  }

  checkMilestones(state);

  return {
    feedback: vi
      ? `Demo Day tại Nhà triển lãm thành công: +3 Uy tín, +25 người dùng & khách mới!`
      : `Civic Event Hall Demo Day succeeded: +3 Reputation, +25 users & new traction!`,
    sound: 'CASH',
  };
}

export function handleWorldBuyProperty(
  state: GameState,
  propertyId: string
): {
  feedback: string;
  sound: 'CASH' | 'ERROR';
} {
  const vi = getLocale() === 'vi-VN';
  const world = ensureOpenWorldState(state);
  const prop = world.properties.find((p) => p.id === propertyId);
  if (!prop) {
    return {
      feedback: vi ? 'Không tìm thấy bất động sản.' : 'Business property not found.',
      sound: 'ERROR',
    };
  }
  if (prop.owned) {
    return {
      feedback: vi ? 'Công ty đã sở hữu cơ sở này.' : 'Company already owns this property.',
      sound: 'ERROR',
    };
  }
  if (state.finance.cash < prop.cost) {
    return {
      feedback: vi
        ? `Không đủ tiền mặt (${formatCurrency(prop.cost)}).`
        : `Insufficient cash (${formatCurrency(prop.cost)}).`,
      sound: 'ERROR',
    };
  }

  state.finance.cash -= prop.cost;
  state.finance.cumulativeExpenses += prop.cost;
  prop.owned = true;
  prop.purchasedDay = state.totalDays;
  state.founder.reputation = clamp(state.founder.reputation + prop.reputationBonus, 0, 100);
  state.office.maxEmployees += prop.teamCapacityBonus;

  checkMilestones(state);

  return {
    feedback: vi
      ? `Đã mua ${prop.name}! +${formatCurrency(prop.monthlyRevenue)}/tháng, +${prop.reputationBonus} uy tín.`
      : `Acquired ${prop.name}! +${formatCurrency(prop.monthlyRevenue)}/mo recurring revenue & +${prop.reputationBonus} reputation.`,
    sound: 'CASH',
  };
}

export function getLocationEntranceTile(locationId: keyof typeof WORLD_LOCATIONS) {
  return WORLD_LOCATIONS[locationId].entranceTile;
}
