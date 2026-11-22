import { ActiveEvent } from '@/src/types/game';

export interface EventTemplate {
  templateId: string;
  title: string;
  description: string;
  category: ActiveEvent['category'];
  severity: ActiveEvent['severity'];
  minDay: number;
  buildChoices: (ctx: { employeeName?: string; productName?: string; investorCash?: number }) => ActiveEvent['choices'];
}

export const EVENT_TEMPLATES: EventTemplate[] = [
  {
    templateId: 'CRITICAL_BUG',
    title: 'Production Bug Discovered',
    description:
      'Early customers reported a checkout and data-sync glitch in your flagship release. Support tickets are climbing.',
    category: 'PRODUCT',
    severity: 'WARNING',
    minDay: 6,
    buildChoices: () => [
      {
        id: 'HOTFIX_NOW',
        label: 'Authorize Emergency Hotfix',
        description: 'Spend $650 on cloud tools and overtime to patch immediately.',
        cost: 650,
        effectsSummary: 'Clears bugs, +4 Satisfaction, -10 Team Energy',
      },
      {
        id: 'QUEUE_PATCH',
        label: 'Schedule in Regular Sprint',
        description: 'Avoid extra spend and let engineers fix it during normal hours.',
        effectsSummary: '+4 Bugs, -5 Customer Satisfaction',
      },
    ],
  },
  {
    templateId: 'VIRAL_POST',
    title: 'Viral Product Mention',
    description:
      'A respected tech creator shared a glowing thread about your startup, driving a wave of curious traffic.',
    category: 'MARKET',
    severity: 'OPPORTUNITY',
    minDay: 5,
    buildChoices: () => [
      {
        id: 'AMPLIFY_CAMPAIGN',
        label: 'Boost With Follow-Up Content',
        description: 'Invest $800 into landing page polish and paid amplification.',
        cost: 800,
        effectsSummary: '+25–45 New Customers, +6 Reputation',
      },
      {
        id: 'ORGANIC_RIDE',
        label: 'Thank Community Organically',
        description: 'Engage in comments directly with zero ad spend.',
        effectsSummary: '+12–18 New Customers, +3 Reputation',
      },
    ],
  },
  {
    templateId: 'MAJOR_CLIENT_OPP',
    title: 'Enterprise Pilot Invitation',
    description:
      'A mid-market firm wants to pilot your product across 40 seats, provided you tailor onboarding this week.',
    category: 'MARKET',
    severity: 'OPPORTUNITY',
    minDay: 10,
    buildChoices: () => [
      {
        id: 'PITCH_CUSTOM',
        label: 'Build Custom Pilot Deck',
        description: 'Spend $900 on legal review and demo preparation.',
        cost: 900,
        effectsSummary: 'Adds a high-value B2B Contract to your pipeline',
      },
      {
        id: 'STANDARD_OFFER',
        label: 'Send Standard Self-Serve Link',
        description: 'Keep team focused on core roadmap.',
        effectsSummary: '+$600 Instant Pilot Fee, +2 Reputation',
      },
    ],
  },
  {
    templateId: 'EMPLOYEE_RESIGN_RISK',
    title: 'Key Employee Burnout Warning',
    description:
      'One of your team members is feeling overworked and received a recruiter message from a larger firm.',
    category: 'HR',
    severity: 'WARNING',
    minDay: 12,
    buildChoices: ({ employeeName }) => [
      {
        id: 'RETENTION_BONUS',
        label: `Give ${employeeName ?? 'Employee'} Retention Bonus & Day Off`,
        description: 'Offer $1,000 bonus and lighter workload.',
        cost: 1000,
        effectsSummary: '+25 Morale, -25 Stress, stays committed',
      },
      {
        id: 'PEP_TALK',
        label: 'Hold 1-on-1 Career Check-In',
        description: 'Use founder leadership to realign goals without cash outlay.',
        effectsSummary: '+10 Morale, small risk of resignation if stress stays high',
      },
    ],
  },
  {
    templateId: 'INVESTOR_OFFER',
    title: 'Seed Investor Term Sheet',
    description:
      'An angel syndicate visited your Lobby and was impressed by your execution. They are offering growth capital.',
    category: 'INVESTOR',
    severity: 'OPPORTUNITY',
    minDay: 15,
    buildChoices: ({ investorCash }) => [
      {
        id: 'ACCEPT_FUNDING',
        label: `Accept $${(investorCash ?? 25000).toLocaleString()} for 10% Equity`,
        description: 'Inject runway immediately to accelerate hiring and marketing.',
        effectsSummary: `+$${(investorCash ?? 25000).toLocaleString()} Cash, +10% Dilution, +5 Reputation`,
      },
      {
        id: 'STAY_BOOTSTRAPPED',
        label: 'Politely Decline & Stay Independent',
        description: 'Keep 100% ownership and build from customer revenue.',
        effectsSummary: '+4 Founder Reputation, 0% Dilution',
      },
    ],
  },
  {
    templateId: 'SERVER_OUTAGE',
    title: 'Cloud Infrastructure Outage',
    description:
      'Traffic spiked unexpectedly and your database cluster is throttling requests across customer regions.',
    category: 'OPERATIONS',
    severity: 'CRITICAL',
    minDay: 8,
    buildChoices: () => [
      {
        id: 'UPGRADE_CLUSTER',
        label: 'Failover & Upgrade Nodes',
        description: 'Pay $1,100 for emergency autoscaling capacity.',
        cost: 1100,
        effectsSummary: 'Zero data loss, +3 Satisfaction, +4 Quality',
      },
      {
        id: 'RESTART_MANUAL',
        label: 'Manual Restart & Status Apology',
        description: 'Save cash while ops restarts nodes manually.',
        effectsSummary: '-7 Customer Satisfaction, -3 Reputation',
      },
    ],
  },
  {
    templateId: 'COMPETITOR_LAUNCH',
    title: 'Competitor Launches Rival Release',
    description:
      'A rival studio shipped a competing release with aggressive introductory pricing.',
    category: 'MARKET',
    severity: 'WARNING',
    minDay: 14,
    buildChoices: () => [
      {
        id: 'FEATURE_SPRINT',
        label: 'Launch Differentiation Sprint',
        description: 'Invest $750 into targeted customer outreach and polish.',
        cost: 750,
        effectsSummary: '+6 Market Demand, +4 Product Quality',
      },
      {
        id: 'HOLD_COURSE',
        label: 'Stay Focused on Core Users',
        description: 'Avoid reactionary spending and keep runway safe.',
        effectsSummary: '-4 Market Demand',
      },
    ],
  },
  {
    templateId: 'EMPLOYEE_CONFLICT',
    title: 'Product vs. Engineering Disagreement',
    description:
      'Two team members disagree sharply on shipping speed versus architectural refactoring.',
    category: 'HR',
    severity: 'INFO',
    minDay: 9,
    buildChoices: () => [
      {
        id: 'MEDIATE_COMPROMISE',
        label: 'Facilitate Architecture Compromise',
        description: 'Spend Founder energy to align both sides in the Meeting Room.',
        effectsSummary: '+8 Team Morale, +5 Founder Leadership XP',
      },
      {
        id: 'PUSH_DEADLINE',
        label: 'Prioritize Immediate Shipping',
        description: 'Force the feature out quickly without refactoring.',
        effectsSummary: '+8 Dev Progress, -6 Morale, +2 Bugs',
      },
    ],
  },
  {
    templateId: 'UNEXPECTED_EXPENSE',
    title: 'Software License & Compliance Audit',
    description:
      'Annual third-party API and security compliance fees came in slightly higher than budgeted.',
    category: 'FINANCE',
    severity: 'WARNING',
    minDay: 11,
    buildChoices: () => [
      {
        id: 'PAY_AUDIT',
        label: 'Settle Full Compliance Fee',
        description: 'Pay $950 immediately to keep enterprise trust intact.',
        cost: 950,
        effectsSummary: '-$950 Cash, +3 Reputation',
      },
      {
        id: 'RENEGOTIATE',
        label: 'Defer via Quarterly Debt Plan',
        description: 'Avoid immediate cash hit using legal & finance leverage.',
        effectsSummary: '$0 Upfront, +$950 Short-Term Debt',
      },
    ],
  },
  {
    templateId: 'NEGATIVE_FEEDBACK',
    title: 'Critical Customer Review Thread',
    description:
      'A paying customer posted detailed criticism about missing workflow polish.',
    category: 'PRODUCT',
    severity: 'WARNING',
    minDay: 7,
    buildChoices: () => [
      {
        id: 'FOUNDER_REPLY',
        label: 'Respond Personally & Ship Quick Fix',
        description: 'Spend $400 and founder energy to turn a critic into an advocate.',
        cost: 400,
        effectsSummary: '+6 Customer Satisfaction, +4 Reputation',
      },
      {
        id: 'IGNORE_THREAD',
        label: 'Log Feedback & Move On',
        description: 'Conserve resources for the next milestone.',
        effectsSummary: '-5 Customer Satisfaction',
      },
    ],
  },
];
