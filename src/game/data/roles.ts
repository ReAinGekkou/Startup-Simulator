import {
  CharacterAppearance,
  EmployeePersonality,
  EmployeeRole,
  EmployeeSkills,
  EmployeeTask,
  EmployeeTraitDefinition,
  RoomId,
} from '@/src/types/game';

export interface RoleDefinition {
  role: EmployeeRole;
  label: string;
  shortLabel: string;
  baseSalary: number;
  homeRoom: RoomId;
  defaultTask: EmployeeTask;
  primarySkill: keyof EmployeeSkills;
  description: string;
  outfitColor: string;
}

export const ROLE_DEFINITIONS: Record<EmployeeRole, RoleDefinition> = {
  SOFTWARE_ENGINEER: {
    role: 'SOFTWARE_ENGINEER',
    label: 'Software Engineer',
    shortLabel: 'Engineer',
    baseSalary: 3200,
    homeRoom: 'ENGINEERING',
    defaultTask: 'BUILD_PRODUCT',
    primarySkill: 'engineering',
    description: 'Builds product features, ships updates, and fixes production bugs.',
    outfitColor: '#3b82f6',
  },
  DESIGNER: {
    role: 'DESIGNER',
    label: 'Product Designer',
    shortLabel: 'Designer',
    baseSalary: 2700,
    homeRoom: 'ENGINEERING',
    defaultTask: 'BUILD_PRODUCT',
    primarySkill: 'design',
    description: 'Raises product quality, user satisfaction, and UX conversion.',
    outfitColor: '#ec4899',
  },
  MARKETING_SPECIALIST: {
    role: 'MARKETING_SPECIALIST',
    label: 'Marketing Specialist',
    shortLabel: 'Marketing',
    baseSalary: 2500,
    homeRoom: 'MEETING_ROOM',
    defaultTask: 'MARKET_GROWTH',
    primarySkill: 'marketing',
    description: 'Amplifies campaign ROI, organic growth, and brand demand.',
    outfitColor: '#f59e0b',
  },
  SALES_REP: {
    role: 'SALES_REP',
    label: 'Sales Representative',
    shortLabel: 'Sales',
    baseSalary: 2600,
    homeRoom: 'LOBBY',
    defaultTask: 'CLOSE_SALES',
    primarySkill: 'sales',
    description: 'Closes B2B client contracts and expands enterprise pipeline.',
    outfitColor: '#10b981',
  },
  ACCOUNTANT: {
    role: 'ACCOUNTANT',
    label: 'Accountant',
    shortLabel: 'Finance',
    baseSalary: 2800,
    homeRoom: 'FINANCE_DEPT',
    defaultTask: 'MANAGE_FINANCE',
    primarySkill: 'finance',
    description: 'Optimizes tax efficiency, lowers burn, and protects credit terms.',
    outfitColor: '#6366f1',
  },
  HR_MANAGER: {
    role: 'HR_MANAGER',
    label: 'HR Manager',
    shortLabel: 'HR',
    baseSalary: 2600,
    homeRoom: 'HR_DEPT',
    defaultTask: 'RECRUIT_TALENT',
    primarySkill: 'operations',
    description: 'Boosts team morale, lowers stress, and attracts stronger talent.',
    outfitColor: '#14b8a6',
  },
  PRODUCT_MANAGER: {
    role: 'PRODUCT_MANAGER',
    label: 'Product Manager',
    shortLabel: 'PM',
    baseSalary: 3100,
    homeRoom: 'MEETING_ROOM',
    defaultTask: 'PLAN_ROADMAP',
    primarySkill: 'design',
    description: 'Aligns roadmap velocity and multiplies team engineering output.',
    outfitColor: '#8b5cf6',
  },
  OPERATIONS_MANAGER: {
    role: 'OPERATIONS_MANAGER',
    label: 'Operations Manager',
    shortLabel: 'Ops',
    baseSalary: 2900,
    homeRoom: 'LEGAL_DEPT',
    defaultTask: 'OPERATIONS_SUPPORT',
    primarySkill: 'operations',
    description: 'Keeps servers reliable, speeds legal compliance, and cuts overhead.',
    outfitColor: '#64748b',
  },
};

export const PERSONALITY_MODIFIERS: Record<
  EmployeePersonality,
  { label: string; productivityMult: number; stressRate: number; moraleDecay: number; summary: string }
