# Master QA Test Cases — Startup Founder Simulator

**Status Legend:** `PASS` | `FAIL` | `BLOCKED` | `NOT RUN`  
**Severity Legend:** `S0` Blocker · `S1` Critical · `S2` Major · `S3` Minor  
**Related Docs:** [`QA_TEST_PLAN.md`](QA_TEST_PLAN.md) · [`BUG_REPORT_TEMPLATE.md`](BUG_REPORT_TEMPLATE.md) · [`TEST_EXECUTION_REPORT.md`](TEST_EXECUTION_REPORT.md)

---

## 1. Automated Verification Baseline

| ID | Category | Command / Verification | Expected Result | Current Status |
|---|---|---|---|---|
| `TC-AUTO-001` | Typecheck | `npm run lint` (`tsc --noEmit`) | Exits `0` with zero TypeScript errors | `PASS` |
| `TC-AUTO-002` | Engine & API Suite | `npx tsx --test src/game/__tests__/simulation.test.ts` | `51/51` tests pass (`fail: 0`) | `PASS` |
| `TC-AUTO-003` | Production Build | `npm run build` | Builds `dist/` bundle and copies `public/assets` cleanly | `PASS` |
| `TC-AUTO-004` | Localization Parity | JSON key diff between `en-US.json` & `vi-VN.json` | Equal key counts (`1,369`), `0` missing keys either way | `PASS` |

---

## 2. Game Initialization & Title Screen

### `TC-INIT-001` — Launch New Campaign & Verify Starter State (P0 · S0)
- **Preconditions:** Fresh browser session (empty `localStorage`), server running via `npm run dev`.
- **Steps:**
  1. Open `http://localhost:3000`.
  2. Click **Start New Game**, enter Company Name `"QA Cloud"` and Founder Name `"Alex"`, choose `SAAS` + `BALANCED` + `CAMPAIGN`.
  3. Complete or skip the `INTRO` cinematic.
- **Expected Result:**
  - `PLAYING` screen renders 2.5D isometric office with `CEO_OFFICE` and `ENGINEERING` unlocked.
  - Starting cash equals `$42,000`, 3 starter employees present, starter product at `45%`, Tutorial Step 1 active.
- **Status:** `NOT RUN` *(Browser manual check)*

### `TC-INIT-002` — Title Screen Ambient Canvas & Continue Detection (P1 · S2)
- **Preconditions:** At least one valid save slot exists in `localStorage`.
- **Steps:**
  1. Reload `http://localhost:3000`.
  2. Observe background isometric office pan and floating dust overlay.
  3. Click **Continue**.
- **Expected Result:**
  - Title screen smoothly pans the ambient office without errors and loads the most recent save slot directly into `PLAYING` without re-playing the Intro cinematic.
- **Status:** `NOT RUN` *(Browser manual check)*

---

## 3. 2.5D Isometric Coordinate System, Camera & Movement

### `TC-ISO-001` — Camera Pan, Zoom-Around-Cursor & Bounds Clamping (P0 · S1)
- **Preconditions:** Active `PLAYING` session on `OfficeCanvas`.
- **Steps:**
  1. Hover cursor over `ENGINEERING` desk and scroll mouse wheel in and out repeatedly.
  2. Drag-pan across the connected city to `INVESTOR_CENTER` and `COWORKING_SPACE` edges.
  3. Click **Reset View**.
- **Expected Result:**
  - World point beneath cursor remains visually pinned during zoom (`0.42 <= zoom <= 2.2`).
  - Camera clamps smoothly to `WORLD_MIN_X..WORLD_MAX_X` / `WORLD_MIN_Y..WORLD_MAX_Y` bounds without losing the map off-screen.
  - Reset View cleanly re-centers HQ.
- **Status:** `NOT RUN` *(Automated math verified in Test 45; browser interaction manual)*

### `TC-ISO-002` — WASD Diagonal Screen-to-World Mapping & Input Guard (P0 · S1)
- **Preconditions:** Active `PLAYING` session, no modal open.
- **Steps:**
  1. Hold `W`, `A`, `S`, `D` individually for 1 second each.
  2. Open **Products** modal and type `"w"`, `"a"`, `"s"`, `"d"` into product name input.
