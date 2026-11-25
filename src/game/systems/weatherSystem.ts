import { GameState, GlobalWeatherState, WeatherCycleState } from '@/src/types/game';

export type WeatherCondition = 'CLEAR' | 'SUNLIT' | 'CLOUDY' | 'RAIN';

export interface WeatherSnapshot {
  condition: WeatherCondition;
  /** High-level global weather state when computed from GameState */
  globalState?: GlobalWeatherState;
  /** Whether automatic time-based cycling is active */
  autoCycle?: boolean;
  /** Overall strength of active atmospheric cues (0..1) */
  intensity: number;
  /** Cozy rain shower intensity (0..1) */
  rainIntensity: number;
  /** Warm shifting sunlight beam intensity (0..1) */
  sunlightIntensity: number;
  /** Soft passing cloud / overcast tint intensity (0..1) */
  overcastIntensity: number;
}

export const GLOBAL_WEATHER_CYCLE: readonly GlobalWeatherState[] = [
  'SUNNY',
  'OVERCAST',
  'RAINY',
] as const;

export const WEATHER_CYCLE_HOURS = 6.5;

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function isValidGlobalWeather(val: unknown): val is GlobalWeatherState {
  return val === 'SUNNY' || val === 'OVERCAST' || val === 'RAINY';
}

function deterministicUnit(seed: number, day: number, period: number): number {
  let h =
    (Math.imul(Math.floor(seed) | 0, 374761393) +
      Math.imul(day | 0, 668265263) +
      Math.imul(period | 0, 1274126177)) |
    0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 10000) / 10000;
}

function pickConditionForPeriod(seed: number, totalDays: number, period: 0 | 1): WeatherCondition {
  const safeDay = Math.max(1, Math.floor(totalDays));
  if (safeDay === 1) {
    return period === 0 ? 'CLEAR' : 'SUNLIT';
  }
  const roll = deterministicUnit(seed, safeDay, period);
  if (roll < 0.36) return 'CLEAR';
  if (roll < 0.61) return 'SUNLIT';
  if (roll < 0.82) return 'CLOUDY';
  return 'RAIN';
}

function profileForCondition(condition: WeatherCondition): {
  rain: number;
  sunlight: number;
  overcast: number;
} {
  switch (condition) {
    case 'RAIN':
      return { rain: 0.85, sunlight: 0, overcast: 0.72 };
    case 'CLOUDY':
      return { rain: 0, sunlight: 0.08, overcast: 0.65 };
    case 'SUNLIT':
      return { rain: 0, sunlight: 0.88, overcast: 0 };
    case 'CLEAR':
    default:
      return { rain: 0, sunlight: 0.28, overcast: 0 };
  }
}

function profileForGlobalState(globalState: GlobalWeatherState): {
  condition: WeatherCondition;
  rain: number;
  sunlight: number;
  overcast: number;
} {
  switch (globalState) {
    case 'RAINY':
      return { condition: 'RAIN', rain: 0.95, sunlight: 0, overcast: 0.82 };
    case 'OVERCAST':
      return { condition: 'CLOUDY', rain: 0, sunlight: 0.08, overcast: 0.78 };
    case 'SUNNY':
    default:
      return { condition: 'SUNLIT', rain: 0, sunlight: 0.9, overcast: 0 };
  }
}

export function conditionToGlobalWeather(condition: WeatherCondition): GlobalWeatherState {
  if (condition === 'RAIN') return 'RAINY';
  if (condition === 'CLOUDY') return 'OVERCAST';
  return 'SUNNY';
}

/**
 * Computes a deterministic, smoothly blended atmospheric weather snapshot for the
 * current day and hour without mutating or migrating saved GameState schemas.
 */
