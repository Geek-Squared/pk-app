# Feature Specification: Phone Number Sign-In with OTP

**Feature Branch**: `004-phone-otp-auth`

**Created**: 2026-08-26

**Status**: Draft. Not implemented. Written before any code, because this changes the identity model and there are live accounts.

**Input**: Programme observation — a substantial share of the people this service is for do not have an email address, but do have a phone. Registration and sign-in today require an email, so those people cannot reach the app at all.

---

## Context

Positive Konnections authenticates with Firebase Auth, email and password only. The app has `registration`, `login`, `reset-password` and `verify-email` routes, and every one of them assumes an email exists.

For a service supporting people affected by HIV in Zimbabwe — including adolescents and young mothers — requiring an email address is an access barrier, not a neutral technical choice. A phone number is the identifier this population actually has.

Firebase Auth supports phone sign-in with an SMS one-time passcode. **No plan change is needed**: phone sign-in requires the Blaze (pay-as-you-go) plan, and the project is already on Blaze because Cloud Functions are deployed. What it does introduce is a **per-verification cost** and a **new abuse surface**, both of which this specification treats as first-class requirements rather than operational detail.

Three places in the current code silently break for an account with no email. They are the reason this is a specification and not a ticket:

1. **New accounts are never provisioned.** `processSignUp` opens with `if (!user.email) return;`. A phone-only account would be created in Firebase Auth and then receive no `users` document, no workbook, no chat, and no custom claim. With no `users` document, `isStaff()` cannot even evaluate for that account.

2. **They can never get past the login screen.** The app's `AuthGuard` routes any account whose `emailVerified` is false to `/verify-email`. A phone account's `emailVerified` is false permanently, so it would be redirected forever to verify an email it does not have.

3. **There is no admin path to create one.** `createStaffUser` requires email and password. Staff provisioning is fine on email, but there is no equivalent for registering a phone-only member from the admin portal.

4. **The admin portal identifies people by email on screen.** The user list and the user form both display and edit `email`; a phone-only member would appear with a blank identity column. This one is cosmetic rather than blocking, but it is where staff would first notice something looked broken.

None of these are hard to change. All four follow from one assumption — that every account has an email — and that assumption is load-bearing in more places than it looks.

What makes the feature contained is the thing that is *not* wrong: **no query in either codebase filters on email.** Every lookup — workbooks, chats, responses, care assignments, intake — is by uid. Confirmed by sweep, and it is the difference between adding a sign-in method and migrating an identity model.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Someone with only a phone can join and use the programme (Priority: P1)

A person with a phone number and no email address registers, verifies by SMS code, and reaches the same programme every other member gets: interventions, chapters, a workbook, and a counsellor conversation.

**Why this priority**: This is the feature. Everything else is a consequence or a safeguard.

**Independent Test**: On a device with no email account configured, register using a phone number only. Confirm the account reaches the home screen, has a workbook, appears in the admin user list, and can open a chat.

**Acceptance Scenarios**:

1. **Given** an unregistered phone number, **When** the person submits it, **Then** an SMS passcode is sent and a code entry screen is shown.
2. **Given** a correct passcode, **When** it is submitted, **Then** the account is signed in and provisioned exactly as an email account is — `users` document, workbook, chat, client claim.
3. **Given** an incorrect passcode, **When** it is submitted, **Then** the person is told it is wrong and can retry without restarting registration.
4. **Given** a registered phone number, **When** the person signs in later, **Then** they receive a passcode and reach their existing account and history — not a new one.
5. **Given** a phone-registered member, **When** they complete onboarding, **Then** care routing and intervention visibility behave exactly as for an email member.

---

### User Story 2 - Existing members are not disturbed (Priority: P1)

Every account that exists today continues to sign in with email and password, keeps its history, and sees no change.

**Why this priority**: There are live accounts with real counselling data. A change to the identity model that disrupts them is a worse outcome than the access barrier being fixed.

**Independent Test**: Sign in as an existing email member before and after the change. Workbook, chats, surveys and progress are identical, and no additional step is introduced.

**Acceptance Scenarios**:

1. **Given** an existing email member, **When** they sign in after this feature ships, **Then** nothing about their flow has changed.
2. **Given** an existing member's data, **When** the provisioning function runs after the change, **Then** no existing document is rewritten or reshaped.
3. **Given** a staff account, **When** they sign in, **Then** email and password still work and their role is unchanged.