- **Expected Result:**
  - `W` moves Founder visually up (`-X, -Y`), `S` down (`+X, +Y`), `A` left (`-X, +Y`), `D` right (`+X, -Y`).
  - Typing in modal inputs does NOT move the Founder or trigger HUD hotkeys.
- **Status:** `NOT RUN` *(Vector math verified in Test 46; browser interaction manual)*

### `TC-ISO-003` — Click-to-Move, A* Pathfinding & Wall/Furniture Collision (P1 · S1)
- **Preconditions:** Active `PLAYING` session with starter unlocked rooms.
- **Steps:**
  1. Click a walkable floor tile inside `CEO_OFFICE` while Founder is in `ENGINEERING`.
  2. Click a locked room (e.g., `LEGAL_DEPT`) or a furniture tile.
  3. Click an open street tile toward `COFFEE_SHOP`.
- **Expected Result:**
  - Founder follows a valid A* path through corridor doorways (`y=11..12`), avoiding desks/walls.
  - Clicking locked rooms does not walk through closed walls; walking out the south Lobby entrance (`x=4..5, y=22..23`) navigates seamlessly to Main Street.
- **Status:** `NOT RUN` *(Pathfinding verified in Tests 46 & 48; browser interaction manual)*

### `TC-ISO-004` — Painter's Algorithm Depth Sorting & Character Hitboxes (P1 · S2)
- **Preconditions:** Multiple employees and Founder standing near desks/plants.
- **Steps:**
  1. Walk Founder behind and in front of a desk and an employee.
  2. Click on overlapping employee sprites when standing near each other.
- **Expected Result:**
  - Entities with higher `(wx + wy)` render in front of lower-depth tiles/furniture.
  - Clicking overlapping characters selects the front-most sprite accurately.
- **Status:** `NOT RUN` *(Automated hitbox test in Test 44; visual check manual)*

---

## 4. Portal-Mounted Tutorial System

### `TC-TUT-001` — Portal Mount & World Target Tracking Across Camera Pan/Zoom (P0 · S1)
- **Preconditions:** New Campaign game at Tutorial Step 1 (employee world target) or Step 2 (`CEO_OFFICE` / `ENGINEERING` room target).
- **Steps:**
  1. Inspect DOM for `#tutorial-overlay-root` directly under `document.body`.
  2. Pan and zoom the 2.5D office camera while the curved tutorial arrow points at an employee or room.
- **Expected Result:**
  - `#tutorial-overlay-root` renders outside nested canvas/container transforms.
  - Highlight box & curved SVG arrow track the projected world target smoothly in real time without clipping or detaching.
- **Status:** `NOT RUN` *(Browser manual check)*

### `TC-TUT-002` — Modal Scroll Occlusion & Viewport Resize Tracking (P0 · S1)
- **Preconditions:** Tutorial Step 3–6 active inside a scrollable modal (`PRODUCTS`, `EMPLOYEES`, or `MARKET`).
- **Steps:**
  1. Scroll the modal body (`[data-modal-scroll-body="true"]`) so the target button moves out of view, then back in.
  2. Resize browser window from Desktop (`1440×900`) to Tablet (`834×1194`) to Mobile (`390×844`).
- **Expected Result:**
  - Target auto-scrolls into view on step transition; if manually scrolled off-screen, overlay avoids pointing into empty header/backdrop space.
  - `ResizeObserver` + `resize` listener immediately realigns highlight frame and auto-flips `TutorialArrow` to stay inside viewport margins.
- **Status:** `NOT RUN` *(Browser manual check)*

### `TC-TUT-003` — Full 8-Step Tutorial Progression & Skip/Resume Preservation (P0 · S1)
- **Preconditions:** New Campaign game starting at Step 1.
- **Steps:**
  1. Complete Steps 1 → 8 sequentially (click employee, explore CEO & Engineering rooms, create product, assign task, launch MVP, launch campaign/contract, open Finance, End Day 1).
  2. On a separate run, test **Skip Tutorial** and reload.
- **Expected Result:**
  - Each step advances cleanly, displays localized milestone feedback banner, and completes at Step 8 (`completed = true`).
  - Skipping persists cleanly across save/load without soft-locking any gameplay modal.
