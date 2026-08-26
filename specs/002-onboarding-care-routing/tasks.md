# Tasks: Onboarding & Care Routing

**Input**: Design documents from `/specs/002-onboarding-care-routing/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included, and **not** as speculative TDD. Constitution Principle IV ("Verification Before Done") is non-negotiable, `contracts/firestore-rules.md` carries an explicit Verification section, and `quickstart.md` defines done in terms of those runs. The security-rules tests in particular are the only way to prove FR-023 — a rule that is not tested is a rule that is assumed.

**Organization**: Grouped by user story. US1 and US2 are both P1 and together form the MVP.

**Revision**: Updated after `/speckit-analyze`. Fixes: a Node runner for the rules suite (was specified with no runner that could execute it), an FR-025 enforcement task, dangling-intervention handling, concurrent-write handling, abandoned-intake retention, two missing success-criteria verifications, and `CarePackageService` → `CareAssignmentService` to match the collection and model.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable — different files, no dependency on an incomplete task
- **[US#]**: the user story served (user-story phases only)

## Path Conventions

Angular app at `src/app/`, Firebase config at repo root, rules tests at `tests/rules/`. Paths below are exact.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Environment, both test runners, and the two prerequisites that are expensive to skip.

- [X] T001 Confirm toolchain: run `nvm use` (22.12 per `.nvmrc`) and `npm install --legacy-peer-deps`, then `npm run build` to establish a clean baseline before any change
- [X] T002 [P] Add the Firestore emulator to local tooling and verify `firebase emulators:start --only firestore` runs
- [X] T003 [P] Install `@firebase/rules-unit-testing` as a dev dependency (use `--legacy-peer-deps`, per the pre-existing `firebase` 11 vs 12 peer conflict)
- [X] T004 Add a **Node** test runner for the rules suite: create `tests/rules/` with its own tsconfig and a `test:rules` script in `package.json`. `ng test` cannot run these — `tsconfig.spec.json` scopes Karma to `src/**/*.spec.ts`, and `@firebase/rules-unit-testing` is a Node library that will not run in a browser. Without this task, T010 is a blocking gate that cannot execute
- [X] T005 **BLOCKING** Export the live ruleset from the Firebase console (Firestore → Rules) and save it verbatim to `firestore.rules` — do not edit it in this task. Deploying a rules file replaces the entire live ruleset, so this baseline is what stops the feature silently stripping protection from `users`, `chats` and `workbooks`
- [X] T006 [P] Export one real `interventions/{id}` document and one `users/{uid}` document from the console and reconcile field names against `data-model.md`; record any mismatch in `research.md` R7. This is the check that would have caught the `phone` vs `phoneNumber` bug already shipped in `referrals.interface.ts`

**Checkpoint**: Build clean, emulator running, both runners working, live rules committed unchanged.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Data, rules and models every story depends on.

**⚠️ CRITICAL**: No user story work begins until this phase completes. T005 must be committed before T007.

- [ ] T007 Register the rules file by adding `"rules": "firestore.rules"` to the `firestore` block of `firebase.json`
- [ ] T008 Add the feature rules from `contracts/firestore-rules.md` to `firestore.rules` — `intakes/{uid}`, `careAssignments/{uid}` and its append-only `history` subcollection, and `config/{doc}` — as a reviewable diff on top of the T005 baseline
- [ ] T009 Implement the `isStaff()` rules helper against the existing `administrator` / `counsellor` roles, preferring a custom claim over a `get()` on `users/{uid}` (a `get()` inside a rule is billed and evaluated on every read; `processSignUp` already sets a `client` claim so the mechanism exists)
- [ ] T010 Write emulator rules tests in `tests/rules/firestore-rules.spec.ts`, run via `npm run test:rules` (T004), covering every case in `contracts/firestore-rules.md`. **The decisive case is that a member cannot read another member's `intakes/{uid}`** — if that passes, the collection split has done its job; if it fails, the whole reason for a separate collection is void
- [ ] T011 Add a rules regression test asserting the pre-existing collections (`users`, `chats`, `workbooks`, `interventions`) behave exactly as they did at the T005 baseline
- [X] T012 [P] Create the `config/onboarding` document in Firestore per `data-model.md` — `defaultInterventionIds` (must be non-empty), `adolescentAgeThreshold: 18`, `demographicsConsentVersion`, and the gender/region/language option lists
- [X] T013 [P] Add `selectableAtOnboarding`, `onboardingLabel`, `onboardingOrder` and `audience` to a representative set of `interventions/{id}` documents, including at least one `audience: 'adolescent'`
- [X] T014 [P] Create `src/app/models/intake.interface.ts` per `contracts/firestore-documents.md`. **It must contain no free-text field** — its absence is FR-006, not an omission
- [X] T015 [P] Enforce FR-025 the same way T014 enforces FR-006: assert no HIV-status field exists on the intake model, on any step form, or in `config/onboarding`'s option lists, and comment that its absence is the requirement. A negative requirement with nothing enforcing it is only a comment
- [X] T016 [P] Create `src/app/models/care-assignment.interface.ts` with `CareAssignment` and the `CareAssignmentSource` union
- [X] T017 [P] Extend `src/app/models/intervention.interface.ts` with the four new optional onboarding fields, keeping every existing field unchanged so documents lacking them keep working

**Checkpoint**: Rules deployed and proven, config readable, models compile. User stories can begin.

---

## Phase 3: User Story 1 - Complete intake and receive a package of care (Priority: P1) 🎯 MVP

**Goal**: A newly verified member is routed into intake, answers identity, demographics and intervention pills, and lands on Home with a package composed from their own selections.

**Independent Test**: Register a new account, verify the email, and confirm intake appears before Home, every answer persists, and the interventions list afterwards contains exactly the selections (or the default when nothing was picked).

### Tests for User Story 1

- [ ] T018 [P] [US1] Spec for `IntakeService` covering step writes, validation and completion in `src/app/services/intake.service.spec.ts`
- [X] T019 [P] [US1] Spec for `CareAssignmentService` covering composition from selections, the empty-selection default, and the in-progress union in `src/app/services/care-assignment.service.spec.ts`
- [ ] T020 [P] [US1] Spec for `OnboardingGuard` covering all three branches — complete, new-member redirect, and existing-member pass-through — in `src/app/guards/onboarding.guard.spec.ts`

### Implementation for User Story 1

- [X] T021 [US1] Implement `IntakeService` in `src/app/services/intake.service.ts` with `getIntake`, `saveStep` (merge writes) and `completeIntake`, per the contract in `contracts/firestore-documents.md`
- [X] T022 [US1] Add age and phone validation to `IntakeService`, reusing the `toDialable` sanitiser already written for the Referrals call button rather than writing a second one. No minimum age — under-18s are admitted (FR-021). Each rejection must carry a plain-language message saying what is wrong, not a validation code (FR-007)
- [X] T023 [US1] Implement `CareAssignmentService` in `src/app/services/care-assignment.service.ts` with `composeFromSelections`, `getAssignment` and `visibleInterventionIds`. Composition is synchronous on completion — no review step, no waiting state shown to the member (FR-012a)
- [X] T024 [US1] Add the history write in `CareAssignmentService` — copy the current assignment to `careAssignments/{uid}/history/{autoId}` before overwriting the parent
- [X] T025 [US1] Add `getSelectableInterventions(age)` to `src/app/services/interventions.service.ts`, ordering by `onboardingOrder ?? order` and placing the age-matching audience first (FR-005b)
- [ ] T026 [US1] Handle intervention ids in a package that no longer resolve — unpublished or deleted since selection. Surface them to the member rather than silently shrinking their package, consistent with User Story 3 acceptance scenario 4 — nothing disappears without explanation. Listed in the spec's Edge Cases
- [X] T027 [US1] Implement `OnboardingGuard` in `src/app/guards/onboarding.guard.ts` reading `users/{uid}.onboardingStatus` — never the intake document, so the guard reveals nothing sensitive
- [X] T028 [US1] Create the lazy-loaded onboarding feature module and routes in `src/app/pages/onboarding/onboarding.module.ts` and `onboarding-routing.module.ts`
- [X] T029 [US1] Create the stepped shell in `src/app/pages/onboarding/onboarding.page.ts|html|scss`, at the standard 104px content offset (no bleeding background)
- [X] T030 [P] [US1] Build the identity step in `src/app/pages/onboarding/steps/identity-step.component.ts|html|scss`, pre-filling email from the verified account so it is never retyped (FR-003)
- [X] T031 [P] [US1] Build the demographics step in `src/app/pages/onboarding/steps/demographics-step.component.ts|html|scss` — gender, region and language only, sourced from `config/onboarding`
- [X] T032 [P] [US1] Build the pill multi-select in `src/app/pages/onboarding/steps/selection-step.component.ts|html|scss`, styling pills with the existing `--pk-card-*` logo tokens rather than new colours
- [X] T033 [P] [US1] Build the confirm step in `src/app/pages/onboarding/steps/confirm-step.component.ts|html|scss`, showing **all answers given plus the composed package** back to the member before they finish — this is where FR-022 (a member can see what was collected about them) is satisfied at MVP; post-completion editing follows in US3
- [X] T034 [US1] Capture versioned demographic consent into `intakes/{uid}.consent` on the demographics step, reading `demographicsConsentVersion` from config (FR-019)
- [X] T035 [US1] **SAFETY-CRITICAL** Add a persistent crisis affordance to every intake step, invoking the existing counsellor path (`requestCounsellorChat`, `functions/src/index.ts:740`). It is permanently visible, never content-triggered. This is the **only** safeguarding in this flow — the free-text field it originally depended on no longer exists, so it looks like an orphan requirement and is not one (FR-018, Story 1 scenario 7, SC-007)
- [X] T036 [US1] Write `users/{uid}.onboardingStatus` on intake start and completion, and nothing else to that document — demographics must never land there (research R1)
- [X] T037 [US1] Register `OnboardingGuard` after `AuthGuard` on the protected subtree in `src/app/app-routing.module.ts`, leaving `/onboarding` itself behind `AuthGuard` only, to avoid a redirect loop
- [ ] T038 [US1] Verify ordering against the existing first-run walkthrough — `verify-email` → `/onboarding` → `/how-to-use` → `/home`. The walkthrough is a redirect inside `HomePage.ngOnInit`, not a guard; do not deepen that pattern, but test the two together or a member can be bounced between them
- [X] T039 [US1] Filter the list in `src/app/pages/interventions/interventions.page.ts` by `visibleInterventionIds`, keeping the existing `canView()` allowlist applied on top and leaving `allowedUserIds` untouched (research R3)

**Checkpoint**: A new member completes intake and sees only their package. US1 is independently demonstrable.

---

## Phase 4: User Story 2 - Leave and resume without losing answers (Priority: P1)

**Goal**: An interrupted intake resumes exactly where it stopped, including with no network.

**Independent Test**: Start intake, complete some steps, force-close the app, reopen, and confirm answers are intact and the member resumes at the first unanswered step.

### Tests for User Story 2

- [ ] T040 [P] [US2] Spec for the draft mirror — save, read, clear, and uid-scoping — in `src/app/services/intake.service.spec.ts`

### Implementation for User Story 2

- [X] T041 [US2] Add `saveDraft`, `readDraft` and `clearDraft` to `src/app/services/intake.service.ts`, keyed per uid so a shared device never leaks one member's draft into another's intake
- [X] T042 [US2] Mirror the in-flight step to the draft on change, and clear it once the step is committed to Firestore
- [X] T043 [US2] Maintain `completedSteps` on `intakes/{uid}` and resume at the first unanswered step on entry
- [X] T044 [US2] Allow backward navigation to review and change an earlier answer before submission (FR-009)
- [ ] T045 [US2] Define behaviour when two devices write the same intake concurrently — last-write-wins per step, with `status` guarded so it can only move `in_progress` → `complete` once and a second completion cannot produce a duplicate assignment. Listed in the spec's Edge Cases
- [ ] T046 [US2] Verify offline behaviour: answer a step in airplane mode, confirm it is retained and submitted on reconnect. **Do not** enable Firestore persistence to achieve this — it is an app-wide behaviour change for one flow's benefit (research R4)

**Checkpoint**: MVP complete. Both P1 stories work.

---

## Phase 5: User Story 3 - Change what you are working on (Priority: P2)

**Goal**: A member revisits and edits selections and details; the package updates immediately without losing progress.

**Independent Test**: Complete intake, add and remove selections, confirm the package updates while workbook progress survives.

- [ ] T047 [P] [US3] Spec for override-preservation — a member editing selections must not silently revert a staff override (FR-030) — in `src/app/services/care-assignment.service.spec.ts`
- [ ] T048 [US3] Add an intake-answers view and edit entry point to `src/app/pages/profile/profile.page.ts|html` (FR-022)
- [ ] T049 [US3] Recompose the package on save, writing the prior assignment to history first
- [ ] T050 [US3] Preserve access to in-progress interventions removed from the package, via the union in `visibleInterventionIds` (FR-015)
- [ ] T051 [US3] Tell the member what changed when their package changes, rather than letting an intervention disappear silently
- [ ] T052 [US3] Implement `withdrawDemographicsConsent` in `src/app/services/intake.service.ts` — clears the three demographic fields and stamps `demographicsWithdrawnAt`, and must **not** cascade to the care assignment or workbook history (FR-024)

**Checkpoint**: Members can correct a choice made on a bad day.

---

## Phase 6: User Story 4 - Existing members are brought into the new model (Priority: P2)

**Goal**: Pre-existing accounts are invited into intake without ever being locked out.

**Independent Test**: Take an account created before this feature; confirm it is prompted, can defer, and retains all prior progress either way.

- [ ] T053 [P] [US4] Spec for the existing-member branch of `OnboardingGuard` — absent status plus workbook history must pass through, not redirect — in `src/app/guards/onboarding.guard.spec.ts`
- [ ] T054 [US4] Detect existing members (no `onboardingStatus`, has workbook history) and allow them through the guard
- [ ] T055 [US4] Show a deferrable invitation explaining why intake is being asked (FR-026)
- [ ] T056 [US4] Re-invite on a later session after a deferral, without ever blocking access (FR-027)
- [ ] T057 [US4] Verify that no backfill writes to existing accounts — an untouched account must behave exactly as it does today

**Checkpoint**: Both cohorts coexist safely.

---

## Phase 7: User Story 5 - Programme staff can see and correct routing (Priority: P3)

**Goal**: Staff can view a member's intake and assigned package, and override the placement.

**Independent Test**: As a staff user, open a member's record, view answers and package, apply an override, and confirm the member's available interventions change.

**⚠️ BLOCKED — decision required before starting.** There is no admin route anywhere in `src/app/app-routing.module.ts`. The `administrator` role is read by messages and profile but opens no console, so these tasks have nowhere to live. Building one inside this feature would dwarf the feature. See `research.md` R6: does console-editing suffice, or does this become its own feature?

- [ ] T058 [US5] Resolve R6 with the programme and record the decision in `research.md` before writing any code below
- [ ] T059 [US5] Provide a staff view of a member's intake answers, package and assignment source (FR-028)
- [ ] T060 [US5] Implement `applyStaffOverride` in `src/app/services/care-assignment.service.ts`, recording `overriddenBy`, `overrideReason` and `effectiveAt` (FR-029)
- [ ] T061 [US5] Ensure an override survives later member edits rather than being silently replaced (FR-030)
- [ ] T062 [US5] Restrict all of the above to `isStaff()` in both rules and UI — the rule is the control; the UI is a convenience

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T063 Decide and implement what happens to a permanently abandoned intake — an account holding partial demographic data, possibly a minor's, with no package and no completion. Either a retention/cleanup rule or an explicit decision to retain, recorded in `research.md`. Interacts directly with FR-021 and FR-024. Listed in the spec's Edge Cases
- [ ] T064 [P] Verify SC-001 — intake completes in under 5 minutes on a real low-end Android device
- [ ] T065 [P] Verify SC-007 — the crisis affordance is reachable in one tap from 100% of intake steps
- [ ] T066 [P] Verify SC-010 — intake completes with no data loss on the slowest supported device and connection
- [ ] T067 [P] Verify SC-005 — run usability testing with at least 8 members and confirm they attribute the interventions they see to their own choice
- [ ] T068 [P] Verify SC-009 — run a full re-routing cycle and confirm zero loss of recorded care progress
- [ ] T069 [P] Confirm intake screens honour the 80px header / 104px offset rule and do not double-pad
- [ ] T070 Run `npm run build` and `npm test` clean, plus `npm run test:rules` green against the emulator
- [ ] T071 Update `tasks/lessons.md` with the `users/{uid}` read-surface finding — demographics cannot live on a document other members read, because Firestore has no field-level read control (constitution Principle V)
- [ ] T072 Record the outcome of T006 in `research.md` R7, and if the exported documents disagreed with `data-model.md`, reconcile before shipping

---

## Dependencies

```
Phase 1 Setup
   │  T004 (rules runner) BLOCKS T010
   │  T005 (rules baseline) BLOCKS T007/T008
   ▼
