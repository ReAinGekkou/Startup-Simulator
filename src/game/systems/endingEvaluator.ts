import { ENDING_DEFINITIONS } from '@/src/game/data/storyData';
import {
  CinematicSceneId,
  EndingId,
  EvaluatedEndingSummary,
  GameState,
  StoryChapterId,
} from '@/src/types/game';

export const ENDING_THRESHOLDS = {
  LEGACY_MIN_VALUATION: 320_000,
  LEGACY_MIN_REVENUE: 140_000,
  LEGACY_MIN_MORALE: 72,
  LEGACY_MIN_CULTURE: 70,
  LEGACY_MIN_REPUTATION: 65,
  LEGACY_MAX_RESIGNATIONS: 1,
  LEGACY_MIN_DAYS: 35,
  DREAM_MIN_VALUATION: 220_000,
  DREAM_MIN_CASH: 90_000,
  DREAM_MIN_MORALE: 62,
  DREAM_MIN_REPUTATION: 55,
  BURNOUT_MIN_VALUATION: 190_000,
  BURNOUT_MIN_REVENUE: 75_000,
  BURNOUT_LOW_MORALE: 45,
  BURNOUT_LOW_CULTURE: 42,
  BURNOUT_MIN_RESIGNATIONS: 2,
  SMALL_HAPPY_MIN_CASH: 8_000,
  SMALL_HAPPY_MIN_MORALE: 66,
  SMALL_HAPPY_MIN_CULTURE: 58,
  SMALL_HAPPY_MAX_EMPLOYEES: 8,
} as const;

export interface CompanyStoryMetrics {
  valuation: number;
  cash: number;
  cumulativeRevenue: number;
  employeesCount: number;
  avgMorale: number;
  avgStress: number;
  reputation: number;
  cultureScore: number;
  resignationsCount: number;
  daysOperated: number;
  liveProductsCount: number;
  maxProductQuality: number;
  profitableMonthsCount: number;
}

export function computeCompanyStoryMetrics(state: GameState): CompanyStoryMetrics {
  const employeesCount = state.employees.length;
  const avgMorale =
    employeesCount > 0
      ? Math.round(
          state.employees.reduce((sum, e) => sum + e.morale, 0) / employeesCount
        )
      : 50;
  const avgStress =
    employeesCount > 0
      ? Math.round(
          state.employees.reduce((sum, e) => sum + e.stress, 0) / employeesCount
        )
      : 0;
  const liveProducts = state.products.filter(
    (p) => p.stage === 'MVP_LIVE' || p.stage === 'MATURE'
  );
  const maxProductQuality =
    state.products.length > 0
      ? Math.max(...state.products.map((p) => p.quality))
      : 0;
  const profitableMonthsCount = state.monthlyHistory.filter(
    (r) => r.netProfit > 0
  ).length;

  return {
    valuation: Math.round(state.finance.valuation),
    cash: Math.round(state.finance.cash),
    cumulativeRevenue: Math.round(state.finance.cumulativeRevenue),
    employeesCount,
    avgMorale,
    avgStress,
    reputation: Math.round(state.founder.reputation),
    cultureScore: Math.round(state.story?.decisions?.cultureScore ?? 55),
    resignationsCount: state.story?.decisions?.resignationsCount ?? 0,
    daysOperated: state.totalDays,
    liveProductsCount: liveProducts.length,
    maxProductQuality: Math.round(maxProductQuality),
    profitableMonthsCount,
  };
}

/**
 * Verifies whether the company still has a realistic path to recover from cash trouble.
 * Failure ending (LAST_DAY) must NOT trigger while the founder still has viable credit/cash recovery.
 */
export function hasViableRecoveryPath(state: GameState): boolean {
  const f = state.finance;
  if (f.cash < -f.creditLimit) {
    return false;
  }
  if (f.consecutiveNegativeCashMonths >= 3 && f.cash < 0) {
    return false;
  }
  const availableCredit = f.creditLimit - f.totalDebt;
  const hasPersonalBailout = (state.founder.personalCash ?? 0) >= 500;
  const positiveLastMonth = f.lastMonthNetProfit > 0;
  if (f.cash >= 0) return true;
  if (availableCredit >= 2000 || hasPersonalBailout || positiveLastMonth) {
    return true;
  }
  return f.consecutiveNegativeCashMonths < 3 && f.cash >= -f.creditLimit;
}

