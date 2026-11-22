import React, { useMemo, useState } from 'react';
import { Award, BookOpen, CheckCircle2, Lock, Play } from 'lucide-react';
import { ModalFrame } from '@/src/components/modals/ModalFrame';
import {
  ENDING_DEFINITIONS,
  ENDING_ORDER,
  STORY_CHAPTERS,
} from '@/src/game/data/storyData';
import { getStoryEventTemplate } from '@/src/game/systems/storyEventSystem';
import { useLocalization } from '@/src/hooks/useLocalization';
import { getUnlockedEndings } from '@/src/services/endingGalleryService';
import { loadMostRecentSave } from '@/src/services/saveService';
import {
  CinematicSceneId,
  EndingId,
  GameState,
  UnlockedEndingRecord,
} from '@/src/types/game';
import { CinematicCanvasStage } from './CinematicCanvasStage';
import { CinematicPlayer } from './CinematicPlayer';

interface EndingGalleryModalProps {
  state?: GameState;
  initialTab?: 'ENDINGS' | 'CHAPTERS';
  onClose: () => void;
}

function getEndingVisual(id: EndingId) {
  switch (id) {
    case 'DREAM_COMPANY':
      return 'ENDING_DREAM_SKYLINE' as const;
    case 'SMALL_BUT_HAPPY':
      return 'ENDING_COZY_COFFEE' as const;
    case 'ACQUISITION':
      return 'ENDING_ACQUISITION_PRESS' as const;
    case 'BURNOUT':
      return 'ENDING_BURNOUT_NIGHT' as const;
    case 'LAST_DAY':
      return 'ENDING_LAST_DAY_BOXES' as const;
    case 'LEGACY':
      return 'ENDING_LEGACY_FUTURE' as const;
  }
}

