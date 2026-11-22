import React from 'react';
import { GameCommand, GameState, RoomId } from '@/src/types/game';
import { CinematicPlayer } from './CinematicPlayer';
import { MilestoneCelebrationBanner } from './MilestoneCelebrationBanner';
import { StoryEventModal } from './StoryEventModal';

interface StoryManagerProps {
  state: GameState;
  hasOpenModal?: boolean;
  onFocusRoom?: (roomId: RoomId) => void;
  onWatchInOffice?: (roomId: RoomId) => void;
  onDispatch: (cmd: GameCommand) => void;
  onOpenEndingGallery: () => void;
  onStartNewGame: () => void;
}

export const StoryManager: React.FC<StoryManagerProps> = ({
  state,
  hasOpenModal = false,
  onFocusRoom,
  onWatchInOffice,
  onDispatch,
  onOpenEndingGallery,
  onStartNewGame,
}) => {
  const activeCinematic = state.story?.activeCinematic ?? null;
  const activeStoryEvent = state.story?.activeStoryEvent ?? null;
  const activeCelebration = state.activeCelebration ?? null;

  if (activeCinematic) {
    return (
      <CinematicPlayer
        cinematicId={activeCinematic}
        state={state}
        endingSummary={state.story?.evaluatedEnding ?? null}
        onComplete={(skipped) =>
          onDispatch({
            type: 'COMPLETE_CINEMATIC',
            cinematicId: activeCinematic,
            skipped,
          })
        }
        onContinueSandbox={() => onDispatch({ type: 'CONTINUE_SANDBOX' })}
        onOpenGallery={onOpenEndingGallery}
        onStartNewGame={onStartNewGame}
      />
    );
  }

  if (
    state.screen === 'PLAYING' &&
    activeStoryEvent &&
    !state.activeEvent &&
    !state.pendingDailyReport &&
    !state.pendingMonthlyReport
  ) {
    return (
      <StoryEventModal
        storyEvent={activeStoryEvent}
        state={state}
        onChoose={(choiceId) =>
          onDispatch({ type: 'RESOLVE_STORY_EVENT', choiceId })
        }
      />
    );
  }

  if (
    state.screen === 'PLAYING' &&
    activeCelebration &&
    !state.activeEvent &&
    !state.pendingDailyReport &&
    !state.pendingMonthlyReport
  ) {
    return (
      <MilestoneCelebrationBanner
        celebration={activeCelebration}
        state={state}
        hasOpenModal={hasOpenModal}
        onFocusRoom={(roomId) => onFocusRoom?.(roomId)}
        onWatchInOffice={(roomId) => onWatchInOffice?.(roomId)}
        onDismiss={() => onDispatch({ type: 'DISMISS_CELEBRATION' })}
      />
    );
  }

  return null;
};
