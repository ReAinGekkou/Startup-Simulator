import { useCallback, useEffect, useRef, useState } from 'react';
import { audioManager } from '@/src/audio/audioManager';
import { voiceService } from '@/src/audio/voiceService';
import { createNewGame, DEFAULT_NEW_GAME_PARAMS } from '@/src/game/engine/initGame';
import {
  executeCommand,
  tickSimulation,
  tickTitleAmbientLife,
} from '@/src/game/engine/simulation';
import {
  createMoraleNotificationTracker,
  evaluateMoraleNotification,
} from '@/src/game/systems/moraleSystem';
import { getLocale } from '@/src/localization';
import {
  deleteSaveSlot,
  getMostRecentSaveMeta,
  hasAnySavedGame,
  loadGameFromSlot,
  saveGameToSlot,
} from '@/src/services/saveService';
import { soundService } from '@/src/services/soundService';
import {
  Achievement,
  GameCommand,
  GameState,
  NewGameParams,
  SaveSlotMeta,
} from '@/src/types/game';

export interface QueuedNotification {
  id: string;
  kind: 'INFO' | 'ACHIEVEMENT';
  tone?: 'DEFAULT' | 'MORALE';
  message: string;
  subtext?: string;
  action?: {
    label: string;
    command: GameCommand;
  };
  achievement?: Achievement;
  day: number;
}

export function appendToNotificationQueue(
  queue: QueuedNotification[],
  item: QueuedNotification
): QueuedNotification[] {
  // Deduplicate immediate duplicate messages or identical achievement IDs already queued
  if (item.achievement && queue.some((q) => q.achievement?.id === item.achievement?.id)) {
    return queue;
  }
  if (
    queue.length > 0 &&
    queue[queue.length - 1].kind === item.kind &&
    queue[queue.length - 1].message === item.message
  ) {
    return queue;
  }
  return [...queue, item].slice(0, 8);
}

