import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audioManager, BgmScene } from '@/src/audio/audioManager';
import {
  getDailyReportVoiceScript,
  getMonthlyReportVoiceScript,
  getTutorialVoiceScript,
} from '@/src/audio/voiceRegistry';
import { EmployeeChatterFeed } from '@/src/components/EmployeeChatterFeed';
import { ActiveModal, GameHUD, ShortcutFeedback } from '@/src/components/GameHUD';
import { CameraActionHandle, OfficeCanvas } from '@/src/components/OfficeCanvas';
import { RoomActionDrawer } from '@/src/components/RoomActionDrawer';
import { WorldActionDrawer } from '@/src/components/WorldActionDrawer';
import { TutorialManager } from '@/src/components/tutorial/TutorialManager';
import { SubtitlePanel } from '@/src/components/SubtitlePanel';
import { TitleScreen } from '@/src/components/TitleScreen';
import { DailyReportModal } from '@/src/components/modals/DailyReportModal';
import { EmployeePanel } from '@/src/components/modals/EmployeePanel';
import { EventModal } from '@/src/components/modals/EventModal';
import { FinancePanel } from '@/src/components/modals/FinancePanel';
import { MarketPanel } from '@/src/components/modals/MarketPanel';
import { MilestonesPanel, MilestonesTab } from '@/src/components/modals/MilestonesPanel';
import { ModalFrame } from '@/src/components/modals/ModalFrame';
import { MonthlyReportModal } from '@/src/components/modals/MonthlyReportModal';
import { OfficeUpgradePanel } from '@/src/components/modals/OfficeUpgradePanel';
import { ProductPanel } from '@/src/components/modals/ProductPanel';
import { SaveLoadModal } from '@/src/components/modals/SaveLoadModal';
import { SettingsModal } from '@/src/components/modals/SettingsModal';
import { CelebrationParticlesOverlay } from '@/src/components/story/CelebrationParticlesOverlay';
import { CinematicPlayer } from '@/src/components/story/CinematicPlayer';
import { EndingGalleryModal } from '@/src/components/story/EndingGalleryModal';
import { StoryManager } from '@/src/components/story/StoryManager';
import {
  createCelebrationBurstCoordinator,
  isCelebratoryCinematic,
} from '@/src/game/systems/celebrationParticles';
import { WORLD_LOCATIONS } from '@/src/game/data/cityWorld';
import { DEFAULT_NEW_GAME_PARAMS } from '@/src/game/engine/initGame';
import { getIsoMovementVector } from '@/src/game/engine/isoMath';
import {
  buildWalkabilityGrid,
  findAdjacentWalkableTile,
  findRoomAtTile,
} from '@/src/game/engine/pathfinding';
import { getRenderableFurniture } from '@/src/game/renderer/pixelRenderer';
import { useGameEngine } from '@/src/hooks/useGameEngine';
import { useLocalization } from '@/src/hooks/useLocalization';
import { useVoiceOver } from '@/src/hooks/useVoiceOver';
import { soundService } from '@/src/services/soundService';
import {
  getAchievementLocalized,
  getEventLocalized,
  getLocalizedGameOverReason,
  getObjectiveLocalized,
} from '@/src/localization';
import { GridPoint, RoomId, SimulationSpeed, WorldLocationId } from '@/src/types/game';