---

### User Story 3 - Staff keep email sign-in (Priority: P2)

Counsellors and administrators continue to sign in with email and password, and continue to be created through the admin portal.

**Why this priority**: Staff accounts need password reset, are minted by an administrator rather than self-registered, and are the accounts with elevated access. Keeping them on email is deliberate, not an omission.

**Independent Test**: Create a counsellor from the admin portal after the change; confirm it is email-based, has the correct role, and that no phone number is required.

**Acceptance Scenarios**:

1. **Given** an administrator, **When** they create a counsellor, **Then** the flow is unchanged and requires no phone number.
2. **Given** a phone-only account, **When** staff privileges are considered, **Then** it is treated as a client unless a staff role is explicitly assigned by the existing server-side path.

---

### User Story 4 - A member can add the other contact method later (Priority: P2)

A member who registered by phone can later add an email, and a member who registered by email can later add a phone — keeping one account and one history.

**Why this priority**: Without this, a member who registers by phone and later by email ends up with two accounts and a split workbook. Retrofitting identity linking after that has happened is far more expensive than allowing it from the start.

**Independent Test**: Register by phone, complete a chapter, then add an email to the same account. Sign out, sign in with the email, and confirm the same workbook and history are present.

**Acceptance Scenarios**:

1. **Given** a phone-registered member, **When** they add an email address, **Then** both methods sign in to the same account.
2. **Given** a member attempting to add a contact method already used by another account, **When** they submit it, **Then** they are told clearly and no data is merged or lost.

---

### User Story 6 - The programme controls who can use phone sign-in, and can stop it (Priority: P1)

Phone registration opens to a named cohort first. Staff choose who is in it, can add and remove people without a release, and can switch the whole thing off if SMS delivery or spend goes wrong.

**Why this priority**: It is how the cost risk (FR-015 to FR-019) is actually contained on day one — a closed list means no SMS is ever sent to a number nobody chose. It is also the safest way to discover what delivery in Zimbabwe is really like, on twenty people rather than everyone.

**Independent Test**: Add a number to the cohort and register with it successfully. Attempt to register with a number not on the list and confirm no SMS is sent and a clear message is shown. Disable phone registration entirely and confirm email registration still works.

**Acceptance Scenarios**:

1. **Given** a number on the cohort list, **When** it is submitted, **Then** a passcode is sent.
2. **Given** a number not on the list, **When** it is submitted, **Then** **no SMS is sent**, no cost is incurred, and the person is told plainly that phone sign-in is not yet open to them.
3. **Given** phone registration is switched off, **When** anyone opens registration, **Then** the email route works unchanged and phone is not offered.
4. **Given** a staff member, **When** they add or remove a number, **Then** it takes effect without a release and the change is recorded.

---

### User Story 5 - A member who loses their number is not locked out of their care (Priority: P1)

A phone-only account has no password. If the number is lost, changed or stops receiving SMS, there must be a defined way back to the account that does not depend on that number.

**Why this priority**: For an email account, recovery is self-service. For a phone-only account it is not — and the data behind it is counselling history. An account recovery story that is left undefined becomes "the member loses their history", which for this service is a care outcome, not an inconvenience.

**Independent Test**: With a phone-only member, simulate loss of the number and confirm a documented, staff-assisted route restores access to the same account, with the action recorded.

**Acceptance Scenarios**:

1. **Given** a member who no longer has their number, **When** they contact the programme, **Then** a defined staff-assisted procedure restores access to the same account.
2. **Given** that procedure, **When** it is used, **Then** who performed it, for whom, and when are recorded.
3. **Given** a request to change a number, **When** it is completed, **Then** the old number can no longer sign in to that account.

---

### Edge Cases

- **A recycled number.** Carriers reassign disconnected numbers. Whoever receives that number next can pass an SMS check for an account that is not theirs — and that account holds counselling history.
- **The SMS never arrives.** Poor coverage, a carrier block, or a delivery failure with no error. The person is stuck on a code screen with nothing to enter.
- **A shared or borrowed handset.** More than one person using one number, in a population where handset sharing is common.
- **A number entered in the wrong format** — local `07…` versus international `+263…`. The same person must not become two accounts.
- **Repeated code requests**, whether from a frustrated member or an attacker generating billable SMS.
- **A member with both** an email account and a phone account created separately, each with history, before linking existed.
- **A staff member who also has a phone account** as a test or personal account.
- **Onboarding interrupted** between passcode verification and provisioning completing.

