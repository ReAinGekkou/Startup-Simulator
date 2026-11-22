import { LocaleCode } from '@/src/localization/localeStore';
import { getRoleLocalized, getTutorialStepLocalized } from '@/src/localization/i18n';
import {
  DailySummaryReport,
  Employee,
  EmployeeRole,
  MonthlyReport,
  TutorialStepId,
} from '@/src/types/game';
import { formatCurrency } from '@/src/utils/format';

export interface VoiceScriptEntry {
  speaker: string;
  text: string;
}

const MENU_INTRO_SCRIPTS: Record<LocaleCode, VoiceScriptEntry> = {
  'vi-VN': {
    speaker: 'Người dẫn chuyện',
    text: 'Chào mừng bạn đến với Nhà sáng lập khởi nghiệp. Bạn sẽ điều hành một công ty công nghệ non trẻ, xây dựng sản phẩm đầu tiên, dẫn dắt đội ngũ và đưa công ty phát triển bền vững.',
  },
  'en-US': {
    speaker: 'Narrator',
    text: 'Welcome to Startup Founder Simulator. You will lead a young technology startup, build your first product, guide your team, and grow a profitable company.',
  },
};

const TUTORIAL_SCRIPTS_VI: Record<TutorialStepId, string> = {
  1: 'Bước một. Hãy làm quen với đội ngũ của bạn. Bạn bắt đầu với ba nhân viên đầu tiên gồm kỹ sư phần mềm, nhà thiết kế và chuyên viên tiếp thị. Hãy nhấp vào một nhân viên trong văn phòng hoặc mở mục Nhân sự để xem kỹ năng của họ.',
  2: 'Bước hai. Khám phá văn phòng. Bạn bắt đầu với Văn phòng CEO và Phòng kỹ thuật. Hãy nhấp vào cả hai phòng trên bản đồ để xem thông số và các thao tác quản lý.',
  3: 'Bước ba. Tạo sản phẩm đầu tiên. Hãy mở mục Sản phẩm, chọn loại hình phù hợp và khởi động nghiên cứu phát triển cho ý tưởng sản phẩm mới.',
  4: 'Bước bốn. Phân công công việc. Hãy giao nhiệm vụ phát triển sản phẩm cho nhân viên dựa trên kỹ năng mạnh nhất để rút ngắn thời gian hoàn thiện.',
  5: 'Bước năm. Ra mắt bản MVP. Khi tiến độ đạt một trăm phần trăm, hãy nhấn Ra mắt MVP ngay để đón những người dùng và khách hàng trả phí đầu tiên.',
  6: 'Bước sáu. Tìm khách hàng đầu tiên. Hãy mở mục Thị trường và khởi chạy chiến dịch tiếp thị hoặc ký hợp đồng doanh nghiệp.',
  7: 'Bước bảy. Nắm vững tài chính. Mở mục Tài chính để theo dõi dòng tiền, quỹ lương cuối tháng và hạn mức tín dụng, tránh nguy cơ cạn kiệt tiền mặt.',
  8: 'Bước tám. Kết thúc ngày làm việc đầu tiên. Nhấn Kết thúc ngày ở thanh trên cùng để tổng kết ngày một và xem báo cáo kết quả.',
};

export function getMainMenuIntroScript(locale: LocaleCode): VoiceScriptEntry {
  return MENU_INTRO_SCRIPTS[locale];
}

export function getTutorialVoiceScript(
  step: TutorialStepId,
  locale: LocaleCode
): VoiceScriptEntry {
  if (locale === 'vi-VN') {
    return {
      speaker: 'Hướng dẫn khởi nghiệp',
      text: TUTORIAL_SCRIPTS_VI[step],
    };
  }
  const meta = getTutorialStepLocalized(step, locale);
  return {
    speaker: 'Startup Advisor',
    text: `${meta.title}. ${meta.actionPrompt} ${meta.explanation}`,
  };
}

