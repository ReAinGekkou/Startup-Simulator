export type WeatherCondition = 'CLEAR' | 'SUNLIT' | 'CLOUDY' | 'RAIN';

export interface WeatherSnapshot {
  condition: WeatherCondition;
  /** Overall strength of active atmospheric cues (0..1) */
  intensity: number;
  /** Cozy rain shower intensity (0..1) */
  rainIntensity: number;
  /** Warm shifting sunlight beam intensity (0..1) */
  sunlightIntensity: number;
  /** Soft passing cloud / overcast tint intensity (0..1) */
  overcastIntensity: number;
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function deterministicUnit(seed: number, day: number, period: number): number {
  let h = (Math.imul(Math.floor(seed) | 0, 374761393) + Math.imul(day | 0, 668265263) + Math.imul(period | 0, 1274126177)) | 0;
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
    intensity,
    rainIntensity,
    sunlightIntensity,
    overcastIntensity,
  };
}
