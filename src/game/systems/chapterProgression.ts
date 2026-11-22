import { STORY_CHAPTERS } from '@/src/game/data/storyData';
import { evaluateEnding, getEndingCinematicId } from '@/src/game/systems/endingEvaluator';
import { canShowStoryInterruption, maybePickStoryEvent } from '@/src/game/systems/storyEventSystem';
import { recordUnlockedEnding } from '@/src/services/endingGalleryService';
import {
  CinematicSceneId,
  GameState,
  StoryChapterId,
  StoryState,
} from '@/src/types/game';
import { clamp } from '@/src/utils/format';

export function createInitialStoryState(skipIntro = false): StoryState {
  return {
    introCompleted: skipIntro,
    introSkipped: skipIntro,
    currentChapter: 1,
    unlockedChapters: [1],
    completedChapters: [],
    seenMilestoneScenes: [],
    pendingCinematicQueue: [],
    activeCinematic: skipIntro ? null : 'INTRO',
    triggeredStoryEvents: [],
    completedStoryEvents: [],
    activeStoryEvent: null,
    decisions: {
      acquisitionOfferReceived: false,
      acquisitionAccepted: null,
      cultureScore: 55,
      resignationsCount: 0,
    },
    choiceHistory: [],
    evaluatedEnding: null,
  };
}

export function migrateLegacyStoryState(state: GameState): StoryState {
  if (state.story && typeof state.story.currentChapter === 'number') {
    const base = createInitialStoryState(true);
    return {
      ...base,
      ...state.story,
      unlockedChapters: Array.isArray(state.story.unlockedChapters)
        ? state.story.unlockedChapters
        : [1],
      completedChapters: Array.isArray(state.story.completedChapters)
        ? state.story.completedChapters
        : [],
      seenMilestoneScenes: Array.isArray(state.story.seenMilestoneScenes)
        ? state.story.seenMilestoneScenes
        : [],
      pendingCinematicQueue: Array.isArray(state.story.pendingCinematicQueue)
        ? state.story.pendingCinematicQueue
        : [],
      triggeredStoryEvents: Array.isArray(state.story.triggeredStoryEvents)
        ? state.story.triggeredStoryEvents
        : [],
      completedStoryEvents: Array.isArray(state.story.completedStoryEvents)
        ? state.story.completedStoryEvents
        : [],
      choiceHistory: Array.isArray(state.story.choiceHistory)
        ? state.story.choiceHistory
        : [],
      decisions: {
        ...base.decisions,
        ...(state.story.decisions ?? {}),
      },
      evaluatedEnding: state.story.evaluatedEnding ?? null,
    };
  }

  // Existing save without story state: do NOT auto-replay intro; derive chapter progress cleanly
  const story = createInitialStoryState(true);
  const hasLiveProduct = state.products.some(
    (p) => p.stage === 'MVP_LIVE' || p.stage === 'MATURE'
  );
  const hasCustomer =
    state.products.some((p) => p.payingCustomers > 0) ||
    state.contracts.some((c) => c.status === 'ACTIVE');
  const hasProfitableMonth = state.monthlyHistory.some((r) => r.netProfit > 0);
  const hasGrown =
    state.office.level >= 2 ||
    state.employees.length >= 5 ||
    hasProfitableMonth ||
    state.totalDays >= 12;
  const hasOpportunity =
    state.office.level >= 2 ||
    state.finance.valuation >= 120_000 ||
    state.totalDays >= 24;

  const unlocked: StoryChapterId[] = [1];
  const completed: StoryChapterId[] = [];
  const seenMilestones: StoryChapterId[] = [];

  if (state.products.length > 0 || state.totalDays > 1) {
    completed.push(1);
    seenMilestones.push(1);
    unlocked.push(2);
  }
  if (hasLiveProduct) {
    completed.push(2);
    seenMilestones.push(2);
    unlocked.push(3);
  }
  if (hasCustomer && hasLiveProduct) {
    completed.push(3);
    seenMilestones.push(3);
    if (hasGrown) unlocked.push(4);
  }
  if (hasCustomer && hasGrown && hasOpportunity) {
    completed.push(4);
    seenMilestones.push(4);
    unlocked.push(5);
  }

  story.unlockedChapters = unlocked;
  story.completedChapters = completed;
  story.seenMilestoneScenes = seenMilestones;
  story.currentChapter = unlocked[unlocked.length - 1] ?? 1;
  return story;
}

