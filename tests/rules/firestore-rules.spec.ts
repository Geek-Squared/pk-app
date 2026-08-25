import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Rules suite for specs/003-firestore-security-rules.
 *
 * FR-015: every rule is asserted for BOTH what it permits and what it denies.
 * A rule tested only for what it allows is untested — it would still pass if
 * the rule were `allow read, write: if true`.
 */

const MEMBER_A = 'member-a';
const MEMBER_B = 'member-b';
const STAFF = 'staff-1';

let env: RulesTestEnvironment;

/** Seed data written with rules disabled, so fixtures are not themselves a test. */
async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', MEMBER_A), { uid: MEMBER_A, displayName: 'A' });
    await setDoc(doc(db, 'users', MEMBER_B), { uid: MEMBER_B, displayName: 'B' });
    await setDoc(doc(db, 'users', STAFF), { uid: STAFF, displayName: 'S', role: 'counsellor' });
    await setDoc(doc(db, 'users', MEMBER_A, 'notifications', 'n1'), { read: false });

    await setDoc(doc(db, 'chats', 'chat-ab'), { uids: [MEMBER_A, MEMBER_B], type: 'private' });
    await setDoc(doc(db, 'workbooks', 'wb-a'), { uid: MEMBER_A, coinBalance: 0 });

    for (const c of ['interventions', 'chapters', 'posts', 'questions', 'categories', 'referrals']) {
      await setDoc(doc(db, c, 'x1'), { name: 'x' });
    }
    await setDoc(doc(db, 'surveys', 's1'), { title: 's' });
    await setDoc(doc(db, 'surveys', 's1', 'responses', 'r-a'), { uid: MEMBER_A });
    await setDoc(doc(db, 'bookings', 'b1'), { uid: MEMBER_A, phoneNumber: '000' });
    await setDoc(doc(db, 'feedback', 'f1'), { uid: MEMBER_A });
    await setDoc(doc(db, 'adminNotifications', 'an1'), { x: 1 });
    await setDoc(doc(db, 'knowledge_index', 'k1'), { text: 'x' });
  });
}

const asA = () => env.authenticatedContext(MEMBER_A).firestore();
const asB = () => env.authenticatedContext(MEMBER_B).firestore();
const asStaff = () => env.authenticatedContext(STAFF).firestore();
const anon = () => env.unauthenticatedContext().firestore();

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'pk-rules-test',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: readFileSync(join(__dirname, '..', '..', 'firestore.rules'), 'utf8'),
    },
  });
});

afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await seed(); });

// ---------------------------------------------------------------------------

describe('unauthenticated access (FR-007, SC-002)', () => {
  const collections = [
    'users', 'chats', 'workbooks', 'interventions', 'chapters', 'posts',
    'questions', 'categories', 'referrals', 'surveys', 'bookings', 'feedback',
    'adminNotifications', 'knowledge_index',
  ];

  it.each(collections)('denies anonymous read of %s', async (c) => {
    await assertFails(getDoc(doc(anon(), c, 'x1')));
  });

  it('denies anonymous write', async () => {
    await assertFails(setDoc(doc(anon(), 'users', 'anything'), { x: 1 }));
  });
});

describe('cross-member isolation (FR-008, SC-001)', () => {
  it('DENIES A writing B user document', async () => {
    await assertFails(updateDoc(doc(asA(), 'users', MEMBER_B), { displayName: 'hacked' }));
  });

  it('ALLOWS A writing own user document', async () => {
    await assertSucceeds(updateDoc(doc(asA(), 'users', MEMBER_A), { displayName: 'ok' }));
  });

  it('DENIES B reading A workbook', async () => {
    await assertFails(getDoc(doc(asB(), 'workbooks', 'wb-a')));
  });

  it('ALLOWS A reading own workbook', async () => {
    await assertSucceeds(getDoc(doc(asA(), 'workbooks', 'wb-a')));
  });

  it('DENIES B reading A notifications', async () => {
    await assertFails(getDoc(doc(asB(), 'users', MEMBER_A, 'notifications', 'n1')));
  });

  it('ALLOWS A reading own notifications', async () => {
    await assertSucceeds(getDoc(doc(asA(), 'users', MEMBER_A, 'notifications', 'n1')));
  });

  it('DENIES B reading A survey response', async () => {
    await assertFails(getDoc(doc(asB(), 'surveys', 's1', 'responses', 'r-a')));
  });

  it('ALLOWS A reading own survey response', async () => {
    await assertSucceeds(getDoc(doc(asA(), 'surveys', 's1', 'responses', 'r-a')));
  });
});