export function determineEndingId(state: GameState): EndingId {
  const m = computeCompanyStoryMetrics(state);
  const decisions = state.story?.decisions;

  // 1. Ending C: Acquisition ONLY triggers on explicit player acceptance
  if (decisions?.acquisitionAccepted === true) {
    return 'ACQUISITION';
  }

  // 2. Ending E: The Last Day ONLY triggers on genuine unrecoverable insolvency/failure
  if (state.screen === 'GAME_OVER' || !hasViableRecoveryPath(state)) {
    return 'LAST_DAY';
  }

  // 3. Ending D: Burnout requires BOTH high financial scale/value AND clear human/culture toll
  const hasHighScale =
    m.valuation >= ENDING_THRESHOLDS.BURNOUT_MIN_VALUATION ||
    m.cumulativeRevenue >= ENDING_THRESHOLDS.BURNOUT_MIN_REVENUE;
  const hasSevereHumanCost =
    m.avgMorale < ENDING_THRESHOLDS.BURNOUT_LOW_MORALE ||
    m.cultureScore < ENDING_THRESHOLDS.BURNOUT_LOW_CULTURE ||
    (m.resignationsCount >= ENDING_THRESHOLDS.BURNOUT_MIN_RESIGNATIONS &&
      m.avgMorale < 58);
  if (hasHighScale && hasSevereHumanCost) {
    return 'BURNOUT';
  }

  // 4. Ending F: Legacy (sustainable long-term performance + happy retained team + culture + product + reputation)
  const qualifiesLegacy =
    (m.valuation >= ENDING_THRESHOLDS.LEGACY_MIN_VALUATION ||
      m.cumulativeRevenue >= ENDING_THRESHOLDS.LEGACY_MIN_REVENUE) &&
    m.avgMorale >= ENDING_THRESHOLDS.LEGACY_MIN_MORALE &&
    m.cultureScore >= ENDING_THRESHOLDS.LEGACY_MIN_CULTURE &&
    m.reputation >= ENDING_THRESHOLDS.LEGACY_MIN_REPUTATION &&
    m.resignationsCount <= ENDING_THRESHOLDS.LEGACY_MAX_RESIGNATIONS &&
    m.employeesCount >= 4 &&
    m.liveProductsCount >= 1 &&
    m.maxProductQuality >= 72 &&
    (m.daysOperated >= ENDING_THRESHOLDS.LEGACY_MIN_DAYS ||
      m.profitableMonthsCount >= 2 ||
      (state.story?.completedChapters ?? []).includes(5));
  if (qualifiesLegacy) {
    return 'LEGACY';
  }

  // 5. Ending A: The Dream Company (strong financial health + live products + satisfied team + reputation)
  const qualifiesDream =
    (m.valuation >= ENDING_THRESHOLDS.DREAM_MIN_VALUATION ||
      m.cash >= ENDING_THRESHOLDS.DREAM_MIN_CASH) &&
    m.liveProductsCount >= 1 &&
    m.avgMorale >= ENDING_THRESHOLDS.DREAM_MIN_MORALE &&
    m.reputation >= ENDING_THRESHOLDS.DREAM_MIN_REPUTATION;
  if (qualifiesDream) {
    return 'DREAM_COMPANY';
  }

  // 6. Ending B: Small But Happy (sustainable finances + high satisfaction + strong culture + compact team)
  const qualifiesSmallHappy =
    m.cash >= ENDING_THRESHOLDS.SMALL_HAPPY_MIN_CASH &&
    m.avgMorale >= ENDING_THRESHOLDS.SMALL_HAPPY_MIN_MORALE &&
    m.cultureScore >= ENDING_THRESHOLDS.SMALL_HAPPY_MIN_CULTURE &&
    m.employeesCount <= ENDING_THRESHOLDS.SMALL_HAPPY_MAX_EMPLOYEES;
  if (qualifiesSmallHappy) {
    return 'SMALL_BUT_HAPPY';
  }

  // Fallback tie-breaker based on balanced metrics rather than single-metric heuristics
  if (m.avgMorale >= 60 && m.cultureScore >= 55 && m.cash >= 0) {
    return 'SMALL_BUT_HAPPY';
  }
  if (m.valuation >= ENDING_THRESHOLDS.DREAM_MIN_VALUATION && m.avgMorale >= 50) {
    return 'DREAM_COMPANY';
  }
  return m.avgMorale < 48 ? 'BURNOUT' : 'SMALL_BUT_HAPPY';
}

export function evaluateEnding(state: GameState): EvaluatedEndingSummary {
  const endingId = determineEndingId(state);
  const m = computeCompanyStoryMetrics(state);
  const highestChapter = (
    state.story?.unlockedChapters?.length
      ? Math.max(...state.story.unlockedChapters)
      : state.story?.currentChapter ?? 1
  ) as StoryChapterId;

  return {
    endingId,
    endingDay: state.day,
    endingMonth: state.month,
    endingYear: state.year,
    chapterReached: highestChapter,
    stats: {
      valuation: m.valuation,
      cash: m.cash,
      cumulativeRevenue: m.cumulativeRevenue,
      employeesCount: m.employeesCount,
      avgMorale: m.avgMorale,
      reputation: m.reputation,
      cultureScore: m.cultureScore,
      resignationsCount: m.resignationsCount,
      daysOperated: m.daysOperated,
      liveProductsCount: m.liveProductsCount,
    },
    majorChoices: [...(state.story?.choiceHistory ?? [])],
  };
}

export function getEndingCinematicId(endingId: EndingId): CinematicSceneId {
  return ENDING_DEFINITIONS[endingId].cinematicId;
}
