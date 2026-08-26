# Implementation Plan: Phone Number Sign-In with OTP

**Branch**: `004-phone-otp-auth` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-phone-otp-auth/spec.md`

## Summary

Add phone number + SMS passcode as a second way to register and sign in, alongside the existing email and password. Members with no email — a substantial share of the people this service is for — can then reach the programme.

Three findings from reading the codebase shape this plan more than the spec does:

1. **Nothing queries by email.** A sweep of both repositories for a query filtered on `email` returns nothing; every lookup is by uid. This is what makes the feature an addition rather than a migration, and it is the single most important fact in this plan.

2. **The eligibility gate has no pre-auth home.** The cohort check (FR-027) and the kill switch (FR-025) must both be decided before an account exists, and `config/{doc}` is `allow read: if isSignedIn()`. Loosening it would publish a list of programme members' phone numbers. Both therefore live behind an unauthenticated callable, which also satisfies FR-028 for free.

3. **The provisioning bug is already half-fixed.** `processSignUp` was made idempotent and role-preserving three commits ago for `createStaffUser`. The same transaction now serves phone accounts, so FR-002 and FR-005 are mostly a matter of deleting the `if (!user.email) return;` guard rather than restructuring the function.

## Technical Context

**Language/Version**: TypeScript 5.x; Angular 20 (NgModule-based, lazy-loaded routes); Node 20 for Functions

**Primary Dependencies**: Ionic 8.6, Capacitor 8, `@angular/fire` 20 (compat API), Firebase JS SDK 11.9, `firebase-admin` in Functions. **One dependency decision open** — see Phase 0.

**Storage**: Cloud Firestore. New: `phoneCohort/{e164}` (staff-managed eligibility, server-read only), `identityChanges/{id}` (FR-014 record). Modified: `users/{uid}` gains `phoneNumber`; `email` becomes optional.

**Testing**: Two runners, as established. Karma + Jasmine (`ng test`) for app code; `npm run test:rules` (Firestore emulator + vitest) for rules — currently 104 tests. Functions have no runner today; the eligibility callable is pure enough to warrant the first one.

**Target Platform**: Android via Capacitor (primary), responsive web (secondary). Low-end devices, intermittent connectivity, and — new here — a dependence on SMS delivery in Zimbabwe.

**Project Type**: Mobile-first hybrid app with a Firebase backend, plus a separate Angular admin portal (`pk-admin-v3`) that this feature also touches.

**Performance Goals**: Passcode entry reachable within one screen of registration; no added latency for the existing email path.

**Constraints**: SMS permitted to +263 only (FR-016); no SMS sent before a server-side eligibility check (FR-027); the cohort list never leaves the server (FR-028); 80px header / 104px content offset layout rule.

**Scale/Scope**: One new registration flow (2 screens), one guard change, one Functions change plus two new callables, one new collection pair, one admin screen, and rules for both new collections.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Spec-First, Plan-First | **PASS** | `spec.md` complete. Five open questions resolved as recorded decisions; zero markers outstanding. This plan precedes any code. |
| II. Minimal-Impact Changes | **PASS with justification** | Reuses `processSignUp`, the existing guard, and the existing staff model rather than building a parallel identity path. Three additions need justification — two collections and a possible native plugin — see Complexity Tracking. |
| III. Root-Cause Discipline | **PASS** | The root cause is one assumption ("every account has an email") in four places, not four separate defects. The plan removes the assumption rather than special-casing phone accounts around it. |
| IV. Verification Before Done | **PASS with a gap to close** | Rules and app code have runners. Functions do not, and the eligibility callable is the piece where a mistake costs money and leaks a member list. Phase 2 adds a Functions test runner; this is unplanned work and is tracked. |
| V. Self-Improvement Loop | **PASS** | `tasks/lessons.md` to record the OTP-does-not-defend-against-recycling correction, which is the kind of plausible-but-wrong control that would otherwise be reimplemented. |

**Domain constraints**:

- **Stack is fixed** — **PASS pending one decision.** Phone auth may need `@capacitor-firebase/authentication`. Resolved in Phase 0, and the bar is "the web flow demonstrably fails on a real Android build", not preference.
- **AI/secrets boundary** — PASS. No model involved. No new secret beyond what Firebase Auth manages itself.
- **Layout rule** — Applies. Registration and passcode screens are standard pages at the 104px offset.
- **Mental-health safety** — **Applies directly.** Two ways this flow can fail a person in distress: an SMS that never arrives, and an ineligible number met with a dead end. FR-016a and FR-029 require a route to human help at both, and the crisis affordance must be reachable from the passcode screen as it is from every other. A member who cannot get in must never be left with a spinner.

**Result**: PASS. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```
specs/004-phone-otp-auth/
├── spec.md              # complete
├── plan.md              # this file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── contracts/
│   └── callables.md     # eligibility + recovery call contracts
├── tasks.md             # Phase 2 output
└── checklists/
    └── requirements.md
