import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Captions,
  FastForward,
  Mic,
  MicOff,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { audioManager } from '@/src/audio/audioManager';
import { voiceService } from '@/src/audio/voiceService';
import { getBeatsForCinematic, STORY_CHAPTERS } from '@/src/game/data/storyData';
import { isCelebratoryCinematic } from '@/src/game/systems/celebrationParticles';
import { getStoryEventTemplate } from '@/src/game/systems/storyEventSystem';
import { useLocalization } from '@/src/hooks/useLocalization';
import { soundService } from '@/src/services/soundService';
import {
  CinematicSceneId,
  EvaluatedEndingSummary,
  GameState,
} from '@/src/types/game';
import { CelebrationParticlesOverlay } from './CelebrationParticlesOverlay';
import { CinematicCanvasStage } from './CinematicCanvasStage';
import { DialogueBox, DialogueTextSpeed } from './DialogueBox';

interface CinematicPlayerProps {
  cinematicId: CinematicSceneId;
  state: GameState;
  endingSummary?: EvaluatedEndingSummary | null;
  isReplay?: boolean;
  onComplete: (skipped: boolean) => void;
  onContinueSandbox?: () => void;
  onOpenGallery?: () => void;
  onStartNewGame?: () => void;
}

export const CinematicPlayer: React.FC<CinematicPlayerProps> = ({
  cinematicId,
  state,
  endingSummary = null,
  isReplay = false,
  onComplete,
  onContinueSandbox,
  onOpenGallery,
  onStartNewGame,
}) => {
  const { locale, t, formatCurrency } = useLocalization();
  const beats = useMemo(
    () => getBeatsForCinematic(cinematicId, state),
    [cinematicId, state]
  );

  const [beatIndex, setBeatIndex] = useState(0);
  const [fadeOpacity, setFadeOpacity] = useState(0);
  const [textSpeed, setTextSpeed] = useState<DialogueTextSpeed>('NORMAL');
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [confirmNewGame, setConfirmNewGame] = useState(false);

  const [bgmVolume, setBgmVolume] = useState(
    () => audioManager.getSettings().bgmVolume
  );
  const [bgmMuted, setBgmMuted] = useState(
    () => audioManager.getSettings().bgmMuted || audioManager.getSettings().masterMuted
  );
  const [voiceEnabled, setVoiceEnabled] = useState(
    () => voiceService.getSettings().enabled
  );
  const [voiceVolume, setVoiceVolume] = useState(
    () => voiceService.getSettings().volume
  );

  useEffect(() => {
    const unsubAudio = audioManager.subscribe(() => {
      const s = audioManager.getSettings();
      setBgmVolume(s.bgmVolume);
      setBgmMuted(s.bgmMuted || s.masterMuted);
    });
    const unsubVoice = voiceService.subscribe(() => {
      const vs = voiceService.getSettings();
      setVoiceEnabled(vs.enabled);
      setVoiceVolume(vs.volume);
    });
    return () => {
      unsubAudio();
      unsubVoice();
    };
  }, []);

  useEffect(() => {
    setBeatIndex(0);
    setConfirmNewGame(false);
    audioManager.setScene(
      cinematicId === 'INTRO' ? 'MENU' : cinematicId.startsWith('ENDING_') ? 'EVENT' : 'OFFICE'
    );
    if (isReplay && isCelebratoryCinematic(cinematicId)) {
      soundService.playMilestoneChime(`replay:${cinematicId}`, { dedupeKey: false });
    }
    return () => {
      voiceService.stop(true);
    };
  }, [cinematicId, isReplay]);

  // Smooth fade-in on beat transition
  useEffect(() => {
    setFadeOpacity(0);
    const id = window.setTimeout(() => setFadeOpacity(1), 40);
    return () => window.clearTimeout(id);
  }, [beatIndex, cinematicId]);

  const currentBeat = beats[beatIndex] ?? beats[0];
  const isLastBeat = beatIndex >= beats.length - 1;

  // Narrate current cinematic beat when voice narration is enabled
  useEffect(() => {
    if (!currentBeat || currentBeat.isEndingSummary || !voiceEnabled || voiceVolume <= 0) {
      return;
    }
    const lineText = currentBeat.isTitleCard
      ? t('story.intro.readyDay1', { company: state.config.companyName })
      : t(currentBeat.textKey, { company: state.config.companyName });
    const speakerLabel = currentBeat.speakerKey
      ? currentBeat.speakerKey === 'story.speakers.founder'
        ? state.founder.name
        : currentBeat.speakerKey === 'story.speakers.teamLead' && state.employees[0]
          ? state.employees[0].name
          : t(currentBeat.speakerKey)
      : t('story.speakers.narrator');

    voiceService.speak({
      speaker: speakerLabel,
      text: lineText,
      locale,
      category: 'MANUAL',
      dedupeKey: `cinematic_${cinematicId}_${beatIndex}_${locale}`,
      userInitiated: true,
    });
  }, [
    beatIndex,
    cinematicId,
    currentBeat,
    locale,
    state.config.companyName,
    state.employees,
    state.founder.name,
    t,
    voiceEnabled,
    voiceVolume,
  ]);

  // Auto-advance timer when enabled & not resting on interactive Ending Summary card
  useEffect(() => {
    if (!autoAdvance || !currentBeat || currentBeat.isEndingSummary) return;
    const speedFactor = textSpeed === 'FAST' ? 0.75 : textSpeed === 'SLOW' ? 1.25 : 1;
    const ms = Math.round(currentBeat.durationMs * speedFactor);
    const id = window.setTimeout(() => {
      if (beatIndex < beats.length - 1) {
        setBeatIndex((i) => i + 1);
      } else {
        onComplete(false);
      }
    }, ms);
    return () => window.clearTimeout(id);
  }, [autoAdvance, currentBeat, beatIndex, beats.length, textSpeed, onComplete]);

  const handleAdvance = () => {
    if (beatIndex < beats.length - 1) {
      setBeatIndex((i) => i + 1);
    } else {
      onComplete(false);
    }
  };

  const handleCycleSpeed = () => {
    setTextSpeed((prev) =>
      prev === 'NORMAL' ? 'FAST' : prev === 'FAST' ? 'SLOW' : 'NORMAL'
    );
  };

  const speakerAvatar = useMemo(() => {
    if (!currentBeat?.speakerKey) return null;
    if (currentBeat.speakerKey === 'story.speakers.founder') {
      return {
        appearance: state.founder.appearance,
        isFounder: true,
        mood:
          cinematicId === 'ENDING_BURNOUT' || cinematicId === 'ENDING_LAST_DAY'
            ? ('STRESSED' as const)
            : ('HAPPY' as const),
      };
    }
    if (currentBeat.speakerKey === 'story.speakers.teamLead' && state.employees[0]) {
      return {
        appearance: state.employees[0].appearance,
        isFounder: false,
        mood: 'NEUTRAL' as const,
      };
    }
    return null;
  }, [currentBeat?.speakerKey, state.founder.appearance, state.employees, cinematicId]);

  const headerTitle = useMemo(() => {
    if (cinematicId === 'INTRO') return t('story.intro.badge');
    if (cinematicId.startsWith('CHAPTER_')) {
      const chNum = Number(cinematicId.split('_')[1]);
      const meta = STORY_CHAPTERS.find((c) => c.id === chNum);
      return meta ? `${t('story.chapterPrefix', { n: chNum })}: ${t(meta.titleKey)}` : '';
    }
    const endId = cinematicId.replace('ENDING_', '');
    return t(`story.endings.${endId}.title`);
  }, [cinematicId, t]);

  const summary = endingSummary ?? state.story?.evaluatedEnding ?? null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={headerTitle}
      className="fixed inset-0 z-50 bg-[#1B2321]/95 flex flex-col justify-between p-3 sm:p-5 overflow-y-auto"
    >
      {isReplay && isCelebratoryCinematic(cinematicId) && (
        <CelebrationParticlesOverlay triggerKey={`replay:${cinematicId}`} />
      )}
      {/* Top Bar: Progress Dots + Audio / Subtitle / Speed / Skip Controls */}
      <div className="w-full max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-2 text-[#F3F0E7]">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="px-2.5 py-1 bg-[#303B38] border border-[#78978A] text-[12px] font-bold text-[#F3F0E7] truncate">
            {headerTitle}
          </span>
          <div className="flex items-center gap-1" aria-hidden="true">
            {beats.map((b, idx) => (
              <span
                key={b.id}
                className={`h-2 w-4 border border-[#F3F0E7]/35 transition-colors ${
                  idx === beatIndex
                    ? 'bg-[#D9A66C]'
                    : idx < beatIndex
                      ? 'bg-[#78978A]'
                      : 'bg-[#303B38]'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Music Volume Control */}
          <div className="flex items-center gap-1.5 px-2 py-1 bg-[#303B38] border border-[#F3F0E7]/25">
            <button
              type="button"
              onClick={() => audioManager.setBgmMuted(!bgmMuted)}
              aria-label={t('audio.bgmMuteAria')}
              title={t('story.controls.musicVolume')}
              className="p-1 text-[#F3F0E7] hover:text-[#D9A66C] cursor-pointer"
            >
              {bgmMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(bgmVolume * 100)}
              aria-label={t('story.controls.musicVolume')}
              onChange={(e) => audioManager.setBgmVolume(Number(e.target.value) / 100)}
              className="w-14 sm:w-16 accent-[#78978A] cursor-pointer"
            />
          </div>

          {/* Voice Volume Control */}
          <div className="flex items-center gap-1.5 px-2 py-1 bg-[#303B38] border border-[#F3F0E7]/25">
            <button
              type="button"
              onClick={() => voiceService.updateSettings({ enabled: !voiceEnabled })}
              aria-label={t('story.controls.voiceMuteAria')}
              title={t('story.controls.voiceVolume')}
              className="p-1 text-[#F3F0E7] hover:text-[#D9A66C] cursor-pointer"
            >
              {!voiceEnabled || voiceVolume <= 0 ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(voiceVolume * 100)}
              aria-label={t('story.controls.voiceVolume')}
              onChange={(e) => {
                const nextVol = Number(e.target.value) / 100;
                voiceService.updateSettings({
                  volume: nextVol,
                  enabled: nextVol > 0 ? true : voiceEnabled,
                });
              }}
              className="w-14 sm:w-16 accent-[#D9A66C] cursor-pointer"
            />
          </div>

          <button
            type="button"
            onClick={handleCycleSpeed}
            className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 bg-[#303B38] hover:bg-[#3F4D49] border border-[#F3F0E7]/25 text-[12px] font-bold cursor-pointer"
          >
            <FastForward className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t(`story.controls.speed_${textSpeed}`)}</span>
          </button>

          <button
            type="button"
            onClick={() => setAutoAdvance((v) => !v)}
            aria-pressed={autoAdvance}
            className={`min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 border text-[12px] font-bold cursor-pointer ${
              autoAdvance
                ? 'bg-[#78978A] text-[#303B38] border-[#F3F0E7]/40'
                : 'bg-[#303B38] text-[#F3F0E7] border-[#F3F0E7]/25'
            }`}
          >
            {autoAdvance ? (
              <Pause className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <Play className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">{t('story.controls.autoBtn')}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSubtitles((v) => !v)}
            aria-pressed={showSubtitles}
            className={`min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 border text-[12px] font-bold cursor-pointer ${
              showSubtitles
                ? 'bg-[#EAE5D8] text-[#303B38] border-[#303B38]'
                : 'bg-[#303B38] text-[#F3F0E7] border-[#F3F0E7]/25'
            }`}
          >
            <Captions className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">{t('story.controls.subtitlesBtn')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              voiceService.stop(true);
              onComplete(true);
            }}
            className="min-h-[34px] inline-flex items-center gap-1 px-3 py-1 bg-[#FAF8F2] hover:bg-[#EAE5D8] border border-[#303B38] text-[#303B38] text-[12px] font-bold cursor-pointer"
          >
            <SkipForward className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('story.controls.skip')}</span>
          </button>
        </div>
      </div>

      {/* Center Stage */}
      <div
        className="w-full max-w-4xl mx-auto my-auto py-3 transition-opacity duration-500"
        style={{ opacity: fadeOpacity }}
      >
        {currentBeat.isEndingSummary && summary ? (
          <div className="bg-[#F3F0E7] border-2 border-[#303B38] p-5 sm:p-7 text-[#303B38] shadow-lg space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#303B38]/20 pb-3">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#D9A66C]/35 border border-[#303B38]/25 text-[12px] font-bold mb-1.5">
                  <Award className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{t('story.endingCard.badge')}</span>
                </div>
                <h2 className="text-[24px] sm:text-[28px] font-bold leading-tight">
                  {t(`story.endings.${summary.endingId}.title`)}
                </h2>
                <p className="text-[14px] text-[#303B38]/80 mt-0.5">
                  {state.config.companyName} · {t('story.endingCard.reachedDate', {
                    day: summary.endingDay,
                    month: summary.endingMonth,
                    year: summary.endingYear,
                  })}
                </p>
              </div>
              <div className="w-36 h-20 border-2 border-[#303B38] shrink-0 overflow-hidden hidden sm:block">
                <CinematicCanvasStage
                  visual={
                    summary.endingId === 'DREAM_COMPANY'
                      ? 'ENDING_DREAM_SKYLINE'
                      : summary.endingId === 'SMALL_BUT_HAPPY'
                        ? 'ENDING_COZY_COFFEE'
                        : summary.endingId === 'ACQUISITION'
                          ? 'ENDING_ACQUISITION_PRESS'
                          : summary.endingId === 'BURNOUT'
                            ? 'ENDING_BURNOUT_NIGHT'
                            : summary.endingId === 'LAST_DAY'
                              ? 'ENDING_LAST_DAY_BOXES'
                              : 'ENDING_LEGACY_FUTURE'
                  }
                  companyName={state.config.companyName}
                  founderAppearance={state.founder.appearance}
                  employees={state.employees}
                  compact
                />
              </div>
            </div>

            <blockquote className="bg-[#FAF8F2] border border-[#303B38]/25 px-4 py-3 text-[16px] font-bold italic text-[#303B38]">
              “{t(`story.endings.${summary.endingId}.message`)}”
            </blockquote>

            {/* Evaluated Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[13px]">
              <div className="bg-[#FAF8F2] border border-[#303B38]/20 p-2.5">
                <div className="text-[#303B38]/70">{t('story.endingCard.valuation')}</div>
                <div className="font-mono-num font-bold text-[15px]">
                  {formatCurrency(summary.stats.valuation)}
                </div>
              </div>
              <div className="bg-[#FAF8F2] border border-[#303B38]/20 p-2.5">
                <div className="text-[#303B38]/70">{t('story.endingCard.revenue')}</div>
                <div className="font-mono-num font-bold text-[15px]">
                  {formatCurrency(summary.stats.cumulativeRevenue)}
                </div>
              </div>
              <div className="bg-[#FAF8F2] border border-[#303B38]/20 p-2.5">
                <div className="text-[#303B38]/70">{t('story.endingCard.moraleCulture')}</div>
                <div className="font-mono-num font-bold text-[15px]">
                  {summary.stats.avgMorale}% / {summary.stats.cultureScore}%
                </div>
              </div>
              <div className="bg-[#FAF8F2] border border-[#303B38]/20 p-2.5">
                <div className="text-[#303B38]/70">{t('story.endingCard.chapterTeam')}</div>
                <div className="font-mono-num font-bold text-[15px]">
                  Ch.{summary.chapterReached} · {summary.stats.employeesCount}
                </div>
              </div>
            </div>

            {/* Major Decisions Summary */}
            {summary.majorChoices.length > 0 && (
              <div className="bg-[#FAF8F2] border border-[#303B38]/20 p-3">
                <div className="text-[13px] font-bold mb-1.5">
                  {t('story.endingCard.majorChoicesTitle')}
                </div>
                <ul className="space-y-1 text-[13px] text-[#303B38]/85 max-h-28 overflow-y-auto">
                  {summary.majorChoices.map((ch) => {
                    const tpl = getStoryEventTemplate(ch.eventId);
                    const choiceMeta = tpl?.choices.find((c) => c.id === ch.choiceId);
                    return (
                      <li key={`${ch.eventId}_${ch.day}`} className="flex items-center justify-between gap-2">
                        <span className="truncate">
                          • {tpl ? t(tpl.titleKey) : ch.eventId}:{' '}
                          <strong>{choiceMeta ? t(choiceMeta.labelKey) : ch.choiceId}</strong>
                        </span>
                        <span className="text-[12px] text-[#303B38]/65 shrink-0 font-mono-num">
                          {t('hud.dayShort', { day: ch.day })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Actions (with explicit confirmation before starting new company) */}
            {!confirmNewGame ? (
              <div className="flex flex-wrap gap-2.5 pt-1">
                {isReplay ? (
                  <button
                    type="button"
                    onClick={() => onComplete(false)}
                    className="min-h-[44px] flex-1 bg-[#78978A] hover:bg-[#6A897C] border-2 border-[#303B38] font-bold px-4 py-2 text-[14px] cursor-pointer"
                  >
                    {t('common.close')}
                  </button>
                ) : (
                  <>
                    {onOpenGallery && (
                      <button
                        type="button"
                        onClick={onOpenGallery}
                        className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#D9A66C]/35 hover:bg-[#D9A66C]/55 border border-[#303B38] font-bold text-[14px] cursor-pointer"
                      >
                        <Award className="w-4 h-4" aria-hidden="true" />
                        <span>{t('story.gallery.openBtn')}</span>
                      </button>
                    )}
                    {onContinueSandbox && summary.endingId !== 'LAST_DAY' && (
                      <button
                        type="button"
                        onClick={onContinueSandbox}
                        className="min-h-[44px] flex-1 bg-[#78978A] hover:bg-[#6A897C] border-2 border-[#303B38] font-bold px-4 py-2 text-[14px] cursor-pointer"
                      >
                        {t('endgame.continueSandbox')}
                      </button>
                    )}
                    {onStartNewGame && (
                      <button
                        type="button"
                        onClick={() => setConfirmNewGame(true)}
                        className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#FAF8F2] hover:bg-[#EAE5D8] border border-[#303B38]/35 font-bold text-[14px] cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" aria-hidden="true" />
                        <span>{t('story.endingCard.newCompanyBtn')}</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="bg-[#FAF8F2] border-2 border-[#303B38] p-3.5 space-y-2.5">
                <div className="text-[14px] font-bold">
                  {t('story.endingCard.confirmNewGameBody')}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmNewGame(false)}
                    className="min-h-[42px] flex-1 bg-[#F3F0E7] hover:bg-[#EAE5D8] border border-[#303B38]/35 font-bold text-[14px] cursor-pointer"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onStartNewGame?.()}
                    className="min-h-[42px] flex-1 bg-[#303B38] hover:bg-[#3F4D49] text-[#F3F0E7] font-bold text-[14px] cursor-pointer"
                  >
                    {t('story.endingCard.confirmNewGameAction')}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="relative w-full aspect-video max-h-[56vh] border-2 border-[#303B38] shadow-xl overflow-hidden bg-[#242D2B]">
            <CinematicCanvasStage
              visual={currentBeat.visual}
              companyName={state.config.companyName}
              founderAppearance={state.founder.appearance}
              employees={state.employees}
              cameraPan={currentBeat.cameraPan}
              gameState={state}
            />

            {currentBeat.isTitleCard && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#303B38]/60 text-center px-4">
                <div className="bg-[#F3F0E7] border-2 border-[#303B38] px-6 py-5 sm:px-9 sm:py-6 shadow-md max-w-md">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#D9A66C]/35 border border-[#303B38]/25 text-[12px] font-bold text-[#303B38] mb-2">
                    <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{state.config.companyName}</span>
                  </div>
                  <h1 className="text-[22px] sm:text-[26px] font-bold text-[#303B38] tracking-tight">
                    {t(currentBeat.textKey)}
                  </h1>
                  {currentBeat.subtextKey && (
                    <p className="text-[15px] font-bold text-[#78978A] mt-1">
                      {t(currentBeat.subtextKey)}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Dialogue Box (hidden on final ending card since summary itself shows final text & buttons) */}
      <div className="w-full max-w-4xl mx-auto">
        {!currentBeat.isEndingSummary && (
          <DialogueBox
            speaker={
              currentBeat.speakerKey
                ? currentBeat.speakerKey === 'story.speakers.founder'
                  ? state.founder.name
                  : currentBeat.speakerKey === 'story.speakers.teamLead' &&
                      state.employees[0]
                    ? state.employees[0].name
                    : t(currentBeat.speakerKey)
                : undefined
            }
            text={
              currentBeat.isTitleCard
                ? t('story.intro.readyDay1', { company: state.config.companyName })
                : t(currentBeat.textKey, { company: state.config.companyName })
            }
            subtext={currentBeat.subtextKey ? t(currentBeat.subtextKey) : undefined}
            avatar={speakerAvatar?.appearance ?? null}
            isFounder={speakerAvatar?.isFounder ?? false}
            moodTone={speakerAvatar?.mood ?? 'NEUTRAL'}
            textSpeed={textSpeed}
            autoAdvance={autoAdvance}
            showSubtitles={showSubtitles}
            isLastBeat={isLastBeat}
            onAdvance={handleAdvance}
          />
        )}
      </div>
    </div>
  );
};
