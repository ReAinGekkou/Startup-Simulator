export type ScreenMode = 'TITLE_MENU' | 'PLAYING' | 'GAME_OVER' | 'VICTORY';

export type GameMode = 'CAMPAIGN' | 'SANDBOX';
export type DifficultyLevel = 'BOOTSTRAPPED' | 'BALANCED' | 'ANGEL_BACKED';
export type BusinessType = 'SAAS' | 'MOBILE_APP' | 'GAME_STUDIO' | 'AI_TOOLS' | 'WEB_PLATFORM';
export type SimulationSpeed = 0 | 1 | 2 | 3;

export type RoomId =
  | 'CEO_OFFICE'
  | 'HR_DEPT'
  | 'FINANCE_DEPT'
  | 'ENGINEERING'
  | 'LEGAL_DEPT'
  | 'MEETING_ROOM'
  | 'BREAK_ROOM'
  | 'LOBBY';

export type EmployeeRole =
  | 'SOFTWARE_ENGINEER'
  | 'DESIGNER'
  | 'MARKETING_SPECIALIST'
  | 'SALES_REP'
  | 'ACCOUNTANT'
  | 'HR_MANAGER'
  | 'PRODUCT_MANAGER'
  | 'OPERATIONS_MANAGER';

export type EmployeePersonality =
  | 'PRAGMATIC'
  | 'PERFECTIONIST'
  | 'WORKAHOLIC'
  | 'CREATIVE'
  | 'SOCIAL'
  | 'ANALYTICAL';

export type CharacterState =
  | 'IDLE'
  | 'WALKING'
  | 'WORKING'
  | 'RESTING'
  | 'MEETING'
  | 'CHATTING'
  | 'OFF_DUTY';

export type EmployeeTask =
  | 'BUILD_PRODUCT'
  | 'FIX_BUGS'
  | 'MARKET_GROWTH'
  | 'CLOSE_SALES'
  | 'MANAGE_FINANCE'
  | 'RECRUIT_TALENT'
  | 'PLAN_ROADMAP'
  | 'OPERATIONS_SUPPORT'
  | 'REST_BREAK';

export type ProductCategory = 'SAAS' | 'MOBILE_APP' | 'GAME' | 'AI_TOOL' | 'WEB_PLATFORM';
export type RevenueModel = 'SUBSCRIPTION' | 'ONE_TIME' | 'FREEMIUM' | 'ENTERPRISE_LICENSE';
export type ProductStage = 'CONCEPT' | 'IN_DEV' | 'MVP_LIVE' | 'MATURE' | 'SUNSET';

export type MarketingChannel =
  | 'SOCIAL_MEDIA'
  | 'PAID_ADS'
  | 'SEO'
  | 'CONTENT_MARKETING'
  | 'DIRECT_SALES'
  | 'PARTNERSHIPS';

export type CustomerSegment = 'CONSUMERS' | 'SMB' | 'ENTERPRISE';

export interface GridPoint {
  x: number;
  y: number;
}

export interface CharacterAppearance {
  skinTone: string;
  hairColor: string;
  hairStyle: 'SHORT' | 'BOB' | 'SPIKY' | 'PONYTAIL' | 'BALD';
  shirtColor: string;
  pantsColor: string;
  hasGlasses: boolean;
}

export type CharacterMood = 'HAPPY' | 'NEUTRAL' | 'STRESSED' | 'SURPRISED' | 'THOUGHTFUL' | 'DETERMINED';


export interface Founder {
  name: string;
  energy: number; // 0-100
  maxEnergy: number;
  productivity: number; // 0-100
  reputation: number; // 0-100
  leadership: number; // 1-100
  businessExp: number; // XP
  level: number;
  position: GridPoint; // continuous grid coords
  targetTile: GridPoint | null;
  path: GridPoint[];
  inputVector?: GridPoint;
  facing: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
  state: CharacterState;
  appearance: CharacterAppearance;
  actionCooldownDays: number;
  monthlySalary: number;
  personalCash: number;
  investorTrust: number; // 0-100
}

export type EmployeeTraitId =
  | 'EFFICIENT_CODER'
  | 'SYSTEMS_VIRTUOSO'
  | 'PIXEL_PERFECTIONIST'
  | 'VIRAL_STRATEGIST'
  | 'PERSUASIVE_NEGOTIATOR'
  | 'FISCAL_ARCHITECT'
  | 'CULTURE_CATALYST';

