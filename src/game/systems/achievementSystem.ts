import { ROLE_DEFINITIONS } from '@/src/game/data/roles';
import {
  getAchievementLocalized,
  getAchievementProgressLocalized,
  getLocale,
} from '@/src/localization';
import { Achievement, EmployeeRole, GameState } from '@/src/types/game';

const ALL_ROLES = Object.keys(ROLE_DEFINITIONS) as EmployeeRole[];

export function getLifetimeCashBurned(state: GameState): number {
  return Math.max(
    0,
    Math.round(
      (state.finance.cumulativeExpenses ?? 0) +
        state.finance.currentMonthMarketing +
        state.finance.currentMonthDevCosts
    )
  );
}

export function getUniqueHiredRoles(state: GameState): Set<EmployeeRole> {
  const roles = new Set<EmployeeRole>(state.hiredRolesHistory ?? []);
  for (const emp of state.employees) {
    roles.add(emp.role);
  }
  return roles;
}

export function getAchievementProgress(state: GameState, achievementId: string): string {
  return getAchievementProgressLocalized(state, achievementId, getLocale());
}

export function checkAchievements(state: GameState): Achievement[] {
  if (!Array.isArray(state.achievements)) return [];

  const unlockedNow: Achievement[] = [];

  const award = (id: string, condition: boolean) => {
    const ach = state.achievements.find((a) => a.id === id);
    if (!ach || ach.unlocked || !condition) return;
    ach.unlocked = true;
    ach.unlockedDay = state.totalDays;
    unlockedNow.push({ ...ach });

    const loc = getAchievementLocalized(id, ach.title, ach.description, getLocale());
    const prefix = getLocale() === 'vi-VN' ? 'Đã mở khóa thành tựu' : 'Achievement unlocked';
    state.notifications.unshift({
      id: `ach_${id}_${state.totalDays}`,
      day: state.totalDays,
      message: `${prefix}: ${loc.title}`,
      type: 'SUCCESS',
    });
    state.notifications = state.notifications.slice(0, 24);
  };

  const burned = getLifetimeCashBurned(state);
  const uniqueRoles = getUniqueHiredRoles(state);
  const liveProductsCount = state.products.filter(
    (p) => p.stage === 'MVP_LIVE' || p.stage === 'MATURE'
  ).length;
  const totalPaying = state.products.reduce((s, p) => s + p.payingCustomers, 0);
  const hasMaturePolished = state.products.some(
    (p) => p.stage === 'MATURE' && p.quality >= 85 && p.bugs === 0
  );
  const hasEnterpriseWhale = state.contracts.some(
    (c) => (c.status === 'ACTIVE' || c.status === 'COMPLETED') && c.monthlyValue >= 4000
  );

  award('ach_100k_revenue', state.finance.cumulativeRevenue >= 100_000);
  award('ach_1m_revenue', state.finance.cumulativeRevenue >= 1_000_000);
  award('ach_burned_1m', burned >= 1_000_000);
  award('ach_all_roles', ALL_ROLES.every((role) => uniqueRoles.has(role)));
  award('ach_lead_veteran', state.employees.some((e) => e.level >= 4));
  award('ach_zero_bugs_mature', hasMaturePolished);
  award('ach_multi_product', liveProductsCount >= 3);
  award('ach_1k_customers', totalPaying >= 1000);
  award('ach_enterprise_whale', hasEnterpriseWhale);
  award(
    'ach_debt_free_hq',
    state.office.level >= 3 && state.finance.totalDebt === 0 && state.finance.cash >= 100_000
  );

  return unlockedNow;
}
