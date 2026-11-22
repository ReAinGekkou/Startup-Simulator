import { STORY_EVENTS, StoryEventTemplate } from '@/src/game/data/storyData';
import { createEmployeeFromCandidate, generateCandidatePool } from '@/src/game/systems/employeeSystem';
import { evaluateEnding, getEndingCinematicId } from '@/src/game/systems/endingEvaluator';
import { getLocale, t } from '@/src/localization';
import { recordUnlockedEnding } from '@/src/services/endingGalleryService';
import { GameState, StoryEventInstance } from '@/src/types/game';
import { clamp, formatCurrency } from '@/src/utils/format';

export function getStoryEventTemplate(eventId: string): StoryEventTemplate | undefined {
  return STORY_EVENTS.find((e) => e.id === eventId);
}

export function canShowStoryInterruption(state: GameState): boolean {
  if (state.screen !== 'PLAYING') return false;
  if (state.activeEvent || state.pendingMonthlyReport || state.pendingDailyReport) {
    return false;
  }
  if (state.story.activeCinematic || state.story.activeStoryEvent) {
    return false;
  }
  const tutorialBlocking =
    Boolean(state.tutorial?.active) &&
    !state.tutorial?.completed &&
    !state.tutorial?.skipped;
  if (tutorialBlocking && state.totalDays <= 1) {
    return false;
  }
  return true;
}

export function maybePickStoryEvent(state: GameState): StoryEventInstance | null {
  if (!canShowStoryInterruption(state)) return null;
  if (!state.story.introCompleted && !state.story.introSkipped) return null;

  const unlocked = new Set(state.story.unlockedChapters);
  const triggered = new Set(state.story.triggeredStoryEvents);

  // Chapter 1: Company Identity (after initial onboarding step or Day 2+)
  if (
    unlocked.has(1) &&
    !triggered.has('SE_CH1_IDENTITY') &&
    (state.totalDays >= 2 || state.tutorial.completed || state.tutorial.skipped)
  ) {
    return {
      id: 'SE_CH1_IDENTITY',
      chapter: 1,
      triggeredDay: state.totalDays,
    };
  }

  // Chapter 2: Product Direction (when Chapter 2 unlocked & product exists)
  if (
    unlocked.has(2) &&
    !triggered.has('SE_CH2_PRODUCT_DIR') &&
    state.products.length > 0 &&
    triggered.has('SE_CH1_IDENTITY')
  ) {
    return {
      id: 'SE_CH2_PRODUCT_DIR',
      chapter: 2,
      triggeredDay: state.totalDays,
      relatedProductId: state.products[0].id,
    };
  }

  // Chapter 3: Early Customer Feedback (when Chapter 3 unlocked)
  if (
    unlocked.has(3) &&
    !triggered.has('SE_CH3_FEEDBACK') &&
    state.products.some((p) => p.stage === 'MVP_LIVE' || p.stage === 'MATURE')
  ) {
    const liveProd = state.products.find(
      (p) => p.stage === 'MVP_LIVE' || p.stage === 'MATURE'
    );
    return {
      id: 'SE_CH3_FEEDBACK',
      chapter: 3,
      triggeredDay: state.totalDays,
      relatedProductId: liveProd?.id ?? state.products[0]?.id,
    };
  }

  // Chapter 4a: Overwhelmed Team
  if (
    unlocked.has(4) &&
    !triggered.has('SE_CH4_WORKLOAD') &&
    state.employees.length > 0
  ) {
    const stressed = [...state.employees].sort(
      (a, b) => b.stress - a.stress || a.morale - b.morale
    )[0];
    return {
      id: 'SE_CH4_WORKLOAD',
      chapter: 4,
      triggeredDay: state.totalDays,
      relatedEmployeeId: stressed?.id,
    };
  }

  // Chapter 4b: Expansion Decision (after workload decision)
  if (
    unlocked.has(4) &&
    triggered.has('SE_CH4_WORKLOAD') &&
    !triggered.has('SE_CH4_EXPANSION') &&
    state.totalDays >= 14
  ) {
    return {
      id: 'SE_CH4_EXPANSION',
      chapter: 4,
      triggeredDay: state.totalDays,
    };
  }

  // Chapter 5a: Strategic Investment Opportunity
  if (unlocked.has(5) && !triggered.has('SE_CH5_INVESTMENT')) {
    return {
      id: 'SE_CH5_INVESTMENT',
      chapter: 5,
      triggeredDay: state.totalDays,
    };
  }

  // Chapter 5b: Major Acquisition Offer (only after Investment decision resolved)
  const valuationReady =
    state.finance.valuation >= 160_000 ||
    state.finance.cumulativeRevenue >= 50_000 ||
    state.totalDays >= 26;
  if (
    unlocked.has(5) &&
    triggered.has('SE_CH5_INVESTMENT') &&
    !triggered.has('SE_CH5_ACQUISITION') &&
    valuationReady &&
    state.story.decisions.acquisitionAccepted === null
  ) {
    const offerValuation = Math.max(
      180_000,
      Math.round((state.finance.valuation * 1.35) / 5000) * 5000
    );
    return {
      id: 'SE_CH5_ACQUISITION',
      chapter: 5,
      triggeredDay: state.totalDays,
      offerValuation,
    };
  }

  // Chapter 6: Final Horizon
  if (
    unlocked.has(6) &&
    !triggered.has('SE_CH6_HORIZON') &&
    state.story.decisions.acquisitionAccepted !== true
  ) {
    return {
      id: 'SE_CH6_HORIZON',
      chapter: 6,
      triggeredDay: state.totalDays,
    };
  }

  return null;
}

