import { FURNITURE_CATALOG, OFFICE_LEVELS, OFFICE_PERKS } from '@/src/game/data/officeLayout';
import { FEATURE_TEMPLATES, MARKETING_CHANNELS, PRODUCT_CATEGORIES } from '@/src/game/data/products';
import { ROLE_DEFINITIONS, TASK_LABELS } from '@/src/game/data/roles';
import {
  buildWalkabilityGrid,
  canPlaceFurnitureAt,
  findAdjacentWalkableTile,
  findPath,
  findWorldPath,
  findNearestWalkable,
  getRoomSeatTile,
  isNavWalkable,
  stepContinuousPosition,
  syncPurchasedPerkFurniture,
} from '@/src/game/engine/pathfinding';
import {
  buildFullWorldNavGrid,
  handleWorldBuyProperty,
  handleWorldCoffeeBreak,
  handleWorldHostEvent,
  handleWorldInteractNpc,
  handleWorldPitchInvestor,
  syncCoworkingCandidateNpcs,
  syncOpenWorldDaily,
} from '@/src/game/systems/openWorldSystem';
import {
  computeEmployeeProductivity,
  createEmployeeFromCandidate,
  evaluateEmployeeTraits,
  generateCandidatePool,
  getLevelTitle,
  getTaskRoom,
  updateEmployeesDaily,
} from '@/src/game/systems/employeeSystem';
import { maybeTriggerEvent, resolveActiveEvent } from '@/src/game/systems/eventSystem';
import {
  getFounderSalaryProfile,
  MAX_FOUNDER_SALARY,
  MIN_FOUNDER_SALARY,
  processEndOfMonth,
} from '@/src/game/systems/financeSystem';
import { updateMarketDaily } from '@/src/game/systems/marketSystem';
import { checkAchievements } from '@/src/game/systems/achievementSystem';
import { checkMilestones } from '@/src/game/systems/milestoneSystem';
import { createProductEntity, updateProductsDaily } from '@/src/game/systems/productSystem';
import { generateEmployeeChatterForContext } from '@/src/game/systems/chatterSystem';
import {
  completeActiveCinematic,
  recordStoryResignations,
  syncStoryProgression,
  triggerEvaluatedEnding,
} from '@/src/game/systems/chapterProgression';
import { resolveStoryEventChoice } from '@/src/game/systems/storyEventSystem';
import {
  dismissActiveCelebration,
  queueMilestoneCelebration,
  syncCelebrationState,
} from '@/src/game/systems/celebrationSystem';
import { isCelebratoryCinematic } from '@/src/game/systems/celebrationParticles';
import {
  advanceWeatherCycle,
  cycleWeatherState,
  ensureWeatherState,
  setWeatherState,
} from '@/src/game/systems/weatherSystem';
import {
  createInitialTutorialState,
  evaluateRoomUnlocks,
  syncTutorialAndObjectives,
} from '@/src/game/systems/tutorialSystem';
import {
  getChannelLocalized,
  getFeatureLocalized,
  getFurnitureLocalized,
  getLevelTitleLocalized,
  getLocale,
  getOfficeLevelLocalized,
  getPerkLocalized,
  getRoomLocalized,
  getSkillLocalized,
  getTaskLocalized,
  getTraitLocalized,
} from '@/src/localization';
import {
  Achievement,
  GameCommand,
  GameState,
  GridPoint,
  RoomId,
  TutorialStepId,
} from '@/src/types/game';
import { clamp, formatCurrency } from '@/src/utils/format';

export interface CommandResult {
  state: GameState;
  feedback?: string;
  sound?: 'CLICK' | 'CASH' | 'SUCCESS' | 'ERROR' | 'ALERT' | 'LEVEL_UP' | 'MILESTONE_CHIME';
  unlockedAchievements?: Achievement[];
}

function addNotification(
  state: GameState,
  message: string,
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' = 'INFO'
) {
  state.notifications.unshift({
    id: `n_${state.totalDays}_${Math.random().toString(36).slice(2, 7)}`,
    day: state.totalDays,
    message,
    type,
  });
  state.notifications = state.notifications.slice(0, 24);
}

function moveAlongPath(
  pos: GridPoint,
  path: GridPoint[],
  speedTilesPerSec: number,
  dt: number
): { pos: GridPoint; path: GridPoint[]; facing: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'; moving: boolean } {
  if (path.length === 0) {
    return { pos, path, facing: 'DOWN', moving: false };
  }
  const target = path[0];
  const dx = target.x - pos.x;
  const dy = target.y - pos.y;
  const dist = Math.hypot(dx, dy);
  const step = speedTilesPerSec * dt;

  let facing: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' = 'DOWN';
  if (Math.abs(dx) > Math.abs(dy)) {
    facing = dx > 0 ? 'RIGHT' : 'LEFT';
  } else if (Math.abs(dy) > 0.01) {
    facing = dy > 0 ? 'DOWN' : 'UP';
  }

  if (dist <= step) {
    return {
      pos: { x: target.x, y: target.y },
      path: path.slice(1),
      facing,
      moving: path.length > 1,
    };
  }

  return {
    pos: {
      x: pos.x + (dx / dist) * step,
      y: pos.y + (dy / dist) * step,
    },
    path,
    facing,
    moving: true,
  };
}

export function reserveFreeRoomSeat(
  office: GameState['office'],
  roomId: RoomId,
  idx: number,
  grid: boolean[][],
  reservedTiles: Set<string>
): GridPoint {
  const room = office.rooms[roomId];
  if (!room || !room.unlocked) {
    return getRoomSeatTile(office, 'CEO_OFFICE', idx);
  }

  const roomFurniture = office.furniture.filter(
    (f) =>
      f.roomId === roomId &&
      (f.templateId === 'WORKSTATION' ||
        f.templateId === 'CEO_DESK' ||
        f.templateId === 'MEETING_TABLE' ||
        f.templateId === 'FINANCE_TERMINAL' ||
        f.templateId === 'LEGAL_DESK' ||
        f.templateId === 'HR_BOARD' ||
        f.templateId === 'RECEPTION_DESK')
  );

  // First try reserving an unclaimed tile directly adjacent to a workstation/table in this room
  for (let i = 0; i < roomFurniture.length; i++) {
    const furn = roomFurniture[(idx + i) % roomFurniture.length];
    const adj = findAdjacentWalkableTile(grid, furn);
    if (adj && !reservedTiles.has(`${adj.x},${adj.y}`)) {
      reservedTiles.add(`${adj.x},${adj.y}`);
      return adj;
    }
  }

  // Next scan room interior tiles for an unreserved walkable tile
  const { x, y, w, h } = room.bounds;
  const candidates: GridPoint[] = [];
  for (let ry = y + 2; ry < y + h - 1; ry++) {
    for (let rx = x + 2; rx < x + w - 1; rx++) {
      if (grid[ry]?.[rx] && !reservedTiles.has(`${rx},${ry}`)) {
        candidates.push({ x: rx, y: ry });
      }
    }
  }
  if (candidates.length > 0) {
    const picked = candidates[idx % candidates.length];
    reservedTiles.add(`${picked.x},${picked.y}`);
    return picked;
  }

  const fallback = findNearestWalkable(grid, getRoomSeatTile(office, roomId, idx));
  reservedTiles.add(`${fallback.x},${fallback.y}`);
  return fallback;
}

export function resolveEmployeeLivingActivity(
  emp: GameState['employees'][number],
  idx: number,
  state: GameState,
  grid: boolean[][],
  reservedTiles: Set<string>
): {
  desiredRoom: RoomId;
  seat: GridPoint;
  arrivalState: GameState['employees'][number]['state'];
  thoughtIcon: string;
} {
  // 1. Leaving at end of workday
  if (state.hourOfDay >= 17.65) {
    const lobbyUnlocked = Boolean(state.office.rooms.LOBBY?.unlocked);
    const desiredRoom: RoomId = lobbyUnlocked ? 'LOBBY' : 'CEO_OFFICE';
    const exitCandidate = lobbyUnlocked
      ? { x: 4 + (idx % 2), y: 21 }
      : { x: 4 + (idx % 2), y: 11 };
    const seat = findNearestWalkable(grid, exitCandidate);
    reservedTiles.add(`${seat.x},${seat.y}`);
    return {
      desiredRoom,
      seat,
      arrivalState: 'OFF_DUTY',
      thoughtIcon: '👋',
    };
  }

  // 2. Break room recovery when fatigued or assigned REST_BREAK
  const breakUnlocked = Boolean(state.office.rooms.BREAK_ROOM?.unlocked);
  if (
    breakUnlocked &&
    (emp.assignedTask === 'REST_BREAK' ||
      (emp.energy < 44 && state.hourOfDay > 10.5 && state.hourOfDay < 16.5))
  ) {
    const breakInteractive = state.office.furniture.filter(
      (f) =>
        f.roomId === 'BREAK_ROOM' &&
        (f.templateId.startsWith('PERK_') ||
          f.templateId === 'ESPRESSO_BAR' ||
          f.templateId === 'ARCADE_CABINET' ||
          f.templateId === 'LOUNGE_SOFA')
    );
    let seat = reserveFreeRoomSeat(state.office, 'BREAK_ROOM', idx, grid, reservedTiles);
    let breakIcon = '☕';
    if (breakInteractive.length > 0) {
      const targetObj = breakInteractive[(idx + state.day) % breakInteractive.length];
      const adj = findAdjacentWalkableTile(grid, targetObj);
      if (adj && !reservedTiles.has(`${adj.x},${adj.y}`)) {
        reservedTiles.add(`${adj.x},${adj.y}`);
        seat = adj;
      }
      breakIcon =
        targetObj.templateId === 'PERK_PING_PONG'
          ? '🏓'
          : targetObj.templateId === 'PERK_SNACK_PANTRY'
            ? '🍎'
            : targetObj.templateId === 'PERK_WELLNESS_SUITE'
              ? '🧘'
              : targetObj.templateId === 'ARCADE_CABINET'
                ? '🕹️'
                : '☕';
    }
    const socialInBreak =
      emp.personality === 'SOCIAL' && state.hourOfDay >= 12.0 && state.hourOfDay <= 13.0;
    return {
      desiredRoom: 'BREAK_ROOM',
      seat,
      arrivalState: socialInBreak ? 'CHATTING' : 'RESTING',
      thoughtIcon: socialInBreak ? '💬' : breakIcon,
    };
  }

  // 3. Scheduled team sync in Meeting Room for managers, PMs, sales, and marketing
  const meetingUnlocked = Boolean(state.office.rooms.MEETING_ROOM?.unlocked);
  const inMeetingWindow =
    (state.hourOfDay >= 10.25 && state.hourOfDay <= 11.45) ||
    (state.hourOfDay >= 14.25 && state.hourOfDay <= 15.25);
  const isMeetingRole =
    emp.role === 'PRODUCT_MANAGER' ||
    emp.role === 'MARKETING_SPECIALIST' ||
    emp.role === 'SALES_REP' ||
    emp.role === 'OPERATIONS_MANAGER' ||
    emp.assignedTask === 'PLAN_ROADMAP' ||
    emp.assignedTask === 'CLOSE_SALES';

  if (meetingUnlocked && inMeetingWindow && isMeetingRole) {
    const seat = reserveFreeRoomSeat(state.office, 'MEETING_ROOM', idx, grid, reservedTiles);
    return {
      desiredRoom: 'MEETING_ROOM',
      seat,
      arrivalState: 'MEETING',
      thoughtIcon: '📋',
    };
  }

  // 4. Midday casual socializing for social personalities
  if (
    emp.personality === 'SOCIAL' &&
    state.hourOfDay >= 12.1 &&
    state.hourOfDay <= 12.85 &&
    state.office.rooms.LOBBY?.unlocked
  ) {
    const seat = reserveFreeRoomSeat(state.office, 'LOBBY', idx, grid, reservedTiles);
    return {
      desiredRoom: 'LOBBY',
      seat,
      arrivalState: 'CHATTING',
      thoughtIcon: '💬',
    };
  }

  // 5. Waiting briefly before morning ramp-up or resting if depleted without break room
  if (emp.energy <= 8 && emp.assignedTask === 'REST_BREAK') {
    const desiredRoom = getTaskRoom(emp.assignedTask, emp.homeRoom, state.office);
    const seat = reserveFreeRoomSeat(state.office, desiredRoom, idx, grid, reservedTiles);
    return {
      desiredRoom,
      seat,
      arrivalState: 'IDLE',
      thoughtIcon: '💭',
    };
  }

  // 6. Primary role/task workstation
  const desiredRoom = getTaskRoom(emp.assignedTask, emp.homeRoom, state.office);
  const seat = reserveFreeRoomSeat(state.office, desiredRoom, idx, grid, reservedTiles);
  const icon =
    emp.stress > 75
      ? '😓'
      : emp.assignedTask === 'BUILD_PRODUCT'
        ? '💻'
        : emp.assignedTask === 'FIX_BUGS'
          ? '🔧'
          : emp.assignedTask === 'MARKET_GROWTH'
            ? '📣'
            : emp.assignedTask === 'CLOSE_SALES'
              ? '🤝'
              : '📊';

  return {
    desiredRoom,
    seat,
    arrivalState: 'WORKING',
    thoughtIcon: icon,
  };
}