export function getDailyReportVoiceScript(
  report: DailySummaryReport,
  locale: LocaleCode
): VoiceScriptEntry {
  if (locale === 'vi-VN') {
    const firstHighlight = report.highlights[0] ?? '';
    return {
      speaker: 'Báo cáo cuối ngày',
      text: `Báo cáo tiến độ ngày ${report.day}, tháng ${report.month}. Doanh thu hôm nay đạt ${formatCurrency(report.revenueEarned, false, 'vi-VN')}. Số khách hàng trả phí hiện có là ${report.customersTotal}. Tiền mặt còn lại là ${formatCurrency(report.cashBalance, false, 'vi-VN')}. ${firstHighlight}`,
    };
  }
  const firstHighlight = report.highlights[0] ?? '';
  return {
    speaker: 'Daily Summary',
    text: `Day ${report.day}, Month ${report.month} progress report. Today's revenue is ${formatCurrency(report.revenueEarned, false, 'en-US')}. Total paying customers: ${report.customersTotal}. Ending cash balance: ${formatCurrency(report.cashBalance, false, 'en-US')}. ${firstHighlight}`,
  };
}

export function getMonthlyReportVoiceScript(
  report: MonthlyReport,
  locale: LocaleCode
): VoiceScriptEntry {
  if (locale === 'vi-VN') {
    const profitText =
      report.netProfit >= 0
        ? `lợi nhuận ròng đạt ${formatCurrency(report.netProfit, false, 'vi-VN')}`
        : `lỗ ròng ${formatCurrency(Math.abs(report.netProfit), false, 'vi-VN')}`;
    return {
      speaker: 'Báo cáo tài chính tháng',
      text: `Báo cáo tháng ${report.month} đã hoàn tất. Doanh thu tháng đạt ${formatCurrency(report.revenue, false, 'vi-VN')}. Tổng chi phí là ${formatCurrency(report.expenses, false, 'vi-VN')}, ${profitText}. Tiền mặt cuối kỳ còn ${formatCurrency(report.endingCash, false, 'vi-VN')}.`,
    };
  }
  const profitText =
    report.netProfit >= 0
      ? `net profit of ${formatCurrency(report.netProfit, false, 'en-US')}`
      : `net loss of ${formatCurrency(Math.abs(report.netProfit), false, 'en-US')}`;
  return {
    speaker: 'Monthly Report',
    text: `Month ${report.month} report is complete. Monthly revenue reached ${formatCurrency(report.revenue, false, 'en-US')}, total expenses were ${formatCurrency(report.expenses, false, 'en-US')}, resulting in a ${profitText}. Ending cash is ${formatCurrency(report.endingCash, false, 'en-US')}.`,
  };
}

const ROLE_DIALOGUES: Record<
  LocaleCode,
  Record<EmployeeRole, { steady: string; stressed: string; motivated: string }>
