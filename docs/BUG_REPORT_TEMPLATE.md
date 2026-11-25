# Bug Report Template

Copy this template when logging a defect discovered during automated or manual QA.

---

## Defect Summary
- **Bug ID:** `BUG-YYYYMMDD-XXX`
- **Title:** `<Concise summary of the failure>`
- **Related Test Case:** `<e.g., TC-TUT-001 or Ad-hoc>`
- **Severity:** `<S0 Blocker | S1 Critical | S2 Major | S3 Minor>`
- **Status:** `<Open | In Progress | Fixed | Verified | Won't Fix>`
- **Area:** `<2.5D Canvas | Tutorial Portal | Simulation Engine | UI/Responsive | Save/Load | Auth | Audio/Voice | Localization>`

---

## Environment
- **Build / Branch / Commit:** `<commit hash or local working tree>`
- **Startup Command:** `<e.g., npm run dev>`
- **OS & Browser:** `<e.g., macOS / Chrome 130>`
- **Viewport Size & DPR:** `<e.g., 1440x900 @2x or 390x844 @3x>`
- **Locale:** `<vi-VN | en-US>`
- **Auth State:** `<Guest | Authenticated>`

---

## Game State Context
- **Screen / Mode:** `<TITLE_MENU | PLAYING | GAME_OVER | VICTORY>` · `<CAMPAIGN | SANDBOX>`
- **Day / Month / Year:** `<e.g., Day 4, Month 1, Year 1>`
- **Active Modal / Drawer:** `<e.g., PRODUCTS | CEO_OFFICE drawer | None>`
- **Tutorial Step:** `<1..8 | Completed | Skipped>`
- **Camera State (if 2.5D/tutorial bug):** `<Approximate zoom level / panned district>`

---

## Steps to Reproduce
1. ...
2. ...
3. ...

---

## Expected Behavior
`<Describe what should happen according to docs/TEST_CASES.md or system specs.>`

---

## Actual Behavior
`<Describe what actually happened.>`

---

## Evidence & Diagnostics
- **Console Errors / Network Failures:**
  ```text
  <Paste browser console stack trace or failed /api/* HTTP status>
  ```
- **Screenshots / Screen Recording:** `<Attach path or describe visual misalignment>`
- **Automated Verification Output (if applicable):** `<Output from simulation.test.ts or npm run lint>`

---

## Suggested Root Cause / Notes (Optional)
`<Suspected file/component, e.g., src/components/tutorial/TutorialManager.tsx or src/game/engine/isoMath.ts>`
