import { evaluateMilestoneProgress } from '@/src/game/systems/milestoneSystem';
import {
  getLocale,
  getMilestoneLocalized,
  getOfficeLevelLocalized,
  LocaleCode,
  t,
} from '@/src/localization';
import { GameState, Milestone } from '@/src/types/game';
import { formatCurrency } from '@/src/utils/format';

export interface CalendarDate {
  day: number;
  month: number;
  year: number;
  totalDays: number;
}

export type MilestoneTimelineStatus = 'COMPLETED' | 'CURRENT' | 'UPCOMING';

export interface MilestoneTimelineEntry {
  milestone: Milestone;
  orderIndex: number;
  status: MilestoneTimelineStatus;
  completedDate: CalendarDate | null;
  completedDateLabel: string | null;
  progressRatio: number;
  progressLabel: string;
  flavorText: string | null;
}

export interface MilestoneTimelineResult {
  entries: MilestoneTimelineEntry[];
  completedCount: number;
  currentCount: number;
  upcomingCount: number;
}

const START_YEAR = 2026;
const DAYS_PER_MONTH = 30;
const MONTHS_PER_YEAR = 12;

export function totalDaysToCalendarDate(totalDays: number): CalendarDate {
  const safeDays = Math.max(1, Math.floor(totalDays));
  const zeroBased = safeDays - 1;
  const day = (zeroBased % DAYS_PER_MONTH) + 1;
  const totalMonths = Math.floor(zeroBased / DAYS_PER_MONTH);
  const month = (totalMonths % MONTHS_PER_YEAR) + 1;
  const year = START_YEAR + Math.floor(totalMonths / MONTHS_PER_YEAR);
  return {
    day,
    month,
    year,
    totalDays: safeDays,
  };
}

function stableHash(input: string, seed: number): number {
  let hash = (seed ^ 0x811c9dc5) >>> 0;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

const DETAIL_KEYS = ['d1', 'd2', 'd3', 'd4'] as const;
const VARIANT_KEYS = ['v1', 'v2', 'v3'] as const;

export function generateMilestoneFlavorText(
  state: GameState,
  milestone: Milestone,
  status: MilestoneTimelineStatus,
  locale: LocaleCode = getLocale()
): string | null {
  if (status === 'UPCOMING') return null;

  const company = state.config.companyName || 'BrightForge Labs';
  const founder = state.founder.name || 'Founder';
  const hash = stableHash(
    `${milestone.id}:${milestone.unlockedDay ?? state.totalDays}`,
    state.seed
  );

  const teammate =
    state.employees.length > 0
      ? state.employees[hash % state.employees.length].name
      : founder;
  const teammate2 =
    state.employees.length > 1
      ? state.employees[(hash + 1) % state.employees.length].name
      : founder;
  const product = state.products[0]?.name ?? company;
  const officeName = getOfficeLevelLocalized(state.office.level, locale).name;
  const cashStr = formatCurrency(milestone.rewardCash, false, locale);
  const dayNum = milestone.unlockedDay ?? state.totalDays;

  if (status === 'CURRENT') {
    const focusKey = `milestones.timeline.currentFocus.${milestone.id}`;
    const resolved = t(
      focusKey,
      {
        company,
        founder,
        teammate,
        teammate2,
        product,
        office: officeName,
        day: dayNum,
        cash: cashStr,
      },
      locale
    );
    if (resolved !== focusKey) return resolved;
    return t(
      'milestones.timeline.currentNote',
      { company, teammate, founder },
      locale
    );
  }

  const detailKey = DETAIL_KEYS[(hash >>> 3) % DETAIL_KEYS.length];
  const detailText = t(`milestones.timeline.details.${detailKey}`, undefined, locale);
  const variantKey = VARIANT_KEYS[hash % VARIANT_KEYS.length];
  const flavorKey = `milestones.timeline.flavors.${milestone.id}.${variantKey}`;

  const rendered = t(
    flavorKey,
    {
      company,
      founder,
      teammate,
      teammate2,
      product,
      office: officeName,
      day: dayNum,
      cash: cashStr,
      detail: detailText,
    },
    locale
  );

  if (rendered !== flavorKey) return rendered;
  const msTitle = getMilestoneLocalized(
    milestone.id,
    milestone.title,
    milestone.description,
    locale
  ).title;
  return `${teammate} · ${msTitle}`;
}

export function buildMilestoneTimeline(
  state: GameState,
  locale: LocaleCode = getLocale()
): MilestoneTimelineResult {
  const evaluations = evaluateMilestoneProgress(state, locale);
  const indexed = state.milestones.map((milestone, orderIndex) => ({
    milestone,
    orderIndex,
    evalInfo: evaluations[milestone.id] ?? {
      id: milestone.id,
      conditionMet: milestone.unlocked,
      progressRatio: milestone.unlocked ? 1 : 0,
      progressText: '',
    },
  }));

  const completedRaw = indexed
    .filter((item) => item.milestone.unlocked)
    .sort((a, b) => {
      const dayA = a.milestone.unlockedDay ?? Number.MAX_SAFE_INTEGER;
      const dayB = b.milestone.unlockedDay ?? Number.MAX_SAFE_INTEGER;
      if (dayA !== dayB) return dayA - dayB;
      return a.orderIndex - b.orderIndex;
    });

  const lockedRaw = indexed.filter((item) => !item.milestone.unlocked);

  // Pick the next milestone in canonical progression order as the Current Goal
  const currentItem = lockedRaw[0] ?? null;

  const upcomingRaw = lockedRaw.filter((item) => item.milestone.id !== currentItem?.milestone.id);

  const toEntry = (
    item: (typeof indexed)[number],
    status: MilestoneTimelineStatus
  ): MilestoneTimelineEntry => {
    const unlockedDay =
      status === 'COMPLETED' ? Math.max(1, item.milestone.unlockedDay ?? 1) : null;
    const completedDate = unlockedDay !== null ? totalDaysToCalendarDate(unlockedDay) : null;
    const completedDateLabel = completedDate
      ? t(
          'milestones.timeline.completedDate',
          {
            day: completedDate.day,
            month: completedDate.month,
            year: completedDate.year,
            totalDays: completedDate.totalDays,
          },
          locale
        )
      : null;

    return {
      milestone: item.milestone,
      orderIndex: item.orderIndex,
      status,
      completedDate,
      completedDateLabel,
      progressRatio: status === 'COMPLETED' ? 1 : item.evalInfo.progressRatio,
      progressLabel: item.evalInfo.progressText,
      flavorText: generateMilestoneFlavorText(state, item.milestone, status, locale),
    };
  };

  const entries: MilestoneTimelineEntry[] = [
    ...completedRaw.map((item) => toEntry(item, 'COMPLETED')),
    ...(currentItem ? [toEntry(currentItem, 'CURRENT')] : []),
    ...upcomingRaw.map((item) => toEntry(item, 'UPCOMING')),
  ];

  return {
    entries,
    completedCount: completedRaw.length,
    currentCount: currentItem ? 1 : 0,
    upcomingCount: upcomingRaw.length,
  };
}
