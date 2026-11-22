import {
  GameState,
  RoomId,
  StartupObjective,
  TutorialState,
  TutorialStepId,
} from '@/src/types/game';

export interface TutorialStepMeta {
  step: TutorialStepId;
  title: string;
  actionPrompt: string;
  explanation: string;
  targetArea: 'EMPLOYEES' | 'OFFICE_CANVAS' | 'PRODUCTS' | 'MARKET' | 'FINANCE' | 'END_DAY';
  recommendedTab: 'OFFICE' | 'EMPLOYEES' | 'PRODUCTS' | 'FINANCE' | 'MARKET';
}

export const TUTORIAL_STEPS: TutorialStepMeta[] = [
  {
    step: 1,
    title: 'Step 1: Meet Your Team',
    actionPrompt: 'Click any employee in the office or open Employees to review your founding team.',
    explanation:
      'Your 3 starting employees have unique roles, skills, salaries, and energy. Higher skills produce faster, higher-quality work.',
    targetArea: 'EMPLOYEES',
    recommendedTab: 'EMPLOYEES',
  },
  {
    step: 2,
    title: 'Step 2: Explore the Office',
    actionPrompt: 'Click both the CEO Office and the Engineering Room on the office map.',
    explanation:
      'You start with 2 unlocked rooms. Click rooms or desks to inspect stats and run contextual actions. More departments unlock as you grow.',
    targetArea: 'OFFICE_CANVAS',
    recommendedTab: 'OFFICE',
  },
  {
    step: 3,
    title: 'Step 3: Create Your First Product',
    actionPrompt: 'Open Products, choose a product type, and start building your product idea.',
    explanation:
      'Starting a product takes an upfront R&D budget and advances daily toward 100% MVP readiness.',
    targetArea: 'PRODUCTS',
    recommendedTab: 'PRODUCTS',
  },
  {
    step: 4,
    title: 'Step 4: Assign Work',
    actionPrompt: 'Assign an employee task in Employees (or the employee drawer) to build your product.',
    explanation:
      'Matching an employee’s strongest skill to their assigned task increases daily productivity and shortens completion time.',
    targetArea: 'EMPLOYEES',
    recommendedTab: 'EMPLOYEES',
  },
  {
    step: 5,
    title: 'Step 5: Launch Your MVP',
    actionPrompt: 'Open Products, finish your prototype to 100% (run a Build Sprint if needed), and click Launch MVP Now.',
    explanation:
      'Launching your Minimum Viable Product brings your first active users and paying customers. Higher quality attracts more buyers.',
    targetArea: 'PRODUCTS',
    recommendedTab: 'PRODUCTS',
  },
  {
    step: 6,
    title: 'Step 6: Find Your First Customer',
    actionPrompt: 'Open Market and launch a marketing campaign (or sign a client contract).',
    explanation:
      'Marketing campaigns spend daily budget to bring new customers to your live product, turning awareness into recurring revenue.',
    targetArea: 'MARKET',
    recommendedTab: 'MARKET',
  },
  {
    step: 7,
    title: 'Step 7: Understand Finances',
    actionPrompt: 'Open Finance to inspect cash balance, salaries, rent, R&D expenses, and monthly payroll.',
    explanation:
      'Salaries, founder draw, rent, and maintenance are billed on Day 30. Keep enough cash runway to avoid debt or bankruptcy.',
    targetArea: 'FINANCE',
    recommendedTab: 'FINANCE',
  },
  {
    step: 8,
    title: 'Step 8: End Your First Day',
    actionPrompt: 'Click End Day in the top bar to complete Day 1 and view your first progress report.',
    explanation:
      'Each day updates product progress, customer revenue, and employee stamina. Every 30 days closes a financial month.',
    targetArea: 'END_DAY',
    recommendedTab: 'OFFICE',
  },
];

export function createInitialTutorialState(): TutorialState {
  return {
    active: true,
    currentStep: 1,
    completed: false,
    skipped: false,
    reviewedEmployee: false,
    exploredCeoOffice: false,
    exploredEngineering: false,
    createdProduct: false,
    assignedWork: false,
    launchedMvp: false,
    foundFirstCustomer: false,
    reviewedFinances: false,
    endedFirstDay: false,
    instructionsOpen: true,
  };
}