- **Status:** `NOT RUN` *(Progression logic verified in Test 29; full UI walk manual)*

---

## 5. Core Gameplay, Economy & Story

### `TC-SIM-001` — End-of-Month Payroll, Burn Rate & Cash Runway (P0 · S1)
- **Preconditions:** Active game approaching Day 30.
- **Steps:**
  1. Note current cash, employee salaries, founder draw, and HQ rent.
  2. Advance simulation to Day 30 and inspect `MonthlyReportModal`.
- **Expected Result:**
  - Monthly report reconciles revenue, salaries, founder salary, rent, maintenance, and net profit without NaN or mismatch against HUD cash.
- **Status:** `NOT RUN` *(Engine math verified in Tests 1–10; modal verification manual)*

### `TC-SIM-002` — Story Chapters, Cinematics, Celebration Particles & Endings (P1 · S2)
- **Preconditions:** Campaign run hitting milestone thresholds.
- **Steps:**
  1. Trigger Chapter milestone progression and verify `MilestoneCelebrationBanner` queues cleanly without overlapping blocking modals.
  2. Verify `CinematicPlayer` play/pause, speed toggle, skip, and Ending Gallery unlock persistence.
- **Expected Result:**
  - Simulation clock pauses during cinematics/story events; unlocked endings appear in `EndingGalleryModal` after reload.
- **Status:** `NOT RUN` *(Verified in Tests 33–36, 39, 41; UI playback manual)*

---

## 6. Save/Load, Auth, Localization & Responsive UI

### `TC-SAVE-001` — Manual Save Slots, Delete & Reload Integrity (P0 · S0)
- **Preconditions:** Active game at Day >= 2 with custom product and employee assignments.
- **Steps:**
  1. Open `SaveLoadModal`, save to `slot_1`, change game state, then reload `slot_1`.
  2. Delete `slot_2` and verify slot metadata updates.
- **Expected Result:**
  - Exact cash, day, employees, products, furniture, weather, and tutorial state restore cleanly.
- **Status:** `NOT RUN` *(Migration verified in Tests 36, 50, 51; modal UX manual)*

### `TC-AUTH-001` — Register, Login, Session Persistence & Guest Save Retention (P1 · S1)
- **Preconditions:** Dev server running (`npm run dev`), at least one local save exists before login.
- **Steps:**
  1. Open `AuthModal`, register a new test account (`qa.tester@example.com` / `TestPass123`) with Remember Me checked.
  2. Refresh page and verify `/api/auth/session` retains authenticated state.
  3. Log out and verify local game saves remain intact.
- **Expected Result:**
  - Authenticated session persists via `HttpOnly` `sf_session` cookie across refresh; logout clears session without deleting `localStorage` game saves.
- **Status:** `NOT RUN` *(Backend API verified in Test 27; browser cookie round-trip manual)*

### `TC-LOC-001` — Live Switching Between `vi-VN` and `en-US` (P1 · S2)
- **Preconditions:** Active game or Title screen.
- **Steps:**
  1. Switch language between Tiếng Việt (`vi-VN`) and English (`en-US`) via `LanguageSelector`.
  2. Inspect HUD, tutorial tooltips, room drawers, management modals, and currency formatting.
- **Expected Result:**
  - All visible labels translate immediately with zero raw translation keys (e.g., `hud.nav.*`) and `<html lang>` updates accordingly.
- **Status:** `NOT RUN` *(Key parity verified in `TC-AUTO-004`; visual layout overflow check manual)*

### `TC-UI-001` — Responsive Layout: Desktop, Tablet & Mobile Viewports (P0 · S1)
- **Preconditions:** Active `PLAYING` session.
- **Steps:**
  1. Inspect HUD, `ManagementMenu`, contextual drawers (`RoomActionDrawer` / `WorldActionDrawer`), and modals at `1440×900`, `834×1194`, and `390×844`.
- **Expected Result:**
  - No horizontal page overflow, overlapped HUD buttons, or unreachable modal close controls on mobile bottom-sheet/overlay layouts.
- **Status:** `NOT RUN` *(Browser manual check)*
