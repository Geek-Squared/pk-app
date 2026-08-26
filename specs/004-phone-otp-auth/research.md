# Phase 0 Research: Phone Number Sign-In with OTP

**Feature**: `004-phone-otp-auth` | **Date**: 2026-08-26 | **Plan**: [plan.md](./plan.md)

Three questions had to be settled before design. Two are resolved here. One could not be answered from public sources at the confidence a budget requires, and is recorded as an unresolved item with the exact method to close it — deliberately, rather than filled in with a plausible number.

---

## R1 — Client mechanism: native plugin, not the web reCAPTCHA flow

**Decision**: Use `@capacitor-firebase/authentication` for the Android build. Keep the Firebase JS SDK's `RecaptchaVerifier` flow for the responsive web build only.

**Rationale**, in the order the evidence actually weighed:

1. **The native Firebase Android SDK is already wired up.** The app depends on `@capacitor-firebase/messaging@^8.2.0` — the same plugin family, on the same major line — so `google-services.json`, the Gradle plugin and the native Firebase initialisation all exist and work today. This is not adding a vendor; it is adding a sibling package to one already in production. That single fact removes most of the cost normally attached to this decision.

2. **The target is Android only.** There is no `ios/` directory in the repository. The usual complication of native phone auth — APNs silent-push verification on iOS — does not apply. What is needed is the Android path alone.

3. **Play Integrity beats reCAPTCHA for these users.** Native phone auth verifies the app via Play Integrity rather than challenging the person. The web flow's "invisible" reCAPTCHA degrades to a visible image challenge under exactly the conditions this programme's members are most likely to be in: an unfamiliar device fingerprint, a shared handset, a low-end phone, an intermittent connection. Asking someone to identify traffic lights before they can reach counselling support is a real accessibility cost, not a cosmetic one.

4. **Android SMS auto-retrieval.** The native path can read the passcode automatically, removing a step where people frequently drop out — switching apps to read a code and typing six digits back.

**Alternative rejected**: the JS SDK reCAPTCHA flow inside the Capacitor webview. It is documented as workable, but the webview is served from `localhost`, the reCAPTCHA iframe behaves inconsistently there, and it gives up both advantages above. Rejected on evidence, not preference — the deciding factor is that the native plumbing already exists, so the "simpler" option is not actually simpler here.

### The integration risk this creates, and it is the important part

`@capacitor-firebase/authentication` signs in **at the native layer**. The JS SDK does not automatically know about it.

This entire application reads authentication state through `@angular/fire`'s `afAuth.authState` — the route guard was changed to it in the auth-hardening work, `AuthenticationService` mirrors from it, and every service that needs a uid depends on it. A native-only sign-in would leave `authState` emitting `null` while the person is, natively, signed in. The guard would bounce them to `/login` forever, and it would look like the passcode had failed.

**The flow must therefore be**: sign in natively → take the returned credential → `signInWithCredential` on the JS SDK → `authState` emits → the guard admits. Both layers, every time. This must be a task in its own right and it must have a test, because the failure mode is silent and looks like something else.

**Ops prerequisite**: Play Integrity requires the app's SHA-256 signing certificates (debug *and* release) registered against the Firebase Android app. A missing release SHA produces "app not authorised" only in the production build — passing every test on the way there. This belongs on the release checklist, not in the code.

---

## R2 — Per-verification cost: UNRESOLVED, with the method to resolve it

**Status**: Not determined. Do not budget from this document.

Firebase's own pricing page confirms the model — phone auth is "billed per SMS sent", listed as "Phone Auth – All regions" — and then defers to the Identity Platform rate card for the actual figures. That rate card could not be retrieved in a form that could be quoted with confidence, so no number is recorded here.

Third-party summaries circulating publicly suggest a tiered structure — roughly $0.01 for US/Canada/India, higher for most other destinations, with premium carriers substantially higher again. **These are unofficial blog sources and must not be used as a budget input.** They are noted only to set an expectation that Zimbabwe will not be in the cheapest tier, and that the cost per member is therefore not negligible at cohort scale.

**How to close this** (FR-019, one task):

1. Open the Identity Platform pricing rate card and find the row for **Zimbabwe (+263)**, not a regional average.
2. Cross-check against the Firebase console's own billing estimate for the project, which reflects the account's actual contract.
3. Record the figure, the source, and the date read — because it changes, and a stale number in a budget is worse than none.

**Then apply the FR-018a formula**:

```
monthly ceiling = cohort size
                × expected verifications per member per month
                × Zimbabwe per-SMS rate
```

Expected verifications per member is itself an estimate. Registration is one. Each subsequent sign-in on a new device or after a sign-out is another. Budget on the pessimistic end for the first month, when everyone in the cohort registers at once, then recalculate from observed data rather than from the estimate.

**Free allowance**: there is no meaningful free tier for production SMS. The daily free allowance applies to *fictional test numbers*, which matters for R4 below but not for real members.

---

## R3 — Deliverability in Zimbabwe: must be tested before anything is built on it

Everything downstream of the passcode screen assumes the passcode arrives. That assumption has not been tested, and if it is wrong the feature's premise changes rather than its implementation.

**Test before Phase 3**, with real handsets, not an emulator:

- At least two Zimbabwean carriers, on separate networks.
- A prepaid handset as well as a contract one — prepaid is what most of this cohort will have.
- A low-end Android device, not only a modern one.
- Time-to-delivery recorded, not just success or failure. A passcode that arrives in four minutes is a failed passcode in practice, because the person has already given up or requested another one — and each request costs.
- Behaviour when the SMS does not arrive at all: what the person sees, and how they reach help (FR-016a, FR-029).

**If delivery proves unreliable**, that is a finding, not a bug to work around. WhatsApp and USSD are currently out of scope, and would need to come back onto the table. Better to learn that with twenty people in a cohort than after a general launch.

---

## R4 — Testing without spending money

Firebase supports **fictional phone numbers with fixed passcodes**, configured per project. A number registered this way never sends an SMS, never costs anything, and always accepts its assigned code.

This should be used for:

- The Karma suite and any end-to-end run.
- The Firestore emulator work — the rules tests do not touch Auth's SMS path at all, so `phoneCohort` and `identityChanges` rules are testable today with no new infrastructure.
- The eligibility callable, which is where the Functions test runner gap in the plan bites: it is pure logic over a Firestore read, entirely testable, and it is the piece that decides whether money is spent and whether a member list stays private.

Real SMS should be used only for R3's deliverability testing and for a final pre-launch walkthrough. Everything else runs on fictional numbers.

**A trap to avoid**: fictional numbers are configured in the Firebase console, per project, and there is one project — `positive-konnections-42d8a`. A fictional number added for testing is live in production. Use a clearly non-real range, document which numbers are reserved, and remove them before general availability.

---

## Resolved for Phase 1

- Client mechanism: native plugin for Android, JS SDK for web (R1).
- Dual-layer sign-in is a first-class requirement, not an implementation detail (R1).
- Test strategy runs on fictional numbers; real SMS is reserved for deliverability and final walkthrough (R4).

## Carried into Phase 2 as tasks

- Obtain and record the Zimbabwe rate; compute the FR-018a ceiling (R2).
- Run the deliverability test on real handsets and carriers (R3).
- Register debug and release SHA-256 certificates for Play Integrity (R1).
- Reserve and document fictional test numbers (R4).
