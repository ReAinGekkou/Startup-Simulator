import { getLocale, getLocalizedFounderSalaryLabelAndSummary } from '@/src/localization';
import { GameState, MonthlyReport } from '@/src/types/game';
import { clamp } from '@/src/utils/format';

export const MIN_FOUNDER_SALARY = 0;
export const MAX_FOUNDER_SALARY = 15000;

export interface FounderSalaryProfile {
  tier: 'SWEAT_EQUITY' | 'LEAN' | 'STANDARD' | 'HIGH' | 'LAVISH';
  label: string;
  moralePerDay: number;
  investorTrustPerDay: number;
  respectPerDay: number;
  crunchActive: boolean;
  summary: string;
}

export function getFounderSalaryProfile(salary: number, companyCash: number): FounderSalaryProfile {
  const safeSalary = clamp(Math.round(salary), MIN_FOUNDER_SALARY, MAX_FOUNDER_SALARY);
  const crunchActive = companyCash < 10000;
  const crunchMult = crunchActive ? 1.5 : 1;

  if (safeSalary === 0) {
    const loc = getLocalizedFounderSalaryLabelAndSummary('SWEAT_EQUITY', crunchActive);
    return {
      tier: 'SWEAT_EQUITY',
      label: loc.label,
      moralePerDay: 1.5,
      investorTrustPerDay: 0.4,
      respectPerDay: 0.45,
      crunchActive,
      summary: loc.summary,
    };
  }
  if (safeSalary <= 1500) {
    const loc = getLocalizedFounderSalaryLabelAndSummary('LEAN', crunchActive);
    return {
      tier: 'LEAN',
      label: loc.label,
      moralePerDay: 0.8,
      investorTrustPerDay: 0.2,
      respectPerDay: 0.2,
      crunchActive,
      summary: loc.summary,
    };
  }
  if (safeSalary <= 4000) {
    const loc = getLocalizedFounderSalaryLabelAndSummary('STANDARD', crunchActive);
    return {
      tier: 'STANDARD',
      label: loc.label,
      moralePerDay: 0,
      investorTrustPerDay: 0,
      respectPerDay: 0,
      crunchActive,
      summary: loc.summary,
    };
  }
  if (safeSalary <= 7500) {
    const loc = getLocalizedFounderSalaryLabelAndSummary('HIGH', crunchActive);
    return {
      tier: 'HIGH',
      label: loc.label,
      moralePerDay: Number((-1.0 * crunchMult).toFixed(2)),
      investorTrustPerDay: Number((-0.9 * crunchMult).toFixed(2)),
      respectPerDay: Number((-0.15 * crunchMult).toFixed(2)),
      crunchActive,
      summary: loc.summary,
    };
  }
  const loc = getLocalizedFounderSalaryLabelAndSummary('LAVISH', crunchActive);
  return {
    tier: 'LAVISH',
    label: loc.label,
    moralePerDay: Number((-2.2 * crunchMult).toFixed(2)),
    investorTrustPerDay: Number((-1.8 * crunchMult).toFixed(2)),
    respectPerDay: Number((-0.45 * crunchMult).toFixed(2)),
    crunchActive,
    summary: loc.summary,
  };
}

export function calculateMonthlyPayroll(state: GameState): number {
  return state.employees.reduce((sum, emp) => sum + emp.monthlySalary, 0);
}

export function calculateFounderSalary(state: GameState): number {
  return clamp(
    Math.round(state.founder.monthlySalary ?? 0),
    MIN_FOUNDER_SALARY,
    MAX_FOUNDER_SALARY
  );
}

export function calculateMonthlyMaintenance(state: GameState): number {
  const opsManagers = state.employees.filter(
    (e) => e.role === 'OPERATIONS_MANAGER' && e.assignedTask !== 'REST_BREAK'
  );
  const opsDiscount = clamp(
    1 -
      opsManagers.reduce(
        (acc, e) =>
          acc +
          e.skills.operations * 0.0025 +
          (e.traits?.includes('CULTURE_CATALYST') ? 0.05 : 0),
        0
      ),
    0.7,
    1
  );
  const raw = state.products
    .filter((p) => p.stage === 'MVP_LIVE' || p.stage === 'MATURE')
    .reduce((sum, p) => sum + p.monthlyMaintenanceCost, 0);
  return Math.round(raw * opsDiscount);
}