const TITLE_AMBIENT_SPOTS: Array<{ roomId: 'CEO_OFFICE' | 'ENGINEERING'; x: number; y: number }> = [
  { roomId: 'ENGINEERING', x: 14, y: 5 },
  { roomId: 'ENGINEERING', x: 18, y: 5 },
  { roomId: 'ENGINEERING', x: 22, y: 5 },
  { roomId: 'ENGINEERING', x: 17, y: 8 },
  { roomId: 'ENGINEERING', x: 21, y: 8 },
  { roomId: 'CEO_OFFICE', x: 4, y: 6 },
  { roomId: 'CEO_OFFICE', x: 6, y: 7 },
];

/**
 * Lightweight ambient simulation for the Main Menu living background:
 * employees and founder move naturally between desks and rooms while time lighting drifts softly.
 */
export function tickTitleAmbientLife(state: GameState, rawDtSeconds: number): GameState {
  const dt = Math.min(Math.max(rawDtSeconds, 0), 0.05);
  if (dt <= 0) return state;

  // Gentle ambient time drift (09:00 -> 17:15 -> wraps calmly to 09:15) so windows & clock animate
  state.hourOfDay += dt * 0.18;
  if (state.hourOfDay >= 17.25) {
    state.hourOfDay = 9.15;
  }

  const grid = buildWalkabilityGrid(state.office);

  // Move founder occasionally between desk & engineering collaboration spot
  if (state.founder.path.length > 0) {
    const moved = moveAlongPath(state.founder.position, state.founder.path, 2.4, dt);
    state.founder.position = moved.pos;
    state.founder.path = moved.path;
    state.founder.facing = moved.facing;
    state.founder.state = moved.moving ? 'WALKING' : 'IDLE';
  } else {
    state.founder.state = 'IDLE';
    if (Math.random() < dt * 0.14) {
      const spot =
        TITLE_AMBIENT_SPOTS[Math.floor(Math.random() * TITLE_AMBIENT_SPOTS.length)];
      const path = findPath(grid, state.founder.position, { x: spot.x, y: spot.y });
      if (path.length > 1) {
        state.founder.path = path.slice(1);
        state.founder.state = 'WALKING';
      }
    }
  }

  // Employees alternate calmly between working at desks and taking brief walks
  state.employees.forEach((emp, idx) => {
    if (emp.path.length > 0) {
      const moved = moveAlongPath(emp.position, emp.path, 2.1, dt);
      emp.position = moved.pos;
      emp.path = moved.path;
      emp.facing = moved.facing;
      emp.state = moved.moving ? 'WALKING' : 'WORKING';
      emp.thoughtIcon = moved.moving ? null : emp.role === 'DESIGNER' ? '🎨' : '💻';
    } else if (Math.random() < dt * (0.09 + idx * 0.02)) {
      const seat =
        Math.random() < 0.65
          ? getRoomSeatTile(state.office, emp.homeRoom, idx)
          : TITLE_AMBIENT_SPOTS[Math.floor(Math.random() * TITLE_AMBIENT_SPOTS.length)];
      const path = findPath(grid, emp.position, { x: seat.x, y: seat.y });
      if (path.length > 1) {
        emp.path = path.slice(1);
        emp.state = 'WALKING';
        emp.thoughtIcon = null;
      }
    } else if (emp.state !== 'WORKING') {
      emp.state = 'WORKING';
    }
  });

  return state;
}

export function tickSimulation(
  prevState: GameState,
  rawDtSeconds: number
): {
  state: GameState;
  dayEnded: boolean;
  monthEnded: boolean;
  eventTriggered: boolean;
  unlockedAchievements: Achievement[];
  unlockedMilestones: string[];
} {
  const dt = Math.min(rawDtSeconds, 0.05);
  let dayEnded = false;
  let monthEnded = false;
  let eventTriggered = false;
  let unlockedAchievements: Achievement[] = [];
  let unlockedMilestones: string[] = [];

  // Deep enough shallow clone for top-level React sync when needed
  const state: GameState = prevState;
  const grid = buildWalkabilityGrid(state.office);

  // Move founder smoothly across full Connected City via held isometric WASD or click-to-move path
  if (state.screen === 'PLAYING') {
    const worldNav = buildFullWorldNavGrid(state);
    const input = state.founder.inputVector;
    if (input && (Math.abs(input.x) > 0.01 || Math.abs(input.y) > 0.01)) {
      state.founder.path = [];
      state.founder.targetTile = null;
      const stepped = stepContinuousPosition(worldNav, state.founder.position, input, 4.8, dt);
      state.founder.position = stepped.pos;
      state.founder.facing = stepped.facing;
      state.founder.state = 'WALKING';
    } else if (state.founder.path.length > 0) {
      const moved = moveAlongPath(state.founder.position, state.founder.path, 4.4, dt);
      state.founder.position = moved.pos;
      state.founder.path = moved.path;
      state.founder.facing = moved.facing;
      state.founder.state = moved.moving ? 'WALKING' : 'IDLE';
    } else if (state.founder.state === 'WALKING') {
      state.founder.state = 'IDLE';
    }

    // Nearby City NPCs naturally turn to face the Founder as they walk past
    if (state.world?.npcs) {
      for (const npc of state.world.npcs) {
        const dx = state.founder.position.x - npc.position.x;
        const dy = state.founder.position.y - npc.position.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= 3.2) {
          if (Math.abs(dx) >= Math.abs(dy)) {
            npc.facing = dx >= 0 ? 'RIGHT' : 'LEFT';
          } else {
            npc.facing = dy >= 0 ? 'DOWN' : 'UP';
          }
        }
      }
    }
  }

  // Ensure stateful global weather cycle is present and step smooth visual transitions even while paused
  ensureWeatherState(state);
  if (state.screen === 'PLAYING') {
    syncCelebrationState(state, dt);
    if (state.speed === 0 || state.activeEvent !== null || state.pendingMonthlyReport !== null || state.pendingDailyReport !== null || state.story?.activeCinematic !== null || state.story?.activeStoryEvent !== null) {
      advanceWeatherCycle(state, 0, dt);
    }
  }

  // Pause time progression during modals, cinematics, story events, or speed === 0
  if (
    state.screen !== 'PLAYING' ||
    state.speed === 0 ||
    state.activeEvent !== null ||
    state.pendingMonthlyReport !== null ||
    state.pendingDailyReport !== null ||
    state.story?.activeCinematic !== null ||
    state.story?.activeStoryEvent !== null
  ) {
    return {
      state,
      dayEnded,
      monthEnded,
      eventTriggered,
      unlockedAchievements,
      unlockedMilestones,
    };
  }

  // Advance clock (1x = ~1.1 in-game hours per real second -> ~9s per workday)
  const beforeHour = state.hourOfDay;
  const hoursPerSec = state.speed === 1 ? 1.1 : state.speed === 2 ? 2.2 : 4.2;
  const hoursDelta = hoursPerSec * dt;
  state.hourOfDay += hoursDelta;
  advanceWeatherCycle(state, hoursDelta, dt);

  // During active onboarding Steps 1-7 on Day 1, hold clock softly at 17:30 until Step 8 teaches End Day
  if (
    beforeHour < 17.8 &&
    state.totalDays === 1 &&
    state.tutorial?.active &&
    !state.tutorial.completed &&
    !state.tutorial.skipped &&
    state.tutorial.currentStep < 8 &&
    state.hourOfDay > 17.5
  ) {
    state.hourOfDay = 17.5;
  }

  // Update employee autonomous Living Office AI (Working, Meeting, Break, Socializing, Leaving, Idle)
  const reservedTiles = new Set<string>();
  state.employees.forEach((emp) => {
    const dest = emp.targetTile ?? {
      x: Math.round(emp.position.x),
      y: Math.round(emp.position.y),
    };
    reservedTiles.add(`${dest.x},${dest.y}`);
  });

  state.employees.forEach((emp, idx) => {
    const activity = resolveEmployeeLivingActivity(emp, idx, state, grid, reservedTiles);

    if (emp.path.length > 0) {
      const moved = moveAlongPath(emp.position, emp.path, 2.8 + state.speed * 0.4, dt);
      emp.position = moved.pos;
      emp.path = moved.path;
      emp.facing = moved.facing;
      emp.state = moved.moving ? 'WALKING' : activity.arrivalState;
      if (!moved.moving) {
        emp.thoughtIcon = activity.thoughtIcon;
      }
    } else {
      const seat = activity.seat;
      const distToSeat = Math.hypot(emp.position.x - seat.x, emp.position.y - seat.y);
      if (distToSeat > 0.85) {
        emp.targetTile = seat;
        emp.path = findPath(grid, emp.position, seat);
        emp.state = emp.path.length > 0 ? 'WALKING' : activity.arrivalState;
      } else {
        // Gentle local separation if two stationary employees overlap on same spot
        const crowded = state.employees.some(
          (other, oIdx) =>
            oIdx < idx &&
            other.state !== 'WALKING' &&
            Math.hypot(other.position.x - emp.position.x, other.position.y - emp.position.y) < 0.55
        );
        if (crowded) {
          const alt = reserveFreeRoomSeat(state.office, activity.desiredRoom, idx + 3, grid, reservedTiles);
          if (Math.hypot(alt.x - emp.position.x, alt.y - emp.position.y) > 0.7) {
            emp.targetTile = alt;
            emp.path = findPath(grid, emp.position, alt);
            if (emp.path.length > 0) {
              emp.state = 'WALKING';
              return;
            }
          }
        }
        emp.state = activity.arrivalState;
        emp.thoughtIcon = activity.thoughtIcon;
      }
    }
  });

  // Visitor subtle stroll in lobby
  for (const vis of state.visitors) {
    const dx = vis.targetTile.x - vis.position.x;
    const dy = vis.targetTile.y - vis.position.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.1) {
      const step = 1.4 * dt;
      vis.position.x += (dx / d) * Math.min(step, d);
      vis.position.y += (dy / d) * Math.min(step, d);
    }
  }

  // End of workday at 18:30
  if (state.hourOfDay >= 18.5) {
    const res = advanceDay(state);
    dayEnded = true;
    monthEnded = res.monthEnded;
    eventTriggered = res.eventTriggered;
    unlockedAchievements = res.unlockedAchievements;
    unlockedMilestones = res.unlockedMilestones;
  }

  return {
    state,
    dayEnded,
    monthEnded,
    eventTriggered,
    unlockedAchievements,
    unlockedMilestones,
  };
}

