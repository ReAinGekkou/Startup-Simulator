import { EVENT_TEMPLATES } from '@/src/game/data/events';
import { generateContractOpportunity } from '@/src/game/systems/marketSystem';
import { getLocale } from '@/src/localization';
import { ActiveEvent, GameState } from '@/src/types/game';
import { clamp, formatCurrency, seededRandom } from '@/src/utils/format';

export function maybeTriggerEvent(state: GameState): ActiveEvent | null {
  if (state.activeEvent || state.pendingMonthlyReport || state.screen !== 'PLAYING') {
    return null;
  }

  // Trigger roughly every 6-8 days
  if (state.totalDays < 5 || state.totalDays % 6 !== 0) {
    return null;
  }

  const rng = seededRandom(state.seed + state.totalDays * 313);
  const hasLive = state.products.some((p) => p.stage === 'MVP_LIVE' || p.stage === 'MATURE');

  const eligible = EVENT_TEMPLATES.filter((t) => {
    if (state.totalDays < t.minDay) return false;
    if ((t.templateId === 'CRITICAL_BUG' || t.templateId === 'VIRAL_POST' || t.templateId === 'SERVER_OUTAGE' || t.templateId === 'NEGATIVE_FEEDBACK') && !hasLive) {
      return false;
    }
    if (t.templateId === 'EMPLOYEE_RESIGN_RISK' && state.employees.length === 0) {
      return false;
    }
    return true;
  });

  if (eligible.length === 0) return null;

  // Prioritize stressed employee burnout if present
  const stressedEmp = state.employees.find((e) => e.stress > 68 || e.morale < 42);
  let chosen = eligible[Math.floor(rng() * eligible.length)];
  if (stressedEmp && rng() < 0.45) {
    const burnoutTpl = eligible.find((e) => e.templateId === 'EMPLOYEE_RESIGN_RISK');
    if (burnoutTpl) chosen = burnoutTpl;
  }

  const trust = state.founder.investorTrust ?? 55;
  const investorAmount = Math.max(
    10000,
    Math.round((12000 + state.founder.reputation * 240 + trust * 220) / 5000) * 5000
  );
  const investorEquityPct = trust >= 75 ? 8 : trust < 35 ? 14 : 10;
  const targetProduct = state.products[0];

  const event: ActiveEvent = {
    id: `evt_${state.totalDays}_${chosen.templateId}`,
    templateId: chosen.templateId,
    title: chosen.title,
    description: chosen.description,
    category: chosen.category,
    severity: chosen.severity,
    choices: chosen.buildChoices({
      employeeName: stressedEmp?.name ?? state.employees[0]?.name,
      productName: targetProduct?.name,
      investorCash: investorAmount,
    }),
    triggeredDay: state.totalDays,
    relatedEmployeeId: stressedEmp?.id ?? state.employees[0]?.id,
    relatedProductId: targetProduct?.id,
    investorAmount,
    investorEquityPct,
  };

  return event;
}

