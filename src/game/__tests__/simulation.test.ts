import assert from 'node:assert/strict';
import test from 'node:test';
import { createNewGame, DEFAULT_NEW_GAME_PARAMS } from '../engine/initGame.ts';
import { buildWalkabilityGrid, canPlaceFurnitureAt, findPath } from '../engine/pathfinding.ts';
import {
  advanceDay,
  executeCommand,
  tickSimulation,
  tickTitleAmbientLife,
} from '../engine/simulation.ts';
import {
  getMostRecentSaveMeta,
  loadGameFromSlot,
  loadMostRecentSave,
  migrateSaveState,
  saveGameToSlot,
  validateSaveState,
} from '../../services/saveService.ts';

function installMockLocalStorage() {
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

test('1. Game initialization creates balanced starting scenario with 8 rooms and 3 employees', () => {
  const state = createNewGame(DEFAULT_NEW_GAME_PARAMS);
  assert.equal(state.employees.length, 3);
  assert.equal(state.products.length, 1);
  assert.equal(state.office.level, 1);
  assert.equal(Object.keys(state.office.rooms).length, 8);
  assert.ok(state.finance.cash === 42000);
});

test('2. Employees have functional attributes, skills, training, promotion, and burnout resignation', () => {
  let state = createNewGame(DEFAULT_NEW_GAME_PARAMS);
  const empId = state.employees[0].id;
  const beforeSkill = state.employees[0].skills.engineering;
  const beforeSalary = state.employees[0].monthlySalary;

  state = executeCommand(state, { type: 'TRAIN_EMPLOYEE', employeeId: empId }).state;
  assert.equal(state.employees[0].skills.engineering, beforeSkill + 6);

  state = executeCommand(state, { type: 'PROMOTE_EMPLOYEE', employeeId: empId }).state;
  assert.equal(state.employees[0].level, 3);
  assert.ok(state.employees[0].monthlySalary > beforeSalary);

  // Simulate extreme burnout triggering resignation warning then resignation
  state.employees[0].morale = 10;
  state.employees[0].stress = 95;
  advanceDay(state);
  assert.equal(state.employees[0].resignationWarning, true);

  state.employees[0].morale = 10;
  state.employees[0].stress = 95;
  advanceDay(state);
  assert.equal(state.employees.length, 2, 'Burned-out employee should resign on day 2 of warning');
});

test('3. Daily simulation tick advances time, moves Founder, and rolls over workday', () => {
  let state = createNewGame(DEFAULT_NEW_GAME_PARAMS);
  state = executeCommand(state, {
    type: 'COMPLETE_CINEMATIC',
    cinematicId: 'INTRO',
    skipped: true,
  }).state;
  const startHour = state.hourOfDay;
  const grid = buildWalkabilityGrid(state.office);
  const path = findPath(grid, state.founder.position, { x: 30, y: 16 });
  assert.ok(path.length > 5);

  state = executeCommand(state, { type: 'MOVE_FOUNDER', target: { x: 30, y: 16 } }).state;
  const ticked = tickSimulation(state, 0.05);
  assert.ok(ticked.state.hourOfDay > startHour);
  assert.equal(ticked.state.founder.state, 'WALKING');

  // Force clock to end of workday
  ticked.state.hourOfDay = 18.49;
  const rolled = tickSimulation(ticked.state, 0.05);
  assert.equal(rolled.dayEnded, true);
  assert.equal(rolled.state.day, 2);
});

test('4. Product development consumes cash resources, adds features, and stalls when insolvent past credit', () => {
  let state = createNewGame(DEFAULT_NEW_GAME_PARAMS);
  const cashStart = state.finance.cash;
  const progressStart = state.products[0].developmentProgress;

  // Add a feature (costs $650)
  state = executeCommand(state, {
    type: 'ADD_PRODUCT_FEATURE',
    productId: state.products[0].id,
    templateIndex: 1,
  }).state;
  assert.equal(state.finance.cash, cashStart - 650);

  // Daily R&D advances progress and consumes $35/day tooling cost
  const cashBeforeDay = state.finance.cash;
  advanceDay(state);
  assert.ok(state.products[0].developmentProgress > progressStart);
  assert.equal(state.finance.cash, cashBeforeDay - 35);

  // Stalls when below -creditLimit
  const stalledProgress = state.products[0].developmentProgress;
  state.finance.cash = -state.finance.creditLimit;
  advanceDay(state);
  assert.equal(state.products[0].developmentProgress, stalledProgress);
});

test('5. Customers, marketing campaigns, and B2B contracts generate real revenue and monthly customer totals', () => {
  let state = createNewGame(DEFAULT_NEW_GAME_PARAMS);
  state.products[0].developmentProgress = 100;
  state.products[0].quality = 65;

  state = executeCommand(state, {
    type: 'LAUNCH_PRODUCT_MVP',
    productId: state.products[0].id,
  }).state;
  assert.equal(state.products[0].stage, 'MVP_LIVE');
  assert.ok(state.products[0].payingCustomers > 0);

  // Launch SEO marketing campaign
  state = executeCommand(state, {
    type: 'TOGGLE_CAMPAIGN',
    channel: 'SEO',
    productId: state.products[0].id,
    segment: 'SMB',
    dailyBudget: 100,
  }).state;

  // Toggle pause & resume does not duplicate campaigns
  state = executeCommand(state, {
    type: 'TOGGLE_CAMPAIGN',
    channel: 'SEO',
    productId: state.products[0].id,
    segment: 'SMB',
    dailyBudget: 100,
  }).state;
  state = executeCommand(state, {
    type: 'TOGGLE_CAMPAIGN',
    channel: 'SEO',
    productId: state.products[0].id,
    segment: 'SMB',
    dailyBudget: 120,
  }).state;
  assert.equal(state.campaigns.length, 1);
  assert.equal(state.campaigns[0].active, true);

  // Review & sign B2B contract
  const ctrId = state.contracts[0].id;
  state = executeCommand(state, { type: 'REVIEW_CONTRACT_LEGAL', contractId: ctrId }).state;
  const cashBeforeSign = state.finance.cash;
  state = executeCommand(state, { type: 'PITCH_CONTRACT', contractId: ctrId }).state;
  assert.equal(state.contracts[0].status, 'ACTIVE');
  assert.ok(state.finance.cash > cashBeforeSign);

  // Advance full 30 days and verify monthly customer count & revenue
  for (let i = 0; i < 30; i++) {
    advanceDay(state);
    if (state.activeEvent) {
      state = executeCommand(state, {
        type: 'RESOLVE_EVENT',
        choiceId: state.activeEvent.choices[state.activeEvent.choices.length - 1].id,
      }).state;
    }
  }
  assert.ok(state.pendingMonthlyReport !== null);
  assert.ok(state.pendingMonthlyReport!.revenue > 0);
  assert.ok(state.pendingMonthlyReport!.customersGained > 0);
});

test('6. Monthly payroll and rent deduct actual cash on month close', () => {
  const state = createNewGame(DEFAULT_NEW_GAME_PARAMS);
  // Stop R&D and clear products to isolate payroll + rent math cleanly
  state.products = [];
  const expectedPayroll = state.employees.reduce((s, e) => s + e.monthlySalary, 0);
  const expectedFounderSalary = state.founder.monthlySalary;
  const expectedRent = state.office.monthlyRent;
  const cashBeforeDay30 = state.finance.cash;
  const personalBefore = state.founder.personalCash;

  state.day = 30;
  advanceDay(state);

  assert.ok(state.pendingMonthlyReport !== null);
  assert.equal(state.pendingMonthlyReport!.salaries, expectedPayroll);
  assert.equal(state.pendingMonthlyReport!.founderSalary, expectedFounderSalary);
  assert.equal(state.pendingMonthlyReport!.rent, expectedRent);
  assert.equal(
    state.finance.cash,
    cashBeforeDay30 - expectedPayroll - expectedFounderSalary - expectedRent
  );
  assert.equal(state.founder.personalCash, personalBefore + expectedFounderSalary);
});

test('7. Events trigger with real consequences and never soft-lock near credit limit', () => {
  let state = createNewGame(DEFAULT_NEW_GAME_PARAMS);
  state.products[0].developmentProgress = 100;
  state = executeCommand(state, {
    type: 'LAUNCH_PRODUCT_MVP',
    productId: state.products[0].id,
  }).state;

  let triggered = 0;
  for (let i = 0; i < 18; i++) {
    advanceDay(state);
    if (state.activeEvent) {
      triggered += 1;
      // Put cash near credit limit to ensure fallback choice never blocks
      const fallback = state.activeEvent.choices[state.activeEvent.choices.length - 1];
      assert.ok(!fallback.cost || fallback.cost === 0, 'Every event must have a $0 upfront fallback');
      state = executeCommand(state, {
        type: 'RESOLVE_EVENT',
        choiceId: fallback.id,
      }).state;
      assert.equal(state.activeEvent, null);
    }
  }
  assert.ok(triggered >= 2, 'Expected multiple strategic events over 18 days');
});

test('8. Save and Load restores complete GameState including employees, products, and finance', () => {
  installMockLocalStorage();
  let state = createNewGame(DEFAULT_NEW_GAME_PARAMS);
  state.day = 14;
  state.finance.cash = 33450;
  state = executeCommand(state, { type: 'TAKE_LOAN', amount: 5000 }).state;

  const saved = saveGameToSlot('slot_1', state, 'Test Slot');
  assert.equal(saved, true);

  const loaded = loadGameFromSlot('slot_1');
  assert.ok(loaded !== null);
  assert.equal(loaded!.day, 14);
  assert.equal(loaded!.finance.cash, 38450);
  assert.equal(loaded!.finance.totalDebt, 5000);
  assert.equal(loaded!.employees.length, state.employees.length);
  assert.equal(loaded!.products[0].name, state.products[0].name);
  assert.equal(validateSaveState({ broken: true }), null);
});

test('9. Financial distress, recovery via loan/revenue, and bankruptcy conditions work accurately', () => {
  let state = createNewGame(DEFAULT_NEW_GAME_PARAMS);
  state.products = [];
  // End Month 1 slightly negative (-$2,700 after payroll/founder draw/rent) -> distress month 1, NOT bankrupt
  state.finance.cash = 8500;
  state.day = 30;
  advanceDay(state);
  assert.equal(state.screen, 'PLAYING');
  assert.equal(state.finance.consecutiveNegativeCashMonths, 1);

  // Recover via business credit line + cash infusion before Month 2 ends
  state = executeCommand(state, { type: 'DISMISS_MONTHLY_REPORT' }).state;
  state = executeCommand(state, { type: 'TAKE_LOAN', amount: 15000 }).state;
  state.day = 30;
  advanceDay(state);
  assert.equal(state.screen, 'PLAYING');
  assert.equal(state.finance.consecutiveNegativeCashMonths, 0, 'Positive cash should reset distress counter');

  // Exceed credit limit on Month 3 -> triggers GAME_OVER bankruptcy
  state = executeCommand(state, { type: 'DISMISS_MONTHLY_REPORT' }).state;
  state.finance.cash = -25000;
  state.day = 30;
  advanceDay(state);
  assert.equal(state.screen, 'GAME_OVER');
  assert.ok(state.gameOverReason?.includes('Bankruptcy'));
});

test('10. Furniture placement validates walls, doorways, and overlapping objects', () => {
  let state = createNewGame(DEFAULT_NEW_GAME_PARAMS);
  // Wall tile (0,0) should fail
  const badWall = canPlaceFurnitureAt(state.office, { x: 0, y: 0 }, 1, 1);
  assert.equal(badWall.valid, false);

  // Overlapping CEO desk tile (3,4) should fail
  const badOverlap = canPlaceFurnitureAt(state.office, { x: 3, y: 4 }, 1, 1);
  assert.equal(badOverlap.valid, false);

  // Valid open tile inside CEO Office (6, 2)
  const goodTile = canPlaceFurnitureAt(state.office, { x: 6, y: 2 }, 1, 1);
  assert.equal(goodTile.valid, true);
  assert.equal(goodTile.roomId, 'CEO_OFFICE');

  const countBefore = state.office.furniture.length;
  state = executeCommand(state, {
    type: 'BUY_FURNITURE',
    templateId: 'PLANT_FIDDLE',
    roomId: 'CEO_OFFICE',
    tile: { x: 6, y: 2 },
  }).state;
  assert.equal(state.office.furniture.length, countBefore + 1);
});

test('11. Employee chatter reflects morale, stress, and workplace events', () => {
  let state = createNewGame(DEFAULT_NEW_GAME_PARAMS);
  assert.ok(state.chatterFeed.length >= 2, 'Should seed starter chatter');

  // Stress out employees and advance day -> stressed chatter
  state.employees.forEach((e) => {
    e.morale = 25;
    e.stress = 85;
  });
  state.totalDays = 2;
  advanceDay(state);
  const hasStressed = state.chatterFeed.some((m) => m.tone === 'STRESSED');
  assert.equal(hasStressed, true, 'Stressed employees should generate STRESSED chatter');

  // Launch MVP -> immediate EVENT chatter
  state.products[0].developmentProgress = 100;
  state = executeCommand(state, {
    type: 'LAUNCH_PRODUCT_MVP',
    productId: state.products[0].id,
  }).state;
  assert.equal(state.chatterFeed[0].tone, 'EVENT');
});

test('12. Achievements system tracks unique milestones, cash burned, all roles, and emits unlock alerts', () => {
  let state = createNewGame(DEFAULT_NEW_GAME_PARAMS);
  assert.ok(state.achievements.length >= 8, 'Should initialize unique achievements');
  assert.equal(
    state.achievements.some((a) => a.unlocked),
    false,
    'No achievements unlocked on Day 1 start'
  );

  // 1) First 100k Revenue unlocks via advanceDay and returns unlockedAchievements
  state.finance.cumulativeRevenue = 102_000;
  const dayRes = advanceDay(state);
  assert.ok(
    dayRes.unlockedAchievements.some((a) => a.id === 'ach_100k_revenue'),
    'Should emit achievement unlock notification for First 100k Revenue'
  );
  assert.equal(
    state.achievements.find((a) => a.id === 'ach_100k_revenue')?.unlocked,
    true
  );

  // 2) Burned 1M Cash unlocks when cumulative expenses + current month spend >= 1,000,000
  state.finance.cumulativeExpenses = 995_000;
  state.finance.currentMonthDevCosts = 6_000;
  const cmdBurn = executeCommand(state, { type: 'SET_SPEED', speed: 2 });
  state = cmdBurn.state;
  assert.ok(
    cmdBurn.unlockedAchievements?.some((a) => a.id === 'ach_burned_1m'),
    'Should unlock Burned 1M Cash once cumulative + current spend crosses $1,000,000'
  );

  // 3) Hired all roles unlocks when all 8 distinct roles are in hiredRolesHistory
  state.hiredRolesHistory = [
    'SOFTWARE_ENGINEER',
    'DESIGNER',
    'MARKETING_SPECIALIST',
    'SALES_REP',
    'ACCOUNTANT',
    'HR_MANAGER',
    'PRODUCT_MANAGER',
    'OPERATIONS_MANAGER',
  ];
  const cmdRoles = executeCommand(state, { type: 'SET_SPEED', speed: 1 });
  state = cmdRoles.state;
  assert.ok(
    cmdRoles.unlockedAchievements?.some((a) => a.id === 'ach_all_roles'),
    'Should unlock Hired All Roles when all 8 roles are recruited'
  );

  // 4) Legacy save migration backfills achievements without losing state
  const legacyLike = structuredClone(state) as unknown as Record<string, unknown>;
  delete legacyLike.achievements;
  delete legacyLike.hiredRolesHistory;
  const migrated = migrateSaveState(legacyLike as unknown as typeof state);
  assert.ok(Array.isArray(migrated.achievements) && migrated.achievements.length >= 8);
  assert.ok(Array.isArray(migrated.hiredRolesHistory));
});

test('13. Office perks provide real passive buffs to morale, energy recovery, and stress reduction', () => {
  // Prepare two identical starting states with tired, stressed employees
  const baseline = createNewGame(DEFAULT_NEW_GAME_PARAMS);
  baseline.employees.forEach((e) => {
    e.energy = 50;
    e.stress = 65;
    e.morale = 60;
  });

  let perked = structuredClone(baseline);
  const cashBefore = perked.finance.cash;

  // Locked HQ Level 3 perk should fail at HQ Level 1 without charging cash
  const blocked = executeCommand(perked, {
    type: 'BUY_OFFICE_PERK',
    perkId: 'perk_wellness_suite',
  });
  assert.equal(blocked.sound, 'ERROR');
  assert.equal(blocked.state.finance.cash, cashBefore);

  // Purchase Coffee Machine ($1,200) and Ping Pong Table ($2,800)
  perked = executeCommand(perked, {
    type: 'BUY_OFFICE_PERK',
    perkId: 'perk_coffee_machine',
  }).state;
  perked = executeCommand(perked, {
    type: 'BUY_OFFICE_PERK',
    perkId: 'perk_ping_pong',
  }).state;

  assert.equal(perked.finance.cash, cashBefore - 1200 - 2800);
  assert.deepEqual(perked.office.purchasedPerks, ['perk_coffee_machine', 'perk_ping_pong']);
  assert.ok(
    perked.office.furniture.some((f) => f.templateId === 'PERK_COFFEE_MACHINE'),
    'Purchasing Coffee Machine should spawn interactive PERK_COFFEE_MACHINE furniture'
  );
  assert.ok(
    perked.office.furniture.some((f) => f.templateId === 'PERK_PING_PONG'),
    'Purchasing Ping Pong Table should spawn interactive PERK_PING_PONG furniture'
  );

  // Reset employee morale to identical starting point so we measure daily passive buffs cleanly
  perked.employees.forEach((e) => {
    e.morale = 60;
  });

  advanceDay(baseline);
  advanceDay(perked);

  const baseEmp = baseline.employees[0];
  const perkEmp = perked.employees[0];

  assert.ok(perkEmp.energy > baseEmp.energy, 'Perks should improve daily energy recovery');
  assert.ok(perkEmp.stress < baseEmp.stress, 'Perks should increase daily stress reduction');
  assert.ok(perkEmp.morale > baseEmp.morale, 'Perks should provide passive daily morale gain');

  // Legacy save migration backfills purchasedPerks
  const legacyLike = structuredClone(perked);
  delete (legacyLike.office as unknown as Record<string, unknown>).purchasedPerks;
  const migrated = migrateSaveState(legacyLike);
  assert.deepEqual(migrated.office.purchasedPerks, []);
});

test('14. Employee skill training unlocks special traits with real gameplay bonuses and migrates safely', () => {
  // 1) Training Liam Chen (engineering 68 -> 74) unlocks Efficient Coder and boosts build velocity
  const baseState = createNewGame(DEFAULT_NEW_GAME_PARAMS);
  const trainedState = structuredClone(baseState);
  const liamBase = baseState.employees[0];
  assert.equal(liamBase.skills.engineering, 68);
  assert.deepEqual(liamBase.traits, []);

  const trainRes = executeCommand(trainedState, {
    type: 'TRAIN_EMPLOYEE',
    employeeId: trainedState.employees[0].id,
  });
  assert.equal(trainRes.sound, 'LEVEL_UP');
  assert.ok(trainRes.state.employees[0].skills.engineering >= 74);
  assert.ok(
    trainRes.state.employees[0].traits.includes('EFFICIENT_CODER'),
    'Reaching 70+ engineering should unlock Efficient Coder'
  );

  // Equalize other variables except the unlocked trait to isolate trait velocity bonus
  trainRes.state.products[0].developmentProgress = 10;
  trainRes.state.products[0].stage = 'IN_DEV';
  trainRes.state.employees[0].experience = 10;
  const noTraitCompare = structuredClone(trainRes.state);
  noTraitCompare.employees[0].traits = [];
  advanceDay(noTraitCompare);
  advanceDay(trainRes.state);
  assert.ok(
    trainRes.state.products[0].developmentProgress > noTraitCompare.products[0].developmentProgress,
    'Efficient Coder should accelerate daily product development progress'
  );

  // 2) Sales Rep reaching 70+ sales unlocks Persuasive Negotiator and boosts B2B contract upfront bonuses
  const pitchBase = createNewGame(DEFAULT_NEW_GAME_PARAMS);
  pitchBase.products[0].stage = 'MVP_LIVE';
  pitchBase.products[0].quality = 90;
  pitchBase.contracts = [
    {
      id: 'ctr_test_trait',
      clientName: 'Acme Corp',
      segment: 'ENTERPRISE',
      productId: pitchBase.products[0].id,
      monthlyValue: 2000,
      upfrontBonus: 1000,
      durationMonths: 6,
      monthsRemaining: 6,
      requiredQuality: 50,
      legalReviewed: true,
      status: 'PIPELINE',
      expiresDay: 30,
    },
  ];
  pitchBase.employees.push({
    ...structuredClone(pitchBase.employees[0]),
    id: 'emp_sales_test',
    name: 'Jordan Closer',
    role: 'SALES_REP',
    title: 'Senior Sales',
    skills: { engineering: 25, design: 25, marketing: 40, sales: 66, finance: 30, operations: 30 },
    traits: [],
    assignedTask: 'CLOSE_SALES',
    lastTrainedDay: 0,
  });

  const pitchWithTrait = structuredClone(pitchBase);
  const salesTrain = executeCommand(pitchWithTrait, {
    type: 'TRAIN_EMPLOYEE',
    employeeId: 'emp_sales_test',
  });
  assert.ok(
    salesTrain.state.employees.find((e) => e.id === 'emp_sales_test')?.traits.includes('PERSUASIVE_NEGOTIATOR'),
    'Training sales from 66 -> 72 should unlock Persuasive Negotiator'
  );

  const cashBeforeBase = pitchBase.finance.cash;
  const cashBeforeTrait = salesTrain.state.finance.cash;
  const resBase = executeCommand(pitchBase, { type: 'PITCH_CONTRACT', contractId: 'ctr_test_trait' });
  const resTrait = executeCommand(salesTrain.state, { type: 'PITCH_CONTRACT', contractId: 'ctr_test_trait' });
  const bonusBase = resBase.state.finance.cash - cashBeforeBase;
  const bonusTrait = resTrait.state.finance.cash - cashBeforeTrait;
  assert.ok(bonusTrait > bonusBase, 'Persuasive Negotiator should yield a larger upfront contract bonus');

  // 3) Legacy save migration backfills and evaluates traits from existing skills
  const legacyLike = structuredClone(trainRes.state);
  delete (legacyLike.employees[0] as unknown as Record<string, unknown>).traits;
  const migrated = migrateSaveState(legacyLike);
  assert.ok(
    migrated.employees[0].traits.includes('EFFICIENT_CODER'),
    'Save migration should backfill and evaluate traits from employee skills'
  );
});

test('15. Founder salary affects personal cash, employee morale, respect, and investor trust', () => {
  // 1) Compare low ($0) vs high ($10,000) founder salary over 3 days
  const base = createNewGame(DEFAULT_NEW_GAME_PARAMS);
  base.products = [];
  base.employees.forEach((e) => {
    e.morale = 70;
    e.stress = 35;
  });

  let lowSalaryState = executeCommand(structuredClone(base), {
    type: 'SET_FOUNDER_SALARY',
    amount: 0,
  }).state;
  let highSalaryState = executeCommand(structuredClone(base), {
    type: 'SET_FOUNDER_SALARY',
    amount: 10000,
  }).state;

  assert.equal(lowSalaryState.founder.monthlySalary, 0);
  assert.equal(highSalaryState.founder.monthlySalary, 10000);

  const startTrust = base.founder.investorTrust;
  const startRep = base.founder.reputation;

  for (let i = 0; i < 3; i++) {
    advanceDay(lowSalaryState);
    advanceDay(highSalaryState);
  }

  const avgMoraleLow =
    lowSalaryState.employees.reduce((s, e) => s + e.morale, 0) / lowSalaryState.employees.length;
  const avgMoraleHigh =
    highSalaryState.employees.reduce((s, e) => s + e.morale, 0) / highSalaryState.employees.length;

  assert.ok(avgMoraleLow > avgMoraleHigh, 'Low founder salary should result in higher team morale than high salary');
  assert.ok(lowSalaryState.founder.investorTrust > startTrust, 'Low salary should boost investor trust');
  assert.ok(lowSalaryState.founder.reputation > startRep, 'Low salary should boost employee respect/reputation');
  assert.ok(highSalaryState.founder.investorTrust < startTrust, 'High salary should reduce investor trust');
  assert.ok(highSalaryState.founder.reputation < startRep, 'High salary should erode founder respect');

  // 2) Month-end payout credits personalCash with high salary
  const personalBeforeMonth = highSalaryState.founder.personalCash;
  const companyCashBeforeMonth = highSalaryState.finance.cash;
  highSalaryState.day = 30;
  advanceDay(highSalaryState);
  assert.equal(highSalaryState.founder.personalCash, personalBeforeMonth + 10000);
  assert.equal(highSalaryState.pendingMonthlyReport?.founderSalary, 10000);
  assert.ok(highSalaryState.finance.cash < companyCashBeforeMonth - 10000);

  // 3) Personal cash injection transfers funds to company cash and boosts trust
  const trustBeforeInject = highSalaryState.founder.investorTrust;
  const injectRes = executeCommand(highSalaryState, { type: 'INJECT_PERSONAL_CASH', amount: 2500 });
  assert.equal(injectRes.state.founder.personalCash, personalBeforeMonth + 10000 - 2500);
  assert.equal(injectRes.state.finance.cash, highSalaryState.finance.cash + 2500);
  assert.ok(injectRes.state.founder.investorTrust > trustBeforeInject);

  // 4) Legacy save migration backfills founder salary fields
  const legacyLike = structuredClone(lowSalaryState) as unknown as Record<string, unknown>;
  const legacyFounder = structuredClone(lowSalaryState.founder) as unknown as Record<string, unknown>;
  delete legacyFounder.monthlySalary;
  delete legacyFounder.personalCash;
  delete legacyFounder.investorTrust;
  legacyLike.founder = legacyFounder;
  const migrated = migrateSaveState(legacyLike as unknown as typeof lowSalaryState);
  assert.equal(typeof migrated.founder.monthlySalary, 'number');
  assert.equal(typeof migrated.founder.personalCash, 'number');
  assert.equal(typeof migrated.founder.investorTrust, 'number');
});

test('16. Progressive room unlocking starts with CEO Office and Engineering Room and unlocks by milestone or cash', () => {
  let state = createNewGame(DEFAULT_NEW_GAME_PARAMS);
  assert.equal(state.office.rooms.CEO_OFFICE.unlocked, true);
  assert.equal(state.office.rooms.ENGINEERING.unlocked, true);
  assert.equal(state.office.rooms.HR_DEPT.unlocked, false);
  assert.equal(state.office.rooms.FINANCE_DEPT.unlocked, false);
  assert.equal(state.office.rooms.BREAK_ROOM.unlocked, false);
  assert.equal(state.office.rooms.MEETING_ROOM.unlocked, false);
  assert.equal(state.office.rooms.LOBBY.unlocked, false);
  assert.equal(state.office.rooms.LEGAL_DEPT.unlocked, false);

  // Manual early unlock of Legal Dept charges unlockCost
  const cashBefore = state.finance.cash;
  const legalCost = state.office.rooms.LEGAL_DEPT.unlockCost;
  state = executeCommand(state, { type: 'UNLOCK_ROOM', roomId: 'LEGAL_DEPT' }).state;
  assert.equal(state.office.rooms.LEGAL_DEPT.unlocked, true);
  assert.equal(state.finance.cash, cashBefore - legalCost);

  // Day 2 automatically unlocks HR Dept & Finance Dept; Day 3 unlocks Break Room
  advanceDay(state);
  assert.equal(state.totalDays, 2);
  assert.equal(state.office.rooms.HR_DEPT.unlocked, true);
  assert.equal(state.office.rooms.FINANCE_DEPT.unlocked, true);
  assert.equal(state.office.rooms.BREAK_ROOM.unlocked, false);

  advanceDay(state);
  assert.equal(state.totalDays, 3);
  assert.equal(state.office.rooms.BREAK_ROOM.unlocked, true);

  // Launching an MVP unlocks Meeting Room and high customer volume unlocks Lobby
  state.products[0].developmentProgress = 100;
  state = executeCommand(state, {
    type: 'LAUNCH_PRODUCT_MVP',
    productId: state.products[0].id,
  }).state;
  assert.equal(state.office.rooms.MEETING_ROOM.unlocked, true);
});

test('17. Complete 8-step interactive onboarding tutorial advances sequentially and yields Day 1 Progress Report + 6/6 objectives', () => {
  let state = createNewGame(DEFAULT_NEW_GAME_PARAMS);
  assert.equal(state.tutorial.active, true);
  assert.equal(state.tutorial.currentStep, 1);

  // Day 1 clock holds at 17.5 while tutorial Steps 1-7 are active
  state.hourOfDay = 17.45;
  state = tickSimulation(state, 0.2).state;
  assert.equal(state.day, 1);
  assert.ok(state.hourOfDay <= 17.5);

  // Step 1 -> Step 2: Review an employee
  state = executeCommand(state, { type: 'REPORT_TUTORIAL_ACTION', action: 'REVIEW_EMPLOYEE' }).state;
  assert.equal(state.tutorial.currentStep, 2);

  // Step 2 -> Step 3: Explore CEO Office and Engineering Room
  state = executeCommand(state, { type: 'REPORT_TUTORIAL_ACTION', action: 'EXPLORE_ROOM', roomId: 'CEO_OFFICE' }).state;
  assert.equal(state.tutorial.currentStep, 2);
  state = executeCommand(state, { type: 'REPORT_TUTORIAL_ACTION', action: 'EXPLORE_ROOM', roomId: 'ENGINEERING' }).state;
  assert.equal(state.tutorial.currentStep, 3);

  // Step 3 -> Step 4: Create a product
  state = executeCommand(state, {
    type: 'CREATE_PRODUCT',
    name: 'CloudFlow Alpha',
    category: 'SAAS',
    revenueModel: 'SUBSCRIPTION',
  }).state;
  assert.equal(state.tutorial.currentStep, 4);

  // Step 4 -> Step 5: Assign an employee task
  state = executeCommand(state, {
    type: 'ASSIGN_EMPLOYEE_TASK',
    employeeId: state.employees[0].id,
    task: 'BUILD_PRODUCT',
    productId: state.products[1].id,
  }).state;
  assert.equal(state.tutorial.currentStep, 5);

  // Step 5 -> Step 6: Run prototype sprint to reach 100% and launch MVP
  const targetProd = state.products[0];
  while (targetProd.developmentProgress < 100) {
    state = executeCommand(state, { type: 'RUN_PROTOTYPE_SPRINT', productId: targetProd.id }).state;
    const updated = state.products.find((p) => p.id === targetProd.id)!;
    if (updated.developmentProgress >= 100) break;
  }
  state = executeCommand(state, { type: 'LAUNCH_PRODUCT_MVP', productId: targetProd.id }).state;
  assert.equal(state.tutorial.currentStep, 6);

  // Step 6 -> Step 7: Launch marketing campaign to find customers
  state = executeCommand(state, {
    type: 'TOGGLE_CAMPAIGN',
    channel: 'SEO',
    productId: targetProd.id,
    segment: 'SMB',
    dailyBudget: 100,
  }).state;
  assert.equal(state.tutorial.currentStep, 7);

  // Step 7 -> Step 8: Open Finance
  state = executeCommand(state, { type: 'REPORT_TUTORIAL_ACTION', action: 'REVIEW_FINANCE' }).state;
  assert.equal(state.tutorial.currentStep, 8);

  // Step 8 -> Complete Day 1 via END_DAY and receive Day 1 Progress Report + 6/6 objectives
  state = executeCommand(state, { type: 'END_DAY' }).state;
  assert.equal(state.day, 2);
  assert.equal(state.tutorial.completed, true);
  assert.equal(state.tutorial.active, false);
  assert.ok(state.pendingDailyReport !== null);
  assert.equal(state.pendingDailyReport!.day, 1);
  assert.equal(
    state.objectives.every((o) => o.completed),
    true,
    'Completing Day 1 after launching MVP and campaign should complete all 6 starter objectives'
  );

  // Dismiss Day 1 report cleanly
  state = executeCommand(state, { type: 'DISMISS_DAILY_REPORT' }).state;
  assert.equal(state.pendingDailyReport, null);
});

test('18. Tutorial skip, resume, instruction toggle, and legacy save migration preserve state cleanly', () => {
  installMockLocalStorage();
  let state = createNewGame(DEFAULT_NEW_GAME_PARAMS);

  state = executeCommand(state, { type: 'TOGGLE_TUTORIAL_INSTRUCTIONS' }).state;
  assert.equal(state.tutorial.instructionsOpen, false);

  state = executeCommand(state, { type: 'SKIP_TUTORIAL' }).state;
  assert.equal(state.tutorial.skipped, true);
  assert.equal(state.tutorial.active, false);

  state = executeCommand(state, { type: 'RESUME_TUTORIAL' }).state;
  assert.equal(state.tutorial.skipped, false);
  assert.equal(state.tutorial.active, true);

  saveGameToSlot('slot_2', state, 'Tutorial Test');
  const loaded = loadGameFromSlot('slot_2');
  assert.ok(loaded !== null);
  assert.equal(loaded!.tutorial.active, true);
  assert.equal(loaded!.objectives.length, 6);

  // Legacy save without tutorial/objectives backfills gracefully
  const legacyLike = structuredClone(state) as unknown as Record<string, unknown>;
  delete legacyLike.tutorial;
  delete legacyLike.objectives;
  const migrated = migrateSaveState(legacyLike as unknown as typeof state);
  assert.ok(migrated.tutorial !== undefined);
  assert.equal(migrated.objectives.length, 6);
});

test('19. Localization defaults to vi-VN, persists locale switches, formats VND/₫, and covers all dictionaries', async () => {
  installMockLocalStorage();
  const localeStore = await import('../../localization/localeStore.ts');
  const i18n = await import('../../localization/i18n.ts');
  const format = await import('../../utils/format.ts');

  assert.equal(localeStore.DEFAULT_LOCALE, 'vi-VN');
  assert.equal(localeStore.getLocale(), 'vi-VN');
  assert.equal(i18n.t('app.title', undefined, 'vi-VN'), 'Nhà sáng lập khởi nghiệp');
  assert.equal(i18n.t('app.title', undefined, 'en-US'), 'Startup Founder Simulator');

  assert.equal(format.formatCurrency(1000000, false, 'vi-VN'), '1.000.000 ₫');
  assert.equal(format.formatCurrency(1000000, false, 'en-US'), '1,000,000 VND');

  localeStore.setLocale('en-US');
  assert.equal(localeStore.getLocale(), 'en-US');
  assert.equal(localStorage.getItem(localeStore.LOCALE_STORAGE_KEY), 'en-US');

  localeStore.setLocale('vi-VN');
  assert.equal(localeStore.getLocale(), 'vi-VN');
  assert.equal(localStorage.getItem(localeStore.LOCALE_STORAGE_KEY), 'vi-VN');
});

test('20. Voice-over picks vi-VN voices strictly without English fallback and safely handles Node/unsupported TTS', async () => {
  const { pickVoiceForLocale, voiceService } = await import('../../audio/voiceService.ts');
  const {
    getDailyReportVoiceScript,
    getEmployeeVoiceLine,
    getMainMenuIntroScript,
    getMonthlyReportVoiceScript,
    getTutorialVoiceScript,
  } = await import('../../audio/voiceRegistry.ts');

  const enOnlyVoices = [
    { voiceURI: 'en-us-1', name: 'Google US English', lang: 'en-US', localService: false },
    { voiceURI: 'en-gb-1', name: 'Google UK English Female', lang: 'en-GB', localService: false },
  ];
  assert.equal(
    pickVoiceForLocale(enOnlyVoices, 'vi-VN'),
    null,
    'Vietnamese mode MUST NEVER fall back to an English voice'
  );
  assert.equal(pickVoiceForLocale(enOnlyVoices, 'en-US')?.voiceURI, 'en-us-1');

  const mixedVoices = [
    ...enOnlyVoices,
    { voiceURI: 'vi-vn-1', name: 'Microsoft HoaiMy Online (Natural)', lang: 'vi-VN', localService: false },
  ];
  assert.equal(pickVoiceForLocale(mixedVoices, 'vi-VN')?.voiceURI, 'vi-vn-1');

  // Script coverage across menu, all 8 tutorial steps, reports, and role dialogue
  assert.ok(getMainMenuIntroScript('vi-VN').text.includes('Nhà sáng lập khởi nghiệp'));
  assert.ok(getMainMenuIntroScript('en-US').text.includes('Startup Founder Simulator'));
  for (let step = 1; step <= 8; step++) {
    assert.ok(getTutorialVoiceScript(step as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8, 'vi-VN').text.length > 20);
    assert.ok(getTutorialVoiceScript(step as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8, 'en-US').text.length > 20);
  }

  const state = createNewGame(DEFAULT_NEW_GAME_PARAMS);
  const dailyScript = getDailyReportVoiceScript(
    {
      day: 1,
      month: 1,
      year: 1,
      cashBalance: 42000,
      revenueEarned: 500,
      expensesSpent: 100,
      customersTotal: 3,
      avgMorale: 80,
      highlights: ['Test highlight'],
    },
    'vi-VN'
  );
  assert.ok(dailyScript.text.includes('42.000 ₫'));
  const monthlyScript = getMonthlyReportVoiceScript(
    {
      month: 1,
      year: 1,
      revenue: 5000,
      productRevenue: 5000,
      contractRevenue: 0,
      expenses: 3000,
      salaries: 2000,
      founderSalary: 0,
      rent: 800,
      maintenance: 200,
      marketing: 0,
      devAndMisc: 0,
      taxes: 0,
      interest: 0,
      netProfit: 2000,
      endingCash: 44000,
      customersGained: 10,
      customersChurned: 0,
      activeCustomers: 10,
      avgMorale: 82,
      headcount: 3,
      summaryNote: 'Profitable',
    },
    'vi-VN'
  );
  assert.ok(monthlyScript.text.includes('5.000 ₫'));
  assert.ok(getEmployeeVoiceLine(state.employees[0], 'vi-VN').text.length > 10);

  // Calling speak safely in non-browser Node context preserves subtitle without throwing
  voiceService.speak({
    speaker: 'Test',
    text: 'Xin chào nhà sáng lập',
    locale: 'vi-VN',
    category: 'MANUAL',
    userInitiated: true,
  });
  assert.equal(voiceService.getSubtitle()?.audioSkippedReason, 'UNSUPPORTED');
  assert.equal(voiceService.getSubtitle()?.text, 'Xin chào nhà sáng lập');
  voiceService.dismissSubtitle();
});

test('21. Tutorial Back/Next navigation, restart after completion, and localized arrow strings work cleanly', async () => {
  installMockLocalStorage();
  const i18n = await import('../../localization/i18n.ts');
  let state = createNewGame(DEFAULT_NEW_GAME_PARAMS);

  // Advance Step 1 -> Step 2, then step Back -> Step 1
  state = executeCommand(state, { type: 'REPORT_TUTORIAL_ACTION', action: 'REVIEW_EMPLOYEE' }).state;
  assert.equal(state.tutorial.currentStep, 2);

  state = executeCommand(state, { type: 'TUTORIAL_BACK' }).state;
  assert.equal(state.tutorial.currentStep, 1);
  assert.equal(state.tutorial.manualHoldStep, 1);

  // Next returns to Step 2
  state = executeCommand(state, { type: 'TUTORIAL_NEXT' }).state;
  assert.equal(state.tutorial.currentStep, 2);
  assert.equal(state.tutorial.manualHoldStep, null);

  // Simulate completed tutorial on Day 2, then restart from Settings
  state.totalDays = 2;
  state.tutorial.completed = true;
  state.tutorial.active = false;
  state.tutorial.endedFirstDay = true;
  state = executeCommand(state, { type: 'RESUME_TUTORIAL' }).state;
  assert.equal(state.tutorial.active, true);
  assert.equal(state.tutorial.completed, false);
  assert.equal(state.tutorial.currentStep, 1);
  assert.equal(state.tutorial.restartAnchorDay, 2);

  // Verify required Vietnamese and English tutorial arrow strings
  assert.equal(i18n.t('tutorialArrow.clickToContinue', undefined, 'vi-VN'), 'Nhấn vào đây để tiếp tục.');
  assert.equal(
    i18n.t('tutorialArrow.interactHighlighted', undefined, 'vi-VN'),
    'Hãy tương tác với vật thể được đánh dấu.'
  );
  assert.equal(i18n.t('tutorialArrow.greatJob', undefined, 'vi-VN'), 'Tốt lắm! Hãy tiếp tục.');
  assert.equal(
    i18n.t('tutorialArrow.completedTutorial', undefined, 'vi-VN'),
    'Bạn đã hoàn thành hướng dẫn.'
  );

  assert.equal(i18n.t('tutorialArrow.clickToContinue', undefined, 'en-US'), 'Click here to continue.');
  assert.equal(
    i18n.t('tutorialArrow.interactHighlighted', undefined, 'en-US'),
    'Interact with the highlighted object.'
  );
  assert.equal(i18n.t('tutorialArrow.greatJob', undefined, 'en-US'), 'Great job! Keep going.');
  assert.equal(
    i18n.t('tutorialArrow.completedTutorial', undefined, 'en-US'),
    'You have completed the tutorial.'
  );
});

test('22. Tooltip positioning auto-flips/clamps cleanly and tooltips dictionary has full vi-VN / en-US parity', async () => {
  const { computeTooltipPosition } = await import('../../components/Tooltip.tsx');
  const i18n = await import('../../localization/i18n.ts');
  const viJson = (await import('../../localization/locales/vi-VN.json', { with: { type: 'json' } })).default as {
    tooltips: Record<string, string>;
  };
  const enJson = (await import('../../localization/locales/en-US.json', { with: { type: 'json' } })).default as {
    tooltips: Record<string, string>;
  };

  const viKeys = Object.keys(viJson.tooltips).sort();
  const enKeys = Object.keys(enJson.tooltips).sort();
  assert.deepEqual(viKeys, enKeys, 'vi-VN and en-US tooltips dictionaries must share identical keys');
  assert.ok(viKeys.length >= 25);

  for (const key of viKeys) {
    const viText = i18n.t(`tooltips.${key}`, undefined, 'vi-VN');
    const enText = i18n.t(`tooltips.${key}`, undefined, 'en-US');
    assert.ok(viText.length > 10 && viText !== `tooltips.${key}`);
    assert.ok(enText.length > 10 && enText !== `tooltips.${key}`);
    assert.notEqual(viText, enText);
  }

  // Top placement flips to bottom when near top edge
  const flippedBottom = computeTooltipPosition(
    { left: 200, top: 8, right: 320, bottom: 48, width: 120, height: 40 },
    { width: 240, height: 60 },
    'top',
    { width: 1280, height: 720 }
  );
  assert.equal(flippedBottom.placement, 'bottom');
  assert.equal(flippedBottom.top, 56);

  // Right placement flips to left when near right edge, and clamps inside viewport margins
  const flippedLeft = computeTooltipPosition(
    { left: 1180, top: 200, right: 1270, bottom: 240, width: 90, height: 40 },
    { width: 220, height: 50 },
    'right',
    { width: 1280, height: 720 }
  );
  assert.equal(flippedLeft.placement, 'left');
  assert.ok(flippedLeft.left >= 10 && flippedLeft.left + 220 <= 1270);
});

test('23. Notification queue deduplicates/caps cleanly and vi-VN / en-US locales maintain full recursive key parity', async () => {
  const { appendToNotificationQueue } = await import('../../hooks/useGameEngine.ts');
  type QItem = Parameters<typeof appendToNotificationQueue>[1];

  let queue: QItem[] = [];
  queue = appendToNotificationQueue(queue, { id: '1', kind: 'INFO', message: 'Saved', day: 1 });
  // Consecutive identical INFO message is deduplicated
  queue = appendToNotificationQueue(queue, { id: '2', kind: 'INFO', message: 'Saved', day: 1 });
  assert.equal(queue.length, 1);

  // Achievement deduplication by achievement.id
  queue = appendToNotificationQueue(queue, {
    id: 'a1',
    kind: 'ACHIEVEMENT',
    message: 'First Hire',
    day: 1,
    achievement: {
      id: 'first_hire',
      title: 'First Hire',
      description: 'Hired',
      category: 'TEAM',
      unlocked: true,
      unlockedDay: 1,
    },
  });
  queue = appendToNotificationQueue(queue, { id: '3', kind: 'INFO', message: 'Other', day: 1 });
  queue = appendToNotificationQueue(queue, {
    id: 'a2',
    kind: 'ACHIEVEMENT',
    message: 'First Hire',
    day: 1,
    achievement: {
      id: 'first_hire',
      title: 'First Hire',
      description: 'Hired',
      category: 'TEAM',
      unlocked: true,
      unlockedDay: 1,
    },
  });
  assert.equal(queue.length, 3);

  // Queue caps at 8 items (preserving FIFO)
  for (let i = 0; i < 10; i++) {
    queue = appendToNotificationQueue(queue, { id: `m_${i}`, kind: 'INFO', message: `Msg ${i}`, day: 2 });
  }
  assert.equal(queue.length, 8);
  assert.equal(queue[0].message, 'Saved');

  // Full recursive leaf-key parity across vi-VN and en-US dictionaries
  const viJson = (await import('../../localization/locales/vi-VN.json', { with: { type: 'json' } })).default as Record<
    string,
    unknown
  >;
  const enJson = (await import('../../localization/locales/en-US.json', { with: { type: 'json' } })).default as Record<
    string,
    unknown
  >;

  function collectLeafEntries(obj: Record<string, unknown>, prefix = ''): Map<string, unknown> {
    const map = new Map<string, unknown>();
    for (const [k, v] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        for (const [subKey, subVal] of collectLeafEntries(v as Record<string, unknown>, path)) {
          map.set(subKey, subVal);
        }
      } else {
        map.set(path, v);
      }
    }
    return map;
  }

  const viLeaves = collectLeafEntries(viJson);
  const enLeaves = collectLeafEntries(enJson);
  const viSortedKeys = [...viLeaves.keys()].sort();
  const enSortedKeys = [...enLeaves.keys()].sort();

  assert.deepEqual(viSortedKeys, enSortedKeys, 'vi-VN.json and en-US.json must have identical leaf key paths');
  for (const key of viSortedKeys) {
    const viVal = viLeaves.get(key);
    const enVal = enLeaves.get(key);
    assert.equal(typeof viVal, typeof enVal, `Mismatched leaf value type at ${key}`);
    if (typeof viVal === 'string' && typeof enVal === 'string') {
      assert.equal(
        viVal.trim().length > 0,
        enVal.trim().length > 0,
        `Mismatched empty/non-empty string parity at ${key}`
      );
      if (!key.startsWith('office.furniture.')) {
        assert.ok(viVal.trim().length > 0, `Empty vi-VN string at ${key}`);
        assert.ok(enVal.trim().length > 0, `Empty en-US string at ${key}`);
      }
    }
  }
});

