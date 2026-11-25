import React, { useState } from 'react';
import {
  Award,
  ChevronDown,
  ChevronUp,
  DollarSign,
  GraduationCap,
  Info,
  RefreshCw,
  TrendingUp,
  UserMinus,
  UserPlus,
  Volume2,
} from 'lucide-react';
import { getEmployeeVoiceLine } from '@/src/audio/voiceRegistry';
import { EMPLOYEE_TRAITS, ROLE_DEFINITIONS, TASK_LABELS } from '@/src/game/data/roles';
import { getNextTraitForEmployee } from '@/src/game/systems/employeeSystem';
import { useLocalization } from '@/src/hooks/useLocalization';
import { useVoiceOver } from '@/src/hooks/useVoiceOver';
import {
  getLevelTitleLocalized,
  getPersonalityLocalized,
  getRoleLocalized,
  getSkillLocalized,
  getTaskLocalized,
  getTraitLocalized,
} from '@/src/localization/i18n';
import { GameCommand, GameState, EmployeeSkills, EmployeeTask } from '@/src/types/game';
import { PixelAvatar } from '@/src/components/PixelAvatar';
import { Tooltip } from '@/src/components/Tooltip';
import { ModalFrame } from './ModalFrame';

interface EmployeePanelProps {
  state: GameState;
  onDispatch: (cmd: GameCommand) => void;
  onClose: () => void;
}

const ALL_SKILL_KEYS: Array<keyof EmployeeSkills> = [
  'engineering',
  'design',
  'marketing',
  'sales',
  'finance',
  'operations',
];

