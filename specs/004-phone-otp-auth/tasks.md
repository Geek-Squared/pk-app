# Tasks: Phone Number Sign-In with OTP

**Feature**: `004-phone-otp-auth` | **Date**: 2026-08-26 | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

Phases ship in order. Each phase is independently verifiable and leaves the app working; nothing here requires a big-bang cutover, because email sign-in is untouched throughout.

`[P]` marks tasks that can run in parallel with their siblings.

---

## Phase 0 — Research

- [x] **T001** Decide the client mechanism. → native plugin (research.md R1)
- [x] **T002** Establish the test strategy that avoids SMS spend. → fictional numbers (R4)
- [ ] **T003** Obtain the **Zimbabwe (+263) per-SMS rate** from the Identity Platform rate card, cross-check against the console's estimate for `positive-konnections-42d8a`, and record figure + source + date read. *(Needs console access — cannot be done from the repository.)*
- [ ] **T004** Compute the FR-018a monthly ceiling from T003 and the agreed cohort size. Record the assumed verifications-per-member.
- [ ] **T005** **Deliverability test** (R3): two Zimbabwean carriers, prepaid and contract, one low-end handset. Record time-to-delivery, not only success. **Gate: if delivery is unreliable, stop and re-open the spec** — WhatsApp/USSD return to scope.

> T005 gates Phase 3 onward. T003/T004 gate launch, not build.

---

## Phase 1 — Design

- [x] **T006** `data-model.md`: `phoneCohort/{e164}` and `identityChanges/{id}` — fields, ownership, who writes, retention. Include the E.164 canonicalisation rule (FR-004) as the document id, so the same number entered as `07…` or `+263…` cannot become two entries.
- [x] **T007** `contracts/callables.md`: request/response and error codes for `checkPhoneEligibility` (unauthenticated) and `recoverPhoneAccount` (administrator only). Error codes matter — FR-029 needs "not eligible" to be distinguishable from "something failed".
- [x] **T008** Write the exact guard predicate for all four states (verified email / verified phone / unverified / signed out), as a table, before touching code.

---

## Phase 2 — Foundations

*No user-visible change. Everything here is testable on its own.*

- [x] **T009** Add a **test runner for Cloud Functions**. This is the verification gap the Constitution Check flagged. The eligibility callable decides whether money is spent and whether a member list stays private; it is not acceptable for it to be the only untested code in the feature.
- [x] **T010** `processSignUp`: remove `if (!user.email) return;`. Provision from the uid. Store `phoneNumber` when present, and **do not write an empty or placeholder email** (FR-003). The existing transaction already preserves an assigned role — leave it exactly as it is.
- [x] **T011 [P]** Rules for `phoneCohort`: **no client access at all**, read or write (FR-028). Only Functions touch it.
- [x] **T012 [P]** Rules for `identityChanges`: staff read, no client write. An audit record must not be editable by the people it describes.
- [x] **T013** Rules tests for T011 and T012 — allow *and* deny, per the established FR-015 discipline. Also assert a phone-only account gets exactly a client's access and no more (FR-023).
- [ ] **T014** Reserve fictional test numbers **in the console** *(not done — needs console access)*. The table to record them in, and the warning that they are live in production because there is only one project, are in `quickstart.md`.

**Verify**: `npm run test:rules` green; a phone-only account created by hand in the console receives its `users` document, workbook and chat.

---

## Phase 3 — User Story 6: the cohort gate and the kill switch (P1)

*First, deliberately. This is the control that bounds every cost and abuse risk in the feature. Built after the flow, there would be a window in which neither exists.*

- [ ] **T015** `checkPhoneEligibility` callable: unauthenticated, takes an E.164 number, returns eligible / not eligible / registration closed. Reads `phoneCohort` server-side. **Never returns the list, and never returns anything that would let a caller enumerate it.**
- [ ] **T016** Per-number and per-device rate limiting inside the callable (FR-015). A number *on* the list can still be used to generate repeat sends.
- [ ] **T017** Kill switch honoured by the same callable (FR-025), so turning phone registration off needs no release.
- [ ] **T018 [P]** Restrict SMS regions to **Zimbabwe only** in the Firebase console (FR-016) and enable the platform's abuse protection (FR-017). Console task, before any public exposure.
- [ ] **T019 [P]** Billing alert at 50% and 100% of the T004 ceiling (FR-018a).
- [ ] **T020** Admin portal: cohort management screen in `pk-admin-v3` — add, remove, list (FR-030). Writes go through a callable, not direct Firestore, so the list stays server-side.
- [ ] **T021** Every cohort change writes an `identityChanges` record (FR-014, FR-030).
- [ ] **T022** Tests for T015–T017 on the new Functions runner: eligible, not eligible, closed, rate-limited.

