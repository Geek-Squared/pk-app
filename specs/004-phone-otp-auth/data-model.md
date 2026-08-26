# Phase 1 Data Model: Phone Number Sign-In

**Feature**: `004-phone-otp-auth` | **Date**: 2026-08-26

Two new collections. Neither is readable by any client.

---

## Canonical phone number (FR-004)

One representation, everywhere: **`+263` followed by nine digits beginning with `7`.**

```
+263771234567
```

Zimbabwean mobile numbers have a nine-digit national significant number starting with `7` (`71` NetOne, `73` Telecel, `77`/`78` Econet). The same number is commonly written `0771234567`, `771234567`, `+263 77 123 4567` or `263-77-123-4567`; all must resolve to one value, or one person becomes two accounts.

Landlines and non-Zimbabwean numbers are **rejected at canonicalisation**, not later. This is FR-016 enforced at the earliest possible point: a number that cannot be canonicalised never reaches an SMS send, so it cannot cost anything.

Implemented as `toE164()` in `functions/src/phone.ts` — a pure function, tested independently of Firebase, and the single definition both the eligibility callable and the cohort document id use.

---

## `phoneCohort/{e164}`

Who may register by phone during the cohort launch (FR-026 to FR-030).

| Field | Type | Notes |
|---|---|---|
| *(document id)* | string | The canonical `+263…` number. Being the id is what makes duplicates impossible. |
| `addedAt` | number | epoch ms |
| `addedBy` | string | uid of the staff member |
| `note` | string? | optional — which cohort, or why |
| `registeredAt` | number? | set when the number completes registration; absent means invited, not yet joined |

**Access**: none for clients, read or write (FR-028). Only Cloud Functions touch it. This is a list of phone numbers of people in an HIV programme — it is sensitive in its own right, and the temptation to make the pre-auth check convenient by opening it is the failure mode to design against.

**Why a collection and not Remote Config**: staff must edit it from the admin portal without a release, and every change must be recorded (FR-030). Remote Config satisfies neither.

---

## `identityChanges/{autoId}`

The record of every staff-executed identity action (FR-014).

| Field | Type | Notes |
|---|---|---|
| `type` | string | `cohort_add` \| `cohort_remove` \| `recovery` \| `number_change` |
| `subjectUid` | string? | the member acted upon; absent for a cohort change on a number with no account yet |
| `subjectPhone` | string? | canonical form |
| `actorUid` | string | who performed it |
| `actorRole` | string | captured at the time — a role can change later, the record must not |
| `at` | number | epoch ms |
| `detail` | map? | before/after for a number change |

**Access**: staff read, no client write. Written only by Functions. An audit record must not be editable by the people it describes, which is why this is its own collection rather than a subcollection under `users/{uid}` where the member has write access.

**Retention**: kept indefinitely for now. If a retention limit is wanted it is a programme decision, not a technical one, and should be recorded as such.

---

## `users/{uid}` — modified

| Field | Change |
|---|---|
| `email` | Becomes **optional**. Never written as `''` or a placeholder to satisfy a field that expects one (FR-003). |
| `phoneNumber` | **New**, optional, canonical form. Present when the account has a verified phone. |

An account has at least one of the two. Both is the linked state (User Story 4).

Nothing else changes. No query anywhere filters on `email` — verified by sweep — so making it optional has no read-path consequences.

---

## What deliberately does not change

- **`intakes/{uid}.phoneNumber`** is demographic data collected during onboarding. It is **not** an authentication identifier and must never be treated as one. A number there does not grant sign-in, and the two are not synchronised.
- The uid remains the sole key for all programme data. Nothing here changes what a workbook, chat, response or care assignment hangs from.
