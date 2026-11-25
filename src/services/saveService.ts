import { createInitialAchievements } from '@/src/game/data/achievements';
import { createInitialRooms } from '@/src/game/data/officeLayout';
import { syncPurchasedPerkFurniture } from '@/src/game/engine/pathfinding';
import { evaluateEmployeeTraits } from '@/src/game/systems/employeeSystem';
import { migrateLegacyStoryState } from '@/src/game/systems/chapterProgression';
import { ensureOpenWorldState } from '@/src/game/systems/openWorldSystem';
import { ensureWeatherState } from '@/src/game/systems/weatherSystem';
import {
  createInitialObjectives,
  createInitialTutorialState,
  syncTutorialAndObjectives,
} from '@/src/game/systems/tutorialSystem';
import { GameState, RoomId, SaveSlotMeta } from '@/src/types/game';

export const CURRENT_SAVE_VERSION = 1;
const SAVE_PREFIX = 'startup_founder_save_v1_';
const AUTOSAVE_KEY = `${SAVE_PREFIX}autosave`;
const SLOTS = ['slot_1', 'slot_2', 'slot_3'];

export interface SaveEnvelope {
  version: number;
  savedAt: number;
  label: string;
  state: GameState;
}

export function validateSaveState(raw: unknown): GameState | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<GameState>;
  if (
    typeof s.day !== 'number' ||
    typeof s.month !== 'number' ||
    typeof s.year !== 'number' ||
    !s.config ||
    !s.founder ||
    typeof s.founder.energy !== 'number' ||
    !s.finance ||
    typeof s.finance.cash !== 'number' ||
    !s.office ||
    !s.office.rooms ||
    !Array.isArray(s.employees) ||
    !Array.isArray(s.products) ||
    !Array.isArray(s.milestones) ||
    !Array.isArray(s.contracts)
  ) {
    return null;
  }
  return migrateSaveState(s as GameState);
}

export function migrateSaveState(state: GameState): GameState {
  const defaultAchievements = createInitialAchievements();
  const savedMap = new Map(
    Array.isArray(state.achievements) ? state.achievements.map((a) => [a.id, a]) : []
  );
  const mergedAchievements = defaultAchievements.map((def) => {
    const saved = savedMap.get(def.id);
    return saved
      ? { ...def, unlocked: Boolean(saved.unlocked), unlockedDay: saved.unlockedDay ?? null }
      : def;
  });

  const derivedRoles = Array.from(
    new Set([
      ...(Array.isArray(state.hiredRolesHistory) ? state.hiredRolesHistory : []),
      ...state.employees.map((e) => e.role),
    ])
  );

  const historicalExpenses = Array.isArray(state.monthlyHistory)
    ? state.monthlyHistory.reduce((sum, r) => sum + (r.expenses ?? 0), 0)
    : 0;

  const defaultRooms = createInitialRooms();
  const mergedRooms = { ...state.office.rooms };
  (Object.keys(defaultRooms) as RoomId[]).forEach((rId) => {
    const existing = state.office.rooms[rId];
    mergedRooms[rId] = existing
      ? { ...defaultRooms[rId], ...existing, unlockCondition: existing.unlockCondition ?? defaultRooms[rId].unlockCondition }
      : defaultRooms[rId];
  });

  const migratedOffice = {
    ...state.office,
    rooms: mergedRooms,
    purchasedPerks: Array.isArray(state.office.purchasedPerks) ? state.office.purchasedPerks : [],
    furniture: [...state.office.furniture],
  };
  syncPurchasedPerkFurniture(migratedOffice);

  const migratedEmployees = state.employees.map((emp) => {
    const copy = {
      ...emp,
      traits: Array.isArray(emp.traits) ? [...emp.traits] : [],
    };
    evaluateEmployeeTraits(copy);
    return copy;
  });

  const defaultTutorial = createInitialTutorialState();
  const isLegacyEstablished = !state.tutorial && state.totalDays > 1;
  const migratedTutorial = state.tutorial
    ? { ...defaultTutorial, ...state.tutorial }
    : {
        ...defaultTutorial,
        active: !isLegacyEstablished,
        completed: isLegacyEstablished,
        endedFirstDay: isLegacyEstablished,
      };

  const defaultObjectives = createInitialObjectives();
  const objMap = new Map(
    Array.isArray(state.objectives) ? state.objectives.map((o) => [o.id, o]) : []
  );
  const migratedObjectives = defaultObjectives.map((def) => {
    const saved = objMap.get(def.id);
    return saved ? { ...def, completed: Boolean(saved.completed), completedDay: saved.completedDay ?? null } : def;
  });

  const migrated: GameState = {
    ...state,
    version: CURRENT_SAVE_VERSION,
    founder: {
      ...state.founder,
      monthlySalary: state.founder.monthlySalary ?? 1500,
      personalCash: state.founder.personalCash ?? 2500,
      investorTrust: state.founder.investorTrust ?? 55,
    },
    employees: migratedEmployees,
    chatterFeed: Array.isArray(state.chatterFeed) ? state.chatterFeed : [],
    achievements: mergedAchievements,
    hiredRolesHistory: derivedRoles,
    monthlyHistory: Array.isArray(state.monthlyHistory)
      ? state.monthlyHistory.map((r) => ({ ...r, founderSalary: r.founderSalary ?? 0 }))
      : [],
    pendingMonthlyReport: state.pendingMonthlyReport
      ? { ...state.pendingMonthlyReport, founderSalary: state.pendingMonthlyReport.founderSalary ?? 0 }
      : null,
    pendingDailyReport: state.pendingDailyReport ?? null,
    tutorial: migratedTutorial,
    objectives: migratedObjectives,
    story: migrateLegacyStoryState(state),
    activeCelebration: state.activeCelebration ?? null,
    celebrationQueue: Array.isArray(state.celebrationQueue) ? state.celebrationQueue : [],
    seenCelebrationIds: Array.isArray(state.seenCelebrationIds) ? state.seenCelebrationIds : [],
    office: migratedOffice,
    finance: {
      ...state.finance,
      cumulativeExpenses: state.finance.cumulativeExpenses ?? historicalExpenses,
      currentMonthCustomersGained: state.finance.currentMonthCustomersGained ?? 0,
      currentMonthCustomersChurned: state.finance.currentMonthCustomersChurned ?? 0,
    },
  };
  syncTutorialAndObjectives(migrated);
  ensureOpenWorldState(migrated);
  ensureWeatherState(migrated);
  return migrated;
}