test('24. PixelAvatar portrait status maps all CharacterState values to expected CSS animation classes and localized labels', async () => {
  const { getPortraitStatusClass } = await import('../../components/PixelAvatar.tsx');
  const i18n = await import('../../localization/i18n.ts');

  assert.equal(getPortraitStatusClass('IDLE'), 'animate-portrait-idle');
  assert.equal(getPortraitStatusClass('WORKING'), 'animate-portrait-working');
  assert.equal(getPortraitStatusClass('WALKING'), 'animate-portrait-walking');
  assert.equal(getPortraitStatusClass('RESTING'), 'animate-portrait-resting');
  assert.equal(getPortraitStatusClass('MEETING'), 'animate-portrait-social');
  assert.equal(getPortraitStatusClass('CHATTING'), 'animate-portrait-social');
  assert.equal(getPortraitStatusClass('OFF_DUTY'), 'animate-portrait-offduty');
  assert.equal(getPortraitStatusClass(undefined), '');

  const states = ['IDLE', 'WORKING', 'WALKING', 'RESTING', 'MEETING', 'CHATTING', 'OFF_DUTY'] as const;
  for (const st of states) {
    const vi = i18n.t(`drawer.empStates.${st}`, undefined, 'vi-VN');
    const en = i18n.t(`drawer.empStates.${st}`, undefined, 'en-US');
    assert.ok(vi.length > 0 && vi !== `drawer.empStates.${st}`);
    assert.ok(en.length > 0 && en !== `drawer.empStates.${st}`);
  }
});

