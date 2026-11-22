import {
  CinematicSceneId,
  EndingId,
  GameState,
  StoryChapterId,
} from '@/src/types/game';

export type CinematicVisualKind =
  | 'SUNRISE_CITY'
  | 'SMALL_OFFICE_BOXES'
  | 'FIRST_TEAM_COFFEE'
  | 'FOUNDER_DESK_WAKEUP'
  | 'TITLE_CARD'
  | 'MILESTONE_FOUNDING'
  | 'MILESTONE_PROTOTYPE'
  | 'MILESTONE_CUSTOMER'
  | 'MILESTONE_GROWTH'
  | 'MILESTONE_OPPORTUNITY'
  | 'MILESTONE_FUTURE'
  | 'ENDING_DREAM_SKYLINE'
  | 'ENDING_COZY_COFFEE'
  | 'ENDING_ACQUISITION_PRESS'
  | 'ENDING_BURNOUT_NIGHT'
  | 'ENDING_LAST_DAY_BOXES'
  | 'ENDING_LEGACY_FUTURE'
  | 'ENDING_SUMMARY_CARD';

export interface CinematicBeat {
  id: string;
  visual: CinematicVisualKind;
  durationMs: number;
  speakerKey?: string;
  textKey: string;
  subtextKey?: string;
  isTitleCard?: boolean;
  isEndingSummary?: boolean;
  cameraPan?: 'LEFT_TO_RIGHT' | 'ZOOM_IN' | 'ZOOM_OUT' | 'GENTLE_DRIFT';
}

export interface StoryChapterMeta {
  id: StoryChapterId;
  titleKey: string;
  themeKey: string;
  milestoneKey: string;
  milestoneCinematic: CinematicSceneId;
}

export interface StoryEventChoiceMeta {
  id: string;
  labelKey: string;
  descKey: string;
  effectsKey: string;
  cost?: number;
}

export interface StoryEventTemplate {
  id: string;
  chapter: StoryChapterId;
  titleKey: string;
  descKey: string;
  choices: StoryEventChoiceMeta[];
}

export interface EndingMeta {
  id: EndingId;
  cinematicId: CinematicSceneId;
  titleKey: string;
  taglineKey: string;
  messageKey: string;
  hintKey: string;
  badgeColor: string;
}

export const STORY_CHAPTERS: StoryChapterMeta[] = [
  {
    id: 1,
    titleKey: 'story.chapters.c1.title',
    themeKey: 'story.chapters.c1.theme',
    milestoneKey: 'story.chapters.c1.milestone',
    milestoneCinematic: 'CHAPTER_1_MILESTONE',
  },
  {
    id: 2,
    titleKey: 'story.chapters.c2.title',
    themeKey: 'story.chapters.c2.theme',
    milestoneKey: 'story.chapters.c2.milestone',
    milestoneCinematic: 'CHAPTER_2_MILESTONE',
  },
  {
    id: 3,
    titleKey: 'story.chapters.c3.title',
    themeKey: 'story.chapters.c3.theme',
    milestoneKey: 'story.chapters.c3.milestone',
    milestoneCinematic: 'CHAPTER_3_MILESTONE',
  },
  {
    id: 4,
    titleKey: 'story.chapters.c4.title',
    themeKey: 'story.chapters.c4.theme',
    milestoneKey: 'story.chapters.c4.milestone',
    milestoneCinematic: 'CHAPTER_4_MILESTONE',
  },
  {
    id: 5,
    titleKey: 'story.chapters.c5.title',
    themeKey: 'story.chapters.c5.theme',
    milestoneKey: 'story.chapters.c5.milestone',
    milestoneCinematic: 'CHAPTER_5_MILESTONE',
  },
  {
    id: 6,
    titleKey: 'story.chapters.c6.title',
    themeKey: 'story.chapters.c6.theme',
    milestoneKey: 'story.chapters.c6.milestone',
    milestoneCinematic: 'CHAPTER_6_MILESTONE',
  },
];