```

### Source Code

```
pk-app-latest/
├── functions/src/
│   └── index.ts                       # processSignUp: drop the email gate
│                                      # NEW checkPhoneEligibility (unauthenticated)
│                                      # NEW recoverPhoneAccount (administrator only)
├── src/app/
│   ├── guards/auth.guard.ts           # verified-email OR verified-phone
│   ├── pages/registration/            # add the phone route
│   ├── pages/verify-phone/            # NEW passcode entry
│   └── services/authentication.service.ts
├── firestore.rules                    # phoneCohort, identityChanges
└── tests/rules/firestore-rules.spec.ts

pk-admin-v3/
└── src/app/features/feature-users/    # cohort management; show phone when no email
```

## Phase Sequencing

**Phase 0 — Research.** Settle the one dependency question: does the web SDK's reCAPTCHA flow work inside the Capacitor webview on a real Android build, or is the native plugin required? Establish the current Zimbabwe per-verification rate for FR-018a. Confirm SMS deliverability to at least two Zimbabwean carriers before anything is built on the assumption that it works.

**Phase 1 — Design.** Data model for `phoneCohort` and `identityChanges`; call contracts for the two callables; the exact guard predicate for all four states.

**Phase 2 — Foundations.** The Functions test runner (Constitution gap above), `processSignUp` de-gating, and rules for the new collections. Everything here is independently verifiable and ships without any UI.

**Phase 3 — User Story 6 (P1).** Cohort gate and kill switch. Deliberately first: it is the control that bounds every cost and abuse risk in the feature, and building it after the flow would mean a window where neither exists.

**Phase 4 — User Story 1 (P1).** The registration and passcode screens, and provisioning end to end.

**Phase 5 — User Story 5 (P1).** Recovery and number change, administrator-only, recorded.

**Phase 6 — User Stories 2, 3, 4 (P1/P2).** Regression pass on email sign-in, staff unchanged, then contact-method linking.

Stories 2 and 3 are P1 but are verification rather than construction — they are proven continuously from Phase 2 onward, and Phase 6 is where that proof is made explicit rather than where it starts.

## Complexity Tracking

| Addition | Why it is needed | Simpler alternative rejected because |
|---|---|---|
| `phoneCohort` collection | FR-026 needs a staff-editable list that changes without a release | A hardcoded list needs a deploy per change; Remote Config cannot be edited from the admin portal and is not auditable per FR-030 |
| `identityChanges` collection | FR-014 requires recovery to be recorded | Writing to an existing collection would mix an audit record with mutable member data, and audit records must not be editable by the people they describe |
| Two unauthenticated callables | FR-027 and FR-028 — the check must run before an SMS is sent, and the list must not reach a client | A client-side check is bypassable and, worse, requires shipping the member list to devices |
| Possible native auth plugin | Phone auth on Capacitor may not work through the webview | Not yet rejected — Phase 0 decides it on evidence, not preference |
| A Functions test runner | The eligibility callable gates spend and guards a sensitive list | Manual testing of a function that costs money per mistake is not verification |

## Risks carried into implementation

- **SMS deliverability in Zimbabwe is unproven.** Everything downstream assumes a passcode arrives. Phase 0 tests it first; if delivery is unreliable the feature's premise changes and WhatsApp or USSD (currently out of scope) come back onto the table.
- **The admin portal is a second codebase.** Cohort management lands in `pk-admin-v3`, which has its own build, its own deploy, and no test runner. Its tasks must not be treated as an afterthought to the app work.
- **Two P1 stories depend on staff process, not code.** FR-013's recovery procedure and FR-030's cohort management are only as good as the runbook behind them. A screen without a documented procedure is not done.