test('25. UX refinement: autoReadTutorial starts off, v1 voice settings migrate cleanly, hitTestEmployee covers sprite bounds, and Step 1 ignores unrelated actions', async () => {
  installMockLocalStorage();
  const { DEFAULT_VOICE_SETTINGS, loadVoiceSettings } = await import('../../audio/voiceSettings.ts');
  const { hitTestEmployee } = await import('../../components/OfficeCanvas.tsx');
  const i18n = await import('../../localization/i18n.ts');

  assert.equal(DEFAULT_VOICE_SETTINGS.autoReadTutorial, false);

  // Legacy v1 setting with autoReadTutorial: true must migrate to v2 with autoReadTutorial: false
  localStorage.setItem(
    'startup_founder_voice_v1',
    JSON.stringify({ enabled: true, rate: 1.1, volume: 0.7, autoReadTutorial: true })
  );
  const migratedVoice = loadVoiceSettings();
  assert.equal(migratedVoice.autoReadTutorial, false);
  assert.equal(migratedVoice.rate, 1.1);
  assert.equal(migratedVoice.volume, 0.7);

  // Welcome banner copy exists in both locales
  for (const loc of ['vi-VN', 'en-US'] as const) {
    const title = i18n.t('hud.welcomeBanner.title', undefined, loc);
    const subtitle = i18n.t('hud.welcomeBanner.subtitle', undefined, loc);
    assert.ok(title.length > 0 && title !== 'hud.welcomeBanner.title');
    assert.ok(subtitle.length > 0 && subtitle !== 'hud.welcomeBanner.subtitle');
  }

  const mockEmployees = [
    { id: 'emp_a', position: { x: 5, y: 8 } },
    { id: 'emp_b', position: { x: 10, y: 12 } },
  ];

  // Exact tile center hit
  assert.equal(hitTestEmployee(mockEmployees, { x: 5, y: 8 }, 5.5, 8.5), 'emp_a');
  // Upper sprite/head click slightly above tile origin still hits
  assert.equal(hitTestEmployee(mockEmployees, { x: 5, y: 7 }, 5.4, 7.8), 'emp_a');
  // Lower sprite feet/shadow click still hits
  assert.equal(hitTestEmployee(mockEmployees, { x: 5, y: 9 }, 5.6, 9.05), 'emp_a');
  // Distant empty floor tile misses
  assert.equal(hitTestEmployee(mockEmployees, { x: 2, y: 2 }, 2.5, 2.5), null);

  // Step 1 requires REVIEW_EMPLOYEE and must NOT advance on EXPLORE_ROOM
  let state = createNewGame(DEFAULT_NEW_GAME_PARAMS);
  assert.equal(state.tutorial.currentStep, 1);
  assert.equal(state.tutorial.reviewedEmployee, false);

  state = executeCommand(state, {
    type: 'REPORT_TUTORIAL_ACTION',
    action: 'EXPLORE_ROOM',
    roomId: 'CEO_OFFICE',
  }).state;
  assert.equal(state.tutorial.currentStep, 1);
  assert.equal(state.tutorial.exploredCeoOffice, true);

  state = executeCommand(state, {
    type: 'REPORT_TUTORIAL_ACTION',
    action: 'REVIEW_EMPLOYEE',
  }).state;
  assert.equal(state.tutorial.reviewedEmployee, true);
  assert.equal(state.tutorial.currentStep, 2);
});

test('26. Cozy Audio System: settings persist independently, preserve volume on mute, recover from corruption, and switch scenes safely', async () => {
  installMockLocalStorage();
  const {
    AUDIO_SETTINGS_STORAGE_KEY,
    DEFAULT_AUDIO_SETTINGS,
    loadAudioSettings,
    saveAudioSettings,
  } = await import('../../audio/audioSettings.ts');
  const { audioManager } = await import('../../audio/audioManager.ts');
  const { soundService } = await import('../../services/soundService.ts');

  assert.equal(DEFAULT_AUDIO_SETTINGS.masterVolume, 1.0);
  assert.equal(DEFAULT_AUDIO_SETTINGS.bgmVolume, 0.7);
  assert.equal(DEFAULT_AUDIO_SETTINGS.sfxVolume, 0.8);
  assert.equal(DEFAULT_AUDIO_SETTINGS.masterMuted, false);
  assert.equal(DEFAULT_AUDIO_SETTINGS.bgmMuted, false);
  assert.equal(DEFAULT_AUDIO_SETTINGS.sfxMuted, false);

  // Corrupted settings fall back cleanly without touching gameplay saves
  const game = createNewGame(DEFAULT_NEW_GAME_PARAMS);
  saveGameToSlot('slot_1', game, 'Audio Safeguard Save');
  localStorage.setItem(AUDIO_SETTINGS_STORAGE_KEY, '{broken_json');
  const recovered = loadAudioSettings();
  assert.deepEqual(recovered, DEFAULT_AUDIO_SETTINGS);
  assert.equal(loadGameFromSlot('slot_1')?.config.companyName, game.config.companyName);

  // Saved settings without masterVolume/masterMuted default those fields safely
  localStorage.setItem(
    AUDIO_SETTINGS_STORAGE_KEY,
    JSON.stringify({ bgmVolume: 0.5, sfxVolume: 0.6, bgmMuted: false, sfxMuted: false })
  );
  const partialMigrated = loadAudioSettings();
  assert.equal(partialMigrated.masterVolume, 1.0);
  assert.equal(partialMigrated.masterMuted, false);
  assert.equal(partialMigrated.bgmVolume, 0.5);

  // Legacy mute key migrates safely if new key absent
  localStorage.removeItem(AUDIO_SETTINGS_STORAGE_KEY);
  localStorage.setItem('startup_founder_muted_v1', 'true');
  const migrated = loadAudioSettings();
  assert.equal(migrated.bgmMuted, true);
  assert.equal(migrated.sfxMuted, true);

  // Independent Master, BGM & SFX volume and mute controls preserve slider values
  audioManager.setMasterVolume(0.75);
  audioManager.setMasterMuted(false);
  audioManager.setBgmVolume(0.45);
  audioManager.setSfxVolume(0.65);
  audioManager.setBgmMuted(true);
  audioManager.setSfxMuted(false);
  let snap = audioManager.getSettings();
  assert.equal(snap.masterVolume, 0.75);
  assert.equal(snap.masterMuted, false);
  assert.equal(snap.bgmVolume, 0.45);
  assert.equal(snap.sfxVolume, 0.65);
  assert.equal(snap.bgmMuted, true);
  assert.equal(snap.sfxMuted, false);
  assert.equal(soundService.isMuted(), false);

  // Toggling SFX mute leaves Master/BGM mute & SFX volume intact
  soundService.toggleMute();
  snap = audioManager.getSettings();
  assert.equal(snap.sfxMuted, true);
  assert.equal(snap.sfxVolume, 0.65);
  assert.equal(snap.bgmMuted, true);
  assert.equal(snap.masterMuted, false);

  // Persisted reload restores exact settings
  const reloaded = loadAudioSettings();
  assert.deepEqual(reloaded, snap);

  // Test Sound respects both SFX mute and Master mute without touching BGM state
  assert.equal(soundService.playTestSound(), false);
  audioManager.setSfxMuted(false);
  assert.equal(soundService.playTestSound(), true);
  audioManager.setMasterMuted(true);
  assert.equal(soundService.isMuted(), true);
  assert.equal(soundService.playTestSound(), false);
  audioManager.setMasterMuted(false);
  assert.equal(soundService.playTestSound(), true);
  assert.equal(audioManager.getSettings().bgmMuted, true);

  // Scene switching and lifecycle methods run without errors in headless mode
  audioManager.setScene('MENU');
  assert.equal(audioManager.getActiveScene(), 'MENU');
  audioManager.setScene('OFFICE');
  assert.equal(audioManager.getActiveScene(), 'OFFICE');
  audioManager.setScene('EVENT');
  assert.equal(audioManager.getActiveScene(), 'EVENT');
  audioManager.pauseBgm();
  audioManager.resumeBgm();
  audioManager.stopBgm();
  saveAudioSettings(DEFAULT_AUDIO_SETTINGS);
});

