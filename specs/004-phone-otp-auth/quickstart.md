# Quickstart: Phone Sign-In

**Feature**: `004-phone-otp-auth` | **Date**: 2026-08-26

How to work on this feature without sending SMS or spending money.

---

## Running the tests

```bash
npm run test:functions   # pure Functions logic — no emulator, no network
npm run test:rules       # Firestore rules, via the emulator
ng test                  # app code (Karma)
```

`test:functions` is new with this feature. It covers modules under `functions/src` that are free of Firebase imports — currently `phone.ts`. It deliberately does **not** load `functions/src/index.ts`, which calls `admin.initializeApp()` at import time and would reach for a live project.

That constraint is the design, not a limitation: logic worth testing gets its own module and is imported by `index.ts`. The eligibility callable (Phase 3) must be written that way.

---

## Fictional test numbers

Firebase supports phone numbers that never send an SMS and always accept a fixed passcode. Configure them at:

**Firebase console → Authentication → Sign-in method → Phone → Phone numbers for testing**

Use these for every kind of testing except the deliverability check in `research.md` R3 and a final pre-launch walkthrough.

### The trap

**There is one project.** `positive-konnections-42d8a` serves development and production both — there is no staging project, as recorded in feature 003's FR-021. A fictional number added "for testing" is live in production the moment it is saved, and anyone who enters it can sign in with the fixed code.

Therefore:

1. Use a **clearly non-real range** so a fictional number can never collide with a member's actual number.
2. **Record every number reserved** in the table below, in this file, as it is added.
3. **Remove them before general availability.** This belongs on the launch checklist, not on someone's memory.

| Number | Code | Purpose | Added | Removed |
|---|---|---|---|---|
| *(none reserved yet)* | | | | |

---

## Canonical form

Every phone number in this system is `+263` followed by nine digits starting with `7`.

```ts
import { toE164 } from './phone';

toE164('0771234567');      // '+263771234567'
toE164('+263 77 123 4567') // '+263771234567'
toE164('0242751234');      // null — Harare landline
toE164('+27821234567');    // null — South Africa
```

`null` means **do not send an SMS**. Rejection happens here, before anything reaches Firebase Auth, which is what makes the Zimbabwe-only restriction (FR-016) free rather than something billed and then refused.

Use `toE164()` for the `phoneCohort` document id. Being the id is what stops one person becoming two entries.

---

## What is not built yet

Phases 3 to 6. Specifically, nothing sends an SMS yet and no UI exists — Phase 2 is foundations only, and the app behaves exactly as it did before.

Phase 3 (the cohort gate and kill switch) is blocked on **T005, the deliverability test**, which needs real handsets on real Zimbabwean carriers. That gate is deliberate: if a passcode does not reliably arrive, the feature's premise changes rather than its implementation, and that is much cheaper to discover now.
