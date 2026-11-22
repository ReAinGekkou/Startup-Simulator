import viVN from './locales/vi-VN.json';
import enUS from './locales/en-US.json';
import { getLocale, LocaleCode } from './localeStore';
import {
  ActiveEvent,
  EmployeePersonality,
  EmployeeRole,
  EmployeeSkills,
  EmployeeTask,
  EmployeeTraitId,
  GameState,
  MarketingChannel,
  MonthlyReport,
  ProductCategory,
  RoomId,
  StartupObjectiveId,
  TutorialStepId,
} from '@/src/types/game';
import { formatCurrency, formatNumber } from '@/src/utils/format';

type Dictionary = Record<string, unknown>;

const DICTIONARIES: Record<LocaleCode, Dictionary> = {
  'vi-VN': viVN as Dictionary,
  'en-US': enUS as Dictionary,
};

function lookupPath(dict: Dictionary, key: string): string | undefined {
  const parts = key.split('.');
  let current: unknown = dict;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

export function t(
  key: string,
  vars?: Record<string, string | number>,
  locale: LocaleCode = getLocale()
): string {
  const raw =
    lookupPath(DICTIONARIES[locale], key) ??
    lookupPath(DICTIONARIES['en-US'], key) ??
    key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, token: string) =>
    token in vars ? String(vars[token]) : `{${token}}`
  );
}

export function getRoomLocalized(
  roomId: RoomId,
  unlockCost = 0,
  locale: LocaleCode = getLocale()
): { name: string; description: string; unlockCondition: string } {
  const costStr = formatCurrency(unlockCost, false, locale);
  return {
    name: t(`rooms.items.${roomId}.name`, undefined, locale),
    description: t(`rooms.items.${roomId}.description`, undefined, locale),
    unlockCondition: t(`rooms.items.${roomId}.unlockCondition`, { cost: costStr }, locale),
  };
}

export function getOfficeLevelLocalized(
  level: 1 | 2 | 3 | 4,
  locale: LocaleCode = getLocale()
): { name: string; description: string } {
  return {
    name: t(`office.levels.${level}.name`, undefined, locale),
    description: t(`office.levels.${level}.description`, undefined, locale),
  };
}

export function getFurnitureLocalized(
  templateId: string,
  fallbackName: string,
  fallbackDesc = '',
  locale: LocaleCode = getLocale()
): { name: string; description: string } {
  const nameKey = `office.furniture.${templateId}.name`;
  const descKey = `office.furniture.${templateId}.description`;
  const translatedName = lookupPath(DICTIONARIES[locale], nameKey) ?? lookupPath(DICTIONARIES['en-US'], nameKey);
  const translatedDesc = lookupPath(DICTIONARIES[locale], descKey) ?? lookupPath(DICTIONARIES['en-US'], descKey);

  // Also localize perk-generated furniture
  if (templateId.startsWith('PERK_')) {
    const perkMap: Record<string, string> = {
      PERK_COFFEE_MACHINE: 'perk_coffee_machine',
      PERK_PING_PONG: 'perk_ping_pong',
      PERK_SNACK_PANTRY: 'perk_snack_pantry',
      PERK_QUIET_POD: 'perk_quiet_pods',
      PERK_WELLNESS_SUITE: 'perk_wellness_suite',
    };
    const perkId = perkMap[templateId];
    if (perkId) {
      return getPerkLocalized(perkId, locale);
    }
  }

  return {
    name: translatedName || fallbackName,
    description: translatedDesc || fallbackDesc,
  };
}

export function getPerkLocalized(
  perkId: string,
  locale: LocaleCode = getLocale()
): { name: string; description: string } {
  return {
    name: t(`office.perks.${perkId}.name`, undefined, locale),
    description: t(`office.perks.${perkId}.description`, undefined, locale),
  };
}

export function getRoleLocalized(
  role: EmployeeRole,
  locale: LocaleCode = getLocale()
): { label: string; short: string; description: string } {
  return {
    label: t(`employees.roles.${role}.label`, undefined, locale),
    short: t(`employees.roles.${role}.short`, undefined, locale),
    description: t(`employees.roles.${role}.description`, undefined, locale),
  };
}