function enqueueCinematic(story: StoryState, id: CinematicSceneId): void {
  if (story.activeCinematic === id) return;
  if (story.pendingCinematicQueue.includes(id)) return;
  story.pendingCinematicQueue.push(id);
}

export function recordStoryResignations(state: GameState, count: number): void {
  if (!state.story || count <= 0) return;
  state.story.decisions.resignationsCount += count;
  state.story.decisions.cultureScore = clamp(
    state.story.decisions.cultureScore - count * 8,
    0,
    100
  );
}

function ensureChapterUnlocked(story: StoryState, ch: StoryChapterId): void {
  if (!story.unlockedChapters.includes(ch)) {
    story.unlockedChapters.push(ch);
  }
  if (ch > story.currentChapter) {
    story.currentChapter = ch;
  }
}

function completeChapterMilestone(
  story: StoryState,
  ch: StoryChapterId,
  queueScene: boolean
): void {
  if (!story.completedChapters.includes(ch)) {
    story.completedChapters.push(ch);
  }
  if (!story.seenMilestoneScenes.includes(ch)) {
    story.seenMilestoneScenes.push(ch);
    if (queueScene) {
      const meta = STORY_CHAPTERS.find((c) => c.id === ch);
      if (meta) enqueueCinematic(story, meta.milestoneCinematic);
    }
  }
}

export function triggerEvaluatedEnding(state: GameState): void {
  if (!state.story) return;
  if (state.story.evaluatedEnding && state.story.activeCinematic?.startsWith('ENDING_')) {
    return;
  }
  const summary = evaluateEnding(state);
  state.story.evaluatedEnding = summary;
  const cinematicId = getEndingCinematicId(summary.endingId);
  state.story.activeStoryEvent = null;
  state.story.activeCinematic = cinematicId;
  recordUnlockedEnding(state, summary);
}

