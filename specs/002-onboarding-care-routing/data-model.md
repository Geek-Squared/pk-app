# Phase 1: Data Model — Onboarding & Care Routing

Entities from `spec.md`, mapped onto Firestore. Field names are the contract
this feature writes; see `research.md` R7 on why reads must stay defensive.

---

## `intakes/{uid}`

One document per member, keyed by auth uid. Holds everything the member told
the programme. **Deliberately not on `users/{uid}`** — that document is read by
peers in group chats, and Firestore has no field-level read control (R1).

| Field | Type | Required | Notes |
|---|---|---|---|
| `uid` | string | yes | Matches the document id; denormalised for collection-group queries later |
| `fullName` | string | yes | FR-002. Distinct from `users.displayName`, which the member may have set to a pseudonym |
| `age` | number | yes | FR-002. Self-declared, unverified (FR-021) |
| `phoneNumber` | string | yes | FR-002. Contact only — not an auth factor, no SMS verification |
| `email` | string | yes | FR-003. Copied from the verified account, never retyped |
| `gender` | string | yes | FR-020 |
| `region` | string | yes | FR-020 |
| `language` | string | yes | FR-020 |
| `selectedInterventionIds` | string[] | yes | FR-005. May be empty — the default package then applies (FR-016) |
| `status` | `'in_progress' \| 'complete'` | yes | Drives `OnboardingGuard` |
| `completedSteps` | string[] | yes | Resume point for Story 2 |
| `consent` | map | yes | See below. Separate from the sign-up Terms/Privacy consent on `users/{uid}` |
| `createdAt` | timestamp | yes | |
| `updatedAt` | timestamp | yes | |
| `completedAt` | timestamp | no | Set once, when `status` becomes `complete` |

**`consent` map** (FR-019, FR-024):

| Field | Type | Notes |
|---|---|---|
| `demographicsVersion` | string | Version of the demographic-processing notice agreed to |
| `demographicsAgreedAt` | timestamp | |
| `demographicsWithdrawnAt` | timestamp \| null | FR-024. Withdrawal clears the three demographic fields; it must **not** cascade to the care assignment or workbook history |

**No free-text field exists on this document, by design** (FR-006). If one
appears in a later change, that is a spec violation, not an enhancement.

**Validation**
- `age` — positive integer, upper bound sanity-checked. No minimum: under-18s are admitted (FR-021).
- `phoneNumber` — digits plus optional leading `+`. Reuse the sanitiser already written for the Referrals call button rather than writing a second one.
- `selectedInterventionIds` — every id must exist and be currently selectable.
- `status` — may only move `in_progress` → `complete`. Never back.

---

## `careAssignments/{uid}`

The member's current package. Stored rather than derived, because an override
must be able to disagree with the member's own selection (R2).

| Field | Type | Required | Notes |
|---|---|---|---|
| `uid` | string | yes | |
| `interventionIds` | string[] | yes | The package. Never empty — default applies if selections were (FR-016) |
| `source` | `'self_selection' \| 'default' \| 'staff_override'` | yes | FR-013 |
| `overriddenBy` | string \| null | no | Staff uid when `source` is `staff_override` (FR-029) |
| `overrideReason` | string \| null | no | |
| `effectiveAt` | timestamp | yes | |
| `updatedAt` | timestamp | yes | |

**State transitions**

```
(no assignment)
      │ intake completed
      ▼
 self_selection ──── member edits selections ────▶ self_selection
      │                                                  │
      │ selections empty                                 │
      ▼                                                  │
   default ◀─────────────────────────────────────────────┘
      │
      │ staff assigns a different package
      ▼
 staff_override ──── member edits selections ────▶ staff_override
                     (FR-030: override is NOT
                      silently replaced)
```

The bottom transition is the one to get right. Once overridden, a member
editing their own selections must not silently revert the override — the change
is recorded and surfaced, not applied blindly.

### `careAssignments/{uid}/history/{autoId}`

A copy of each superseded assignment, written before the parent is updated.
Same fields, plus `supersededAt`. Append-only; never updated or deleted.

---

## `config/onboarding`

Single programme-managed document. Edited in the Firebase console for now
(R6) — no admin UI exists.

| Field | Type | Notes |
|---|---|---|
| `defaultInterventionIds` | string[] | Applied when a member selects nothing (FR-016). Must be non-empty |
| `adolescentAgeThreshold` | number | Default 18. Below this, the adolescent set is shown first (FR-005b) |
| `demographicsConsentVersion` | string | Written into each intake's consent map |
| `genderOptions` | string[] | Configurable so the list can change without a release |
| `regionOptions` | string[] | |
| `languageOptions` | string[] | |

---

## `interventions/{id}` — modified

New optional fields on the existing collection. Absent means "not selectable",
so **existing documents keep working untouched**.

| Field | Type | Notes |
|---|---|---|
| `selectableAtOnboarding` | boolean | Whether it appears as a pill (FR-005a) |
| `onboardingLabel` | string | Pill text; falls back to `name` |
| `onboardingOrder` | number | Pill ordering; falls back to existing `order` |
| `audience` | `'adolescent' \| 'adult' \| 'all'` | Drives the age-based default set (FR-005b). Absent means `'all'` |

Existing `visibility` / `allowedUserIds` are **not touched** — they remain the
tester allowlist and continue to apply on top of package filtering (R3).

---

## `users/{uid}` — one field only

| Field | Type | Notes |
|---|---|---|
| `onboardingStatus` | `'none' \| 'in_progress' \| 'complete'` | A non-sensitive mirror of `intakes/{uid}.status`, so the guard can decide without reading the intake document — and so peers reading this doc learn nothing beyond "has completed onboarding" |

Nothing else is added here. That restraint is the point of R1.

---

## Relationships

```
users/{uid} ──1:1── intakes/{uid} ──1:1── careAssignments/{uid}
     │                     │                      │
     │                     │                      └──1:N── history/{autoId}
     │                     │
     │                     └── selectedInterventionIds ──▶ interventions/{id}
     │
     └── workbooks (existing) ──▶ interventions/{id}
              │
              └── in-progress union with the package (FR-015)
```

---

## Migration

Existing members have no `intakes/{uid}` and no `onboardingStatus`. Both absent
is read as `'none'`, which triggers the Story 4 invitation. **No backfill runs
and no data is written to existing accounts** — an untouched account behaves
exactly as it does today until the member chooses to complete intake (FR-027).