export function getLevelTitleLocalized(
  role: EmployeeRole,
  level: 1 | 2 | 3 | 4,
  locale: LocaleCode = getLocale()
): string {
  const tier = t(`employees.levels.${level}`, undefined, locale);
  const shortRole = t(`employees.roles.${role}.short`, undefined, locale);
  return locale === 'vi-VN' ? `${shortRole} (${tier})` : `${tier} ${shortRole}`;
}

export function getPersonalityLocalized(
  personality: EmployeePersonality,
  locale: LocaleCode = getLocale()
): { label: string; summary: string } {
  return {
    label: t(`employees.personalities.${personality}.label`, undefined, locale),
    summary: t(`employees.personalities.${personality}.summary`, undefined, locale),
  };
}

export function getTraitLocalized(
  traitId: EmployeeTraitId,
  locale: LocaleCode = getLocale()
): { name: string; summary: string } {
  return {
    name: t(`employees.traits.${traitId}.name`, undefined, locale),
    summary: t(`employees.traits.${traitId}.summary`, undefined, locale),
  };
}

export function getTaskLocalized(task: EmployeeTask, locale: LocaleCode = getLocale()): string {
  return t(`employees.tasks.${task}`, undefined, locale);
}

export function getSkillLocalized(
  skillKey: keyof EmployeeSkills,
  locale: LocaleCode = getLocale()
): string {
  return t(`employees.skills.${skillKey}`, undefined, locale);
}

export function getProductCategoryLocalized(
  category: ProductCategory,
  locale: LocaleCode = getLocale()
): { label: string; description: string } {
  return {
    label: t(`products.categories.${category}.label`, undefined, locale),
    description: t(`products.categories.${category}.description`, undefined, locale),
  };
}

export function getFeatureLocalized(
  name: string,
  description: string,
  locale: LocaleCode = getLocale()
): { name: string; description: string } {
  const nKey = `products.features.${name}.name`;
  const dKey = `products.features.${name}.description`;
  const tn = lookupPath(DICTIONARIES[locale], nKey);
  const td = lookupPath(DICTIONARIES[locale], dKey);
  return {
    name: tn ?? name,
    description: td ?? description,
  };
}

export function getChannelLocalized(
  channel: MarketingChannel,
  locale: LocaleCode = getLocale()
): { label: string; speedLabel: string; description: string } {
  return {
    label: t(`market.channels.${channel}.label`, undefined, locale),
    speedLabel: t(`market.channels.${channel}.speedLabel`, undefined, locale),
    description: t(`market.channels.${channel}.description`, undefined, locale),
  };
}

export function getMilestoneLocalized(
  id: string,
  fallbackTitle = '',
  fallbackDesc = '',
  locale: LocaleCode = getLocale()
): { title: string; description: string } {
  const tKey = `milestones.ms.${id}.title`;
  const dKey = `milestones.ms.${id}.description`;
  return {
    title: lookupPath(DICTIONARIES[locale], tKey) ?? fallbackTitle,
    description: lookupPath(DICTIONARIES[locale], dKey) ?? fallbackDesc,
  };
}

export function getAchievementLocalized(
  id: string,
  fallbackTitle = '',
  fallbackDesc = '',
  locale: LocaleCode = getLocale()
): { title: string; description: string } {
  const tKey = `milestones.ach.${id}.title`;
  const dKey = `milestones.ach.${id}.description`;
  return {
    title: lookupPath(DICTIONARIES[locale], tKey) ?? fallbackTitle,
    description: lookupPath(DICTIONARIES[locale], dKey) ?? fallbackDesc,
  };
}

