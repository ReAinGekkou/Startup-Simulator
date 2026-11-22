import {
  BusinessType,
  Competitor,
  EmployeeSkills,
  MarketingChannel,
  ProductCategory,
  RevenueModel,
} from '@/src/types/game';

export interface ProductCategorySpec {
  category: ProductCategory;
  label: string;
  defaultModel: RevenueModel;
  defaultPrice: number;
  baseDevCost: number;
  baseMaintenance: number;
  baseDemand: number;
  description: string;
}

export const PRODUCT_CATEGORIES: Record<ProductCategory, ProductCategorySpec> = {
  SAAS: {
    category: 'SAAS',
    label: 'SaaS Application',
    defaultModel: 'SUBSCRIPTION',
    defaultPrice: 29,
    baseDevCost: 2200,
    baseMaintenance: 450,
    baseDemand: 62,
    description: 'Steady monthly recurring revenue with enterprise expansion upside.',
  },
  MOBILE_APP: {
    category: 'MOBILE_APP',
    label: 'Mobile App',
    defaultModel: 'FREEMIUM',
    defaultPrice: 12,
    baseDevCost: 1800,
    baseMaintenance: 380,
    baseDemand: 70,
    description: 'Broad consumer reach with fast organic viral adoption.',
  },
  GAME: {
    category: 'GAME',
    label: 'Indie Game',
    defaultModel: 'ONE_TIME',
    defaultPrice: 24,
    baseDevCost: 2600,
    baseMaintenance: 320,
    baseDemand: 65,
    description: 'High launch spikes driven by quality, polish, and streamers.',
  },
  AI_TOOL: {
    category: 'AI_TOOL',
    label: 'AI Tool',
    defaultModel: 'SUBSCRIPTION',
    defaultPrice: 39,
    baseDevCost: 3000,
    baseMaintenance: 680,
    baseDemand: 76,
    description: 'High-demand automation software with higher compute maintenance.',
  },
  WEB_PLATFORM: {
    category: 'WEB_PLATFORM',
    label: 'Web Platform',
    defaultModel: 'ENTERPRISE_LICENSE',
    defaultPrice: 85,
    baseDevCost: 2500,
    baseMaintenance: 520,
    baseDemand: 58,
    description: 'High-ticket B2B platform suited for long-term contracts.',
  },
};

export interface FeatureTemplate {
  name: string;
  description: string;
  effortRequired: number;
  cost: number;
  qualityBoost: number;
  demandBoost: number;
  requiredSkill: keyof EmployeeSkills;
}

export const FEATURE_TEMPLATES: FeatureTemplate[] = [
  {
    name: 'Core Workflow Engine',
    description: 'Streamlines primary user tasks with crisp responsiveness.',
    effortRequired: 110,
    cost: 800,
    qualityBoost: 10,
    demandBoost: 8,
    requiredSkill: 'engineering',
  },
  {
    name: 'Polished Onboarding UX',
    description: 'Reduces churn by helping new signups succeed in 2 minutes.',
    effortRequired: 85,
    cost: 650,
    qualityBoost: 9,
    demandBoost: 10,
    requiredSkill: 'design',
  },
  {
    name: 'Team Collaboration & Roles',
    description: 'Unlocks multi-seat SMB and Enterprise team adoption.',
    effortRequired: 140,
    cost: 1200,
    qualityBoost: 11,
    demandBoost: 14,
    requiredSkill: 'engineering',
  },
  {
    name: 'Analytics & Reporting Suite',
    description: 'Gives customers clear ROI dashboards and exportable metrics.',
    effortRequired: 120,
    cost: 950,
    qualityBoost: 8,
    demandBoost: 11,
    requiredSkill: 'engineering',
  },
  {
    name: 'Smart Automation Workflows',
    description: 'Automates repetitive customer routines for high retention.',
    effortRequired: 160,
    cost: 1500,
    qualityBoost: 13,
    demandBoost: 16,
    requiredSkill: 'engineering',
  },
  {
    name: 'Mobile Companion View',
    description: 'Responsive mobile experience for users on the move.',
    effortRequired: 100,
    cost: 850,
    qualityBoost: 7,
    demandBoost: 9,
    requiredSkill: 'design',
  },
];

export interface MarketingChannelSpec {
  channel: MarketingChannel;
  label: string;
  minDailyBudget: number;
  maxDailyBudget: number;
  cacBase: number; // cost per customer baseline
  speedLabel: string;
  description: string;
}

export const MARKETING_CHANNELS: Record<MarketingChannel, MarketingChannelSpec> = {
  SOCIAL_MEDIA: {
    channel: 'SOCIAL_MEDIA',
    label: 'Social Media',
    minDailyBudget: 40,
    maxDailyBudget: 400,
    cacBase: 28,
    speedLabel: 'Fast',
    description: 'Steady consumer awareness and occasional viral spikes.',
  },
  PAID_ADS: {
    channel: 'PAID_ADS',
    label: 'Paid Advertising',
    minDailyBudget: 100,
    maxDailyBudget: 1200,
    cacBase: 42,
    speedLabel: 'Immediate',
    description: 'Scalable daily signups as long as budget stays funded.',
  },
  SEO: {
    channel: 'SEO',
    label: 'Search & SEO',
    minDailyBudget: 50,
    maxDailyBudget: 350,
    cacBase: 20,
    speedLabel: 'Compounding',
    description: 'Lower customer acquisition cost that compounds over months.',
  },
  CONTENT_MARKETING: {
    channel: 'CONTENT_MARKETING',
    label: 'Content Marketing',
    minDailyBudget: 60,
    maxDailyBudget: 450,
    cacBase: 24,
    speedLabel: 'Steady',
    description: 'Builds founder reputation and inbound SMB leads.',
  },
  DIRECT_SALES: {
    channel: 'DIRECT_SALES',
    label: 'Direct Sales',
    minDailyBudget: 90,
    maxDailyBudget: 600,
    cacBase: 55,
    speedLabel: 'High Ticket',
    description: 'Generates higher-value B2B contracts and pipeline deals.',
  },
  PARTNERSHIPS: {
    channel: 'PARTNERSHIPS',
    label: 'Partnerships',
    minDailyBudget: 80,
    maxDailyBudget: 500,
    cacBase: 32,
    speedLabel: 'Strategic',
    description: 'Co-marketing distribution with complementary platforms.',
  },
};

export function businessTypeToCategory(type: BusinessType): ProductCategory {
  switch (type) {
    case 'SAAS':
      return 'SAAS';
    case 'MOBILE_APP':
      return 'MOBILE_APP';
    case 'GAME_STUDIO':
      return 'GAME';
    case 'AI_TOOLS':
      return 'AI_TOOL';
    case 'WEB_PLATFORM':
      return 'WEB_PLATFORM';
  }
}

export function createInitialCompetitors(): Competitor[] {
  return [
    {
      id: 'comp_northstar',
      name: 'Northstar Labs',
      category: 'SAAS',
      marketShare: 28,
      productQuality: 64,
      aggressiveness: 0.5,
      lastLaunchDay: 1,
    },
    {
      id: 'comp_pixelwave',
      name: 'PixelWave Interactive',
      category: 'GAME',
      marketShare: 24,
      productQuality: 61,
      aggressiveness: 0.45,
      lastLaunchDay: 1,
    },
    {
      id: 'comp_kinetix',
      name: 'Kinetix AI',
      category: 'AI_TOOL',
      marketShare: 32,
      productQuality: 70,
      aggressiveness: 0.7,
      lastLaunchDay: 1,
    },
  ];
}