export interface EmployeeTraitDefinition {
  id: EmployeeTraitId;
  name: string;
  skillKey: keyof EmployeeSkills;
  requiredSkill: number;
  summary: string;
}

export interface EmployeeSkills {
  engineering: number; // 1-100
  design: number;
  marketing: number;
  sales: number;
  finance: number;
  operations: number;
}

export interface Employee {
  id: string;
  name: string;
  role: EmployeeRole;
  level: 1 | 2 | 3 | 4; // Junior, Mid, Senior, Lead
  title: string;
  monthlySalary: number;
  skills: EmployeeSkills;
  productivity: number; // derived/dynamic 0-150
  energy: number; // 0-100
  morale: number; // 0-100
  stress: number; // 0-100
  personality: EmployeePersonality;
  experience: number;
  traits: EmployeeTraitId[];
  assignedTask: EmployeeTask;
  assignedProductId: string | null;
  homeRoom: RoomId;
  deskId: string | null;
  position: GridPoint;
  targetTile: GridPoint | null;
  path: GridPoint[];
  facing: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
  state: CharacterState;
  thoughtIcon: string | null;
  appearance: CharacterAppearance;
  hiredDay: number;
  lastTrainedDay: number;
  resignationWarning: boolean;
}

export interface RecruitmentCandidate {
  id: string;
  name: string;
  role: EmployeeRole;
  level: 1 | 2 | 3;
  expectedSalary: number;
  hiringFee: number;
  skills: EmployeeSkills;
  personality: EmployeePersonality;
  appearance: CharacterAppearance;
  bio: string;
  expiresDay: number;
}

export interface ProductFeature {
  id: string;
  name: string;
  description: string;
  effortRequired: number;
  effortProgress: number;
  cost: number;
  qualityBoost: number;
  demandBoost: number;
  completed: boolean;
  requiredSkill: keyof EmployeeSkills;
}

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  revenueModel: RevenueModel;
  stage: ProductStage;
  developmentProgress: number; // 0-100 for initial MVP
  quality: number; // 0-100
  bugs: number;
  features: ProductFeature[];
  developmentCostSpent: number;
  monthlyMaintenanceCost: number;
  marketDemand: number; // 0-100
  customerSatisfaction: number; // 0-100
  activeUsers: number;
  payingCustomers: number;
  pricePerCustomer: number;
  monthlyRevenue: number;
  cumulativeRevenue: number;
  launchDay: number | null;
  version: number;
}

export interface MarketingCampaign {
  id: string;
  channel: MarketingChannel;
  productId: string;
  targetSegment: CustomerSegment;
  dailyBudget: number;
  active: boolean;
  totalSpent: number;
  customersAcquired: number;
  impressions: number;
  effectivenessMultiplier: number;
}

export interface ClientContract {
  id: string;
  clientName: string;
  segment: CustomerSegment;
  productId: string | null;
  monthlyValue: number;
  upfrontBonus: number;
  durationMonths: number;
  monthsRemaining: number;
  requiredQuality: number;
  legalReviewed: boolean;
  status: 'PIPELINE' | 'ACTIVE' | 'COMPLETED' | 'EXPIRED';
  expiresDay: number;
}

export interface Competitor {
  id: string;
  name: string;
  category: ProductCategory;
  marketShare: number; // 0-100
  productQuality: number; // 0-100
  aggressiveness: number;
  lastLaunchDay: number;
}

export interface FurnitureItem {
  id: string;
  templateId: string;
  name: string;
  roomId: RoomId;
  tile: GridPoint;
  width: number;
  height: number;
  tier: number;
  interactiveAction: string;
  comfortBonus: number;
  productivityBonus: number;
}

export interface OfficeRoom {
  id: RoomId;
  name: string;
  description: string;
  bounds: { x: number; y: number; w: number; h: number };
  floorStyle: 'WOOD' | 'CARPET_BLUE' | 'CARPET_WARM' | 'TILE' | 'CONCRETE';
  level: number;
  unlocked: boolean;
  unlockCost: number;
  upgradeCost: number;
  unlockCondition?: string;
}

export interface OfficePerkDefinition {
  id: string;
  name: string;
  description: string;
  cost: number;
  minOfficeLevel: 1 | 2 | 3 | 4;
  moraleBonusPerDay: number;
  energyRecoveryPerDay: number;
  stressReductionPerDay: number;
  comfortBonus: number;
}

