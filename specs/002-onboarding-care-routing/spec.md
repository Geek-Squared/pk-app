# Feature Specification: Onboarding & Care Routing

**Feature Branch**: `002-onboarding-care-routing`

**Created**: 2026-08-25

**Status**: Clarified — ready for `/speckit-plan`

**Input**: User description: "We need to redo onboarding. We need to capture Name, Age, Phone number, email and demographic info. Then the user selects the interventions we create — like you know how apps have a screen where you select a category — and they enter information telling us what they are going through. Then after, we direct them to the appropriate package of care."

---

## Context

Today a new person creates an account with only an email address, a password, a display name and a Terms/Privacy consent record. Nothing else is asked. After verifying their email they land on an undifferentiated list of every published intervention and are left to work out for themselves which of it applies to them.

This feature replaces that gap with a guided intake that profiles the person and then narrows what they see to a **package of care** relevant to their situation.

The programme serves people affected by HIV, including adolescents. Everything collected here is sensitive personal information, and some of it will belong to minors. The spec therefore treats data minimisation and consent as first-class requirements rather than an afterthought.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Complete intake and receive a package of care (Priority: P1)

A person who has just verified their email is taken through a short, guided intake instead of being dropped on the home screen. They give their name, age and contact details, answer a small set of demographic questions, and pick the interventions they want support with from a set of pills the programme publishes. When they finish, the app shows them their package of care — the interventions they chose — and they arrive on Home with those, rather than the full catalogue, in front of them.

**Why this priority**: This is the feature. Without it there is no intake and no routing, and every other story here is an adjunct to it. It is also independently valuable: even routing to a single default package beats the current undifferentiated list.

**Independent Test**: Register a new account, verify the email, and confirm the intake appears before Home, that every answer persists, and that the interventions selected are exactly the ones presented afterwards.

**Acceptance Scenarios**:

1. **Given** a newly verified account with no intake on record, **When** the person opens the app, **Then** they are taken to the intake rather than to Home.
2. **Given** a person on the identity step, **When** they submit a name, age, phone number and email, **Then** the answers are validated, saved, and they advance to the next step.
3. **Given** a person on the selection step, **When** they tap one or more intervention pills, **Then** each pill shows as selected, the selection is recorded, and they advance.
4. **Given** a person who has answered every step, **When** they submit the intake, **Then** their package is composed from what they selected, shown back to them for confirmation, and they arrive on Home.
5. **Given** a person who selected nothing, **When** they submit the intake, **Then** the programme's default package is applied rather than an empty one.
6. **Given** a person who has completed intake, **When** they open the interventions list, **Then** they see the interventions in their package rather than the full undifferentiated catalogue.
7. **Given** a person at any step of the intake, **When** they are in distress, **Then** a route to human support is visible to them without having to finish or abandon the form.

---

### User Story 2 - Leave and resume without losing answers (Priority: P1)

A person starts the intake, closes the app partway through — interrupted, out of data, or simply not ready to answer a hard question — and returns later. Their previous answers are still there and they continue from where they stopped rather than starting again.

**Why this priority**: P1 alongside Story 1 because of who this is for. Intake asks emotionally heavy questions of people in distress, on mobile devices with unreliable connectivity. An intake that must be finished in one sitting will be abandoned, and an abandoned intake means no package of care — which fails Story 1 in practice even when Story 1 works in the lab.

**Independent Test**: Begin the intake, complete some steps, force-close the app, reopen it, and confirm the answered steps are retained and the person resumes at the first unanswered step.

**Acceptance Scenarios**:

1. **Given** a person who has completed some intake steps, **When** they close and reopen the app, **Then** their saved answers are intact and they resume at the first unanswered step.
2. **Given** a person mid-intake with no network, **When** they answer a step, **Then** the answer is retained locally and submitted when connectivity returns.
3. **Given** a person mid-intake, **When** they go back to an earlier step, **Then** they can review and change an answer before submitting.

---

### User Story 3 - Change what you are working on (Priority: P2)

Circumstances change. A person can revisit their selections at any time, add interventions they now want and remove ones they no longer do, and update the details they gave — without losing the progress they have already made.

**Why this priority**: P2 because the intake delivers value on first completion. But because the package is self-selected, a member who picked badly under distress — or whose situation has moved on — has no other correction path. Without this they are stuck with a one-off choice made on their worst day.

**Independent Test**: Complete intake, add and remove selections, and confirm the package updates immediately while existing workbook progress survives.