export function getWeatherSnapshot(
  seed: number,
  totalDays: number,
  hourOfDay: number
): WeatherSnapshot {
  const safeHour = Number.isFinite(hourOfDay) ? hourOfDay : 9;
  const morningCond = pickConditionForPeriod(seed, totalDays, 0);
  const afternoonCond = pickConditionForPeriod(seed, totalDays, 1);

  // Smoothly cross-fade between morning (before 12.6) and afternoon (after 13.4)
  const blendStart = 12.6;
  const blendEnd = 13.4;
  const t = clamp01((safeHour - blendStart) / (blendEnd - blendStart));
  const smoothT = t * t * (3 - 2 * t);

  const mProf = profileForCondition(morningCond);
  const aProf = profileForCondition(afternoonCond);

  let rainIntensity = clamp01(mProf.rain + (aProf.rain - mProf.rain) * smoothT);
  let sunlightIntensity = clamp01(mProf.sunlight + (aProf.sunlight - mProf.sunlight) * smoothT);
  const overcastIntensity = clamp01(mProf.overcast + (aProf.overcast - mProf.overcast) * smoothT);

  // After dusk (17.5+), soften sunbeams gently as evening lamps turn on
  if (safeHour >= 17.0) {
    const duskFade = clamp01(1 - (safeHour - 17.0) / 1.0);
    sunlightIntensity *= duskFade;
  }

  // Slight natural rain modulation so showers aren't completely static
  if (rainIntensity > 0.05) {
    const pulse = 0.88 + 0.12 * Math.sin(safeHour * Math.PI * 1.5);
    rainIntensity = clamp01(rainIntensity * pulse);
  }

  const activeCond: WeatherCondition = smoothT >= 0.5 ? afternoonCond : morningCond;
  const intensity = clamp01(Math.max(rainIntensity, sunlightIntensity, overcastIntensity));

  return {
    condition: activeCond,
    globalState: conditionToGlobalWeather(activeCond),
    autoCycle: true,
    intensity,
    rainIntensity,
    sunlightIntensity,
    overcastIntensity,
  };
}

export function createInitialWeatherState(): WeatherCycleState {
  return {
    current: 'SUNNY',
    previous: 'SUNNY',
    transitionProgress: 1,
    autoCycle: true,
    hoursInState: 0,
    cycleCount: 0,
  };
}

export function ensureWeatherState(state: GameState): WeatherCycleState {
  const existing = state.weather;
  if (!existing || typeof existing !== 'object') {
    const created = createInitialWeatherState();
    state.weather = created;
    return created;
  }
  const current = isValidGlobalWeather(existing.current) ? existing.current : 'SUNNY';
  const previous = isValidGlobalWeather(existing.previous) ? existing.previous : current;
  const normalized: WeatherCycleState = {
    current,
    previous,
    transitionProgress:
      typeof existing.transitionProgress === 'number' && Number.isFinite(existing.transitionProgress)
        ? clamp01(existing.transitionProgress)
        : 1,
    autoCycle: typeof existing.autoCycle === 'boolean' ? existing.autoCycle : true,
    hoursInState:
      typeof existing.hoursInState === 'number' && Number.isFinite(existing.hoursInState)
        ? Math.max(0, existing.hoursInState)
        : 0,
    cycleCount:
      typeof existing.cycleCount === 'number' && Number.isFinite(existing.cycleCount)
        ? Math.max(0, Math.floor(existing.cycleCount))
        : 0,
  };
  state.weather = normalized;
  return normalized;
}

function getNextCycleWeather(current: GlobalWeatherState): GlobalWeatherState {
  const idx = GLOBAL_WEATHER_CYCLE.indexOf(current);
  return GLOBAL_WEATHER_CYCLE[(idx + 1) % GLOBAL_WEATHER_CYCLE.length];
}