export function advanceDay(state: GameState): {
  monthEnded: boolean;
  eventTriggered: boolean;
  unlockedAchievements: Achievement[];
  unlockedMilestones: string[];
} {
  let monthEnded = false;
  let eventTriggered = false;
  const closingDay = state.day;
  const closingMonth = state.month;
  const closingYear = state.year;
  const isFirstDayClosing = state.totalDays === 1;
  const cashBeforeDay = state.finance.cash;
  const revBeforeDay = state.finance.cumulativeRevenue;

  const locale = getLocale();
  const vi = locale === 'vi-VN';

  // 1. Update Employees
  const { resignedNames, unlockedTraits } = updateEmployeesDaily(state);
  if (resignedNames.length > 0) {
    recordStoryResignations(state, resignedNames.length);
  }
  for (const name of resignedNames) {
    addNotification(
      state,
      vi
        ? `${name} đã xin nghỉ việc do tinh thần giảm sút và căng thẳng kéo dài.`
        : `${name} resigned due to low morale and burnout.`,
      'ERROR'
    );
  }
  for (const ut of unlockedTraits) {
    const tName = getTraitLocalized(ut.traitId, locale).name;
    addNotification(
      state,
      vi ? `${ut.employeeName} đã mở khóa tố chất: ${tName}!` : `${ut.employeeName} unlocked trait: ${tName}!`,
      'SUCCESS'
    );
  }

  // 2. Update Products
  const { completedProductNames, completedFeatures } = updateProductsDaily(state);
  for (const pname of completedProductNames) {
    addNotification(
      state,
      vi
        ? `${pname} đã hoàn tất 100% MVP! Hãy vào mục Sản phẩm để ra mắt và bắt đầu có doanh thu.`
        : `${pname} reached 100% MVP progress! Launch it in Products to start earning revenue.`,
      'SUCCESS'
    );
  }
  for (const feat of completedFeatures) {
    addNotification(
      state,
      vi ? `Hoàn thành tính năng: ${feat}.` : `Feature completed: ${feat}.`,
      'SUCCESS'
    );
  }

  // 3. Update Market & Revenue
  const market = updateMarketDaily(state);
  for (const campName of market.pausedCampaigns) {
    addNotification(
      state,
      vi
        ? `Chiến dịch ${campName} đã tạm dừng do thiếu tiền mặt.`
        : `${campName} campaign paused due to low cash.`,
      'WARNING'
    );
  }

  // 4. Recover Founder overnight energy & apply founder salary reputation/investor trust effects
  state.founder.energy = clamp(state.founder.energy + 35, 0, state.founder.maxEnergy);
  state.founder.actionCooldownDays = Math.max(0, state.founder.actionCooldownDays - 1);
  const salaryProfile = getFounderSalaryProfile(
    state.founder.monthlySalary ?? 0,
    state.finance.cash
  );
  state.founder.investorTrust = clamp(
    Number(((state.founder.investorTrust ?? 55) + salaryProfile.investorTrustPerDay).toFixed(2)),
    0,
    100
  );
  state.founder.reputation = clamp(
    Number((state.founder.reputation + salaryProfile.respectPerDay).toFixed(2)),
    0,
    100
  );

  // 5. Refresh expired recruitment candidates every 5 days
  if (state.totalDays % 5 === 0) {
    const hrSkill = state.employees
      .filter((e) => e.role === 'HR_MANAGER')
      .reduce((acc, e) => acc + e.skills.operations, 0);
    state.candidates = generateCandidatePool(state.seed, state.totalDays, hrSkill / 100, 5);
  }

  // 5b. Sync daily Open World NPCs & Business Properties passive revenue
  const { propertyRevenue } = syncOpenWorldDaily(state);
  if (propertyRevenue > 0) {
    state.finance.cash += propertyRevenue;
    state.finance.currentMonthRevenue += propertyRevenue;
    state.finance.cumulativeRevenue += propertyRevenue;
    state.finance.cumulativeProfit += propertyRevenue;
  }

  // 6. Check milestones
  const unlocked = checkMilestones(state);
  const unlockedMilestones: string[] = [...unlocked];
  for (const msg of unlocked) {
    addNotification(
      state,
      vi ? `Đạt cột mốc mới: ${msg}` : `Milestone unlocked: ${msg}`,
      'SUCCESS'
    );
  }

  // 7. End of Month (Day 30)
  if (state.day >= 30) {
    const gained = state.finance.currentMonthCustomersGained;
    const churned = state.finance.currentMonthCustomersChurned;
    processEndOfMonth(state, gained, churned);
    monthEnded = true;

    // Check milestones again after monthly profit report
    const postMonthMs = checkMilestones(state);
    unlockedMilestones.push(...postMonthMs);
    for (const msg of postMonthMs) {
      addNotification(
        state,
        vi ? `Đạt cột mốc mới: ${msg}` : `Milestone unlocked: ${msg}`,
        'SUCCESS'
      );
    }

    state.day = 1;
    state.month += 1;
    if (state.month > 12) {
      state.month = 1;
      state.year += 1;
    }
  } else {
    state.day += 1;
  }

  state.totalDays += 1;
  state.hourOfDay = 8.5;
  advanceWeatherCycle(state, 4.0, 1.0);

  // 7b. Progressive Room Unlocks & Tutorial/Objectives sync
  const unlockedRooms = evaluateRoomUnlocks(state);
  for (const rId of unlockedRooms) {
    const rName = getRoomLocalized(rId, 0, locale).name;
    addNotification(
      state,
      vi ? `Đã mở khóa phòng mới: ${rName}!` : `New department unlocked: ${rName}!`,
      'SUCCESS'
    );
    if (
      (rId === 'BREAK_ROOM' || rId === 'LOBBY' || rId === 'LEGAL_DEPT') &&
      !state.activeCelebration &&
      state.celebrationQueue.length === 0
    ) {
      queueMilestoneCelebration(state, {
        id: `celebrate_room_${rId}`,
        kind: 'DEPARTMENT_EXPANSION',
        targetRoomId: rId,
        subjectName: rId,
      });
    }
  }
  syncTutorialAndObjectives(state);

  // Day 1 Progress Report when closing Day 1 (helps new founders understand daily results)
  if (isFirstDayClosing && !monthEnded && state.screen === 'PLAYING') {
    const revDelta = Math.max(0, Math.round(state.finance.cumulativeRevenue - revBeforeDay));
    const netDelta = state.finance.cash - cashBeforeDay;
    const spent = Math.max(0, Math.round(revDelta - netDelta));
    const totalCustomers = state.products.reduce((s, p) => s + p.payingCustomers, 0);
    const avgMorale = state.employees.length
      ? Math.round(state.employees.reduce((s, e) => s + e.morale, 0) / state.employees.length)
      : 0;
    const highlights: string[] = [];
    if (completedProductNames.length > 0) {
      highlights.push(
        vi
          ? `Hoàn thiện bản MVP: ${completedProductNames.join(', ')}`
          : `Completed MVP build: ${completedProductNames.join(', ')}`
      );
    }
    if (unlockedRooms.length > 0) {
      const names = unlockedRooms.map((id) => getRoomLocalized(id, 0, locale).name).join(', ');
      highlights.push(
        vi ? `Mở khóa phòng ban mới: ${names}` : `Unlocked office rooms: ${names}`
      );
    }
    if (revDelta > 0) {
      highlights.push(
        vi
          ? `Tạo được ${formatCurrency(revDelta, false, locale)} doanh thu trong Ngày 1.`
          : `Generated ${formatCurrency(revDelta, false, locale)} in Day 1 revenue.`
      );
    } else {
      highlights.push(
        vi
          ? 'Đội ngũ đã đẩy mạnh tiến độ R&D sản phẩm và chuẩn bị cho tăng trưởng khách hàng.'
          : 'Team advanced product R&D and prepared for customer growth.'
      );
    }
    state.pendingDailyReport = {
      day: closingDay,
      month: closingMonth,
      year: closingYear,
      revenueEarned: revDelta,
      expensesSpent: spent,
      cashBalance: state.finance.cash,
      customersTotal: totalCustomers,
      avgMorale,
      highlights,
    };
  }

  // 8. Daily employee chatter reflecting morale, workload, and workplace state
  const hasStressedStaff = state.employees.some(
    (e) => e.resignationWarning || e.morale < 38 || e.stress > 72
  );
  if (
    state.screen === 'PLAYING' &&
    state.employees.length > 0 &&
    (state.totalDays % 2 === 0 || hasStressedStaff)
  ) {
    generateEmployeeChatterForContext(state, 'DAILY');
  }

  // 9. Check unique achievements after all daily & monthly ledger updates
  const unlockedAchievements = checkAchievements(state);

  // 10. Maybe trigger strategic event if no monthly report pending
  if (!monthEnded && state.screen === 'PLAYING') {
    const evt = maybeTriggerEvent(state);
    if (evt) {
      state.activeEvent = evt;
      eventTriggered = true;
    }
  }

  // 11. Advance story chapters, milestone cinematics, and ending checks
  syncStoryProgression(state);
  syncCelebrationState(state, 0);

  return { monthEnded, eventTriggered, unlockedAchievements, unlockedMilestones };
}

export function executeCommand(prevState: GameState, cmd: GameCommand): CommandResult {
  const unlockedBefore = new Set(
    prevState.milestones.filter((m) => m.unlocked).map((m) => m.id)
  );
  const prevActiveCelId = prevState.activeCelebration?.id ?? null;
  const prevCinematic = prevState.story?.activeCinematic ?? null;

  const state: GameState = structuredClone(prevState);
  const res = executeCommandCore(state, cmd);
  const unlockedRooms = evaluateRoomUnlocks(res.state);
  const locale = getLocale();
  const vi = locale === 'vi-VN';
  for (const rId of unlockedRooms) {
    const rName = getRoomLocalized(rId, 0, locale).name;
    addNotification(
      res.state,
      vi ? `Đã mở khóa phòng mới: ${rName}!` : `New department unlocked: ${rName}!`,
      'SUCCESS'
    );
    if (
      (rId === 'BREAK_ROOM' || rId === 'LOBBY' || rId === 'LEGAL_DEPT') &&
      !res.state.activeCelebration &&
      res.state.celebrationQueue.length === 0
    ) {
      queueMilestoneCelebration(res.state, {
        id: `celebrate_room_${rId}`,
        kind: 'DEPARTMENT_EXPANSION',
        targetRoomId: rId,
        subjectName: rId,
      });
    }
  }
  syncTutorialAndObjectives(res.state);
  if (
    cmd.type !== 'COMPLETE_CINEMATIC' ||
    !res.state.story?.evaluatedEnding
  ) {
    syncStoryProgression(res.state);
  }
  syncCelebrationState(res.state, 0);
  const newlyUnlocked =
    cmd.type === 'END_DAY'
      ? res.unlockedAchievements ?? []
      : checkAchievements(res.state);
  if (newlyUnlocked.length > 0) {
    res.unlockedAchievements = newlyUnlocked;
  }

  const milestoneCompletedNow = res.state.milestones.some(
    (m) => m.unlocked && !unlockedBefore.has(m.id)
  );
  const celebrationStartedNow = Boolean(
    res.state.activeCelebration?.id && res.state.activeCelebration.id !== prevActiveCelId
  );
  const celebratoryCinematicStartedNow = Boolean(
    res.state.story?.activeCinematic &&
      res.state.story.activeCinematic !== prevCinematic &&
      isCelebratoryCinematic(res.state.story.activeCinematic)
  );

  if (
    res.sound !== 'ERROR' &&
    (milestoneCompletedNow || celebrationStartedNow || celebratoryCinematicStartedNow)
  ) {
    res.sound = 'MILESTONE_CHIME';
  }

  return res;
}