export const INTRO_SCENES: CinematicBeat[] = [
  {
    id: 'intro_1',
    visual: 'SUNRISE_CITY',
    durationMs: 7500,
    speakerKey: 'story.speakers.narrator',
    textKey: 'story.intro.s1Text',
    subtextKey: 'story.intro.s1Scene',
    cameraPan: 'LEFT_TO_RIGHT',
  },
  {
    id: 'intro_2',
    visual: 'SMALL_OFFICE_BOXES',
    durationMs: 7500,
    speakerKey: 'story.speakers.narrator',
    textKey: 'story.intro.s2Text',
    subtextKey: 'story.intro.s2Scene',
    cameraPan: 'ZOOM_IN',
  },
  {
    id: 'intro_3',
    visual: 'FIRST_TEAM_COFFEE',
    durationMs: 7500,
    speakerKey: 'story.speakers.narrator',
    textKey: 'story.intro.s3Text',
    subtextKey: 'story.intro.s3Scene',
    cameraPan: 'GENTLE_DRIFT',
  },
  {
    id: 'intro_4',
    visual: 'FOUNDER_DESK_WAKEUP',
    durationMs: 6500,
    speakerKey: 'story.speakers.founder',
    textKey: 'story.intro.s4Text',
    subtextKey: 'story.intro.s4Scene',
    cameraPan: 'ZOOM_IN',
  },
  {
    id: 'intro_5',
    visual: 'TITLE_CARD',
    durationMs: 5500,
    textKey: 'story.intro.s5Title',
    subtextKey: 'story.intro.s5Subtitle',
    isTitleCard: true,
    cameraPan: 'ZOOM_OUT',
  },
];

export const CHAPTER_MILESTONE_SCENES: Record<
  Exclude<
    CinematicSceneId,
    | 'INTRO'
    | 'ENDING_DREAM_COMPANY'
    | 'ENDING_SMALL_BUT_HAPPY'
    | 'ENDING_ACQUISITION'
    | 'ENDING_BURNOUT'
    | 'ENDING_LAST_DAY'
    | 'ENDING_LEGACY'
  >,
  CinematicBeat[]
> = {
  CHAPTER_1_MILESTONE: [
    {
      id: 'c1_m1',
      visual: 'MILESTONE_FOUNDING',
      durationMs: 6000,
      speakerKey: 'story.speakers.narrator',
      textKey: 'story.milestones.c1Line1',
      subtextKey: 'story.chapters.c1.title',
      cameraPan: 'ZOOM_IN',
    },
    {
      id: 'c1_m2',
      visual: 'FIRST_TEAM_COFFEE',
      durationMs: 5500,
      speakerKey: 'story.speakers.founder',
      textKey: 'story.milestones.c1Line2',
      subtextKey: 'story.chapters.c1.milestone',
      cameraPan: 'GENTLE_DRIFT',
    },
  ],
  CHAPTER_2_MILESTONE: [
    {
      id: 'c2_m1',
      visual: 'MILESTONE_PROTOTYPE',
      durationMs: 6000,
      speakerKey: 'story.speakers.teamLead',
      textKey: 'story.milestones.c2Line1',
      subtextKey: 'story.chapters.c2.title',
      cameraPan: 'ZOOM_IN',
    },
    {
      id: 'c2_m2',
      visual: 'FOUNDER_DESK_WAKEUP',
      durationMs: 5500,
      speakerKey: 'story.speakers.narrator',
      textKey: 'story.milestones.c2Line2',
      subtextKey: 'story.chapters.c2.milestone',
      cameraPan: 'GENTLE_DRIFT',
    },
  ],
  CHAPTER_3_MILESTONE: [
    {
      id: 'c3_m1',
      visual: 'MILESTONE_CUSTOMER',
      durationMs: 6000,
      speakerKey: 'story.speakers.narrator',
      textKey: 'story.milestones.c3Line1',
      subtextKey: 'story.chapters.c3.title',
      cameraPan: 'LEFT_TO_RIGHT',
    },
    {
      id: 'c3_m2',
      visual: 'FIRST_TEAM_COFFEE',
      durationMs: 5500,
      speakerKey: 'story.speakers.founder',
      textKey: 'story.milestones.c3Line2',
      subtextKey: 'story.chapters.c3.milestone',
      cameraPan: 'GENTLE_DRIFT',
    },
  ],
  CHAPTER_4_MILESTONE: [
    {
      id: 'c4_m1',
      visual: 'MILESTONE_GROWTH',
      durationMs: 6000,
      speakerKey: 'story.speakers.narrator',
      textKey: 'story.milestones.c4Line1',
      subtextKey: 'story.chapters.c4.title',
      cameraPan: 'ZOOM_OUT',
    },
    {
      id: 'c4_m2',
      visual: 'SMALL_OFFICE_BOXES',
      durationMs: 5500,
      speakerKey: 'story.speakers.narrator',
      textKey: 'story.milestones.c4Line2',
      subtextKey: 'story.chapters.c4.milestone',
      cameraPan: 'GENTLE_DRIFT',
    },
  ],
  CHAPTER_5_MILESTONE: [
    {
      id: 'c5_m1',
      visual: 'MILESTONE_OPPORTUNITY',
      durationMs: 6000,
      speakerKey: 'story.speakers.narrator',
      textKey: 'story.milestones.c5Line1',
      subtextKey: 'story.chapters.c5.title',
      cameraPan: 'ZOOM_IN',
    },
    {
      id: 'c5_m2',
      visual: 'SUNRISE_CITY',
      durationMs: 5500,
      speakerKey: 'story.speakers.founder',
      textKey: 'story.milestones.c5Line2',
      subtextKey: 'story.chapters.c5.milestone',
      cameraPan: 'LEFT_TO_RIGHT',
    },
  ],
  CHAPTER_6_MILESTONE: [
    {
      id: 'c6_m1',
      visual: 'MILESTONE_FUTURE',
      durationMs: 6500,
      speakerKey: 'story.speakers.narrator',
      textKey: 'story.milestones.c6Line1',
      subtextKey: 'story.chapters.c6.title',
      cameraPan: 'GENTLE_DRIFT',
    },
    {
      id: 'c6_m2',
      visual: 'SUNRISE_CITY',
      durationMs: 6000,
      speakerKey: 'story.speakers.founder',
      textKey: 'story.milestones.c6Line2',
      subtextKey: 'story.chapters.c6.milestone',
      cameraPan: 'ZOOM_OUT',
    },
  ],
};