export interface OfficeState {
  level: 1 | 2 | 3 | 4;
  name: string;
  monthlyRent: number;
  maxEmployees: number;
  comfortScore: number;
  techTier: number;
  rooms: Record<RoomId, OfficeRoom>;
  furniture: FurnitureItem[];
  purchasedPerks: string[];
}

export interface FinancialLedger {
  cash: number;
  totalDebt: number;
  creditLimit: number;
  monthlyInterestRate: number;
  equityDilutionPct: number;
  valuation: number;
  taxRate: number;
  currentMonthRevenue: number;
  currentMonthProductRev: number;
  currentMonthContractRev: number;
  currentMonthSalaries: number;
  currentMonthRent: number;
  currentMonthMaintenance: number;
  currentMonthMarketing: number;
  currentMonthDevCosts: number;
  currentMonthTaxes: number;
  currentMonthInterest: number;
  currentMonthCustomersGained: number;
  currentMonthCustomersChurned: number;
  cumulativeRevenue: number;
  cumulativeExpenses: number;
  cumulativeProfit: number;
  lastMonthNetProfit: number;
  consecutiveNegativeCashMonths: number;
}

export interface MonthlyReport {
  month: number;
  year: number;
  revenue: number;
  productRevenue: number;
  contractRevenue: number;
  expenses: number;
  salaries: number;
  founderSalary: number;
  rent: number;
  maintenance: number;
  marketing: number;
  devAndMisc: number;
  taxes: number;
  interest: number;
  netProfit: number;
  endingCash: number;
  customersGained: number;
  customersChurned: number;
  activeCustomers: number;
  headcount: number;
  avgMorale: number;
  summaryNote: string;
}

export interface EventChoice {
  id: string;
  label: string;
  description: string;
  cost?: number;
  effectsSummary: string;
}

export interface ActiveEvent {
  id: string;
  templateId: string;
  title: string;
  description: string;
  category: 'HR' | 'PRODUCT' | 'MARKET' | 'FINANCE' | 'OPERATIONS' | 'INVESTOR';
  severity: 'INFO' | 'OPPORTUNITY' | 'WARNING' | 'CRITICAL';
  choices: EventChoice[];
  triggeredDay: number;
  relatedEmployeeId?: string;
  relatedProductId?: string;
  investorAmount?: number;
  investorEquityPct?: number;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  unlockedDay: number | null;
  rewardCash: number;
  rewardReputation: number;
}

export type AchievementCategory = 'FINANCE' | 'TEAM' | 'PRODUCT' | 'GROWTH';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  unlocked: boolean;
  unlockedDay: number | null;
}

export interface VisitorNPC {
  id: string;
  name: string;
  kind: 'INVESTOR' | 'CLIENT' | 'PARTNER' | 'APPLICANT';
  position: GridPoint;
  targetTile: GridPoint;
  leaving: boolean;
  dialogue: string;
}

export interface NotificationLog {
  id: string;
  day: number;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
}

export interface ChatterMessage {
  id: string;
  employeeId: string;
  employeeName: string;
  roleLabel: string;
  personality: EmployeePersonality;
  tone: 'POSITIVE' | 'NEUTRAL' | 'STRESSED' | 'EVENT';
  text: string;
  day: number;
  hour: number;
  shirtColor: string;
}

export type TutorialStepId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface TutorialState {
  active: boolean;
  currentStep: TutorialStepId;
  completed: boolean;
  skipped: boolean;
  reviewedEmployee: boolean;
  exploredCeoOffice: boolean;
  exploredEngineering: boolean;
  createdProduct: boolean;
  assignedWork: boolean;
  launchedMvp: boolean;
  foundFirstCustomer: boolean;
  reviewedFinances: boolean;
  endedFirstDay: boolean;
  instructionsOpen: boolean;
  manualHoldStep?: TutorialStepId | null;
  restartAnchorDay?: number;
}

export type StartupObjectiveId =
  | 'obj_review_employees'
  | 'obj_create_product'
  | 'obj_assign_tasks'
  | 'obj_launch_mvp'
  | 'obj_acquire_customer'
  | 'obj_first_revenue';

export interface StartupObjective {
  id: StartupObjectiveId;
  label: string;
  completed: boolean;
  completedDay: number | null;
}

