# Specification Quality Checklist: Onboarding & Care Routing

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

### Validation run 2 — 2026-08-25 (all items pass)

All three clarifications resolved. 33 functional requirements (was 34; free text removed).

| Marker | Resolution |
|---|---|
| FR-012 — how the package is decided | **Member self-selection** from a programme-configured set of pills, applied immediately. No rules engine, no triage queue, no inference. |
| FR-020 — demographic fields | **Gender, location/region, preferred language.** Nothing further; more requires a new consent basis and a spec change. |
| FR-021 — minors | **Under-18s admitted, no guardian consent**, adolescent-appropriate interventions shown first. |

### Revision — free text removed

The free-text "what you are going through" step has been **dropped entirely**
(FR-006 now forbids it). Once package composition became pure self-selection,
the step collected sensitive disclosure that changed nothing, while implying to
the member that it did. Removing it is the correct consequence of the Q1
answer, not a reduction in scope.

What that displaced:

- **FR-018 changed shape.** It was "scan the description for crisis
  indicators". With nothing to scan, it is now "a route to human support is
  visible from every intake step, permanently, not triggered". This is a
  weaker signal than reading what someone wrote — a deliberate trade recorded
  under Risks: no disclosure is collected, so none can be missed, mishandled
  or stored. **Do not let this requirement quietly disappear with the text
  field it used to depend on** — it is the only safeguarding in the flow.
- SC-007 changed from "100% of crisis descriptions are acted on" to "support
  is reachable from 100% of steps in at most one tap".
- SC-005a (members wrongly expecting the text to affect routing) is gone —
  the misleading step no longer exists.
- The Intake Response entity now holds no free-text disclosure, which
  meaningfully lowers the data-protection weight of FR-021's minors decision.

### Consequences of the self-selection answer

Self-selection is simpler than any of the three options originally offered, and
it removed work rather than adding it. It also changed the meaning of parts of
the spec that had assumed inference, all of which were revised:

- **The free-text no longer routed anything**, which is why it was
  subsequently removed altogether. See the revision note above.
- Story 3 changed from "be re-triaged" to "change what you are working on".
- FR-013 changed from recording *why* a member was placed somewhere to
  recording *how* the package arose (selection, default, or override).
- Edge cases about no-rule-matches and ambiguous matches were dropped;
  select-none and select-everything became central.
- A rules engine is now explicitly **out of scope**, so adding inference later
  is a new feature rather than an extension.

### Deliberate risk carried forward

FR-021 admits minors' sensitive data without guardian consent. This was chosen
knowingly — a consent gate would block the adolescents pathway the programme
exists to serve — but it is recorded under **Risks & Open Decisions** and
**needs legal sign-off against POPIA (and GDPR Art. 8 if any member may be in
the EU/UK) before launch**. It does not block planning.

**Status**: ready for `/speckit-plan`.
