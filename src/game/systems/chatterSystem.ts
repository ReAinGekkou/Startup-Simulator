import { ROLE_DEFINITIONS } from '@/src/game/data/roles';
import { getLocale, getRoleLocalized, getTraitLocalized } from '@/src/localization';
import { ChatterMessage, Employee, EmployeePersonality, GameState } from '@/src/types/game';
import { seededRandom } from '@/src/utils/format';

interface FlavorBank {
  highMorale: string[];
  stressed: string[];
  tired: string[];
  taskLines: Partial<Record<Employee['assignedTask'], string[]>>;
}

const PERSONALITY_FLAVOR_EN: Record<EmployeePersonality, FlavorBank> = {
  PRAGMATIC: {
    highMorale: [
      'Solid momentum today. Scope feels realistic and clean.',
      'Shipping steady increments beats over-engineering every time.',
    ],
    stressed: [
      'Workload is stacking up. We should trim non-essential scope.',
      'Feels like we are firefighting more than building this week.',
    ],
    tired: [
      'Grabbing a quick espresso before diving back into the queue.',
      'Running a bit low on battery—one more coffee should help.',
    ],
    taskLines: {
      BUILD_PRODUCT: ['Core module is coming together cleanly.'],
      FIX_BUGS: ['Isolated two edge-case bugs in the build pipeline.'],
      MANAGE_FINANCE: ['Runway numbers are reconciled and up to date.'],
    },
  },
  PERFECTIONIST: {
    highMorale: [
      'Polished the details until every interaction felt crisp.',
      'Zero lint warnings and clean test coverage—love days like this.',
    ],
    stressed: [
      'I hate rushing releases with rough edges still showing.',
      'Too many compromises on quality right now—it is wearing me down.',
    ],
    tired: [
      'Staring at pixel alignments for hours is catching up to me.',
      'Need ten minutes away from the monitor to reset my eyes.',
    ],
    taskLines: {
      BUILD_PRODUCT: ['Refining the edge cases before we call this sprint done.'],
      FIX_BUGS: ['Tracked down every last regression—no shortcuts.'],
    },
  },
  WORKAHOLIC: {
    highMorale: [
      'Locked in! Let us push this milestone across the finish line.',
      'Already cleared my morning checklist—ready for the next sprint.',
    ],
    stressed: [
      'Even I am hitting a wall with this pace... maybe a Break Room pause.',
      'My calendar is packed wall-to-wall today.',
    ],
    tired: [
      'Double espresso time. Sleep can wait until after launch.',
      'Energy tank is flashing yellow—hitting the coffee bar.',
    ],
    taskLines: {
      BUILD_PRODUCT: ['Cranking through tickets at full speed.'],
      CLOSE_SALES: ['Following up on every warm lead in the inbox.'],
    },
  },
  CREATIVE: {
    highMorale: [
      'Had a breakthrough idea for the user onboarding flow!',
      'The office vibe feels super inspiring today.',
    ],
    stressed: [
      'Hard to stay creative when stress keeps piling up.',
      'Could really use a breather before brainstorming the next update.',
    ],
    tired: [
      'Brain feels foggy—time for a quick lounge recharge.',
      'Sketchbook is waiting, just need a fresh cup of coffee first.',
    ],
    taskLines: {
      BUILD_PRODUCT: ['Iterating on layouts so users feel delighted on first click.'],
      MARKET_GROWTH: ['Drafting fresh campaign visuals for our target segment.'],
    },
  },
  SOCIAL: {
    highMorale: [
      'Great sync with the crew today—everyone has each other’s back!',
      'Love how lively the studio feels when we collaborate.',
    ],
    stressed: [
      'Team tension is creeping up. Maybe a 1-on-1 check-in would help?',
      'Feels quiet and tense in here—hope everyone is holding up okay.',
    ],
    tired: [
      'Anyone up for a quick Break Room coffee chat?',
      'Long day of back-to-back calls—recharging on the sofa.',
    ],
    taskLines: {
      MARKET_GROWTH: ['Community replies are warming up nicely today!'],
      RECRUIT_TALENT: ['Reviewing promising applicants for our open roles.'],
      CLOSE_SALES: ['Clients respond way better when we keep pitches personal.'],
    },
  },
  ANALYTICAL: {
    highMorale: [
      'Metrics are trending in the right direction across the board.',
      'Data shows our recent product polish is lifting retention.',
    ],
    stressed: [
      'Burnout indicators are flashing—productivity will dip if we stay this hot.',
      'Error rate and stress are correlating higher than I like.',
    ],
    tired: [
      'Mental bandwidth is down to 30%. Taking a brief Break Room reset.',
      'Need caffeine before running another cohort spreadsheet.',
    ],
    taskLines: {
      PLAN_ROADMAP: ['Prioritizing features by highest demand-to-effort ratio.'],
      MANAGE_FINANCE: ['Auditing margins and tax deductions for month-end.'],
      OPERATIONS_SUPPORT: ['Tightening compliance and server reliability checks.'],
    },
  },
};