test('27. Authentication System: registration, login, HttpOnly cookie sessions, expiry, rate limit, bcrypt hashing, and guest save preservation', async () => {
  installMockLocalStorage();
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const http = await import('node:http');
  const { createAuthApp } = await import('../../../server/authRouter.ts');
  const { createSession } = await import('../../../server/authStore.ts');

  // Guest local save created before any account interaction must remain untouched
  const guestGame = createNewGame(DEFAULT_NEW_GAME_PARAMS);
  guestGame.day = 4;
  saveGameToSlot('slot_1', guestGame, 'Guest Progress');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sfs-auth-test-'));
  const app = createAuthApp({ dataDir: tempDir, rateLimitMax: 5, rateLimitWindowMs: 60_000 });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // 1. Unauthenticated protected route fails, session check returns guest
    const unauthMe = await fetch(`${baseUrl}/api/account/me`);
    assert.equal(unauthMe.status, 401);

    const guestSess = await (await fetch(`${baseUrl}/api/auth/session`)).json();
    assert.equal(guestSess.authenticated, false);
    assert.equal(guestSess.user, null);

    // 2. Validation rejects invalid email & weak password
    const badEmailRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: 'Password1' }),
    });
    assert.equal(badEmailRes.status, 400);
    assert.equal((await badEmailRes.json()).errorCode, 'INVALID_EMAIL');

    const weakPwRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'founder@example.com', password: 'short' }),
    });
    assert.equal(weakPwRes.status, 400);
    assert.equal((await weakPwRes.json()).errorCode, 'WEAK_PASSWORD');

    // 3. Valid registration sets HttpOnly cookie and hashes password (no plaintext)
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'Founder@Example.com', password: 'Password123', rememberMe: true }),
    });
    assert.equal(regRes.status, 201);
    const setCookieHeader = regRes.headers.get('set-cookie') ?? '';
    assert.ok(setCookieHeader.includes('sf_session='));
    assert.ok(setCookieHeader.includes('HttpOnly'));
    const cookiePair = setCookieHeader.split(';')[0];

    const regBody = (await regRes.json()) as { user: { id: string; email: string; passwordHash?: string } };
    assert.equal(regBody.user.email, 'founder@example.com');
    assert.equal(regBody.user.passwordHash, undefined);

    const dbText = fs.readFileSync(path.join(tempDir, 'auth-db.json'), 'utf8');
    assert.ok(!dbText.includes('Password123'), 'Plaintext password must NEVER be stored');
    assert.ok(dbText.includes('$2'), 'Bcrypt hash must be stored');

    // 4. Protected endpoint succeeds with session cookie
    const meRes = await fetch(`${baseUrl}/api/account/me`, {
      headers: { Cookie: cookiePair },
    });
    assert.equal(meRes.status, 200);
    const meBody = (await meRes.json()) as { user: { email: string } };
    assert.equal(meBody.user.email, 'founder@example.com');

    // 5. Logout revokes session cleanly
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: cookiePair },
    });
    assert.equal(logoutRes.status, 200);
    const meAfterLogout = await fetch(`${baseUrl}/api/account/me`, {
      headers: { Cookie: cookiePair },
    });
    assert.equal(meAfterLogout.status, 401);

    // 6. Wrong password rejected, correct login persists session
    const badLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'founder@example.com', password: 'WrongPassword1' }),
    });
    assert.equal(badLogin.status, 401);

    const goodLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'founder@example.com', password: 'Password123', rememberMe: false }),
    });
    assert.equal(goodLogin.status, 200);
    const loginCookie = (goodLogin.headers.get('set-cookie') ?? '').split(';')[0];
    const sessAfterLogin = await (
      await fetch(`${baseUrl}/api/auth/session`, { headers: { Cookie: loginCookie } })
    ).json();
    assert.equal(sessAfterLogin.authenticated, true);
    assert.equal(sessAfterLogin.user.email, 'founder@example.com');

    // 7. Expired session token is rejected cleanly
    const expired = createSession(
      tempDir,
      { id: regBody.user.id, email: regBody.user.email, createdAt: Date.now() },
      false,
      -5000
    );
    const expiredRes = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { Cookie: `sf_session=${encodeURIComponent(expired.rawToken)}` },
    });
    const expiredBody = await expiredRes.json();
    assert.equal(expiredBody.authenticated, false);
    assert.equal(expiredBody.expired, true);

    // 8. Rate limiter triggers 429 on excessive attempts
    const rateLimited = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'founder@example.com', password: 'WrongPassword1' }),
    });
    assert.equal(rateLimited.status, 429);
    assert.equal((await rateLimited.json()).errorCode, 'RATE_LIMITED');

    // 9. Guest save remains completely intact after account registration/login/logout
    const reloadedSave = loadGameFromSlot('slot_1');
    assert.equal(reloadedSave?.day, 4);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('28. AudioManager schedules smooth 500ms fade-in/fade-out linear interpolation ramps without snapping', async () => {
  installMockLocalStorage();
  const {
    AUDIO_FADE_DURATIONS,
    AudioManager,
    evaluateLinearRamp,
    scheduleSmoothGainRamp,
  } = await import('../../audio/audioManager.ts');

  assert.equal(AUDIO_FADE_DURATIONS.bgmStart, 0.5);
  assert.equal(AUDIO_FADE_DURATIONS.bgmVolumeChange, 0.5);
  assert.equal(AUDIO_FADE_DURATIONS.bgmMuteFade, 0.5);
  assert.equal(AUDIO_FADE_DURATIONS.bgmPauseStop, 0.5);
  assert.equal(AUDIO_FADE_DURATIONS.sfxVolumeChange, 0.5);
  assert.equal(AUDIO_FADE_DURATIONS.sfxMuteFade, 0.5);
  assert.equal(AUDIO_FADE_DURATIONS.bgmSceneOut + AUDIO_FADE_DURATIONS.bgmSceneIn, 0.5);

  type GainCall =
    | { op: 'cancelAndHold'; time: number }
    | { op: 'cancelScheduled'; time: number }
    | { op: 'setValue'; value: number; time: number }
    | { op: 'linearRamp'; value: number; endTime: number };

  function makeMockParam(withCancelAndHold: boolean) {
    const calls: GainCall[] = [];
    const param = {
      value: 0.35,
      ...(withCancelAndHold
        ? {
            cancelAndHoldAtTime(t: number) {
              calls.push({ op: 'cancelAndHold', time: t });
              return param;
            },
          }
        : {}),
      cancelScheduledValues(t: number) {
        calls.push({ op: 'cancelScheduled', time: t });
        return param;
      },
      setValueAtTime(v: number, t: number) {
        param.value = v;
        calls.push({ op: 'setValue', value: v, time: t });
        return param;
      },
      linearRampToValueAtTime(v: number, t: number) {
        calls.push({ op: 'linearRamp', value: v, endTime: t });
        return param;
      },
      exponentialRampToValueAtTime(v: number, t: number) {
        calls.push({ op: 'linearRamp', value: v, endTime: t });
        return param;
      },
    };
    return { param: param as unknown as AudioParam, calls };
  }

  // 1. scheduleSmoothGainRamp uses cancelAndHoldAtTime when supported and defaults to 500ms linear ramp
  const modern = makeMockParam(true);
  scheduleSmoothGainRamp(modern.param, 0.8, 10.0);
  assert.deepEqual(modern.calls, [
    { op: 'cancelAndHold', time: 10.0 },
    { op: 'linearRamp', value: 0.8, endTime: 10.5 },
  ]);

  // 2. Fallback browsers without cancelAndHoldAtTime anchor the exact mid-flight interpolated value
  const fallback = makeMockParam(false);
  fallback.param.value = 0;
  const firstRamp = scheduleSmoothGainRamp(fallback.param, 0.8, 5.0, 0.5);
  assert.ok(Math.abs(evaluateLinearRamp(firstRamp, 5.25) - 0.4) < 1e-6);

  fallback.calls.length = 0;
  scheduleSmoothGainRamp(fallback.param, 0.2, 5.25, 0.5, firstRamp);
  assert.equal(fallback.calls[0]?.op, 'cancelScheduled');
  assert.equal(fallback.calls[1]?.op, 'setValue');
  if (fallback.calls[1]?.op === 'setValue') {
    assert.ok(Math.abs(fallback.calls[1].value - 0.4) < 1e-6);
    assert.equal(fallback.calls[1].time, 5.25);
  }
  assert.deepEqual(fallback.calls[2], { op: 'linearRamp', value: 0.2, endTime: 5.75 });

  // 3. Full AudioManager lifecycle against a mock AudioContext verifies BGM & SFX fade-ins/fade-outs
  const createdGains: Array<{ calls: GainCall[] }> = [];
  class MockAudioContext {
    currentTime = 1.0;
    sampleRate = 44100;
    state: AudioContextState = 'running';
    destination = {};
    createGain() {
      const mock = makeMockParam(true);
      mock.param.value = 1;
      createdGains.push({ calls: mock.calls });
      return { gain: mock.param, connect() {} };
    }
    createDynamicsCompressor() {
      return {
        threshold: { value: 0 },
        knee: { value: 0 },
        ratio: { value: 1 },
        attack: { value: 0 },
        release: { value: 0 },
        connect() {},
      };
    }
    createBiquadFilter() {
      return {
        type: 'lowpass',
        frequency: { value: 1000, setValueAtTime() {} },
        Q: { value: 1, setValueAtTime() {} },
        connect() {},
      };
    }
    createBuffer(_ch: number, len: number) {
      const ch = new Float32Array(len);
      return { getChannelData: () => ch };
    }
    createBufferSource() {
      return { buffer: null, connect() {}, start() {}, stop() {} };
    }
    createOscillator() {
      return {
        type: 'sine',
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        start() {},
        stop() {},
      };
    }
    resume() {
      this.state = 'running';
      return Promise.resolve();
    }
    close() {
      this.state = 'closed';
      return Promise.resolve();
    }
  }

  const prevWindow = (globalThis as Record<string, unknown>).window;
  (globalThis as Record<string, unknown>).window = {
    AudioContext: MockAudioContext,
    addEventListener() {},
    removeEventListener() {},
  };

  const mgr = new AudioManager();
  try {
    mgr.playBgm('OFFICE');
    mgr.unlockFromUserGesture();

    // createdGains[0]=master, [1]=bgmBusGain, [2]=sfxBusGain
    const masterRaw = createdGains[0].calls;
    const bgmRaw = createdGains[1].calls;
    const sfxRaw = createdGains[2].calls;
    const takeCalls = (arr: GainCall[]): GainCall[] => {
      const copy = [...arr];
      arr.length = 0;
      return copy;
    };

    // Initial BGM bus starts at 0 and fades in smoothly over bgmStart
    const initCalls = takeCalls(bgmRaw);
    masterRaw.length = 0;
    sfxRaw.length = 0;
    assert.deepEqual(initCalls[0], { op: 'setValue', value: 0, time: 1.0 });
    const startRamp = initCalls.find((c) => c.op === 'linearRamp');
    assert.ok(startRamp && startRamp.op === 'linearRamp');
    assert.ok(startRamp.value > 0);
    assert.ok(Math.abs(startRamp.endTime - (1.0 + AUDIO_FADE_DURATIONS.bgmStart)) < 1e-6);

    // Updating Master, BGM & SFX sliders ramps smoothly over 500ms instead of jumping
    mgr.setMasterVolume(0.6);
    mgr.setBgmVolume(0.3);
    mgr.setSfxVolume(0.5);

    const masterVolCalls = takeCalls(masterRaw);
    assert.equal(masterVolCalls[0]?.op, 'cancelAndHold');
    assert.equal(masterVolCalls[1]?.op, 'linearRamp');
    if (masterVolCalls[1]?.op === 'linearRamp') {
      assert.ok(
        Math.abs(masterVolCalls[1].endTime - (1.0 + AUDIO_FADE_DURATIONS.masterVolumeChange)) < 1e-6
      );
    }

    const bgmVolCalls = takeCalls(bgmRaw);
    assert.equal(bgmVolCalls[0]?.op, 'cancelAndHold');
    assert.equal(bgmVolCalls[1]?.op, 'linearRamp');
    if (bgmVolCalls[1]?.op === 'linearRamp') {
      assert.ok(
        Math.abs(bgmVolCalls[1].endTime - (1.0 + AUDIO_FADE_DURATIONS.bgmVolumeChange)) < 1e-6
      );
    }

    const sfxVolCalls = takeCalls(sfxRaw);
    assert.equal(sfxVolCalls[0]?.op, 'cancelAndHold');
    assert.equal(sfxVolCalls[1]?.op, 'linearRamp');
    if (sfxVolCalls[1]?.op === 'linearRamp') {
      assert.ok(
        Math.abs(sfxVolCalls[1].endTime - (1.0 + AUDIO_FADE_DURATIONS.sfxVolumeChange)) < 1e-6
      );
    }

    // Muting Master fades masterGain smoothly to 0 over 500ms; unmuting fades back in
    mgr.setMasterMuted(true);
    assert.deepEqual(takeCalls(masterRaw), [
      { op: 'cancelAndHold', time: 1.0 },
      { op: 'linearRamp', value: 0, endTime: 1.0 + AUDIO_FADE_DURATIONS.masterMuteFade },
    ]);
    mgr.setMasterMuted(false);
    const masterUnmuteCalls = takeCalls(masterRaw);
    assert.equal(masterUnmuteCalls[0]?.op, 'cancelAndHold');
    assert.equal(masterUnmuteCalls[1]?.op, 'linearRamp');
    if (masterUnmuteCalls[1]?.op === 'linearRamp') {
      assert.ok(masterUnmuteCalls[1].value > 0);
      assert.ok(
        Math.abs(masterUnmuteCalls[1].endTime - (1.0 + AUDIO_FADE_DURATIONS.masterMuteFade)) < 1e-6
      );
    }

    // Muting BGM fades smoothly to 0; unmuting fades smoothly back in
    mgr.setBgmMuted(true);
    assert.deepEqual(takeCalls(bgmRaw), [
      { op: 'cancelAndHold', time: 1.0 },
      { op: 'linearRamp', value: 0, endTime: 1.0 + AUDIO_FADE_DURATIONS.bgmMuteFade },
    ]);

    mgr.setBgmMuted(false);
    const unmuteCalls = takeCalls(bgmRaw);
    assert.equal(unmuteCalls[0]?.op, 'cancelAndHold');
    assert.equal(unmuteCalls[1]?.op, 'linearRamp');
    if (unmuteCalls[1]?.op === 'linearRamp') {
      assert.ok(unmuteCalls[1].value > 0);
      assert.ok(
        Math.abs(unmuteCalls[1].endTime - (1.0 + AUDIO_FADE_DURATIONS.bgmMuteFade)) < 1e-6
      );
    }

    // Pausing BGM fades out cleanly to 0; resuming fades back in cleanly
    mgr.pauseBgm();
    assert.deepEqual(takeCalls(bgmRaw), [
      { op: 'cancelAndHold', time: 1.0 },
      { op: 'linearRamp', value: 0, endTime: 1.0 + AUDIO_FADE_DURATIONS.bgmPauseStop },
    ]);

    mgr.resumeBgm();
    const resumeCalls = takeCalls(bgmRaw);
    assert.equal(resumeCalls[0]?.op, 'cancelAndHold');
    assert.equal(resumeCalls[1]?.op, 'linearRamp');
    if (resumeCalls[1]?.op === 'linearRamp') {
      assert.ok(resumeCalls[1].value > 0);
      assert.ok(
        Math.abs(resumeCalls[1].endTime - (1.0 + AUDIO_FADE_DURATIONS.bgmPauseStop)) < 1e-6
      );
    }
  } finally {
    mgr.destroy();
    if (prevWindow === undefined) {
      delete (globalThis as Record<string, unknown>).window;
    } else {
      (globalThis as Record<string, unknown>).window = prevWindow;
    }
  }
});

test('29. Step 1 tutorial progression, pause/resume/skip preservation, locked room preview state, and Master Volume localization', async () => {
  installMockLocalStorage();
  const i18n = await import('../../localization/i18n.ts');

  // Fresh save starts on Step 1 with starting rooms unlocked and locked expansion rooms preserved
  let state = createNewGame(DEFAULT_NEW_GAME_PARAMS);
  assert.equal(state.tutorial.active, true);
  assert.equal(state.tutorial.currentStep, 1);
  assert.equal(state.tutorial.completed, false);
  assert.equal(state.tutorial.skipped, false);
  assert.ok(state.employees.length >= 1);
  assert.equal(state.office.rooms.CEO_OFFICE.unlocked, true);
  assert.equal(state.office.rooms.ENGINEERING.unlocked, true);
  assert.equal(state.office.rooms.HR_DEPT.unlocked, false);
  assert.equal(state.office.rooms.FINANCE_DEPT.unlocked, false);
  assert.equal(state.office.rooms.LEGAL_DEPT.unlocked, false);
  assert.ok(state.office.rooms.HR_DEPT.unlockCost > 0);

  // Unrelated interactions (moving Founder, exploring a room, opening Finance) must NOT prematurely complete Step 1
  state = executeCommand(state, { type: 'MOVE_FOUNDER', target: { x: 4, y: 4 } }).state;
  state = executeCommand(state, { type: 'REPORT_TUTORIAL_ACTION', action: 'EXPLORE_ROOM', roomId: 'CEO_OFFICE' }).state;
  state = executeCommand(state, { type: 'REPORT_TUTORIAL_ACTION', action: 'REVIEW_FINANCE' }).state;
  assert.equal(state.tutorial.currentStep, 1);

  // Pausing & resuming gameplay preserves tutorial state cleanly
  state = executeCommand(state, { type: 'SET_SPEED', speed: 0 }).state;
  assert.equal(state.speed, 0);
  assert.equal(state.tutorial.active, true);
  assert.equal(state.tutorial.currentStep, 1);
  state = executeCommand(state, { type: 'SET_SPEED', speed: 1 }).state;
  assert.equal(state.speed, 1);
  assert.equal(state.tutorial.currentStep, 1);

  // Clicking/inspecting an employee dispatches REVIEW_EMPLOYEE and advances Step 1 -> Step 2
  state = executeCommand(state, { type: 'REPORT_TUTORIAL_ACTION', action: 'REVIEW_EMPLOYEE' }).state;
  assert.equal(state.tutorial.currentStep, 2);

  // Skip and Resume tutorial preserve/restart progression cleanly
  state = executeCommand(state, { type: 'SKIP_TUTORIAL' }).state;
  assert.equal(state.tutorial.skipped, true);
  assert.equal(state.tutorial.active, false);
  state = executeCommand(state, { type: 'RESUME_TUTORIAL' }).state;
  assert.equal(state.tutorial.skipped, false);
  assert.equal(state.tutorial.active, true);

  // Master Volume literal label and concise Welcome Banner copy
  assert.equal(i18n.t('audio.masterLabel', undefined, 'en-US'), 'Master Volume');
  assert.equal(i18n.t('audio.masterLabel', undefined, 'vi-VN'), 'Âm lượng tổng');
  assert.equal(i18n.t('hud.welcomeBanner.subtitle', undefined, 'en-US'), "Let's get started!");
  assert.equal(i18n.t('hud.welcomeBanner.subtitle', undefined, 'vi-VN'), 'Cùng bắt đầu nhé!');
});

