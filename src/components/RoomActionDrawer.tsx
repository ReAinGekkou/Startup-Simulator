import React from 'react';
import {
  Award,
  Briefcase,
  Coffee,
  Lock,
  MessageSquare,
  Sparkles,
  Unlock,
  UserCheck,
  Volume2,
  X,
} from 'lucide-react';
import { getEmployeeVoiceLine } from '@/src/audio/voiceRegistry';
import { EMPLOYEE_TRAITS, ROLE_DEFINITIONS, TASK_LABELS } from '@/src/game/data/roles';
import { getRenderableFurniture, isFurnitureInUse } from '@/src/game/renderer/pixelRenderer';
import { getNextTraitForEmployee } from '@/src/game/systems/employeeSystem';
import { useLocalization } from '@/src/hooks/useLocalization';
import { useVoiceOver } from '@/src/hooks/useVoiceOver';
import {
  getFurnitureLocalized,
  getLevelTitleLocalized,
  getPersonalityLocalized,
  getRoomLocalized,
  getSkillLocalized,
  getTaskLocalized,
  getTraitLocalized,
} from '@/src/localization/i18n';
import { EmployeeTask, GameCommand, GameState, RoomId } from '@/src/types/game';
import { ActiveModal } from './GameHUD';
import { PixelAvatar } from './PixelAvatar';

interface RoomActionDrawerProps {
  state: GameState;
  selectedRoomId: RoomId | null;
  selectedEmployeeId: string | null;
  onClose: () => void;
  onDispatch: (cmd: GameCommand) => void;
  onOpenModal: (modal: ActiveModal) => void;
}

