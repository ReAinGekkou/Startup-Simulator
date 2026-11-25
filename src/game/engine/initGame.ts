import { createInitialAchievements } from '@/src/game/data/achievements';
import { createInitialMilestones } from '@/src/game/data/milestones';
import { createInitialOfficeState } from '@/src/game/data/officeLayout';
import { businessTypeToCategory, createInitialCompetitors } from '@/src/game/data/products';
import { ROLE_DEFINITIONS } from '@/src/game/data/roles';
import { getRoomSeatTile } from '@/src/game/engine/pathfinding';
import {
  generateCandidatePool,
  getLevelTitle,
} from '@/src/game/systems/employeeSystem';
import { createProductEntity } from '@/src/game/systems/productSystem';
import { createInitialStoryState } from '@/src/game/systems/chapterProgression';
import { ensureOpenWorldState } from '@/src/game/systems/openWorldSystem';
import { ensureWeatherState } from '@/src/game/systems/weatherSystem';
import {
  createInitialObjectives,
  createInitialTutorialState,
} from '@/src/game/systems/tutorialSystem';
import { getLocale, getRoleLocalized } from '@/src/localization';
import { BusinessType, DifficultyLevel, Employee, GameState, NewGameParams } from '@/src/types/game';

const DEFAULT_PRODUCT_NAMES: Record<BusinessType, string> = {
  SAAS: 'PulseFlow Cloud',
  MOBILE_APP: 'SnapHabit Mobile',
  GAME_STUDIO: 'Starlight Harbor',
  AI_TOOLS: 'SynthCraft Studio',
  WEB_PLATFORM: 'DockGrid Portal',
};

export const DEFAULT_NEW_GAME_PARAMS: NewGameParams = {
  companyName: 'BrightForge Labs',
  founderName: 'Samira Vance',
  businessType: 'SAAS',
  difficulty: 'BALANCED',
  gameMode: 'CAMPAIGN',
};