export const EndingGalleryModal: React.FC<EndingGalleryModalProps> = ({
  state,
  initialTab = 'CHAPTERS',
  onClose,
}) => {
  const { t, formatCurrency } = useLocalization();
  const [tab, setTab] = useState<'ENDINGS' | 'CHAPTERS'>(initialTab);
  const [selectedEndingId, setSelectedEndingId] = useState<EndingId | null>(null);
  const [replayCinematic, setReplayCinematic] = useState<{
    cinematicId: CinematicSceneId;
    record?: UnlockedEndingRecord | null;
  } | null>(null);

  const unlockedRecords = useMemo(() => getUnlockedEndings(), []);
  const unlockedMap = useMemo(() => {
    const map = new Map<EndingId, UnlockedEndingRecord>();
    for (const r of unlockedRecords) {
      map.set(r.endingId, r);
    }
    return map;
  }, [unlockedRecords]);

  // On Main Menu, display real chapter progression from the most recent valid save if available
  const effectiveState: GameState | undefined = useMemo(() => {
    if (state && state.screen !== 'TITLE_MENU') return state;
    const latest = loadMostRecentSave();
    return latest?.state ?? state;
  }, [state]);

  const completedChaptersCount = effectiveState?.story?.completedChapters?.length ?? 0;

  return (
    <>
      <ModalFrame
        title={t('story.gallery.openBtn')}
        subtitle={t('story.gallery.overviewSubtitle', {
          chapters: completedChaptersCount,
          totalChapters: STORY_CHAPTERS.length,
          unlocked: unlockedRecords.length,
          totalEndings: ENDING_ORDER.length,
        })}
        onClose={onClose}
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4 text-[14px] text-[#303B38]">
          {/* Section Tabs */}
          <div className="flex flex-wrap gap-2 border-b border-[#303B38]/20 pb-3">
            <button
              type="button"
              onClick={() => setTab('CHAPTERS')}
              className={`min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 border font-bold cursor-pointer whitespace-normal text-center ${
                tab === 'CHAPTERS'
                  ? 'bg-[#78978A] border-[#303B38] text-[#303B38]'
                  : 'bg-[#FAF8F2] border-[#303B38]/30 text-[#303B38] hover:bg-[#EAE5D8]'
              }`}
            >
              <BookOpen className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{t('story.gallery.tabChapters')}</span>
            </button>

            <button
              type="button"
              onClick={() => setTab('ENDINGS')}
              className={`min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 border font-bold cursor-pointer whitespace-normal text-center ${
                tab === 'ENDINGS'
                  ? 'bg-[#78978A] border-[#303B38] text-[#303B38]'
                  : 'bg-[#FAF8F2] border-[#303B38]/30 text-[#303B38] hover:bg-[#EAE5D8]'
              }`}
            >
              <Award className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                {t('story.gallery.tabEndings', {
                  unlocked: unlockedRecords.length,
                  total: ENDING_ORDER.length,
                })}
              </span>
            </button>
          </div>

          {tab === 'ENDINGS' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ENDING_ORDER.map((id) => {
                  const meta = ENDING_DEFINITIONS[id];
                  const record = unlockedMap.get(id);
                  const unlocked = Boolean(record);
                  const isSelected = selectedEndingId === id;

                  return (
                    <div
                      key={id}
                      className={`border-2 transition-colors p-3 flex flex-col gap-2.5 ${
                        unlocked
                          ? isSelected
                            ? 'bg-[#EAE5D8] border-[#303B38]'
                            : 'bg-[#FAF8F2] border-[#303B38]/35 hover:border-[#303B38]'
                          : 'bg-[#EAE5D8]/60 border-[#303B38]/20'
                      }`}
                    >
                      <div className="relative h-24 w-full border border-[#303B38]/35 overflow-hidden">
                        <CinematicCanvasStage
                          visual={getEndingVisual(id)}
                          companyName={record?.companyName ?? state?.config.companyName ?? 'BrightForge Labs'}
                          founderAppearance={state?.founder.appearance}
                          employees={state?.employees}
                          locked={!unlocked}
                          compact
                        />
                        <div className="absolute top-1.5 left-1.5 px-2 py-0.5 border border-[#303B38] text-[11px] font-bold bg-[#F3F0E7] text-[#303B38] inline-flex items-center gap-1">
                          {unlocked ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-[#78978A]" aria-hidden="true" />
                              <span>{t('story.gallery.unlockedBadge')}</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3 text-[#303B38]/75" aria-hidden="true" />
                              <span>{t('story.gallery.lockedBadge')}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex-1 space-y-1">
                        <h3 className="font-bold text-[16px] text-[#303B38]">
                          {unlocked ? t(meta.titleKey) : t('story.gallery.lockedTitle')}
                        </h3>
                        {unlocked && record ? (
                          <>
                            <p className="text-[13px] italic text-[#303B38]/85 leading-snug">
                              “{t(meta.messageKey)}”
                            </p>
                            <div className="text-[12px] text-[#303B38]/70 font-mono-num pt-1">
                              {record.companyName} · {t('story.endingCard.reachedDate', {
                                day: record.summary.endingDay,
                                month: record.summary.endingMonth,
                                year: record.summary.endingYear,
                              })}
                            </div>
                          </>
                        ) : (
                          <p className="text-[13px] text-[#303B38]/75 leading-snug">
                            <span className="font-bold">{t('story.gallery.hintLabel')}: </span>
                            {t(meta.hintKey)}
                          </p>
                        )}
                      </div>

                      {unlocked && record && (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedEndingId((cur) => (cur === id ? null : id))
                            }
                            className="min-h-[36px] flex-1 px-2.5 py-1 bg-[#F3F0E7] hover:bg-[#EAE5D8] border border-[#303B38]/35 text-[12px] font-bold cursor-pointer"
                          >
                            {isSelected
                              ? t('story.gallery.hideDetails')
                              : t('story.gallery.viewDetails')}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setReplayCinematic({
                                cinematicId: meta.cinematicId,
                                record,
                              })
                            }
                            className="min-h-[36px] inline-flex items-center justify-center gap-1 px-3 py-1 bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38] text-[12px] font-bold cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                            <span>{t('story.gallery.replayEnding')}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Expanded Details for Selected Unlocked Ending */}
              {selectedEndingId && unlockedMap.get(selectedEndingId) && (() => {
                const rec = unlockedMap.get(selectedEndingId)!;
                const s = rec.summary.stats;
                return (
                  <div className="bg-[#FAF8F2] border-2 border-[#303B38] p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-[16px]">
                          {t(ENDING_DEFINITIONS[selectedEndingId].titleKey)} — {rec.companyName}
                        </h4>
                        <div className="text-[12px] text-[#303B38]/75">
                          {t('story.gallery.founderLabel', { name: rec.founderName })} · Ch.{rec.summary.chapterReached}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setReplayCinematic({
                            cinematicId: ENDING_DEFINITIONS[selectedEndingId].cinematicId,
                            record: rec,
                          })
                        }
                        className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38] text-[13px] font-bold cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                        <span>{t('story.gallery.replayEnding')}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[13px]">
                      <div className="bg-[#F3F0E7] border border-[#303B38]/20 p-2">
                        <div className="text-[#303B38]/70">{t('story.endingCard.valuation')}</div>
                        <div className="font-mono-num font-bold">{formatCurrency(s.valuation)}</div>
                      </div>
                      <div className="bg-[#F3F0E7] border border-[#303B38]/20 p-2">
                        <div className="text-[#303B38]/70">{t('story.endingCard.revenue')}</div>
                        <div className="font-mono-num font-bold">{formatCurrency(s.cumulativeRevenue)}</div>
                      </div>
                      <div className="bg-[#F3F0E7] border border-[#303B38]/20 p-2">
                        <div className="text-[#303B38]/70">{t('story.endingCard.moraleCulture')}</div>
                        <div className="font-mono-num font-bold">{s.avgMorale}% / {s.cultureScore}%</div>
                      </div>
                      <div className="bg-[#F3F0E7] border border-[#303B38]/20 p-2">
                        <div className="text-[#303B38]/70">{t('endgame.daysOperated')}</div>
                        <div className="font-mono-num font-bold">{s.daysOperated}</div>
                      </div>
                    </div>

                    {rec.summary.majorChoices.length > 0 && (
                      <div>
                        <div className="text-[13px] font-bold mb-1">
                          {t('story.endingCard.majorChoicesTitle')}
                        </div>
                        <ul className="space-y-1 text-[13px] text-[#303B38]/85">
                          {rec.summary.majorChoices.map((ch) => {
                            const tpl = getStoryEventTemplate(ch.eventId);
                            const cm = tpl?.choices.find((c) => c.id === ch.choiceId);
                            return (
                              <li key={`${ch.eventId}_${ch.day}`}>
                                • {tpl ? t(tpl.titleKey) : ch.eventId}:{' '}
                                <strong>{cm ? t(cm.labelKey) : ch.choiceId}</strong>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Replay Intro Scene Card */}
              <div className="bg-[#FAF8F2] border border-[#303B38]/30 p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-[15px]">{t('story.intro.badge')}</div>
                  <div className="text-[13px] text-[#303B38]/75">
                    {t('story.intro.s5Subtitle')}
                  </div>
                </div>
                {effectiveState && (
                  <button
                    type="button"
                    onClick={() => setReplayCinematic({ cinematicId: 'INTRO' })}
                    className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#F3F0E7] hover:bg-[#EAE5D8] border border-[#303B38]/35 text-[13px] font-bold cursor-pointer whitespace-normal text-center"
                  >
                    <Play className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true" />
                    <span>{t('story.gallery.replayScene')}</span>
                  </button>
                )}
              </div>

              {/* 6 Chapters Progression List (compact cards, short descriptions) */}
              {STORY_CHAPTERS.map((ch) => {
                const isCompleted =
                  effectiveState?.story?.completedChapters.includes(ch.id) ?? false;
                const isUnlocked =
                  effectiveState?.story?.unlockedChapters.includes(ch.id) ?? false;
                return (
                  <div
                    key={ch.id}
                    className={`border p-3.5 flex flex-wrap items-center justify-between gap-3 ${
                      isCompleted
                        ? 'bg-[#FAF8F2] border-[#78978A]'
                        : isUnlocked
                          ? 'bg-[#FAF8F2] border-[#303B38]'
                          : 'bg-[#EAE5D8]/60 border-[#303B38]/20 opacity-85'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-[15px]">
                        <span className="font-bold text-[#303B38]/70">
                          {t('story.chapterPrefix', { n: ch.id })}
                        </span>
                        <span aria-hidden="true" className="text-[#303B38]/40">·</span>
                        <h4 className="font-bold text-[#303B38]">{t(ch.titleKey)}</h4>
                        <span aria-hidden="true" className="text-[#303B38]/40">·</span>
                        <span
                          className={`text-[12px] font-bold ${
                            isCompleted
                              ? 'text-[#5A786B]'
                              : isUnlocked
                                ? 'text-[#303B38]'
                                : 'text-[#303B38]/60'
                          }`}
                        >
                          {isCompleted
                            ? t('story.gallery.statusCompleted')
                            : isUnlocked
                              ? t('story.gallery.statusActive')
                              : t('story.gallery.statusLocked')}
                        </span>
                      </div>
                      <p className="text-[13px] text-[#303B38]/85">{t(ch.themeKey)}</p>
                      <p className="text-[12px] text-[#303B38]/65">
                        {t('story.gallery.milestoneGoal')}: {t(ch.milestoneKey)}
                      </p>
                    </div>

                    {isCompleted && effectiveState && (
                      <button
                        type="button"
                        onClick={() =>
                          setReplayCinematic({ cinematicId: ch.milestoneCinematic })
                        }
                        className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38] text-[12px] font-bold cursor-pointer shrink-0"
                      >
                        <Play className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true" />
                        <span>{t('story.gallery.replayScene')}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ModalFrame>

      {replayCinematic && effectiveState && (
        <CinematicPlayer
          cinematicId={replayCinematic.cinematicId}
          state={effectiveState}
          endingSummary={replayCinematic.record?.summary ?? null}
          isReplay
          onComplete={() => setReplayCinematic(null)}
        />
      )}
    </>
  );
};
