import { LocaleCode, t } from '@/src/localization';
import { Employee, GameState } from '@/src/types/game';

export const MORALE_ALERT_THRESHOLD = 45;
export const MORALE_CRITICAL_THRESHOLD = 28;
export const MORALE_GLOBAL_COOLDOWN_DAYS = 1;
export const MORALE_EMPLOYEE_COOLDOWN_DAYS = 3;
export const MORALE_REALTIME_COOLDOWN_MS = 18000;

export interface MoraleNotificationTracker {
  lastToastDay: number;
  lastToastAtMs: number;
  employeeLastAlertDay: Record<string, number>;
  lastEvaluatedHourKey: string | null;
}

export interface MoraleNotification {
  employeeId: string;
  employeeName: string;
  morale: number;
  title: string;
  suggestion: string;
  actionLabel: string;
  critical: boolean;
}

export function createMoraleNotificationTracker(): MoraleNotificationTracker {
  return {
    lastToastDay: -999,
    lastToastAtMs: -MORALE_REALTIME_COOLDOWN_MS,
    employeeLastAlertDay: {},
    lastEvaluatedHourKey: null,
  };
}

function hashCheckpointRoll(
  seed: number,
  totalDays: number,
  hourSlot: number,
  employeeId: string
): number {
  let h = (seed ^ (totalDays * 2654435761) ^ (hourSlot * 2246822519)) >>> 0;
  for (let i = 0; i < employeeId.length; i++) {
    h = Math.imul(h ^ employeeId.charCodeAt(i), 16777619) >>> 0;
  }
  return (h % 1000) / 1000;
}

export function findLowestMoraleCandidate(
  employees: Employee[],
  totalDays: number,
  tracker: MoraleNotificationTracker
): Employee | null {
  const eligible = employees.filter((emp) => {
    if (emp.morale >= MORALE_ALERT_THRESHOLD) return false;
    if (emp.assignedTask === 'REST_BREAK') return false;
    const lastAlertDay = tracker.employeeLastAlertDay[emp.id] ?? -999;
    return totalDays - lastAlertDay >= MORALE_EMPLOYEE_COOLDOWN_DAYS;
  });

  if (eligible.length === 0) return null;

  eligible.sort((a, b) => {
    if (a.morale !== b.morale) return a.morale - b.morale;
    if (a.stress !== b.stress) return b.stress - a.stress;
    return a.id.localeCompare(b.id);
  });

  return eligible[0];
}

export function evaluateMoraleNotification(
  state: GameState,
  tracker: MoraleNotificationTracker,
  locale: LocaleCode,
  nowMs = Date.now()
): MoraleNotification | null {
  if (state.screen !== 'PLAYING' || state.employees.length === 0) {
    return null;
  }
  if (state.activeEvent || state.pendingDailyReport || state.pendingMonthlyReport) {
    return null;
  }

  const hourSlot = Math.floor(state.hourOfDay);
  const hourKey = `${state.totalDays}:${hourSlot}`;
  if (tracker.lastEvaluatedHourKey === hourKey) {
    return null;
  }
  tracker.lastEvaluatedHourKey = hourKey;

  // Cooldown gates prevent repetitive toast spam across days and speed levels
  if (state.totalDays - tracker.lastToastDay < MORALE_GLOBAL_COOLDOWN_DAYS) {
    return null;
  }
  if (nowMs - tracker.lastToastAtMs < MORALE_REALTIME_COOLDOWN_MS) {
    return null;
  }

  const candidate = findLowestMoraleCandidate(state.employees, state.totalDays, tracker);
  if (!candidate) {
    return null;
  }

  const critical = candidate.morale <= MORALE_CRITICAL_THRESHOLD;
  if (!critical) {
    const roll = hashCheckpointRoll(state.seed, state.totalDays, hourSlot, candidate.id);
    if (roll >= 0.35) {
      return null;
    }
  }

  tracker.lastToastDay = state.totalDays;
  tracker.lastToastAtMs = nowMs;
  tracker.employeeLastAlertDay[candidate.id] = state.totalDays;

  const roundedMorale = Math.round(candidate.morale);
  return {
    employeeId: candidate.id,
    employeeName: candidate.name,
    morale: roundedMorale,
    title: t('employees.moraleAlert.title', { name: candidate.name, morale: roundedMorale }, locale),
    suggestion: t('employees.moraleAlert.suggestion', undefined, locale),
    actionLabel: t('employees.moraleAlert.actionBtn', undefined, locale),
    critical,
  };
}
