import { MARKETING_CHANNELS } from '@/src/game/data/products';
import { ClientContract, CustomerSegment, GameState } from '@/src/types/game';
import { clamp, seededRandom } from '@/src/utils/format';

const CLIENT_NAMES = [
  'Harbor Retail Group',
  'Summit Logistics',
  'Vanguard Health',
  'BrightPath Edu',
  'Cobalt Fintech',
  'Oakridge Manufacturing',
  'Redwood Media',
  'Metro Civic Systems',
];

export function generateContractOpportunity(state: GameState): ClientContract {
  const rng = seededRandom(state.seed + state.totalDays * 4099 + state.contracts.length * 97);
  const clientName = CLIENT_NAMES[Math.floor(rng() * CLIENT_NAMES.length)];
  const segment: CustomerSegment = rng() > 0.65 ? 'ENTERPRISE' : 'SMB';
  const baseValue = segment === 'ENTERPRISE' ? 2400 + rng() * 2600 : 950 + rng() * 1150;
  const monthlyValue = Math.round(baseValue / 50) * 50;
  const durationMonths = segment === 'ENTERPRISE' ? 6 : 4;
  const requiredQuality = segment === 'ENTERPRISE' ? 58 : 42;

  return {
    id: `ctr_${state.totalDays}_${Math.floor(rng() * 10000)}`,
    clientName,
    segment,
    productId: state.products.find((p) => p.stage === 'MVP_LIVE' || p.stage === 'MATURE')?.id ?? state.products[0]?.id ?? null,
    monthlyValue,
    upfrontBonus: Math.round(monthlyValue * 0.5),
    durationMonths,
    monthsRemaining: durationMonths,
    requiredQuality,
    legalReviewed: false,
    status: 'PIPELINE',
    expiresDay: state.totalDays + 14,
  };
}

