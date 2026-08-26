# Phase 1 Contracts: Callables and Guard States

**Feature**: `004-phone-otp-auth` | **Date**: 2026-08-26

---

## `checkPhoneEligibility` — unauthenticated

Decides whether a passcode may be sent, **before it is sent** (FR-027). Called from the registration screen by someone with no account.

**Request**: `{ phone: string }` — as typed by the person, any format.

**Response**: `{ status: 'eligible' | 'not_eligible' | 'closed' | 'invalid_number' }`

| Status | Meaning | What the person sees |
|---|---|---|
| `eligible` | Canonical, on the cohort list, registration open | Proceed to passcode |
| `not_eligible` | Canonical, not on the list | "Phone sign-in isn't open to you yet" + email route + contact (FR-029) |
| `closed` | Kill switch is off (FR-025) | Same as above, without implying they could be added |
| `invalid_number` | Not a Zimbabwean mobile number | "Enter a Zimbabwean mobile number" (FR-016a) |

**Errors**: `resource-exhausted` when rate-limited (FR-015).

### Rules this contract must hold to

- **It never returns the list, and never lets a caller enumerate it.** `not_eligible` and `closed` are deliberately close in effect; neither confirms anything about who *is* on the list.
- **It is unauthenticated by necessity** — the caller has no account yet — which makes it the most exposed surface in the feature. Rate limiting is part of the contract, not an optimisation.
- **No SMS is triggered by this call.** It only authorises the client to request one. The send happens through Firebase Auth afterwards.

---

## `recoverPhoneAccount` — administrator only

Restores access, or changes the number on an account (FR-013, FR-013a).

**Request**: `{ subjectUid: string, newPhone: string, reason: string }`

**Response**: `{ ok: true, phoneNumber: string }`

**Authorisation**: `assertAdmin` — administrators only. A counsellor calling this receives `permission-denied` and is expected to raise a request instead. This is the first place the administrator/counsellor split is load-bearing, which feature 003's FR-014a was written to make cheap.

**Errors**: `permission-denied` (not an administrator), `invalid-argument` (number not canonical), `already-exists` (number in use on another account), `not-found` (no such account).

**Side effects**, all of them required:

1. The old number can no longer sign in (US5 scenario 3).
2. An `identityChanges` record is written (FR-014).
3. `users/{uid}.phoneNumber` is updated to the canonical form.

---

## Guard states (T008)

The predicate for `AuthGuard`, exhaustively. Four states, and the current code gets the third one wrong for phone accounts.

| Signed in | Email verified | Phone present | Result |
|---|---|---|---|
| no | — | — | → `/login` |
| yes | yes | — | **admit** |
| yes | no | **yes** | **admit** — this is the new case |
| yes | no | no | → `/verify-email` |

Expressed as: *admit when there is a user AND (`emailVerified` OR a verified phone number on the account).*

A Firebase account's `phoneNumber` is only populated after a successful passcode, so its presence **is** the verification — there is no separate `phoneVerified` flag to check, and inventing one would be a second source of truth.

The bug this replaces: the current guard sends any account with `emailVerified === false` to `/verify-email`. A phone account's `emailVerified` is permanently false, so it loops forever on a page asking it to verify an email it does not have.