---

## Requirements *(mandatory)*

### Functional Requirements

#### Identity and provisioning

- **FR-001**: An account MUST be able to exist with a phone number and no email address.
- **FR-002**: Provisioning MUST key off the account identifier, not the presence of an email. Every account MUST receive its `users` document, workbook, chat and claim regardless of which contact method created it.
- **FR-003**: The stored profile MUST record whichever contact methods an account has, and MUST NOT record an empty or placeholder email to satisfy a field that expects one.
- **FR-004**: Phone numbers MUST be stored in a single canonical format so that the same number entered differently resolves to the same account.
- **FR-005**: Provisioning MUST be idempotent and MUST NOT overwrite an existing account's role or profile — the guarantee `processSignUp` already provides for email accounts.

#### Session and access

- **FR-006**: The route guard MUST NOT gate on `emailVerified`. It MUST admit an account that has completed the verification appropriate to its contact method — a verified email, or a verified phone number.
- **FR-007**: An unverified account MUST NOT reach programme content, whichever method it registered with.
- **FR-008**: An account signed in by phone MUST reach exactly the same features as one signed in by email. There is one member experience, not two.
- **FR-008a**: The admin portal MUST identify a member by whichever contact method they have, so a phone-only member is not shown as a blank row.

#### Staff

- **FR-009**: Staff accounts MUST continue to be created server-side by an administrator, and MUST continue to use email and password.
- **FR-010**: A self-registered account MUST NOT be able to obtain a staff role, whichever method it used. The existing guard on role assignment MUST apply unchanged.

#### Linking and recovery

- **FR-011**: A member MUST be able to add a second contact method to an existing account without creating a new one or losing history.
- **FR-012**: An attempt to attach a contact method already in use MUST fail clearly, and MUST NOT merge or discard any data.
- **FR-013**: There MUST be a documented, staff-executed procedure to restore access for a member who has lost their number, and to change the number on an account.
- **FR-013a**: Executing a recovery or a number change MUST be restricted to administrators. Counsellors MUST be able to raise the request — they are who a member reaches — but MUST NOT be able to complete it themselves.
- **FR-013b**: An account dormant for **twelve months or more** MUST require one identity check, drawn from data the member supplied at onboarding, before counselling history is exposed. A repeat passcode MUST NOT be treated as satisfying this: if the number has been recycled, the new holder passes it, so it confirms control of exactly the thing that changed hands.
- **FR-014**: Any staff-executed identity change MUST be recorded — who acted, on whose account, and when.

#### Cost and abuse

- **FR-015**: Passcode requests MUST be rate-limited per number and per device, so that repeated requests cannot generate unbounded billable SMS.
- **FR-016**: SMS delivery MUST be restricted to **Zimbabwe (+263) only** (decided 2026-08-26). Every other destination MUST be denied at the platform level, not merely unused. A single permitted destination is the strongest available control here: toll fraud depends on reaching expensive destinations, and this closes that off entirely rather than rate-limiting it.
- **FR-016a**: A member roaming or holding a non-Zimbabwean number MUST be given a clear reason and a route to human help, not a silent failure. This is a known and accepted consequence of FR-016.
- **FR-017**: The platform's abuse protections for phone sign-in MUST be enabled before the feature is exposed to the public, not after.
- **FR-018**: Verification volume and spend MUST be observable, with a threshold that raises an alert rather than being discovered on an invoice.
- **FR-018a**: The threshold MUST be derived from the cohort rather than guessed — cohort size × expected verifications per member per month × the current Zimbabwe rate — with alerts at 50% and 100% of it. Alerts go to the Firebase project owner until the programme names a recipient. The figure MUST be recalculated before general availability, when the cohort ceases to be the ceiling.
- **FR-019**: The per-verification cost for the programme's actual destination countries MUST be established and accepted before launch. It MUST be taken from current published pricing at the time of the decision, not assumed.

#### Verification

- **FR-020**: Provisioning MUST be covered by an automated test for a phone-only account, asserting every artefact an email account receives.
- **FR-021**: The guard MUST be covered by tests for all four states: verified email, verified phone, unverified, signed out.
- **FR-022**: Existing email sign-in and provisioning tests MUST continue to pass unchanged — the regression gate for User Story 2.
- **FR-023**: Rules tests MUST confirm that a phone-only account receives exactly a client's access and no more.