export function createInitialObjectives(): StartupObjective[] {
  return [
    { id: 'obj_review_employees', label: 'Review your employees', completed: false, completedDay: null },
    { id: 'obj_create_product', label: 'Create your first product', completed: false, completedDay: null },
    { id: 'obj_assign_tasks', label: 'Assign development tasks', completed: false, completedDay: null },
    { id: 'obj_launch_mvp', label: 'Launch your MVP', completed: false, completedDay: null },
    { id: 'obj_acquire_customer', label: 'Acquire your first customer', completed: false, completedDay: null },
    { id: 'obj_first_revenue', label: 'Generate your first revenue', completed: false, completedDay: null },
  ];
}

export function getTutorialStepMeta(step: TutorialStepId): TutorialStepMeta {
  return TUTORIAL_STEPS.find((s) => s.step === step) ?? TUTORIAL_STEPS[0];
}

export function syncTutorialAndObjectives(state: GameState): void {
  if (!state.tutorial) {
    state.tutorial = createInitialTutorialState();
  }
  if (!Array.isArray(state.objectives) || state.objectives.length === 0) {
    state.objectives = createInitialObjectives();
  }

  const t = state.tutorial;
  const hasLiveProduct = state.products.some(
    (p) => p.stage === 'MVP_LIVE' || p.stage === 'MATURE'
  );
  const totalCustomers = state.products.reduce((s, p) => s + p.payingCustomers, 0);
  const hasActiveContract = state.contracts.some((c) => c.status === 'ACTIVE');
  const hasActiveCampaign = state.campaigns.some((c) => c.active);
  const hasRevenue =
    state.finance.cumulativeRevenue > 0 || state.finance.currentMonthRevenue > 0;

  if (state.products.length >= 2) t.createdProduct = true;
  if (hasLiveProduct) t.launchedMvp = true;
  if (totalCustomers > 0 || hasActiveContract || hasActiveCampaign) {
    if (t.currentStep >= 6 || totalCustomers > 0 || hasActiveContract) {
      // Only consider marketing action for step 6 once step 5 or campaign exists
      if (hasActiveCampaign || hasActiveContract || (t.launchedMvp && totalCustomers > 0 && hasActiveCampaign)) {
        t.foundFirstCustomer = true;
      }
    }
  }
  if (state.totalDays > (t.restartAnchorDay ?? 1)) {
    t.endedFirstDay = true;
  }

  // Advance tutorial steps sequentially while active (unless player stepped back to review)
  if (t.active && !t.completed && !t.skipped && t.manualHoldStep !== t.currentStep) {
    t.manualHoldStep = null;
    if (t.currentStep === 1 && t.reviewedEmployee) {
      t.currentStep = 2;
    }
    if (t.currentStep === 2 && t.exploredCeoOffice && t.exploredEngineering) {
      t.currentStep = 3;
    }
    if (t.currentStep === 3 && t.createdProduct) {
      t.currentStep = 4;
    }
    if (t.currentStep === 4 && t.assignedWork) {
      t.currentStep = 5;
    }
    if (t.currentStep === 5 && t.launchedMvp) {
      t.currentStep = 6;
    }
    if (t.currentStep === 6 && t.foundFirstCustomer) {
      t.currentStep = 7;
    }
    if (t.currentStep === 7 && t.reviewedFinances) {
      t.currentStep = 8;
    }
    if (t.currentStep === 8 && t.endedFirstDay) {
      t.completed = true;
      t.active = false;
    }
  }

  // Sync permanent objectives checklist
  const completionMap: Record<StartupObjective['id'], boolean> = {
    obj_review_employees: t.reviewedEmployee || state.employees.length > 3,
    obj_create_product: t.createdProduct || state.products.length >= 2 || hasLiveProduct,
    obj_assign_tasks: t.assignedWork || hasLiveProduct,
    obj_launch_mvp: hasLiveProduct,
    obj_acquire_customer: totalCustomers > 0 || hasActiveContract,
    obj_first_revenue: hasRevenue,
  };

  state.objectives = state.objectives.map((obj) => {
    const done = obj.completed || Boolean(completionMap[obj.id]);
    return {
      ...obj,
      completed: done,
      completedDay: done ? (obj.completedDay ?? state.totalDays) : null,
    };
  });
}