**Verify**: an ineligible number produces **no SMS and no cost**; the kill switch works without a deploy; the cohort list cannot be read from any client.

---

## Phase 4 — User Story 1: register and sign in by phone (P1)

- [ ] **T023** Add `@capacitor-firebase/authentication`; register debug **and release** SHA-256 certs for Play Integrity (R1). The missing release cert fails only in production.
- [ ] **T024** Phone entry screen on the registration route: E.164 canonicalisation (FR-004), calls `checkPhoneEligibility` **before** requesting a passcode.
- [ ] **T025** `verify-phone` passcode screen. Retry without restarting registration (US1 scenario 3). Crisis affordance reachable, per the layout and safety rules.
- [ ] **T026** **Dual-layer sign-in**: native credential → `signInWithCredential` on the JS SDK, so `afAuth.authState` emits. Without this the guard bounces a successfully-verified member to `/login` forever, and it looks like the passcode failed. Its own task because its own failure mode.
- [ ] **T027** Guard: verified email **or** verified phone (FR-006), per the T008 table. Remove the `emailVerified` gate that sends phone accounts to `/verify-email` in a loop.
- [ ] **T028 [P]** Failure copy: undelivered SMS, ineligible number, wrong code, roaming or non-`+263` number (FR-016a, FR-029). Each offers a route to human help. **No dead ends and no bare spinners** — this is the safety-critical part of this phase.
- [ ] **T029 [P]** Admin portal: show phone number where a member has no email (FR-008a), so a phone member is not a blank row.
- [ ] **T030** Guard tests for all four states (FR-021).

**Verify**: on a real device with no email account, register by phone and reach home with a workbook, a chat and correct intervention visibility (SC-001, SC-002).

---

## Phase 5 — User Story 5: recovery and number change (P1)

- [ ] **T031** `recoverPhoneAccount` callable: **administrator only** (FR-013a). Reuses the existing `assertAdmin`, which is the administrator-versus-counsellor split feature 003's FR-014a anticipated.
- [ ] **T032** Changing a number revokes sign-in from the old one (US5 scenario 3).
- [ ] **T033** Every execution writes an `identityChanges` record: who acted, on whom, when (FR-014).
- [ ] **T034** **Dormancy check** (FR-013b): twelve months idle → one question from onboarding data before counselling history is exposed. **Not a second passcode** — a recycled number passes that, which is the whole point of the control. See the correction in spec.md.
- [ ] **T035** Runbook for staff: how a counsellor raises a recovery, how an administrator executes it, what identity confirmation is required. **A screen without a documented procedure is not done.**

**Verify**: a recovery completes in one support interaction and appears in the record (SC-008).

---

## Phase 6 — Stories 2, 3, 4: regression, staff, and linking

- [ ] **T036** Full regression on email sign-in — existing members, staff, password reset (US2, US3, SC-004). Proven continuously from Phase 2; this is where it is made explicit.
- [ ] **T037** Confirm no existing account was altered by any of the above (SC-003).
- [ ] **T038** Contact-method linking (US4): add an email to a phone account and vice versa, one account and one history throughout.
- [ ] **T039** Clear failure when a contact method is already in use — no merge, no data loss (FR-012).
- [ ] **T040** `tasks/lessons.md`: record the OTP-does-not-defend-against-recycling correction, and the native-sign-in-does-not-reach-`authState` trap. Both are plausible-but-wrong paths someone would otherwise take again.

---

## Ordering and dependencies

```
T005 (deliverability) ──gates──> Phase 3 onward
T009 (Functions runner) ────────> T015, T022, T031
T010 (provisioning) ────────────> T024 onward
T015 (eligibility) ─────────────> T024
T023 (plugin + SHA) ────────────> T026
T026 (dual sign-in) ────────────> T027
T031 (recovery callable) ───────> T033, T034
```

Phases 3, 4 and 5 each deliver a complete, independently valuable slice. Phase 3 alone is worth shipping: it is the spend ceiling and the off switch, and it is useful before a single member registers by phone.

## Definition of done, per phase

Not "the code is written". A phase is done when its verification line passes, its tests are green in the appropriate runner, and any staff procedure it depends on is written down. Phase 5 in particular is not done at T033.
