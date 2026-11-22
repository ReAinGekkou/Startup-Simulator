import { getOfficePerkBonuses } from '@/src/game/data/officeLayout';
import { getFounderSalaryProfile } from '@/src/game/systems/financeSystem';
import {
  EMPLOYEE_TRAITS,
  FIRST_NAMES,
  HAIR_COLORS,
  HAIR_STYLES,
  LAST_NAMES,
  PANTS_COLORS,
  PERSONALITY_MODIFIERS,
  ROLE_DEFINITIONS,
  SKIN_TONES,
} from '@/src/game/data/roles';
import { getRoomSeatTile } from '@/src/game/engine/pathfinding';
import {
  CharacterAppearance,
  Employee,
  EmployeePersonality,
  EmployeeRole,
  EmployeeSkills,
  EmployeeTask,
  EmployeeTraitDefinition,
  EmployeeTraitId,
  GameState,
  RecruitmentCandidate,
  RoomId,
} from '@/src/types/game';
import { clamp, seededRandom } from '@/src/utils/format';

const ALL_ROLES: EmployeeRole[] = [
  'SOFTWARE_ENGINEER',
  'DESIGNER',
  'MARKETING_SPECIALIST',
  'SALES_REP',
  'ACCOUNTANT',
  'HR_MANAGER',
  'PRODUCT_MANAGER',
  'OPERATIONS_MANAGER',
];

const PERSONALITIES: EmployeePersonality[] = [
  'PRAGMATIC',
  'PERFECTIONIST',
  'WORKAHOLIC',
  'CREATIVE',
  'SOCIAL',
  'ANALYTICAL',
];

export function generateAppearance(rng: () => number, role: EmployeeRole): CharacterAppearance {
  return {
    skinTone: SKIN_TONES[Math.floor(rng() * SKIN_TONES.length)],
    hairColor: HAIR_COLORS[Math.floor(rng() * HAIR_COLORS.length)],
    hairStyle: HAIR_STYLES[Math.floor(rng() * HAIR_STYLES.length)],
    shirtColor: ROLE_DEFINITIONS[role].outfitColor,
    pantsColor: PANTS_COLORS[Math.floor(rng() * PANTS_COLORS.length)],
    hasGlasses: rng() < 0.32,
  };
}

export function generateSkillsForRole(
  rng: () => number,
  role: EmployeeRole,
  level: 1 | 2 | 3
): EmployeeSkills {
  const base = level === 1 ? 26 : level === 2 ? 44 : 62;
  const primaryBonus = level === 1 ? 24 : level === 2 ? 28 : 30;
  const roll = (extra = 0) => clamp(Math.round(base + extra + rng() * 14), 15, 96);

  const primary = ROLE_DEFINITIONS[role].primarySkill;
  return {
    engineering: roll(primary === 'engineering' ? primaryBonus : -8),
    design: roll(primary === 'design' ? primaryBonus : -8),
    marketing: roll(primary === 'marketing' ? primaryBonus : -8),
    sales: roll(primary === 'sales' ? primaryBonus : -8),
    finance: roll(primary === 'finance' ? primaryBonus : -8),
    operations: roll(primary === 'operations' ? primaryBonus : -8),
  };
}

export function getLevelTitle(role: EmployeeRole, level: 1 | 2 | 3 | 4): string {
  const prefix =
    level === 1 ? 'Junior' : level === 2 ? 'Mid' : level === 3 ? 'Senior' : 'Lead';
  return `${prefix} ${ROLE_DEFINITIONS[role].shortLabel}`;
}

export function generateCandidatePool(
  seed: number,
  totalDays: number,
  hrBonus: number,
  count = 5
): RecruitmentCandidate[] {
  const rng = seededRandom(seed + totalDays * 7919);
  const candidates: RecruitmentCandidate[] = [];
  const usedNames = new Set<string>();

  for (let i = 0; i < count; i++) {
    const role = ALL_ROLES[(Math.floor(rng() * ALL_ROLES.length) + i) % ALL_ROLES.length];
    let name = '';
    for (let tries = 0; tries < 10; tries++) {
      const f = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
      const l = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
      const candidateName = `${f} ${l[0].toUpperCase()}${l.slice(1)}`;
      if (!usedNames.has(candidateName)) {
        usedNames.add(candidateName);
        name = candidateName;
        break;
      }
    }
    if (!name) name = `Alex Mercer ${i + 1}`;

    const levelRoll = rng() + hrBonus * 0.15;
    const level: 1 | 2 | 3 = levelRoll > 0.85 ? 3 : levelRoll > 0.45 ? 2 : 1;
    const roleDef = ROLE_DEFINITIONS[role];
    const salaryMult = level === 1 ? 0.85 : level === 2 ? 1.05 : 1.35;
    const expectedSalary = Math.round((roleDef.baseSalary * salaryMult + (rng() - 0.5) * 300) / 50) * 50;
    const hiringFee = Math.round(expectedSalary * 0.35);
    const personality = PERSONALITIES[Math.floor(rng() * PERSONALITIES.length)];
    const skills = generateSkillsForRole(rng, role, level);

    candidates.push({
      id: `cand_${totalDays}_${i}_${Math.floor(rng() * 10000)}`,
      name,
      role,
      level,
      expectedSalary,
      hiringFee,
      skills,
      personality,
      appearance: generateAppearance(rng, role),
      bio: `${PERSONALITY_MODIFIERS[personality].summary} ${roleDef.description}`,
      expiresDay: totalDays + 10,
    });
  }

  return candidates;
}

