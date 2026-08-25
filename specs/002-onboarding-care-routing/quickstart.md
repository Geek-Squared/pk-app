# Quickstart — Onboarding & Care Routing

How to get set up, build this feature in the right order, and prove it works.

---

## Before you write anything

Two prerequisites, both cheap, both expensive to skip.

**1. Baseline the security rules.** This repo has no `firestore.rules`, and
deploying one **replaces the entire live ruleset**. Export the current rules
from the Firebase console (Firestore → Rules), commit them unchanged, register
the file in `firebase.json`, and only then start editing. Skipping this can
lock production out or silently open it up. See
`contracts/firestore-rules.md`.

**2. Export one real document of each shape.** Pull a single `interventions`
document and a single `users` document from the console and reconcile them
against `data-model.md`. The live data is not visible from the repo, and this
exact blind spot already shipped a bug here — `referrals.interface.ts` says
`phone`, the templates read `phoneNumber`, and with `strictTemplates` off it
compiled and rendered nothing.

---

## Environment

```bash
nvm use                 # 22.12 — the Capacitor CLI refuses anything below 22
npm install --legacy-peer-deps
```

`--legacy-peer-deps` is required by a **pre-existing** conflict unrelated to
this feature: `@capacitor-firebase/messaging` wants `firebase@^12`, while
`@angular/fire@20` pins `firebase@11`. There is no `.npmrc`, so this flag is
folklore rather than configuration — worth pinning in one.

```bash
npm start               # ng serve
npm run build           # must stay clean
npm test                # Karma + Jasmine
```

For rules work:

```bash
firebase emulators:start --only firestore
npm i -D @firebase/rules-unit-testing
```

---

## Build order

Backend-config-first: the pills cannot render until something defines them.

### Phase A — data & rules

1. Baseline `firestore.rules` (above), register in `firebase.json`.
2. Add the rules from `contracts/firestore-rules.md`.
3. Create `config/onboarding` in the console, per `data-model.md`.
4. Add `selectableAtOnboarding`, `onboardingLabel`, `onboardingOrder`,
   `audience` to a few `interventions` documents.
5. Add the models: `intake.interface.ts`, `care-assignment.interface.ts`,
   and the new optional fields on `intervention.interface.ts`.

**Verify**: emulator tests green, including *a member cannot read another
member's intake*. If that one passes, the whole reason for splitting the
collection was wasted.

### Phase B — intake flow (both P1 stories)

6. `IntakeService` with per-step merge writes and the localStorage draft mirror.
7. `OnboardingGuard`, wired after `AuthGuard`.
8. Lazy-loaded `/onboarding` module with the four steps.
9. **The crisis affordance on every step**, invoking the existing
   `requestCounsellorChat` path.

**Verify**: complete an intake end to end; force-close mid-step and confirm
resume; airplane-mode a step and confirm it survives. Confirm the crisis
control is reachable in one tap from every step.

### Phase C — package application

10. `CarePackageService`; compose on completion; default when nothing selected.
11. Filter the interventions list by `visibleInterventionIds` — the package
    **unioned with** anything already in progress.

**Verify**: two accounts with different selections see different lists. Start
an intervention, deselect it, confirm your own progress is still reachable.

### Phases D & E

Story 3 (edit selections), Story 4 (existing-member invitation), then Story 5
(staff view/override). Phase E needs an admin surface that does not exist —
see `research.md` R6 before starting it.

---

## Things that will bite

- **`users/{uid}` is read by other members.** Chat and group-details fetch
  peers' user documents. Never put demographic data there; that is the entire
  reason `intakes/{uid}` is a separate collection.
- **The crisis affordance has lost its original justification.** It used to
  scan the free-text field. That field is gone, so the requirement looks like
  an orphan — it is not. It is the only safeguarding in this flow, it is
  safety-critical under the constitution, and Story 1 scenario 7 and SC-007
  exist to stop it being quietly dropped.
- **Existing members must never be locked out.** The guard blocks *new*
  members without an intake. An existing account with workbook history and no
  intake gets an invitation, not a wall (FR-027).
- **`strictTemplates` is off**, so a mistyped field name renders empty rather
  than failing the build. Route field access through an accessor.
- **Don't reuse `allowedUserIds` for packages.** It writes member uids into
  intervention documents — write amplification proportional to membership, and
  an unbounded array. It stays as the tester allowlist (research R3).
- **Don't enable Firestore offline persistence** for this feature. It is an
  app-wide behaviour change for one flow's benefit (research R4).

---

## Definition of done

Per constitution Principle IV — "it should work" is not verification.

- [ ] `npm run build` clean
- [ ] `npm test` green, including new service and guard specs
- [ ] Emulator rules tests green, cross-member read denied
- [ ] Existing collections' rules unchanged from the baseline commit
- [ ] Intake completes on a real Android device
- [ ] Resume verified after a force-close and after an offline step
- [ ] Crisis affordance reachable in one tap from every step (SC-007)
- [ ] A pre-existing account still reaches all of its prior progress
- [ ] `tasks/lessons.md` updated with the `users/{uid}` read-surface finding