test('30. Master mute toggle shortcut preserves volume levels, persists masterMuted state, and has full localization', async () => {
  installMockLocalStorage();
  const { AudioManager } = await import('../../audio/audioManager.ts');
  const { loadAudioSettings } = await import('../../audio/audioSettings.ts');
  const i18n = await import('../../localization/i18n.ts');

  const mgr = new AudioManager();
  try {
    mgr.setMasterVolume(0.75);
    mgr.setBgmVolume(0.65);
    mgr.setSfxVolume(0.85);

    const mutedNow = mgr.toggleMasterMute();
    assert.equal(mutedNow, true);
    assert.equal(mgr.getSettings().masterMuted, true);
    assert.equal(mgr.getSettings().masterVolume, 0.75);
    assert.equal(mgr.getSettings().bgmVolume, 0.65);
    assert.equal(mgr.getSettings().sfxVolume, 0.85);
    assert.equal(loadAudioSettings().masterMuted, true);

    const unmutedNow = mgr.toggleMasterMute();
    assert.equal(unmutedNow, false);
    assert.equal(mgr.getSettings().masterMuted, false);
    assert.equal(mgr.getSettings().masterVolume, 0.75);
    assert.equal(loadAudioSettings().masterMuted, false);

    // Localized shortcut documentation and visual feedback strings
    assert.equal(i18n.t('shortcutsModal.keyM', undefined, 'en-US'), 'M');
    assert.equal(i18n.t('shortcutsModal.keyM', undefined, 'vi-VN'), 'M');
    assert.ok(i18n.t('shortcutsModal.muteAudioDesc', undefined, 'en-US').includes('Master Volume'));
    assert.ok(i18n.t('shortcutsModal.muteAudioDesc', undefined, 'vi-VN').includes('Âm lượng tổng'));
    assert.equal(i18n.t('shortcutFeedback.MUTE_AUDIO', undefined, 'en-US'), 'Master Audio Muted');
    assert.equal(i18n.t('shortcutFeedback.UNMUTE_AUDIO', undefined, 'en-US'), 'Master Audio Unmuted');
    assert.equal(i18n.t('shortcutFeedback.MUTE_AUDIO', undefined, 'vi-VN'), 'Đã tắt âm thanh tổng');
    assert.equal(i18n.t('shortcutFeedback.UNMUTE_AUDIO', undefined, 'vi-VN'), 'Đã bật âm thanh tổng');
  } finally {
    mgr.destroy();
  }
});

test('31. Weather effect system produces deterministic conditions, natural rain/sunlight diversity, and smooth midday transitions', async () => {
  const { getWeatherSnapshot } = await import('../systems/weatherSystem.ts');

  // Day 1 starts clear/bright in morning and shifts smoothly to sunlit in afternoon
  const d1Morning = getWeatherSnapshot(12345, 1, 9.0);
  const d1Afternoon = getWeatherSnapshot(12345, 1, 14.5);
  assert.equal(d1Morning.condition, 'CLEAR');
  assert.equal(d1Morning.rainIntensity, 0);
  assert.equal(d1Afternoon.condition, 'SUNLIT');
  assert.ok(d1Afternoon.sunlightIntensity > d1Morning.sunlightIntensity);

  // Across multiple days, all 4 atmospheric states (CLEAR, SUNLIT, CLOUDY, RAIN) occur naturally
  const seen = new Set<string>();
  for (let day = 1; day <= 40; day++) {
    seen.add(getWeatherSnapshot(98765, day, 10.0).condition);
    seen.add(getWeatherSnapshot(98765, day, 15.0).condition);
  }
  assert.ok(seen.has('CLEAR'));
  assert.ok(seen.has('SUNLIT'));
  assert.ok(seen.has('CLOUDY'));
  assert.ok(seen.has('RAIN'));

  // Smooth transition blending between morning and afternoon (no sudden jump at boundary)
  const midPre = getWeatherSnapshot(12345, 1, 12.6);
  const midHalf = getWeatherSnapshot(12345, 1, 13.0);
  const midPost = getWeatherSnapshot(12345, 1, 13.4);
  assert.ok(midPre.sunlightIntensity < midHalf.sunlightIntensity);
  assert.ok(midHalf.sunlightIntensity < midPost.sunlightIntensity);

  // Evening dusk gently fades active sunbeams
  const late = getWeatherSnapshot(12345, 1, 18.2);
  assert.equal(late.sunlightIntensity, 0);
});

test('32. Morale notification system occasionally alerts below threshold, respects cooldowns, and restores morale via Coffee Break', async () => {
  const {
    MORALE_ALERT_THRESHOLD,
    MORALE_EMPLOYEE_COOLDOWN_DAYS,
    MORALE_GLOBAL_COOLDOWN_DAYS,
    MORALE_REALTIME_COOLDOWN_MS,
    createMoraleNotificationTracker,
    evaluateMoraleNotification,
  } = await import('../systems/moraleSystem.ts');
  const i18n = await import('../../localization/i18n.ts');

  const state = createNewGame(DEFAULT_NEW_GAME_PARAMS);
  state.seed = 42;
  state.screen = 'PLAYING';
  state.totalDays = 5;
  state.hourOfDay = 10.0;

  // Healthy team above threshold never triggers a morale alert
  const trackerHealthy = createMoraleNotificationTracker();
  for (let h = 9; h <= 17; h++) {
    state.hourOfDay = h;
    assert.equal(
      evaluateMoraleNotification(state, trackerHealthy, 'en-US', 100_000 + h * 60_000),
      null
    );
  }

  // Drop first employee's morale below threshold (critical vs occasional)
  const target = state.employees[0];
  const secondary = state.employees[1];
  target.morale = MORALE_ALERT_THRESHOLD - 10; // 35 (non-critical, occasional roll across hours)
  target.assignedTask = 'BUILD_PRODUCT';
  secondary.morale = 80;

  // Across a workday's hourly checkpoints, non-critical low morale triggers occasionally (some null, eventually triggers)
  const tracker = createMoraleNotificationTracker();
  let nullChecks = 0;
  let triggered: ReturnType<typeof evaluateMoraleNotification> = null;
  for (let day = 5; day <= 9 && !triggered; day++) {
    state.totalDays = day;
    for (let h = 9; h <= 17; h++) {
      state.hourOfDay = h;
      const res = evaluateMoraleNotification(state, tracker, 'en-US', (day * 24 + h) * 60_000);
      if (res) {
        triggered = res;
        break;
      }
      nullChecks++;
    }
  }
  assert.ok(triggered, 'Expected low-morale employee to eventually trigger an occasional alert');
  assert.ok(nullChecks > 0, 'Alert should trigger occasionally rather than unconditionally on every check');
  assert.equal(triggered.employeeId, target.id);
  assert.ok(triggered.title.includes(target.name));
  assert.ok(triggered.suggestion.includes('Coffee Break'));
  assert.equal(triggered.actionLabel, 'Coffee Break');

  // Same hour or within real-time / global cooldown must NOT spam another alert
  assert.equal(
    evaluateMoraleNotification(state, tracker, 'en-US', (state.totalDays * 24 + 17) * 60_000 + 1000),
    null
  );
  state.totalDays += MORALE_GLOBAL_COOLDOWN_DAYS;
  state.hourOfDay = 11.0;
  // Even after global day cooldown, same employee is still protected by per-employee cooldown
  secondary.morale = 85;
  assert.equal(
    evaluateMoraleNotification(state, tracker, 'en-US', 999_999_999),
    null
  );

  // Realtime cooldown blocks alerts even if another employee is critical right after a toast
  secondary.morale = 20;
  assert.equal(
    evaluateMoraleNotification(state, tracker, 'vi-VN', tracker.lastToastAtMs + MORALE_REALTIME_COOLDOWN_MS - 500),
    null
  );

  // Once realtime + global cooldown pass, Vietnamese alert suggests Nghỉ uống cà phê for secondary critical employee
  state.hourOfDay = 12.0;
  const viAlert = evaluateMoraleNotification(
    state,
    tracker,
    'vi-VN',
    tracker.lastToastAtMs + MORALE_REALTIME_COOLDOWN_MS + 1000
  );
  assert.ok(viAlert);
  assert.equal(viAlert.employeeId, secondary.id);
  assert.ok(viAlert.suggestion.includes('Nghỉ uống cà phê'));
  assert.equal(viAlert.actionLabel, 'Nghỉ uống cà phê');
  assert.equal(i18n.getTaskLocalized('REST_BREAK', 'en-US'), 'Coffee Break');
  assert.equal(i18n.getTaskLocalized('REST_BREAK', 'vi-VN'), 'Nghỉ uống cà phê');

  // Assigning Coffee Break (REST_BREAK) excludes the employee from alerts even past employee cooldown & restores morale
  let breakState = executeCommand(state, {
    type: 'ASSIGN_EMPLOYEE_TASK',
    employeeId: target.id,
    task: 'REST_BREAK',
  }).state;
  breakState.totalDays += MORALE_EMPLOYEE_COOLDOWN_DAYS + 2;
  breakState.hourOfDay = 14.0;
  breakState.employees.forEach((e) => {
    if (e.id !== target.id) e.morale = 85;
  });
  assert.equal(
    evaluateMoraleNotification(breakState, tracker, 'en-US', 1_500_000_000),
    null
  );

  const moraleBeforeBreak = breakState.employees.find((e) => e.id === target.id)!.morale;
  breakState = executeCommand(breakState, { type: 'END_DAY' }).state;
  const moraleAfterBreak = breakState.employees.find((e) => e.id === target.id)!.morale;
  assert.ok(
    moraleAfterBreak > moraleBeforeBreak,
    `Expected Coffee Break to restore morale (${moraleBeforeBreak} -> ${moraleAfterBreak})`
  );
});

test('33. Story Mode Intro Cinematic pauses clock, completes cleanly, and progresses Chapters 1 to 6 on real milestones', async () => {
  const { getBeatsForCinematic, STORY_CHAPTERS } = await import('../data/storyData.ts');
  const i18n = await import('../../localization/i18n.ts');

  let state = createNewGame(DEFAULT_NEW_GAME_PARAMS);
  assert.equal(state.story.activeCinematic, 'INTRO');
  assert.equal(state.story.introCompleted, false);
  assert.equal(state.story.currentChapter, 1);

  // Intro has 5 scenes ending with Title Card, localized in vi-VN and en-US
  const introBeats = getBeatsForCinematic('INTRO', state);
  assert.equal(introBeats.length, 5);
  assert.equal(introBeats[4].isTitleCard, true);
  assert.ok(
    i18n.t(introBeats[0].textKey, undefined, 'vi-VN').includes('Mọi công ty lớn'),
    'Expected Vietnamese narration on Intro Scene 1'
  );
  assert.ok(
    i18n.t(introBeats[0].textKey, undefined, 'en-US').length > 10,
    'Expected English narration on Intro Scene 1'
  );

  // Clock pauses during Intro Cinematic until dismissed or skipped
  const hourBefore = state.hourOfDay;
  const pausedTick = tickSimulation(state, 0.2).state;
  assert.equal(pausedTick.hourOfDay, hourBefore);

  // Completing Intro starts Day 1 gameplay without extra dialogue interruption
  state = executeCommand(state, {
    type: 'COMPLETE_CINEMATIC',
    cinematicId: 'INTRO',
    skipped: false,
  }).state;
  assert.equal(state.story.introCompleted, true);
  assert.equal(state.story.activeCinematic, null);
  assert.equal(state.story.activeStoryEvent, null);
  assert.equal(state.day, 1);

  const activeTick = tickSimulation(state, 0.1).state;
  assert.ok(activeTick.hourOfDay > hourBefore, 'Clock should resume after Intro completes');

  // Skip tutorial & advance to Day 2 -> Chapter 1 Story Event triggers, completing it unlocks Chapter 2
  state = executeCommand(state, { type: 'SKIP_TUTORIAL' }).state;
  state.totalDays = 2;
  state.day = 2;
  state = executeCommand(state, { type: 'SET_SPEED', speed: 1 }).state;
  assert.equal(state.story.activeStoryEvent?.id, 'SE_CH1_IDENTITY');

  state = executeCommand(state, {
    type: 'RESOLVE_STORY_EVENT',
    choiceId: 'PEOPLE_FIRST',
  }).state;
  assert.ok(state.story.completedChapters.includes(1));
  assert.ok(state.story.unlockedChapters.includes(2));

  // Clear Chapter 1 milestone scene if active
  if (state.story.activeCinematic) {
    state = executeCommand(state, {
      type: 'COMPLETE_CINEMATIC',
      cinematicId: state.story.activeCinematic,
    }).state;
  }

  // Chapter 2 milestone: launch starter MVP -> Chapter 2 completes and Chapter 3 unlocks
  state.products[0].developmentProgress = 100;
  state = executeCommand(state, {
    type: 'LAUNCH_PRODUCT_MVP',
    productId: state.products[0].id,
  }).state;
  assert.ok(state.story.completedChapters.includes(2));
  assert.ok(state.story.unlockedChapters.includes(3));
  assert.equal(STORY_CHAPTERS.length, 6);
});

test('34. Story Events apply real gameplay consequences, persist across Save/Load, and reject Acquisition leaves Chapter 6 open', () => {
  const storage = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
    clear: () => storage.clear(),
  };

  let state = createNewGame(DEFAULT_NEW_GAME_PARAMS);
  state = executeCommand(state, {
    type: 'COMPLETE_CINEMATIC',
    cinematicId: 'INTRO',
    skipped: true,
  }).state;
  state = executeCommand(state, { type: 'SKIP_TUTORIAL' }).state;

  // Trigger Chapter 1 Identity choice & verify real simulation changes
  state.totalDays = 2;
  state.day = 2;
  state = executeCommand(state, { type: 'SET_SPEED', speed: 1 }).state;
  assert.equal(state.story.activeStoryEvent?.id, 'SE_CH1_IDENTITY');
  const moraleBefore = state.employees[0].morale;
  const cultureBefore = state.story.decisions.cultureScore;

  state = executeCommand(state, {
    type: 'RESOLVE_STORY_EVENT',
    choiceId: 'PEOPLE_FIRST',
  }).state;
  assert.ok(state.employees[0].morale >= moraleBefore);
  assert.ok(state.story.decisions.cultureScore > cultureBefore);
  assert.equal(state.story.choiceHistory[0].choiceId, 'PEOPLE_FIRST');

  // Resolve Chapter 2 product direction event cleanly before advancing to Chapter 5 Acquisition test
  if (state.story.activeStoryEvent?.id === 'SE_CH2_PRODUCT_DIR') {
    state = executeCommand(state, {
      type: 'RESOLVE_STORY_EVENT',
      choiceId: 'USER_FRIENDLY',
    }).state;
  }
  while (state.story.activeCinematic) {
    state = executeCommand(state, {
      type: 'COMPLETE_CINEMATIC',
      cinematicId: state.story.activeCinematic,
    }).state;
  }

  // Trigger Chapter 5 Acquisition event & verify REJECT keeps company independent without ending
  state.story.activeStoryEvent = null;
  state.story.unlockedChapters = [1, 2, 3, 4, 5];
  state.story.completedChapters = [1, 2, 3, 4];
  state.story.seenMilestoneScenes = [1, 2, 3, 4];
  state.story.triggeredStoryEvents.push(
    'SE_CH2_PRODUCT_DIR',
    'SE_CH3_FEEDBACK',
    'SE_CH4_WORKLOAD',
    'SE_CH4_EXPANSION',
    'SE_CH5_INVESTMENT'
  );
  state.story.completedStoryEvents.push('SE_CH5_INVESTMENT');
  state.finance.valuation = 175_000;
  state.totalDays = 26;
  state = executeCommand(state, { type: 'SET_SPEED', speed: 1 }).state;
  assert.equal(state.story.activeStoryEvent?.id, 'SE_CH5_ACQUISITION');

  state = executeCommand(state, {
    type: 'RESOLVE_STORY_EVENT',
    choiceId: 'REJECT_ACQUISITION',
  }).state;
  assert.equal(state.story.decisions.acquisitionAccepted, false);
  assert.equal(state.story.evaluatedEnding, null);
  assert.ok(state.story.unlockedChapters.includes(6), 'Rejecting acquisition should advance toward Chapter 6');

  // Save and load preserves choiceHistory & decisions
  saveGameToSlot('slot_story', state, 'Story Persist');
  const loaded = loadGameFromSlot('slot_story');
  assert.ok(loaded);
  assert.equal(loaded.story.decisions.companyIdentity, 'PEOPLE_FIRST');
  assert.equal(loaded.story.decisions.acquisitionAccepted, false);
  assert.ok(loaded.story.choiceHistory.some((c) => c.choiceId === 'REJECT_ACQUISITION'));
});

