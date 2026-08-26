# Implementation Plan: Onboarding & Care Routing

**Branch**: `002-onboarding-care-routing` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-onboarding-care-routing/spec.md`

## Summary

A new member, once their email is verified, is routed to a guided intake before reaching Home. The intake collects identity and contact details, three demographic fields, and a multi-select of intervention "pills". Those selections *are* the package of care — nothing infers it — so the work is mostly a form, a persisted intake document, and a filter on the interventions list.

Two findings from reading the codebase shape this plan more than the spec does:

1. **`users/{uid}` is read by other members.** Chat and group-details fetch other people's user documents to render names, avatars and online state. Demographic data therefore cannot live on `users/{uid}` without exposing it to every peer in a group chat. Intake gets its own collection.
2. **There are no Firestore security rules in this repo.** `firebase.json` registers indexes only, and no `.rules` file exists anywhere. FR-023 has no enforcement point today. Writing them is in scope for this feature and is its single largest piece of unplanned work.

## Technical Context

**Language/Version**: TypeScript 5.x; Angular 20 (NgModule-based, lazy-loaded routes); Node 22.12 for tooling (`.nvmrc`)

**Primary Dependencies**: Ionic 8.6, Capacitor 8, `@angular/fire` 20 (compat API), Firebase JS SDK 11.9

**Storage**: Cloud Firestore. New: `intakes/{uid}`, `careAssignments/{uid}` (+ `history` subcollection), `config/onboarding`. Modified: `interventions/{id}` gains onboarding fields.

**Testing**: Two runners. Karma + Jasmine (`ng test`) for app code — 44 existing `.spec.ts` files, service-level specs are the established pattern. Separately, a Node runner (`npm run test:rules`) for the Firestore rules suite under `tests/rules/`, because `tsconfig.spec.json` scopes Karma to `src/**/*.spec.ts` and `@firebase/rules-unit-testing` cannot run in a browser

**Target Platform**: Android via Capacitor (primary), responsive web (secondary). Low-end devices, intermittent connectivity.

**Project Type**: Mobile-first hybrid app with a Firebase backend, both in this repository

**Performance Goals**: Intake completable in under 5 minutes (SC-001); each step's write acknowledged locally without waiting on the network (SC-010)

**Constraints**: Offline-tolerant intake (FR-010); no free text collected (FR-006); crisis affordance reachable in one tap from every step (FR-018, SC-007); 80px header / 104px content offset layout rule

**Scale/Scope**: One new lazy-loaded route with ~4 steps, one guard, two services, one new Firestore collection pair, one config document, plus security rules for the whole database

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Spec-First, Plan-First | **PASS** | `spec.md` complete, three clarifications resolved, zero markers outstanding. This plan precedes any code. |
| II. Minimal-Impact Changes | **PASS with justification** | Reuses the existing `interventions` collection rather than a parallel catalogue, and the existing counsellor-request path for FR-018. Two additions need justification — new collections and security rules — see Complexity Tracking. |
| III. Root-Cause Discipline | **PASS** | The absent security rules are treated as the root cause of FR-023 having nowhere to live, rather than patched with client-side filtering that any caller could bypass. |
| IV. Verification Before Done | **PASS** | Every task carries a verification step; the Firestore emulator gives rules a real test target rather than an assertion that they "should" work. **This requires a second test runner** — Karma cannot run the rules suite (see Technical Context). An analysis pass caught that being assumed rather than provided. |
| V. Self-Improvement Loop | **PASS** | `tasks/lessons.md` to be updated with the `users/{uid}` read-surface finding, which is the kind of mistake that would otherwise recur. |

**Domain constraints**:

- **Stack is fixed** — PASS. No new frameworks. One dependency question (Firestore persistence) is resolved in `research.md` *against* adding it.
- **AI/secrets boundary** — PASS, and now trivially so. Self-selection means no AI is involved in routing at all. Nothing in this feature calls a model.
- **Layout rule** — Applies. Intake screens are standard pages at the 104px offset; they do not bleed.
- **Mental-health safety** — **Applies directly.** FR-018 is safety-critical. Removing free text removed the only distress signal intake could have had, so the always-visible crisis affordance is the sole safeguarding mechanism in this flow. It carries an explicit acceptance criterion (Story 1 scenario 7, SC-007) and must be verified before merge. It must not be dropped as an orphan when the field it once depended on is absent.

**Result**: PASS. Proceed to Phase 0.

### Post-design re-check (after Phase 1)

Re-evaluated against the artifacts produced. Still **PASS**, with two things
the design work changed:

- **Principle II got easier to honour, not harder.** Phase 1 removed work
  rather than adding it. No Cloud Function is needed (self-selection means no
  server-side computation), Firestore persistence was rejected in favour of a
  contained localStorage mirror, and `allowedUserIds` is left alone rather than
  repurposed. `functions/` is untouched by this feature.
- **Principle IV became concrete.** Security rules are emulator-testable, so
  "verify before done" is a real test run rather than an assertion. The
  decisive case is *a member cannot read another member's intake* — if that
  passes, the collection split (R1) did its job.

Four justified deviations remain, all recorded in Complexity Tracking. The
security-rules work is the one to watch: it is the largest unplanned item, it
is all-or-nothing by nature, and it must start from a baseline commit of the
live rules or it will silently replace protection on every existing collection.

## Project Structure

### Documentation (this feature)

```text
specs/002-onboarding-care-routing/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── firestore-documents.md
│   └── firestore-rules.md
├── checklists/
│   └── requirements.md
├── spec.md
└── tasks.md             # /speckit-tasks output — not created here
```

### Source Code (repository root)

```text
src/app/
├── pages/
│   └── onboarding/                     # NEW — lazy-loaded, one page, stepped
│       ├── onboarding.module.ts
│       ├── onboarding-routing.module.ts
│       ├── onboarding.page.ts|html|scss
│       └── steps/
│           ├── identity-step.component.*
│           ├── demographics-step.component.*
│           ├── selection-step.component.*     # the pills
│           └── confirm-step.component.*
├── guards/
│   ├── auth.guard.ts                   # unchanged
│   └── onboarding.guard.ts             # NEW — redirects until intake complete
├── services/
│   ├── intake.service.ts               # NEW — read/write intake, draft mirror
│   ├── care-assignment.service.ts         # NEW — compose/read assignment
│   └── interventions.service.ts        # MODIFIED — selectable-set query
├── models/
│   ├── intake.interface.ts             # NEW
│   ├── care-assignment.interface.ts    # NEW
│   └── intervention.interface.ts       # MODIFIED — onboarding fields
└── pages/interventions/
    └── interventions.page.ts           # MODIFIED — filter by package