export const RoomActionDrawer: React.FC<RoomActionDrawerProps> = ({
  state,
  selectedRoomId,
  selectedEmployeeId,
  onClose,
  onDispatch,
  onOpenModal,
}) => {
  const { locale, t, formatCurrency } = useLocalization();
  const { speak } = useVoiceOver();

  const emp = selectedEmployeeId
    ? state.employees.find((e) => e.id === selectedEmployeeId)
    : null;
  const room = selectedRoomId ? state.office.rooms[selectedRoomId] : null;

  if (!emp && !room) return null;

  const localizedRoom = room ? getRoomLocalized(room.id, room.unlockCost, locale) : null;
  const empMoodTone: 'HAPPY' | 'NEUTRAL' | 'STRESSED' = emp
    ? emp.stress >= 70 || emp.morale < 40
      ? 'STRESSED'
      : emp.morale >= 70 && emp.stress < 45
        ? 'HAPPY'
        : 'NEUTRAL'
    : 'NEUTRAL';

  return (
    <aside
      aria-label={emp ? emp.name : localizedRoom?.name ?? room?.name}
      className="fixed right-2 sm:right-3 top-[5.25rem] sm:top-20 bottom-[136px] md:bottom-[76px] w-[min(22rem,calc(100vw-16px))] z-20 bg-[#F3F0E7] border-2 border-[#303B38] shadow-md flex flex-col overflow-hidden text-[#303B38]"
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[#303B38]/20 bg-[#FAF8F2]">
        <div className="flex items-center gap-3 min-w-0">
          {emp && (
            <PixelAvatar
              appearance={emp.appearance}
              size={48}
              moodTone={empMoodTone}
              status={emp.state}
            />
          )}
          <div className="min-w-0">
            <h2 className="text-[18px] font-bold text-[#303B38] truncate">
              {emp ? emp.name : localizedRoom?.name}
            </h2>
            <p className="text-[13px] text-[#303B38]/80 truncate">
              {emp
                ? getLevelTitleLocalized(emp.role, emp.level, locale)
                : room?.unlocked
                  ? t('rooms.levelLabel', { level: room.level })
                  : t('rooms.lockedLabel')}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-[#F3F0E7] hover:bg-[#EAE5D8] border border-[#303B38]/25 text-[#303B38] cursor-pointer shrink-0"
          aria-label={t('drawer.closeAria')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3.5 overflow-y-auto flex-1 text-[15px]">
        {emp ? (
          <>
            <div className="bg-[#FAF8F2] border border-[#303B38]/20 p-3 space-y-2 text-[14px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#303B38]/80">{t('drawer.currentActivity')}</span>
                <span className="font-bold text-[#303B38]">{t(`drawer.empStates.${emp.state}`)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#303B38]/80">{t('drawer.moodLabel')}</span>
                <span
                  className={`px-2 py-0.5 border text-[13px] font-bold ${
                    empMoodTone === 'HAPPY'
                      ? 'bg-[#78978A]/35 border-[#78978A] text-[#303B38]'
                      : empMoodTone === 'STRESSED'
                        ? 'bg-[#D68B7B]/35 border-[#D68B7B] text-[#303B38]'
                        : 'bg-[#D9A66C]/30 border-[#D9A66C] text-[#303B38]'
                  }`}
                >
                  {empMoodTone === 'HAPPY'
                    ? t('drawer.moodHappy')
                    : empMoodTone === 'STRESSED'
                      ? t('drawer.moodStressed')
                      : t('drawer.moodOkay')}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                onDispatch({
                  type: 'FOUNDER_INTERACT_EMPLOYEE',
                  employeeId: emp.id,
                  mode: 'MOTIVATE',
                })
              }
              className="w-full min-h-[44px] flex items-center justify-center gap-2 bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38] px-3 py-2 text-[14px] font-bold text-[#303B38] cursor-pointer"
            >
              <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{t('drawer.motivateBtn')}</span>
            </button>

            <details
              open={state.tutorial?.currentStep === 4}
              className="bg-[#FAF8F2] border border-[#303B38]/25 p-3"
            >
              <summary className="cursor-pointer text-[14px] font-bold text-[#303B38] select-none">
                {t('drawer.moreDetails')}
              </summary>

              <div className="mt-3 pt-3 border-t border-[#303B38]/15 space-y-3.5 text-[14px]">
                <div>
                  <label
                    htmlFor="drawer-emp-task"
                    className="block text-[13px] font-bold text-[#303B38] mb-1"
                  >
                    {t('drawer.assignedTask')}
                  </label>
                  <select
                    id="drawer-emp-task"
                    data-tutorial-target="drawer-task-select"
                    value={emp.assignedTask}
                    onChange={(e) =>
                      onDispatch({
                        type: 'ASSIGN_EMPLOYEE_TASK',
                        employeeId: emp.id,
                        task: e.target.value as EmployeeTask,
                      })
                    }
                    className="w-full min-h-[42px] bg-[#F3F0E7] border border-[#303B38]/30 px-3 py-2 text-[14px] text-[#303B38]"
                  >
                    {(Object.keys(TASK_LABELS) as EmployeeTask[]).map((taskId) => (
                      <option key={taskId} value={taskId}>
                        {getTaskLocalized(taskId, locale)}
                      </option>
                    ))}
                  </select>
                </div>

                {state.products.length > 0 && (
                  <div>
                    <label
                      htmlFor="drawer-emp-prod"
                      className="block text-[13px] font-bold text-[#303B38] mb-1"
                    >
                      {t('drawer.assignedProduct')}
                    </label>
                    <select
                      id="drawer-emp-prod"
                      value={emp.assignedProductId ?? ''}
                      onChange={(e) =>
                        onDispatch({
                          type: 'ASSIGN_EMPLOYEE_TASK',
                          employeeId: emp.id,
                          task: emp.assignedTask,
                          productId: e.target.value || null,
                        })
                      }
                      className="w-full min-h-[42px] bg-[#F3F0E7] border border-[#303B38]/30 px-3 py-2 text-[14px] text-[#303B38]"
                    >
                      {state.products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-1 text-[13px]">
                  <div className="flex justify-between">
                    <span className="text-[#303B38]/80">{t('drawer.personalityLabel')}</span>
                    <span className="font-bold">
                      {getPersonalityLocalized(emp.personality, locale).label}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#303B38]/80">{t('drawer.monthlySalary')}</span>
                    <span className="font-mono-num font-bold">
                      {formatCurrency(emp.monthlySalary)}
                      {t('common.perMonth')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#303B38]/80">{t('drawer.productivity')}</span>
                    <span className="font-mono-num font-bold">{emp.productivity}%</span>
                  </div>
                </div>

                <div className="space-y-2 text-[13px]">
                  {[
                    { key: 'energy', label: t('drawer.energy'), val: emp.energy },
                    { key: 'morale', label: t('drawer.morale'), val: emp.morale },
                    { key: 'stress', label: t('drawer.stress'), val: emp.stress },
                  ].map((m) => (
                    <div key={m.key}>
                      <div className="flex justify-between mb-1">
                        <span className="text-[#303B38]/85">{m.label}</span>
                        <span className="font-mono-num font-bold">{Math.round(m.val)}/100</span>
                      </div>
                      <div className="h-2 bg-[#EAE5D8] border border-[#303B38]/20">
                        <div
                          className={
                            m.key === 'stress' && m.val > 70
                              ? 'h-full bg-[#D68B7B]'
                              : 'h-full bg-[#78978A]'
                          }
                          style={{ width: `${Math.min(100, Math.max(0, m.val))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {(() => {
                  const primaryKey = ROLE_DEFINITIONS[emp.role].primarySkill;
                  const primaryLabel = getSkillLocalized(primaryKey, locale);
                  const skillVal = emp.skills[primaryKey];
                  const nextTrait = getNextTraitForEmployee(emp);
                  const unlockedDefs = (emp.traits ?? [])
                    .map((id) => EMPLOYEE_TRAITS.find((tr) => tr.id === id))
                    .filter((tr): tr is NonNullable<typeof tr> => Boolean(tr));
                  return (
                    <div className="pt-2.5 border-t border-[#303B38]/15 space-y-2 text-[13px]">
                      <div className="flex items-center justify-between">
                        <span className="text-[#303B38]/85">
                          {t('drawer.coreSkill', { skill: primaryLabel })}
                        </span>
                        <span className="font-mono-num font-bold">{skillVal}/100</span>
                      </div>
                      <div className="h-2 bg-[#EAE5D8] border border-[#303B38]/20">
                        <div
                          className="h-full bg-[#78978A]"
                          style={{ width: `${Math.min(100, Math.max(0, skillVal))}%` }}
                        />
                      </div>
                      {nextTrait ? (
                        <div
                          className="text-[13px] text-[#303B38]/80"
                          title={getTraitLocalized(nextTrait.id, locale).summary}
                        >
                          {t('drawer.nextTrait', {
                            name: getTraitLocalized(nextTrait.id, locale).name,
                            skill: getSkillLocalized(nextTrait.skillKey, locale),
                            req: nextTrait.requiredSkill,
                          })}
                        </div>
                      ) : (
                        <div className="text-[13px] font-bold text-[#303B38]">
                          {t('drawer.allTraitsMastered')}
                        </div>
                      )}
                      {unlockedDefs.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          {unlockedDefs.map((trait) => {
                            const locTrait = getTraitLocalized(trait.id, locale);
                            return (
                              <div
                                key={trait.id}
                                className="border border-[#303B38]/25 bg-[#F3F0E7] px-2.5 py-1.5"
                              >
                                <div className="flex items-center gap-1.5 font-bold text-[13px] text-[#303B38]">
                                  <Award className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                  <span>{locTrait.name}</span>
                                </div>
                                <p className="text-[13px] text-[#303B38]/80 mt-0.5 leading-snug">
                                  {locTrait.summary}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {(() => {
                  const voiceLine = getEmployeeVoiceLine(emp, locale);
                  return (
                    <div className="bg-[#EAE5D8] border border-[#303B38]/20 p-2.5 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-bold text-[#303B38]">
                          {t('drawer.dialogueLabel')}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            speak({
                              speaker: voiceLine.speaker,
                              text: voiceLine.text,
                              locale,
                              category: 'DIALOGUE',
                              userInitiated: true,
                            })
                          }
                          className="min-h-[34px] inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38]/30 text-[13px] font-bold text-[#303B38] cursor-pointer"
                        >
                          <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{t('drawer.speakLineBtn')}</span>
                        </button>
                      </div>
                      <p className="text-[13px] text-[#303B38] leading-snug">
                        "{voiceLine.text}"
                      </p>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      onDispatch({
                        type: 'FOUNDER_INTERACT_EMPLOYEE',
                        employeeId: emp.id,
                        mode: 'COACH',
                      })
                    }
                    className="min-h-[40px] flex items-center gap-2 bg-[#F3F0E7] hover:bg-[#EAE5D8] border border-[#303B38]/30 px-3 py-1.5 text-[13px] font-bold text-[#303B38] cursor-pointer text-left"
                  >
                    <UserCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>
                      {t('drawer.coachBtn', {
                        skill: getSkillLocalized(ROLE_DEFINITIONS[emp.role].primarySkill, locale),
                      })}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onDispatch({
                        type: 'FOUNDER_INTERACT_EMPLOYEE',
                        employeeId: emp.id,
                        mode: 'CHECK_IN',
                      })
                    }
                    className="min-h-[40px] flex items-center gap-2 bg-[#F3F0E7] hover:bg-[#EAE5D8] border border-[#303B38]/30 px-3 py-1.5 text-[13px] font-bold text-[#303B38] cursor-pointer text-left"
                  >
                    <MessageSquare className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{t('drawer.checkInBtn')}</span>
                  </button>
                </div>
              </div>
            </details>
          </>
        ) : room && !room.unlocked && localizedRoom ? (
          <div className="space-y-4">
            <div className="bg-[#FAF8F2] border border-[#303B38]/25 p-4 space-y-2">
              <div className="flex items-center gap-2 text-[15px] font-bold text-[#303B38]">
                <Lock className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{t('rooms.lockedLabel')}</span>
              </div>
              <p className="text-[14px] text-[#303B38] leading-relaxed">
                {localizedRoom.description}
              </p>
              <p className="text-[13px] font-bold text-[#303B38]/85 pt-1">
                {t('rooms.unlockRequirement')} {localizedRoom.unlockCondition}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onDispatch({ type: 'UNLOCK_ROOM', roomId: room.id })}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38]/35 px-3 py-2.5 text-[14px] font-bold text-[#303B38] cursor-pointer"
            >
              <Unlock className="w-4 h-4" aria-hidden="true" />
              {t('rooms.unlockEarly', { cost: formatCurrency(room.unlockCost) })}
            </button>
          </div>
        ) : room && localizedRoom ? (
          <>
            <p className="text-[15px] text-[#303B38] leading-relaxed">
              {localizedRoom.description}
            </p>

            <div className="pt-3 border-t border-[#303B38]/20 space-y-2.5">
              {room.id === 'CEO_OFFICE' && (
                <>
                  <div className="bg-[#FAF8F2] border border-[#303B38]/20 p-3 space-y-1.5 text-[14px] font-mono-num">
                    <div className="flex justify-between">
                      <span className="text-[#303B38]/80">{t('drawer.founderSalary')}</span>
                      <span className="font-bold">
                        {formatCurrency(state.founder.monthlySalary ?? 0)}
                        {t('common.perMonth')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#303B38]/80">{t('drawer.personalCash')}</span>
                      <span className="font-bold">
                        {formatCurrency(state.founder.personalCash ?? 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#303B38]/80">{t('drawer.investorTrust')}</span>
                      <span className="font-bold">
                        {Math.round(state.founder.investorTrust ?? 55)}/100
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDispatch({ type: 'FOUNDER_STRATEGY_SESSION' })}
                    className="w-full min-h-[44px] flex items-center gap-2 bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38]/35 text-[#303B38] font-bold px-3 py-2.5 text-[14px] cursor-pointer text-left"
                  >
                    <Briefcase className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{t('drawer.strategySprintBtn')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onDispatch({ type: 'REPORT_TUTORIAL_ACTION', action: 'REVIEW_FINANCE' });
                      onOpenModal('FINANCE');
                    }}
                    className="w-full min-h-[44px] bg-[#FAF8F2] hover:bg-[#EAE5D8] border border-[#303B38]/30 px-3 py-2 text-[14px] font-bold text-[#303B38] cursor-pointer text-left"
                  >
                    {t('drawer.adjustFinanceBtn')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenModal('MILESTONES')}
                    className="w-full min-h-[44px] bg-[#FAF8F2] hover:bg-[#EAE5D8] border border-[#303B38]/30 px-3 py-2 text-[14px] font-bold text-[#303B38] cursor-pointer text-left"
                  >
                    {t('drawer.viewMilestonesBtn')}
                  </button>
                </>
              )}

              {room.id === 'HR_DEPT' && (
                <button
                  type="button"
                  onClick={() => onOpenModal('EMPLOYEES')}
                  className="w-full min-h-[44px] bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38]/35 text-[#303B38] font-bold px-3 py-2.5 text-[14px] cursor-pointer"
                >
                  {t('drawer.openHrBtn')}
                </button>
              )}

              {room.id === 'FINANCE_DEPT' && (
                <button
                  type="button"
                  onClick={() => {
                    onDispatch({ type: 'REPORT_TUTORIAL_ACTION', action: 'REVIEW_FINANCE' });
                    onOpenModal('FINANCE');
                  }}
                  className="w-full min-h-[44px] bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38]/35 text-[#303B38] font-bold px-3 py-2.5 text-[14px] cursor-pointer"
                >
                  {t('drawer.openFinanceBtn')}
                </button>
              )}

              {room.id === 'ENGINEERING' && (
                <button
                  type="button"
                  onClick={() => onOpenModal('PRODUCTS')}
                  className="w-full min-h-[44px] bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38]/35 text-[#303B38] font-bold px-3 py-2.5 text-[14px] cursor-pointer"
                >
                  {t('drawer.openProductBtn')}
                </button>
              )}

              {(room.id === 'MEETING_ROOM' ||
                room.id === 'LOBBY' ||
                room.id === 'LEGAL_DEPT') && (
                <button
                  type="button"
                  onClick={() => onOpenModal('MARKET')}
                  className="w-full min-h-[44px] bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38]/35 text-[#303B38] font-bold px-3 py-2.5 text-[14px] cursor-pointer"
                >
                  {room.id === 'LEGAL_DEPT'
                    ? t('drawer.openLegalBtn')
                    : t('drawer.openMarketBtn')}
                </button>
              )}

              {room.id === 'BREAK_ROOM' && (
                <button
                  type="button"
                  onClick={() => onDispatch({ type: 'FOUNDER_REST' })}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38]/35 text-[#303B38] font-bold px-3 py-2.5 text-[14px] cursor-pointer"
                >
                  <Coffee className="w-4 h-4" aria-hidden="true" />
                  <span>{t('drawer.drinkEspressoBtn')}</span>
                </button>
              )}

              {room.level < 3 && (
                <button
                  type="button"
                  onClick={() => onDispatch({ type: 'UNLOCK_ROOM', roomId: room.id })}
                  className="w-full min-h-[44px] bg-[#FAF8F2] hover:bg-[#EAE5D8] border border-[#303B38]/30 px-3 py-2 text-[14px] font-bold text-[#303B38] cursor-pointer"
                >
                  {t('rooms.upgradeRoom', {
                    name: localizedRoom.name,
                    cost: formatCurrency(room.upgradeCost),
                  })}
                </button>
              )}
            </div>

            {(() => {
              const roomPerks = getRenderableFurniture(state.office).filter(
                (f) => f.roomId === room.id && f.templateId.startsWith('PERK_')
              );
              if (roomPerks.length === 0) return null;
              return (
                <div className="pt-3 border-t border-[#303B38]/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-bold text-[#303B38]">
                      {t('drawer.installedPerks', { count: roomPerks.length })}
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenModal('OFFICE')}
                      className="text-[13px] font-bold underline text-[#303B38] cursor-pointer"
                    >
                      {t('drawer.managePerks')}
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {roomPerks.map((perkFurn) => {
                      const inUse = isFurnitureInUse(perkFurn, state);
                      const locFurn = getFurnitureLocalized(
                        perkFurn.templateId,
                        perkFurn.name,
                        '',
                        locale
                      );
                      return (
                        <div
                          key={perkFurn.id}
                          className="bg-[#FAF8F2] border border-[#303B38]/20 px-3 py-2 flex items-center justify-between gap-2 text-[14px]"
                        >
                          <span className="truncate">{locFurn.name}</span>
                          <span className="text-[13px] font-mono-num font-bold shrink-0">
                            [{inUse ? t('drawer.inUse') : t('drawer.ready')}]
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {room.id === 'LOBBY' && state.visitors.length > 0 && (
              <div className="pt-3 border-t border-[#303B38]/20 space-y-2">
                <div className="text-[14px] font-bold text-[#303B38]">
                  {t('drawer.lobbyVisitors')}
                </div>
                {state.visitors.map((v) => (
                  <div
                    key={v.id}
                    className="bg-[#FAF8F2] border border-[#303B38]/20 p-3 text-[14px]"
                  >
                    <div className="font-bold text-[#303B38]">{v.name}</div>
                    <p className="text-[#303B38]/85 mt-1">{v.dialogue}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </aside>
  );
};
