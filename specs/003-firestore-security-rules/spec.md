# Feature Specification: Firestore Security Rules Remediation

**Feature Branch**: `003-firestore-security-rules`

**Created**: 2026-08-25

**Status**: Clarified — ready for `/speckit-plan`

**Input**: Discovered executing task T005 of feature 002. The live Firestore ruleset grants read, update, write and delete on every document to any signed-in account. See `specs/002-onboarding-care-routing/SECURITY-FINDING.md`.

---

## Context

Every member's data in Positive Konnections is currently readable and writable by every other signed-in member.

The live ruleset, unchanged since **2021-07-11**, is:

```
match /databases/{database}/documents {
  match /{document=**} {
    allow read, update, write, delete: if isSignedIn();
  }
}
```

Three narrower blocks sit beneath it, intended to stop clients writing curriculum content. They match `/databases/chapters/documents`, where that path segment is the *database* name rather than a collection, so they have never matched a request. The protection they describe has never existed.

This is not a theoretical exposure. Anyone who registers an account can read every private counsellor conversation, every workbook reflection, and every member's contact details — for a service supporting people affected by HIV, including adolescents.

It also blocks feature 002. That feature's FR-023 restricts a member's demographic data to that member and authorised staff, which cannot be achieved by adding rules: Firestore evaluates all matching rules and grants access if **any** allows, so a specific rule can never narrow a broader one. 002 is paused at task T007 until this lands.

The verbatim export is committed at `firestore.rules` and is deliberately **not** registered for deployment, so nothing can ship from it by accident.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A member's private data is private (Priority: P1)

A member's chats, workbook reflections, intake answers and contact details are readable only by that member and by authorised programme staff. Another member — however curious, and whatever tooling they use — cannot reach them.

**Why this priority**: This is the defect. Everything else here is a consequence of fixing it. It is also independently valuable: closing cross-member access on the personal collections is worth shipping even if the curriculum collections are still permissive.

**Independent Test**: Signed in as member A, attempt to read and write member B's user document, chat, workbook and intake. Every attempt is denied. Member B's own access to all four is unaffected.

**Acceptance Scenarios**:

1. **Given** two members A and B, **When** A attempts to read B's workbook, **Then** the read is denied.
2. **Given** two members A and B, **When** A attempts to read a chat B is in and A is not, **Then** the read is denied.
3. **Given** two members A and B, **When** A attempts to write to B's user document, **Then** the write is denied.
4. **Given** an unauthenticated client, **When** it attempts to read any collection, **Then** the read is denied.
5. **Given** a member, **When** they read and write their own data, **Then** everything they could do before still works.

---

### User Story 2 - The app keeps working (Priority: P1)

Every screen that worked before the rules change still works after it. No member is shown an error, and in particular nobody is blocked from reaching support.

**Why this priority**: P1 alongside Story 1, and in practice the harder half. Tightening rules is easy; tightening them without breaking a live mental-health service is the actual work. A permission error on the counsellor-request path would be worse than the exposure it fixes.

**Independent Test**: Walk every screen of the app as a normal member against the tightened rules, and confirm no operation is denied that previously succeeded.

**Acceptance Scenarios**:

1. **Given** the tightened rules, **When** a member opens each screen in turn, **Then** no operation fails with a permission error.
2. **Given** a member in distress, **When** they use the crisis or counsellor-request path, **Then** it succeeds — this path must be verified explicitly and never assumed.
3. **Given** a member reading a group chat, **When** the app fetches other participants' display names and avatars, **Then** those reads succeed, because the app depends on limited cross-member reads of `users`.
4. **Given** background delivery of notifications and messages, **When** rules are tightened, **Then** delivery is unaffected.

---

### User Story 3 - Curriculum is readable but not writable by members (Priority: P2)

Interventions, chapters, posts, questions and categories are readable by signed-in members and writable only by programme staff — the protection the dead rule blocks were always meant to provide.

**Why this priority**: P2 because the exposure here is integrity rather than privacy. A member rewriting curriculum content would be serious, but no personal data leaks through these collections, so Story 1 comes first.