export function evaluateRoomUnlocks(state: GameState): RoomId[] {
  const unlockedNow: RoomId[] = [];
  const totalPaying = state.products.reduce((s, p) => s + p.payingCustomers, 0);
  const hasLiveProduct = state.products.some(
    (p) => p.stage === 'MVP_LIVE' || p.stage === 'MATURE'
  );

  const tryUnlock = (roomId: RoomId, condition: boolean) => {
    const room = state.office.rooms[roomId];
    if (room && !room.unlocked && condition) {
      room.unlocked = true;
      unlockedNow.push(roomId);
    }
  };

  tryUnlock('HR_DEPT', state.totalDays >= 2);
  tryUnlock('FINANCE_DEPT', state.totalDays >= 2);
  tryUnlock('BREAK_ROOM', state.totalDays >= 3);
  tryUnlock('MEETING_ROOM', hasLiveProduct);
  tryUnlock('LOBBY', totalPaying >= 5);
  tryUnlock('LEGAL_DEPT', totalPaying >= 10);

  return unlockedNow;
}

export function getNextRecommendedAction(state: GameState): {
  objectiveTitle: string;
  actionText: string;
  targetModal: 'OFFICE' | 'EMPLOYEES' | 'PRODUCTS' | 'FINANCE' | 'MARKET' | 'END_DAY';
  progressLabel: string;
} {
  if (state.tutorial?.active && !state.tutorial.completed && !state.tutorial.skipped) {
    const meta = getTutorialStepMeta(state.tutorial.currentStep);
    return {
      objectiveTitle: meta.title,
      actionText: meta.actionPrompt,
      targetModal: meta.targetArea === 'END_DAY' ? 'END_DAY' : meta.recommendedTab,
      progressLabel: `Tutorial ${state.tutorial.currentStep}/8`,
    };
  }

  const objs = state.objectives ?? [];
  const doneCount = objs.filter((o) => o.completed).length;
  const nextObj = objs.find((o) => !o.completed);
  if (nextObj) {
    const actionMap: Record<
      StartupObjective['id'],
      { actionText: string; targetModal: 'EMPLOYEES' | 'PRODUCTS' | 'MARKET' | 'FINANCE' }
    > = {
      obj_review_employees: {
        actionText: 'Open Employees or click a team member in the office to review skills.',
        targetModal: 'EMPLOYEES',
      },
      obj_create_product: {
        actionText: 'Open Products to start building your first product idea.',
        targetModal: 'PRODUCTS',
      },
      obj_assign_tasks: {
        actionText: 'Assign your team members to product development tasks in Employees.',
        targetModal: 'EMPLOYEES',
      },
      obj_launch_mvp: {
        actionText: 'Bring a product to 100% development and click Launch MVP Now.',
        targetModal: 'PRODUCTS',
      },
      obj_acquire_customer: {
        actionText: 'Open Market to run a marketing campaign or pitch a client contract.',
        targetModal: 'MARKET',
      },
      obj_first_revenue: {
        actionText: 'Advance the day with live customers to record your first revenue.',
        targetModal: 'FINANCE',
      },
    };
    const next = actionMap[nextObj.id];
    return {
      objectiveTitle: `Objective: ${nextObj.label}`,
      actionText: next.actionText,
      targetModal: next.targetModal,
      progressLabel: `${doneCount}/${objs.length} Objectives`,
    };
  }

  if (state.finance.cash < 5000) {
    return {
      objectiveTitle: 'Stabilize Cash Runway',
      actionText: 'Cash is low. Open Finance to review burn rate or adjust expenses.',
      targetModal: 'FINANCE',
      progressLabel: `${doneCount}/${objs.length} Objectives`,
    };
  }

  return {
    objectiveTitle: 'Grow Profitability & Scale',
    actionText: 'Upgrade product quality, expand marketing reach, and build toward Level 4 HQ.',
    targetModal: 'MARKET',
    progressLabel: `${doneCount}/${objs.length} Objectives`,
  };
}
