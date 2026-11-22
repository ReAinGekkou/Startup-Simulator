import { OFFICE_LEVELS } from '@/src/game/data/officeLayout';
import { getLocale, getMilestoneLocalized, LocaleCode } from '@/src/localization';
import { GameState } from '@/src/types/game';
import { clamp, formatCurrency, formatNumber } from '@/src/utils/format';

export interface MilestoneEvaluation {
  id: string;
  conditionMet: boolean;
  progressRatio: number; // 0..1
  progressText: string;
}

export function evaluateMilestoneProgress(
  state: GameState,
  locale: LocaleCode = getLocale()
): Record<string, MilestoneEvaluation> {
  const vi = locale === 'vi-VN';

  const hasLiveProduct = state.products.some(
    (p) => p.stage === 'MVP_LIVE' || p.stage === 'MATURE'
  );
  const maxDevProgress = state.products.reduce(
    (max, p) => Math.max(max, p.developmentProgress ?? 0),
    0
  );

  const totalPaying = state.products.reduce((s, p) => s + p.payingCustomers, 0);
  const totalActiveUsers = state.products.reduce((s, p) => s + p.activeUsers, 0);
  const hasActiveContract = state.contracts.some((c) => c.status === 'ACTIVE');

  const hasMajorContract = state.contracts.some(
    (c) => (c.status === 'ACTIVE' || c.status === 'COMPLETED') && c.monthlyValue >= 2000
  );
  const bestContractValue = state.contracts.reduce(
    (best, c) => Math.max(best, c.monthlyValue ?? 0),
    0
  );

  const hasProfitableMonth = state.monthlyHistory.some((r) => r.netProfit > 0);
  const latestMonthProfit =
    state.monthlyHistory.length > 0
      ? state.monthlyHistory[state.monthlyHistory.length - 1].netProfit
      : 0;
  const estMonthlyRentAndPayroll =
    state.office.monthlyRent +
    state.employees.reduce((s, e) => s + e.monthlySalary, 0) +
    (state.founder.monthlySalary ?? 0);

  const hq2Cost = OFFICE_LEVELS[2].upgradeCost;
  const techLeaderProgress =
    (Math.min(1, state.office.level / 4) +
      Math.min(1, state.founder.reputation / 75) +
      Math.min(1, Math.max(0, state.finance.cash) / 250_000)) /
    3;

  return {
    ms_first_product: {
      id: 'ms_first_product',
      conditionMet: hasLiveProduct,
      progressRatio: hasLiveProduct ? 1 : clamp(maxDevProgress / 100, 0, 0.99),
      progressText: hasLiveProduct
        ? vi
          ? 'Đã ra mắt MVP'
          : 'MVP live'
        : vi
          ? `Hoàn thiện MVP ${Math.round(maxDevProgress)}% / 100%`
          : `MVP build ${Math.round(maxDevProgress)}% / 100%`,
    },
    ms_first_customer: {
      id: 'ms_first_customer',
      conditionMet: totalPaying > 0 || hasActiveContract,
      progressRatio:
        totalPaying > 0 || hasActiveContract
          ? 1
          : clamp((totalActiveUsers > 0 ? 0.45 : 0), 0, 0.9),
      progressText:
        totalPaying > 0 || hasActiveContract
          ? vi
            ? `${formatNumber(Math.max(1, totalPaying), locale)} khách hàng`
            : `${formatNumber(Math.max(1, totalPaying), locale)} paying`
          : vi
            ? `0 / 1 khách hàng trả phí (${totalActiveUsers} dùng thử)`
            : `0 / 1 paying customer (${totalActiveUsers} active users)`,
    },
    ms_profitable_month: {
      id: 'ms_profitable_month',
      conditionMet: hasProfitableMonth,
      progressRatio: hasProfitableMonth
        ? 1
        : clamp(
            state.finance.currentMonthRevenue / Math.max(1, estMonthlyRentAndPayroll),
            0,
            0.95
          ),
      progressText: hasProfitableMonth
        ? vi
          ? `Tháng lãi ${formatCurrency(Math.max(0, latestMonthProfit), false, locale)}`
          : `Profitable month (${formatCurrency(Math.max(0, latestMonthProfit), false, locale)})`
        : vi
          ? `Doanh thu tháng ${formatCurrency(state.finance.currentMonthRevenue, false, locale)} / ${formatCurrency(estMonthlyRentAndPayroll, false, locale)}`
          : `Month rev ${formatCurrency(state.finance.currentMonthRevenue, false, locale)} / ${formatCurrency(estMonthlyRentAndPayroll, false, locale)}`,
    },
    ms_ten_employees: {
      id: 'ms_ten_employees',
      conditionMet: state.employees.length >= 10,
      progressRatio: clamp(state.employees.length / 10, 0, 1),
      progressText: vi
        ? `${state.employees.length} / 10 nhân sự`
        : `${state.employees.length} / 10 staff`,
    },
    ms_major_contract: {
      id: 'ms_major_contract',
      conditionMet: hasMajorContract,
      progressRatio: hasMajorContract
        ? 1
        : clamp(bestContractValue / 2000, 0, 0.9),
      progressText: hasMajorContract
        ? vi
          ? `Hợp đồng ${formatCurrency(bestContractValue, false, locale)}/tháng`
          : `Contract ${formatCurrency(bestContractValue, false, locale)}/mo`
        : vi
          ? `Hợp đồng tốt nhất ${formatCurrency(bestContractValue, false, locale)} / ${formatCurrency(2000, false, locale)}/tháng`
          : `Best contract ${formatCurrency(bestContractValue, false, locale)} / ${formatCurrency(2000, false, locale)}/mo`,
    },
    ms_office_expansion: {
      id: 'ms_office_expansion',
      conditionMet: state.office.level >= 2,
      progressRatio:
        state.office.level >= 2
          ? 1
          : clamp(Math.max(0, state.finance.cash) / hq2Cost, 0, 0.95),
      progressText:
        state.office.level >= 2
          ? vi
            ? `Trụ sở Cấp ${state.office.level}`
            : `HQ Level ${state.office.level}`
          : vi
            ? `Cấp ${state.office.level}/2 · ${formatCurrency(Math.max(0, state.finance.cash), false, locale)} / ${formatCurrency(hq2Cost, false, locale)}`
            : `HQ Lv.${state.office.level}/2 · ${formatCurrency(Math.max(0, state.finance.cash), false, locale)} / ${formatCurrency(hq2Cost, false, locale)}`,
    },
    ms_one_million: {
      id: 'ms_one_million',
      conditionMet: state.finance.cumulativeRevenue >= 1_000_000,
      progressRatio: clamp(state.finance.cumulativeRevenue / 1_000_000, 0, 1),
      progressText: `${formatCurrency(Math.min(state.finance.cumulativeRevenue, 1_000_000), false, locale)} / ${formatCurrency(1_000_000, false, locale)}`,
    },
    ms_tech_leader: {
      id: 'ms_tech_leader',
      conditionMet:
        state.office.level >= 4 &&
        state.founder.reputation >= 75 &&
        state.finance.cash >= 250_000,
      progressRatio: clamp(techLeaderProgress, 0, 1),
      progressText: vi
        ? `Trụ sở ${state.office.level}/4 · Uy tín ${Math.round(state.founder.reputation)}/75 · Tiền ${formatCurrency(Math.max(0, state.finance.cash), false, locale)}/${formatCurrency(250_000, false, locale)}`
        : `HQ ${state.office.level}/4 · Rep ${Math.round(state.founder.reputation)}/75 · Cash ${formatCurrency(Math.max(0, state.finance.cash), false, locale)}/${formatCurrency(250_000, false, locale)}`,
    },
  };
}

export function checkMilestones(state: GameState): string[] {
  const unlockedNow: string[] = [];
  const locale = getLocale();
  const evaluations = evaluateMilestoneProgress(state, locale);

  for (const ms of state.milestones) {
    const ev = evaluations[ms.id];
    if (!ev || ms.unlocked || !ev.conditionMet) continue;
    ms.unlocked = true;
    ms.unlockedDay = state.totalDays;
    state.finance.cash += ms.rewardCash;
    state.founder.reputation = clamp(state.founder.reputation + ms.rewardReputation, 0, 100);
    const loc = getMilestoneLocalized(ms.id, ms.title, ms.description, locale);
    unlockedNow.push(`${loc.title} (+${formatCurrency(ms.rewardCash, false, locale)})`);
  }

  // Campaign Victory condition
  const techLeader = state.milestones.find((m) => m.id === 'ms_tech_leader');
  if (
    state.config.gameMode === 'CAMPAIGN' &&
    !state.victoryAchieved &&
    !state.sandboxContinued &&
    techLeader?.unlocked
  ) {
    state.victoryAchieved = true;
    state.screen = 'VICTORY';
  }

  return unlockedNow;
}