export interface DailySummaryReport {
  day: number;
  month: number;
  year: number;
  revenueEarned: number;
  expensesSpent: number;
  cashBalance: number;
  customersTotal: number;
  avgMorale: number;
  highlights: string[];
}

export type StoryChapterId = 1 | 2 | 3 | 4 | 5 | 6;

export type EndingId =
  | 'DREAM_COMPANY'
  | 'SMALL_BUT_HAPPY'
  | 'ACQUISITION'
  | 'BURNOUT'
  | 'LAST_DAY'
  | 'LEGACY';

export type CinematicSceneId =
  | 'INTRO'
  | 'CHAPTER_1_MILESTONE'
  | 'CHAPTER_2_MILESTONE'
  | 'CHAPTER_3_MILESTONE'
  | 'CHAPTER_4_MILESTONE'
  | 'CHAPTER_5_MILESTONE'
  | 'CHAPTER_6_MILESTONE'
  | 'ENDING_DREAM_COMPANY'
  | 'ENDING_SMALL_BUT_HAPPY'
  | 'ENDING_ACQUISITION'
  | 'ENDING_BURNOUT'
  | 'ENDING_LAST_DAY'
  | 'ENDING_LEGACY';

export interface StoryChoiceRecord {
  eventId: string;
  chapter: StoryChapterId;
  choiceId: string;
  day: number;
}

export interface StoryEventInstance {
  id: string;
  chapter: StoryChapterId;
  triggeredDay: number;
  relatedEmployeeId?: string;
  relatedProductId?: string;
  offerValuation?: number;
}

export interface StoryDecisions {
  companyIdentity?: 'QUALITY_FIRST' | 'FAST_GROWTH' | 'PEOPLE_FIRST';
  productDirection?: 'DEEP_TECH' | 'USER_FRIENDLY';
  customerResponse?: 'LISTEN_FIX' | 'SHIP_FAST' | 'MARKETING_PUSH';
  workloadChoice?: 'REDUCE_LOAD' | 'HIRE_HELP' | 'PUSH_THROUGH';
  expansionChoice?: 'EXPAND_NOW' | 'SAVE_RUNWAY' | 'INVEST_TEAM';
  investmentChoice?: 'ACCEPT' | 'NEGOTIATE' | 'DECLINE';
  finalVision?: 'INNOVATE_CULTURE' | 'SCALE_MARKET';
  acquisitionOfferReceived: boolean;
  acquisitionAccepted: boolean | null;
  cultureScore: number; // 0-100
  resignationsCount: number;
}

export interface EvaluatedEndingSummary {
  endingId: EndingId;
  endingDay: number;
  endingMonth: number;
  endingYear: number;
  chapterReached: StoryChapterId;
  stats: {
    valuation: number;
    cash: number;
    cumulativeRevenue: number;
    employeesCount: number;
    avgMorale: number;
    reputation: number;
    cultureScore: number;
    resignationsCount: number;
    daysOperated: number;
    liveProductsCount: number;
  };
  majorChoices: StoryChoiceRecord[];
}

export interface StoryState {
  introCompleted: boolean;
  introSkipped: boolean;
  currentChapter: StoryChapterId;
  unlockedChapters: StoryChapterId[];
  completedChapters: StoryChapterId[];
  seenMilestoneScenes: StoryChapterId[];
  pendingCinematicQueue: CinematicSceneId[];
  activeCinematic: CinematicSceneId | null;
  triggeredStoryEvents: string[];
  completedStoryEvents: string[];
  activeStoryEvent: StoryEventInstance | null;
  decisions: StoryDecisions;
  choiceHistory: StoryChoiceRecord[];
  evaluatedEnding: EvaluatedEndingSummary | null;
}

export interface UnlockedEndingRecord {
  endingId: EndingId;
  unlockedAt: number;
  companyName: string;
  founderName: string;
  summary: EvaluatedEndingSummary;
}

export type MilestoneCelebrationKind =
  | 'PRODUCT_MVP_LAUNCH'
  | 'PRODUCT_MATURE_RELEASE'
  | 'HQ_EXPANSION'
  | 'DEPARTMENT_EXPANSION';

export interface MilestoneCelebration {
  id: string;
  kind: MilestoneCelebrationKind;
  targetRoomId: RoomId;
  subjectName: string;
  detailValue?: string | number;
  triggeredDay: number;
  durationSec: number;
  remainingSec: number;
}