#### Rollout

- **FR-024**: The feature MUST be releasable without altering any existing account. No migration of live accounts is required to ship it.
- **FR-025**: Phone registration MUST be disableable without a code release, so that a delivery failure or a cost problem can be stopped quickly while email registration continues.
- **FR-026**: Phone registration MUST launch to a limited cohort before general availability (decided 2026-08-26), and the cohort MUST be changeable without a code release.
- **FR-027**: Eligibility MUST be decided **server-side, before an SMS is sent**. A client-side check would be both bypassable and pointless — the cost is incurred by the send, so a gate that runs after it protects nothing.
- **FR-028**: The eligibility list MUST NOT be readable by clients. A list of the phone numbers of people in an HIV programme is itself sensitive; it must never be shipped to a device or exposed to an unauthenticated caller.
- **FR-029**: An ineligible number MUST be told plainly that phone sign-in is not yet open to them, and offered the existing email route or a way to contact the programme — never left on a code screen waiting for an SMS that will not arrive.
- **FR-030**: Staff MUST be able to add and remove numbers from the cohort from the admin portal, and every change MUST be recorded under FR-014.

### Key Entities

- **Account**: One person's identity in the system, addressed by uid. It carries one or more contact methods. The uid is what all programme data — workbook, chats, responses, care assignment — hangs from, and it does not change when contact methods do.
- **Contact method**: An email address or a phone number attached to an account, each either verified or not. An account needs at least one verified method to reach the programme.
- **Verification**: One SMS passcode challenge — issued, delivered, and either satisfied, failed or abandoned. The unit that costs money and the unit that gets abused.
- **Provisioning**: The set of records created for a new account — `users` document, workbook, chat, claim. Currently gated on email; must become gated on nothing.
- **Identity change**: A staff-executed change to which contact methods an account has. The recovery path, and the thing that most needs recording.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person with no email address can register and reach programme content — verified end to end on a real device, not only in an emulator.
- **SC-002**: A phone-registered account receives 100% of the artefacts an email account receives; zero missing records.
- **SC-003**: Zero existing accounts are altered by the release.
- **SC-004**: Zero regressions in the email sign-in path across a full walkthrough.
- **SC-005**: A phone-registered member signing in a second time reaches their existing account, with a duplicate-account rate of zero across the test matrix, including numbers entered in local and international format.
- **SC-006**: Every rule and guard state has both an allow and a deny test.
- **SC-007**: SMS spend per active member stays within the accepted budget in the first 30 days, with an alert proven to fire before the threshold is reached.
- **SC-008**: The recovery procedure completes in a single support interaction, and every use of it appears in the record.
- **SC-009**: Phone registration can be turned off and back on without a release, demonstrated before launch.

---

## Assumptions

- The project remains on the Blaze plan; Cloud Functions already require it, so phone sign-in adds no plan change.
- Firebase Auth's own SMS delivery is used. No third-party SMS provider is introduced by this feature.
- The programme serves a known, small set of destination countries, so FR-016's regional restriction is workable rather than a blanket allow.
- Staff remain email-based (FR-009). Phone sign-in is for members.
- The uid remains the sole key for all programme data. **Verified, not assumed**: a sweep of both codebases for queries filtered on `email` returns nothing — every lookup is by uid. This is what keeps the feature contained; had a query keyed off email, this would be a migration rather than an addition.
- Onboarding, care routing and intervention visibility are identity-method agnostic and need no change beyond provisioning reaching them.
- `intakes.phoneNumber` is demographic data collected during onboarding and is **not** an authentication identifier. The two must not be conflated, and this feature does not make an intake number a sign-in method.
- **The cohort gate cannot reuse the existing `config` collection.** Its rule is `allow read: if isSignedIn()`, and registration happens before an account exists — a pre-auth screen cannot read it. FR-027 pushes the decision server-side anyway: the natural shape is an unauthenticated callable that takes a number, checks it against a staff-managed list no client can read (FR-028), and only then triggers the passcode. Loosening the `config` rule to unauthenticated read is explicitly **not** the answer; it would put a list of programme members' phone numbers behind a public read.
- The kill switch of FR-025 has the same pre-auth constraint and the same answer: it is decided by the server, or by remote configuration, never by a document a signed-out client has to read.
- The client platform can present the passcode flow. Which mechanism — the web SDK's reCAPTCHA flow inside the Capacitor webview, or the native authentication plugin — is an implementation decision for the plan, with a bias toward the native path for a shipped app.