export default function App() {
  const {
    gameState,
    stateRef,
    toast,
    toastSubtext,
    toastTone,
    toastAction,
    achievementToast,
    notificationHistory,
    welcomeBannerOpen,
    dismissWelcomeBanner,
    dismissAchievementToast,
    dismissCurrentNotification,
    muted,
    hasSave,
    latestSaveMeta,
    dispatch,
    startNewGame,
    saveToSlot,
    loadFromSlot,
    continueMostRecentGame,
    removeSaveSlot,
    resetToTitle,
    toggleMute,
    toggleMasterMute,
  } = useGameEngine();

  const { locale, t, formatCurrency } = useLocalization();
  const { speak } = useVoiceOver();

  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [milestonesTab, setMilestonesTab] = useState<MilestonesTab>('MILESTONES');
  const [showTitleSaveModal, setShowTitleSaveModal] = useState(false);
  const [showEndingGallery, setShowEndingGallery] = useState(false);
  const [showTitleIntro, setShowTitleIntro] = useState(false);
  const [confirmEndModalNewGame, setConfirmEndModalNewGame] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<RoomId | null>(null);
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<WorldLocationId | null>(null);
  const [selectedWorldNpcId, setSelectedWorldNpcId] = useState<string | null>(null);
  const [followFounder, setFollowFounder] = useState(false);
  const [movingFurnitureId, setMovingFurnitureId] = useState<string | null>(null);
  const [placingTemplateId, setPlacingTemplateId] = useState<string | null>(null);
  const heldNavKeysRef = useRef({ up: false, down: false, left: false, right: false });
  const [shortcutFeedback, setShortcutFeedback] = useState<ShortcutFeedback | null>(null);
  const [speedShortcutPulseId, setSpeedShortcutPulseId] = useState(0);
  const shortcutTimerRef = useRef<number | null>(null);
  const shortcutSeqRef = useRef(0);

  const triggerShortcutFeedback = useCallback(
    (
      keyLabel: string,
      actionKey: ShortcutFeedback['actionKey'],
      speedTarget?: SimulationSpeed
    ) => {
      shortcutSeqRef.current += 1;
      setShortcutFeedback({
        id: shortcutSeqRef.current,
        keyLabel,
        actionKey,
        speedTarget,
      });
      if (speedTarget !== undefined) {
        setSpeedShortcutPulseId((prev) => prev + 1);
      }
      if (shortcutTimerRef.current !== null) {
        window.clearTimeout(shortcutTimerRef.current);
      }
      shortcutTimerRef.current = window.setTimeout(() => {
        setShortcutFeedback(null);
        shortcutTimerRef.current = null;
      }, 1000);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (shortcutTimerRef.current !== null) {
        window.clearTimeout(shortcutTimerRef.current);
      }
    };
  }, []);

  const cameraActionRef = useRef<CameraActionHandle | null>(null);
  const [particleBurstKey, setParticleBurstKey] = useState<string | null>(null);
  const burstCoordinatorRef = useRef(createCelebrationBurstCoordinator());
  const runIdentityRef = useRef<string>('');
  const knownUnlockedMsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (gameState.screen === 'TITLE_MENU') {
      runIdentityRef.current = '';
      knownUnlockedMsRef.current.clear();
      burstCoordinatorRef.current.reset();
      soundService.resetMilestoneChimeHistory();
      setParticleBurstKey(null);
      return;
    }

    const runId = `${gameState.seed}:${gameState.config.companyName}`;
    const currentUnlockedIds = new Set(
      gameState.milestones.filter((m) => m.unlocked).map((m) => m.id)
    );
    const loadedEarlierSnapshot = Array.from(knownUnlockedMsRef.current).some(
      (id) => !currentUnlockedIds.has(id)
    );

    if (runIdentityRef.current !== runId || loadedEarlierSnapshot) {
      runIdentityRef.current = runId;
      burstCoordinatorRef.current.reset();
      soundService.resetMilestoneChimeHistory();
      knownUnlockedMsRef.current = currentUnlockedIds;
    }

    const newlyUnlocked = gameState.milestones.find(
      (m) => m.unlocked && !knownUnlockedMsRef.current.has(m.id)
    );
    for (const id of currentUnlockedIds) {
      knownUnlockedMsRef.current.add(id);
    }

    const activeCin = gameState.story?.activeCinematic ?? null;
    const candidateKey = isCelebratoryCinematic(activeCin)
      ? `cinematic:${activeCin}`
      : gameState.activeCelebration
        ? `cel:${gameState.activeCelebration.id}`
        : newlyUnlocked
          ? `ms:${newlyUnlocked.id}:${newlyUnlocked.unlockedDay ?? gameState.totalDays}`
          : null;

    if (
      candidateKey &&
      burstCoordinatorRef.current.shouldTriggerBurst(candidateKey, performance.now(), 1500)
    ) {
      setParticleBurstKey(candidateKey);
      soundService.playMilestoneChime(candidateKey);
    }
  }, [
    gameState.screen,
    gameState.seed,
    gameState.config.companyName,
    gameState.totalDays,
    gameState.story?.activeCinematic,
    gameState.activeCelebration,
    gameState.milestones,
  ]);

  // Cozy BGM lifecycle & automatic scene switching (MENU / OFFICE / EVENT)
  const targetBgmScene = useMemo<BgmScene | null>(() => {
    if (gameState.screen === 'TITLE_MENU') return 'MENU';
    if (gameState.story?.activeCinematic === 'INTRO') return 'MENU';
    if (gameState.story?.activeCinematic || gameState.story?.activeStoryEvent) {
      return 'EVENT';
    }
    if (gameState.screen === 'VICTORY') return 'EVENT';
    if (gameState.screen === 'GAME_OVER') return null;
    if (
      gameState.activeEvent ||
      gameState.pendingMonthlyReport ||
      gameState.pendingDailyReport
    ) {
      return 'EVENT';
    }
    return 'OFFICE';
  }, [
    gameState.screen,
    gameState.activeEvent,
    gameState.pendingMonthlyReport,
    gameState.pendingDailyReport,
    gameState.story?.activeCinematic,
    gameState.story?.activeStoryEvent,
  ]);

  useEffect(() => {
    if (targetBgmScene) {
      audioManager.setScene(targetBgmScene);
    } else {
      audioManager.pauseBgm();
    }
  }, [targetBgmScene]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        audioManager.pauseBgm();
      } else if (targetBgmScene) {
        audioManager.resumeBgm();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [targetBgmScene]);

  // Track last spoken triggers to prevent overlap/re-triggers
  const lastTutorialKeyRef = useRef<string>('');
  const lastDailyDayRef = useRef<number>(0);
  const lastMonthlyKeyRef = useRef<string>('');
  const lastEventIdRef = useRef<string>('');
  const lastAchIdRef = useRef<string>('');
  const lastChatIdRef = useRef<string>(gameState.chatterFeed[0]?.id ?? '');
  const completedObjIdsRef = useRef<Set<string>>(
    new Set((gameState.objectives ?? []).filter((o) => o.completed).map((o) => o.id))
  );

  // Voice-over trigger: Tutorial step change
  useEffect(() => {
    if (
      gameState.screen !== 'PLAYING' ||
      !gameState.tutorial?.active ||
      gameState.tutorial.completed ||
      gameState.tutorial.skipped
    ) {
      return;
    }
    const key = `${locale}:${gameState.tutorial.currentStep}`;
    if (lastTutorialKeyRef.current === key) return;
    lastTutorialKeyRef.current = key;
    const script = getTutorialVoiceScript(gameState.tutorial.currentStep, locale);
    speak({
      speaker: script.speaker,
      text: script.text,
      locale,
      category: 'TUTORIAL',
      dedupeKey: `tut_${key}`,
    });
  }, [
    gameState.screen,
    gameState.tutorial?.active,
    gameState.tutorial?.completed,
    gameState.tutorial?.skipped,
    gameState.tutorial?.currentStep,
    locale,
    speak,
  ]);

  // Voice-over trigger: Daily & Monthly Reports
  useEffect(() => {
    if (gameState.screen !== 'PLAYING') return;
    if (gameState.pendingMonthlyReport) {
      const rep = gameState.pendingMonthlyReport;
      const mKey = `${rep.year}-${rep.month}`;
      if (lastMonthlyKeyRef.current !== mKey) {
        lastMonthlyKeyRef.current = mKey;
        const script = getMonthlyReportVoiceScript(rep, locale);
        speak({
          speaker: script.speaker,
          text: script.text,
          locale,
          category: 'REPORT',
          dedupeKey: `monthly_${mKey}`,
        });
      }
      return;
    }
    if (gameState.pendingDailyReport) {
      const rep = gameState.pendingDailyReport;
      if (lastDailyDayRef.current !== rep.day) {
        lastDailyDayRef.current = rep.day;
        const script = getDailyReportVoiceScript(rep, locale);
        speak({
          speaker: script.speaker,
          text: script.text,
          locale,
          category: 'REPORT',
          dedupeKey: `daily_${rep.day}`,
        });
      }
    }
  }, [
    gameState.screen,
    gameState.pendingDailyReport,
    gameState.pendingMonthlyReport,
    locale,
    speak,
  ]);

  // Voice-over trigger: Strategic Event modal
  useEffect(() => {
    if (gameState.screen !== 'PLAYING' || !gameState.activeEvent) return;
    if (lastEventIdRef.current === gameState.activeEvent.id) return;
    lastEventIdRef.current = gameState.activeEvent.id;
    const loc = getEventLocalized(gameState.activeEvent, gameState, locale);
    speak({
      speaker: loc.categoryLabel,
      text: `${loc.title}. ${loc.description}`,
      locale,
      category: 'REPORT',
      dedupeKey: `evt_${gameState.activeEvent.id}`,
    });
  }, [gameState.screen, gameState.activeEvent, gameState, locale, speak]);

  // Voice-over trigger: Achievement unlocked toast
  useEffect(() => {
    if (!achievementToast || lastAchIdRef.current === achievementToast.id) return;
    lastAchIdRef.current = achievementToast.id;
    const loc = getAchievementLocalized(
      achievementToast.id,
      achievementToast.title,
      achievementToast.description,
      locale
    );
    speak({
      speaker: t('hud.achievementUnlocked'),
      text: `${t('hud.achievementUnlocked')}: ${loc.title}. ${loc.description}`,
      locale,
      category: 'NOTIFICATION',
      dedupeKey: `ach_${achievementToast.id}`,
    });
  }, [achievementToast, locale, speak, t]);

  // Voice-over trigger: Newly completed objective
  useEffect(() => {
    if (gameState.screen !== 'PLAYING') return;
    for (const obj of gameState.objectives ?? []) {
      if (obj.completed && !completedObjIdsRef.current.has(obj.id)) {
        completedObjIdsRef.current.add(obj.id);
        const loc = getObjectiveLocalized(obj.id, obj.label, locale);
        speak({
          speaker: t('voice.speakerAdvisor'),
          text: `${loc.label}.`,
          locale,
          category: 'OBJECTIVE',
          dedupeKey: `obj_${obj.id}`,
        });
      }
    }
  }, [gameState.screen, gameState.objectives, locale, speak, t]);

  // Voice-over trigger: New employee chatter (only if enabled by user in settings)
  useEffect(() => {
    if (gameState.screen !== 'PLAYING') return;
    const latest = gameState.chatterFeed[0];
    if (!latest || latest.id === lastChatIdRef.current) return;
    lastChatIdRef.current = latest.id;
    speak({
      speaker: `${latest.employeeName} (${latest.roleLabel})`,
      text: latest.text,
      locale,
      category: 'DIALOGUE',
      dedupeKey: `chat_${latest.id}`,
    });
  }, [gameState.screen, gameState.chatterFeed, locale, speak]);

  // Highlight CEO Office and Engineering Room during Tutorial Step 2
  const highlightedRoomIds = useMemo<RoomId[]>(() => {
    if (
      gameState.screen !== 'PLAYING' ||
      !gameState.tutorial?.active ||
      gameState.tutorial.completed ||
      gameState.tutorial.skipped ||
      gameState.tutorial.currentStep !== 2
    ) {
      return [];
    }
    const ids: RoomId[] = [];
    if (!gameState.tutorial.exploredCeoOffice) ids.push('CEO_OFFICE');
    if (!gameState.tutorial.exploredEngineering) ids.push('ENGINEERING');
    return ids;
  }, [gameState.screen, gameState.tutorial]);

  const highlightedEmployeeId = useMemo<string | null>(() => {
    if (
      gameState.screen !== 'PLAYING' ||
      !gameState.tutorial?.active ||
      gameState.tutorial.completed ||
      gameState.tutorial.skipped ||
      gameState.tutorial.currentStep !== 1
    ) {
      return null;
    }
    return gameState.employees[0]?.id ?? null;
  }, [gameState.employees, gameState.screen, gameState.tutorial]);

  // Keyboard shortcuts: WASD/Arrows to move Founder, Space to pause/resume, 1-3 speed, Esc menu
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (gameState.screen !== 'PLAYING') return;
      const targetEl = e.target as HTMLElement | null;
      const tag = targetEl?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || targetEl?.isContentEditable) return;

      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'm') {
        if (e.repeat) return;
        e.preventDefault();
        const nextMuted = toggleMasterMute();
        triggerShortcutFeedback('M', nextMuted ? 'MUTE_AUDIO' : 'UNMUTE_AUDIO');
        return;
      }

      if (e.key === 'Escape') {
        if (e.repeat) return;
        if (movingFurnitureId || placingTemplateId) {
          setMovingFurnitureId(null);
          setPlacingTemplateId(null);
          triggerShortcutFeedback(t('shortcutsModal.keyEsc'), 'CANCEL_PLACEMENT');
          return;
        }
        if (activeModal) {
          if (document.querySelectorAll('[role="dialog"]').length <= 1) {
            setActiveModal(null);
          }
          triggerShortcutFeedback(t('shortcutsModal.keyEsc'), 'CLOSE_PANEL');
          return;
        }
        if (
          selectedEmployeeId ||
          selectedRoomId ||
          selectedFurnitureId ||
          selectedWorldNpcId ||
          selectedLocationId
        ) {
          setSelectedEmployeeId(null);
          setSelectedRoomId(null);
          setSelectedFurnitureId(null);
          setSelectedWorldNpcId(null);
          setSelectedLocationId(null);
          triggerShortcutFeedback(t('shortcutsModal.keyEsc'), 'CLOSE_PANEL');
          return;
        }
        setActiveModal('SETTINGS');
        triggerShortcutFeedback(t('shortcutsModal.keyEsc'), 'OPEN_SETTINGS');
        return;
      }

      if (
        activeModal ||
        showEndingGallery ||
        gameState.story?.activeCinematic ||
        gameState.story?.activeStoryEvent ||
        gameState.activeEvent ||
        gameState.pendingMonthlyReport ||
        gameState.pendingDailyReport
      ) {
        return;
      }

      const keyLower = e.key.toLowerCase();
      switch (keyLower) {
        case ' ': {
          e.preventDefault();
          if (e.repeat) return;
          cameraActionRef.current?.focusFounder();
          triggerShortcutFeedback(t('shortcutsModal.keySpace'), 'FOCUS_FOUNDER');
          break;
        }
        case 'p': {
          e.preventDefault();
          if (e.repeat) return;
          const nextSpeed: SimulationSpeed = gameState.speed === 0 ? 1 : 0;
          dispatch({ type: 'SET_SPEED', speed: nextSpeed });
          triggerShortcutFeedback(
            t('shortcutsModal.keyP'),
            nextSpeed === 0 ? 'PAUSE' : 'RESUME',
            nextSpeed
          );
          break;
        }
        case '1':
          if (e.repeat) return;
          dispatch({ type: 'SET_SPEED', speed: 1 });
          triggerShortcutFeedback('1', 'SPEED_1', 1);
          break;
        case '2':
          if (e.repeat) return;
          dispatch({ type: 'SET_SPEED', speed: 2 });
          triggerShortcutFeedback('2', 'SPEED_2', 2);
          break;
        case '3':
          if (e.repeat) return;
          dispatch({ type: 'SET_SPEED', speed: 3 });
          triggerShortcutFeedback('3', 'SPEED_3', 3);
          break;
        case 'w':
        case 'arrowup':
        case 's':
        case 'arrowdown':
        case 'a':
        case 'arrowleft':
        case 'd':
        case 'arrowright': {
          e.preventDefault();
          if (keyLower === 'w' || keyLower === 'arrowup') heldNavKeysRef.current.up = true;
          if (keyLower === 's' || keyLower === 'arrowdown') heldNavKeysRef.current.down = true;
          if (keyLower === 'a' || keyLower === 'arrowleft') heldNavKeysRef.current.left = true;
          if (keyLower === 'd' || keyLower === 'arrowright') heldNavKeysRef.current.right = true;
          const dir = getIsoMovementVector(heldNavKeysRef.current);
          stateRef.current.founder.inputVector = dir;
          stateRef.current.founder.path = [];
          stateRef.current.founder.targetTile = null;
          if (!e.repeat) {
            const actionKey =
              keyLower === 'w' || keyLower === 'arrowup'
                ? 'MOVE_UP'
                : keyLower === 's' || keyLower === 'arrowdown'
                  ? 'MOVE_DOWN'
                  : keyLower === 'a' || keyLower === 'arrowleft'
                    ? 'MOVE_LEFT'
                    : 'MOVE_RIGHT';
            const label =
              e.key === 'ArrowUp'
                ? '↑'
                : e.key === 'ArrowDown'
                  ? '↓'
                  : e.key === 'ArrowLeft'
                    ? '←'
                    : e.key === 'ArrowRight'
                      ? '→'
                      : keyLower.toUpperCase();
            triggerShortcutFeedback(label, actionKey);
          }
          break;
        }
      }
    };

    const clearHeldNav = () => {
      heldNavKeysRef.current = { up: false, down: false, left: false, right: false };
      if (stateRef.current.founder.inputVector) {
        stateRef.current.founder.inputVector = { x: 0, y: 0 };
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const keyLower = e.key.toLowerCase();
      let changed = false;
      if (keyLower === 'w' || keyLower === 'arrowup') {
        heldNavKeysRef.current.up = false;
        changed = true;
      }
      if (keyLower === 's' || keyLower === 'arrowdown') {
        heldNavKeysRef.current.down = false;
        changed = true;
      }
      if (keyLower === 'a' || keyLower === 'arrowleft') {
        heldNavKeysRef.current.left = false;
        changed = true;
      }
      if (keyLower === 'd' || keyLower === 'arrowright') {
        heldNavKeysRef.current.right = false;
        changed = true;
      }
      if (changed) {
        stateRef.current.founder.inputVector = getIsoMovementVector(heldNavKeysRef.current);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearHeldNav);
    return () => {
      clearHeldNav();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearHeldNav);
    };
  }, [
    activeModal,
    showEndingGallery,
    dispatch,
    gameState.activeEvent,
    gameState.pendingDailyReport,
    gameState.pendingMonthlyReport,
    gameState.screen,
    gameState.speed,
    gameState.story?.activeCinematic,
    gameState.story?.activeStoryEvent,
    movingFurnitureId,
    placingTemplateId,
    selectedEmployeeId,
    selectedRoomId,
    selectedFurnitureId,
    selectedLocationId,
    selectedWorldNpcId,
    stateRef,
    t,
    toggleMasterMute,
    triggerShortcutFeedback,
  ]);

  const handleTileClick = useCallback(
    (
      tile: GridPoint,
      hitEmployeeId: string | null,
      hitFurnitureId: string | null,
      hitRoomId: RoomId | null,
      worldExtra?: { worldNpcId: string | null; locationId: WorldLocationId | null }
    ) => {
      // Furniture placement or relocation mode
      if (movingFurnitureId) {
        const room = findRoomAtTile(stateRef.current.office, tile) ?? 'CEO_OFFICE';
        dispatch({ type: 'MOVE_FURNITURE', furnitureId: movingFurnitureId, tile, roomId: room });
        setMovingFurnitureId(null);
        return;
      }
      if (placingTemplateId) {
        const room = findRoomAtTile(stateRef.current.office, tile) ?? 'ENGINEERING';
        dispatch({ type: 'BUY_FURNITURE', templateId: placingTemplateId, roomId: room, tile });
        setPlacingTemplateId(null);
        return;
      }

      if (hitEmployeeId) {
        const emp = stateRef.current.employees.find((e) => e.id === hitEmployeeId);
        if (emp) {
          const dist = Math.hypot(
            emp.position.x - stateRef.current.founder.position.x,
            emp.position.y - stateRef.current.founder.position.y
          );
          if (dist > 2.2) {
            dispatch({
              type: 'MOVE_FOUNDER',
              target: { x: Math.round(emp.position.x), y: Math.round(emp.position.y) },
            });
          }
        }
        setSelectedEmployeeId(hitEmployeeId);
        setSelectedRoomId(null);
        setSelectedFurnitureId(null);
        setSelectedWorldNpcId(null);
        setSelectedLocationId(null);
        dispatch({ type: 'REPORT_TUTORIAL_ACTION', action: 'REVIEW_EMPLOYEE' });
        return;
      }

      if (worldExtra?.worldNpcId) {
        const npc = stateRef.current.world?.npcs.find((n) => n.id === worldExtra.worldNpcId);
        if (npc) {
          const dist = Math.hypot(
            npc.position.x - stateRef.current.founder.position.x,
            npc.position.y - stateRef.current.founder.position.y
          );
          if (dist > 2.4) {
            dispatch({
              type: 'MOVE_FOUNDER',
              target: npc.position,
            });
          }
        }
        setSelectedEmployeeId(null);
        setSelectedRoomId(null);
        setSelectedFurnitureId(null);
        setSelectedWorldNpcId(worldExtra.worldNpcId);
        setSelectedLocationId(npc?.locationId ?? worldExtra.locationId ?? null);
        return;
      }

      if (hitFurnitureId) {
        const furn = getRenderableFurniture(stateRef.current.office).find(
          (f) => f.id === hitFurnitureId
        );
        if (furn) {
          setSelectedEmployeeId(null);
          setSelectedRoomId(furn.roomId);
          setSelectedFurnitureId(furn.id);
          setSelectedWorldNpcId(null);
          setSelectedLocationId(null);
          if (stateRef.current.office.rooms[furn.roomId]?.unlocked) {
            const grid = buildWalkabilityGrid(stateRef.current.office);
            const target = findAdjacentWalkableTile(grid, furn) ?? tile;
            dispatch({ type: 'MOVE_FOUNDER', target });
            dispatch({ type: 'REPORT_TUTORIAL_ACTION', action: 'EXPLORE_ROOM', roomId: furn.roomId });
          }
          return;
        }
      }

      // Click floor -> walk Founder there & highlight room if unlocked, or inspect locked room preview directly
      if (hitRoomId) {
        setSelectedEmployeeId(null);
        setSelectedRoomId(hitRoomId);
        setSelectedFurnitureId(null);
        setSelectedWorldNpcId(null);
        setSelectedLocationId(null);
        if (stateRef.current.office.rooms[hitRoomId]?.unlocked) {
          dispatch({ type: 'MOVE_FOUNDER', target: tile });
          dispatch({ type: 'REPORT_TUTORIAL_ACTION', action: 'EXPLORE_ROOM', roomId: hitRoomId });
        }
        return;
      }

      if (
        worldExtra?.locationId &&
        worldExtra.locationId !== 'COMPANY_HQ' &&
        worldExtra.locationId !== 'MAIN_STREET'
      ) {
        const locId = worldExtra.locationId;
        setSelectedEmployeeId(null);
        setSelectedRoomId(null);
        setSelectedFurnitureId(null);
        setSelectedWorldNpcId(null);
        setSelectedLocationId(locId);
        dispatch({ type: 'MOVE_FOUNDER', target: WORLD_LOCATIONS[locId].entranceTile });
        return;
      }

      dispatch({ type: 'MOVE_FOUNDER', target: tile });
      setSelectedEmployeeId(null);
      setSelectedRoomId(null);
      setSelectedFurnitureId(null);
      setSelectedWorldNpcId(null);
      setSelectedLocationId(null);
    },
    [dispatch, movingFurnitureId, placingTemplateId, stateRef]
  );

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#F3F0E7] text-[#303B38] select-none">
      {/* LAYER A — Full-Bleed Live 2.5D Isometric Office & Main Street World */}
      <div className="w-full h-full">
        <OfficeCanvas
          stateRef={stateRef}
          isTitlePan={gameState.screen === 'TITLE_MENU'}
          selectedRoomId={selectedRoomId}
          selectedFurnitureId={selectedFurnitureId}
          selectedEmployeeId={selectedEmployeeId}
          selectedLocationId={selectedLocationId}
          selectedWorldNpcId={selectedWorldNpcId}
          movingFurnitureId={movingFurnitureId}
          placingTemplateId={placingTemplateId}
          highlightedRoomIds={highlightedRoomIds}
          highlightedEmployeeId={highlightedEmployeeId}
          onFollowFounderChange={setFollowFounder}
          onTileClick={handleTileClick}
          onCameraActionRef={cameraActionRef}
        />
      </div>

      {/* Title Screen */}
      {gameState.screen === 'TITLE_MENU' && (
        <TitleScreen
          hasSave={hasSave}
          latestSaveMeta={latestSaveMeta}
          onStartGame={(p) => {
            setSelectedRoomId(null);
            setSelectedFurnitureId(null);
            setSelectedEmployeeId(null);
            setSelectedLocationId(null);
            setSelectedWorldNpcId(null);
            setMovingFurnitureId(null);
            setPlacingTemplateId(null);
            setActiveModal(null);
            setShowTitleIntro(false);
            startNewGame(p);
          }}
          onContinueGame={() => {
            setSelectedRoomId(null);
            setSelectedFurnitureId(null);
            setSelectedEmployeeId(null);
            setSelectedLocationId(null);
            setSelectedWorldNpcId(null);
            setMovingFurnitureId(null);
            setPlacingTemplateId(null);
            setShowTitleIntro(false);
            continueMostRecentGame();
          }}
          onOpenSaveLoad={() => setShowTitleSaveModal(true)}
          onOpenEndingGallery={() => setShowEndingGallery(true)}
          onWatchIntro={() => setShowTitleIntro(true)}
        />
      )}

      {gameState.screen === 'TITLE_MENU' && showTitleIntro && (
        <CinematicPlayer
          cinematicId="INTRO"
          state={gameState}
          isReplay
          onComplete={() => setShowTitleIntro(false)}
        />
      )}

      {gameState.screen === 'TITLE_MENU' && showTitleSaveModal && (
        <SaveLoadModal
          canSaveCurrent={false}
          onSaveSlot={saveToSlot}
          onLoadSlot={(slotId) => {
            setSelectedRoomId(null);
            setSelectedFurnitureId(null);
            setSelectedEmployeeId(null);
            setSelectedLocationId(null);
            setSelectedWorldNpcId(null);
            setMovingFurnitureId(null);
            setPlacingTemplateId(null);
            setShowTitleIntro(false);
            return loadFromSlot(slotId);
          }}
          onDeleteSlot={removeSaveSlot}
          onClose={() => setShowTitleSaveModal(false)}
        />
      )}

      {/* Active Gameplay HUD & Contextual Drawer */}
      {gameState.screen === 'PLAYING' && (
        <>
          <GameHUD
            state={gameState}
            activeModal={activeModal}
            toast={toast}
            toastSubtext={toastSubtext}
            toastTone={toastTone}
            toastAction={toastAction}
            achievementToast={achievementToast}
            notificationHistory={notificationHistory}
            welcomeBannerOpen={welcomeBannerOpen}
            onDismissWelcomeBanner={dismissWelcomeBanner}
            shortcutFeedback={shortcutFeedback}
            speedShortcutPulseId={speedShortcutPulseId}
            movingMode={Boolean(movingFurnitureId || placingTemplateId)}
            hasDrawerOpen={Boolean(
              selectedEmployeeId ||
                selectedRoomId ||
                selectedFurnitureId ||
                selectedWorldNpcId ||
                selectedLocationId
            )}
            selectedLocationId={selectedLocationId}
            selectedRoomId={selectedRoomId}
            followFounder={followFounder}
            cameraActionRef={cameraActionRef}
            onSelectDistrict={(locId) => {
              setSelectedEmployeeId(null);
              setSelectedWorldNpcId(null);
              setSelectedFurnitureId(null);
              if (locId === 'COMPANY_HQ') {
                setSelectedLocationId(null);
                setSelectedRoomId(null);
              } else {
                setSelectedRoomId(null);
                setSelectedLocationId(locId);
              }
            }}
            onCycleWeather={() => dispatch({ type: 'CYCLE_WEATHER' })}
            onCancelMoving={() => {
              setMovingFurnitureId(null);
              setPlacingTemplateId(null);
            }}
            onDismissAchievementToast={dismissAchievementToast}
            onDismissNotification={dismissCurrentNotification}
            onFocusTutorialTarget={() => {
              const tut = stateRef.current.tutorial;
              if (!tut || !tut.active || tut.completed || tut.skipped) return;
              if (tut.currentStep === 1) {
                cameraActionRef.current?.focusEmployee(stateRef.current.employees[0]?.id);
              } else if (tut.currentStep === 2) {
                const room = !tut.exploredCeoOffice ? 'CEO_OFFICE' : 'ENGINEERING';
                cameraActionRef.current?.focusRoom(room);
              }
            }}
            onOpenAchievements={() => {
              setMilestonesTab('ACHIEVEMENTS');
              setActiveModal('MILESTONES');
            }}
            onSetSpeed={(speed) => dispatch({ type: 'SET_SPEED', speed })}
            onEndDay={() => dispatch({ type: 'END_DAY' })}
            onOpenModal={(m) => {
              if (m === 'MILESTONES') setMilestonesTab('MILESTONES');
              setActiveModal(m);
            }}
            onDispatch={dispatch}
          />

          {!activeModal &&
            !gameState.activeEvent &&
            !gameState.pendingMonthlyReport &&
            !gameState.pendingDailyReport &&
            (!gameState.tutorial?.active ||
              gameState.tutorial?.completed ||
              gameState.tutorial?.skipped) && (
              <EmployeeChatterFeed
                messages={gameState.chatterFeed}
                hideOnMobile={Boolean(
                  selectedEmployeeId ||
                    selectedRoomId ||
                    selectedFurnitureId ||
                    selectedWorldNpcId ||
                    selectedLocationId
                )}
                onSelectEmployee={(empId) => {
                  setSelectedEmployeeId(empId);
                  setSelectedRoomId(null);
                  setSelectedFurnitureId(null);
                  setSelectedWorldNpcId(null);
                  setSelectedLocationId(null);
                  dispatch({ type: 'REPORT_TUTORIAL_ACTION', action: 'REVIEW_EMPLOYEE' });
                }}
              />
            )}

          {!activeModal && (selectedEmployeeId || selectedRoomId || selectedFurnitureId) && (
            <RoomActionDrawer
              state={gameState}
              selectedRoomId={selectedRoomId}
              selectedFurnitureId={selectedFurnitureId}
              selectedEmployeeId={selectedEmployeeId}
              onClearFurniture={() => setSelectedFurnitureId(null)}
              onClose={() => {
                setSelectedEmployeeId(null);
                setSelectedRoomId(null);
                setSelectedFurnitureId(null);
              }}
              onDispatch={dispatch}
              onOpenModal={(m) => setActiveModal(m)}
              onWalkOutsideLobby={() => {
                setSelectedEmployeeId(null);
                setSelectedRoomId(null);
                setSelectedFurnitureId(null);
                setSelectedWorldNpcId(null);
                setSelectedLocationId('MAIN_STREET');
                cameraActionRef.current?.focusLocation('MAIN_STREET');
              }}
            />
          )}

          {!activeModal &&
            (selectedWorldNpcId ||
              (selectedLocationId && selectedLocationId !== 'COMPANY_HQ')) && (
              <WorldActionDrawer
                state={gameState}
                selectedLocationId={selectedLocationId}
                selectedWorldNpcId={selectedWorldNpcId}
                onClose={() => {
                  setSelectedWorldNpcId(null);
                  setSelectedLocationId(null);
                }}
                onDispatch={dispatch}
                onOpenModal={(m) => setActiveModal(m)}
                onWalkToLocation={(locId) => cameraActionRef.current?.focusLocation(locId)}
              />
            )}

          {/* Management Modals */}
          {activeModal === 'EMPLOYEES' && (
            <EmployeePanel
              state={gameState}
              onDispatch={dispatch}
              onClose={() => setActiveModal(null)}
            />
          )}
          {activeModal === 'PRODUCTS' && (
            <ProductPanel
              state={gameState}
              onDispatch={dispatch}
              onClose={() => setActiveModal(null)}
            />
          )}
          {activeModal === 'MARKET' && (
            <MarketPanel
              state={gameState}
              onDispatch={dispatch}
              onClose={() => setActiveModal(null)}
            />
          )}
          {activeModal === 'FINANCE' && (
            <FinancePanel
              state={gameState}
              onDispatch={dispatch}
              onClose={() => setActiveModal(null)}
            />
          )}
          {activeModal === 'OFFICE' && (
            <OfficeUpgradePanel
              state={gameState}
              onDispatch={dispatch}
              onStartPlaceTemplate={(tplId) => setPlacingTemplateId(tplId)}
              onStartMoveFurniture={(furnId) => setMovingFurnitureId(furnId)}
              onClose={() => setActiveModal(null)}
            />
          )}
          {activeModal === 'MILESTONES' && (
            <MilestonesPanel
              state={gameState}
              initialTab={milestonesTab}
              onOpenStoryGallery={() => setShowEndingGallery(true)}
              onClose={() => setActiveModal(null)}
            />
          )}
          {activeModal === 'SAVE_LOAD' && (
            <SaveLoadModal
              canSaveCurrent
              onSaveSlot={saveToSlot}
              onLoadSlot={loadFromSlot}
              onDeleteSlot={removeSaveSlot}
              onClose={() => setActiveModal(null)}
            />
          )}
          {activeModal === 'SETTINGS' && (
            <SettingsModal
              state={gameState}
              onRestartTutorial={() => dispatch({ type: 'RESUME_TUTORIAL' })}
              onResetGame={(p) => {
                setActiveModal(null);
                startNewGame(p);
              }}
              onReturnTitle={() => {
                setActiveModal(null);
                resetToTitle();
              }}
              onClose={() => setActiveModal(null)}
            />
          )}

          {/* Priority Day 1, Monthly Report & Event Modals */}
          {gameState.pendingMonthlyReport && (
            <MonthlyReportModal
              report={gameState.pendingMonthlyReport}
              onContinue={() => dispatch({ type: 'DISMISS_MONTHLY_REPORT' })}
            />
          )}

          {!gameState.pendingMonthlyReport && gameState.pendingDailyReport && (
            <DailyReportModal
              report={gameState.pendingDailyReport}
              onContinue={() => dispatch({ type: 'DISMISS_DAILY_REPORT' })}
            />
          )}

          {!gameState.pendingMonthlyReport &&
            !gameState.pendingDailyReport &&
            gameState.activeEvent && (
              <EventModal
                event={gameState.activeEvent}
                state={gameState}
                cash={gameState.finance.cash}
                creditLimit={gameState.finance.creditLimit}
                onChoose={(choiceId) => dispatch({ type: 'RESOLVE_EVENT', choiceId })}
              />
            )}

          <TutorialManager
            state={gameState}
            activeModal={activeModal}
            selectedEmployeeId={selectedEmployeeId}
            cameraActionRef={cameraActionRef}
          />
        </>
      )}

      {gameState.screen !== 'TITLE_MENU' && (
        <StoryManager
          state={gameState}
          hasOpenModal={Boolean(activeModal)}
          onFocusRoom={(roomId) => cameraActionRef.current?.focusRoom(roomId)}
          onWatchInOffice={(roomId) => {
            setActiveModal(null);
            setSelectedEmployeeId(null);
            setSelectedRoomId(null);
            setSelectedFurnitureId(null);
            setSelectedWorldNpcId(null);
            setSelectedLocationId(null);
            cameraActionRef.current?.focusRoom(roomId);
          }}
          onDispatch={dispatch}
          onOpenEndingGallery={() => setShowEndingGallery(true)}
          onStartNewGame={() => {
            setConfirmEndModalNewGame(false);
            startNewGame(DEFAULT_NEW_GAME_PARAMS);
          }}
        />
      )}

      {/* Victory Modal (shown after ending cinematic or if skipped) */}
      {gameState.screen === 'VICTORY' && !gameState.story?.activeCinematic && (
        <ModalFrame
          title={
            gameState.story?.evaluatedEnding
              ? t(`story.endings.${gameState.story.evaluatedEnding.endingId}.title`)
              : t('endgame.victoryTitle')
          }
          subtitle={t('endgame.victorySubtitle', { company: gameState.config.companyName })}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4 text-[15px]">
            <p className="text-[#303B38] leading-relaxed">
              {gameState.story?.evaluatedEnding
                ? t(`story.endings.${gameState.story.evaluatedEnding.endingId}.message`)
                : t('endgame.victoryBody', {
                    company: gameState.config.companyName,
                    count: gameState.employees.length,
                    revenue: formatCurrency(gameState.finance.cumulativeRevenue),
                    rep: Math.round(gameState.founder.reputation),
                  })}
            </p>
            {!confirmEndModalNewGame ? (
              <div className="flex flex-wrap gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEndingGallery(true)}
                  className="min-h-[44px] py-2.5 px-4 bg-[#D9A66C]/35 hover:bg-[#D9A66C]/55 border border-[#303B38] text-[#303B38] text-[14px] font-bold cursor-pointer"
                >
                  {t('story.gallery.openBtn')}
                </button>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'CONTINUE_SANDBOX' })}
                  className="min-h-[44px] flex-1 py-2.5 px-4 bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38] text-[#303B38] text-[15px] font-bold cursor-pointer"
                >
                  {t('endgame.continueSandbox')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmEndModalNewGame(true)}
                  className="min-h-[44px] py-2.5 px-4 bg-[#FAF8F2] hover:bg-[#EAE5D8] border border-[#303B38]/35 text-[#303B38] text-[14px] font-bold cursor-pointer"
                >
                  {t('story.endingCard.newCompanyBtn')}
                </button>
              </div>
            ) : (
              <div className="bg-[#FAF8F2] border-2 border-[#303B38] p-3.5 space-y-2.5">
                <div className="text-[14px] font-bold">{t('story.endingCard.confirmNewGameBody')}</div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmEndModalNewGame(false)}
                    className="min-h-[42px] flex-1 bg-[#F3F0E7] hover:bg-[#EAE5D8] border border-[#303B38]/35 font-bold cursor-pointer"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmEndModalNewGame(false);
                      startNewGame(DEFAULT_NEW_GAME_PARAMS);
                    }}
                    className="min-h-[42px] flex-1 bg-[#303B38] text-[#F3F0E7] font-bold cursor-pointer"
                  >
                    {t('story.endingCard.confirmNewGameAction')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </ModalFrame>
      )}

      {/* Game Over Modal (shown after Ending E cinematic or if skipped) */}
      {gameState.screen === 'GAME_OVER' && !gameState.story?.activeCinematic && (
        <ModalFrame
          title={t('story.endings.LAST_DAY.title')}
          subtitle={t('endgame.gameOverSubtitle', {
            company: gameState.config.companyName,
            year: gameState.year,
            month: gameState.month,
          })}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4 text-[15px]">
            <p className="text-[#303B38] font-bold leading-relaxed">
              {getLocalizedGameOverReason(gameState.gameOverReason, locale)}
            </p>
            <div className="bg-[#FAF8F2] border border-[#303B38]/25 p-4 text-[15px] font-mono-num space-y-2">
              <div className="flex justify-between">
                <span className="text-[#303B38]/75">{t('endgame.daysOperated')}</span>
                <span className="font-bold">{gameState.totalDays}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#303B38]/75">{t('endgame.cumulativeRevenue')}</span>
                <span className="font-bold">
                  {formatCurrency(gameState.finance.cumulativeRevenue)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#303B38]/75">{t('endgame.endingCash')}</span>
                <span className="font-bold">{formatCurrency(gameState.finance.cash)}</span>
              </div>
            </div>
            {!confirmEndModalNewGame ? (
              <div className="flex flex-wrap gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEndingGallery(true)}
                  className="min-h-[44px] py-2.5 px-4 bg-[#D9A66C]/35 hover:bg-[#D9A66C]/55 border border-[#303B38] text-[#303B38] text-[14px] font-bold cursor-pointer"
                >
                  {t('story.gallery.openBtn')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmEndModalNewGame(true)}
                  className="min-h-[44px] flex-1 py-2.5 px-4 bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38] text-[#303B38] text-[15px] font-bold cursor-pointer"
                >
                  {t('story.endingCard.newCompanyBtn')}
                </button>
                <button
                  type="button"
                  onClick={resetToTitle}
                  className="min-h-[44px] px-4 py-2.5 bg-[#FAF8F2] hover:bg-[#EAE5D8] border border-[#303B38]/35 text-[#303B38] text-[15px] font-bold cursor-pointer"
                >
                  {t('endgame.titleScreenBtn')}
                </button>
              </div>
            ) : (
              <div className="bg-[#FAF8F2] border-2 border-[#303B38] p-3.5 space-y-2.5">
                <div className="text-[14px] font-bold">{t('story.endingCard.confirmNewGameBody')}</div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmEndModalNewGame(false)}
                    className="min-h-[42px] flex-1 bg-[#F3F0E7] hover:bg-[#EAE5D8] border border-[#303B38]/35 font-bold cursor-pointer"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmEndModalNewGame(false);
                      startNewGame(DEFAULT_NEW_GAME_PARAMS);
                    }}
                    className="min-h-[42px] flex-1 bg-[#303B38] text-[#F3F0E7] font-bold cursor-pointer"
                  >
                    {t('story.endingCard.confirmNewGameAction')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </ModalFrame>
      )}

      {/* Ending Gallery Modal (accessible from Title Screen, Milestones, and Ending Cards) */}
      {showEndingGallery && (
        <EndingGalleryModal
          state={gameState}
          onClose={() => setShowEndingGallery(false)}
        />
      )}

      {/* Voice-Over Synchronized Subtitles */}
      <SubtitlePanel hasBottomBar={gameState.screen === 'PLAYING'} />

      {/* Subtle Cozy Screen-Wide Celebration Particles */}
      {gameState.screen !== 'TITLE_MENU' && (
        <CelebrationParticlesOverlay triggerKey={particleBurstKey} />
      )}
    </div>
  );
}