**Independent Test**: As a member, read every curriculum collection successfully, then attempt to write each and be denied. As staff, write successfully.

**Acceptance Scenarios**:

1. **Given** a signed-in member, **When** they read curriculum content, **Then** it succeeds.
2. **Given** a signed-in member, **When** they attempt to modify curriculum content, **Then** it is denied.
3. **Given** a staff account, **When** they modify curriculum content, **Then** it succeeds.
4. **Given** an intervention marked restricted, **When** a member not on its allowlist reads it, **Then** the existing allowlist behaviour is preserved.

---

### User Story 4 - Staff can do their work, and only their work (Priority: P2)

Counsellors and administrators can reach the member data their role requires, and nothing beyond it. Staff access is granted by role, not by being signed in.

**Why this priority**: P2 because the programme functions without a formal staff boundary today, but the fix is incomplete without one — "everyone can read everything" cannot become "nobody can read anything but themselves" without stranding the people delivering care.

**Independent Test**: As a staff account, access the member data the role requires and confirm it succeeds; attempt something outside the role and confirm denial.

**Acceptance Scenarios**:

1. **Given** a staff account, **When** they read a member's data their role requires, **Then** it succeeds.
2. **Given** a member account with no staff role, **When** they attempt the same read, **Then** it is denied.
3. **Given** a user document with no role field at all, **When** authorisation is evaluated, **Then** they are treated as **not** staff.

---

### User Story 5 - The change can be reversed quickly (Priority: P1)

If the tightened rules deny something the live app needs, the previous ruleset can be restored in minutes by someone who did not write the change.

**Why this priority**: P1 because deployment replaces the entire live ruleset atomically — there is no partial rollout, no canary, no percentage rollback. The blast radius is the whole database and every member at once. A change with that shape is only safe if reversing it is trivial and rehearsed.

**Independent Test**: Perform a rollback drill against a non-production target: deploy tightened rules, restore the baseline, and confirm the original behaviour returns.

**Acceptance Scenarios**:

1. **Given** a deployed rules change, **When** a problem is found, **Then** the previous ruleset is restorable from version control without reconstructing it by hand.
2. **Given** a rollback, **When** it completes, **Then** the app behaves exactly as it did before the change.
3. **Given** the deployment, **When** it happens, **Then** someone is watching for permission-denied errors rather than discovering them from member reports.

---

### Edge Cases

- A collection nobody inventoried is in use by a screen not exercised in testing, and its rule denies a real operation.
- `notifications` and `responses` appear in code but returned nothing live. They may be unused, or subcollections, or simply empty — assuming the wrong one either strands a feature or leaves a hole.
- Cloud Functions using elevated backend access bypass rules entirely. Writing rules for `knowledge_index` and `adminNotifications` may be protecting collections no client ever touches — or may be the only thing standing between a client and them.
- A member is mid-session when rules change; their client holds listeners opened under the old rules.
- The `client` custom claim is set at sign-up. Accounts created before it existed may not carry it, so any rule depending on it fails open or closed for that cohort.
- A member legitimately reads another member's display name and avatar in a group chat — the personal-data boundary is not simply "your own document".
- Staff use the same app as members; a rule keyed only to the signed-in uid would lock staff out of their own tooling.
- Two collections are written by both a client and a Function, with different expectations about who may write.

---

## Requirements *(mandatory)*

### Functional Requirements

#### Coverage

- **FR-001**: The ruleset MUST deny access by default, granting only what is explicitly permitted.
- **FR-002**: The ruleset MUST NOT contain any rule granting blanket access to all documents.
- **FR-003**: The ruleset MUST define explicit rules for every collection the system uses: `users`, `chats`, `workbooks`, `interventions`, `chapters`, `posts`, `questions`, `categories`, `surveys`, `bookings`, `feedback`, `referrals`, `adminNotifications`, `knowledge_index`.
- **FR-004**: The ruleset MUST resolve the status of `notifications` and `responses` — confirmed in use and given rules, or confirmed unused and denied — rather than leaving either assumed.
- **FR-005**: The ruleset MUST NOT contain rules that cannot match a request. The three existing dead blocks MUST be removed rather than carried forward.
- **FR-006**: Every collection MUST be reachable by the roles that legitimately need it, verified against actual application behaviour rather than inferred from collection names.

