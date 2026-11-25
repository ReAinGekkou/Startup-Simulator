# QA Test Plan — Startup Founder Simulator

**Document Version:** 1.0  
**Related Docs:** [`README.md`](../README.md) · [`TEST_CASES.md`](TEST_CASES.md) · [`BUG_REPORT_TEMPLATE.md`](BUG_REPORT_TEMPLATE.md) · [`TEST_EXECUTION_REPORT.md`](TEST_EXECUTION_REPORT.md)

---

## 1. Purpose & Scope

This QA Test Plan defines the quality gates, test environments, data isolation rules, and regression workflows for **Startup Founder Simulator** following the transition to the 2.5D isometric canvas, connected open-world city, portal-mounted tutorial system, and hybrid Cozy Pixel Art UI.

### In Scope
1. **Engine & Economy Simulation**: New game initialization, daily/monthly ticks, employee productivity/traits/morale, product lifecycle, marketing & contracts, cash runway & insolvency.
2. **2.5D Isometric World & Camera**: `worldToIso`/`isoToWorld`/`worldToScreen`/`screenToWorld`, `getScreenSpaceCoordinates`, camera pan/zoom clamping, WASD diagonal movement, painter's depth sorting, character hit-testing, and A* pathfinding across HQ + 7 city districts.
3. **Portal Tutorial Overlay (`TutorialManager` + `TutorialArrow`)**: Target resolution for both DOM elements and moving 2.5D canvas entities, viewport resize/scroll tracking (`ResizeObserver`), scroll occlusion handling, and smart arrow auto-flipping.
4. **Hybrid Cozy UI & Responsive Layouts**: Desktop (`>= 1024px`), Tablet (`768px–1023px`), and Mobile (`375px–767px`) HUD, contextual room/world drawers, management modals, keyboard shortcuts, and story/cinematic overlays.
5. **Persistence & Auth**: `localStorage` save/load slots & `v1` schema migration, Ending Gallery persistence, bilingual localization (`vi-VN` / `en-US`), audio/voice settings, and Express session auth (`/api/auth/*`).

### Out of Scope (Not Implemented in Current Codebase)
- Automated Playwright/Cypress E2E suite (no E2E runner installed; browser checks are manual).
- Automated pixel-diff visual regression harness.
- External PostgreSQL / cloud save synchronization (auth uses `.data/auth-db.json`; saves live in `localStorage`).

---

## 2. Test Environments

| Environment | Purpose | Command / Setup |
|---|---|---|
| **Headless Node Runner** | Unit & engine/API integration tests | `npx tsx --test src/game/__tests__/simulation.test.ts` |
| **Typecheck & Bundler** | Static type safety & production bundle verification | `npm run lint && npm run build` |
| **Local Dev Server** | Manual interactive browser QA (Express + Vite HMR disabled via `DISABLE_HMR` if needed) | `npm run dev` → `http://localhost:3000` |
| **Viewport Matrix (Manual)** | Responsive layout & touch/click verification | Desktop `1440×900`, Tablet `834×1194`, Mobile `390×844` |
| **Browsers (Manual)** | Cross-browser Canvas 2D, WebAudio, and Cookie validation | Chromium/Chrome (primary), Firefox, Safari/WebKit |

---

## 3. Test Data & Isolation Rules

1. **No Production/Developer Data Mutation**:
   - Automated tests in `src/game/__tests__/simulation.test.ts` install a clean in-memory `localStorage` mock before each test and spawn Express auth apps against temporary `fs.mkdtempSync()` directories (deleted in cleanup).
2. **Manual Browser Isolation**:
   - Use an Incognito/Private window or set `AUTH_DATA_DIR=/tmp/sfs-qa-auth` when running `npm run dev` for auth QA so local `.data/auth-db.json` and existing `localStorage` slots remain untouched.
   - Never commit `.data/`, `.env`, or exported save/auth artifacts.
3. **Zero Secrets Policy**:
   - Use synthetic test credentials only (e.g., `qa.tester@example.com` / `TestPass123`) during manual auth testing.

---

## 4. Entry & Exit Criteria

### Entry Criteria (Before Manual QA Pass)
- `npm run lint` exits with code `0`.
- `npx tsx --test src/game/__tests__/simulation.test.ts` passes `51/51` tests (`0` failures).
- `npm run build` completes cleanly with `dist/index.html` generated.
- Localization parity script reports `missingInVi: 0` and `missingInEn: 0`.

### Exit Criteria (Release / Milestone Sign-Off)
- **0 open S0 (Blocker)** defects.
- **0 open S1 (Critical)** defects.
- All automated checks (`lint`, `simulation.test.ts`, `build`, parity) are `PASS`.
- All core P0/P1 manual test cases in `docs/TEST_CASES.md` executed with `PASS` across Desktop (`1440×900`) and Mobile (`390×844`).
- `docs/TEST_EXECUTION_REPORT.md` updated with actual run date, build commit/state, and counts.

---

## 5. Regression & Defect Triage Policy

| Change Area | Mandatory Automated Checks | Required Manual Smoke Cases |
|---|---|---|
| `src/game/engine/isoMath.ts`, `OfficeCanvas.tsx` | `simulation.test.ts` (Tests 44–46), `lint`, `build` | `TC-ISO-001` through `TC-ISO-004` |
| `src/components/tutorial/*`, `tutorialSystem.ts` | `simulation.test.ts` (Test 29), `lint`, `build` | `TC-TUT-001` through `TC-TUT-004` |
| `src/services/saveService.ts`, `src/types/game.ts` | `simulation.test.ts` (Tests 36, 50, 51), `lint`, `build` | `TC-SAVE-001`, `TC-SAVE-002` |
| `server/authRouter.ts`, `server/authStore.ts` | `simulation.test.ts` (Test 27), `lint` | `TC-AUTH-001`, `TC-AUTH-002` |
| `src/components/*`, `src/localization/*` | Parity check, `lint`, `build` | `TC-UI-001`, `TC-UI-002`, `TC-LOC-001` |

When any test case fails, document the failure immediately using [`BUG_REPORT_TEMPLATE.md`](BUG_REPORT_TEMPLATE.md) and link the defect ID in [`TEST_EXECUTION_REPORT.md`](TEST_EXECUTION_REPORT.md).