function executeCommandCore(state: GameState, cmd: GameCommand): CommandResult {
  const locale = getLocale();
  const vi = locale === 'vi-VN';

  switch (cmd.type) {
    case 'SET_SPEED': {
      state.speed = cmd.speed;
      return { state };
    }

    case 'END_DAY': {
      if (state.screen !== 'PLAYING' || state.activeEvent || state.pendingMonthlyReport) {
        return { state };
      }
      const res = advanceDay(state);
      return {
        state,
        feedback: res.monthEnded
          ? vi
            ? 'Đã chốt sổ tháng — báo cáo tài chính đã sẵn sàng.'
            : 'Month closed — financial report ready.'
          : vi
            ? `Bắt đầu Ngày ${state.day}.`
            : `Started Day ${state.day}.`,
        sound: res.monthEnded ? 'CASH' : 'CLICK',
        unlockedAchievements: res.unlockedAchievements,
      };
    }

    case 'MOVE_FOUNDER': {
      const worldNav = buildFullWorldNavGrid(state);
      state.founder.inputVector = { x: 0, y: 0 };
      state.founder.path = findWorldPath(worldNav, state.founder.position, cmd.target);
      state.founder.targetTile = cmd.target;
      if (state.founder.path.length > 0) {
        state.founder.state = 'WALKING';
      }
      return { state };
    }

    case 'SET_FOUNDER_INPUT': {
      state.founder.inputVector = { x: cmd.dir.x, y: cmd.dir.y };
      if (Math.abs(cmd.dir.x) > 0.01 || Math.abs(cmd.dir.y) > 0.01) {
        state.founder.path = [];
        state.founder.targetTile = null;
        state.founder.state = 'WALKING';
      } else if (state.founder.path.length === 0 && state.founder.state === 'WALKING') {
        state.founder.state = 'IDLE';
      }
      return { state };
    }

    case 'STEP_FOUNDER': {
      const worldNav = buildFullWorldNavGrid(state);
      state.founder.targetTile = null;
      const nx = Math.round(state.founder.position.x + cmd.dx);
      const ny = Math.round(state.founder.position.y + cmd.dy);
      if (isNavWalkable(worldNav, nx, ny)) {
        state.founder.path = [{ x: nx, y: ny }];
        state.founder.state = 'WALKING';
      }
      return { state };
    }

    case 'FOUNDER_INTERACT_EMPLOYEE': {
      const emp = state.employees.find((e) => e.id === cmd.employeeId);
      if (!emp) return { state };
      if (state.founder.energy < 12) {
        return {
          state,
          feedback: vi
            ? 'Năng lượng nhà sáng lập đang thấp! Hãy nghỉ ở Phòng nghỉ ngơi hoặc kết thúc ngày.'
            : 'Founder energy is low! Rest in the Break Room or end the day.',
          sound: 'ERROR',
        };
      }
      state.founder.energy = clamp(state.founder.energy - 12, 0, 100);
      state.founder.businessExp += 15;
      if (state.founder.businessExp >= state.founder.level * 100) {
        state.founder.level += 1;
        state.founder.leadership = clamp(state.founder.leadership + 4, 1, 100);
      }

      if (cmd.mode === 'MOTIVATE') {
        emp.morale = clamp(emp.morale + 14, 0, 100);
        emp.stress = clamp(emp.stress - 8, 0, 100);
        emp.thoughtIcon = '✨';
        addNotification(
          state,
          vi ? `Đã khích lệ tinh thần ${emp.name} (+14 Tinh thần).` : `Motivated ${emp.name} (+14 Morale).`,
          'SUCCESS'
        );
        generateEmployeeChatterForContext(state, 'MOTIVATE', emp);
      } else if (cmd.mode === 'COACH') {
        const primary = ROLE_DEFINITIONS[emp.role].primarySkill;
        const skillLabel = getSkillLocalized(primary, locale);
        emp.skills[primary] = clamp(emp.skills[primary] + 3, 1, 100);
        emp.experience += 18;
        emp.thoughtIcon = '💡';
        const unlocked = evaluateEmployeeTraits(emp);
        emp.productivity = computeEmployeeProductivity(emp, state);
        addNotification(
          state,
          vi ? `Đã kèm cặp ${emp.name} (+3 ${skillLabel}).` : `Coached ${emp.name} (+3 ${skillLabel} skill).`,
          'SUCCESS'
        );
        for (const tr of unlocked) {
          const tName = getTraitLocalized(tr.id, locale).name;
          addNotification(
            state,
            vi ? `${emp.name} đã mở khóa tố chất: ${tName}!` : `${emp.name} unlocked trait: ${tName}!`,
            'SUCCESS'
          );
        }
      } else {
        emp.stress = clamp(emp.stress - 14, 0, 100);
        emp.energy = clamp(emp.energy + 8, 0, 100);
        emp.thoughtIcon = '💬';
        addNotification(
          state,
          vi
            ? `Trao đổi 1-1 với ${emp.name} đã giúp giảm căng thẳng.`
            : `1-on-1 check-in with ${emp.name} eased stress.`,
          'INFO'
        );
      }
      return { state, sound: 'SUCCESS' };
    }

    case 'FOUNDER_REST': {
      state.founder.energy = clamp(state.founder.energy + 35, 0, state.founder.maxEnergy);
      addNotification(
        state,
        vi
          ? 'Đã dùng cà phê tại Phòng nghỉ ngơi (+35 Năng lượng CEO).'
          : 'Grabbed espresso in the Break Room (+35 Founder Energy).',
        'INFO'
      );
      return {
        state,
        feedback: vi ? 'Đã hồi phục +35 Năng lượng CEO.' : 'Founder energy restored +35.',
        sound: 'SUCCESS',
      };
    }

    case 'FOUNDER_STRATEGY_SESSION': {
      if (state.founder.energy < 25 || state.founder.actionCooldownDays > 0) {
        return {
          state,
          feedback:
            state.founder.actionCooldownDays > 0
              ? vi
                ? 'Họp chiến lược CEO thực hiện mỗi 3 ngày một lần.'
                : 'Strategy sprint available once every 3 days.'
              : vi
                ? 'Cần tối thiểu 25 Năng lượng CEO.'
                : 'Need at least 25 Founder Energy.',
          sound: 'ERROR',
        };
      }
      state.founder.energy -= 25;
      state.founder.actionCooldownDays = 3;
      state.founder.leadership = clamp(state.founder.leadership + 3, 1, 100);
      state.founder.reputation = clamp(state.founder.reputation + 2, 0, 100);
      state.products.forEach((p) => {
        if (p.stage === 'CONCEPT' || p.stage === 'IN_DEV') {
          p.developmentProgress = clamp(p.developmentProgress + 8, 0, 100);
        } else {
          p.marketDemand = clamp(p.marketDemand + 3, 0, 100);
        }
      });
      addNotification(
        state,
        vi
          ? 'Phiên chiến lược CEO đã thúc đẩy tiến độ sản phẩm & năng lực lãnh đạo!'
          : 'CEO Strategy Session accelerated product & leadership!',
        'SUCCESS'
      );
      return {
        state,
        feedback: vi
          ? 'Phiên chiến lược đã thúc đẩy lộ trình & uy tín!'
          : 'Strategy session boosted roadmap & leadership!',
        sound: 'SUCCESS',
      };
    }

    case 'HIRE_CANDIDATE': {
      if (state.employees.length >= state.office.maxEmployees) {
        return {
          state,
          feedback: vi
            ? `Văn phòng đã đủ chỗ (${state.office.maxEmployees} tối đa). Hãy mở rộng trụ sở trước!`
            : `Office capacity full (${state.office.maxEmployees} max). Expand office first!`,
          sound: 'ERROR',
        };
      }
      const candIdx = state.candidates.findIndex((c) => c.id === cmd.candidateId);
      if (candIdx === -1) return { state };
      const cand = state.candidates[candIdx];
      if (state.finance.cash < cand.hiringFee) {
        return {
          state,
          feedback: vi
            ? `Cần ${formatCurrency(cand.hiringFee, false, locale)} phí tiếp nhận.`
            : `Need ${formatCurrency(cand.hiringFee, false, locale)} hiring fee.`,
          sound: 'ERROR',
        };
      }
      state.finance.cash -= cand.hiringFee;
      state.finance.currentMonthDevCosts += cand.hiringFee;
      const newEmp = createEmployeeFromCandidate(cand, state, state.employees.length);
      state.employees.push(newEmp);
      if (!state.hiredRolesHistory.includes(newEmp.role)) {
        state.hiredRolesHistory.push(newEmp.role);
      }
      state.candidates.splice(candIdx, 1);
      syncCoworkingCandidateNpcs(state);
      const roleTitle = getLevelTitleLocalized(newEmp.role, newEmp.level, locale);
      addNotification(
        state,
        vi ? `Đã tuyển dụng ${newEmp.name} ở vị trí ${roleTitle}.` : `Hired ${newEmp.name} as ${roleTitle}.`,
        'SUCCESS'
      );
      generateEmployeeChatterForContext(state, 'NEW_HIRE', newEmp);
      checkMilestones(state);
      return {
        state,
        feedback: vi ? `Chào mừng ${newEmp.name} gia nhập công ty!` : `Welcome aboard, ${newEmp.name}!`,
        sound: 'SUCCESS',
      };
    }

    case 'REFRESH_CANDIDATES': {
      const fee = 250;
      if (state.finance.cash < fee) {
        return {
          state,
          feedback: vi
            ? `Cần ${formatCurrency(fee, false, locale)} để tìm kiếm ứng viên mới.`
            : `Need ${formatCurrency(fee, false, locale)} to run a new talent search.`,
          sound: 'ERROR',
        };
      }
      state.finance.cash -= fee;
      state.finance.currentMonthDevCosts += fee;
      const hrBonus = state.employees
        .filter((e) => e.role === 'HR_MANAGER')
        .reduce((acc, e) => acc + e.skills.operations / 100, 0);
      state.candidates = generateCandidatePool(
        state.seed + Math.floor(Math.random() * 5000),
        state.totalDays,
        hrBonus,
        5
      );
      syncCoworkingCandidateNpcs(state);
      return {
        state,
        feedback: vi ? 'Đã làm mới danh sách ứng viên.' : 'Refreshed candidate pool.',
        sound: 'CLICK',
      };
    }

    case 'FIRE_EMPLOYEE': {
      const idx = state.employees.findIndex((e) => e.id === cmd.employeeId);
      if (idx === -1) return { state };
      const [removed] = state.employees.splice(idx, 1);
      state.employees.forEach((e) => (e.morale = clamp(e.morale - 6, 0, 100)));
      addNotification(
        state,
        vi ? `Đã chấm dứt hợp đồng với ${removed.name}.` : `Parted ways with ${removed.name}.`,
        'WARNING'
      );
      return {
        state,
        feedback: vi ? `Đã cho ${removed.name} nghỉ việc.` : `Released ${removed.name}.`,
        sound: 'CLICK',
      };
    }

    case 'ASSIGN_EMPLOYEE_TASK': {
      const emp = state.employees.find((e) => e.id === cmd.employeeId);
      if (!emp) return { state };
      emp.assignedTask = cmd.task;
      if (cmd.productId !== undefined) emp.assignedProductId = cmd.productId;
      const targetRoom = getTaskRoom(cmd.task, emp.homeRoom, state.office);
      const grid = buildWalkabilityGrid(state.office);
      const dest = getRoomSeatTile(state.office, targetRoom, 0);
      emp.path = findPath(grid, emp.position, dest);
      if (state.tutorial) {
        state.tutorial.assignedWork = true;
        state.tutorial.manualHoldStep = null;
      }
      const taskLabel = getTaskLocalized(cmd.task, locale) || TASK_LABELS[cmd.task];
      addNotification(
        state,
        vi ? `Đã giao cho ${emp.name} nhiệm vụ: ${taskLabel}.` : `${emp.name} assigned to ${taskLabel}.`,
        'INFO'
      );
      return { state, sound: 'CLICK' };
    }

    case 'TRAIN_EMPLOYEE': {
      const emp = state.employees.find((e) => e.id === cmd.employeeId);
      if (!emp) return { state };
      const cost = 600;
      if (state.finance.cash < cost) {
        return {
          state,
          feedback: vi
            ? `Cần ${formatCurrency(cost, false, locale)} cho khóa đào tạo chuyên môn.`
            : `Need ${formatCurrency(cost, false, locale)} for professional training.`,
          sound: 'ERROR',
        };
      }
      if (emp.lastTrainedDay > 0 && state.totalDays - emp.lastTrainedDay < 5) {
        return {
          state,
          feedback: vi
            ? 'Nhân viên vừa được đào tạo gần đây. Vui lòng đợi vài ngày.'
            : 'Employee was recently trained. Wait a few days.',
          sound: 'ERROR',
        };
      }
      state.finance.cash -= cost;
      state.finance.currentMonthDevCosts += cost;
      const primary = ROLE_DEFINITIONS[emp.role].primarySkill;
      const skillLabel = getSkillLocalized(primary, locale);
      emp.skills[primary] = clamp(emp.skills[primary] + 6, 1, 100);
      emp.experience += 30;
      emp.morale = clamp(emp.morale + 5, 0, 100);
      emp.lastTrainedDay = state.totalDays;
      const unlocked = evaluateEmployeeTraits(emp);
      emp.productivity = computeEmployeeProductivity(emp, state);
      addNotification(
        state,
        vi ? `Đã đào tạo ${emp.name} (+6 ${skillLabel}).` : `Trained ${emp.name} (+6 ${skillLabel} skill).`,
        'SUCCESS'
      );
      for (const tr of unlocked) {
        const tName = getTraitLocalized(tr.id, locale).name;
        addNotification(
          state,
          vi ? `${emp.name} đã mở khóa tố chất: ${tName}!` : `${emp.name} unlocked trait: ${tName}!`,
          'SUCCESS'
        );
      }
      if (unlocked.length > 0) {
        const firstTrait = getTraitLocalized(unlocked[0].id, locale).name;
        return {
          state,
          feedback: vi
            ? `${emp.name} đã mở khóa "${firstTrait}"!`
            : `${emp.name} unlocked "${firstTrait}"!`,
          sound: 'LEVEL_UP',
        };
      }
      return {
        state,
        feedback: vi ? `${emp.name} đã hoàn thành đào tạo!` : `${emp.name} completed training!`,
        sound: 'SUCCESS',
      };
    }

    case 'PROMOTE_EMPLOYEE': {
      const emp = state.employees.find((e) => e.id === cmd.employeeId);
      if (!emp || emp.level >= 4) return { state };
      emp.level = (emp.level + 1) as 1 | 2 | 3 | 4;
      emp.title = getLevelTitle(emp.role, emp.level);
      emp.monthlySalary = Math.round(emp.monthlySalary * 1.18);
      emp.morale = clamp(emp.morale + 20, 0, 100);
      emp.stress = clamp(emp.stress - 10, 0, 100);
      const primary = ROLE_DEFINITIONS[emp.role].primarySkill;
      emp.skills[primary] = clamp(emp.skills[primary] + 5, 1, 100);
      const unlocked = evaluateEmployeeTraits(emp);
      emp.productivity = computeEmployeeProductivity(emp, state);
      const roleTitle = getLevelTitleLocalized(emp.role, emp.level, locale);
      addNotification(
        state,
        vi ? `Đã thăng chức cho ${emp.name} lên ${roleTitle}!` : `Promoted ${emp.name} to ${roleTitle}!`,
        'SUCCESS'
      );
      for (const tr of unlocked) {
        const tName = getTraitLocalized(tr.id, locale).name;
        addNotification(
          state,
          vi ? `${emp.name} đã mở khóa tố chất: ${tName}!` : `${emp.name} unlocked trait: ${tName}!`,
          'SUCCESS'
        );
      }
      generateEmployeeChatterForContext(state, 'PROMOTION', emp);
      return {
        state,
        feedback: vi
          ? `${emp.name} được thăng chức thành ${roleTitle}!`
          : `${emp.name} promoted to ${roleTitle}!`,
        sound: 'LEVEL_UP',
      };
    }

    case 'GIVE_RAISE': {
      const emp = state.employees.find((e) => e.id === cmd.employeeId);
      if (!emp) return { state };
      emp.monthlySalary += cmd.amount;
      emp.morale = clamp(emp.morale + 15, 0, 100);
      emp.resignationWarning = false;
      addNotification(
        state,
        vi
          ? `Đã tăng lương cho ${emp.name} thêm ${formatCurrency(cmd.amount, false, locale)}/tháng.`
          : `Gave ${emp.name} a +${formatCurrency(cmd.amount, false, locale)}/mo raise.`,
        'SUCCESS'
      );
      return { state, sound: 'SUCCESS' };
    }

    case 'CREATE_PRODUCT': {
      const spec = PRODUCT_CATEGORIES[cmd.category];
      const upfront = Math.round(spec.baseDevCost * 0.45);
      if (state.finance.cash < upfront) {
        return {
          state,
          feedback: vi
            ? `Cần ${formatCurrency(upfront, false, locale)} ngân sách R&D ban đầu.`
            : `Need ${formatCurrency(upfront, false, locale)} seed R&D budget to start.`,
          sound: 'ERROR',
        };
      }
      state.finance.cash -= upfront;
      state.finance.currentMonthDevCosts += upfront;
      const prod = createProductEntity(
        `prod_${state.totalDays}_${Math.random().toString(36).slice(2, 6)}`,
        cmd.name,
        cmd.category,
        cmd.revenueModel,
        5
      );
      prod.developmentCostSpent += upfront;
      state.products.push(prod);
      if (state.tutorial) {
        state.tutorial.createdProduct = true;
        state.tutorial.manualHoldStep = null;
      }
      addNotification(
        state,
        vi ? `Đã khởi động R&D sản phẩm mới: ${prod.name}.` : `Started R&D on new product: ${prod.name}.`,
        'SUCCESS'
      );
      return {
        state,
        feedback: vi ? `Đã tạo sản phẩm ${prod.name}!` : `Created ${prod.name}!`,
        sound: 'SUCCESS',
      };
    }

    case 'RUN_PROTOTYPE_SPRINT': {
      const prod = state.products.find((p) => p.id === cmd.productId);
      if (!prod) return { state };
      if (prod.stage !== 'CONCEPT' && prod.stage !== 'IN_DEV') {
        return {
          state,
          feedback: vi ? 'Sản phẩm đã qua giai đoạn MVP.' : 'Product is already past MVP stage.',
          sound: 'ERROR',
        };
      }
      if (prod.developmentProgress >= 100) {
        return {
          state,
          feedback: vi
            ? 'MVP đã đạt 100% và sẵn sàng ra mắt!'
            : 'MVP is already at 100% and ready to launch!',
          sound: 'INFO' as 'CLICK',
        };
      }
      const sprintCost = 400;
      if (state.finance.cash < sprintCost) {
        return {
          state,
          feedback: vi
            ? `Cần ${formatCurrency(sprintCost, false, locale)} cho đợt tăng tốc R&D.`
            : `Need ${formatCurrency(sprintCost, false, locale)} for R&D build sprint.`,
          sound: 'ERROR',
        };
      }
      if (state.founder.energy < 10) {
        return {
          state,
          feedback: vi
            ? 'Cần ít nhất 10 Năng lượng CEO cho đợt tăng tốc.'
            : 'Need at least 10 Founder Energy for a build sprint.',
          sound: 'ERROR',
        };
      }
      state.finance.cash -= sprintCost;
      state.finance.currentMonthDevCosts += sprintCost;
      state.founder.energy = clamp(state.founder.energy - 10, 0, state.founder.maxEnergy);
      prod.stage = 'IN_DEV';
      prod.developmentCostSpent += sprintCost;
      prod.developmentProgress = clamp(Math.round(prod.developmentProgress + 35), 0, 100);
      prod.quality = clamp(Number((prod.quality + 3).toFixed(1)), 10, 99);
      if (prod.developmentProgress >= 100 && prod.features[0]) {
        prod.features[0].effortProgress = prod.features[0].effortRequired;
        prod.features[0].completed = true;
      }
      addNotification(
        state,
        vi
          ? `Tăng tốc R&D đưa ${prod.name} lên ${Math.round(prod.developmentProgress)}% tiến độ MVP.`
          : `Build sprint pushed ${prod.name} to ${Math.round(prod.developmentProgress)}% MVP progress.`,
        'SUCCESS'
      );
      return {
        state,
        feedback: vi
          ? `${prod.name} hoàn thành đợt tăng tốc (${Math.round(prod.developmentProgress)}%).`
          : `${prod.name} sprint complete (${Math.round(prod.developmentProgress)}%).`,
        sound: prod.developmentProgress >= 100 ? 'LEVEL_UP' : 'SUCCESS',
      };
    }

    case 'ADD_PRODUCT_FEATURE': {
      const prod = state.products.find((p) => p.id === cmd.productId);
      const tpl = FEATURE_TEMPLATES[cmd.templateIndex];
      if (!prod || !tpl) return { state };
      if (state.finance.cash < tpl.cost) {
        return {
          state,
          feedback: vi
            ? `Cần ${formatCurrency(tpl.cost, false, locale)} để thêm tính năng.`
            : `Need ${formatCurrency(tpl.cost, false, locale)} for feature scope.`,
          sound: 'ERROR',
        };
      }
      if (prod.features.some((f) => f.name === tpl.name && !f.completed)) {
        return {
          state,
          feedback: vi
            ? 'Tính năng này đã nằm trong danh sách phát triển.'
            : 'This feature is already queued in development.',
          sound: 'ERROR',
        };
      }
      state.finance.cash -= tpl.cost;
      state.finance.currentMonthDevCosts += tpl.cost;
      prod.developmentCostSpent += tpl.cost;
      prod.features.push({
        id: `feat_${state.totalDays}_${Math.random().toString(36).slice(2, 6)}`,
        name: tpl.name,
        description: tpl.description,
        effortRequired: tpl.effortRequired,
        effortProgress: 0,
        cost: tpl.cost,
        qualityBoost: tpl.qualityBoost,
        demandBoost: tpl.demandBoost,
        completed: false,
        requiredSkill: tpl.requiredSkill,
      });
      const featName = getFeatureLocalized(tpl.name, tpl.description, locale).name;
      addNotification(
        state,
        vi ? `Đã thêm tính năng "${featName}" vào ${prod.name}.` : `Added feature "${featName}" to ${prod.name}.`,
        'INFO'
      );
      return {
        state,
        feedback: vi ? `Đã xếp lịch "${featName}"!` : `Queued ${featName}!`,
        sound: 'CLICK',
      };
    }

    case 'LAUNCH_PRODUCT_MVP': {
      const prod = state.products.find((p) => p.id === cmd.productId);
      if (!prod) return { state };
      if (prod.developmentProgress < 100) {
        return {
          state,
          feedback: vi
            ? 'Sản phẩm cần hoàn thiện 100% MVP trước khi ra mắt.'
            : 'Product must reach 100% MVP development first.',
          sound: 'ERROR',
        };
      }
      if (prod.stage === 'MVP_LIVE' || prod.stage === 'MATURE') return { state };
      prod.stage = 'MVP_LIVE';
      prod.launchDay = state.totalDays;
      const initialUsers = Math.max(8, Math.round((prod.quality + state.founder.reputation) * 0.35));
      prod.activeUsers += initialUsers;
      prod.payingCustomers += Math.round(initialUsers * 0.55);
      state.founder.reputation = clamp(state.founder.reputation + 6, 0, 100);
      addNotification(
        state,
        vi
          ? `Đã ra mắt ${prod.name}! Có ${prod.payingCustomers} khách hàng trả phí đầu tiên.`
          : `Launched ${prod.name}! ${prod.payingCustomers} initial paying customers signed up.`,
        'SUCCESS'
      );
      generateEmployeeChatterForContext(state, 'MVP_LAUNCH');
      checkMilestones(state);
      queueMilestoneCelebration(state, {
        id: `celebrate_mvp_${prod.id}`,
        kind: 'PRODUCT_MVP_LAUNCH',
        targetRoomId: 'ENGINEERING',
        subjectName: prod.name,
        detailValue: prod.payingCustomers,
      });
      return {
        state,
        feedback: vi ? `${prod.name} đã chính thức ra mắt!` : `${prod.name} is LIVE!`,
        sound: 'MILESTONE_CHIME',
      };
    }

    case 'RELEASE_PRODUCT_UPDATE': {
      const prod = state.products.find((p) => p.id === cmd.productId);
      if (!prod || (prod.stage !== 'MVP_LIVE' && prod.stage !== 'MATURE')) return { state };
      const updateCost = 700;
      if (state.finance.cash < updateCost) {
        return {
          state,
          feedback: vi
            ? `Cần ${formatCurrency(updateCost, false, locale)} để phát hành bản cập nhật.`
            : `Need ${formatCurrency(updateCost, false, locale)} for release rollout.`,
          sound: 'ERROR',
        };
      }
      state.finance.cash -= updateCost;
      state.finance.currentMonthDevCosts += updateCost;
      const wasMature = prod.stage === 'MATURE';
      prod.version += 1;
      prod.quality = clamp(prod.quality + 6, 0, 100);
      prod.marketDemand = clamp(prod.marketDemand + 5, 0, 100);
      prod.customerSatisfaction = clamp(prod.customerSatisfaction + 7, 0, 100);
      if (prod.version >= 3) prod.stage = 'MATURE';
      addNotification(
        state,
        vi ? `Đã phát hành ${prod.name} v${prod.version}.0!` : `Shipped ${prod.name} v${prod.version}.0!`,
        'SUCCESS'
      );
      generateEmployeeChatterForContext(state, 'UPDATE_SHIPPED');
      if (!wasMature && prod.stage === 'MATURE') {
        queueMilestoneCelebration(state, {
          id: `celebrate_mature_${prod.id}`,
          kind: 'PRODUCT_MATURE_RELEASE',
          targetRoomId: 'ENGINEERING',
          subjectName: prod.name,
          detailValue: prod.version,
        });
      }
      return {
        state,
        feedback: vi ? `Đã phát hành v${prod.version}.0!` : `Released v${prod.version}.0!`,
        sound: !wasMature && prod.stage === 'MATURE' ? 'MILESTONE_CHIME' : 'SUCCESS',
      };
    }

    case 'FIX_PRODUCT_BUGS': {
      const prod = state.products.find((p) => p.id === cmd.productId);
      if (!prod || prod.bugs === 0) return { state };
      const cost = prod.bugs * 120;
      if (state.finance.cash < cost) {
        return {
          state,
          feedback: vi
            ? `Cần ${formatCurrency(cost, false, locale)} cho đợt sửa lỗi khẩn cấp.`
            : `Need ${formatCurrency(cost, false, locale)} for emergency QA sprint.`,
          sound: 'ERROR',
        };
      }
      state.finance.cash -= cost;
      state.finance.currentMonthDevCosts += cost;
      const fixed = prod.bugs;
      prod.bugs = 0;
      prod.customerSatisfaction = clamp(prod.customerSatisfaction + 6, 0, 100);
      addNotification(
        state,
        vi ? `Đã xử lý ${fixed} lỗi trong ${prod.name}.` : `Resolved ${fixed} bugs in ${prod.name}.`,
        'SUCCESS'
      );
      return { state, sound: 'SUCCESS' };
    }

    case 'SET_PRODUCT_PRICE': {
      const prod = state.products.find((p) => p.id === cmd.productId);
      if (!prod) return { state };
      const newPrice = clamp(Math.round(cmd.price), 5, 500);
      const spec = PRODUCT_CATEGORIES[prod.category];
      prod.pricePerCustomer = newPrice;
      const ratio = newPrice / spec.defaultPrice;
      if (ratio > 1.6) {
        prod.customerSatisfaction = clamp(prod.customerSatisfaction - 4, 10, 100);
      }
      return {
        state,
        feedback: vi
          ? `Đã cập nhật giá lên ${formatCurrency(newPrice, false, locale)}.`
          : `Updated price to ${formatCurrency(newPrice, false, locale)}.`,
        sound: 'CLICK',
      };
    }

    case 'TOGGLE_CAMPAIGN': {
      const chanName = getChannelLocalized(cmd.channel, locale).label || MARKETING_CHANNELS[cmd.channel].label;
      const existing = state.campaigns.find(
        (c) => c.channel === cmd.channel && c.productId === cmd.productId
      );
      if (existing && existing.active) {
        existing.active = false;
        return {
          state,
          feedback: vi ? `Đã tạm dừng ${chanName}.` : `Paused ${chanName}.`,
          sound: 'CLICK',
        };
      }
      if (existing && !existing.active) {
        existing.active = true;
        existing.dailyBudget = cmd.dailyBudget;
        existing.targetSegment = cmd.segment;
        addNotification(
          state,
          vi
            ? `Đã tiếp tục chiến dịch ${chanName} (${formatCurrency(cmd.dailyBudget, false, locale)}/ngày).`
            : `Resumed ${chanName} campaign (${formatCurrency(cmd.dailyBudget, false, locale)}/day).`,
          'INFO'
        );
        return {
          state,
          feedback: vi ? 'Đã tiếp tục chiến dịch tiếp thị!' : 'Marketing campaign resumed!',
          sound: 'SUCCESS',
        };
      }
      state.campaigns.push({
        id: `camp_${state.totalDays}_${Math.random().toString(36).slice(2, 6)}`,
        channel: cmd.channel,
        productId: cmd.productId,
        targetSegment: cmd.segment,
        dailyBudget: cmd.dailyBudget,
        active: true,
        totalSpent: 0,
        customersAcquired: 0,
        impressions: 0,
        effectivenessMultiplier: 1,
      });
      addNotification(
        state,
        vi
          ? `Đã chạy chiến dịch ${chanName} (${formatCurrency(cmd.dailyBudget, false, locale)}/ngày).`
          : `Started ${chanName} campaign (${formatCurrency(cmd.dailyBudget, false, locale)}/day).`,
        'INFO'
      );
      return {
        state,
        feedback: vi ? 'Chiến dịch tiếp thị đã kích hoạt!' : 'Marketing campaign active!',
        sound: 'SUCCESS',
      };
    }

    case 'STOP_CAMPAIGN': {
      const camp = state.campaigns.find((c) => c.id === cmd.campaignId);
      if (camp) camp.active = false;
      return { state, sound: 'CLICK' };
    }

    case 'REVIEW_CONTRACT_LEGAL': {
      const ctr = state.contracts.find((c) => c.id === cmd.contractId);
      if (!ctr || ctr.legalReviewed) return { state };
      const opsBoost = state.employees.some(
        (e) => e.role === 'OPERATIONS_MANAGER' && e.assignedTask !== 'REST_BREAK'
      );
      const catalystDiscount = state.employees.some(
        (e) => e.assignedTask !== 'REST_BREAK' && e.traits?.includes('CULTURE_CATALYST')
      )
        ? 50
        : 0;
      const legalLvl = state.office.rooms.LEGAL_DEPT?.level ?? 1;
      const baseFee = opsBoost ? 200 : 400;
      const fee = Math.max(100, baseFee - (legalLvl - 1) * 75 - catalystDiscount);
      if (state.finance.cash < fee) {
        return {
          state,
          feedback: vi
            ? `Cần ${formatCurrency(fee, false, locale)} để thẩm định pháp lý.`
            : `Need ${formatCurrency(fee, false, locale)} for legal review.`,
          sound: 'ERROR',
        };
      }
      state.finance.cash -= fee;
      state.finance.currentMonthDevCosts += fee;
      ctr.legalReviewed = true;
      addNotification(
        state,
        vi
          ? `Phòng pháp chế đã thông qua hợp đồng với ${ctr.clientName}.`
          : `Legal approved contract terms for ${ctr.clientName}.`,
        'SUCCESS'
      );
      return {
        state,
        feedback: vi ? 'Hợp đồng đã qua thẩm định pháp lý!' : 'Contract passed legal compliance!',
        sound: 'SUCCESS',
      };
    }

    case 'PITCH_CONTRACT': {
      const ctr = state.contracts.find((c) => c.id === cmd.contractId);
      if (!ctr || ctr.status !== 'PIPELINE') return { state };
      const prod = state.products.find((p) => p.id === ctr.productId) ?? state.products[0];
      if (!prod || (prod.stage !== 'MVP_LIVE' && prod.stage !== 'MATURE')) {
        return {
          state,
          feedback: vi
            ? 'Hãy ra mắt sản phẩm MVP trước khi chào bán hợp đồng doanh nghiệp.'
            : 'Launch a live product before pitching client contracts.',
          sound: 'ERROR',
        };
      }
      if (prod.quality < ctr.requiredQuality) {
        return {
          state,
          feedback: vi
            ? `Khách hàng yêu cầu chất lượng sản phẩm ${ctr.requiredQuality}+ (hiện tại ${Math.round(prod.quality)}).`
            : `Client requires product quality ${ctr.requiredQuality}+ (currently ${Math.round(prod.quality)}).`,
          sound: 'ERROR',
        };
      }
      if (!ctr.legalReviewed) {
        return {
          state,
          feedback: vi
            ? 'Hợp đồng cần được Phòng pháp chế thẩm định trước khi ký.'
            : 'Contract must clear Legal Department review before signing.',
          sound: 'ERROR',
        };
      }
      const salesBoost = state.employees
        .filter((e) => e.role === 'SALES_REP' && e.assignedTask === 'CLOSE_SALES')
        .reduce(
          (acc, e) =>
            acc +
            e.skills.sales * 0.002 +
            (e.traits?.includes('PERSUASIVE_NEGOTIATOR') ? 0.25 : 0),
          1
        );
      const meetLvlBonus = 1 + ((state.office.rooms.MEETING_ROOM?.level ?? 1) - 1) * 0.06;
      const finalBonus = Math.round(ctr.upfrontBonus * salesBoost * meetLvlBonus);
      ctr.status = 'ACTIVE';
      state.finance.cash += finalBonus;
      state.finance.currentMonthRevenue += finalBonus;
      state.finance.currentMonthContractRev += finalBonus;
      state.finance.cumulativeRevenue += finalBonus;
      state.founder.reputation = clamp(state.founder.reputation + 5, 0, 100);
      addNotification(
        state,
        vi
          ? `Đã ký với ${ctr.clientName} (${formatCurrency(ctr.monthlyValue, false, locale)}/tháng + ${formatCurrency(finalBonus, false, locale)} trả trước)!`
          : `Signed ${ctr.clientName} (${formatCurrency(ctr.monthlyValue, false, locale)}/mo + ${formatCurrency(finalBonus, false, locale)} upfront)!`,
        'SUCCESS'
      );
      checkMilestones(state);
      return {
        state,
        feedback: vi
          ? `Đã ký hợp đồng với ${ctr.clientName}!`
          : `Contract signed with ${ctr.clientName}!`,
        sound: 'CASH',
      };
    }

    case 'BUY_FURNITURE': {
      const tpl = FURNITURE_CATALOG.find((f) => f.templateId === cmd.templateId);
      if (!tpl) return { state };
      const furnName = getFurnitureLocalized(tpl.templateId, tpl.name, tpl.description, locale).name;
      const placement = canPlaceFurnitureAt(state.office, cmd.tile, tpl.width, tpl.height);
      if (!placement.valid || !placement.roomId) {
        return {
          state,
          feedback:
            placement.reason ??
            (vi ? 'Không thể đặt nội thất tại ô sàn này.' : 'Cannot place furniture on that tile.'),
          sound: 'ERROR',
        };
      }
      if (state.finance.cash < tpl.cost) {
        return {
          state,
          feedback: vi
            ? `Cần ${formatCurrency(tpl.cost, false, locale)} để mua ${furnName}.`
            : `Need ${formatCurrency(tpl.cost, false, locale)} for ${furnName}.`,
          sound: 'ERROR',
        };
      }
      state.finance.cash -= tpl.cost;
      state.finance.currentMonthDevCosts += tpl.cost;
      state.office.furniture.push({
        id: `furn_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        templateId: tpl.templateId,
        name: tpl.name,
        roomId: placement.roomId,
        tile: cmd.tile,
        width: tpl.width,
        height: tpl.height,
        tier: 1,
        interactiveAction: tpl.interactiveAction,
        comfortBonus: tpl.comfortBonus,
        productivityBonus: tpl.productivityBonus,
      });
      state.office.comfortScore = clamp(state.office.comfortScore + tpl.comfortBonus, 20, 100);
      addNotification(
        state,
        vi ? `Đã mua ${furnName} cho văn phòng.` : `Purchased ${furnName} for the office.`,
        'SUCCESS'
      );
      return {
        state,
        feedback: vi ? `Đã đặt ${furnName}!` : `Placed ${furnName}!`,
        sound: 'SUCCESS',
      };
    }

    case 'MOVE_FURNITURE': {
      const item = state.office.furniture.find((f) => f.id === cmd.furnitureId);
      if (!item) return { state };
      const furnName = getFurnitureLocalized(item.templateId, item.name, '', locale).name;
      const placement = canPlaceFurnitureAt(
        state.office,
        cmd.tile,
        item.width,
        item.height,
        item.id
      );
      if (!placement.valid || !placement.roomId) {
        return {
          state,
          feedback:
            placement.reason ??
            (vi ? 'Không thể di chuyển nội thất tới vị trí đó.' : 'Cannot move furniture to that tile.'),
          sound: 'ERROR',
        };
      }
      item.tile = { ...cmd.tile };
      item.roomId = placement.roomId;
      return {
        state,
        feedback: vi ? `Đã di chuyển ${furnName}.` : `Moved ${furnName}.`,
        sound: 'CLICK',
      };
    }

    case 'UPGRADE_WORKSTATIONS': {
      if (state.office.techTier >= 4) {
        return {
          state,
          feedback: vi
            ? 'Thiết bị bàn làm việc đã đạt cấp tối đa.'
            : 'Workstations are already at maximum tier.',
          sound: 'ERROR',
        };
      }
      const cost = state.office.techTier * 3500;
      if (state.finance.cash < cost) {
        return {
          state,
          feedback: vi
            ? `Cần ${formatCurrency(cost, false, locale)} để nâng cấp máy tính.`
            : `Need ${formatCurrency(cost, false, locale)} to upgrade computers.`,
          sound: 'ERROR',
        };
      }
      state.finance.cash -= cost;
      state.finance.currentMonthDevCosts += cost;
      state.office.techTier += 1;
      addNotification(
        state,
        vi
          ? `Đã nâng cấp toàn bộ máy tính lên Cấp ${state.office.techTier} (+10% hiệu suất đội ngũ).`
          : `Upgraded all office computers to Tier ${state.office.techTier} (+10% team output).`,
        'SUCCESS'
      );
      return {
        state,
        feedback: vi
          ? `Đã nâng cấp bàn làm việc lên Cấp ${state.office.techTier}!`
          : `Workstations upgraded to Tier ${state.office.techTier}!`,
        sound: 'LEVEL_UP',
      };
    }

    case 'BUY_OFFICE_PERK': {
      const perk = OFFICE_PERKS.find((p) => p.id === cmd.perkId);
      if (!perk) return { state };
      const perkName = getPerkLocalized(perk.id, locale).name;
      if (!Array.isArray(state.office.purchasedPerks)) {
        state.office.purchasedPerks = [];
      }
      if (state.office.purchasedPerks.includes(perk.id)) {
        return {
          state,
          feedback: vi ? `${perkName} đã được lắp đặt.` : `${perkName} is already installed.`,
          sound: 'ERROR',
        };
      }
      if (state.office.level < perk.minOfficeLevel) {
        return {
          state,
          feedback: vi
            ? `Cần Trụ sở Cấp ${perk.minOfficeLevel} để mở khóa ${perkName}.`
            : `Requires Level ${perk.minOfficeLevel} HQ to unlock ${perkName}.`,
          sound: 'ERROR',
        };
      }
      if (state.finance.cash < perk.cost) {
        return {
          state,
          feedback: vi
            ? `Cần ${formatCurrency(perk.cost, false, locale)} để lắp đặt ${perkName}.`
            : `Need ${formatCurrency(perk.cost, false, locale)} to purchase ${perkName}.`,
          sound: 'ERROR',
        };
      }
      state.finance.cash -= perk.cost;
      state.finance.currentMonthDevCosts += perk.cost;
      state.office.purchasedPerks.push(perk.id);
      syncPurchasedPerkFurniture(state.office);
      state.office.comfortScore = clamp(state.office.comfortScore + perk.comfortBonus, 20, 100);
      state.employees.forEach((emp) => {
        emp.morale = clamp(emp.morale + 3, 0, 100);
      });
      addNotification(
        state,
        vi ? `Đã lắp đặt tiện ích văn phòng: ${perkName}.` : `Installed office perk: ${perkName}.`,
        'SUCCESS'
      );
      return {
        state,
        feedback: vi ? `Đã lắp đặt ${perkName}!` : `Installed ${perkName}!`,
        sound: 'SUCCESS',
      };
    }

    case 'EXPAND_OFFICE': {
      if (state.office.level >= 4) {
        return {
          state,
          feedback: vi
            ? 'Trụ sở công ty đã đạt quy mô tối đa Cấp 4!'
            : 'Headquarters is already at maximum Level 4!',
          sound: 'ERROR',
        };
      }
      const nextLvl = (state.office.level + 1) as 2 | 3 | 4;
      const spec = OFFICE_LEVELS[nextLvl];
      const lvlName = getOfficeLevelLocalized(nextLvl, locale).name;
      if (state.finance.cash < spec.upgradeCost) {
        return {
          state,
          feedback: vi
            ? `Cần ${formatCurrency(spec.upgradeCost, false, locale)} để mở rộng lên ${lvlName}.`
            : `Need ${formatCurrency(spec.upgradeCost, false, locale)} to expand to ${lvlName}.`,
          sound: 'ERROR',
        };
      }
      state.finance.cash -= spec.upgradeCost;
      state.finance.currentMonthDevCosts += spec.upgradeCost;
      state.office.level = nextLvl;
      state.office.name = spec.name;
      state.office.monthlyRent = spec.monthlyRent;
      state.office.maxEmployees = spec.maxEmployees;
      state.office.comfortScore = clamp(state.office.comfortScore + 10, 20, 100);
      state.founder.reputation = clamp(state.founder.reputation + 8, 0, 100);
      addNotification(
        state,
        vi
          ? `Đã mở rộng trụ sở lên ${lvlName} (tối đa ${spec.maxEmployees} nhân sự)!`
          : `Expanded HQ to ${lvlName} (max ${spec.maxEmployees} staff)!`,
        'SUCCESS'
      );
      generateEmployeeChatterForContext(state, 'OFFICE_EXPANDED');
      checkMilestones(state);
      queueMilestoneCelebration(state, {
        id: `celebrate_hq_lvl_${nextLvl}`,
        kind: 'HQ_EXPANSION',
        targetRoomId: state.office.rooms.MEETING_ROOM?.unlocked ? 'MEETING_ROOM' : 'ENGINEERING',
        subjectName: lvlName,
        detailValue: nextLvl,
      });
      return {
        state,
        feedback: vi ? `Chào mừng đến ${lvlName}!` : `Welcome to ${lvlName}!`,
        sound: 'MILESTONE_CHIME',
      };
    }

    case 'UNLOCK_ROOM': {
      const room = state.office.rooms[cmd.roomId];
      if (!room) return { state };
      const rName = getRoomLocalized(room.id, room.unlockCost, locale).name;
      if (!room.unlocked) {
        if (state.finance.cash < room.unlockCost) {
          return {
            state,
            feedback: vi
              ? `Cần ${formatCurrency(room.unlockCost, false, locale)} để mở khóa ${rName}.`
              : `Need ${formatCurrency(room.unlockCost, false, locale)} to unlock ${rName}.`,
            sound: 'ERROR',
          };
        }
        state.finance.cash -= room.unlockCost;
        state.finance.currentMonthDevCosts += room.unlockCost;
        room.unlocked = true;
        addNotification(
          state,
          vi ? `Đã mở khóa ${rName}!` : `Unlocked ${rName}!`,
          'SUCCESS'
        );
        queueMilestoneCelebration(state, {
          id: `celebrate_room_${room.id}`,
          kind: 'DEPARTMENT_EXPANSION',
          targetRoomId: room.id,
          subjectName: room.id,
        });
        return {
          state,
          feedback: vi ? `Đã mở khóa ${rName}!` : `Unlocked ${rName}!`,
          sound: 'MILESTONE_CHIME',
        };
      } else {
        if (room.level >= 3) {
          return {
            state,
            feedback: vi ? 'Phòng đã đạt cấp tối đa.' : 'Room already max level.',
            sound: 'ERROR',
          };
        }
        if (state.finance.cash < room.upgradeCost) {
          return {
            state,
            feedback: vi
              ? `Cần ${formatCurrency(room.upgradeCost, false, locale)}.`
              : `Need ${formatCurrency(room.upgradeCost, false, locale)}.`,
            sound: 'ERROR',
          };
        }
        state.finance.cash -= room.upgradeCost;
        state.finance.currentMonthDevCosts += room.upgradeCost;
        room.level += 1;
        room.upgradeCost = Math.round(room.upgradeCost * 1.6);
        state.office.comfortScore = clamp(state.office.comfortScore + 5, 20, 100);
        addNotification(
          state,
          vi ? `Đã nâng cấp ${rName} lên Cấp ${room.level}.` : `Upgraded ${rName} to Level ${room.level}.`,
          'SUCCESS'
        );
      }
      return { state, sound: 'LEVEL_UP' };
    }

    case 'TAKE_LOAN': {
      const available = state.finance.creditLimit - state.finance.totalDebt;
      const amt = Math.min(cmd.amount, available);
      if (amt <= 0) {
        return {
          state,
          feedback: vi ? 'Đã chạm hạn mức tín dụng.' : 'Credit limit reached.',
          sound: 'ERROR',
        };
      }
      state.finance.totalDebt += amt;
      state.finance.cash += amt;
      addNotification(
        state,
        vi
          ? `Đã rút ${formatCurrency(amt, false, locale)} từ hạn mức tín dụng doanh nghiệp.`
          : `Drew ${formatCurrency(amt, false, locale)} from business credit line.`,
        'WARNING'
      );
      return {
        state,
        feedback: vi
          ? `Đã nhận khoản vay ${formatCurrency(amt, false, locale)}.`
          : `Received ${formatCurrency(amt, false, locale)} loan.`,
        sound: 'CASH',
      };
    }

    case 'REPAY_LOAN': {
      const amt = Math.min(cmd.amount, state.finance.totalDebt, Math.max(0, state.finance.cash));
      if (amt <= 0) {
        return {
          state,
          feedback: vi
            ? 'Không có dư nợ hoặc tiền mặt chưa đủ.'
            : 'No payable debt or insufficient cash.',
          sound: 'ERROR',
        };
      }
      state.finance.totalDebt -= amt;
      state.finance.cash -= amt;
      addNotification(
        state,
        vi
          ? `Đã trả ${formatCurrency(amt, false, locale)} dư nợ tín dụng.`
          : `Repaid ${formatCurrency(amt, false, locale)} of credit debt.`,
        'SUCCESS'
      );
      return {
        state,
        feedback: vi
          ? `Đã trả nợ ${formatCurrency(amt, false, locale)}.`
          : `Repaid ${formatCurrency(amt, false, locale)}.`,
        sound: 'CASH',
      };
    }

    case 'SET_FOUNDER_SALARY': {
      const amount = clamp(Math.round(cmd.amount), MIN_FOUNDER_SALARY, MAX_FOUNDER_SALARY);
      state.founder.monthlySalary = amount;
      const profile = getFounderSalaryProfile(amount, state.finance.cash);
      addNotification(
        state,
        vi
          ? `Lương nhà sáng lập đặt ở mức ${formatCurrency(amount, false, locale)}/tháng (${profile.label}).`
          : `Founder salary set to ${formatCurrency(amount, false, locale)}/mo (${profile.label}).`,
        profile.tier === 'HIGH' || profile.tier === 'LAVISH' ? 'WARNING' : 'INFO'
      );
      return {
        state,
        feedback: vi
          ? `Lương CEO: ${formatCurrency(amount, false, locale)}/tháng (${profile.label})`
          : `Founder salary: ${formatCurrency(amount, false, locale)}/mo (${profile.label})`,
        sound: 'CLICK',
      };
    }

    case 'INJECT_PERSONAL_CASH': {
      const available = Math.max(0, Math.floor(state.founder.personalCash ?? 0));
      const amt = Math.min(Math.max(0, Math.round(cmd.amount)), available);
      if (amt <= 0) {
        return {
          state,
          feedback: vi
            ? 'Tiền mặt cá nhân không đủ để góp thêm vốn.'
            : 'Insufficient personal cash to inject.',
          sound: 'ERROR',
        };
      }
      state.founder.personalCash = available - amt;
      state.finance.cash += amt;
      state.founder.investorTrust = clamp((state.founder.investorTrust ?? 55) + 2, 0, 100);
      addNotification(
        state,
        vi
          ? `Đã góp ${formatCurrency(amt, false, locale)} từ tiền cá nhân vào quỹ công ty.`
          : `Injected ${formatCurrency(amt, false, locale)} from personal savings into company cash.`,
        'SUCCESS'
      );
      return {
        state,
        feedback: vi
          ? `Đã góp ${formatCurrency(amt, false, locale)} vốn cá nhân!`
          : `Injected ${formatCurrency(amt, false, locale)} personal funds!`,
        sound: 'CASH',
      };
    }

    case 'RESOLVE_EVENT': {
      const msg = resolveActiveEvent(state, cmd.choiceId);
      generateEmployeeChatterForContext(state, 'EVENT');
      checkMilestones(state);
      return { state, feedback: msg, sound: 'CLICK' };
    }

    case 'DISMISS_MONTHLY_REPORT': {
      state.pendingMonthlyReport = null;
      return { state, sound: 'CLICK' };
    }

    case 'DISMISS_DAILY_REPORT': {
      state.pendingDailyReport = null;
      return { state, sound: 'CLICK' };
    }

    case 'REPORT_TUTORIAL_ACTION': {
      if (!state.tutorial) break;
      state.tutorial.manualHoldStep = null;
      if (cmd.action === 'REVIEW_EMPLOYEE') {
        state.tutorial.reviewedEmployee = true;
      } else if (cmd.action === 'EXPLORE_ROOM') {
        if (cmd.roomId === 'CEO_OFFICE') state.tutorial.exploredCeoOffice = true;
        if (cmd.roomId === 'ENGINEERING') state.tutorial.exploredEngineering = true;
      } else if (cmd.action === 'REVIEW_FINANCE') {
        state.tutorial.reviewedFinances = true;
      }
      return { state };
    }

    case 'SKIP_TUTORIAL': {
      if (state.tutorial) {
        state.tutorial.active = false;
        state.tutorial.skipped = true;
        state.tutorial.manualHoldStep = null;
      }
      return {
        state,
        feedback: vi
          ? 'Đã bỏ qua hướng dẫn. Bạn có thể mở lại bất cứ lúc nào trong menu.'
          : 'Tutorial skipped. You can reopen it anytime from the menu.',
        sound: 'CLICK',
      };
    }

    case 'RESUME_TUTORIAL': {
      if (state.tutorial?.completed) {
        state.tutorial = {
          ...createInitialTutorialState(),
          restartAnchorDay: state.totalDays,
        };
      } else if (state.tutorial) {
        state.tutorial.active = true;
        state.tutorial.skipped = false;
        state.tutorial.completed = false;
        state.tutorial.instructionsOpen = true;
        state.tutorial.manualHoldStep = null;
      }
      return { state, sound: 'CLICK' };
    }

    case 'TUTORIAL_BACK': {
      if (state.tutorial && state.tutorial.currentStep > 1) {
        const prevStep = (state.tutorial.currentStep - 1) as TutorialStepId;
        state.tutorial.currentStep = prevStep;
        state.tutorial.manualHoldStep = prevStep;
      }
      return { state, sound: 'CLICK' };
    }

    case 'TUTORIAL_NEXT': {
      if (state.tutorial) {
        state.tutorial.manualHoldStep = null;
      }
      return { state, sound: 'CLICK' };
    }

    case 'TOGGLE_TUTORIAL_INSTRUCTIONS': {
      if (state.tutorial) {
        state.tutorial.instructionsOpen =
          cmd.open !== undefined ? cmd.open : !state.tutorial.instructionsOpen;
      }
      return { state };
    }

    case 'COMPLETE_CINEMATIC': {
      completeActiveCinematic(state, cmd.cinematicId, Boolean(cmd.skipped));
      return { state, sound: 'CLICK' };
    }

    case 'RESOLVE_STORY_EVENT': {
      const outcome = resolveStoryEventChoice(state, cmd.choiceId);
      return {
        state,
        feedback: outcome.feedback,
        sound: outcome.sound,
      };
    }

    case 'TRIGGER_ENDING_EVALUATION': {
      triggerEvaluatedEnding(state);
      return { state, sound: 'LEVEL_UP' };
    }

    case 'CONTINUE_SANDBOX': {
      state.sandboxContinued = true;
      if (state.story) {
        state.story.activeCinematic = null;
      }
      state.screen = 'PLAYING';
      return { state, sound: 'SUCCESS' };
    }

    case 'DISMISS_CELEBRATION': {
      dismissActiveCelebration(state);
      return { state, sound: 'CLICK' };
    }

    case 'WORLD_COFFEE_BREAK': {
      const res = handleWorldCoffeeBreak(state);
      if (res.sound !== 'ERROR') addNotification(state, res.feedback, 'INFO');
      return { state, feedback: res.feedback, sound: res.sound };
    }

    case 'WORLD_INTERACT_NPC': {
      const res = handleWorldInteractNpc(state, cmd.npcId);
      if (res.sound !== 'ERROR') addNotification(state, res.feedback, 'SUCCESS');
      return { state, feedback: res.feedback, sound: res.sound };
    }

    case 'WORLD_PITCH_INVESTOR': {
      const res = handleWorldPitchInvestor(state);
      if (res.sound !== 'ERROR') addNotification(state, res.feedback, 'SUCCESS');
      return { state, feedback: res.feedback, sound: res.sound };
    }

    case 'WORLD_HOST_EVENT': {
      const res = handleWorldHostEvent(state);
      if (res.sound !== 'ERROR') addNotification(state, res.feedback, 'SUCCESS');
      return { state, feedback: res.feedback, sound: res.sound };
    }

    case 'WORLD_BUY_PROPERTY': {
      const res = handleWorldBuyProperty(state, cmd.propertyId);
      if (res.sound !== 'ERROR') addNotification(state, res.feedback, 'SUCCESS');
      return { state, feedback: res.feedback, sound: res.sound };
    }

    case 'CYCLE_WEATHER': {
      const next = cycleWeatherState(state);
      const label = vi
        ? next.current === 'SUNNY'
          ? 'Nắng ấm'
          : next.current === 'OVERCAST'
            ? 'Nhiều mây'
            : 'Mưa nhẹ'
        : next.current === 'SUNNY'
          ? 'Sunny'
          : next.current === 'OVERCAST'
            ? 'Overcast'
            : 'Rainy';
      return {
        state,
        feedback: vi
          ? `Thời tiết toàn cầu: ${label}${next.autoCycle ? ' (Tự động)' : ''}.`
          : `Global weather: ${label}${next.autoCycle ? ' (Auto)' : ''}.`,
        sound: 'CLICK',
      };
    }

    case 'SET_WEATHER': {
      const next = setWeatherState(state, cmd.weather);
      const label = vi
        ? next.current === 'SUNNY'
          ? 'Nắng ấm'
          : next.current === 'OVERCAST'
            ? 'Nhiều mây'
            : 'Mưa nhẹ'
        : next.current === 'SUNNY'
          ? 'Sunny'
          : next.current === 'OVERCAST'
            ? 'Overcast'
            : 'Rainy';
      return {
        state,
        feedback: vi
          ? `Thời tiết toàn cầu: ${label}${next.autoCycle ? ' (Tự động)' : ''}.`
          : `Global weather: ${label}${next.autoCycle ? ' (Auto)' : ''}.`,
        sound: 'CLICK',
      };
    }

    default:
      return { state };
  }
  return { state };
}