export const STORY_EVENTS: StoryEventTemplate[] = [
  {
    id: 'SE_CH1_IDENTITY',
    chapter: 1,
    titleKey: 'story.events.ch1Identity.title',
    descKey: 'story.events.ch1Identity.desc',
    choices: [
      {
        id: 'QUALITY_FIRST',
        labelKey: 'story.events.ch1Identity.c1Label',
        descKey: 'story.events.ch1Identity.c1Desc',
        effectsKey: 'story.events.ch1Identity.c1Effects',
      },
      {
        id: 'FAST_GROWTH',
        labelKey: 'story.events.ch1Identity.c2Label',
        descKey: 'story.events.ch1Identity.c2Desc',
        effectsKey: 'story.events.ch1Identity.c2Effects',
      },
      {
        id: 'PEOPLE_FIRST',
        labelKey: 'story.events.ch1Identity.c3Label',
        descKey: 'story.events.ch1Identity.c3Desc',
        effectsKey: 'story.events.ch1Identity.c3Effects',
      },
    ],
  },
  {
    id: 'SE_CH2_PRODUCT_DIR',
    chapter: 2,
    titleKey: 'story.events.ch2Direction.title',
    descKey: 'story.events.ch2Direction.desc',
    choices: [
      {
        id: 'DEEP_TECH',
        labelKey: 'story.events.ch2Direction.c1Label',
        descKey: 'story.events.ch2Direction.c1Desc',
        effectsKey: 'story.events.ch2Direction.c1Effects',
        cost: 800,
      },
      {
        id: 'USER_FRIENDLY',
        labelKey: 'story.events.ch2Direction.c2Label',
        descKey: 'story.events.ch2Direction.c2Desc',
        effectsKey: 'story.events.ch2Direction.c2Effects',
      },
    ],
  },
  {
    id: 'SE_CH3_FEEDBACK',
    chapter: 3,
    titleKey: 'story.events.ch3Feedback.title',
    descKey: 'story.events.ch3Feedback.desc',
    choices: [
      {
        id: 'LISTEN_FIX',
        labelKey: 'story.events.ch3Feedback.c1Label',
        descKey: 'story.events.ch3Feedback.c1Desc',
        effectsKey: 'story.events.ch3Feedback.c1Effects',
        cost: 500,
      },
      {
        id: 'SHIP_FAST',
        labelKey: 'story.events.ch3Feedback.c2Label',
        descKey: 'story.events.ch3Feedback.c2Desc',
        effectsKey: 'story.events.ch3Feedback.c2Effects',
      },
      {
        id: 'MARKETING_PUSH',
        labelKey: 'story.events.ch3Feedback.c3Label',
        descKey: 'story.events.ch3Feedback.c3Desc',
        effectsKey: 'story.events.ch3Feedback.c3Effects',
        cost: 900,
      },
    ],
  },
  {
    id: 'SE_CH4_WORKLOAD',
    chapter: 4,
    titleKey: 'story.events.ch4Workload.title',
    descKey: 'story.events.ch4Workload.desc',
    choices: [
      {
        id: 'REDUCE_LOAD',
        labelKey: 'story.events.ch4Workload.c1Label',
        descKey: 'story.events.ch4Workload.c1Desc',
        effectsKey: 'story.events.ch4Workload.c1Effects',
      },
      {
        id: 'HIRE_HELP',
        labelKey: 'story.events.ch4Workload.c2Label',
        descKey: 'story.events.ch4Workload.c2Desc',
        effectsKey: 'story.events.ch4Workload.c2Effects',
        cost: 2200,
      },
      {
        id: 'PUSH_THROUGH',
        labelKey: 'story.events.ch4Workload.c3Label',
        descKey: 'story.events.ch4Workload.c3Desc',
        effectsKey: 'story.events.ch4Workload.c3Effects',
      },
    ],
  },
  {
    id: 'SE_CH4_EXPANSION',
    chapter: 4,
    titleKey: 'story.events.ch4Expansion.title',
    descKey: 'story.events.ch4Expansion.desc',
    choices: [
      {
        id: 'EXPAND_NOW',
        labelKey: 'story.events.ch4Expansion.c1Label',
        descKey: 'story.events.ch4Expansion.c1Desc',
        effectsKey: 'story.events.ch4Expansion.c1Effects',
        cost: 4500,
      },
      {
        id: 'SAVE_RUNWAY',
        labelKey: 'story.events.ch4Expansion.c2Label',
        descKey: 'story.events.ch4Expansion.c2Desc',
        effectsKey: 'story.events.ch4Expansion.c2Effects',
      },
      {
        id: 'INVEST_TEAM',
        labelKey: 'story.events.ch4Expansion.c3Label',
        descKey: 'story.events.ch4Expansion.c3Desc',
        effectsKey: 'story.events.ch4Expansion.c3Effects',
        cost: 2000,
      },
    ],
  },
  {
    id: 'SE_CH5_INVESTMENT',
    chapter: 5,
    titleKey: 'story.events.ch5Investment.title',
    descKey: 'story.events.ch5Investment.desc',
    choices: [
      {
        id: 'ACCEPT',
        labelKey: 'story.events.ch5Investment.c1Label',
        descKey: 'story.events.ch5Investment.c1Desc',
        effectsKey: 'story.events.ch5Investment.c1Effects',
      },
      {
        id: 'NEGOTIATE',
        labelKey: 'story.events.ch5Investment.c2Label',
        descKey: 'story.events.ch5Investment.c2Desc',
        effectsKey: 'story.events.ch5Investment.c2Effects',
      },
      {
        id: 'DECLINE',
        labelKey: 'story.events.ch5Investment.c3Label',
        descKey: 'story.events.ch5Investment.c3Desc',
        effectsKey: 'story.events.ch5Investment.c3Effects',
      },
    ],
  },
  {
    id: 'SE_CH5_ACQUISITION',
    chapter: 5,
    titleKey: 'story.events.ch5Acquisition.title',
    descKey: 'story.events.ch5Acquisition.desc',
    choices: [
      {
        id: 'ACCEPT_ACQUISITION',
        labelKey: 'story.events.ch5Acquisition.c1Label',
        descKey: 'story.events.ch5Acquisition.c1Desc',
        effectsKey: 'story.events.ch5Acquisition.c1Effects',
      },
      {
        id: 'REJECT_ACQUISITION',
        labelKey: 'story.events.ch5Acquisition.c2Label',
        descKey: 'story.events.ch5Acquisition.c2Desc',
        effectsKey: 'story.events.ch5Acquisition.c2Effects',
      },
    ],
  },
  {
    id: 'SE_CH6_HORIZON',
    chapter: 6,
    titleKey: 'story.events.ch6Horizon.title',
    descKey: 'story.events.ch6Horizon.desc',
    choices: [
      {
        id: 'INNOVATE_CULTURE',
        labelKey: 'story.events.ch6Horizon.c1Label',
        descKey: 'story.events.ch6Horizon.c1Desc',
        effectsKey: 'story.events.ch6Horizon.c1Effects',
      },
      {
        id: 'SCALE_MARKET',
        labelKey: 'story.events.ch6Horizon.c2Label',
        descKey: 'story.events.ch6Horizon.c2Desc',
        effectsKey: 'story.events.ch6Horizon.c2Effects',
      },
    ],
  },
];