export function updateMarketDaily(state: GameState): {
  customersGained: number;
  customersChurned: number;
  dailyRevenue: number;
  pausedCampaigns: string[];
} {
  let customersGained = 0;
  let customersChurned = 0;
  let dailyRevenue = 0;
  const pausedCampaigns: string[] = [];

  const marketers = state.employees.filter((e) => e.assignedTask === 'MARKET_GROWTH');
  const marketingMultiplier =
    1 +
    marketers.reduce(
      (acc, e) =>
        acc +
        (e.skills.marketing * (e.productivity / 100)) / 140 +
        (e.traits?.includes('VIRAL_STRATEGIST') ? 0.25 : 0),
      0
    );

  const salesReps = state.employees.filter((e) => e.assignedTask === 'CLOSE_SALES');
  const salesPower = salesReps.reduce(
    (acc, e) =>
      acc +
      e.skills.sales * (e.productivity / 100) +
      (e.traits?.includes('PERSUASIVE_NEGOTIATOR') ? 20 : 0),
    0
  );

  // Update live products
  for (const product of state.products) {
    if (product.stage !== 'MVP_LIVE' && product.stage !== 'MATURE') {
      product.monthlyRevenue = 0;
      continue;
    }

    // Organic discovery based on quality, demand, reputation
    const organicScore =
      (product.quality * 0.35 +
        product.marketDemand * 0.35 +
        state.founder.reputation * 0.3) /
      100;
    const organicSignups = Math.max(
      0,
      Math.round(organicScore * 2.4 * marketingMultiplier - product.bugs * 0.25)
    );

    // Paid & channel campaigns for this product
    let campaignSignups = 0;
    for (const camp of state.campaigns) {
      if (!camp.active || camp.productId !== product.id) continue;
      if (state.finance.cash < camp.dailyBudget) {
        camp.active = false;
        pausedCampaigns.push(MARKETING_CHANNELS[camp.channel].label);
        continue;
      }

      state.finance.cash -= camp.dailyBudget;
      state.finance.currentMonthMarketing += camp.dailyBudget;
      camp.totalSpent += camp.dailyBudget;
      camp.impressions += Math.round(camp.dailyBudget * 45);

      const channelSpec = MARKETING_CHANNELS[camp.channel];
      const effectiveCac =
        channelSpec.cacBase /
        (marketingMultiplier * (0.75 + product.quality / 140) * camp.effectivenessMultiplier);
      const acquiredFloat = camp.dailyBudget / Math.max(8, effectiveCac);
      const acquired = Math.max(0, Math.round(acquiredFloat));

      camp.customersAcquired += acquired;
      campaignSignups += acquired;

      if (camp.channel === 'SEO' || camp.channel === 'CONTENT_MARKETING') {
        camp.effectivenessMultiplier = clamp(camp.effectivenessMultiplier + 0.015, 1, 2.2);
      }
    }

    const totalNew = organicSignups + campaignSignups;
    const conversionRate =
      product.revenueModel === 'FREEMIUM'
        ? 0.28
        : product.revenueModel === 'SUBSCRIPTION'
          ? 0.68
          : product.revenueModel === 'ONE_TIME'
            ? 0.78
            : 0.52;

    const newPaying = Math.round(totalNew * conversionRate);
    product.activeUsers += totalNew;
    product.payingCustomers += newPaying;
    customersGained += newPaying;

    // Churn calculation
    const baseChurnRate = product.revenueModel === 'ONE_TIME' ? 0.015 : 0.008;
    const dissatisfactionPenalty = Math.max(0, (70 - product.customerSatisfaction) * 0.0005);
    const bugPenalty = product.bugs * 0.0015;
    const churnRate = clamp(baseChurnRate + dissatisfactionPenalty + bugPenalty, 0.002, 0.08);
    const churned = Math.floor(product.payingCustomers * churnRate);

    product.payingCustomers = Math.max(0, product.payingCustomers - churned);
    product.activeUsers = Math.max(product.payingCustomers, product.activeUsers - churned);
    customersChurned += churned;

    // Daily revenue calculation
    let dailyProductRev = 0;
    if (product.revenueModel === 'ONE_TIME') {
      dailyProductRev = newPaying * product.pricePerCustomer + product.payingCustomers * 0.15;
    } else {
      // Monthly price spread across 30 days
      dailyProductRev = (product.payingCustomers * product.pricePerCustomer) / 30;
    }

    product.monthlyRevenue = Math.round(dailyProductRev * 30);
    product.cumulativeRevenue += dailyProductRev;
    dailyRevenue += dailyProductRev;
    state.finance.currentMonthProductRev += dailyProductRev;
  }

  // Active B2B contracts daily revenue
  for (const contract of state.contracts) {
    if (contract.status === 'ACTIVE') {
      const dailyCtrRev = contract.monthlyValue / 30;
      dailyRevenue += dailyCtrRev;
      state.finance.currentMonthContractRev += dailyCtrRev;
    } else if (contract.status === 'PIPELINE' && contract.expiresDay < state.totalDays) {
      contract.status = 'EXPIRED';
    }
  }

  // Auto-generate pipeline contracts periodically if live product exists or sales rep working
  const hasLiveProduct = state.products.some((p) => p.stage === 'MVP_LIVE' || p.stage === 'MATURE');
  const openPipeline = state.contracts.filter((c) => c.status === 'PIPELINE').length;
  if (hasLiveProduct && openPipeline < 3 && (state.totalDays % 6 === 0 || (salesPower > 40 && state.totalDays % 4 === 0))) {
    state.contracts.push(generateContractOpportunity(state));
  }

  // Competitors slowly improve
  for (const comp of state.competitors) {
    if (state.totalDays % 10 === 0) {
      comp.productQuality = clamp(comp.productQuality + comp.aggressiveness * 1.2, 40, 96);
    }
  }

  // Apply daily revenue & customer tracking to ledger
  state.finance.cash += dailyRevenue;
  state.finance.currentMonthRevenue += dailyRevenue;
  state.finance.cumulativeRevenue += dailyRevenue;
  state.finance.currentMonthCustomersGained += customersGained;
  state.finance.currentMonthCustomersChurned += customersChurned;

  return { customersGained, customersChurned, dailyRevenue, pausedCampaigns };
}
