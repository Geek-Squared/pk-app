# Security finding — live Firestore rules are effectively open

**Found**: 2026-08-25, executing task T005 (export the live ruleset).
**Project**: `positive-konnections-42d8a`
**Live ruleset**: `cae55955-b65d-42fd-a51b-de7a87576c5d`, last updated **2021-07-11** — over five years ago.
**Status**: NOT remediated. Exported verbatim to `firestore.rules`; nothing deployed.
**Decision (2026-08-25)**: **Option A** — remediation becomes its own feature. Onboarding (002) is paused at T007 until it lands.

T005 was written as a deployment-safety step: capture the baseline so the
feature's rules do not silently replace it. It turned into a security audit.

## What is live

```
match /databases/{database}/documents {
  match /{document=**} {
    allow read, update, write, delete: if isSignedIn();
  }
}
```

**Any signed-in account can read, write and delete every document in the
database.** Every member's profile, every private chat, every workbook
reflection, every counsellor conversation — readable and writable by any other
authenticated user, including a freshly registered one.

## The other three blocks do nothing

```
match /databases/chapters/documents { ... }
match /databases/posts/documents { ... }
match /databases/{database}/users { ... }
```

In Firestore, the path segment after `/databases/` is the **database name**
(always `(default)`), not a collection. `match /databases/chapters/documents`
therefore matches no request that can ever be issued. The same applies to
`posts`. The `users` block is malformed for the same reason — scoping a
collection requires `match /databases/{database}/documents/users/{uid}`.

So the intended protections — "only non-clients may write chapters and posts" —
have **never been in force**. The blanket allow above is the only rule doing
anything.

## Why this blocks the feature

Firestore evaluates every matching rule and grants access if **any** `allow`
matches. Rules are OR-ed, never AND-ed. There is no way to narrow access by
adding a more specific rule underneath a blanket allow — the blanket wins.

This means:

- **FR-023 cannot be satisfied by adding rules.** The planned
  `intakes/{uid}` rules would be evaluated alongside the global allow, and the
  global allow would grant the read regardless.
- **Research R1 is necessary but not sufficient.** Splitting demographics into
  their own collection stops peers seeing them *incidentally* when reading a
  user document for a chat avatar. It does not stop a deliberate read, because
  every collection is currently readable by every signed-in account.
- Task T010 — "a member cannot read another member's intake" — **would fail
  against the live rules today**, which is precisely what that gate was for.

## What this feature would add to the exposure

Intake introduces gender, region, language, full name, phone number and age,
for a population that includes people living with HIV and, per FR-021,
children. Writing that into a database where any signed-in account can read
everything materially raises the stakes of an already serious problem.

## Remediation is a decision, not a task

Tightening the global rule is the right fix and is **not** something to do
unilaterally. The current app almost certainly depends on the permissiveness in
places nobody has mapped — every collection the client reads today does so
under the blanket allow. Replacing it will break whatever was relying on it,
and this is a live mental-health service.

A safe sequence would be:

1. Enumerate every collection the client reads or writes, and the identity it
   does so as. `firestore.indexes.json`, the services under
   `src/app/services/`, and `functions/src/index.ts` are the inputs.
2. Write per-collection rules for all of them, not just the new ones.
3. Prove them against the emulator suite (`npm run test:rules`), including
   regression cases for existing behaviour.
4. Deploy to a staging project first if one exists.
5. Deploy, and watch for permission-denied errors.

Step 2 is a larger piece of work than this onboarding feature. It should
probably be its own spec.

## Immediate options

- **A — Fix rules first.** Treat this as its own feature, land it, then resume
  onboarding. Slowest, and the only one where onboarding actually satisfies
  FR-023 on delivery.
- **B — Fix rules alongside.** Expand this feature's scope to include the full
  ruleset. Contradicts constitution Principle II, and couples a UI feature to a
  risky production change.
- **C — Ship onboarding under current rules.** Fastest, and means knowingly
  writing minors' demographic data into a database every signed-in account can
  read. FR-023 would be documented as unmet.

Option C should not be chosen without the same legal review already flagged for
FR-021.

---

## Decision: Option A (2026-08-25)

Rules remediation is its own feature. Feature 002 is paused at T007 and resumes
once the ruleset is tightened and proven.

Rationale: the exposure exists today regardless of whether onboarding ships, so
it is not really "onboarding's problem to solve" — it is a live defect that
onboarding happened to surface. Fixing it inside 002 would also couple a UI
feature to a risky production change, which Principle II forbids.

Collections requiring rules, from the client and Functions inventory:

| Collection | Client | Functions | Live |
|---|---|---|---|
| `users` | ✓ | ✓ | ✓ |
| `chats` | ✓ | ✓ | ✓ |
| `workbooks` | ✓ | ✓ | ✓ |
| `interventions` | ✓ | ✓ | ✓ |
| `chapters` | ✓ | ✓ | ✓ |
| `posts` | ✓ | ✓ | ✓ |
| `questions` | ✓ | ✓ | ✓ |
| `categories` | — | — | ✓ |
| `surveys` | ✓ | — | ✓ |
| `bookings` | ✓ | — | ✓ |
| `feedback` | ✓ | — | ✓ |
| `referrals` | ✓ | — | ✓ |
| `adminNotifications` | — | ✓ | ✓ |
| `knowledge_index` | — | ✓ | ✓ |

`notifications` and `responses` are referenced in code but returned nothing
live — either unused or subcollections. Both need confirming rather than
assuming.