export const ENDING_DEFINITIONS: Record<EndingId, EndingMeta> = {
  DREAM_COMPANY: {
    id: 'DREAM_COMPANY',
    cinematicId: 'ENDING_DREAM_COMPANY',
    titleKey: 'story.endings.DREAM_COMPANY.title',
    taglineKey: 'story.endings.DREAM_COMPANY.tagline',
    messageKey: 'story.endings.DREAM_COMPANY.message',
    hintKey: 'story.endings.DREAM_COMPANY.hint',
    badgeColor: '#78978A',
  },
  SMALL_BUT_HAPPY: {
    id: 'SMALL_BUT_HAPPY',
    cinematicId: 'ENDING_SMALL_BUT_HAPPY',
    titleKey: 'story.endings.SMALL_BUT_HAPPY.title',
    taglineKey: 'story.endings.SMALL_BUT_HAPPY.tagline',
    messageKey: 'story.endings.SMALL_BUT_HAPPY.message',
    hintKey: 'story.endings.SMALL_BUT_HAPPY.hint',
    badgeColor: '#D9A66C',
  },
  ACQUISITION: {
    id: 'ACQUISITION',
    cinematicId: 'ENDING_ACQUISITION',
    titleKey: 'story.endings.ACQUISITION.title',
    taglineKey: 'story.endings.ACQUISITION.tagline',
    messageKey: 'story.endings.ACQUISITION.message',
    hintKey: 'story.endings.ACQUISITION.hint',
    badgeColor: '#6366f1',
  },
  BURNOUT: {
    id: 'BURNOUT',
    cinematicId: 'ENDING_BURNOUT',
    titleKey: 'story.endings.BURNOUT.title',
    taglineKey: 'story.endings.BURNOUT.tagline',
    messageKey: 'story.endings.BURNOUT.message',
    hintKey: 'story.endings.BURNOUT.hint',
    badgeColor: '#D68B7B',
  },
  LAST_DAY: {
    id: 'LAST_DAY',
    cinematicId: 'ENDING_LAST_DAY',
    titleKey: 'story.endings.LAST_DAY.title',
    taglineKey: 'story.endings.LAST_DAY.tagline',
    messageKey: 'story.endings.LAST_DAY.message',
    hintKey: 'story.endings.LAST_DAY.hint',
    badgeColor: '#64748b',
  },
  LEGACY: {
    id: 'LEGACY',
    cinematicId: 'ENDING_LEGACY',
    titleKey: 'story.endings.LEGACY.title',
    taglineKey: 'story.endings.LEGACY.tagline',
    messageKey: 'story.endings.LEGACY.message',
    hintKey: 'story.endings.LEGACY.hint',
    badgeColor: '#10b981',
  },
};

