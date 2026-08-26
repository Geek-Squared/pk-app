# Rollback procedure — Firestore security rules

**Read this before deploying, not after.** FR-021b requires the drill be
rehearsed first, because there is no staging project and no canary: the deploy
is total and atomic.

Written so someone who did not author the change can execute it.

## When to roll back

Roll back immediately, without debugging, if after deployment:

- Members report anything failing that worked before, **or**
- `permission-denied` errors appear in logs or the console, **or**
- Anyone cannot reach a counsellor or the crisis path.

Diagnose afterwards. The exposure being fixed has existed since 2021; a few
more hours of it costs less than a member unable to reach support.

## Roll back

The previous ruleset is commit **`2004594`**, the verbatim export of what was
live from 2021-07-11 until this change.

```bash
cd <repo root>
nvm use                                    # 22.12

# 1. Restore the previous ruleset
git show 2004594:firestore.rules > firestore.rules

# 2. Confirm it is the old one — it must contain a single blanket allow
grep -A2 "document=\*\*" firestore.rules

# 3. Deploy ONLY the rules
npx firebase deploy --only firestore:rules --project positive-konnections-42d8a
```

Takes under five minutes. SC-007 allows fifteen.

**Do not** run `firebase deploy` without `--only firestore:rules`. A bare
deploy also ships Cloud Functions, which is a second change on top of an
incident.

## Verify the rollback worked

1. Sign in as a normal member.
2. Open messages, a chat, the workbook, and interventions.
3. Confirm the failing operation now succeeds.

## After rolling back

Restore the tightened rules in the working tree so the fix is not lost:

```bash
git checkout HEAD -- firestore.rules
```

Then reproduce the failure in the emulator (`npm run test:rules`) and add a
test for it before trying again. A failure that reached production is a missing
test case, not a reason to widen the rule until the error stops.

## Important: this repository can now deploy rules

`firestore.rules` is registered in `firebase.json`, so **`firebase deploy` with
no `--only` flag will ship these rules** alongside functions and hosting. That
is intended — it is how the fix ships — but it means an unrelated deploy now
carries the rules change with it. Until the rules deployment is deliberately
made, prefer `--only functions` or `--only hosting` for unrelated work.
