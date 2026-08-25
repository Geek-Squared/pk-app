# Contract: Firestore Documents & Client Interfaces

The app exposes no HTTP API — its interfaces are Firestore document shapes and
the TypeScript models that read them. Those are the contracts here.

**With self-selection there is no server-side computation, so no new Cloud
Function is added.** `functions/` is untouched by this feature.

---

## Read defensively

The live Firestore data is not visible from the repository (research R7). This
codebase has already been bitten by that exact gap: `models/referrals.interface.ts`
declares `phone`, both referrals templates read `phoneNumber`, and with
`strictTemplates` off it compiled silently and rendered nothing.

So, for every document this feature reads but does not own:

- Treat new fields as optional, with a defined fallback.
- Never assume a field exists because an interface says so.
- Route field access through one accessor rather than reading it inline in
  templates — the same fix applied to `phoneOf()` on the Referrals page.

Documents this feature **owns** (`intakes`, `careAssignments`, `config/onboarding`)
can be trusted, because nothing else writes them.

---

## TypeScript models

```ts
// src/app/models/intake.interface.ts
export type IntakeStatus = 'in_progress' | 'complete';

export interface IntakeConsent {
  demographicsVersion: string;
  demographicsAgreedAt: any;              // Firestore Timestamp
  demographicsWithdrawnAt?: any | null;
}

export interface Intake {
  uid: string;
  fullName: string;
  age: number;
  phoneNumber: string;
  email: string;
  gender: string;
  region: string;
  language: string;
  selectedInterventionIds: string[];
  status: IntakeStatus;
  completedSteps: string[];
  consent: IntakeConsent;
  createdAt: any;
  updatedAt: any;
  completedAt?: any;
  // No free-text field. See FR-006 — its absence is a requirement.
}
```

```ts
// src/app/models/care-assignment.interface.ts
export type CareAssignmentSource = 'self_selection' | 'default' | 'staff_override';

export interface CareAssignment {
  uid: string;
  interventionIds: string[];
  source: CareAssignmentSource;
  overriddenBy?: string | null;
  overrideReason?: string | null;
  effectiveAt: any;
  updatedAt: any;
}
```

```ts
// src/app/models/intervention.interface.ts — MODIFIED
export interface Intervention {
  name: string;
  createdDate: string;
  id: string;
  order?: number;

  // Added by this feature. All optional: an existing document with none of
  // these is simply not selectable, and keeps working untouched.
  selectableAtOnboarding?: boolean;
  onboardingLabel?: string;
  onboardingOrder?: number;
  audience?: 'adolescent' | 'adult' | 'all';
}
```

---

## Service contracts

```ts
// src/app/services/intake.service.ts
getIntake(uid: string): Observable<Intake | null>;
saveStep(uid: string, step: string, data: Partial<Intake>): Promise<void>;
completeIntake(uid: string): Promise<void>;
saveDraft(uid: string, step: string, data: any): void;    // localStorage mirror
readDraft(uid: string, step: string): any | null;
clearDraft(uid: string): void;
withdrawDemographicsConsent(uid: string): Promise<void>;  // FR-024
```

`saveStep` writes with `{ merge: true }` so a completed step is durable
immediately (research R4). `completeIntake` composes the package and writes the
assignment; it is the only place `status` becomes `'complete'`.

```ts
// src/app/services/care-package.service.ts
getAssignment(uid: string): Observable<CareAssignment | null>;
composeFromSelections(uid: string, ids: string[]): Promise<CareAssignment>;
applyStaffOverride(uid: string, ids: string[], staffUid: string, reason: string): Promise<void>;
visibleInterventionIds(uid: string): Observable<string[]>;  // package ∪ in-progress
```

`visibleInterventionIds` is the union in FR-015 — deselecting something you had
already begun must not make your own progress unreachable.

```ts
// src/app/services/interventions.service.ts — MODIFIED
getSelectableInterventions(age: number): Observable<Intervention[]>;
```

Returns interventions with `selectableAtOnboarding === true`, ordered by
`onboardingOrder ?? order`, with the audience matching the age placed first
(FR-005b).

---

## Guard contract

```ts
// src/app/guards/onboarding.guard.ts
canActivate(): Observable<boolean | UrlTree>;
```

Runs **after** `AuthGuard` on the protected subtree. Reads
`users/{uid}.onboardingStatus` — not the intake document — so the guard costs
one read of a document already fetched, and reveals nothing sensitive.

- `'complete'` → allow
- `'in_progress'` or absent, and the member is **new** → redirect to `/onboarding`
- absent, and the member is **existing** (has workbook history) → allow, and
  show the Story 4 invitation rather than blocking (FR-027)

That last branch is the one to get right: an existing member with years of
progress must never be locked out by a form they have not filled in.

---

## Route contract

| Route | Guard | Notes |
|---|---|---|
| `/onboarding` | `AuthGuard` | Lazy-loaded. Not behind `OnboardingGuard` — that would be circular |
| everything under the protected tree | `AuthGuard`, `OnboardingGuard` | |

Order relative to the existing first-run walkthrough:
`verify-email` → `/onboarding` → `/how-to-use` → `/home`.

The walkthrough is currently triggered by a redirect inside
`HomePage.ngOnInit`, not a guard. Do not deepen that pattern — but do verify
the two together, or a member can be bounced between them.
