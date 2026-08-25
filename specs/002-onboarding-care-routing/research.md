# Phase 0: Research — Onboarding & Care Routing

Unknowns carried in from the spec and from reading the codebase, each resolved
to a decision the plan can rely on.

---

## R1. Where does intake data live?

**Decision**: A separate top-level collection, `intakes/{uid}`. Not fields on `users/{uid}`.

**Rationale**: `users/{uid}` documents are read by *other members*, not just their owner. `chat.component.ts` and `group-details.component.ts` both fetch peers' user documents to render display names, avatars, roles and online status. Firestore has no field-level read control — a client permitted to read a document reads all of it. Putting gender, region and language on `users/{uid}` would therefore publish them to every peer in a group chat, which FR-023 forbids.

This was the single most consequential finding of the codebase review, and it is not visible from the spec.

**Alternatives considered**:
- *Fields on `users/{uid}`* — simplest, and wrong for the reason above.
- *Subcollection `users/{uid}/intake/current`* — solves the exposure and keeps ownership obvious. Rejected narrowly: rules for a top-level collection keyed by uid are flatter and easier to audit, and future staff access (Phase E) is a simpler rule against a top-level collection than a collection-group query.

---

## R2. Should the package be derived from selections, or stored?

**Decision**: Stored, in `careAssignments/{uid}`, with superseded assignments retained under `careAssignments/{uid}/history/{autoId}`.

**Rationale**: Deriving the package from `intakes/{uid}.selections` on read is simpler and was the first choice. It fails two requirements. FR-030 says a staff override must not be silently discarded — an override is by definition a package that disagrees with the member's own selection, which a derived value cannot represent. FR-013 requires recording how the assignment arose, and the Care Assignment entity is explicitly historical.

**Alternatives considered**:
- *Derive on read* — rejected above.
- *Single document with an embedded history array* — rejected: unbounded array growth in a document that is read on every interventions-list render.

---

## R3. How does a member's package filter the interventions list?

**Decision**: Filter client-side against `careAssignments/{uid}.interventionIds`, **unioned with** any intervention the member already has workbook progress in. Leave the existing `canView()` allowlist untouched and applied in addition.

**Rationale**: The existing `visibility: 'restricted'` + `allowedUserIds[]` mechanism looked like the natural seam, and the spec even points at it. It is the wrong tool: it expresses "which users may see this intervention" by writing member uids into intervention documents, so routing every member would mean editing every intervention document on every intake — write amplification proportional to membership, and an unbounded array. It stays as it is, for its actual purpose (tester allowlisting).

The union with in-progress interventions is what satisfies FR-015 and FR-017: deselecting something you had already started must not make your own progress unreachable.

**Alternatives considered**:
- *Reuse `allowedUserIds`* — rejected above.
- *Server-side filtering via a Cloud Function* — rejected as unnecessary: the interventions list is small, already fetched wholesale, and adding a function contradicts Principle II. Security still comes from rules, not from this filter.

---

## R4. How is intake made resumable and offline-tolerant?

**Decision**: Write each completed step to `intakes/{uid}` with `{ merge: true }`, and mirror the in-flight step to `localStorage` under a uid-scoped key. Do **not** enable Firestore offline persistence.

**Rationale**: Story 2 is P1 — an intake that must be completed in one sitting will be abandoned by exactly the people it is for. Per-step merge writes mean a completed step is durable server-side immediately; the localStorage mirror covers the partially-filled step the member is looking at when the app dies.

Enabling `enablePersistence()` would give durable offline writes for free, but it is an app-wide change to Firestore behaviour affecting every existing collection, with known multi-tab failure modes, taken on for the benefit of one flow. That is precisely the scope Principle II forbids.

**Alternatives considered**:
- *Firestore IndexedDB persistence* — rejected above.
- *Hold everything in memory, write once at the end* — rejected: loses the entire intake on any interruption, defeating Story 2.
- *localStorage only, sync at the end* — rejected: a member who reinstalls or switches device loses everything, and the app already treats localStorage as a cache rather than a source of truth.

---

## R5. What does the crisis affordance do, with no free text to scan?