**Acceptance Scenarios**:

1. **Given** a person with a completed intake, **When** they open their profile, **Then** they can view and edit the answers they gave.
2. **Given** a person who changes their selections, **When** they save, **Then** their package updates immediately to match.
3. **Given** a person whose package changes, **When** the new package is applied, **Then** progress already recorded against interventions is preserved and still visible.
4. **Given** a person removed from an intervention they had begun, **When** the package changes, **Then** they are told what changed rather than finding it silently gone.

---

### User Story 4 - Existing members are brought into the new model (Priority: P2)

People who registered before this feature existed already have accounts, progress and workbook history. They are asked to complete the intake, but on their own terms, and nothing they have already done is lost or hidden while they decide.

**Why this priority**: P2 because it does not block launch for new members, but without it the existing cohort has no package of care and the programme is split between two models indefinitely.

**Independent Test**: Take an account created before this feature, confirm it is prompted to complete intake, that the prompt can be deferred, and that all prior progress remains reachable either way.

**Acceptance Scenarios**:

1. **Given** an existing member with no intake on record, **When** they open the app, **Then** they are invited to complete it and told why it is being asked.
2. **Given** an existing member who defers, **When** they continue using the app, **Then** they retain access to what they had before and are re-invited later.
3. **Given** an existing member who completes intake, **When** a package is assigned, **Then** interventions they have already made progress in remain accessible.

---

### User Story 5 - Programme staff can see and correct routing (Priority: P3)

Someone running the programme can see what a member was asked, what they answered, which package they were placed in and why — and can override that placement when the routing has got it wrong.

**Why this priority**: P3 because routing works without it, but automated placement with no human correction path is not defensible in a care setting. Whoever is accountable for the member's care needs a way to intervene.

**Independent Test**: As a staff user, open a member's record, view their intake answers and assigned package, apply an override, and confirm the member's available interventions change accordingly.

**Acceptance Scenarios**:

1. **Given** a staff user viewing a member, **When** they open the member's intake, **Then** they see the answers, the assigned package and the reason for the assignment.
2. **Given** a staff user who disagrees with a placement, **When** they assign a different package, **Then** the override takes effect, is attributed to them, and is recorded with a timestamp.
3. **Given** a member whose placement was overridden, **When** the routing rules would otherwise reassign them, **Then** the override is not silently discarded.

---

### Edge Cases

- A person gives an age under 18. They are admitted (FR-021) and shown the adolescent-appropriate set first, but nothing stops them selecting anything else — is that intended?
- A person's stated age and their selections disagree (a 15-year-old choosing "parents"). Under self-selection the member's choice governs; confirm the programme accepts that.
- A person understates their age to reach content aimed at adults, or overstates it to avoid the adolescent framing. Self-declared age is unverifiable.
- A person is in crisis during intake. With no free-text step there is nothing to detect it, so the route to support has to be permanently visible rather than triggered. See FR-018.
- A person selects every pill — is a package containing everything meaningfully different from the old undifferentiated list?
- A person selects nothing and takes the default package (FR-016).
- A person deselects an intervention they have already partly completed.
- The programme unpublishes or renames an intervention that members have already selected, so existing packages reference something that no longer exists.
- A person abandons intake permanently — they verify their email but never finish. They exist as an account with partial sensitive data and no package.
- A person withdraws consent for the demographic data they gave. The programme must be able to honour that without destroying their care history.
- Two devices submit different answers for the same account concurrently.

---

## Requirements *(mandatory)*

### Functional Requirements

#### Intake flow