export function evaluateEmployeeTraits(emp: Employee): EmployeeTraitDefinition[] {
  if (!Array.isArray(emp.traits)) {
    emp.traits = [];
  }
  const newlyUnlocked: EmployeeTraitDefinition[] = [];
  for (const trait of EMPLOYEE_TRAITS) {
    if (!emp.traits.includes(trait.id) && emp.skills[trait.skillKey] >= trait.requiredSkill) {
      emp.traits.push(trait.id);
      newlyUnlocked.push(trait);
    }
  }
  return newlyUnlocked;
}

export function getNextTraitForEmployee(emp: Employee): EmployeeTraitDefinition | null {
  const owned = new Set<EmployeeTraitId>(emp.traits ?? []);
  const primary = ROLE_DEFINITIONS[emp.role].primarySkill;
  const primaryPending = EMPLOYEE_TRAITS.filter(
    (t) => t.skillKey === primary && !owned.has(t.id)
  ).sort((a, b) => a.requiredSkill - b.requiredSkill);
  if (primaryPending.length > 0) return primaryPending[0];

  const anyPending = EMPLOYEE_TRAITS.filter((t) => !owned.has(t.id)).sort(
    (a, b) => a.requiredSkill - b.requiredSkill
  );
  return anyPending[0] ?? null;
}

export function createEmployeeFromCandidate(
  candidate: RecruitmentCandidate,
  state: GameState,
  seatIndex: number
): Employee {
  const roleDef = ROLE_DEFINITIONS[candidate.role];
  const spawn = getRoomSeatTile(state.office, roleDef.homeRoom, seatIndex);
  const firstProductId = state.products[0]?.id ?? null;

  const emp: Employee = {
    id: `emp_${state.totalDays}_${Math.random().toString(36).slice(2, 7)}`,
    name: candidate.name,
    role: candidate.role,
    level: candidate.level,
    title: getLevelTitle(candidate.role, candidate.level),
    monthlySalary: candidate.expectedSalary,
    skills: { ...candidate.skills },
    productivity: 95,
    energy: 92,
    morale: 85,
    stress: 12,
    personality: candidate.personality,
    experience: 0,
    traits: [],
    assignedTask: roleDef.defaultTask,
    assignedProductId: firstProductId,
    homeRoom: roleDef.homeRoom,
    deskId: null,
    position: { ...spawn },
    targetTile: null,
    path: [],
    facing: 'DOWN',
    state: 'WORKING',
    thoughtIcon: null,
    appearance: { ...candidate.appearance },
    hiredDay: state.totalDays,
    lastTrainedDay: 0,
    resignationWarning: false,
  };
  evaluateEmployeeTraits(emp);
  return emp;
}

export function getTaskRoom(
  task: EmployeeTask,
  homeRoom: RoomId,
  office?: import('@/src/types/game').OfficeState
): RoomId {
  let target: RoomId;
  switch (task) {
    case 'REST_BREAK':
      target = 'BREAK_ROOM';
      break;
    case 'BUILD_PRODUCT':
    case 'FIX_BUGS':
      target = 'ENGINEERING';
      break;
    case 'MARKET_GROWTH':
    case 'PLAN_ROADMAP':
      target = 'MEETING_ROOM';
      break;
    case 'CLOSE_SALES':
      target = 'LOBBY';
      break;
    case 'MANAGE_FINANCE':
      target = 'FINANCE_DEPT';
      break;
    case 'RECRUIT_TALENT':
      target = 'HR_DEPT';
      break;
    case 'OPERATIONS_SUPPORT':
      target = 'LEGAL_DEPT';
      break;
    default:
      target = homeRoom;
  }

  if (office && !office.rooms[target]?.unlocked) {
    if (office.rooms[homeRoom]?.unlocked) return homeRoom;
    if (office.rooms.ENGINEERING?.unlocked) return 'ENGINEERING';
    return 'CEO_OFFICE';
  }
  return target;
}