**Decision**: A persistent control on every intake step, invoking the existing counsellor-request path (`requestCounsellorChat`, `functions/src/index.ts:740`). Always present; never triggered by content.

**Rationale**: Removing free text removed the only thing intake could have scanned. FR-018 was rewritten from "detect distress in the description" to "support is always one tap away", and this is now the **only** safeguarding mechanism in the flow. The constitution classifies crisis paths as safety-critical and requires an explicit acceptance criterion — Story 1 scenario 7 and SC-007 supply it.

The risk this must guard against is organisational, not technical: a requirement whose original justification has been deleted tends to be dropped as dead weight. It is not. It is the whole of safeguarding here.

**Alternatives considered**:
- *No crisis affordance during intake* — rejected. Intake is several screens of questions put to someone who may have just decided to seek help. Making them finish or abandon a form to reach a human is indefensible.
- *Reinstating free text purely for crisis detection* — rejected: collects sensitive disclosure to power a keyword scan, which is the exact trade the free-text removal rejected.

---

## R6. Where do FR-005a (pill configuration) and FR-028–FR-030 (staff view/override) live?

**Decision**: For this feature, `config/onboarding` is a Firestore document maintained through the Firebase console, and onboarding fields are added to existing `interventions/{id}` documents. **Phase E is planned but not scheduled**, pending a decision on an admin surface.

**Rationale**: There is no admin route in `app-routing.module.ts`. The `administrator` role exists and is read by messages and profile, but it opens no console. So "programme-managed configuration" today means a staff member editing JSON in the Firebase console — workable for a small programme, and honest, but it should be a decision rather than a discovery made mid-implementation.

Building an admin console inside this feature would be larger than the feature and is not what the spec asked for.

**Open question for the programme**: is console-editing acceptable for configuring the pills, or does Phase E need to become its own feature before launch? FR-028–FR-030 are P3 and do not block the MVP either way.

**Alternatives considered**:
- *Build a minimal admin page in this feature* — rejected as scope creep under Principle II.
- *Hard-code the selectable set in the app* — rejected: violates FR-005a, and means an app release to change a label.

---

## R7. Firestore document shapes cannot be verified from the repository

**Decision**: Treat the shapes in `contracts/firestore-documents.md` as the contract this feature **writes**, and read defensively — tolerate absent or differently-named fields rather than assuming.

**Rationale**: The live Firestore data is not visible from here. This exact blind spot already produced a real bug in this codebase: `models/referrals.interface.ts` declares `phone`, both referrals templates read `phoneNumber`, and because `strictTemplates` is off it compiled silently and rendered an empty value. Repeating that pattern on demographic data would be worse.

**Follow-up**: export one real `interventions` document and one `users` document before Phase A, and reconcile. Cheap, and it removes the guesswork.

---

## R8. Should `strictTemplates` be enabled?

**Decision**: Out of scope for this feature. Recommended as a separate change.

**Rationale**: It would have caught the referrals bug at compile time, and would protect the new intake models the same way. But enabling it surfaces errors across all 25+ existing pages at once, which is a repo-wide change landing in the middle of a feature branch — the opposite of minimal-impact.

**Alternatives considered**: *Enable it now* — rejected above. *Never* — also rejected; it is recorded here so the recommendation is not lost.

---

## R9. Where does intake sit relative to email verification and the existing walkthrough?

**Decision**: `verify-email` → **intake** → `/how-to-use` → `home`. A new `OnboardingGuard` runs after `AuthGuard` on the protected subtree.

**Rationale**: `AuthGuard` already gates on the live Firebase session and redirects unverified users to `/verify-email`. The first-run walkthrough is triggered separately inside `HomePage.ngOnInit` via a `localStorage` key. Intake belongs between them: it must not be reachable before verification, and the walkthrough explains an app the member has not yet been given a package for.

**Note**: the existing walkthrough trigger is a redirect inside `ngOnInit` rather than a guard. Phase B should not deepen that pattern — the new check is a guard, and the two must be verified together so a member is not bounced between them.

**Alternatives considered**:
- *Intake before email verification* — rejected: collects sensitive data, including from minors, before the account is proven to belong to anyone.
- *Extend `AuthGuard`* — rejected: it has one job, and conflating session validity with profile completeness makes both harder to reason about.
