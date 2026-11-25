import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  Crown,
  Lock,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { buildMilestoneTimeline } from '@/src/game/systems/milestoneTimeline';
import { useLocalization } from '@/src/hooks/useLocalization';
import {
  getAchievementLocalized,
  getAchievementProgressLocalized,
  getMilestoneLocalized,
} from '@/src/localization/i18n';
import { GameState } from '@/src/types/game';
import { ModalFrame } from './ModalFrame';

export type MilestonesTab = 'MILESTONES' | 'TIMELINE' | 'ACHIEVEMENTS';
type TimelineFilter = 'ALL' | 'COMPLETED' | 'UPCOMING';

interface MilestonesPanelProps {
  state: GameState;
  initialTab?: MilestonesTab;
  onOpenStoryGallery?: () => void;
  onClose: () => void;
}

export const MilestonesPanel: React.FC<MilestonesPanelProps> = ({
  state,
  initialTab = 'MILESTONES',
  onOpenStoryGallery,
  onClose,
}) => {
  const { locale, t, formatCurrency } = useLocalization();
  const [activeTab, setActiveTab] = useState<MilestonesTab>(initialTab);
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>('ALL');

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const unlockedCount = state.milestones.filter((m) => m.unlocked).length;
  const achievements = state.achievements ?? [];
  const unlockedAchCount = achievements.filter((a) => a.unlocked).length;
  const totalCustomers = state.products.reduce((s, p) => s + p.payingCustomers, 0);

  const timeline = useMemo(
    () => buildMilestoneTimeline(state, locale),
    [state, locale]
  );

  const filteredTimelineEntries = useMemo(() => {
    if (timelineFilter === 'COMPLETED') {
      return timeline.entries.filter((e) => e.status === 'COMPLETED');
    }
    if (timelineFilter === 'UPCOMING') {
      return timeline.entries.filter(
        (e) => e.status === 'CURRENT' || e.status === 'UPCOMING'
      );
    }
    return timeline.entries;
  }, [timeline.entries, timelineFilter]);

  return (
    <ModalFrame
      title={t('milestones.title')}
      subtitle={t('milestones.subtitle', {
        mode:
          state.config.gameMode === 'CAMPAIGN'
            ? t('milestones.modeCampaign')
            : t('milestones.modeSandbox'),
        msUnlocked: unlockedCount,
        msTotal: state.milestones.length,
        achUnlocked: unlockedAchCount,
        achTotal: achievements.length,
      })}
      onClose={onClose}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-[#FAF8F2] border border-[#303B38]/25 p-3.5">
            <div className="text-[13px] text-[#303B38]/80">{t('milestones.founderLevel')}</div>
            <div className="font-mono-num text-[20px] font-bold text-[#303B38] mt-0.5">
              {t('milestones.levelValue', {
                level: state.founder.level,
                lead: state.founder.leadership,
              })}
            </div>
          </div>
          <div className="bg-[#FAF8F2] border border-[#303B38]/25 p-3.5">
            <div className="text-[13px] text-[#303B38]/80">{t('milestones.reputation')}</div>
            <div className="font-mono-num text-[20px] font-bold text-[#303B38] mt-0.5">
              {Math.round(state.founder.reputation)}/100
            </div>
          </div>
          <div className="bg-[#FAF8F2] border border-[#303B38]/25 p-3.5">
            <div className="text-[13px] text-[#303B38]/80">{t('milestones.investorTrust')}</div>
            <div className="font-mono-num text-[20px] font-bold text-[#303B38] mt-0.5">
              {Math.round(state.founder.investorTrust ?? 55)}/100
            </div>
          </div>
          <div className="bg-[#FAF8F2] border border-[#303B38]/25 p-3.5">
            <div className="text-[13px] text-[#303B38]/80">{t('milestones.personalCash')}</div>
            <div className="font-mono-num text-[20px] font-bold text-[#303B38] mt-0.5">
              {formatCurrency(state.founder.personalCash ?? 0)}
            </div>
          </div>
          <div className="bg-[#FAF8F2] border border-[#303B38]/25 p-3.5">
            <div className="text-[13px] text-[#303B38]/80">{t('milestones.payingCustomers')}</div>
            <div className="font-mono-num text-[20px] font-bold text-[#303B38] mt-0.5">
              {totalCustomers}
            </div>
          </div>
          <div className="bg-[#FAF8F2] border border-[#303B38]/25 p-3.5">
            <div className="text-[13px] text-[#303B38]/80">{t('milestones.daysOperated')}</div>
            <div className="font-mono-num text-[20px] font-bold text-[#303B38] mt-0.5">
              {t('milestones.daysUnit', { days: state.totalDays })}
            </div>
          </div>
        </div>

        {/* Section Tabs */}
        <div
          className="flex flex-wrap border-b border-[#303B38]/25 gap-2 pb-1 sm:pb-0"
          role="tablist"
          aria-label={t('milestones.title')}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'MILESTONES'}
            onClick={() => setActiveTab('MILESTONES')}
            className={`min-h-[44px] flex items-center gap-2 px-3.5 py-2 text-[14px] font-bold border-t border-x border-b sm:border-b-0 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'MILESTONES'
                ? 'bg-[#78978A] border-[#303B38] text-[#303B38]'
                : 'bg-[#FAF8F2] border-[#303B38]/20 text-[#303B38]/80 hover:text-[#303B38]'
            }`}
          >
            <Trophy className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>
              {t('milestones.tabMilestones', {
                unlocked: unlockedCount,
                total: state.milestones.length,
              })}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'TIMELINE'}
            onClick={() => setActiveTab('TIMELINE')}
            className={`min-h-[44px] flex items-center gap-2 px-3.5 py-2 text-[14px] font-bold border-t border-x border-b sm:border-b-0 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'TIMELINE'
                ? 'bg-[#78978A] border-[#303B38] text-[#303B38]'
                : 'bg-[#FAF8F2] border-[#303B38]/20 text-[#303B38]/80 hover:text-[#303B38]'
            }`}
          >
            <CalendarDays className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{t('milestones.tabTimeline')}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'ACHIEVEMENTS'}
            onClick={() => setActiveTab('ACHIEVEMENTS')}
            className={`min-h-[44px] flex items-center gap-2 px-3.5 py-2 text-[14px] font-bold border-t border-x border-b sm:border-b-0 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'ACHIEVEMENTS'
                ? 'bg-[#78978A] border-[#303B38] text-[#303B38]'
                : 'bg-[#FAF8F2] border-[#303B38]/20 text-[#303B38]/80 hover:text-[#303B38]'
            }`}
          >
            <Award className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>
              {t('milestones.tabAchievements', {
                unlocked: unlockedAchCount,
                total: achievements.length,
              })}
            </span>
          </button>
          {onOpenStoryGallery && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenStoryGallery();
              }}
              className="sm:ml-auto min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 text-[14px] font-bold border border-[#303B38]/35 bg-[#D9A66C]/30 hover:bg-[#D9A66C]/50 text-[#303B38] cursor-pointer whitespace-nowrap shrink-0"
            >
              <BookOpen className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{t('story.gallery.openBtn')}</span>
            </button>
          )}
        </div>

        {activeTab === 'MILESTONES' ? (
          <div className="space-y-2.5">
            <h3 className="font-bold text-[20px] text-[#303B38]">
              {t('milestones.progressionTitle')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {state.milestones.map((ms) => {
                const msLoc = getMilestoneLocalized(ms.id, ms.title, ms.description, locale);
                return (
                  <div
                    key={ms.id}
                    className={`border p-4 flex items-start gap-3 ${
                      ms.unlocked
                        ? 'bg-[#78978A]/20 border-[#303B38]'
                        : 'bg-[#FAF8F2] border-[#303B38]/25'
                    }`}
                  >
                    {ms.unlocked ? (
                      <CheckCircle2 className="w-5 h-5 text-[#303B38] shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-5 h-5 text-[#303B38]/55 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between items-center gap-2">
                        <span className="font-bold text-[15px] text-[#303B38]">{msLoc.title}</span>
                        <span className="font-mono-num text-[13px] font-bold text-[#303B38] shrink-0">
                          +{formatCurrency(ms.rewardCash)}
                        </span>
                      </div>
                      <p className="text-[14px] text-[#303B38]/85 mt-1">{msLoc.description}</p>
                      {ms.unlocked && ms.unlockedDay && (
                        <div className="text-[13px] font-mono-num font-bold text-[#303B38] mt-1.5">
                          {t('milestones.unlockedOnDay', { day: ms.unlockedDay })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : activeTab === 'TIMELINE' ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="font-bold text-[20px] text-[#303B38]">
                  {t('milestones.timeline.title')}
                </h3>
                <p className="text-[13px] text-[#303B38]/75 font-mono-num mt-0.5">
                  {t('milestones.timeline.summaryLine', {
                    completed: timeline.completedCount,
                    current: timeline.currentCount,
                    upcoming: timeline.upcomingCount,
                  })}
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5 bg-[#EAE5D8] p-1 border border-[#303B38]/20">
                <button
                  type="button"
                  onClick={() => setTimelineFilter('ALL')}
                  className={`min-h-[40px] px-3 py-1.5 text-[13px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                    timelineFilter === 'ALL'
                      ? 'bg-[#FAF8F2] text-[#303B38] border border-[#303B38]'
                      : 'text-[#303B38]/75 hover:text-[#303B38] border border-transparent'
                  }`}
                >
                  {t('milestones.timeline.filterAll', {
                    count: timeline.entries.length,
                  })}
                </button>
                <button
                  type="button"
                  onClick={() => setTimelineFilter('COMPLETED')}
                  className={`min-h-[40px] px-3 py-1.5 text-[13px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                    timelineFilter === 'COMPLETED'
                      ? 'bg-[#FAF8F2] text-[#303B38] border border-[#303B38]'
                      : 'text-[#303B38]/75 hover:text-[#303B38] border border-transparent'
                  }`}
                >
                  {t('milestones.timeline.filterCompleted', {
                    count: timeline.completedCount,
                  })}
                </button>
                <button
                  type="button"
                  onClick={() => setTimelineFilter('UPCOMING')}
                  className={`min-h-[40px] px-3 py-1.5 text-[13px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                    timelineFilter === 'UPCOMING'
                      ? 'bg-[#FAF8F2] text-[#303B38] border border-[#303B38]'
                      : 'text-[#303B38]/75 hover:text-[#303B38] border border-transparent'
                  }`}
                >
                  {t('milestones.timeline.filterUpcoming', {
                    count: timeline.currentCount + timeline.upcomingCount,
                  })}
                </button>
              </div>
            </div>

            {/* Milestone Timeline Summary Statistics */}
            <section
              aria-label={t('milestones.timeline.statsLabel')}
              className="grid grid-cols-1 sm:grid-cols-3 gap-3"
            >
              <div className="bg-[#FAF8F2] border border-[#303B38]/25 p-3.5 flex flex-col justify-between gap-2 min-w-0">
                <div>
                  <div className="text-[13px] text-[#303B38]/80">
                    {t('milestones.timeline.completionLabel')}
                  </div>
                  <div className="font-mono-num text-[22px] font-bold text-[#303B38] leading-tight mt-0.5">
                    {timeline.summary.completionPercent}%
                  </div>
                </div>
                <div className="space-y-1.5">
                  <svg
                    className="w-full h-2 block border border-[#303B38]/25"
                    aria-hidden="true"
                  >
                    <rect x="0" y="0" width="100%" height="8" fill="#EAE5D8" />
                    <rect
                      x="0"
                      y="0"
                      width={`${timeline.summary.completionPercent}%`}
                      height="8"
                      fill="#78978A"
                    />
                  </svg>
                  <div className="text-[12px] font-mono-num text-[#303B38]/75">
                    {t('milestones.timeline.completionSub', {
                      completed: timeline.summary.completedCount,
                      total: timeline.summary.totalCount,
                    })}
                  </div>
                </div>
              </div>

              <div className="bg-[#FAF8F2] border border-[#303B38]/25 p-3.5 flex flex-col justify-between gap-2 min-w-0">
                <div>
                  <div className="text-[13px] text-[#303B38]/80">
                    {t('milestones.timeline.avgDaysLabel')}
                  </div>
                  <div className="font-mono-num text-[22px] font-bold text-[#303B38] leading-tight mt-0.5">
                    {timeline.summary.averageDaysPerMilestone !== null
                      ? t('milestones.timeline.avgDaysValue', {
                          days: new Intl.NumberFormat(locale, {
                            maximumFractionDigits: 1,
                          }).format(timeline.summary.averageDaysPerMilestone),
                        })
                      : t('milestones.timeline.avgDaysEmpty')}
                  </div>
                </div>
                <div className="text-[12px] font-mono-num text-[#303B38]/75">
                  {timeline.summary.averageDaysPerMilestone !== null
                    ? t('milestones.timeline.avgDaysSub', {
                        totalDays: timeline.summary.elapsedDays,
                      })
                    : t('milestones.timeline.avgDaysEmptySub')}
                </div>
              </div>

              <div
                className={`border p-3.5 flex flex-col justify-between gap-2 min-w-0 ${
                  timeline.summary.mostChallenging
                    ? 'bg-[#D9A66C]/18 border-[#303B38]'
                    : 'bg-[#EAE5D8]/60 border-[#303B38]/25'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#303B38]/85">
                    <Crown className="w-3.5 h-3.5 text-[#9A6826] shrink-0" aria-hidden="true" />
                    <span>{t('milestones.timeline.challengingLabel')}</span>
                  </div>
                  <div className="font-bold text-[15px] text-[#303B38] leading-snug mt-1 break-words">
                    {timeline.summary.mostChallenging
                      ? timeline.summary.mostChallenging.title
                      : t('milestones.timeline.challengingEmptyTitle')}
                  </div>
                </div>
                <div className="text-[12px] font-mono-num text-[#303B38]/80">
                  {timeline.summary.mostChallenging
                    ? t('milestones.timeline.challengingMeta', {
                        day: timeline.summary.mostChallenging.unlockedDay,
                        span: timeline.summary.mostChallenging.daysToReach,
                      })
                    : t('milestones.timeline.challengingEmptySub')}
                </div>
              </div>
            </section>

            {timeline.completedCount === 0 && timelineFilter === 'ALL' && (
              <div className="bg-[#FAF8F2] border border-[#303B38]/25 p-3.5 text-[14px] text-[#303B38]/85">
                {t('milestones.timeline.emptyCompleted')}
              </div>
            )}

            {filteredTimelineEntries.length === 0 ? (
              <div className="bg-[#FAF8F2] border border-[#303B38]/25 p-4 text-[14px] text-[#303B38]/75 text-center">
                {t('milestones.timeline.emptyFiltered')}
              </div>
            ) : (
              <div className="relative pl-6 sm:pl-7 space-y-3.5">
                {/* Vertical Timeline Spine */}
                <div
                  aria-hidden="true"
                  className="absolute left-2 sm:left-2.5 top-3 bottom-3 w-0.5 bg-[#303B38]/20"
                />

                {filteredTimelineEntries.map((entry) => {
                  const ms = entry.milestone;
                  const msLoc = getMilestoneLocalized(ms.id, ms.title, ms.description, locale);
                  const isCompleted = entry.status === 'COMPLETED';
                  const isCurrent = entry.status === 'CURRENT';
                  const pct = Math.round(entry.progressRatio * 100);
                  const statusLabel = isCompleted
                    ? t('milestones.timeline.statusCompleted')
                    : isCurrent
                      ? t('milestones.timeline.statusCurrent')
                      : t('milestones.timeline.statusUpcoming');
                  const rewardText = t('milestones.timeline.rewardSummary', {
                    cash: formatCurrency(ms.rewardCash),
                    rep: ms.rewardReputation,
                  });

                  return (
                    <article
                      key={ms.id}
                      className={`relative border p-4 transition-colors ${
                        isCompleted
                          ? 'bg-[#78978A]/16 border-[#303B38]'
                          : isCurrent
                            ? 'bg-[#FAF8F2] border-2 border-[#303B38]'
                            : 'bg-[#EAE5D8]/55 border-[#303B38]/25'
                      }`}
                    >
                      {/* Pixel Node Marker */}
                      <div
                        aria-hidden="true"
                        className={`absolute -left-[22px] sm:-left-[24px] top-5 w-3.5 h-3.5 border-2 border-[#303B38] ${
                          isCompleted
                            ? 'bg-[#78978A]'
                            : isCurrent
                              ? 'bg-[#D9A66C]'
                              : 'bg-[#F3F0E7]'
                        }`}
                      />

                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[12px] font-mono-num text-[#303B38]/80">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {isCompleted ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#5A786B] shrink-0" aria-hidden="true" />
                          ) : isCurrent ? (
                            <Clock className="w-3.5 h-3.5 text-[#A87535] shrink-0" aria-hidden="true" />
                          ) : (
                            <Circle className="w-3.5 h-3.5 text-[#303B38]/55 shrink-0" aria-hidden="true" />
                          )}
                          <span className="font-bold text-[#303B38]">{statusLabel}</span>
                          {entry.completedDateLabel && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{entry.completedDateLabel}</span>
                            </>
                          )}
                          {!isCompleted && entry.progressLabel && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{entry.progressLabel}</span>
                            </>
                          )}
                        </div>
                        <span className="font-bold text-[#303B38]">{rewardText}</span>
                      </div>

                      <h4 className="font-bold text-[16px] text-[#303B38] mt-1.5">
                        {msLoc.title}
                      </h4>
                      <p className="text-[14px] text-[#303B38]/85 mt-1 leading-snug">
                        {msLoc.description}
                      </p>

                      {isCurrent && (
                        <div className="mt-2.5 space-y-1">
                          <div className="flex items-center justify-between text-[12px] font-mono-num text-[#303B38]/80">
                            <span>{entry.progressLabel}</span>
                            <span className="font-bold text-[#303B38]">{pct}%</span>
                          </div>
                          <svg
                            className="w-full h-2 block border border-[#303B38]/30"
                            aria-hidden="true"
                          >
                            <rect x="0" y="0" width="100%" height="8" fill="#EAE5D8" />
                            <rect x="0" y="0" width={`${pct}%`} height="8" fill="#78978A" />
                          </svg>
                        </div>
                      )}

                      {entry.flavorText && (
                        <div className="mt-2.5 bg-[#F3F0E7] border border-[#303B38]/20 px-3 py-2 text-[13px] text-[#303B38]/90 flex items-start gap-2">
                          <Sparkles
                            className="w-3.5 h-3.5 text-[#D9A66C] shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                          <p className="italic leading-snug">
                            {entry.flavorText}
                          </p>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[20px] text-[#303B38]">
                {t('milestones.achievementsTitle')}
              </h3>
              <span className="text-[14px] font-mono-num font-bold text-[#303B38]">
                {t('milestones.unlockedRatio', {
                  unlocked: unlockedAchCount,
                  total: achievements.length,
                })}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {achievements.map((ach) => {
                const progressText = getAchievementProgressLocalized(state, ach.id, locale);
                const achLoc = getAchievementLocalized(ach.id, ach.title, ach.description, locale);
                return (
                  <div
                    key={ach.id}
                    className={`border p-4 flex items-start gap-3 ${
                      ach.unlocked
                        ? 'bg-[#78978A]/20 border-[#303B38]'
                        : 'bg-[#FAF8F2] border-[#303B38]/25'
                    }`}
                  >
                    {ach.unlocked ? (
                      <Award className="w-5 h-5 text-[#303B38] shrink-0 mt-0.5" />
                    ) : (
                      <Lock className="w-5 h-5 text-[#303B38]/55 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between items-center gap-2">
                        <span className="font-bold text-[15px] text-[#303B38]">{achLoc.title}</span>
                        <span className="text-[13px] font-mono-num bg-[#EAE5D8] text-[#303B38] border border-[#303B38]/25 px-2 py-0.5 shrink-0">
                          {t(`milestones.categories.${ach.category}`)}
                        </span>
                      </div>
                      <p className="text-[14px] text-[#303B38]/85 mt-1">{achLoc.description}</p>
                      <div className="mt-1.5 text-[13px] font-mono-num text-[#303B38]">
                        {ach.unlocked ? (
                          <span className="font-bold">
                            {t('milestones.unlockedOnDay', { day: ach.unlockedDay ?? 1 })}
                          </span>
                        ) : (
                          <span className="text-[#303B38]/80">
                            {t('milestones.progressPrefix', { text: progressText })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent Log */}
        <div className="border-t border-[#303B38]/20 pt-4">
          <h3 className="font-bold text-[20px] text-[#303B38] mb-2">
            {t('milestones.activityLog')}
          </h3>
          <div className="space-y-1.5 max-h-44 overflow-y-auto text-[14px] bg-[#FAF8F2] border border-[#303B38]/20 p-3">
            {state.notifications.slice(0, 12).map((n) => (
              <div key={n.id} className="flex gap-2.5 text-[#303B38]">
                <span className="font-mono-num text-[#303B38]/75 shrink-0">
                  {locale === 'vi-VN' ? `N${n.day}` : `D${n.day}`}
                </span>
                <span className={n.type === 'ERROR' ? 'font-bold' : ''}>
                  {n.type === 'ERROR' ? t('milestones.alertTag') : ''}
                  {n.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ModalFrame>
  );
};