export interface GameConfig {
  companyName: string;
  founderName: string;
  businessType: BusinessType;
  difficulty: DifficultyLevel;
  gameMode: GameMode;
}

export type WorldLocationId =
  | 'COMPANY_HQ'
  | 'MAIN_STREET'
  | 'COFFEE_SHOP'
  | 'COWORKING_SPACE'
  | 'INVESTOR_CENTER'
  | 'EVENT_HALL'
  | 'BUSINESS_PROPERTIES';

export type WorldNpcKind = 'CUSTOMER' | 'CANDIDATE' | 'PARTNER' | 'INVESTOR' | 'HOST';

export interface WorldNPC {
  id: string;
  name: string;
  roleTitle: string;
  kind: WorldNpcKind;
  locationId: WorldLocationId;
  position: GridPoint;
  homeTile: GridPoint;
  appearance: CharacterAppearance;
  facing: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
  moodIcon: string;
  lastInteractedDay: number;
  linkedCandidateId?: string;
}

export interface BusinessPropertyState {
  id: string;
  name: string;
  lotTile: GridPoint;
  cost: number;
  monthlyRevenue: number;
  reputationBonus: number;
  teamCapacityBonus: number;
  owned: boolean;
  purchasedDay: number | null;
}

export interface OpenWorldState {
  npcs: WorldNPC[];
  properties: BusinessPropertyState[];
  lastCityRefreshDay: number;
  coffeeVisitsToday: number;
  investorPitchesToday: number;
  eventsAttendedTotal: number;
}

export type GlobalWeatherState = 'SUNNY' | 'RAINY' | 'OVERCAST';

export interface WeatherCycleState {
  current: GlobalWeatherState;
  previous: GlobalWeatherState;
  /** Smooth 0..1 visual cross-fade from previous -> current */
  transitionProgress: number;
  /** When true, weather automatically cycles SUNNY -> OVERCAST -> RAINY -> SUNNY as simulated hours pass */
  autoCycle: boolean;
  /** Elapsed simulated hours spent in the current state */
  hoursInState: number;
  /** Total weather state transitions completed */
  cycleCount: number;
}

export interface GameState {
  version: number;
  seed: number;
  config: GameConfig;
  screen: ScreenMode;
  day: number; // 1-30 per month
  month: number; // 1-12
  year: number;
  totalDays: number;
  hourOfDay: number; // 8.0 to 19.0
  speed: SimulationSpeed;
  founder: Founder;
  employees: Employee[];
  candidates: RecruitmentCandidate[];
  products: Product[];
  campaigns: MarketingCampaign[];
  contracts: ClientContract[];
  competitors: Competitor[];
  office: OfficeState;
  finance: FinancialLedger;
  monthlyHistory: MonthlyReport[];
  pendingMonthlyReport: MonthlyReport | null;
  pendingDailyReport: DailySummaryReport | null;
  activeEvent: ActiveEvent | null;
  milestones: Milestone[];
  achievements: Achievement[];
  hiredRolesHistory: EmployeeRole[];
  visitors: VisitorNPC[];
  notifications: NotificationLog[];
  chatterFeed: ChatterMessage[];
  tutorial: TutorialState;
  objectives: StartupObjective[];
  story: StoryState;
  activeCelebration: MilestoneCelebration | null;
  celebrationQueue: MilestoneCelebration[];
  seenCelebrationIds: string[];
  gameOverReason: string | null;
  victoryAchieved: boolean;
  sandboxContinued: boolean;
  world?: OpenWorldState;
  weather?: WeatherCycleState;
}

export interface NewGameParams {
  companyName: string;
  founderName: string;
  businessType: BusinessType;
  difficulty: DifficultyLevel;
  gameMode: GameMode;
}