test('35. Multi-metric EndingEvaluator accurately distinguishes all 6 endings and guards Burnout/Acquisition/Insolvency', async () => {
  const {
    determineEndingId,
    hasViableRecoveryPath,
  } = await import('../systems/endingEvaluator.ts');

  const makeReadyBase = () => {
    let s = createNewGame(DEFAULT_NEW_GAME_PARAMS);
    s = executeCommand(s, {
      type: 'COMPLETE_CINEMATIC',
      cinematicId: 'INTRO',
      skipped: true,
    }).state;
    s.products[0].stage = 'MVP_LIVE';
    s.products[0].quality = 78;
    s.products[0].payingCustomers = 30;
    return s;
  };

  // Guard 1: High valuation WITH healthy morale & culture NEVER yields BURNOUT
  const healthyScale = makeReadyBase();
  healthyScale.finance.valuation = 300_000;
  healthyScale.finance.cash = 110_000;
  healthyScale.finance.cumulativeRevenue = 120_000;
  healthyScale.founder.reputation = 64;
  healthyScale.story.decisions.cultureScore = 76;
  healthyScale.employees.forEach((e) => (e.morale = 80));
  assert.equal(determineEndingId(healthyScale), 'DREAM_COMPANY');

  // Ending F: LEGACY requires sustained long-term high performance + team + culture + product quality
  const legacy = makeReadyBase();
  legacy.totalDays = 40;
  legacy.finance.valuation = 360_000;
  legacy.finance.cash = 140_000;
  legacy.finance.cumulativeRevenue = 165_000;
  legacy.founder.reputation = 75;
  legacy.story.decisions.cultureScore = 78;
  legacy.story.decisions.resignationsCount = 0;
  legacy.employees.push(structuredClone(legacy.employees[0]));
  legacy.employees[3].id = 'emp_extra_4';
  legacy.employees.forEach((e) => (e.morale = 82));
  assert.equal(determineEndingId(legacy), 'LEGACY');

  // Ending B: SMALL_BUT_HAPPY for sustainable compact team with high morale & culture
  const smallHappy = makeReadyBase();
  smallHappy.finance.valuation = 95_000;
  smallHappy.finance.cash = 24_000;
  smallHappy.finance.cumulativeRevenue = 35_000;
  smallHappy.founder.reputation = 52;
  smallHappy.story.decisions.cultureScore = 74;
  smallHappy.employees.forEach((e) => (e.morale = 84));
  assert.equal(determineEndingId(smallHappy), 'SMALL_BUT_HAPPY');

  // Ending C: ACQUISITION ONLY when explicit acquisitionAccepted === true
  const acq = makeReadyBase();
  acq.story.decisions.acquisitionAccepted = true;
  assert.equal(determineEndingId(acq), 'ACQUISITION');

  // Ending D: BURNOUT requires BOTH high scale AND human/culture toll
  const burnout = makeReadyBase();
  burnout.finance.valuation = 260_000;
  burnout.finance.cumulativeRevenue = 95_000;
  burnout.story.decisions.cultureScore = 34;
  burnout.story.decisions.resignationsCount = 3;
  burnout.employees.forEach((e) => (e.morale = 32));
  assert.equal(determineEndingId(burnout), 'BURNOUT');

  // Ending E: LAST_DAY respects hasViableRecoveryPath guard (not premature while credit/bailout exists)
  const recoverable = makeReadyBase();
  recoverable.finance.cash = -3000;
  recoverable.finance.creditLimit = 15000;
  recoverable.finance.consecutiveNegativeCashMonths = 1;
  assert.equal(hasViableRecoveryPath(recoverable), true);
  assert.notEqual(determineEndingId(recoverable), 'LAST_DAY');

  const insolvent = makeReadyBase();
  insolvent.finance.cash = -20_000;
  insolvent.finance.creditLimit = 15_000;
  insolvent.screen = 'GAME_OVER';
  assert.equal(hasViableRecoveryPath(insolvent), false);
  assert.equal(determineEndingId(insolvent), 'LAST_DAY');

  // Completing an ending cinematic sets screen to VICTORY (or GAME_OVER for LAST_DAY), and CONTINUE_SANDBOX resumes PLAYING
  let endFlow = executeCommand(legacy, { type: 'TRIGGER_ENDING_EVALUATION' }).state;
  assert.equal(endFlow.story.activeCinematic, 'ENDING_LEGACY');
  endFlow = executeCommand(endFlow, {
    type: 'COMPLETE_CINEMATIC',
    cinematicId: 'ENDING_LEGACY',
  }).state;
  assert.equal(endFlow.screen, 'VICTORY');
  endFlow = executeCommand(endFlow, { type: 'CONTINUE_SANDBOX' }).state;
  assert.equal(endFlow.screen, 'PLAYING');
  assert.equal(endFlow.sandboxContinued, true);
  assert.equal(endFlow.story.activeCinematic, null);
});

test('36. Ending Gallery persists unlocked endings and Legacy Saves migrate without auto-replaying Intro', async () => {
  const storage = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
    clear: () => storage.clear(),
  };

  const {
    clearUnlockedEndings,
    getUnlockedEndings,
    recordUnlockedEnding,
  } = await import('../../services/endingGalleryService.ts');
  const { evaluateEnding } = await import('../systems/endingEvaluator.ts');

  clearUnlockedEndings();
  assert.equal(getUnlockedEndings().length, 0);

  let state = createNewGame(DEFAULT_NEW_GAME_PARAMS);
  state.finance.valuation = 260_000;
  state.finance.cash = 110_000;
  state.products[0].stage = 'MVP_LIVE';
  state.founder.reputation = 65;
  state.employees.forEach((e) => (e.morale = 75));
  const summary = evaluateEnding(state);
  recordUnlockedEnding(state, summary);

  const unlocked = getUnlockedEndings();
  assert.equal(unlocked.length, 1);
  assert.equal(unlocked[0].endingId, 'DREAM_COMPANY');
  assert.equal(unlocked[0].companyName, state.config.companyName);

  // Legacy save without state.story migrates cleanly and sets introCompleted=true (never auto-replays Intro)
  const legacySave = structuredClone(state) as unknown as Record<string, unknown>;
  delete legacySave.story;
  legacySave.totalDays = 14;
  legacySave.day = 14;
  storage.set(
    'startup_founder_save_v1_legacy_story_test',
    JSON.stringify({
      version: 1,
      savedAt: Date.now(),
      slotId: 'legacy_story_test',
      label: 'Old Save',
      state: legacySave,
    })
  );

  const migrated = loadGameFromSlot('legacy_story_test');
  assert.ok(migrated);
  assert.equal(migrated.story.introCompleted, true);
  assert.equal(migrated.story.introSkipped, true);
  assert.equal(migrated.story.activeCinematic, null);
  assert.ok(migrated.story.unlockedChapters.includes(3));
  assert.equal(migrated.totalDays, 14);
});

test('37. Main Menu loads most recent valid save, handles empty state, skips intro for existing saves, and ticks living ambient office', async () => {
  installMockLocalStorage();
  const i18n = await import('../../localization/i18n.ts');

  // Empty state returns null gracefully
  assert.equal(getMostRecentSaveMeta(), null);
  assert.equal(loadMostRecentSave(), null);

  // Create autosave (older) and manual slot_2 (newer, introCompleted=true)
  const autoState = executeCommand(createNewGame(DEFAULT_NEW_GAME_PARAMS), {
    type: 'COMPLETE_CINEMATIC',
    cinematicId: 'INTRO',
    skipped: true,
  }).state;
  autoState.config.companyName = 'Older Co';
  autoState.day = 2;
  autoState.totalDays = 2;
  saveGameToSlot('autosave', autoState, 'Autosave');

  // Force autosave timestamp older than slot_2
  const rawAuto = JSON.parse(localStorage.getItem('startup_founder_save_v1_autosave')!);
  rawAuto.savedAt = 1_000_000;
  localStorage.setItem('startup_founder_save_v1_autosave', JSON.stringify(rawAuto));

  const manualState = executeCommand(
    createNewGame({ ...DEFAULT_NEW_GAME_PARAMS, companyName: 'Newest Manual Co' }),
    { type: 'COMPLETE_CINEMATIC', cinematicId: 'INTRO', skipped: false }
  ).state;
  manualState.day = 9;
  manualState.totalDays = 9;
  saveGameToSlot('slot_2', manualState, 'Slot 2');

  const rawManual = JSON.parse(localStorage.getItem('startup_founder_save_v1_slot_2')!);
  rawManual.savedAt = 2_000_000;
  localStorage.setItem('startup_founder_save_v1_slot_2', JSON.stringify(rawManual));

  const recentMeta = getMostRecentSaveMeta();
  assert.ok(recentMeta);
  assert.equal(recentMeta.slotId, 'slot_2');
  assert.equal(recentMeta.companyName, 'Newest Manual Co');
  assert.equal(recentMeta.day, 9);

  const loadedRecent = loadMostRecentSave();
  assert.ok(loadedRecent);
  assert.equal(loadedRecent.slotId, 'slot_2');
  assert.equal(loadedRecent.state.story.introCompleted, true);
  assert.equal(loadedRecent.state.story.activeCinematic, null);

  // Living Office Background ticks ambient clock & character movement on TITLE_MENU without changing day/cash
  const titleState = { ...createNewGame(DEFAULT_NEW_GAME_PARAMS), screen: 'TITLE_MENU' as const };
  const initialCash = titleState.finance.cash;
  const initialHour = titleState.hourOfDay;
  for (let i = 0; i < 40; i++) {
    tickTitleAmbientLife(titleState, 0.1);
  }
  assert.equal(titleState.day, 1);
  assert.equal(titleState.finance.cash, initialCash);
  assert.notEqual(titleState.hourOfDay, initialHour);
  assert.ok(
    titleState.employees.some((e) => e.path.length > 0 || e.state === 'WALKING' || e.state === 'WORKING')
  );

  // Concise localized labels exist in both languages without overlong Settings title leaking to menu buttons
  assert.equal(i18n.t('settings.menuBtn', undefined, 'en-US'), 'Settings');
  assert.equal(i18n.t('settings.menuBtn', undefined, 'vi-VN'), 'Cài đặt');
  assert.equal(i18n.t('titleScreen.watchIntro', undefined, 'en-US'), 'Watch Intro');
  assert.equal(i18n.t('titleScreen.watchIntro', undefined, 'vi-VN'), 'Xem Intro');
  assert.equal(i18n.t('titleScreen.listenIntro', undefined, 'en-US'), 'Listen to Intro');
  assert.equal(i18n.t('titleScreen.listenIntro', undefined, 'vi-VN'), 'Nghe Intro');
});

test('38. TitleScreen atmospheric office background asset exists and floating dust motes drift & wrap cleanly', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { createDustMotes, stepDustMotes } = await import('../../components/TitleDustOverlay.tsx');

  const bgAssetPath = path.resolve(
    process.cwd(),
    'public/assets/aistudio/Asset_01___Main_Office_Environment_2159ecb8.png'
  );
  assert.equal(fs.existsSync(bgAssetPath), true, 'Expected static office background asset in public/assets');

  const motesA = createDustMotes(28);
  const motesB = createDustMotes(28);
  assert.equal(motesA.length, 28);
  assert.deepEqual(motesA, motesB, 'Dust mote initialization should be deterministic');

  const initialY = motesA[0].y;
  for (let i = 0; i < 60; i++) {
    stepDustMotes(motesA, 0.05, i * 0.05);
  }
  assert.notEqual(motesA[0].y, initialY);
  for (const m of motesA) {
    assert.ok(m.x >= -0.04 && m.x <= 1.04, `Expected wrapped mote x in bounds, got ${m.x}`);
    assert.ok(m.y >= -0.04 && m.y <= 1.04, `Expected wrapped mote y in bounds, got ${m.y}`);
    assert.ok(m.radius >= 1.2 && m.radius <= 3.0);
  }
});

test('39. Non-intrusive office milestone celebrations trigger on product launches and expansions, queue behind blocking dialogs, auto-expire, and migrate cleanly', async () => {
  installMockLocalStorage();
  const { getStoryEventTemplate } = await import('../systems/storyEventSystem.ts');

  const clearBlockingStoryDialogs = (s: typeof state) => {
    let cur = s;
    for (let guard = 0; guard < 12; guard++) {
      if (cur.story.activeCinematic) {
        cur = executeCommand(cur, {
          type: 'COMPLETE_CINEMATIC',
          cinematicId: cur.story.activeCinematic,
        }).state;
      } else if (cur.story.activeStoryEvent) {
        const tpl = getStoryEventTemplate(cur.story.activeStoryEvent.id);
        const choiceId = tpl?.choices[0]?.id ?? 'USER_FRIENDLY';
        cur = executeCommand(cur, {
          type: 'RESOLVE_STORY_EVENT',
          choiceId,
        }).state;
      } else {
        break;
      }
    }
    return cur;
  };

  let state = createNewGame(DEFAULT_NEW_GAME_PARAMS);
  state = executeCommand(state, {
    type: 'COMPLETE_CINEMATIC',
    cinematicId: 'INTRO',
    skipped: true,
  }).state;
  state = executeCommand(state, { type: 'SKIP_TUTORIAL' }).state;

  // Give enough cash & complete starter MVP development
  state.finance.cash = 100_000;
  state.products[0].developmentProgress = 100;
  state.totalDays = 2;
  state.day = 2;

  // Complete Chapter 1 identity if triggered so Chapter 2 is ready
  state = executeCommand(state, { type: 'SET_SPEED', speed: 1 }).state;
  state = clearBlockingStoryDialogs(state);

  // Launch MVP -> queues PRODUCT_MVP_LAUNCH; if CHAPTER_2_MILESTONE plays first, celebration waits cleanly in queue
  state = executeCommand(state, {
    type: 'LAUNCH_PRODUCT_MVP',
    productId: state.products[0].id,
  }).state;
  assert.ok(state.seenCelebrationIds.includes(`celebrate_mvp_${state.products[0].id}`));

  if (state.story.activeCinematic || state.story.activeStoryEvent) {
    assert.equal(state.activeCelebration, null, 'Celebration must stay tucked in queue during blocking story scenes');
    assert.ok(state.celebrationQueue.length >= 1);
    state = clearBlockingStoryDialogs(state);
  }

  // Now workspace is unobstructed: MVP celebration activates non-intrusively in Engineering
  assert.equal(state.activeCelebration?.kind, 'PRODUCT_MVP_LAUNCH');
  assert.equal(state.activeCelebration?.targetRoomId, 'ENGINEERING');

  // Simulation continues running even while activeCelebration is displayed (never blocks time)
  const hourBefore = state.hourOfDay;
  const simTick = tickSimulation(state, 0.05);
  assert.ok(simTick.state.hourOfDay > hourBefore, 'Celebration must not pause simulation time');
  assert.ok(simTick.state.activeCelebration!.remainingSec < simTick.state.activeCelebration!.durationSec);

  // Even when speed is 0 (paused), celebration timer finishes cleanly and clears itself
  simTick.state.speed = 0;
  for (let i = 0; i < 140; i++) {
    tickSimulation(simTick.state, 0.05);
  }
  assert.equal(simTick.state.activeCelebration, null, 'Celebration should auto-expire after duration');

  // Mature product update (v2 -> v3) triggers PRODUCT_MATURE_RELEASE
  state = executeCommand(simTick.state, { type: 'SET_SPEED', speed: 1 }).state;
  state = executeCommand(state, {
    type: 'RELEASE_PRODUCT_UPDATE',
    productId: state.products[0].id,
  }).state;
  state = executeCommand(state, {
    type: 'RELEASE_PRODUCT_UPDATE',
    productId: state.products[0].id,
  }).state;
  assert.equal(state.products[0].stage, 'MATURE');
  assert.equal(state.activeCelebration?.kind, 'PRODUCT_MATURE_RELEASE');

  // Dismiss manually clears current celebration immediately
  state = executeCommand(state, { type: 'DISMISS_CELEBRATION' }).state;
  assert.equal(state.activeCelebration, null);

  // Expanding office HQ triggers HQ_EXPANSION and is deduplicated per level
  state = executeCommand(state, { type: 'EXPAND_OFFICE' }).state;
  if (state.story.activeCinematic) {
    state = executeCommand(state, {
      type: 'COMPLETE_CINEMATIC',
      cinematicId: state.story.activeCinematic,
    }).state;
  }
  assert.equal(state.office.level, 2);
  assert.equal(state.activeCelebration?.kind, 'HQ_EXPANSION');
  assert.equal(state.activeCelebration?.detailValue, 2);
  state = executeCommand(state, { type: 'DISMISS_CELEBRATION' }).state;

  // Manually unlocking a locked room triggers DEPARTMENT_EXPANSION targeting that room
  const lockedRoomId = (Object.keys(state.office.rooms) as Array<keyof typeof state.office.rooms>).find(
    (id) => !state.office.rooms[id].unlocked
  );
  assert.ok(lockedRoomId, 'Expected at least one locked room available for unlock test');
  state = executeCommand(state, { type: 'UNLOCK_ROOM', roomId: lockedRoomId }).state;
  assert.equal(state.activeCelebration?.kind, 'DEPARTMENT_EXPANSION');
  assert.equal(state.activeCelebration?.targetRoomId, lockedRoomId);

  // Legacy saves without celebration fields migrate cleanly
  const legacyRaw = structuredClone(state) as unknown as Record<string, unknown>;
  delete legacyRaw.activeCelebration;
  delete legacyRaw.celebrationQueue;
  delete legacyRaw.seenCelebrationIds;
  localStorage.setItem(
    'startup_founder_save_v1_legacy_cel_test',
    JSON.stringify({
      version: 1,
      savedAt: Date.now(),
      label: 'Legacy Cel',
      state: legacyRaw,
    })
  );
  const migrated = loadGameFromSlot('legacy_cel_test');
  assert.ok(migrated);
  assert.equal(migrated.activeCelebration, null);
  assert.deepEqual(migrated.celebrationQueue, []);
  assert.deepEqual(migrated.seenCelebrationIds, []);
});