export function createNewGame(params: NewGameParams = DEFAULT_NEW_GAME_PARAMS): GameState {
  const seed = Date.now() % 1_000_000;
  const office = createInitialOfficeState();

  const startingCashByDiff: Record<DifficultyLevel, number> = {
    BOOTSTRAPPED: 28000,
    BALANCED: 42000,
    ANGEL_BACKED: 68000,
  };

  const startingCash = startingCashByDiff[params.difficulty];
  const category = businessTypeToCategory(params.businessType);
  const starterProduct = createProductEntity(
    'prod_starter_1',
    DEFAULT_PRODUCT_NAMES[params.businessType],
    category,
    category === 'GAME' ? 'ONE_TIME' : category === 'WEB_PLATFORM' ? 'ENTERPRISE_LICENSE' : 'SUBSCRIPTION',
    45
  );

  const starterEmployees: Employee[] = [
    {
      id: 'emp_starter_1',
      name: 'Liam Chen',
      role: 'SOFTWARE_ENGINEER',
      level: 2,
      title: getLevelTitle('SOFTWARE_ENGINEER', 2),
      monthlySalary: 3200,
      skills: { engineering: 68, design: 38, marketing: 22, sales: 20, finance: 24, operations: 36 },
      productivity: 105,
      energy: 92,
      morale: 86,
      stress: 15,
      personality: 'PRAGMATIC',
      experience: 40,
      traits: [],
      assignedTask: 'BUILD_PRODUCT',
      assignedProductId: starterProduct.id,
      homeRoom: 'ENGINEERING',
      deskId: 'furn_eng_desk_1',
      position: getRoomSeatTile(office, 'ENGINEERING', 0),
      targetTile: null,
      path: [],
      facing: 'UP',
      state: 'WORKING',
      thoughtIcon: '💻',
      appearance: {
        skinTone: '#f2ccb0',
        hairColor: '#1e1b18',
        hairStyle: 'SHORT',
        shirtColor: ROLE_DEFINITIONS.SOFTWARE_ENGINEER.outfitColor,
        pantsColor: '#1e293b',
        hasGlasses: true,
      },
      hiredDay: 1,
      lastTrainedDay: 0,
      resignationWarning: false,
    },
    {
      id: 'emp_starter_2',
      name: 'Maya Patel',
      role: 'DESIGNER',
      level: 1,
      title: getLevelTitle('DESIGNER', 1),
      monthlySalary: 2550,
      skills: { engineering: 34, design: 64, marketing: 36, sales: 24, finance: 20, operations: 30 },
      productivity: 98,
      energy: 90,
      morale: 88,
      stress: 14,
      personality: 'CREATIVE',
      experience: 25,
      traits: [],
      assignedTask: 'BUILD_PRODUCT',
      assignedProductId: starterProduct.id,
      homeRoom: 'ENGINEERING',
      deskId: 'furn_eng_desk_2',
      position: getRoomSeatTile(office, 'ENGINEERING', 3),
      targetTile: null,
      path: [],
      facing: 'UP',
      state: 'WORKING',
      thoughtIcon: '🎨',
      appearance: {
        skinTone: '#c68b63',
        hairColor: '#1e1b18',
        hairStyle: 'PONYTAIL',
        shirtColor: ROLE_DEFINITIONS.DESIGNER.outfitColor,
        pantsColor: '#334155',
        hasGlasses: false,
      },
      hiredDay: 1,
      lastTrainedDay: 0,
      resignationWarning: false,
    },
    {
      id: 'emp_starter_3',
      name: 'Noah Brooks',
      role: 'MARKETING_SPECIALIST',
      level: 1,
      title: getLevelTitle('MARKETING_SPECIALIST', 1),
      monthlySalary: 2450,
      skills: { engineering: 22, design: 40, marketing: 62, sales: 48, finance: 26, operations: 32 },
      productivity: 96,
      energy: 91,
      morale: 84,
      stress: 16,
      personality: 'SOCIAL',
      experience: 20,
      traits: [],
      assignedTask: 'MARKET_GROWTH',
      assignedProductId: starterProduct.id,
      homeRoom: 'ENGINEERING',
      deskId: 'furn_eng_desk_3',
      position: getRoomSeatTile(
        office,
        office.rooms.MEETING_ROOM.unlocked ? 'MEETING_ROOM' : 'ENGINEERING',
        5
      ),
      targetTile: null,
      path: [],
      facing: 'DOWN',
      state: 'WORKING',
      thoughtIcon: '📣',
      appearance: {
        skinTone: '#e8b896',
        hairColor: '#8c5a32',
        hairStyle: 'SPIKY',
        shirtColor: ROLE_DEFINITIONS.MARKETING_SPECIALIST.outfitColor,
        pantsColor: '#1e3a5f',
        hasGlasses: false,
      },
      hiredDay: 1,
      lastTrainedDay: 0,
      resignationWarning: false,
    },
  ];

  const founderPos = getRoomSeatTile(office, 'CEO_OFFICE', 1);

  const initialState: GameState = {
    version: 1,
    seed,
    config: {
      companyName: params.companyName.trim() || DEFAULT_NEW_GAME_PARAMS.companyName,
      founderName: params.founderName.trim() || DEFAULT_NEW_GAME_PARAMS.founderName,
      businessType: params.businessType,
      difficulty: params.difficulty,
      gameMode: params.gameMode,
    },
    screen: 'PLAYING',
    day: 1,
    month: 1,
    year: 2026,
    totalDays: 1,
    hourOfDay: 9.0,
    speed: 1,
    founder: {
      name: params.founderName.trim() || DEFAULT_NEW_GAME_PARAMS.founderName,
      energy: 100,
      maxEnergy: 100,
      productivity: 100,
      reputation: params.difficulty === 'ANGEL_BACKED' ? 32 : 22,
      leadership: 30,
      businessExp: 0,
      level: 1,
      position: founderPos,
      targetTile: null,
      path: [],
      facing: 'DOWN',
      state: 'IDLE',
      appearance: {
        skinTone: '#f2ccb0',
        hairColor: '#4a3222',
        hairStyle: 'BOB',
        shirtColor: '#f59e0b',
        pantsColor: '#1e293b',
        hasGlasses: false,
      },
      actionCooldownDays: 0,
      monthlySalary:
        params.difficulty === 'BOOTSTRAPPED'
          ? 0
          : params.difficulty === 'ANGEL_BACKED'
            ? 2500
            : 1500,
      personalCash:
        params.difficulty === 'BOOTSTRAPPED'
          ? 1500
          : params.difficulty === 'ANGEL_BACKED'
            ? 4000
            : 2500,
      investorTrust:
        params.difficulty === 'ANGEL_BACKED'
          ? 68
          : params.difficulty === 'BALANCED'
            ? 56
            : 50,
    },
    employees: starterEmployees,
    candidates: generateCandidatePool(seed, 1, 0, 5),
    products: [starterProduct],
    campaigns: [],
    contracts: [
      {
        id: 'ctr_starter_pilot',
        clientName: 'Harbor Retail Group',
        segment: 'SMB',
        productId: starterProduct.id,
        monthlyValue: 1150,
        upfrontBonus: 600,
        durationMonths: 4,
        monthsRemaining: 4,
        requiredQuality: 42,
        legalReviewed: false,
        status: 'PIPELINE',
        expiresDay: 18,
      },
    ],
    competitors: createInitialCompetitors(),
    office,
    finance: {
      cash: startingCash,
      totalDebt: 0,
      creditLimit: 20000,
      monthlyInterestRate: 0.015,
      equityDilutionPct: params.difficulty === 'ANGEL_BACKED' ? 12 : 0,
      valuation: startingCash * 2,
      taxRate: 0.18,
      currentMonthRevenue: 0,
      currentMonthProductRev: 0,
      currentMonthContractRev: 0,
      currentMonthSalaries: 0,
      currentMonthRent: 0,
      currentMonthMaintenance: 0,
      currentMonthMarketing: 0,
      currentMonthDevCosts: 0,
      currentMonthTaxes: 0,
      currentMonthInterest: 0,
      currentMonthCustomersGained: 0,
      currentMonthCustomersChurned: 0,
      cumulativeRevenue: 0,
      cumulativeExpenses: 0,
      cumulativeProfit: 0,
      lastMonthNetProfit: 0,
      consecutiveNegativeCashMonths: 0,
    },
    monthlyHistory: [],
    pendingMonthlyReport: null,
    pendingDailyReport: null,
    activeEvent: null,
    milestones: createInitialMilestones(),
    achievements: createInitialAchievements(),
    hiredRolesHistory: starterEmployees.map((e) => e.role),
    visitors: [
      {
        id: 'vis_1',
        name: 'Elena Vance (Advisor)',
        kind: 'PARTNER',
        position: { x: 4, y: 11 },
        targetTile: { x: 6, y: 12 },
        leaving: false,
        dialogue:
          getLocale() === 'vi-VN'
            ? 'Chào mừng ngày làm việc đầu tiên! Hãy hoàn thiện bản MVP ở Phòng kỹ thuật và ra mắt để bắt đầu có doanh thu.'
            : 'Welcome to Day 1! Finish your first MVP in Engineering and launch to start earning.',
      },
    ],
    notifications: [
      {
        id: 'notif_welcome',
        day: 1,
        message:
          getLocale() === 'vi-VN'
            ? 'Ngày 1: Ba thành viên sáng lập đang phát triển bản MVP đầu tiên cho công ty.'
            : 'Day 1: Your 3 founding team members are building your first product MVP.',
        type: 'INFO',
      },
    ],
    chatterFeed: [
      {
        id: 'chat_init_1',
        employeeId: 'emp_starter_1',
        employeeName: 'Liam Chen',
        roleLabel: getRoleLocalized('SOFTWARE_ENGINEER').short,
        personality: 'PRAGMATIC',
        tone: 'POSITIVE',
        text:
          getLocale() === 'vi-VN'
            ? 'Bản thử nghiệm cốt lõi đã đạt 45%. Cho chúng tôi vài ngày để hoàn thiện và ra mắt MVP!'
            : 'Core prototype is already at 45%. Give us a few days to reach MVP launch!',
        day: 1,
        hour: 9.0,
        shirtColor: ROLE_DEFINITIONS.SOFTWARE_ENGINEER.outfitColor,
      },
      {
        id: 'chat_init_2',
        employeeId: 'emp_starter_2',
        employeeName: 'Maya Patel',
        roleLabel: getRoleLocalized('DESIGNER').short,
        personality: 'CREATIVE',
        tone: 'NEUTRAL',
        text:
          getLocale() === 'vi-VN'
            ? 'Đang phác thảo màn hình làm quen rõ ràng hơn trước khi mở đăng ký cho người dùng.'
            : 'Sketching cleaner onboarding screens before we open beta signups.',
        day: 1,
        hour: 9.0,
        shirtColor: ROLE_DEFINITIONS.DESIGNER.outfitColor,
      },
    ],
    tutorial: createInitialTutorialState(),
    objectives: createInitialObjectives(),
    story: createInitialStoryState(false),
    activeCelebration: null,
    celebrationQueue: [],
    seenCelebrationIds: [],
    gameOverReason: null,
    victoryAchieved: false,
    sandboxContinued: false,
  };
  ensureOpenWorldState(initialState);
  ensureWeatherState(initialState);
  return initialState;
}