const PERSONALITY_FLAVOR_VI: Record<EmployeePersonality, FlavorBank> = {
  PRAGMATIC: {
    highMorale: [
      'Nhịp làm việc hôm nay rất ổn định. Phạm vi công việc gọn gàng và rõ ràng.',
      'Tôi đã hoàn thành phần mã nguồn hôm nay và đang tiến hành kiểm thử.',
    ],
    stressed: [
      'Khối lượng công việc đang dồn lại khá nhiều. Chúng ta nên ưu tiên các hạng mục cốt lõi.',
      'Tuần này cả nhóm xử lý sự cố gấp hơi nhiều so với thời gian xây dựng tính năng mới.',
    ],
    tired: [
      'Làm nhanh một tách cà phê trước khi quay lại xử lý danh sách công việc.',
      'Năng lượng hơi tụt rồi—nghỉ tay vài phút sẽ giúp tỉnh táo hơn.',
    ],
    taskLines: {
      BUILD_PRODUCT: ['Mô-đun cốt lõi đang ghép nối rất trơn tru và ổn định.'],
      FIX_BUGS: ['Đã khoanh vùng và xử lý gọn hai lỗi biên trong quy trình dựng bản mới.'],
      MANAGE_FINANCE: ['Số liệu dòng tiền đã được đối soát khớp và cập nhật đầy đủ.'],
    },
  },
  PERFECTIONIST: {
    highMorale: [
      'Đã trau chuốt từng chi tiết nhỏ cho đến khi trải nghiệm thật mượt mà.',
      'Không còn cảnh báo lỗi và bộ kiểm thử đều xanh—rất thích những ngày như hôm nay!',
    ],
    stressed: [
      'Tôi không yên tâm chút nào khi phải phát hành gấp lúc giao diện còn chưa hoàn chỉnh.',
      'Phải đánh đổi chất lượng quá nhiều lúc này khiến tôi khá áp lực.',
    ],
    tired: [
      'Nhìn màn hình căn chỉnh từng điểm ảnh nhiều giờ liên tục bắt đầu mỏi mắt rồi.',
      'Cần rời bàn làm việc mười phút để mắt và đầu óc được thư giãn.',
    ],
    taskLines: {
      BUILD_PRODUCT: ['Đang rà soát kỹ các tình huống biên trước khi chốt hoàn thành sprint.'],
      FIX_BUGS: ['Truy vết triệt để từng lỗi phát sinh—không bỏ sót điểm nào.'],
    },
  },
  WORKAHOLIC: {
    highMorale: [
      'Tập trung tối đa! Hãy cùng đưa cột mốc này về đích đúng hẹn.',
      'Đã xong hết đầu việc buổi sáng—sẵn sàng cho đợt phát triển tiếp theo.',
    ],
    stressed: [
      'Ngay cả tôi cũng thấy nhịp độ này hơi căng... có lẽ nên ghé Phòng nghỉ ngơi một chút.',
      'Lịch làm việc hôm nay kín đặc từ sáng đến chiều.',
    ],
    tired: [
      'Đến giờ nạp thêm cà phê đậm đặc để chạy tiếp chặng nước rút rồi.',
      'Thanh năng lượng đang báo vàng—tôi ra quầy pha chế nghỉ nhanh đây.',
    ],
    taskLines: {
      BUILD_PRODUCT: ['Đang tăng tốc xử lý các đầu việc phát triển với hiệu suất cao nhất.'],
      CLOSE_SALES: ['Đang bám sát từng khách hàng doanh nghiệp tiềm năng trong hộp thư.'],
    },
  },
  CREATIVE: {
    highMorale: [
      'Vừa nảy ra một ý tưởng đột phá giúp luồng làm quen người dùng mượt hơn hẳn!',
      'Không khí văn phòng hôm nay tạo rất nhiều cảm hứng sáng tạo.',
    ],
    stressed: [
      'Thật khó giữ mạch sáng tạo khi áp lực công việc cứ tăng liên tục.',
      'Giá mà có chút khoảng lặng để lên ý tưởng mới cho bản cập nhật sắp tới.',
    ],
    tired: [
      'Đầu óc hơi quá tải ý tưởng—ra khu nghỉ ngơi thư giãn vài phút sẽ sáng suốt lại ngay.',
      'Sổ phác thảo vẫn đang chờ, chỉ cần thêm một ly cà phê tươi mới nữa thôi.',
    ],
    taskLines: {
      BUILD_PRODUCT: ['Đang tinh chỉnh bố cục để người dùng ấn tượng ngay từ cú nhấp đầu tiên.'],
      MARKET_GROWTH: ['Chiến dịch tiếp thị đang mang về những khách hàng tiềm năng đầu tiên.'],
    },
  },
  SOCIAL: {
    highMorale: [
      'Hôm nay phối hợp với cả nhóm cực kỳ ăn ý—mọi người hỗ trợ nhau rất nhiệt tình!',
      'Thích cảm giác văn phòng rộn ràng và gắn kết khi cùng thảo luận ý tưởng.',
    ],
    stressed: [
      'Không khí cả nhóm hơi căng thẳng. Có lẽ một buổi trao đổi 1-1 sẽ giúp mọi người nhẹ nhõm hơn.',
      'Văn phòng hôm nay hơi trầm lắng và căng—mong mọi người đều giữ vững tinh thần.',
    ],
    tired: [
      'Có ai muốn ra Phòng nghỉ ngơi làm tách cà phê trò chuyện năm phút không?',
      'Họp liên tiếp cả buổi hơi mệt rồi—ngả lưng trên ghế sofa chút nhé.',
    ],
    taskLines: {
      MARKET_GROWTH: ['Phản hồi từ cộng đồng người dùng hôm nay rất tích cực!'],
      RECRUIT_TALENT: ['Đang xem xét nhiều hồ sơ ứng viên sáng giá cho các vị trí mới.'],
      CLOSE_SALES: ['Khách hàng doanh nghiệp cởi mở hơn hẳn khi chúng ta tư vấn sát nhu cầu thực tế.'],
    },
  },
  ANALYTICAL: {
    highMorale: [
      'Tất cả chỉ số tăng trưởng đều đang đi đúng hướng.',
      'Dữ liệu cho thấy lần cải thiện chất lượng vừa rồi giúp giữ chân người dùng tốt hơn rõ rệt.',
    ],
    stressed: [
      'Chỉ số kiệt sức đang tăng—năng suất toàn đội sẽ giảm nếu giữ cường độ này quá lâu.',
      'Tỷ lệ lỗi và mức độ căng thẳng đang tăng tỷ lệ thuận khá đáng ngại.',
    ],
    tired: [
      'Độ tập trung chỉ còn khoảng ba mươi phần trăm. Tôi cần nghỉ ngắn để nạp lại năng lượng.',
      'Cần nạp chút tỉnh táo trước khi kiểm tra tiếp bảng tính phân tích nhóm khách hàng.',
    ],
    taskLines: {
      PLAN_ROADMAP: ['Đang sắp xếp lộ trình tính năng theo tỷ lệ nhu cầu trên công sức cao nhất.'],
      MANAGE_FINANCE: ['Dòng tiền tháng này cần được kiểm soát chặt chẽ để đảm bảo quỹ lương.'],
      OPERATIONS_SUPPORT: ['Đang siết chặt kiểm tra tuân thủ pháp lý và độ ổn định máy chủ.'],
    },
  },
};