> = {
  PRAGMATIC: {
    label: 'Pragmatic',
    productivityMult: 1.05,
    stressRate: 0.85,
    moraleDecay: 0.85,
    summary: 'Steady output and resilient under deadlines.',
  },
  PERFECTIONIST: {
    label: 'Perfectionist',
    productivityMult: 1.12,
    stressRate: 1.25,
    moraleDecay: 1.0,
    summary: 'Higher quality work, but accumulates stress faster.',
  },
  WORKAHOLIC: {
    label: 'Workaholic',
    productivityMult: 1.18,
    stressRate: 1.35,
    moraleDecay: 1.15,
    summary: 'High output, needs Break Room recovery or burns out.',
  },
  CREATIVE: {
    label: 'Creative',
    productivityMult: 1.08,
    stressRate: 0.95,
    moraleDecay: 1.1,
    summary: 'Excels in design and product innovation.',
  },
  SOCIAL: {
    label: 'Social',
    productivityMult: 0.98,
    stressRate: 0.8,
    moraleDecay: 0.75,
    summary: 'Lifts office morale and thrives in collaborative rooms.',
  },
  ANALYTICAL: {
    label: 'Analytical',
    productivityMult: 1.1,
    stressRate: 0.95,
    moraleDecay: 0.95,
    summary: 'Consistent problem-solver with low bug rate.',
  },
};

export const EMPLOYEE_TRAITS: EmployeeTraitDefinition[] = [
  {
    id: 'EFFICIENT_CODER',
    name: 'Efficient Coder',
    skillKey: 'engineering',
    requiredSkill: 70,
    summary: '+15% build velocity and +1 extra bug fix power per sprint.',
  },
  {
    id: 'SYSTEMS_VIRTUOSO',
    name: 'Systems Virtuoso',
    skillKey: 'engineering',
    requiredSkill: 88,
    summary: '+15% productivity and halves build-time bug regressions.',
  },
  {
    id: 'PIXEL_PERFECTIONIST',
    name: 'UX Craftsperson',
    skillKey: 'design',
    requiredSkill: 70,
    summary: '+12% product design velocity and +0.25 daily product quality.',
  },
  {
    id: 'VIRAL_STRATEGIST',
    name: 'Viral Strategist',
    skillKey: 'marketing',
    requiredSkill: 70,
    summary: '+25% marketing campaign and organic acquisition power.',
  },
  {
    id: 'PERSUASIVE_NEGOTIATOR',
    name: 'Persuasive Negotiator',
    skillKey: 'sales',
    requiredSkill: 70,
    summary: '+25% B2B contract upfront bonuses and faster sales pipeline.',
  },
  {
    id: 'FISCAL_ARCHITECT',
    name: 'Fiscal Architect',
    skillKey: 'finance',
    requiredSkill: 70,
    summary: '+10% productivity and extra 2% monthly tax optimization.',
  },
  {
    id: 'CULTURE_CATALYST',
    name: 'Culture Catalyst',
    skillKey: 'operations',
    requiredSkill: 70,
    summary: 'Eases daily team stress (+1.5) and cuts maintenance & legal overhead.',
  },
];

export const FIRST_NAMES = [
  'Alex', 'Maya', 'Liam', 'Sofia', 'Noah', 'Chloe', 'Ethan', 'Hannah',
  'Lucas', 'Zoe', 'Owen', 'Priya', 'Kai', 'Elena', 'Marcus', 'Nora',
  'Devon', 'Tessa', 'Julian', 'Sora', 'Minh', 'Claire', 'Rohan', 'Iris',
];

export const LAST_NAMES = [
  'Chen', 'Patel', 'Rivera', 'Kim', 'Brooks', 'Nguyen', 'Vance', 'Sato',
  'Morales', 'Kowalski', 'Bennett', 'Lindqvist', 'okafor', 'Mercer', 'Tanaka', 'Hayes',
];

export const SKIN_TONES = ['#f6d5b8', '#e8b896', '#c68b63', '#8d5524', '#f2ccb0'];
export const HAIR_COLORS = ['#1e1b18', '#4a3222', '#8c5a32', '#d4a34c', '#7c2d12', '#334155'];
export const HAIR_STYLES: CharacterAppearance['hairStyle'][] = ['SHORT', 'BOB', 'SPIKY', 'PONYTAIL', 'BALD'];
export const PANTS_COLORS = ['#1e293b', '#334155', '#1e3a5f', '#3f3f46'];

export const TASK_LABELS: Record<EmployeeTask, string> = {
  BUILD_PRODUCT: 'Build Product',
  FIX_BUGS: 'Fix Bugs & QA',
  MARKET_GROWTH: 'Run Marketing',
  CLOSE_SALES: 'Close B2B Sales',
  MANAGE_FINANCE: 'Manage Finances',
  RECRUIT_TALENT: 'Recruit & Morale',
  PLAN_ROADMAP: 'Product Strategy',
  OPERATIONS_SUPPORT: 'Legal & Ops',
  REST_BREAK: 'Coffee Break',
};
