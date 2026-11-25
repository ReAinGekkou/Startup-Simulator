# Test Execution Report — Startup Founder Simulator

**Execution Date:** 2026-11-25  
**Scope:** Full documentation & verification pass (Engine/API tests, TypeScript lint, Vite production build, localization parity)  
**Environment:** Node `v22.23.5`, npm `10.9.9`, `tsx v4.23.15` (Linux)  
**Related Docs:** [`QA_TEST_PLAN.md`](QA_TEST_PLAN.md) · [`TEST_CASES.md`](TEST_CASES.md) · [`BUG_REPORT_TEMPLATE.md`](BUG_REPORT_TEMPLATE.md)

---

## 1. Execution Summary

| Suite / Check | Total | PASS | FAIL | BLOCKED | NOT RUN | Verdict |
|---|---:|---:|---:|---:|---:|---|
| Automated Simulation & API Tests (`simulation.test.ts`) | 51 | 51 | 0 | 0 | 0 | **PASS** |
| TypeScript Typecheck (`npm run lint`) | 1 | 1 | 0 | 0 | 0 | **PASS** |
| Production Build (`npm run build`) | 1 | 1 | 0 | 0 | 0 | **PASS** |
| Localization Key Parity (`en-US` vs `vi-VN`) | 1 | 1 | 0 | 0 | 0 | **PASS** |
| Manual Browser QA Cases (`docs/TEST_CASES.md` §2–§6) | 15 | 0 | 0 | 0 | 15 | **PENDING MANUAL RUN** |

---

## 2. Automated Check Details

### 2.1 `npm run lint` (`tsc --noEmit`)
- **Status:** `PASS`
- **Result:** Exited with code `0`; zero TypeScript compilation errors across `src/` and `server/`.

### 2.2 `npx tsx --test src/game/__tests__/simulation.test.ts`
- **Status:** `PASS` (`51/51` passed, `0` failed, `0` skipped, duration `~5.13s`)
- **Verified Subsystems:**
  - **Tests 1–25**: Game initialization, difficulty starting cash, product creation & MVP launch, task assignment, marketing campaigns, monthly payroll/founder salary, events, milestones, achievements, chatter, save/load, and locale switching.
  - **Test 26, 28, 30**: Cozy Audio settings persistence, corruption recovery, 500ms fade-in/out ramps, master mute preservation.
  - **Test 27**: Auth registration, login, `HttpOnly` cookie session lifecycle, expiry, IP rate limiting, `bcryptjs` hashing, and guest save preservation (isolated temp `AUTH_DATA_DIR`).
  - **Test 29**: Step 1 tutorial progression, pause/resume/skip preservation, locked room preview state.
  - **Tests 31–43**: Deterministic weather cycles, morale notifications & Coffee Break recovery, Story Mode Chapters 1–6, story event consequences, 6-ending evaluator, Ending Gallery persistence, TitleScreen ambient tick & assets, queued milestone celebrations, timeline stats, particle bursts, and milestone chimes.
  - **Tests 44–51**: Phase 1 Isometric projection round-trips, depth sorting, character hitboxes; Phase 2 zoom-around-cursor & bounds clamping; Phase 3 WASD isometric vectors, A* pathing, wall collision; Phase 4 employee activity states & seat reservation de-duplication; Phase 5–7 connected 7-district city navigation, open-world NPCs/venues, property ownership boosts, global weather cycle, and `v1` save migration.

### 2.3 `npm run build` (`vite build`)
- **Status:** `PASS` (`built in 1.70s`)
- **Output Summary:**
  - `1,752` modules transformed.
  - `dist/index.html` (`1.36 kB`)
  - `dist/assets/index-*.css` (`51.54 kB`)
  - `dist/assets/index-*.js` (`1,341.62 kB`)
  - Static assets under `public/assets` copied cleanly into `dist/assets`.

### 2.4 Localization Parity Check (`en-US.json` vs `vi-VN.json`)
- **Status:** `PASS`
- **Result:** `en: 1369`, `vi: 1369`, `missingInVi: 0`, `missingInEn: 0`.

---

## 3. Manual Browser QA Tracking

| Test ID | Title | Priority | Status | Notes |
|---|---|---|---|---|
| `TC-INIT-001` | Launch New Campaign & Starter State | P0 | `NOT RUN` | Requires interactive browser session |
| `TC-INIT-002` | Title Screen Ambient Canvas & Continue | P1 | `NOT RUN` | Requires interactive browser session |
| `TC-ISO-001` | Camera Pan, Zoom-Around-Cursor & Clamp | P0 | `NOT RUN` | Math covered in Test 45; pointer QA pending |
| `TC-ISO-002` | WASD Isometric Movement & Input Guard | P0 | `NOT RUN` | Vector math covered in Test 46; input focus QA pending |
| `TC-ISO-003` | Click-to-Move, A* & Wall/Furniture Collision | P1 | `NOT RUN` | Grid A* covered in Tests 46, 48; click QA pending |
| `TC-ISO-004` | Painter's Depth Sorting & Character Hitboxes | P1 | `NOT RUN` | Hitbox math covered in Test 44; overlap QA pending |
| `TC-TUT-001` | Portal Mount & World Target Tracking | P0 | `NOT RUN` | Verify `#tutorial-overlay-root` in live DOM |
| `TC-TUT-002` | Scroll Occlusion & Resize Tracking | P0 | `NOT RUN` | Verify `ResizeObserver` + scroll auto-scroll |
| `TC-TUT-003` | Full 8-Step Tutorial & Skip/Resume | P0 | `NOT RUN` | Logic covered in Test 29; full UI walk pending |
| `TC-SIM-001` | End-of-Month Payroll & Runway Modal | P0 | `NOT RUN` | Logic covered in simulation tests; modal QA pending |
| `TC-SIM-002` | Story Chapters, Cinematics & Particles | P1 | `NOT RUN` | Logic covered in Tests 33–41; playback QA pending |
| `TC-SAVE-001` | Manual Save Slots, Delete & Reload | P0 | `NOT RUN` | Serialization covered in Tests 36, 50; modal QA pending |
| `TC-AUTH-001` | Register, Login, Cookie Persistence & Logout | P1 | `NOT RUN` | Express API covered in Test 27; browser cookie QA pending |
| `TC-LOC-001` | Live Switching (`vi-VN` / `en-US`) | P1 | `NOT RUN` | 1,369/1,369 parity verified; layout check pending |
| `TC-UI-001` | Responsive Viewports (Desktop/Tablet/Mobile) | P0 | `NOT RUN` | Verify `1440x900`, `834x1194`, `390x844` |

---

## 4. Open Defects
None logged from automated execution. Browser-level manual pass should record any findings using [`BUG_REPORT_TEMPLATE.md`](BUG_REPORT_TEMPLATE.md).