export function getAchievementProgressLocalized(
  state: GameState,
  achievementId: string,
  locale: LocaleCode = getLocale()
): string {
  const f = state.finance;
  switch (achievementId) {
    case 'ach_100k_revenue':
      return `${formatCurrency(Math.min(f.cumulativeRevenue, 100_000), false, locale)} / ${formatCurrency(100_000, false, locale)}`;
    case 'ach_1m_revenue':
      return `${formatCurrency(Math.min(f.cumulativeRevenue, 1_000_000), false, locale)} / ${formatCurrency(1_000_000, false, locale)}`;
    case 'ach_burned_1m': {
      const burned = Math.max(
        0,
        Math.round(
          (f.cumulativeExpenses ?? 0) + f.currentMonthMarketing + f.currentMonthDevCosts
        )
      );
      return `${formatCurrency(Math.min(burned, 1_000_000), false, locale)} / ${formatCurrency(1_000_000, false, locale)}`;
    }
    case 'ach_all_roles': {
      const roles = new Set(state.hiredRolesHistory ?? []);
      for (const e of state.employees) roles.add(e.role);
      return locale === 'vi-VN'
        ? `${roles.size} / 8 vai trò`
        : `${roles.size} / 8 roles`;
    }
    case 'ach_lead_veteran': {
      const maxLvl = state.employees.reduce((m, e) => Math.max(m, e.level), 0);
      return locale === 'vi-VN'
        ? `Cấp cao nhất ${maxLvl} / 4`
        : `Max Lv.${maxLvl} / 4`;
    }
    case 'ach_zero_bugs_mature': {
      const mature = state.products
        .filter((p) => p.stage === 'MATURE')
        .sort((a, b) => b.quality - a.quality)[0];
      if (!mature) {
        return locale === 'vi-VN' ? 'Cần sản phẩm v3+ (Trưởng thành)' : 'Needs Mature v3+ product';
      }
      return locale === 'vi-VN'
        ? `${Math.round(mature.quality)}/85 Chất lượng · ${mature.bugs} lỗi`
        : `${Math.round(mature.quality)}/85 Qual · ${mature.bugs} bugs`;
    }
    case 'ach_multi_product': {
      const liveCount = state.products.filter(
        (p) => p.stage === 'MVP_LIVE' || p.stage === 'MATURE'
      ).length;
      return locale === 'vi-VN'
        ? `${Math.min(liveCount, 3)} / 3 đang phát hành`
        : `${Math.min(liveCount, 3)} / 3 live`;
    }
    case 'ach_1k_customers': {
      const paying = state.products.reduce((s, p) => s + p.payingCustomers, 0);
      return `${formatNumber(Math.min(paying, 1000), locale)} / ${formatNumber(1000, locale)}`;
    }
    case 'ach_enterprise_whale': {
      const best = state.contracts
        .filter((c) => c.status === 'ACTIVE' || c.status === 'COMPLETED')
        .reduce((m, c) => Math.max(m, c.monthlyValue), 0);
      return locale === 'vi-VN'
        ? `Cao nhất ${formatCurrency(best, false, locale)} / ${formatCurrency(4000, false, locale)}/tháng`
        : `Best ${formatCurrency(best, false, locale)} / ${formatCurrency(4000, false, locale)}/mo`;
    }
    case 'ach_debt_free_hq':
      return locale === 'vi-VN'
        ? `Trụ sở Cấp ${state.office.level}/3 · ${formatCurrency(Math.max(0, f.cash), false, locale)}/${formatCurrency(100_000, false, locale)}`
        : `HQ L${state.office.level}/3 · ${formatCurrency(Math.max(0, f.cash), false, locale)}/${formatCurrency(100_000, false, locale)}`;
    default:
      return '';
  }
}

export function getObjectiveLocalized(
  id: StartupObjectiveId,
  fallbackLabel = '',
  locale: LocaleCode = getLocale()
): { label: string; actionText: string } {
  const lKey = `objectives.items.${id}`;
  const aKey = `objectives.actions.${id}`;
  return {
    label: lookupPath(DICTIONARIES[locale], lKey) ?? fallbackLabel,
    actionText: t(aKey, undefined, locale),
  };
}

export function getTutorialStepLocalized(
  step: TutorialStepId,
  locale: LocaleCode = getLocale()
): { title: string; actionPrompt: string; explanation: string } {
  return {
    title: t(`tutorial.steps.${step}.title`, undefined, locale),
    actionPrompt: t(`tutorial.steps.${step}.actionPrompt`, undefined, locale),
    explanation: t(`tutorial.steps.${step}.explanation`, undefined, locale),
  };
}