export function syncStoryProgression(state: GameState): void {
  if (!state.story) {
    state.story = migrateLegacyStoryState(state);
  }
  const story = state.story;

  // Handle genuine Game Over failure -> Ending E (LAST_DAY)
  if (state.screen === 'GAME_OVER' && !story.evaluatedEnding) {
    triggerEvaluatedEnding(state);
    return;
  }

  // Handle Campaign victory -> Evaluated Ending (unless player continued into Sandbox)
  if (
    state.screen === 'VICTORY' &&
    !state.sandboxContinued &&
    !story.evaluatedEnding
  ) {
    triggerEvaluatedEnding(state);
    return;
  }

  // Once an ending has been evaluated, do not queue further story chapters or events
  if (story.evaluatedEnding) {
    return;
  }

  const hasProduct = state.products.length > 0;
  const hasLiveProduct = state.products.some(
    (p) => p.stage === 'MVP_LIVE' || p.stage === 'MATURE'
  );
  const totalCustomers = state.products.reduce(
    (s, p) => s + p.payingCustomers,
    0
  );
  const hasActiveContract = state.contracts.some((c) => c.status === 'ACTIVE');
  const hasRevenueCustomer = totalCustomers > 0 || hasActiveContract;
  const hasProfitableMonth = state.monthlyHistory.some((r) => r.netProfit > 0);
  const allowStoryScenes =
    (story.introCompleted || story.introSkipped) &&
    (state.totalDays >= 2 || Boolean(state.tutorial?.completed) || Boolean(state.tutorial?.skipped));

  // Chapter 1 Milestone: company operating with identity chosen or initial product created
  if (
    story.unlockedChapters.includes(1) &&
    !story.completedChapters.includes(1) &&
    (story.completedStoryEvents.includes('SE_CH1_IDENTITY') ||
      state.totalDays >= 2 ||
      hasLiveProduct)
  ) {
    completeChapterMilestone(story, 1, allowStoryScenes);
    ensureChapterUnlocked(story, 2);
  }

  // Chapter 2 Unlock & Milestone: first product prototype live
  if (story.completedChapters.includes(1) && hasProduct) {
    ensureChapterUnlocked(story, 2);
  }
  if (story.unlockedChapters.includes(2) && hasLiveProduct) {
    completeChapterMilestone(story, 2, allowStoryScenes);
    ensureChapterUnlocked(story, 3);
  }

  // Chapter 3 Milestone: first paying customer / contract
  if (story.unlockedChapters.includes(3) && hasRevenueCustomer) {
    completeChapterMilestone(story, 3, allowStoryScenes);
    if (
      state.employees.length >= 4 ||
      state.totalDays >= 10 ||
      state.finance.cumulativeRevenue >= 6000
    ) {
      ensureChapterUnlocked(story, 4);
    }
  }

  // Chapter 4 Unlock & Milestone: growing pains (expansion / team growth / profitable month)
  if (
    story.completedChapters.includes(3) &&
    (state.employees.length >= 4 ||
      state.totalDays >= 10 ||
      state.finance.cumulativeRevenue >= 6000)
  ) {
    ensureChapterUnlocked(story, 4);
  }
  if (
    story.unlockedChapters.includes(4) &&
    (state.office.level >= 2 ||
      state.employees.length >= 5 ||
      hasProfitableMonth ||
      (story.completedStoryEvents.includes('SE_CH4_WORKLOAD') &&
        story.completedStoryEvents.includes('SE_CH4_EXPANSION')))
  ) {
    completeChapterMilestone(story, 4, allowStoryScenes);
    if (
      state.office.level >= 2 ||
      state.finance.valuation >= 120_000 ||
      state.totalDays >= 20
    ) {
      ensureChapterUnlocked(story, 5);
    }
  }

  // Chapter 5 Unlock & Milestone: strategic direction resolved
  if (
    story.completedChapters.includes(4) &&
    (state.office.level >= 2 ||
      state.finance.valuation >= 120_000 ||
      state.totalDays >= 20)
  ) {
    ensureChapterUnlocked(story, 5);
  }
  if (
    story.unlockedChapters.includes(5) &&
    story.completedStoryEvents.includes('SE_CH5_INVESTMENT') &&
    (story.decisions.acquisitionAccepted === false ||
      state.finance.valuation >= 200_000 ||
      state.totalDays >= 28)
  ) {
    completeChapterMilestone(story, 5, allowStoryScenes);
    ensureChapterUnlocked(story, 6);
  }

  // Chapter 6 Unlock & Milestone: Final Horizon resolved -> trigger Ending Evaluation
  if (
    story.unlockedChapters.includes(6) &&
    story.completedStoryEvents.includes('SE_CH6_HORIZON') &&
    !story.completedChapters.includes(6)
  ) {
    completeChapterMilestone(story, 6, true);
  }

  // Dequeue pending cinematics safely when screen is PLAYING and unobstructed
  if (
    !story.activeCinematic &&
    story.pendingCinematicQueue.length > 0 &&
    canShowStoryInterruption(state)
  ) {
    story.activeCinematic = story.pendingCinematicQueue.shift() ?? null;
  }

  // Trigger next eligible story event cleanly when nothing is blocking
  if (canShowStoryInterruption(state)) {
    const nextEvt = maybePickStoryEvent(state);
    if (nextEvt) {
      story.activeStoryEvent = nextEvt;
      if (!story.triggeredStoryEvents.includes(nextEvt.id)) {
        story.triggeredStoryEvents.push(nextEvt.id);
      }
    }
  }
}

export function completeActiveCinematic(
  state: GameState,
  cinematicId: CinematicSceneId,
  skipped = false
): void {
  const story = state.story;
  if (!story) return;

  if (cinematicId === 'INTRO') {
    story.introCompleted = true;
    if (skipped) story.introSkipped = true;
  }

  if (story.activeCinematic === cinematicId) {
    story.activeCinematic = null;
  }

  // Completing Chapter 6 milestone launches the evaluated ending cinematic!
  if (
    cinematicId === 'CHAPTER_6_MILESTONE' &&
    !story.evaluatedEnding &&
    !state.sandboxContinued
  ) {
    triggerEvaluatedEnding(state);
    return;
  }

  // Completing an ending cinematic leaves screen cleanly on VICTORY / GAME_OVER summary or Sandbox
  if (cinematicId.startsWith('ENDING_')) {
    if (story.evaluatedEnding?.endingId === 'LAST_DAY') {
      state.screen = 'GAME_OVER';
    } else if (!state.sandboxContinued) {
      state.victoryAchieved = true;
      state.screen = 'VICTORY';
    }
    return;
  }

  // Advance queue if another cinematic is waiting and unobstructed
  if (!story.activeCinematic && story.pendingCinematicQueue.length > 0) {
    story.activeCinematic = story.pendingCinematicQueue.shift() ?? null;
  }
}