firestore.rules                         # NEW — first rules in this repo
firebase.json                           # MODIFIED — register the rules file
```

**Structure Decision**: The existing Angular structure is kept exactly as-is — a lazy-loaded feature module under `src/app/pages/onboarding/`, services in `src/app/services/`, models in `src/app/models/`, matching every other feature in the app. No new top-level directories. The backend half of this feature is Firestore documents and security rules rather than Cloud Functions: with self-selection there is no server-side computation to perform, so `functions/` is untouched.

## Phase Sequencing

Backend-config-first, because the pills cannot be rendered until there is something to render.

| Phase | Delivers | Spec coverage |
|---|---|---|
| **A. Data & rules** | `firestore.rules`, collections, `config/onboarding`, onboarding fields on interventions | FR-005a, FR-019, FR-023, FR-024 |
| **B. Intake flow** | Route, guard, steps, draft persistence, crisis affordance | Stories 1 & 2 (both P1); FR-001–FR-011, FR-018 |
| **C. Package application** | Compose from selections, filter interventions list, preserve in-progress | FR-012–FR-017 |
| **D. Revision & migration** | Edit selections from profile; prompt existing members | Stories 3 & 4 (P2); FR-026, FR-027 |
| **E. Staff view & override** | Admin surface for FR-028–FR-030 | Story 5 (P3) |

Phases A–C are the MVP and satisfy both P1 stories. Phase E needs an admin surface that does not exist anywhere in the app today — see Complexity Tracking.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| New `intakes/{uid}` collection rather than fields on `users/{uid}` | `users/{uid}` documents are fetched by *other members* — `chat.component.ts` and `group-details.component.ts` read peers' user docs for names, avatars, roles and online state. Putting gender, region and language there would expose them to every peer in a group chat. | Keeping demographics on `users/{uid}` cannot satisfy FR-023 at any price: no security rule can hide selected fields from a client that is legitimately allowed to read the document. Field-level privacy in Firestore requires document-level separation. |
| New `careAssignments/{uid}` + `history` subcollection | FR-013 requires recording how a package arose, and FR-030 requires a staff override to survive later changes. Both need state that outlives the current selection. | Deriving the package from `intakes/{uid}.selections` alone is simpler and was the first choice, but it cannot express an override that disagrees with the member's own selection, and it loses history on every edit. |
| Writing `firestore.rules` for the entire database | The repo has none. FR-023 restricts demographic access, FR-024 requires withdrawable consent, and FR-021 stores minors' sensitive data. All three are unenforceable without rules, and client-side filtering is not a security control. | Scoping rules to only the new collections was considered and rejected: deploying a rules file replaces whatever is currently live, so a partial file would silently remove protection from every existing collection. This is all-or-nothing by nature. |
| Phase E deferred behind an admin surface that does not exist | No admin route exists in `app-routing.module.ts`. The `administrator` role is read in messages and profile but has no console. FR-028–FR-030 have nowhere to live. | Building an admin console inside this feature would dwarf the feature itself and is not what the spec asked for. Phase E is planned but gated on that decision — see `research.md` R6. |