export const ENDING_ORDER: EndingId[] = [
  'DREAM_COMPANY',
  'SMALL_BUT_HAPPY',
  'ACQUISITION',
  'BURNOUT',
  'LAST_DAY',
  'LEGACY',
];

export const ENDING_CINEMATICS: Record<EndingId, CinematicBeat[]> = {
  DREAM_COMPANY: [
    {
      id: 'ed_dream_1',
      visual: 'MILESTONE_GROWTH',
      durationMs: 6500,
      speakerKey: 'story.speakers.narrator',
      textKey: 'story.endings.DREAM_COMPANY.s1',
      cameraPan: 'LEFT_TO_RIGHT',
    },
    {
      id: 'ed_dream_2',
      visual: 'ENDING_DREAM_SKYLINE',
      durationMs: 7000,
      speakerKey: 'story.speakers.teamLead',
      textKey: 'story.endings.DREAM_COMPANY.s2',
      cameraPan: 'ZOOM_OUT',
    },
    {
      id: 'ed_dream_3',
      visual: 'SUNRISE_CITY',
      durationMs: 6500,
      speakerKey: 'story.speakers.founder',
      textKey: 'story.endings.DREAM_COMPANY.message',
      cameraPan: 'GENTLE_DRIFT',
    },
    {
      id: 'ed_dream_4',
      visual: 'ENDING_SUMMARY_CARD',
      durationMs: 999999,
      textKey: 'story.endings.DREAM_COMPANY.title',
      subtextKey: 'story.endings.DREAM_COMPANY.message',
      isEndingSummary: true,
    },
  ],
  SMALL_BUT_HAPPY: [
    {
      id: 'ed_small_1',
      visual: 'ENDING_COZY_COFFEE',
      durationMs: 6500,
      speakerKey: 'story.speakers.narrator',
      textKey: 'story.endings.SMALL_BUT_HAPPY.s1',
      cameraPan: 'GENTLE_DRIFT',
    },
    {
      id: 'ed_small_2',
      visual: 'FIRST_TEAM_COFFEE',
      durationMs: 6500,
      speakerKey: 'story.speakers.teamLead',
      textKey: 'story.endings.SMALL_BUT_HAPPY.s2',
      cameraPan: 'ZOOM_IN',
    },
    {
      id: 'ed_small_3',
      visual: 'ENDING_COZY_COFFEE',
      durationMs: 6500,
      speakerKey: 'story.speakers.founder',
      textKey: 'story.endings.SMALL_BUT_HAPPY.message',
      cameraPan: 'ZOOM_OUT',
    },
    {
      id: 'ed_small_4',
      visual: 'ENDING_SUMMARY_CARD',
      durationMs: 999999,
      textKey: 'story.endings.SMALL_BUT_HAPPY.title',
      subtextKey: 'story.endings.SMALL_BUT_HAPPY.message',
      isEndingSummary: true,
    },
  ],
  ACQUISITION: [
    {
      id: 'ed_acq_1',
      visual: 'ENDING_ACQUISITION_PRESS',
      durationMs: 6500,
      speakerKey: 'story.speakers.narrator',
      textKey: 'story.endings.ACQUISITION.s1',
      cameraPan: 'ZOOM_IN',
    },
    {
      id: 'ed_acq_2',
      visual: 'FIRST_TEAM_COFFEE',
      durationMs: 6500,
      speakerKey: 'story.speakers.teamLead',
      textKey: 'story.endings.ACQUISITION.s2',
      cameraPan: 'GENTLE_DRIFT',
    },
    {
      id: 'ed_acq_3',
      visual: 'SUNRISE_CITY',
      durationMs: 6500,
      speakerKey: 'story.speakers.founder',
      textKey: 'story.endings.ACQUISITION.message',
      cameraPan: 'LEFT_TO_RIGHT',
    },
    {
      id: 'ed_acq_4',
      visual: 'ENDING_SUMMARY_CARD',
      durationMs: 999999,
      textKey: 'story.endings.ACQUISITION.title',
      subtextKey: 'story.endings.ACQUISITION.message',
      isEndingSummary: true,
    },
  ],
  BURNOUT: [
    {
      id: 'ed_burn_1',
      visual: 'ENDING_BURNOUT_NIGHT',
      durationMs: 6500,
      speakerKey: 'story.speakers.narrator',
      textKey: 'story.endings.BURNOUT.s1',
      cameraPan: 'ZOOM_OUT',
    },
    {
      id: 'ed_burn_2',
      visual: 'ENDING_BURNOUT_NIGHT',
      durationMs: 6500,
      speakerKey: 'story.speakers.narrator',
      textKey: 'story.endings.BURNOUT.s2',
      cameraPan: 'ZOOM_IN',
    },
    {
      id: 'ed_burn_3',
      visual: 'ENDING_BURNOUT_NIGHT',
      durationMs: 7000,
      speakerKey: 'story.speakers.founder',
      textKey: 'story.endings.BURNOUT.message',
      cameraPan: 'GENTLE_DRIFT',
    },
    {
      id: 'ed_burn_4',
      visual: 'ENDING_SUMMARY_CARD',
      durationMs: 999999,
      textKey: 'story.endings.BURNOUT.title',
      subtextKey: 'story.endings.BURNOUT.message',
      isEndingSummary: true,
    },
  ],
  LAST_DAY: [
    {
      id: 'ed_last_1',
      visual: 'ENDING_LAST_DAY_BOXES',
      durationMs: 6500,
      speakerKey: 'story.speakers.narrator',
      textKey: 'story.endings.LAST_DAY.s1',
      cameraPan: 'ZOOM_OUT',
    },
    {
      id: 'ed_last_2',
      visual: 'ENDING_LAST_DAY_BOXES',
      durationMs: 6500,
      speakerKey: 'story.speakers.teamLead',
      textKey: 'story.endings.LAST_DAY.s2',
      cameraPan: 'LEFT_TO_RIGHT',
    },
    {
      id: 'ed_last_3',
      visual: 'SMALL_OFFICE_BOXES',
      durationMs: 7000,
      speakerKey: 'story.speakers.founder',
      textKey: 'story.endings.LAST_DAY.message',
      cameraPan: 'ZOOM_OUT',
    },
    {
      id: 'ed_last_4',
      visual: 'ENDING_SUMMARY_CARD',
      durationMs: 999999,
      textKey: 'story.endings.LAST_DAY.title',
      subtextKey: 'story.endings.LAST_DAY.message',
      isEndingSummary: true,
    },
  ],
  LEGACY: [
    {
      id: 'ed_leg_1',
      visual: 'ENDING_LEGACY_FUTURE',
      durationMs: 6500,
      speakerKey: 'story.speakers.narrator',
      textKey: 'story.endings.LEGACY.s1',
      cameraPan: 'LEFT_TO_RIGHT',
    },
    {
      id: 'ed_leg_2',
      visual: 'ENDING_DREAM_SKYLINE',
      durationMs: 6500,
      speakerKey: 'story.speakers.teamLead',
      textKey: 'story.endings.LEGACY.s2',
      cameraPan: 'GENTLE_DRIFT',
    },
    {
      id: 'ed_leg_3',
      visual: 'ENDING_LEGACY_FUTURE',
      durationMs: 7000,
      speakerKey: 'story.speakers.founder',
      textKey: 'story.endings.LEGACY.message',
      cameraPan: 'ZOOM_OUT',
    },
    {
      id: 'ed_leg_4',
      visual: 'ENDING_SUMMARY_CARD',
      durationMs: 999999,
      textKey: 'story.endings.LEGACY.title',
      subtextKey: 'story.endings.LEGACY.message',
      isEndingSummary: true,
    },
  ],
};

export function getBeatsForCinematic(
  cinematicId: CinematicSceneId,
  _state?: GameState
): CinematicBeat[] {
  if (cinematicId === 'INTRO') return INTRO_SCENES;
  if (cinematicId.startsWith('ENDING_')) {
    const endingId = cinematicId.replace('ENDING_', '') as EndingId;
    return ENDING_CINEMATICS[endingId] ?? ENDING_CINEMATICS.DREAM_COMPANY;
  }
  return (
    CHAPTER_MILESTONE_SCENES[
      cinematicId as keyof typeof CHAPTER_MILESTONE_SCENES
    ] ?? CHAPTER_MILESTONE_SCENES.CHAPTER_1_MILESTONE
  );
}