export const EmployeePanel: React.FC<EmployeePanelProps> = ({ state, onDispatch, onClose }) => {
  const { locale, t, formatCurrency } = useLocalization();
  const { speak } = useVoiceOver();
  const [tab, setTab] = useState<'ROSTER' | 'RECRUIT'>('ROSTER');
  const [expandedDetailsIds, setExpandedDetailsIds] = useState<Record<string, boolean>>({});

  const totalPayroll = state.employees.reduce((sum, emp) => sum + emp.monthlySalary, 0);

  const reportEmployeeInteraction = () => {
    if (
      state.tutorial?.active &&
      !state.tutorial.completed &&
      !state.tutorial.skipped &&
      !state.tutorial.reviewedEmployee
    ) {
      onDispatch({ type: 'REPORT_TUTORIAL_ACTION', action: 'REVIEW_EMPLOYEE' });
    }
  };

  const toggleDetails = (id: string) => {
    reportEmployeeInteraction();
    setExpandedDetailsIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <ModalFrame
      title={t('employees.title')}
      subtitle={t('employees.subtitle', {
        count: state.employees.length,
        max: state.office.maxEmployees,
        payroll: formatCurrency(totalPayroll),
      })}
      onClose={onClose}
      maxWidth="max-w-[1100px]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-4 pb-3 border-b border-[#303B38]/20 min-w-0">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <button
            type="button"
            data-tutorial-target="employee-roster-tab"
            onClick={() => setTab('ROSTER')}
            className={`min-h-[44px] max-w-full px-4 py-2 text-[14px] sm:text-[15px] font-bold border cursor-pointer transition-colors text-center leading-tight sm:whitespace-nowrap ${
              tab === 'ROSTER'
                ? 'bg-[#78978A] border-[#303B38] text-[#303B38]'
                : 'bg-[#FAF8F2] border-[#303B38]/25 text-[#303B38] hover:bg-[#EAE5D8]'
            }`}
          >
            {t('employees.currentTeam', { count: state.employees.length })}
          </button>
          <button
            type="button"
            onClick={() => setTab('RECRUIT')}
            className={`min-h-[44px] max-w-full px-4 py-2 text-[14px] sm:text-[15px] font-bold border cursor-pointer transition-colors text-center leading-tight sm:whitespace-nowrap ${
              tab === 'RECRUIT'
                ? 'bg-[#78978A] border-[#303B38] text-[#303B38]'
                : 'bg-[#FAF8F2] border-[#303B38]/25 text-[#303B38] hover:bg-[#EAE5D8]'
            }`}
          >
            {t('employees.hireCandidates', { count: state.candidates.length })}
          </button>
        </div>

        {tab === 'RECRUIT' && (
          <button
            type="button"
            onClick={() => onDispatch({ type: 'REFRESH_CANDIDATES' })}
            className="min-h-[44px] max-w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#FAF8F2] hover:bg-[#EAE5D8] border border-[#303B38]/30 text-[14px] font-bold text-[#303B38] cursor-pointer text-center leading-tight sm:whitespace-nowrap"
          >
            <RefreshCw className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{t('employees.refreshSearch', { cost: formatCurrency(250) })}</span>
          </button>
        )}
      </div>

      {tab === 'ROSTER' ? (
        state.employees.length === 0 ? (
          <div className="bg-[#FAF8F2] border border-[#303B38]/20 p-8 text-center">
            <p className="text-[15px] text-[#303B38]/85">{t('employees.emptyRoster')}</p>
          </div>
        ) : (
          <div className="space-y-4 min-w-0">
            {state.employees.map((emp, empIdx) => {
              const primarySkillKey = ROLE_DEFINITIONS[emp.role].primarySkill;
              const primarySkillLabel = getSkillLocalized(primarySkillKey, locale);
              const primarySkillValue = emp.skills[primarySkillKey];
              const personalityLabel = getPersonalityLocalized(emp.personality, locale).label;
              const empTitle = getLevelTitleLocalized(emp.role, emp.level, locale);
              const nextTrait = getNextTraitForEmployee(emp);
              const unlockedDefs = (emp.traits ?? [])
                .map((id) => EMPLOYEE_TRAITS.find((tr) => tr.id === id))
                .filter((tr): tr is NonNullable<typeof tr> => Boolean(tr));
              const cooldownLeft =
                emp.lastTrainedDay > 0 ? Math.max(0, 5 - (state.totalDays - emp.lastTrainedDay)) : 0;
              const isDetailsOpen = Boolean(expandedDetailsIds[emp.id]);
              const moodTone: 'HAPPY' | 'NEUTRAL' | 'STRESSED' =
                emp.stress >= 70 || emp.morale < 40
                  ? 'STRESSED'
                  : emp.morale >= 70 && emp.stress < 45
                    ? 'HAPPY'
                    : 'NEUTRAL';

              const statusText = t(`drawer.empStates.${emp.state}`);
              const statusBadgeStyle =
                emp.state === 'WORKING'
                  ? 'bg-[#78978A]/25 border-[#78978A] text-[#303B38]'
                  : emp.state === 'RESTING' || emp.state === 'MEETING' || emp.state === 'CHATTING'
                    ? 'bg-[#D9A66C]/25 border-[#D9A66C] text-[#303B38]'
                    : 'bg-[#EAE5D8] border-[#303B38]/25 text-[#303B38]/85';

              return (
                <article
                  key={emp.id}
                  onClick={reportEmployeeInteraction}
                  className="bg-[#FAF8F2] border border-[#303B38]/30 p-4 space-y-3.5 min-w-0 box-border"
                >
                  {/* 1. EMPLOYEE PROFILE HEADER: CSS Grid [Avatar] + [Name / Position & Level] + [Salary] */}
                  <div className="w-full grid grid-cols-[56px_minmax(0,1fr)] sm:grid-cols-[56px_minmax(0,1fr)_auto] items-start gap-3.5 min-w-0">
                    <PixelAvatar
                      appearance={emp.appearance}
                      size={56}
                      moodTone={moodTone}
                      status={emp.state}
                      statusLabel={`${emp.name} — ${statusText}`}
                    />

                    <div className="grid grid-cols-1 gap-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 min-w-0">
                        <h3 className="font-bold text-[18px] text-[#303B38] leading-snug break-words min-w-0">
                          {emp.name}
                        </h3>
                        <span className={`text-[13px] px-2 py-0.5 border font-bold leading-tight max-w-full ${statusBadgeStyle}`}>
                          {statusText}
                        </span>
                        <span className="text-[13px] px-2 py-0.5 bg-[#EAE5D8] border border-[#303B38]/25 text-[#303B38] leading-tight max-w-full">
                          {personalityLabel}
                        </span>
                        {emp.resignationWarning && (
                          <span className="text-[13px] px-2 py-0.5 bg-[#D68B7B]/30 border border-[#D68B7B] text-[#303B38] font-bold leading-tight max-w-full">
                            {t('employees.burnoutRisk')}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 text-[15px] font-medium text-[#303B38]/85 leading-snug break-words">
                        {empTitle}
                      </div>
                    </div>

                    <div className="col-span-2 sm:col-span-1 sm:min-w-[140px] sm:text-right bg-[#F3F0E7] border border-[#303B38]/20 px-3 py-1.5 min-w-0 box-border flex sm:block items-center justify-between gap-2">
                      <div className="text-[13px] text-[#303B38]/75 leading-tight min-w-0">
                        {t('employees.salaryLabel')}
                      </div>
                      <div className="text-[16px] font-bold font-mono-num text-[#303B38] whitespace-nowrap leading-snug">
                        {formatCurrency(emp.monthlySalary)}
                        {t('common.perMonth')}
                      </div>
                    </div>
                  </div>

                  {/* 2. EMPLOYEE STATISTICS GRID */}
                  <div className="pt-3 border-t border-[#303B38]/15 space-y-3 min-w-0">
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2.5 min-w-0">
                      <Tooltip hintKey="tooltips.empSkill" wrapperClassName="block min-w-0">
                        <div tabIndex={0} className="bg-[#F3F0E7] border border-[#303B38]/20 px-3 py-2 min-w-0 h-full cursor-help">
                          <div className="text-[13px] text-[#303B38]/80 leading-tight break-words">
                            {primarySkillLabel}
                          </div>
                          <div className="text-[16px] font-bold font-mono-num text-[#303B38] mt-0.5">
                            {primarySkillValue}
                          </div>
                        </div>
                      </Tooltip>
                      <Tooltip hintKey="tooltips.empOutput" wrapperClassName="block min-w-0">
                        <div tabIndex={0} className="bg-[#F3F0E7] border border-[#303B38]/20 px-3 py-2 min-w-0 h-full cursor-help">
                          <div className="text-[13px] text-[#303B38]/80 leading-tight break-words">
                            {t('employees.outputLabel').replace(':', '')}
                          </div>
                          <div className="text-[16px] font-bold font-mono-num text-[#303B38] mt-0.5">
                            {emp.productivity}%
                          </div>
                        </div>
                      </Tooltip>
                      <Tooltip hintKey="tooltips.empMorale" wrapperClassName="block min-w-0">
                        <div tabIndex={0} className="bg-[#F3F0E7] border border-[#303B38]/20 px-3 py-2 min-w-0 h-full cursor-help">
                          <div className="text-[13px] text-[#303B38]/80 leading-tight break-words">
                            {t('employees.moraleLabel').replace(':', '')}
                          </div>
                          <div className="text-[16px] font-bold font-mono-num text-[#303B38] mt-0.5">
                            {Math.round(emp.morale)}
                          </div>
                        </div>
                      </Tooltip>
                      <Tooltip hintKey="tooltips.empEnergy" wrapperClassName="block min-w-0">
                        <div tabIndex={0} className="bg-[#F3F0E7] border border-[#303B38]/20 px-3 py-2 min-w-0 h-full cursor-help">
                          <div className="text-[13px] text-[#303B38]/80 leading-tight break-words">
                            {t('employees.energyLabel').replace(':', '')}
                          </div>
                          <div className="text-[16px] font-bold font-mono-num text-[#303B38] mt-0.5">
                            {Math.round(emp.energy)}
                          </div>
                        </div>
                      </Tooltip>
                      <Tooltip hintKey="tooltips.empStress" wrapperClassName="block min-w-0">
                        <div
                          tabIndex={0}
                          className={`border px-3 py-2 min-w-0 h-full cursor-help ${
                            emp.stress >= 70
                              ? 'bg-[#D68B7B]/20 border-[#D68B7B]'
                              : 'bg-[#F3F0E7] border-[#303B38]/20'
                          }`}
                        >
                          <div className="text-[13px] text-[#303B38]/80 leading-tight break-words">
                            {t('employees.stressLabel').replace(':', '')}
                          </div>
                          <div className="text-[16px] font-bold font-mono-num text-[#303B38] mt-0.5">
                            {Math.round(emp.stress)}
                          </div>
                        </div>
                      </Tooltip>
                    </div>

                    {/* Skill Mastery Progress & Unlocked Traits */}
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] min-w-0">
                        <span className="text-[#303B38]/85 min-w-0">
                          {t('employees.masteryLabel', { skill: primarySkillLabel })}{' '}
                          <span className="font-mono-num font-bold text-[#303B38]">
                            {primarySkillValue}/100
                          </span>
                        </span>
                        {nextTrait ? (
                          <span
                            className="text-[#303B38]/80 min-w-0 break-words"
                            title={getTraitLocalized(nextTrait.id, locale).summary}
                          >
                            {t('employees.nextTraitHint', {
                              name: getTraitLocalized(nextTrait.id, locale).name,
                              skill: getSkillLocalized(nextTrait.skillKey, locale),
                              req: nextTrait.requiredSkill,
                            })}
                          </span>
                        ) : (
                          <span className="text-[#303B38] font-bold min-w-0">
                            {t('employees.allTraitsUnlocked')}
                          </span>
                        )}
                      </div>
                      <div className="h-2 bg-[#EAE5D8] border border-[#303B38]/25 overflow-hidden">
                        <div
                          className="h-full bg-[#78978A]"
                          style={{ width: `${Math.min(100, Math.max(0, primarySkillValue))}%` }}
                        />
                      </div>
                      {unlockedDefs.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-0.5 min-w-0">
                          {unlockedDefs.map((trait) => {
                            const locTrait = getTraitLocalized(trait.id, locale);
                            return (
                              <span
                                key={trait.id}
                                title={locTrait.summary}
                                className="inline-flex items-center gap-1 border border-[#303B38]/30 bg-[#78978A]/20 px-2.5 py-0.5 text-[13px] text-[#303B38] font-bold max-w-full"
                              >
                                <Award className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                <span className="break-words min-w-0">{locTrait.name}</span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3. RESPONSIVE ACTION TOOLBAR */}
                  <div
                    role="toolbar"
                    aria-label={emp.name}
                    className="pt-3 border-t border-[#303B38]/20 flex flex-wrap items-end justify-between gap-3 min-w-0"
                  >
                    {/* Task / Product Assignment */}
                    <div
                      role="group"
                      aria-label={t('employees.assignmentGroupLabel')}
                      className="w-full sm:w-auto sm:flex-1 sm:min-w-[260px] max-w-full flex flex-wrap items-end gap-2.5 min-w-0 box-border"
                    >
                      <div className="min-w-0 flex-1 basis-[160px] max-w-full">
                        <label
                          htmlFor={`emp-task-${emp.id}`}
                          className="block text-[13px] font-bold text-[#303B38]/80 mb-1"
                        >
                          {t('employees.assignTaskLabel')}
                        </label>
                        <Tooltip hintKey="tooltips.empTaskSelect" wrapperClassName="block w-full min-w-0">
                          <select
                            id={`emp-task-${emp.id}`}
                            data-tutorial-target={empIdx === 0 ? 'employee-task-select' : undefined}
                            aria-label={`${t('drawer.assignedTask')}: ${emp.name}`}
                            value={emp.assignedTask}
                            onChange={(e) =>
                              onDispatch({
                                type: 'ASSIGN_EMPLOYEE_TASK',
                                employeeId: emp.id,
                                task: e.target.value as EmployeeTask,
                              })
                            }
                            className="w-full max-w-full min-w-0 min-h-[44px] bg-[#F3F0E7] border border-[#303B38]/35 px-3 py-2 text-[14px] font-bold text-[#303B38] box-border cursor-pointer"
                          >
                            {(Object.keys(TASK_LABELS) as EmployeeTask[]).map((taskId) => (
                              <option key={taskId} value={taskId}>
                                {getTaskLocalized(taskId, locale)}
                              </option>
                            ))}
                          </select>
                        </Tooltip>
                      </div>

                      {state.products.length > 1 && (
                        <div className="min-w-0 flex-1 basis-[160px] max-w-full">
                          <label
                            htmlFor={`emp-prod-${emp.id}`}
                            className="block text-[13px] font-bold text-[#303B38]/80 mb-1"
                          >
                            {t('employees.selectProductLabel')}
                          </label>
                          <Tooltip hintKey="tooltips.empProductSelect" wrapperClassName="block w-full min-w-0">
                            <select
                              id={`emp-prod-${emp.id}`}
                              aria-label={`${t('drawer.assignedProduct')}: ${emp.name}`}
                              value={emp.assignedProductId ?? state.products[0]?.id ?? ''}
                              onChange={(e) =>
                                onDispatch({
                                  type: 'ASSIGN_EMPLOYEE_TASK',
                                  employeeId: emp.id,
                                  task: emp.assignedTask,
                                  productId: e.target.value || null,
                                })
                              }
                              className="w-full max-w-full min-w-0 min-h-[44px] bg-[#F3F0E7] border border-[#303B38]/35 px-3 py-2 text-[14px] font-bold text-[#303B38] box-border cursor-pointer"
                            >
                              {state.products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </Tooltip>
                        </div>
                      )}
                    </div>

                    {/* Training / Promotion / Bonus */}
                    <div
                      role="group"
                      aria-label={t('employees.developmentGroupLabel')}
                      className="w-full sm:w-auto max-w-full flex flex-col justify-between gap-1.5 min-w-0 box-border"
                    >
                      <div className="text-[13px] font-bold text-[#303B38]/80 leading-none">
                        {t('employees.developmentGroupLabel')}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <Tooltip
                          hintKey={
                            cooldownLeft > 0
                              ? 'employees.trainCooldownTooltip'
                              : 'employees.trainTooltip'
                          }
                          hintVars={
                            cooldownLeft > 0
                              ? { days: cooldownLeft }
                              : { cost: formatCurrency(600) }
                          }
                          wrapperClassName="inline-flex min-w-0 max-w-full flex-1 sm:flex-initial"
                        >
                          <button
                            type="button"
                            disabled={cooldownLeft > 0}
                            onClick={() => onDispatch({ type: 'TRAIN_EMPLOYEE', employeeId: emp.id })}
                            className="w-full min-h-[44px] min-w-0 max-w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#F3F0E7] hover:bg-[#EAE5D8] disabled:opacity-45 border border-[#303B38]/35 text-[14px] font-bold text-[#303B38] cursor-pointer text-center leading-tight sm:whitespace-nowrap box-border"
                          >
                            <GraduationCap className="w-4 h-4 shrink-0" aria-hidden="true" />
                            <span>
                              {cooldownLeft > 0
                                ? t('employees.trainCooldown', { days: cooldownLeft })
                                : t('employees.trainBtn', { cost: formatCurrency(600) })}
                            </span>
                          </button>
                        </Tooltip>

                        <Tooltip
                          hintKey="employees.promoteTooltip"
                          wrapperClassName="inline-flex min-w-0 max-w-full flex-1 sm:flex-initial"
                        >
                          <button
                            type="button"
                            disabled={emp.level >= 4}
                            onClick={() => onDispatch({ type: 'PROMOTE_EMPLOYEE', employeeId: emp.id })}
                            className="w-full min-h-[44px] min-w-0 max-w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#F3F0E7] hover:bg-[#EAE5D8] disabled:opacity-40 border border-[#303B38]/35 text-[14px] font-bold text-[#303B38] cursor-pointer text-center leading-tight sm:whitespace-nowrap box-border"
                          >
                            <TrendingUp className="w-4 h-4 shrink-0" aria-hidden="true" />
                            <span>{t('employees.promoteBtn')}</span>
                          </button>
                        </Tooltip>

                        <Tooltip
                          hintKey="employees.raiseTooltip"
                          hintVars={{ amount: formatCurrency(250) }}
                          wrapperClassName="inline-flex min-w-0 max-w-full flex-1 sm:flex-initial"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              onDispatch({ type: 'GIVE_RAISE', employeeId: emp.id, amount: 250 })
                            }
                            className="w-full min-h-[44px] min-w-0 max-w-full inline-flex items-center justify-center gap-1 px-3.5 py-2 bg-[#F3F0E7] hover:bg-[#EAE5D8] border border-[#303B38]/35 text-[14px] font-bold text-[#303B38] cursor-pointer text-center leading-tight sm:whitespace-nowrap box-border"
                          >
                            <DollarSign className="w-4 h-4 shrink-0" aria-hidden="true" />
                            <span>{t('employees.raiseBtn', { amount: formatCurrency(250) })}</span>
                          </button>
                        </Tooltip>
                      </div>
                    </div>

                    {/* Details & Roster Management */}
                    <div
                      role="group"
                      aria-label={t('employees.rosterGroupLabel')}
                      className="w-full sm:w-auto max-w-full flex flex-col justify-between gap-1.5 min-w-0 box-border"
                    >
                      <div className="text-[13px] font-bold text-[#303B38]/80 leading-none">
                        {t('employees.rosterGroupLabel')}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <button
                          type="button"
                          aria-expanded={isDetailsOpen}
                          onClick={() => toggleDetails(emp.id)}
                          className={`min-h-[44px] min-w-0 max-w-full flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 border text-[14px] font-bold cursor-pointer text-center leading-tight sm:whitespace-nowrap transition-colors box-border ${
                            isDetailsOpen
                              ? 'bg-[#78978A] border-[#303B38] text-[#303B38]'
                              : 'bg-[#F3F0E7] hover:bg-[#EAE5D8] border-[#303B38]/35 text-[#303B38]'
                          }`}
                        >
                          <Info className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span>
                            {isDetailsOpen
                              ? t('employees.hideDetailsBtn')
                              : t('employees.detailsBtn')}
                          </span>
                          {isDetailsOpen ? (
                            <ChevronUp className="w-4 h-4 shrink-0" aria-hidden="true" />
                          ) : (
                            <ChevronDown className="w-4 h-4 shrink-0" aria-hidden="true" />
                          )}
                        </button>

                        <Tooltip
                          hintKey="employees.releaseTooltip"
                          hintVars={{ name: emp.name }}
                          wrapperClassName="inline-flex min-w-0 max-w-full flex-1 sm:flex-initial"
                        >
                          <button
                            type="button"
                            onClick={() => onDispatch({ type: 'FIRE_EMPLOYEE', employeeId: emp.id })}
                            aria-label={t('employees.releaseTooltip', { name: emp.name })}
                            className="w-full min-h-[44px] min-w-0 max-w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#EAE5D8] hover:bg-[#303B38] hover:text-[#F3F0E7] border border-[#303B38]/35 text-[14px] font-bold text-[#303B38] cursor-pointer text-center leading-tight sm:whitespace-nowrap transition-colors box-border"
                          >
                            <UserMinus className="w-4 h-4 shrink-0" aria-hidden="true" />
                            <span>{t('employees.releaseBtn')}</span>
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  </div>

                  {/* EXPANDABLE EMPLOYEE DETAILS */}
                  {isDetailsOpen && (() => {
                    const roleLoc = getRoleLocalized(emp.role, locale);
                    const voiceLine = getEmployeeVoiceLine(emp, locale);
                    return (
                      <div className="bg-[#F3F0E7] border border-[#303B38]/20 p-3.5 space-y-3 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
                          <div className="text-[14px] font-bold text-[#303B38] min-w-0">
                            {t('employees.detailsSkillsTitle')}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-[13px] font-mono-num text-[#303B38]/80 min-w-0">
                            <span>{t('employees.detailsHiredDay', { day: emp.hiredDay })}</span>
                            <span>{t('employees.detailsXp', { xp: Math.round(emp.experience) })}</span>
                          </div>
                        </div>

                        <p className="text-[14px] text-[#303B38]/85 leading-snug min-w-0 break-words">
                          {roleLoc.description}
                        </p>

                        <div className="grid grid-cols-[repeat(auto-fit,minmax(115px,1fr))] gap-2 min-w-0">
                          {ALL_SKILL_KEYS.map((sk) => (
                            <div
                              key={sk}
                              className={`border px-2.5 py-1.5 text-[13px] min-w-0 ${
                                sk === primarySkillKey
                                  ? 'bg-[#78978A]/20 border-[#303B38]/40 font-bold'
                                  : 'bg-[#FAF8F2] border-[#303B38]/20'
                              }`}
                            >
                              <div className="text-[#303B38]/80 leading-tight break-words">
                                {getSkillLocalized(sk, locale)}
                              </div>
                              <div className="font-mono-num font-bold text-[#303B38] mt-0.5">
                                {emp.skills[sk]}
                              </div>
                            </div>
                          ))}
                        </div>

                        {unlockedDefs.length > 0 && (
                          <div className="space-y-1.5 min-w-0">
                            {unlockedDefs.map((trait) => {
                              const locTrait = getTraitLocalized(trait.id, locale);
                              return (
                                <div
                                  key={trait.id}
                                  className="bg-[#FAF8F2] border border-[#303B38]/20 px-3 py-2 text-[13px] min-w-0 break-words"
                                >
                                  <span className="font-bold text-[#303B38]">{locTrait.name}: </span>
                                  <span className="text-[#303B38]/85">{locTrait.summary}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div className="bg-[#EAE5D8] border border-[#303B38]/20 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0">
                          <p className="text-[14px] text-[#303B38] leading-snug min-w-0 break-words">
                            "{voiceLine.text}"
                          </p>
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
                            className="min-h-[44px] max-w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38]/35 text-[13px] font-bold text-[#303B38] cursor-pointer shrink-0 sm:whitespace-nowrap"
                          >
                            <Volume2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span>{t('drawer.speakLineBtn')}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </article>
              );
            })}
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 min-w-0">
          {state.candidates.map((c) => {
            const roleDef = ROLE_DEFINITIONS[c.role];
            const roleLoc = getRoleLocalized(c.role, locale);
            const primary = roleDef.primarySkill;
            const persLoc = getPersonalityLocalized(c.personality, locale);
            return (
              <div
                key={c.id}
                className="bg-[#FAF8F2] border border-[#303B38]/25 p-4 flex flex-col justify-between gap-3 min-w-0 box-border"
              >
                <div className="space-y-2.5 min-w-0">
                  <div className="grid grid-cols-[56px_minmax(0,1fr)] items-start gap-3 min-w-0">
                    <PixelAvatar appearance={c.appearance} size={56} moodTone="NEUTRAL" />
                    <div className="min-w-0 space-y-1">
                      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2 gap-y-0.5 min-w-0">
                        <span className="font-bold text-[17px] text-[#303B38] leading-snug break-words min-w-0">
                          {c.name}
                        </span>
                        <span className="text-[15px] font-mono-num font-bold text-[#303B38] whitespace-nowrap">
                          {formatCurrency(c.expectedSalary)}
                          {t('common.perMonth')}
                        </span>
                      </div>
                      <div className="text-[14px] text-[#303B38]/80 leading-snug break-words min-w-0">
                        {roleLoc.label} · {t('employees.candidateLevel', { level: c.level })} ·{' '}
                        {persLoc.label}
                      </div>
                    </div>
                  </div>
                  <p className="text-[14px] text-[#303B38]/90 leading-relaxed min-w-0">
                    {roleLoc.description}
                  </p>
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2 text-[13px] font-mono-num text-[#303B38]/90 min-w-0">
                    <div className="bg-[#F3F0E7] border border-[#303B38]/20 px-2.5 py-1.5 font-bold min-w-0 break-words">
                      {getSkillLocalized(primary, locale)}: {c.skills[primary]}
                    </div>
                    <div className="bg-[#F3F0E7] border border-[#303B38]/20 px-2.5 py-1.5 min-w-0 break-words">
                      {getSkillLocalized('engineering', locale)}: {c.skills.engineering}
                    </div>
                    <div className="bg-[#F3F0E7] border border-[#303B38]/20 px-2.5 py-1.5 min-w-0 break-words">
                      {getSkillLocalized('design', locale)}: {c.skills.design}
                    </div>
                    <div className="bg-[#F3F0E7] border border-[#303B38]/20 px-2.5 py-1.5 min-w-0 break-words">
                      {getSkillLocalized('marketing', locale)}: {c.skills.marketing}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onDispatch({ type: 'HIRE_CANDIDATE', candidateId: c.id })}
                  className="min-h-[44px] w-full flex items-center justify-center gap-2 bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38] text-[#303B38] font-bold py-2.5 px-4 text-[14px] cursor-pointer transition-colors"
                >
                  <UserPlus className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{t('employees.hireBtn', { fee: formatCurrency(c.hiringFee) })}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </ModalFrame>
  );
};
