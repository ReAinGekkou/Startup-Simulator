import {
  GameState,
  MilestoneCelebration,
  MilestoneCelebrationKind,
  RoomId,
} from '@/src/types/game';

export const CELEBRATION_DURATION_SEC = 5.6;

export interface QueueCelebrationParams {
  id: string;
  kind: MilestoneCelebrationKind;
  targetRoomId: RoomId;
  subjectName: string;
  detailValue?: string | number;
  durationSec?: number;
}

export function canShowOfficeCelebration(state: GameState): boolean {
  if (state.screen !== 'PLAYING') return false;
  if (state.activeEvent !== null) return false;
  if (state.pendingDailyReport !== null) return false;
  if (state.pendingMonthlyReport !== null) return false;
  if (state.story?.activeCinematic !== null && state.story?.activeCinematic !== undefined) {
    return false;
  }
  if (state.story?.activeStoryEvent !== null && state.story?.activeStoryEvent !== undefined) {
    return false;
  }
  return true;
}

export function ensureCelebrationFields(state: GameState): void {
  if (state.activeCelebration === undefined) {
    state.activeCelebration = null;
  }
  if (!Array.isArray(state.celebrationQueue)) {
    state.celebrationQueue = [];
  }
  if (!Array.isArray(state.seenCelebrationIds)) {
    state.seenCelebrationIds = [];
  }
}

export function queueMilestoneCelebration(
  state: GameState,
  params: QueueCelebrationParams
): boolean {
  ensureCelebrationFields(state);

  if (state.seenCelebrationIds.includes(params.id)) {
    return false;
  }
  if (
    state.activeCelebration?.id === params.id ||
    state.celebrationQueue.some((c) => c.id === params.id)
  ) {
    return false;
  }

  const durationSec = Math.max(2.5, params.durationSec ?? CELEBRATION_DURATION_SEC);
  const item: MilestoneCelebration = {
    id: params.id,
    kind: params.kind,
    targetRoomId: params.targetRoomId,
    subjectName: params.subjectName,
    detailValue: params.detailValue,
    triggeredDay: state.totalDays,
    durationSec,
    remainingSec: durationSec,
  };

  state.seenCelebrationIds.push(params.id);
  state.celebrationQueue.push(item);
  if (state.celebrationQueue.length > 6) {
    state.celebrationQueue = state.celebrationQueue.slice(-6);
  }

  syncCelebrationState(state, 0);
  return true;
}

export function syncCelebrationState(
  state: GameState,
  dtSec: number
): { started: MilestoneCelebration | null; finished: boolean } {
  ensureCelebrationFields(state);

  let finished = false;
  let started: MilestoneCelebration | null = null;
  const visible = canShowOfficeCelebration(state);

  if (state.activeCelebration && !visible) {
    state.celebrationQueue.unshift(state.activeCelebration);
    state.activeCelebration = null;
    return { started: null, finished: false };
  }

  if (state.activeCelebration && visible && dtSec > 0) {
    state.activeCelebration.remainingSec = Math.max(
      0,
      state.activeCelebration.remainingSec - dtSec
    );
    if (state.activeCelebration.remainingSec <= 0) {
      state.activeCelebration = null;
      finished = true;
    }
  }

  if (!state.activeCelebration && state.celebrationQueue.length > 0 && visible) {
    const next = state.celebrationQueue.shift() ?? null;
    if (next) {
      state.activeCelebration = next;
      started = next;
    }
  }

  return { started, finished };
}

export function dismissActiveCelebration(state: GameState): boolean {
  ensureCelebrationFields(state);
  if (!state.activeCelebration) return false;
  state.activeCelebration = null;
  syncCelebrationState(state, 0);
  return true;
}
