import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Award,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coffee,
  FastForward,
  Landmark,
  Package,
  Pause,
  Play,
  Save,
  Settings,
  SkipForward,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { estimateMonthlyBurn } from '@/src/game/systems/financeSystem';
import { getTutorialStepMeta } from '@/src/game/systems/tutorialSystem';
import { QueuedNotification } from '@/src/hooks/useGameEngine';
import { useLocalization } from '@/src/hooks/useLocalization';
import {
  getAchievementLocalized,
  getObjectiveLocalized,
  getTutorialStepLocalized,
} from '@/src/localization/i18n';
import { Achievement, GameCommand, GameState, SimulationSpeed } from '@/src/types/game';
import { ObjectivesChecklist } from './ObjectivesChecklist';
import { Tooltip } from './Tooltip';
import { TutorialGuide } from './TutorialGuide';

export type ActiveModal =
  | null
  | 'EMPLOYEES'
  | 'PRODUCTS'
  | 'MARKET'
  | 'FINANCE'
  | 'OFFICE'
  | 'MILESTONES'
  | 'SAVE_LOAD'
  | 'SETTINGS';

export interface ShortcutFeedback {
  id: number;
  keyLabel: string;
  actionKey:
    | 'PAUSE'
    | 'RESUME'
    | 'SPEED_1'
    | 'SPEED_2'
    | 'SPEED_3'
    | 'MOVE_UP'
    | 'MOVE_DOWN'
    | 'MOVE_LEFT'
    | 'MOVE_RIGHT'
    | 'CANCEL_PLACEMENT'
    | 'CLOSE_PANEL'
    | 'OPEN_SETTINGS'
    | 'MUTE_AUDIO'
    | 'UNMUTE_AUDIO';
  speedTarget?: SimulationSpeed;
}

interface GameHUDProps {
  state: GameState;
  activeModal: ActiveModal;
  toast: string | null;
  toastSubtext?: string | null;
  toastTone?: 'DEFAULT' | 'MORALE';
  toastAction?: { label: string; command: GameCommand } | null;
  achievementToast: Achievement | null;
  notificationHistory?: QueuedNotification[];
  welcomeBannerOpen?: boolean;
  onDismissWelcomeBanner?: () => void;
  shortcutFeedback?: ShortcutFeedback | null;
  movingMode: boolean;
  hasDrawerOpen: boolean;
  onCancelMoving: () => void;
  onDismissAchievementToast: () => void;
  onDismissNotification?: () => void;
  onFocusTutorialTarget?: () => void;
  onOpenAchievements: () => void;
  onSetSpeed: (speed: SimulationSpeed) => void;
  onEndDay: () => void;
  onOpenModal: (modal: ActiveModal) => void;
  onDispatch: (cmd: GameCommand) => void;
}

function getCompanyStatusSymbol(
  state: GameState
): 'WARNING' | 'PROFIT' | 'GROWING' | 'BOOTSTRAPPING' {
  if (state.finance.cash < 5000) return 'WARNING';
  const burn = estimateMonthlyBurn(state);
  const totalCustomers = state.products.reduce((s, p) => s + p.payingCustomers, 0);
  if (burn.netMonthly > 0 && state.finance.cumulativeRevenue > 0) return 'PROFIT';
  if (
    totalCustomers > 0 ||
    state.products.some((p) => p.stage === 'MVP_LIVE' || p.stage === 'MATURE')
  ) {
    return 'GROWING';
  }
  return 'BOOTSTRAPPING';
}