export function getEventLocalized(
  event: ActiveEvent,
  state?: GameState,
  locale: LocaleCode = getLocale()
): {
  title: string;
  description: string;
  categoryLabel: string;
  choices: Array<{ id: string; label: string; description: string; effectsSummary: string; cost?: number }>;
} {
  const tplId = event.templateId;
  const tplKey = `events.templates.${tplId}`;
  const hasTpl = Boolean(lookupPath(DICTIONARIES[locale], `${tplKey}.title`));

  const empName =
    (event.relatedEmployeeId &&
      state?.employees.find((e) => e.id === event.relatedEmployeeId)?.name) ||
    (locale === 'vi-VN' ? 'Nhân viên' : 'Employee');
  const investorAmount = formatCurrency(event.investorAmount ?? 25000, false, locale);
  const eq = event.investorEquityPct ?? 10;

  if (!hasTpl) {
    return {
      title: event.title,
      description: event.description,
      categoryLabel: t(`events.categories.${event.category}`, undefined, locale),
      choices: event.choices,
    };
  }

  return {
    title: t(`${tplKey}.title`, undefined, locale),
    description: t(`${tplKey}.description`, undefined, locale),
    categoryLabel: t(`events.categories.${event.category}`, undefined, locale),
    choices: event.choices.map((c) => {
      const cKey = `${tplKey}.choices.${c.id}`;
      const costStr = formatCurrency(c.cost ?? 0, false, locale);
      const vars = {
        cost: costStr,
        name: empName,
        amount: investorAmount,
        eq,
      };
      const hasChoice = Boolean(lookupPath(DICTIONARIES[locale], `${cKey}.label`));
      if (!hasChoice) return c;
      return {
        id: c.id,
        cost: c.cost,
        label: t(`${cKey}.label`, vars, locale),
        description: t(`${cKey}.description`, vars, locale),
        effectsSummary: t(`${cKey}.effects`, vars, locale),
      };
    }),
  };
}

export function getLocalizedMonthlySummaryNote(
  report: MonthlyReport,
  locale: LocaleCode = getLocale()
): string {
  if (locale === 'en-US') return report.summaryNote;
  if (report.netProfit > 5000) {
    return 'Tháng kinh doanh lãi lớn! Biên lợi nhuận đang mở rộng tích cực.';
  }
  if (report.netProfit > 0) {
    return 'Tháng có lãi — doanh thu đã bù đắp toàn bộ lương, thuê văn phòng và vận hành.';
  }
  if (report.endingCash < 5000) {
    return 'Dự trữ tiền mặt xuống rất thấp. Hãy đẩy mạnh bán hàng hoặc tối ưu chi phí tiếp thị.';
  }
  return 'Đang lỗ kế hoạch để đầu tư phát triển sản phẩm và mở rộng tập khách hàng.';
}

export function getLocalizedGameOverReason(
  reason: string | null,
  locale: LocaleCode = getLocale()
): string {
  if (!reason) return t('endgame.gameOverFallback', undefined, locale);
  if (locale === 'en-US') return reason;
  if (reason.includes('Bankruptcy')) {
    return 'Phá sản: Khoản thâm hụt tiền mặt đã vượt quá hạn mức tín dụng sau khi thanh toán lương và thuê văn phòng cuối tháng.';
  }
  if (reason.includes('Insolvency')) {
    return 'Mất khả năng thanh toán: Công ty âm dòng tiền ba tháng liên tiếp dẫn đến phải đóng cửa.';
  }
  return reason;
}

export function getLocalizedFounderSalaryLabelAndSummary(
  tier: 'SWEAT_EQUITY' | 'LEAN' | 'STANDARD' | 'HIGH' | 'LAVISH',
  crunchActive: boolean,
  locale: LocaleCode = getLocale()
): { label: string; summary: string } {
  const label = t(`finance.salaryTiers.${tier}.label`, undefined, locale);
  if (tier === 'HIGH' || tier === 'LAVISH') {
    const subKey = crunchActive ? 'summaryCrunch' : 'summaryNormal';
    return {
      label,
      summary: t(`finance.salaryTiers.${tier}.${subKey}`, undefined, locale),
    };
  }
  return {
    label,
    summary: t(`finance.salaryTiers.${tier}.summary`, undefined, locale),
  };
}