export function pushChatter(
  state: GameState,
  entry: Omit<ChatterMessage, 'id' | 'day' | 'hour'>
): void {
  const msg: ChatterMessage = {
    ...entry,
    id: `chat_${state.totalDays}_${Math.random().toString(36).slice(2, 7)}`,
    day: state.totalDays,
    hour: state.hourOfDay,
  };
  state.chatterFeed.unshift(msg);
  state.chatterFeed = state.chatterFeed.slice(0, 10);
}

export function generateEmployeeChatterForContext(
  state: GameState,
  trigger:
    | 'DAILY'
    | 'MVP_LAUNCH'
    | 'UPDATE_SHIPPED'
    | 'PROMOTION'
    | 'MOTIVATE'
    | 'EVENT'
    | 'NEW_HIRE'
    | 'OFFICE_EXPANDED',
  targetEmployee?: Employee
): void {
  if (state.employees.length === 0) return;

  const locale = getLocale();
  const isVi = locale === 'vi-VN';
  const rng = seededRandom(state.seed + state.totalDays * 997 + state.chatterFeed.length * 37);
  const stressedPool =
    trigger === 'DAILY'
      ? state.employees.filter((e) => e.resignationWarning || e.morale < 38 || e.stress > 72)
      : [];
  const speakerPool =
    stressedPool.length > 0 && rng() < 0.75 ? stressedPool : state.employees;
  const emp =
    targetEmployee ?? speakerPool[Math.floor(rng() * speakerPool.length)];
  const roleLabel = getRoleLocalized(emp.role, locale).short;
  const flavor = (isVi ? PERSONALITY_FLAVOR_VI : PERSONALITY_FLAVOR_EN)[emp.personality];

  let tone: ChatterMessage['tone'] = 'NEUTRAL';
  let text = '';

  if (trigger === 'MVP_LAUNCH') {
    tone = 'EVENT';
    const prodName = state.products[state.products.length - 1]?.name ?? 'MVP';
    text = isVi
      ? `Chúng ta đã chính thức ra mắt ${prodName}! Háo hức chờ những người dùng đầu tiên đăng ký.`
      : `We actually shipped ${prodName}! Excited to watch signups roll in.`;
  } else if (trigger === 'UPDATE_SHIPPED') {
    tone = 'POSITIVE';
    text = isVi
      ? 'Bản cập nhật mới chạy mượt mà hơn hẳn—khách hàng sẽ cảm nhận được ngay.'
      : 'Latest release feels way smoother—customers should notice right away.';
  } else if (trigger === 'PROMOTION') {
    tone = 'POSITIVE';
    text = isVi
      ? `Rất vinh dự khi được thăng cấp lên ${ROLE_DEFINITIONS[emp.role].shortLabel} cấp ${emp.level}! Tôi sẽ nỗ lực hết mình vì đội ngũ.`
      : `Honored by the promotion to ${emp.title}! Ready to step up for the team.`;
  } else if (trigger === 'MOTIVATE') {
    tone = 'POSITIVE';
    text = isVi
      ? 'Cảm ơn lời động viên của bạn—đúng lúc tôi cần thêm tinh thần cho hôm nay!'
      : 'Appreciate the pep talk—needed that boost today!';
  } else if (trigger === 'NEW_HIRE') {
    tone = 'EVENT';
    text = isVi
      ? `Rất vui được gia nhập ${state.config.companyName}! Tôi đang ổn định bàn làm việc ngay.`
      : `Thrilled to join ${state.config.companyName}! Setting up my desk now.`;
  } else if (trigger === 'OFFICE_EXPANDED') {
    tone = 'EVENT';
    text = isVi
      ? `Không gian văn phòng mới rộng rãi và thoải mái hơn hẳn, làm việc rất có cảm hứng!`
      : `The ${state.office.name} upgrade feels huge—so much more breathing room!`;
  } else if (trigger === 'EVENT') {
    tone = state.finance.cash < 5000 ? 'STRESSED' : 'EVENT';
    if (isVi) {
      text =
        state.finance.cash < 5000
          ? 'Tình huống vừa rồi khiến mọi người đều theo dõi sát sao dự trữ tiền mặt.'
          : 'Một bước ngoặt đáng chú ý—rất vui vì ban lãnh đạo đã xử lý quyết đoán.';
    } else {
      text =
        state.finance.cash < 5000
          ? 'That latest curveball has everyone watching runway numbers closely.'
          : 'Interesting turn of events—glad we handled it decisively.';
    }
  } else {
    const buggyLive = state.products.find(
      (p) => (p.stage === 'MVP_LIVE' || p.stage === 'MATURE') && p.bugs >= 4
    );

    if (emp.resignationWarning || emp.morale < 38 || emp.stress > 72) {
      tone = 'STRESSED';
      text = flavor.stressed[Math.floor(rng() * flavor.stressed.length)];
    } else if (emp.energy < 42 || emp.assignedTask === 'REST_BREAK') {
      tone = 'NEUTRAL';
      text = flavor.tired[Math.floor(rng() * flavor.tired.length)];
    } else if (buggyLive && rng() < 0.45) {
      tone = 'STRESSED';
      text = isVi
        ? `Khách hàng đang gặp ${buggyLive.bugs} lỗi tồn đọng trên ${buggyLive.name}—cần ưu tiên sửa lỗi sớm.`
        : `Customers are noticing ${buggyLive.bugs} open bugs on ${buggyLive.name}—might need QA soon.`;
    } else if (state.finance.cash < 6000 && rng() < 0.4) {
      tone = 'STRESSED';
      text = isVi
        ? 'Quỹ tiền mặt đang mỏng dần—hy vọng doanh số tăng kịp trước kỳ trả lương.'
        : 'Cash cushion is getting thin—hoping sales pick up before payroll.';
    } else if (emp.morale >= 80 && rng() < 0.5) {
      tone = 'POSITIVE';
      text = flavor.highMorale[Math.floor(rng() * flavor.highMorale.length)];
    } else {
      const taskPool = flavor.taskLines[emp.assignedTask];
      if (taskPool && taskPool.length > 0) {
        tone = 'NEUTRAL';
        text = taskPool[Math.floor(rng() * taskPool.length)];
      } else {
        tone = 'POSITIVE';
        text = flavor.highMorale[Math.floor(rng() * flavor.highMorale.length)];
      }
    }
  }

  pushChatter(state, {
    employeeId: emp.id,
    employeeName: emp.name,
    roleLabel,
    personality: emp.personality,
    tone,
    text,
    shirtColor: emp.appearance.shirtColor,
  });

  // Unused import safety keep
  void getTraitLocalized;
}