- **FR-001**: The system MUST present a guided intake to any authenticated member who has no completed intake on record, before they reach the main app.
- **FR-002**: The system MUST collect the person's full name, age, phone number and email address.
- **FR-003**: The system MUST pre-fill the email address from the verified account and MUST NOT require it to be retyped.
- **FR-004**: The system MUST collect demographic information as defined in FR-020.
- **FR-005**: The system MUST present the interventions the programme has marked as selectable at onboarding as a multi-select set of pills, and MUST let the person choose any number of them.
- **FR-005a**: The system MUST read that selectable set from programme-managed configuration, so which interventions appear — and their order and labels — can change without an app release.
- **FR-005b**: The system MUST allow that configuration to vary the default selectable set by stated age, so that members under 18 are shown adolescent-appropriate interventions first (FR-021).
- **FR-006**: The system MUST NOT ask the member to describe their situation in free text during intake. Intake collects only the identity, demographic and selection answers above. *(Removed deliberately: with package composition decided by the member's own selections, a free-text step would collect sensitive disclosure that changes nothing, while implying to the member that it does.)*
- **FR-007**: The system MUST validate each answer at the point of entry and explain in plain language what is wrong when it rejects one.
- **FR-008**: The system MUST persist each step's answers as they are given, so that an interrupted intake can be resumed without re-answering completed steps.
- **FR-009**: The system MUST allow the person to return to an earlier step and change an answer before final submission.
- **FR-010**: The system MUST tolerate loss of connectivity mid-intake without discarding answers already given.

#### Routing to a package of care

- **FR-011**: The system MUST assign each member a package of care on completion of intake.
- **FR-012**: The system MUST compose the package of care from the interventions the member selected during intake. Placement is by member self-selection from the programme-configured set — there is no rules engine, no staff triage queue and no automated inference between the member's answers and their package.
- **FR-012a**: The system MUST apply the selection immediately on completion, with no review step and no waiting state visible to the member.
- **FR-013**: The system MUST record, alongside the assignment, how it arose — the member's own selection, the default applied to an empty selection, or a staff override — with the time it took effect and, for an override, who made it.
- **FR-014**: The system MUST show the member which interventions their package contains once assigned.
- **FR-015**: The system MUST restrict the interventions presented to the member to those in their package, while keeping any intervention they have already begun reachable.
- **FR-016**: The system MUST assign a programme-defined default package to a member who selects nothing, and MUST NOT leave a member with an empty package after a completed intake.
- **FR-017**: The system MUST update a member's package immediately when they change their selections, without discarding progress already recorded.

#### Safeguarding and consent

- **FR-018**: The system MUST make a route to human support visible and reachable from every step of the intake, using the same crisis route the app already offers elsewhere. With no free text there is nothing to scan for distress, so the affordance MUST be permanently present rather than triggered — a member in crisis must never have to complete or abandon a form to reach help.
- **FR-019**: The system MUST obtain explicit consent for the collection of demographic and health-related information, recorded with the version consented to and the time, consistent with how Terms/Privacy consent is already recorded at sign-up.
- **FR-020**: The system MUST collect exactly three demographic fields — gender, location/region, and preferred language — and MUST NOT collect further demographic or health information at intake. This is the minimal set the programme can justify under POPIA/GDPR; anything beyond it requires a new consent basis and a spec change.
- **FR-021**: The system MUST admit members under 18 without requiring guardian consent, and MUST make the adolescent-appropriate interventions the default selectable set for them. There is no minimum-age barrier and no age-based refusal. See **Risks & Open Decisions** — this choice is deliberate and carries data-protection exposure that needs legal sign-off before launch, not before planning.
- **FR-022**: The system MUST make each member's own intake answers visible to them.
- **FR-023**: The system MUST restrict access to a member's demographic data and selections to that member and to authorised programme staff.
- **FR-024**: The system MUST allow a member to withdraw consent for demographic processing without destroying their care history.
- **FR-025**: The system MUST NOT require the person to disclose HIV status in order to complete intake.

#### Existing members and staff

- **FR-026**: The system MUST invite members who registered before this feature to complete intake, and MUST explain why it is being asked.
- **FR-027**: The system MUST allow such members to defer, retaining their existing access, and MUST re-invite them subsequently.
- **FR-028**: The system MUST allow authorised staff to view a member's intake answers, assigned package and assignment reason.
- **FR-029**: The system MUST allow authorised staff to override a package assignment, recording who made the change and when.
- **FR-030**: The system MUST NOT silently discard a staff override when automated routing would reassign the member.

### Key Entities

- **Intake Response**: What one member told the programme. Their identity and contact details, demographic answers, selected interventions, the consent captured, completion state, and when each part was answered. Belongs to exactly one member. Contains no free-text disclosure.
- **Selectable Intervention**: An intervention the programme has published as choosable at onboarding, with the label and order shown on its pill. Programme-managed configuration, not fixed in the app; may differ by stated age.
- **Package of Care**: The set of interventions a member is working with — composed from their own selections, or the programme default when they selected none. Member-specific.
- **Care Assignment**: The link between a member and their package — its contents, how it arose (self-selection, default, or staff override), when it took effect, and who overrode it if anyone. Historical: superseded assignments are retained so a member's history can be reviewed.
- **Consent Record**: Evidence that a member agreed to a specific version of a specific processing purpose at a specific time. Extends the consent already captured at sign-up rather than replacing it.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A member can complete the entire intake in under 5 minutes.
- **SC-002**: At least 85% of members who begin intake complete it.
- **SC-003**: At least 90% of members who are interrupted mid-intake return and finish, with no answers lost.
- **SC-004**: 100% of members who complete intake are assigned a package of care, with no member left unrouted.
- **SC-005**: A member can explain, unprompted, why they see the interventions they see, and correctly attributes it to their own choice — verified in usability testing with at least 8 members.
- **SC-006**: The proportion of members who begin an intervention within 7 days of joining improves by at least 30% against the pre-intake baseline.
- **SC-007**: A route to human support is reachable from 100% of intake steps, in at most one tap.
- **SC-008**: Staff can locate a member's answers, package and assignment reason in under 60 seconds.
- **SC-009**: No member's care progress is lost when their package changes — zero incidents across a full re-routing cycle.
- **SC-010**: Intake completes successfully on the slowest device and connection the programme supports, without data loss.

---

## Assumptions

- The intake follows email verification and precedes the existing first-run walkthrough; a member meets it once, on first entry to the app proper.
- The selectable pills are read from programme-managed configuration, so adding or retiring one does not require an app release.
- A member's package is composed by the member from what the programme publishes. The programme controls the menu; the member chooses from it.
- The existing per-user intervention gating is the natural seam for expressing a package; whether it is reused or replaced is a planning decision, not a specification one.
- Intake collects no free text. A member who wants to say more in their own words does so with Peekay or a counsellor, where there is someone to respond — not into a form field.
- Phone number is collected for programme contact, not as an authentication factor, and no SMS verification is implied.
- "Age" means the member's self-declared age at intake. It is unverified, and FR-021 places no barrier behind it. Whether a date of birth is stored instead, so age stays correct over time, is a planning decision.
- Members have intermittent mobile connectivity and may be on low-end Android devices.
- Existing accounts remain usable throughout the rollout; there is no forced migration cut-off.
- Staff access relies on the role concept already present on member records; defining a full staff console is out of scope.

## Risks & Open Decisions

- **Minors' data is collected without guardian consent (FR-021).** This was
  chosen deliberately over refusing under-18s or requiring verifiable guardian
  consent, because the programme's adolescents pathway exists to reach exactly
  this group and a consent gate would block it. The exposure is real: the app
  will hold sensitive personal information about children affected by HIV, with
  a self-declared and unverifiable age as the only signal. **This needs legal
  sign-off against POPIA and, if any member may be in the EU/UK, GDPR Article 8
  before launch** — not before planning, which can proceed. Mitigations already
  in the spec: the demographic set is minimal (FR-020), HIV status is never
  required (FR-025), consent is explicit and versioned (FR-019), and consent is
  withdrawable (FR-024).

- **Self-declared age is unverifiable.** FR-005b varies the default pills by
  stated age, so a member who misstates their age sees a different starting set.
  Nothing prevents this and nothing detects it.

- **Intake can no longer notice distress.** Removing free text removed the one
  place a member might have disclosed crisis during onboarding, and there is
  now nothing to detect it. FR-018 compensates with a permanently visible route
  to support rather than a triggered one. This is a weaker signal than reading
  what someone wrote, and it is a deliberate trade: no disclosure is collected,
  so none can be missed, mishandled or stored.

- **Self-selection assumes insight.** A member in acute distress may not be
  well placed to choose their own care. Story 5's staff override is the only
  correction path, and it is P3 — worth confirming the programme is comfortable
  with that ordering.

## Out of Scope

- Clinical assessment, diagnosis, or scoring instruments of any kind.
- Any rules engine, triage queue or automated inference between a member's answers and their package. Placement is self-selection (FR-012); introducing inference later is a new feature, not an extension of this one.
- Age verification of any kind.
- Collecting any free-text account of the member's situation during intake (FR-006).
- Building a staff-facing administration console beyond viewing and overriding an assignment.
- Changing how interventions, chapters or workbooks themselves work.
- Automated referral to external services or booking on the member's behalf.
- Re-running or revisiting a member's package on a schedule; it changes only when the member changes their selections or staff override them.

## Dependencies

- The account, email-verification and consent mechanisms already in place at sign-up.
- The published intervention and chapter catalogue, and the grouping that gives members their categories.
- The existing crisis-support route the app offers, which FR-018 reuses rather than reinvents.
- A decision from the programme on the three open clarifications above before planning can begin.