export function resolveActiveEvent(state: GameState, choiceId: string): string {
  const locale = getLocale();
  const vi = locale === 'vi-VN';
  const evt = state.activeEvent;
  if (!evt) return vi ? 'Không có sự kiện đang mở.' : 'No active event.';

  const choice = evt.choices.find((c) => c.id === choiceId);
  if (!choice) return vi ? 'Lựa chọn không hợp lệ.' : 'Invalid choice.';

  if (choice.cost && state.finance.cash < choice.cost) {
    if (state.finance.cash - choice.cost < -state.finance.creditLimit) {
      return vi
        ? 'Tiền mặt và hạn mức tín dụng không đủ để chọn phương án này.'
        : 'Insufficient cash and credit to afford this option.';
    }
  }

  if (choice.cost) {
    state.finance.cash -= choice.cost;
    state.finance.currentMonthDevCosts += choice.cost;
  }

  const prod = state.products.find((p) => p.id === evt.relatedProductId) ?? state.products[0];
  const emp = state.employees.find((e) => e.id === evt.relatedEmployeeId) ?? state.employees[0];

  let summary = '';

  switch (evt.templateId) {
    case 'CRITICAL_BUG':
      if (choiceId === 'HOTFIX_NOW' && prod) {
        prod.bugs = Math.max(0, prod.bugs - 4);
        prod.customerSatisfaction = clamp(prod.customerSatisfaction + 4, 0, 100);
        state.employees.forEach((e) => (e.energy = clamp(e.energy - 10, 10, 100)));
        summary = vi
          ? 'Đã triển khai bản vá khẩn cấp gọn gàng; khách hàng đánh giá cao tốc độ xử lý.'
          : 'Emergency hotfix deployed cleanly; customers noticed the fast response.';
      } else if (prod) {
        prod.bugs += 4;
        prod.customerSatisfaction = clamp(prod.customerSatisfaction - 5, 0, 100);
        summary = vi
          ? 'Đã xếp lỗi vào sprint thường; vé hỗ trợ tăng nhẹ làm giảm hài lòng khách hàng.'
          : 'Bug queued for later; support tickets dipped customer satisfaction.';
      }
      break;

    case 'VIRAL_POST':
      if (prod) {
        const gain = choiceId === 'AMPLIFY_CAMPAIGN' ? 32 : 14;
        prod.activeUsers += gain;
        prod.payingCustomers += Math.round(gain * 0.65);
        state.founder.reputation = clamp(
          state.founder.reputation + (choiceId === 'AMPLIFY_CAMPAIGN' ? 6 : 3),
          0,
          100
        );
        summary = vi
          ? `Làn sóng lan truyền đã mang về ${gain} người dùng mới cho ${prod.name}.`
          : `Viral attention brought ${gain} new users to ${prod.name}.`;
      }
      break;

    case 'MAJOR_CLIENT_OPP':
      if (choiceId === 'PITCH_CUSTOM') {
        const deal = generateContractOpportunity(state);
        deal.monthlyValue = Math.round(deal.monthlyValue * 1.35);
        deal.legalReviewed = true;
        state.contracts.push(deal);
        summary = vi
          ? `Đã thêm hợp đồng B2B giá trị cao (${deal.clientName}) vào phễu bán hàng.`
          : `Added high-value contract (${deal.clientName}) to your sales pipeline.`;
      } else {
        state.finance.cash += 600;
        state.finance.currentMonthRevenue += 600;
        state.founder.reputation = clamp(state.founder.reputation + 2, 0, 100);
        summary = vi
          ? `Đã thu ${formatCurrency(600, false, locale)} phí dùng thử tiêu chuẩn.`
          : `Collected ${formatCurrency(600, false, locale)} self-serve pilot fee.`;
      }
      break;

    case 'EMPLOYEE_RESIGN_RISK':
      if (emp) {
        if (choiceId === 'RETENTION_BONUS') {
          emp.morale = clamp(emp.morale + 25, 0, 100);
          emp.stress = clamp(emp.stress - 25, 0, 100);
          emp.resignationWarning = false;
          summary = vi
            ? `${emp.name} rất trân trọng khoản thưởng giữ chân và đã lấy lại năng lượng.`
            : `${emp.name} appreciated the bonus and feels re-energized.`;
        } else {
          emp.morale = clamp(emp.morale + 10, 0, 100);
          summary = vi
            ? `Đã trao đổi định hướng 1-1 cùng ${emp.name}.`
            : `Held a 1-on-1 check-in with ${emp.name}.`;
        }
      }
      break;

    case 'INVESTOR_OFFER':
      if (choiceId === 'ACCEPT_FUNDING') {
        const amt = evt.investorAmount ?? 25000;
        const eq = evt.investorEquityPct ?? 10;
        state.finance.cash += amt;
        state.finance.equityDilutionPct = clamp(state.finance.equityDilutionPct + eq, 0, 85);
        state.founder.reputation = clamp(state.founder.reputation + 5, 0, 100);
        state.founder.investorTrust = clamp((state.founder.investorTrust ?? 55) + 3, 0, 100);
        summary = vi
          ? `Đã chốt vòng gọi vốn hạt giống ${formatCurrency(amt, false, locale)} đổi ${eq}% cổ phần!`
          : `Closed ${formatCurrency(amt, false, locale)} seed investment for ${eq}% equity!`;
      } else {
        state.founder.reputation = clamp(state.founder.reputation + 4, 0, 100);
        summary = vi
          ? 'Đã từ chối pha loãng cổ phần để tiếp tục tự chủ tăng trưởng.'
          : 'Turned down dilution and stayed founder-controlled.';
      }
      break;

    case 'SERVER_OUTAGE':
      if (choiceId === 'UPGRADE_CLUSTER' && prod) {
        prod.customerSatisfaction = clamp(prod.customerSatisfaction + 3, 0, 100);
        prod.quality = clamp(prod.quality + 4, 0, 100);
        summary = vi
          ? 'Cụm máy chủ tự mở rộng đã xử lý tải cao ổn định mà không mất dữ liệu.'
          : 'Autoscaling cluster stabilized infrastructure with zero downtime.';
      } else if (prod) {
        prod.customerSatisfaction = clamp(prod.customerSatisfaction - 7, 0, 100);
        state.founder.reputation = clamp(state.founder.reputation - 3, 0, 100);
        summary = vi
          ? 'Đã khởi động lại máy chủ thủ công sau một khoảng thời gian gián đoạn.'
          : 'Manual restart recovered servers after noticeable customer downtime.';
      }
      break;

    case 'COMPETITOR_LAUNCH':
      if (prod) {
        if (choiceId === 'FEATURE_SPRINT') {
          prod.marketDemand = clamp(prod.marketDemand + 6, 0, 100);
          prod.quality = clamp(prod.quality + 4, 0, 100);
          summary = vi
            ? 'Chiến dịch tạo khác biệt giúp giữ vững vị thế trước đối thủ.'
            : 'Differentiation sprint protected market positioning.';
        } else {
          prod.marketDemand = clamp(prod.marketDemand - 4, 10, 100);
          summary = vi
            ? 'Giữ vững lộ trình cốt lõi dù đối thủ tạo được chú ý ngắn hạn.'
            : 'Stayed focused while competitor grabbed brief market attention.';
        }
      }
      break;

    case 'EMPLOYEE_CONFLICT':
      if (choiceId === 'MEDIATE_COMPROMISE') {
        state.employees.forEach((e) => (e.morale = clamp(e.morale + 8, 0, 100)));
        state.founder.leadership = clamp(state.founder.leadership + 3, 1, 100);
        state.founder.energy = clamp(state.founder.energy - 12, 0, 100);
        summary = vi
          ? 'Đã điều phối thống nhất hai nhóm tại Phòng họp; tinh thần cả đội tăng lên.'
          : 'Mediated team alignment in the Meeting Room; morale improved.';
      } else if (prod) {
        prod.developmentProgress = clamp(prod.developmentProgress + 8, 0, 100);
        prod.bugs += 2;
        state.employees.forEach((e) => (e.morale = clamp(e.morale - 6, 0, 100)));
        summary = vi
          ? 'Ưu tiên giao hàng đúng hạn; tiến độ tăng nhanh kèm chút nợ kỹ thuật.'
          : 'Pushed deadline forward; progress jumped with minor technical debt.';
      }
      break;

    case 'UNEXPECTED_EXPENSE':
      if (choiceId === 'PAY_AUDIT') {
        state.founder.reputation = clamp(state.founder.reputation + 3, 0, 100);
        summary = vi
          ? 'Đã tất toán gọn khoản kiểm toán bản quyền và tuân thủ.'
          : 'Settled compliance audit cleanly.';
      } else {
        state.finance.totalDebt += 950;
        summary = vi
          ? `Đã giãn chi qua kế hoạch công nợ (+${formatCurrency(950, false, locale)} nợ ngắn hạn).`
          : `Deferred audit via debt plan (${formatCurrency(950, false, locale)} added to company debt).`;
      }
      break;

    case 'NEGATIVE_FEEDBACK':
      if (prod) {
        if (choiceId === 'FOUNDER_REPLY') {
          prod.customerSatisfaction = clamp(prod.customerSatisfaction + 6, 0, 100);
          state.founder.reputation = clamp(state.founder.reputation + 4, 0, 100);
          summary = vi
            ? 'Phản hồi tận tâm từ nhà sáng lập đã biến góp ý gay gắt thành lời khen từ cộng đồng.'
            : 'Personal founder follow-up turned harsh feedback into community praise.';
        } else {
          prod.customerSatisfaction = clamp(prod.customerSatisfaction - 5, 0, 100);
          summary = vi
            ? 'Đã ghi nhận góp ý cho các đợt phát triển sau.'
            : 'Feedback logged for future sprint.';
        }
      }
      break;

    default:
      summary = vi ? 'Đã ghi nhận quyết định.' : 'Decision recorded.';
  }

  state.activeEvent = null;
  state.notifications.unshift({
    id: `notif_${state.totalDays}_${Date.now()}`,
    day: state.totalDays,
    message: summary,
    type: 'INFO',
  });
  state.notifications = state.notifications.slice(0, 20);
  return summary;
}