> = {
  'vi-VN': {
    SOFTWARE_ENGINEER: {
      steady: 'Tôi đã hoàn thành phần mã nguồn hôm nay và đang tiến hành kiểm thử.',
      stressed: 'Khối lượng công việc đang khá dày, tôi cần xử lý gọn lỗi tồn đọng trước khi phát hành.',
      motivated: 'Tốc độ triển khai đang rất tốt, hệ thống chạy ổn định và mượt mà!',
    },
    DESIGNER: {
      steady: 'Tôi đang tinh chỉnh bố cục và trải nghiệm người dùng để tăng tỷ lệ chuyển đổi.',
      stressed: 'Chúng ta cần thêm chút thời gian trau chuốt giao diện trước khi chốt bản mới.',
      motivated: 'Bản thiết kế mới nhận được nhiều phản hồi tích cực từ người dùng thử nghiệm!',
    },
    MARKETING_SPECIALIST: {
      steady: 'Chiến dịch tiếp thị đang mang về những khách hàng tiềm năng đầu tiên.',
      stressed: 'Chi phí quảng cáo đang tăng, tôi đang tối ưu lại nội dung để giữ chi phí thu hút hợp lý.',
      motivated: 'Lượng người dùng quan tâm tăng rõ rệt sau chiến dịch truyền thông tuần này!',
    },
    SALES_REP: {
      steady: 'Tôi đang trao đổi với các khách hàng doanh nghiệp để chốt thêm hợp đồng dài hạn.',
      stressed: 'Nhiều khách hàng đang cân nhắc kỹ chất lượng sản phẩm trước khi ký hợp đồng.',
      motivated: 'Khách hàng B2B đánh giá rất cao bản dùng thử, cơ hội chốt hợp đồng đang rộng mở!',
    },
    ACCOUNTANT: {
      steady: 'Dòng tiền tháng này cần được kiểm soát chặt chẽ để đảm bảo quỹ lương.',
      stressed: 'Biên an toàn tiền mặt đang thu hẹp, chúng ta nên cân nhắc kỹ các khoản chi cố định.',
      motivated: 'Sổ sách tháng này cân đối rõ ràng và mức thuế đã được tối ưu tốt.',
    },
    HR_MANAGER: {
      steady: 'Tôi đang theo dõi tinh thần đội ngũ và sàng lọc ứng viên phù hợp cho công ty.',
      stressed: 'Một vài thành viên có dấu hiệu quá tải, mình nên sắp xếp thời gian nghỉ hợp lý.',
      motivated: 'Không khí làm việc trong văn phòng hôm nay rất gắn kết và tích cực!',
    },
    PRODUCT_MANAGER: {
      steady: 'Tôi đang sắp xếp lộ trình tính năng ưu tiên những hạng mục tạo giá trị cao nhất.',
      stressed: 'Các phòng ban đang có nhiều yêu cầu song song, cần chốt lại mục tiêu trọng tâm.',
      motivated: 'Lộ trình sản phẩm đang đi đúng hướng và đồng bộ với phản hồi thị trường!',
    },
    OPERATIONS_MANAGER: {
      steady: 'Tôi đang rà soát vận hành máy chủ và hồ sơ pháp lý để đảm bảo tiến độ.',
      stressed: 'Áp lực vận hành đang tăng lên cùng lượng người dùng, cần kiểm tra hệ thống thường xuyên.',
      motivated: 'Hạ tầng và quy trình pháp lý đang vận hành ổn định, chi phí được kiểm soát gọn.',
    },
  },
  'en-US': {
    SOFTWARE_ENGINEER: {
      steady: "I've completed today's implementation and I am running integration tests now.",
      stressed: 'The ticket queue is stacking up—we should clear open bugs before the next release.',
      motivated: 'Build velocity feels crisp today and our test suite is completely green!',
    },
    DESIGNER: {
      steady: 'Refining the onboarding layout and interaction polish to boost signup conversion.',
      stressed: 'We need a bit more breathing room to polish rough UI edges before launch.',
      motivated: 'Users love how clear and effortless the new product flow feels!',
    },
    MARKETING_SPECIALIST: {
      steady: 'Our marketing campaign is bringing in our first qualified customer leads.',
      stressed: 'Ad acquisition costs are creeping up—tuning our messaging to protect ROI.',
      motivated: 'Inbound demand jumped noticeably after this week’s product spotlight!',
    },
    SALES_REP: {
      steady: 'Following up with enterprise prospects to move active B2B deals toward closing.',
      stressed: 'Clients are asking tough quality questions before signing annual agreements.',
      motivated: 'Prospects were impressed by the demo—pipeline momentum looks strong!',
    },
    ACCOUNTANT: {
      steady: 'Cash flow this month needs disciplined tracking to comfortably cover end-of-month payroll.',
      stressed: 'Our cash cushion is getting tight; we should watch recurring overhead carefully.',
      motivated: 'Monthly books are balanced and tax efficiency is in great shape.',
    },
    HR_MANAGER: {
      steady: 'Checking in on team morale and reviewing promising candidates for open seats.',
      stressed: 'A few teammates are showing fatigue—some Break Room recovery would help.',
      motivated: 'Team energy and collaboration around the office feel genuinely upbeat today!',
    },
    PRODUCT_MANAGER: {
      steady: 'Prioritizing the feature backlog toward the highest customer retention impact.',
      stressed: 'Too many competing requests right now—we need sharper roadmap focus.',
      motivated: 'Roadmap execution is clicking smoothly with strong market alignment!',
    },
    OPERATIONS_MANAGER: {
      steady: 'Auditing infrastructure reliability and legal compliance across active contracts.',
      stressed: 'Server load and operational tickets are climbing—staying alert on maintenance.',
      motivated: 'Systems are running smoothly and operational overhead is under control.',
    },
  },
};

export function getEmployeeVoiceLine(
  employee: Employee,
  locale: LocaleCode
): VoiceScriptEntry {
  const rolePack = ROLE_DIALOGUES[locale][employee.role];
  const roleName = getRoleLocalized(employee.role, locale).short;
  let line = rolePack.steady;
  if (employee.stress > 68 || employee.morale < 42 || employee.resignationWarning) {
    line = rolePack.stressed;
  } else if (employee.morale >= 75) {
    line = rolePack.motivated;
  }
  return {
    speaker: `${employee.name} (${roleName})`,
    text: line,
  };
}