export function resolveStoryEventChoice(
  state: GameState,
  choiceId: string
): { feedback: string; sound: 'SUCCESS' | 'CLICK' | 'CASH' | 'ERROR'; endingTriggered: boolean } {
  const locale = getLocale();
  const vi = locale === 'vi-VN';
  const evt = state.story.activeStoryEvent;
  if (!evt) {
    return {
      feedback: vi ? 'Không có sự kiện cốt truyện đang mở.' : 'No active story event.',
      sound: 'ERROR',
      endingTriggered: false,
    };
  }

  const template = getStoryEventTemplate(evt.id);
  const choice = template?.choices.find((c) => c.id === choiceId);
  if (!template || !choice) {
    return {
      feedback: vi ? 'Lựa chọn không hợp lệ.' : 'Invalid choice.',
      sound: 'ERROR',
      endingTriggered: false,
    };
  }

  const cost = choice.cost ?? 0;
  if (cost > 0 && state.finance.cash - cost < -state.finance.creditLimit) {
    return {
      feedback: vi
        ? 'Tiền mặt và hạn mức tín dụng không đủ cho lựa chọn này.'
        : 'Insufficient cash and credit for this choice.',
      sound: 'ERROR',
      endingTriggered: false,
    };
  }

  if (cost > 0) {
    state.finance.cash -= cost;
    state.finance.currentMonthDevCosts += cost;
  }

  const d = state.story.decisions;
  const prod =
    state.products.find((p) => p.id === evt.relatedProductId) ?? state.products[0];
  const emp =
    state.employees.find((e) => e.id === evt.relatedEmployeeId) ?? state.employees[0];

  let summaryMsg = '';
  let sound: 'SUCCESS' | 'CLICK' | 'CASH' | 'ERROR' = 'SUCCESS';
  let endingTriggered = false;

  switch (evt.id) {
    case 'SE_CH1_IDENTITY': {
      if (choiceId === 'QUALITY_FIRST') {
        d.companyIdentity = 'QUALITY_FIRST';
        d.cultureScore = clamp(d.cultureScore + 6, 0, 100);
        if (prod) prod.quality = clamp(prod.quality + 6, 0, 100);
        state.founder.reputation = clamp(state.founder.reputation + 4, 0, 100);
      } else if (choiceId === 'FAST_GROWTH') {
        d.companyIdentity = 'FAST_GROWTH';
        d.cultureScore = clamp(d.cultureScore - 4, 0, 100);
        if (prod) prod.developmentProgress = clamp(prod.developmentProgress + 12, 0, 100);
        state.employees.forEach((e) => (e.stress = clamp(e.stress + 6, 0, 100)));
      } else {
        d.companyIdentity = 'PEOPLE_FIRST';
        d.cultureScore = clamp(d.cultureScore + 12, 0, 100);
        state.employees.forEach((e) => {
          e.morale = clamp(e.morale + 10, 0, 100);
          e.stress = clamp(e.stress - 6, 0, 100);
        });
      }
      summaryMsg = t(choice.effectsKey, undefined, locale);
      break;
    }

    case 'SE_CH2_PRODUCT_DIR': {
      if (choiceId === 'DEEP_TECH') {
        d.productDirection = 'DEEP_TECH';
        d.cultureScore = clamp(d.cultureScore + 4, 0, 100);
        if (prod) {
          prod.quality = clamp(prod.quality + 10, 0, 100);
          prod.developmentProgress = clamp(prod.developmentProgress + 10, 0, 100);
        }
      } else {
        d.productDirection = 'USER_FRIENDLY';
        d.cultureScore = clamp(d.cultureScore + 5, 0, 100);
        if (prod) {
          prod.customerSatisfaction = clamp(prod.customerSatisfaction + 8, 0, 100);
          prod.marketDemand = clamp(prod.marketDemand + 8, 0, 100);
          prod.developmentProgress = clamp(prod.developmentProgress + 14, 0, 100);
        }
      }
      summaryMsg = t(choice.effectsKey, undefined, locale);
      break;
    }

    case 'SE_CH3_FEEDBACK': {
      if (choiceId === 'LISTEN_FIX') {
        d.customerResponse = 'LISTEN_FIX';
        d.cultureScore = clamp(d.cultureScore + 8, 0, 100);
        if (prod) {
          prod.quality = clamp(prod.quality + 8, 0, 100);
          prod.customerSatisfaction = clamp(prod.customerSatisfaction + 10, 0, 100);
          prod.bugs = Math.max(0, prod.bugs - 3);
        }
        state.founder.reputation = clamp(state.founder.reputation + 5, 0, 100);
      } else if (choiceId === 'SHIP_FAST') {
        d.customerResponse = 'SHIP_FAST';
        d.cultureScore = clamp(d.cultureScore - 6, 0, 100);
        if (prod) {
          prod.payingCustomers += 8;
          prod.activeUsers += 14;
          prod.bugs += 3;
          prod.customerSatisfaction = clamp(prod.customerSatisfaction - 4, 0, 100);
        }
        state.employees.forEach((e) => (e.morale = clamp(e.morale - 6, 0, 100)));
      } else {
        d.customerResponse = 'MARKETING_PUSH';
        d.cultureScore = clamp(d.cultureScore - 2, 0, 100);
        if (prod) {
          prod.activeUsers += 22;
          prod.payingCustomers += 10;
          prod.marketDemand = clamp(prod.marketDemand + 7, 0, 100);
        }
      }
      summaryMsg = t(choice.effectsKey, undefined, locale);
      break;
    }

    case 'SE_CH4_WORKLOAD': {
      if (choiceId === 'REDUCE_LOAD') {
        d.workloadChoice = 'REDUCE_LOAD';
        d.cultureScore = clamp(d.cultureScore + 12, 0, 100);
        state.employees.forEach((e) => {
          e.morale = clamp(e.morale + 14, 0, 100);
          e.stress = clamp(e.stress - 18, 0, 100);
          e.resignationWarning = false;
        });
      } else if (choiceId === 'HIRE_HELP') {
        d.workloadChoice = 'HIRE_HELP';
        d.cultureScore = clamp(d.cultureScore + 8, 0, 100);
        if (emp) {
          emp.morale = clamp(emp.morale + 12, 0, 100);
          emp.stress = clamp(emp.stress - 15, 0, 100);
        }
        if (state.employees.length < state.office.maxEmployees) {
          const pool = generateCandidatePool(
            state.seed + state.totalDays * 17,
            state.totalDays,
            1,
            3
          );
          const newHire = createEmployeeFromCandidate(
            pool[0],
            state,
            state.employees.length
          );
          state.employees.push(newHire);
          if (!state.hiredRolesHistory.includes(newHire.role)) {
            state.hiredRolesHistory.push(newHire.role);
          }
        }
      } else {
        d.workloadChoice = 'PUSH_THROUGH';
        d.cultureScore = clamp(d.cultureScore - 16, 0, 100);
        state.employees.forEach((e) => {
          e.morale = clamp(e.morale - 18, 5, 100);
          e.stress = clamp(e.stress + 20, 0, 100);
        });
        if (prod) {
          prod.developmentProgress = clamp(prod.developmentProgress + 12, 0, 100);
        }
        state.finance.cash += 2500;
        sound = 'CASH';
      }
      summaryMsg = t(choice.effectsKey, undefined, locale);
      break;
    }

    case 'SE_CH4_EXPANSION': {
      if (choiceId === 'EXPAND_NOW') {
        d.expansionChoice = 'EXPAND_NOW';
        d.cultureScore = clamp(d.cultureScore + 4, 0, 100);
        state.office.maxEmployees += 2;
        state.office.comfortScore = clamp(state.office.comfortScore + 10, 0, 100);
        state.founder.reputation = clamp(state.founder.reputation + 6, 0, 100);
      } else if (choiceId === 'SAVE_RUNWAY') {
        d.expansionChoice = 'SAVE_RUNWAY';
        d.cultureScore = clamp(d.cultureScore + 2, 0, 100);
        state.finance.cash += 1500;
        state.founder.investorTrust = clamp(
          (state.founder.investorTrust ?? 55) + 5,
          0,
          100
        );
      } else {
        d.expansionChoice = 'INVEST_TEAM';
        d.cultureScore = clamp(d.cultureScore + 14, 0, 100);
        state.employees.forEach((e) => {
          e.morale = clamp(e.morale + 14, 0, 100);
          e.stress = clamp(e.stress - 10, 0, 100);
        });
      }
      summaryMsg = t(choice.effectsKey, undefined, locale);
      break;
    }

    case 'SE_CH5_INVESTMENT': {
      if (choiceId === 'ACCEPT') {
        d.investmentChoice = 'ACCEPT';
        state.finance.cash += 45000;
        state.finance.equityDilutionPct = clamp(
          state.finance.equityDilutionPct + 12,
          0,
          85
        );
        state.founder.investorTrust = clamp(
          (state.founder.investorTrust ?? 55) + 8,
          0,
          100
        );
        sound = 'CASH';
      } else if (choiceId === 'NEGOTIATE') {
        d.investmentChoice = 'NEGOTIATE';
        d.cultureScore = clamp(d.cultureScore + 4, 0, 100);
        state.finance.cash += 35000;
        state.finance.equityDilutionPct = clamp(
          state.finance.equityDilutionPct + 7,
          0,
          85
        );
        state.founder.reputation = clamp(state.founder.reputation + 6, 0, 100);
        sound = 'CASH';
      } else {
        d.investmentChoice = 'DECLINE';
        d.cultureScore = clamp(d.cultureScore + 10, 0, 100);
        state.founder.reputation = clamp(state.founder.reputation + 8, 0, 100);
        state.employees.forEach((e) => (e.morale = clamp(e.morale + 6, 0, 100)));
      }
      summaryMsg = t(choice.effectsKey, undefined, locale);
      break;
    }

    case 'SE_CH5_ACQUISITION': {
      d.acquisitionOfferReceived = true;
      if (choiceId === 'ACCEPT_ACQUISITION') {
        d.acquisitionAccepted = true;
        const payout = evt.offerValuation ?? Math.max(180_000, state.finance.valuation);
        state.finance.cash += Math.round(payout * 0.4);
        state.story.activeStoryEvent = null;
        if (!state.story.completedStoryEvents.includes(evt.id)) {
          state.story.completedStoryEvents.push(evt.id);
        }
        state.story.choiceHistory.push({
          eventId: evt.id,
          chapter: evt.chapter,
          choiceId,
          day: state.totalDays,
        });
        const evaluated = evaluateEnding(state);
        state.story.evaluatedEnding = evaluated;
        state.story.activeCinematic = getEndingCinematicId(evaluated.endingId);
        state.victoryAchieved = true;
        recordUnlockedEnding(state, evaluated);
        return {
          feedback: t('story.events.ch5Acquisition.c1Effects', {
            amount: formatCurrency(payout, false, locale),
          }, locale),
          sound: 'CASH',
          endingTriggered: true,
        };
      } else {
        d.acquisitionAccepted = false;
        d.cultureScore = clamp(d.cultureScore + 10, 0, 100);
        state.founder.reputation = clamp(state.founder.reputation + 10, 0, 100);
        state.employees.forEach((e) => (e.morale = clamp(e.morale + 10, 0, 100)));
        summaryMsg = t(choice.effectsKey, undefined, locale);
      }
      break;
    }

    case 'SE_CH6_HORIZON': {
      if (choiceId === 'INNOVATE_CULTURE') {
        d.finalVision = 'INNOVATE_CULTURE';
        d.cultureScore = clamp(d.cultureScore + 12, 0, 100);
        state.employees.forEach((e) => (e.morale = clamp(e.morale + 10, 0, 100)));
        state.founder.reputation = clamp(state.founder.reputation + 6, 0, 100);
      } else {
        d.finalVision = 'SCALE_MARKET';
        state.finance.cash += 15000;
        if (prod) prod.payingCustomers += 18;
        state.founder.reputation = clamp(state.founder.reputation + 6, 0, 100);
        sound = 'CASH';
      }
      summaryMsg = t(choice.effectsKey, undefined, locale);
      break;
    }
  }

  state.story.activeStoryEvent = null;
  if (!state.story.completedStoryEvents.includes(evt.id)) {
    state.story.completedStoryEvents.push(evt.id);
  }
  state.story.choiceHistory.push({
    eventId: evt.id,
    chapter: evt.chapter,
    choiceId,
    day: state.totalDays,
  });

  state.notifications.unshift({
    id: `story_${evt.id}_${state.totalDays}`,
    day: state.totalDays,
    message: `${t(template.titleKey, undefined, locale)} — ${summaryMsg}`,
    type: 'INFO',
  });
  state.notifications = state.notifications.slice(0, 24);

  return { feedback: summaryMsg, sound, endingTriggered };
}