export type GameCommand =
  | { type: 'SET_SPEED'; speed: SimulationSpeed }
  | { type: 'END_DAY' }
  | { type: 'MOVE_FOUNDER'; target: GridPoint }
  | { type: 'STEP_FOUNDER'; dx: number; dy: number }
  | { type: 'SET_FOUNDER_INPUT'; dir: GridPoint }
  | { type: 'FOUNDER_INTERACT_EMPLOYEE'; employeeId: string; mode: 'MOTIVATE' | 'COACH' | 'CHECK_IN' }
  | { type: 'FOUNDER_REST' }
  | { type: 'FOUNDER_STRATEGY_SESSION' }
  | { type: 'HIRE_CANDIDATE'; candidateId: string }
  | { type: 'REFRESH_CANDIDATES' }
  | { type: 'FIRE_EMPLOYEE'; employeeId: string }
  | { type: 'ASSIGN_EMPLOYEE_TASK'; employeeId: string; task: EmployeeTask; productId?: string | null }
  | { type: 'TRAIN_EMPLOYEE'; employeeId: string }
  | { type: 'PROMOTE_EMPLOYEE'; employeeId: string }
  | { type: 'GIVE_RAISE'; employeeId: string; amount: number }
  | { type: 'CREATE_PRODUCT'; name: string; category: ProductCategory; revenueModel: RevenueModel }
  | { type: 'RUN_PROTOTYPE_SPRINT'; productId: string }
  | { type: 'ADD_PRODUCT_FEATURE'; productId: string; templateIndex: number }
  | { type: 'LAUNCH_PRODUCT_MVP'; productId: string }
  | { type: 'RELEASE_PRODUCT_UPDATE'; productId: string }
  | { type: 'FIX_PRODUCT_BUGS'; productId: string }
  | { type: 'SET_PRODUCT_PRICE'; productId: string; price: number }
  | { type: 'TOGGLE_CAMPAIGN'; channel: MarketingChannel; productId: string; segment: CustomerSegment; dailyBudget: number }
  | { type: 'STOP_CAMPAIGN'; campaignId: string }
  | { type: 'REVIEW_CONTRACT_LEGAL'; contractId: string }
  | { type: 'PITCH_CONTRACT'; contractId: string }
  | { type: 'BUY_FURNITURE'; templateId: string; roomId: RoomId; tile: GridPoint }
  | { type: 'MOVE_FURNITURE'; furnitureId: string; tile: GridPoint; roomId: RoomId }
  | { type: 'UPGRADE_WORKSTATIONS' }
  | { type: 'BUY_OFFICE_PERK'; perkId: string }
  | { type: 'EXPAND_OFFICE' }
  | { type: 'UNLOCK_ROOM'; roomId: RoomId }
  | { type: 'TAKE_LOAN'; amount: number }
  | { type: 'REPAY_LOAN'; amount: number }
  | { type: 'SET_FOUNDER_SALARY'; amount: number }
  | { type: 'INJECT_PERSONAL_CASH'; amount: number }
  | { type: 'RESOLVE_EVENT'; choiceId: string }
  | { type: 'DISMISS_MONTHLY_REPORT' }
  | { type: 'DISMISS_DAILY_REPORT' }
  | { type: 'REPORT_TUTORIAL_ACTION'; action: 'REVIEW_EMPLOYEE' | 'EXPLORE_ROOM' | 'REVIEW_FINANCE'; roomId?: RoomId }
  | { type: 'SKIP_TUTORIAL' }
  | { type: 'RESUME_TUTORIAL' }
  | { type: 'TUTORIAL_BACK' }
  | { type: 'TUTORIAL_NEXT' }
  | { type: 'TOGGLE_TUTORIAL_INSTRUCTIONS'; open?: boolean }
  | { type: 'COMPLETE_CINEMATIC'; cinematicId: CinematicSceneId; skipped?: boolean }
  | { type: 'RESOLVE_STORY_EVENT'; choiceId: string }
  | { type: 'TRIGGER_ENDING_EVALUATION' }
  | { type: 'CONTINUE_SANDBOX' }
  | { type: 'DISMISS_CELEBRATION' }
  | { type: 'WORLD_COFFEE_BREAK' }
  | { type: 'WORLD_INTERACT_NPC'; npcId: string }
  | { type: 'WORLD_PITCH_INVESTOR' }
  | { type: 'WORLD_HOST_EVENT' }
  | { type: 'WORLD_BUY_PROPERTY'; propertyId: string }
  | { type: 'CYCLE_WEATHER' }
  | { type: 'SET_WEATHER'; weather: GlobalWeatherState | 'AUTO' };

export interface SaveSlotMeta {
  slotId: string;
  label: string;
  companyName: string;
  founderName: string;
  day: number;
  month: number;
  year: number;
  cash: number;
  employeesCount: number;
  savedAt: number;
  version: number;
}
