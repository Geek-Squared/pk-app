# Contract: Firestore Security Rules

**This repository currently has no `firestore.rules` file.** `firebase.json`
registers `firestore.indexes.json` only, and no `.rules` file exists anywhere in
the tree. Whatever rules are live were applied outside version control.

That is the enforcement gap behind FR-023 (restrict demographic access),
FR-024 (withdrawable consent) and FR-021 (minors' sensitive data). Client-side
filtering is not a security control — any caller with the project config can
read a collection the rules permit.

## Deployment hazard — read before writing the file

Deploying a rules file **replaces the entire live ruleset**. A file covering
only the new collections would silently strip protection from `users`, `chats`,
`workbooks` and everything else.

So this cannot be scoped to the new collections. Before writing anything:

1. Export the live rules from the Firebase console (Firestore → Rules).
2. Commit them **unchanged** as `firestore.rules`, as a baseline commit.
3. Register the file in `firebase.json`.
4. Only then add the rules below, as a reviewable diff.

Skipping step 1 risks a production lockout or, worse, a silent opening-up.

## Required rules for this feature

```
// intakes/{uid} — the member's own intake. Demographics live here precisely
// so that peers reading users/{uid} cannot see them.
match /intakes/{uid} {
  allow read:   if request.auth.uid == uid || isStaff();
  allow create: if request.auth.uid == uid;
  allow update: if request.auth.uid == uid || isStaff();
  allow delete: if false;   // retained; consent withdrawal clears fields
}

// careAssignments/{uid} — readable by the member, written by staff or by the
// member's own intake completion.
match /careAssignments/{uid} {
  allow read:   if request.auth.uid == uid || isStaff();
  allow write:  if request.auth.uid == uid || isStaff();

  match /history/{entry} {
    allow read:   if request.auth.uid == uid || isStaff();
    allow create: if request.auth.uid == uid || isStaff();
    allow update, delete: if false;   // append-only
  }
}

// config/onboarding — world-readable to signed-in members, staff-writable.
match /config/{doc} {
  allow read:  if request.auth != null;
  allow write: if isStaff();
}
```

`isStaff()` must resolve the `administrator` / `counsellor` roles the app
already uses. **Prefer a custom claim over a `get()` on `users/{uid}`** — a
`get()` inside a rule is billed per evaluation and runs on every read.
`processSignUp` already sets a `client` claim, so the claim mechanism exists.

## Verification

Rules are testable, so Principle IV applies literally: use the Firestore
emulator with `@firebase/rules-unit-testing`. Minimum cases —

- A member reads and writes their own `intakes/{uid}`. **Allow.**
- A member reads another member's `intakes/{uid}`. **Deny.** This is the case
  that motivated the whole collection split; if it passes, R1 was wasted.
- An unauthenticated client reads any intake. **Deny.**
- A member writes their own `careAssignments/{uid}/history` entry. **Allow.**
- Anyone updates or deletes an existing history entry. **Deny.**
- A non-staff member writes `config/onboarding`. **Deny.**
- Existing collections behave exactly as they did before the baseline commit.

The last one is the regression guard for the deployment hazard above.