export function estimateMonthlyBurn(state: GameState): {
  projectedRevenue: number;
  projectedExpenses: number;
  netMonthly: number;
} {
  const productRev = state.products.reduce((sum, p) => sum + p.monthlyRevenue, 0);
  const contractRev = state.contracts
    .filter((c) => c.status === 'ACTIVE')
    .reduce((sum, c) => sum + c.monthlyValue, 0);
  const projectedRevenue = Math.round(productRev + contractRev);

  const salaries = calculateMonthlyPayroll(state);
  const founderSalary = calculateFounderSalary(state);
  const rent = state.office.monthlyRent;
  const maintenance = calculateMonthlyMaintenance(state);
  const marketing = state.campaigns
    .filter((c) => c.active)
    .reduce((sum, c) => sum + c.dailyBudget * 30, 0);
  const interest = Math.round(state.finance.totalDebt * state.finance.monthlyInterestRate);
  const projectedExpenses = salaries + founderSalary + rent + maintenance + marketing + interest;

  return {
    projectedRevenue,
    projectedExpenses,
    netMonthly: projectedRevenue - projectedExpenses,
  };
}

export function processEndOfMonth(
  state: GameState,
  monthCustomersGained: number,
  monthCustomersChurned: number
): MonthlyReport {
  const f = state.finance;

  const salaries = calculateMonthlyPayroll(state);
  const founderSalary = calculateFounderSalary(state);
  const rent = state.office.monthlyRent;
  const maintenance = calculateMonthlyMaintenance(state);
  const financeRoomLevel = state.office.rooms.FINANCE_DEPT?.level ?? 1;
  const interestRate = Math.max(0.008, f.monthlyInterestRate - (financeRoomLevel - 1) * 0.0025);
  const interest = Math.round(f.totalDebt * interestRate);

  const accountants = state.employees.filter(
    (e) => e.role === 'ACCOUNTANT' && e.assignedTask !== 'REST_BREAK'
  );
  const taxReduction = clamp(
    accountants.reduce(
      (acc, e) =>
        acc + e.skills.finance * 0.001 + (e.traits?.includes('FISCAL_ARCHITECT') ? 0.02 : 0),
      0
    ) +
      (financeRoomLevel - 1) * 0.01,
    0,
    0.09
  );
  const effectiveTaxRate = Math.max(0.08, f.taxRate - taxReduction);

  const preTaxProfit =
    f.currentMonthRevenue -
    (salaries +
      founderSalary +
      rent +
      maintenance +
      f.currentMonthMarketing +
      f.currentMonthDevCosts +
      interest);
  const taxes = preTaxProfit > 0 ? Math.round(preTaxProfit * effectiveTaxRate) : 0;

  // Deduct end-of-month obligations from company cash and credit founder's personal cash
  const cashSettlement = salaries + founderSalary + rent + maintenance + taxes + interest;
  f.cash -= cashSettlement;
  state.founder.personalCash = Math.round((state.founder.personalCash ?? 0) + founderSalary);

  f.currentMonthSalaries = salaries + founderSalary;
  f.currentMonthRent = rent;
  f.currentMonthMaintenance = maintenance;
  f.currentMonthTaxes = taxes;
  f.currentMonthInterest = interest;

  const totalExpenses =
    salaries +
    founderSalary +
    rent +
    maintenance +
    f.currentMonthMarketing +
    f.currentMonthDevCosts +
    taxes +
    interest;

  const netProfit = Math.round(f.currentMonthRevenue - totalExpenses);
  f.lastMonthNetProfit = netProfit;
  f.cumulativeExpenses = (f.cumulativeExpenses ?? 0) + Math.round(totalExpenses);
  f.cumulativeProfit += netProfit;

  // Update company valuation based on ARR + cash + reputation + investor trust
  const annualizedRev = Math.max(0, f.currentMonthRevenue * 12);
  const trustFactor = 0.8 + clamp(state.founder.investorTrust ?? 55, 0, 100) / 250;
  f.valuation = Math.max(
    15000,
    Math.round(
      (annualizedRev * 3.5 + Math.max(0, f.cash) + state.founder.reputation * 500) * trustFactor
    )
  );

  // Advance B2B contract durations
  for (const contract of state.contracts) {
    if (contract.status === 'ACTIVE') {
      contract.monthsRemaining -= 1;
      if (contract.monthsRemaining <= 0) {
        contract.status = 'COMPLETED';
      }
    }
  }

  // Track financial distress / bankruptcy
  if (f.cash < 0) {
    f.consecutiveNegativeCashMonths += 1;
  } else {
    f.consecutiveNegativeCashMonths = 0;
  }

  if (f.cash < -f.creditLimit) {
    state.screen = 'GAME_OVER';
    state.gameOverReason =
      'Bankruptcy: Cash deficit exceeded your company credit limit after monthly payroll and rent.';
  } else if (f.consecutiveNegativeCashMonths >= 3) {
    state.screen = 'GAME_OVER';
    state.gameOverReason =
      'Insolvency: Three consecutive months in negative cash flow forced company closure.';
  } else if (f.consecutiveNegativeCashMonths > 0) {
    const isVi = getLocale() === 'vi-VN';
    state.notifications.unshift({
      id: `distress_${state.totalDays}`,
      day: state.totalDays,
      message: isVi
        ? `Cảnh báo dòng tiền (${f.consecutiveNegativeCashMonths}/3 tháng âm tiền): Hãy khôi phục tiền mặt dương hoặc dùng hạn mức tín dụng.`
        : `Cash Warning (${f.consecutiveNegativeCashMonths}/3 insolvent months): Recover positive cash or use credit line.`,
      type: 'WARNING',
    });
    state.notifications = state.notifications.slice(0, 24);
  }

  const activeCustomers = state.products.reduce((sum, p) => sum + p.payingCustomers, 0);
  const avgMorale =
    state.employees.length > 0
      ? Math.round(
          state.employees.reduce((sum, e) => sum + e.morale, 0) / state.employees.length
        )
      : 100;

  const isVi = getLocale() === 'vi-VN';
  let summaryNote = isVi
    ? 'Vận hành ổn định trong tháng.'
    : 'Steady operations this month.';
  if (netProfit > 5000) {
    summaryNote = isVi
      ? 'Tháng kinh doanh lãi lớn! Biên lợi nhuận đang mở rộng tích cực.'
      : 'Strong profitable month! Margins are expanding cleanly.';
  } else if (netProfit > 0) {
    summaryNote = isVi
      ? 'Tháng có lãi — doanh thu đã bù đắp toàn bộ lương, thuê văn phòng và vận hành.'
      : 'Profitable month — revenue covered all payroll and overhead.';
  } else if (f.cash < 5000) {
    summaryNote = isVi
      ? 'Dự trữ tiền mặt xuống rất thấp. Hãy đẩy mạnh bán hàng hoặc tối ưu chi phí tiếp thị.'
      : 'Cash runway is critically low. Focus on sales or cut marketing burn.';
  } else {
    summaryNote = isVi
      ? 'Đang lỗ kế hoạch để đầu tư phát triển sản phẩm và mở rộng tập khách hàng.'
      : 'Operating at a net loss while investing in growth and product.';
  }

  const report: MonthlyReport = {
    month: state.month,
    year: state.year,
    revenue: Math.round(f.currentMonthRevenue),
    productRevenue: Math.round(f.currentMonthProductRev),
    contractRevenue: Math.round(f.currentMonthContractRev),
    expenses: Math.round(totalExpenses),
    salaries,
    founderSalary,
    rent,
    maintenance,
    marketing: Math.round(f.currentMonthMarketing),
    devAndMisc: Math.round(f.currentMonthDevCosts),
    taxes,
    interest,
    netProfit,
    endingCash: Math.round(f.cash),
    customersGained: monthCustomersGained,
    customersChurned: monthCustomersChurned,
    activeCustomers,
    headcount: state.employees.length,
    avgMorale,
    summaryNote,
  };

  state.monthlyHistory.push(report);
  state.pendingMonthlyReport = report;

  // Reset monthly accumulators
  f.currentMonthRevenue = 0;
  f.currentMonthProductRev = 0;
  f.currentMonthContractRev = 0;
  f.currentMonthSalaries = 0;
  f.currentMonthRent = 0;
  f.currentMonthMaintenance = 0;
  f.currentMonthMarketing = 0;
  f.currentMonthDevCosts = 0;
  f.currentMonthTaxes = 0;
  f.currentMonthInterest = 0;
  f.currentMonthCustomersGained = 0;
  f.currentMonthCustomersChurned = 0;

  return report;
}
