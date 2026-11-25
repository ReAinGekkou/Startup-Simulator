import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Award,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cloud,
  CloudRain,
  Coffee,
  Compass,
  FastForward,
  Landmark,
  Laptop,
  LayoutGrid,
  LocateFixed,
  MapPin,
  Mic,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings,
  SkipForward,
  Sparkles,
  Store,
  Sun,
  Target,
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
import {
  Achievement,
  GameCommand,
  GameState,
  SimulationSpeed,
  WorldLocationId,
} from '@/src/types/game';
import { ManagementMenu } from './ManagementMenu';
import { ObjectivesChecklist } from './ObjectivesChecklist';
import type { CameraActionHandle } from './OfficeCanvas';
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
    | 'FOCUS_FOUNDER'
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
  speedShortcutPulseId?: number;
  movingMode: boolean;
  hasDrawerOpen: boolean;
  selectedLocationId?: WorldLocationId | null;
  selectedRoomId?: string | null;
  followFounder?: boolean;
  cameraActionRef?: React.MutableRefObject<CameraActionHandle | null>;
  onSelectDistrict?: (locationId: WorldLocationId) => void;
  onCycleWeather?: () => void;
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

const DISTRICT_ITEMS: Array<{
  id: WorldLocationId;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'COMPANY_HQ', Icon: Building2 },
  { id: 'MAIN_STREET', Icon: MapPin },
  { id: 'COFFEE_SHOP', Icon: Coffee },
  { id: 'COWORKING_SPACE', Icon: Laptop },
  { id: 'INVESTOR_CENTER', Icon: Landmark },
  { id: 'EVENT_HALL', Icon: Mic },
  { id: 'BUSINESS_PROPERTIES', Icon: Store },
];

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
  speedShortcutPulseId = 0,
  movingMode,
  hasDrawerOpen,
  selectedLocationId = null,
  selectedRoomId = null,
  followFounder = false,
  cameraActionRef,
  onSelectDistrict,
  onCycleWeather,
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const mapPopoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeModal) {
      setAlertsOpen(false);
      setObjectivesOpen(false);
      setMenuOpen(false);
      setMapOpen(false);
    }
  }, [activeModal]);

  useEffect(() => {
    if (hasDrawerOpen) {
      setAlertsOpen(false);
      setObjectivesOpen(false);
      setMenuOpen(false);
      setMapOpen(false);
    }
  }, [hasDrawerOpen]);

  useEffect(() => {
    if (!mapOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-city-map-trigger="true"]')) return;
      if (mapPopoverRef.current && !mapPopoverRef.current.contains(target)) {
        setMapOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setMapOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mapOpen]);

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

  const handleTaskQuickAction = () => {
    setMenuOpen(false);
    setMapOpen(false);
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

  const activeWeather = state.weather?.current ?? 'SUNNY';
  const WeatherIcon =
    activeWeather === 'RAINY'
      ? CloudRain
      : activeWeather === 'OVERCAST'
        ? Cloud
        : Sun;
  const weatherStateName = t(`weather.states.${activeWeather}`);
  const weatherTooltip = t('weather.cycleTooltip', { state: weatherStateName });

  const hideGuidanceOverlays = Boolean(
    activeModal ||
      state.story?.activeCinematic ||
      state.story?.activeStoryEvent ||
      state.activeEvent ||
      state.pendingMonthlyReport ||
      state.pendingDailyReport
  );

  return (
    <div className="fixed inset-0 pointer-events-none flex flex-col justify-between z-10 p-2 sm:p-3 text-[#303B38]">
      {/* LAYER B — TOP MINIMAL HUD (Top-Left, Top-Center, Top-Right) */}
      <header className="flex flex-wrap md:grid md:grid-cols-[1fr_auto_1fr] items-start justify-between gap-2 shrink-0">
        {/* TOP-LEFT: Company Name + Day & Month + Weather */}
        <div className="pointer-events-auto justify-self-start flex items-stretch gap-1.5 min-w-0 max-w-full">
          <div className="bg-[#F3F0E7]/94 border-2 border-[#303B38] px-3 py-1.5 shadow-[2px_2px_0px_rgba(48,59,56,0.18)] min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[14px] sm:text-[15px] font-bold text-[#303B38] truncate max-w-[140px] sm:max-w-[190px] leading-tight">
                {state.config.companyName}
              </span>
              {statusSymbol === 'WARNING' && (
                <AlertTriangle
                  className="w-3.5 h-3.5 text-[#D68B7B] shrink-0"
                  aria-label={t('hud.status.WARNING')}
                />
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[12px] sm:text-[13px] text-[#303B38]/85 font-mono-num whitespace-nowrap leading-tight mt-0.5">
              <CalendarDays className="w-3.5 h-3.5 text-[#D9A66C] shrink-0 hidden sm:inline" aria-hidden="true" />
              <span>
                {t('hud.dayMonthTime', {
                  day: state.day,
                  month: state.month,
                  time: formatHour(state.hourOfDay),
                })}
              </span>
            </div>
          </div>

          {onCycleWeather && (
            <button
              type="button"
              onClick={onCycleWeather}
              aria-label={weatherTooltip}
              title={weatherTooltip}
              className="min-h-[42px] min-w-[42px] px-2.5 flex items-center justify-center gap-1.5 bg-[#F3F0E7]/94 hover:bg-[#EAE5D8] border-2 border-[#303B38] shadow-[2px_2px_0px_rgba(48,59,56,0.18)] text-[12px] font-bold text-[#303B38] cursor-pointer transition-colors shrink-0"
            >
              <WeatherIcon className="w-4 h-4 text-[#78978A] shrink-0" aria-hidden="true" />
              <span className="hidden lg:inline whitespace-nowrap">{weatherStateName}</span>
            </button>
          )}
        </div>

        {/* TOP-CENTER: Current Cash Balance */}
        <div className="pointer-events-auto justify-self-center">
          <button
            type="button"
            onClick={() => {
              onDispatch({ type: 'REPORT_TUTORIAL_ACTION', action: 'REVIEW_FINANCE' });
              onOpenModal(activeModal === 'FINANCE' ? null : 'FINANCE');
            }}
            title={t('tooltips.cashBalance')}
            className={`min-h-[44px] px-3.5 py-1 border-2 border-[#303B38] shadow-[2px_2px_0px_rgba(48,59,56,0.18)] cursor-pointer transition-colors flex flex-col items-center justify-center ${
              isLowCash
                ? 'bg-[#F5E0DB]/96 hover:bg-[#EDD0C9]'
                : 'bg-[#FAF8F2]/95 hover:bg-[#EAE5D8]'
            }`}
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#303B38]/70 leading-none">
              {t('hud.cashBalance')}
            </span>
            <span className="text-[16px] sm:text-[18px] font-bold font-mono-num text-[#303B38] leading-tight mt-0.5 whitespace-nowrap">
              {formatCurrency(state.finance.cash)}
            </span>
          </button>
        </div>

        {/* TOP-RIGHT: Pause / Simulation Speed + Notifications + End Day */}
        <div className="pointer-events-auto justify-self-end w-full sm:w-auto flex items-center justify-end gap-1.5">
          <div
            className="flex items-center bg-[#F3F0E7]/94 border-2 border-[#303B38] shadow-[2px_2px_0px_rgba(48,59,56,0.18)] p-0.5"
            role="group"
            aria-label={t('hud.speedAria')}
          >
            <button
              type="button"
              onClick={() => onSetSpeed(0)}
              aria-label={t('hud.pauseTitle')}
              title={t('hud.pauseTitle')}
              aria-pressed={state.speed === 0}
              className={`relative min-w-[36px] min-h-[36px] flex items-center justify-center px-1.5 text-[13px] font-bold cursor-pointer transition-colors ${
                state.speed === 0
                  ? 'bg-[#78978A] text-[#303B38]'
                  : 'text-[#303B38] hover:bg-[#EAE5D8]'
              }`}
            >
              {(shortcutFeedback?.speedTarget === 0 || (speedShortcutPulseId > 0 && state.speed === 0)) && (
                <span
                  key={`pulse-0-${shortcutFeedback?.id ?? speedShortcutPulseId}`}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 border-2 border-[#303B38] animate-speed-pulse"
                />
              )}
              <Pause className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onSetSpeed(1)}
              aria-label={t('hud.speed1Title')}
              title={t('hud.speed1Title')}
              aria-pressed={state.speed === 1}
              className={`relative min-w-[38px] min-h-[36px] flex items-center justify-center px-1.5 text-[13px] font-mono-num font-bold cursor-pointer transition-colors ${
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
              <Play className="w-3 h-3 mr-0.5 inline" aria-hidden="true" />
              1x
            </button>
            <button
              type="button"
              onClick={() => onSetSpeed(2)}
              aria-label={t('hud.speed2Title')}
              title={t('hud.speed2Title')}
              aria-pressed={state.speed === 2}
              className={`relative min-w-[36px] min-h-[36px] flex items-center justify-center px-1.5 text-[13px] font-mono-num font-bold cursor-pointer transition-colors ${
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
            <button
              type="button"
              onClick={() => onSetSpeed(3)}
              aria-label={t('hud.speed3Title')}
              title={t('hud.speed3Title')}
              aria-pressed={state.speed === 3}
              className={`relative min-w-[38px] min-h-[36px] flex items-center justify-center px-1.5 text-[13px] font-mono-num font-bold cursor-pointer transition-colors ${
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
              <FastForward className="w-3 h-3 mr-0.5 inline" aria-hidden="true" />
              3x
            </button>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setAlertsOpen((v) => !v);
                setObjectivesOpen(false);
                setMenuOpen(false);
                setMapOpen(false);
              }}
              aria-expanded={alertsOpen}
              aria-label={t('hud.notificationsBtn')}
              title={t('hud.notificationsBtn')}
              className={`min-h-[42px] min-w-[42px] flex items-center justify-center gap-1.5 px-2.5 border-2 border-[#303B38] shadow-[2px_2px_0px_rgba(48,59,56,0.18)] text-[13px] font-bold cursor-pointer transition-colors ${
                alertsOpen
                  ? 'bg-[#D9A66C] text-[#303B38]'
                  : 'bg-[#F3F0E7]/94 hover:bg-[#EAE5D8] text-[#303B38]'
              }`}
            >
              <Bell className="w-4 h-4 shrink-0" aria-hidden="true" />
              {recentFeed.length > 0 && (
                <span className="px-1.5 py-0.5 text-[11px] leading-none font-mono-num bg-[#EAE5D8] border border-[#303B38]/30">
                  {recentFeed.length}
                </span>
              )}
            </button>

            {alertsOpen && (
              <div
                role="region"
                aria-label={t('hud.notificationsTitle')}
                className="absolute right-0 mt-1.5 w-72 sm:w-80 bg-[#F3F0E7] border-2 border-[#303B38] shadow-[4px_4px_0px_rgba(48,59,56,0.22)] z-40"
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

          <button
            type="button"
            data-tutorial-target="end-day-btn"
            onClick={onEndDay}
            title={t('hud.endDayTitle')}
            className={`min-h-[42px] flex items-center gap-1.5 px-3 border-2 border-[#303B38] shadow-[2px_2px_0px_rgba(48,59,56,0.18)] text-[13px] font-bold cursor-pointer whitespace-nowrap transition-colors ${
              tutorialMeta?.targetArea === 'END_DAY'
                ? 'bg-[#D9A66C] ring-2 ring-[#D9A66C] text-[#303B38]'
                : 'bg-[#FAF8F2]/95 hover:bg-[#EAE5D8] text-[#303B38]'
            }`}
          >
            <SkipForward className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{t('hud.endDay')}</span>
          </button>
        </div>
      </header>

      {/* MIDDLE UNOBSTRUCTED CANVAS ZONE — TRANSIENT BANNERS & TUTORIAL CARD ONLY */}
      <div className="flex-1 min-h-0 relative py-2 flex flex-col justify-between pointer-events-none">
        <div className="flex flex-col gap-2">
          {welcomeBannerOpen && !hideGuidanceOverlays && (
            <div className="w-full flex justify-center shrink-0">
              <div
                role="status"
                aria-live="polite"
                className="pointer-events-auto bg-[#FAF8F2]/96 border-2 border-[#303B38] text-[#303B38] pl-3 pr-2 py-2 flex items-center gap-2.5 shadow-[3px_3px_0px_rgba(48,59,56,0.18)] max-w-md"
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
                  className="min-w-[32px] min-h-[32px] flex items-center justify-center text-[#303B38]/75 hover:bg-[#EAE5D8] cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-start justify-between gap-2">
            {/* Single Non-Stacking Notification / Placement Slot */}
            <div className="flex flex-col items-start gap-2 min-w-0">
              {movingMode && (
                <div className="pointer-events-auto bg-[#F3F0E7] border-2 border-[#303B38] text-[#303B38] text-[14px] px-3.5 py-2 flex items-center gap-3 shadow-[3px_3px_0px_rgba(48,59,56,0.18)]">
                  <span>{t('hud.placementMode')}</span>
                  <button
                    type="button"
                    onClick={onCancelMoving}
                    className="min-h-[36px] bg-[#78978A] border border-[#303B38] text-[#303B38] px-3 py-1 text-[13px] font-bold cursor-pointer"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              )}

              {achievementToast && localizedAchievement ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="pointer-events-auto bg-[#F3F0E7]/96 border-2 border-[#303B38] px-3.5 py-2 flex items-center gap-3 max-w-sm shadow-[3px_3px_0px_rgba(48,59,56,0.18)]"
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
                    className={`pointer-events-auto bg-[#F3F0E7]/96 border-2 text-[#303B38] pl-3 pr-2 py-2 flex items-start gap-2.5 shadow-[3px_3px_0px_rgba(48,59,56,0.18)] max-w-xs sm:max-w-sm ${
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

            {/* Active Tutorial Guide (only when active and no drawer/modal obscures it) */}
            {!hideGuidanceOverlays && tutorialActive && !hasDrawerOpen && (
              <div className="ml-auto flex flex-col items-end gap-1.5 max-w-full">
                <TutorialGuide state={state} onDispatch={onDispatch} onNavigate={onOpenModal} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* LAYER B — BOTTOM MINIMAL HUD (Bottom-Left Objective + Bottom-Right Controls & Layer D Menu) */}
      <footer className="flex items-end justify-between gap-2 shrink-0">
        {/* BOTTOM-LEFT: Current Objective & Progress */}
        <div className="pointer-events-auto relative min-w-0 max-w-[min(22rem,calc(100vw-11.5rem))] sm:max-w-[23rem]">
          {objectivesOpen && !tutorialActive && objs.length > 0 && (
            <div className="absolute left-0 bottom-full mb-2 z-30">
              <ObjectivesChecklist objectives={state.objectives} hiddenOnSmall={false} />
            </div>
          )}

          <div className="bg-[#F3F0E7]/94 border-2 border-[#303B38] shadow-[2px_2px_0px_rgba(48,59,56,0.18)] px-3 py-2 flex items-center gap-2.5 min-w-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[11px] font-bold font-mono-num bg-[#D9A66C]/35 border border-[#303B38]/30 px-1.5 py-0.5 text-[#303B38] shrink-0">
                  {taskGuide.progressLabel}
                </span>
                <span className="text-[13px] sm:text-[14px] font-bold text-[#303B38] truncate">
                  {taskGuide.objectiveTitle}
                </span>
              </div>
              <p className="hidden sm:block text-[12px] text-[#303B38]/80 truncate mt-0.5">
                {taskGuide.actionText}
              </p>
            </div>

            {!tutorialActive && objs.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setObjectivesOpen((v) => !v);
                  setAlertsOpen(false);
                  setMenuOpen(false);
                  setMapOpen(false);
                }}
                aria-expanded={objectivesOpen}
                aria-label={t('hud.checklistBtn')}
                title={t('hud.checklistBtn')}
                className={`min-h-[36px] min-w-[36px] px-2 flex items-center justify-center gap-1 border text-[12px] font-bold cursor-pointer shrink-0 ${
                  objectivesOpen
                    ? 'bg-[#78978A] border-[#303B38]'
                    : 'bg-[#FAF8F2] hover:bg-[#EAE5D8] border-[#303B38]/30'
                }`}
              >
                <Target className="w-3.5 h-3.5 text-[#303B38]" aria-hidden="true" />
                {objectivesOpen ? (
                  <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* BOTTOM-RIGHT: Contextual Action + Camera/City + Management Menu (Layer D) */}
        <div className="pointer-events-auto relative flex flex-col items-end gap-2 shrink-0">
          {menuOpen && (
            <div className="absolute right-0 bottom-full mb-2 z-30">
              <ManagementMenu
                open={menuOpen}
                state={state}
                activeModal={activeModal}
                tutorialActive={tutorialActive}
                recommendedTab={
                  tutorialMeta?.recommendedTab && tutorialMeta.recommendedTab !== 'OFFICE'
                    ? tutorialMeta.recommendedTab
                    : null
                }
                tutorialStep={tutorialActive ? state.tutorial.currentStep : null}
                onClose={() => setMenuOpen(false)}
                onOpenModal={onOpenModal}
                onDispatch={onDispatch}
              />
            </div>
          )}

          {mapOpen && (
            <div
              ref={mapPopoverRef}
              role="dialog"
              aria-label={t('world.districtBarLabel')}
              className="absolute right-0 bottom-full mb-2 z-30 w-[min(17.5rem,calc(100vw-24px))] bg-[#F3F0E7] border-2 border-[#303B38] shadow-[4px_4px_0px_rgba(48,59,56,0.22)] text-[#303B38]"
            >
              <div className="px-3 py-2 bg-[#FAF8F2] border-b border-[#303B38]/20 flex items-center justify-between gap-2">
                <span className="text-[13px] font-bold text-[#303B38]">
                  {t('hud.mapTitle')}
                </span>
                <button
                  type="button"
                  onClick={() => setMapOpen(false)}
                  aria-label={t('common.close')}
                  className="min-w-[30px] min-h-[30px] flex items-center justify-center hover:bg-[#EAE5D8] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-2 space-y-1 max-h-[52dvh] overflow-y-auto">
                {DISTRICT_ITEMS.map(({ id, Icon }) => {
                  const isActive =
                    selectedLocationId === id ||
                    (id === 'COMPANY_HQ' && Boolean(selectedRoomId) && !selectedLocationId);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        cameraActionRef?.current?.focusLocation(id);
                        onSelectDistrict?.(id);
                        setMapOpen(false);
                      }}
                      className={`w-full min-h-[40px] px-3 py-1.5 flex items-center gap-2.5 border text-[13px] font-bold text-left cursor-pointer transition-colors ${
                        isActive
                          ? 'bg-[#78978A] border-[#303B38] text-[#303B38]'
                          : 'bg-[#FAF8F2] hover:bg-[#EAE5D8] border-[#303B38]/20 text-[#303B38]'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{t(`world.locations.${id}.name`)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            {/* Contextual Action Prompt */}
            {!hasDrawerOpen && !activeModal && (
              <button
                type="button"
                onClick={handleTaskQuickAction}
                className="hidden md:flex min-h-[42px] items-center gap-1.5 px-3 bg-[#78978A] hover:bg-[#6A897C] border-2 border-[#303B38] shadow-[2px_2px_0px_rgba(48,59,56,0.18)] text-[13px] font-bold text-[#303B38] cursor-pointer whitespace-nowrap"
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
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}

            {/* Camera Mini-Controls */}
            <div
              role="toolbar"
              aria-label={t('camera.toolbarLabel')}
              className="hidden sm:flex items-center gap-1 bg-[#F3F0E7]/94 border-2 border-[#303B38] shadow-[2px_2px_0px_rgba(48,59,56,0.18)] p-0.5"
            >
              <button
                type="button"
                onClick={() => {
                  const next = !followFounder;
                  cameraActionRef?.current?.setFollowFounder(next);
                  if (next) cameraActionRef?.current?.focusFounder();
                }}
                aria-pressed={followFounder}
                aria-label={t('camera.followFounder')}
                title={t('camera.followFounder')}
                className={`min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer transition-colors ${
                  followFounder
                    ? 'bg-[#78978A] text-[#303B38]'
                    : 'hover:bg-[#EAE5D8] text-[#303B38]'
                }`}
              >
                <LocateFixed className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => cameraActionRef?.current?.zoomIn()}
                aria-label={t('camera.zoomIn')}
                title={t('camera.zoomIn')}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center hover:bg-[#EAE5D8] text-[#303B38] cursor-pointer"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => cameraActionRef?.current?.zoomOut()}
                aria-label={t('camera.zoomOut')}
                title={t('camera.zoomOut')}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center hover:bg-[#EAE5D8] text-[#303B38] cursor-pointer"
              >
                <Minus className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => cameraActionRef?.current?.resetView()}
                aria-label={t('camera.resetView')}
                title={t('camera.resetView')}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center hover:bg-[#EAE5D8] text-[#303B38] cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* City Districts Map Trigger */}
            <button
              type="button"
              data-city-map-trigger="true"
              onClick={() => {
                setMapOpen((v) => !v);
                setMenuOpen(false);
                setAlertsOpen(false);
                setObjectivesOpen(false);
              }}
              aria-expanded={mapOpen}
              aria-label={t('hud.mapBtn')}
              title={t('world.districtBarLabel')}
              className={`min-h-[42px] min-w-[42px] px-2.5 flex items-center justify-center gap-1.5 border-2 border-[#303B38] shadow-[2px_2px_0px_rgba(48,59,56,0.18)] text-[13px] font-bold cursor-pointer transition-colors ${
                mapOpen
                  ? 'bg-[#78978A] text-[#303B38]'
                  : 'bg-[#F3F0E7]/94 hover:bg-[#EAE5D8] text-[#303B38]'
              }`}
            >
              <Compass className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">{t('hud.mapBtn')}</span>
            </button>

            {/* Layer D Expandable Management Menu Trigger */}
            <button
              type="button"
              data-tutorial-target="management-menu-btn"
              data-management-menu-trigger="true"
              onClick={() => {
                setMenuOpen((v) => !v);
                setMapOpen(false);
                setAlertsOpen(false);
                setObjectivesOpen(false);
              }}
              aria-expanded={menuOpen}
              className={`min-h-[42px] px-3 flex items-center justify-center gap-2 border-2 border-[#303B38] shadow-[2px_2px_0px_rgba(48,59,56,0.18)] text-[13px] font-bold cursor-pointer transition-colors ${
                menuOpen
                  ? 'bg-[#D9A66C] text-[#303B38]'
                  : 'bg-[#FAF8F2]/95 hover:bg-[#EAE5D8] text-[#303B38]'
              }`}
            >
              <LayoutGrid className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{t('hud.menuBtn')}</span>
            </button>
          </div>
        </div>
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