export const GameHUD: React.FC<GameHUDProps> = ({
  state,
  activeModal,
  toast,
  toastSubtext,
  toastTone = 'DEFAULT',
  toastAction = null,
  achievementToast,
  notificationHistory = [],
  welcomeBannerOpen = false,
  onDismissWelcomeBanner,
  shortcutFeedback,
  movingMode,
  hasDrawerOpen,
  onCancelMoving,
  onDismissAchievementToast,
  onDismissNotification,
  onFocusTutorialTarget,
  onOpenAchievements,
  onSetSpeed,
  onEndDay,
  onOpenModal,
  onDispatch,
}) => {
  const { locale, t, formatCurrency, formatHour } = useLocalization();
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [objectivesOpen, setObjectivesOpen] = useState(false);

  useEffect(() => {
    if (activeModal || hasDrawerOpen) {
      setAlertsOpen(false);
      setObjectivesOpen(false);
    }
  }, [activeModal, hasDrawerOpen]);

  const statusSymbol = getCompanyStatusSymbol(state);
  const isLowCash = statusSymbol === 'WARNING';

  const tutorialActive =
    Boolean(state.tutorial?.active) &&
    !state.tutorial?.completed &&
    !state.tutorial?.skipped;
  const tutorialMeta = tutorialActive ? getTutorialStepMeta(state.tutorial.currentStep) : null;

  const objs = state.objectives ?? [];
  const doneCount = objs.filter((o) => o.completed).length;

  const taskGuide: {
    objectiveTitle: string;
    actionText: string;
    targetModal:
      | 'FIND_EMPLOYEE'
      | 'OFFICE'
      | 'EMPLOYEES'
      | 'PRODUCTS'
      | 'FINANCE'
      | 'MARKET'
      | 'END_DAY';
    progressLabel: string;
  } = (() => {
    if (tutorialActive && tutorialMeta) {
      const tutLoc = getTutorialStepLocalized(state.tutorial.currentStep, locale);
      return {
        objectiveTitle: tutLoc.title,
        actionText: tutLoc.actionPrompt,
        targetModal:
          state.tutorial.currentStep === 1
            ? 'FIND_EMPLOYEE'
            : tutorialMeta.targetArea === 'END_DAY'
              ? 'END_DAY'
              : tutorialMeta.recommendedTab,
        progressLabel: t('tutorial.progressLabel', { step: state.tutorial.currentStep }),
      };
    }

    const nextObj = objs.find((o) => !o.completed);
    if (nextObj) {
      const objLoc = getObjectiveLocalized(nextObj.id, nextObj.label, locale);
      const modalMap: Record<typeof nextObj.id, 'EMPLOYEES' | 'PRODUCTS' | 'MARKET' | 'FINANCE'> = {
        obj_review_employees: 'EMPLOYEES',
        obj_create_product: 'PRODUCTS',
        obj_assign_tasks: 'EMPLOYEES',
        obj_launch_mvp: 'PRODUCTS',
        obj_acquire_customer: 'MARKET',
        obj_first_revenue: 'FINANCE',
      };
      return {
        objectiveTitle: t('objectives.objectivePrefix', { title: objLoc.label }),
        actionText: objLoc.actionText,
        targetModal: modalMap[nextObj.id],
        progressLabel: t('objectives.progressRatio', { done: doneCount, total: objs.length }),
      };
    }

    if (state.finance.cash < 5000) {
      return {
        objectiveTitle: t('objectives.stabilizeTitle'),
        actionText: t('objectives.stabilizeAction'),
        targetModal: 'FINANCE',
        progressLabel: t('objectives.progressRatio', { done: doneCount, total: objs.length }),
      };
    }

    return {
      objectiveTitle: t('objectives.scaleTitle'),
      actionText: t('objectives.scaleAction'),
      targetModal: 'MARKET',
      progressLabel: t('objectives.progressRatio', { done: doneCount, total: objs.length }),
    };
  })();

  const primaryNav: Array<{
    id: 'OFFICE_VIEW' | 'EMPLOYEES' | 'PRODUCTS' | 'FINANCE' | 'MARKET';
    label: string;
    tooltipKey: string;
    icon: React.ComponentType<{ className?: string }>;
    modal: ActiveModal;
    badge?: string;
  }> = [
    {
      id: 'OFFICE_VIEW',
      label: t('hud.nav.office'),
      tooltipKey: 'tooltips.navOffice',
      icon: Building2,
      modal: null,
    },
    {
      id: 'EMPLOYEES',
      label: t('hud.nav.employees'),
      tooltipKey: 'tooltips.navEmployees',
      icon: Users,
      modal: 'EMPLOYEES',
      badge: `${state.employees.length}`,
    },
    {
      id: 'PRODUCTS',
      label: t('hud.nav.products'),
      tooltipKey: 'tooltips.navProducts',
      icon: Package,
      modal: 'PRODUCTS',
      badge: `${state.products.length}`,
    },
    {
      id: 'FINANCE',
      label: t('hud.nav.finance'),
      tooltipKey: 'tooltips.navFinance',
      icon: Landmark,
      modal: 'FINANCE',
    },
    {
      id: 'MARKET',
      label: t('hud.nav.market'),
      tooltipKey: 'tooltips.navMarket',
      icon: TrendingUp,
      modal: 'MARKET',
    },
  ];

  const handleNavClick = (item: (typeof primaryNav)[number]) => {
    if (item.id === 'OFFICE_VIEW') {
      onOpenModal(null);
      return;
    }
    const opening = activeModal !== item.modal;
    onOpenModal(opening ? item.modal : null);
    if (opening && item.id === 'FINANCE') {
      onDispatch({ type: 'REPORT_TUTORIAL_ACTION', action: 'REVIEW_FINANCE' });
    }
  };

  const handleTaskQuickAction = () => {
    if (taskGuide.targetModal === 'END_DAY') {
      onEndDay();
    } else if (taskGuide.targetModal === 'FIND_EMPLOYEE') {
      onOpenModal(null);
      onFocusTutorialTarget?.();
    } else if (taskGuide.targetModal === 'OFFICE') {
      onOpenModal(null);
      onFocusTutorialTarget?.();
    } else {
      if (taskGuide.targetModal === 'FINANCE') {
        onDispatch({ type: 'REPORT_TUTORIAL_ACTION', action: 'REVIEW_FINANCE' });
      }
      onOpenModal(taskGuide.targetModal);
    }
  };

  const localizedAchievement = achievementToast
    ? getAchievementLocalized(
        achievementToast.id,
        achievementToast.title,
        achievementToast.description,
        locale
      )
    : null;

  const recentFeed =
    notificationHistory.length > 0
      ? notificationHistory.slice(0, 8).map((n) => ({
          id: n.id,
          day: n.day,
          text:
            n.kind === 'ACHIEVEMENT' && n.achievement
              ? `${t('hud.achievementUnlocked')}: ${
                  getAchievementLocalized(
                    n.achievement.id,
                    n.achievement.title,
                    n.achievement.description,
                    locale
                  ).title
                }`
              : n.message,
          isHighlight: n.kind === 'ACHIEVEMENT',
        }))
      : (state.notifications ?? []).slice(0, 8).map((n) => ({
          id: n.id,
          day: n.day,
          text: n.message,
          isHighlight: n.type === 'WARNING',
        }));

  const handleDismissBanner = () => {
    if (onDismissNotification) {
      onDismissNotification();
    } else {
      onDismissAchievementToast();
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none flex flex-col z-10 text-[#303B38]">
      {/* TOP BAR */}
      <header className="pointer-events-auto bg-[#F3F0E7] border-b-2 border-[#303B38]/25 px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        {/* Left: Money + Day + Employees + Company Status */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 min-w-0">
          <div className="min-w-0 hidden lg:block">
            <div className="text-[17px] font-bold text-[#303B38] truncate max-w-[180px] leading-tight">
              {state.config.companyName}
            </div>
            <div className="text-[13px] text-[#303B38]/80 font-mono-num whitespace-nowrap">
              {t('hud.dayMonthTime', {
                day: state.day,
                month: state.month,
                time: formatHour(state.hourOfDay),
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 lg:pl-4 lg:border-l border-[#303B38]/20">
            <Tooltip hintKey="tooltips.cashBalance" placement="bottom">
              <button
                type="button"
                onClick={() => onOpenModal(activeModal === 'FINANCE' ? null : 'FINANCE')}
                className={`text-left px-2.5 py-1 border cursor-pointer transition-colors ${
                  isLowCash
                    ? 'bg-[#D68B7B]/20 border-[#D68B7B] hover:bg-[#D68B7B]/30'
                    : 'bg-[#FAF8F2] border-[#303B38]/20 hover:bg-[#EAE5D8]'
                }`}
              >
                <div className="text-[13px] text-[#303B38]/80 leading-none">
                  {t('hud.cashBalance')}
                </div>
                <div className="text-[17px] sm:text-[19px] font-bold font-mono-num text-[#303B38] leading-tight mt-0.5 whitespace-nowrap">
                  {formatCurrency(state.finance.cash)}
                </div>
              </button>
            </Tooltip>

            <div className="lg:hidden flex items-center gap-1.5 bg-[#FAF8F2] border border-[#303B38]/20 px-2.5 py-1.5 min-h-[40px] text-[13px] font-bold font-mono-num whitespace-nowrap">
              <CalendarDays className="w-4 h-4 text-[#D9A66C] shrink-0" aria-hidden="true" />
              <span>{t('hud.dayShort', { day: state.day })}</span>
              <span className="hidden sm:inline text-[#303B38]/70">· {formatHour(state.hourOfDay)}</span>
            </div>

            <Tooltip hintKey="tooltips.navEmployees" placement="bottom" wrapperClassName="hidden sm:inline-flex">
              <button
                type="button"
                onClick={() => onOpenModal(activeModal === 'EMPLOYEES' ? null : 'EMPLOYEES')}
                className="flex items-center gap-1.5 bg-[#FAF8F2] hover:bg-[#EAE5D8] border border-[#303B38]/20 px-2.5 py-1.5 min-h-[40px] text-[13px] font-bold text-[#303B38] cursor-pointer whitespace-nowrap"
              >
                <Users className="w-4 h-4 text-[#78978A] shrink-0" aria-hidden="true" />
                <span className="font-mono-num">
                  {t('hud.employeesCount', { count: state.employees.length })}
                </span>
              </button>
            </Tooltip>

            <Tooltip hintKey="tooltips.companyStatus" placement="bottom" wrapperClassName="hidden xl:inline-flex">
              <div
                tabIndex={0}
                className={`flex items-center gap-1.5 border px-2.5 py-1.5 min-h-[40px] cursor-help ${
                  isLowCash
                    ? 'bg-[#D68B7B]/20 border-[#D68B7B]'
                    : statusSymbol === 'PROFIT'
                      ? 'bg-[#78978A]/20 border-[#78978A]'
                      : 'bg-[#EAE5D8] border-[#303B38]/25'
                }`}
              >
                {statusSymbol === 'WARNING' ? (
                  <AlertTriangle className="w-4 h-4 text-[#303B38]" aria-hidden="true" />
                ) : statusSymbol === 'PROFIT' ? (
                  <CheckCircle2 className="w-4 h-4 text-[#303B38]" aria-hidden="true" />
                ) : (
                  <Sparkles className="w-4 h-4 text-[#303B38]" aria-hidden="true" />
                )}
                <span className="text-[13px] font-bold text-[#303B38] whitespace-nowrap">
                  {t(`hud.status.${statusSymbol}`)}
                </span>
              </div>
            </Tooltip>
          </div>
        </div>

        {/* Right: Notification Bell, Speed & End Day */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setAlertsOpen((v) => !v);
                setObjectivesOpen(false);
              }}
              aria-expanded={alertsOpen}
              aria-label={t('hud.notificationsBtn')}
              className={`min-h-[40px] min-w-[40px] flex items-center gap-1.5 px-2.5 py-1.5 border text-[13px] font-bold cursor-pointer transition-colors ${
                alertsOpen
                  ? 'bg-[#D9A66C] border-[#303B38] text-[#303B38]'
                  : 'bg-[#FAF8F2] hover:bg-[#EAE5D8] border-[#303B38]/30 text-[#303B38]'
              }`}
            >
              <Bell className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="hidden md:inline">{t('hud.notificationsBtn')}</span>
              {recentFeed.length > 0 && (
                <span className="px-1.5 py-0.5 text-[12px] leading-none font-mono-num bg-[#EAE5D8] border border-[#303B38]/25">
                  {recentFeed.length}
                </span>
              )}
            </button>

            {alertsOpen && (
              <div
                role="region"
                aria-label={t('hud.notificationsTitle')}
                className="absolute right-0 mt-1.5 w-72 sm:w-80 bg-[#F3F0E7] border-2 border-[#303B38] shadow-md z-40"
              >
                <div className="px-3 py-2 bg-[#FAF8F2] border-b border-[#303B38]/20 flex items-center justify-between gap-2">
                  <span className="text-[14px] font-bold text-[#303B38]">
                    {t('hud.notificationsTitle')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAlertsOpen(false)}
                    aria-label={t('hud.dismiss')}
                    className="min-w-[30px] min-h-[30px] flex items-center justify-center hover:bg-[#EAE5D8] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {recentFeed.length === 0 ? (
                  <p className="p-3.5 text-[13px] text-[#303B38]/75">{t('hud.noNotifications')}</p>
                ) : (
                  <ul className="max-h-60 overflow-y-auto divide-y divide-[#303B38]/15">
                    {recentFeed.map((item) => (
                      <li
                        key={item.id}
                        className={`px-3 py-2 text-[13px] leading-snug ${
                          item.isHighlight ? 'bg-[#D9A66C]/15 font-bold' : ''
                        }`}
                      >
                        <div className="text-[#303B38]">{item.text}</div>
                        <div className="text-[12px] text-[#303B38]/65 font-mono-num mt-0.5">
                          {t('hud.dayShort', { day: item.day })}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div
            className="flex items-center bg-[#FAF8F2] border border-[#303B38]/30 p-0.5"
            role="group"
            aria-label={t('hud.speedAria')}
          >
            <Tooltip hintKey="tooltips.speedPause" placement="bottom">
              <button
                type="button"
                onClick={() => onSetSpeed(0)}
                aria-label={t('hud.pauseTitle')}
                aria-pressed={state.speed === 0}
                className={`relative min-w-[38px] min-h-[38px] flex items-center justify-center px-2 text-[14px] font-bold cursor-pointer transition-colors ${
                  state.speed === 0
                    ? 'bg-[#78978A] text-[#303B38]'
                    : 'text-[#303B38] hover:bg-[#EAE5D8]'
                }`}
              >
                {shortcutFeedback?.speedTarget === 0 && (
                  <span
                    key={`pulse-0-${shortcutFeedback.id}`}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 border-2 border-[#303B38] animate-speed-pulse"
                  />
                )}
                <Pause className="w-4 h-4" aria-hidden="true" />
              </button>
            </Tooltip>
            <Tooltip hintKey="tooltips.speed1x" placement="bottom">
              <button
                type="button"
                onClick={() => onSetSpeed(1)}
                aria-label={t('hud.speed1Title')}
                aria-pressed={state.speed === 1}
                className={`relative min-w-[40px] min-h-[38px] flex items-center justify-center px-2 text-[14px] font-mono-num font-bold cursor-pointer transition-colors ${
                  state.speed === 1
                    ? 'bg-[#78978A] text-[#303B38]'
                    : 'text-[#303B38] hover:bg-[#EAE5D8]'
                }`}
              >
                {shortcutFeedback?.speedTarget === 1 && (
                  <span
                    key={`pulse-1-${shortcutFeedback.id}`}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 border-2 border-[#303B38] animate-speed-pulse"
                  />
                )}
                <Play className="w-3.5 h-3.5 mr-0.5 inline" aria-hidden="true" />
                1x
              </button>
            </Tooltip>
            <Tooltip hintKey="tooltips.speed2x" placement="bottom">
              <button
                type="button"
                onClick={() => onSetSpeed(2)}
                aria-label={t('hud.speed2Title')}
                aria-pressed={state.speed === 2}
                className={`relative min-w-[38px] min-h-[38px] flex items-center justify-center px-2 text-[14px] font-mono-num font-bold cursor-pointer transition-colors ${
                  state.speed === 2
                    ? 'bg-[#78978A] text-[#303B38]'
                    : 'text-[#303B38] hover:bg-[#EAE5D8]'
                }`}
              >
                {shortcutFeedback?.speedTarget === 2 && (
                  <span
                    key={`pulse-2-${shortcutFeedback.id}`}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 border-2 border-[#303B38] animate-speed-pulse"
                  />
                )}
                2x
              </button>
            </Tooltip>
            <Tooltip hintKey="tooltips.speed3x" placement="bottom">
              <button
                type="button"
                onClick={() => onSetSpeed(3)}
                aria-label={t('hud.speed3Title')}
                aria-pressed={state.speed === 3}
                className={`relative min-w-[40px] min-h-[38px] flex items-center justify-center px-2 text-[14px] font-mono-num font-bold cursor-pointer transition-colors ${
                  state.speed === 3
                    ? 'bg-[#78978A] text-[#303B38]'
                    : 'text-[#303B38] hover:bg-[#EAE5D8]'
                }`}
              >
                {shortcutFeedback?.speedTarget === 3 && (
                  <span
                    key={`pulse-3-${shortcutFeedback.id}`}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 border-2 border-[#303B38] animate-speed-pulse"
                  />
                )}
                <FastForward className="w-3.5 h-3.5 mr-0.5 inline" aria-hidden="true" />
                3x
              </button>
            </Tooltip>
          </div>

          <Tooltip hintKey="tooltips.endDay" placement="bottom">
            <button
              type="button"
              data-tutorial-target="end-day-btn"
              onClick={onEndDay}
              className={`min-h-[40px] flex items-center gap-1.5 px-3 py-1.5 text-[14px] font-bold cursor-pointer whitespace-nowrap transition-colors border ${
                tutorialMeta?.targetArea === 'END_DAY'
                  ? 'bg-[#D9A66C] border-[#303B38] ring-2 ring-[#303B38] text-[#303B38]'
                  : 'bg-[#FAF8F2] hover:bg-[#EAE5D8] border-[#303B38]/35 text-[#303B38]'
              }`}
            >
              <SkipForward className="w-4 h-4" aria-hidden="true" />
              <span>{t('hud.endDay')}</span>
            </button>
          </Tooltip>
        </div>
      </header>

      {/* MIDDLE ROW */}
      <div className="flex-1 flex min-h-0 relative">
        {/* LEFT NAVIGATION */}
        <nav
          aria-label={t('hud.nav.office')}
          className="hidden md:flex pointer-events-auto w-44 lg:w-48 bg-[#F3F0E7]/96 border-r-2 border-[#303B38]/20 flex-col justify-between p-2.5 shrink-0"
        >
          <div className="space-y-1.5">
            {primaryNav.map((item) => {
              const Icon = item.icon;
              const isSelected =
                item.id === 'OFFICE_VIEW'
                  ? activeModal === null
                  : activeModal === item.modal;
              const isTutorialTarget =
                (tutorialMeta?.recommendedTab === 'EMPLOYEES' && item.id === 'EMPLOYEES') ||
                (tutorialMeta?.recommendedTab === 'PRODUCTS' && item.id === 'PRODUCTS') ||
                (tutorialMeta?.recommendedTab === 'MARKET' && item.id === 'MARKET') ||
                (tutorialMeta?.recommendedTab === 'FINANCE' && item.id === 'FINANCE');

              return (
                <Tooltip
                  key={item.id}
                  hintKey={item.tooltipKey}
                  placement="right"
                  wrapperClassName="block w-full"
                >
                  <button
                    type="button"
                    data-tutorial-target={`nav-${item.id.toLowerCase()}`}
                    onClick={() => handleNavClick(item)}
                    className={`w-full min-h-[42px] flex items-center justify-between gap-2 px-3 py-2 text-[14px] font-bold cursor-pointer transition-colors border ${
                      isSelected
                        ? 'bg-[#78978A] border-[#303B38] text-[#303B38]'
                        : isTutorialTarget
                          ? 'bg-[#FAF8F2] border-2 border-[#D9A66C] text-[#303B38]'
                          : 'bg-[#FAF8F2] hover:bg-[#EAE5D8] border-[#303B38]/20 text-[#303B38]'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.badge && (
                      <span className="text-[13px] font-mono-num font-bold px-1.5 py-0.5 bg-[#F3F0E7] border border-[#303B38]/25 text-[#303B38]">
                        {item.badge}
                      </span>
                    )}
                  </button>
                </Tooltip>
              );
            })}
          </div>

          <div className="pt-2.5 border-t border-[#303B38]/20 space-y-1">
            <Tooltip hintKey="tooltips.navUpgrades" placement="right" wrapperClassName="block w-full">
              <button
                type="button"
                onClick={() => onOpenModal(activeModal === 'OFFICE' ? null : 'OFFICE')}
                className={`w-full min-h-[38px] flex items-center gap-2 px-2.5 py-1.5 text-[13px] font-bold cursor-pointer border text-left ${
                  activeModal === 'OFFICE'
                    ? 'bg-[#78978A] border-[#303B38]/40 text-[#303B38]'
                    : 'bg-transparent hover:bg-[#EAE5D8] border-transparent text-[#303B38]'
                }`}
              >
                <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{t('hud.nav.upgrades')}</span>
              </button>
            </Tooltip>
            <Tooltip hintKey="tooltips.navMilestones" placement="right" wrapperClassName="block w-full">
              <button
                type="button"
                onClick={() => onOpenModal(activeModal === 'MILESTONES' ? null : 'MILESTONES')}
                className={`w-full min-h-[38px] flex items-center gap-2 px-2.5 py-1.5 text-[13px] font-bold cursor-pointer border text-left ${
                  activeModal === 'MILESTONES'
                    ? 'bg-[#78978A] border-[#303B38]/40 text-[#303B38]'
                    : 'bg-transparent hover:bg-[#EAE5D8] border-transparent text-[#303B38]'
                }`}
              >
                <Trophy className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{t('hud.nav.milestones')}</span>
              </button>
            </Tooltip>
            <Tooltip hintKey="tooltips.navSaveLoad" placement="right" wrapperClassName="block w-full">
              <button
                type="button"
                onClick={() => onOpenModal(activeModal === 'SAVE_LOAD' ? null : 'SAVE_LOAD')}
                className={`w-full min-h-[38px] flex items-center gap-2 px-2.5 py-1.5 text-[13px] font-bold cursor-pointer border text-left ${
                  activeModal === 'SAVE_LOAD'
                    ? 'bg-[#78978A] border-[#303B38]/40 text-[#303B38]'
                    : 'bg-transparent hover:bg-[#EAE5D8] border-transparent text-[#303B38]'
                }`}
              >
                <Save className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{t('hud.nav.saveLoad')}</span>
              </button>
            </Tooltip>
            {!tutorialActive && (
              <Tooltip hintKey="tooltips.navTutorial" placement="right" wrapperClassName="block w-full">
                <button
                  type="button"
                  onClick={() => onDispatch({ type: 'RESUME_TUTORIAL' })}
                  className="w-full min-h-[38px] flex items-center gap-2 px-2.5 py-1.5 text-[13px] font-bold cursor-pointer hover:bg-[#EAE5D8] text-[#303B38] text-left"
                >
                  <BookOpen className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{t('hud.nav.tutorial')}</span>
                </button>
              </Tooltip>
            )}
            <Tooltip hintKey="tooltips.navSettings" placement="right" wrapperClassName="block w-full">
              <button
                type="button"
                onClick={() => onOpenModal(activeModal === 'SETTINGS' ? null : 'SETTINGS')}
                className={`w-full min-h-[38px] flex items-center gap-2 px-2.5 py-1.5 text-[13px] font-bold cursor-pointer border text-left ${
                  activeModal === 'SETTINGS'
                    ? 'bg-[#78978A] border-[#303B38]/40 text-[#303B38]'
                    : 'bg-transparent hover:bg-[#EAE5D8] border-transparent text-[#303B38]'
                }`}
              >
                <Settings className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{t('hud.nav.settings')}</span>
              </button>
            </Tooltip>
          </div>
        </nav>

        {/* CENTER OVERLAYS */}
        <div className="flex-1 relative min-w-0 p-3 flex flex-col justify-between gap-2">
          <div className="flex flex-col gap-2">
            {welcomeBannerOpen &&
              !activeModal &&
              !state.story?.activeCinematic &&
              !state.story?.activeStoryEvent && (
              <div className="w-full flex justify-center pointer-events-none shrink-0">
                <div
                  role="status"
                  aria-live="polite"
                  className="pointer-events-auto bg-[#FAF8F2]/96 border-2 border-[#303B38] text-[#303B38] pl-3 pr-2 py-2 flex items-center gap-2.5 shadow-sm max-w-lg"
                >
                  <div className="w-8 h-8 bg-[#78978A]/35 border border-[#303B38]/30 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-[#303B38]" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-bold leading-snug">
                      {t('hud.welcomeBanner.title')}
                    </div>
                    <div className="text-[13px] text-[#303B38]/80 leading-snug">
                      {t('hud.welcomeBanner.subtitle')}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onDismissWelcomeBanner}
                    aria-label={t('hud.dismiss')}
                    title={t('hud.dismiss')}
                    className="min-w-[32px] min-h-[32px] flex items-center justify-center text-[#303B38]/75 hover:bg-[#EAE5D8] cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-start justify-between gap-2 sm:gap-3">
              {/* Single Non-Stacking Notification / Placement Slot */}
              <div className="flex flex-col items-start gap-2 pt-1 min-w-0">
              {movingMode && (
                <div className="pointer-events-auto bg-[#F3F0E7] border-2 border-[#303B38] text-[#303B38] text-[14px] px-4 py-2 flex items-center gap-3 shadow-sm">
                  <span>{t('hud.placementMode')}</span>
                  <button
                    type="button"
                    onClick={onCancelMoving}
                    className="min-h-[36px] bg-[#78978A] border border-[#303B38]/35 text-[#303B38] px-3 py-1 text-[13px] font-bold cursor-pointer"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              )}

              {achievementToast && localizedAchievement ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="pointer-events-auto bg-[#F3F0E7] border-2 border-[#303B38] px-3.5 py-2 flex items-center gap-3 max-w-sm shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onDismissAchievementToast();
                      onOpenAchievements();
                    }}
                    className="flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer"
                  >
                    <div className="w-8 h-8 bg-[#D9A66C]/45 border border-[#303B38]/35 flex items-center justify-center shrink-0">
                      <Award className="w-4 h-4 text-[#303B38]" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-bold text-[#303B38]">
                        {t('hud.achievementUnlocked')}
                      </div>
                      <div className="text-[14px] font-bold text-[#303B38] truncate">
                        {localizedAchievement.title}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={onDismissAchievementToast}
                    aria-label={t('hud.dismiss')}
                    className="min-w-[34px] min-h-[34px] flex items-center justify-center text-[#303B38] hover:bg-[#EAE5D8] cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                toast && (
                  <div
                    role="status"
                    aria-live="polite"
                    className={`pointer-events-auto bg-[#F3F0E7]/96 border-2 text-[#303B38] pl-3 pr-2 py-2 flex items-start gap-2.5 shadow-sm max-w-xs sm:max-w-sm ${
                      toastTone === 'MORALE' ? 'border-[#D9A66C]' : 'border-[#303B38]'
                    }`}
                  >
                    {toastTone === 'MORALE' && (
                      <div className="w-7 h-7 bg-[#D9A66C]/35 border border-[#303B38]/30 flex items-center justify-center shrink-0 mt-0.5">
                        <Coffee className="w-4 h-4 text-[#303B38]" aria-hidden="true" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-bold leading-snug">{toast}</div>
                      {toastSubtext && (
                        <div className="text-[13px] text-[#303B38]/80 leading-snug mt-0.5">
                          {toastSubtext}
                        </div>
                      )}
                      {toastAction && (
                        <button
                          type="button"
                          onClick={() => {
                            onDispatch(toastAction.command);
                            handleDismissBanner();
                          }}
                          className="mt-2 inline-flex items-center gap-1.5 min-h-[32px] px-2.5 py-1 bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38] text-[12px] font-bold text-[#303B38] cursor-pointer"
                        >
                          <Coffee className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>{toastAction.label}</span>
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleDismissBanner}
                      aria-label={t('hud.dismiss')}
                      className="min-w-[30px] min-h-[30px] flex items-center justify-center text-[#303B38]/75 hover:bg-[#EAE5D8] cursor-pointer shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              )}
              </div>

              {/* Top-Right Guidance Slot: single active TutorialGuide OR compact Objectives chip */}
              {!activeModal &&
                !state.story?.activeCinematic &&
                !state.story?.activeStoryEvent &&
                !state.activeEvent &&
                !state.pendingMonthlyReport &&
                !state.pendingDailyReport &&
                tutorialActive &&
                !hasDrawerOpen ? (
                <div className="ml-auto flex flex-col items-end gap-1.5 max-w-full">
                  <TutorialGuide state={state} onDispatch={onDispatch} onNavigate={onOpenModal} />
                </div>
              ) : (
                !activeModal &&
                !state.story?.activeCinematic &&
                !state.story?.activeStoryEvent &&
                !hasDrawerOpen &&
                !tutorialActive &&
                objs.length > 0 && (
                  <div className="ml-auto flex flex-col items-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setObjectivesOpen((v) => !v);
                        setAlertsOpen(false);
                      }}
                      aria-expanded={objectivesOpen}
                      className="pointer-events-auto min-h-[38px] bg-[#F3F0E7]/95 hover:bg-[#EAE5D8] border border-[#303B38]/35 px-3 py-1.5 flex items-center gap-2 text-[13px] font-bold text-[#303B38] shadow-sm cursor-pointer"
                    >
                      <Target className="w-4 h-4 text-[#D9A66C] shrink-0" aria-hidden="true" />
                      <span>{t('hud.objectiveChip')}</span>
                      <span className="font-mono-num px-1.5 py-0.5 bg-[#EAE5D8] border border-[#303B38]/20">
                        {doneCount}/{objs.length}
                      </span>
                      {objectivesOpen ? (
                        <ChevronUp className="w-4 h-4 shrink-0" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="w-4 h-4 shrink-0" aria-hidden="true" />
                      )}
                    </button>

                    {objectivesOpen && (
                      <ObjectivesChecklist objectives={state.objectives} hiddenOnSmall={false} />
                    )}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE NAVIGATION STRIP */}
      <nav
        aria-label={t('hud.nav.office')}
        className="md:hidden pointer-events-auto bg-[#F3F0E7] border-t border-[#303B38]/25 px-2 py-1.5 flex items-center gap-1.5 overflow-x-auto shrink-0"
      >
        {primaryNav.map((item) => {
          const Icon = item.icon;
          const isSelected =
            item.id === 'OFFICE_VIEW'
              ? activeModal === null
              : activeModal === item.modal;
          return (
            <button
              key={item.id}
              type="button"
              data-tutorial-target={`nav-${item.id.toLowerCase()}`}
              onClick={() => handleNavClick(item)}
              className={`min-h-[42px] flex items-center gap-1.5 px-3 py-1.5 text-[14px] font-bold whitespace-nowrap shrink-0 border cursor-pointer ${
                isSelected
                  ? 'bg-[#78978A] border-[#303B38]/40 text-[#303B38]'
                  : 'bg-[#FAF8F2] border-[#303B38]/25 text-[#303B38]'
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onOpenModal(activeModal === 'OFFICE' ? null : 'OFFICE')}
          className="min-h-[42px] flex items-center gap-1.5 px-3 py-1.5 text-[14px] font-bold whitespace-nowrap shrink-0 bg-[#FAF8F2] border border-[#303B38]/25 text-[#303B38] cursor-pointer"
        >
          <Sparkles className="w-4 h-4" aria-hidden="true" />
          <span>{t('hud.nav.upgradesShort')}</span>
        </button>
        <button
          type="button"
          onClick={() => onOpenModal(activeModal === 'SETTINGS' ? null : 'SETTINGS')}
          aria-label={t('hud.nav.settings')}
          className="min-h-[42px] min-w-[42px] flex items-center justify-center px-3 py-1.5 bg-[#FAF8F2] border border-[#303B38]/25 text-[#303B38] shrink-0 cursor-pointer"
        >
          <Settings className="w-4 h-4" aria-hidden="true" />
        </button>
      </nav>

      {/* BOTTOM TASK PANEL */}
      <footer className="pointer-events-auto bg-[#FAF8F2] border-t-2 border-[#303B38]/25 px-3 sm:px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
        <div className="min-w-0 flex-1 flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-bold bg-[#D9A66C]/35 border border-[#303B38]/25 px-2 py-0.5 text-[#303B38] shrink-0">
            {taskGuide.progressLabel}
          </span>
          <span className="text-[14px] font-bold text-[#303B38] truncate">
            {taskGuide.objectiveTitle}
          </span>
          {!tutorialActive && (
            <span className="hidden md:inline text-[14px] text-[#303B38]/85 truncate">
              — {taskGuide.actionText}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleTaskQuickAction}
          className="min-h-[40px] flex items-center justify-center gap-2 px-3.5 py-1.5 bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38]/40 text-[14px] font-bold text-[#303B38] cursor-pointer whitespace-nowrap shrink-0"
        >
          <span>
            {taskGuide.targetModal === 'END_DAY'
              ? t('hud.quickAction.endDay', { day: state.day })
              : taskGuide.targetModal === 'FIND_EMPLOYEE'
                ? t('hud.quickAction.findEmployee')
                : taskGuide.targetModal === 'OFFICE'
                  ? t('hud.quickAction.exploreOffice')
                  : t(`hud.quickAction.goTo${taskGuide.targetModal}`)}
          </span>
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </footer>

      {/* KEYBOARD SHORTCUT VISUAL CONFIRMATION */}
      {shortcutFeedback && (
        <div
          key={shortcutFeedback.id}
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed left-1/2 -translate-x-1/2 top-[4.5rem] z-40 animate-shortcut-pop"
        >
          <div className="bg-[#F3F0E7] border-2 border-[#303B38] px-3.5 py-2 flex items-center gap-2.5 shadow-sm">
            <kbd className="inline-flex items-center justify-center min-w-[30px] px-2.5 py-0.5 bg-[#78978A] border border-[#303B38] border-b-2 text-[14px] font-bold text-[#303B38] leading-tight">
              {shortcutFeedback.keyLabel}
            </kbd>
            <span className="flex items-center gap-1.5 text-[14px] font-bold text-[#303B38] whitespace-nowrap">
              {shortcutFeedback.actionKey === 'PAUSE' && (
                <Pause className="w-4 h-4 shrink-0" aria-hidden="true" />
              )}
              {(shortcutFeedback.actionKey === 'RESUME' ||
                shortcutFeedback.actionKey === 'SPEED_1') && (
                <Play className="w-4 h-4 shrink-0" aria-hidden="true" />
              )}
              {(shortcutFeedback.actionKey === 'SPEED_2' ||
                shortcutFeedback.actionKey === 'SPEED_3') && (
                <FastForward className="w-4 h-4 shrink-0" aria-hidden="true" />
              )}
              {shortcutFeedback.actionKey === 'MOVE_UP' && (
                <ArrowUp className="w-4 h-4 shrink-0" aria-hidden="true" />
              )}
              {shortcutFeedback.actionKey === 'MOVE_DOWN' && (
                <ArrowDown className="w-4 h-4 shrink-0" aria-hidden="true" />
              )}
              {shortcutFeedback.actionKey === 'MOVE_LEFT' && (
                <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
              )}
              {shortcutFeedback.actionKey === 'MOVE_RIGHT' && (
                <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              )}
              {(shortcutFeedback.actionKey === 'CANCEL_PLACEMENT' ||
                shortcutFeedback.actionKey === 'CLOSE_PANEL') && (
                <X className="w-4 h-4 shrink-0" aria-hidden="true" />
              )}
              {shortcutFeedback.actionKey === 'OPEN_SETTINGS' && (
                <Settings className="w-4 h-4 shrink-0" aria-hidden="true" />
              )}
              {shortcutFeedback.actionKey === 'MUTE_AUDIO' && (
                <VolumeX className="w-4 h-4 shrink-0" aria-hidden="true" />
              )}
              {shortcutFeedback.actionKey === 'UNMUTE_AUDIO' && (
                <Volume2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              )}
              <span>{t(`shortcutFeedback.${shortcutFeedback.actionKey}`)}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