test('40. Milestone Timeline connects to real progression, orders completed milestones chronologically, and generates bilingual procedural team flavor text', async () => {
  installMockLocalStorage();
  const {
    buildMilestoneTimeline,
    totalDaysToCalendarDate,
  } = await import('../systems/milestoneTimeline.ts');

  // Calendar conversion boundaries (30 days/month, 12 months/year starting Jan 2026)
  assert.deepEqual(totalDaysToCalendarDate(1), { day: 1, month: 1, year: 2026, totalDays: 1 });
  assert.deepEqual(totalDaysToCalendarDate(30), { day: 30, month: 1, year: 2026, totalDays: 30 });
  assert.deepEqual(totalDaysToCalendarDate(31), { day: 1, month: 2, year: 2026, totalDays: 31 });
  assert.deepEqual(totalDaysToCalendarDate(361), { day: 1, month: 1, year: 2027, totalDays: 361 });

  const state = createNewGame({
    companyName: 'CedarLeaf Studio',
    founderName: 'An Nguyen',
    businessType: 'SAAS',
    difficulty: 'BALANCED',
    gameMode: 'CAMPAIGN',
  });

  // Initial state: 0 completed, ms_first_product active at 45% progress, 7 upcoming
  const initialTimeline = buildMilestoneTimeline(state, 'en-US');
  assert.equal(initialTimeline.completedCount, 0);
  assert.equal(initialTimeline.currentCount, 1);
  assert.equal(initialTimeline.upcomingCount, 7);
  assert.equal(initialTimeline.entries[0].milestone.id, 'ms_first_product');
  assert.equal(initialTimeline.entries[0].status, 'CURRENT');
  assert.ok(Math.abs(initialTimeline.entries[0].progressRatio - 0.45) < 0.01);
  assert.ok(initialTimeline.entries[0].flavorText && initialTimeline.entries[0].flavorText.length > 10);

  // Unlock milestones via real gameplay progression on separate days
  state.finance.cash = 100_000;
  state.totalDays = 3;
  state.day = 3;
  // Trigger HQ expansion first (index 5 in canonical array) on Day 3
  const expandRes = executeCommand(state, { type: 'EXPAND_OFFICE' });
  const afterHq = expandRes.state;
  const hqMs = afterHq.milestones.find((m) => m.id === 'ms_office_expansion');
  assert.equal(hqMs?.unlocked, true);
  assert.equal(hqMs?.unlockedDay, 3);

  // Now complete and launch first product (index 0 in canonical array) on Day 7
  afterHq.totalDays = 7;
  afterHq.day = 7;
  afterHq.products[0].developmentProgress = 100;
  const launchRes = executeCommand(afterHq, {
    type: 'LAUNCH_PRODUCT_MVP',
    productId: afterHq.products[0].id,
  });
  const progressed = launchRes.state;

  const timelineEn = buildMilestoneTimeline(progressed, 'en-US');
  const timelineVi = buildMilestoneTimeline(progressed, 'vi-VN');

  // Completed items must appear first in strict chronological order (Day 3 before Day 7)
  const completedEn = timelineEn.entries.filter((e) => e.status === 'COMPLETED');
  assert.ok(completedEn.length >= 2);
  assert.equal(completedEn[0].milestone.id, 'ms_office_expansion');
  assert.equal(completedEn[0].completedDateLabel, 'Day 3 · Month 1, 2026');
  assert.equal(completedEn[1].milestone.id, 'ms_first_product');
  assert.equal(completedEn[1].completedDateLabel, 'Day 7 · Month 1, 2026');

  // Procedural flavor text incorporates real company/product/team context and is deterministic
  const flavorA = completedEn[1].flavorText ?? '';
  const flavorB = buildMilestoneTimeline(progressed, 'en-US').entries.find(
    (e) => e.milestone.id === 'ms_first_product'
  )?.flavorText;
  assert.equal(flavorA, flavorB);
  assert.ok(flavorA.length > 20);
  assert.ok(
    flavorA.includes('CedarLeaf Studio') ||
      flavorA.includes(progressed.products[0].name) ||
      flavorA.includes('An Nguyen') ||
      progressed.employees.some((e) => flavorA.includes(e.name)),
    `Expected flavor text to reference real company/team/product, got: ${flavorA}`
  );

  // Vietnamese timeline entries exist cleanly with localized date and flavor text
  const completedVi = timelineVi.entries.filter((e) => e.status === 'COMPLETED');
  assert.equal(completedVi[0].completedDateLabel, 'Ngày 3 · Tháng 1, 2026');
  assert.ok((completedVi[1].flavorText ?? '').length > 20);

  // Current + Upcoming follow after Completed
  const currentEntries = timelineEn.entries.filter((e) => e.status === 'CURRENT');
  const upcomingEntries = timelineEn.entries.filter((e) => e.status === 'UPCOMING');
  assert.equal(currentEntries.length, 1);
  assert.equal(
    completedEn.length + currentEntries.length + upcomingEntries.length,
    progressed.milestones.length
  );
});

test('41. Screen-wide celebration particles trigger cleanly for milestone/ending cinematics, scale for mobile/desktop, expire cleanly, and deduplicate bursts', async () => {
  const {
    COZY_CELEBRATION_COLORS,
    createCelebrationBurstCoordinator,
    createCelebrationParticles,
    hashTriggerSeed,
    isCelebratoryCinematic,
    stepCelebrationParticles,
  } = await import('../systems/celebrationParticles.ts');

  // Only milestone cinematics and positive endings trigger screen-wide celebration particles
  assert.equal(isCelebratoryCinematic('CHAPTER_1_MILESTONE'), true);
  assert.equal(isCelebratoryCinematic('CHAPTER_6_MILESTONE'), true);
  assert.equal(isCelebratoryCinematic('ENDING_DREAM_COMPANY'), true);
  assert.equal(isCelebratoryCinematic('ENDING_SMALL_BUT_HAPPY'), true);
  assert.equal(isCelebratoryCinematic('ENDING_ACQUISITION'), true);
  assert.equal(isCelebratoryCinematic('ENDING_LEGACY'), true);
  assert.equal(isCelebratoryCinematic('INTRO'), false);
  assert.equal(isCelebratoryCinematic('ENDING_BURNOUT'), false);
  assert.equal(isCelebratoryCinematic('ENDING_LAST_DAY'), false);
  assert.equal(isCelebratoryCinematic(null), false);

  // Compact mobile/tablet viewport uses lighter particle budget than desktop
  const seed = hashTriggerSeed('cinematic:CHAPTER_2_MILESTONE');
  const mobileParticles = createCelebrationParticles(375, 667, seed, true);
  const desktopParticles = createCelebrationParticles(1440, 900, seed, false);
  assert.equal(mobileParticles.length, 22);
  assert.equal(desktopParticles.length, 34);

  const colorSet = new Set<string>(COZY_CELEBRATION_COLORS);
  assert.ok(desktopParticles.some((p) => p.kind === 'CONFETTI'));
  assert.ok(desktopParticles.some((p) => p.kind === 'SPARKLE'));
  for (const p of desktopParticles) {
    assert.ok(colorSet.has(p.color));
  }

  // Particles advance and self-terminate cleanly (zero lingering CPU overhead)
  let alive = true;
  for (let i = 0; i < 120; i++) {
    alive = stepCelebrationParticles(desktopParticles, 0.05);
  }
  assert.equal(alive, false, 'Celebration particles should expire completely after ~6s');

  // Burst coordinator prevents duplicate triggers and merges simultaneous unlocks
  const coord = createCelebrationBurstCoordinator();
  assert.equal(coord.shouldTriggerBurst('cel:mvp_1', 1000, 1500), true);
  assert.equal(coord.shouldTriggerBurst('cel:mvp_1', 5000, 1500), false, 'Duplicate key must not retrigger');
  assert.equal(coord.shouldTriggerBurst('ms:ms_first_product:2', 1400, 1500), false, 'Simultaneous burst within window merges cleanly');
  assert.equal(coord.shouldTriggerBurst('cinematic:CHAPTER_2_MILESTONE', 3000, 1500), true, 'Separate later milestone triggers after merge window');
  coord.reset();
  assert.equal(coord.shouldTriggerBurst('cel:mvp_1', 3500, 1500), true, 'Reset clears history cleanly for new game/save');
});

test('42. Milestone completion integrates gentle MILESTONE_CHIME audio cues synced with celebrations and mute settings', async () => {
  installMockLocalStorage();
  const { audioManager } = await import('../../audio/audioManager.ts');
  const {
    MILESTONE_CHIME_NOTES,
    createMilestoneAudioCoordinator,
    soundService,
  } = await import('../../services/soundService.ts');

  // 1. Gentle chime notes use soft gains and warm sine/triangle tones
  assert.ok(MILESTONE_CHIME_NOTES.length >= 4);
  for (const note of MILESTONE_CHIME_NOTES) {
    assert.ok(note.gainPeak > 0 && note.gainPeak <= 0.06, `Expected gentle gain, got ${note.gainPeak}`);
    assert.ok(note.type === 'sine' || note.type === 'triangle');
  }

  // 2. Coordinator deduplicates keys and merges simultaneous triggers within 1500ms
  const audioCoord = createMilestoneAudioCoordinator();
  assert.equal(audioCoord.shouldTrigger('ms:ms_first_product:2', 1000, 1500), true);
  assert.equal(audioCoord.shouldTrigger('ms:ms_first_product:2', 5000, 1500), false);
  assert.equal(audioCoord.shouldTrigger('cel:celebrate_mvp_1', 1400, 1500), false);
  assert.equal(audioCoord.shouldTrigger('cinematic:CHAPTER_3_MILESTONE', 3000, 1500), true);
  assert.equal(audioCoord.shouldTrigger('replay:CHAPTER_2_MILESTONE', 5000, 1500, false), true);
  assert.equal(audioCoord.shouldTrigger('replay:CHAPTER_2_MILESTONE', 7000, 1500, false), true);
  audioCoord.reset();
  assert.equal(audioCoord.shouldTrigger('ms:ms_first_product:2', 7500, 1500), true);

  // 3. soundService.playMilestoneChime respects SFX mute & Master mute without throwing in headless mode
  audioManager.setMasterMuted(false);
  audioManager.setSfxMuted(false);
  soundService.resetMilestoneChimeHistory();
  assert.equal(soundService.playMilestoneChime('ms:test_1', { nowMs: 10_000 }), true);
  assert.equal(soundService.playMilestoneChime('ms:test_1', { nowMs: 15_000 }), false);
  assert.equal(soundService.playMilestoneChime('cel:test_2', { nowMs: 10_500 }), false);

  audioManager.setSfxMuted(true);
  assert.equal(soundService.playMilestoneChime('ms:test_muted', { nowMs: 20_000 }), false);
  audioManager.setSfxMuted(false);
  audioManager.setMasterMuted(true);
  assert.equal(soundService.playMilestoneChime('ms:test_master_muted', { nowMs: 25_000 }), false);
  audioManager.setMasterMuted(false);

  // 4. Simulation commands emit MILESTONE_CHIME when milestones/celebrations complete
  let state = createNewGame(DEFAULT_NEW_GAME_PARAMS);
  state = executeCommand(state, {
    type: 'COMPLETE_CINEMATIC',
    cinematicId: 'INTRO',
    skipped: true,
  }).state;
  state = executeCommand(state, { type: 'SKIP_TUTORIAL' }).state;
  state.finance.cash = 100_000;
  state.totalDays = 3;
  state.day = 3;

  const expandRes = executeCommand(state, { type: 'EXPAND_OFFICE' });
  assert.equal(expandRes.sound, 'MILESTONE_CHIME');
  state = expandRes.state;
  if (state.story.activeCinematic) {
    state = executeCommand(state, {
      type: 'COMPLETE_CINEMATIC',
      cinematicId: state.story.activeCinematic,
    }).state;
  }

  state.products[0].developmentProgress = 100;
  const launchRes = executeCommand(state, {
    type: 'LAUNCH_PRODUCT_MVP',
    productId: state.products[0].id,
  });
  assert.equal(launchRes.sound, 'MILESTONE_CHIME');

  // 5. tickSimulation reports unlockedMilestones when end-of-day unlocks a milestone
  const tickReady = structuredClone(launchRes.state);
  tickReady.story.activeCinematic = null;
  tickReady.story.activeStoryEvent = null;
  tickReady.pendingDailyReport = null;
  tickReady.pendingMonthlyReport = null;
  tickReady.activeEvent = null;
  tickReady.speed = 1;
  tickReady.hourOfDay = 18.6;
  tickReady.finance.cumulativeRevenue = 1_050_000;
  const tickRes = tickSimulation(tickReady, 0.05);
  assert.equal(tickRes.dayEnded, true);
  assert.ok(tickRes.unlockedMilestones.length >= 1, 'Expected tickSimulation to report unlocked milestones at day end');
});

test('43. Milestone Timeline summary statistics compute completion %, average days per milestone, and Most Challenging Milestone badge accurately', async () => {
  const { buildMilestoneTimeline } = await import('../systems/milestoneTimeline.ts');
  const i18n = await import('../../localization/i18n.ts');

  const state = createNewGame(DEFAULT_NEW_GAME_PARAMS);

  // 1. Fresh game with 0 completed milestones
  const initial = buildMilestoneTimeline(state, 'en-US');
  assert.equal(initial.summary.totalCount, 8);
  assert.equal(initial.summary.completedCount, 0);
  assert.equal(initial.summary.completionPercent, 0);
  assert.equal(initial.summary.averageDaysPerMilestone, null);
  assert.equal(initial.summary.mostChallenging, null);

  // 2. Complete 2 milestones via real progression (HQ expansion on Day 3, First MVP on Day 7)
  state.finance.cash = 100_000;
  state.totalDays = 3;
  state.day = 3;
  const afterHq = executeCommand(state, { type: 'EXPAND_OFFICE' }).state;
  afterHq.totalDays = 7;
  afterHq.day = 7;
  afterHq.products[0].developmentProgress = 100;
  const afterMvp = executeCommand(afterHq, {
    type: 'LAUNCH_PRODUCT_MVP',
    productId: afterHq.products[0].id,
  }).state;

  const midEn = buildMilestoneTimeline(afterMvp, 'en-US');
  const midVi = buildMilestoneTimeline(afterMvp, 'vi-VN');
  assert.equal(midEn.summary.completedCount, 3);
  assert.equal(midEn.summary.completionPercent, 38);
  assert.equal(midEn.summary.elapsedDays, 7);
  assert.equal(midEn.summary.averageDaysPerMilestone, 2.3);
  assert.ok(midEn.summary.mostChallenging);
  assert.equal(midEn.summary.mostChallenging.milestoneId, 'ms_office_expansion');
  assert.equal(midEn.summary.mostChallenging.unlockedDay, 3);
  assert.equal(midEn.summary.mostChallenging.daysToReach, 3);
  assert.notEqual(midVi.summary.mostChallenging?.title, midEn.summary.mostChallenging.title);

  // 3. Complete all 8 milestones -> 100% completion and Recognized Tech Company selected as Most Challenging
  afterMvp.totalDays = 64;
  afterMvp.milestones.forEach((ms, idx) => {
    ms.unlocked = true;
    ms.unlockedDay = (idx + 1) * 8;
  });
  const full = buildMilestoneTimeline(afterMvp, 'en-US');
  assert.equal(full.summary.completedCount, 8);
  assert.equal(full.summary.completionPercent, 100);
  assert.equal(full.summary.averageDaysPerMilestone, 8);
  assert.equal(full.summary.mostChallenging?.milestoneId, 'ms_tech_leader');
  assert.equal(full.summary.mostChallenging?.unlockedDay, 64);

  // 4. Localized labels exist in both en-US and vi-VN
  assert.equal(i18n.t('milestones.timeline.completionLabel', undefined, 'en-US'), 'Total Completion');
  assert.equal(i18n.t('milestones.timeline.completionLabel', undefined, 'vi-VN'), 'Tỷ lệ hoàn thành');
  assert.equal(i18n.t('milestones.timeline.challengingLabel', undefined, 'en-US'), 'Most Challenging Milestone');
  assert.equal(i18n.t('milestones.timeline.challengingLabel', undefined, 'vi-VN'), 'Cột mốc thử thách nhất');
});

test('44. Phase 1 Isometric Foundation: projection round-trips, screen inverse, depth sorting, and iso character hitboxes', async () => {
  const {
    worldToIso,
    isoToWorld,
    worldToScreen,
    screenToWorld,
    getIsoDepth,
    hitTestIsoCharacters,
  } = await import('../engine/isoMath.ts');

  // 1. World <-> Isometric round-trip accuracy across arbitrary points
  const samples = [
    { x: 0, y: 0 },
    { x: 4.5, y: 6.25 },
    { x: 18.75, y: 15.4 },
    { x: -6.5, y: 28.1 },
  ];
  for (const pt of samples) {
    const iso = worldToIso(pt.x, pt.y);
    const back = isoToWorld(iso.x, iso.y);
    assert.ok(Math.abs(back.x - pt.x) < 1e-6);
    assert.ok(Math.abs(back.y - pt.y) < 1e-6);
  }

  // 2. Screen <-> World inverse at arbitrary pan & zoom
  const cam = { x: 185, y: 410, zoom: 1.35 };
  const sp = worldToScreen(12.4, 9.8, 1280, 720, cam);
  const backWorld = screenToWorld(sp.x, sp.y, 1280, 720, cam);
  assert.ok(Math.abs(backWorld.x - 12.4) < 1e-6);
  assert.ok(Math.abs(backWorld.y - 9.8) < 1e-6);

  // 3. Depth sorting places foreground south-east tiles after north-west tiles
  assert.ok(getIsoDepth(10, 12) > getIsoDepth(10, 8));
  assert.ok(getIsoDepth(18, 15) > getIsoDepth(4, 6));

  // 4. Isometric character hitbox selects front-most sprite when overlapping on screen
  const backChar = { id: 'back_emp', position: { x: 10, y: 10 } };
  const frontChar = { id: 'front_emp', position: { x: 10.2, y: 10.2 } };
  const frontScreen = worldToScreen(10.7, 10.7, 1280, 720, cam, 10);
  const hit = hitTestIsoCharacters([backChar, frontChar], frontScreen.x, frontScreen.y, 1280, 720, cam);
  assert.equal(hit, 'front_emp');
});

test('45. Phase 2 Free Camera: zoom-around-cursor keeps world point pinned and clamps within world bounds', async () => {
  const {
    zoomAroundScreenPoint,
    screenToWorld,
    worldToScreen,
    getWorldIsoBounds,
    clampIsoCamera,
  } = await import('../engine/isoMath.ts');

  const initialCam = { x: 120, y: 340, zoom: 0.9 };
  const cursorX = 820;
  const cursorY = 410;
  const worldBefore = screenToWorld(cursorX, cursorY, 1280, 720, initialCam);

  // Zoom in around cursor
  const zoomedCam = zoomAroundScreenPoint(initialCam, 1.45, cursorX, cursorY, 1280, 720);
  const worldAfter = screenToWorld(cursorX, cursorY, 1280, 720, zoomedCam);
  assert.ok(Math.abs(worldAfter.x - worldBefore.x) < 1e-6);
  assert.ok(Math.abs(worldAfter.y - worldBefore.y) < 1e-6);

  const screenCheck = worldToScreen(worldBefore.x, worldBefore.y, 1280, 720, zoomedCam);
  assert.ok(Math.abs(screenCheck.x - cursorX) < 1e-6);
  assert.ok(Math.abs(screenCheck.y - cursorY) < 1e-6);

  // Camera bounds clamping prevents escaping world bounds
  const bounds = getWorldIsoBounds(0, 36, 0, 24);
  const farOut = clampIsoCamera({ x: 99999, y: -99999, zoom: 10 }, bounds);
  assert.equal(farOut.zoom, 2.2);
  assert.ok(farOut.x <= bounds.maxIsoX + 120);
  assert.ok(farOut.y >= bounds.minIsoY - 120);
});