export function advanceWeatherCycle(
  state: GameState,
  elapsedHours: number,
  dtSeconds: number
): WeatherCycleState {
  const w = ensureWeatherState(state);

  if (w.transitionProgress < 1 && dtSeconds > 0) {
    w.transitionProgress = clamp01(w.transitionProgress + dtSeconds * 1.45);
  }

  if (w.autoCycle && elapsedHours > 0 && Number.isFinite(elapsedHours)) {
    w.hoursInState += elapsedHours;
    while (w.hoursInState >= WEATHER_CYCLE_HOURS) {
      w.hoursInState -= WEATHER_CYCLE_HOURS;
      w.previous = w.current;
      w.current = getNextCycleWeather(w.current);
      w.transitionProgress = 0;
      w.cycleCount += 1;
    }
  }

  return w;
}

/**
 * Cycles SUNNY -> OVERCAST -> RAINY -> SUNNY.
 * Entering SUNNY from RAINY re-enables automatic time-based cycling so the player
 * can freely inspect each state or let the sky resume natural shifting.
 */
export function cycleWeatherState(state: GameState): WeatherCycleState {
  const w = ensureWeatherState(state);
  const prev = w.current;
  const next = getNextCycleWeather(prev);
  w.previous = prev;
  w.current = next;
  w.transitionProgress = 0;
  w.hoursInState = 0;
  w.cycleCount += 1;
  w.autoCycle = next === 'SUNNY' && prev === 'RAINY';
  return w;
}

export function setWeatherState(
  state: GameState,
  target: GlobalWeatherState | 'AUTO'
): WeatherCycleState {
  const w = ensureWeatherState(state);
  if (target === 'AUTO') {
    w.autoCycle = true;
    return w;
  }
  const prev = w.current;
  w.previous = prev;
  w.current = target;
  w.transitionProgress = prev === target ? 1 : 0;
  w.autoCycle = false;
  w.hoursInState = 0;
  if (prev !== target) {
    w.cycleCount += 1;
  }
  return w;
}

export function getEffectiveWeatherSnapshot(
  state: GameState
): WeatherSnapshot & { globalState: GlobalWeatherState; autoCycle: boolean } {
  const w = state.weather;
  if (!w || !isValidGlobalWeather(w.current)) {
    const snap = getWeatherSnapshot(state.seed, state.totalDays, state.hourOfDay);
    return {
      ...snap,
      globalState: snap.globalState ?? conditionToGlobalWeather(snap.condition),
      autoCycle: true,
    };
  }

  const safeHour = Number.isFinite(state.hourOfDay) ? state.hourOfDay : 9;
  const t = clamp01(w.transitionProgress);
  const smoothT = t * t * (3 - 2 * t);

  const prevProf = profileForGlobalState(isValidGlobalWeather(w.previous) ? w.previous : w.current);
  const curProf = profileForGlobalState(w.current);

  let rainIntensity = clamp01(prevProf.rain + (curProf.rain - prevProf.rain) * smoothT);
  let sunlightIntensity = clamp01(prevProf.sunlight + (curProf.sunlight - prevProf.sunlight) * smoothT);
  const overcastIntensity = clamp01(
    prevProf.overcast + (curProf.overcast - prevProf.overcast) * smoothT
  );

  // Evening dusk gently fades active sunbeams while keeping rain/clouds visible
  if (safeHour >= 17.0) {
    const duskFade = clamp01(1 - (safeHour - 17.0) / 1.0);
    sunlightIntensity *= duskFade;
  }

  if (rainIntensity > 0.05) {
    const pulse = 0.9 + 0.1 * Math.sin(safeHour * Math.PI * 1.5);
    rainIntensity = clamp01(rainIntensity * pulse);
  }

  const condition: WeatherCondition = smoothT >= 0.5 ? curProf.condition : prevProf.condition;
  const intensity = clamp01(Math.max(rainIntensity, sunlightIntensity, overcastIntensity));

  return {
    condition,
    globalState: w.current,
    autoCycle: w.autoCycle,
    intensity,
    rainIntensity,
    sunlightIntensity,
    overcastIntensity,
  };
}
