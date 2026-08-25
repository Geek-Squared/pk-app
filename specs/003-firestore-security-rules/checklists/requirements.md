# Specification Quality Checklist: Firestore Security Rules Remediation

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-25
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`

### Validation run — 2026-08-25

**All 16 items pass.** All three clarifications resolved — one from evidence,
two by decision.

| Marker | Status |
|---|---|
| FR-014 — one staff role or two | **RESOLVED: one shared staff capability.** A counsellor gets an administrator's reach — more than strictly needed, accepted as proportionate for a programme this size. FR-014a requires it be expressed as a single named condition so a later split does not mean rewriting every rule. |
| FR-021 — rehearsal target | **RESOLVED: emulator only, no staging project.** Checked first: none exists. Decided not to build one — the data is open today and delaying to provision an environment costs more than it buys. The trade is explicit, and the mitigations become mandatory rather than advisory: rehearsed rollback *before* production (FR-021b), low-traffic window with someone watching (FR-021a), explicit crisis-path verification (FR-024). |
| FR-025 — do Functions bypass rules | **RESOLVED from evidence.** The Functions initialise the Firebase Admin SDK, which runs with full privilege and ignores security rules. Two consequences now in the spec: tightening rules cannot break any background process, which removes a whole category of deployment risk; and rules for `knowledge_index` and `adminNotifications` constrain clients only, so both should deny all client access rather than being given permissive rules that merely look complete. |

Resolving FR-025 by checking rather than asking also **reduced** the feature's
risk profile: the initial assumption was that tightening rules might break
background delivery. It cannot.

Everything else the finding left open was resolved with a documented default in
**Assumptions**.

**Content quality note**: the spec names existing collections and authorisation
signals because they are the subject matter — the feature is *about* specific
collections. It does not specify rule syntax, file layout, or tooling; those are
planning decisions.

### A note on the three P1 stories

Unusually, three stories are P1. That is deliberate rather than uncalibrated:

- **Story 1** is the defect itself.
- **Story 2** (the app keeps working) is the harder half. Tightening rules is
  easy; doing it without breaking a live mental-health service is the work.
- **Story 5** (reversibility) is P1 because rules deploy atomically to the whole
  database with no canary and no partial rollback. A change with that blast
  radius is only safe if reversal is trivial and rehearsed.

Shipping Story 1 without Stories 2 and 5 would fix the exposure and risk taking
the service down for the people who depend on it.

### The accepted risk, stated plainly

This feature will deploy a total, atomic, un-canaried change to a live
mental-health service on emulator evidence alone. That is not an oversight —
it was weighed against leaving member data open for however long a staging
environment takes to build, and the exposure won.

It does mean the emulator suite is not a quality gate but *the* quality gate,
and that the rollback drill is load-bearing. FR-015 (every rule tested for both
what it permits and what it denies) and FR-021b (rollback rehearsed before
deployment) are the two requirements this decision rests on. Weakening either
during planning would quietly remove the basis on which the risk was accepted.

**Next step**: `/speckit-plan`.