export function useGameEngine() {
  const [gameState, setGameState] = useState<GameState>(() => {
    const base = createNewGame(DEFAULT_NEW_GAME_PARAMS);
    return { ...base, screen: 'TITLE_MENU', speed: 1 };
  });

  const stateRef = useRef<GameState>(gameState);
  stateRef.current = gameState;

  const [notificationQueue, setNotificationQueue] = useState<QueuedNotification[]>([]);
  const [notificationHistory, setNotificationHistory] = useState<QueuedNotification[]>([]);
  const [welcomeBannerOpen, setWelcomeBannerOpen] = useState<boolean>(false);
  const moraleTrackerRef = useRef(createMoraleNotificationTracker());
  const lastObservedCelebrationIdRef = useRef<string | null>(
    gameState.activeCelebration?.id ?? null
  );
  const [muted, setMuted] = useState<boolean>(() => soundService.isMuted());
  const [hasSave, setHasSave] = useState<boolean>(() => hasAnySavedGame());
  const [latestSaveMeta, setLatestSaveMeta] = useState<SaveSlotMeta | null>(() =>
    getMostRecentSaveMeta()
  );

  const refreshSaveIndicators = useCallback(() => {
    setHasSave(hasAnySavedGame());
    setLatestSaveMeta(getMostRecentSaveMeta());
  }, []);

  useEffect(() => {
    return audioManager.subscribe(() => {
      setMuted(soundService.isMuted());
    });
  }, []);

  const dismissWelcomeBanner = useCallback(() => {
    setWelcomeBannerOpen(false);
  }, []);

  const pushQueuedNotification = useCallback((item: QueuedNotification) => {
    setNotificationQueue((prev) => appendToNotificationQueue(prev, item));
    setNotificationHistory((prev) => [item, ...prev].slice(0, 20));
  }, []);

  const showToast = useCallback(
    (msg: string) => {
      pushQueuedNotification({
        id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        kind: 'INFO',
        message: msg,
        day: stateRef.current.totalDays,
      });
    },
    [pushQueuedNotification]
  );

  const enqueueAchievements = useCallback(
    (items?: Achievement[], skipSound = false) => {
      if (!items || items.length === 0) return;
      for (const ach of items) {
        pushQueuedNotification({
          id: `ach_${ach.id}_${Date.now()}`,
          kind: 'ACHIEVEMENT',
          message: ach.title,
          achievement: ach,
          day: stateRef.current.totalDays,
        });
      }
      if (!skipSound) {
        soundService.play('LEVEL_UP');
      }
    },
    [pushQueuedNotification]
  );

  const dismissCurrentNotification = useCallback(() => {
    setNotificationQueue((prev) => prev.slice(1));
  }, []);

  const currentBanner = notificationQueue[0] ?? null;

  useEffect(() => {
    if (!currentBanner) return;
    const durationMs =
      currentBanner.kind === 'ACHIEVEMENT'
        ? 3600
        : currentBanner.tone === 'MORALE'
          ? 4500
          : 2800;
    const id = window.setTimeout(() => {
      setNotificationQueue((prev) => prev.slice(1));
    }, durationMs);
    return () => window.clearTimeout(id);
  }, [currentBanner]);

  const toast = currentBanner?.kind === 'INFO' ? currentBanner.message : null;
  const toastSubtext = currentBanner?.kind === 'INFO' ? currentBanner.subtext ?? null : null;
  const toastTone = currentBanner?.kind === 'INFO' ? currentBanner.tone ?? 'DEFAULT' : 'DEFAULT';
  const toastAction = currentBanner?.kind === 'INFO' ? currentBanner.action ?? null : null;
  const currentAchievementToast =
    currentBanner?.kind === 'ACHIEVEMENT' && currentBanner.achievement
      ? currentBanner.achievement
      : null;

  const dispatch = useCallback(
    (command: GameCommand) => {
      const prevCelId = stateRef.current.activeCelebration?.id ?? null;
      const result = executeCommand(stateRef.current, command);
      const nextCelId = result.state.activeCelebration?.id ?? null;
      stateRef.current = result.state;
      lastObservedCelebrationIdRef.current = nextCelId;
      setGameState(result.state);
      if (result.sound) {
        soundService.play(result.sound);
      }
      if (
        nextCelId &&
        nextCelId !== prevCelId &&
        result.sound !== 'LEVEL_UP' &&
        result.sound !== 'MILESTONE_CHIME'
      ) {
        soundService.playMilestoneChime(`cel:${nextCelId}`);
      }
      if (result.feedback) {
        showToast(result.feedback);
      }
      if (result.unlockedAchievements && result.unlockedAchievements.length > 0) {
        enqueueAchievements(result.unlockedAchievements, result.sound === 'MILESTONE_CHIME');
      }
      return result;
    },
    [enqueueAchievements, showToast]
  );

  const startNewGame = useCallback(
    (params: NewGameParams) => {
      soundService.resetMilestoneChimeHistory();
      const fresh = createNewGame(params);
      stateRef.current = fresh;
      lastObservedCelebrationIdRef.current = fresh.activeCelebration?.id ?? null;
      setGameState(fresh);
      setNotificationQueue([]);
      moraleTrackerRef.current = createMoraleNotificationTracker();
      const vi = getLocale() === 'vi-VN';
      setNotificationHistory([
        {
          id: `welcome_${Date.now()}`,
          kind: 'INFO',
          message: vi ? 'Chào mừng đến với công ty của bạn!' : 'Welcome to your company!',
          subtext: vi ? 'Cùng bắt đầu nhé!' : "Let's get started!",
          day: fresh.totalDays,
        },
      ]);
      setWelcomeBannerOpen(true);
      saveGameToSlot('autosave', fresh, vi ? 'Lưu tự động' : 'Autosave');
      refreshSaveIndicators();
      soundService.play('LEVEL_UP');
    },
    [refreshSaveIndicators]
  );

  const saveToSlot = useCallback(
    (slotId: string, label?: string) => {
      const ok = saveGameToSlot(slotId, stateRef.current, label);
      const vi = getLocale() === 'vi-VN';
      if (ok) {
        refreshSaveIndicators();
        soundService.play('SUCCESS');
        showToast(vi ? 'Đã lưu tiến trình.' : 'Game saved locally.');
      } else {
        soundService.play('ERROR');
        showToast(vi ? 'Không thể lưu bản chơi.' : 'Failed to write local save.');
      }
    },
    [refreshSaveIndicators, showToast]
  );

  const loadFromSlot = useCallback(
    (slotId: string) => {
      const loaded = loadGameFromSlot(slotId);
      const vi = getLocale() === 'vi-VN';
      if (!loaded) {
        soundService.play('ERROR');
        showToast(
          vi ? 'Ô lưu trống hoặc dữ liệu bị hỏng.' : 'Save slot is empty or corrupted.'
        );
        return false;
      }
      soundService.resetMilestoneChimeHistory();
      const next: GameState = { ...loaded, screen: 'PLAYING' };
      stateRef.current = next;
      lastObservedCelebrationIdRef.current = next.activeCelebration?.id ?? null;
      setGameState(next);
      setNotificationQueue([]);
      moraleTrackerRef.current = createMoraleNotificationTracker();
      setWelcomeBannerOpen(false);
      soundService.play('SUCCESS');
      showToast(
        vi
          ? `Đã mở ${next.config.companyName} (Ngày ${next.day}).`
          : `Loaded ${next.config.companyName} (Day ${next.day}).`
      );
      return true;
    },
    [showToast]
  );

  const continueMostRecentGame = useCallback(() => {
    const mostRecent = getMostRecentSaveMeta();
    if (!mostRecent) {
      return false;
    }
    return loadFromSlot(mostRecent.slotId);
  }, [loadFromSlot]);

  const removeSaveSlot = useCallback(
    (slotId: string) => {
      deleteSaveSlot(slotId);
      refreshSaveIndicators();
    },
    [refreshSaveIndicators]
  );

  const resetToTitle = useCallback(() => {
    voiceService.stop(true);
    soundService.resetMilestoneChimeHistory();
    const fresh = createNewGame(DEFAULT_NEW_GAME_PARAMS);
    const titleState: GameState = { ...fresh, screen: 'TITLE_MENU', speed: 1 };
    stateRef.current = titleState;
    lastObservedCelebrationIdRef.current = null;
    setGameState(titleState);
    setNotificationQueue([]);
    moraleTrackerRef.current = createMoraleNotificationTracker();
    setWelcomeBannerOpen(false);
    refreshSaveIndicators();
  }, [refreshSaveIndicators]);

  const toggleMute = useCallback(() => {
    const next = soundService.toggleMute();
    if (next) {
      voiceService.stop(false);
    }
    setMuted(next);
  }, []);

  const toggleMasterMute = useCallback((): boolean => {
    const next = audioManager.toggleMasterMute();
    if (next) {
      voiceService.stop(false);
    }
    setMuted(soundService.isMuted());
    return next;
  }, []);

  // Simulation frame ticker (syncs React HUD at ~10Hz while canvas renders at 60fps via stateRef)
  useEffect(() => {
    let lastTime = performance.now();
    let syncAccum = 0;
    let rafId = 0;

    const frame = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;

      const curr = stateRef.current;
      if (curr.screen === 'TITLE_MENU') {
        tickTitleAmbientLife(curr, rawDt);
        lastObservedCelebrationIdRef.current = null;
      } else if (curr.screen === 'PLAYING') {
        const prevHourFloor = Math.floor(curr.hourOfDay);
        const prevCelId = curr.activeCelebration?.id ?? null;
        const res = tickSimulation(curr, rawDt);
        const nextCelId = res.state.activeCelebration?.id ?? null;
        const celebrationChanged =
          nextCelId !== prevCelId || nextCelId !== lastObservedCelebrationIdRef.current;
        const celebrationActivated = Boolean(
          nextCelId && nextCelId !== lastObservedCelebrationIdRef.current
        );
        const milestoneCompletedThisTick = res.unlockedMilestones.length > 0;
        if (milestoneCompletedThisTick) {
          soundService.playMilestoneChime(
            `tick_ms:${res.state.totalDays}:${res.unlockedMilestones.length}`
          );
        } else if (celebrationActivated) {
          soundService.playMilestoneChime(`cel:${nextCelId}`);
        }
        lastObservedCelebrationIdRef.current = nextCelId;
        syncAccum += rawDt;

        if (Math.floor(res.state.hourOfDay) !== prevHourFloor || res.dayEnded) {
          const moraleAlert = evaluateMoraleNotification(
            res.state,
            moraleTrackerRef.current,
            getLocale(),
            performance.now()
          );
          if (moraleAlert) {
            pushQueuedNotification({
              id: `morale_${moraleAlert.employeeId}_${Date.now()}`,
              kind: 'INFO',
              tone: 'MORALE',
              message: moraleAlert.title,
              subtext: moraleAlert.suggestion,
              action: {
                label: moraleAlert.actionLabel,
                command: {
                  type: 'ASSIGN_EMPLOYEE_TASK',
                  employeeId: moraleAlert.employeeId,
                  task: 'REST_BREAK',
                },
              },
              day: res.state.totalDays,
            });
            soundService.play('ALERT');
          }
        }

        if (res.dayEnded) {
          saveGameToSlot('autosave', res.state, 'Autosave');
          refreshSaveIndicators();
          if (res.eventTriggered) soundService.play('ALERT');
          if (res.monthEnded && !milestoneCompletedThisTick) soundService.play('CASH');
          if (res.unlockedAchievements.length > 0) {
            enqueueAchievements(
              res.unlockedAchievements,
              milestoneCompletedThisTick || celebrationActivated
            );
          }
          setGameState({ ...res.state });
          syncAccum = 0;
        } else if (celebrationChanged || syncAccum >= 0.15) {
          syncAccum = 0;
          setGameState({ ...res.state });
        }
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [enqueueAchievements, pushQueuedNotification, refreshSaveIndicators]);

  return {
    gameState,
    stateRef,
    toast,
    toastSubtext,
    toastTone,
    toastAction,
    achievementToast: currentAchievementToast,
    notificationHistory,
    welcomeBannerOpen,
    dismissWelcomeBanner,
    dismissAchievementToast: dismissCurrentNotification,
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
  };
}
