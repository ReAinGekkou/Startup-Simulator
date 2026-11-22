import { FEATURE_TEMPLATES, PRODUCT_CATEGORIES } from '@/src/game/data/products';
import { GameState, Product, ProductCategory, RevenueModel } from '@/src/types/game';
import { clamp } from '@/src/utils/format';

export function createProductEntity(
  id: string,
  name: string,
  category: ProductCategory,
  revenueModel: RevenueModel,
  initialProgress = 0
): Product {
  const spec = PRODUCT_CATEGORIES[category];
  return {
    id,
    name: name.trim() || `${spec.label} v1`,
    category,
    revenueModel,
    stage: initialProgress > 0 ? 'IN_DEV' : 'CONCEPT',
    developmentProgress: initialProgress,
    quality: 35,
    bugs: initialProgress > 0 ? 2 : 0,
    features: [
      {
        id: `feat_${id}_core`,
        name: FEATURE_TEMPLATES[0].name,
        description: FEATURE_TEMPLATES[0].description,
        effortRequired: FEATURE_TEMPLATES[0].effortRequired,
        effortProgress: Math.round((initialProgress / 100) * FEATURE_TEMPLATES[0].effortRequired),
        cost: 0,
        qualityBoost: 10,
        demandBoost: 8,
        completed: initialProgress >= 100,
        requiredSkill: 'engineering',
      },
    ],
    developmentCostSpent: initialProgress > 0 ? Math.round(spec.baseDevCost * 0.4) : 0,
    monthlyMaintenanceCost: spec.baseMaintenance,
    marketDemand: spec.baseDemand,
    customerSatisfaction: 72,
    activeUsers: 0,
    payingCustomers: 0,
    pricePerCustomer: spec.defaultPrice,
    monthlyRevenue: 0,
    cumulativeRevenue: 0,
    launchDay: null,
    version: 1,
  };
}