Phase 2 Foundational ── T010/T011 prove the rules before any UI reads them
   │
   ├──▶ Phase 3 US1 (P1) ─────────┐
   │                              ├──▶ MVP
   ├──▶ Phase 4 US2 (P1) ─────────┘     (US2 extends IntakeService from US1:
   │                                     T041 depends on T021)
   ├──▶ Phase 5 US3 (P2)   depends on US1 (T049 needs T023/T024)
   ├──▶ Phase 6 US4 (P2)   depends on US1 (T054 needs T027)
   └──▶ Phase 7 US5 (P3)   BLOCKED on T058
                                   │
                                   ▼
                            Phase 8 Polish
```

US1 and US2 are not fully independent: US2 extends the service US1 creates. They are separated because they fail differently — US1 failing means no routing, US2 failing means routing that real members never reach.

## Parallel Opportunities

- **Phase 1**: T002, T003, T006 together (T004 gates T010; T005 is manual and blocking)
- **Phase 2**: T012–T017 — different files and documents
- **US1 tests**: T018, T019, T020 together
- **US1 steps**: T030, T031, T032, T033 — four separate components
- **Phase 8**: T064–T069 — independent verification runs

## Implementation Strategy

**MVP = Phases 1, 2, 3, 4.** Both P1 stories, and nothing further.

Deliver in that order rather than by layer. The most common failure mode here would be building the intake UI first and discovering at integration that demographics were written to a document every group-chat peer can read — which is why the rules and the collection split land in Phase 2, before a single screen exists.

**Do not start Phase 3 until T010 passes.** A member being unable to read another member's intake is the requirement the entire data model was shaped around; proving it after the UI is built means proving it too late to change anything. T004 exists because that gate was previously specified with no runner able to execute it.

---

## Implementation status — halted at T007 (2026-08-25)

Phase 1 complete (T001-T006). Phase 2 models complete (T014-T017).
**Halted at T007 by a security finding, not by tooling.**

### T005 turned into a security audit

T005 was framed as deployment safety: capture the live ruleset so the feature's
rules do not silently replace it. Exporting it revealed that the live rules —
unchanged since **2021-07-11** — grant `read, update, write, delete` on
`/{document=**}` to any signed-in account. Three narrower blocks beneath it
match `/databases/chapters/documents`, where that segment is the *database*
name, so they have never matched anything.

See `SECURITY-FINDING.md`.

**This invalidates the plan's approach to FR-023.** Firestore ORs its rules — a
blanket allow cannot be narrowed by a more specific rule underneath. Adding
`intakes/{uid}` rules (T008) would not restrict anything. T010 would fail
against the live rules today, which is what that gate was for.

### Why work stopped rather than continued

Continuing means one of:

- deploying tightened global rules, which is a risky change to a live
  mental-health service and far beyond this feature's scope; or
- building intake UI that writes minors' demographic data into a database every
  signed-in account can read, with FR-023 knowingly unmet.

Neither is a call to make unilaterally. Three options are set out at the end of
`SECURITY-FINDING.md`.

**Decision (2026-08-25): Option A.** Rules remediation becomes its own feature.
This one stays paused at T007 until that lands, then resumes from T007 with the
tightened ruleset as its baseline instead of the open one.

### Also resolved

T006 exported the real document shapes. `interventions/{id}` carries `uid` and
`categoryId`, neither previously declared — both now optional on the model.
`users/{uid}` carries no `role` field in any sampled document, so `isStaff()`
(T009) must treat an absent role as "not staff". Recorded in research R7.

### State

| Task | Status |
|---|---|
| T001-T006 | Done |
| T007-T011 | **Blocked on the rules decision** |
| T012, T013 | Available — Firestore write access works; deferred until the rules decision, since they add data to an open database |
| T014-T017 | Done |
| Phase 3 onward | Gated on T010, which cannot pass under current rules |