describe('account deletion still works (US2 regression)', () => {
  it('ALLOWS a member to delete their own user document', async () => {
    await assertSucceeds(deleteDoc(doc(asA(), 'users', MEMBER_A)));
  });

  it('DENIES a member deleting another member document', async () => {
    await assertFails(deleteDoc(doc(asA(), 'users', MEMBER_B)));
  });
});

describe('intake and care assignments (feature 002)', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'intakes', MEMBER_A), { uid: MEMBER_A, gender: 'x', region: 'y' });
      await setDoc(doc(db, 'careAssignments', MEMBER_A), { uid: MEMBER_A, interventionIds: [] });
      await setDoc(doc(db, 'config', 'onboarding'), { defaultInterventionIds: ['x1'] });
    });
  });

  it('ALLOWS a member to read their own intake', async () => {
    await assertSucceeds(getDoc(doc(asA(), 'intakes', MEMBER_A)));
  });

  it('DENIES a member reading another intake — the whole point of the split', async () => {
    await assertFails(getDoc(doc(asB(), 'intakes', MEMBER_A)));
  });

  it('ALLOWS staff to read an intake', async () => {
    await assertSucceeds(getDoc(doc(asStaff(), 'intakes', MEMBER_A)));
  });

  it('ALLOWS a member to write their own intake', async () => {
    await assertSucceeds(setDoc(doc(asA(), 'intakes', MEMBER_A), { gender: 'z' }, { merge: true }));
  });

  it('DENIES a member writing another intake', async () => {
    await assertFails(setDoc(doc(asB(), 'intakes', MEMBER_A), { gender: 'z' }, { merge: true }));
  });

  it('DENIES deleting an intake', async () => {
    await assertFails(deleteDoc(doc(asA(), 'intakes', MEMBER_A)));
  });

  it('ALLOWS a member to read their own care assignment', async () => {
    await assertSucceeds(getDoc(doc(asA(), 'careAssignments', MEMBER_A)));
  });

  it('DENIES a member reading another care assignment', async () => {
    await assertFails(getDoc(doc(asB(), 'careAssignments', MEMBER_A)));
  });

  it('ALLOWS appending to assignment history', async () => {
    await assertSucceeds(addDoc(collection(asA(), 'careAssignments', MEMBER_A, 'history'), { x: 1 }));
  });

  it('DENIES editing an existing history entry (append-only)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'careAssignments', MEMBER_A, 'history', 'h1'), { x: 1 });
    });
    await assertFails(setDoc(doc(asA(), 'careAssignments', MEMBER_A, 'history', 'h1'), { x: 2 }));
    await assertFails(deleteDoc(doc(asA(), 'careAssignments', MEMBER_A, 'history', 'h1')));
  });

  it('ALLOWS any member to read onboarding config', async () => {
    await assertSucceeds(getDoc(doc(asA(), 'config', 'onboarding')));
  });

  it('DENIES a member writing onboarding config', async () => {
    await assertFails(setDoc(doc(asA(), 'config', 'onboarding'), { x: 1 }));
  });
});

describe('chats are limited to participants (FR-008)', () => {
  it('ALLOWS a participant to read', async () => {
    await assertSucceeds(getDoc(doc(asA(), 'chats', 'chat-ab')));
  });

  it('DENIES a non-participant', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'chats', 'chat-other'), { uids: ['someone-else'] });
    });
    await assertFails(getDoc(doc(asA(), 'chats', 'chat-other')));
  });

  it('ALLOWS a participant to delete their chat (US2 regression)', async () => {
    await assertSucceeds(deleteDoc(doc(asA(), 'chats', 'chat-ab')));
  });

  it('DENIES a non-participant deleting a chat', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'chats', 'chat-other'), { uids: ['x', 'y'] });
    });
    await assertFails(deleteDoc(doc(asA(), 'chats', 'chat-other')));
  });

  it('DENIES creating a chat you are not in', async () => {
    await assertFails(addDoc(collection(asA(), 'chats'), { uids: [MEMBER_B] }));
  });

  it('ALLOWS creating a chat you are in', async () => {
    await assertSucceeds(addDoc(collection(asA(), 'chats'), { uids: [MEMBER_A, MEMBER_B] }));
  });
});

describe('curriculum is read-only to members (FR-010, US3)', () => {
  const curriculum = ['interventions', 'chapters', 'posts', 'questions', 'categories', 'referrals', 'surveys'];

  it.each(curriculum)('ALLOWS a member to read %s', async (c) => {
    await assertSucceeds(getDoc(doc(asA(), c, c === 'surveys' ? 's1' : 'x1')));
  });

  it.each(curriculum)('DENIES a member writing %s', async (c) => {
    await assertFails(setDoc(doc(asA(), c, 'new'), { name: 'injected' }));
  });

  it.each(curriculum)('ALLOWS staff writing %s', async (c) => {
    await assertSucceeds(setDoc(doc(asStaff(), c, 'new'), { name: 'ok' }));
  });
});