export function computeEmployeeProductivity(emp: Employee, state: GameState): number {
  const roleDef = ROLE_DEFINITIONS[emp.role];
  const primarySkill = emp.skills[roleDef.primarySkill];
  const personalityMod = PERSONALITY_MODIFIERS[emp.personality].productivityMult;
  const energyFactor = 0.45 + (emp.energy / 100) * 0.65;
  const moraleFactor = 0.55 + (emp.morale / 100) * 0.55;
  const stressPenalty = emp.stress > 70 ? 1 - (emp.stress - 70) * 0.01 : 1;
  const techBonus = 1 + (state.office.techTier - 1) * 0.1;
  const leadershipBonus = 1 + state.founder.leadership * 0.0025;
  const traitMult =
    (emp.traits?.includes('SYSTEMS_VIRTUOSO') ? 1.15 : 1) *
    (emp.traits?.includes('FISCAL_ARCHITECT') ? 1.1 : 1);

  const raw =
    (0.55 + primarySkill / 120) *
    personalityMod *
    energyFactor *
    moraleFactor *
    stressPenalty *
    techBonus *
    leadershipBonus *
    traitMult *
    100;

  return clamp(Math.round(raw), 25, 175);
}

export function updateEmployeesDaily(state: GameState): {
  resignedNames: string[];
  unlockedTraits: Array<{ employeeName: string; traitId: EmployeeTraitId; traitName: string }>;
} {
  const resignedNames: string[] = [];
  const unlockedTraits: Array<{ employeeName: string; traitId: EmployeeTraitId; traitName: string }> = [];
  const hrManagers = state.employees.filter(
    (e) => e.role === 'HR_MANAGER' && e.assignedTask !== 'REST_BREAK'
  );
  const hrMoraleSupport = hrManagers.reduce((acc, e) => acc + e.skills.operations * 0.04, 0);
  const cultureCatalystBonus = state.employees.some(
    (e) => e.assignedTask !== 'REST_BREAK' && e.traits?.includes('CULTURE_CATALYST')
  )
    ? 1.5
    : 0;
  const comfortSupport = state.office.comfortScore * 0.05;
  const breakRoomBonus = ((state.office.rooms.BREAK_ROOM?.level ?? 1) - 1) * 4;
  const perkBonuses = getOfficePerkBonuses(state.office);
  const salaryProfile = getFounderSalaryProfile(
    state.founder.monthlySalary ?? 0,
    state.finance.cash
  );

  const remaining: Employee[] = [];

  for (const emp of state.employees) {
    const pMod = PERSONALITY_MODIFIERS[emp.personality];

    if (emp.assignedTask === 'REST_BREAK') {
      emp.energy = clamp(
        emp.energy + 28 + breakRoomBonus + perkBonuses.energyRecoveryPerDay,
        0,
        100
      );
      emp.stress = clamp(
        emp.stress - 22 - breakRoomBonus * 0.5 - perkBonuses.stressReductionPerDay,
        0,
        100
      );
      emp.morale = clamp(
        Math.round(
          emp.morale +
            12 +
            breakRoomBonus * 0.5 +
            perkBonuses.moraleBonusPerDay +
            salaryProfile.moralePerDay
        ),
        0,
        100
      );
    } else {
      // Normal workday drain & nightly sleep recovery
      const drain = 22 * pMod.stressRate;
      const nightRecovery =
        20 +
        state.office.comfortScore * 0.08 +
        breakRoomBonus * 0.5 +
        perkBonuses.energyRecoveryPerDay;
      emp.energy = clamp(emp.energy - drain + nightRecovery, 15, 100);
      emp.stress = clamp(
        emp.stress +
          7 * pMod.stressRate -
          comfortSupport * 0.5 -
          hrMoraleSupport * 0.4 -
          cultureCatalystBonus -
          perkBonuses.stressReductionPerDay,
        0,
        100
      );

      const baseMoraleShift =
        emp.stress > 75
          ? -6 * pMod.moraleDecay
          : emp.stress < 35
            ? 2.5 + hrMoraleSupport * 0.2
            : 0.5;
      const moraleShift =
        baseMoraleShift + perkBonuses.moraleBonusPerDay + salaryProfile.moralePerDay;
      emp.morale = clamp(Math.round(emp.morale + moraleShift), 5, 100);

      // Skill XP progression
      emp.experience += 6 + Math.round(state.founder.leadership * 0.05);
      const primary = ROLE_DEFINITIONS[emp.role].primarySkill;
      if (emp.experience % 24 < 7 && emp.skills[primary] < 98) {
        emp.skills[primary] = clamp(emp.skills[primary] + 1, 1, 100);
        const unlocked = evaluateEmployeeTraits(emp);
        for (const t of unlocked) {
          unlockedTraits.push({ employeeName: emp.name, traitId: t.id, traitName: t.name });
        }
      }
    }

    emp.productivity = computeEmployeeProductivity(emp, state);

    // Resignation check
    if (emp.morale <= 18 || (emp.stress >= 92 && emp.morale < 35)) {
      if (emp.resignationWarning) {
        resignedNames.push(emp.name);
        continue;
      }
      emp.resignationWarning = true;
    } else if (emp.morale > 40 && emp.stress < 75) {
      emp.resignationWarning = false;
    }

    remaining.push(emp);
  }

  state.employees = remaining;
  return { resignedNames, unlockedTraits };
}