export function updateProductsDaily(state: GameState): {
  completedProductNames: string[];
  completedFeatures: string[];
} {
  const completedProductNames: string[] = [];
  const completedFeatures: string[] = [];

  const builders = state.employees.filter(
    (e) => e.assignedTask === 'BUILD_PRODUCT' || e.assignedTask === 'PLAN_ROADMAP'
  );
  const bugFixers = state.employees.filter((e) => e.assignedTask === 'FIX_BUGS');
  const pmBonus = state.employees
    .filter((e) => e.role === 'PRODUCT_MANAGER' && e.assignedTask !== 'REST_BREAK')
    .reduce((acc, e) => acc + e.skills.design * 0.004, 1);

  const engRoomLevel = state.office.rooms.ENGINEERING?.level ?? 1;
  const engRoomBonus = 1 + (engRoomLevel - 1) * 0.08;
  const furnProdBonus =
    1 +
    Math.min(
      0.35,
      state.office.furniture.reduce((sum, f) => sum + f.productivityBonus, 0) * 0.004
    );
  const opsActive = state.employees.some(
    (e) => e.role === 'OPERATIONS_MANAGER' && e.assignedTask !== 'REST_BREAK'
  );

  for (const product of state.products) {
    if (product.stage === 'SUNSET') continue;

    const assignedBuilders = builders.filter(
      (e) => e.assignedProductId === product.id || (!e.assignedProductId && state.products[0]?.id === product.id)
    );
    const assignedFixers = bugFixers.filter(
      (e) => e.assignedProductId === product.id || (!e.assignedProductId && state.products[0]?.id === product.id)
    );

    // Engineering & Design points (including unlocked traits)
    let devEffort = 0;
    let qualityDelta = 0;
    for (const emp of assignedBuilders) {
      const skill = Math.max(emp.skills.engineering, emp.skills.design);
      const traitEffortMult =
        (emp.traits?.includes('EFFICIENT_CODER') ? 1.15 : 1) *
        (emp.traits?.includes('PIXEL_PERFECTIONIST') ? 1.12 : 1);
      const eff =
        skill *
        (emp.productivity / 100) *
        0.34 *
        pmBonus *
        engRoomBonus *
        furnProdBonus *
        traitEffortMult;
      devEffort += eff;
      if (emp.role === 'DESIGNER') {
        qualityDelta += 0.35;
      } else if (emp.role === 'SOFTWARE_ENGINEER') {
        qualityDelta += 0.18;
      }
      if (emp.traits?.includes('PIXEL_PERFECTIONIST')) {
        qualityDelta += 0.25;
      }
    }

    // Small founder contribution if founder has energy
    if (state.founder.energy > 30) {
      devEffort += 3.5 + state.founder.leadership * 0.08;
    }

    const pendingFeature = product.features.find((f) => !f.completed);
    const isActivelyBuilding =
      devEffort > 0 &&
      (product.stage === 'CONCEPT' || product.stage === 'IN_DEV' || Boolean(pendingFeature));

    // Active R&D consumes daily cloud/tooling resources ($35/day)
    if (isActivelyBuilding) {
      const dailyRdCost = 35;
      if (state.finance.cash - dailyRdCost >= -state.finance.creditLimit) {
        state.finance.cash -= dailyRdCost;
        state.finance.currentMonthDevCosts += dailyRdCost;
        product.developmentCostSpent += dailyRdCost;
      } else {
        // Out of credit: development stalls
        devEffort = 0;
      }
    }

    if (devEffort > 0 && (product.stage === 'CONCEPT' || product.stage === 'IN_DEV')) {
      product.stage = 'IN_DEV';
      const progressGain = devEffort * 0.38;
      product.developmentProgress = clamp(
        Number((product.developmentProgress + progressGain).toFixed(1)),
        0,
        100
      );
      product.quality = clamp(Number((product.quality + qualityDelta).toFixed(1)), 10, 99);

      // Chance of introducing a minor bug during rapid dev (reduced by Ops Manager & Systems Virtuoso)
      const virtuosoActive = assignedBuilders.some((e) => e.traits?.includes('SYSTEMS_VIRTUOSO'));
      const bugModulo = (opsActive ? 6 : 4) + (virtuosoActive ? 2 : 0);
      if (progressGain > 8 && product.bugs < 15 && (state.totalDays + product.name.length) % bugModulo === 0) {
        product.bugs += 1;
      }

      if (product.developmentProgress >= 100) {
        if (product.features[0] && !product.features[0].completed) {
          product.features[0].effortProgress = product.features[0].effortRequired;
          product.features[0].completed = true;
        }
        completedProductNames.push(product.name);
      }
    }

    // Advance active incomplete features (especially post-MVP updates)
    if (pendingFeature && devEffort > 0) {
      pendingFeature.effortProgress = Math.min(
        pendingFeature.effortRequired,
        pendingFeature.effortProgress + devEffort
      );
      if (pendingFeature.effortProgress >= pendingFeature.effortRequired) {
        pendingFeature.completed = true;
        product.quality = clamp(product.quality + pendingFeature.qualityBoost, 10, 100);
        product.marketDemand = clamp(product.marketDemand + pendingFeature.demandBoost, 10, 100);
        product.customerSatisfaction = clamp(product.customerSatisfaction + 4, 10, 100);
        completedFeatures.push(`${product.name}: ${pendingFeature.name}`);
      }
    }

    // Bug fixing
    if (assignedFixers.length > 0 && product.bugs > 0) {
      const fixPower = assignedFixers.reduce(
        (acc, e) =>
          acc +
          (e.skills.engineering * (e.productivity / 100)) / 35 +
          (e.traits?.includes('EFFICIENT_CODER') ? 1 : 0),
        0
      );
      const fixed = Math.max(1, Math.floor(fixPower));
      product.bugs = Math.max(0, product.bugs - fixed);
      product.customerSatisfaction = clamp(product.customerSatisfaction + fixed * 1.2, 10, 100);
    }

    // Bug impact on satisfaction for live products
    if (product.stage === 'MVP_LIVE' || product.stage === 'MATURE') {
      if (product.bugs >= 5) {
        product.customerSatisfaction = clamp(product.customerSatisfaction - 1.4, 10, 100);
      } else if (product.bugs === 0 && product.quality >= 65) {
        product.customerSatisfaction = clamp(product.customerSatisfaction + 0.4, 10, 100);
      }
    }
  }

  return { completedProductNames, completedFeatures };
}