export function saveGameToSlot(slotId: string, state: GameState, label?: string): boolean {
  try {
    const key = slotId === 'autosave' ? AUTOSAVE_KEY : `${SAVE_PREFIX}${slotId}`;
    const envelope: SaveEnvelope = {
      version: CURRENT_SAVE_VERSION,
      savedAt: Date.now(),
      label: label ?? (slotId === 'autosave' ? 'Autosave' : `Save ${slotId.replace('slot_', '#')}`),
      state: { ...state, screen: 'PLAYING' },
    };
    localStorage.setItem(key, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

export function loadGameFromSlot(slotId: string): GameState | null {
  try {
    const key = slotId === 'autosave' ? AUTOSAVE_KEY : `${SAVE_PREFIX}${slotId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SaveEnvelope>;
    if (!parsed || !parsed.state) return null;
    return validateSaveState(parsed.state);
  } catch {
    return null;
  }
}

export function deleteSaveSlot(slotId: string): void {
  try {
    const key = slotId === 'autosave' ? AUTOSAVE_KEY : `${SAVE_PREFIX}${slotId}`;
    localStorage.removeItem(key);
  } catch {
    // ignore storage errors
  }
}

export function listSaveSlots(): Array<{ slotId: string; meta: SaveSlotMeta | null }> {
  const keys = ['autosave', ...SLOTS];
  return keys.map((slotId) => {
    try {
      const key = slotId === 'autosave' ? AUTOSAVE_KEY : `${SAVE_PREFIX}${slotId}`;
      const raw = localStorage.getItem(key);
      if (!raw) return { slotId, meta: null };
      const parsed = JSON.parse(raw) as SaveEnvelope;
      const valid = validateSaveState(parsed.state);
      if (!valid) return { slotId, meta: null };
      return {
        slotId,
        meta: {
          slotId,
          label: parsed.label,
          companyName: valid.config.companyName,
          founderName: valid.founder.name,
          day: valid.day,
          month: valid.month,
          year: valid.year,
          cash: valid.finance.cash,
          employeesCount: valid.employees.length,
          savedAt: parsed.savedAt,
          version: parsed.version,
        },
      };
    } catch {
      return { slotId, meta: null };
    }
  });
}

export function getMostRecentSaveMeta(): SaveSlotMeta | null {
  const valid = listSaveSlots()
    .map((s) => s.meta)
    .filter((m): m is SaveSlotMeta => m !== null);
  if (valid.length === 0) return null;
  valid.sort((a, b) => b.savedAt - a.savedAt);
  return valid[0];
}

export function loadMostRecentSave(): { slotId: string; state: GameState } | null {
  const latest = getMostRecentSaveMeta();
  if (!latest) return null;
  const loaded = loadGameFromSlot(latest.slotId);
  if (!loaded) return null;
  return { slotId: latest.slotId, state: loaded };
}

export function hasAnySavedGame(): boolean {
  return listSaveSlots().some((s) => s.meta !== null);
}