#### Access model

- **FR-007**: Unauthenticated clients MUST have no read or write access to any collection.
- **FR-008**: A member MUST be able to read and write their own personal records, and MUST NOT be able to read or write another member's.
- **FR-009**: A member MUST be able to read the limited profile fields of other members that shared features already depend on, and MUST NOT gain access to the rest of another member's record through that permission.
- **FR-010**: A member MUST be able to read curriculum content and MUST NOT be able to modify it.
- **FR-011**: Staff MUST be able to reach the member data their role requires; a signed-in account without a staff role MUST NOT.
- **FR-012**: Authorisation MUST treat an absent role as "not staff". A missing field must never grant privilege.
- **FR-013**: The existing per-intervention allowlist behaviour MUST be preserved.
- **FR-014**: Counsellors and administrators MUST share a single **staff** capability. There is one staff access matrix, not two, and any account whose role is `counsellor` or `administrator` receives identical access.
- **FR-014a**: The staff capability MUST be expressed so that splitting it later does not require rewriting every rule — a single named condition, referenced everywhere, rather than the role comparison repeated inline.

#### Verification

- **FR-015**: Every rule MUST be covered by an automated test asserting both what it permits and what it denies. A rule tested only for what it allows is untested.
- **FR-016**: The test suite MUST include cross-member denial cases for every collection holding personal data.
- **FR-017**: The test suite MUST verify that operations the live app performs today still succeed.
- **FR-018**: The test suite MUST run without touching production data.
- **FR-019**: Deployment MUST be blocked while any test fails.

#### Deployment and reversal

- **FR-020**: The previous ruleset MUST be retained in version control before any change is deployed.
- **FR-021**: The emulator suite is the sole pre-deployment gate. Verified: **there is no staging or development Firebase project** — `positive-konnections-42d8a` is the only project for this app. No staging project will be provisioned for this change; the exposure is live and delaying to build an environment costs more than it buys.
- **FR-021a**: Because the emulator is the only gate, deployment MUST occur in an identified low-traffic window, with someone watching for permission failures for the duration.
- **FR-021b**: The rollback drill (User Story 5) MUST be rehearsed **before** the production deployment, not after. With no staging project and no canary, a rehearsed reversal is the only real safety net — it moves from good practice to the mitigation the whole deployment rests on.
- **FR-022**: A rollback MUST be executable by someone who did not author the change, from written instructions, without reconstructing the previous ruleset by hand.
- **FR-023**: Permission failures MUST be observable after deployment, so a problem is detected rather than reported by members.
- **FR-024**: The crisis and counsellor-request paths MUST be verified explicitly before and after deployment. They are safety-critical, and a denial there is more harmful than the exposure being fixed.
- **FR-025**: Backend processes bypass rules entirely and MUST NOT be treated as constrained by them. Verified: the Cloud Functions initialise the Firebase Admin SDK (`functions/src/index.ts`), which executes with full privilege and is not subject to security rules. Two consequences the plan MUST carry:
  - Tightening rules **cannot** break background delivery, push notifications, AI indexing or any other Function. This removes a whole category of deployment risk.
  - Rules for `knowledge_index` and `adminNotifications` therefore constrain **clients only**. No client code touches either collection, so both MUST deny all client access rather than being given permissive rules that merely look complete.

---

### Key Entities