describe('staff capability (FR-011, FR-012, US4)', () => {
  it('ALLOWS staff to read any chat', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'chats', 'chat-other'), { uids: ['x', 'y'] });
    });
    await assertSucceeds(getDoc(doc(asStaff(), 'chats', 'chat-other')));
  });

  it('ALLOWS staff to read user profiles', async () => {
    await assertSucceeds(getDoc(doc(asStaff(), 'users', MEMBER_A)));
  });

  it('DENIES staff reading a member workbook (access without a use case)', async () => {
    await assertFails(getDoc(doc(asStaff(), 'workbooks', 'wb-a')));
  });

  it('FR-012: a user document with no role field is NOT staff', async () => {
    await assertFails(setDoc(doc(asA(), 'interventions', 'new'), { name: 'x' }));
  });

  it('FR-012: a user with no document at all is NOT staff', async () => {
    const ghost = env.authenticatedContext('no-such-user').firestore();
    await assertFails(setDoc(doc(ghost, 'interventions', 'new'), { name: 'x' }));
  });
});

describe('submission-only collections', () => {
  it.each(['bookings', 'feedback'])('ALLOWS a member to create %s', async (c) => {
    await assertSucceeds(addDoc(collection(asA(), c), { uid: MEMBER_A }));
  });

  it.each(['bookings', 'feedback'])('DENIES a member reading %s', async (c) => {
    await assertFails(getDoc(doc(asA(), c, c === 'bookings' ? 'b1' : 'f1')));
  });

  it.each(['bookings', 'feedback'])('ALLOWS staff reading %s', async (c) => {
    await assertSucceeds(getDoc(doc(asStaff(), c, c === 'bookings' ? 'b1' : 'f1')));
  });
});

describe('backend-only collections are closed to all clients (FR-025)', () => {
  it.each(['adminNotifications', 'knowledge_index'])('DENIES member read of %s', async (c) => {
    await assertFails(getDoc(doc(asA(), c, c === 'adminNotifications' ? 'an1' : 'k1')));
  });

  it.each(['adminNotifications', 'knowledge_index'])('DENIES even staff read of %s', async (c) => {
    await assertFails(getDoc(doc(asStaff(), c, c === 'adminNotifications' ? 'an1' : 'k1')));
  });
});

describe('the queries the app actually issues (US2, FR-017)', () => {
  // Firestore evaluates rules against a QUERY differently from a document get:
  // the query must be provably safe for every document it could return. A rule
  // that permits getDoc can still reject the equivalent query, so these mirror
  // the real service calls rather than re-testing document reads.

  it('workbook.service: where uid == me — ALLOWED', async () => {
    await assertSucceeds(getDocs(query(
      collection(asA(), 'workbooks'), where('uid', '==', MEMBER_A)
    )));
  });

  it('workbooks: unfiltered list — DENIED', async () => {
    await assertFails(getDocs(collection(asA(), 'workbooks')));
  });

  it('workbooks: querying someone else uid — DENIED', async () => {
    await assertFails(getDocs(query(
      collection(asA(), 'workbooks'), where('uid', '==', MEMBER_B)
    )));
  });

  it('chat.service: where uids array-contains me — ALLOWED', async () => {
    await assertSucceeds(getDocs(query(
      collection(asA(), 'chats'), where('uids', 'array-contains', MEMBER_A)
    )));
  });

  it('chats: unfiltered list — DENIED', async () => {
    await assertFails(getDocs(collection(asA(), 'chats')));
  });

  it('survey.service: responses where uid == me — ALLOWED', async () => {
    await assertSucceeds(getDocs(query(
      collection(asA(), 'surveys', 's1', 'responses'), where('uid', '==', MEMBER_A)
    )));
  });

  it('users.service getUsers: unfiltered list — ALLOWED (messaging depends on it)', async () => {
    await assertSucceeds(getDocs(collection(asA(), 'users')));
  });

  it('interventions.service: ordered list — ALLOWED', async () => {
    await assertSucceeds(getDocs(collection(asA(), 'interventions')));
  });
});

describe('no catch-all rule remains (FR-002)', () => {
  it('DENIES access to a collection with no explicit rule', async () => {
    await assertFails(getDoc(doc(asA(), 'someCollectionNobodyDefined', 'x')));
    await assertFails(setDoc(doc(asA(), 'someCollectionNobodyDefined', 'x'), { a: 1 }));
  });
});
