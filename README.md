# Startup Founder Simulator (`Nhà sáng lập khởi nghiệp`)

A cozy 2.5D isometric startup management simulation game built with React, TypeScript, HTML5 Canvas, Tailwind CSS, and an Express authentication backend. Guide a fledgling tech company from a two-room starter suite to a thriving technology enterprise across a connected 7-district isometric city.

---

## Table of Contents

- [1. Project Overview](#1-project-overview)
- [2. Installation and Setup](#2-installation-and-setup)
- [3. Testing Documentation](#3-testing-documentation)
- [4. QA Test Case Documentation](#4-qa-test-case-documentation)
- [5. Game Systems Reference](#5-game-systems-reference)
- [6. Isometric 2.5D Technical Architecture](#6-isometric-25d-technical-architecture)
- [7. Save Data & Persistence Safety](#7-save-data--persistence-safety)
- [8. Troubleshooting](#8-troubleshooting)
- [9. Development Guidelines](#9-development-guidelines)

---

## 1. Project Overview

### Concept & Core Gameplay
In **Startup Founder Simulator**, players create a startup across five business archetypes (`SAAS`, `MOBILE_APP`, `GAME_STUDIO`, `AI_TOOLS`, `WEB_PLATFORM`) and three difficulty tiers (`BOOTSTRAPPED`, `BALANCED`, `ANGEL_BACKED`), in either **Campaign** or **Sandbox** mode. Players manage their team on a live 2.5D isometric office floor and connected city map—developing software products from concept to launch, assigning tasks, acquiring customers via marketing and enterprise contracts, balancing 30-day payroll and cash runway, navigating narrative story chapters, and unlocking one of six distinct endings.

### Current Development Status
- **Playable Full-Stack SPA**: Complete simulation loop, 2.5D isometric office + 7-district connected city world, hybrid Cozy Pixel Art HUD & contextual drawers, 8-step interactive tutorial overlay, story mode cinematics, and ending gallery.
- **Bilingual Support**: Full `vi-VN` (default) and `en-US` localization parity (`1,369` keys verified in both locales).
- **Audio & Voice**: Procedural WebAudio cozy BGM/SFX mixer (`src/audio/audioManager.ts`) with smooth 500ms crossfade/mute ramps and browser speech synthesis narration (`src/audio/voiceService.ts`).
- **Automated Verification**: `51/51` simulation & API tests passing via Node's test runner, clean TypeScript (`tsc --noEmit`), and clean Vite production bundle.

### Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| **Frontend UI** | React `19.0.1`, TypeScript `7.0.2`, Tailwind CSS `4.3.3` | Cozy Pixel Art palette (`#F3F0E7`, `#303B38`, `#78978A`), `lucide-react`, `motion` |
| **Build Tooling** | Vite `8.3.0`, `@vitejs/plugin-react` | SPA bundler; serves static assets from `public/assets` into `dist/assets` |
| **Rendering** | HTML5 2D `<canvas>` (`src/components/OfficeCanvas.tsx`) | Custom 60fps 2:1 isometric renderer (`src/game/renderer/pixelRenderer.ts`) |
| **Backend Server** | Express `4.21.2` (`server.ts`, `tsx` runtime) | Serves `/api/auth/*`, `/api/account/me`, Vite middlewares in dev, `dist/` in prod |
| **Auth & Storage** | `bcryptjs` (`^3.0.3`), atomic JSON store + Browser `localStorage` | `.data/auth-db.json` (`0o600`) for user sessions; `localStorage` for game saves/settings |
| **Testing** | Node.js `node:test` + `tsx` | `src/game/__tests__/simulation.test.ts` (51 automated unit & integration tests) |

### Architecture Summary

#### Frontend (`src/`)
- **`src/App.tsx`**: Top-level shell orchestrating `TitleScreen`, `OfficeCanvas`, `GameHUD`, contextual `RoomActionDrawer` / `WorldActionDrawer`, management modals (`src/components/modals/*`), `StoryManager`, `CinematicPlayer`, and `TutorialManager`.
- **`src/hooks/useGameEngine.ts`**: Central React bridge holding `GameState` (plus `stateRef` for 60fps canvas reads), 1-second simulation tick driver, command dispatcher (`executeCommand`), autosave cadence, and sound triggers.
- **`src/game/engine/`**: Pure simulation core (`initGame.ts`, `simulation.ts`, `isoMath.ts`, `pathfinding.ts`).
- **`src/game/systems/`**: Modular domain systems (employees, products, finance, market, milestones, achievements, chatter, morale, weather, open world, story chapters, endings, celebrations, tutorial).
- **`src/game/data/`**: Static catalogs and layouts (`officeLayout.ts`, `cityWorld.ts`, `products.ts`, `roles.ts`, `events.ts`, `milestones.ts`, `achievements.ts`, `storyData.ts`).
- **`src/components/tutorial/`**: Portal-mounted 2.5D-aware `TutorialManager.tsx` and directional `TutorialArrow.tsx` using `ResizeObserver` (`src/hooks/useResizeObserver.ts`).

#### Backend (`server.ts`, `server/`)
- **`server.ts`**: Express HTTP server listening on `0.0.0.0:${PORT || 3000}` (`trust proxy` enabled). In development (`NODE_ENV !== 'production'`), attaches `vite.middlewares`; in production, serves static files from `dist/`.
- **`server/authRouter.ts`**: Exposes `/api/auth/session`, `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, and `/api/account/me` with per-IP rate limiting (default 12 attempts / 15 min) and `HttpOnly` cookie (`sf_session`).
- **`server/authStore.ts`**: Validates emails and password strength, hashes passwords with `bcryptjs` (cost factor `12`), hashes 32-byte session tokens with SHA-256, and persists atomically to `${AUTH_DATA_DIR || '.data'}/auth-db.json` via temporary file rename.

#### Database Technology (Important Clarification)
- **PostgreSQL / SQL databases are NOT configured in this repository** (no SQL schema, Drizzle/Prisma config, or `pg` driver is present).
- **Accounts & Sessions** are stored server-side in an atomic JSON database (`.data/auth-db.json`), ignored by `.gitignore`.
- **Game Progression & Preferences** are persisted client-side in browser `localStorage` with schema validation and automatic migration (`CURRENT_SAVE_VERSION = 1`). Logging in/out preserves guest local saves.

---

## 2. Installation and Setup

### Prerequisites
- **Node.js**: `v22.x` or later (verified on `v22.23.5`)
- **npm**: `v10.x` or later (verified on `10.9.9`)

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env` when running locally if environment overrides are needed. Never commit `.env` or real credentials.

Defined in `.env.example`:
- `GEMINI_API_KEY`: Placeholder API key slot for Gemini runtime environment injection (not required to play the core simulation or run tests).
- `APP_URL`: Public host URL used when deployed behind a proxy.

Additional runtime variables read by `server.ts`, `server/authStore.ts`, and `vite.config.ts`:
- `PORT`: HTTP server port (defaults to `3000`).
- `NODE_ENV`: Set to `production` to serve `dist/` instead of Vite dev middleware.
- `AUTH_DATA_DIR`: Directory for `auth-db.json` (defaults to `./.data`). Useful for isolated integration testing.
- `DISABLE_HMR`: Set to `'true'` to disable Vite HMR and file watching.

### 3. Database Setup & Migrations
- **Backend Auth Store**: No manual setup or SQL migration step is required. `server/authStore.ts` automatically creates `.data/auth-db.json` (with `0o600` file permissions) on the first user registration or session write.
- **Game Save Data**: No SQL migrations exist. Legacy or partial `localStorage` save payloads are automatically normalized on load via `validateSaveState()` and `migrateSaveState()` in `src/services/saveService.ts`.

### 4. Local Development & Production Commands
All scripts defined in `package.json`:

| Command | Purpose |
|---|---|
| `npm run dev` | Starts unified Express backend + Vite dev server via `tsx server.ts` on port `3000` |
| `npm run lint` | Runs strict TypeScript type-checking (`tsc --noEmit`) |
| `npm run build` | Builds client SPA into `dist/` (`vite build`) |
| `npm run start` | Runs `node server.ts` (intended for Node versions/builds running compiled/native TS or `NODE_ENV=production`) |
| `npm run preview` | Runs `vite preview` to inspect the static `dist/` bundle |
| `npm run clean` | Removes `dist` and `server.js` (`rm -rf dist server.js`) |

> Note: `npm run start` invokes `node server.ts` directly; for development or environments without native Node TypeScript type-stripping for `.ts` imports, use `npm run dev` (`tsx server.ts`).

---

## 3. Testing Documentation

### Testing Architecture & Folder Structure
Automated verification relies on Node.js's built-in `node:test` and `node:assert/strict` modules executed through `tsx` (no external Jest/Vitest/Playwright dependency is installed).

```text
src/game/__tests__/
└── simulation.test.ts   # 51 automated unit & integration tests
```

`simulation.test.ts` provides lightweight polyfills for `localStorage` (reset in `beforeEach`) and runs real simulation engines, math utilities, pathfinding, localization parity checks, and HTTP auth endpoints (`createAuthApp()` backed by isolated temporary directories).

### Exact Test & Verification Commands

| Check Type | Command | What It Verifies |
|---|---|---|
| **All Automated Tests** | `npx tsx --test src/game/__tests__/simulation.test.ts` | Executes all 51 unit & integration tests (engine, economy, auth API, audio, tutorial, story/endings, 2.5D iso math, camera, pathfinding, connected city, weather, save migration) |
| **Filtered / Specific Tests** | `npx tsx --test --test-name-pattern="Phase 1" src/game/__tests__/simulation.test.ts` | Runs only tests matching the given pattern |
| **TypeScript Typecheck** | `npm run lint` | Runs `tsc --noEmit` across client, engine, and server code |
| **Production Build** | `npm run build` | Verifies Vite compilation and `dist/` bundle output |
| **Localization Key Parity** | `node -e "const en=require('./src/localization/locales/en-US.json');const vi=require('./src/localization/locales/vi-VN.json');function flat(o,p=''){return Object.entries(o).flatMap(([k,v])=>v&&typeof v==='object'&&!Array.isArray(v)?flat(v,p?p+'.'+k:k):[[p?p+'.'+k:k,v]])}const ek=flat(en).map(x=>x[0]),vk=flat(vi).map(x=>x[0]);console.log('en:',ek.length,'vi:',vk.length,'missingInVi:',ek.filter(k=>!vk.includes(k)).length,'missingInEn:',vk.filter(k=>!ek.includes(k)).length);"` | Confirms zero missing translation keys between `en-US.json` and `vi-VN.json` |

### Status of Unit, Integration, E2E, Visual, and Performance Testing
- **Unit & Engine Integration Tests (Implemented)**: Covered by `src/game/__tests__/simulation.test.ts` (tests 1–51, including Express auth HTTP integration using an isolated temporary `AUTH_DATA_DIR`).
- **End-to-End (E2E) Browser Tests (Manual / Not Configured)**: Playwright/Cypress is **not installed** in `package.json`. Browser gameplay, tutorial portal alignment, responsive viewports, and drag/zoom interactions are verified via structured manual QA procedures in [`docs/TEST_CASES.md`](docs/TEST_CASES.md).
- **Visual Regression Testing (Manual / Planned)**: No automated pixel-diff/screenshot harness is installed. Visual inspection checklists (Cozy Pixel Art palette, isometric wall/furniture occlusion, dialogue portraits, tutorial spotlight masks) are tracked in [`docs/QA_TEST_PLAN.md`](docs/QA_TEST_PLAN.md).
- **Performance Testing (Manual / Planned)**: No automated benchmark runner is configured. Verify 60fps canvas rendering, DPR capping (`<= 2`), and particle budget scaling via browser DevTools Performance profiler (criteria documented in `docs/QA_TEST_PLAN.md`).

---

## 4. QA Test Case Documentation

Formal QA artifacts live in [`docs/`](docs/):

- **[QA Test Plan](docs/QA_TEST_PLAN.md)**: Scope, test environments, data isolation policy, entry/exit criteria, and regression cadence.
- **[Master Test Cases](docs/TEST_CASES.md)**: Step-by-step test cases across initialization, 2.5D coordinates, tutorial portal overlay, simulation mechanics, save/load, auth, localization, and responsive viewports.
- **[Bug Report Template](docs/BUG_REPORT_TEMPLATE.md)**: Standard template for reporting defects with environment, save/state snapshot, reproduction steps, and severity classification.
- **[Test Execution Report](docs/TEST_EXECUTION_REPORT.md)**: Latest recorded verification results from automated runs and manual QA coverage tracking.

### Test ID & Status Conventions
- **ID Format**: `TC-<AREA>-<NNN>` (e.g., `TC-ISO-001`, `TC-TUT-003`, `TC-SIM-002`, `TC-SAVE-001`, `TC-AUTH-002`, `TC-UI-001`).
- **Execution Statuses**:
  - `PASS`: Actual behavior matches expected results under clean conditions.
  - `FAIL`: Behavior deviates from expected results; requires a linked defect using [`docs/BUG_REPORT_TEMPLATE.md`](docs/BUG_REPORT_TEMPLATE.md).
  - `BLOCKED`: Cannot execute because an upstream dependency, prerequisite step, or environment condition failed.
  - `NOT RUN`: Defined in suite but not yet executed in the current cycle (e.g., unrun browser E2E checks).

### Severity Levels

| Severity | Meaning | Examples |
|---|---|---|
| **S0 (Blocker)** | Crash, infinite loop, unrecoverable game freeze, or save corruption/data loss | Blank screen on boot; `validateSaveState` drops progress; server auth crashes |
| **S1 (Critical)** | Core feature unusable with no viable workaround | Tutorial blocks progression; cannot launch MVP; negative/broken payroll calculation; wrong auth session access |
| **S2 (Major)** | Feature degraded or visually broken, workaround exists | Tutorial arrow slightly offset at certain zoom levels; drawer clips on tablet; missing translation key |
| **S3 (Minor)** | Cosmetic polish, minor copy typo, non-blocking visual glitch | Slight tooltip padding mismatch; subtle SFX timing quirk |

### Regression Requirements
Before merging changes affecting engine logic, UI layout, isometric coordinates, or persistence:
1. Run `npm run lint` (`0` TypeScript errors).
2. Run `npx tsx --test src/game/__tests__/simulation.test.ts` (`51/51` passing).
3. Run `npm run build` (`vite build` succeeds cleanly).
4. Execute targeted manual smoke cases in `docs/TEST_CASES.md` matching the modified area (Tutorial/2.5D camera, Save/Load migration, Auth flow, Desktop + Mobile viewports).

---

## 5. Game Systems Reference

### Initialization (`src/game/engine/initGame.ts`)
- `createNewGame(params)` seeds a deterministic run ID, initializes `OFFICE_COLS = 36` by `OFFICE_ROWS = 24` office layout, sets difficulty starting capital (`BOOTSTRAPPED`: `$28,000`, `BALANCED`: `$42,000`, `ANGEL_BACKED`: `$68,000`), creates one starter product at 45% progress, assigns 3 founding staff (`Liam Chen`, `Maya Patel`, `Noah Brooks`), populates the initial candidate pool, initializes tutorial step 1, 6 objectives, open-world city state, weather state, and Story Mode intro cinematic (in `CAMPAIGN` mode).

### Office & Connected City World
- **HQ Office (`36 × 24` tiles, `src/game/data/officeLayout.ts`)**: 8 rooms (`CEO_OFFICE`, `ENGINEERING`, `HR_DEPT`, `FINANCE_DEPT`, `BREAK_ROOM`, `MEETING_ROOM`, `LOBBY`, `LEGAL_DEPT`). Only `CEO_OFFICE` and `ENGINEERING` start unlocked; remaining rooms unlock progressively by day, MVP launch, and paying customer count (`evaluateRoomUnlocks` in `src/game/systems/tutorialSystem.ts`).
- **Office Levels & Furniture**: 4 HQ levels (`Startup Office`, `Product Studio`, `Client Lounge`, `Large Technology Company`) scaling max employee capacity (`6 → 10 → 15 → 22`) and monthly rent. Interactive furniture (`WORKSTATION`, `ESPRESSO_BAR`, etc.) can be bought, placed, and moved with collision validation.
- **Connected City (`src/game/data/cityWorld.ts`, `src/game/systems/openWorldSystem.ts`)**: Unified walkable world spanning `x ∈ [-14, 51], y ∈ [-4, 44]` with 7 locations: `COMPANY_HQ`, `MAIN_STREET`, `COFFEE_SHOP`, `COWORKING_SPACE`, `INVESTOR_CENTER`, `EVENT_HALL`, and `BUSINESS_PROPERTIES` (purchasable commercial properties adding passive revenue/capacity).

### Employees (`src/game/systems/employeeSystem.ts`)
- **8 Roles**: `SOFTWARE_ENGINEER`, `DESIGNER`, `MARKETING_SPECIALIST`, `SALES_REP`, `ACCOUNTANT`, `HR_MANAGER`, `PRODUCT_MANAGER`, `OPERATIONS_MANAGER`.
- **Attributes & Traits**: Levels 1–4, 6 skills (`engineering`, `design`, `marketing`, `sales`, `finance`, `operations`), `energy`, `morale`, `stress`, 6 personalities, and 7 threshold-unlocked traits (`evaluateEmployeeTraits`).
- **Living Office AI**: Employees reserve unique seats (`reserveFreeRoomSeat`), pathfind between desks/break room/meeting room, emit contextual chatter (`chatterSystem.ts`), and switch to `OFF_DUTY` at end of workday.

### Finance, Products & Market
- **Products (`src/game/systems/productSystem.ts`)**: Progress through `CONCEPT → IN_DEV → MVP_LIVE → MATURE → SUNSET`, supported by development tasks, build sprints, feature upgrades, and bug-fixing.
- **Market & Contracts (`src/game/systems/marketSystem.ts`)**: 6 marketing channels (`SOCIAL_MEDIA`, `PAID_ADS`, `SEO`, `CONTENT_MARKETING`, `DIRECT_SALES`, `PARTNERSHIPS`), daily customer acquisition/churn, competitor pressure, and B2B client contracts.
- **Finance (`src/game/systems/financeSystem.ts`)**: Tracks daily revenue/R&D spend and closes each 30-day cycle via `processEndOfMonth` (salaries, founder draw `MIN_FOUNDER_SALARY`..`MAX_FOUNDER_SALARY`, office rent, maintenance, tax/runway checks).

### Events, Milestones, Weather & Celebrations
- **Random & Story Events**: Business dilemmas (`eventSystem.ts`) and narrative story choices (`storyEventSystem.ts`) pause the simulation clock until resolved.
- **Milestones & Achievements**: Tracked chronologically (`milestoneSystem.ts`, `milestoneTimeline.ts`, `achievementSystem.ts`) with non-intrusive queued celebration banners (`celebrationSystem.ts`), screen particles (`celebrationParticles.ts`), and chime SFX.
- **Weather (`weatherSystem.ts`)**: Cycles deterministically (`SUNNY → OVERCAST → RAINY → SUNNY`), affecting interior/exterior ambiance and window/street visuals.

### Tutorial, Story, Cinematics & Endings
- **Tutorial & Objectives (`tutorialSystem.ts`)**: 8 guided steps (Review team → Explore CEO Office & Engineering → Create product → Assign work → Launch MVP → Acquire customer → Inspect Finances → End Day 1) synced with 6 persistent startup objectives. Supports skip, pause/resume, and manual step review.
- **Story & Endings (`chapterProgression.ts`, `endingEvaluator.ts`)**: Intro + 6 milestone-driven Chapters (`CH1`–`CH6`), full-screen `CinematicPlayer` (`CinematicCanvasStage` + `DialogueBox`), 6 evaluated endings (Dream IPO/Scale, Cozy Studio, Acquisition, Burnout, Insolvency, Tech Legacy) archived in the persistent Ending Gallery (`endingGalleryService.ts`).

---

## 6. Isometric 2.5D Technical Architecture

### Coordinate Spaces & Projection (`src/game/engine/isoMath.ts`)
The game uses a right-handed **2:1 isometric projection** (`ISO_TILE_WIDTH = 64`, `ISO_TILE_HEIGHT = 32`, `ISO_HALF_W = 32`, `ISO_HALF_H = 16`):

```text
World Grid (wx, wy) ──worldToIso──▶ Isometric Plane (isoX, isoY) ──isoToScreen──▶ Canvas (sx, sy) ──+rect.left/top──▶ Viewport (clientX, clientY)
```

1. **World → Isometric**:
   - `isoX = (wx - wy) * 32`
   - `isoY = (wx + wy) * 16 - elevationPx`
   - `+X` moves down-right; `+Y` moves down-left.
2. **Isometric → Screen (Canvas)**:
   - `screenX = canvasWidth * 0.5 + (isoX - camera.x) * camera.zoom`
   - `screenY = canvasHeight * 0.5 + (isoY - camera.y) * camera.zoom`
3. **Exact Inverse (`screenToWorld`)**:
   - Converts screen coordinates back to the `elevationPx = 0` plane cleanly (`isoToWorld` solves `u = isoX / 32`, `v = isoY / 16`, `wx = (u + v) * 0.5`, `wy = (v - u) * 0.5`).
4. **Unified Overlay Projection (`getScreenSpaceCoordinates`)**:
   - Accepts either a DOM `Element` (returning `getBoundingClientRect()`) or world coordinates `(wx, wy, canvasW, canvasH, camera, objW, objH, elevationPx)` and returns a viewport/screen `ScreenSpaceRect` (`left, top, right, bottom, width, height`) scaled by `camera.zoom`.

### Camera Pan, Zoom & Character Controls
- **Zoom Clamping**: Zoom is clamped to `[0.42, 2.2]`; `zoomAroundScreenPoint()` preserves the exact world/iso point beneath the cursor during wheel or pinch zoom.
- **World Bounds Clamping**: `clampIsoCamera()` constrains camera center `(x, y)` inside `getWorldIsoBounds(WORLD_MIN_X, WORLD_MAX_X + 1, WORLD_MIN_Y, WORLD_MAX_Y + 1)` with `paddingPx = 120`.
- **DPR Handling (`OfficeCanvas.tsx`)**: Canvas backing store scales by `Math.min(window.devicePixelRatio || 1, 2)` and applies `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` while math uses CSS client dimensions (`clientWidth`, `clientHeight`).
- **WASD Screen-to-World Mapping (`getIsoMovementVector`)**: Maps intuitive screen directions to diagonal world axes and normalizes length (`wx = sx + sy`, `wy = sy - sx`), so pressing `W` moves visually up (`-X, -Y`), `D` moves visually right (`+X, -Y`), `S` moves down (`+X, +Y`), and `A` moves left (`-X, +Y`).

### Depth Sorting & Collision / Pathfinding
- **Painter's Algorithm (`getIsoDepth`)**: Computes `wx + wy + bias`; larger values are closer to the viewer and drawn later. `hitTestIsoCharacters()` sorts front-to-back (`db - da`) so front-most characters win clicks.
- **Walkability & A\* (`src/game/engine/pathfinding.ts`, `openWorldSystem.ts`)**:
  - `buildWalkabilityGrid(office, openSouthEntrance)` marks unlocked room interiors, 2-tile corridor doorways (`y = 11..12`), and the south Lobby entrance (`x = 4..5, y = 22..23`), then blocks furniture footprints.
  - `buildFullWorldNavGrid` expands navigation across `WORLD_MIN_X..WORLD_MAX_X` and `WORLD_MIN_Y..WORLD_MAX_Y` for seamless walking between HQ and city districts via `findPath` / `findWorldPath`.

### Portal-Based 2.5D Tutorial Overlay (`TutorialManager.tsx` & `TutorialArrow.tsx`)
To prevent clipping or CSS transform drift inside nested game containers or scrolling modals:
- **Document Body Portal**: `TutorialManager` mounts a dedicated `#tutorial-overlay-root` node on `document.body` via `createPortal`.
- **Dual Target Resolution**:
  - *World targets* (`EMPLOYEE`, `FOUNDER`, `ROOM`): Resolved every frame via `cameraActionRef.current.getWorldTargetRect()`, which calls `worldToScreen()` using live `cameraRef.current` + `canvas.getBoundingClientRect()` and clamps inside canvas edges (`28px` inset).
  - *UI targets* (`[data-tutorial-target="..."]`): Resolved via viewport `getBoundingClientRect()`, checking `[data-modal-scroll-body="true"]` containers to detect scroll occlusion and auto-calling `scrollIntoView({ block: 'nearest', behavior: 'smooth' })`.
- **Dynamic Sync**: Re-measures on `requestAnimationFrame`, `window.resize`, capturing `scroll`, and `useResizeObserver` (`src/hooks/useResizeObserver.ts`).
- **Smart Auto-Flip (`TutorialArrow.tsx`)**: Flips `'up'`/`'down'`/`'left'`/`'right'`/`'curved'` directions automatically when near viewport boundaries (`120px` vertical / `268px` horizontal clearance) so tooltips stay readable without covering the target.

---

## 7. Save Data & Persistence Safety

### Client-Side Storage Keys (`localStorage`)

| Key Pattern | Source | Purpose |
|---|---|---|
| `startup_founder_save_v1_autosave` | `src/services/saveService.ts` | Automatic periodic save (`SaveEnvelope` `{ version: 1, savedAt, label, state }`) |
| `startup_founder_save_v1_slot_1..3` | `src/services/saveService.ts` | Manual player save slots 1–3 |
| `startup_founder_ending_gallery_v1` | `src/services/endingGalleryService.ts` | Permanently unlocked endings across runs |
| `startup_founder_locale_v1` | `src/localization/localeStore.ts` | Selected UI locale (`vi-VN` or `en-US`) |
| `startup_founder_audio_v1` | `src/audio/audioSettings.ts` | Master/BGM/SFX volumes and mute flags |
| `startup_founder_voice_v2` | `src/audio/voiceSettings.ts` | TTS enablement, speech rate, volume, auto-read toggles |

### Schema Migration & Data Integrity
- `validateSaveState()` verifies required root fields (`day`, `month`, `year`, `config`, `founder`, `finance`, `office`, `employees`, `products`, `milestones`, `contracts`) before passing to `migrateSaveState()`.
- `migrateSaveState()` cleanly backfills missing rooms, perk furniture, employee traits, achievements, legacy story states, open-world state, weather state, and tutorial state without wiping older saves.

### Server-Side Auth Persistence & Test Isolation
- **Auth Store (`server/authStore.ts`)**: Writes JSON atomically (write temp file with `0o600` mode, then `fs.renameSync`) to `${AUTH_DATA_DIR || '.data'}/auth-db.json`. Passwords use `bcryptjs` (cost 12); cookie tokens are stored exclusively as SHA-256 hashes.
- **No Relational DB**: There are no SQL schemas or external database credentials in this project.
- **Safe Testing Isolation**: Automated tests override `AUTH_DATA_DIR` with a fresh `fs.mkdtempSync(...)` temp folder (cleaned up in `after`) and run against an in-memory `localStorage` polyfill so developer `.data/` and browser saves are never mutated by tests.

---

## 8. Troubleshooting

| Symptom | Likely Cause | Resolution |
|---|---|---|
| **`EADDRINUSE` on port `3000`** | Another dev server or background process is using port `3000` | Stop the existing process or start with `PORT=3001 npm run dev` (note AI Studio preview requires `3000`) |
| **Auth login succeeds in API but session cookie isn't persisted on HTTP** | HTTPS-only `SameSite=None; Secure; Partitioned` vs HTTP `SameSite=Lax` mismatch behind proxy | Verify `trust proxy` headers (`x-forwarded-proto`); on local `http://localhost:3000`, `authRouter.ts` emits `SameSite=Lax` automatically |
| **`/api/auth/*` returns `429 RATE_LIMITED`** | Exceeded 12 auth requests within 15 minutes from the same IP | Wait for the rate-limit window to reset or restart the local dev server |
| **Tutorial arrow points to wrong spot or disappears** | Target element is inside a scrolled modal (`[data-modal-scroll-body="true"]`), occluded, or a blocking modal (`SETTINGS`, `SAVE_LOAD`, `EventModal`) is open | Close utility/blocking dialogs; scroll modal body or click the highlighted tab—`TutorialManager` re-syncs via `requestAnimationFrame` + `ResizeObserver` |
| **WASD / Arrow keys do not move the Founder** | Focus is inside an `<input>`/`<textarea>`/`<select>`, a blocking modal/cinematic is active, or a path tile is blocked | Click back onto the office canvas and close active overlays; verify target tile is not occupied by furniture |
| **Employee or Founder stops walking or can't enter a room** | Room is still locked (`HR_DEPT` Day 2, `FINANCE_DEPT` Day 2, `BREAK_ROOM` Day 3, `MEETING_ROOM` MVP Live, `LOBBY` 5 paying, `LEGAL_DEPT` 10 paying) or furniture blocks the doorway | Check room unlock conditions in `OfficeUpgradePanel` or move blocking furniture via edit mode |
| **Canvas appears blurry on Retina / HiDPI displays** | Browser zoom changed or initial layout resize hasn't propagated | Resize window or click Reset View; `OfficeCanvas.tsx` caps DPR at `2` and observes canvas bounds via `ResizeObserver` |
| **No background music or SFX plays** | Browser autoplay policy blocks `AudioContext` prior to user gesture, or Master/BGM/SFX is muted | Click anywhere in the app or toggle audio in `SettingsModal` (`AudioSettingsSection`) |
| **Voice narration has no available voices** | Host OS/browser lacks Web Speech API `speechSynthesis` voices for `vi-VN` or `en-US` | Open Voice Settings in `SettingsModal` to pick an available system voice or disable auto-read |
| **Corrupted browser save or blank loaded state** | Malformed JSON in `localStorage` | `loadGameFromSlot` returns `null` safely on invalid JSON; delete the bad slot in `SaveLoadModal` or run `localStorage.removeItem('startup_founder_save_v1_autosave')` in DevTools |
| **Missing translation keys or Vite build warning** | Edited one locale file without updating the other | Run the localization parity check from Section 3 and `npm run lint` before `npm run build` |

---

## 9. Development Guidelines

- **TypeScript & Strict Imports**: Keep all modules strongly typed in TypeScript (`npm run lint` must exit `0`). Use top-level imports and `@/*` path aliases configured in `tsconfig.json` and `vite.config.ts`.
- **Styling**: Use Tailwind CSS utility classes configured via `src/index.css` (`@import "tailwindcss";`) and preserve the Cozy Pixel Art palette (`#F3F0E7` Warm Cream, `#303B38` Dark Charcoal, `#78978A` Muted Sage, `#D9A66C` Warm Amber).
- **Server / Dev Entry**: Keep Express routes mounted in `server.ts` alongside `vite.middlewares` in dev mode; never move Express server mounting into `vite.config.ts`.
- **Save Backward Compatibility**: Any new fields added to `GameState` must include safe defaults in `migrateSaveState()` (`src/services/saveService.ts`) and a regression assertion in `src/game/__tests__/simulation.test.ts`.
- **Localization Parity**: Whenever adding UI copy, update both `src/localization/locales/en-US.json` and `src/localization/locales/vi-VN.json` and verify `0` missing keys.
- **Validation Before Finish**: Always run:
  ```bash
  npm run lint && npx tsx --test src/game/__tests__/simulation.test.ts && npm run build
  ```