- **Ruleset**: The complete set of access rules in force at one time. Deployed and replaced atomically — there is no partial application, which is why reversal matters more than usual.
- **Actor**: Who is making a request — unauthenticated, a member, or staff. Determined from the request's identity, never from data the requester controls.
- **Collection Access Policy**: For one collection, who may read and who may write, and under what condition.
- **Rule Test**: A single assertion that a specific actor is permitted or denied a specific operation on a specific collection. The unit of evidence for FR-015.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A member cannot read or write any other member's personal data — verified by an automated denial test for every collection holding personal data, with zero passing reads.
- **SC-002**: An unauthenticated client can read nothing — zero collections accessible.
- **SC-003**: 100% of collections in use have explicit rules; none rely on a catch-all.
- **SC-004**: Every rule has at least one allow test and one deny test.
- **SC-005**: Every operation the app performs today still succeeds after the change — zero regressions across a full walkthrough of the app.
- **SC-006**: The crisis and counsellor-request paths succeed after deployment, verified explicitly rather than assumed.
- **SC-007**: A rollback completes in under 15 minutes from the decision to reverse.
- **SC-008**: Zero member-reported permission errors in the 48 hours after deployment.
- **SC-009**: Feature 002's gate — a member cannot read another member's intake — passes, unblocking that feature.

---

## Assumptions

- The exported baseline at `firestore.rules` is the ruleset currently in force, captured 2026-08-25.
- The collection inventory is drawn from a code sweep plus a live existence check, and is complete for collections in current use. A collection used only by a rarely-exercised path could still be missed, which FR-006 exists to catch.
- Members and staff use the same application; there is no separate staff console, so rules must accommodate both in one client.
- Counsellors and administrators share one staff capability (FR-014). This grants a counsellor an administrator's reach, accepted as proportionate for a programme this size; FR-014a keeps a later split cheap.
- Cloud Functions run with Admin SDK privilege and are unaffected by rules (FR-025), so no Function needs a corresponding rule to keep working.
- The sign-up custom claim and the role field on user documents are the available authorisation signals. The role field is sparse — sampled documents carried none — so absent means not-staff (FR-012).
- Subcollections inherit nothing implicitly and need rules stated where they exist.
- Tightening rules changes no application code. If a screen breaks, the correct response is to fix the rule or the screen deliberately, not to widen the rule until the error stops.
- This work does not depend on feature 002, but feature 002 depends on it.

## Risks

- **The app depends on the current permissiveness in unmapped ways.** Every read the client performs today succeeds because everything is permitted; nobody has enumerated which of those reads a tightened rule would deny. Story 2 is where this feature will actually be won or lost.
- **Deployment is atomic and total.** The whole database, every member, at once. There is no canary and no percentage rollout, which is why Story 5 is P1 rather than a closing task.
- **A denial on a safety-critical path is worse than the exposure being fixed.** Someone unable to reach a counsellor because of a rule intended to protect them is the failure mode to design against (FR-024).
- **The exposure is live now.** Every day this is not fixed is a day the data is open. That argues for moving quickly, and against moving carelessly — the two pressures pull in opposite directions and the plan must pick a side deliberately.
- **There is no staging environment, and one will not be built** (FR-021, decided). Deployment goes straight to production on emulator evidence alone. This is the single largest risk in the feature and it is **accepted deliberately**, because the data is open today and every day of delay carries its own cost. The mitigations are non-negotiable rather than advisory: exhaustive emulator coverage (FR-015, FR-016), a rehearsed rollback (FR-021b), a low-traffic window with someone watching (FR-021a), and explicit verification of the crisis path (FR-024).
- **One risk is now closed.** Because Functions run with Admin SDK privilege (FR-025), no background process can be broken by this change. The blast radius is client reads and writes only — still the whole member base, but a smaller surface than initially assumed.

## Out of Scope

- Changing application code, data shapes or features. Rules only.
- Storage security rules — a separate ruleset with its own exposure, and it should be checked, but not here.
- Building an admin console or formal staff management.
- Auditing historical access to determine whether the exposure was exploited. That is an incident-response question and, if the programme wants it, its own piece of work.
- Feature 002's own intake rules, which land with that feature once this one unblocks it.

## Dependencies

- The exported baseline ruleset at `firestore.rules`.
- The emulator-based rules test harness built in feature 002 (`npm run test:rules`), already verified working.
- Access to deploy rules to the Firebase project.
- Answers to the three clarifications above before planning.