## Risks

- **Number recycling is a real account-takeover path, and it is not fully solvable.** A reassigned number lets a stranger pass the only check protecting counselling history. Mitigation is partial by nature: FR-013's controlled change procedure, and re-verification for accounts dormant a long time. This risk is accepted, not eliminated, and should be stated plainly to whoever signs off.
- **SMS is a metered, attacker-facing spend.** Unprotected phone auth is a known toll-fraud target: an attacker triggers verifications the programme pays for. FR-015 to FR-018 are the mitigation and are not optional extras. Two of the decisions above cut this down substantially — a single permitted destination (FR-016) removes the expensive-destination motive, and a closed cohort (FR-027) means no SMS is sent to a number nobody chose. Neither removes the need for rate limiting, because a number *on* the list can still be used to generate repeat sends.
- **The cohort list is itself sensitive.** It is a list of phone numbers of people in an HIV programme. FR-028 keeps it server-side; the failure mode to design against is someone exposing it to make the pre-auth check convenient.
- **Delivery is outside our control.** An undelivered SMS looks identical to a broken app to the person waiting for it, and for this population a failure to get in may mean not seeking support. The flow needs an honest fallback message and a route to human help, not a spinner.
- **The "no email" assumption may be wider than the three known places.** Three were found by reading the auth path. A full sweep before implementation is the difference between a contained change and a long tail of small breakages.
- **Two accounts for one person.** Until linking (US4) exists, someone who registers both ways has split history. Shipping US1 without at least detecting this makes cleanup harder later.
- **This adds a second identity path to a system whose authorisation was only just hardened.** Every new entry point is a new place for the role model to be got wrong. FR-010 is the guard, and its test is not a formality.

## Out of Scope

- Migrating existing email accounts to phone. They keep working as they are (FR-024).
- Replacing email sign-in. Both methods coexist.
- Any third-party SMS gateway.
- Multi-factor authentication. Phone-as-a-second-factor is a different feature from phone-as-an-identifier, and mixing them here would confuse both. It remains on the auth hardening plan.
- Staff phone sign-in.
- WhatsApp or USSD as delivery channels, however plausible they may be for this population — worth researching separately if SMS delivery proves unreliable.
- Building a general support console. FR-013's procedure may be a documented runbook rather than a screen.

---

## Decisions taken

- **2026-08-26 — Zimbabwe only.** SMS is permitted to +263 and nowhere else (FR-016). Accepted consequence: a member roaming or on a foreign number cannot use phone sign-in (FR-016a).
- **2026-08-26 — Cohort first.** Phone registration opens to a staff-managed list before general availability (User Story 6, FR-026 to FR-030), which also bounds the SMS spend on day one.

- **2026-08-26 — Recovery is an administrator action; counsellors request it.** (FR-013a.) A counsellor is who a member actually reaches, so they raise the request; an administrator executes it. Recovery hands someone access to a counselling record, and it is the single action most exposed to social engineering — "I lost my phone, that's my account" is exactly what an attacker says. Keeping execution with the smaller group is proportionate, and it is the first genuine administrator-versus-counsellor distinction in the system, which FR-014a of feature 003 was written to keep cheap.
- **2026-08-26 — Verification budget is derived from the cohort, alerting at 50% and 100%.** (FR-018a.) With a closed list the ceiling is knowable rather than open-ended: cohort size × expected verifications per member per month × the current Zimbabwe rate. Alerts go to the Firebase project owner until the programme names someone else.
- **2026-08-26 — Twelve months dormant triggers an identity check, not just another passcode.** (FR-013b.) See the correction below: a second passcode proves nothing about recycling.

## A correction worth recording

An earlier framing of this feature suggested "re-verify dormant accounts by SMS". **That does not work, and it is worth writing down so nobody implements it.** If a number has been recycled, the new holder receives the passcode and passes the check — re-verification by OTP confirms control of the *number*, which is precisely the thing that changed hands. It would produce the appearance of a control while providing none.

What actually distinguishes the original member from a stranger holding their old number is something the stranger cannot know. Hence FR-013b: after a long dormancy, one question drawn from data the member gave at onboarding, before counselling history is opened.

## Open questions for the programme

None blocking. The three above are recommended defaults, taken so implementation can proceed; each is recorded as a decision and any of them can be revisited without reopening the specification.