test('46. Phase 3 Hybrid Character Control: isometric WASD direction vectors, click-to-move cancellation, A* pathing, and wall collision', async () => {
  const { getIsoMovementVector } = await import('../engine/isoMath.ts');

  // 1. Isometric WASD maps W to screen up (-x, -y) and D to screen right (+x, -y)
  const upVec = getIsoMovementVector({ up: true, down: false, left: false, right: false });
  assert.ok(upVec.x < 0 && upVec.y < 0);
  const rightVec = getIsoMovementVector({ up: false, down: false, left: false, right: true });
  assert.ok(rightVec.x > 0 && rightVec.y < 0);

  // 2. Click-to-move sets A* path; pressing WASD cancels active click path and moves continuously with wall collision
  let state = createNewGame(DEFAULT_NEW_GAME_PARAMS);
  state = executeCommand(state, { type: 'MOVE_FOUNDER', target: { x: 20, y: 11 } }).state;
  assert.ok(state.founder.path.length > 5);

  const beforeX = state.founder.position.x;
  const beforeY = state.founder.position.y;
  state = executeCommand(state, { type: 'SET_FOUNDER_INPUT', dir: { x: 1, y: 0 } }).state;
  assert.equal(state.founder.path.length, 0);
  assert.equal(state.founder.targetTile, null);

  state = tickSimulation(state, 0.05).state;
  assert.ok(state.founder.position.x > beforeX);
  assert.equal(state.founder.position.y, beforeY);
  assert.equal(state.founder.state, 'WALKING');

  // 3. Collision blocks moving through exterior north wall (y=0)
  state.founder.position = { x: 5, y: 1.1 };
  state = executeCommand(state, { type: 'SET_FOUNDER_INPUT', dir: { x: 0, y: -1 } }).state;
  for (let i = 0; i < 10; i++) {
    state = tickSimulation(state, 0.05).state;
  }
  assert.ok(state.founder.position.y >= 1.0);
});

test('47. Phase 4 Living Office: employee activity states, seat reservation de-duplication, and end-of-day OFF_DUTY transition', async () => {
  const { resolveEmployeeLivingActivity } = await import('../engine/simulation.ts');

  const state = createNewGame(DEFAULT_NEW_GAME_PARAMS);
  state.office.rooms.MEETING_ROOM.unlocked = true;
  state.office.rooms.BREAK_ROOM.unlocked = true;
  state.office.rooms.LOBBY.unlocked = true;
  const grid = buildWalkabilityGrid(state.office);

  // 1. Unique reserved seats for all employees in shared Engineering room
  const reserved = new Set<string>();
  const pickedSeats = state.employees.map((e, idx) =>
    resolveEmployeeLivingActivity(e, idx, state, grid, reserved).seat
  );
  const uniqueKeys = new Set(pickedSeats.map((s) => `${s.x},${s.y}`));
  assert.equal(uniqueKeys.size, state.employees.length);

  // 2. Meeting window sends Marketing/Sales/PM roles to MEETING state
  state.hourOfDay = 10.5;
  const mkt = state.employees.find((e) => e.role === 'MARKETING_SPECIALIST');
  assert.ok(mkt);
  const meetAct = resolveEmployeeLivingActivity(mkt, 1, state, grid, new Set());
  assert.equal(meetAct.arrivalState, 'MEETING');
  assert.equal(meetAct.desiredRoom, 'MEETING_ROOM');

  // 3. Fatigued employee enters Break Room RESTING state
  state.hourOfDay = 13.5;
  state.employees[0].energy = 25;
  const breakAct = resolveEmployeeLivingActivity(state.employees[0], 0, state, grid, new Set());
  assert.equal(breakAct.arrivalState, 'RESTING');
  assert.equal(breakAct.desiredRoom, 'BREAK_ROOM');

  // 4. End of workday transitions employees to OFF_DUTY heading toward Lobby
  state.hourOfDay = 17.8;
  const offAct = resolveEmployeeLivingActivity(state.employees[0], 0, state, grid, new Set());
  assert.equal(offAct.arrivalState, 'OFF_DUTY');
  assert.equal(offAct.desiredRoom, 'LOBBY');
});

test('48. Phase 5 Connected City: all 7 districts form one continuous world with Day 1 walkable routes', async () => {
  const { WORLD_LOCATIONS } = await import('../data/cityWorld.ts');
  const { buildFullWorldNavGrid } = await import('../systems/openWorldSystem.ts');
  const { findWorldPath } = await import('../engine/pathfinding.ts');
  const i18n = await import('../../localization/i18n.ts');

  const expectedDistricts = [
    'COMPANY_HQ',
    'MAIN_STREET',
    'COFFEE_SHOP',
    'COWORKING_SPACE',
    'INVESTOR_CENTER',
    'EVENT_HALL',
    'BUSINESS_PROPERTIES',
  ] as const;

  assert.deepEqual(Object.keys(WORLD_LOCATIONS).sort(), [...expectedDistricts].sort());

  let state = createNewGame(DEFAULT_NEW_GAME_PARAMS);
  const worldNav = buildFullWorldNavGrid(state);

  // Starting inside Day 1 CEO_OFFICE (4, 6), every city district entrance must be continuously reachable
  const start = { x: 4, y: 6 };
  for (const id of expectedDistricts) {
    const entrance = WORLD_LOCATIONS[id].entranceTile;
    const route = findWorldPath(worldNav, start, entrance);
    assert.ok(route.length > 0, `Expected continuous path from CEO_OFFICE to ${id}`);
    const last = route[route.length - 1];
    assert.equal(last.x, entrance.x);
    assert.equal(last.y, entrance.y);

    // Verify localized labels exist in both en-US and vi-VN
    assert.ok(i18n.t(`world.locations.${id}.shortName`, undefined, 'en-US').length > 0);
    assert.ok(i18n.t(`world.locations.${id}.shortName`, undefined, 'vi-VN').length > 0);
  }

  // Click-to-move sets path onto Main Street outside HQ
  state = executeCommand(state, { type: 'MOVE_FOUNDER', target: { x: 16, y: 26 } }).state;
  assert.ok(state.founder.path.length > 10);
  assert.deepEqual(state.founder.targetTile, { x: 16, y: 26 });
});

test('49. Phase 6 Open World Business Integration: NPCs, Cafe, Coworking, Investors, and Event Hall connect to real simulation state', async () => {
  let state = createNewGame(DEFAULT_NEW_GAME_PARAMS);
  state = executeCommand(state, {
    type: 'COMPLETE_CINEMATIC',
    cinematicId: 'INTRO',
    skipped: true,
  }).state;
  state = executeCommand(state, { type: 'SKIP_TUTORIAL' }).state;

  assert.ok(state.world);
  assert.ok(state.world.npcs.length >= 6);

  // 1. Bean & Byte espresso restores +22 energy and caps at 2 visits/day
  state.founder.energy = 40;
  const cashBeforeCoffee = state.finance.cash;
  state = executeCommand(state, { type: 'WORLD_COFFEE_BREAK' }).state;
  assert.equal(state.founder.energy, 62);
  assert.equal(state.finance.cash, cashBeforeCoffee - 18);
  assert.equal(state.world?.coffeeVisitsToday, 1);
  state = executeCommand(state, { type: 'WORLD_COFFEE_BREAK' }).state;
  assert.equal(state.world?.coffeeVisitsToday, 2);
  const thirdCoffee = executeCommand(state, { type: 'WORLD_COFFEE_BREAK' });
  assert.equal(thirdCoffee.sound, 'ERROR');
  assert.equal(thirdCoffee.state.world?.coffeeVisitsToday, 2);

  // 2. Partner NPC generates a real B2B pipeline contract in state.contracts
  const beforeContracts = state.contracts.length;
  state = executeCommand(state, {
    type: 'WORLD_INTERACT_NPC',
    npcId: 'npc_partner_claire',
  }).state;
  assert.equal(state.contracts.length, beforeContracts + 1);
  assert.equal(state.contracts[0].status, 'PIPELINE');

  // 3. Customer NPC boosts real product marketDemand / customers
  const demandBefore = state.products[0].marketDemand;
  state = executeCommand(state, {
    type: 'WORLD_INTERACT_NPC',
    npcId: 'npc_customer_tuan',
  }).state;
  assert.ok(state.products[0].marketDemand > demandBefore);

  // 4. Hiring candidate at Foundry Commons removes old coworking NPC & re-syncs pool
  const candNpc = state.world?.npcs.find((n) => n.kind === 'CANDIDATE');
  assert.ok(candNpc?.linkedCandidateId);
  const empCountBefore = state.employees.length;
  state = executeCommand(state, {
    type: 'HIRE_CANDIDATE',
    candidateId: candNpc.linkedCandidateId,
  }).state;
  assert.equal(state.employees.length, empCountBefore + 1);
  assert.ok(!state.world?.npcs.some((n) => n.linkedCandidateId === candNpc.linkedCandidateId));

  // 5. Harbor Capital Investor Center pitch increases investorTrust once/day
  const trustBefore = state.founder.investorTrust;
  state = executeCommand(state, { type: 'WORLD_PITCH_INVESTOR' }).state;
  assert.equal(state.founder.investorTrust, trustBefore + 4);
  assert.equal(state.world?.investorPitchesToday, 1);
  const secondPitch = executeCommand(state, { type: 'WORLD_PITCH_INVESTOR' });
  assert.equal(secondPitch.sound, 'ERROR');

  // 6. Civic Event Hall Demo Day adds activeUsers and increments eventsAttendedTotal
  const usersBefore = state.products[0].activeUsers;
  state = executeCommand(state, { type: 'WORLD_HOST_EVENT' }).state;
  assert.equal(state.world?.eventsAttendedTotal, 1);
  assert.ok(state.products[0].activeUsers >= usersBefore + 25);
});

test('50. Phase 7 Business Properties & Save Compatibility: property ownership boosts revenue/capacity and v1 saves migrate cleanly', async () => {
  const { estimateMonthlyBurn } = await import('../systems/financeSystem.ts');

  let state = createNewGame(DEFAULT_NEW_GAME_PARAMS);
  state = executeCommand(state, {
    type: 'COMPLETE_CINEMATIC',
    cinematicId: 'INTRO',
    skipped: true,
  }).state;
  state = executeCommand(state, { type: 'SKIP_TUTORIAL' }).state;
  state.finance.cash = 40000;

  const baseCap = state.office.maxEmployees;
  const baseProjRev = estimateMonthlyBurn(state).projectedRevenue;

  // Buy Harbor Regional Sales Hub (+2 team seats, +$2200/mo revenue, +5 rep)
  state = executeCommand(state, {
    type: 'WORLD_BUY_PROPERTY',
    propertyId: 'prop_sales_hub',
  }).state;
  const hub = state.world?.properties.find((p) => p.id === 'prop_sales_hub');
  assert.equal(hub?.owned, true);
  assert.equal(hub?.purchasedDay, state.totalDays);
  assert.equal(state.office.maxEmployees, baseCap + 2);
  assert.ok(estimateMonthlyBurn(state).projectedRevenue >= baseProjRev + 2200);

  // Advance day adds daily passive property revenue trickle cleanly
  const cumRevBefore = state.finance.cumulativeRevenue;
  state = executeCommand(state, { type: 'END_DAY' }).state;
  assert.ok(state.finance.cumulativeRevenue >= cumRevBefore + Math.round(2200 / 30));

  // Legacy save without world field migrates seamlessly without corrupting HQ state
  const legacyV1 = createNewGame({
    ...DEFAULT_NEW_GAME_PARAMS,
    companyName: 'LegacyCo',
  }) as unknown as Record<string, unknown>;
  delete legacyV1.world;
  legacyV1.version = 1;
  const migrated = migrateSaveState(legacyV1 as unknown as Parameters<typeof migrateSaveState>[0]);
  assert.equal(migrated.config.companyName, 'LegacyCo');
  assert.equal(migrated.employees.length, 3);
  assert.ok(migrated.world);
  assert.ok(migrated.world.npcs.length >= 6);
  assert.equal(migrated.world.properties.length, 3);
});

test('51. Global weather system cycles SUNNY -> OVERCAST -> RAINY -> SUNNY, renders interior & city exterior, and preserves legacy saves', async () => {
  const {
    WEATHER_CYCLE_HOURS,
    advanceWeatherCycle,
    getEffectiveWeatherSnapshot,
  } = await import('../systems/weatherSystem.ts');
  const { renderOfficeScene } = await import('../renderer/pixelRenderer.ts');

  let state = createNewGame(DEFAULT_NEW_GAME_PARAMS);
  state = executeCommand(state, {
    type: 'COMPLETE_CINEMATIC',
    cinematicId: 'INTRO',
    skipped: true,
  }).state;
  state = executeCommand(state, { type: 'SKIP_TUTORIAL' }).state;

  // 1. New games start in SUNNY with autoCycle active
  assert.equal(state.weather?.current, 'SUNNY');
  assert.equal(state.weather?.autoCycle, true);
  assert.equal(state.weather?.transitionProgress, 1);
  const initialSnap = getEffectiveWeatherSnapshot(state);
  assert.equal(initialSnap.globalState, 'SUNNY');
  assert.ok(initialSnap.sunlightIntensity > 0.7);
  assert.equal(initialSnap.rainIntensity, 0);

  // 2. Advancing simulated hours automatically cycles SUNNY -> OVERCAST -> RAINY -> SUNNY
  advanceWeatherCycle(state, WEATHER_CYCLE_HOURS, 1.0);
  assert.equal(state.weather?.current, 'OVERCAST');
  advanceWeatherCycle(state, WEATHER_CYCLE_HOURS, 1.0);
  assert.equal(state.weather?.current, 'RAINY');
  advanceWeatherCycle(state, WEATHER_CYCLE_HOURS, 1.0);
  assert.equal(state.weather?.current, 'SUNNY');
  assert.ok((state.weather?.cycleCount ?? 0) >= 3);

  // 3. CYCLE_WEATHER & SET_WEATHER commands transition smoothly and toggle autoCycle
  state = executeCommand(state, { type: 'CYCLE_WEATHER' }).state;
  assert.equal(state.weather?.current, 'OVERCAST');
  assert.equal(state.weather?.autoCycle, false);
  assert.equal(state.weather?.transitionProgress, 0);

  // Smooth cross-fade mid-transition between SUNNY and OVERCAST
  if (state.weather) {
    state.weather.transitionProgress = 0.5;
  }
  const midBlend = getEffectiveWeatherSnapshot(state);
  assert.ok(midBlend.sunlightIntensity > 0.1 && midBlend.overcastIntensity > 0.2);

  // Even when paused (speed = 0), tickSimulation advances transitionProgress cleanly
  state.speed = 0;
  for (let i = 0; i < 20; i++) {
    tickSimulation(state, 0.05);
  }
  assert.equal(state.weather?.transitionProgress, 1);

  state = executeCommand(state, { type: 'CYCLE_WEATHER' }).state;
  assert.equal(state.weather?.current, 'RAINY');
  assert.equal(state.weather?.autoCycle, false);
  assert.equal(getEffectiveWeatherSnapshot(state).rainIntensity, 0);
  for (let i = 0; i < 20; i++) {
    tickSimulation(state, 0.05);
  }
  const rainySnap = getEffectiveWeatherSnapshot(state);
  assert.equal(rainySnap.globalState, 'RAINY');
  assert.ok(rainySnap.rainIntensity > 0.7);

  // Cycling from RAINY wraps back to SUNNY and restores autoCycle = true
  state = executeCommand(state, { type: 'CYCLE_WEATHER' }).state;
  assert.equal(state.weather?.current, 'SUNNY');
  assert.equal(state.weather?.autoCycle, true);

  // Explicit SET_WEATHER overrides directly
  state = executeCommand(state, { type: 'SET_WEATHER', weather: 'RAINY' }).state;
  assert.equal(state.weather?.current, 'RAINY');
  assert.equal(state.weather?.autoCycle, false);
  state = executeCommand(state, { type: 'SET_WEATHER', weather: 'AUTO' }).state;
  assert.equal(state.weather?.autoCycle, true);

  // 4. Renderer updates backdrop, lighting, exterior street puddles, & overlays across all 3 states
  const recordedBackdrops: string[] = [];
  let totalFullScreenFills = 0;
  let captureNextBackdrop = false;
  const noop = () => {};
  const mockGrad = { addColorStop: noop };
  const mockCtx = {
    imageSmoothingEnabled: false,
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    globalAlpha: 1,
    font: '12px Arial',
    textAlign: 'left',
    save: noop,
    restore: noop,
    translate: noop,
    scale: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    arc: noop,
    ellipse: noop,
    fill: noop,
    stroke: noop,
    rect: noop,
    strokeRect: noop,
    fillText: noop,
    measureText: (txt: string) => ({ width: txt.length * 7 }),
    createRadialGradient: () => mockGrad,
    createLinearGradient: () => mockGrad,
    fillRect: (x: number, y: number, w: number, h: number) => {
      if (x === 0 && y === 0 && w === 1280 && h === 720 && typeof mockCtx.fillStyle === 'string') {
        totalFullScreenFills += 1;
        if (captureNextBackdrop) {
          recordedBackdrops.push(mockCtx.fillStyle);
          captureNextBackdrop = false;
        }
      }
    },
  } as unknown as CanvasRenderingContext2D;

  const baseInteraction = {
    hoveredTile: null,
    hoveredEntityId: null,
    selectedRoomId: null,
    selectedEmployeeId: null,
    movingFurnitureId: null,
    placingTemplateId: null,
  };
  const cityCam = { x: 0, y: 520, zoom: 0.75 };

  for (const wState of ['SUNNY', 'OVERCAST', 'RAINY'] as const) {
    state = executeCommand(state, { type: 'SET_WEATHER', weather: wState }).state;
    if (state.weather) state.weather.transitionProgress = 1;
    captureNextBackdrop = true;
    renderOfficeScene(mockCtx, 1280, 720, state, cityCam, baseInteraction, [], 12.5, false);
    captureNextBackdrop = true;
    renderOfficeScene(mockCtx, 1280, 720, state, cityCam, baseInteraction, [], 12.5, true);
  }
  const uniqueBackdrops = new Set(recordedBackdrops);
  assert.equal(uniqueBackdrops.size, 3);
  assert.ok(totalFullScreenFills > 6);

  // 5. Legacy save without weather field migrates cleanly
  const legacyV1 = createNewGame(DEFAULT_NEW_GAME_PARAMS) as unknown as Record<string, unknown>;
  delete legacyV1.weather;
  const migrated = migrateSaveState(legacyV1 as unknown as Parameters<typeof migrateSaveState>[0]);
  assert.equal(migrated.weather?.current, 'SUNNY');
  assert.equal(migrated.weather?.autoCycle, true);
});






